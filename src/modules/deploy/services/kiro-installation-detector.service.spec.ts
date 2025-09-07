import * as fs from 'node:fs/promises';
import * as os from 'node:os';

import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { KiroInstallationDetectorService } from './kiro-installation-detector.service';

vi.mock('node:fs/promises');
vi.mock('node:os');
vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => ({
    stdout: {
      on: vi.fn(),
    },
    on: vi.fn((event, callback) => {
      if (event === 'close') {
        setTimeout(() => callback(1), 0); // Simulate process failure
      }
      if (event === 'error') {
        setTimeout(() => callback(new Error('Process failed')), 0);
      }
    }),
    kill: vi.fn(),
  })),
}));

describe('KiroInstallationDetectorService', () => {
  let service: KiroInstallationDetectorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KiroInstallationDetectorService],
    }).compile();

    service = module.get<KiroInstallationDetectorService>(
      KiroInstallationDetectorService,
    );
    vi.clearAllMocks();
  });

  describe('detectKiroInstallation', () => {
    it('should detect Kiro installation when found', async () => {
      // Mock successful installation detection
      vi.mocked(fs.access).mockResolvedValueOnce(undefined);
      vi.mocked(fs.readFile).mockResolvedValueOnce('{"version": "2.0.0"}');
      vi.mocked(os.homedir).mockReturnValue('/home/user');

      const result = await service.detectKiroInstallation();

      expect(result.isInstalled).toBe(true);
      expect(result.version).toBe('2.0.0');
      expect(result.isCompatible).toBe(true);
    });

    it('should return not installed when Kiro is not found', async () => {
      // Mock installation not found
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const result = await service.detectKiroInstallation();

      expect(result.isInstalled).toBe(false);
      expect(result.isCompatible).toBe(false);
      expect(result.version).toBeUndefined();
    });

    it('should detect installation with unknown version', async () => {
      // Mock installation found but version detection fails
      vi.mocked(fs.access).mockResolvedValueOnce(undefined);
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));
      vi.mocked(os.homedir).mockReturnValue('/home/user');

      const result = await service.detectKiroInstallation();

      expect(result.isInstalled).toBe(true);
      expect(result.version).toBeUndefined();
    });
  });

  describe('checkCompatibility', () => {
    it('should return compatible for supported versions', async () => {
      const result = await service.checkCompatibility('2.0.0');

      expect(result.isCompatible).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.migrationRequired).toBe(false);
    });

    it('should detect incompatible old versions', async () => {
      const result = await service.checkCompatibility('0.9.0');

      expect(result.isCompatible).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'version',
            severity: 'critical',
            message: 'Kiro IDE version 0.9.0 is not officially supported',
          }),
        ]),
      );
      expect(result.migrationRequired).toBe(true);
    });

    it('should handle missing version', async () => {
      const result = await service.checkCompatibility(undefined);

      expect(result.isCompatible).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'version',
            severity: 'critical',
            message: 'Unable to determine Kiro IDE version',
          }),
        ]),
      );
    });

    it('should detect feature compatibility issues for old versions', async () => {
      const result = await service.checkCompatibility('1.0.0');

      // Version 1.0.0 should have some feature limitations
      const featureIssues = result.issues.filter(
        (issue) => issue.type === 'feature',
      );
      expect(featureIssues.length).toBeGreaterThan(0);
    });

    it('should generate appropriate recommendations', async () => {
      const result = await service.checkCompatibility('1.1.0');

      expect(result.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Consider upgrading to Kiro IDE v2.0.0'),
        ]),
      );
    });
  });

  describe('performHealthCheck', () => {
    it('should pass health check for healthy installation', async () => {
      // Mock healthy installation
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue('{"version": "2.0.0"}');
      vi.mocked(os.homedir).mockReturnValue('/home/user');

      const result = await service.performHealthCheck();

      expect(result.healthy).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect installation health issues', async () => {
      // Mock installation not found
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const result = await service.performHealthCheck();

      expect(result.healthy).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'installation',
            severity: 'critical',
            message:
              'Kiro IDE is not installed or not found in expected locations',
          }),
        ]),
      );
    });

    it('should detect configuration health issues', async () => {
      // Mock installation found but corrupted config
      vi.mocked(fs.access).mockImplementation((filePath) => {
        if (
          typeof filePath === 'string' &&
          filePath.includes('settings.json')
        ) {
          return Promise.resolve();
        }
        return Promise.resolve();
      });
      vi.mocked(fs.readFile).mockImplementation((filePath) => {
        if (
          typeof filePath === 'string' &&
          filePath.includes('settings.json')
        ) {
          return Promise.resolve('invalid json{');
        }
        return Promise.resolve('{"version": "2.0.0"}');
      });
      vi.mocked(os.homedir).mockReturnValue('/home/user');

      const result = await service.performHealthCheck();

      const configIssues = result.issues.filter(
        (issue) => issue.category === 'configuration',
      );
      expect(configIssues.length).toBeGreaterThan(0);
    });

    it('should detect permission issues', async () => {
      // Mock permission errors
      vi.mocked(fs.access).mockImplementation((filePath, mode) => {
        if (mode === (fs.constants.R_OK | fs.constants.W_OK)) {
          return Promise.reject(new Error('EACCES'));
        }
        return Promise.resolve();
      });
      vi.mocked(os.homedir).mockReturnValue('/home/user');

      const result = await service.performHealthCheck();

      const permissionIssues = result.issues.filter(
        (issue) => issue.category === 'permissions',
      );
      expect(permissionIssues.length).toBeGreaterThan(0);
    });

    it('should generate health recommendations', async () => {
      // Mock critical issues
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const result = await service.performHealthCheck();

      expect(result.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Address critical issues'),
        ]),
      );
    });

    it('should generate auto-fixable health fixes', async () => {
      // Mock configuration issues that are auto-fixable
      vi.mocked(fs.access).mockImplementation((filePath) => {
        if (
          typeof filePath === 'string' &&
          filePath.includes('settings.json')
        ) {
          return Promise.resolve();
        }
        return Promise.resolve();
      });
      vi.mocked(fs.readFile).mockImplementation((filePath) => {
        if (
          typeof filePath === 'string' &&
          filePath.includes('settings.json')
        ) {
          return Promise.resolve('invalid json{');
        }
        return Promise.resolve('{"version": "2.0.0"}');
      });
      vi.mocked(os.homedir).mockReturnValue('/home/user');

      const result = await service.performHealthCheck();

      const autoFixableFixes = result.fixes.filter((fix) => fix.automated);
      expect(autoFixableFixes.length).toBeGreaterThan(0);
    });
  });

  describe('migrateConfiguration', () => {
    it('should successfully migrate supported version path', async () => {
      // Mock successful migration
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      const result = await service.migrateConfiguration('1.0.0', '1.1.0');

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'MIGRATION_BACKUP_CREATED',
          }),
        ]),
      );
    });

    it('should reject unsupported migration paths', async () => {
      const result = await service.migrateConfiguration('0.5.0', '2.0.0');

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'MIGRATION_NOT_SUPPORTED',
            severity: 'HIGH',
          }),
        ]),
      );
    });

    it('should handle migration step failures', async () => {
      // Mock backup creation failure
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('Permission denied'));

      const result = await service.migrateConfiguration('1.0.0', '1.1.0');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('version comparison', () => {
    it('should correctly compare versions', async () => {
      // Test through compatibility check which uses version comparison
      const olderResult = await service.checkCompatibility('1.0.0');
      const newerResult = await service.checkCompatibility('2.0.0');

      // Older version should have more issues
      expect(olderResult.issues.length).toBeGreaterThan(
        newerResult.issues.length,
      );
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully during detection', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Unexpected error'));

      const result = await service.detectKiroInstallation();

      expect(result.isInstalled).toBe(false);
      expect(result.isCompatible).toBe(false);
    });

    it('should handle health check errors gracefully', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Unexpected error'));

      const result = await service.performHealthCheck();

      expect(result.healthy).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'installation',
            severity: 'critical',
          }),
        ]),
      );
    });
  });
});
