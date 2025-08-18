import * as fs from 'node:fs/promises';

import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { LockingService } from './locking.service';

vi.mock('fs/promises');

describe('LockingService', () => {
  let service: LockingService;
  const mockLockFile = '/tmp/test.lock';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LockingService],
    }).compile();

    service = module.get<LockingService>(LockingService);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('acquireLock', () => {
    it('should create lock file when not exists', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);

      const handle = await service.acquireLock(mockLockFile);

      expect(handle).toBeDefined();
      expect(handle.filePath).toBe(mockLockFile);
      expect(handle.processId).toBe(process.pid);
      expect(vi.mocked(fs.writeFile)).toHaveBeenCalled();
    });

    it('should throw error if lock already exists', async () => {
      vi.mocked(fs.access).mockResolvedValue();
      vi.mocked(fs.readFile).mockResolvedValue(
        Buffer.from(
          JSON.stringify({
            id: 'existing-lock',
            processId: 12345,
            timestamp: new Date().toISOString(),
          }),
        ),
      );

      await expect(service.acquireLock(mockLockFile)).rejects.toThrow(
        /Lock file already exists/,
      );
    });

    it('should clean up stale lock and acquire new one', async () => {
      const staleLockData = {
        id: 'stale-lock',
        processId: 99999, // Non-existent process
        timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour old
      };

      vi.mocked(fs.access).mockResolvedValue();
      vi.mocked(fs.readFile).mockResolvedValue(
        Buffer.from(JSON.stringify(staleLockData)),
      );
      vi.mocked(fs.unlink).mockResolvedValue();
      vi.mocked(fs.writeFile).mockResolvedValue();

      const handle = await service.acquireLock(mockLockFile);

      expect(handle).toBeDefined();
      expect(vi.mocked(fs.unlink)).toHaveBeenCalledWith(mockLockFile);
      expect(vi.mocked(fs.writeFile)).toHaveBeenCalled();
    });
  });

  describe('releaseLock', () => {
    it('should remove lock file', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        Buffer.from(
          JSON.stringify({
            id: 'test-lock',
            processId: process.pid,
            timestamp: new Date().toISOString(),
          }),
        ),
      );
      vi.mocked(fs.unlink).mockResolvedValue();

      const handle = {
        id: 'test-lock',
        filePath: mockLockFile,
        timestamp: new Date(),
        processId: process.pid,
      };

      await service.releaseLock(handle);

      expect(vi.mocked(fs.unlink)).toHaveBeenCalledWith(mockLockFile);
    });

    it('should handle missing lock file gracefully', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      vi.mocked(fs.unlink).mockRejectedValue(new Error('ENOENT'));

      const handle = {
        id: 'test-lock',
        filePath: mockLockFile,
        timestamp: new Date(),
        processId: process.pid,
      };

      await expect(service.releaseLock(handle)).resolves.not.toThrow();
    });

    it('should verify lock ownership before release', async () => {
      const handle = {
        id: 'test-lock',
        filePath: mockLockFile,
        timestamp: new Date(),
        processId: process.pid,
      };

      vi.mocked(fs.readFile).mockResolvedValue(
        Buffer.from(
          JSON.stringify({
            id: 'different-lock',
            processId: 12345,
            timestamp: new Date().toISOString(),
          }),
        ),
      );

      await expect(service.releaseLock(handle)).rejects.toThrow(
        /Lock ownership mismatch/,
      );
    });
  });

  describe('isLocked', () => {
    it('should return true when lock exists', async () => {
      vi.mocked(fs.access).mockResolvedValue();
      vi.mocked(fs.readFile).mockResolvedValue(
        Buffer.from(
          JSON.stringify({
            id: 'existing-lock',
            processId: process.pid,
            timestamp: new Date().toISOString(),
          }),
        ),
      );

      const result = await service.isLocked(mockLockFile);
      expect(result).toBe(true);
    });

    it('should return false when lock does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const result = await service.isLocked(mockLockFile);
      expect(result).toBe(false);
    });

    it('should return false for stale lock', async () => {
      const staleLockData = {
        id: 'stale-lock',
        processId: 99999,
        timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours old
      };

      vi.mocked(fs.access).mockResolvedValue();
      vi.mocked(fs.readFile).mockResolvedValue(
        Buffer.from(JSON.stringify(staleLockData)),
      );

      const result = await service.isLocked(mockLockFile);
      expect(result).toBe(false);
    });
  });

  describe('cleanupStaleLocks', () => {
    it('should remove stale lock files', async () => {
      const staleLockFiles = ['stale1.lock', 'stale2.lock'];

      // Mock for ~/.claude directory
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(staleLockFiles as any) // ~/.claude
        .mockResolvedValueOnce([] as any); // .claude

      vi.mocked(fs.readFile).mockResolvedValue(
        Buffer.from(
          JSON.stringify({
            id: 'stale-lock',
            processId: 99999,
            timestamp: new Date(Date.now() - 7200000).toISOString(),
          }),
        ),
      );
      vi.mocked(fs.unlink).mockResolvedValue();

      await service.cleanupStaleLocks();

      expect(vi.mocked(fs.unlink)).toHaveBeenCalledTimes(2);
    });

    it('should keep valid locks', async () => {
      const lockFiles = ['valid.lock', 'stale.lock'];

      // Mock for ~/.claude directory
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(lockFiles as any) // ~/.claude
        .mockResolvedValueOnce([] as any); // .claude

      let readFileCallCount = 0;
      vi.mocked(fs.readFile).mockImplementation(async () => {
        readFileCallCount++;
        if (readFileCallCount === 1) {
          return Buffer.from(
            JSON.stringify({
              id: 'valid-lock',
              processId: process.pid,
              timestamp: new Date().toISOString(),
            }),
          );
        } else {
          return Buffer.from(
            JSON.stringify({
              id: 'stale-lock',
              processId: 99999,
              timestamp: new Date(Date.now() - 7200000).toISOString(),
            }),
          );
        }
      });
      vi.mocked(fs.unlink).mockResolvedValue();

      await service.cleanupStaleLocks();

      expect(vi.mocked(fs.unlink)).toHaveBeenCalledTimes(1);
    });
  });

  describe('waitForLock', () => {
    it('should acquire lock immediately if available', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);

      const result = await service.waitForLock(mockLockFile, 5000);
      expect(result).toBe(true);
    });

    it('should timeout if lock not available', async () => {
      vi.mocked(fs.access).mockResolvedValue();
      vi.mocked(fs.readFile).mockResolvedValue(
        Buffer.from(
          JSON.stringify({
            id: 'existing-lock',
            processId: 12345,
            timestamp: new Date().toISOString(),
          }),
        ),
      );

      const result = await service.waitForLock(mockLockFile, 100);
      expect(result).toBe(false);
    });

    it('should acquire lock when it becomes available', async () => {
      let callCount = 0;
      vi.mocked(fs.access).mockImplementation(async () => {
        callCount++;
        if (callCount > 2) {
          throw new Error('ENOENT');
        }
      });
      vi.mocked(fs.readFile).mockResolvedValue(
        Buffer.from(
          JSON.stringify({
            id: 'existing-lock',
            processId: 12345,
            timestamp: new Date().toISOString(),
          }),
        ),
      );
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);

      const result = await service.waitForLock(mockLockFile, 5000);
      expect(result).toBe(true);
    });
  });
});
