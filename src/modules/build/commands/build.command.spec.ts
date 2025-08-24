import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, vi, Mock, Mocked } from 'vitest';

import { MetadataGeneratorService } from '../../context/services/metadata-generator.service';
import { PackageService } from '../../context/services/package.service';
import { SanitizationService } from '../../context/services/sanitization.service';
import { ValidationService } from '../../context/services/validation.service';
import {
  BuildPlatform,
  BuildCategoryName,
} from '../interfaces/build-config.interface';
import { CollectionService } from '../services/collection/collection.service';
import { ErrorHandlerService } from '../services/error-handler/error-handler.service';
import { InteractiveService } from '../services/interactive/interactive.service';
import { OutputService } from '../services/output/output.service';
import { ProgressService } from '../services/progress/progress.service';
import { TransformationService } from '../services/transformation/transformation.service';

import { BuildCommand } from './build.command';

// Manual mocks are provided through TestingModule instead of vi.mock for better control

describe('BuildCommand', () => {
  let command: BuildCommand;
  let interactiveService: Mocked<InteractiveService>;
  let collectionService: Mocked<CollectionService>;
  let transformationService: Mocked<TransformationService>;
  let sanitizationService: Mocked<SanitizationService>;
  let metadataGeneratorService: Mocked<MetadataGeneratorService>;
  let packageService: Mocked<PackageService>;
  let validationService: Mocked<ValidationService>;
  let outputService: Mocked<OutputService>;
  let progressService: Mocked<ProgressService>;
  let errorHandler: Mocked<ErrorHandlerService>;

  const mockLocalSettingsData = {
    context: 'test context',
    userPreferences: 'test preferences',
    projectSpec: 'test spec',
    steeringFiles: [
      {
        filename: 'test.md',
        content: 'steering content',
        path: '/test/steering/test.md',
      },
    ],
    hookFiles: [
      {
        filename: 'commit.kiro.hook',
        content: 'hook content',
        path: '/test/hooks/commit.kiro.hook',
      },
    ],
    configFiles: [],
    sourcePath: '/test/.kiro',
    collectedAt: '2025-01-01T00:00:00Z',
  };

  const mockGlobalSettingsData = {
    userConfig: 'global config',
    globalPreferences: 'global preferences',
    promptTemplates: [
      {
        filename: 'template.md',
        content: 'template content',
        path: '/home/.kiro/templates/template.md',
      },
    ],
    configFiles: [],
    sourcePath: '/home/.kiro',
    collectedAt: '2025-01-01T00:00:00Z',
    securityFiltered: false,
  };

  const mockPersonalContext = {
    user_id: 'test-user-id',
    preferences: {
      preferred_languages: ['typescript'],
      coding_style: {
        indentation: '2 spaces',
        naming_convention: 'camelCase',
        comment_style: 'minimal',
        code_organization: 'feature-based',
      },
      tools_and_frameworks: ['nestjs'],
      development_environment: ['vscode'],
    },
    work_style: {
      preferred_workflow: 'agile',
      problem_solving_approach: 'incremental',
      documentation_level: 'minimal',
      testing_approach: 'unit-first',
    },
    communication: {
      preferred_explanation_style: 'concise',
      technical_depth: 'intermediate',
      feedback_style: 'direct',
    },
    metadata: {
      source_platform: 'kiro',
      created_at: '2025-01-01T00:00:00Z',
      version: '1.0.0',
    },
  };

  const mockProjectContext = {
    project_id: 'test-project-id',
    project_info: {
      name: 'test-project',
      description: 'test description',
      version: '1.0.0',
      repository: 'https://github.com/test/repo',
    },
    technical_stack: {
      primary_language: 'typescript',
      frameworks: ['nestjs'],
      databases: ['postgresql'],
      tools: ['jest'],
      deployment: ['docker'],
    },
    development_guidelines: {
      coding_standards: ['use typescript'],
      testing_requirements: ['unit tests required'],
      documentation_standards: ['document public APIs'],
      review_process: ['peer review required'],
    },
    metadata: {
      source_platform: 'kiro',
      source_path: '/test/project',
      created_at: '2025-01-01T00:00:00Z',
      version: '1.0.0',
    },
  };

  const mockPromptTemplates = {
    templates: [
      {
        id: 'template-1',
        name: 'Test Template',
        description: 'A test template',
        category: 'test',
        content: 'Template content',
        variables: [],
        tags: ['test'],
      },
    ],
    metadata: {
      source_platform: 'kiro',
      created_at: '2025-01-01T00:00:00Z',
      version: '1.0.0',
      total_templates: 1,
    },
  };

  const mockOutputFiles = [
    {
      filename: 'personal-context.json',
      category: 'personal-context',
      size: 1024,
    },
    {
      filename: 'project-context.json',
      category: 'project-context',
      size: 2048,
    },
    {
      filename: 'prompt-templates.json',
      category: 'prompt-templates',
      size: 512,
    },
  ];

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
      failStep: vi.fn(),
      startScan: vi.fn(),
      completeScan: vi.fn(),
      startTransformation: vi.fn(),
      completeTransformation: vi.fn(),
      startOutput: vi.fn(),
      completeOutput: vi.fn(),
      displayBuildSummary: vi.fn(),
    };

    const mockSanitizationService = {
      sanitizeForCloudUpload: vi.fn(),
    };

    const mockMetadataGeneratorService = {
      generateCloudMetadata: vi.fn(),
    };

    const mockPackageService = {
      createTaptikPackage: vi.fn(),
      writePackageToFile: vi.fn(),
    };

    const mockValidationService = {
      validateForCloudUpload: vi.fn(),
    };

    const mockErrorHandler = {
      isProcessInterrupted: vi.fn().mockReturnValue(false),
      addWarning: vi.fn(),
      addCriticalError: vi.fn(),
      hasWarnings: vi.fn().mockReturnValue(false),
      hasCriticalErrors: vi.fn().mockReturnValue(false),
      getErrorSummary: vi
        .fn()
        .mockReturnValue({
          warnings: [],
          criticalErrors: [],
          partialFiles: [],
        }),
      displayErrorSummary: vi.fn(),
      exitWithAppropriateCode: vi.fn().mockImplementation(() => undefined),
      handleCriticalErrorAndExit: vi.fn().mockImplementation(() => undefined),
      reset: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
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
          provide: SanitizationService,
          useValue: mockSanitizationService,
        },
        {
          provide: MetadataGeneratorService,
          useValue: mockMetadataGeneratorService,
        },
        {
          provide: PackageService,
          useValue: mockPackageService,
        },
        {
          provide: ValidationService,
          useValue: mockValidationService,
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

    // Get the mock services from the module (needed for proper typing)
    interactiveService = module.get(InteractiveService);
    collectionService = module.get(CollectionService);
    transformationService = module.get(TransformationService);
    sanitizationService = module.get(SanitizationService);
    metadataGeneratorService = module.get(MetadataGeneratorService);
    packageService = module.get(PackageService);
    validationService = module.get(ValidationService);
    outputService = module.get(OutputService);
    progressService = module.get(ProgressService);
    errorHandler = module.get(ErrorHandlerService);

    // Create BuildCommand with direct instantiation to ensure proper dependency injection
    command = new BuildCommand(
      interactiveService,
      collectionService,
      transformationService,
      sanitizationService,
      metadataGeneratorService,
      packageService,
      validationService,
      outputService,
      progressService,
      errorHandler,
    );

    // Setup default mock implementations
    interactiveService.selectPlatform.mockResolvedValue(BuildPlatform.KIRO);
    interactiveService.selectCategories.mockResolvedValue([
      { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      { name: BuildCategoryName.PROJECT_CONTEXT, enabled: true },
      { name: BuildCategoryName.PROMPT_TEMPLATES, enabled: true },
    ]);

    collectionService.collectLocalSettings.mockResolvedValue(
      mockLocalSettingsData,
    );
    collectionService.collectGlobalSettings.mockResolvedValue(
      mockGlobalSettingsData,
    );

    transformationService.transformPersonalContext.mockResolvedValue(
      mockPersonalContext,
    );
    transformationService.transformProjectContext.mockResolvedValue(
      mockProjectContext,
    );
    transformationService.transformPromptTemplates.mockResolvedValue(
      mockPromptTemplates,
    );

    outputService.createOutputDirectory.mockResolvedValue('/test/output');
    outputService.writeOutputFiles.mockResolvedValue(mockOutputFiles);
    outputService.generateManifest.mockResolvedValue(undefined);
    outputService.displayBuildSummary.mockResolvedValue(undefined);

    // Suppress logger output during tests
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
  });

  describe('run', () => {
    it('should orchestrate complete build workflow successfully', async () => {
      await command.run([], {});

      // Verify progress initialization
      expect(progressService.initializeProgress).toHaveBeenCalledWith([
        'Platform selection',
        'Category selection',
        'Data collection',
        'Data transformation',
        'Output generation',
        'Build completion',
      ]);

      // Verify interactive selection
      expect(interactiveService.selectPlatform).toHaveBeenCalled();
      expect(interactiveService.selectCategories).toHaveBeenCalled();

      // Verify data collection
      expect(collectionService.collectLocalSettings).toHaveBeenCalled();
      expect(collectionService.collectGlobalSettings).toHaveBeenCalled();

      // Verify transformation for all categories
      expect(transformationService.transformPersonalContext).toHaveBeenCalled();
      expect(transformationService.transformProjectContext).toHaveBeenCalled();
      expect(transformationService.transformPromptTemplates).toHaveBeenCalled();

      // Verify output generation
      expect(outputService.createOutputDirectory).toHaveBeenCalled();
      expect(outputService.writeOutputFiles).toHaveBeenCalledWith(
        '/test/output',
        mockPersonalContext,
        mockProjectContext,
        mockPromptTemplates,
      );
      expect(outputService.generateManifest).toHaveBeenCalled();

      // Verify completion
      expect(progressService.displayBuildSummary).toHaveBeenCalled();
      expect(outputService.displayBuildSummary).toHaveBeenCalled();
      expect(errorHandler.exitWithAppropriateCode).toHaveBeenCalled();
    });

    it('should handle process interruption gracefully', async () => {
      (errorHandler.isProcessInterrupted as Mock).mockReturnValue(true);

      await command.run([], {});

      // Should exit early without calling other services
      expect(interactiveService.selectPlatform).not.toHaveBeenCalled();
      expect(collectionService.collectLocalSettings).not.toHaveBeenCalled();
    });

    it('should handle local settings collection failure gracefully', async () => {
      const error = new Error('Local settings not found');
      collectionService.collectLocalSettings.mockRejectedValue(error);

      await command.run([], {});

      // Should add warning and continue
      expect(errorHandler.addWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.any(String),
          message: expect.stringContaining('Local settings collection failed'),
        }),
      );

      // Should still proceed with transformation
      expect(transformationService.transformPersonalContext).toHaveBeenCalled();
    });

    it('should handle global settings collection failure gracefully', async () => {
      const error = new Error('Global settings not found');
      collectionService.collectGlobalSettings.mockRejectedValue(error);

      await command.run([], {});

      // Should add warning and continue
      expect(errorHandler.addWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.any(String),
          message: expect.stringContaining('Global settings collection failed'),
        }),
      );

      // Should still proceed with transformation
      expect(transformationService.transformPersonalContext).toHaveBeenCalled();
    });

    it('should handle transformation failure gracefully', async () => {
      const error = new Error('Transformation failed');
      transformationService.transformPersonalContext.mockRejectedValue(error);

      await command.run([], {});

      // Should add warning and continue with other transformations
      expect(errorHandler.addWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.any(String),
          message: expect.stringContaining(
            'Failed to transform personal-context',
          ),
        }),
      );
      expect(progressService.failStep).toHaveBeenCalledWith(
        'Failed to transform personal-context',
        error,
      );

      // Should still proceed with other transformations
      expect(transformationService.transformProjectContext).toHaveBeenCalled();
      expect(transformationService.transformPromptTemplates).toHaveBeenCalled();
    });

    it('should handle only selected categories', async () => {
      // Mock selection of only personal context
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
        { name: BuildCategoryName.PROJECT_CONTEXT, enabled: false },
        { name: BuildCategoryName.PROMPT_TEMPLATES, enabled: false },
      ]);

      await command.run([], {});

      // Should only transform personal context
      expect(transformationService.transformPersonalContext).toHaveBeenCalled();
      expect(
        transformationService.transformProjectContext,
      ).not.toHaveBeenCalled();
      expect(
        transformationService.transformPromptTemplates,
      ).not.toHaveBeenCalled();

      // Should write output with only personal context
      expect(outputService.writeOutputFiles).toHaveBeenCalledWith(
        '/test/output',
        mockPersonalContext,
        undefined,
        undefined,
      );
    });

    it('should handle timeout error appropriately', async () => {
      const timeoutError = new Error('Operation timed out');
      timeoutError.name = 'TimeoutError';
      interactiveService.selectPlatform.mockRejectedValue(timeoutError);

      await command.run([], {});

      expect(errorHandler.handleCriticalErrorAndExit).toHaveBeenCalledWith({
        type: 'system',
        message: 'Build process timed out',
        details: timeoutError.message,
        suggestedResolution:
          'Try running the command again or check your system resources',
        exitCode: 124,
      });
    });

    it('should handle permission denied error appropriately', async () => {
      const permissionError = new Error('Permission denied');
      (permissionError as any).code = 'EACCES';
      collectionService.collectLocalSettings.mockRejectedValue(permissionError);

      await command.run([], {});

      // Permission errors in collection phase are handled as warnings, not critical errors
      // The critical error handling only applies to unhandled exceptions in the outer try-catch
      expect(errorHandler.addWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.any(String),
          message: expect.stringContaining('Local settings collection failed'),
        }),
      );
    });

    it('should handle file not found error appropriately', async () => {
      const notFoundError = new Error('File not found');
      (notFoundError as any).code = 'ENOENT';
      outputService.createOutputDirectory.mockRejectedValue(notFoundError);

      await command.run([], {});

      expect(errorHandler.handleCriticalErrorAndExit).toHaveBeenCalledWith({
        type: 'file_system',
        message: 'Required file or directory not found',
        details: notFoundError.message,
        suggestedResolution:
          'Ensure all required files exist and paths are correct',
        exitCode: 2,
      });
    });

    it('should handle generic error appropriately', async () => {
      const genericError = new Error('Something went wrong');
      outputService.writeOutputFiles.mockRejectedValue(genericError);

      await command.run([], {});

      expect(errorHandler.handleCriticalErrorAndExit).toHaveBeenCalledWith({
        type: 'system',
        message: 'Build process failed with unexpected error',
        details: genericError.message,
        suggestedResolution: 'Please report this issue with the error details',
        exitCode: 1,
      });
    });

    it('should track progress through all steps', async () => {
      await command.run([], {});

      // Verify all progress steps are called
      expect(progressService.startStep).toHaveBeenCalledWith(
        'Platform selection',
      );
      expect(progressService.completeStep).toHaveBeenCalledWith(
        'Platform selection',
      );

      expect(progressService.startStep).toHaveBeenCalledWith(
        'Category selection',
      );
      expect(progressService.completeStep).toHaveBeenCalledWith(
        'Category selection',
      );

      expect(progressService.startStep).toHaveBeenCalledWith('Data collection');
      expect(progressService.completeStep).toHaveBeenCalledWith(
        'Data collection',
      );

      expect(progressService.startStep).toHaveBeenCalledWith(
        'Data transformation',
      );
      expect(progressService.completeStep).toHaveBeenCalledWith(
        'Data transformation',
      );

      expect(progressService.startStep).toHaveBeenCalledWith(
        'Output generation',
      );
      expect(progressService.completeStep).toHaveBeenCalledWith(
        'Output generation',
      );

      expect(progressService.startStep).toHaveBeenCalledWith(
        'Build completion',
      );
      expect(progressService.completeStep).toHaveBeenCalledWith(
        'Build completion',
      );
    });

    it('should check for interruption between major steps', async () => {
      await command.run([], {});

      // Should check for interruption multiple times (exact count may vary)
      expect(errorHandler.isProcessInterrupted).toHaveBeenCalledTimes(7);
    });

    it('should display warnings if any exist', async () => {
      errorHandler.hasWarnings.mockReturnValue(true);

      await command.run([], {});

      expect(errorHandler.displayErrorSummary).toHaveBeenCalled();
    });

    it('should generate unique build IDs', async () => {
      const command1 = new BuildCommand(
        interactiveService,
        collectionService,
        transformationService,
        sanitizationService,
        metadataGeneratorService,
        packageService,
        validationService,
        outputService,
        progressService,
        errorHandler,
      );

      const command2 = new BuildCommand(
        interactiveService,
        collectionService,
        transformationService,
        sanitizationService,
        metadataGeneratorService,
        packageService,
        validationService,
        outputService,
        progressService,
        errorHandler,
      );

      // Mock the private method by accessing it through the prototype
      const generateBuildId1 = (command1 as any).generateBuildId();
      const generateBuildId2 = (command2 as any).generateBuildId();

      expect(generateBuildId1).not.toBe(generateBuildId2);
      expect(generateBuildId1).toMatch(/^build(?:-[\da-z]+){2}$/);
    });
  });

  describe('private methods', () => {
    it('should extract hook type from filename correctly', () => {
      const { extractHookType } = command as any;

      expect(extractHookType('commit.kiro.hook')).toBe('commit');
      expect(extractHookType('save.kiro.hook')).toBe('save');
      expect(extractHookType('test.kiro.hook')).toBe('test');
      expect(extractHookType('invalid-filename')).toBe('unknown');
    });
  });
});
