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
import { mockBuildConfig, mockSettingsData, mockExpectedOutputs } from '../test-fixtures';

describe('BuildCommand Integration Tests', () => {
  let command: BuildCommand;
  let interactiveService: jest.Mocked<InteractiveService>;
  let collectionService: jest.Mocked<CollectionService>;
  let transformationService: jest.Mocked<TransformationService>;
  let outputService: jest.Mocked<OutputService>;
  let progressService: jest.Mocked<ProgressService>;
  let errorHandler: jest.Mocked<ErrorHandlerService>;

  beforeEach(async () => {
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
      getWarnings: jest.fn().mockReturnValue([]),
      getErrors: jest.fn().mockReturnValue([]),
      displayErrorSummary: jest.fn(),
      exitWithAppropriateCode: jest.fn(),
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
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
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
        context: mockSettingsData.localSettings.contextMd,
        userPreferences: mockSettingsData.localSettings.userPreferencesMd,
        projectSpec: mockSettingsData.localSettings.projectSpecMd,
        steeringFiles: mockSettingsData.localSettings.steeringFiles,
        hookFiles: mockSettingsData.localSettings.hooks.map(hook => ({
          filename: hook.filename,
          content: hook.content,
          path: hook.path,
        })),
      });

      collectionService.collectGlobalSettings.mockResolvedValue({
        userConfig: mockSettingsData.globalSettings.userConfig,
        globalPreferences: mockSettingsData.globalSettings.preferences,
        promptTemplates: mockSettingsData.globalSettings.globalPrompts,
        configFiles: [],
      });

      transformationService.transformPersonalContext.mockResolvedValue(mockExpectedOutputs.personalContext);
      transformationService.transformProjectContext.mockResolvedValue(mockExpectedOutputs.projectContext);
      transformationService.transformPromptTemplates.mockResolvedValue(mockExpectedOutputs.promptTemplates);

      outputService.createOutputDirectory.mockResolvedValue('./taptik-build-test');
      outputService.writeOutputFiles.mockResolvedValue([
        'personal-context.json',
        'project-context.json',
        'prompt-templates.json',
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
        mockExpectedOutputs.promptTemplates
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
        context: mockSettingsData.localSettings.contextMd,
        userPreferences: mockSettingsData.localSettings.userPreferencesMd,
        projectSpec: mockSettingsData.localSettings.projectSpecMd,
        steeringFiles: [],
        hookFiles: [],
      });

      collectionService.collectGlobalSettings.mockResolvedValue({
        userConfig: mockSettingsData.globalSettings.userConfig,
        globalPreferences: mockSettingsData.globalSettings.preferences,
        promptTemplates: [],
        configFiles: [],
      });

      transformationService.transformPersonalContext.mockResolvedValue(mockExpectedOutputs.personalContext);
      outputService.createOutputDirectory.mockResolvedValue('./taptik-build-test');
      outputService.writeOutputFiles.mockResolvedValue(['personal-context.json']);

      // Execute command
      await command.run([], {});

      // Verify only personal context transformation was called
      expect(transformationService.transformPersonalContext).toHaveBeenCalled();
      expect(transformationService.transformProjectContext).not.toHaveBeenCalled();
      expect(transformationService.transformPromptTemplates).not.toHaveBeenCalled();

      // Verify output generation with only personal context
      expect(outputService.writeOutputFiles).toHaveBeenCalledWith(
        './taptik-build-test',
        mockExpectedOutputs.personalContext,
        undefined,
        undefined
      );
    });

    it('should handle data collection failures gracefully', async () => {
      interactiveService.selectPlatform.mockResolvedValue(BuildPlatform.KIRO);
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      // Mock collection failure
      collectionService.collectLocalSettings.mockRejectedValue(new Error('Permission denied'));
      collectionService.collectGlobalSettings.mockRejectedValue(new Error('Directory not found'));

      transformationService.transformPersonalContext.mockResolvedValue(mockExpectedOutputs.personalContext);
      outputService.createOutputDirectory.mockResolvedValue('./taptik-build-test');
      outputService.writeOutputFiles.mockResolvedValue(['personal-context.json']);

      // Execute command
      await command.run([], {});

      // Verify warnings were added
      expect(errorHandler.addWarning).toHaveBeenCalledWith('Local settings collection failed: Permission denied');
      expect(errorHandler.addWarning).toHaveBeenCalledWith('Global settings collection failed: Directory not found');

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
        context: mockSettingsData.localSettings.contextMd,
        userPreferences: mockSettingsData.localSettings.userPreferencesMd,
        projectSpec: mockSettingsData.localSettings.projectSpecMd,
        steeringFiles: [],
        hookFiles: [],
      });

      collectionService.collectGlobalSettings.mockResolvedValue({
        userConfig: '',
        globalPreferences: '',
        promptTemplates: [],
        configFiles: [],
      });

      // Mock transformation failure for project context
      transformationService.transformPersonalContext.mockResolvedValue(mockExpectedOutputs.personalContext);
      transformationService.transformProjectContext.mockRejectedValue(new Error('Invalid project data'));

      outputService.createOutputDirectory.mockResolvedValue('./taptik-build-test');
      outputService.writeOutputFiles.mockResolvedValue(['personal-context.json']);

      // Execute command
      await command.run([], {});

      // Verify warning was added for failed transformation
      expect(errorHandler.addWarning).toHaveBeenCalledWith('Failed to transform project-context: Invalid project data');

      // Verify successful transformation still completed
      expect(outputService.writeOutputFiles).toHaveBeenCalledWith(
        './taptik-build-test',
        mockExpectedOutputs.personalContext,
        undefined,
        undefined
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
      expect(transformationService.transformPersonalContext).not.toHaveBeenCalled();
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
        suggestedResolution: 'Try running the command again or check your system resources',
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
        suggestedResolution: 'Check file permissions or run with appropriate privileges',
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
        suggestedResolution: 'Ensure all required files exist and paths are correct',
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
        context: '',
        userPreferences: '',
        projectSpec: '',
        steeringFiles: [],
        hookFiles: [],
      });

      collectionService.collectGlobalSettings.mockResolvedValue({
        userConfig: '',
        globalPreferences: '',
        promptTemplates: [],
        configFiles: [],
      });

      transformationService.transformPersonalContext.mockResolvedValue(mockExpectedOutputs.personalContext);
      outputService.createOutputDirectory.mockResolvedValue('./taptik-build-test');
      outputService.writeOutputFiles.mockResolvedValue(['personal-context.json']);

      // Execute multiple times to verify unique build IDs
      await command.run([], {});
      const firstManifestCall = outputService.generateManifest.mock.calls[0];

      outputService.generateManifest.mockClear();
      await command.run([], {});
      const secondManifestCall = outputService.generateManifest.mock.calls[0];

      // Verify build IDs are different
      expect(firstManifestCall[1].buildId).not.toBe(secondManifestCall[1].buildId);
      expect(firstManifestCall[1].buildId).toMatch(/^build-[a-z0-9]+-[a-z0-9]+$/);
      expect(secondManifestCall[1].buildId).toMatch(/^build-[a-z0-9]+-[a-z0-9]+$/);
    });
  });
});