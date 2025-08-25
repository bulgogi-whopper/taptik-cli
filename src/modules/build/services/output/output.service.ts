import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import {
  CloudMetadata,
  SanitizationResult,
  TaptikPackage,
  ValidationResult,
} from '../../../context/interfaces/cloud.interface';
import { BuildConfig } from '../../interfaces/build-config.interface';
import { SettingsData } from '../../interfaces/settings-data.interface';
import {
  TaptikPersonalContext,
  TaptikProjectContext,
  TaptikPromptTemplates,
  TaptikManifest,
  SourceFile,
  OutputFile,
} from '../../interfaces/taptik-format.interface';
import { FileSystemErrorHandler } from '../../utils/file-system-error-handler';

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
      const workingDirectory = basePath || process.cwd();
      const timestamp = this.generateTimestamp();
      const baseOutputPath = join(
        workingDirectory,
        `taptik-build-${timestamp}`,
      );

      const uniqueOutputPath = await this.findUniqueDirectoryPath(
        baseOutputPath,
        timestamp,
        workingDirectory,
      );

      await fs.mkdir(uniqueOutputPath, { recursive: true });
      this.logger.log(`Created output directory: ${uniqueOutputPath}`);

      return resolve(uniqueOutputPath);
    } catch (error) {
      const errorResult = FileSystemErrorHandler.handleError(
        error,
        'creating output directory',
        basePath || process.cwd(),
      );

      FileSystemErrorHandler.logErrorResult(errorResult);

      if (errorResult.isCritical) {
        throw new Error(
          `${errorResult.userMessage}. ${errorResult.suggestions.join(' ')}`,
        );
      } else {
        this.logger.warn(
          `Non-critical error during directory creation: ${errorResult.userMessage}`,
        );
        // Try to continue with a fallback directory
        return this.createFallbackDirectory();
      }
    }
  }

  /**
   * Find a unique directory path by checking for conflicts and incrementing counter
   * @param baseOutputPath Initial path to try
   * @param timestamp Timestamp for directory naming
   * @param workingDirectory Working directory for fallback paths
   * @returns Promise resolving to a unique directory path
   */
  private async findUniqueDirectoryPath(
    baseOutputPath: string,
    timestamp: string,
    workingDirectory: string,
  ): Promise<string> {
    // Check if the base path is available
    if (!(await this.directoryExists(baseOutputPath))) {
      return baseOutputPath;
    }

    // If base path exists, try numbered alternatives in batches
    const maxAttempts = 1000;
    const batchSize = 10; // Check paths in batches to avoid overwhelming the system

    return this.checkDirectoryBatches(
      workingDirectory,
      timestamp,
      maxAttempts,
      batchSize,
    );
  }

  /**
   * Check directory existence in batches to find an available path
   * @param workingDirectory Working directory for path generation
   * @param timestamp Timestamp for directory naming
   * @param maxAttempts Maximum number of attempts
   * @param batchSize Number of paths to check per batch
   * @returns Promise resolving to an available directory path
   */
  private async checkDirectoryBatches(
    workingDirectory: string,
    timestamp: string,
    maxAttempts: number,
    batchSize: number,
  ): Promise<string> {
    // Generate all batch ranges
    const batchRanges: Array<{ start: number; end: number }> = [];
    for (
      let startCounter = 1;
      startCounter <= maxAttempts;
      startCounter += batchSize
    ) {
      const endCounter = Math.min(startCounter + batchSize - 1, maxAttempts);
      batchRanges.push({ start: startCounter, end: endCounter });
    }

    // Process batches recursively to avoid await in loop
    return this.processBatchRanges(workingDirectory, timestamp, batchRanges, 0);
  }

  /**
   * Process batch ranges recursively to find an available directory path
   * @param workingDirectory Working directory for path generation
   * @param timestamp Timestamp for directory naming
   * @param batchRanges Array of batch ranges to process
   * @param batchIndex Current batch index being processed
   * @returns Promise resolving to an available directory path
   */
  private async processBatchRanges(
    workingDirectory: string,
    timestamp: string,
    batchRanges: Array<{ start: number; end: number }>,
    batchIndex: number,
  ): Promise<string> {
    if (batchIndex >= batchRanges.length) {
      throw new Error(
        `Unable to create unique directory after ${batchRanges.length * 10} attempts`,
      );
    }

    const { start, end } = batchRanges[batchIndex];

    // Create batch of directory existence check promises
    const pathChecks = this.createBatchPathChecks(
      workingDirectory,
      timestamp,
      start,
      end,
    );

    // Execute all checks in this batch concurrently
    const results = await Promise.all(pathChecks);

    // Find the first available path
    const availablePath = results.find((result) => !result.exists);
    if (availablePath) {
      return availablePath.path;
    }

    // Recursively check the next batch
    return this.processBatchRanges(
      workingDirectory,
      timestamp,
      batchRanges,
      batchIndex + 1,
    );
  }

  /**
   * Create an array of directory existence check promises for a batch
   * @param workingDirectory Working directory for path generation
   * @param timestamp Timestamp for directory naming
   * @param startCounter Starting counter for the batch
   * @param endCounter Ending counter for the batch
   * @returns Array of promises that check directory existence
   */
  private createBatchPathChecks(
    workingDirectory: string,
    timestamp: string,
    startCounter: number,
    endCounter: number,
  ): Promise<{ counter: number; path: string; exists: boolean }>[] {
    const checks: Promise<{
      counter: number;
      path: string;
      exists: boolean;
    }>[] = [];

    for (let counter = startCounter; counter <= endCounter; counter++) {
      const path = join(
        workingDirectory,
        `taptik-build-${timestamp}-${counter}`,
      );

      // Create a promise that checks if this specific path exists
      const checkPromise = (async () => {
        const exists = await this.directoryExists(path);
        return { counter, path, exists };
      })();

      checks.push(checkPromise);
    }

    return checks;
  }

  /**
   * Create fallback directory in system temp location
   * @returns Path to fallback directory
   */
  private async createFallbackDirectory(): Promise<string> {
    try {
      const temporaryDirectory = tmpdir();
      const timestamp = this.generateTimestamp();
      const fallbackPath = join(
        temporaryDirectory,
        `taptik-build-${timestamp}`,
      );

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

        this.logger.log(
          `Written personal context: ${filePath} (${stats.size} bytes)`,
        );
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

        this.logger.log(
          `Written project context: ${filePath} (${stats.size} bytes)`,
        );
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

        this.logger.log(
          `Written prompt templates: ${filePath} (${stats.size} bytes)`,
        );
      }

      return outputFiles;
    } catch (error) {
      const errorResult = FileSystemErrorHandler.handleError(
        error,
        'writing output files',
        outputPath,
      );

      FileSystemErrorHandler.logErrorResult(errorResult);

      if (errorResult.isCritical) {
        throw new Error(
          `${errorResult.userMessage}. ${errorResult.suggestions.join(' ')}`,
        );
      } else {
        this.logger.warn(
          `Non-critical error during file writing: ${errorResult.userMessage}`,
        );
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
        categories: config.categories
          .filter((cat) => cat.enabled)
          .map((cat) => cat.name as string),
        created_at: new Date().toISOString(),
        taptik_version: '1.0.0',
        source_files: await this.collectSourceFiles(settingsData),
        output_files: outputFiles,
      };

      const manifestPath = join(outputPath, 'manifest.json');
      const content = JSON.stringify(manifest, null, 2);

      await fs.writeFile(manifestPath, content, 'utf8');

      const stats = await fs.stat(manifestPath);
      this.logger.log(
        `Generated manifest: ${manifestPath} (${stats.size} bytes)`,
      );
    } catch (error) {
      const errorResult = FileSystemErrorHandler.handleError(
        error,
        'generating manifest file',
        outputPath,
      );

      FileSystemErrorHandler.logErrorResult(errorResult);

      if (errorResult.isCritical) {
        throw new Error(
          `${errorResult.userMessage}. ${errorResult.suggestions.join(' ')}`,
        );
      } else {
        this.logger.warn(
          `Non-critical error during manifest generation: ${errorResult.userMessage}`,
        );
      }
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
  private async collectSourceFiles(
    settingsData: SettingsData,
  ): Promise<SourceFile[]> {
    const sourceFiles: SourceFile[] = [];

    try {
      // Add local settings files
      const localBasePath = settingsData.collectionMetadata.projectPath;

      if (settingsData.localSettings.contextMd) {
        sourceFiles.push(
          await this.createSourceFile(
            join(localBasePath, '.kiro/settings/context.md'),
            'markdown',
          ),
        );
      }

      if (settingsData.localSettings.userPreferencesMd) {
        sourceFiles.push(
          await this.createSourceFile(
            join(localBasePath, '.kiro/settings/user-preferences.md'),
            'markdown',
          ),
        );
      }

      if (settingsData.localSettings.projectSpecMd) {
        sourceFiles.push(
          await this.createSourceFile(
            join(localBasePath, '.kiro/settings/project-spec.md'),
            'markdown',
          ),
        );
      }

      // steering files 병렬 처리
      const steeringFilePromises = settingsData.localSettings.steeringFiles
        .filter((steeringFile) => steeringFile.path)
        .map((steeringFile) =>
          this.createSourceFile(steeringFile.path!, 'markdown'),
        );

      // hook files 병렬 처리
      const hookFilePromises = settingsData.localSettings.hooks
        .filter((hookFile) => hookFile.path)
        .map((hookFile) => this.createSourceFile(hookFile.path!, 'hook'));

      // 모든 파일을 동시에 처리
      const [steeringFiles, hookFiles] = await Promise.all([
        Promise.all(steeringFilePromises),
        Promise.all(hookFilePromises),
      ]);

      // 결과 합치기
      sourceFiles.push(
        ...steeringFiles.filter(Boolean),
        ...hookFiles.filter(Boolean),
      );

      // Add global settings files
      const globalBasePath = settingsData.collectionMetadata.globalPath;

      if (settingsData.globalSettings.userConfig) {
        sourceFiles.push(
          await this.createSourceFile(
            join(globalBasePath, 'user-config.md'),
            'config',
          ),
        );
      }

      if (settingsData.globalSettings.preferences) {
        sourceFiles.push(
          await this.createSourceFile(
            join(globalBasePath, 'global-preferences.md'),
            'config',
          ),
        );
      }
    } catch (error) {
      this.logger.warn('Failed to collect some source files', error.message);
    }

    return sourceFiles.filter((file) => file !== null);
  }

  /**
   * Create source file information
   */
  private async createSourceFile(
    path: string,
    type: string,
  ): Promise<SourceFile | null> {
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
   * Generic method to write JSON data to file
   * @param outputPath Path to the output directory
   * @param filename Name of the file to write
   * @param data Data to write (will be JSON stringified)
   * @param category Category for the output file
   * @param description Human-readable description for logging
   * @returns Output file information
   */
  private async writeJsonFile(
    outputPath: string,
    filename: string,
    data: unknown,
    category: string,
    description: string,
  ): Promise<OutputFile> {
    const filePath = join(outputPath, filename);

    try {
      // Validate output path exists
      await this.validateOutputPath(outputPath);

      // Convert data to JSON with proper formatting
      const content = JSON.stringify(data, null, 2);

      // Write file with progress indicator
      this.logger.debug(`Writing ${description} to ${filePath}...`);
      await fs.writeFile(filePath, content, 'utf8');

      // Get file stats for size information
      const stats = await fs.stat(filePath);
      const outputFile: OutputFile = {
        filename,
        category,
        size: stats.size,
      };

      // Log success with formatted size
      this.logger.log(
        `✅ Written ${description}: ${filename} (${this.formatBytes(stats.size)})`,
      );

      return outputFile;
    } catch (error) {
      const errorResult = FileSystemErrorHandler.handleError(
        error,
        `writing ${description}`,
        filePath,
      );

      FileSystemErrorHandler.logErrorResult(errorResult);

      // Enhanced error message with actionable guidance
      const enhancedMessage = this.enhanceErrorMessage(
        errorResult.userMessage,
        errorResult.suggestions,
        filePath,
      );

      throw new Error(enhancedMessage);
    }
  }

  /**
   * Validate that output path exists and is writable
   * @param outputPath Path to validate
   */
  private async validateOutputPath(outputPath: string): Promise<void> {
    try {
      await fs.access(outputPath, fs.constants.W_OK);
    } catch {
      // Try to create the directory if it doesn't exist
      await fs.mkdir(outputPath, { recursive: true });
    }
  }

  /**
   * Enhance error messages with more context and guidance
   * @param baseMessage Base error message
   * @param suggestions Array of suggestions
   * @param path Related file path
   * @returns Enhanced error message
   */
  private enhanceErrorMessage(
    baseMessage: string,
    suggestions: string[],
    path: string,
  ): string {
    const enhancedSuggestions = [
      ...suggestions,
      `Path: ${path}`,
      'Ensure the directory exists and has write permissions',
      'Check available disk space',
    ];

    return `${baseMessage}\n💡 Suggestions:\n${enhancedSuggestions.map((s) => `  • ${s}`).join('\n')}`;
  }

  /**
   * Write cloud metadata to JSON file
   * @param outputPath Path to the output directory
   * @param metadata Cloud metadata to write
   * @returns Output file information
   */
  async writeCloudMetadata(
    outputPath: string,
    metadata: CloudMetadata,
  ): Promise<OutputFile> {
    return this.writeJsonFile(
      outputPath,
      'cloud-metadata.json',
      metadata,
      'cloud-metadata',
      'cloud metadata',
    );
  }

  /**
   * Write sanitization report to JSON file
   * @param outputPath Path to the output directory
   * @param sanitizationResult Sanitization result to write
   * @returns Output file information
   */
  async writeSanitizationReport(
    outputPath: string,
    sanitizationResult: SanitizationResult,
  ): Promise<OutputFile> {
    // Create a serializable version of the report
    const reportData = {
      securityLevel: sanitizationResult.securityLevel,
      findings: sanitizationResult.findings,
      report: {
        ...sanitizationResult.report,
        timestamp:
          sanitizationResult.report.timestamp instanceof Date
            ? sanitizationResult.report.timestamp.toISOString()
            : sanitizationResult.report.timestamp,
      },
      severityBreakdown: sanitizationResult.severityBreakdown,
      recommendations: sanitizationResult.recommendations,
    };

    return this.writeJsonFile(
      outputPath,
      'sanitization-report.json',
      reportData,
      'sanitization-report',
      'sanitization report',
    );
  }

  /**
   * Write validation report to JSON file
   * @param outputPath Path to the output directory
   * @param validationResult Validation result to write
   * @returns Output file information
   */
  async writeValidationReport(
    outputPath: string,
    validationResult: ValidationResult,
  ): Promise<OutputFile> {
    return this.writeJsonFile(
      outputPath,
      'validation-report.json',
      validationResult,
      'validation-report',
      'validation report',
    );
  }

  /**
   * Create cloud-ready output directory structure
   * @param outputPath Base output path
   * @returns Structure information with full paths
   */
  async createCloudReadyOutputStructure(
    outputPath: string,
  ): Promise<{ directories: string[]; paths: Record<string, string> }> {
    try {
      // Define directory structure with descriptions
      const directoryConfig = [
        { name: 'cloud', description: 'Cloud package files' },
        { name: 'reports', description: 'Sanitization and validation reports' },
        { name: 'metadata', description: 'Cloud metadata and manifests' },
      ];

      // Validate base output path
      await this.validateOutputPath(outputPath);

      // Create all directories in parallel with progress logging
      this.logger.debug('Creating cloud output directory structure...');

      const createPromises = directoryConfig.map(
        async ({ name, description }) => {
          const dirPath = join(outputPath, name);
          await fs.mkdir(dirPath, { recursive: true });
          this.logger.debug(`  📁 ${name}/ - ${description}`);
          return { name, path: dirPath };
        },
      );

      const results = await Promise.all(createPromises);

      // Build response with directory names and full paths
      const directories = results.map((r) => r.name);
      const paths = results.reduce(
        (acc, { name, path }) => {
          acc[name] = path;
          return acc;
        },
        {} as Record<string, string>,
      );

      this.logger.log('✅ Cloud output structure created successfully');

      return { directories, paths };
    } catch (error) {
      const errorResult = FileSystemErrorHandler.handleError(
        error,
        'creating cloud output structure',
        outputPath,
      );

      FileSystemErrorHandler.logErrorResult(errorResult);

      const enhancedMessage = this.enhanceErrorMessage(
        errorResult.userMessage,
        errorResult.suggestions,
        outputPath,
      );

      throw new Error(enhancedMessage);
    }
  }

  /**
   * Display comprehensive build summary and completion information
   * @param outputPath Path to the output directory
   * @param outputFiles Generated output files
   * @param warnings Optional array of warning messages
   * @param errors Optional array of error messages
   * @param buildTime Optional build duration in milliseconds
   * @param cloudPackage Optional cloud package information
   */
  async displayBuildSummary(
    outputPath: string,
    outputFiles: OutputFile[],
    warnings: string[] = [],
    errors: string[] = [],
    buildTime?: number,
    cloudPackage?: TaptikPackage,
  ): Promise<void> {
    try {
      const totalSize = outputFiles.reduce((sum, file) => sum + file.size, 0);
      const formattedSize = this.formatBytes(totalSize);
      const buildTimeFormatted = buildTime
        ? this.formatDuration(buildTime)
        : undefined;

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

      // Display cloud package information if available
      if (cloudPackage) {
        this.displayCloudPackageSummary(cloudPackage);
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
   * Display cloud package summary with enhanced formatting
   * @param cloudPackage Cloud package information
   */
  private displayCloudPackageSummary(cloudPackage: TaptikPackage): void {
    this.logger.log('');
    this.logger.log('☁️  Cloud Package Information:');
    this.logger.log('─'.repeat(50));

    // Basic Information
    this.logger.log(
      `  📦 Title: ${cloudPackage.metadata.title || 'Untitled Package'}`,
    );

    // Tags with better formatting
    if (cloudPackage.metadata.tags && cloudPackage.metadata.tags.length > 0) {
      this.logger.log(`  🏷️  Tags: ${cloudPackage.metadata.tags.join(', ')}`);
    }

    // Component breakdown with detailed counts
    const components = cloudPackage.metadata.componentCount;
    const componentParts: string[] = [];

    if (components.agents > 0) {
      componentParts.push(
        `${components.agents} agent${components.agents > 1 ? 's' : ''}`,
      );
    }
    if (components.commands > 0) {
      componentParts.push(
        `${components.commands} command${components.commands > 1 ? 's' : ''}`,
      );
    }
    if (components.mcpServers > 0) {
      componentParts.push(
        `${components.mcpServers} MCP server${components.mcpServers > 1 ? 's' : ''}`,
      );
    }
    if (components.steeringRules > 0) {
      componentParts.push(
        `${components.steeringRules} steering rule${components.steeringRules > 1 ? 's' : ''}`,
      );
    }

    if (componentParts.length > 0) {
      this.logger.log(`  📊 Components: ${componentParts.join(', ')}`);
    } else {
      this.logger.log('  📊 Components: No components configured');
    }

    // Security status with color coding (through emoji)
    const securityStatus = cloudPackage.sanitizedConfig
      ? '✅ Sanitized (safe for sharing)'
      : '⚠️  Not sanitized (may contain sensitive data)';
    this.logger.log(`  🔒 Security: ${securityStatus}`);

    // Package details
    this.logger.log(
      `  💾 Package Size: ${this.formatBytes(cloudPackage.size)}`,
    );
    this.logger.log(`  📦 Format: ${cloudPackage.format || 'taptik-v1'}`);
    this.logger.log(`  🗜️  Compression: ${cloudPackage.compression || 'none'}`);

    // Target compatibility
    if (
      cloudPackage.metadata.targetIdes &&
      cloudPackage.metadata.targetIdes.length > 0
    ) {
      const targets = cloudPackage.metadata.targetIdes
        .map((ide) => ide.replace('-', ' '))
        .map((ide) => ide.charAt(0).toUpperCase() + ide.slice(1))
        .join(', ');
      this.logger.log(`  🎯 Compatible IDEs: ${targets}`);
    }

    // Complexity level indicator
    if (cloudPackage.metadata.complexityLevel) {
      const complexityEmoji =
        {
          minimal: '🟢',
          basic: '🟢',
          intermediate: '🟡',
          advanced: '🟠',
          expert: '🔴',
        }[cloudPackage.metadata.complexityLevel] || '⚪';

      this.logger.log(
        `  📈 Complexity: ${complexityEmoji} ${cloudPackage.metadata.complexityLevel}`,
      );
    }

    this.logger.log('─'.repeat(50));
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
      warnings.forEach((warning) => this.logger.warn(`  • ${warning}`));
    }

    if (errors.length > 0) {
      this.logger.log('');
      this.logger.error('❌ Non-critical errors encountered:');
      errors.forEach((error) => this.logger.error(`  • ${error}`));
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

    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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
