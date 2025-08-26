import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CursorDeploymentService } from './cursor-deployment.service';
import { CursorTransformerService } from './cursor-transformer.service';
import { CursorValidatorService } from './cursor-validator.service';
import { CursorFileWriterService } from './cursor-file-writer.service';
import { CursorInstallationDetectorService } from './cursor-installation-detector.service';
import { CursorDeploymentOptions } from '../interfaces/cursor-deployment.interface';

describe('CursorDeploymentService', () => {
  let service: CursorDeploymentService;
  let transformerService: any;
  let validatorService: any;
  let fileWriterService: any;
  let installationDetectorService: any;

  beforeEach(async () => {
    const mockTransformerService = {
      transformPersonalContext: vi.fn().mockReturnValue({ 'editor.fontSize': 14 }),
      transformProjectContext: vi.fn().mockReturnValue({ 'files.exclude': { '**/.git': true } }),
      transformAIRules: vi.fn().mockReturnValue({ rules: ['Use TypeScript best practices'] }),
      transformWorkspaceSettings: vi.fn().mockReturnValue({ folders: [{ path: '.', name: 'Root' }] }),
      transformDebugConfigurations: vi.fn().mockReturnValue({ version: '0.2.0', configurations: [] }),
      transformBuildTasks: vi.fn().mockReturnValue({ version: '2.0.0', tasks: [] }),
      transformCodeSnippets: vi.fn().mockReturnValue({ typescript: {} }),
    };

    const mockValidatorService = {
      validateConfiguration: vi.fn().mockResolvedValue(true),
      validateComponent: vi.fn().mockResolvedValue(true),
    };

    const mockFileWriterService = {
      writeSettings: vi.fn().mockResolvedValue({
        success: true,
        filePath: '/cursor/User/settings.json',
        errors: [],
        warnings: [],
        bytesWritten: 1024,
      }),
      writeExtensions: vi.fn().mockResolvedValue({
        success: true,
        filePath: '/cursor/User/extensions.json',
        errors: [],
        warnings: [],
        bytesWritten: 512,
      }),
      writeAIConfig: vi.fn().mockResolvedValue({
        success: true,
        filePath: '/cursor/.cursorrules',
        errors: [],
        warnings: [],
        bytesWritten: 2048,
      }),
      writeDebugConfig: vi.fn().mockResolvedValue({
        success: true,
        filePath: '/cursor/.vscode/launch.json',
        errors: [],
        warnings: [],
        bytesWritten: 800,
      }),
      writeTasks: vi.fn().mockResolvedValue({
        success: true,
        filePath: '/cursor/.vscode/tasks.json',
        errors: [],
        warnings: [],
        bytesWritten: 600,
      }),
      writeSnippets: vi.fn().mockResolvedValue({
        success: true,
        filePath: '/cursor/User/snippets/typescript.json',
        errors: [],
        warnings: [],
        bytesWritten: 1200,
      }),
      writeWorkspace: vi.fn().mockResolvedValue({
        success: true,
        filePath: '/cursor/project.code-workspace',
        errors: [],
        warnings: [],
        bytesWritten: 400,
      }),
    };

    const mockInstallationDetectorService = {
      detectCursorInstallation: vi.fn().mockResolvedValue('/usr/local/bin/cursor'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CursorDeploymentService,
        {
          provide: CursorTransformerService,
          useValue: mockTransformerService,
        },
        {
          provide: CursorValidatorService,
          useValue: mockValidatorService,
        },
        {
          provide: CursorFileWriterService,
          useValue: mockFileWriterService,
        },
        {
          provide: CursorInstallationDetectorService,
          useValue: mockInstallationDetectorService,
        },
      ],
    }).compile();

    service = module.get<CursorDeploymentService>(CursorDeploymentService);
    transformerService = module.get(CursorTransformerService);
    validatorService = module.get(CursorValidatorService);
    fileWriterService = module.get(CursorFileWriterService);
    installationDetectorService = module.get(CursorInstallationDetectorService);

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have all required dependencies injected', () => {
      expect(service).toBeDefined();
      expect(transformerService).toBeDefined();
      expect(validatorService).toBeDefined();
      expect(fileWriterService).toBeDefined();
      expect(installationDetectorService).toBeDefined();
    });
  });

  describe('deploy', () => {
    const mockOptions: CursorDeploymentOptions = {
      platform: 'cursor',
      cursorPath: '/usr/local/bin/cursor',
      workspacePath: '/test/workspace',
      components: ['global-settings', 'ai-config'],
      skipComponents: [],
      globalSettings: true,
      aiConfig: true,
    };

    it('should deploy successfully with valid options', async () => {
      const result = await service.deploy(mockOptions);

      expect(result.success).toBe(true);
      expect(result.platform).toBe('cursor');
      expect(result.cursorPath).toBe(mockOptions.cursorPath);
      expect(result.deployedComponents).toContain('global-settings');
      expect(result.deployedComponents).toContain('ai-config');
      expect(result.errors).toHaveLength(0);
      expect(result.deploymentId).toMatch(/^cursor-/);
      expect(result.timestamp).toBeDefined();
    });

    it('should fail when Cursor installation is not found', async () => {
      const optionsWithoutCursorPath = { ...mockOptions };
      delete optionsWithoutCursorPath.cursorPath;
      
      installationDetectorService.detectCursorInstallation.mockResolvedValue(null);

      const result = await service.deploy(optionsWithoutCursorPath);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].component).toBe('cursor-installation');
      expect(result.errors[0].message).toContain('Cursor IDE installation not found');
    });

    it('should deploy only specified components', async () => {
      const specificComponentOptions = {
        ...mockOptions,
        components: ['ai-config'] as const,
      };

      const result = await service.deploy(specificComponentOptions);

      expect(result.success).toBe(true);
      expect(result.deployedComponents).toHaveLength(1);
      expect(result.deployedComponents).toContain('ai-config');
      expect(fileWriterService.writeAIConfig).toHaveBeenCalled();
      expect(fileWriterService.writeSettings).not.toHaveBeenCalled();
    });

    it('should handle component deployment failures gracefully', async () => {
      fileWriterService.writeAIConfig.mockResolvedValue({
        success: false,
        errors: [{
          component: 'ai-config',
          type: 'file_operation',
          severity: 'high',
          message: 'Failed to write AI configuration',
          suggestion: 'Check file permissions',
        }],
        warnings: [],
      });

      const result = await service.deploy(mockOptions);

      expect(result.success).toBe(false); // Should fail due to errors
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].component).toBe('ai-config');
      expect(result.deployedComponents).toContain('global-settings'); // Other components should still succeed
      expect(result.deployedComponents).not.toContain('ai-config');
    });

    it('should collect warnings from component deployments', async () => {
      fileWriterService.writeAIConfig.mockResolvedValue({
        success: true,
        filePath: '/cursor/.cursorrules',
        errors: [],
        warnings: [{
          component: 'ai-config',
          type: 'security',
          message: 'Large AI configuration detected',
          suggestion: 'Consider reducing content size',
        }],
        bytesWritten: 5000,
      });

      const result = await service.deploy(mockOptions);

      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].component).toBe('ai-config');
    });
  });

  describe('validateDeployment', () => {
    const validOptions: CursorDeploymentOptions = {
      platform: 'cursor',
      cursorPath: '/usr/local/bin/cursor',
      components: ['global-settings'],
      skipComponents: [],
    };

    it('should validate valid deployment options', async () => {
      const result = await service.validateDeployment(validOptions);

      expect(result).toBe(true);
    });

    it('should reject invalid platform', async () => {
      const invalidOptions = {
        ...validOptions,
        platform: 'invalid' as any,
      };

      const result = await service.validateDeployment(invalidOptions);

      expect(result).toBe(false);
    });

    it('should require workspace path for workspace components', async () => {
      const workspaceComponentOptions = {
        ...validOptions,
        components: ['debug-config'] as const,
      };

      const result = await service.validateDeployment(workspaceComponentOptions);

      expect(result).toBe(false); // Should fail because workspacePath is missing
    });

    it('should pass validation when workspace path provided for workspace components', async () => {
      const workspaceComponentOptions = {
        ...validOptions,
        components: ['debug-config'] as const,
        workspacePath: '/test/workspace',
      };

      const result = await service.validateDeployment(workspaceComponentOptions);

      expect(result).toBe(true);
    });
  });

  describe('previewDeployment', () => {
    const previewOptions: CursorDeploymentOptions = {
      platform: 'cursor',
      components: ['global-settings', 'ai-config'],
      skipComponents: [],
    };

    it('should return preview result without actual deployment', async () => {
      const result = await service.previewDeployment(previewOptions);

      expect(result.preview).toBe(true);
      expect(result.deploymentId).toMatch(/^preview-cursor-/);
      expect(result.deployedComponents).toContain('global-settings');
      expect(result.deployedComponents).toContain('ai-config');
      expect(result.configurationFiles.globalSettings).toContain('/simulated/cursor/config');
      
      // Should not have called actual file writers
      expect(fileWriterService.writeSettings).not.toHaveBeenCalled();
      expect(fileWriterService.writeAIConfig).not.toHaveBeenCalled();
    });

    it('should identify components that would be skipped', async () => {
      const previewWithSkips = {
        ...previewOptions,
        skipComponents: ['ai-config'] as const,
      };

      const result = await service.previewDeployment(previewWithSkips);

      expect(result.preview).toBe(true);
      expect(result.skippedComponents).toContain('ai-config');
      expect(result.deployedComponents).not.toContain('ai-config');
    });

    it('should detect workspace path requirements in preview', async () => {
      const workspacePreviewOptions = {
        ...previewOptions,
        components: ['debug-config'] as const,
      };

      const result = await service.previewDeployment(workspacePreviewOptions);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.includes('workspace path'))).toBe(true);
    });
  });

  describe('rollback', () => {
    it('should throw error indicating rollback is not yet implemented', async () => {
      await expect(service.rollback('test-deployment-id')).rejects.toThrow(
        'Rollback functionality will be implemented in Task 6.2'
      );
    });
  });

  describe('Component-specific deployment', () => {
    const componentOptions: CursorDeploymentOptions = {
      platform: 'cursor',
      cursorPath: '/usr/local/bin/cursor',
      workspacePath: '/test/workspace',
      components: [],
      skipComponents: [],
    };

    it('should deploy global-settings component', async () => {
      const result = await service.deploy({
        ...componentOptions,
        components: ['global-settings'],
      });

      expect(result.success).toBe(true);
      expect(result.deployedComponents).toContain('global-settings');
      expect(transformerService.transformPersonalContext).toHaveBeenCalled();
      expect(fileWriterService.writeSettings).toHaveBeenCalled();
    });

    it('should deploy ai-config component', async () => {
      const result = await service.deploy({
        ...componentOptions,
        components: ['ai-config'],
      });

      expect(result.success).toBe(true);
      expect(result.deployedComponents).toContain('ai-config');
      expect(transformerService.transformAIRules).toHaveBeenCalled();
      expect(fileWriterService.writeAIConfig).toHaveBeenCalled();
    });

    it('should deploy workspace-config component', async () => {
      const result = await service.deploy({
        ...componentOptions,
        components: ['workspace-config'],
      });

      expect(result.success).toBe(true);
      expect(result.deployedComponents).toContain('workspace-config');
      expect(transformerService.transformWorkspaceSettings).toHaveBeenCalled();
      expect(fileWriterService.writeWorkspace).toHaveBeenCalled();
    });
  });

  describe('Deployment ID generation', () => {
    it('should generate unique deployment IDs', async () => {
      const options: CursorDeploymentOptions = {
        platform: 'cursor',
        cursorPath: '/usr/local/bin/cursor',
        components: ['global-settings'],
        skipComponents: [],
      };

      const result1 = await service.deploy(options);
      const result2 = await service.deploy(options);

      expect(result1.deploymentId).not.toBe(result2.deploymentId);
      expect(result1.deploymentId).toMatch(/^cursor-/);
      expect(result2.deploymentId).toMatch(/^cursor-/);
    });

    it('should generate preview deployment IDs with prefix', async () => {
      const options: CursorDeploymentOptions = {
        platform: 'cursor',
        components: ['global-settings'],
        skipComponents: [],
      };

      const result = await service.previewDeployment(options);

      expect(result.deploymentId).toMatch(/^preview-cursor-/);
    });
  });
});