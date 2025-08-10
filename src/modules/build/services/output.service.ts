import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';

import { SettingsData } from '../interfaces/settings-data.interface';
import {
  TaptikPersonalContext,
  TaptikProjectContext,
  TaptikPromptTemplates,
  TaptikManifest,
  SourceFile,
  OutputFile,
} from '../interfaces/taptik-format.interface';
import { BuildConfig, BuildCategoryName } from '../interfaces/build-config.interface';
import { FileSystemErrorHandler } from '../utils/file-system-error-handler';

/**
 * Service responsible for generating output files and directory structure
 * Creates timestamped directories and writes transformed data to JSON files
 */
@Injectable()
export class OutputService {
  private readonly logger = new Logger(OutputService.name);

  /**
   * Create timestamped output directory with conflict resolution
   * @param basePath Base path for directory creation (default: current working directory)
   * @returns Path to the created directory
   */
  async createOutputDirectory(basePath?: string): Promise<string> {
    try {
      const workingDir = basePath || process.cwd();
      const timestamp = this.generateTimestamp();
      let outputPath = join(workingDir, `taptik-build-${timestamp}`);
      let counter = 1;

      // Handle directory conflicts with incremental numbering
      while (await this.directoryExists(outputPath)) {
        outputPath = join(workingDir, `taptik-build-${timestamp}-${counter}`);
        counter++;

        // Prevent infinite loops
        if (counter > 1000) {
          throw new Error('Unable to create unique directory after 1000 attempts');
        }
      }

      await fs.mkdir(outputPath, { recursive: true });
      this.logger.log(`Created output directory: ${outputPath}`);

      return resolve(outputPath);
    } catch (error) {
      const errorResult = FileSystemErrorHandler.handleError(
        error,
        'creating output directory',
        basePath || process.cwd()
      );
      
      FileSystemErrorHandler.logErrorResult(errorResult);
      
      if (errorResult.isCritical) {
        throw new Error(`${errorResult.userMessage}. ${errorResult.suggestions.join(' ')}`);
      } else {
        this.logger.warn(`Non-critical error during directory creation: ${errorResult.userMessage}`);
        // Try to continue with a fallback directory
        return this.createFallbackDirectory();
      }
    }
  }

  /**
   * Create fallback directory in system temp location
   * @returns Path to fallback directory
   */
  private async createFallbackDirectory(): Promise<string> {
    try {
      const tmpdir = require('os').tmpdir();
      const timestamp = this.generateTimestamp();
      const fallbackPath = join(tmpdir, `taptik-build-${timestamp}`);
      
      await fs.mkdir(fallbackPath, { recursive: true });
      this.logger.log(`Created fallback output directory: ${fallbackPath}`);
      
      return resolve(fallbackPath);
    } catch (error) {
      this.logger.error('Failed to create fallback directory', error.stack);
      throw new Error('Unable to create output directory in any location');
    }
  }

  /**
   * Generate timestamp in YYYYMMDD-HHMMSS format
   */
  private generateTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
  }

  /**
   * Write transformed data to JSON files in the output directory
   * @param outputPath Path to the output directory
   * @param personalContext Personal context data (optional)
   * @param projectContext Project context data (optional)
   * @param promptTemplates Prompt templates data (optional)
   */
  async writeOutputFiles(
    outputPath: string,
    personalContext?: TaptikPersonalContext,
    projectContext?: TaptikProjectContext,
    promptTemplates?: TaptikPromptTemplates,
  ): Promise<OutputFile[]> {
    const outputFiles: OutputFile[] = [];
    
    try {

      // Write personal context file
      if (personalContext) {
        const filename = 'personal-context.json';
        const filePath = join(outputPath, filename);
        const content = JSON.stringify(personalContext, null, 2);
        
        await fs.writeFile(filePath, content, 'utf8');
        
        const stats = await fs.stat(filePath);
        outputFiles.push({
          filename,
          category: 'personal-context',
          size: stats.size,
        });

        this.logger.log(`Written personal context: ${filePath} (${stats.size} bytes)`);
      }

      // Write project context file
      if (projectContext) {
        const filename = 'project-context.json';
        const filePath = join(outputPath, filename);
        const content = JSON.stringify(projectContext, null, 2);
        
        await fs.writeFile(filePath, content, 'utf8');
        
        const stats = await fs.stat(filePath);
        outputFiles.push({
          filename,
          category: 'project-context',
          size: stats.size,
        });

        this.logger.log(`Written project context: ${filePath} (${stats.size} bytes)`);
      }

      // Write prompt templates file
      if (promptTemplates) {
        const filename = 'prompt-templates.json';
        const filePath = join(outputPath, filename);
        const content = JSON.stringify(promptTemplates, null, 2);
        
        await fs.writeFile(filePath, content, 'utf8');
        
        const stats = await fs.stat(filePath);
        outputFiles.push({
          filename,
          category: 'prompt-templates',
          size: stats.size,
        });

        this.logger.log(`Written prompt templates: ${filePath} (${stats.size} bytes)`);
      }

      return outputFiles;
    } catch (error) {
      const errorResult = FileSystemErrorHandler.handleError(
        error,
        'writing output files',
        outputPath
      );
      
      FileSystemErrorHandler.logErrorResult(errorResult);
      
      if (errorResult.isCritical) {
        throw new Error(`${errorResult.userMessage}. ${errorResult.suggestions.join(' ')}`);
      } else {
        this.logger.warn(`Non-critical error during file writing: ${errorResult.userMessage}`);
        return outputFiles; // Return partial results
      }
    }
  }

  /**
   * Generate manifest file with build metadata
   * @param outputPath Path to the output directory
   * @param config Build configuration
   * @param settingsData Original settings data
   * @param outputFiles Generated output files
   */
  async generateManifest(
    outputPath: string,
    config: BuildConfig,
    settingsData: SettingsData,
    outputFiles: OutputFile[],
  ): Promise<void> {
    try {
      const manifest: TaptikManifest = {
        build_id: this.generateBuildId(),
        source_platform: settingsData.collectionMetadata.sourcePlatform,
        categories: config.categories.filter(cat => cat.enabled).map(cat => cat.name as string),
        created_at: new Date().toISOString(),
        taptik_version: '1.0.0',
        source_files: await this.collectSourceFiles(settingsData),
        output_files: outputFiles,
      };

      const manifestPath = join(outputPath, 'manifest.json');
      const content = JSON.stringify(manifest, null, 2);
      
      await fs.writeFile(manifestPath, content, 'utf8');
      
      const stats = await fs.stat(manifestPath);
      this.logger.log(`Generated manifest: ${manifestPath} (${stats.size} bytes)`);
    } catch (error) {
      const errorResult = FileSystemErrorHandler.handleError(
        error,
        'generating manifest file',
        outputPath
      );
      
      FileSystemErrorHandler.logErrorResult(errorResult);
      
      if (errorResult.isCritical) {
        throw new Error(`${errorResult.userMessage}. ${errorResult.suggestions.join(' ')}`);
      } else {
        this.logger.warn(`Non-critical error during manifest generation: ${errorResult.userMessage}`);
      }
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
   * Check if directory exists
   */
  private async directoryExists(path: string): Promise<boolean> {
    try {
      const stats = await fs.stat(path);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(path: string): Promise<boolean> {
    try {
      const stats = await fs.stat(path);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Collect source files information from settings data
   */
  private async collectSourceFiles(settingsData: SettingsData): Promise<SourceFile[]> {
    const sourceFiles: SourceFile[] = [];

    try {
      // Add local settings files
      const localBasePath = settingsData.collectionMetadata.projectPath;
      
      if (settingsData.localSettings.contextMd) {
        sourceFiles.push(await this.createSourceFile(join(localBasePath, '.kiro/settings/context.md'), 'markdown'));
      }
      
      if (settingsData.localSettings.userPreferencesMd) {
        sourceFiles.push(await this.createSourceFile(join(localBasePath, '.kiro/settings/user-preferences.md'), 'markdown'));
      }
      
      if (settingsData.localSettings.projectSpecMd) {
        sourceFiles.push(await this.createSourceFile(join(localBasePath, '.kiro/settings/project-spec.md'), 'markdown'));
      }

      // Add steering files
      for (const steeringFile of settingsData.localSettings.steeringFiles) {
        if (steeringFile.path) {
          sourceFiles.push(await this.createSourceFile(steeringFile.path, 'markdown'));
        }
      }

      // Add hook files
      for (const hookFile of settingsData.localSettings.hooks) {
        if (hookFile.path) {
          sourceFiles.push(await this.createSourceFile(hookFile.path, 'hook'));
        }
      }

      // Add global settings files
      const globalBasePath = settingsData.collectionMetadata.globalPath;
      
      if (settingsData.globalSettings.userConfig) {
        sourceFiles.push(await this.createSourceFile(join(globalBasePath, 'user-config.md'), 'config'));
      }

      if (settingsData.globalSettings.preferences) {
        sourceFiles.push(await this.createSourceFile(join(globalBasePath, 'global-preferences.md'), 'config'));
      }

    } catch (error) {
      this.logger.warn('Failed to collect some source files', error.message);
    }

    return sourceFiles.filter(file => file !== null);
  }

  /**
   * Create source file information
   */
  private async createSourceFile(path: string, type: string): Promise<SourceFile | null> {
    try {
      if (await this.fileExists(path)) {
        const stats = await fs.stat(path);
        return {
          path,
          type,
          size: stats.size,
          last_modified: stats.mtime.toISOString(),
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Display comprehensive build summary and completion information
   * @param outputPath Path to the output directory
   * @param outputFiles Generated output files
   * @param warnings Optional array of warning messages
   * @param errors Optional array of error messages
   * @param buildTime Optional build duration in milliseconds
   */
  async displayBuildSummary(
    outputPath: string, 
    outputFiles: OutputFile[], 
    warnings: string[] = [], 
    errors: string[] = [],
    buildTime?: number
  ): Promise<void> {
    try {
      const totalSize = outputFiles.reduce((sum, file) => sum + file.size, 0);
      const formattedSize = this.formatBytes(totalSize);
      const buildTimeFormatted = buildTime ? this.formatDuration(buildTime) : undefined;

      // Main success message
      this.logger.log('');
      this.logger.log('🎉 Build completed successfully!');
      this.logger.log('');
      
      // Build details
      this.logger.log('📊 Build Summary:');
      this.logger.log(`📁 Output directory: ${outputPath}`);
      this.logger.log(`📄 Generated files: ${outputFiles.length}`);
      this.logger.log(`💾 Total size: ${formattedSize}`);
      if (buildTimeFormatted) {
        this.logger.log(`⏱️  Build time: ${buildTimeFormatted}`);
      }
      this.logger.log('');

      // Individual file details
      this.logger.log('📋 Generated Files:');
      for (const file of outputFiles) {
        const fileSize = this.formatBytes(file.size);
        this.logger.log(`  • ${file.filename} (${file.category}): ${fileSize}`);
      }

      // Check for manifest file
      const manifestPath = join(outputPath, 'manifest.json');
      if (await this.fileExists(manifestPath)) {
        const manifestStats = await fs.stat(manifestPath);
        const manifestSize = this.formatBytes(manifestStats.size);
        this.logger.log(`  • manifest.json: ${manifestSize}`);
      }

      // Display warnings and errors if any
      if (warnings.length > 0 || errors.length > 0) {
        this.displayIssuesSummary(warnings, errors);
      }

      this.logger.log('');
    } catch (error) {
      this.logger.error('Failed to display summary', error.stack);
      // Don't throw error for display issues - build was successful
    }
  }

  /**
   * Display warnings and errors summary
   * @param warnings Array of warning messages
   * @param errors Array of error messages
   */
  private displayIssuesSummary(warnings: string[], errors: string[]): void {
    if (warnings.length > 0) {
      this.logger.log('');
      this.logger.warn('⚠️  Warnings encountered during build:');
      warnings.forEach(warning => this.logger.warn(`  • ${warning}`));
    }

    if (errors.length > 0) {
      this.logger.log('');
      this.logger.error('❌ Non-critical errors encountered:');
      errors.forEach(error => this.logger.error(`  • ${error}`));
    }
  }

  /**
   * Format bytes to human-readable string
   * @param bytes Number of bytes
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  /**
   * Format duration in milliseconds to human-readable format
   * @param milliseconds Duration in milliseconds
   */
  private formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    }
    
    const seconds = Math.floor(milliseconds / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
}