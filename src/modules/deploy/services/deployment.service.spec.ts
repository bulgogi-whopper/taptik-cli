import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { PLATFORM_PATHS } from '../constants/platform-paths.constants';
import { DeployOptions } from '../interfaces/deploy-options.interface';

import { DeploymentService } from './deployment.service';
import { createMockTaptikContext } from './test-helpers';

vi.mock('fs/promises');

describe('DeploymentService', () => {
  let service: DeploymentService;
  let mockBackupService: any;
  let mockDiffService: any;
  let mockSecurityService: any;
  let mockValidatorService: any;
  let mockErrorRecoveryService: any;
  let mockPerformanceMonitorService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    // Mock fs operations
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('{}'));
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    } as any);

    // Mock services
    mockBackupService = {
      createBackup: vi.fn().mockResolvedValue('/backup/path'),
      rollback: vi.fn().mockResolvedValue(undefined),
    };

    mockDiffService = {
      generateDiff: vi.fn().mockReturnValue({
        hasChanges: false,
        additions: [],
        modifications: [],
        deletions: [],
      }),
      mergeConfigurations: vi
        .fn()
        .mockImplementation((source, target, strategy) => {
          if (strategy === 'overwrite') return source;
          if (strategy === 'skip') return target;
          return source;
        }),
    };

    mockSecurityService = {
      scanContext: vi.fn().mockResolvedValue({
        isSafe: true,
        hasApiKeys: false,
        hasMaliciousCommands: false,
      }),
      sanitizeSensitiveData: vi.fn().mockImplementation((ctx) => ctx),
    };

    mockValidatorService = {
      validateForPlatform: vi.fn().mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      }),
    };

    mockErrorRecoveryService = {
      recoverFromFailure: vi.fn().mockResolvedValue({
        success: true,
        recoveredComponents: [],
        errors: [],
        cleanedUp: true,
      }),
    };

    mockPerformanceMonitorService = {
      startDeploymentTiming: vi.fn(),
      endDeploymentTiming: vi.fn(),
      startComponentTiming: vi.fn(),
      endComponentTiming: vi.fn(),
      recordMemoryUsage: vi.fn(),
      generatePerformanceReport: vi.fn().mockReturnValue('Performance Report'),
      checkPerformanceThresholds: vi.fn().mockReturnValue([]),
      clearMetrics: vi.fn(),
    };

    service = new DeploymentService(
      mockBackupService,
      mockDiffService,
      mockSecurityService,
      mockValidatorService,
      mockErrorRecoveryService,
      mockPerformanceMonitorService,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('deployToClaudeCode', () => {
    it('should deploy configuration to Claude Code successfully', async () => {
      const context = createMockTaptikContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        conflictStrategy: 'overwrite',
        dryRun: false,
        validateOnly: false,
      };

      const result = await service.deployToClaudeCode(context, options);

      expect(result.success).toBe(true);
      expect(result.platform).toBe('claude-code');
      expect(mockValidatorService.validateForPlatform).toHaveBeenCalledWith(
        context,
        'claude-code',
      );
      expect(mockSecurityService.scanContext).toHaveBeenCalledWith(context);
    });

    it('should skip deployment in dry-run mode', async () => {
      const context = createMockTaptikContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        conflictStrategy: 'overwrite',
        dryRun: true,
        validateOnly: false,
      };

      const result = await service.deployToClaudeCode(context, options);

      expect(result.success).toBe(true);
      expect(result.summary.filesDeployed).toBe(0);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should validate only when validateOnly is true', async () => {
      const context = createMockTaptikContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        conflictStrategy: 'overwrite',
        dryRun: false,
        validateOnly: true,
      };

      const result = await service.deployToClaudeCode(context, options);

      expect(result.success).toBe(true);
      expect(result.summary.filesDeployed).toBe(0);
      expect(mockValidatorService.validateForPlatform).toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      const context = createMockTaptikContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        conflictStrategy: 'overwrite',
        dryRun: false,
        validateOnly: false,
      };

      mockValidatorService.validateForPlatform.mockResolvedValueOnce({
        isValid: false,
        errors: [
          {
            field: 'test',
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            severity: 'HIGH',
          },
        ],
        warnings: [],
      });

      const result = await service.deployToClaudeCode(context, options);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0].code).toBe('VALIDATION_ERROR');
    });

    it('should handle security scan failures', async () => {
      const context = createMockTaptikContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        conflictStrategy: 'overwrite',
        dryRun: false,
        validateOnly: false,
      };

      mockSecurityService.scanContext.mockResolvedValueOnce({
        isSafe: false,
        hasApiKeys: true,
        hasMaliciousCommands: false,
        blockers: ['Detected API keys'],
      });

      const result = await service.deployToClaudeCode(context, options);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0].code).toBe('SECURITY_CHECK_FAILED');
    });

    it('should create backup when backup strategy is used', async () => {
      const context = createMockTaptikContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        conflictStrategy: 'backup',
        dryRun: false,
        validateOnly: false,
      };

      await service.deployToClaudeCode(context, options);

      expect(mockBackupService.createBackup).toHaveBeenCalled();
    });

    it('should deploy only specified components', async () => {
      const context = createMockTaptikContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        conflictStrategy: 'overwrite',
        dryRun: false,
        validateOnly: false,
        components: ['settings'],
      };

      const result = await service.deployToClaudeCode(context, options);

      expect(result.success).toBe(true);
      expect(result.deployedComponents).toContain('settings');
      expect(result.deployedComponents).not.toContain('agents');
    });

    it('should skip specified components', async () => {
      const context = createMockTaptikContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        conflictStrategy: 'overwrite',
        dryRun: false,
        validateOnly: false,
        skipComponents: ['agents', 'commands'],
      };

      const result = await service.deployToClaudeCode(context, options);

      expect(result.success).toBe(true);
      expect(result.deployedComponents).not.toContain('agents');
      expect(result.deployedComponents).not.toContain('commands');
    });
  });

  describe('deployGlobalSettings', () => {
    it('should deploy global settings to Claude Code', async () => {
      const settings = {
        theme: 'dark',
        autoSave: true,
      };

      await service.deployGlobalSettings(settings);

      const expectedPath = path.join(
        os.homedir(),
        PLATFORM_PATHS.CLAUDE_CODE.GLOBAL_SETTINGS,
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expectedPath,
        JSON.stringify(settings, null, 2),
      );
    });

    it('should merge with existing settings', async () => {
      const existingSettings = { theme: 'light', fontSize: 14 };
      const newSettings = { theme: 'dark', autoSave: true };

      vi.mocked(fs.readFile).mockResolvedValueOnce(
        Buffer.from(JSON.stringify(existingSettings)),
      );

      await service.deployGlobalSettings(newSettings, 'merge');

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('dark'),
      );
    });

    it('should handle missing settings file', async () => {
      vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('File not found'));

      const settings = { theme: 'dark' };
      await service.deployGlobalSettings(settings);

      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('deployAgents', () => {
    it('should deploy agents to Claude Code directory', async () => {
      const agents = [
        {
          name: 'test-agent',
          content: 'Agent content',
          metadata: { version: '1.0.0' },
        },
      ];

      await service.deployAgents(agents);

      const expectedDirectory = path.join(
        os.homedir(),
        PLATFORM_PATHS.CLAUDE_CODE.AGENTS_DIR,
      );
      expect(fs.mkdir).toHaveBeenCalledWith(expectedDirectory, {
        recursive: true,
      });
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(expectedDirectory, 'test-agent.md'),
        'Agent content',
      );
    });

    it('should skip invalid agents', async () => {
      const agents = [
        { name: '', content: 'Invalid agent' },
        { name: 'valid-agent', content: 'Valid content' },
      ] as any;

      await service.deployAgents(agents);

      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('valid-agent'),
        'Valid content',
      );
    });
  });

  describe('deployCommands', () => {
    it('should deploy commands to Claude Code directory', async () => {
      const commands = [
        {
          name: 'build',
          content: 'npm run build',
          permissions: ['Bash(npm run build)'],
          metadata: { version: '1.0.0' },
        },
      ];

      await service.deployCommands(commands);

      const expectedDirectory = path.join(
        os.homedir(),
        PLATFORM_PATHS.CLAUDE_CODE.COMMANDS_DIR,
      );
      expect(fs.mkdir).toHaveBeenCalledWith(expectedDirectory, {
        recursive: true,
      });
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should include permissions in command file', async () => {
      const commands = [
        {
          name: 'deploy',
          content: 'npm run deploy',
          permissions: ['Bash(npm *)', 'Write(dist/*)'],
        },
      ];

      await service.deployCommands(commands);

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      expect(writeCall[1]).toContain('npm run deploy');
      expect(writeCall[1]).toContain('Bash(npm *)');
    });
  });

  describe('deployProjectSettings', () => {
    it('should deploy project settings to current directory', async () => {
      const projectSettings = {
        name: 'Test Project',
        customSettings: { buildCommand: 'npm run build' },
      };

      await service.deployProjectSettings(projectSettings);

      expect(fs.writeFile).toHaveBeenCalledWith(
        PLATFORM_PATHS.CLAUDE_CODE.PROJECT_SETTINGS,
        JSON.stringify(projectSettings, null, 2),
      );
    });

    it('should create CLAUDE.md if content exists', async () => {
      const projectSettings = {
        name: 'Test Project',
        claudeMd: '# Project Instructions\nTest content',
      };

      await service.deployProjectSettings(projectSettings);

      expect(fs.writeFile).toHaveBeenCalledWith(
        PLATFORM_PATHS.CLAUDE_CODE.CLAUDE_MD,
        '# Project Instructions\nTest content',
      );
    });
  });

  describe('handleConflicts', () => {
    it('should handle conflicts with skip strategy', async () => {
      const context = createMockTaptikContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        conflictStrategy: 'skip',
        dryRun: false,
        validateOnly: false,
      };

      mockDiffService.generateDiff.mockReturnValueOnce({
        hasChanges: true,
        additions: [],
        modifications: [{ path: 'settings.theme', type: 'modification' }],
        deletions: [],
      });

      const result = await service.deployToClaudeCode(context, options);

      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.summary.filesSkipped).toBeGreaterThan(0);
    });

    it('should handle conflicts with overwrite strategy', async () => {
      const context = createMockTaptikContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        conflictStrategy: 'overwrite',
        dryRun: false,
        validateOnly: false,
      };

      mockDiffService.generateDiff.mockReturnValueOnce({
        hasChanges: true,
        modifications: [{ path: 'settings.theme', type: 'modification' }],
        additions: [],
        deletions: [],
      });

      const result = await service.deployToClaudeCode(context, options);

      expect(result.success).toBe(true);
      expect(result.summary.conflictsResolved).toBeGreaterThan(0);
    });
  });
});
