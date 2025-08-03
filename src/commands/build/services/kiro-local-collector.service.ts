import { Injectable, Logger } from '@nestjs/common';
import { readFile, readdir, stat } from 'fs-extra';
import { join } from 'node:path';

import { PathResolverUtil } from '../utils/path-resolver.util';
import { LocalSettings, CollectionError } from '../interfaces/collected-settings.interface';

/**
 * Service for collecting local Kiro settings from the .kiro/ directory
 */
@Injectable()
export class KiroLocalCollectorService {
  private readonly logger = new Logger(KiroLocalCollectorService.name);

  /**
   * Collect all local Kiro settings from the current project's .kiro/ directory
   */
  async collectLocalSettings(): Promise<{
    settings: LocalSettings;
    sourceFiles: string[];
    errors: CollectionError[];
  }> {
    const settings: LocalSettings = {};
    const sourceFiles: string[] = [];
    const errors: CollectionError[] = [];

    const paths = PathResolverUtil.getKiroSettingsPaths().local;

    // Collect JSON configuration files
    await this.collectJsonFile(
      paths.contextJson,
      'contextJson',
      settings,
      sourceFiles,
      errors,
    );

    await this.collectJsonFile(
      paths.userPreferences,
      'userPreferencesJson',
      settings,
      sourceFiles,
      errors,
    );

    await this.collectJsonFile(
      paths.projectSpec,
      'projectSpecJson',
      settings,
      sourceFiles,
      errors,
    );

    // Collect directory contents
    await this.collectDirectoryContents(
      paths.promptsDir,
      'prompts',
      settings,
      sourceFiles,
      errors,
    );

    await this.collectDirectoryContents(
      paths.hooksDir,
      'hooks',
      settings,
      sourceFiles,
      errors,
    );

    this.logger.log(`Collected local settings from ${sourceFiles.length} files`);
    if (errors.length > 0) {
      this.logger.warn(`Encountered ${errors.length} errors during collection`);
    }

    return { settings, sourceFiles, errors };
  }

  /**
   * Collect a single JSON configuration file
   */
  private async collectJsonFile(
    filePath: string,
    settingsKey: keyof LocalSettings,
    settings: LocalSettings,
    sourceFiles: string[],
    errors: CollectionError[],
  ): Promise<void> {
    try {
      // Check if file exists and is readable
      if (!(await PathResolverUtil.pathExists(filePath))) {
        this.logger.debug(`File not found: ${filePath}`);
        return;
      }

      if (!(await PathResolverUtil.isReadable(filePath))) {
        const error: CollectionError = {
          file: filePath,
          error: 'Permission denied - file is not readable',
          severity: 'error',
        };
        errors.push(error);
        this.logger.error(`Permission denied reading file: ${filePath}`);
        return;
      }

      // Read and parse JSON file
      const fileContent = await readFile(filePath, 'utf-8');
      
      if (!fileContent.trim()) {
        this.logger.debug(`Empty file skipped: ${filePath}`);
        return;
      }

      try {
        const parsedContent = JSON.parse(fileContent);
        settings[settingsKey] = parsedContent;
        sourceFiles.push(filePath);
        this.logger.debug(`Successfully collected: ${filePath}`);
      } catch (parseError) {
        const error: CollectionError = {
          file: filePath,
          error: `Invalid JSON format: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`,
          severity: 'error',
        };
        errors.push(error);
        this.logger.error(`Failed to parse JSON file ${filePath}: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }
    } catch (fileError) {
      const errorMessage = PathResolverUtil.getPathErrorMessage(filePath, fileError as Error);
      const error: CollectionError = {
        file: filePath,
        error: errorMessage,
        severity: 'error',
      };
      errors.push(error);
      this.logger.error(`Error reading file ${filePath}: ${errorMessage}`);
    }
  }

  /**
   * Collect all files from a directory (prompts/ or hooks/)
   */
  private async collectDirectoryContents(
    directoryPath: string,
    settingsKey: 'prompts' | 'hooks',
    settings: LocalSettings,
    sourceFiles: string[],
    errors: CollectionError[],
  ): Promise<void> {
    try {
      // Check if directory exists and is readable
      if (!(await PathResolverUtil.pathExists(directoryPath))) {
        this.logger.debug(`Directory not found: ${directoryPath}`);
        return;
      }

      if (!(await PathResolverUtil.isReadable(directoryPath))) {
        const error: CollectionError = {
          file: directoryPath,
          error: 'Permission denied - directory is not readable',
          severity: 'error',
        };
        errors.push(error);
        this.logger.error(`Permission denied reading directory: ${directoryPath}`);
        return;
      }

      // Check if it's actually a directory
      const stats = await stat(directoryPath);
      if (!stats.isDirectory()) {
        const error: CollectionError = {
          file: directoryPath,
          error: 'Path exists but is not a directory',
          severity: 'warning',
        };
        errors.push(error);
        this.logger.warn(`Path is not a directory: ${directoryPath}`);
        return;
      }

      // Read directory contents
      const files = await readdir(directoryPath);
      const directoryContents: Record<string, any> = {};

      for (const fileName of files) {
        const filePath = join(directoryPath, fileName);
        
        try {
          const fileStats = await stat(filePath);
          
          // Skip subdirectories for now (could be enhanced later)
          if (fileStats.isDirectory()) {
            this.logger.debug(`Skipping subdirectory: ${filePath}`);
            continue;
          }

          // Check if file is readable
          if (!(await PathResolverUtil.isReadable(filePath))) {
            const error: CollectionError = {
              file: filePath,
              error: 'Permission denied - file is not readable',
              severity: 'warning',
            };
            errors.push(error);
            this.logger.warn(`Permission denied reading file: ${filePath}`);
            continue;
          }

          // Read file content
          const fileContent = await readFile(filePath, 'utf-8');
          
          if (!fileContent.trim()) {
            this.logger.debug(`Empty file skipped: ${filePath}`);
            continue;
          }

          // Try to parse as JSON, fallback to plain text
          let parsedContent: any;
          try {
            parsedContent = JSON.parse(fileContent);
          } catch {
            // If not valid JSON, store as plain text
            parsedContent = fileContent;
          }

          directoryContents[fileName] = parsedContent;
          sourceFiles.push(filePath);
          this.logger.debug(`Successfully collected: ${filePath}`);

        } catch (fileError) {
          const errorMessage = PathResolverUtil.getPathErrorMessage(filePath, fileError as Error);
          const error: CollectionError = {
            file: filePath,
            error: errorMessage,
            severity: 'warning',
          };
          errors.push(error);
          this.logger.warn(`Error reading file ${filePath}: ${errorMessage}`);
        }
      }

      // Only set the settings key if we found any files
      if (Object.keys(directoryContents).length > 0) {
        settings[settingsKey] = directoryContents;
        this.logger.debug(`Successfully collected ${Object.keys(directoryContents).length} files from ${directoryPath}`);
      } else {
        this.logger.debug(`No files found in directory: ${directoryPath}`);
      }

    } catch (directoryError) {
      const errorMessage = PathResolverUtil.getPathErrorMessage(directoryPath, directoryError as Error);
      const error: CollectionError = {
        file: directoryPath,
        error: errorMessage,
        severity: 'error',
      };
      errors.push(error);
      this.logger.error(`Error reading directory ${directoryPath}: ${errorMessage}`);
    }
  }

  /**
   * Validate that local Kiro configuration exists and is accessible
   */
  async validateLocalConfiguration(): Promise<{
    isValid: boolean;
    configDirectory: string;
    errors: string[];
  }> {
    const errors: string[] = [];
    const configDirectory = PathResolverUtil.getLocalKiroConfigDirectory();

    try {
      const exists = await PathResolverUtil.pathExists(configDirectory);
      if (!exists) {
        errors.push(`Local Kiro configuration directory not found: ${configDirectory}`);
        return { isValid: false, configDirectory, errors };
      }

      const isReadable = await PathResolverUtil.isReadable(configDirectory);
      if (!isReadable) {
        errors.push(`Cannot read local Kiro configuration directory: ${configDirectory}`);
        return { isValid: false, configDirectory, errors };
      }

      // Check if it's actually a directory
      const stats = await stat(configDirectory);
      if (!stats.isDirectory()) {
        errors.push(`Path exists but is not a directory: ${configDirectory}`);
        return { isValid: false, configDirectory, errors };
      }

      return { isValid: true, configDirectory, errors };

    } catch (error) {
      const errorMessage = PathResolverUtil.getPathErrorMessage(configDirectory, error as Error);
      errors.push(`Error validating local configuration: ${errorMessage}`);
      return { isValid: false, configDirectory, errors };
    }
  }
}