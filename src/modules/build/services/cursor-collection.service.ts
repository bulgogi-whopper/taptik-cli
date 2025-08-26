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
  CursorWorkspaceConfig,
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
      
      const rawLaunch = await this.collectLaunchConfiguration(
        path.join(settingsPath, 'launch.json'),
      );
      const launch = this.processLaunchConfiguration(rawLaunch, projectPath);
      
      const rawTasks = await this.collectTaskConfiguration(
        path.join(settingsPath, 'tasks.json'),
      );
      const tasks = this.processTaskConfiguration(rawTasks, projectPath);
      
      const aiRules = await this.parseCursorAiConfig(settingsPath);

      // Determine workspace type
      const workspaceType = await this.determineWorkspaceType(projectPath);
      
      // Collect workspace configuration if it exists
      const workspaceConfig = await this.collectWorkspaceConfiguration(projectPath);

      return {
        projectPath,
        workspaceType,
        workspaceConfig: workspaceConfig || undefined,
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
   * Determine workspace type and collect workspace configuration
   */
  private async determineWorkspaceType(
    projectPath: string,
  ): Promise<'single' | 'multi-root' | 'none'> {
    try {
      // Check for workspace file
      const workspaceFiles = await fs.readdir(projectPath);
      const workspaceFile = workspaceFiles.find(
        file => file.endsWith('.code-workspace') || file.endsWith('.cursor-workspace'),
      );

      if (workspaceFile) {
        // Parse workspace file to determine if it's multi-root
        try {
          const workspacePath = path.join(projectPath, workspaceFile);
          const workspaceContent = await fs.readFile(workspacePath, 'utf-8');
          const workspace = JSON.parse(workspaceContent);
          
          // Check if workspace has multiple folders
          if (workspace.folders && Array.isArray(workspace.folders) && workspace.folders.length > 1) {
            return 'multi-root';
          }
        } catch {
          // Error parsing workspace file, assume single
        }
        return 'single';
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

  /**
   * Collect workspace configuration for multi-root projects
   */
  async collectWorkspaceConfiguration(
    projectPath: string,
  ): Promise<CursorWorkspaceConfig | null> {
    try {
      const files = await fs.readdir(projectPath);
      const workspaceFile = files.find(
        file => file.endsWith('.code-workspace') || file.endsWith('.cursor-workspace'),
      );

      if (!workspaceFile) {
        return null;
      }

      const workspacePath = path.join(projectPath, workspaceFile);
      const content = await fs.readFile(workspacePath, 'utf-8');
      const workspace = JSON.parse(content);

      return {
        folders: workspace.folders || [],
        settings: workspace.settings || {},
        launch: workspace.launch,
        tasks: workspace.tasks,
        extensions: workspace.extensions,
        remoteAuthority: workspace.remoteAuthority,
      };
    } catch (error) {
      this.logger.warn(`Failed to collect workspace configuration: ${error}`);
      return null;
    }
  }

  /**
   * Substitute VS Code variables in configuration strings
   * Supports common VS Code variables like ${workspaceFolder}, ${file}, etc.
   */
  private substituteVariables(
    value: string,
    projectPath: string,
  ): string {
    const variables: Record<string, string> = {
      '${workspaceFolder}': projectPath,
      '${workspaceFolderBasename}': path.basename(projectPath),
      '${userHome}': homedir(),
      '${pathSeparator}': path.sep,
      '${/}': path.sep,
    };

    let result = value;
    for (const [variable, replacement] of Object.entries(variables)) {
      result = result.replace(new RegExp(variable.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&'), 'g'), replacement);
    }
    return result;
  }

  /**
   * Process launch configuration with variable substitution
   */
  private processLaunchConfiguration(
    launch: LaunchConfiguration | undefined,
    projectPath: string,
  ): LaunchConfiguration | undefined {
    if (!launch) return undefined;

    return {
      version: launch.version,
      configurations: launch.configurations.map(config => {
        const processed: Record<string, unknown> = { ...config };
        
        // Substitute variables in string properties
        for (const [key, value] of Object.entries(processed)) {
          if (typeof value === 'string') {
            processed[key] = this.substituteVariables(value, projectPath);
          } else if (Array.isArray(value)) {
            processed[key] = value.map(item => 
              typeof item === 'string' ? this.substituteVariables(item, projectPath) : item
            );
          } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // Handle nested objects like env
            const nestedObject: Record<string, unknown> = {};
            for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
              if (typeof nestedValue === 'string') {
                nestedObject[nestedKey] = this.substituteVariables(nestedValue, projectPath);
              } else {
                nestedObject[nestedKey] = nestedValue;
              }
            }
            processed[key] = nestedObject;
          }
        }
        
        return processed as typeof config;
      }),
      compounds: launch.compounds,
    };
  }

  /**
   * Process task configuration with variable substitution
   */
  private processTaskConfiguration(
    tasks: TaskConfiguration | undefined,
    projectPath: string,
  ): TaskConfiguration | undefined {
    if (!tasks) return undefined;

    return {
      version: tasks.version,
      tasks: tasks.tasks.map(task => {
        const processed: Record<string, unknown> = { ...task };
        
        // Substitute variables in string properties recursively
        const processValue = (value: unknown): unknown => {
          if (typeof value === 'string') {
            return this.substituteVariables(value, projectPath);
          } else if (Array.isArray(value)) {
            return value.map(item => processValue(item));
          } else if (typeof value === 'object' && value !== null) {
            const nestedObject: Record<string, unknown> = {};
            for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
              nestedObject[nestedKey] = processValue(nestedValue);
            }
            return nestedObject;
          }
          return value;
        };
        
        // Process all properties
        for (const [key, value] of Object.entries(processed)) {
          processed[key] = processValue(value);
        }
        
        return processed as typeof task;
      }),
    };
  }

  /**
   * Generate project metadata for classification and discovery
   */
  async generateProjectMetadata(
    projectPath: string,
  ): Promise<Record<string, unknown>> {
    const metadata: Record<string, unknown> = {
      path: projectPath,
      name: path.basename(projectPath),
    };

    try {
      // Check for common project files to determine project type
      const files = await fs.readdir(projectPath);
      
      // Package managers
      if (files.includes('package.json')) {
        try {
          const packageJson = await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8');
          const pkg = JSON.parse(packageJson);
          metadata.type = 'node';
          metadata.framework = this.detectFramework(pkg);
          metadata.dependencies = Object.keys(pkg.dependencies || {}).length;
          metadata.devDependencies = Object.keys(pkg.devDependencies || {}).length;
        } catch {
          // Invalid package.json
        }
      }
      
      if (files.includes('Cargo.toml')) {
        metadata.type = 'rust';
      }
      
      if (files.includes('go.mod')) {
        metadata.type = 'go';
      }
      
      if (files.includes('requirements.txt') || files.includes('Pipfile')) {
        metadata.type = 'python';
      }
      
      // Language detection based on file extensions
      const languages = new Set<string>();
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        switch (ext) {
          case '.ts':
            languages.add('typescript');
            break;
          case '.tsx':
            languages.add('typescript');
            languages.add('javascript'); // TSX includes JS/JSX
            break;
          case '.js':
          case '.jsx':
            languages.add('javascript');
            break;
          case '.py':
            languages.add('python');
            break;
          case '.rs':
            languages.add('rust');
            break;
          case '.go':
            languages.add('go');
            break;
          case '.java':
            languages.add('java');
            break;
          case '.cpp':
          case '.cc':
          case '.cxx':
            languages.add('cpp');
            break;
        }
      }
      
      metadata.languages = Array.from(languages);
      
      // Version control
      if (files.includes('.git')) {
        metadata.vcs = 'git';
      }
      
      // Docker
      if (files.includes('Dockerfile') || files.includes('docker-compose.yml')) {
        metadata.docker = true;
      }
      
    } catch (error) {
      this.logger.debug(`Failed to generate project metadata: ${error}`);
    }

    return metadata;
  }

  /**
   * Detect framework from package.json
   */
  private detectFramework(pkg: Record<string, unknown>): string | undefined {
    const dependencies = (pkg.dependencies || {}) as Record<string, unknown>;
    const devDependencies = (pkg.devDependencies || {}) as Record<string, unknown>;
    const deps = { ...dependencies, ...devDependencies };
    
    if (deps['@nestjs/core']) return 'nestjs';
    if (deps['next']) return 'nextjs';
    if (deps['react']) return 'react';
    if (deps['@angular/core']) return 'angular';
    if (deps['vue']) return 'vue';
    if (deps['svelte']) return 'svelte';
    if (deps['express']) return 'express';
    if (deps['koa']) return 'koa';
    if (deps['fastify']) return 'fastify';
    
    return undefined;
  }
}