import { randomUUID } from 'crypto';

import { Injectable } from '@nestjs/common';

import { QUEUE_CONFIG } from '../constants/push.constants';
import { PushOptions, QueuedUpload } from '../interfaces';

@Injectable()
export class LocalQueueService {
  private readonly queueConfig = QUEUE_CONFIG;
  private queue: Map<string, QueuedUpload> = new Map();

  async addToQueue(
    packagePath: string,
    options: PushOptions,
  ): Promise<string> {
    // TODO: Add upload to local queue (eventually use SQLite)
    const id = randomUUID();
    const queuedUpload: QueuedUpload = {
      id,
      packagePath,
      options,
      attempts: 0,
      status: 'pending',
    };
    
    this.queue.set(id, queuedUpload);
    return id;
  }

  async processQueue(): Promise<void> {
    // TODO: Process queued uploads when online
    for (const [_id, upload] of this.queue.entries()) {
      if (upload.status === 'pending') {
        // TODO: Process upload
        // Will be implemented when processing logic is added
      }
    }
  }

  async getQueueStatus(): Promise<QueuedUpload[]> {
    // Get current queue status
    return Array.from(this.queue.values());
  }

  async removeFromQueue(id: string): Promise<void> {
    this.queue.delete(id);
  }

  async updateQueueItem(
    id: string,
    updates: Partial<QueuedUpload>,
  ): Promise<void> {
    const item = this.queue.get(id);
    if (item) {
      this.queue.set(id, { ...item, ...updates });
    }
  }

  async clearQueue(): Promise<void> {
    this.queue.clear();
  }
}