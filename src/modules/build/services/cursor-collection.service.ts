/**
 * CursorCollectionService - Service for collecting Cursor IDE configurations
 * Handles directory discovery, settings collection, and AI configuration gathering
 */

import * as fs from 'fs/promises';
import { homedir } from 'os';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';

import {
  CursorLocalSettingsData,
  CursorGlobalSettingsData,
  CursorAiConfiguration,
  VSCodeSettings,
  CursorExtension,
  CursorSnippet,
  CursorKeybinding,
  LaunchConfiguration,
  TaskConfiguration,
  CursorConfigurationError,
} from '../interfaces/cursor-ide.interfaces';

/**
 * Service for collecting Cursor IDE configurations from the file system
 */
@Injectable()
export class CursorCollectionService {
  private readonly logger = new Logger(CursorCollectionService.name);

  // Get Cursor IDE directory paths
  private getCursorPaths() {
    const home = homedir();
    return {
      // macOS paths
      darwin: {
        global: path.join(home, '.cursor'),
        globalAlt: path.join(home, 'Library', 'Application Support', 'Cursor'),
        extensions: path.join(home, '.cursor', 'extensions'),
      },
      // Windows paths
      win32: {
        global: path.join(home, 'AppData', 'Roaming', 'Cursor'),
        globalAlt: path.join(home, '.cursor'),
        extensions: path.join(home, '.cursor', 'extensions'),
      },
      // Linux paths
      linux: {
        global: path.join(home, '.config', 'Cursor'),
        globalAlt: path.join(home, '.cursor'),
        extensions: path.join(home, '.cursor', 'extensions'),
      },
    };
  }

  /**
   * Collect Cursor local (project-specific) settings
   */
  async collectCursorLocalSettings(
    projectPath: string,
  ): Promise<CursorLocalSettingsData | null> {
    this.logger.log(`Collecting local Cursor settings from: ${projectPath}`);

    try {
      const vscodePath = path.join(projectPath, '.vscode');
      const cursorPath = path.join(projectPath, '.cursor');
      
      // Check for .vscode directory first (Cursor uses this too)
      const settingsPath = await this.findSettingsPath(vscodePath, cursorPath);
      if (!settingsPath) {
        this.logger.debug('No local Cursor settings found');
        return null;
      }

      const settings = await this.parseSettingsJson(
        path.join(settingsPath, 'settings.json'),
      );
      
      const extensions = await this.collectExtensionsJson(
        path.join(settingsPath, 'extensions.json'),
      );
      
      const keybindings = await this.collectKeybindings(
        path.join(settingsPath, 'keybindings.json'),
      );
      
      const snippets = await this.collectSnippets(settingsPath);
      
      const launch = await this.collectLaunchConfiguration(
        path.join(settingsPath, 'launch.json'),
      );
      
      const tasks = await this.collectTaskConfiguration(
        path.join(settingsPath, 'tasks.json'),
      );
      
      const aiRules = await this.parseCursorAiConfig(settingsPath);

      // Determine workspace type
      const workspaceType = await this.determineWorkspaceType(projectPath);

      return {
        projectPath,
        workspaceType,
        projectAiRules: aiRules || undefined,
        settings,
        extensions: extensions ? {
          recommendations: extensions.recommendations,
          unwantedRecommendations: extensions.unwantedRecommendations,
        } : undefined,
        snippets,
        keybindings,
        workspace: {
          settings,
          launch,
          tasks,
        },
        sourcePath: settingsPath,
        collectedAt: new Date().toISOString(),
        isGlobal: false,
      };
    } catch (error) {
      this.logger.error(`Error collecting local settings: ${error}`);
      throw new CursorConfigurationError(
        `Failed to collect local Cursor settings: ${error}`,
        projectPath,
      );
    }
  }

  /**
   * Collect Cursor global settings
   */
  async collectCursorGlobalSettings(): Promise<CursorGlobalSettingsData | null> {
    this.logger.log('Collecting global Cursor settings');

    try {
      const cursorPaths = this.getCursorPaths();
      const platform = process.platform as keyof typeof cursorPaths;
      const paths = cursorPaths[platform] || cursorPaths.linux;

      // Find the Cursor global directory
      const globalPath = await this.findGlobalCursorPath(paths);
      if (!globalPath) {
        this.logger.warn('Cursor IDE installation not found');
        return null;
      }

      const settings = await this.parseSettingsJson(
        path.join(globalPath, 'User', 'settings.json'),
      );
      
      const keybindings = await this.collectKeybindings(
        path.join(globalPath, 'User', 'keybindings.json'),
      );
      
      const snippets = await this.collectGlobalSnippets(globalPath);
      
      const globalExtensions = await this.collectInstalledExtensions(
        paths.extensions,
      );
      
      const globalAiRules = await this.parseCursorAiConfig(
        path.join(globalPath, 'User'),
      );

      return {
        userHome: homedir(),
        globalAiRules: globalAiRules || undefined,
        globalExtensions,
        settings,
        snippets,
        keybindings,
        extensions: globalExtensions ? {
          installed: globalExtensions,
        } : undefined,
        sourcePath: globalPath,
        collectedAt: new Date().toISOString(),
        isGlobal: true,
      };
    } catch (error) {
      this.logger.error(`Error collecting global settings: ${error}`);
      throw new CursorConfigurationError(
        `Failed to collect global Cursor settings: ${error}`,
        'global',
      );
    }
  }

  /**
   * Parse settings.json file
   */
  async parseSettingsJson(filePath: string): Promise<VSCodeSettings | undefined> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const settings = JSON.parse(content) as VSCodeSettings;
      this.logger.debug(`Parsed settings from: ${filePath}`);
      return settings;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Error parsing settings.json: ${error}`);
      }
      return undefined;
    }
  }

  /**
   * Parse Cursor AI configuration
   */
  async parseCursorAiConfig(
    dirPath: string,
  ): Promise<CursorAiConfiguration | null> {
    try {
      // Check for ai-rules.json
      const aiRulesPath = path.join(dirPath, 'ai-rules.json');
      const copilotSettingsPath = path.join(dirPath, 'copilot-settings.json');
      const cursorConfigPath = path.join(dirPath, 'cursor-config.json');

      let config: CursorAiConfiguration = {
        version: '1.0.0',
      };

      // Try to read ai-rules.json
      try {
        const aiRulesContent = await fs.readFile(aiRulesPath, 'utf-8');
        const aiRules = JSON.parse(aiRulesContent);
        config.rules = aiRules.rules || aiRules;
      } catch {
        // File doesn't exist or is invalid
      }

      // Try to read copilot-settings.json
      try {
        const copilotContent = await fs.readFile(copilotSettingsPath, 'utf-8');
        const copilotSettings = JSON.parse(copilotContent);
        config.copilot = copilotSettings;
      } catch {
        // File doesn't exist or is invalid
      }

      // Try to read cursor-config.json
      try {
        const cursorContent = await fs.readFile(cursorConfigPath, 'utf-8');
        const cursorSettings = JSON.parse(cursorContent);
        config = { ...config, ...cursorSettings };
      } catch {
        // File doesn't exist or is invalid
      }

      // Return null if no AI configuration found
      if (!config.rules && !config.copilot && !config.modelConfig) {
        return null;
      }

      this.logger.debug(`Parsed AI configuration from: ${dirPath}`);
      return config;
    } catch (error) {
      this.logger.warn(`Error parsing AI configuration: ${error}`);
      return null;
    }
  }

  /**
   * Collect extensions.json
   */
  async collectExtensionsJson(
    filePath: string,
  ): Promise<{ recommendations?: string[]; unwantedRecommendations?: string[] } | undefined> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const extensions = JSON.parse(content);
      return extensions;
    } catch {
      return undefined;
    }
  }

  /**
   * Collect installed extensions
   */
  async collectInstalledExtensions(
    extensionsPath: string,
  ): Promise<CursorExtension[] | undefined> {
    try {
      const extensionDirs = await fs.readdir(extensionsPath);
      
      const extensionPromises = extensionDirs.map(async (dir) => {
        try {
          const packagePath = path.join(extensionsPath, dir, 'package.json');
          const packageContent = await fs.readFile(packagePath, 'utf-8');
          const packageJson = JSON.parse(packageContent);
          
          const extension: CursorExtension = {
            id: `${packageJson.publisher}.${packageJson.name}`,
            name: packageJson.displayName || packageJson.name,
            publisher: packageJson.publisher,
            version: packageJson.version,
            enabled: true,
          };
          return extension;
        } catch {
          // Skip invalid extension directories
          return null;
        }
      });

      const results = await Promise.all(extensionPromises);
      const extensions = results.filter((ext): ext is CursorExtension => ext !== null);

      return extensions.length > 0 ? extensions : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Collect keybindings
   */
  async collectKeybindings(
    filePath: string,
  ): Promise<CursorKeybinding[] | undefined> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const keybindings = JSON.parse(content);
      return keybindings;
    } catch {
      return undefined;
    }
  }

  /**
   * Collect snippets from a directory
   */
  async collectSnippets(
    dirPath: string,
  ): Promise<Record<string, Record<string, CursorSnippet>> | undefined> {
    try {
      const snippetsPath = path.join(dirPath, 'snippets');
      const snippetFiles = await fs.readdir(snippetsPath);
      
      const snippetPromises = snippetFiles
        .filter(file => file.endsWith('.json'))
        .map(async (file) => {
          const language = path.basename(file, '.json');
          const content = await fs.readFile(path.join(snippetsPath, file), 'utf-8');
          return { language, snippets: JSON.parse(content) };
        });

      const results = await Promise.all(snippetPromises);
      const snippets = results.reduce<Record<string, Record<string, CursorSnippet>>>(
        (acc, { language, snippets }) => {
          acc[language] = snippets;
          return acc;
        },
        {}
      );

      return Object.keys(snippets).length > 0 ? snippets : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Collect global snippets
   */
  async collectGlobalSnippets(
    globalPath: string,
  ): Promise<Record<string, Record<string, CursorSnippet>> | undefined> {
    const userPath = path.join(globalPath, 'User');
    return this.collectSnippets(userPath);
  }

  /**
   * Collect launch configuration
   */
  async collectLaunchConfiguration(
    filePath: string,
  ): Promise<LaunchConfiguration | undefined> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const launch = JSON.parse(content);
      return launch;
    } catch {
      return undefined;
    }
  }

  /**
   * Collect task configuration
   */
  async collectTaskConfiguration(
    filePath: string,
  ): Promise<TaskConfiguration | undefined> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const tasks = JSON.parse(content);
      return tasks;
    } catch {
      return undefined;
    }
  }

  /**
   * Find settings path (.vscode or .cursor)
   */
  private async findSettingsPath(
    vscodePath: string,
    cursorPath: string,
  ): Promise<string | null> {
    try {
      await fs.access(vscodePath);
      return vscodePath;
    } catch {
      try {
        await fs.access(cursorPath);
        return cursorPath;
      } catch {
        return null;
      }
    }
  }

  /**
   * Find global Cursor path
   */
  private async findGlobalCursorPath(
    paths: { global: string; globalAlt: string },
  ): Promise<string | null> {
    try {
      await fs.access(paths.global);
      return paths.global;
    } catch {
      try {
        await fs.access(paths.globalAlt);
        return paths.globalAlt;
      } catch {
        return null;
      }
    }
  }

  /**
   * Determine workspace type
   */
  private async determineWorkspaceType(
    projectPath: string,
  ): Promise<'single' | 'multi-root' | 'none'> {
    try {
      // Check for workspace file
      const workspaceFiles = await fs.readdir(projectPath);
      const hasWorkspaceFile = workspaceFiles.some(
        file => file.endsWith('.code-workspace') || file.endsWith('.cursor-workspace'),
      );

      if (hasWorkspaceFile) {
        return 'multi-root';
      }

      // Check for package.json or other project markers
      const hasProjectFile = workspaceFiles.some(
        file => file === 'package.json' || file === 'tsconfig.json' || file === '.git',
      );

      return hasProjectFile ? 'single' : 'none';
    } catch {
      return 'none';
    }
  }
}