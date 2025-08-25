import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { PushError } from '../constants/push.constants';
import { PushOptions, QueuedUpload } from '../interfaces';

import { LocalQueueService } from './local-queue.service';

describe('LocalQueueService', () => {
  let service: LocalQueueService;
  let testFilePath: string;

  beforeEach(async () => {
    // Use a test file in temp directory
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taptik-test-'));
    testFilePath = path.join(tempDir, 'upload-queue.json');

    const module: TestingModule = await Test.createTestingModule({
      providers: [LocalQueueService],
    }).compile();

    service = module.get<LocalQueueService>(LocalQueueService);
    
    // Override the file path for testing
    (service as any).queueConfig.filePath = testFilePath;
    
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    
    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    
    // Clean up temp directory
    const tempDir = path.dirname(testFilePath);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('addToQueue', () => {
    it('should add a package to the queue', async () => {
      // Create a temporary test file
      const tempFile = path.join(os.tmpdir(), 'test-package.taptik');
      fs.writeFileSync(tempFile, 'test content');

      const options: PushOptions = {
        public: true,
        title: 'Test Package',
      };

      try {
        const id = await service.addToQueue(tempFile, options);
        
        expect(id).toBeDefined();
        expect(id).toMatch(/^queue_\d+_[\da-z]+$/);
        
        // Verify it was added to database
        const queued = await service.getQueuedUpload(id);
        expect(queued).toBeDefined();
        expect(queued?.packagePath).toBe(tempFile);
        expect(queued?.options).toEqual(options);
        expect(queued?.status).toBe('pending');
        expect(queued?.attempts).toBe(0);
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    it('should throw error if file does not exist', async () => {
      const options: PushOptions = {
        public: true,
      };

      await expect(
        service.addToQueue('/non/existent/file.taptik', options)
      ).rejects.toThrow(PushError);

      await expect(
        service.addToQueue('/non/existent/file.taptik', options)
      ).rejects.toThrow('Package file not found');
    });

    it('should enforce queue size limit', async () => {
      // Override max queue size for testing
      (service as any).queueConfig.maxQueueSize = 2;

      const tempFile = path.join(os.tmpdir(), 'test-package.taptik');
      fs.writeFileSync(tempFile, 'test content');

      const options: PushOptions = { public: true };

      try {
        // Add two items (at the limit)
        await service.addToQueue(tempFile, options);
        await service.addToQueue(tempFile, options);

        // Third should fail
        await expect(
          service.addToQueue(tempFile, options)
        ).rejects.toThrow('Queue is full');
      } finally {
        fs.unlinkSync(tempFile);
      }
    });
  });

  describe('removeFromQueue', () => {
    it('should remove an item from the queue', async () => {
      const tempFile = path.join(os.tmpdir(), 'test-package.taptik');
      fs.writeFileSync(tempFile, 'test content');

      try {
        const id = await service.addToQueue(tempFile, { public: true });
        
        await service.removeFromQueue(id);
        
        const queued = await service.getQueuedUpload(id);
        expect(queued).toBeNull();
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    it('should throw error if item not found', async () => {
      await expect(
        service.removeFromQueue('non-existent-id')
      ).rejects.toThrow('Queue item not found');
    });
  });

  describe('updateQueueStatus', () => {
    it('should update queue item status', async () => {
      const tempFile = path.join(os.tmpdir(), 'test-package.taptik');
      fs.writeFileSync(tempFile, 'test content');

      try {
        const id = await service.addToQueue(tempFile, { public: true });
        
        await service.updateQueueStatus(id, 'uploading');
        
        let queued = await service.getQueuedUpload(id);
        expect(queued?.status).toBe('uploading');
        
        await service.updateQueueStatus(id, 'completed');
        
        queued = await service.getQueuedUpload(id);
        expect(queued?.status).toBe('completed');
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    it('should update error message', async () => {
      const tempFile = path.join(os.tmpdir(), 'test-package.taptik');
      fs.writeFileSync(tempFile, 'test content');

      try {
        const id = await service.addToQueue(tempFile, { public: true });
        
        await service.updateQueueStatus(id, 'failed', 'Network error');
        
        const queued = await service.getQueuedUpload(id);
        expect(queued?.status).toBe('failed');
        expect(queued?.error).toBe('Network error');
      } finally {
        fs.unlinkSync(tempFile);
      }
    });
  });

  describe('incrementRetryAttempt', () => {
    it('should increment retry attempts', async () => {
      const tempFile = path.join(os.tmpdir(), 'test-package.taptik');
      fs.writeFileSync(tempFile, 'test content');

      try {
        const id = await service.addToQueue(tempFile, { public: true });
        
        const attempts = await service.incrementRetryAttempt(id);
        expect(attempts).toBe(1);
        
        const queued = await service.getQueuedUpload(id);
        expect(queued?.attempts).toBe(1);
        expect(queued?.lastAttempt).toBeDefined();
        expect(queued?.nextRetry).toBeDefined();
        
        // Next retry should be in the future
        expect(queued!.nextRetry!.getTime()).toBeGreaterThan(Date.now());
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    it('should calculate exponential backoff', async () => {
      const tempFile = path.join(os.tmpdir(), 'test-package.taptik');
      fs.writeFileSync(tempFile, 'test content');

      try {
        const id = await service.addToQueue(tempFile, { public: true });
        
        // First attempt
        await service.incrementRetryAttempt(id);
        const queued1 = await service.getQueuedUpload(id);
        const delay1 = queued1!.nextRetry!.getTime() - queued1!.lastAttempt!.getTime();
        
        // Second attempt (should have longer delay)
        await service.incrementRetryAttempt(id);
        const queued2 = await service.getQueuedUpload(id);
        const delay2 = queued2!.nextRetry!.getTime() - queued2!.lastAttempt!.getTime();
        
        // Delay should increase (exponential backoff)
        expect(delay2).toBeGreaterThan(delay1);
      } finally {
        fs.unlinkSync(tempFile);
      }
    });
  });

  describe('getQueueStatus', () => {
    it('should return all queue items', async () => {
      const tempFile = path.join(os.tmpdir(), 'test-package.taptik');
      fs.writeFileSync(tempFile, 'test content');

      try {
        const id1 = await service.addToQueue(tempFile, { public: true });
        const id2 = await service.addToQueue(tempFile, { private: true });
        
        const status = await service.getQueueStatus();
        
        expect(status).toHaveLength(2);
        expect(status.map(s => s.id)).toContain(id1);
        expect(status.map(s => s.id)).toContain(id2);
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    it('should return items in reverse chronological order', async () => {
      const tempFile = path.join(os.tmpdir(), 'test-package.taptik');
      fs.writeFileSync(tempFile, 'test content');

      try {
        const id1 = await service.addToQueue(tempFile, { public: true });
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
        const id2 = await service.addToQueue(tempFile, { private: true });
        
        const status = await service.getQueueStatus();
        
        expect(status[0].id).toBe(id2); // Most recent first
        expect(status[1].id).toBe(id1);
      } finally {
        fs.unlinkSync(tempFile);
      }
    });
  });

  describe('getPendingUploads', () => {
    it('should return only pending uploads', async () => {
      const tempFile = path.join(os.tmpdir(), 'test-package.taptik');
      fs.writeFileSync(tempFile, 'test content');

      try {
        const id1 = await service.addToQueue(tempFile, { public: true });
        const id2 = await service.addToQueue(tempFile, { private: true });
        const id3 = await service.addToQueue(tempFile, { public: false });
        
        // Update some statuses
        await service.updateQueueStatus(id2, 'completed');
        await service.updateQueueStatus(id3, 'failed');
        
        const pending = await service.getPendingUploads();
        
        expect(pending).toHaveLength(1);
        expect(pending[0].id).toBe(id1);
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    it('should respect retry limits', async () => {
      const tempFile = path.join(os.tmpdir(), 'test-package.taptik');
      fs.writeFileSync(tempFile, 'test content');

      try {
        const id = await service.addToQueue(tempFile, { public: true });
        
        // Max out retry attempts
         
        for (let i = 0; i < 5; i++) {
          // eslint-disable-next-line no-await-in-loop
          await service.incrementRetryAttempt(id);
        }
        
        const pending = await service.getPendingUploads();
        
        // Should not include item that exceeded retry limit
        expect(pending).toHaveLength(0);
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    it('should respect next retry time', async () => {
      const tempFile = path.join(os.tmpdir(), 'test-package.taptik');
      fs.writeFileSync(tempFile, 'test content');

      try {
        const id = await service.addToQueue(tempFile, { public: true });
        
        // Increment retry with future next_retry time
        await service.incrementRetryAttempt(id);
        
        // Manually set next_retry to far future
        const item = await service.getQueuedUpload(id);
        if (item) {
          item.nextRetry = new Date(Date.now() + 1000000);
          await service.updateQueueItem(id, { nextRetry: item.nextRetry });
        }
        
        const pending = await service.getPendingUploads();
        
        // Should not include item with future retry time
        expect(pending).toHaveLength(0);
      } finally {
        fs.unlinkSync(tempFile);
      }
    });
  });

  describe('clearFailedUploads', () => {
    it('should clear old failed uploads', async () => {
      const tempFile = path.join(os.tmpdir(), 'test-package.taptik');
      fs.writeFileSync(tempFile, 'test content');

      try {
        const id1 = await service.addToQueue(tempFile, { public: true });
        const id2 = await service.addToQueue(tempFile, { private: true });
        
        await service.updateQueueStatus(id1, 'failed');
        await service.updateQueueStatus(id2, 'failed');
        
        // Manually set one to be old
        const item = await service.getQueuedUpload(id1);
        if (item) {
          item.updatedAt = new Date(Date.now() - (8 * 24 * 60 * 60 * 1000)); // 8 days ago
          await service.updateQueueItem(id1, { updatedAt: item.updatedAt });
        }
        
        const cleared = await service.clearFailedUploads(7);
        
        expect(cleared).toBe(1);
        
        const status = await service.getQueueStatus();
        expect(status).toHaveLength(1);
        expect(status[0].id).toBe(id2);
      } finally {
        fs.unlinkSync(tempFile);
      }
    });
  });

  describe('clearCompletedUploads', () => {
    it('should clear all completed uploads', async () => {
      const tempFile = path.join(os.tmpdir(), 'test-package.taptik');
      fs.writeFileSync(tempFile, 'test content');

      try {
        const id1 = await service.addToQueue(tempFile, { public: true });
        const id2 = await service.addToQueue(tempFile, { private: true });
        const id3 = await service.addToQueue(tempFile, { public: false });
        
        await service.updateQueueStatus(id1, 'completed');
        await service.updateQueueStatus(id2, 'completed');
        // Leave id3 as pending
        
        const cleared = await service.clearCompletedUploads();
        
        expect(cleared).toBe(2);
        
        const status = await service.getQueueStatus();
        expect(status).toHaveLength(1);
        expect(status[0].id).toBe(id3);
      } finally {
        fs.unlinkSync(tempFile);
      }
    });
  });

  describe('startBackgroundSync', () => {
    it('should process pending uploads', async () => {
      const tempFile = path.join(os.tmpdir(), 'test-package.taptik');
      fs.writeFileSync(tempFile, 'test content');

      const processedUploads: QueuedUpload[] = [];
      const onProcess = vi.fn(async (upload: QueuedUpload) => {
        processedUploads.push(upload);
      });

      try {
        const id = await service.addToQueue(tempFile, { public: true });
        
        service.startBackgroundSync(onProcess);
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        expect(onProcess).toHaveBeenCalled();
        expect(processedUploads).toHaveLength(1);
        expect(processedUploads[0].id).toBe(id);
        
        // Check status was updated
        const queued = await service.getQueuedUpload(id);
        expect(queued?.status).toBe('completed');
      } finally {
        service.stopBackgroundSync();
        fs.unlinkSync(tempFile);
      }
    });

    it('should handle processing errors with retry', async () => {
      const tempFile = path.join(os.tmpdir(), 'test-package.taptik');
      fs.writeFileSync(tempFile, 'test content');

      const onProcess = vi.fn(async () => {
        throw new Error('Processing failed');
      });

      try {
        const id = await service.addToQueue(tempFile, { public: true });
        
        service.startBackgroundSync(onProcess);
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        expect(onProcess).toHaveBeenCalled();
        
        // Check status and retry attempt
        const queued = await service.getQueuedUpload(id);
        expect(queued?.status).toBe('pending');
        expect(queued?.attempts).toBe(1);
        expect(queued?.error).toBe('Processing failed');
      } finally {
        service.stopBackgroundSync();
        fs.unlinkSync(tempFile);
      }
    });

    it('should mark as failed after max retries', async () => {
      const tempFile = path.join(os.tmpdir(), 'test-package.taptik');
      fs.writeFileSync(tempFile, 'test content');

      const onProcess = vi.fn(async () => {
        throw new Error('Processing failed');
      });

      try {
        const id = await service.addToQueue(tempFile, { public: true });
        
        // Set attempts to 4 (one away from max)
        await service.updateQueueItem(id, { attempts: 4 });
        
        service.startBackgroundSync(onProcess);
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check status is now failed
        const queued = await service.getQueuedUpload(id);
        expect(queued?.status).toBe('failed');
        expect(queued?.attempts).toBe(5);
      } finally {
        service.stopBackgroundSync();
        fs.unlinkSync(tempFile);
      }
    });
  });

  describe('clearQueue', () => {
    it('should clear all items from queue', async () => {
      const tempFile = path.join(os.tmpdir(), 'test-package.taptik');
      fs.writeFileSync(tempFile, 'test content');

      try {
        await service.addToQueue(tempFile, { public: true });
        await service.addToQueue(tempFile, { private: true });
        await service.addToQueue(tempFile, { public: false });
        
        await service.clearQueue();
        
        const status = await service.getQueueStatus();
        expect(status).toHaveLength(0);
      } finally {
        fs.unlinkSync(tempFile);
      }
    });
  });

  describe('updateQueueItem', () => {
    it('should update specific fields', async () => {
      const tempFile = path.join(os.tmpdir(), 'test-package.taptik');
      fs.writeFileSync(tempFile, 'test content');

      try {
        const id = await service.addToQueue(tempFile, { public: true });
        
        await service.updateQueueItem(id, {
          status: 'uploading',
          attempts: 3,
          error: 'Test error',
        });
        
        const queued = await service.getQueuedUpload(id);
        expect(queued?.status).toBe('uploading');
        expect(queued?.attempts).toBe(3);
        expect(queued?.error).toBe('Test error');
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    it('should handle date fields', async () => {
      const tempFile = path.join(os.tmpdir(), 'test-package.taptik');
      fs.writeFileSync(tempFile, 'test content');

      try {
        const id = await service.addToQueue(tempFile, { public: true });
        
        const now = new Date();
        const future = new Date(Date.now() + 10000);
        
        await service.updateQueueItem(id, {
          lastAttempt: now,
          nextRetry: future,
        });
        
        const queued = await service.getQueuedUpload(id);
        expect(queued?.lastAttempt?.getTime()).toBe(now.getTime());
        expect(queued?.nextRetry?.getTime()).toBe(future.getTime());
      } finally {
        fs.unlinkSync(tempFile);
      }
    });
  });
});