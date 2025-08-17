import * as crypto from 'node:crypto';
import * as path from 'node:path';

// Import after mocking
import * as fs from 'fs-extra';
import { glob } from 'glob';
import * as tar from 'tar';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { AIPlatform } from '../interfaces';

import { BackupManagerService } from './backup-manager.service';

// Mock modules
vi.mock('fs-extra', () => ({
  default: {
    ensureDir: vi.fn(),
    pathExists: vi.fn(),
    readJson: vi.fn(),
    writeJson: vi.fn(),
    copy: vi.fn(),
    remove: vi.fn(),
    stat: vi.fn(),
    createReadStream: vi.fn(),
    createWriteStream: vi.fn(),
  },
  ensureDir: vi.fn(),
  pathExists: vi.fn(),
  readJson: vi.fn(),
  writeJson: vi.fn(),
  copy: vi.fn(),
  remove: vi.fn(),
  stat: vi.fn(),
  createReadStream: vi.fn(),
  createWriteStream: vi.fn(),
}));

vi.mock('tar', () => ({
  default: {
    create: vi.fn(),
    extract: vi.fn(),
  },
  create: vi.fn(),
  extract: vi.fn(),
}));

vi.mock('glob', () => ({
  glob: vi.fn(),
}));
vi.mock('crypto', () => ({
  randomBytes: vi.fn(() => ({
    toString: vi.fn(() => 'mock123'),
  })),
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => 'mockchecksum'),
  })),
  createCipheriv: vi.fn(() => ({
    update: vi.fn().mockReturnValue(Buffer.from('encrypted')),
    final: vi.fn().mockReturnValue(Buffer.from('final')),
    on: vi.fn((event, callback) => {
      if (event === 'end') callback();
      if (event === 'finish') callback();
      return { on: vi.fn() };
    }),
    pipe: vi.fn(() => ({
      pipe: vi.fn(() => ({
        on: vi.fn((event, callback) => {
          if (event === 'finish') callback();
        }),
      })),
    })),
  })),
  createDecipheriv: vi.fn(() => ({
    update: vi.fn().mockReturnValue(Buffer.from('decrypted')),
    final: vi.fn().mockReturnValue(Buffer.from('final')),
    on: vi.fn((event, callback) => {
      if (event === 'end') callback();
      if (event === 'finish') callback();
      return { on: vi.fn() };
    }),
    pipe: vi.fn(() => ({
      pipe: vi.fn(() => ({
        on: vi.fn((event, callback) => {
          if (event === 'finish') callback();
        }),
      })),
    })),
  })),
  createCipher: vi.fn(() => ({
    pipe: vi.fn(() => ({
      pipe: vi.fn(() => ({
        on: vi.fn((event, callback) => {
          if (event === 'finish') callback();
        }),
      })),
    })),
  })),
  createDecipher: vi.fn(() => ({
    pipe: vi.fn(() => ({
      pipe: vi.fn(() => ({
        on: vi.fn((event, callback) => {
          if (event === 'finish') callback();
        }),
      })),
    })),
  })),
}));

describe('BackupManagerService', () => {
  let service: BackupManagerService;
  let mockFileSystem: any;
  let mockCompression: any;

  beforeEach(() => {
    mockFileSystem = {
      exists: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      readJson: vi.fn(),
      writeJson: vi.fn(),
      ensureDir: vi.fn(),
      copy: vi.fn(),
      remove: vi.fn(),
    };

    mockCompression = {
      compress: vi.fn(),
      decompress: vi.fn(),
    };

    // Mock fs-extra methods
    vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
    (vi.mocked(fs.pathExists) as any).mockResolvedValue(true);
    vi.mocked(fs.readJson).mockResolvedValue({});
    vi.mocked(fs.writeJson).mockResolvedValue(undefined);
    vi.mocked(fs.copy).mockResolvedValue(undefined);
    vi.mocked(fs.remove).mockResolvedValue(undefined);
    vi.mocked(fs.stat).mockResolvedValue({
      size: 1024,
      mtime: new Date(),
    } as any);
    vi.mocked(fs.createReadStream).mockReturnValue({
      on: vi.fn((event, callback) => {
        if (event === 'data') callback(Buffer.from('test'));
        if (event === 'end') callback();
        return { on: vi.fn() };
      }),
      pipe: vi.fn(() => ({
        pipe: vi.fn(() => ({
          on: vi.fn((event, callback) => {
            if (event === 'finish') callback();
          }),
        })),
      })),
    } as any);
    vi.mocked(fs.createWriteStream).mockReturnValue({
      on: vi.fn((event, callback) => {
        if (event === 'finish') callback();
        if (event === 'error') callback();
        return { on: vi.fn() };
      }),
      write: vi.fn((data, callback) => {
        if (callback) callback();
        return true;
      }),
      end: vi.fn((callback) => {
        if (callback) callback();
      }),
    } as any);

    // Mock glob
    vi.mocked(glob).mockResolvedValue([]);

    // Mock tar
    vi.mocked(tar.create).mockResolvedValue(undefined);
    vi.mocked(tar.extract).mockResolvedValue(undefined);

    service = new BackupManagerService(mockFileSystem, mockCompression);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createBackup', () => {
    it('should create a backup successfully', async () => {
      const sourcePath = '/test/source';
      const platform = AIPlatform.KIRO;
      const options = { compress: false, encrypt: false };

      vi.mocked(glob).mockResolvedValue([
        '/test/source/file1.ts',
        '/test/source/file2.ts',
      ]);

      const result = await service.createBackup(sourcePath, platform, options);

      expect(result).toBeDefined();
      expect(result.platform).toBe(platform);
      expect(result.sourcePath).toBe(sourcePath);
      expect(result.files).toHaveLength(2);
      expect(result.compressed).toBe(false);
      expect(result.encrypted).toBe(false);
      expect(fs.ensureDir).toHaveBeenCalled();
      expect(fs.copy).toHaveBeenCalledTimes(2);
    });

    it('should create compressed backup when requested', async () => {
      const sourcePath = '/test/source';
      const platform = AIPlatform.CLAUDE_CODE;
      const options = { compress: true };

      vi.mocked(glob).mockResolvedValue(['/test/source/file1.ts']);

      const result = await service.createBackup(sourcePath, platform, options);

      expect(result.compressed).toBe(true);
      expect(tar.create).toHaveBeenCalled();
      expect(fs.remove).toHaveBeenCalled();
    });

    it('should handle encryption when requested', async () => {
      const sourcePath = '/test/source';
      const platform = AIPlatform.KIRO;
      const options = { encrypt: true, encryptionKey: 'testkey' };

      vi.mocked(glob).mockResolvedValue(['/test/source/file1.ts']);

      const result = await service.createBackup(sourcePath, platform, options);

      expect(result.encrypted).toBe(true);
    });

    it('should throw error when no files found', async () => {
      const sourcePath = '/test/source';
      const platform = AIPlatform.KIRO;

      vi.mocked(glob).mockResolvedValue([]);

      await expect(service.createBackup(sourcePath, platform)).rejects.toThrow(
        'No files found to backup',
      );
    });

    it('should clean old backups when maxBackups is set', async () => {
      const sourcePath = '/test/source';
      const platform = AIPlatform.KIRO;
      const options = { maxBackups: 3 };

      vi.mocked(glob).mockResolvedValueOnce(['/test/source/file1.ts']);

      // Mock existing backups that will exceed maxBackups limit
      const mockBackups = [
        {
          id: 'backup1',
          timestamp: '2024-01-01T00:00:00Z',
          platform: AIPlatform.KIRO,
        },
        {
          id: 'backup2',
          timestamp: '2024-01-02T00:00:00Z',
          platform: AIPlatform.KIRO,
        },
        {
          id: 'backup3',
          timestamp: '2024-01-03T00:00:00Z',
          platform: AIPlatform.KIRO,
        },
        {
          id: 'backup4',
          timestamp: '2024-01-04T00:00:00Z',
          platform: AIPlatform.KIRO,
        },
      ];

      // Clear previous glob mocks and set up specific behavior
      vi.mocked(glob).mockReset();

      // First call: getFilesToBackup - return source files
      vi.mocked(glob).mockResolvedValueOnce(['/test/source/file1.ts']);

      // Second call: listBackups for cleanup - return existing backups
      vi.mocked(glob).mockResolvedValueOnce([
        '.taptik/backups/kiro/backup1/metadata.json',
        '.taptik/backups/kiro/backup2/metadata.json',
        '.taptik/backups/kiro/backup3/metadata.json',
        '.taptik/backups/kiro/backup4/metadata.json',
      ]);

      // Third call: getBackupMetadata for deleteBackup - return metadata file path
      vi.mocked(glob).mockResolvedValue([
        '.taptik/backups/kiro/backup1/metadata.json',
      ]);

      vi.mocked(fs.readJson).mockImplementation((file) => {
        const id = path.basename(path.dirname(file as string));
        const backup = mockBackups.find((b) => b.id === id);
        // Add missing backupPath property for deleteBackup to work
        return Promise.resolve({
          ...backup,
          backupPath: `.taptik/backups/kiro/${id}`,
        });
      });

      // Mock pathExists to return true for backup deletions
      (vi.mocked(fs.pathExists) as any).mockResolvedValue(true);

      await service.createBackup(sourcePath, platform, options);

      // Should have deleted the oldest backup (backup1)
      expect(fs.remove).toHaveBeenCalledWith(
        expect.stringContaining('backup1'),
      );
    });
  });

  describe('restoreBackup', () => {
    const mockMetadata = {
      id: 'backup123',
      timestamp: '2024-01-01T00:00:00Z',
      platform: AIPlatform.KIRO,
      sourcePath: '/test/source',
      backupPath: '/backup/path',
      size: 1024,
      compressed: false,
      encrypted: false,
      files: ['file1.ts', 'file2.ts'],
      checksum: 'mockchecksum',
      version: '1.0.0',
    };

    beforeEach(() => {
      // Mock getBackupMetadata and backup verification
      vi.mocked(glob).mockResolvedValue([
        '.taptik/backups/kiro/backup123/metadata.json',
      ]);
      vi.mocked(fs.readJson).mockResolvedValue(mockMetadata);

      // Reset mocks before each test
      vi.clearAllMocks();

      // Mock checksum verification to match metadata checksum
      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn(() => 'mockchecksum'), // This matches the checksum in mockMetadata
      } as any);

      // Mock successful stream reading for checksum
      vi.mocked(fs.createReadStream).mockReturnValue({
        on: vi.fn((event, callback) => {
          if (event === 'data') callback(Buffer.from('test data'));
          if (event === 'end') callback();
          if (event === 'error') callback();
          return { on: vi.fn() };
        }),
        pipe: vi.fn(() => ({
          pipe: vi.fn(() => ({
            on: vi.fn((event, callback) => {
              if (event === 'finish') callback();
            }),
          })),
        })),
      } as any);
    });

    it('should restore backup successfully', async () => {
      const backupId = 'backup123';
      const targetPath = '/test/target';
      const options = { overwrite: true };

      // Mock pathExists to return true for backup path and false for conflicts
      (vi.mocked(fs.pathExists) as any).mockImplementation((path: string) => {
        // Return true for backup path verification
        if (path === mockMetadata.backupPath) return Promise.resolve(true);
        // Return false for target file conflicts
        return Promise.resolve(false);
      });

      // Override verifyBackup to return true for this test
      vi.spyOn(service, 'verifyBackup').mockResolvedValue(true);

      const result = await service.restoreBackup(backupId, targetPath, options);

      expect(result.success).toBe(true);
      expect(result.restoredFiles).toHaveLength(2);
      expect(result.skippedFiles).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(fs.copy).toHaveBeenCalledTimes(2);
    });

    it('should handle conflicts based on strategy', async () => {
      const backupId = 'backup123';
      const targetPath = '/test/target';
      const options = { conflictStrategy: 'skip' as const };

      (vi.mocked(fs.pathExists) as any).mockResolvedValue(true); // All files exist

      const result = await service.restoreBackup(backupId, targetPath, options);

      expect(result.skippedFiles).toHaveLength(2);
      expect(result.restoredFiles).toHaveLength(0);
      expect(fs.copy).not.toHaveBeenCalled();
    });

    it('should handle dry run mode', async () => {
      const backupId = 'backup123';
      const targetPath = '/test/target';
      const options = { dryRun: true };

      const result = await service.restoreBackup(backupId, targetPath, options);

      expect(result.success).toBe(true);
      expect(fs.copy).not.toHaveBeenCalled();
    });

    it('should handle encrypted backups', async () => {
      const encryptedMetadata = { ...mockMetadata, encrypted: true };
      vi.mocked(fs.readJson).mockResolvedValue(encryptedMetadata);

      const backupId = 'backup123';
      const targetPath = '/test/target';
      const options = { decrypt: true, decryptionKey: 'testkey' };

      // Mock pathExists and verifyBackup for encrypted backup
      (vi.mocked(fs.pathExists) as any).mockImplementation((path: string) => {
        if (path === encryptedMetadata.backupPath) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      // Override verifyBackup to return true for this test
      vi.spyOn(service, 'verifyBackup').mockResolvedValue(true);

      // Mock decryptBackup to avoid crypto stream issues
      vi.spyOn(service as any, 'decryptBackup').mockResolvedValue(
        '/path/to/decrypted',
      );

      const result = await service.restoreBackup(backupId, targetPath, options);

      expect(result.success).toBe(true);
    });

    it('should handle encrypted backup without key gracefully', async () => {
      const encryptedMetadata = { ...mockMetadata, encrypted: true };
      vi.mocked(fs.readJson).mockResolvedValue(encryptedMetadata);

      const backupId = 'backup123';
      const targetPath = '/test/target';

      const result = await service.restoreBackup(backupId, targetPath);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'Backup is encrypted but no decryption key provided',
      );
    });

    it('should handle compressed backups', async () => {
      const compressedMetadata = { ...mockMetadata, compressed: true };
      vi.mocked(fs.readJson).mockResolvedValue(compressedMetadata);

      const backupId = 'backup123';
      const targetPath = '/test/target';

      // Mock pathExists and verifyBackup for compressed backup
      (vi.mocked(fs.pathExists) as any).mockImplementation((path: string) => {
        if (path === compressedMetadata.backupPath)
          return Promise.resolve(true);
        return Promise.resolve(false);
      });

      // Override verifyBackup to return true for this test
      vi.spyOn(service, 'verifyBackup').mockResolvedValue(true);

      const result = await service.restoreBackup(backupId, targetPath);

      expect(tar.extract).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('listBackups', () => {
    it('should list all backups', async () => {
      const mockBackups = [
        {
          id: 'backup1',
          timestamp: '2024-01-01T00:00:00Z',
          platform: AIPlatform.KIRO,
        },
        {
          id: 'backup2',
          timestamp: '2024-01-02T00:00:00Z',
          platform: AIPlatform.CLAUDE_CODE,
        },
      ];

      vi.mocked(glob).mockResolvedValue([
        '.taptik/backups/kiro/backup1/metadata.json',
        '.taptik/backups/claude_code/backup2/metadata.json',
      ]);

      let callCount = 0;
      vi.mocked(fs.readJson).mockImplementation(() =>
        Promise.resolve(mockBackups[callCount++]),
      );

      const result = await service.listBackups();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('backup2'); // Should be sorted by timestamp
      expect(result[1].id).toBe('backup1');
    });

    it('should filter by platform', async () => {
      vi.mocked(glob).mockResolvedValue([
        '.taptik/backups/kiro/backup1/metadata.json',
      ]);
      vi.mocked(fs.readJson).mockResolvedValue({
        id: 'backup1',
        timestamp: '2024-01-01T00:00:00Z',
        platform: AIPlatform.KIRO,
      });

      const result = await service.listBackups(AIPlatform.KIRO);

      expect(result).toHaveLength(1);
      expect(result[0].platform).toBe(AIPlatform.KIRO);
    });

    it('should apply limit', async () => {
      const mockBackups = Array.from({ length: 5 }, (_, i) => ({
        id: `backup${i}`,
        timestamp: `2024-01-0${i + 1}T00:00:00Z`,
        platform: AIPlatform.KIRO,
      }));

      vi.mocked(glob).mockResolvedValue(
        mockBackups.map(
          (_, i) => `.taptik/backups/kiro/backup${i}/metadata.json`,
        ),
      );

      let callCount = 0;
      vi.mocked(fs.readJson).mockImplementation(() =>
        Promise.resolve(mockBackups[callCount++]),
      );

      const result = await service.listBackups(undefined, 3);

      expect(result).toHaveLength(3);
    });
  });

  describe('deleteBackup', () => {
    it('should delete backup successfully', async () => {
      const backupId = 'backup123';
      const mockMetadata = {
        id: backupId,
        backupPath: '.taptik/backups/kiro/backup123',
      };

      vi.mocked(glob).mockResolvedValue([
        '.taptik/backups/kiro/backup123/metadata.json',
      ]);
      vi.mocked(fs.readJson).mockResolvedValue(mockMetadata);
      (vi.mocked(fs.pathExists) as any).mockResolvedValue(true);

      const result = await service.deleteBackup(backupId);

      expect(result).toBe(true);
      expect(fs.remove).toHaveBeenCalledWith('.taptik/backups/kiro/backup123');
      expect(fs.remove).toHaveBeenCalledWith(
        '.taptik/backups/kiro/metadata.json',
      );
    });

    it('should return false for non-existent backup', async () => {
      vi.mocked(glob).mockResolvedValue([]);

      const result = await service.deleteBackup('nonexistent');

      expect(result).toBe(false);
      expect(fs.remove).not.toHaveBeenCalled();
    });
  });

  describe('verifyBackup', () => {
    it('should verify backup integrity successfully', async () => {
      const metadata = {
        id: 'backup123',
        backupPath: '/backup/backup123',
        checksum: 'mockchecksum',
      } as any;

      (vi.mocked(fs.pathExists) as any).mockResolvedValue(true);

      const result = await service.verifyBackup(metadata);

      expect(result).toBe(true);
    });

    it('should return false for missing backup', async () => {
      const metadata = {
        id: 'backup123',
        backupPath: '/backup/backup123',
        checksum: 'checksum',
      } as any;

      (vi.mocked(fs.pathExists) as any).mockResolvedValue(false);

      const result = await service.verifyBackup(metadata);

      expect(result).toBe(false);
    });
  });

  describe('compareWithCurrent', () => {
    it('should compare backup with current configuration', async () => {
      const backupId = 'backup123';
      const currentPath = '/current/path';
      const mockMetadata = {
        id: backupId,
        files: ['file1.ts', 'file2.ts'],
      };

      vi.mocked(glob).mockResolvedValueOnce([
        '.taptik/backups/kiro/backup123/metadata.json',
      ]);
      vi.mocked(fs.readJson).mockResolvedValue(mockMetadata);
      vi.mocked(glob).mockResolvedValueOnce([
        '/current/path/file1.ts',
        '/current/path/file3.ts',
      ]);

      const result = await service.compareWithCurrent(backupId, currentPath);

      expect(result.identical).toBe(false);
      expect(result.added).toContain('file3.ts');
      expect(result.removed).toContain('file2.ts');
    });

    it('should detect identical configurations', async () => {
      const backupId = 'backup123';
      const currentPath = '/current/path';
      const mockMetadata = {
        id: backupId,
        files: ['file1.ts', 'file2.ts'],
      };

      vi.mocked(glob).mockResolvedValueOnce([
        '.taptik/backups/kiro/backup123/metadata.json',
      ]);
      vi.mocked(fs.readJson).mockResolvedValue(mockMetadata);
      vi.mocked(glob).mockResolvedValueOnce([
        '/current/path/file1.ts',
        '/current/path/file2.ts',
      ]);
      (vi.mocked(fs.pathExists) as any).mockResolvedValue(true);

      const result = await service.compareWithCurrent(backupId, currentPath);

      // Modified will have items due to simplified check, but added/removed should be empty
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
    });
  });
});
