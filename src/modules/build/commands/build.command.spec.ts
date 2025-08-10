import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

import { InteractiveService } from '../services/interactive.service';
import { BuildCommand } from './build.command';
import { CollectionService } from '../services/collection.service';
import { TransformationService } from '../services/transformation.service';
import { OutputService } from '../services/output.service';
import { ProgressService } from '../services/progress.service';
import { ErrorHandlerService } from '../services/error-handler.service';
import { BuildPlatform, BuildCategoryName } from '../interfaces/build-config.interface';

// Mock all services
vi.mock('../services/interactive.service');
vi.mock('../services/collection.service');
vi.mock('../services/transformation.service');
vi.mock('../services/output.service');
vi.mock('../services/progress.service');
vi.mock('../services/error-handler.service');

describe('BuildCommand', () => {
  let command: BuildCommand;
  let interactiveService: InteractiveService;
  let collectionService: CollectionService;
  let transformationService: TransformationService;
  let outputService: OutputService;
  let progressService: ProgressService;
  let errorHandler: ErrorHandlerService;

  const mockLocalSettingsData = {
    context: 'test context',
    userPreferences: 'test preferences',
    projectSpec: 'test spec',
    steeringFiles: [
      { filename: 'test.md', content: 'steering content', path: '/test/steering/test.md' }
    ],
    hookFiles: [
      { filename: 'commit.kiro.hook', content: 'hook content', path: '/test/hooks/commit.kiro.hook' }
    ],
    sourcePath: '/test/.kiro',
    collectedAt: '2025-01-01T00:00:00Z',
  };

  const mockGlobalSettingsData = {
    userConfig: 'global config',
    globalPreferences: 'global preferences',
    promptTemplates: [
      { filename: 'template.md', content: 'template content', path: '/home/.kiro/templates/template.md' }
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
        content: 'Template content',
        variables: [],
        metadata: {
          created_at: '2025-01-01T00:00:00Z',
          version: '1.0.0',
        },
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
    { filename: 'personal-context.json', category: 'personal-context', size: 1024 },
    { filename: 'project-context.json', category: 'project-context', size: 2048 },
    { filename: 'prompt-templates.json', category: 'prompt-templates', size: 512 },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BuildCommand,
        {
          provide: InteractiveService,
          useValue: {
            selectPlatform: vi.fn(),
            selectCategories: vi.fn(),
          },
        },
        {
          provide: CollectionService,
          useValue: {
            collectLocalSettings: vi.fn(),
            collectGlobalSettings: vi.fn(),
          },
        },
        {
          provide: TransformationService,
          useValue: {
            transformPersonalContext: vi.fn(),
            transformProjectContext: vi.fn(),
            transformPromptTemplates: vi.fn(),
          },
        },
        {
          provide: OutputService,
          useValue: {
            createOutputDirectory: vi.fn(),
            writeOutputFiles: vi.fn(),
            generateManifest: vi.fn(),
            displayBuildSummary: vi.fn(),
          },
        },
        {
          provide: ProgressService,
          useValue: {
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
          },
        },
        {
          provide: ErrorHandlerService,
          useValue: {
            isProcessInterrupted: vi.fn().mockReturnValue(false),
            addWarning: vi.fn(),
            addError: vi.fn(),
            hasWarnings: vi.fn().mockReturnValue(false),
            getWarnings: vi.fn().mockReturnValue([]),
            getErrors: vi.fn().mockReturnValue([]),
            displayErrorSummary: vi.fn(),
            exitWithAppropriateCode: vi.fn(),
            handleCriticalErrorAndExit: vi.fn(),
          },
        },
      ],
    }).compile();

    command = module.get<BuildCommand>(BuildCommand);
    interactiveService = module.get<InteractiveService>(InteractiveService);
    collectionService = module.get<CollectionService>(CollectionService);
    transformationService = module.get<TransformationService>(TransformationService);
    outputService = module.get<OutputService>(OutputService);
    progressService = module.get<ProgressService>(ProgressService);
    errorHandler = module.get<ErrorHandlerService>(ErrorHandlerService);

    // Setup default mock implementations
    (interactiveService.selectPlatform as Mock).mockResolvedValue(BuildPlatform.KIRO);
    (interactiveService.selectCategories as Mock).mockResolvedValue([
      { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      { name: BuildCategoryName.PROJECT_CONTEXT, enabled: true },
      { name: BuildCategoryName.PROMPT_TEMPLATES, enabled: true },
    ]);

    (collectionService.collectLocalSettings as Mock).mockResolvedValue(mockLocalSettingsData);
    (collectionService.collectGlobalSettings as Mock).mockResolvedValue(mockGlobalSettingsData);

    (transformationService.transformPersonalContext as Mock).mockResolvedValue(mockPersonalContext);
    (transformationService.transformProjectContext as Mock).mockResolvedValue(mockProjectContext);
    (transformationService.transformPromptTemplates as Mock).mockResolvedValue(mockPromptTemplates);

    (outputService.createOutputDirectory as Mock).mockResolvedValue('/test/output');
    (outputService.writeOutputFiles as Mock).mockResolvedValue(mockOutputFiles);
    (outputService.generateManifest as Mock).mockResolvedValue(undefined);
    (outputService.displayBuildSummary as Mock).mockResolvedValue(undefined);
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
        'Build completion'
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
        mockPromptTemplates
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
      (collectionService.collectLocalSettings as Mock).mockRejectedValue(error);

      await command.run([], {});

      // Should add warning and continue
      expect(errorHandler.addWarning).toHaveBeenCalledWith(
        expect.stringContaining('Local settings collection failed')
      );

      // Should still proceed with transformation
      expect(transformationService.transformPersonalContext).toHaveBeenCalled();
    });

    it('should handle global settings collection failure gracefully', async () => {
      const error = new Error('Global settings not found');
      (collectionService.collectGlobalSettings as Mock).mockRejectedValue(error);

      await command.run([], {});

      // Should add warning and continue
      expect(errorHandler.addWarning).toHaveBeenCalledWith(
        expect.stringContaining('Global settings collection failed')
      );

      // Should still proceed with transformation
      expect(transformationService.transformPersonalContext).toHaveBeenCalled();
    });

    it('should handle transformation failure gracefully', async () => {
      const error = new Error('Transformation failed');
      (transformationService.transformPersonalContext as Mock).mockRejectedValue(error);

      await command.run([], {});

      // Should add warning and continue with other transformations
      expect(errorHandler.addWarning).toHaveBeenCalledWith(
        expect.stringContaining('Failed to transform personal-context')
      );
      expect(progressService.failStep).toHaveBeenCalledWith(
        'Failed to transform personal-context',
        error
      );

      // Should still proceed with other transformations
      expect(transformationService.transformProjectContext).toHaveBeenCalled();
      expect(transformationService.transformPromptTemplates).toHaveBeenCalled();
    });

    it('should handle only selected categories', async () => {
      // Mock selection of only personal context
      (interactiveService.selectCategories as Mock).mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
        { name: BuildCategoryName.PROJECT_CONTEXT, enabled: false },
        { name: BuildCategoryName.PROMPT_TEMPLATES, enabled: false },
      ]);

      await command.run([], {});

      // Should only transform personal context
      expect(transformationService.transformPersonalContext).toHaveBeenCalled();
      expect(transformationService.transformProjectContext).not.toHaveBeenCalled();
      expect(transformationService.transformPromptTemplates).not.toHaveBeenCalled();

      // Should write output with only personal context
      expect(outputService.writeOutputFiles).toHaveBeenCalledWith(
        '/test/output',
        mockPersonalContext,
        undefined,
        undefined
      );
    });

    it('should handle timeout error appropriately', async () => {
      const timeoutError = new Error('Operation timed out');
      timeoutError.name = 'TimeoutError';
      (interactiveService.selectPlatform as Mock).mockRejectedValue(timeoutError);

      await command.run([], {});

      expect(errorHandler.handleCriticalErrorAndExit).toHaveBeenCalledWith({
        type: 'system',
        message: 'Build process timed out',
        details: timeoutError.message,
        suggestedResolution: 'Try running the command again or check your system resources',
        exitCode: 124,
      });
    });

    it('should handle permission denied error appropriately', async () => {
      const permissionError = new Error('Permission denied');
      permissionError.code = 'EACCES';
      (collectionService.collectLocalSettings as Mock).mockRejectedValue(permissionError);

      await command.run([], {});

      expect(errorHandler.handleCriticalErrorAndExit).toHaveBeenCalledWith({
        type: 'file_system',
        message: 'Permission denied accessing files',
        details: permissionError.message,
        suggestedResolution: 'Check file permissions or run with appropriate privileges',
        exitCode: 126,
      });
    });

    it('should handle file not found error appropriately', async () => {
      const notFoundError = new Error('File not found');
      notFoundError.code = 'ENOENT';
      (outputService.createOutputDirectory as Mock).mockRejectedValue(notFoundError);

      await command.run([], {});

      expect(errorHandler.handleCriticalErrorAndExit).toHaveBeenCalledWith({
        type: 'file_system',
        message: 'Required file or directory not found',
        details: notFoundError.message,
        suggestedResolution: 'Ensure all required files exist and paths are correct',
        exitCode: 2,
      });
    });

    it('should handle generic error appropriately', async () => {
      const genericError = new Error('Something went wrong');
      (outputService.writeOutputFiles as Mock).mockRejectedValue(genericError);

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
      expect(progressService.startStep).toHaveBeenCalledWith('Platform selection');
      expect(progressService.completeStep).toHaveBeenCalledWith('Platform selection');
      
      expect(progressService.startStep).toHaveBeenCalledWith('Category selection');
      expect(progressService.completeStep).toHaveBeenCalledWith('Category selection');
      
      expect(progressService.startStep).toHaveBeenCalledWith('Data collection');
      expect(progressService.completeStep).toHaveBeenCalledWith('Data collection');
      
      expect(progressService.startStep).toHaveBeenCalledWith('Data transformation');
      expect(progressService.completeStep).toHaveBeenCalledWith('Data transformation');
      
      expect(progressService.startStep).toHaveBeenCalledWith('Output generation');
      expect(progressService.completeStep).toHaveBeenCalledWith('Output generation');
      
      expect(progressService.startStep).toHaveBeenCalledWith('Build completion');
      expect(progressService.completeStep).toHaveBeenCalledWith('Build completion');
    });

    it('should check for interruption between major steps', async () => {
      await command.run([], {});

      // Should check for interruption multiple times
      expect(errorHandler.isProcessInterrupted).toHaveBeenCalledTimes(4);
    });

    it('should display warnings if any exist', async () => {
      (errorHandler.hasWarnings as Mock).mockReturnValue(true);

      await command.run([], {});

      expect(errorHandler.displayErrorSummary).toHaveBeenCalled();
    });

    it('should generate unique build IDs', async () => {
      const command1 = new BuildCommand(
        interactiveService,
        collectionService,
        transformationService,
        outputService,
        progressService,
        errorHandler
      );

      const command2 = new BuildCommand(
        interactiveService,
        collectionService,
        transformationService,
        outputService,
        progressService,
        errorHandler
      );

      // Mock the private method by accessing it through the prototype
      const generateBuildId1 = (command1 as any).generateBuildId();
      const generateBuildId2 = (command2 as any).generateBuildId();

      expect(generateBuildId1).not.toBe(generateBuildId2);
      expect(generateBuildId1).toMatch(/^build-[a-z0-9]+-[a-z0-9]+$/);
    });
  });

  describe('private methods', () => {
    it('should extract hook type from filename correctly', () => {
      const extractHookType = (command as any).extractHookType;

      expect(extractHookType('commit.kiro.hook')).toBe('commit');
      expect(extractHookType('save.kiro.hook')).toBe('save');
      expect(extractHookType('test.kiro.hook')).toBe('test');
      expect(extractHookType('invalid-filename')).toBe('unknown');
    });
  });
});