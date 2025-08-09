import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

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