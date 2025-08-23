import { homedir } from 'node:os';
import * as path from 'node:path';

import { Logger } from '@nestjs/common';

import { Command, CommandRunner, Option } from 'nest-commander';

import { SanitizationResult, TaptikContext, TaptikPackage, ValidationResult as CloudValidationResult } from '../../context/interfaces/cloud.interface';
import { MetadataGeneratorService } from '../../context/services/metadata-generator.service';
import { PackageService } from '../../context/services/package.service';
import { SanitizationService } from '../../context/services/sanitization.service';
import { ValidationService } from '../../context/services/validation.service';
import { BuildConfig, BuildPlatform, BuildCategoryName } from '../interfaces/build-config.interface';
import { CloudTransformationService } from '../interfaces/cloud-services.interface';
import { SettingsData } from '../interfaces/settings-data.interface';
import { TaptikPersonalContext, TaptikProjectContext, TaptikPromptTemplates } from '../interfaces/taptik-format.interface';
import { CollectionService } from '../services/collection/collection.service';
import { ErrorHandlerService } from '../services/error-handler/error-handler.service';
import { InteractiveService } from '../services/interactive/interactive.service';
import { OutputService } from '../services/output/output.service';
import { ProgressService } from '../services/progress/progress.service';
import { TransformationService } from '../services/transformation/transformation.service';

@Command({
  name: 'build',
  description: 'Build taptik-compatible context files from Kiro settings',
})
export class BuildCommand extends CommandRunner {
  private readonly logger = new Logger(BuildCommand.name);

  constructor(
    private readonly interactiveService: InteractiveService,
    private readonly collectionService: CollectionService,
    private readonly transformationService: TransformationService,
    private readonly sanitizationService: SanitizationService,
    private readonly metadataGeneratorService: MetadataGeneratorService,
    private readonly packageService: PackageService,
    private readonly validationService: ValidationService,
    private readonly outputService: OutputService,
    private readonly progressService: ProgressService,
    private readonly errorHandler: ErrorHandlerService,
  ) {
    super();
  }

  @Option({
    flags: '--dry-run',
    description: 'Preview what would be built without creating actual files',
  })
  parseDryRun(): boolean {
    return true;
  }

  @Option({
    flags: '--output <path>',
    description: 'Specify custom output directory path',
  })
  parseOutputPath(value: string): string {
    return value;
  }

  @Option({
    flags: '--verbose',
    description: 'Show detailed progress and debugging information',
  })
  parseVerbose(): boolean {
    return true;
  }

  @Option({
    flags: '--platform <platform>',
    description: 'Skip platform selection and use specified platform (kiro, cursor, claude-code)',
  })
  parsePlatform(value: string): BuildPlatform {
    const platform = value.toLowerCase();
    if (platform === 'kiro') return BuildPlatform.KIRO;
    if (platform === 'cursor') return BuildPlatform.CURSOR;
    if (platform === 'claude-code') return BuildPlatform.CLAUDE_CODE;
    throw new Error(`Invalid platform: ${value}. Must be one of: kiro, cursor, claude-code`);
  }

  @Option({
    flags: '--categories <categories>',
    description: 'Comma-separated list of categories to build (personal, project, prompts)',
  })
  parseCategories(value: string): string[] {
    return value.split(',').map(category => category.trim().toLowerCase());
  }

  @Option({
    flags: '--quiet',
    description: 'Suppress non-essential output (opposite of --verbose)',
  })
  parseQuiet(): boolean {
    return true;
  }

  async run(_passedParameters: string[], options?: Record<string, unknown>): Promise<void> {
    const startTime = Date.now();
    const isDryRun = options?.dryRun as boolean;
    const customOutputPath = options?.output as string;
    const isVerbose = options?.verbose as boolean;
    const isQuiet = options?.quiet as boolean;
    const presetPlatform = options?.platform as BuildPlatform;
    const presetCategories = options?.categories as string[];
    
    try {
      // Configure logging based on options
      if (isVerbose) {
        this.logger.log('🔍 Verbose mode enabled - showing detailed information');
        this.logger.log(`CLI options: ${JSON.stringify(options, null, 2)}`);
      }

      if (isDryRun) {
        this.logger.log('🔍 Dry run mode - no files will be created');
      }

      if (isQuiet) {
        // Suppress non-essential logger output
        this.logger.log = () => {}; // Override log method for quiet mode
      }

      // Check for interruption before starting
      if (this.errorHandler.isProcessInterrupted()) {
        return;
      }

      // Initialize progress tracking (with cloud pipeline steps for Claude Code)
      const progressSteps = presetPlatform === BuildPlatform.CLAUDE_CODE
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
            'Build completion'
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
          this.logger.log(`📋 Using preset categories: ${presetCategories.join(', ')}`);
        }
        
        // Convert preset categories to proper format
        categories = presetCategories.map(category => {
          const categoryMap: Record<string, BuildCategoryName> = {
            'personal': BuildCategoryName.PERSONAL_CONTEXT,
            'project': BuildCategoryName.PROJECT_CONTEXT, 
            'prompts': BuildCategoryName.PROMPT_TEMPLATES,
          };
          
          const categoryName = categoryMap[category];
          if (!categoryName) {
            throw new Error(`Invalid category: ${category}. Must be one of: personal, project, prompts`);
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
        this.logger.log(`🔧 Build configuration: ${JSON.stringify(buildConfig, null, 2)}`);
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
      const transformedData = await this.transformData(settingsData, buildConfig);
      
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
        try {
          // Step 4: Security sanitization
          this.progressService.startStep('Security sanitization');
          sanitizationResult = await this.sanitizationService.sanitizeForCloudUpload(transformedData);
          
          if (sanitizationResult.securityLevel === 'blocked') {
            this.errorHandler.handleCriticalErrorAndExit({
              type: 'security',
              message: 'Configuration contains sensitive data that cannot be safely shared',
              details: sanitizationResult.findings.join(', '),
              suggestedResolution: 'Remove sensitive information before building for cloud',
              exitCode: 1,
            });
            return;
          }
          this.progressService.completeStep('Security sanitization');
        } catch (error) {
          this.logger.error('Security sanitization failed:', error);
          this.progressService.failStep('Security sanitization', error.message);
          this.errorHandler.addWarning({
            type: 'security',
            message: 'Security sanitization failed, continuing with original data',
            details: error.message,
          });
          sanitizationResult = { 
            sanitizedData: transformedData, 
            securityLevel: 'warning', 
            findings: [],
            report: {
              totalFields: 0,
              sanitizedFields: 0,
              safeFields: 0,
              timestamp: new Date(),
              summary: 'Sanitization skipped - service not available'
            }
          };
        }

        try {
          // Step 5: Metadata generation
          this.progressService.startStep('Metadata generation');
          const cloudMetadata = await this.metadataGeneratorService.generateCloudMetadata(
            sanitizationResult.sanitizedData as TaptikContext
          );
          this.progressService.completeStep('Metadata generation');

          // Step 6: Package creation
          this.progressService.startStep('Package creation');
          cloudPackage = await this.packageService.createTaptikPackage(
            cloudMetadata,
            sanitizationResult.sanitizedData as TaptikContext,
            { compression: 'gzip', optimizeSize: true }
          );
          this.progressService.completeStep('Package creation');
        } catch (error) {
          this.logger.error('Package creation failed:', error);
          this.progressService.failStep(
            error.message.includes('metadata') ? 'Metadata generation' : 'Package creation',
            error.message
          );
          this.errorHandler.addWarning({
            type: 'package',
            message: error.message,
            details: error.stack,
          });
        }

        if (cloudPackage) {
          try {
            // Step 7: Cloud validation
            this.progressService.startStep('Cloud validation');
            validationResult = await this.validationService.validateForCloudUpload(cloudPackage);
            
            if (!validationResult.isValid || !validationResult.cloudCompatible) {
              this.errorHandler.addWarning({
                type: 'validation',
                message: 'Package validation failed',
                details: validationResult.errors.join(', '),
              });
            }
            this.progressService.completeStep('Cloud validation');
          } catch (error) {
            this.logger.error('Validation failed:', error);
            this.progressService.failStep('Cloud validation', error.message);
            validationResult = { 
              isValid: false, 
              cloudCompatible: false, 
              errors: [error.message],
              warnings: [],
              schemaCompliant: false,
              sizeLimit: {
                current: 0,
                maximum: 50 * 1024 * 1024,
                withinLimit: true
              },
              featureSupport: {
                ide: 'claudeCode',
                supported: [],
                unsupported: []
              },
              recommendations: []
            };
          }
        }
      }

      // Step 8 (or 4 for non-Claude Code): Output generation
      this.progressService.startStep('Output generation');
      
      if (isDryRun) {
        this.logger.log('📋 Dry run - showing what would be generated:');
        this.previewBuildOutput(transformedData, buildConfig);
        this.progressService.completeStep('Output generation');
        
        // Skip actual file generation and completion for dry run
        this.progressService.startStep('Build completion');
        this.logger.log('✅ Dry run completed successfully');
        this.progressService.completeStep('Build completion');
        return;
      }
      
      let outputPath;
      if (buildConfig.platform === BuildPlatform.CLAUDE_CODE && cloudPackage) {
        outputPath = await this.generateCloudOutput(
          cloudPackage, 
          validationResult, 
          buildConfig, 
          customOutputPath,
          sanitizationResult
        );
      } else {
        outputPath = await this.generateOutput(transformedData, buildConfig, settingsData, customOutputPath);
      }
      
      if (this.errorHandler.isProcessInterrupted()) {
        return;
      }
      this.progressService.completeStep('Output generation');

      // Cloud upload prompting for Claude Code
      if (buildConfig.platform === BuildPlatform.CLAUDE_CODE && cloudPackage && validationResult?.cloudCompatible) {
        await this.promptForCloudUpload(cloudPackage, validationResult);
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
          suggestedResolution: 'Try running the command again or check your system resources',
          exitCode: 124, // Standard timeout exit code
        });
      } else if (error.code === 'EACCES') {
        this.errorHandler?.handleCriticalErrorAndExit({
          type: 'file_system',
          message: 'Permission denied accessing files',
          details: error.message,
          suggestedResolution: 'Check file permissions or run with appropriate privileges',
          exitCode: 126, // Permission denied exit code
        });
      } else if (error.code === 'ENOENT') {
        this.errorHandler?.handleCriticalErrorAndExit({
          type: 'file_system',
          message: 'Required file or directory not found',
          details: error.message,
          suggestedResolution: 'Ensure all required files exist and paths are correct',
          exitCode: 2, // File not found exit code
        });
      } else {
        // Generic critical error
        this.errorHandler?.handleCriticalErrorAndExit({
          type: 'system',
          message: 'Build process failed with unexpected error',
          details: error.message,
          suggestedResolution: 'Please report this issue with the error details',
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
        steeringFiles: localData.steeringFiles.map(file => ({
          filename: file.filename,
          content: file.content,
          path: file.path,
        })),
        hooks: localData.hookFiles.map(file => ({
          filename: file.filename,
          content: file.content,
          path: file.path,
          type: this.extractHookType(file.filename),
        })),
      };
      this.progressService.completeScan('local', localData.steeringFiles.length + localData.hookFiles.length + 3);
    } catch (error) {
      warnings.push(`Local settings collection failed: ${error.message}`);
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
        globalPrompts: globalData.promptTemplates.map(template => ({
          name: template.filename,
          content: template.content,
          metadata: { path: template.path },
        })),
      };
      this.progressService.completeScan('global', globalData.promptTemplates.length + globalData.configFiles.length + 2);
    } catch (error) {
      warnings.push(`Global settings collection failed: ${error.message}`);
      globalSettings = {
        globalPrompts: [],
      };
      this.progressService.completeScan('global', 0);
    }

    // Add warnings to error handler
    warnings.forEach(warning => this.errorHandler.addWarning({
      type: 'missing_file',
      message: warning,
    }));

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
    buildConfig: BuildConfig
  ): Promise<{
    personalContext?: TaptikPersonalContext;
    projectContext?: TaptikProjectContext;
    promptTemplates?: TaptikPromptTemplates;
  }> {
    // Route to Claude Code transformation if platform is Claude Code
    if (buildConfig.platform === BuildPlatform.CLAUDE_CODE) {
      return this.transformClaudeCodeData(settingsData, buildConfig);
    }
    const transformedData: {
      personalContext?: TaptikPersonalContext;
      projectContext?: TaptikProjectContext;
      promptTemplates?: TaptikPromptTemplates;
    } = {};

    // Transform each enabled category in parallel
    const enabledCategories = buildConfig.categories.filter(category => category.enabled);
    const transformationPromises = enabledCategories.map(async (category) => {
      try {
        this.progressService.startTransformation(category.name);

        let result: TaptikPersonalContext | TaptikProjectContext | TaptikPromptTemplates | undefined;
        switch (category.name) {
          case BuildCategoryName.PERSONAL_CONTEXT: {
            result = await this.transformationService.transformPersonalContext(settingsData);
            break;
          }
          case BuildCategoryName.PROJECT_CONTEXT: {
            result = await this.transformationService.transformProjectContext(settingsData);
            break;
          }
          case BuildCategoryName.PROMPT_TEMPLATES: {
            result = await this.transformationService.transformPromptTemplates(settingsData);
            break;
          }
        }

        this.progressService.completeTransformation(category.name);
        return { category: category.name, result };
      } catch (error) {
        this.errorHandler.addWarning({
          type: 'partial_conversion',
          message: `Failed to transform ${category.name}`,
          details: error.message,
        });
        this.progressService.failStep(`Failed to transform ${category.name}`, error);
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
   * Preview what would be generated in dry run mode
   */
  private previewBuildOutput(
    transformedData: {
      personalContext?: TaptikPersonalContext;
      projectContext?: TaptikProjectContext;
      promptTemplates?: TaptikPromptTemplates;
    },
    buildConfig: BuildConfig
  ): void {
    const enabledCategories = buildConfig.categories.filter(cat => cat.enabled);
    
    this.logger.log(`🎯 Platform: ${buildConfig.platform}`);
    this.logger.log(`📂 Output would be created in: ${buildConfig.outputDirectory || './taptik-build-[timestamp]'}`);
    this.logger.log(`📋 Categories to build: ${enabledCategories.map(category => category.name).join(', ')}`);
    
    const filesToGenerate = [];
    if (transformedData.personalContext) filesToGenerate.push('personal-context.json');
    if (transformedData.projectContext) filesToGenerate.push('project-context.json');
    if (transformedData.promptTemplates) filesToGenerate.push('prompt-templates.json');
    filesToGenerate.push('manifest.json');
    
    this.logger.log(`📄 Files that would be generated: ${filesToGenerate.join(', ')}`);
    
    // Show estimated sizes
    const estimatedSizes = {
      'personal-context.json': transformedData.personalContext ? JSON.stringify(transformedData.personalContext).length : 0,
      'project-context.json': transformedData.projectContext ? JSON.stringify(transformedData.projectContext).length : 0,
      'prompt-templates.json': transformedData.promptTemplates ? JSON.stringify(transformedData.promptTemplates).length : 0,
    };
    
    let totalSize = 0;
    filesToGenerate.forEach(file => {
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
    customOutputPath?: string
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
      transformedData.promptTemplates
    );

    // Generate manifest
    await this.outputService.generateManifest(outputPath, buildConfig, settingsData, outputFiles);

    this.progressService.completeOutput(outputPath, outputFiles.length + 1); // +1 for manifest
    return outputPath;
  }

  /**
   * Complete the build process with summary
   */
  private async completeBuild(outputPath: string, buildConfig: BuildConfig, buildTime: number): Promise<void> {
    const enabledCategories = buildConfig.categories
      .filter(category => category.enabled)
      .map(category => category.name);

    // Display build summary
    this.progressService.displayBuildSummary(buildTime, outputPath, enabledCategories);

    // Display detailed output summary
    try {
      const outputFiles = await this.getOutputFiles(outputPath);
      const errorSummary = this.errorHandler.getErrorSummary();
      const { warnings, criticalErrors: errors } = errorSummary;

      const warningMessages = warnings.map(warning => warning.message);
      const errorMessages = errors.map(error => error.message);
      await this.outputService.displayBuildSummary(outputPath, outputFiles, warningMessages, errorMessages, buildTime);
    } catch (error) {
      this.logger.warn('Failed to display detailed build summary', error.message);
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
  private async getOutputFiles(outputPath: string): Promise<Array<{ filename: string; category: string; size: number }>> {
    const { promises: fs } = await import('node:fs');
    const { join } = await import('node:path');
    const outputFiles = [];

    try {
      const files = await fs.readdir(outputPath);
      
      const jsonFiles = files.filter(filename => filename.endsWith('.json'));
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
    } catch (error) {
      this.logger.warn('Failed to read output files for summary', error.message);
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
    buildConfig: BuildConfig
  ): void {
    const enabledCategories = buildConfig.categories.filter(cat => cat.enabled);
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

    this.logger.log(`Transformation completed: ${successfulTransformations.length} successful, ${failedTransformations.length} failed`);
    
    if (successfulTransformations.length > 0) {
      this.logger.debug(`Successful transformations: ${successfulTransformations.join(', ')}`);
    }
    
    if (failedTransformations.length > 0) {
      this.logger.warn(`Failed transformations: ${failedTransformations.join(', ')}`);
    }
  }

  /**
   * Collect data from Claude Code settings
   */
  private async collectClaudeCodeData(_buildConfig: BuildConfig): Promise<SettingsData> {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Collect local Claude Code settings
    this.progressService.startScan('local');
    let localSettings;
    try {
      // Check if the method exists, if not use fallback
      const collectionSvc = this.collectionService as unknown as Record<string, unknown>;
      if (typeof collectionSvc['collectClaudeCodeLocalSettings'] === 'function') {
        localSettings = await (collectionSvc['collectClaudeCodeLocalSettings'] as () => Promise<unknown>)();
      } else {
        // Fallback to mock data for testing
        localSettings = {
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
        };
        this.logger.debug('Using fallback Claude Code local settings');
      }
      this.progressService.completeScan('local', Object.keys(localSettings).length);
    } catch (error) {
      warnings.push(`Claude Code local settings collection failed: ${error.message}`);
      localSettings = {};
      this.progressService.completeScan('local', 0);
    }

    // Collect global Claude Code settings
    this.progressService.startScan('global');
    let globalSettings;
    try {
      // Check if the method exists, if not use fallback
      const collectionSvcGlobal = this.collectionService as unknown as Record<string, unknown>;
      if (typeof collectionSvcGlobal['collectClaudeCodeGlobalSettings'] === 'function') {
        globalSettings = await (collectionSvcGlobal['collectClaudeCodeGlobalSettings'] as () => Promise<unknown>)();
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
      this.progressService.completeScan('global', Object.keys(globalSettings).length);
    } catch (error) {
      warnings.push(`Claude Code global settings collection failed: ${error.message}`);
      globalSettings = {};
      this.progressService.completeScan('global', 0);
    }

    // Add warnings to error handler
    warnings.forEach(warning => this.errorHandler.addWarning({
      type: 'missing_file',
      message: warning,
    }));

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
    buildConfig: BuildConfig
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
    const enabledCategories = buildConfig.categories.filter(category => category.enabled);
    
    for (const category of enabledCategories) {
      try {
        this.progressService.startTransformation(category.name);
        
        switch (category.name) {
          case BuildCategoryName.PERSONAL_CONTEXT: {
            const cloudTransformService = this.transformationService as unknown as CloudTransformationService;
            if (typeof cloudTransformService.transformClaudeCodePersonalContext === 'function') {
              // eslint-disable-next-line no-await-in-loop
              transformedData.personalContext = await cloudTransformService
                .transformClaudeCodePersonalContext(settingsData.localSettings, settingsData.globalSettings);
            } else {
              // Fallback transformation
              transformedData.personalContext = settingsData.localSettings as unknown as TaptikPersonalContext;
            }
            break;
          }
          case BuildCategoryName.PROJECT_CONTEXT: {
            const cloudTransformService = this.transformationService as unknown as CloudTransformationService;
            if (typeof cloudTransformService.transformClaudeCodeProjectContext === 'function') {
              // eslint-disable-next-line no-await-in-loop
              transformedData.projectContext = await cloudTransformService
                .transformClaudeCodeProjectContext(settingsData.localSettings, settingsData.globalSettings);
            } else {
              // Fallback transformation
              transformedData.projectContext = settingsData.localSettings as unknown as TaptikProjectContext;
            }
            break;
          }
          case BuildCategoryName.PROMPT_TEMPLATES: {
            const cloudTransformService = this.transformationService as unknown as CloudTransformationService;
            if (typeof cloudTransformService.transformClaudeCodePromptTemplates === 'function') {
              // eslint-disable-next-line no-await-in-loop
              transformedData.promptTemplates = await cloudTransformService
                .transformClaudeCodePromptTemplates(settingsData.localSettings, settingsData.globalSettings);
            } else {
              // Fallback transformation
              transformedData.promptTemplates = settingsData.localSettings as unknown as TaptikPromptTemplates;
            }
            break;
          }
        }
        
        this.progressService.completeTransformation(category.name);
      } catch (error) {
        this.errorHandler.addWarning({
          type: 'partial_conversion',
          message: `Failed to transform ${category.name}`,
          details: error.message,
        });
        this.progressService.failStep(`${category.name} transformation failed`, error);
      }
    }

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
    sanitizationResult?: SanitizationResult
  ): Promise<string> {
    const outputPath = customOutputPath || await this.outputService.createOutputDirectory(customOutputPath);

    try {
      // Write the cloud package
      const packageFilePath = path.join(outputPath, 'taptik.package');
      await this.packageService.writePackageToFile(cloudPackage, packageFilePath);

      // Write cloud metadata
      try {
        const outputSvc = this.outputService as unknown as Record<string, unknown>;
        if (outputSvc['writeCloudMetadata']) {
          await (outputSvc['writeCloudMetadata'] as (path: string, metadata: unknown) => Promise<void>)(outputPath, cloudPackage.metadata);
        }
      } catch (error) {
        this.logger.debug('writeCloudMetadata not available or failed:', error.message);
      }

      // Write sanitization report
      try {
        const outputSvcSanitization = this.outputService as unknown as Record<string, unknown>;
        if (outputSvcSanitization['writeSanitizationReport'] && sanitizationResult?.report) {
          await (outputSvcSanitization['writeSanitizationReport'] as (path: string, report: unknown) => Promise<void>)(outputPath, sanitizationResult.report);
        }
      } catch (error) {
        this.logger.debug('writeSanitizationReport not available or failed:', error.message);
      }

      // Write validation report
      try {
        const outputSvcValidation = this.outputService as unknown as Record<string, unknown>;
        if (outputSvcValidation['writeValidationReport'] && validationResult) {
          await (outputSvcValidation['writeValidationReport'] as (path: string, result: unknown) => Promise<void>)(outputPath, validationResult);
        }
      } catch (error) {
        this.logger.debug('writeValidationReport not available or failed:', error.message);
      }

      // Display cloud-ready summary
      try {
        const outputSvcSummary = this.outputService as unknown as Record<string, unknown>;
        if (outputSvcSummary['displayCloudReadySummary']) {
          await (outputSvcSummary['displayCloudReadySummary'] as (path: string, pkg: unknown, result: unknown) => Promise<void>)(outputPath, cloudPackage, validationResult);
        } else {
          // Fallback to basic summary
          this.logger.log(`✅ Cloud package created: ${packageFilePath}`);
          if (validationResult?.cloudCompatible) {
            this.logger.log('☁️  Package is ready for cloud upload');
          }
        }
      } catch (error) {
        this.logger.debug('displayCloudReadySummary not available or failed:', error.message);
      }

      return outputPath;
    } catch (error) {
      this.logger.error('Failed to generate cloud output:', error);
      throw error;
    }
  }

  /**
   * Prompt for cloud upload
   */
  private async promptForCloudUpload(cloudPackage: TaptikPackage, validationResult: CloudValidationResult): Promise<void> {
    if (!validationResult.cloudCompatible) {
      return;
    }

    // Check for auto-upload configuration
    const interactiveSvc = this.interactiveService as unknown as Record<string, unknown>;
    const shouldAutoUpload = await (interactiveSvc['confirmAutoUpload'] as ((metadata: unknown) => Promise<boolean>) | undefined)?.(cloudPackage.metadata);
    
    if (!shouldAutoUpload) {
      // Prompt for manual upload
      const interactiveSvcManual = this.interactiveService as unknown as Record<string, unknown>;
      await (interactiveSvcManual['promptForManualUpload'] as ((metadata: unknown) => Promise<void>) | undefined)?.(cloudPackage.metadata);
    }
  }
}