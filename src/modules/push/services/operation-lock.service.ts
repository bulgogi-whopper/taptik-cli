import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';

export interface LockInfo {
  pid: number;
  timestamp: Date;
  operation: string;
  userId?: string;
}

@Injectable()
export class OperationLockService {
  private readonly logger = new Logger(OperationLockService.name);
  private readonly lockDir: string;
  private readonly lockTimeout = 5 * 60 * 1000; // 5 minutes
  private readonly retryDelay = 100; // ms
  private readonly maxRetries = 50; // 5 seconds total

  constructor() {
    this.lockDir = path.join(os.tmpdir(), 'taptik-cli', 'locks');
    this.initializeLockDir();
  }

  /**
   * Initialize lock directory
   */
  private async initializeLockDir(): Promise<void> {
    try {
      await fs.mkdir(this.lockDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create lock directory', error);
    }
  }

  /**
   * Acquire a lock for an operation
   */
  async acquireLock(
    operation: string,
    resourceId: string,
    userId?: string,
    timeout: number = this.lockTimeout,
  ): Promise<boolean> {
    const lockFile = this.getLockPath(operation, resourceId);
    const lockInfo: LockInfo = {
      pid: process.pid,
      timestamp: new Date(),
      operation,
      userId,
    };

    // Use recursive approach instead of loop with await
    return this.tryAcquireLock(lockFile, lockInfo, operation, resourceId, timeout, 0);
  }

  /**
   * Recursive helper for acquiring lock without await in loop
   */
  private async tryAcquireLock(
    lockFile: string,
    lockInfo: LockInfo,
    operation: string,
    resourceId: string,
    timeout: number,
    attempt: number,
  ): Promise<boolean> {
    if (attempt >= this.maxRetries) {
      return false;
    }

    try {
      // Check if lock exists and is still valid
      const existingLock = await this.checkExistingLock(lockFile);

      if (existingLock) {
        // Check if lock is expired
        const lockAge = Date.now() - new Date(existingLock.timestamp).getTime();

        if (lockAge > timeout) {
          this.logger.warn(
            `Removing expired lock for ${operation}:${resourceId}`,
          );
          await this.forceReleaseLock(operation, resourceId);
        } else if (existingLock.pid === process.pid) {
          // Same process already has the lock
          return true;
        } else {
          // Lock is held by another process
          if (attempt === this.maxRetries - 1) {
            this.logger.debug(
              `Failed to acquire lock for ${operation}:${resourceId} after ${this.maxRetries} attempts`,
            );
            return false;
          }

          // Wait and retry
          await this.sleep(this.retryDelay);
          return this.tryAcquireLock(lockFile, lockInfo, operation, resourceId, timeout, attempt + 1);
        }
      }

      // Try to create lock file (atomic operation)
      await fs.writeFile(lockFile, JSON.stringify(lockInfo, null, 2), {
        flag: 'wx',
      });

      this.logger.debug(`Acquired lock for ${operation}:${resourceId}`);
      return true;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        // Lock file already exists, retry
        if (attempt === this.maxRetries - 1) {
          this.logger.debug(
            `Lock already exists for ${operation}:${resourceId}`,
          );
          return false;
        }

        await this.sleep(this.retryDelay);
        return this.tryAcquireLock(lockFile, lockInfo, operation, resourceId, timeout, attempt + 1);
      } else {
        this.logger.error(
          `Error acquiring lock for ${operation}:${resourceId}`,
          error,
        );
        return false;
      }
    }
  }

  /**
   * Release a lock
   */
  async releaseLock(operation: string, resourceId: string): Promise<void> {
    const lockFile = this.getLockPath(operation, resourceId);

    try {
      // Verify that current process owns the lock
      const lockInfo = await this.checkExistingLock(lockFile);

      if (lockInfo && lockInfo.pid === process.pid) {
        await fs.unlink(lockFile);
        this.logger.debug(`Released lock for ${operation}:${resourceId}`);
      } else if (lockInfo) {
        this.logger.warn(
          `Cannot release lock for ${operation}:${resourceId} - owned by PID ${lockInfo.pid}`,
        );
      }
    } catch {
      this.logger.debug(`Lock not found for ${operation}:${resourceId}`);
    }
  }

  /**
   * Force release a lock (admin operation)
   */
  async forceReleaseLock(operation: string, resourceId: string): Promise<void> {
    const lockFile = this.getLockPath(operation, resourceId);

    try {
      await fs.unlink(lockFile);
      this.logger.warn(`Force released lock for ${operation}:${resourceId}`);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error(
          `Error force releasing lock for ${operation}:${resourceId}`,
          error,
        );
      }
    }
  }

  /**
   * Check if a lock exists
   */
  async isLocked(operation: string, resourceId: string): Promise<boolean> {
    const lockFile = this.getLockPath(operation, resourceId);
    const lockInfo = await this.checkExistingLock(lockFile);

    if (!lockInfo) {
      return false;
    }

    // Check if lock is expired
    const lockAge = Date.now() - new Date(lockInfo.timestamp).getTime();

    if (lockAge > this.lockTimeout) {
      // Clean up expired lock
      await this.forceReleaseLock(operation, resourceId);
      return false;
    }

    return true;
  }

  /**
   * Get lock information
   */
  async getLockInfo(
    operation: string,
    resourceId: string,
  ): Promise<LockInfo | null> {
    const lockFile = this.getLockPath(operation, resourceId);
    return this.checkExistingLock(lockFile);
  }

  /**
   * Wait for a lock to be released
   */
  async waitForLock(
    operation: string,
    resourceId: string,
    maxWaitTime: number = 30000,
  ): Promise<boolean> {
    const startTime = Date.now();
    return this.checkLockRelease(operation, resourceId, startTime, maxWaitTime);
  }

  /**
   * Recursive helper for waiting for lock release without await in loop
   */
  private async checkLockRelease(
    operation: string,
    resourceId: string,
    startTime: number,
    maxWaitTime: number,
  ): Promise<boolean> {
    if (Date.now() - startTime >= maxWaitTime) {
      return false;
    }

    if (!(await this.isLocked(operation, resourceId))) {
      return true;
    }

    await this.sleep(this.retryDelay);
    return this.checkLockRelease(operation, resourceId, startTime, maxWaitTime);
  }

  /**
   * Execute an operation with automatic lock management
   */
  async executeWithLock<T>(
    operation: string,
    resourceId: string,
    callback: () => Promise<T>,
    userId?: string,
  ): Promise<T | null> {
    const acquired = await this.acquireLock(operation, resourceId, userId);

    if (!acquired) {
      this.logger.warn(`Failed to acquire lock for ${operation}:${resourceId}`);
      return null;
    }

    try {
      return await callback();
    } finally {
      await this.releaseLock(operation, resourceId);
    }
  }

  /**
   * Clean up expired locks
   */
  async cleanupExpiredLocks(): Promise<void> {
    try {
      const files = await fs.readdir(this.lockDir);
      const lockFiles = files.filter(file => file.endsWith('.lock'));

      // Process all lock files in parallel
      const cleanupOperations = lockFiles.map(async (file) => {
        const lockFile = path.join(this.lockDir, file);
        const lockInfo = await this.checkExistingLock(lockFile);

        if (lockInfo) {
          const lockAge = Date.now() - new Date(lockInfo.timestamp).getTime();

          if (lockAge > this.lockTimeout) {
            await fs.unlink(lockFile);
            this.logger.debug(`Cleaned up expired lock: ${file}`);
          }
        }
      });

      // Wait for all cleanup operations to complete
      await Promise.allSettled(cleanupOperations);
    } catch (error) {
      this.logger.error('Error cleaning up expired locks', error);
    }
  }

  /**
   * List all active locks
   */
  async listActiveLocks(): Promise<Array<LockInfo & { resource: string }>> {
    try {
      const files = await fs.readdir(this.lockDir);
      const lockFiles = files.filter(file => file.endsWith('.lock'));

      // Process all lock files in parallel
      const lockInfoPromises = lockFiles.map(async (file) => {
        const lockFile = path.join(this.lockDir, file);
        const lockInfo = await this.checkExistingLock(lockFile);

        if (lockInfo) {
          const lockAge = Date.now() - new Date(lockInfo.timestamp).getTime();

          if (lockAge <= this.lockTimeout) {
            return {
              ...lockInfo,
              resource: file.replace('.lock', ''),
            };
          }
        }
        return null;
      });

      // Wait for all lock info operations to complete
      const results = await Promise.allSettled(lockInfoPromises);
      
      // Filter out failed promises and null results
      return results
        .filter((result): result is PromiseFulfilledResult<LockInfo & { resource: string }> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value);
    } catch (error) {
      this.logger.error('Error listing active locks', error);
      return [];
    }
  }

  /**
   * Get lock file path
   */
  private getLockPath(operation: string, resourceId: string): string {
    const lockName = `${operation}_${resourceId}`.replace(/[^\w-]/g, '_');
    return path.join(this.lockDir, `${lockName}.lock`);
  }

  /**
   * Check existing lock file
   */
  private async checkExistingLock(lockFile: string): Promise<LockInfo | null> {
    try {
      const content = await fs.readFile(lockFile, 'utf-8');
      return JSON.parse(content) as LockInfo;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error(`Error reading lock file: ${lockFile}`, error);
      }
      return null;
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clean up on module destroy
   */
  onModuleDestroy(): void {
    // Clean up any locks held by this process
    this.cleanupExpiredLocks().catch((error) =>
      this.logger.error('Failed to cleanup locks on shutdown', error),
    );
  }
}
