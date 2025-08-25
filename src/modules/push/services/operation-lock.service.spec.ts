import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { OperationLockService } from './operation-lock.service';

describe('OperationLockService', () => {
  let service: OperationLockService;
  let testDir: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OperationLockService],
    }).compile();

    service = module.get<OperationLockService>(OperationLockService);
    
    // Use test directory
    testDir = path.join(os.tmpdir(), 'taptik-test', 'locks');
    (service as any).lockDir = testDir;
    
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
    
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
  });

  describe('acquireLock', () => {
    it('should acquire lock successfully', async () => {
      const acquired = await service.acquireLock('upload', 'package-123', 'user-456');
      
      expect(acquired).toBe(true);
      
      const lockFile = path.join(testDir, 'upload_package-123.lock');
      const content = await fs.readFile(lockFile, 'utf-8');
      const lockInfo = JSON.parse(content);
      
      expect(lockInfo.operation).toBe('upload');
      expect(lockInfo.userId).toBe('user-456');
      expect(lockInfo.pid).toBe(process.pid);
    });

    it('should fail to acquire lock when already locked', async () => {
      // First lock should succeed
      const acquired1 = await service.acquireLock('upload', 'package-123');
      expect(acquired1).toBe(true);
      
      // Simulate different process
      const originalPid = process.pid;
      Object.defineProperty(process, 'pid', {
        value: 99999,
        configurable: true,
      });
      
      // Second lock should fail
      const acquired2 = await service.acquireLock('upload', 'package-123');
      expect(acquired2).toBe(false);
      
      // Restore original PID
      Object.defineProperty(process, 'pid', {
        value: originalPid,
        configurable: true,
      });
    });

    it('should allow same process to reacquire lock', async () => {
      const acquired1 = await service.acquireLock('upload', 'package-123');
      expect(acquired1).toBe(true);
      
      const acquired2 = await service.acquireLock('upload', 'package-123');
      expect(acquired2).toBe(true);
    });

    it('should remove expired lock and acquire new one', async () => {
      // Create expired lock
      const expiredLock = {
        pid: 99999,
        timestamp: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes old
        operation: 'upload',
      };
      
      const lockFile = path.join(testDir, 'upload_package-123.lock');
      await fs.writeFile(lockFile, JSON.stringify(expiredLock));
      
      // Should remove expired lock and acquire new one
      const acquired = await service.acquireLock('upload', 'package-123');
      expect(acquired).toBe(true);
      
      const content = await fs.readFile(lockFile, 'utf-8');
      const lockInfo = JSON.parse(content);
      expect(lockInfo.pid).toBe(process.pid);
    });
  });

  describe('releaseLock', () => {
    it('should release lock owned by current process', async () => {
      await service.acquireLock('upload', 'package-123');
      await service.releaseLock('upload', 'package-123');
      
      const lockFile = path.join(testDir, 'upload_package-123.lock');
      await expect(fs.access(lockFile)).rejects.toThrow();
    });

    it('should not release lock owned by different process', async () => {
      // Create lock from different process
      const lockInfo = {
        pid: 99999,
        timestamp: new Date(),
        operation: 'upload',
      };
      
      const lockFile = path.join(testDir, 'upload_package-123.lock');
      await fs.writeFile(lockFile, JSON.stringify(lockInfo));
      
      await service.releaseLock('upload', 'package-123');
      
      // Lock should still exist
      await expect(fs.access(lockFile)).resolves.not.toThrow();
    });

    it('should handle releasing non-existent lock', async () => {
      await expect(service.releaseLock('upload', 'missing')).resolves.not.toThrow();
    });
  });

  describe('isLocked', () => {
    it('should return true when locked', async () => {
      await service.acquireLock('upload', 'package-123');
      
      const locked = await service.isLocked('upload', 'package-123');
      
      expect(locked).toBe(true);
    });

    it('should return false when not locked', async () => {
      const locked = await service.isLocked('upload', 'package-123');
      
      expect(locked).toBe(false);
    });

    it('should return false for expired lock', async () => {
      // Create expired lock
      const expiredLock = {
        pid: 99999,
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
        operation: 'upload',
      };
      
      const lockFile = path.join(testDir, 'upload_package-123.lock');
      await fs.writeFile(lockFile, JSON.stringify(expiredLock));
      
      const locked = await service.isLocked('upload', 'package-123');
      
      expect(locked).toBe(false);
      
      // Expired lock should be cleaned up
      await expect(fs.access(lockFile)).rejects.toThrow();
    });
  });

  describe('getLockInfo', () => {
    it('should return lock information', async () => {
      await service.acquireLock('upload', 'package-123', 'user-456');
      
      const info = await service.getLockInfo('upload', 'package-123');
      
      expect(info).not.toBeNull();
      expect(info?.operation).toBe('upload');
      expect(info?.userId).toBe('user-456');
      expect(info?.pid).toBe(process.pid);
    });

    it('should return null for non-existent lock', async () => {
      const info = await service.getLockInfo('upload', 'missing');
      
      expect(info).toBeNull();
    });
  });

  describe('waitForLock', () => {
    it('should wait for lock to be released', async () => {
      await service.acquireLock('upload', 'package-123');
      
      // Release lock after delay
      setTimeout(() => {
        service.releaseLock('upload', 'package-123');
      }, 100);
      
      const startTime = Date.now();
      const released = await service.waitForLock('upload', 'package-123', 1000);
      const elapsed = Date.now() - startTime;
      
      expect(released).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(100);
      expect(elapsed).toBeLessThan(200);
    });

    it('should timeout when lock is not released', async () => {
      await service.acquireLock('upload', 'package-123');
      
      const released = await service.waitForLock('upload', 'package-123', 100);
      
      expect(released).toBe(false);
    });
  });

  describe('executeWithLock', () => {
    it('should execute operation with lock', async () => {
      const callback = vi.fn().mockResolvedValue('result');
      
      const result = await service.executeWithLock(
        'upload',
        'package-123',
        callback,
        'user-456'
      );
      
      expect(callback).toHaveBeenCalled();
      expect(result).toBe('result');
      
      // Lock should be released
      const locked = await service.isLocked('upload', 'package-123');
      expect(locked).toBe(false);
    });

    it('should release lock even if operation fails', async () => {
      const callback = vi.fn().mockRejectedValue(new Error('Operation failed'));
      
      await expect(
        service.executeWithLock('upload', 'package-123', callback)
      ).rejects.toThrow('Operation failed');
      
      // Lock should be released
      const locked = await service.isLocked('upload', 'package-123');
      expect(locked).toBe(false);
    });

    it('should return null when lock cannot be acquired', async () => {
      // Create lock from different process
      const lockInfo = {
        pid: 99999,
        timestamp: new Date(),
        operation: 'upload',
      };
      
      const lockFile = path.join(testDir, 'upload_package-123.lock');
      await fs.writeFile(lockFile, JSON.stringify(lockInfo));
      
      const callback = vi.fn().mockResolvedValue('result');
      
      const result = await service.executeWithLock(
        'upload',
        'package-123',
        callback
      );
      
      expect(callback).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('cleanupExpiredLocks', () => {
    it('should clean up expired locks', async () => {
      // Create expired and active locks
      const expiredLock = {
        pid: 99999,
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
        operation: 'upload',
      };
      
      const activeLock = {
        pid: 88888,
        timestamp: new Date(),
        operation: 'download',
      };
      
      const expiredFile = path.join(testDir, 'upload_package-123.lock');
      const activeFile = path.join(testDir, 'download_package-456.lock');
      
      await fs.writeFile(expiredFile, JSON.stringify(expiredLock));
      await fs.writeFile(activeFile, JSON.stringify(activeLock));
      
      await service.cleanupExpiredLocks();
      
      // Expired lock should be removed
      await expect(fs.access(expiredFile)).rejects.toThrow();
      
      // Active lock should remain
      await expect(fs.access(activeFile)).resolves.not.toThrow();
    });
  });

  describe('listActiveLocks', () => {
    it('should list all active locks', async () => {
      await service.acquireLock('upload', 'package-123', 'user-456');
      await service.acquireLock('download', 'package-789', 'user-789');
      
      const locks = await service.listActiveLocks();
      
      expect(locks).toHaveLength(2);
      expect(locks.find(l => l.operation === 'upload')).toBeDefined();
      expect(locks.find(l => l.operation === 'download')).toBeDefined();
    });

    it('should not list expired locks', async () => {
      // Create expired lock
      const expiredLock = {
        pid: 99999,
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
        operation: 'upload',
      };
      
      const lockFile = path.join(testDir, 'upload_package-123.lock');
      await fs.writeFile(lockFile, JSON.stringify(expiredLock));
      
      await service.acquireLock('download', 'package-456');
      
      const locks = await service.listActiveLocks();
      
      expect(locks).toHaveLength(1);
      expect(locks[0].operation).toBe('download');
    });
  });

  describe('forceReleaseLock', () => {
    it('should force release any lock', async () => {
      // Create lock from different process
      const lockInfo = {
        pid: 99999,
        timestamp: new Date(),
        operation: 'upload',
      };
      
      const lockFile = path.join(testDir, 'upload_package-123.lock');
      await fs.writeFile(lockFile, JSON.stringify(lockInfo));
      
      await service.forceReleaseLock('upload', 'package-123');
      
      await expect(fs.access(lockFile)).rejects.toThrow();
    });
  });
});