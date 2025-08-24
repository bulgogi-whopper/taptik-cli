import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DeployCommand } from './deploy.command';
import { DeploymentService } from '../services/deployment.service';
import { ImportService } from '../services/import.service';
import { SupportedPlatform } from '../interfaces/deploy-options.interface';
import { DeploymentResult } from '../interfaces/deployment-result.interface';

describe('DeployCommand', () => {
  let deployCommand: DeployCommand;
  let deploymentService: DeploymentService;
  let importService: ImportService;

  const mockImportService = {
    importFromSupabase: vi.fn(),
  };

  const mockDeploymentService = {
    deployToClaudeCode: vi.fn(),
    deployToKiro: vi.fn(),
    deployToCursor: vi.fn(),
  };

  const mockTaptikContext = {
    metadata: {
      title: 'Test Configuration',
      version: '1.0.0',
    },
    content: {
      ide: {
        claudeCode: {
          settings: {},
        },
      },
    },
    security: {},
  };

  const mockDeploymentResult: DeploymentResult = {
    success: true,
    platform: 'claude-code',
    deployedComponents: ['settings'],
    conflicts: [],
    summary: {
      filesDeployed: 1,
      filesSkipped: 0,
      conflictsResolved: 0,
      backupCreated: false,
    },
    errors: [],
    warnings: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeployCommand,
        {
          provide: ImportService,
          useValue: mockImportService,
        },
        {
          provide: DeploymentService,
          useValue: mockDeploymentService,
        },
      ],
    }).compile();

    deployCommand = module.get<DeployCommand>(DeployCommand);
    deploymentService = module.get<DeploymentService>(DeploymentService);
    importService = module.get<ImportService>(ImportService);

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('Platform Detection', () => {
    describe('parsePlatform', () => {
      it('should accept claude-code as valid platform', () => {
        const result = deployCommand.parsePlatform('claude-code');
        expect(result).toBe('claude-code');
      });

      it('should accept kiro-ide as valid platform', () => {
        const result = deployCommand.parsePlatform('kiro-ide');
        expect(result).toBe('kiro-ide');
      });

      it('should accept cursor-ide as valid platform', () => {
        const result = deployCommand.parsePlatform('cursor-ide');
        expect(result).toBe('cursor-ide');
      });

      it('should throw error for unsupported platform', () => {
        expect(() => deployCommand.parsePlatform('invalid-platform')).toThrow(
          'Unsupported platform: invalid-platform. Supported platforms: claude-code, kiro-ide, cursor-ide',
        );
      });

      it('should throw error for empty platform', () => {
        expect(() => deployCommand.parsePlatform('')).toThrow(
          'Unsupported platform: . Supported platforms: claude-code, kiro-ide, cursor-ide',
        );
      });
    });
  });

  describe('Platform Routing', () => {
    beforeEach(() => {
      mockImportService.importFromSupabase.mockResolvedValue(mockTaptikContext);
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    });

    it('should route to Claude Code deployment service', async () => {
      mockDeploymentService.deployToClaudeCode.mockResolvedValue({
        ...mockDeploymentResult,
        platform: 'claude-code',
      });

      await deployCommand.run([], {
        platform: 'claude-code',
        contextId: 'test-config',
      });

      expect(mockDeploymentService.deployToClaudeCode).toHaveBeenCalledWith(
        mockTaptikContext,
        expect.objectContaining({
          platform: 'claude-code',
          dryRun: false,
          validateOnly: false,
          conflictStrategy: 'prompt',
        }),
      );
      expect(mockDeploymentService.deployToKiro).not.toHaveBeenCalled();
      expect(mockDeploymentService.deployToCursor).not.toHaveBeenCalled();
    });

    it('should route to Kiro IDE deployment service', async () => {
      mockDeploymentService.deployToKiro.mockResolvedValue({
        ...mockDeploymentResult,
        platform: 'kiro-ide',
      });

      await deployCommand.run([], {
        platform: 'kiro-ide',
        contextId: 'test-config',
      });

      expect(mockDeploymentService.deployToKiro).toHaveBeenCalledWith(
        mockTaptikContext,
        expect.objectContaining({
          platform: 'kiro-ide',
          dryRun: false,
          validateOnly: false,
          conflictStrategy: 'prompt',
        }),
      );
      expect(mockDeploymentService.deployToClaudeCode).not.toHaveBeenCalled();
      expect(mockDeploymentService.deployToCursor).not.toHaveBeenCalled();
    });

    it('should route to Cursor IDE deployment service', async () => {
      mockDeploymentService.deployToCursor.mockResolvedValue({
        ...mockDeploymentResult,
        platform: 'cursor-ide',
        warnings: [
          {
            message: 'Cursor IDE deployment is currently in development. This is a placeholder implementation.',
            code: 'CURSOR_DEVELOPMENT_STATUS',
          },
        ],
      });

      await deployCommand.run([], {
        platform: 'cursor-ide',
        contextId: 'test-config',
      });

      expect(mockDeploymentService.deployToCursor).toHaveBeenCalledWith(
        mockTaptikContext,
        expect.objectContaining({
          platform: 'cursor-ide',
          dryRun: false,
          validateOnly: false,
          conflictStrategy: 'prompt',
        }),
      );
      expect(mockDeploymentService.deployToClaudeCode).not.toHaveBeenCalled();
      expect(mockDeploymentService.deployToKiro).not.toHaveBeenCalled();
    });
  });

  describe('Platform Validation', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    });

    it('should accept cursor-ide platform without error', async () => {
      mockImportService.importFromSupabase.mockResolvedValue(mockTaptikContext);
      mockDeploymentService.deployToCursor.mockResolvedValue({
        ...mockDeploymentResult,
        platform: 'cursor-ide',
      });

      await deployCommand.run([], {
        platform: 'cursor-ide',
        contextId: 'test-config',
      });

      expect(process.exit).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Platform \'cursor-ide\' is not supported'),
      );
    });

    it('should reject unsupported platform and exit', async () => {
      await deployCommand.run([], {
        platform: 'unsupported-platform' as SupportedPlatform,
        contextId: 'test-config',
      });

      expect(console.error).toHaveBeenCalledWith(
        '❌ Platform \'unsupported-platform\' is not supported. Supported platforms: \'claude-code\', \'kiro-ide\', \'cursor-ide\'',
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('Default Platform', () => {
    beforeEach(() => {
      mockImportService.importFromSupabase.mockResolvedValue(mockTaptikContext);
      mockDeploymentService.deployToClaudeCode.mockResolvedValue(mockDeploymentResult);
      vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('should default to claude-code when no platform specified', async () => {
      await deployCommand.run([], {
        contextId: 'test-config',
      });

      expect(mockDeploymentService.deployToClaudeCode).toHaveBeenCalledWith(
        mockTaptikContext,
        expect.objectContaining({
          platform: 'claude-code',
        }),
      );
    });
  });

  describe('Deployment Options', () => {
    beforeEach(() => {
      mockImportService.importFromSupabase.mockResolvedValue(mockTaptikContext);
      mockDeploymentService.deployToCursor.mockResolvedValue({
        ...mockDeploymentResult,
        platform: 'cursor-ide',
      });
      vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('should pass all deployment options to Cursor service', async () => {
      await deployCommand.run([], {
        platform: 'cursor-ide',
        contextId: 'test-config',
        dryRun: true,
        validateOnly: false,
        conflictStrategy: 'merge',
        components: ['settings', 'ai-config'],
        skipComponents: ['debug-config'],
        force: true,
      });

      expect(mockDeploymentService.deployToCursor).toHaveBeenCalledWith(
        mockTaptikContext,
        expect.objectContaining({
          platform: 'cursor-ide',
          dryRun: true,
          validateOnly: false,
          conflictStrategy: 'merge',
          components: ['settings', 'ai-config'],
          skipComponents: ['debug-config'],
        }),
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    });

    it('should handle import failure for Cursor platform', async () => {
      mockImportService.importFromSupabase.mockResolvedValue(null);

      await deployCommand.run([], {
        platform: 'cursor-ide',
        contextId: 'test-config',
      });

      expect(console.error).toHaveBeenCalledWith('❌ Failed to import context from Supabase');
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockDeploymentService.deployToCursor).not.toHaveBeenCalled();
    });

    it('should handle deployment failure for Cursor platform', async () => {
      mockImportService.importFromSupabase.mockResolvedValue(mockTaptikContext);
      mockDeploymentService.deployToCursor.mockResolvedValue({
        success: false,
        platform: 'cursor-ide',
        deployedComponents: [],
        conflicts: [],
        summary: {
          filesDeployed: 0,
          filesSkipped: 0,
          conflictsResolved: 0,
          backupCreated: false,
        },
        errors: [
          {
            message: 'Cursor deployment failed',
            code: 'CURSOR_DEPLOYMENT_ERROR',
            severity: 'CRITICAL',
          },
        ],
        warnings: [],
      });

      await deployCommand.run([], {
        platform: 'cursor-ide',
        contextId: 'test-config',
      });

      expect(console.error).toHaveBeenCalledWith('\n❌ Deployment failed!');
      expect(console.error).toHaveBeenCalledWith('🚨 Errors:');
      expect(console.error).toHaveBeenCalledWith('   - [CRITICAL] Cursor deployment failed');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('Success Scenarios', () => {
    beforeEach(() => {
      mockImportService.importFromSupabase.mockResolvedValue(mockTaptikContext);
      vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('should display success message for Cursor deployment', async () => {
      mockDeploymentService.deployToCursor.mockResolvedValue({
        ...mockDeploymentResult,
        platform: 'cursor-ide',
        deployedComponents: ['settings', 'ai-config'],
        summary: {
          filesDeployed: 5,
          filesSkipped: 0,
          conflictsResolved: 0,
          backupCreated: true,
        },
        warnings: [
          {
            message: 'Cursor IDE deployment is currently in development.',
            code: 'CURSOR_DEVELOPMENT_STATUS',
          },
        ],
      });

      await deployCommand.run([], {
        platform: 'cursor-ide',
        contextId: 'test-config',
      });

      expect(console.log).toHaveBeenCalledWith('\n✅ Deployment successful!');
      expect(console.log).toHaveBeenCalledWith('📦 Components deployed: settings, ai-config');
      expect(console.log).toHaveBeenCalledWith('📊 Summary:');
      expect(console.log).toHaveBeenCalledWith('   - Files deployed: 5');
      expect(console.log).toHaveBeenCalledWith('   - Backup created: ✅');
      expect(console.log).toHaveBeenCalledWith('\n⚠️  Warnings:');
      expect(console.log).toHaveBeenCalledWith('   - Cursor IDE deployment is currently in development.');
    });
  });
});
