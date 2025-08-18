import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  afterEach,
  Mocked,
} from 'vitest';

import {
  BuildPlatform,
  BuildCategoryName,
} from '../interfaces/build-config.interface';
import { TaptikPersonalContext, TaptikPromptTemplates, TaptikProjectContext } from '../interfaces/taptik-format.interface';
import { CollectionService } from '../services/collection/collection.service';
import { ErrorHandlerService } from '../services/error-handler/error-handler.service';
import { InteractiveService } from '../services/interactive/interactive.service';
import { OutputService } from '../services/output/output.service';
import { ProgressService } from '../services/progress/progress.service';
import { TransformationService } from '../services/transformation/transformation.service';
import { mockSettingsData, mockExpectedOutputs } from '../test-fixtures';

import { BuildCommand } from './build.command';

describe('BuildCommand Integration Tests', () => {
  let command: BuildCommand;
  let interactiveService: Mocked<InteractiveService>;
  let collectionService: Mocked<CollectionService>;
  let transformationService: Mocked<TransformationService>;
  let outputService: Mocked<OutputService>;
  let progressService: Mocked<ProgressService>;
  let errorHandler: Mocked<ErrorHandlerService>;

  beforeEach(async () => {
    const mockInteractiveService = {
      selectPlatform: vi.fn(),
      selectCategories: vi.fn(),
    };

    const mockCollectionService = {
      collectLocalSettings: vi.fn(),
      collectGlobalSettings: vi.fn(),
    };

    const mockTransformationService = {
      transformPersonalContext: vi.fn(),
      transformProjectContext: vi.fn(),
      transformPromptTemplates: vi.fn(),
    };

    const mockOutputService = {
      createOutputDirectory: vi.fn(),
      writeOutputFiles: vi.fn(),
      generateManifest: vi.fn(),
      displayBuildSummary: vi.fn(),
    };

    const mockProgressService = {
      initializeProgress: vi.fn(),
      startStep: vi.fn(),
      completeStep: vi.fn(),
      startScan: vi.fn(),
      completeScan: vi.fn(),
      startTransformation: vi.fn(),
      completeTransformation: vi.fn(),
      failStep: vi.fn(),
      startOutput: vi.fn(),
      completeOutput: vi.fn(),
      displayBuildSummary: vi.fn(),
    };

    const mockErrorHandler = {
      isProcessInterrupted: vi.fn().mockReturnValue(false),
      handleCriticalErrorAndExit: vi.fn(),
      addWarning: vi.fn(),
      hasWarnings: vi.fn().mockReturnValue(false),
      getWarnings: vi.fn().mockReturnValue([]),
      getErrors: vi.fn().mockReturnValue([]),
      displayErrorSummary: vi.fn(),
      exitWithAppropriateCode: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BuildCommand,
        {
          provide: InteractiveService,
          useValue: mockInteractiveService,
        },
        {
          provide: CollectionService,
          useValue: mockCollectionService,
        },
        {
          provide: TransformationService,
          useValue: mockTransformationService,
        },
        {
          provide: OutputService,
          useValue: mockOutputService,
        },
        {
          provide: ProgressService,
          useValue: mockProgressService,
        },
        {
          provide: ErrorHandlerService,
          useValue: mockErrorHandler,
        },
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
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Build Workflow', () => {
    it('should successfully complete full build workflow', async () => {
      // Setup mocks
      interactiveService.selectPlatform.mockResolvedValue(BuildPlatform.KIRO);
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
        { name: BuildCategoryName.PROJECT_CONTEXT, enabled: true },
        { name: BuildCategoryName.PROMPT_TEMPLATES, enabled: true },
      ]);

      collectionService.collectLocalSettings.mockResolvedValue({
        sourcePath: '/test/project',
        collectedAt: '2025-01-01T00:00:00Z',
        context: mockSettingsData.localSettings.contextMd,
        userPreferences: mockSettingsData.localSettings.userPreferencesMd,
        projectSpec: mockSettingsData.localSettings.projectSpecMd,
        steeringFiles: mockSettingsData.localSettings.steeringFiles.map(
          (steeringFile) => ({
            filename: steeringFile.filename,
            path: steeringFile.path,
            content: steeringFile.content,
          }),
        ),
        hookFiles: mockSettingsData.localSettings.hooks.map((hook) => ({
          filename: hook.filename,
          content: hook.content,
          path: hook.path,
        })),
      });

      collectionService.collectGlobalSettings.mockResolvedValue({
        sourcePath: '/test/global',
        collectedAt: '2025-01-01T00:00:00Z',
        securityFiltered: false,
        userConfig: mockSettingsData.globalSettings.userConfig,
        globalPreferences: mockSettingsData.globalSettings.preferences,
        promptTemplates: mockSettingsData.globalSettings.globalPrompts,
        configFiles: [],
      });

      transformationService.transformPersonalContext.mockResolvedValue(
        mockExpectedOutputs.personalContext as unknown as TaptikPersonalContext,
      );
      transformationService.transformProjectContext.mockResolvedValue(
        mockExpectedOutputs.projectContext as unknown as TaptikProjectContext,
      );
      transformationService.transformPromptTemplates.mockResolvedValue(
        mockExpectedOutputs.promptTemplates as unknown as TaptikPromptTemplates,
      );

      outputService.createOutputDirectory.mockResolvedValue(
        './taptik-build-test',
      );
      outputService.writeOutputFiles.mockResolvedValue([
        {
          filename: 'personal-context.json',
          category: 'personal-context',
          size: 100,
        },
        {
          filename: 'project-context.json',
          category: 'project-context',
          size: 200,
        },
        {
          filename: 'prompt-templates.json',
          category: 'prompt-templates',
          size: 300,
        },
      ]);

      // Execute command
      await command.run([], {});

      // Verify workflow steps
      expect(progressService.initializeProgress).toHaveBeenCalledWith([
        'Platform selection',
        'Category selection',
        'Data collection',
        'Data transformation',
        'Output generation',
        'Build completion',
      ]);

      expect(interactiveService.selectPlatform).toHaveBeenCalled();
      expect(interactiveService.selectCategories).toHaveBeenCalled();
      expect(collectionService.collectLocalSettings).toHaveBeenCalled();
      expect(collectionService.collectGlobalSettings).toHaveBeenCalled();

      // Verify transformations for all categories
      expect(transformationService.transformPersonalContext).toHaveBeenCalled();
      expect(transformationService.transformProjectContext).toHaveBeenCalled();
      expect(transformationService.transformPromptTemplates).toHaveBeenCalled();

      // Verify output generation
      expect(outputService.createOutputDirectory).toHaveBeenCalled();
      expect(outputService.writeOutputFiles).toHaveBeenCalledWith(
        './taptik-build-test',
        mockExpectedOutputs.personalContext,
        mockExpectedOutputs.projectContext,
        mockExpectedOutputs.promptTemplates,
      );
      expect(outputService.generateManifest).toHaveBeenCalled();

      // Verify completion
      expect(errorHandler.exitWithAppropriateCode).toHaveBeenCalled();
    });

    it('should handle partial category selection', async () => {
      // Setup mocks for only personal context
      interactiveService.selectPlatform.mockResolvedValue(BuildPlatform.KIRO);
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
        { name: BuildCategoryName.PROJECT_CONTEXT, enabled: false },
        { name: BuildCategoryName.PROMPT_TEMPLATES, enabled: false },
      ]);

      collectionService.collectLocalSettings.mockResolvedValue({
        sourcePath: '/test/project',
        collectedAt: '2025-01-01T00:00:00Z',
        context: mockSettingsData.localSettings.contextMd,
        userPreferences: mockSettingsData.localSettings.userPreferencesMd,
        projectSpec: mockSettingsData.localSettings.projectSpecMd,
        steeringFiles: [],
        hookFiles: [],
      });

      collectionService.collectGlobalSettings.mockResolvedValue({
        sourcePath: '/test/global',
        collectedAt: '2025-01-01T00:00:00Z',
        securityFiltered: false,
        userConfig: mockSettingsData.globalSettings.userConfig,
        globalPreferences: mockSettingsData.globalSettings.preferences,
        promptTemplates: [],
        configFiles: [],
      });

      transformationService.transformPersonalContext.mockResolvedValue(
        mockExpectedOutputs.personalContext as unknown as TaptikPersonalContext,
      );
      outputService.createOutputDirectory.mockResolvedValue(
        './taptik-build-test',
      );
      outputService.writeOutputFiles.mockResolvedValue([
        {
          filename: 'personal-context.json',
          category: 'personal-context',
          size: 100,
        },
      ]);

      // Execute command
      await command.run([], {});

      // Verify only personal context transformation was called
      expect(transformationService.transformPersonalContext).toHaveBeenCalled();
      expect(
        transformationService.transformProjectContext,
      ).not.toHaveBeenCalled();
      expect(
        transformationService.transformPromptTemplates,
      ).not.toHaveBeenCalled();

      // Verify output generation with only personal context
      expect(outputService.writeOutputFiles).toHaveBeenCalledWith(
        './taptik-build-test',
        mockExpectedOutputs.personalContext,
        undefined,
        undefined,
      );
    });

    it('should handle data collection failures gracefully', async () => {
      interactiveService.selectPlatform.mockResolvedValue(BuildPlatform.KIRO);
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      // Mock collection failure
      collectionService.collectLocalSettings.mockRejectedValue(
        new Error('Permission denied'),
      );
      collectionService.collectGlobalSettings.mockRejectedValue(
        new Error('Directory not found'),
      );

      transformationService.transformPersonalContext.mockResolvedValue(
        mockExpectedOutputs.personalContext as unknown as TaptikPersonalContext,
      );
      outputService.createOutputDirectory.mockResolvedValue(
        './taptik-build-test',
      );
      outputService.writeOutputFiles.mockResolvedValue([
        {
          filename: 'personal-context.json',
          category: 'personal-context',
          size: 100,
        },
      ]);

      // Execute command
      await command.run([], {});

      // Verify warnings were added
      expect(errorHandler.addWarning).toHaveBeenCalledWith(
        'Local settings collection failed: Permission denied',
      );
      expect(errorHandler.addWarning).toHaveBeenCalledWith(
        'Global settings collection failed: Directory not found',
      );

      // Verify process continued despite collection failures
      expect(transformationService.transformPersonalContext).toHaveBeenCalled();
      expect(outputService.createOutputDirectory).toHaveBeenCalled();
    });

    it('should handle transformation failures', async () => {
      interactiveService.selectPlatform.mockResolvedValue(BuildPlatform.KIRO);
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
        { name: BuildCategoryName.PROJECT_CONTEXT, enabled: true },
      ]);

      collectionService.collectLocalSettings.mockResolvedValue({
        sourcePath: '/test/project',
        collectedAt: '2025-01-01T00:00:00Z',
        context: mockSettingsData.localSettings.contextMd,
        userPreferences: mockSettingsData.localSettings.userPreferencesMd,
        projectSpec: mockSettingsData.localSettings.projectSpecMd,
        steeringFiles: [],
        hookFiles: [],
      });

      collectionService.collectGlobalSettings.mockResolvedValue({
        sourcePath: '/test/global',
        collectedAt: '2025-01-01T00:00:00Z',
        securityFiltered: false,
        userConfig: '',
        globalPreferences: '',
        promptTemplates: [],
        configFiles: [],
      });

      // Mock transformation failure for project context
      transformationService.transformPersonalContext.mockResolvedValue(
        mockExpectedOutputs.personalContext as unknown as TaptikPersonalContext,
      );
      transformationService.transformProjectContext.mockRejectedValue(
        new Error('Invalid project data'),
      );

      outputService.createOutputDirectory.mockResolvedValue(
        './taptik-build-test',
      );
      outputService.writeOutputFiles.mockResolvedValue([
        {
          filename: 'personal-context.json',
          category: 'personal-context',
          size: 100,
        },
      ]);

      // Execute command
      await command.run([], {});

      // Verify warning was added for failed transformation
      expect(errorHandler.addWarning).toHaveBeenCalledWith(
        'Failed to transform project-context: Invalid project data',
      );

      // Verify successful transformation still completed
      expect(outputService.writeOutputFiles).toHaveBeenCalledWith(
        './taptik-build-test',
        mockExpectedOutputs.personalContext,
        undefined,
        undefined,
      );
    });

    it('should handle user interruption', async () => {
      // Mock interruption after platform selection
      errorHandler.isProcessInterrupted
        .mockReturnValueOnce(false) // Initial check
        .mockReturnValueOnce(false) // After platform selection
        .mockReturnValueOnce(true); // After category selection

      interactiveService.selectPlatform.mockResolvedValue(BuildPlatform.KIRO);
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      // Execute command
      await command.run([], {});

      // Verify process stopped at interruption point
      expect(collectionService.collectLocalSettings).not.toHaveBeenCalled();
      expect(
        transformationService.transformPersonalContext,
      ).not.toHaveBeenCalled();
      expect(outputService.createOutputDirectory).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Operation timed out');
      timeoutError.name = 'TimeoutError';

      interactiveService.selectPlatform.mockRejectedValue(timeoutError);

      await command.run([], {});

      expect(errorHandler.handleCriticalErrorAndExit).toHaveBeenCalledWith({
        type: 'system',
        message: 'Build process timed out',
        details: 'Operation timed out',
        suggestedResolution:
          'Try running the command again or check your system resources',
        exitCode: 124,
      });
    });

    it('should handle permission errors', async () => {
      const permissionError = new Error('Permission denied');
      (permissionError as any).code = 'EACCES';

      interactiveService.selectPlatform.mockRejectedValue(permissionError);

      await command.run([], {});

      expect(errorHandler.handleCriticalErrorAndExit).toHaveBeenCalledWith({
        type: 'file_system',
        message: 'Permission denied accessing files',
        details: 'Permission denied',
        suggestedResolution:
          'Check file permissions or run with appropriate privileges',
        exitCode: 126,
      });
    });

    it('should handle file not found errors', async () => {
      const notFoundError = new Error('File not found');
      (notFoundError as any).code = 'ENOENT';

      interactiveService.selectPlatform.mockRejectedValue(notFoundError);

      await command.run([], {});

      expect(errorHandler.handleCriticalErrorAndExit).toHaveBeenCalledWith({
        type: 'file_system',
        message: 'Required file or directory not found',
        details: 'File not found',
        suggestedResolution:
          'Ensure all required files exist and paths are correct',
        exitCode: 2,
      });
    });

    it('should handle generic errors', async () => {
      const genericError = new Error('Something went wrong');

      interactiveService.selectPlatform.mockRejectedValue(genericError);

      await command.run([], {});

      expect(errorHandler.handleCriticalErrorAndExit).toHaveBeenCalledWith({
        type: 'system',
        message: 'Build process failed with unexpected error',
        details: 'Something went wrong',
        suggestedResolution: 'Please report this issue with the error details',
        exitCode: 1,
      });
    });
  });

  describe('Build Configuration', () => {
    it('should generate unique build IDs', async () => {
      interactiveService.selectPlatform.mockResolvedValue(BuildPlatform.KIRO);
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      collectionService.collectLocalSettings.mockResolvedValue({
        sourcePath: '/test/project',
        collectedAt: '2025-01-01T00:00:00Z',
        context: '',
        userPreferences: '',
        projectSpec: '',
        steeringFiles: [],
        hookFiles: [],
      });

      collectionService.collectGlobalSettings.mockResolvedValue({
        sourcePath: '/test/global',
        collectedAt: '2025-01-01T00:00:00Z',
        securityFiltered: false,
        userConfig: '',
        globalPreferences: '',
        promptTemplates: [],
        configFiles: [],
      });

      transformationService.transformPersonalContext.mockResolvedValue(
        mockExpectedOutputs.personalContext as unknown as TaptikPersonalContext,
      );
      outputService.createOutputDirectory.mockResolvedValue(
        './taptik-build-test',
      );
      outputService.writeOutputFiles.mockResolvedValue([
        {
          filename: 'personal-context.json',
          category: 'personal-context',
          size: 100,
        },
      ]);

      // Execute multiple times to verify unique build IDs
      await command.run([], {});
      const firstManifestCall = outputService.generateManifest.mock.calls[0];

      outputService.generateManifest.mockClear();
      await command.run([], {});
      const secondManifestCall = outputService.generateManifest.mock.calls[0];

      // Verify build IDs are different
      expect(firstManifestCall[1].buildId).not.toBe(
        secondManifestCall[1].buildId,
      );
      expect(firstManifestCall[1].buildId).toMatch(/^build(?:-[\da-z]+){2}$/);
      expect(secondManifestCall[1].buildId).toMatch(/^build(?:-[\da-z]+){2}$/);
    });
  });
});
