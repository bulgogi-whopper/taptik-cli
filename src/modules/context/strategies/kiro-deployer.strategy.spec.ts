import * as path from 'node:path';

import * as fs from 'fs-extra';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AIPlatform, TaptikContext } from '../interfaces';

import { KiroDeployerStrategy } from './kiro-deployer.strategy';

// Mock fs-extra
vi.mock('fs-extra', () => ({
  default: {
    stat: vi.fn(),
    access: vi.fn(),
    constants: { W_OK: 2 },
    pathExists: vi.fn(),
    ensureDir: vi.fn(),
    writeFile: vi.fn(),
    writeJson: vi.fn(),
    remove: vi.fn(),
    copy: vi.fn(),
    readdir: vi.fn(),
  },
  stat: vi.fn(),
  access: vi.fn(),
  constants: { W_OK: 2 },
  pathExists: vi.fn(),
  ensureDir: vi.fn(),
  writeFile: vi.fn(),
  writeJson: vi.fn(),
  remove: vi.fn(),
  copy: vi.fn(),
  readdir: vi.fn(),
}));

describe('KiroDeployerStrategy', () => {
  let strategy: KiroDeployerStrategy;
  let mockFileSystem: any;
  let mockProgress: any;

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
      getAllFiles: vi.fn(),
    };

    mockProgress = {
      start: vi.fn(),
      update: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
    };

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock behaviors
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    (vi.mocked(fs.pathExists) as any).mockResolvedValue(false);
    vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.writeJson).mockResolvedValue(undefined);
    vi.mocked(fs.remove).mockResolvedValue(undefined);
    vi.mocked(fs.copy).mockResolvedValue(undefined);
    vi.mocked(fs.readdir).mockResolvedValue([] as any);

    // Setup mockFileSystem methods
    mockFileSystem.getAllFiles.mockResolvedValue([]);

    strategy = new KiroDeployerStrategy(mockFileSystem, mockProgress);
  });

  describe('canDeploy', () => {
    it('should return true for valid writable directory', async () => {
      const result = await strategy.canDeploy('/test/path');

      expect(result).toBe(true);
      expect(fs.stat).toHaveBeenCalledWith('/test/path');
      expect(fs.access).toHaveBeenCalledWith('/test/path', fs.constants.W_OK);
    });

    it('should return false for non-directory', async () => {
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as any);

      const result = await strategy.canDeploy('/test/file.txt');

      expect(result).toBe(false);
    });

    it('should return false for non-writable path', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Permission denied'));

      const result = await strategy.canDeploy('/test/path');

      expect(result).toBe(false);
    });

    it('should return false for non-existent path', async () => {
      vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));

      const result = await strategy.canDeploy('/non/existent');

      expect(result).toBe(false);
    });
  });

  describe('deploy', () => {
    const mockContext: TaptikContext = {
      version: '1.0.0',
      metadata: {
        name: 'test-context',
        created_at: '2024-01-01',
        platforms: [AIPlatform.KIRO],
      },
      project: {
        spec_version: '1.0.0',
        category: 'project',
        data: {
          kiro_specs: [
            {
              name: 'auth-feature',
              requirements: '# Auth Feature Requirements\nUser authentication system',
              design: '# Auth Feature Design\nArchitecture details',
              tasks: '# Auth Feature Tasks\n- [ ] Implement auth service',
            },
            {
              name: 'user-management',
              requirements: '# User Management Requirements\nUser CRUD operations',
              design: '# User Management Design\nDatabase schema',
              tasks: '# User Management Tasks\n- [ ] Create user model',
            },
            {
              name: 'api-integration',
              requirements: '# API Integration Requirements\nExternal API connections',
              design: '# API Integration Design\nAPI architecture and endpoints',
              tasks: '# API Integration Tasks\n- [ ] Set up API client',
            },
          ],
        },
      },
      ide: {
        spec_version: '1.0.0',
        category: 'ide',
        data: {
          kiro: {
            specs_path: '.kiro/specs',
            steering_rules: [
              {
                name: 'principle',
                description: 'Core principles',
                rules: ['# Principles\nCore principles'],
              },
              {
                name: 'architecture',
                description: 'System architecture',
                rules: ['# Architecture\nSystem architecture'],
              },
            ],
            hooks: [
              {
                name: 'pre-commit',
                enabled: true,
                description: 'Pre-commit hook',
                version: '1.0.0',
                when: { type: 'pre-commit', patterns: ['*.ts'] },
                // eslint-disable-next-line unicorn/no-thenable
                then: { type: 'script', command: 'npm run lint' },
              },
            ],
            mcp_settings: { servers: [] },
            project_settings: {
              specification_driven: true,
              auto_test: true,
              incremental_progress: true,
              task_confirmation: true,
            },
          },
        },
      },
    };

    it('should deploy Kiro context successfully', async () => {
      const result = await strategy.deploy(mockContext, '/test/path');

      expect(result.success).toBe(true);
      expect(result.deployed_items).toHaveLength(14); // 9 spec files (3+3+3) + 2 steering + 1 hook + 2 settings
      expect(result.rollback_available).toBe(true);
      expect(fs.ensureDir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
      expect(fs.writeJson).toHaveBeenCalled();
    });

    it('should handle dry run mode', async () => {
      const result = await strategy.deploy(mockContext, '/test/path', {
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(fs.writeJson).not.toHaveBeenCalled();
    });

    it('should create backup when requested', async () => {
      (vi.mocked(fs.pathExists) as any).mockResolvedValueOnce(true); // .kiro exists for backup
      (vi.mocked(fs.pathExists) as any).mockResolvedValue(false); // Other files don't exist

      await strategy.deploy(mockContext, '/test/path', { backup: true });

      expect(fs.copy).toHaveBeenCalled();
    });

    it('should handle overwrite option', async () => {
      (vi.mocked(fs.pathExists) as any).mockResolvedValue(true); // All files exist

      const result = await strategy.deploy(mockContext, '/test/path', {
        overwrite: true,
      });

      expect(result.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should skip existing files when preserveExisting is true', async () => {
      (vi.mocked(fs.pathExists) as any).mockResolvedValue(true); // All files exist

      const result = await strategy.deploy(mockContext, '/test/path', {
        preserveExisting: true,
      });

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Skipped existing file');
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should return error when no Kiro data in context', async () => {
      const emptyContext: TaptikContext = {
        version: '1.0.0',
        metadata: {
          name: 'test-empty-deploy-context',
          created_at: '2024-01-01',
          platforms: [],
        },
      };

      const result = await strategy.deploy(emptyContext, '/test/path');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].error).toBe(
        'No Kiro configuration found in context',
      );
    });

    it('should return error when target path is invalid', async () => {
      vi.mocked(fs.stat).mockRejectedValue(new Error('Invalid path'));

      const result = await strategy.deploy(mockContext, '/invalid/path');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].error).toBe(
        'Target path is not valid or writable',
      );
    });
  });

  describe('validateCompatibility', () => {
    const mockContext: TaptikContext = {
      version: '1.0.0',
      metadata: {
        name: 'test-validate-context',
        created_at: '2024-01-01',
        platforms: [AIPlatform.KIRO],
      },
      ide: {
        data: {
          kiro: {
            specs_path: '.kiro/specs',
            steering_rules: [],
          },
        },
      },
    };

    it('should validate compatible context', async () => {
      const result = await strategy.validateCompatibility(
        mockContext,
        '/test/path',
      );

      expect(result.compatible).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect missing Kiro data', async () => {
      const emptyContext: TaptikContext = {
        version: '1.0.0',
        metadata: {
          name: 'test-empty-context',
          created_at: '2024-01-01',
          platforms: [],
        },
      };

      const result = await strategy.validateCompatibility(
        emptyContext,
        '/test/path',
      );

      expect(result.compatible).toBe(false);
      expect(result.issues).toContain('No Kiro configuration found in context');
    });

    it('should detect invalid target path', async () => {
      vi.mocked(fs.stat).mockRejectedValue(new Error('Invalid'));

      const result = await strategy.validateCompatibility(
        mockContext,
        '/invalid',
      );

      expect(result.compatible).toBe(false);
      expect(result.issues).toContain('Target path is not valid or writable');
    });

    it('should warn about existing customizations', async () => {
      (vi.mocked(fs.pathExists) as any).mockResolvedValue(true);
      vi.mocked(fs.readdir).mockResolvedValue([
        'specs',
        'steering',
        'custom-dir',
      ] as any);
      vi.mocked(fs.stat).mockImplementation((path: string) => {
        if (path === '/test/path') {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.resolve({
          isDirectory: () => path.includes('custom-dir'),
          isFile: () => !path.includes('custom-dir'),
        });
      });

      const result = await strategy.validateCompatibility(
        mockContext,
        '/test/path',
      );

      expect(result.compatible).toBe(false);
      expect(result.issues).toContain(
        'Existing Kiro configuration has customizations that may be overwritten',
      );
    });
  });

  describe('undeploy', () => {
    it('should remove Kiro configuration', async () => {
      (vi.mocked(fs.pathExists) as any).mockResolvedValue(true);

      const result = await strategy.undeploy('/test/path');

      expect(result).toBe(true);
      expect(fs.remove).toHaveBeenCalledWith(path.join('/test/path', '.kiro'));
    });

    it('should return false when no Kiro configuration exists', async () => {
      (vi.mocked(fs.pathExists) as any).mockResolvedValue(false);

      const result = await strategy.undeploy('/test/path');

      expect(result).toBe(false);
      expect(fs.remove).not.toHaveBeenCalled();
    });

    it('should handle removal errors', async () => {
      (vi.mocked(fs.pathExists) as any).mockResolvedValue(true);
      vi.mocked(fs.remove).mockRejectedValue(new Error('Permission denied'));

      const result = await strategy.undeploy('/test/path');

      expect(result).toBe(false);
    });
  });
});
