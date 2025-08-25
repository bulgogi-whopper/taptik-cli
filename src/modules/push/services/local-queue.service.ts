import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { PushError, PushErrorCode } from '../constants/push.constants';
import { PushOptions, QueuedUpload } from '../interfaces';

interface QueueStorage {
  version: string;
  queue: QueuedUpload[];
}

@Injectable()
export class LocalQueueService implements OnModuleInit, OnModuleDestroy {
  private queue: Map<string, QueuedUpload> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;
  private saveDebounceTimer: NodeJS.Timeout | null = null;

  private readonly queueConfig = {
    filePath: path.join(os.homedir(), '.taptik', 'upload-queue.json'),
    syncInterval: 30000, // 30 seconds
    maxQueueSize: 100,
    maxRetryAttempts: 5,
    baseRetryDelay: 1000, // 1 second
    maxRetryDelay: 30000, // 30 seconds
    saveDebounceDelay: 1000, // 1 second
  };

  async onModuleInit(): Promise<void> {
    await this.loadQueue();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    await this.saveQueue();
  }

  private async loadQueue(): Promise<void> {
    try {
      if (fs.existsSync(this.queueConfig.filePath)) {
        const data = fs.readFileSync(this.queueConfig.filePath, 'utf-8');
        const storage: QueueStorage = JSON.parse(data);

        // Convert dates from strings
        for (const item of storage.queue) {
          if (item.lastAttempt) {
            item.lastAttempt = new Date(item.lastAttempt);
          }
          if (item.nextRetry) {
            item.nextRetry = new Date(item.nextRetry);
          }
          if (item.createdAt) {
            item.createdAt = new Date(item.createdAt);
          }
          if (item.updatedAt) {
            item.updatedAt = new Date(item.updatedAt);
          }
          this.queue.set(item.id, item);
        }
      }
    } catch (_error) {
      // Failed to load queue from disk - continue with empty queue
      // Continue with empty queue
    }
  }

  private async saveQueue(): Promise<void> {
    try {
      const dir = path.dirname(this.queueConfig.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const storage: QueueStorage = {
        version: '1.0.0',
        queue: Array.from(this.queue.values()),
      };

      fs.writeFileSync(
        this.queueConfig.filePath,
        JSON.stringify(storage, null, 2),
        'utf-8',
      );
    } catch (_error) {
      // Failed to save queue to disk - will retry on next change
    }
  }

  private debounceSave(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    this.saveDebounceTimer = setTimeout(() => {
      this.saveQueue();
    }, this.queueConfig.saveDebounceDelay);
  }

  async addToQueue(packagePath: string, options: PushOptions): Promise<string> {
    // Check queue size limit
    const queueSize = this.getQueueSize();
    if (queueSize >= this.queueConfig.maxQueueSize) {
      throw new PushError(
        PushErrorCode.QUEUE_FULL,
        `Queue is full. Maximum size is ${this.queueConfig.maxQueueSize}`,
        { currentSize: queueSize },
        false,
      );
    }

    // Check if file exists
    if (!fs.existsSync(packagePath)) {
      throw new PushError(
        PushErrorCode.FILE_NOT_FOUND,
        `Package file not found: ${packagePath}`,
        { path: packagePath },
        false,
      );
    }

    const id = this.generateQueueId();
    const now = new Date();

    const queuedUpload: QueuedUpload = {
      id,
      packagePath,
      options,
      attempts: 0,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    this.queue.set(id, queuedUpload);
    this.debounceSave();

    return id;
  }

  async removeFromQueue(id: string): Promise<void> {
    if (!this.queue.has(id)) {
      throw new PushError(
        PushErrorCode.QUEUE_ITEM_NOT_FOUND,
        `Queue item not found: ${id}`,
        { id },
        false,
      );
    }

    this.queue.delete(id);
    this.debounceSave();
  }

  async updateStatus(id: string, status: QueuedUpload['status']): Promise<void> {
    const item = this.queue.get(id);
    if (item) {
      item.status = status;
      item.lastAttempt = new Date();
      this.queue.set(id, item);
      await this.debounceSave();
    }
  }

  async incrementAttempts(id: string): Promise<void> {
    const item = this.queue.get(id);
    if (item) {
      item.attempts = (item.attempts || 0) + 1;
      item.lastAttempt = new Date();
      this.queue.set(id, item);
      await this.debounceSave();
    }
  }

  async updateQueueStatus(
    id: string,
    status: QueuedUpload['status'],
    error?: string,
  ): Promise<void> {
    const item = this.queue.get(id);
    if (!item) {
      throw new PushError(
        PushErrorCode.QUEUE_ITEM_NOT_FOUND,
        `Queue item not found: ${id}`,
        { id },
        false,
      );
    }

    item.status = status;
    item.error = error;
    item.updatedAt = new Date();

    this.queue.set(id, item);
    this.debounceSave();
  }

  async incrementRetryAttempt(id: string): Promise<number> {
    const item = this.queue.get(id);
    if (!item) {
      throw new PushError(
        PushErrorCode.QUEUE_ITEM_NOT_FOUND,
        `Queue item not found: ${id}`,
        { id },
        false,
      );
    }

    item.attempts++;
    item.lastAttempt = new Date();

    const retryDelay = this.calculateRetryDelay(item.attempts);
    item.nextRetry = new Date(Date.now() + retryDelay);
    item.updatedAt = new Date();

    this.queue.set(id, item);
    this.debounceSave();

    return item.attempts;
  }

  async getQueueStatus(): Promise<QueuedUpload[]> {
    const items = Array.from(this.queue.values());
    // Sort by createdAt in descending order (newest first)
    return items.sort((a, b) => {
      const aTime = a.createdAt?.getTime() || 0;
      const bTime = b.createdAt?.getTime() || 0;
      return bTime - aTime;
    });
  }

  async getPendingUploads(): Promise<QueuedUpload[]> {
    const now = Date.now();
    const items = Array.from(this.queue.values());

    return items
      .filter((item) => {
        if (item.status !== 'pending') return false;
        if (item.attempts >= this.queueConfig.maxRetryAttempts) return false;
        if (item.nextRetry && item.nextRetry.getTime() > now) return false;
        return true;
      })
      .sort((a, b) => {
        const aTime = a.createdAt?.getTime() || 0;
        const bTime = b.createdAt?.getTime() || 0;
        return aTime - bTime; // Oldest first for processing
      })
      .slice(0, 10); // Limit to 10 items per batch
  }

  async clearFailedUploads(olderThanDays: number = 7): Promise<number> {
    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    let cleared = 0;

    for (const [id, item] of this.queue.entries()) {
      if (
        item.status === 'failed' &&
        item.updatedAt &&
        item.updatedAt.getTime() < cutoffTime
      ) {
        this.queue.delete(id);
        cleared++;
      }
    }

    if (cleared > 0) {
      this.debounceSave();
    }

    return cleared;
  }

  async clearCompletedUploads(): Promise<number> {
    let cleared = 0;

    for (const [id, item] of this.queue.entries()) {
      if (item.status === 'completed') {
        this.queue.delete(id);
        cleared++;
      }
    }

    if (cleared > 0) {
      this.debounceSave();
    }

    return cleared;
  }

  async processQueue(): Promise<void> {
    // Process queue with external handler
    // This method is called manually or via background sync
    await this.getPendingUploads();

    // Processing will be handled by PushService
    // This just returns the pending uploads for processing
    return Promise.resolve();
  }

  startBackgroundSync(
    onProcess: (upload: QueuedUpload) => Promise<void>,
  ): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Process immediately on start
    this.processQueueWithHandler(onProcess);

    // Then process periodically
    this.syncInterval = setInterval(
      () => this.processQueueWithHandler(onProcess),
      this.queueConfig.syncInterval,
    );
  }

  stopBackgroundSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private async processQueueWithHandler(
    onProcess: (upload: QueuedUpload) => Promise<void>,
  ): Promise<void> {
    try {
      const pendingUploads = await this.getPendingUploads();

      // Process uploads sequentially

      for (const upload of pendingUploads) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await this.updateQueueStatus(upload.id, 'uploading');
          // eslint-disable-next-line no-await-in-loop
          await onProcess(upload);
          // eslint-disable-next-line no-await-in-loop
          await this.updateQueueStatus(upload.id, 'completed');
        } catch (error) {
          // eslint-disable-next-line no-await-in-loop
          const attempts = await this.incrementRetryAttempt(upload.id);

          if (attempts >= this.queueConfig.maxRetryAttempts) {
            // eslint-disable-next-line no-await-in-loop
            await this.updateQueueStatus(
              upload.id,
              'failed',
              error instanceof Error ? error.message : 'Unknown error',
            );
          } else {
            // eslint-disable-next-line no-await-in-loop
            await this.updateQueueStatus(
              upload.id,
              'pending',
              error instanceof Error ? error.message : 'Unknown error',
            );
          }
        }
      }
    } catch (_error) {
      // Error processing queue - will retry on next interval
      // Silent failure to avoid stopping the background sync
    }
  }

  private calculateRetryDelay(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = Math.min(
      this.queueConfig.baseRetryDelay * Math.pow(2, attempt),
      this.queueConfig.maxRetryDelay,
    );
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    return baseDelay + jitter;
  }

  private generateQueueId(): string {
    return `queue_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private getQueueSize(): number {
    return Array.from(this.queue.values()).filter(
      (item) => item.status !== 'completed',
    ).length;
  }

  async getQueuedUpload(id: string): Promise<QueuedUpload | null> {
    return this.queue.get(id) || null;
  }

  async clearQueue(): Promise<void> {
    this.queue.clear();
    this.debounceSave();
  }

  async updateQueueItem(
    id: string,
    updates: Partial<QueuedUpload>,
  ): Promise<void> {
    const item = this.queue.get(id);
    if (!item) {
      throw new PushError(
        PushErrorCode.QUEUE_ITEM_NOT_FOUND,
        `Queue item not found: ${id}`,
        { id },
        false,
      );
    }

    // Don't override updatedAt if it's being explicitly set
    const finalUpdates = updates.updatedAt
      ? updates
      : { ...updates, updatedAt: new Date() };

    Object.assign(item, finalUpdates);
    this.queue.set(id, item);
    this.debounceSave();
  }
}
