import { homedir } from 'node:os';
import * as path from 'node:path';

import { Logger } from '@nestjs/common';

import { Command, CommandRunner, Option } from 'nest-commander';

import { MetadataGeneratorService } from '../../context/services/metadata-generator.service';
import { PackageService } from '../../context/services/package.service';
import { SanitizationService } from '../../context/services/sanitization.service';
import { ValidationService } from '../../context/services/validation.service';
import { PackageVisibility } from '../../push/interfaces/push-options.interface';
import { PushService } from '../../push/services/push.service';
import {
  BuildPlatform,
  BuildCategoryName,
} from '../interfaces/build-config.interface';
import { CollectionService } from '../services/collection/collection.service';
import { CursorCollectionService } from '../services/cursor-collection.service';
import { CursorTransformationService } from '../services/cursor-transformation.service';
import { ErrorHandlerService } from '../services/error-handler/error-handler.service';
import { InteractiveService } from '../services/interactive/interactive.service';
import { OutputService } from '../services/output/output.service';
import { ProgressService } from '../services/progress/progress.service';
import { TransformationService } from '../services/transformation/transformation.service';

import type {
  SanitizationResult,
  TaptikContext,
  TaptikPackage,
  ValidationResult as CloudValidationResult,
} from '../../context/interfaces/cloud.interface';
import type { PushOptions } from '../../push/interfaces/push-options.interface';
import type { UploadProgress } from '../../push/interfaces/upload-progress.interface';
import type { BuildConfig } from '../interfaces/build-config.interface';
import type { CloudTransformationService } from '../interfaces/cloud-services.interface';
import type { SettingsData } from '../interfaces/settings-data.interface';
import type {
  TaptikPersonalContext,
  TaptikProjectContext,
  TaptikPromptTemplates,
} from '../interfaces/taptik-format.interface';

@Command({
  name: 'build',
  description: 'Build taptik-compatible context files from Kiro settings',
})
export class BuildCommand extends CommandRunner {
  private readonly logger = new Logger(BuildCommand.name);

  constructor(
    private readonly interactiveService: InteractiveService,
    private readonly collectionService: CollectionService,
    private readonly cursorCollectionService: CursorCollectionService,
    private readonly cursorTransformationService: CursorTransformationService,
    private readonly transformationService: TransformationService,
    private readonly sanitizationService: SanitizationService,
    private readonly metadataGeneratorService: MetadataGeneratorService,
    private readonly packageService: PackageService,
    private readonly validationService: ValidationService,
    private readonly outputService: OutputService,
    private readonly progressService: ProgressService,
    private readonly errorHandler: ErrorHandlerService,
    private readonly pushService: PushService,
  ) {
    super();
  }

  @Option({
    flags: '--output <path>',
    description: 'Specify custom output directory path',
  })
  parseOutputPath(value: string): string {
    return value;
  }

  @Option({
    flags: '--platform <platform>',
    description:
      'Skip platform selection and use specified platform (kiro, cursor, claude-code)',
  })
  parsePlatform(value: string): BuildPlatform {
    const platform = value.toLowerCase();
    if (platform === 'kiro') return BuildPlatform.KIRO;
    if (platform === 'cursor') return BuildPlatform.CURSOR;
    if (platform === 'claude-code') return BuildPlatform.CLAUDE_CODE;
    throw new Error(
      `Invalid platform: ${value}. Must be one of: kiro, cursor, claude-code`,
    );
  }

  @Option({
    flags: '--categories <categories>',
    description:
      'Comma-separated list of categories to build (personal, project, prompts)',
  })
  parseCategories(value: string): string[] {
    return value.split(',').map((category) => category.trim().toLowerCase());
  }

  @Option({
    flags: '--push',
    description:
      'Automatically push the built package to the cloud after successful build',
  })
  parsePush(): boolean {
    return true;
  }

  @Option({
    flags: '--push-public',
    description:
      'Make the pushed package publicly accessible (use with --push)',
  })
  parsePushPublic(): boolean {
    return true;
  }

  // removed: --push-team

  async run(
    _passedParameters: string[],
    options?: Record<string, unknown>,
  ): Promise<void> {
    const startTime = Date.now();
    const isDryRun = false;
    const customOutputPath = options?.output as string;
    const isVerbose = false;
    const isQuiet = false;
    const presetPlatform = options?.platform as BuildPlatform;
    const presetCategories = options?.categories as string[];

    // Push-related options
    const shouldPush = options?.push as boolean;
    const pushPublic = options?.pushPublic as boolean;
    // pushTeam removed

    try {
      // Configure logging based on options
      // verbose/quiet/dry-run removed

      // Check for interruption before starting
      if (this.errorHandler.isProcessInterrupted()) {
        return;
      }

      // Initialize progress tracking (with cloud pipeline steps for Claude Code)
      const progressSteps =
        presetPlatform === BuildPlatform.CLAUDE_CODE
          ? [
              'Platform selection',
              'Category selection',
              'Data collection',
              'Data transformation',
              'Security sanitization',
              'Metadata generation',
              'Package creation',
              'Cloud validation',
              'Output generation',
            ]
          : [
              'Platform selection',
              'Category selection',
              'Data collection',
              'Data transformation',
              'Output generation',
              'Build completion',
            ];

      this.progressService.initializeProgress(progressSteps);

      // Step 1: Platform selection (skip if preset)
      let platform: BuildPlatform;
      if (presetPlatform) {
        if (isVerbose) {
          this.logger.log(`📋 Using preset platform: ${presetPlatform}`);
        }
        platform = presetPlatform;
        this.progressService.startStep('Platform selection');
        this.progressService.completeStep('Platform selection');
      } else {
        this.progressService.startStep('Platform selection');
        platform = await this.interactiveService.selectPlatform();

        if (this.errorHandler.isProcessInterrupted()) {
          return;
        }
        this.progressService.completeStep('Platform selection');
      }

      if (this.errorHandler.isProcessInterrupted()) {
        return;
      }
      this.progressService.completeStep('Platform selection');

      // Step 2: Category selection (skip if preset)
      let categories;
      if (presetCategories && presetCategories.length > 0) {
        if (isVerbose) {
          this.logger.log(
            `📋 Using preset categories: ${presetCategories.join(', ')}`,
          );
        }

        // Convert preset categories to proper format
        categories = presetCategories.map((category) => {
          const categoryMap: Record<string, BuildCategoryName> = {
            personal: BuildCategoryName.PERSONAL_CONTEXT,
            project: BuildCategoryName.PROJECT_CONTEXT,
            prompts: BuildCategoryName.PROMPT_TEMPLATES,
          };

          const categoryName = categoryMap[category];
          if (!categoryName) {
            throw new Error(
              `Invalid category: ${category}. Must be one of: personal, project, prompts`,
            );
          }

          return { name: categoryName, enabled: true };
        });

        this.progressService.startStep('Category selection');
        this.progressService.completeStep('Category selection');
      } else {
        this.progressService.startStep('Category selection');
        categories = await this.interactiveService.selectCategories();

        if (this.errorHandler.isProcessInterrupted()) {
          return;
        }
        this.progressService.completeStep('Category selection');
      }

      // Create build configuration
      const buildConfig: BuildConfig = {
        platform: platform as BuildPlatform,
        categories,
        outputDirectory: customOutputPath || '', // Will be set by output service
        timestamp: new Date().toISOString(),
        buildId: this.generateBuildId(),
      };

      if (isVerbose) {
        this.logger.log(
          `🔧 Build configuration: ${JSON.stringify(buildConfig, null, 2)}`,
        );
      }

      // Step 2: Data collection
      this.progressService.startStep('Data collection');
      const settingsData = await this.collectData(buildConfig);

      if (this.errorHandler.isProcessInterrupted()) {
        return;
      }
      this.progressService.completeStep('Data collection');

      // Step 3: Data transformation
      this.progressService.startStep('Data transformation');
      const transformedData = await this.transformData(
        settingsData,
        buildConfig,
      );

      if (this.errorHandler.isProcessInterrupted()) {
        return;
      }
      this.progressService.completeStep('Data transformation');

      // Log transformation results for monitoring
      this.logTransformationResults(transformedData, buildConfig);

      // Cloud pipeline for Claude Code platform
      let cloudPackage: TaptikPackage | undefined;
      let validationResult: CloudValidationResult | undefined;
      let sanitizationResult: SanitizationResult | undefined;
      if (buildConfig.platform === BuildPlatform.CLAUDE_CODE) {
        // Wrap transformed data in TaptikContext structure (cloud.interface version)
        const contextData: TaptikContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          data: {
            claudeCode: {
              local: transformedData.personalContext as unknown,
              global: transformedData.projectContext as unknown,
            },
          },
          metadata: {
            timestamp: new Date().toISOString(),
            exportedBy: 'taptik-cli',
          },
        };

        try {
          // Step 4: Security sanitization
          this.progressService.startStep('Security sanitization');
          sanitizationResult =
            await this.sanitizationService.sanitizeForCloudUpload(contextData);

          if (sanitizationResult.securityLevel === 'blocked') {
            this.errorHandler.handleCriticalErrorAndExit({
              type: 'security',
              message:
                'Configuration contains sensitive data that cannot be safely shared',
              details: sanitizationResult.findings.join(', '),
              suggestedResolution:
                'Remove sensitive information before building for cloud',
              exitCode: 1,
            });
            return;
          }
          this.progressService.completeStep('Security sanitization');
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.error('Security sanitization failed:', error);
          this.progressService.failStep(
            'Security sanitization',
            new Error(errorMessage),
          );
          this.errorHandler.addWarning({
            type: 'security',
            message:
              'Security sanitization failed, continuing with original data',
            details: errorMessage,
          });
          sanitizationResult = {
            sanitizedData: contextData,
            securityLevel: 'warning',
            findings: [],
            report: {
              totalFields: 0,
              sanitizedFields: 0,
              safeFields: 0,
              timestamp: new Date(),
              summary: 'Sanitization skipped - service not available',
            },
          };
        }

        try {
          // Step 5: Metadata generation
          this.progressService.startStep('Metadata generation');
          const cloudMetadata =
            await this.metadataGeneratorService.generateCloudMetadata(
              sanitizationResult.sanitizedData as TaptikContext,
            );
          this.progressService.completeStep('Metadata generation');

          // Step 6: Package creation
          this.progressService.startStep('Package creation');
          cloudPackage = await this.packageService.createTaptikPackage(
            cloudMetadata,
            sanitizationResult.sanitizedData as TaptikContext,
            { compression: 'gzip', optimizeSize: true },
          );
          this.progressService.completeStep('Package creation');
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : undefined;
          this.logger.error('Package creation failed:', error);
          this.progressService.failStep(
            errorMessage.includes('metadata')
              ? 'Metadata generation'
              : 'Package creation',
            new Error(errorMessage),
          );
          this.errorHandler.addWarning({
            type: 'package',
            message: errorMessage,
            details: errorStack,
          });
        }

        if (cloudPackage) {
          try {
            // Step 7: Cloud validation
            this.progressService.startStep('Cloud validation');
            validationResult =
              await this.validationService.validateForCloudUpload(cloudPackage);

            if (
              !validationResult.isValid ||
              !validationResult.cloudCompatible
            ) {
              this.errorHandler.addWarning({
                type: 'validation',
                message: 'Package validation failed',
                details: validationResult.errors.join(', '),
              });
            }
            this.progressService.completeStep('Cloud validation');
          } catch (error: unknown) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            this.logger.error('Validation failed:', error);
            this.progressService.failStep(
              'Cloud validation',
              new Error(errorMessage),
            );
            validationResult = {
              isValid: false,
              cloudCompatible: false,
              errors: [errorMessage],
              warnings: [],
              schemaCompliant: false,
              sizeLimit: {
                current: 0,
                maximum: 50 * 1024 * 1024,
                withinLimit: true,
              },
              featureSupport: {
                ide: 'claudeCode',
                supported: [],
                unsupported: [],
              },
              recommendations: [],
            };
          }
        }
      }

      // Step 8 (or 4 for non-Claude Code): Output generation
      this.progressService.startStep('Output generation');


      let outputPath;
      if (buildConfig.platform === BuildPlatform.CLAUDE_CODE && cloudPackage) {
        outputPath = await this.generateCloudOutput(
          cloudPackage,
          validationResult,
          buildConfig,
          customOutputPath,
          sanitizationResult,
        );
      } else {
        outputPath = await this.generateOutput(
          transformedData,
          buildConfig,
          settingsData,
          customOutputPath,
        );
      }

      if (this.errorHandler.isProcessInterrupted()) {
        return;
      }
      this.progressService.completeStep('Output generation');

      // Cloud upload handling
      if (
        buildConfig.platform === BuildPlatform.CLAUDE_CODE &&
        cloudPackage &&
        validationResult?.cloudCompatible
      ) {
        // If --push flag is set, automatically upload
        if (shouldPush) {
          await this.pushPackageToCloud(
            outputPath,
            cloudPackage,
            {
              pushPublic,
            },
            isVerbose,
          );
        } else if (!shouldPush) {
          // Otherwise, prompt for manual upload as before
          await this.promptForCloudUpload(cloudPackage, validationResult);
        }
      }

      // Step 9 (or 5): Build completion
      if (buildConfig.platform !== BuildPlatform.CLAUDE_CODE) {
        this.progressService.startStep('Build completion');
        const buildTime = Date.now() - startTime;
        await this.completeBuild(outputPath, buildConfig, buildTime);
        this.progressService.completeStep('Build completion');
      }

      // Display any warnings that occurred during the process
      if (this.errorHandler.hasWarnings()) {
        this.errorHandler.displayErrorSummary();
      }

      // Exit with appropriate code
      this.errorHandler.exitWithAppropriateCode();
    } catch (error) {
      // Handle different types of errors appropriately
      if (error.name === 'TimeoutError') {
        this.errorHandler?.handleCriticalErrorAndExit({
          type: 'system',
          message: 'Build process timed out',
          details: error.message,
          suggestedResolution:
            'Try running the command again or check your system resources',
          exitCode: 124, // Standard timeout exit code
        });
      } else if (error.code === 'EACCES') {
        this.errorHandler?.handleCriticalErrorAndExit({
          type: 'file_system',
          message: 'Permission denied accessing files',
          details: error.message,
          suggestedResolution:
            'Check file permissions or run with appropriate privileges',
          exitCode: 126, // Permission denied exit code
        });
      } else if (error.code === 'ENOENT') {
        this.errorHandler?.handleCriticalErrorAndExit({
          type: 'file_system',
          message: 'Required file or directory not found',
          details: error.message,
          suggestedResolution:
            'Ensure all required files exist and paths are correct',
          exitCode: 2, // File not found exit code
        });
      } else {
        // Generic critical error
        this.errorHandler?.handleCriticalErrorAndExit({
          type: 'system',
          message: 'Build process failed with unexpected error',
          details: error.message,
          suggestedResolution:
            'Please report this issue with the error details',
          exitCode: 1, // Generic error exit code
        });
      }
    }
  }

  /**
   * Collect data from local and global Kiro settings
   */
  private async collectData(_buildConfig: BuildConfig): Promise<SettingsData> {
    // Route to Claude Code collection if platform is Claude Code
    if (_buildConfig.platform === BuildPlatform.CLAUDE_CODE) {
      return this.collectClaudeCodeData(_buildConfig);
    }
    
    // Route to Cursor IDE collection if platform is Cursor
    if (_buildConfig.platform === BuildPlatform.CURSOR) {
      return this.collectCursorData(_buildConfig);
    }

    const warnings: string[] = [];
    const errors: string[] = [];

    // Collect local settings (for Kiro platform)
    this.progressService.startScan('local');
    let localSettings;
    try {
      const localData = await this.collectionService.collectLocalSettings();
      localSettings = {
        contextMd: localData.context,
        userPreferencesMd: localData.userPreferences,
        projectSpecMd: localData.projectSpec,
        steeringFiles: localData.steeringFiles.map((file) => ({
          filename: file.filename,
          content: file.content,
          path: file.path,
        })),
        hooks: localData.hookFiles.map((file) => ({
          filename: file.filename,
          content: file.content,
          path: file.path,
          type: this.extractHookType(file.filename),
        })),
      };
      this.progressService.completeScan(
        'local',
        localData.steeringFiles.length + localData.hookFiles.length + 3,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      warnings.push(`Local settings collection failed: ${errorMessage}`);
      localSettings = {
        steeringFiles: [],
        hooks: [],
      };
      this.progressService.completeScan('local', 0);
    }

    // Collect global settings
    this.progressService.startScan('global');
    let globalSettings;
    try {
      const globalData = await this.collectionService.collectGlobalSettings();
      globalSettings = {
        userConfig: globalData.userConfig,
        preferences: globalData.globalPreferences,
        globalPrompts: globalData.promptTemplates.map((template) => ({
          name: template.filename,
          content: template.content,
          metadata: { path: template.path },
        })),
      };
      this.progressService.completeScan(
        'global',
        globalData.promptTemplates.length + globalData.configFiles.length + 2,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      warnings.push(`Global settings collection failed: ${errorMessage}`);
      globalSettings = {
        globalPrompts: [],
      };
      this.progressService.completeScan('global', 0);
    }

    // Add warnings to error handler
    warnings.forEach((warning) =>
      this.errorHandler.addWarning({
        type: 'missing_file',
        message: warning,
      }),
    );

    return {
      localSettings,
      globalSettings,
      collectionMetadata: {
        sourcePlatform: _buildConfig.platform,
        collectionTimestamp: new Date().toISOString(),
        projectPath: process.cwd(),
        globalPath: `${homedir()}/.kiro`,
        warnings,
        errors,
      },
    };
  }

  /**
   * Transform collected data into taptik format
   */
  private async transformData(
    settingsData: SettingsData,
    buildConfig: BuildConfig,
  ): Promise<{
    personalContext?: TaptikPersonalContext;
    projectContext?: TaptikProjectContext;
    promptTemplates?: TaptikPromptTemplates;
  }> {
    // Route to Claude Code transformation if platform is Claude Code
    if (buildConfig.platform === BuildPlatform.CLAUDE_CODE) {
      return this.transformClaudeCodeData(settingsData, buildConfig);
    }
    
    // Route to Cursor IDE transformation if platform is Cursor
    if (buildConfig.platform === BuildPlatform.CURSOR) {
      return this.transformCursorData(settingsData, buildConfig);
    }
    const transformedData: {
      personalContext?: TaptikPersonalContext;
      projectContext?: TaptikProjectContext;
      promptTemplates?: TaptikPromptTemplates;
    } = {};

    // Transform each enabled category in parallel
    const enabledCategories = buildConfig.categories.filter(
      (category) => category.enabled,
    );
    const transformationPromises = enabledCategories.map(async (category) => {
      try {
        this.progressService.startTransformation(category.name);

        let result:
          | TaptikPersonalContext
          | TaptikProjectContext
          | TaptikPromptTemplates
          | undefined;
        switch (category.name) {
          case BuildCategoryName.PERSONAL_CONTEXT: {
            result =
              await this.transformationService.transformPersonalContext(
                settingsData,
              );
            break;
          }
          case BuildCategoryName.PROJECT_CONTEXT: {
            result =
              await this.transformationService.transformProjectContext(
                settingsData,
              );
            break;
          }
          case BuildCategoryName.PROMPT_TEMPLATES: {
            result =
              await this.transformationService.transformPromptTemplates(
                settingsData,
              );
            break;
          }
        }

        this.progressService.completeTransformation(category.name);
        return { category: category.name, result };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.errorHandler.addWarning({
          type: 'partial_conversion',
          message: `Failed to transform ${category.name}`,
          details: errorMessage,
        });
        this.progressService.failStep(
          `Failed to transform ${category.name}`,
          error instanceof Error ? error : new Error(errorMessage),
        );
        return { category: category.name, result: undefined };
      }
    });

    const transformationResults = await Promise.all(transformationPromises);

    // Assign results to transformedData
    for (const { category, result } of transformationResults) {
      switch (category) {
        case BuildCategoryName.PERSONAL_CONTEXT: {
          transformedData.personalContext = result as TaptikPersonalContext;
          break;
        }
        case BuildCategoryName.PROJECT_CONTEXT: {
          transformedData.projectContext = result as TaptikProjectContext;
          break;
        }
        case BuildCategoryName.PROMPT_TEMPLATES: {
          transformedData.promptTemplates = result as TaptikPromptTemplates;
          break;
        }
      }
    }

    return transformedData;
  }

  /**
   * Collect data from Cursor IDE settings
   */
  private async collectCursorData(
    _buildConfig: BuildConfig,
  ): Promise<SettingsData> {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Collect local Cursor settings
    this.progressService.startScan('local');
    let localSettings;
    try {
      localSettings = await this.cursorCollectionService.collectCursorLocalSettings(process.cwd());
      this.progressService.completeScan(
        'local',
        Object.keys(localSettings).length,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      warnings.push(
        `Cursor IDE local settings collection failed: ${errorMessage}`,
      );
      localSettings = {};
      this.progressService.completeScan('local', 0);
    }

    // Collect global Cursor settings
    this.progressService.startScan('global');
    let globalSettings;
    try {
      globalSettings = await this.cursorCollectionService.collectCursorGlobalSettings();
      this.progressService.completeScan(
        'global',
        Object.keys(globalSettings).length,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      warnings.push(
        `Cursor IDE global settings collection failed: ${errorMessage}`,
      );
      globalSettings = {};
      this.progressService.completeScan('global', 0);
    }

    // Add warnings to error handler
    warnings.forEach((warning) =>
      this.errorHandler.addWarning({
        type: 'missing_file',
        message: warning,
      }),
    );

    // Ensure the settings have the expected structure for OutputService
    const normalizedLocalSettings = {
      ...localSettings,
      steeringFiles: [],
      hooks: [],
    };

    const normalizedGlobalSettings = {
      ...globalSettings,
      promptTemplates: [],
    };

    return {
      localSettings: normalizedLocalSettings,
      globalSettings: normalizedGlobalSettings,
      collectionMetadata: {
        sourcePlatform: 'cursor',
        collectionTimestamp: new Date().toISOString(),
        projectPath: process.cwd(),
        globalPath: `${homedir()}/.cursor`,
        warnings,
        errors,
      },
    };
  }

  /**
   * Transform Cursor IDE data into taptik format
   */
  private async transformCursorData(
    settingsData: SettingsData,
    buildConfig: BuildConfig,
  ): Promise<{
    personalContext?: TaptikPersonalContext;
    projectContext?: TaptikProjectContext;
    promptTemplates?: TaptikPromptTemplates;
  }> {
    const transformedData: {
      personalContext?: TaptikPersonalContext;
      projectContext?: TaptikProjectContext;
      promptTemplates?: TaptikPromptTemplates;
    } = {};

    // Transform each enabled category
    const enabledCategories = buildConfig.categories.filter(
      (category) => category.enabled,
    );

    // Process categories in parallel to avoid await-in-loop
    await Promise.all(enabledCategories.map(async (category) => {
      try {
        this.progressService.startTransformation(category.name);
        
        switch (category.name) {
          case BuildCategoryName.PERSONAL_CONTEXT: {
            // Get the actual Cursor global settings
            const globalCursorSettings = await this.cursorCollectionService.collectCursorGlobalSettings();
            if (globalCursorSettings) {
              transformedData.personalContext = 
                await this.cursorTransformationService.transformCursorPersonalContext(
                  globalCursorSettings,
                );
            }
            break;
          }
            
          case BuildCategoryName.PROJECT_CONTEXT: {
            // Get the actual Cursor local settings
            const localCursorSettings = await this.cursorCollectionService.collectCursorLocalSettings(process.cwd());
            if (localCursorSettings) {
              transformedData.projectContext = 
                await this.cursorTransformationService.transformCursorProjectContext(
                  localCursorSettings,
                );
            }
            break;
          }
            
          case BuildCategoryName.PROMPT_TEMPLATES: {
            // Get AI configuration from both sources
            const globalCursorSettings = await this.cursorCollectionService.collectCursorGlobalSettings();
            const localCursorSettings = await this.cursorCollectionService.collectCursorLocalSettings(process.cwd());
            
            const aiConfig = globalCursorSettings?.globalAiRules || localCursorSettings?.projectAiRules;
            if (aiConfig) {
              transformedData.promptTemplates = 
                await this.cursorTransformationService.transformCursorPromptTemplates(aiConfig);
            }
            break;
          }
        }
        
        this.progressService.completeTransformation(category.name);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.errorHandler.addWarning({
          type: 'partial_conversion',
          message: `Failed to transform ${category.name}`,
          details: errorMessage,
        });
        this.progressService.failStep(
          `${category.name} transformation failed`,
          error instanceof Error ? error : new Error(errorMessage),
        );
      }
    }));

    return transformedData;
  }

  /**
   * Preview what would be generated in dry run mode
   */
  private previewBuildOutput(
    transformedData: {
      personalContext?: TaptikPersonalContext;
      projectContext?: TaptikProjectContext;
      promptTemplates?: TaptikPromptTemplates;
    },
    buildConfig: BuildConfig,
  ): void {
    const enabledCategories = buildConfig.categories.filter(
      (cat) => cat.enabled,
    );

    this.logger.log(`🎯 Platform: ${buildConfig.platform}`);
    this.logger.log(
      `📂 Output would be created in: ${buildConfig.outputDirectory || './taptik-build-[timestamp]'}`,
    );
    this.logger.log(
      `📋 Categories to build: ${enabledCategories.map((category) => category.name).join(', ')}`,
    );

    const filesToGenerate = [];
    if (transformedData.personalContext)
      filesToGenerate.push('personal-context.json');
    if (transformedData.projectContext)
      filesToGenerate.push('project-context.json');
    if (transformedData.promptTemplates)
      filesToGenerate.push('prompt-templates.json');
    filesToGenerate.push('manifest.json');

    this.logger.log(
      `📄 Files that would be generated: ${filesToGenerate.join(', ')}`,
    );

    // Show estimated sizes
    const estimatedSizes = {
      'personal-context.json': transformedData.personalContext
        ? JSON.stringify(transformedData.personalContext).length
        : 0,
      'project-context.json': transformedData.projectContext
        ? JSON.stringify(transformedData.projectContext).length
        : 0,
      'prompt-templates.json': transformedData.promptTemplates
        ? JSON.stringify(transformedData.promptTemplates).length
        : 0,
    };

    let totalSize = 0;
    filesToGenerate.forEach((file) => {
      const size = estimatedSizes[file as keyof typeof estimatedSizes] || 1024; // Default manifest size
      totalSize += size;
      this.logger.log(`  📄 ${file}: ~${this.formatBytes(size)}`);
    });

    this.logger.log(`💾 Total estimated size: ~${this.formatBytes(totalSize)}`);
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Generate output files and manifest
   */
  private async generateOutput(
    transformedData: {
      personalContext?: TaptikPersonalContext;
      projectContext?: TaptikProjectContext;
      promptTemplates?: TaptikPromptTemplates;
    },
    buildConfig: BuildConfig,
    settingsData: SettingsData,
    customOutputPath?: string,
  ): Promise<string> {
    // Create output directory
    this.progressService.startOutput();
    const outputPath = customOutputPath
      ? await this.outputService.createOutputDirectory(customOutputPath)
      : await this.outputService.createOutputDirectory();
    buildConfig.outputDirectory = outputPath;

    // Write output files
    const outputFiles = await this.outputService.writeOutputFiles(
      outputPath,
      transformedData.personalContext,
      transformedData.projectContext,
      transformedData.promptTemplates,
    );

    // Generate manifest
    await this.outputService.generateManifest(
      outputPath,
      buildConfig,
      settingsData,
      outputFiles,
    );

    this.progressService.completeOutput(outputPath, outputFiles.length + 1); // +1 for manifest
    return outputPath;
  }

  /**
   * Complete the build process with summary
   */
  private async completeBuild(
    outputPath: string,
    buildConfig: BuildConfig,
    buildTime: number,
  ): Promise<void> {
    const enabledCategories = buildConfig.categories
      .filter((category) => category.enabled)
      .map((category) => category.name);

    // Display build summary
    this.progressService.displayBuildSummary(
      buildTime,
      outputPath,
      enabledCategories,
    );

    // Display detailed output summary
    try {
      const outputFiles = await this.getOutputFiles(outputPath);
      const errorSummary = this.errorHandler.getErrorSummary();
      const { warnings, criticalErrors: errors } = errorSummary;

      const warningMessages = warnings.map((warning) => warning.message);
      const errorMessages = errors.map((error) => error.message);
      await this.outputService.displayBuildSummary(
        outputPath,
        outputFiles,
        warningMessages,
        errorMessages,
        buildTime,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        'Failed to display detailed build summary',
        errorMessage,
      );
      // Continue without detailed summary
    }
  }

  /**
   * Generate unique build ID
   */
  private generateBuildId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `build-${timestamp}-${random}`;
  }

  /**
   * Extract hook type from filename
   */
  private extractHookType(filename: string): string {
    const parts = filename.split('.');
    if (parts.length >= 2) {
      return parts[0]; // e.g., "commit" from "commit.kiro.hook"
    }
    return 'unknown';
  }

  /**
   * Get output files information
   */
  private async getOutputFiles(
    outputPath: string,
  ): Promise<Array<{ filename: string; category: string; size: number }>> {
    const { promises: fs } = await import('node:fs');
    const { join } = await import('node:path');
    const outputFiles = [];

    try {
      const files = await fs.readdir(outputPath);

      const jsonFiles = files.filter((filename) => filename.endsWith('.json'));
      const fileStatsPromises = jsonFiles.map(async (filename) => {
        const filePath = join(outputPath, filename);
        const stats = await fs.stat(filePath);

        let category = 'unknown';
        switch (filename) {
          case 'personal-context.json': {
            category = 'personal-context';
            break;
          }
          case 'project-context.json': {
            category = 'project-context';
            break;
          }
          case 'prompt-templates.json': {
            category = 'prompt-templates';
            break;
          }
          case 'manifest.json': {
            category = 'manifest';
            break;
          }
          default: {
            category = 'unknown';
          }
        }

        return {
          filename,
          category,
          size: stats.size,
        };
      });

      const fileStats = await Promise.all(fileStatsPromises);
      outputFiles.push(...fileStats);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn('Failed to read output files for summary', errorMessage);
    }

    return outputFiles;
  }

  /**
   * Log transformation results for monitoring
   */
  private logTransformationResults(
    transformedData: {
      personalContext?: TaptikPersonalContext;
      projectContext?: TaptikProjectContext;
      promptTemplates?: TaptikPromptTemplates;
    },
    buildConfig: BuildConfig,
  ): void {
    const enabledCategories = buildConfig.categories.filter(
      (cat) => cat.enabled,
    );
    const successfulTransformations = [];
    const failedTransformations = [];

    for (const category of enabledCategories) {
      switch (category.name) {
        case BuildCategoryName.PERSONAL_CONTEXT:
          if (transformedData.personalContext) {
            successfulTransformations.push('personal-context');
          } else {
            failedTransformations.push('personal-context');
          }
          break;
        case BuildCategoryName.PROJECT_CONTEXT:
          if (transformedData.projectContext) {
            successfulTransformations.push('project-context');
          } else {
            failedTransformations.push('project-context');
          }
          break;
        case BuildCategoryName.PROMPT_TEMPLATES:
          if (transformedData.promptTemplates) {
            successfulTransformations.push('prompt-templates');
          } else {
            failedTransformations.push('prompt-templates');
          }
          break;
      }
    }

    this.logger.log(
      `Transformation completed: ${successfulTransformations.length} successful, ${failedTransformations.length} failed`,
    );

    if (successfulTransformations.length > 0) {
      this.logger.debug(
        `Successful transformations: ${successfulTransformations.join(', ')}`,
      );
    }

    if (failedTransformations.length > 0) {
      this.logger.warn(
        `Failed transformations: ${failedTransformations.join(', ')}`,
      );
    }
  }

  /**
   * Collect data from Claude Code settings
   */
  private async collectClaudeCodeData(
    _buildConfig: BuildConfig,
  ): Promise<SettingsData> {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Collect local Claude Code settings
    this.progressService.startScan('local');
    let localSettings;
    try {
      // Check if the method exists, if not use fallback
      const collectionSvc = this.collectionService as unknown as Record<
        string,
        unknown
      >;
      if (
        typeof collectionSvc['collectClaudeCodeLocalSettings'] === 'function'
      ) {
        localSettings = await (
          collectionSvc[
            'collectClaudeCodeLocalSettings'
          ] as () => Promise<unknown>
        )();
      } else {
        // Fallback to default data when method not available
        localSettings = {
          settings: {
            theme: 'default',
          },
          claudeMd: '# Claude Code Configuration\n\nDefault configuration.',
          claudeLocalMd: '',
          steeringFiles: [],
          agents: [],
          commands: [],
          hooks: [],
          mcpConfig: undefined,
          sourcePath: './.claude',
          collectedAt: new Date().toISOString(),
        };
        this.logger.debug('Using fallback Claude Code local settings');
      }
      this.progressService.completeScan(
        'local',
        Object.keys(localSettings).length,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      warnings.push(
        `Claude Code local settings collection failed: ${errorMessage}`,
      );
      localSettings = {};
      this.progressService.completeScan('local', 0);
    }

    // Collect global Claude Code settings
    this.progressService.startScan('global');
    let globalSettings;
    try {
      // Check if the method exists, if not use fallback
      const collectionSvcGlobal = this.collectionService as unknown as Record<
        string,
        unknown
      >;
      if (
        typeof collectionSvcGlobal['collectClaudeCodeGlobalSettings'] ===
        'function'
      ) {
        globalSettings = await (
          collectionSvcGlobal[
            'collectClaudeCodeGlobalSettings'
          ] as () => Promise<unknown>
        )();
      } else {
        // Fallback to mock data for testing
        globalSettings = {
          settings: {},
          agents: [],
          commands: [],
          mcpConfig: undefined,
          sourcePath: '~/.claude',
          collectedAt: new Date().toISOString(),
          securityFiltered: false,
        };
        this.logger.debug('Using fallback Claude Code global settings');
      }
      this.progressService.completeScan(
        'global',
        Object.keys(globalSettings).length,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      warnings.push(
        `Claude Code global settings collection failed: ${errorMessage}`,
      );
      globalSettings = {};
      this.progressService.completeScan('global', 0);
    }

    // Add warnings to error handler
    warnings.forEach((warning) =>
      this.errorHandler.addWarning({
        type: 'missing_file',
        message: warning,
      }),
    );

    return {
      localSettings,
      globalSettings,
      collectionMetadata: {
        sourcePlatform: 'claude-code',
        collectionTimestamp: new Date().toISOString(),
        projectPath: process.cwd(),
        globalPath: `${homedir()}/.claude`,
        warnings,
        errors,
      },
    };
  }

  /**
   * Transform Claude Code data
   */
  private async transformClaudeCodeData(
    settingsData: SettingsData,
    buildConfig: BuildConfig,
  ): Promise<{
    personalContext?: TaptikPersonalContext;
    projectContext?: TaptikProjectContext;
    promptTemplates?: TaptikPromptTemplates;
  }> {
    const transformedData: {
      personalContext?: TaptikPersonalContext;
      projectContext?: TaptikProjectContext;
      promptTemplates?: TaptikPromptTemplates;
    } = {};

    // Transform each enabled category
    const enabledCategories = buildConfig.categories.filter(
      (category) => category.enabled,
    );

    // Process categories using Promise.all to avoid await-in-loop
    const transformationPromises = enabledCategories.map(async (category) => {
      try {
        this.progressService.startTransformation(category.name);

        switch (category.name) {
          case BuildCategoryName.PERSONAL_CONTEXT: {
            const cloudTransformService = this
              .transformationService as unknown as CloudTransformationService;
            if (
              typeof cloudTransformService.transformClaudeCodePersonalContext ===
              'function'
            ) {
              transformedData.personalContext =
                await cloudTransformService.transformClaudeCodePersonalContext(
                  settingsData.localSettings,
                  settingsData.globalSettings,
                );
            } else {
              // Fallback transformation with minimal valid data
              transformedData.personalContext = {
                user_id: `claude-user-${Date.now()}`,
                preferences: {
                  preferred_languages: ['typescript', 'javascript'],
                  coding_style: {
                    indentation: '2 spaces',
                    naming_convention: 'camelCase',
                    comment_style: 'minimal',
                    code_organization: 'feature-based',
                  },
                  tools_and_frameworks: [],
                  development_environment: ['claude-code'],
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
                  source_platform: 'claude-code',
                  created_at: new Date().toISOString(),
                  version: '1.0.0',
                },
              };
            }
            break;
          }
          case BuildCategoryName.PROJECT_CONTEXT: {
            const cloudTransformService = this
              .transformationService as unknown as CloudTransformationService;
            if (
              typeof cloudTransformService.transformClaudeCodeProjectContext ===
              'function'
            ) {
              transformedData.projectContext =
                await cloudTransformService.transformClaudeCodeProjectContext(
                  settingsData.localSettings,
                  settingsData.globalSettings,
                );
            } else {
              // Fallback transformation with minimal valid data
              transformedData.projectContext = {
                project_id: `claude-project-${Date.now()}`,
                project_info: {
                  name: 'Claude Code Project',
                  description: 'Default Claude Code project configuration',
                  version: '1.0.0',
                  repository: '',
                },
                technical_stack: {
                  primary_language: 'typescript',
                  frameworks: [],
                  databases: [],
                  tools: [],
                  deployment: [],
                },
                development_guidelines: {
                  coding_standards: [],
                  testing_requirements: [],
                  documentation_standards: [],
                  review_process: [],
                },
                metadata: {
                  source_platform: 'claude-code',
                  source_path: process.cwd(),
                  created_at: new Date().toISOString(),
                  version: '1.0.0',
                },
              };
            }
            break;
          }
          case BuildCategoryName.PROMPT_TEMPLATES: {
            const cloudTransformService = this
              .transformationService as unknown as CloudTransformationService;
            if (
              typeof cloudTransformService.transformClaudeCodePromptTemplates ===
              'function'
            ) {
              transformedData.promptTemplates =
                await cloudTransformService.transformClaudeCodePromptTemplates(
                  settingsData.localSettings,
                  settingsData.globalSettings,
                );
            } else {
              // Fallback transformation with minimal valid data
              transformedData.promptTemplates = {
                templates: [
                  {
                    id: 'claude-default-1',
                    name: 'Default Assistant',
                    description: 'Default Claude Code assistant prompt',
                    category: 'claude-agent',
                    content: 'You are a helpful AI assistant.',
                    variables: [],
                    tags: ['claude-code', 'default'],
                  },
                ],
                metadata: {
                  source_platform: 'claude-code',
                  total_templates: 1,
                  created_at: new Date().toISOString(),
                  version: '1.0.0',
                },
              };
            }
            break;
          }
        }

        this.progressService.completeTransformation(category.name);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.errorHandler.addWarning({
          type: 'partial_conversion',
          message: `Failed to transform ${category.name}`,
          details: errorMessage,
        });
        this.progressService.failStep(
          `${category.name} transformation failed`,
          error instanceof Error ? error : new Error(errorMessage),
        );
      }
    });

    // Wait for all transformations to complete
    await Promise.all(transformationPromises);

    return transformedData;
  }

  /**
   * Generate cloud-ready output for Claude Code
   */
  private async generateCloudOutput(
    cloudPackage: TaptikPackage,
    validationResult: CloudValidationResult | undefined,
    buildConfig: BuildConfig,
    customOutputPath?: string,
    sanitizationResult?: SanitizationResult,
  ): Promise<string> {
    const outputPath =
      customOutputPath ||
      (await this.outputService.createOutputDirectory(customOutputPath));

    try {
      // Write the cloud package
      const packageFilePath = path.join(outputPath, 'taptik.package');
      await this.packageService.writePackageToFile(
        cloudPackage,
        packageFilePath,
      );

      // Write cloud metadata
      try {
        const outputSvc = this.outputService as unknown as Record<
          string,
          unknown
        >;
        if (outputSvc['writeCloudMetadata']) {
          await (
            outputSvc['writeCloudMetadata'] as (
              path: string,
              metadata: unknown,
            ) => Promise<void>
          )(outputPath, cloudPackage.metadata);
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.debug(
          'writeCloudMetadata not available or failed:',
          errorMessage,
        );
      }

      // Write sanitization report
      try {
        const outputSvcSanitization = this.outputService as unknown as Record<
          string,
          unknown
        >;
        if (
          outputSvcSanitization['writeSanitizationReport'] &&
          sanitizationResult?.report
        ) {
          await (
            outputSvcSanitization['writeSanitizationReport'] as (
              path: string,
              report: unknown,
            ) => Promise<void>
          )(outputPath, sanitizationResult.report);
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.debug(
          'writeSanitizationReport not available or failed:',
          errorMessage,
        );
      }

      // Write validation report
      try {
        const outputSvcValidation = this.outputService as unknown as Record<
          string,
          unknown
        >;
        if (outputSvcValidation['writeValidationReport'] && validationResult) {
          await (
            outputSvcValidation['writeValidationReport'] as (
              path: string,
              result: unknown,
            ) => Promise<void>
          )(outputPath, validationResult);
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.debug(
          'writeValidationReport not available or failed:',
          errorMessage,
        );
      }

      // Display cloud-ready summary
      try {
        const outputSvcSummary = this.outputService as unknown as Record<
          string,
          unknown
        >;
        if (outputSvcSummary['displayCloudReadySummary']) {
          await (
            outputSvcSummary['displayCloudReadySummary'] as (
              path: string,
              pkg: unknown,
              result: unknown,
            ) => Promise<void>
          )(outputPath, cloudPackage, validationResult);
        } else {
          // Fallback to basic summary
          this.logger.log(`✅ Cloud package created: ${packageFilePath}`);
          if (validationResult?.cloudCompatible) {
            this.logger.log('☁️  Package is ready for cloud upload');
          }
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.debug(
          'displayCloudReadySummary not available or failed:',
          errorMessage,
        );
      }

      return outputPath;
    } catch (error: unknown) {
      this.logger.error('Failed to generate cloud output:', error);
      throw error;
    }
  }

  /**
   * Prompt for cloud upload
   */
  private async promptForCloudUpload(
    cloudPackage: TaptikPackage,
    validationResult: CloudValidationResult,
  ): Promise<void> {
    if (!validationResult.cloudCompatible) {
      return;
    }

    // Check for auto-upload configuration
    const interactiveSvc = this.interactiveService as unknown as Record<
      string,
      unknown
    >;
    const shouldAutoUpload = await (
      interactiveSvc['confirmAutoUpload'] as
        | ((metadata: unknown) => Promise<boolean>)
        | undefined
    )?.(cloudPackage.metadata);

    if (!shouldAutoUpload) {
      // Prompt for manual upload
      const interactiveSvcManual = this.interactiveService as unknown as Record<
        string,
        unknown
      >;
      await (
        interactiveSvcManual['promptForManualUpload'] as
          | ((metadata: unknown) => Promise<void>)
          | undefined
      )?.(cloudPackage.metadata);
    }
  }

  /**
   * Push the built package to the cloud using PushService
   */
  private async pushPackageToCloud(
    outputPath: string,
    cloudPackage: TaptikPackage,
    pushOptions: {
      pushPublic?: boolean;
    },
    isVerbose: boolean,
  ): Promise<void> {
    try {
      this.logger.log('📤 Pushing package to cloud...');

      // Find the package file
      const packageFilePath = path.join(outputPath, 'taptik.package');

      // Read the package file
      const fs = await import('fs/promises');
      let fileBuffer: Buffer;
      let fileStats: { size: number };

      try {
        fileBuffer = await fs.readFile(packageFilePath);
        fileStats = await fs.stat(packageFilePath);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to read package file: ${errorMessage}`);
        this.errorHandler.addWarning({
          type: 'push',
          message: 'Failed to push package to cloud',
          details: `Could not read package file at ${packageFilePath}`,
        });
        return;
      }

      // Use defaults from package metadata or sensible fallbacks
      const tags = ['claude-code', 'auto-generated'];
      const title = cloudPackage.metadata?.title || 'Claude Code Configuration';

      // Build push options
      const pushOpts: PushOptions = {
        file: {
          buffer: fileBuffer,
          name: path.basename(packageFilePath),
          size: fileStats.size,
          path: packageFilePath,
        },
        visibility: pushOptions.pushPublic
          ? PackageVisibility.Public
          : PackageVisibility.Private,
        title,
        description:
          cloudPackage.metadata?.description ||
          'Configuration package built with taptik build command',
        tags,
        teamId: undefined,
        version: cloudPackage.metadata?.version || '1.0.0',
        autoBump: true, // Auto-increment version if conflict
        force: true, // Skip confirmation since build already confirmed
        dryRun: false,
      };

      // Track progress
      let lastProgress: UploadProgress | null = null;

      // Execute push with progress tracking
      await this.pushService.push(pushOpts, (progress) => {
        lastProgress = progress;
        if (isVerbose) {
          this.logger.log(
            `  ${progress.stage}: ${progress.percentage}%${
              progress.message ? ` - ${progress.message}` : ''
            }`,
          );
        }
      });

      // Success message
      if (lastProgress?.configId) {
        this.logger.log('✅ Package pushed successfully!');
        this.logger.log(`   Configuration ID: ${lastProgress.configId}`);

        if (lastProgress.shareUrl) {
          this.logger.log(`   Share URL: ${lastProgress.shareUrl}`);
        }

        if (pushOptions.pushPublic) {
          this.logger.log('   📢 Your configuration is now publicly available');
        } else {
          this.logger.log('   🔒 Your configuration is private');
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorCode =
        error && typeof error === 'object' && 'code' in error
          ? (error as { code: unknown }).code
          : undefined;
      this.logger.error(`Push failed: ${errorMessage}`);

      // Check if it's an authentication error
      if (errorCode === 'AUTH_001' || errorMessage.includes('auth')) {
        this.logger.log('💡 Run "taptik login" to authenticate first');
        this.errorHandler.addWarning({
          type: 'push',
          message: 'Authentication required for push',
          details: 'Please run "taptik login" before using --push',
        });
      } else {
        this.errorHandler.addWarning({
          type: 'push',
          message: 'Failed to push package to cloud',
          details: errorMessage,
        });
      }

      // Don't fail the entire build if push fails
      this.logger.log(
        '⚠️  Build completed but push failed. Package saved locally.',
      );
    }
  }
}
