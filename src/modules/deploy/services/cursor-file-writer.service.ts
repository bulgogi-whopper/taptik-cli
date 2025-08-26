import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import { DeploymentError, DeploymentWarning } from '../interfaces/deployment-result.interface';
import {
  CursorGlobalSettings,
  CursorProjectSettings,
  CursorDeploymentOptions,
} from '../interfaces/cursor-deployment.interface';
import { CursorExtensionsConfig } from '../interfaces/cursor-config.interface';

export interface CursorFileWriteResult {
  success: boolean;
  filePath?: string;
  errors: DeploymentError[];
  warnings: DeploymentWarning[];
  bytesWritten?: number;
}

export interface CursorDirectoryStructure {
  globalConfigDir: string;
  projectConfigDir?: string;
  extensionsDir: string;
  snippetsDir: string;
  aiConfigDir: string;
  debugConfigDir?: string;
  tasksConfigDir?: string;
}

@Injectable()
export class CursorFileWriterService {
  private readonly logger = new Logger(CursorFileWriterService.name);

  /**
   * Task 5.1: Write global and project settings to Cursor configuration files
   */
  async writeSettings(
    globalSettings: CursorGlobalSettings,
    projectSettings: CursorProjectSettings | null,
    options: CursorDeploymentOptions
  ): Promise<{
    globalWritten: boolean;
    projectWritten: boolean;
    errors: DeploymentError[];
    warnings: DeploymentWarning[];
    paths: {
      globalSettings?: string;
      projectSettings?: string;
    };
  }> {
    this.logger.log('Writing Cursor settings to configuration files...');

    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];
    let globalWritten = false;
    let projectWritten = false;
    const paths: { globalSettings?: string; projectSettings?: string } = {};

    try {
      // Ensure directory structure exists
      const directories = await this.ensureCursorDirectories(options);

      // Write global settings
      if (options.globalSettings !== false && globalSettings) {
        const globalResult = await this.writeGlobalSettings(
          globalSettings,
          directories.globalConfigDir,
          options
        );
        
        if (globalResult.success) {
          globalWritten = true;
          paths.globalSettings = globalResult.filePath;
          this.logger.log(`Global settings written to: ${globalResult.filePath}`);
        } else {
          errors.push(...globalResult.errors);
          warnings.push(...globalResult.warnings);
        }
      }

      // Write project settings if provided and enabled
      if (options.projectSettings !== false && projectSettings && options.workspacePath) {
        const projectResult = await this.writeProjectSettings(
          projectSettings,
          directories.projectConfigDir || path.join(options.workspacePath, '.vscode'),
          options
        );

        if (projectResult.success) {
          projectWritten = true;
          paths.projectSettings = projectResult.filePath;
          this.logger.log(`Project settings written to: ${projectResult.filePath}`);
        } else {
          errors.push(...projectResult.errors);
          warnings.push(...projectResult.warnings);
        }
      }

      return {
        globalWritten,
        projectWritten,
        errors,
        warnings,
        paths,
      };

    } catch (error) {
      this.logger.error('Failed to write Cursor settings:', error);
      errors.push({
        component: 'settings',
        type: 'file_operation',
        severity: 'high',
        message: `Failed to write settings: ${(error as Error).message}`,
        path: options.cursorPath || 'unknown',
        suggestion: 'Check file permissions and disk space',
      });

      return {
        globalWritten: false,
        projectWritten: false,
        errors,
        warnings,
        paths,
      };
    }
  }

  /**
   * Task 5.1: Write extension configuration to Cursor
   */
  async writeExtensions(
    extensionsConfig: CursorExtensionsConfig,
    options: CursorDeploymentOptions
  ): Promise<CursorFileWriteResult> {
    this.logger.log('Writing Cursor extensions configuration...');

    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];

    try {
      const directories = await this.ensureCursorDirectories(options);
      const extensionsFilePath = path.join(directories.extensionsDir, 'extensions.json');

      // Validate extensions configuration
      const validationResult = this.validateExtensionsConfig(extensionsConfig);
      if (validationResult.warnings.length > 0) {
        warnings.push(...validationResult.warnings);
      }

      // Prepare extensions data for writing
      const extensionsData = {
        recommendations: extensionsConfig.recommendations || [],
        unwantedRecommendations: extensionsConfig.unwanted || [],
        ...extensionsConfig.settings && { settings: extensionsConfig.settings },
      };

      // Write extensions configuration
      const extensionsJson = JSON.stringify(extensionsData, null, 2);
      await fs.writeFile(extensionsFilePath, extensionsJson, 'utf8');

      const stats = await fs.stat(extensionsFilePath);
      
      this.logger.log(`Extensions configuration written to: ${extensionsFilePath} (${stats.size} bytes)`);

      return {
        success: true,
        filePath: extensionsFilePath,
        errors,
        warnings,
        bytesWritten: stats.size,
      };

    } catch (error) {
      this.logger.error('Failed to write extensions configuration:', error);
      errors.push({
        component: 'extensions',
        type: 'file_operation',
        severity: 'high',
        message: `Failed to write extensions: ${(error as Error).message}`,
        path: options.cursorPath || 'unknown',
        suggestion: 'Check file permissions and extensions configuration format',
      });

      return {
        success: false,
        errors,
        warnings,
      };
    }
  }

  /**
   * Task 5.1: Ensure Cursor directory structure exists
   */
  async ensureCursorDirectories(options: CursorDeploymentOptions): Promise<CursorDirectoryStructure> {
    this.logger.debug('Ensuring Cursor directory structure...');

    const directories: CursorDirectoryStructure = {
      globalConfigDir: this.getGlobalConfigPath(options),
      extensionsDir: this.getExtensionsPath(options),
      snippetsDir: this.getSnippetsPath(options),
      aiConfigDir: this.getAIConfigPath(options),
    };

    // Add project-specific directories if workspace is specified
    if (options.workspacePath) {
      directories.projectConfigDir = path.join(options.workspacePath, '.vscode');
      directories.debugConfigDir = path.join(options.workspacePath, '.vscode');
      directories.tasksConfigDir = path.join(options.workspacePath, '.vscode');
    }

    // Create all required directories
    const directoriesToCreate = [
      directories.globalConfigDir,
      directories.extensionsDir,
      directories.snippetsDir,
      directories.aiConfigDir,
    ];

    if (directories.projectConfigDir) {
      directoriesToCreate.push(directories.projectConfigDir);
    }

    for (const dir of directoriesToCreate) {
      try {
        await fs.mkdir(dir, { recursive: true });
        this.logger.debug(`Ensured directory exists: ${dir}`);
      } catch (error) {
        this.logger.error(`Failed to create directory ${dir}:`, error);
        throw new Error(`Unable to create directory structure: ${(error as Error).message}`);
      }
    }

    return directories;
  }

  /**
   * Write global settings to the appropriate Cursor configuration file
   */
  private async writeGlobalSettings(
    settings: CursorGlobalSettings,
    configDir: string,
    options: CursorDeploymentOptions
  ): Promise<CursorFileWriteResult> {
    const settingsPath = path.join(configDir, 'settings.json');
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];

    try {
      // Handle existing settings if merge is enabled
      let existingSettings = {};
      if (options.mergeStrategy === 'merge') {
        try {
          const existingContent = await fs.readFile(settingsPath, 'utf8');
          existingSettings = JSON.parse(existingContent);
        } catch (error) {
          // File doesn't exist or is invalid, continue with empty object
          this.logger.debug('No existing global settings found, creating new file');
        }
      }

      // Merge or replace settings
      const finalSettings = options.mergeStrategy === 'merge' 
        ? { ...existingSettings, ...this.flattenSettings(settings) }
        : this.flattenSettings(settings);

      const settingsJson = JSON.stringify(finalSettings, null, 2);
      await fs.writeFile(settingsPath, settingsJson, 'utf8');

      const stats = await fs.stat(settingsPath);

      return {
        success: true,
        filePath: settingsPath,
        errors,
        warnings,
        bytesWritten: stats.size,
      };

    } catch (error) {
      errors.push({
        component: 'global-settings',
        type: 'file_operation',
        severity: 'high',
        message: `Failed to write global settings: ${(error as Error).message}`,
        path: settingsPath,
        suggestion: 'Check directory permissions and settings format',
      });

      return {
        success: false,
        errors,
        warnings,
      };
    }
  }

  /**
   * Write project settings to the workspace .vscode directory
   */
  private async writeProjectSettings(
    settings: CursorProjectSettings,
    configDir: string,
    options: CursorDeploymentOptions
  ): Promise<CursorFileWriteResult> {
    const settingsPath = path.join(configDir, 'settings.json');
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];

    try {
      // Ensure .vscode directory exists
      await fs.mkdir(configDir, { recursive: true });

      // Handle existing settings if merge is enabled
      let existingSettings = {};
      if (options.mergeStrategy === 'merge') {
        try {
          const existingContent = await fs.readFile(settingsPath, 'utf8');
          existingSettings = JSON.parse(existingContent);
        } catch (error) {
          // File doesn't exist or is invalid, continue with empty object
          this.logger.debug('No existing project settings found, creating new file');
        }
      }

      // Merge or replace settings
      const finalSettings = options.mergeStrategy === 'merge' 
        ? { ...existingSettings, ...this.flattenSettings(settings) }
        : this.flattenSettings(settings);

      const settingsJson = JSON.stringify(finalSettings, null, 2);
      await fs.writeFile(settingsPath, settingsJson, 'utf8');

      const stats = await fs.stat(settingsPath);

      return {
        success: true,
        filePath: settingsPath,
        errors,
        warnings,
        bytesWritten: stats.size,
      };

    } catch (error) {
      errors.push({
        component: 'project-settings',
        type: 'file_operation',
        severity: 'high',
        message: `Failed to write project settings: ${(error as Error).message}`,
        path: settingsPath,
        suggestion: 'Check workspace directory permissions',
      });

      return {
        success: false,
        errors,
        warnings,
      };
    }
  }

  /**
   * Flatten nested settings object to VS Code settings format
   */
  private flattenSettings(settings: CursorGlobalSettings | CursorProjectSettings): Record<string, any> {
    const flattened: Record<string, any> = {};

    if (settings.editor) {
      Object.entries(settings.editor).forEach(([key, value]) => {
        flattened[`editor.${key}`] = value;
      });
    }

    if (settings.ai) {
      Object.entries(settings.ai).forEach(([key, value]) => {
        flattened[`cursor.ai.${key}`] = value;
      });
    }

    if ('files' in settings && settings.files) {
      Object.entries(settings.files).forEach(([key, value]) => {
        flattened[`files.${key}`] = value;
      });
    }

    if ('search' in settings && settings.search) {
      Object.entries(settings.search).forEach(([key, value]) => {
        flattened[`search.${key}`] = value;
      });
    }

    if ('extensions' in settings && settings.extensions) {
      Object.entries(settings.extensions).forEach(([key, value]) => {
        flattened[`extensions.${key}`] = value;
      });
    }

    if ('security' in settings && settings.security) {
      this.flattenSecuritySettings(settings.security, flattened);
    }

    return flattened;
  }

  /**
   * Flatten security settings with proper nesting
   */
  private flattenSecuritySettings(security: any, target: Record<string, any>): void {
    if (security.workspace?.trust) {
      Object.entries(security.workspace.trust).forEach(([key, value]) => {
        target[`security.workspace.trust.${key}`] = value;
      });
    }
  }

  /**
   * Validate extensions configuration before writing
   */
  private validateExtensionsConfig(config: CursorExtensionsConfig): {
    warnings: DeploymentWarning[];
  } {
    const warnings: DeploymentWarning[] = [];

    if (config.recommendations && config.recommendations.length > 50) {
      warnings.push({
        component: 'extensions',
        type: 'performance',
        message: `Large number of recommended extensions (${config.recommendations.length})`,
        suggestion: 'Consider reducing the number of recommendations for better performance',
      });
    }

    if (config.recommendations && config.unwanted) {
      const conflicts = config.recommendations.filter(ext => 
        config.unwanted?.includes(ext)
      );
      
      if (conflicts.length > 0) {
        warnings.push({
          component: 'extensions',
          type: 'configuration',
          message: `Extensions listed in both recommendations and unwanted: ${conflicts.join(', ')}`,
          suggestion: 'Remove conflicting extensions from one of the lists',
        });
      }
    }

    return { warnings };
  }

  /**
   * Get the global configuration directory path for Cursor
   */
  private getGlobalConfigPath(options: CursorDeploymentOptions): string {
    if (options.cursorPath) {
      return path.join(options.cursorPath, 'User');
    }

    // Default Cursor configuration paths by platform
    const os = process.platform;
    switch (os) {
      case 'win32':
        return path.join(process.env.APPDATA || '', 'Cursor', 'User');
      case 'darwin':
        return path.join(process.env.HOME || '', 'Library', 'Application Support', 'Cursor', 'User');
      case 'linux':
        return path.join(process.env.HOME || '', '.config', 'Cursor', 'User');
      default:
        throw new Error(`Unsupported platform: ${os}`);
    }
  }

  /**
   * Get the extensions directory path
   */
  private getExtensionsPath(options: CursorDeploymentOptions): string {
    const globalPath = this.getGlobalConfigPath(options);
    return globalPath; // Extensions config goes in the same directory as settings
  }

  /**
   * Get the snippets directory path
   */
  private getSnippetsPath(options: CursorDeploymentOptions): string {
    const globalPath = this.getGlobalConfigPath(options);
    return path.join(globalPath, 'snippets');
  }

  /**
   * Get the AI configuration directory path
   */
  private getAIConfigPath(options: CursorDeploymentOptions): string {
    if (options.workspacePath) {
      return options.workspacePath; // AI rules go in the workspace root
    }
    const globalPath = this.getGlobalConfigPath(options);
    return path.join(globalPath, 'ai');
  }
}