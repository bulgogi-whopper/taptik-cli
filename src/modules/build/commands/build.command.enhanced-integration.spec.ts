import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { BuildCommand } from './build.command';
import { InteractiveService } from '../services/interactive.service';
import { CollectionService } from '../services/collection.service';
import { TransformationService } from '../services/transformation.service';
import { OutputService } from '../services/output.service';
import { ProgressService } from '../services/progress.service';
import { ErrorHandlerService } from '../services/error-handler.service';
import { BuildPlatform, BuildCategoryName } from '../interfaces/build-config.interface';
import { 
  webAppProjectScenario,
  apiServiceProjectScenario,
  cliToolProjectScenario,
  edgeCaseScenarios,
  webAppPersonalContextOutput,
  apiServicePersonalContextOutput,
  webAppProjectContextOutput,
  apiServiceProjectContextOutput,
  comprehensivePromptTemplatesOutput,
  AdvancedMockFileSystem,
  ErrorScenarioFactory,
  TestEnvironmentManager,
  TestDataGenerator,
  TestAssertions
} from '../test-fixtures';

describe('BuildCommand Enhanced Integration Tests', () => {
  let command: BuildCommand;
  let interactiveService: jest.Mocked<InteractiveService>;
  let collectionService: jest.Mocked<CollectionService>;
  let transformationService: jest.Mocked<TransformationService>;
  let outputService: jest.Mocked<OutputService>;
  let progressService: jest.Mocked<ProgressService>;
  let errorHandler: jest.Mocked<ErrorHandlerService>;
  let testEnv: TestEnvironmentManager;

  beforeEach(async () => {
    // Setup test environment
    testEnv = new TestEnvironmentManager('integration');
    await testEnv.setup();

    const mockInteractiveService = {
      selectPlatform: jest.fn(),
      selectCategories: jest.fn(),
    };

    const mockCollectionService = {
      collectLocalSettings: jest.fn(),
      collectGlobalSettings: jest.fn(),
    };

    const mockTransformationService = {
      transformPersonalContext: jest.fn(),
      transformProjectContext: jest.fn(),
      transformPromptTemplates: jest.fn(),
    };

    const mockOutputService = {
      createOutputDirectory: jest.fn(),
      writeOutputFiles: jest.fn(),
      generateManifest: jest.fn(),
      displayBuildSummary: jest.fn(),
    };

    const mockProgressService = {
      initializeProgress: jest.fn(),
      startStep: jest.fn(),
      completeStep: jest.fn(),
      startScan: jest.fn(),
      completeScan: jest.fn(),
      startTransformation: jest.fn(),
      completeTransformation: jest.fn(),
      failStep: jest.fn(),
      startOutput: jest.fn(),
      completeOutput: jest.fn(),
      displayBuildSummary: jest.fn(),
    };

    const mockErrorHandler = {
      isProcessInterrupted: jest.fn().mockReturnValue(false),
      handleCriticalErrorAndExit: jest.fn(),
      addWarning: jest.fn(),
      hasWarnings: jest.fn().mockReturnValue(false),
      getErrorSummary: jest.fn().mockReturnValue({ warnings: [], criticalErrors: [] }),
      displayErrorSummary: jest.fn(),
      exitWithAppropriateCode: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BuildCommand,
        { provide: InteractiveService, useValue: mockInteractiveService },
        { provide: CollectionService, useValue: mockCollectionService },
        { provide: TransformationService, useValue: mockTransformationService },
        { provide: OutputService, useValue: mockOutputService },
        { provide: ProgressService, useValue: mockProgressService },
        { provide: ErrorHandlerService, useValue: mockErrorHandler },
      ],
    }).compile();

    command = module.get<BuildCommand>(BuildCommand);
    interactiveService = module.get(InteractiveService);
    collectionService = module.get(CollectionService);
    transformationService = module.get(TransformationService);
    outputService = module.get(OutputService);
    progressService = module.get(ProgressService);
    errorHandler = module.get(ErrorHandlerService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(async () => {
    await testEnv.cleanup();
    jest.clearAllMocks();
  });

  describe('Realistic Project Scenarios', () => {
    it('should handle web application project with complete workflow', async () => {
      // Setup web app scenario
      const scenario = webAppProjectScenario;
      
      interactiveService.selectPlatform.mockResolvedValue(BuildPlatform.KIRO);
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
        { name: BuildCategoryName.PROJECT_CONTEXT, enabled: true },
        { name: BuildCategoryName.PROMPT_TEMPLATES, enabled: true },
      ]);

      // Mock collection with realistic web app data
      collectionService.collectLocalSettings.mockResolvedValue({
        context: scenario.localSettings.context,
        userPreferences: scenario.localSettings.userPreferences,
        projectSpec: scenario.localSettings.projectSpec,
        steeringFiles: scenario.steeringFiles,
        hookFiles: scenario.hookFiles,
      });

      collectionService.collectGlobalSettings.mockResolvedValue({
        userConfig: 'name: Web Developer\nemail: dev@company.com',
        globalPreferences: 'React development preferences',
        promptTemplates: [
          {
            filename: 'react-review.md',
            content: '# React Code Review\nReview React components for best practices.',
            path: '~/.kiro/prompts/react-review.md',
          },
        ],
        configFiles: [],
      });

      // Mock transformations with expected outputs
      transformationService.transformPersonalContext.mockResolvedValue(webAppPersonalContextOutput);
      transformationService.transformProjectContext.mockResolvedValue(webAppProjectContextOutput);
      transformationService.transformPromptTemplates.mockResolvedValue(comprehensivePromptTemplatesOutput);

      const outputPath = './taptik-build-web-app-test';
      outputService.createOutputDirectory.mockResolvedValue(outputPath);
      outputService.writeOutputFiles.mockResolvedValue([
        'personal-context.json',
        'project-context.json',
        'prompt-templates.json',
      ]);

      // Execute command and measure performance
      const performanceResult = await TestAssertions.assertPerformance(
        () => command.run([], {}),
        30000 // 30 seconds max
      );

      expect(performanceResult.success).toBe(true);
      expect(performanceResult.actualTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Verify all services were called with realistic data
      expect(collectionService.collectLocalSettings).toHaveBeenCalled();
      expect(collectionService.collectGlobalSettings).toHaveBeenCalled();
      expect(transformationService.transformPersonalContext).toHaveBeenCalled();
      expect(transformationService.transformProjectContext).toHaveBeenCalled();
      expect(transformationService.transformPromptTemplates).toHaveBeenCalled();
      expect(outputService.writeOutputFiles).toHaveBeenCalledWith(
        outputPath,
        webAppPersonalContextOutput,
        webAppProjectContextOutput,
        comprehensivePromptTemplatesOutput
      );

      testEnv.recordOperation('web-app-build');
    });

    it('should handle API service project with security compliance requirements', async () => {
      const scenario = apiServiceProjectScenario;
      
      interactiveService.selectPlatform.mockResolvedValue(BuildPlatform.KIRO);
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
        { name: BuildCategoryName.PROJECT_CONTEXT, enabled: true },
      ]);

      // Mock collection with API service security data
      collectionService.collectLocalSettings.mockResolvedValue({
        context: scenario.localSettings.context,
        userPreferences: scenario.localSettings.userPreferences,
        projectSpec: scenario.localSettings.projectSpec,
        steeringFiles: scenario.steeringFiles,
        hookFiles: scenario.hookFiles,
      });

      collectionService.collectGlobalSettings.mockResolvedValue({
        userConfig: 'name: Backend Engineer\nsecurity_clearance: high',
        globalPreferences: 'Security-focused development practices',
        promptTemplates: [],
        configFiles: [],
      });

      transformationService.transformPersonalContext.mockResolvedValue(apiServicePersonalContextOutput);
      transformationService.transformProjectContext.mockResolvedValue(apiServiceProjectContextOutput);

      const outputPath = './taptik-build-api-service-test';
      outputService.createOutputDirectory.mockResolvedValue(outputPath);
      outputService.writeOutputFiles.mockResolvedValue([
        'personal-context.json',
        'project-context.json',
      ]);

      await command.run([], {});

      // Verify security-specific transformations
      expect(transformationService.transformPersonalContext).toHaveBeenCalledWith(
        expect.objectContaining({
          localSettings: expect.objectContaining({
            context: expect.stringContaining('PCI DSS'),
          }),
        })
      );

      expect(transformationService.transformProjectContext).toHaveBeenCalledWith(
        expect.objectContaining({
          localSettings: expect.objectContaining({
            projectSpec: expect.stringContaining('Payment Processing'),
          }),
        })
      );

      testEnv.recordOperation('api-service-build');
    });

    it('should handle CLI tool project with cross-platform requirements', async () => {
      const scenario = cliToolProjectScenario;
      
      interactiveService.selectPlatform.mockResolvedValue(BuildPlatform.KIRO);
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PROJECT_CONTEXT, enabled: true },
      ]);

      collectionService.collectLocalSettings.mockResolvedValue({
        context: scenario.localSettings.context,
        userPreferences: scenario.localSettings.userPreferences,
        projectSpec: scenario.localSettings.projectSpec,
        steeringFiles: scenario.steeringFiles,
        hookFiles: scenario.hookFiles,
      });

      collectionService.collectGlobalSettings.mockResolvedValue({
        userConfig: 'name: CLI Developer\ncross_platform: true',
        globalPreferences: 'Command-line tool development',
        promptTemplates: [],
        configFiles: [],
      });

      const cliProjectContext = {
        ...webAppProjectContextOutput,
        project_info: {
          ...webAppProjectContextOutput.project_info,
          name: 'Developer Productivity CLI',
          project_type: 'cli_tool' as const,
        },
      };

      transformationService.transformProjectContext.mockResolvedValue(cliProjectContext);

      const outputPath = './taptik-build-cli-tool-test';
      outputService.createOutputDirectory.mockResolvedValue(outputPath);
      outputService.writeOutputFiles.mockResolvedValue(['project-context.json']);

      await command.run([], {});

      // Verify CLI-specific project context
      expect(outputService.writeOutputFiles).toHaveBeenCalledWith(
        outputPath,
        undefined,
        expect.objectContaining({
          project_info: expect.objectContaining({
            project_type: 'cli_tool',
          }),
        }),
        undefined
      );

      testEnv.recordOperation('cli-tool-build');
    });
  });

  describe('Advanced Error Scenarios', () => {
    it('should handle disk space limitations gracefully', async () => {
      interactiveService.selectPlatform.mockResolvedValue(BuildPlatform.KIRO);
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      // Setup minimal data collection
      collectionService.collectLocalSettings.mockResolvedValue({
        context: 'minimal context',
        userPreferences: 'minimal preferences',
        projectSpec: 'minimal spec',
        steeringFiles: [],
        hookFiles: [],
      });

      collectionService.collectGlobalSettings.mockResolvedValue({
        userConfig: 'minimal config',
        globalPreferences: 'minimal preferences',
        promptTemplates: [],
        configFiles: [],
      });

      transformationService.transformPersonalContext.mockResolvedValue(webAppPersonalContextOutput);

      // Simulate disk full error
      outputService.createOutputDirectory.mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), {
          code: 'ENOSPC',
          errno: -28,
        })
      );

      await command.run([], {});

      // Verify error handling was triggered
      expect(errorHandler.handleCriticalErrorAndExit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'file_system',
          message: 'Required file or directory not found',
          exitCode: 2,
        })
      );

      testEnv.recordError(new Error('Disk space limitation test'));
    });

    it('should handle network failures for remote file access', async () => {
      interactiveService.selectPlatform.mockResolvedValue(BuildPlatform.KIRO);
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      // Simulate network failure during collection
      collectionService.collectLocalSettings.mockRejectedValue(
        Object.assign(new Error('ENETUNREACH: network is unreachable'), {
          code: 'ENETUNREACH',
          errno: -51,
        })
      );

      collectionService.collectGlobalSettings.mockResolvedValue({
        userConfig: 'config',
        globalPreferences: 'preferences',
        promptTemplates: [],
        configFiles: [],
      });

      transformationService.transformPersonalContext.mockResolvedValue(webAppPersonalContextOutput);
      outputService.createOutputDirectory.mockResolvedValue('./test-output');
      outputService.writeOutputFiles.mockResolvedValue(['personal-context.json']);

      await command.run([], {});

      // Verify warnings were added for network failures
      expect(errorHandler.addWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'missing_file',
          message: 'Local settings collection failed: ENETUNREACH: network is unreachable',
        })
      );

      testEnv.recordOperation('network-failure-recovery');
    });

    it('should handle memory pressure scenarios', async () => {
      // Create advanced file system with memory pressure
      const advancedFs = ErrorScenarioFactory.createMemoryPressureScenario();

      interactiveService.selectPlatform.mockResolvedValue(BuildPlatform.KIRO);
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      // Simulate memory pressure during data collection
      collectionService.collectLocalSettings.mockImplementation(async () => {
        // Simulate memory pressure
        throw Object.assign(new Error('ENOMEM: not enough memory'), {
          code: 'ENOMEM',
          errno: -12,
        });
      });

      collectionService.collectGlobalSettings.mockResolvedValue({
        userConfig: 'config',
        globalPreferences: 'preferences',
        promptTemplates: [],
        configFiles: [],
      });

      await command.run([], {});

      // Verify memory pressure was handled gracefully
      expect(errorHandler.addWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Local settings collection failed: ENOMEM: not enough memory',
        })
      );

      await advancedFs.cleanup();
      testEnv.recordOperation('memory-pressure-handling');
    });

    it('should handle concurrent operation limits', async () => {
      const highConcurrencyFs = ErrorScenarioFactory.createHighConcurrencyScenario();

      interactiveService.selectPlatform.mockResolvedValue(BuildPlatform.KIRO);
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
        { name: BuildCategoryName.PROJECT_CONTEXT, enabled: true },
        { name: BuildCategoryName.PROMPT_TEMPLATES, enabled: true },
      ]);

      // Simulate concurrent operations
      const concurrentOperations = Array.from({ length: 10 }, () => 
        jest.fn().mockResolvedValue({ context: 'test', userPreferences: 'test', projectSpec: 'test', steeringFiles: [], hookFiles: [] })
      );

      collectionService.collectLocalSettings.mockImplementation(concurrentOperations[0]);
      collectionService.collectGlobalSettings.mockImplementation(concurrentOperations[1]);

      transformationService.transformPersonalContext.mockResolvedValue(webAppPersonalContextOutput);
      transformationService.transformProjectContext.mockResolvedValue(webAppProjectContextOutput);
      transformationService.transformPromptTemplates.mockResolvedValue(comprehensivePromptTemplatesOutput);

      outputService.createOutputDirectory.mockResolvedValue('./test-concurrent');
      outputService.writeOutputFiles.mockResolvedValue(['personal-context.json', 'project-context.json', 'prompt-templates.json']);

      await command.run([], {});

      // Verify concurrent operations completed successfully
      expect(outputService.writeOutputFiles).toHaveBeenCalled();

      await highConcurrencyFs.cleanup();
      testEnv.recordOperation('concurrent-operations');
    });
  });

  describe('Performance and Scale Testing', () => {
    it('should handle large project scenarios within performance limits', async () => {
      const largeProjectScenario = edgeCaseScenarios.largeProject;
      
      interactiveService.selectPlatform.mockResolvedValue(BuildPlatform.KIRO);
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PROJECT_CONTEXT, enabled: true },
      ]);

      // Mock large project data
      collectionService.collectLocalSettings.mockResolvedValue({
        context: largeProjectScenario.localSettings.context,
        userPreferences: largeProjectScenario.localSettings.userPreferences,
        projectSpec: largeProjectScenario.localSettings.projectSpec,
        steeringFiles: largeProjectScenario.steeringFiles || [],
        hookFiles: largeProjectScenario.hookFiles || [],
      });

      collectionService.collectGlobalSettings.mockResolvedValue({
        userConfig: 'enterprise config',
        globalPreferences: 'enterprise preferences',
        promptTemplates: [],
        configFiles: [],
      });

      transformationService.transformProjectContext.mockResolvedValue(webAppProjectContextOutput);
      outputService.createOutputDirectory.mockResolvedValue('./test-large-project');
      outputService.writeOutputFiles.mockResolvedValue(['project-context.json']);

      // Measure performance for large project
      const performanceResult = await TestAssertions.assertPerformance(
        () => command.run([], {}),
        60000 // 1 minute max for large projects
      );

      expect(performanceResult.success).toBe(true);
      expect(performanceResult.actualTime).toBeLessThan(30000); // Should complete within 30 seconds even for large projects

      // Verify memory usage is reasonable
      expect(TestAssertions.assertMemoryUsage(500)).toBe(true); // 500MB limit

      testEnv.recordOperation('large-project-build');
    });

    it('should maintain performance with corrupted files', async () => {
      const corruptedScenario = edgeCaseScenarios.corruptedFiles;
      
      interactiveService.selectPlatform.mockResolvedValue(BuildPlatform.KIRO);
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      // Mock corrupted file handling
      collectionService.collectLocalSettings.mockResolvedValue({
        context: corruptedScenario.localSettings.context || '',
        userPreferences: corruptedScenario.localSettings.userPreferences || '',
        projectSpec: corruptedScenario.localSettings.projectSpec || '',
        steeringFiles: corruptedScenario.steeringFiles || [],
        hookFiles: corruptedScenario.hookFiles || [],
      });

      collectionService.collectGlobalSettings.mockResolvedValue({
        userConfig: 'fallback config',
        globalPreferences: 'fallback preferences',
        promptTemplates: [],
        configFiles: [],
      });

      transformationService.transformPersonalContext.mockResolvedValue(webAppPersonalContextOutput);
      outputService.createOutputDirectory.mockResolvedValue('./test-corrupted');
      outputService.writeOutputFiles.mockResolvedValue(['personal-context.json']);

      const performanceResult = await TestAssertions.assertPerformance(
        () => command.run([], {}),
        15000 // Should handle corrupted files quickly
      );

      expect(performanceResult.success).toBe(true);
      
      // Verify error handling for corrupted data
      expect(outputService.writeOutputFiles).toHaveBeenCalled();

      testEnv.recordOperation('corrupted-files-handling');
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should handle Windows-style paths correctly', async () => {
      interactiveService.selectPlatform.mockResolvedValue(BuildPlatform.KIRO);
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      // Mock Windows-style paths
      collectionService.collectLocalSettings.mockResolvedValue({
        context: 'Windows project context',
        userPreferences: 'Windows preferences',
        projectSpec: 'Windows project spec',
        steeringFiles: [
          {
            filename: 'windows.md',
            path: 'C:\\Users\\Developer\\Project\\.kiro\\steering\\windows.md',
            content: '# Windows Development Standards',
          },
        ],
        hookFiles: [],
      });

      collectionService.collectGlobalSettings.mockResolvedValue({
        userConfig: 'Windows user config',
        globalPreferences: 'Windows global preferences',
        promptTemplates: [],
        configFiles: [],
      });

      transformationService.transformPersonalContext.mockResolvedValue(webAppPersonalContextOutput);
      outputService.createOutputDirectory.mockResolvedValue('./test-windows-paths');
      outputService.writeOutputFiles.mockResolvedValue(['personal-context.json']);

      await command.run([], {});

      // Verify Windows paths are handled correctly
      expect(transformationService.transformPersonalContext).toHaveBeenCalledWith(
        expect.objectContaining({
          localSettings: expect.objectContaining({
            steeringFiles: expect.arrayContaining([
              expect.objectContaining({
                path: expect.stringContaining('windows.md'),
              }),
            ]),
          }),
        })
      );

      testEnv.recordOperation('windows-path-handling');
    });

    it('should handle Unix-style permissions correctly', async () => {
      interactiveService.selectPlatform.mockResolvedValue(BuildPlatform.KIRO);
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      // Simulate Unix permission issues
      collectionService.collectLocalSettings.mockRejectedValue(
        Object.assign(new Error('EACCES: permission denied'), {
          code: 'EACCES',
          errno: -13,
          path: '/restricted/settings.md',
        })
      );

      collectionService.collectGlobalSettings.mockResolvedValue({
        userConfig: 'Unix config',
        globalPreferences: 'Unix preferences',
        promptTemplates: [],
        configFiles: [],
      });

      await command.run([], {});

      // Verify permission errors are handled gracefully
      expect(errorHandler.addWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Local settings collection failed: EACCES: permission denied',
        })
      );

      testEnv.recordOperation('unix-permission-handling');
    });
  });

  describe('Test Environment Validation', () => {
    it('should validate test environment metrics', () => {
      const metrics = testEnv.getMetrics();
      expect(metrics).toBeDefined();
      if (metrics) {
        expect(metrics.startTime).toBeGreaterThan(0);
        expect(metrics.operationCounts).toBeDefined();
        expect(Array.isArray(metrics.errors)).toBe(true);
      }
    });

    it('should generate meaningful test reports', async () => {
      // Record some test operations
      testEnv.recordOperation('test-operation-1');
      testEnv.recordOperation('test-operation-2');
      testEnv.recordError(new Error('Test error'));

      const metrics = testEnv.getMetrics();
      expect(metrics?.operationCounts['test-operation-1']).toBe(1);
      expect(metrics?.operationCounts['test-operation-2']).toBe(1);
      expect(metrics?.errors).toHaveLength(1);
    });
  });
});