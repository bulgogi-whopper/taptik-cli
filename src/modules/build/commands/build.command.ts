import { Command, CommandRunner, Option } from 'nest-commander';
import { Logger } from '@nestjs/common';

import { InteractiveService } from '../services/interactive.service';
import { CollectionService } from '../services/collection.service';
import { TransformationService } from '../services/transformation.service';
import { OutputService } from '../services/output.service';
import { ProgressService } from '../services/progress.service';
import { ErrorHandlerService } from '../services/error-handler.service';
import { BuildConfig, BuildPlatform, BuildCategoryName } from '../interfaces/build-config.interface';
import { SettingsData } from '../interfaces/settings-data.interface';
import { TaptikPersonalContext, TaptikProjectContext, TaptikPromptTemplates } from '../interfaces/taptik-format.interface';

@Command({
  name: 'build',
  description: 'Build taptik-compatible context files from Kiro settings',
  examples: [
    'build                           # Interactive build with prompts',
    'build --dry-run                 # Preview what would be built without creating files',
    'build --output ./my-output      # Specify custom output directory',
    'build --verbose                 # Show detailed progress information',
    'build --platform kiro           # Skip platform selection (use "kiro")',
    'build --categories personal,project  # Build only specific categories',
  ],
})
export class BuildCommand extends CommandRunner {
  private readonly logger = new Logger(BuildCommand.name);

  constructor(
    private readonly interactiveService: InteractiveService,
    private readonly collectionService: CollectionService,
    private readonly transformationService: TransformationService,
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
  parseOutputPath(val: string): string {
    return val;
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
  parsePlatform(val: string): BuildPlatform {
    const platform = val.toLowerCase();
    if (platform === 'kiro') return BuildPlatform.KIRO;
    if (platform === 'cursor') return BuildPlatform.CURSOR;
    if (platform === 'claude-code') return BuildPlatform.CLAUDE_CODE;
    throw new Error(`Invalid platform: ${val}. Must be one of: kiro, cursor, claude-code`);
  }

  @Option({
    flags: '--categories <categories>',
    description: 'Comma-separated list of categories to build (personal, project, prompts)',
  })
  parseCategories(val: string): string[] {
    return val.split(',').map(cat => cat.trim().toLowerCase());
  }

  @Option({
    flags: '--quiet',
    description: 'Suppress non-essential output (opposite of --verbose)',
  })
  parseQuiet(): boolean {
    return true;
  }

  async run(passedParams: string[], options?: Record<string, unknown>): Promise<void> {
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

      // Initialize progress tracking
      this.progressService.initializeProgress([
        'Platform selection',
        'Category selection',
        'Data collection',
        'Data transformation',
        'Output generation',
        'Build completion'
      ]);

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
        categories = presetCategories.map(cat => {
          const categoryMap: Record<string, BuildCategoryName> = {
            'personal': BuildCategoryName.PERSONAL_CONTEXT,
            'project': BuildCategoryName.PROJECT_CONTEXT, 
            'prompts': BuildCategoryName.PROMPT_TEMPLATES,
          };
          
          const categoryName = categoryMap[cat];
          if (!categoryName) {
            throw new Error(`Invalid category: ${cat}. Must be one of: personal, project, prompts`);
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
        categories: categories,
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

      // Step 4: Output generation
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
      
      const outputPath = await this.generateOutput(transformedData, buildConfig, settingsData, customOutputPath);
      
      if (this.errorHandler.isProcessInterrupted()) {
        return;
      }
      this.progressService.completeStep('Output generation');

      // Step 5: Build completion
      this.progressService.startStep('Build completion');
      const buildTime = Date.now() - startTime;
      await this.completeBuild(outputPath, buildConfig, buildTime);
      this.progressService.completeStep('Build completion');

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
  private async collectData(buildConfig: BuildConfig): Promise<SettingsData> {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Collect local settings
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
        sourcePlatform: buildConfig.platform,
        collectionTimestamp: new Date().toISOString(),
        projectPath: process.cwd(),
        globalPath: require('os').homedir() + '/.kiro',
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
    const transformedData: {
      personalContext?: TaptikPersonalContext;
      projectContext?: TaptikProjectContext;
      promptTemplates?: TaptikPromptTemplates;
    } = {};

    // Transform each enabled category
    for (const category of buildConfig.categories.filter(cat => cat.enabled)) {
      try {
        this.progressService.startTransformation(category.name);

        switch (category.name) {
          case BuildCategoryName.PERSONAL_CONTEXT:
            transformedData.personalContext = await this.transformationService.transformPersonalContext(settingsData);
            break;
          case BuildCategoryName.PROJECT_CONTEXT:
            transformedData.projectContext = await this.transformationService.transformProjectContext(settingsData);
            break;
          case BuildCategoryName.PROMPT_TEMPLATES:
            transformedData.promptTemplates = await this.transformationService.transformPromptTemplates(settingsData);
            break;
        }

        this.progressService.completeTransformation(category.name);
      } catch (error) {
        this.errorHandler.addWarning({
          type: 'partial_conversion',
          message: `Failed to transform ${category.name}`,
          details: error.message,
        });
        this.progressService.failStep(`Failed to transform ${category.name}`, error);
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
    this.logger.log(`📋 Categories to build: ${enabledCategories.map(c => c.name).join(', ')}`);
    
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
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
      .filter(cat => cat.enabled)
      .map(cat => cat.name);

    // Display build summary
    this.progressService.displayBuildSummary(buildTime, outputPath, enabledCategories);

    // Display detailed output summary
    try {
      const outputFiles = await this.getOutputFiles(outputPath);
      const errorSummary = this.errorHandler.getErrorSummary();
      const warnings = errorSummary.warnings;
      const errors = errorSummary.criticalErrors;

      const warningMessages = warnings.map(w => w.message);
      const errorMessages = errors.map(e => e.message);
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
    const random = Math.random().toString(36).substring(2, 8);
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
    const { promises: fs } = await import('fs');
    const { join } = await import('path');
    const outputFiles = [];

    try {
      const files = await fs.readdir(outputPath);
      
      for (const filename of files) {
        if (filename.endsWith('.json')) {
          const filePath = join(outputPath, filename);
          const stats = await fs.stat(filePath);
          
          let category = 'unknown';
          if (filename === 'personal-context.json') category = 'personal-context';
          else if (filename === 'project-context.json') category = 'project-context';
          else if (filename === 'prompt-templates.json') category = 'prompt-templates';
          else if (filename === 'manifest.json') category = 'manifest';

          outputFiles.push({
            filename,
            category,
            size: stats.size,
          });
        }
      }
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
}