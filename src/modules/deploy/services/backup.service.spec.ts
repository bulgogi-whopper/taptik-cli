import * as fs from 'node:fs/promises';

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { BackupService } from './backup.service';

vi.mock('fs/promises');

describe('BackupService', () => {
  let service: BackupService;

  beforeEach(() => {
    service = new BackupService();
    vi.clearAllMocks();
    vi.resetAllMocks();

    // Mock fs operations
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('{}'));
    vi.mocked(fs.readdir).mockResolvedValue([]);
    vi.mocked(fs.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    } as any);
    vi.mocked(fs.rm).mockResolvedValue(undefined);
    vi.mocked(fs.access).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createBackup', () => {
    it('should create backup with timestamp', async () => {
      const testPath = '/test/file.json';
      const testContent = { test: 'data' };

      vi.mocked(fs.readFile).mockResolvedValueOnce(
        Buffer.from(JSON.stringify(testContent)),
      );

      const backupPath = await service.createBackup(testPath);

      expect(backupPath).toMatch(/backup_\d{8}_\d{6}/);
      expect(fs.writeFile).toHaveBeenCalledTimes(2); // backup file and manifest
    });

    it('should handle file read errors gracefully', async () => {
      const testPath = '/test/nonexistent.json';

      vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('File not found'));

      await expect(service.createBackup(testPath)).rejects.toThrow(
        'Failed to create backup',
      );
    });

    it('should create backup directory if it does not exist', async () => {
      const testPath = '/test/file.json';

      vi.mocked(fs.access).mockRejectedValueOnce(new Error('Not found'));
      vi.mocked(fs.readFile).mockResolvedValueOnce(Buffer.from('{}'));

      await service.createBackup(testPath);

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('backups'),
        { recursive: true },
      );
    });

    it('should store backup manifest', async () => {
      const testPath = '/test/file.json';
      const testContent = { test: 'data' };

      vi.mocked(fs.readFile).mockResolvedValueOnce(
        Buffer.from(JSON.stringify(testContent)),
      );

      await service.createBackup(testPath);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('manifest_'),
        expect.stringContaining('originalPath'),
      );
    });
  });

  describe('rollback', () => {
    it('should restore file from backup', async () => {
      const originalPath = '/test/file.json';
      const backupPath = '/backup/file.json';
      const backupContent = { restored: 'data' };

      vi.mocked(fs.readFile)
        .mockReset()
        .mockResolvedValueOnce(
          Buffer.from(
            JSON.stringify({
              originalPath,
              backupPath,
              timestamp: Date.now(),
            }),
          ),
        )
        .mockResolvedValueOnce(Buffer.from(JSON.stringify(backupContent)));

      await service.rollback(backupPath);

      expect(fs.writeFile).toHaveBeenCalledWith(
        originalPath,
        expect.stringContaining('restored'),
      );
    });

    it('should handle missing backup gracefully', async () => {
      vi.mocked(fs.readFile).mockRejectedValueOnce(
        new Error('Backup not found'),
      );

      await expect(
        service.rollback('/nonexistent/backup.json'),
      ).rejects.toThrow('Failed to rollback');
    });

    it('should validate backup integrity before rollback', async () => {
      const backupPath = '/backup/file.json';

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(Buffer.from('invalid json'))
        .mockResolvedValueOnce(Buffer.from('{}'));

      await expect(service.rollback(backupPath)).rejects.toThrow(
        'Failed to rollback',
      );
    });
  });

  describe('rollbackComponent', () => {
    it('should rollback specific component', async () => {
      const componentType = 'settings';
      const backupManifest = {
        components: {
          settings: {
            originalPath: '/original/settings.json',
            backupPath: '/backup/settings.json',
            timestamp: Date.now(),
          },
        },
      };

      vi.mocked(fs.readFile)
        .mockReset()
        .mockResolvedValueOnce(Buffer.from(JSON.stringify(backupManifest)))
        .mockResolvedValueOnce(
          Buffer.from(JSON.stringify({ setting: 'value' })),
        );

      await service.rollbackComponent('/backup/manifest.json', componentType);

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/original/settings.json',
        expect.any(String),
      );
    });

    it('should throw error if component not found in manifest', async () => {
      const backupManifest = {
        components: {},
      };

      vi.mocked(fs.readFile).mockResolvedValueOnce(
        Buffer.from(JSON.stringify(backupManifest)),
      );

      await expect(
        service.rollbackComponent('/backup/manifest.json', 'nonexistent'),
      ).rejects.toThrow('Component nonexistent not found in backup manifest');
    });
  });

  describe('rollbackWithDependencies', () => {
    it('should rollback component and its dependencies', async () => {
      const backupManifest = {
        components: {
          agents: {
            originalPath: '/original/agents.json',
            backupPath: '/backup/agents.json',
            timestamp: Date.now(),
            dependencies: ['settings'],
          },
          settings: {
            originalPath: '/original/settings.json',
            backupPath: '/backup/settings.json',
            timestamp: Date.now(),
          },
        },
      };

      vi.mocked(fs.readFile)
        .mockReset()
        .mockResolvedValueOnce(Buffer.from(JSON.stringify(backupManifest)))
        .mockResolvedValueOnce(Buffer.from('{}'))
        .mockResolvedValueOnce(Buffer.from('{}'));

      await service.rollbackWithDependencies('/backup/manifest.json', 'agents');

      // Should rollback both agents and settings
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should handle circular dependencies', async () => {
      const backupManifest = {
        components: {
          a: {
            originalPath: '/a.json',
            backupPath: '/backup/a.json',
            timestamp: Date.now(),
            dependencies: ['b'],
          },
          b: {
            originalPath: '/b.json',
            backupPath: '/backup/b.json',
            timestamp: Date.now(),
            dependencies: ['a'],
          },
        },
      };

      vi.mocked(fs.readFile)
        .mockReset()
        .mockResolvedValueOnce(Buffer.from(JSON.stringify(backupManifest)))
        .mockResolvedValue(Buffer.from('{}'));

      await service.rollbackWithDependencies('/backup/manifest.json', 'a');

      // Should handle circular dependency without infinite loop
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanupOldBackups', () => {
    it('should remove backups older than retention period', async () => {
      const oldBackup = 'backup_20230101_120000.json';
      const recentBackup = `backup_${new Date().toISOString().slice(0, 10).replaceAll('-', '')}_120000.json`;

      vi.mocked(fs.readdir).mockResolvedValueOnce([
        oldBackup,
        recentBackup,
      ] as any);
      vi.mocked(fs.stat).mockImplementation(
        async (filePath) =>
          ({
            isFile: () => true,
            isDirectory: () => false,
            mtime: filePath.toString().includes('20230101')
              ? new Date('2023-01-01')
              : new Date(),
          }) as any,
      );

      await service.cleanupOldBackups(7); // 7 days retention

      expect(fs.rm).toHaveBeenCalledWith(expect.stringContaining(oldBackup), {
        force: true,
      });
      expect(fs.rm).not.toHaveBeenCalledWith(
        expect.stringContaining(recentBackup),
        expect.anything(),
      );
    });

    it('should keep backups within retention period', async () => {
      const recentBackup = `backup_${new Date().toISOString().slice(0, 10).replaceAll('-', '')}_120000.json`;

      vi.mocked(fs.readdir).mockResolvedValueOnce([recentBackup] as any);
      vi.mocked(fs.stat).mockResolvedValueOnce({
        isFile: () => true,
        isDirectory: () => false,
        mtime: new Date(),
      } as any);

      await service.cleanupOldBackups(30);

      expect(fs.rm).not.toHaveBeenCalled();
    });
  });

  describe('getBackupManifest', () => {
    it('should read and parse backup manifest', async () => {
      const manifest = {
        originalPath: '/original/file.json',
        backupPath: '/backup/file.json',
        timestamp: Date.now(),
      };

      vi.mocked(fs.readFile)
        .mockReset()
        .mockResolvedValueOnce(Buffer.from(JSON.stringify(manifest)));

      const result = await service.getBackupManifest('/backup/manifest.json');

      expect(result).toEqual(manifest);
    });

    it('should throw error for invalid manifest', async () => {
      vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('Parse error'));

      await expect(
        service.getBackupManifest('/backup/manifest.json'),
      ).rejects.toThrow('Failed to read backup manifest');
    });
  });

  describe('listBackups', () => {
    it('should list all backup files with metadata', async () => {
      const backupFiles = [
        'backup_20240101_120000.json',
        'backup_20240102_120000.json',
      ];

      vi.mocked(fs.readdir).mockResolvedValueOnce(backupFiles as any);
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: 1024,
        mtime: new Date('2024-01-01'),
      } as any);

      const backups = await service.listBackups();

      expect(backups).toHaveLength(2);
      expect(backups[0]).toMatchObject({
        filename: expect.stringContaining('backup_'),
        size: 1024,
        created: expect.any(Date),
      });
    });

    it('should filter out non-backup files', async () => {
      const files = [
        'backup_20240101_120000.json',
        'not-a-backup.txt',
        '.DS_Store',
      ];

      vi.mocked(fs.readdir).mockResolvedValueOnce(files as any);
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: 1024,
        mtime: new Date(),
      } as any);

      const backups = await service.listBackups();

      expect(backups).toHaveLength(1);
      expect(backups[0].filename).toContain('backup_20240101');
    });
  });
});
