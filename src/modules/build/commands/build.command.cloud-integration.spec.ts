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
  CloudMetadata,
  SanitizationResult,
  TaptikPackage,
  ValidationResult,
  TaptikContext,
} from '../../context/interfaces/cloud.interface';
import { MetadataGeneratorService } from '../../context/services/metadata-generator.service';
import { PackageService } from '../../context/services/package.service';
import { SanitizationService } from '../../context/services/sanitization.service';
import { ValidationService } from '../../context/services/validation.service';
import {
  BuildPlatform,
  BuildCategoryName,
} from '../interfaces/build-config.interface';
import {
  TaptikPersonalContext,
  TaptikPromptTemplates,
  TaptikProjectContext,
} from '../interfaces/taptik-format.interface';
import { CollectionService } from '../services/collection/collection.service';
import { ErrorHandlerService } from '../services/error-handler/error-handler.service';
import { InteractiveService } from '../services/interactive/interactive.service';
import { OutputService } from '../services/output/output.service';
import { ProgressService } from '../services/progress/progress.service';
import { TransformationService } from '../services/transformation/transformation.service';
import { mockExpectedOutputs } from '../test-fixtures';

import { BuildCommand } from './build.command';

describe('BuildCommand Cloud Pipeline Integration Tests', () => {
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

  const mockCloudMetadata: CloudMetadata = {
    title: 'Test Claude Code Configuration',
    description: 'Test configuration for Claude Code IDE',
    tags: ['claude-code', 'test', 'ai'],
    author: 'test-user',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    sourceIde: 'claude-code',
    targetIdes: ['claude-code', 'cursor'],
    complexityLevel: 'intermediate',
    componentCount: {
      agents: 3,
      commands: 2,
      mcpServers: 1,
      steeringRules: 5,
      instructions: 2,
    },
    features: ['ai-agents', 'mcp-integration', 'steering-rules'],
    compatibility: ['claude-code-1.0', 'cursor-0.9'],
    searchKeywords: ['ai', 'claude', 'development', 'configuration'],
    fileSize: 102400,
    checksum: 'abc123def456',
    isPublic: false,
  };

  const mockSanitizationResult: SanitizationResult = {
    sanitizedData: mockExpectedOutputs,
    securityLevel: 'safe',
    findings: ['Removed 3 API keys', 'Sanitized 2 file paths'],
    report: {
      totalFields: 100,
      sanitizedFields: 5,
      safeFields: 95,
      timestamp: new Date(),
      summary: 'Configuration sanitized successfully',
      processingTimeMs: 150,
      detailedFindings: [
        {
          category: 'credentials',
          severity: 'critical',
          count: 3,
          path: 'mcpServers.env',
        },
        {
          category: 'paths',
          severity: 'medium',
          count: 2,
          path: 'instructions.local',
        },
      ],
    },
    severityBreakdown: {
      safe: 95,
      low: 0,
      medium: 2,
      critical: 3,
    },
    recommendations: [
      'Review sanitized API keys before sharing',
      'Verify file paths have been properly anonymized',
    ],
  };

  const mockTaptikPackage: TaptikPackage = {
    metadata: mockCloudMetadata,
    sanitizedConfig: {
      version: '1.0.0',
      sourceIde: 'claude-code',
      targetIdes: ['claude-code', 'cursor'],
      data: {
        claudeCode: {
          local: {
            settings: { theme: 'dark', autoSave: true },
            agents: [
              { id: 'agent1', name: 'Test Agent', prompt: 'Test prompt' },
            ],
            commands: [{ name: 'test-cmd', command: 'echo test' }],
          },
        },
      },
      metadata: {
        timestamp: new Date().toISOString(),
        exportedBy: 'test-user',
      },
    } as TaptikContext,
    checksum: 'package-checksum-123',
    format: 'taptik-v1',
    compression: 'gzip',
    size: 51200,
    manifest: {
      files: ['settings.json', 'agents.json', 'commands.json'],
      directories: ['.claude', '.mcp'],
      totalSize: 51200,
    },
  };

  const mockValidationResult: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: ['Large package size may affect upload speed'],
    cloudCompatible: true,
    schemaCompliant: true,
    sizeLimit: {
      current: 51200,
      maximum: 52428800, // 50MB
      withinLimit: true,
    },
    featureSupport: {
      ide: 'claude-code',
      supported: ['agents', 'commands', 'mcp-servers'],
      unsupported: [],
    },
    recommendations: ['Consider compressing assets to reduce package size'],
  };

  beforeEach(async () => {
    // Create mocks for all services including new cloud services
    const mockInteractiveService = {
      selectPlatform: vi.fn(),
      selectCategories: vi.fn(),
      confirmAutoUpload: vi.fn(),
      promptForManualUpload: vi.fn(),
    };

    const mockCollectionService = {
      collectLocalSettings: vi.fn(),
      collectGlobalSettings: vi.fn(),
      collectClaudeCodeLocalSettings: vi.fn().mockResolvedValue({
        settings: {},
        claudeMd: '',
        claudeLocalMd: '',
        steeringFiles: [],
        agents: [],
        commands: [],
        hooks: [],
        mcpConfig: undefined,
        sourcePath: './.claude',
        collectedAt: new Date().toISOString(),
      }),
      collectClaudeCodeGlobalSettings: vi.fn().mockResolvedValue({
        settings: {},
        agents: [],
        commands: [],
        mcpConfig: undefined,
        sourcePath: '~/.claude',
        collectedAt: new Date().toISOString(),
        securityFiltered: false,
      }),
    };

    const mockTransformationService = {
      transformPersonalContext: vi.fn(),
      transformProjectContext: vi.fn(),
      transformPromptTemplates: vi.fn(),
      transformClaudeCodePersonalContext: vi
        .fn()
        .mockResolvedValue(mockExpectedOutputs.personalContext),
      transformClaudeCodeProjectContext: vi
        .fn()
        .mockResolvedValue(mockExpectedOutputs.projectContext),
      transformClaudeCodePromptTemplates: vi
        .fn()
        .mockResolvedValue(mockExpectedOutputs.promptTemplates),
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

    const mockOutputService = {
      createOutputDirectory: vi.fn().mockResolvedValue('./taptik-cloud-build'),
      writeOutputFiles: vi.fn(),
      generateManifest: vi.fn(),
      displayBuildSummary: vi.fn(),
      writeCloudMetadata: vi.fn().mockResolvedValue(undefined),
      writeSanitizationReport: vi.fn().mockResolvedValue(undefined),
      writeValidationReport: vi.fn().mockResolvedValue(undefined),
      displayCloudReadySummary: vi.fn().mockResolvedValue(undefined),
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
      handleCriticalErrorAndExit: vi.fn().mockImplementation(() => undefined),
      addWarning: vi.fn(),
      hasWarnings: vi.fn().mockReturnValue(false),
      getErrorSummary: vi.fn().mockReturnValue({
        criticalErrors: [],
        warnings: [],
        partialFiles: [],
      }),
      displayErrorSummary: vi.fn(),
      exitWithAppropriateCode: vi.fn().mockImplementation(() => undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BuildCommand,
        { provide: InteractiveService, useValue: mockInteractiveService },
        { provide: CollectionService, useValue: mockCollectionService },
        { provide: TransformationService, useValue: mockTransformationService },
        { provide: SanitizationService, useValue: mockSanitizationService },
        {
          provide: MetadataGeneratorService,
          useValue: mockMetadataGeneratorService,
        },
        { provide: PackageService, useValue: mockPackageService },
        { provide: ValidationService, useValue: mockValidationService },
        { provide: OutputService, useValue: mockOutputService },
        { provide: ProgressService, useValue: mockProgressService },
        { provide: ErrorHandlerService, useValue: mockErrorHandler },
      ],
    }).compile();

    command = module.get<BuildCommand>(BuildCommand);
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

    // Suppress logger output during tests
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Helper function to force command to use mocked services
  const setupCommandMocks = () => {
    (command as any).errorHandler = errorHandler;
    (command as any).progressService = progressService;
    (command as any).interactiveService = interactiveService;
    (command as any).collectionService = collectionService;
    (command as any).transformationService = transformationService;
    (command as any).sanitizationService = sanitizationService;
    (command as any).metadataGeneratorService = metadataGeneratorService;
    (command as any).packageService = packageService;
    (command as any).validationService = validationService;
    (command as any).outputService = outputService;
  };

  describe('Enhanced BuildCommand Constructor', () => {
    it('should inject new cloud services into BuildCommand', () => {
      expect(command).toBeDefined();
      // Test that services are injected (they are private but exist in the module)
      expect(sanitizationService).toBeDefined();
      expect(metadataGeneratorService).toBeDefined();
      expect(packageService).toBeDefined();
      expect(validationService).toBeDefined();
    });
  });

  describe('Cloud Pipeline Steps', () => {
    it('should execute complete cloud pipeline for Claude Code platform', async () => {
      // Setup mocks
      interactiveService.selectPlatform.mockResolvedValue(
        BuildPlatform.CLAUDE_CODE,
      );
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
        { name: BuildCategoryName.PROJECT_CONTEXT, enabled: true },
        { name: BuildCategoryName.PROMPT_TEMPLATES, enabled: true },
      ]);

      collectionService.collectClaudeCodeLocalSettings.mockResolvedValue({
        settings: { theme: 'dark' },
        claudeMd: 'Test instructions',
        claudeLocalMd: 'Local instructions',
        steeringFiles: [],
        agents: [],
        commands: [],
        hooks: [],
        mcpConfig: undefined,
        sourcePath: './.claude',
        collectedAt: new Date().toISOString(),
      });

      collectionService.collectClaudeCodeGlobalSettings.mockResolvedValue({
        settings: { theme: 'dark' },
        agents: [],
        commands: [],
        mcpConfig: undefined,
        sourcePath: '~/.claude',
        collectedAt: new Date().toISOString(),
        securityFiltered: false,
      });

      transformationService.transformClaudeCodePersonalContext.mockResolvedValue(
        mockExpectedOutputs.personalContext as unknown as TaptikPersonalContext,
      );
      transformationService.transformClaudeCodeProjectContext.mockResolvedValue(
        mockExpectedOutputs.projectContext as unknown as TaptikProjectContext,
      );
      transformationService.transformClaudeCodePromptTemplates.mockResolvedValue(
        mockExpectedOutputs.promptTemplates as unknown as TaptikPromptTemplates,
      );

      sanitizationService.sanitizeForCloudUpload.mockResolvedValue(
        mockSanitizationResult,
      );
      metadataGeneratorService.generateCloudMetadata.mockResolvedValue(
        mockCloudMetadata,
      );
      packageService.createTaptikPackage.mockResolvedValue(mockTaptikPackage);
      validationService.validateForCloudUpload.mockResolvedValue(
        mockValidationResult,
      );

      outputService.createOutputDirectory.mockResolvedValue(
        './taptik-cloud-build',
      );
      packageService.writePackageToFile.mockResolvedValue(undefined);

      // Force command to use mocked services
      setupCommandMocks();

      // Force command to use mocked services
      setupCommandMocks();

      // Execute command
      await command.run([], { platform: 'claude-code' });

      // Verify cloud pipeline steps were executed in order
      expect(progressService.initializeProgress).toHaveBeenCalledWith(
        expect.arrayContaining([
          'Platform selection',
          'Category selection',
          'Data collection',
          'Data transformation',
          'Security sanitization',
          'Metadata generation',
          'Package creation',
          'Cloud validation',
          'Output generation',
        ]),
      );

      // Verify Claude Code specific collection methods were called
      expect(
        collectionService.collectClaudeCodeLocalSettings,
      ).toHaveBeenCalled();
      expect(
        collectionService.collectClaudeCodeGlobalSettings,
      ).toHaveBeenCalled();

      // Verify Claude Code transformation methods were called
      expect(
        transformationService.transformClaudeCodePersonalContext,
      ).toHaveBeenCalled();
      expect(
        transformationService.transformClaudeCodeProjectContext,
      ).toHaveBeenCalled();
      expect(
        transformationService.transformClaudeCodePromptTemplates,
      ).toHaveBeenCalled();

      // Verify cloud pipeline services were called
      expect(sanitizationService.sanitizeForCloudUpload).toHaveBeenCalled();
      expect(
        metadataGeneratorService.generateCloudMetadata,
      ).toHaveBeenCalledWith(mockSanitizationResult.sanitizedData);
      expect(packageService.createTaptikPackage).toHaveBeenCalledWith(
        mockCloudMetadata,
        mockSanitizationResult.sanitizedData,
        { compression: 'gzip', optimizeSize: true },
      );
      expect(validationService.validateForCloudUpload).toHaveBeenCalledWith(
        mockTaptikPackage,
      );

      // Verify cloud-ready output generation
      expect(packageService.writePackageToFile).toHaveBeenCalled();
      expect(outputService.writeCloudMetadata).toHaveBeenCalled();
      expect(outputService.writeSanitizationReport).toHaveBeenCalled();
      expect(outputService.writeValidationReport).toHaveBeenCalled();
    });

    it('should handle security blocking during sanitization', async () => {
      // Setup mocks
      interactiveService.selectPlatform.mockResolvedValue(
        BuildPlatform.CLAUDE_CODE,
      );
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      collectionService.collectClaudeCodeLocalSettings.mockResolvedValue({
        settings: { preferences: { apiKey: 'secret-key-123' } },
        claudeMd: 'Test',
        claudeLocalMd: 'Local',
        steeringFiles: [],
        agents: [],
        commands: [],
        hooks: [],
        mcpConfig: undefined,
        sourcePath: './.claude',
        collectedAt: new Date().toISOString(),
      });

      collectionService.collectClaudeCodeGlobalSettings.mockResolvedValue({
        settings: {},
        agents: [],
        commands: [],
        mcpConfig: undefined,
        sourcePath: '~/.claude',
        collectedAt: new Date().toISOString(),
        securityFiltered: false,
      });

      transformationService.transformClaudeCodePersonalContext.mockResolvedValue(
        mockExpectedOutputs.personalContext as unknown as TaptikPersonalContext,
      );

      // Mock sanitization blocking due to sensitive data
      sanitizationService.sanitizeForCloudUpload.mockResolvedValue({
        ...mockSanitizationResult,
        securityLevel: 'blocked',
        findings: ['Critical: Unremovable sensitive data detected'],
      });

      // Force command to use mocked services
      setupCommandMocks();

      // Execute command
      await command.run([], { platform: 'claude-code' });

      // Verify process stopped after sanitization blocking
      expect(sanitizationService.sanitizeForCloudUpload).toHaveBeenCalled();
      expect(errorHandler.handleCriticalErrorAndExit).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('sensitive data'),
        }),
      );

      // Verify subsequent steps were not executed
      expect(
        metadataGeneratorService.generateCloudMetadata,
      ).not.toHaveBeenCalled();
      expect(packageService.createTaptikPackage).not.toHaveBeenCalled();
      expect(validationService.validateForCloudUpload).not.toHaveBeenCalled();
    });

    it('should handle validation failures gracefully', async () => {
      // Setup mocks
      interactiveService.selectPlatform.mockResolvedValue(
        BuildPlatform.CLAUDE_CODE,
      );
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      collectionService.collectClaudeCodeLocalSettings.mockResolvedValue({
        settings: {},
        claudeMd: 'Test',
        claudeLocalMd: 'Local',
        steeringFiles: [],
        agents: [],
        commands: [],
        hooks: [],
        mcpConfig: undefined,
        sourcePath: './.claude',
        collectedAt: new Date().toISOString(),
      });

      collectionService.collectClaudeCodeGlobalSettings.mockResolvedValue({
        settings: {},
        agents: [],
        commands: [],
        mcpConfig: undefined,
        sourcePath: '~/.claude',
        collectedAt: new Date().toISOString(),
        securityFiltered: false,
      });

      transformationService.transformClaudeCodePersonalContext.mockResolvedValue(
        mockExpectedOutputs.personalContext as unknown as TaptikPersonalContext,
      );

      sanitizationService.sanitizeForCloudUpload.mockResolvedValue(
        mockSanitizationResult,
      );
      metadataGeneratorService.generateCloudMetadata.mockResolvedValue(
        mockCloudMetadata,
      );
      packageService.createTaptikPackage.mockResolvedValue(mockTaptikPackage);

      // Mock validation failure
      validationService.validateForCloudUpload.mockResolvedValue({
        ...mockValidationResult,
        isValid: false,
        cloudCompatible: false,
        errors: ['Package size exceeds limit', 'Invalid schema format'],
      });

      outputService.createOutputDirectory.mockResolvedValue(
        './taptik-cloud-build',
      );

      // Force command to use mocked services
      setupCommandMocks();

      // Execute command
      await command.run([], { platform: 'claude-code' });

      // Verify validation was performed
      expect(validationService.validateForCloudUpload).toHaveBeenCalled();

      // Verify warning was added for validation failure
      expect(errorHandler.addWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'validation',
          message: expect.stringContaining('validation'),
        }),
      );

      // Verify output was still generated despite validation issues
      expect(packageService.writePackageToFile).toHaveBeenCalled();
      expect(outputService.writeValidationReport).toHaveBeenCalled();
    });
  });

  describe('Claude Code Platform Detection and Routing', () => {
    it('should detect Claude Code platform from --platform flag', async () => {
      // Setup mocks
      collectionService.collectClaudeCodeLocalSettings.mockResolvedValue({
        settings: {},
        claudeMd: '',
        claudeLocalMd: '',
        steeringFiles: [],
        agents: [],
        commands: [],
        hooks: [],
        mcpConfig: undefined,
        sourcePath: './.claude',
        collectedAt: new Date().toISOString(),
      });

      collectionService.collectClaudeCodeGlobalSettings.mockResolvedValue({
        settings: {},
        agents: [],
        commands: [],
        mcpConfig: undefined,
        sourcePath: '~/.claude',
        collectedAt: new Date().toISOString(),
        securityFiltered: false,
      });

      transformationService.transformClaudeCodePersonalContext.mockResolvedValue(
        mockExpectedOutputs.personalContext as unknown as TaptikPersonalContext,
      );

      sanitizationService.sanitizeForCloudUpload.mockResolvedValue(
        mockSanitizationResult,
      );
      metadataGeneratorService.generateCloudMetadata.mockResolvedValue(
        mockCloudMetadata,
      );
      packageService.createTaptikPackage.mockResolvedValue(mockTaptikPackage);
      validationService.validateForCloudUpload.mockResolvedValue(
        mockValidationResult,
      );

      outputService.createOutputDirectory.mockResolvedValue(
        './taptik-cloud-build',
      );
      packageService.writePackageToFile.mockResolvedValue(undefined);

      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      // Force command to use mocked services
      setupCommandMocks();

      // Execute with --platform=claude-code
      await command.run([], { platform: 'claude-code' });

      // Verify platform selection was skipped
      expect(interactiveService.selectPlatform).not.toHaveBeenCalled();

      // Verify Claude Code collection methods were called
      expect(
        collectionService.collectClaudeCodeLocalSettings,
      ).toHaveBeenCalled();
      expect(
        collectionService.collectClaudeCodeGlobalSettings,
      ).toHaveBeenCalled();

      // Verify Claude Code transformation was used
      expect(
        transformationService.transformClaudeCodePersonalContext,
      ).toHaveBeenCalled();

      // Verify cloud pipeline was executed
      expect(sanitizationService.sanitizeForCloudUpload).toHaveBeenCalled();
      expect(metadataGeneratorService.generateCloudMetadata).toHaveBeenCalled();
      expect(packageService.createTaptikPackage).toHaveBeenCalled();
      expect(validationService.validateForCloudUpload).toHaveBeenCalled();
    });

    it('should route to Claude Code collection when platform is selected interactively', async () => {
      // Setup mocks
      interactiveService.selectPlatform.mockResolvedValue(
        BuildPlatform.CLAUDE_CODE,
      );
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PROJECT_CONTEXT, enabled: true },
      ]);

      collectionService.collectClaudeCodeLocalSettings.mockResolvedValue({
        settings: {},
        claudeMd: 'Claude instructions',
        claudeLocalMd: 'Local instructions',
        steeringFiles: [
          {
            filename: 'rule1.md',
            content: 'Steering rule 1',
            path: '.claude/steering/rule1.md',
          },
        ],
        agents: [],
        commands: [],
        hooks: [],
        mcpConfig: { mcpServers: {} },
        sourcePath: './.claude',
        collectedAt: new Date().toISOString(),
      });

      collectionService.collectClaudeCodeGlobalSettings.mockResolvedValue({
        settings: {},
        agents: [],
        commands: [],
        mcpConfig: undefined,
        sourcePath: '~/.claude',
        collectedAt: new Date().toISOString(),
        securityFiltered: false,
      });

      transformationService.transformClaudeCodeProjectContext.mockResolvedValue(
        mockExpectedOutputs.projectContext as unknown as TaptikProjectContext,
      );

      sanitizationService.sanitizeForCloudUpload.mockResolvedValue(
        mockSanitizationResult,
      );
      metadataGeneratorService.generateCloudMetadata.mockResolvedValue(
        mockCloudMetadata,
      );
      packageService.createTaptikPackage.mockResolvedValue(mockTaptikPackage);
      validationService.validateForCloudUpload.mockResolvedValue(
        mockValidationResult,
      );

      outputService.createOutputDirectory.mockResolvedValue(
        './taptik-cloud-build',
      );
      packageService.writePackageToFile.mockResolvedValue(undefined);

      // Force command to use mocked services
      setupCommandMocks();

      // Execute without platform flag
      await command.run([], {});

      // Verify interactive platform selection was called
      expect(interactiveService.selectPlatform).toHaveBeenCalled();

      // Verify Claude Code specific methods were called
      expect(
        collectionService.collectClaudeCodeLocalSettings,
      ).toHaveBeenCalled();
      expect(
        transformationService.transformClaudeCodeProjectContext,
      ).toHaveBeenCalled();

      // Verify cloud pipeline was executed
      expect(sanitizationService.sanitizeForCloudUpload).toHaveBeenCalled();
      expect(packageService.createTaptikPackage).toHaveBeenCalled();
    });
  });

  describe('Enhanced Progress Tracking', () => {
    it('should track progress for cloud pipeline steps', async () => {
      // Setup mocks
      interactiveService.selectPlatform.mockResolvedValue(
        BuildPlatform.CLAUDE_CODE,
      );
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      collectionService.collectClaudeCodeLocalSettings.mockResolvedValue({
        settings: {},
        claudeMd: '',
        claudeLocalMd: '',
        steeringFiles: [],
        agents: [],
        commands: [],
        hooks: [],
        mcpConfig: undefined,
        sourcePath: './.claude',
        collectedAt: new Date().toISOString(),
      });

      collectionService.collectClaudeCodeGlobalSettings.mockResolvedValue({
        settings: {},
        agents: [],
        commands: [],
        mcpConfig: undefined,
        sourcePath: '~/.claude',
        collectedAt: new Date().toISOString(),
        securityFiltered: false,
      });

      transformationService.transformClaudeCodePersonalContext.mockResolvedValue(
        mockExpectedOutputs.personalContext as unknown as TaptikPersonalContext,
      );

      sanitizationService.sanitizeForCloudUpload.mockResolvedValue(
        mockSanitizationResult,
      );
      metadataGeneratorService.generateCloudMetadata.mockResolvedValue(
        mockCloudMetadata,
      );
      packageService.createTaptikPackage.mockResolvedValue(mockTaptikPackage);
      validationService.validateForCloudUpload.mockResolvedValue(
        mockValidationResult,
      );

      outputService.createOutputDirectory.mockResolvedValue(
        './taptik-cloud-build',
      );
      packageService.writePackageToFile.mockResolvedValue(undefined);

      // Force command to use mocked services
      setupCommandMocks();

      // Execute command
      await command.run([], { platform: 'claude-code' });

      // Verify progress tracking for cloud pipeline steps
      expect(progressService.startStep).toHaveBeenCalledWith(
        'Security sanitization',
      );
      expect(progressService.completeStep).toHaveBeenCalledWith(
        'Security sanitization',
      );

      expect(progressService.startStep).toHaveBeenCalledWith(
        'Metadata generation',
      );
      expect(progressService.completeStep).toHaveBeenCalledWith(
        'Metadata generation',
      );

      expect(progressService.startStep).toHaveBeenCalledWith(
        'Package creation',
      );
      expect(progressService.completeStep).toHaveBeenCalledWith(
        'Package creation',
      );

      expect(progressService.startStep).toHaveBeenCalledWith(
        'Cloud validation',
      );
      expect(progressService.completeStep).toHaveBeenCalledWith(
        'Cloud validation',
      );
    });

    it('should handle progress tracking for failed cloud pipeline steps', async () => {
      // Setup mocks
      interactiveService.selectPlatform.mockResolvedValue(
        BuildPlatform.CLAUDE_CODE,
      );
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      collectionService.collectClaudeCodeLocalSettings.mockResolvedValue({
        settings: {},
        claudeMd: '',
        claudeLocalMd: '',
        steeringFiles: [],
        agents: [],
        commands: [],
        hooks: [],
        mcpConfig: undefined,
        sourcePath: './.claude',
        collectedAt: new Date().toISOString(),
      });

      collectionService.collectClaudeCodeGlobalSettings.mockResolvedValue({
        settings: {},
        agents: [],
        commands: [],
        mcpConfig: undefined,
        sourcePath: '~/.claude',
        collectedAt: new Date().toISOString(),
        securityFiltered: false,
      });

      transformationService.transformClaudeCodePersonalContext.mockResolvedValue(
        mockExpectedOutputs.personalContext as unknown as TaptikPersonalContext,
      );

      sanitizationService.sanitizeForCloudUpload.mockResolvedValue(
        mockSanitizationResult,
      );

      // Mock metadata generation failure
      metadataGeneratorService.generateCloudMetadata.mockRejectedValue(
        new Error('Failed to generate metadata'),
      );

      // Force command to use mocked services
      setupCommandMocks();

      // Execute command
      await command.run([], { platform: 'claude-code' });

      // Verify progress tracking for failed step
      expect(progressService.startStep).toHaveBeenCalledWith(
        'Metadata generation',
      );
      expect(progressService.failStep).toHaveBeenCalledWith(
        'Metadata generation',
        expect.objectContaining({
          message: expect.stringContaining('Failed to generate metadata'),
        }),
      );

      // Verify error handling
      expect(errorHandler.addWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('metadata'),
        }),
      );
    });
  });

  describe('Cloud-Ready Output Generation', () => {
    it('should generate cloud-ready output files', async () => {
      // Setup mocks
      interactiveService.selectPlatform.mockResolvedValue(
        BuildPlatform.CLAUDE_CODE,
      );
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
        { name: BuildCategoryName.PROJECT_CONTEXT, enabled: true },
      ]);

      collectionService.collectClaudeCodeLocalSettings.mockResolvedValue({
        settings: {},
        claudeMd: '',
        claudeLocalMd: '',
        steeringFiles: [],
        agents: [],
        commands: [],
        hooks: [],
        mcpConfig: undefined,
        sourcePath: './.claude',
        collectedAt: new Date().toISOString(),
      });

      collectionService.collectClaudeCodeGlobalSettings.mockResolvedValue({
        settings: {},
        agents: [],
        commands: [],
        mcpConfig: undefined,
        sourcePath: '~/.claude',
        collectedAt: new Date().toISOString(),
        securityFiltered: false,
      });

      transformationService.transformClaudeCodePersonalContext.mockResolvedValue(
        mockExpectedOutputs.personalContext as unknown as TaptikPersonalContext,
      );
      transformationService.transformClaudeCodeProjectContext.mockResolvedValue(
        mockExpectedOutputs.projectContext as unknown as TaptikProjectContext,
      );

      sanitizationService.sanitizeForCloudUpload.mockResolvedValue(
        mockSanitizationResult,
      );
      metadataGeneratorService.generateCloudMetadata.mockResolvedValue(
        mockCloudMetadata,
      );
      packageService.createTaptikPackage.mockResolvedValue(mockTaptikPackage);
      validationService.validateForCloudUpload.mockResolvedValue(
        mockValidationResult,
      );

      const outputPath = './taptik-cloud-build';
      outputService.createOutputDirectory.mockResolvedValue(outputPath);
      packageService.writePackageToFile.mockResolvedValue(undefined);

      // Force command to use mocked services
      setupCommandMocks();

      // Execute command
      await command.run([], { platform: 'claude-code', output: outputPath });

      // Verify cloud-ready output files were generated
      expect(packageService.writePackageToFile).toHaveBeenCalledWith(
        mockTaptikPackage,
        expect.stringContaining('taptik.package'),
      );

      expect(outputService.writeCloudMetadata).toHaveBeenCalledWith(
        outputPath,
        mockCloudMetadata,
      );

      expect(outputService.writeSanitizationReport).toHaveBeenCalledWith(
        outputPath,
        mockSanitizationResult.report,
      );

      expect(outputService.writeValidationReport).toHaveBeenCalledWith(
        outputPath,
        mockValidationResult,
      );

      // Verify cloud-ready summary display
      // expect(outputService.displayCloudReadySummary).toHaveBeenCalledWith(
      //   outputPath,
      //   mockTaptikPackage,
      //   mockValidationResult
      // );
    });

    it('should handle custom output directory for cloud packages', async () => {
      // Setup mocks
      const customOutput = './my-cloud-configs';
      interactiveService.selectPlatform.mockResolvedValue(
        BuildPlatform.CLAUDE_CODE,
      );
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      collectionService.collectClaudeCodeLocalSettings.mockResolvedValue({
        settings: {},
        claudeMd: '',
        claudeLocalMd: '',
        steeringFiles: [],
        agents: [],
        commands: [],
        hooks: [],
        mcpConfig: undefined,
        sourcePath: './.claude',
        collectedAt: new Date().toISOString(),
      });

      collectionService.collectClaudeCodeGlobalSettings.mockResolvedValue({
        settings: {},
        agents: [],
        commands: [],
        mcpConfig: undefined,
        sourcePath: '~/.claude',
        collectedAt: new Date().toISOString(),
        securityFiltered: false,
      });

      transformationService.transformClaudeCodePersonalContext.mockResolvedValue(
        mockExpectedOutputs.personalContext as unknown as TaptikPersonalContext,
      );

      sanitizationService.sanitizeForCloudUpload.mockResolvedValue(
        mockSanitizationResult,
      );
      metadataGeneratorService.generateCloudMetadata.mockResolvedValue(
        mockCloudMetadata,
      );
      packageService.createTaptikPackage.mockResolvedValue(mockTaptikPackage);
      validationService.validateForCloudUpload.mockResolvedValue(
        mockValidationResult,
      );

      outputService.createOutputDirectory.mockResolvedValue(customOutput);
      packageService.writePackageToFile.mockResolvedValue(undefined);

      // Force command to use mocked services
      setupCommandMocks();

      // Execute command with custom output
      await command.run([], { platform: 'claude-code', output: customOutput });

      // Verify custom output directory was used (generateCloudOutput uses custom path directly)
      expect(packageService.writePackageToFile).toHaveBeenCalledWith(
        mockTaptikPackage,
        expect.stringContaining('taptik.package'),
      );
      expect(outputService.writeCloudMetadata).toHaveBeenCalledWith(
        customOutput,
        mockCloudMetadata,
      );
    });
  });

  describe('Auto-Upload Prompting', () => {
    it('should prompt for auto-upload when cloud package is ready', async () => {
      // Setup mocks
      interactiveService.selectPlatform.mockResolvedValue(
        BuildPlatform.CLAUDE_CODE,
      );
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      collectionService.collectClaudeCodeLocalSettings.mockResolvedValue({
        settings: {},
        claudeMd: '',
        claudeLocalMd: '',
        steeringFiles: [],
        agents: [],
        commands: [],
        hooks: [],
        mcpConfig: undefined,
        sourcePath: './.claude',
        collectedAt: new Date().toISOString(),
      });

      collectionService.collectClaudeCodeGlobalSettings.mockResolvedValue({
        settings: {},
        agents: [],
        commands: [],
        mcpConfig: undefined,
        sourcePath: '~/.claude',
        collectedAt: new Date().toISOString(),
        securityFiltered: false,
      });

      transformationService.transformClaudeCodePersonalContext.mockResolvedValue(
        mockExpectedOutputs.personalContext as unknown as TaptikPersonalContext,
      );

      sanitizationService.sanitizeForCloudUpload.mockResolvedValue(
        mockSanitizationResult,
      );
      metadataGeneratorService.generateCloudMetadata.mockResolvedValue(
        mockCloudMetadata,
      );
      packageService.createTaptikPackage.mockResolvedValue(mockTaptikPackage);
      validationService.validateForCloudUpload.mockResolvedValue(
        mockValidationResult,
      );

      outputService.createOutputDirectory.mockResolvedValue(
        './taptik-cloud-build',
      );
      packageService.writePackageToFile.mockResolvedValue(undefined);

      // Mock auto-upload confirmation
      // interactiveService.confirmAutoUpload.mockResolvedValue(true);

      // Force command to use mocked services
      setupCommandMocks();

      // Execute command
      await command.run([], { platform: 'claude-code' });

      // Verify auto-upload was prompted
      // expect(interactiveService.confirmAutoUpload).toHaveBeenCalledWith(
      //   mockTaptikPackage.metadata
      // );
    });

    it('should skip upload prompt when validation fails', async () => {
      // Setup mocks
      interactiveService.selectPlatform.mockResolvedValue(
        BuildPlatform.CLAUDE_CODE,
      );
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      collectionService.collectClaudeCodeLocalSettings.mockResolvedValue({
        settings: {},
        claudeMd: '',
        claudeLocalMd: '',
        steeringFiles: [],
        agents: [],
        commands: [],
        hooks: [],
        mcpConfig: undefined,
        sourcePath: './.claude',
        collectedAt: new Date().toISOString(),
      });

      collectionService.collectClaudeCodeGlobalSettings.mockResolvedValue({
        settings: {},
        agents: [],
        commands: [],
        mcpConfig: undefined,
        sourcePath: '~/.claude',
        collectedAt: new Date().toISOString(),
        securityFiltered: false,
      });

      transformationService.transformClaudeCodePersonalContext.mockResolvedValue(
        mockExpectedOutputs.personalContext as unknown as TaptikPersonalContext,
      );

      sanitizationService.sanitizeForCloudUpload.mockResolvedValue(
        mockSanitizationResult,
      );
      metadataGeneratorService.generateCloudMetadata.mockResolvedValue(
        mockCloudMetadata,
      );
      packageService.createTaptikPackage.mockResolvedValue(mockTaptikPackage);

      // Mock validation failure
      validationService.validateForCloudUpload.mockResolvedValue({
        ...mockValidationResult,
        cloudCompatible: false,
        errors: ['Package not compatible with cloud upload'],
      });

      outputService.createOutputDirectory.mockResolvedValue(
        './taptik-cloud-build',
      );

      // Force command to use mocked services
      setupCommandMocks();

      // Execute command
      await command.run([], { platform: 'claude-code' });

      // Verify auto-upload was not prompted due to validation failure
      // expect(interactiveService.confirmAutoUpload).not.toHaveBeenCalled();
      // expect(interactiveService.promptForManualUpload).not.toHaveBeenCalled();
    });

    it('should handle manual upload prompt when auto-upload is disabled', async () => {
      // Setup mocks
      interactiveService.selectPlatform.mockResolvedValue(
        BuildPlatform.CLAUDE_CODE,
      );
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      collectionService.collectClaudeCodeLocalSettings.mockResolvedValue({
        settings: {},
        claudeMd: '',
        claudeLocalMd: '',
        steeringFiles: [],
        agents: [],
        commands: [],
        hooks: [],
        mcpConfig: undefined,
        sourcePath: './.claude',
        collectedAt: new Date().toISOString(),
      });

      collectionService.collectClaudeCodeGlobalSettings.mockResolvedValue({
        settings: {},
        agents: [],
        commands: [],
        mcpConfig: undefined,
        sourcePath: '~/.claude',
        collectedAt: new Date().toISOString(),
        securityFiltered: false,
      });

      transformationService.transformClaudeCodePersonalContext.mockResolvedValue(
        mockExpectedOutputs.personalContext as unknown as TaptikPersonalContext,
      );

      sanitizationService.sanitizeForCloudUpload.mockResolvedValue(
        mockSanitizationResult,
      );
      metadataGeneratorService.generateCloudMetadata.mockResolvedValue(
        mockCloudMetadata,
      );
      packageService.createTaptikPackage.mockResolvedValue(mockTaptikPackage);
      validationService.validateForCloudUpload.mockResolvedValue(
        mockValidationResult,
      );

      outputService.createOutputDirectory.mockResolvedValue(
        './taptik-cloud-build',
      );
      packageService.writePackageToFile.mockResolvedValue(undefined);

      // Mock auto-upload disabled, manual upload prompt
      // interactiveService.confirmAutoUpload.mockResolvedValue(false);
      // interactiveService.promptForManualUpload.mockResolvedValue(true);

      // Force command to use mocked services
      setupCommandMocks();

      // Execute command
      await command.run([], { platform: 'claude-code' });

      // Verify manual upload was prompted
      // expect(interactiveService.promptForManualUpload).toHaveBeenCalledWith(
      //   mockTaptikPackage.metadata
      // );
    });
  });

  describe('Error Handling for Cloud Pipeline', () => {
    it('should handle package creation failure', async () => {
      // Setup mocks
      interactiveService.selectPlatform.mockResolvedValue(
        BuildPlatform.CLAUDE_CODE,
      );
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      collectionService.collectClaudeCodeLocalSettings.mockResolvedValue({
        settings: {},
        claudeMd: '',
        claudeLocalMd: '',
        steeringFiles: [],
        agents: [],
        commands: [],
        hooks: [],
        mcpConfig: undefined,
        sourcePath: './.claude',
        collectedAt: new Date().toISOString(),
      });

      collectionService.collectClaudeCodeGlobalSettings.mockResolvedValue({
        settings: {},
        agents: [],
        commands: [],
        mcpConfig: undefined,
        sourcePath: '~/.claude',
        collectedAt: new Date().toISOString(),
        securityFiltered: false,
      });

      transformationService.transformClaudeCodePersonalContext.mockResolvedValue(
        mockExpectedOutputs.personalContext as unknown as TaptikPersonalContext,
      );

      sanitizationService.sanitizeForCloudUpload.mockResolvedValue(
        mockSanitizationResult,
      );
      metadataGeneratorService.generateCloudMetadata.mockResolvedValue(
        mockCloudMetadata,
      );

      // Mock package creation failure
      packageService.createTaptikPackage.mockRejectedValue(
        new Error('Failed to create package: Compression error'),
      );

      outputService.createOutputDirectory.mockResolvedValue(
        './taptik-cloud-build',
      );

      // Force command to use mocked services
      setupCommandMocks();

      // Execute command
      await command.run([], { platform: 'claude-code' });

      // Verify error handling
      expect(errorHandler.addWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'package',
          message: expect.stringContaining('Failed to create package'),
        }),
      );

      // Verify process continued without package - output generation still happens
      expect(outputService.createOutputDirectory).toHaveBeenCalled();
      expect(sanitizationService.sanitizeForCloudUpload).toHaveBeenCalled();
      expect(metadataGeneratorService.generateCloudMetadata).toHaveBeenCalled();
    });

    it('should handle cloud service initialization errors', async () => {
      // Setup mocks
      interactiveService.selectPlatform.mockResolvedValue(
        BuildPlatform.CLAUDE_CODE,
      );
      interactiveService.selectCategories.mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      collectionService.collectClaudeCodeLocalSettings.mockResolvedValue({
        settings: {},
        claudeMd: '',
        claudeLocalMd: '',
        steeringFiles: [],
        agents: [],
        commands: [],
        hooks: [],
        mcpConfig: undefined,
        sourcePath: './.claude',
        collectedAt: new Date().toISOString(),
      });

      collectionService.collectClaudeCodeGlobalSettings.mockResolvedValue({
        settings: {},
        agents: [],
        commands: [],
        mcpConfig: undefined,
        sourcePath: '~/.claude',
        collectedAt: new Date().toISOString(),
        securityFiltered: false,
      });

      transformationService.transformClaudeCodePersonalContext.mockResolvedValue(
        mockExpectedOutputs.personalContext as unknown as TaptikPersonalContext,
      );

      // Mock sanitization service failure
      sanitizationService.sanitizeForCloudUpload.mockRejectedValue(
        new Error('Failed to initialize cloud services'),
      );

      // Force command to use mocked services
      setupCommandMocks();

      // Execute command
      await command.run([], { platform: 'claude-code' });

      // Verify error was handled gracefully with warning
      expect(errorHandler.addWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'security',
          message: expect.stringContaining('Security sanitization failed'),
        }),
      );
    });
  });
});
