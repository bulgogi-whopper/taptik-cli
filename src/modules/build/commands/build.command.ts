import { Command, CommandRunner } from 'nest-commander';
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

  async run(passedParams: string[], options?: Record<string, unknown>): Promise<void> {
    const startTime = Date.now();
    
    try {
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

      // Step 1: Interactive platform and category selection
      this.progressService.startStep('Platform selection');
      const platform = await this.interactiveService.selectPlatform();
      
      if (this.errorHandler.isProcessInterrupted()) {
        return;
      }
      this.progressService.completeStep('Platform selection');

      this.progressService.startStep('Category selection');
      const categories = await this.interactiveService.selectCategories();
      
      if (this.errorHandler.isProcessInterrupted()) {
        return;
      }
      this.progressService.completeStep('Category selection');

      // Create build configuration
      const buildConfig: BuildConfig = {
        platform: platform as BuildPlatform,
        categories: categories,
        outputDirectory: '', // Will be set by output service
        timestamp: new Date().toISOString(),
        buildId: this.generateBuildId(),
      };

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

      // Step 4: Output generation
      this.progressService.startStep('Output generation');
      const outputPath = await this.generateOutput(transformedData, buildConfig, settingsData);
      
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
    warnings.forEach(warning => this.errorHandler.addWarning(warning));

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
        this.errorHandler.addWarning(`Failed to transform ${category.name}: ${error.message}`);
        this.progressService.failStep(`Failed to transform ${category.name}`, error);
      }
    }

    return transformedData;
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
    settingsData: SettingsData
  ): Promise<string> {
    // Create output directory
    this.progressService.startOutput();
    const outputPath = await this.outputService.createOutputDirectory();
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
      const warnings = this.errorHandler.getWarnings();
      const errors = this.errorHandler.getErrors();

      await this.outputService.displayBuildSummary(outputPath, outputFiles, warnings, errors, buildTime);
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
}