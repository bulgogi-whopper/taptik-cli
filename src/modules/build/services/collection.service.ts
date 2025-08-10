import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Interface for collected settings data from local Kiro configuration
 */
export interface LocalSettingsData {
  /** Content from settings/context.md */
  context?: string;
  /** Content from settings/user-preferences.md */
  userPreferences?: string;
  /** Content from settings/project-spec.md */
  projectSpec?: string;
  /** Array of steering files with their content */
  steeringFiles: Array<{
    filename: string;
    content: string;
    path: string;
  }>;
  /** Array of hook files with their content */
  hookFiles: Array<{
    filename: string;
    content: string;
    path: string;
  }>;
  /** Source directory path where data was collected */
  sourcePath: string;
  /** Timestamp when data was collected */
  collectedAt: string;
}

/**
 * Interface for collected settings data from global Kiro configuration
 */
export interface GlobalSettingsData {
  /** Global user configuration content */
  userConfig?: string;
  /** Global preferences content */
  globalPreferences?: string;
  /** Array of global prompt template files */
  promptTemplates: Array<{
    filename: string;
    content: string;
    path: string;
  }>;
  /** Array of global configuration files */
  configFiles: Array<{
    filename: string;
    content: string;
    path: string;
  }>;
  /** Source directory path where data was collected */
  sourcePath: string;
  /** Timestamp when data was collected */
  collectedAt: string;
  /** Flag indicating if security filtering was applied */
  securityFiltered: boolean;
}

/**
 * Service for collecting data from local Kiro settings and configuration files
 */
@Injectable()
export class CollectionService {
  private readonly logger = new Logger(CollectionService.name);

  /**
   * Scans and collects data from local .kiro/ directory
   * @param projectPath - Path to the project directory (defaults to current working directory)
   * @returns Promise resolving to collected local settings data
   */
  async collectLocalSettings(projectPath?: string): Promise<LocalSettingsData> {
    const basePath = projectPath || process.cwd();
    const kiroPath = path.join(basePath, '.kiro');

    this.logger.log(`Scanning local Kiro settings in: ${kiroPath}`);

    // Check if .kiro directory exists
    try {
      await fs.access(kiroPath);
    } catch (error) {
      this.logger.warn(`No .kiro directory found at: ${kiroPath}`);
      throw new Error(`No .kiro directory found at: ${kiroPath}`);
    }

    const settingsData: LocalSettingsData = {
      steeringFiles: [],
      hookFiles: [],
      sourcePath: kiroPath,
      collectedAt: new Date().toISOString(),
    };

    // Collect settings files
    await this.collectSettingsFiles(kiroPath, settingsData);

    // Collect steering files
    await this.collectSteeringFiles(kiroPath, settingsData);

    // Collect hook files
    await this.collectHookFiles(kiroPath, settingsData);

    this.logger.log(`Successfully collected data from ${kiroPath}`);
    return settingsData;
  }

  /**
   * Collects content from settings directory files
   * @private
   */
  private async collectSettingsFiles(kiroPath: string, settingsData: LocalSettingsData): Promise<void> {
    const settingsPath = path.join(kiroPath, 'settings');

    try {
      await fs.access(settingsPath);
      this.logger.debug(`Found settings directory: ${settingsPath}`);
    } catch (error) {
      this.logger.warn(`Settings directory not found: ${settingsPath}`);
      return;
    }

    // Collect context.md
    await this.collectFile(
      path.join(settingsPath, 'context.md'),
      'context.md',
      (content) => {
        settingsData.context = content;
      }
    );

    // Collect user-preferences.md
    await this.collectFile(
      path.join(settingsPath, 'user-preferences.md'),
      'user-preferences.md',
      (content) => {
        settingsData.userPreferences = content;
      }
    );

    // Collect project-spec.md
    await this.collectFile(
      path.join(settingsPath, 'project-spec.md'),
      'project-spec.md',
      (content) => {
        settingsData.projectSpec = content;
      }
    );
  }

  /**
   * Collects all .md files from steering directory
   * @private
   */
  private async collectSteeringFiles(kiroPath: string, settingsData: LocalSettingsData): Promise<void> {
    const steeringPath = path.join(kiroPath, 'steering');

    try {
      await fs.access(steeringPath);
      this.logger.debug(`Found steering directory: ${steeringPath}`);
    } catch (error) {
      this.logger.warn(`Steering directory not found: ${steeringPath}`);
      return;
    }

    try {
      const files = await fs.readdir(steeringPath);
      const mdFiles = files.filter(file => file.endsWith('.md'));

      for (const filename of mdFiles) {
        const filePath = path.join(steeringPath, filename);
        await this.collectFile(filePath, filename, (content) => {
          settingsData.steeringFiles.push({
            filename,
            content,
            path: filePath,
          });
        });
      }

      this.logger.debug(`Collected ${settingsData.steeringFiles.length} steering files`);
    } catch (error) {
      this.logger.error(`Error reading steering directory: ${error.message}`);
    }
  }

  /**
   * Collects all .kiro.hook files from hooks directory
   * @private
   */
  private async collectHookFiles(kiroPath: string, settingsData: LocalSettingsData): Promise<void> {
    const hooksPath = path.join(kiroPath, 'hooks');

    try {
      await fs.access(hooksPath);
      this.logger.debug(`Found hooks directory: ${hooksPath}`);
    } catch (error) {
      this.logger.warn(`Hooks directory not found: ${hooksPath}`);
      return;
    }

    try {
      const files = await fs.readdir(hooksPath);
      const hookFiles = files.filter(file => file.endsWith('.kiro.hook'));

      for (const filename of hookFiles) {
        const filePath = path.join(hooksPath, filename);
        await this.collectFile(filePath, filename, (content) => {
          settingsData.hookFiles.push({
            filename,
            content,
            path: filePath,
          });
        });
      }

      this.logger.debug(`Collected ${settingsData.hookFiles.length} hook files`);
    } catch (error) {
      this.logger.error(`Error reading hooks directory: ${error.message}`);
    }
  }

  /**
   * Scans and collects data from global ~/.kiro/ directory
   * @returns Promise resolving to collected global settings data
   */
  async collectGlobalSettings(): Promise<GlobalSettingsData> {
    const homeDir = os.homedir();
    const globalKiroPath = path.join(homeDir, '.kiro');

    this.logger.log(`Scanning global Kiro settings in: ${globalKiroPath}`);

    // Check if ~/.kiro directory exists
    try {
      await fs.access(globalKiroPath);
    } catch (error) {
      this.logger.warn(`No global .kiro directory found at: ${globalKiroPath}`);
      throw new Error(`No global .kiro directory found at: ${globalKiroPath}`);
    }

    const globalSettingsData: GlobalSettingsData = {
      promptTemplates: [],
      configFiles: [],
      sourcePath: globalKiroPath,
      collectedAt: new Date().toISOString(),
      securityFiltered: false,
    };

    // Collect global configuration files
    await this.collectGlobalConfigFiles(globalKiroPath, globalSettingsData);

    // Collect prompt templates
    await this.collectPromptTemplates(globalKiroPath, globalSettingsData);

    // Collect other configuration files
    await this.collectOtherConfigFiles(globalKiroPath, globalSettingsData);

    this.logger.log(`Successfully collected global data from ${globalKiroPath}`);
    return globalSettingsData;
  }

  /**
   * Collects global configuration files from ~/.kiro/
   * @private
   */
  private async collectGlobalConfigFiles(globalKiroPath: string, globalData: GlobalSettingsData): Promise<void> {
    // Collect user-config.md
    await this.collectFileWithSecurity(
      path.join(globalKiroPath, 'user-config.md'),
      'user-config.md',
      (content, filtered) => {
        globalData.userConfig = content;
        if (filtered) globalData.securityFiltered = true;
      }
    );

    // Collect global-preferences.md
    await this.collectFileWithSecurity(
      path.join(globalKiroPath, 'global-preferences.md'),
      'global-preferences.md',
      (content, filtered) => {
        globalData.globalPreferences = content;
        if (filtered) globalData.securityFiltered = true;
      }
    );
  }

  /**
   * Collects prompt template files from ~/.kiro/templates/
   * @private
   */
  private async collectPromptTemplates(globalKiroPath: string, globalData: GlobalSettingsData): Promise<void> {
    const templatesPath = path.join(globalKiroPath, 'templates');

    try {
      await fs.access(templatesPath);
      this.logger.debug(`Found templates directory: ${templatesPath}`);
    } catch (error) {
      this.logger.warn(`Templates directory not found: ${templatesPath}`);
      return;
    }

    try {
      const files = await fs.readdir(templatesPath);
      const templateFiles = files.filter(file => file.endsWith('.md') || file.endsWith('.txt'));

      for (const filename of templateFiles) {
        const filePath = path.join(templatesPath, filename);
        await this.collectFileWithSecurity(filePath, filename, (content, filtered) => {
          globalData.promptTemplates.push({
            filename,
            content,
            path: filePath,
          });
          if (filtered) globalData.securityFiltered = true;
        });
      }

      this.logger.debug(`Collected ${globalData.promptTemplates.length} prompt template files`);
    } catch (error) {
      this.logger.error(`Error reading templates directory: ${error.message}`);
    }
  }

  /**
   * Collects other configuration files from ~/.kiro/config/
   * @private
   */
  private async collectOtherConfigFiles(globalKiroPath: string, globalData: GlobalSettingsData): Promise<void> {
    const configPath = path.join(globalKiroPath, 'config');

    try {
      await fs.access(configPath);
      this.logger.debug(`Found config directory: ${configPath}`);
    } catch (error) {
      this.logger.warn(`Config directory not found: ${configPath}`);
      return;
    }

    try {
      const files = await fs.readdir(configPath);
      const configFiles = files.filter(file => 
        file.endsWith('.json') || 
        file.endsWith('.yaml') || 
        file.endsWith('.yml') || 
        file.endsWith('.md')
      );

      for (const filename of configFiles) {
        const filePath = path.join(configPath, filename);
        await this.collectFileWithSecurity(filePath, filename, (content, filtered) => {
          globalData.configFiles.push({
            filename,
            content,
            path: filePath,
          });
          if (filtered) globalData.securityFiltered = true;
        });
      }

      this.logger.debug(`Collected ${globalData.configFiles.length} config files`);
    } catch (error) {
      this.logger.error(`Error reading config directory: ${error.message}`);
    }
  }

  /**
   * Safely reads a file with security filtering and executes callback with content
   * @private
   */
  private async collectFileWithSecurity(
    filePath: string,
    filename: string,
    onSuccess: (content: string, securityFiltered: boolean) => void
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Handle JSON files with special parsing validation
      if (filename.endsWith('.json')) {
        try {
          JSON.parse(content); // Validate JSON structure
        } catch (jsonError) {
          this.logger.warn(`Invalid JSON structure in ${filename}: ${jsonError.message}`);
          // Continue with the content anyway - let transformation service handle it
        }
      }
      
      const { filteredContent, wasFiltered } = this.applySecurityFilter(content);
      onSuccess(filteredContent, wasFiltered);
      
      if (wasFiltered) {
        this.logger.warn(`Security filtering applied to file: ${filename}`);
      }
      this.logger.debug(`Successfully read file: ${filename}`);
    } catch (error) {
      this.logger.warn(`Could not read file ${filename}: ${error.message}`);
    }
  }

  /**
   * Applies security filtering to remove sensitive information
   * @private
   */
  private applySecurityFilter(content: string): { filteredContent: string; wasFiltered: boolean } {
    let filteredContent = content;
    let wasFiltered = false;

    // Define patterns for sensitive information with simpler approach
    const sensitivePatterns = [
      // API keys - match common API key patterns
      { pattern: /(["']?(?:api[_-]?key|apikey|api_key)["']?)\s*[=:]\s*["']?([a-zA-Z0-9_-]{6,})["']?/gi, name: 'API key' },
      // Tokens - match various token types
      { pattern: /(["']?(?:token|access_token|auth_token)["']?)\s*[=:]\s*["']?([a-zA-Z0-9_.-]{6,})["']?/gi, name: 'Token' },
      // Secrets - match secret patterns
      { pattern: /(["']?(?:secret|client_secret|app_secret)["']?)\s*[=:]\s*["']?([a-zA-Z0-9_.-]{6,})["']?/gi, name: 'Secret' },
      // Passwords - match password patterns
      { pattern: /(["']?(?:password|passwd|pwd)["']?)\s*[=:]\s*["']?([^\s"']{6,})["']?/gi, name: 'Password' },
      // Database URLs - match database connection strings with credentials
      { pattern: /(["']?(?:database_url|db_url)["']?)\s*[=:]\s*["']?[^"'\s]*:\/\/[^"'\s@]*:[^"'\s@]*@[^"'\s]*["']?/gi, name: 'Database URL' },
    ];

    for (const { pattern, name } of sensitivePatterns) {
      if (pattern.test(filteredContent)) {
        filteredContent = filteredContent.replace(pattern, (match, key) => {
          const equalIndex = match.indexOf('=');
          const colonIndex = match.indexOf(':');
          const separatorIndex = equalIndex !== -1 ? equalIndex : colonIndex;
          
          if (separatorIndex !== -1) {
            return match.substring(0, separatorIndex + 1) + '[REDACTED]';
          }
          return '[REDACTED]';
        });
        wasFiltered = true;
      }
    }

    return { filteredContent, wasFiltered };
  }

  /**
   * Safely reads a file and executes callback with content
   * @private
   */
  private async collectFile(
    filePath: string,
    filename: string,
    onSuccess: (content: string) => void
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      onSuccess(content);
      this.logger.debug(`Successfully read file: ${filename}`);
    } catch (error) {
      this.logger.warn(`Could not read file ${filename}: ${error.message}`);
    }
  }
}