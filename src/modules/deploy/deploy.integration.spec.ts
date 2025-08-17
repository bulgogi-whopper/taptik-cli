import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { TaptikContext } from '../context/interfaces/taptik-context.interface';

import { DeployModule } from './deploy.module';
import { DeployOptions } from './interfaces/deploy-options.interface';
import { BackupService } from './services/backup.service';
import { DeploymentService } from './services/deployment.service';
import { ErrorRecoveryService } from './services/error-recovery.service';
import { ImportService } from './services/import.service';

vi.mock('fs/promises');

// Mock environment variables for testing
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';

describe('Deploy Module Integration Tests', () => {
  let module: TestingModule;
  let deploymentService: DeploymentService;
  let importService: ImportService;
  let _backupService: BackupService;
  let errorRecoveryService: ErrorRecoveryService;

  const mockContext: TaptikContext = {
    metadata: {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      sourceIde: 'kiro-ide',
      targetIdes: ['claude-code'],
      title: 'Test Context',
    },
    content: {
      personal: {
        name: 'Test User',
        email: 'test@example.com',
      },
      project: {
        name: 'Test Project',
        description: 'Test project for integration testing',
        claudeMd: 'Test CLAUDE.md content',
      },
      tools: {
        agents: [
          {
            name: 'test-agent',
            content: 'Test agent content',
          },
        ],
        commands: [
          {
            name: 'test-command',
            content: '#!/bin/bash\necho "test"',
            permissions: ['read', 'write'],
          },
        ],
      },
      ide: {
        claudeCode: {
          settings: {
            theme: 'dark',
            fontSize: 14,
          },
        },
      },
    },
    security: {
      hasApiKeys: false,
      filteredFields: [],
      scanResults: {
        passed: true,
        warnings: [],
      },
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock fs operations
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('{}'));
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readdir).mockResolvedValue([]);
    vi.mocked(fs.unlink).mockResolvedValue(undefined);
    vi.mocked(fs.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
      mtime: new Date(),
    } as any);

    // Create mock SupabaseService
    const mockSupabaseService = {
      getClient: vi.fn().mockReturnValue({
        storage: {
          from: vi.fn().mockReturnValue({
            download: vi.fn().mockResolvedValue({
              data: new Blob([JSON.stringify(mockContext)]),
              error: null,
            }),
            list: vi.fn().mockResolvedValue({
              data: [{ name: 'test-config.json' }],
              error: null,
            }),
          }),
        },
      }),
    };

    // Create Testing Module with mocked SupabaseService
    const { SupabaseService } = await import('../supabase/supabase.service');

    module = await Test.createTestingModule({
      imports: [DeployModule],
    })
      .overrideProvider(SupabaseService)
      .useValue(mockSupabaseService)
      .compile();

    deploymentService = module.get<DeploymentService>(DeploymentService);
    importService = module.get<ImportService>(ImportService);
    _backupService = module.get<BackupService>(BackupService);
    errorRecoveryService =
      module.get<ErrorRecoveryService>(ErrorRecoveryService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('End-to-End Deployment Workflow', () => {
    it('should complete full import → validate → deploy → backup flow', async () => {
      // Step 1: Import configuration
      const importedContext =
        await importService.importFromSupabase('test-config');
      expect(importedContext).toBeDefined();
      expect(importedContext.metadata?.title).toBe('Test Context');

      // Step 2: Deploy to Claude Code
      const deployOptions: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        validateOnly: false,
        conflictStrategy: 'overwrite',
      };

      const deployResult = await deploymentService.deployToClaudeCode(
        importedContext,
        deployOptions,
      );

      // Verify deployment success
      expect(deployResult.success).toBe(true);
      expect(deployResult.platform).toBe('claude-code');
      expect(deployResult.deployedComponents).toContain('settings');

      // Verify backup was created
      expect(deployResult.metadata?.backupCreated).toBeDefined();

      // Verify files were written
      const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
      expect(fs.writeFile).toHaveBeenCalledWith(
        settingsPath,
        expect.any(String),
      );
    });

    it('should deploy all component types successfully', async () => {
      const context = await importService.importFromSupabase('test-config');

      const deployOptions: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        validateOnly: false,
        conflictStrategy: 'overwrite',
        components: ['settings', 'agents', 'commands', 'project'],
      };

      const result = await deploymentService.deployToClaudeCode(
        context,
        deployOptions,
      );

      expect(result.success).toBe(true);
      expect(result.deployedComponents).toContain('settings');
      expect(result.deployedComponents).toContain('agents');
      expect(result.deployedComponents).toContain('commands');
      expect(result.deployedComponents).toContain('project');

      // Verify each component was deployed
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('settings.json'),
        expect.any(String),
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-agent.md'),
        expect.any(String),
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-command.sh'),
        expect.any(String),
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('CLAUDE.md'),
        expect.any(String),
      );
    });

    it('should handle deployment failure with automatic rollback', async () => {
      // Mock a failure during deployment
      vi.mocked(fs.writeFile).mockRejectedValueOnce(
        new Error('Permission denied'),
      );

      const context = await importService.importFromSupabase('test-config');

      const deployOptions: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        validateOnly: false,
        conflictStrategy: 'overwrite',
      };

      const result = await deploymentService.deployToClaudeCode(
        context,
        deployOptions,
      );

      // Deployment should fail
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);

      // Recovery should have been attempted if backup was created
      if (result.metadata?.backupCreated) {
        // Verify recovery service was used
        const recoveryResult = await errorRecoveryService.recoverFromFailure(
          result,
          {
            platform: 'claudeCode',
            backupId: result.metadata.backupCreated,
          },
        );

        expect(recoveryResult).toBeDefined();
      }
    });

    it('should validate configuration before deployment', async () => {
      const context = await importService.importFromSupabase('test-config');

      const deployOptions: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        validateOnly: true, // Only validate, don't deploy
        conflictStrategy: 'overwrite',
      };

      const result = await deploymentService.deployToClaudeCode(
        context,
        deployOptions,
      );

      // Should return validation results without deploying
      expect(result.success).toBe(true);
      expect(result.deployedComponents).toHaveLength(0);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle dry-run mode correctly', async () => {
      const context = await importService.importFromSupabase('test-config');

      const deployOptions: DeployOptions = {
        platform: 'claude-code',
        dryRun: true, // Dry run mode
        validateOnly: false,
        conflictStrategy: 'overwrite',
      };

      const result = await deploymentService.deployToClaudeCode(
        context,
        deployOptions,
      );

      // Should simulate deployment without actual file operations
      expect(result.success).toBe(true);
      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(fs.mkdir).not.toHaveBeenCalled();
    });

    it('should handle selective component deployment', async () => {
      const context = await importService.importFromSupabase('test-config');

      const deployOptions: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        validateOnly: false,
        conflictStrategy: 'overwrite',
        components: ['settings', 'agents'], // Only deploy specific components
        skipComponents: ['commands'], // Skip commands
      };

      const result = await deploymentService.deployToClaudeCode(
        context,
        deployOptions,
      );

      expect(result.success).toBe(true);
      expect(result.deployedComponents).toContain('settings');
      expect(result.deployedComponents).toContain('agents');
      expect(result.deployedComponents).not.toContain('commands');
      expect(result.deployedComponents).not.toContain('project');
    });

    it('should error gracefully for unsupported platforms', async () => {
      const context = await importService.importFromSupabase('test-config');

      const deployOptions: DeployOptions = {
        platform: 'kiro-ide' as any, // Unsupported platform
        dryRun: false,
        validateOnly: false,
        conflictStrategy: 'overwrite',
      };

      await expect(async () => {
        await deploymentService.deployToClaudeCode(context, deployOptions);
      }).rejects.toThrow();
    });

    it('should handle concurrent deployments with locking', async () => {
      const context = await importService.importFromSupabase('test-config');

      const deployOptions: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        validateOnly: false,
        conflictStrategy: 'overwrite',
      };

      // Start two deployments concurrently
      const deployment1 = deploymentService.deployToClaudeCode(
        context,
        deployOptions,
      );
      const deployment2 = deploymentService.deployToClaudeCode(
        context,
        deployOptions,
      );

      const results = await Promise.allSettled([deployment1, deployment2]);

      // At least one should succeed
      const successfulDeployments = results.filter(
        (r) => r.status === 'fulfilled' && r.value.success,
      );
      expect(successfulDeployments.length).toBeGreaterThan(0);
    });

    it('should sanitize sensitive data during deployment', async () => {
      const contextWithSecrets = {
        ...mockContext,
        content: {
          ...mockContext.content,
          project: {
            ...mockContext.content.project,
            apiKey: 'secret-api-key-123',
            password: 'secret-password',
          },
        },
      };

      // Mock import to return context with secrets
      vi.spyOn(importService, 'importFromSupabase').mockResolvedValueOnce(
        contextWithSecrets as TaptikContext,
      );

      const context = await importService.importFromSupabase('test-config');

      const deployOptions: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        validateOnly: false,
        conflictStrategy: 'overwrite',
      };

      const result = await deploymentService.deployToClaudeCode(
        context,
        deployOptions,
      );

      // Verify sensitive data was sanitized
      expect(result.success).toBe(true);

      // Check that written files don't contain secrets
      const writeCalls = vi.mocked(fs.writeFile).mock.calls;
      for (const call of writeCalls) {
        const content = call[1] as string;
        expect(content).not.toContain('secret-api-key-123');
        expect(content).not.toContain('secret-password');
      }
    });

    it('should create and validate backup manifest', async () => {
      const context = await importService.importFromSupabase('test-config');

      const deployOptions: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        validateOnly: false,
        conflictStrategy: 'backup',
      };

      const result = await deploymentService.deployToClaudeCode(
        context,
        deployOptions,
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.backupCreated).toBeDefined();

      // Verify backup manifest was created
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('manifest.json'),
        expect.stringContaining('"platform":"claude-code"'),
      );
    });
  });
});
