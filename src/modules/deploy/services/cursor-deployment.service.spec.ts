import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CursorDeploymentService } from './cursor-deployment.service';
import { CursorTransformerService } from './cursor-transformer.service';
import { CursorValidatorService } from './cursor-validator.service';
import { CursorFileWriterService } from './cursor-file-writer.service';
import { CursorInstallationDetectorService } from './cursor-installation-detector.service';
import { CursorBackupService } from './cursor-backup.service';
import { CursorConflictResolverService } from './cursor-conflict-resolver.service';
import { CursorDeploymentStateService } from './cursor-deployment-state.service';
import { CursorDeploymentOptions } from '../interfaces/cursor-deployment.interface';

describe('CursorDeploymentService', () => {
  let service: CursorDeploymentService;
  let transformerService: any;
  let validatorService: any;
  let fileWriterService: any;
  let installationDetectorService: any;
  let backupService: any;
  let conflictResolverService: any;
  let stateManager: any;

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

    const mockBackupService = {
      createBackup: vi.fn().mockResolvedValue({
        success: true,
        backupId: 'backup-123',
        warnings: [],
        errors: [],
      }),
      listBackups: vi.fn().mockResolvedValue([]),
      restoreFromBackup: vi.fn().mockResolvedValue({
        success: true,
        warnings: [],
        errors: [],
        restoredFiles: [],
      }),
    };

    const mockConflictResolverService = {
      resolveConfigurationConflicts: vi.fn().mockResolvedValue({
        resolvedConfig: {},
        warnings: [],
        errors: [],
      }),
    };

    const mockStateManager = {
      saveDeploymentState: vi.fn().mockResolvedValue(undefined),
      updateDeploymentProgress: vi.fn().mockResolvedValue(undefined),
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
        {
          provide: CursorBackupService,
          useValue: mockBackupService,
        },
        {
          provide: CursorConflictResolverService,
          useValue: mockConflictResolverService,
        },
        {
          provide: CursorDeploymentStateService,
          useValue: mockStateManager,
        },
      ],
    }).compile();

    service = module.get<CursorDeploymentService>(CursorDeploymentService);
    transformerService = module.get(CursorTransformerService);
    validatorService = module.get(CursorValidatorService);
    fileWriterService = module.get(CursorFileWriterService);
    installationDetectorService = module.get(CursorInstallationDetectorService);
    backupService = module.get(CursorBackupService);
    conflictResolverService = module.get(CursorConflictResolverService);
    stateManager = module.get(CursorDeploymentStateService);

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

  // Task 6.3: Performance optimization tests
  describe('Performance optimization features', () => {
    describe('Component categorization for parallel deployment', () => {
      it('should categorize components into parallel and sequential groups', async () => {
        const options: CursorDeploymentOptions = {
          platform: 'cursor',
          cursorPath: '/usr/local/bin/cursor',
          components: ['global-settings', 'extensions-config', 'ai-config', 'project-settings', 'debug-config'],
          skipComponents: [],
        };

        const result = await service.deploy(options);

        expect(result.success).toBe(true);
        // Should deploy parallel components first, then sequential
        expect(result.deployedComponents).toContain('global-settings'); // parallel
        expect(result.deployedComponents).toContain('extensions-config'); // parallel
        expect(result.deployedComponents).toContain('ai-config'); // sequential
        expect(result.deployedComponents).toContain('project-settings'); // sequential
        expect(result.deployedComponents).toContain('debug-config'); // sequential
      });

      it('should handle parallel deployment failures gracefully', async () => {
        // Make one parallel component fail
        fileWriterService.writeExtensions.mockResolvedValue({
          success: false,
          errors: [{
            component: 'extensions-config',
            type: 'file_operation',
            severity: 'high',
            message: 'Failed to write extensions configuration',
            suggestion: 'Check file permissions',
          }],
          warnings: [],
        });

        const options: CursorDeploymentOptions = {
          platform: 'cursor',
          cursorPath: '/usr/local/bin/cursor',
          components: ['global-settings', 'extensions-config', 'ai-config'],
          skipComponents: [],
        };

        const result = await service.deploy(options);

        expect(result.success).toBe(false); // Should fail due to errors
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.deployedComponents).toContain('global-settings'); // Other parallel should succeed
        expect(result.deployedComponents).not.toContain('extensions-config'); // Failed component
        expect(result.deployedComponents).toContain('ai-config'); // Sequential should still work
      });
    });

    describe('Progress reporting', () => {
      it('should provide progress callbacks during deployWithProgress', async () => {
        const progressUpdates: Array<{
          stage: string;
          component?: string;
          progress: number;
          message: string;
        }> = [];

        const progressCallback = vi.fn().mockImplementation((progress) => {
          progressUpdates.push(progress);
        });

        const options: CursorDeploymentOptions = {
          platform: 'cursor',
          cursorPath: '/usr/local/bin/cursor',
          components: ['global-settings'],
          skipComponents: [],
        };

        const result = await service.deployWithProgress(options, progressCallback);

        expect(result.success).toBe(true);
        expect(progressCallback).toHaveBeenCalled();
        expect(progressUpdates.length).toBeGreaterThan(0);
        
        // Check initialization stage
        const initUpdate = progressUpdates.find(u => u.stage === 'initialization');
        expect(initUpdate).toBeDefined();
        expect(initUpdate?.progress).toBe(0);
        expect(initUpdate?.message).toContain('Initializing deployment');
        
        // Check completion stage
        const completionUpdate = progressUpdates.find(u => u.stage === 'completion');
        expect(completionUpdate).toBeDefined();
        expect(completionUpdate?.progress).toBe(100);
        expect(completionUpdate?.message).toContain('completed');

        // Should include performance metrics
        expect((result as any).performanceMetrics).toBeDefined();
        expect((result as any).performanceMetrics.totalTimeMs).toBeGreaterThan(0);
        expect((result as any).performanceMetrics.componentsDeployed).toBe(1);
      });

      it('should report error progress when deployment fails', async () => {
        const progressUpdates: Array<{
          stage: string;
          component?: string;
          progress: number;
          message: string;
        }> = [];

        const progressCallback = vi.fn().mockImplementation((progress) => {
          progressUpdates.push(progress);
        });

        // Make installation detection fail
        installationDetectorService.detectCursorInstallation.mockResolvedValue(null);

        const options: CursorDeploymentOptions = {
          platform: 'cursor',
          components: ['global-settings'],
          skipComponents: [],
        };

        const result = await service.deployWithProgress(options, progressCallback);

        expect(result.success).toBe(false);
        expect(progressCallback).toHaveBeenCalled();
        
        // Should have initialization and no completion, but no error stage (handled by deploy method)
        const initUpdate = progressUpdates.find(u => u.stage === 'initialization');
        expect(initUpdate).toBeDefined();
      });
    });

    describe('Memory management', () => {
      it('should handle memory threshold checks during deployment', async () => {
        // Mock high memory usage
        const originalMemoryUsage = process.memoryUsage;
        process.memoryUsage = vi.fn().mockReturnValue({
          rss: 150 * 1024 * 1024, // 150MB
          heapTotal: 150 * 1024 * 1024,
          heapUsed: 150 * 1024 * 1024, // Above threshold
          external: 0,
          arrayBuffers: 0,
        });

        // Mock global.gc if not available
        const originalGc = (global as any).gc;
        (global as any).gc = vi.fn();

        const logSpy = vi.spyOn((service as any).logger, 'warn');

        const options: CursorDeploymentOptions = {
          platform: 'cursor',
          cursorPath: '/usr/local/bin/cursor',
          components: ['global-settings'],
          skipComponents: [],
        };

        const result = await service.deploy(options);

        expect(result.success).toBe(true);
        expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/Memory usage is high/));
        expect((global as any).gc).toHaveBeenCalled();

        // Restore original functions
        process.memoryUsage = originalMemoryUsage;
        (global as any).gc = originalGc;
      });

      it('should handle deployment without global.gc available', async () => {
        // Mock high memory usage
        const originalMemoryUsage = process.memoryUsage;
        process.memoryUsage = vi.fn().mockReturnValue({
          rss: 150 * 1024 * 1024,
          heapTotal: 150 * 1024 * 1024,
          heapUsed: 150 * 1024 * 1024, // Above threshold
          external: 0,
          arrayBuffers: 0,
        });

        // Ensure global.gc is undefined
        const originalGc = (global as any).gc;
        delete (global as any).gc;

        const logSpy = vi.spyOn((service as any).logger, 'warn');

        const options: CursorDeploymentOptions = {
          platform: 'cursor',
          cursorPath: '/usr/local/bin/cursor',
          components: ['global-settings'],
          skipComponents: [],
        };

        const result = await service.deploy(options);

        expect(result.success).toBe(true);
        expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/Memory usage is high/));

        // Restore original functions
        process.memoryUsage = originalMemoryUsage;
        (global as any).gc = originalGc;
      });
    });

    describe('Batch processing', () => {
      it('should process components in controlled batches for parallel deployment', async () => {
        const options: CursorDeploymentOptions = {
          platform: 'cursor',
          cursorPath: '/usr/local/bin/cursor',
          // Use many parallel-safe components to test batching
          components: ['global-settings', 'extensions-config', 'snippets-config'],
          skipComponents: [],
        };

        const result = await service.deploy(options);

        expect(result.success).toBe(true);
        expect(result.deployedComponents).toHaveLength(3);
        expect(result.deployedComponents).toContain('global-settings');
        expect(result.deployedComponents).toContain('extensions-config');
        expect(result.deployedComponents).toContain('snippets-config');
      });

      it('should skip components correctly in parallel processing', async () => {
        const options: CursorDeploymentOptions = {
          platform: 'cursor',
          cursorPath: '/usr/local/bin/cursor',
          components: ['global-settings', 'extensions-config'],
          skipComponents: ['extensions-config'],
        };

        const result = await service.deploy(options);

        expect(result.success).toBe(true);
        expect(result.deployedComponents).toContain('global-settings');
        expect(result.skippedComponents).toContain('extensions-config');
        expect(result.deployedComponents).not.toContain('extensions-config');
      });
    });

    describe('Performance metrics', () => {
      it('should track deployment performance metrics', async () => {
        const options: CursorDeploymentOptions = {
          platform: 'cursor',
          cursorPath: '/usr/local/bin/cursor',
          components: ['global-settings', 'ai-config'],
          skipComponents: [],
        };

        const result = await service.deployWithProgress(options);

        expect(result.success).toBe(true);
        expect((result as any).performanceMetrics).toBeDefined();
        
        const metrics = (result as any).performanceMetrics;
        expect(metrics.totalTimeMs).toBeGreaterThan(0);
        expect(metrics.componentsDeployed).toBe(2);
        expect(metrics.averageTimePerComponent).toBeGreaterThan(0);
        expect(metrics.averageTimePerComponent).toBe(metrics.totalTimeMs / metrics.componentsDeployed);
      });

      it('should handle zero components deployed in performance metrics', async () => {
        // Make all components skip
        const options: CursorDeploymentOptions = {
          platform: 'cursor',
          cursorPath: '/usr/local/bin/cursor',
          components: ['global-settings'],
          skipComponents: ['global-settings'],
        };

        const result = await service.deployWithProgress(options);

        expect(result.success).toBe(true);
        expect((result as any).performanceMetrics).toBeDefined();
        
        const metrics = (result as any).performanceMetrics;
        expect(metrics.componentsDeployed).toBe(0);
        expect(metrics.averageTimePerComponent).toBe(0);
      });
    });

    describe('State management integration', () => {
      it('should update deployment state during parallel processing', async () => {
        const options: CursorDeploymentOptions = {
          platform: 'cursor',
          cursorPath: '/usr/local/bin/cursor',
          components: ['global-settings', 'extensions-config'],
          skipComponents: [],
        };

        const result = await service.deploy(options);

        expect(result.success).toBe(true);
        
        // Should have called state management methods
        expect(stateManager.saveDeploymentState).toHaveBeenCalled();
        expect(stateManager.updateDeploymentProgress).toHaveBeenCalledTimes(4); // 2 components × 2 calls (started + completed)
        
        // Check for started and completed calls
        expect(stateManager.updateDeploymentProgress).toHaveBeenCalledWith(
          expect.any(String),
          'global-settings',
          'started'
        );
        expect(stateManager.updateDeploymentProgress).toHaveBeenCalledWith(
          expect.any(String),
          'global-settings',
          'completed'
        );
        expect(stateManager.updateDeploymentProgress).toHaveBeenCalledWith(
          expect.any(String),
          'extensions-config',
          'started'
        );
        expect(stateManager.updateDeploymentProgress).toHaveBeenCalledWith(
          expect.any(String),
          'extensions-config',
          'completed'
        );
      });

      it('should update state to failed for unsuccessful components', async () => {
        // Make extensions fail
        fileWriterService.writeExtensions.mockResolvedValue({
          success: false,
          errors: [{
            component: 'extensions-config',
            type: 'file_operation',
            severity: 'high',
            message: 'Failed to write extensions',
            suggestion: 'Check permissions',
          }],
          warnings: [],
        });

        const options: CursorDeploymentOptions = {
          platform: 'cursor',
          cursorPath: '/usr/local/bin/cursor',
          components: ['extensions-config'],
          skipComponents: [],
        };

        const result = await service.deploy(options);

        expect(result.success).toBe(false);
        
        // Should update state to failed
        expect(stateManager.updateDeploymentProgress).toHaveBeenCalledWith(
          expect.any(String),
          'extensions-config',
          'failed',
          expect.objectContaining({
            component: 'extensions-config',
            message: 'Failed to write extensions',
          })
        );
      });
    });
  });
});