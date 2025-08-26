import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import { DeploymentError, DeploymentWarning } from '../interfaces/deployment-result.interface';
import {
  CursorGlobalSettings,
  CursorProjectSettings,
  CursorDeploymentOptions,
  CursorAIConfig,
  CursorDebugConfig,
  CursorTasksConfig,
  CursorSnippetsConfig,
  CursorWorkspaceConfig,
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
   * Task 5.2: Write AI configuration files (.cursorrules, context, prompts)
   */
  async writeAIConfig(
    aiConfig: CursorAIConfig,
    options: CursorDeploymentOptions
  ): Promise<{
    rulesWritten: boolean;
    contextWritten: boolean;
    promptsWritten: boolean;
    errors: DeploymentError[];
    warnings: DeploymentWarning[];
    files: {
      rules?: string;
      context?: string[];
      prompts?: string[];
    };
  }> {
    this.logger.log('Writing Cursor AI configuration files...');

    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];
    let rulesWritten = false;
    let contextWritten = false;
    let promptsWritten = false;
    const files: { rules?: string; context?: string[]; prompts?: string[] } = {};

    try {
      const directories = await this.ensureCursorDirectories(options);

      // Write .cursorrules file
      if (aiConfig.rules && aiConfig.rules.length > 0) {
        const rulesResult = await this.writeCursorRules(
          aiConfig.rules,
          directories.aiConfigDir,
          options
        );
        
        if (rulesResult.success) {
          rulesWritten = true;
          files.rules = rulesResult.filePath;
          this.logger.log(`Cursor rules written to: ${rulesResult.filePath}`);
        } else {
          errors.push(...rulesResult.errors);
          warnings.push(...rulesResult.warnings);
        }
      }

      // Write AI context files
      if (aiConfig.context && aiConfig.context.length > 0) {
        const contextResult = await this.writeAIContextFiles(
          aiConfig.context,
          directories.aiConfigDir,
          options
        );
        
        if (contextResult.success) {
          contextWritten = true;
          files.context = contextResult.filePaths;
          this.logger.log(`AI context files written: ${contextResult.filePaths?.length} files`);
        } else {
          errors.push(...contextResult.errors);
          warnings.push(...contextResult.warnings);
        }
      }

      // Write prompt template files
      if (aiConfig.prompts && aiConfig.prompts.length > 0) {
        const promptsResult = await this.writePromptTemplates(
          aiConfig.prompts,
          directories.aiConfigDir,
          options
        );
        
        if (promptsResult.success) {
          promptsWritten = true;
          files.prompts = promptsResult.filePaths;
          this.logger.log(`Prompt templates written: ${promptsResult.filePaths?.length} files`);
        } else {
          errors.push(...promptsResult.errors);
          warnings.push(...promptsResult.warnings);
        }
      }

      // Validate AI content size
      await this.validateAIContentSize(aiConfig, warnings);

      return {
        rulesWritten,
        contextWritten,
        promptsWritten,
        errors,
        warnings,
        files,
      };

    } catch (error) {
      this.logger.error('Failed to write AI configuration:', error);
      errors.push({
        component: 'ai-config',
        type: 'file_operation',
        severity: 'high',
        message: `Failed to write AI configuration: ${(error as Error).message}`,
        path: options.workspacePath || 'unknown',
        suggestion: 'Check workspace permissions and AI configuration format',
      });

      return {
        rulesWritten: false,
        contextWritten: false,
        promptsWritten: false,
        errors,
        warnings,
        files,
      };
    }
  }

  /**
   * Task 5.2: Write .cursorrules file with AI rules
   */
  private async writeCursorRules(
    rules: string[],
    aiConfigDir: string,
    options: CursorDeploymentOptions
  ): Promise<CursorFileWriteResult> {
    const rulesPath = path.join(aiConfigDir, '.cursorrules');
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];

    try {
      // Combine all rules into a single formatted file
      const rulesContent = this.formatCursorRules(rules);
      
      // Validate rules content
      const validationResult = this.validateRulesContent(rulesContent);
      warnings.push(...validationResult.warnings);

      if (validationResult.errors.length > 0) {
        errors.push(...validationResult.errors);
        return { success: false, errors, warnings };
      }

      // Write .cursorrules file
      await fs.writeFile(rulesPath, rulesContent, 'utf8');
      const stats = await fs.stat(rulesPath);

      this.logger.debug(`Wrote .cursorrules file: ${rulesPath} (${stats.size} bytes)`);

      return {
        success: true,
        filePath: rulesPath,
        errors,
        warnings,
        bytesWritten: stats.size,
      };

    } catch (error) {
      errors.push({
        component: 'cursor-rules',
        type: 'file_operation',
        severity: 'high',
        message: `Failed to write .cursorrules: ${(error as Error).message}`,
        path: rulesPath,
        suggestion: 'Check workspace permissions and rules content',
      });

      return { success: false, errors, warnings };
    }
  }

  /**
   * Task 5.2: Write AI context files
   */
  private async writeAIContextFiles(
    contextItems: string[],
    aiConfigDir: string,
    options: CursorDeploymentOptions
  ): Promise<{
    success: boolean;
    filePaths?: string[];
    errors: DeploymentError[];
    warnings: DeploymentWarning[];
  }> {
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];
    const filePaths: string[] = [];

    try {
      const contextDir = path.join(aiConfigDir, 'context');
      await fs.mkdir(contextDir, { recursive: true });

      for (let i = 0; i < contextItems.length; i++) {
        const contextItem = contextItems[i];
        const fileName = `context_${i + 1}.md`;
        const filePath = path.join(contextDir, fileName);

        // Validate and format context content
        const formattedContent = this.formatContextContent(contextItem, i + 1);
        
        await fs.writeFile(filePath, formattedContent, 'utf8');
        filePaths.push(filePath);

        this.logger.debug(`Wrote AI context file: ${filePath}`);
      }

      // Create context index file
      const indexPath = await this.createContextIndex(filePaths, contextDir);
      if (indexPath) {
        filePaths.push(indexPath);
      }

      return {
        success: true,
        filePaths,
        errors,
        warnings,
      };

    } catch (error) {
      errors.push({
        component: 'ai-context',
        type: 'file_operation',
        severity: 'high',
        message: `Failed to write AI context files: ${(error as Error).message}`,
        path: aiConfigDir,
        suggestion: 'Check directory permissions and context content format',
      });

      return {
        success: false,
        errors,
        warnings,
      };
    }
  }

  /**
   * Task 5.2: Write prompt template files
   */
  private async writePromptTemplates(
    prompts: Array<{ name: string; content: string; category?: string }>,
    aiConfigDir: string,
    options: CursorDeploymentOptions
  ): Promise<{
    success: boolean;
    filePaths?: string[];
    errors: DeploymentError[];
    warnings: DeploymentWarning[];
  }> {
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];
    const filePaths: string[] = [];

    try {
      const promptsDir = path.join(aiConfigDir, 'prompts');
      await fs.mkdir(promptsDir, { recursive: true });

      // Group prompts by category
      const promptsByCategory = this.groupPromptsByCategory(prompts);

      for (const [category, categoryPrompts] of Object.entries(promptsByCategory)) {
        const categoryDir = category !== 'general' 
          ? path.join(promptsDir, category)
          : promptsDir;
        
        if (category !== 'general') {
          await fs.mkdir(categoryDir, { recursive: true });
        }

        for (const prompt of categoryPrompts) {
          const fileName = this.sanitizeFileName(prompt.name) + '.md';
          const filePath = path.join(categoryDir, fileName);

          // Format prompt content
          const formattedContent = this.formatPromptContent(prompt);
          
          // Validate prompt content
          const validationResult = this.validatePromptContent(prompt);
          if (validationResult.warnings.length > 0) {
            warnings.push(...validationResult.warnings);
          }

          await fs.writeFile(filePath, formattedContent, 'utf8');
          filePaths.push(filePath);

          this.logger.debug(`Wrote prompt template: ${filePath}`);
        }
      }

      // Create prompts index file
      const indexPath = await this.createPromptsIndex(prompts, promptsDir);
      if (indexPath) {
        filePaths.push(indexPath);
      }

      return {
        success: true,
        filePaths,
        errors,
        warnings,
      };

    } catch (error) {
      errors.push({
        component: 'ai-prompts',
        type: 'file_operation',
        severity: 'high',
        message: `Failed to write prompt templates: ${(error as Error).message}`,
        path: aiConfigDir,
        suggestion: 'Check directory permissions and prompt content format',
      });

      return {
        success: false,
        errors,
        warnings,
      };
    }
  }

  /**
   * Format .cursorrules content with proper structure
   */
  private formatCursorRules(rules: string[]): string {
    const header = `# Cursor AI Rules
# Generated by Taptik CLI - ${new Date().toISOString()}
# 
# These rules guide Cursor's AI behavior for this project.
# Edit these rules to customize how the AI assistant responds.

`;

    const formattedRules = rules
      .map((rule, index) => {
        // Clean and format each rule
        const cleanRule = rule.trim();
        if (!cleanRule) return '';
        
        // Add rule numbering if not already present
        if (!cleanRule.match(/^\d+\./)) {
          return `${index + 1}. ${cleanRule}`;
        }
        return cleanRule;
      })
      .filter(rule => rule.length > 0)
      .join('\n\n');

    return header + formattedRules + '\n';
  }

  /**
   * Format AI context content as markdown
   */
  private formatContextContent(content: string, index: number): string {
    const header = `# AI Context ${index}

*Generated by Taptik CLI - ${new Date().toISOString()}*

---

`;
    
    return header + content.trim() + '\n';
  }

  /**
   * Format prompt content as markdown
   */
  private formatPromptContent(prompt: { name: string; content: string; category?: string }): string {
    const header = `# ${prompt.name}

**Category**: ${prompt.category || 'General'}  
**Generated**: ${new Date().toISOString()}

---

`;
    
    return header + prompt.content.trim() + '\n';
  }

  /**
   * Group prompts by category for organized file structure
   */
  private groupPromptsByCategory(prompts: Array<{ name: string; content: string; category?: string }>): Record<string, typeof prompts> {
    return prompts.reduce((groups, prompt) => {
      const category = prompt.category || 'general';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(prompt);
      return groups;
    }, {} as Record<string, typeof prompts>);
  }

  /**
   * Sanitize filename for cross-platform compatibility
   */
  private sanitizeFileName(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .toLowerCase()
      .substring(0, 50); // Limit length
  }

  /**
   * Create context index file for easy navigation
   */
  private async createContextIndex(filePaths: string[], contextDir: string): Promise<string | null> {
    try {
      const indexPath = path.join(contextDir, 'README.md');
      const indexContent = this.generateContextIndexContent(filePaths);
      await fs.writeFile(indexPath, indexContent, 'utf8');
      return indexPath;
    } catch (error) {
      this.logger.warn('Failed to create context index:', error);
      return null;
    }
  }

  /**
   * Create prompts index file for easy navigation
   */
  private async createPromptsIndex(prompts: Array<{ name: string; content: string; category?: string }>, promptsDir: string): Promise<string | null> {
    try {
      const indexPath = path.join(promptsDir, 'README.md');
      const indexContent = this.generatePromptsIndexContent(prompts);
      await fs.writeFile(indexPath, indexContent, 'utf8');
      return indexPath;
    } catch (error) {
      this.logger.warn('Failed to create prompts index:', error);
      return null;
    }
  }

  /**
   * Generate context index markdown content
   */
  private generateContextIndexContent(filePaths: string[]): string {
    const header = `# AI Context Files

*Generated by Taptik CLI - ${new Date().toISOString()}*

This directory contains AI context files that provide background information to Cursor's AI assistant.

## Context Files

`;

    const fileList = filePaths
      .filter(filePath => path.basename(filePath) !== 'README.md')
      .map((filePath, index) => {
        const fileName = path.basename(filePath);
        return `- [${fileName}](./${fileName}) - Context ${index + 1}`;
      })
      .join('\n');

    return header + fileList + '\n';
  }

  /**
   * Generate prompts index markdown content
   */
  private generatePromptsIndexContent(prompts: Array<{ name: string; content: string; category?: string }>): string {
    const header = `# AI Prompt Templates

*Generated by Taptik CLI - ${new Date().toISOString()}*

This directory contains reusable AI prompt templates organized by category.

## Available Prompts

`;

    const promptsByCategory = this.groupPromptsByCategory(prompts);
    const categoryList = Object.entries(promptsByCategory)
      .map(([category, categoryPrompts]) => {
        const categoryHeader = `### ${category.charAt(0).toUpperCase() + category.slice(1)}`;
        const promptList = categoryPrompts.map(prompt => {
          const fileName = this.sanitizeFileName(prompt.name) + '.md';
          const filePath = category !== 'general' ? `${category}/${fileName}` : fileName;
          return `- [${prompt.name}](./${filePath})`;
        }).join('\n');
        
        return categoryHeader + '\n\n' + promptList;
      })
      .join('\n\n');

    return header + categoryList + '\n';
  }

  /**
   * Validate cursor rules content
   */
  private validateRulesContent(content: string): { errors: DeploymentError[]; warnings: DeploymentWarning[] } {
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];

    if (content.length > 50000) { // 50KB limit
      warnings.push({
        component: 'cursor-rules',
        type: 'performance',
        message: `Large .cursorrules file (${Math.round(content.length / 1024)}KB)`,
        suggestion: 'Consider splitting into smaller, focused rule sets',
      });
    }

    if (content.includes('API_KEY') || content.includes('SECRET') || content.includes('PASSWORD')) {
      errors.push({
        component: 'cursor-rules',
        type: 'security',
        severity: 'high',
        message: 'Potential sensitive information detected in rules',
        suggestion: 'Remove any API keys, secrets, or passwords from AI rules',
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate prompt content
   */
  private validatePromptContent(prompt: { name: string; content: string }): { warnings: DeploymentWarning[] } {
    const warnings: DeploymentWarning[] = [];

    if (prompt.content.length > 10000) {
      warnings.push({
        component: 'ai-prompts',
        type: 'performance',
        message: `Large prompt template "${prompt.name}" (${Math.round(prompt.content.length / 1024)}KB)`,
        suggestion: 'Consider breaking down large prompts into smaller, focused templates',
      });
    }

    return { warnings };
  }

  /**
   * Validate total AI content size
   */
  private async validateAIContentSize(aiConfig: CursorAIConfig, warnings: DeploymentWarning[]): Promise<void> {
    let totalSize = 0;

    if (aiConfig.rules) {
      totalSize += aiConfig.rules.join('\n').length;
    }

    if (aiConfig.context) {
      totalSize += aiConfig.context.join('\n').length;
    }

    if (aiConfig.prompts) {
      totalSize += aiConfig.prompts.reduce((sum, prompt) => sum + prompt.content.length, 0);
    }

    if (totalSize > 200000) { // 200KB total limit
      warnings.push({
        component: 'ai-config',
        type: 'performance',
        message: `Large total AI content size (${Math.round(totalSize / 1024)}KB)`,
        suggestion: 'Consider optimizing AI content to improve Cursor performance',
      });
    }
  }

  /**
   * Task 5.3: Write debug configuration (launch.json)
   */
  async writeDebugConfig(
    debugConfig: CursorDebugConfig,
    options: CursorDeploymentOptions
  ): Promise<CursorFileWriteResult> {
    this.logger.log('Writing Cursor debug configuration...');

    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];

    try {
      if (!options.workspacePath) {
        errors.push({
          component: 'debug-config',
          type: 'configuration',
          severity: 'high',
          message: 'Workspace path is required for debug configuration',
          suggestion: 'Provide a workspace path to write debug configuration',
        });
        return { success: false, errors, warnings };
      }

      const directories = await this.ensureCursorDirectories(options);
      const debugConfigPath = path.join(directories.debugConfigDir || '', 'launch.json');

      // Validate debug configuration
      const validationResult = this.validateDebugConfig(debugConfig);
      warnings.push(...validationResult.warnings);

      if (validationResult.errors.length > 0) {
        errors.push(...validationResult.errors);
        return { success: false, errors, warnings };
      }

      // Handle existing debug configuration if merge is enabled
      let finalConfig = debugConfig;
      if (options.mergeStrategy === 'merge') {
        finalConfig = await this.mergeDebugConfig(debugConfigPath, debugConfig);
      }

      // Write debug configuration
      const debugJson = JSON.stringify(finalConfig, null, 2);
      await fs.writeFile(debugConfigPath, debugJson, 'utf8');

      const stats = await fs.stat(debugConfigPath);
      this.logger.log(`Debug configuration written to: ${debugConfigPath} (${stats.size} bytes)`);

      return {
        success: true,
        filePath: debugConfigPath,
        errors,
        warnings,
        bytesWritten: stats.size,
      };

    } catch (error) {
      this.logger.error('Failed to write debug configuration:', error);
      errors.push({
        component: 'debug-config',
        type: 'file_operation',
        severity: 'high',
        message: `Failed to write debug configuration: ${(error as Error).message}`,
        path: options.workspacePath || 'unknown',
        suggestion: 'Check workspace directory permissions and debug configuration format',
      });

      return { success: false, errors, warnings };
    }
  }

  /**
   * Task 5.3: Write tasks configuration (tasks.json)
   */
  async writeTasks(
    tasksConfig: CursorTasksConfig,
    options: CursorDeploymentOptions
  ): Promise<CursorFileWriteResult> {
    this.logger.log('Writing Cursor tasks configuration...');

    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];

    try {
      if (!options.workspacePath) {
        errors.push({
          component: 'tasks-config',
          type: 'configuration',
          severity: 'high',
          message: 'Workspace path is required for tasks configuration',
          suggestion: 'Provide a workspace path to write tasks configuration',
        });
        return { success: false, errors, warnings };
      }

      const directories = await this.ensureCursorDirectories(options);
      const tasksConfigPath = path.join(directories.tasksConfigDir || '', 'tasks.json');

      // Validate tasks configuration
      const validationResult = this.validateTasksConfig(tasksConfig);
      warnings.push(...validationResult.warnings);

      if (validationResult.errors.length > 0) {
        errors.push(...validationResult.errors);
        return { success: false, errors, warnings };
      }

      // Handle existing tasks configuration if merge is enabled
      let finalConfig = tasksConfig;
      if (options.mergeStrategy === 'merge') {
        finalConfig = await this.mergeTasksConfig(tasksConfigPath, tasksConfig);
      }

      // Write tasks configuration
      const tasksJson = JSON.stringify(finalConfig, null, 2);
      await fs.writeFile(tasksConfigPath, tasksJson, 'utf8');

      const stats = await fs.stat(tasksConfigPath);
      this.logger.log(`Tasks configuration written to: ${tasksConfigPath} (${stats.size} bytes)`);

      return {
        success: true,
        filePath: tasksConfigPath,
        errors,
        warnings,
        bytesWritten: stats.size,
      };

    } catch (error) {
      this.logger.error('Failed to write tasks configuration:', error);
      errors.push({
        component: 'tasks-config',
        type: 'file_operation',
        severity: 'high',
        message: `Failed to write tasks configuration: ${(error as Error).message}`,
        path: options.workspacePath || 'unknown',
        suggestion: 'Check workspace directory permissions and tasks configuration format',
      });

      return { success: false, errors, warnings };
    }
  }

  /**
   * Task 5.3: Write code snippets
   */
  async writeSnippets(
    snippetsConfig: Record<string, CursorSnippetsConfig>,
    options: CursorDeploymentOptions
  ): Promise<{
    success: boolean;
    filePaths: string[];
    errors: DeploymentError[];
    warnings: DeploymentWarning[];
  }> {
    this.logger.log('Writing Cursor code snippets...');

    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];
    const filePaths: string[] = [];

    try {
      const directories = await this.ensureCursorDirectories(options);

      for (const [language, snippets] of Object.entries(snippetsConfig)) {
        const snippetFileName = `${language}.json`;
        const snippetFilePath = path.join(directories.snippetsDir, snippetFileName);

        // Validate snippets for this language
        const validationResult = this.validateSnippetsConfig(language, snippets);
        warnings.push(...validationResult.warnings);

        if (validationResult.errors.length > 0) {
          errors.push(...validationResult.errors);
          continue;
        }

        // Handle existing snippets if merge is enabled
        let finalSnippets = snippets;
        if (options.mergeStrategy === 'merge') {
          finalSnippets = await this.mergeSnippets(snippetFilePath, snippets);
        }

        // Write snippets file
        const snippetsJson = JSON.stringify(finalSnippets, null, 2);
        await fs.writeFile(snippetFilePath, snippetsJson, 'utf8');
        filePaths.push(snippetFilePath);

        this.logger.debug(`Wrote ${language} snippets to: ${snippetFilePath}`);
      }

      this.logger.log(`Code snippets written: ${filePaths.length} files`);

      return {
        success: filePaths.length > 0,
        filePaths,
        errors,
        warnings,
      };

    } catch (error) {
      this.logger.error('Failed to write code snippets:', error);
      errors.push({
        component: 'snippets',
        type: 'file_operation',
        severity: 'high',
        message: `Failed to write code snippets: ${(error as Error).message}`,
        path: options.workspacePath || 'unknown',
        suggestion: 'Check directory permissions and snippets configuration format',
      });

      return {
        success: false,
        filePaths,
        errors,
        warnings,
      };
    }
  }

  /**
   * Task 5.3: Write workspace configuration
   */
  async writeWorkspace(
    workspaceConfig: CursorWorkspaceConfig,
    options: CursorDeploymentOptions
  ): Promise<CursorFileWriteResult> {
    this.logger.log('Writing Cursor workspace configuration...');

    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];

    try {
      if (!options.workspacePath) {
        errors.push({
          component: 'workspace-config',
          type: 'configuration',
          severity: 'high',
          message: 'Workspace path is required for workspace configuration',
          suggestion: 'Provide a workspace path to write workspace configuration',
        });
        return { success: false, errors, warnings };
      }

      const workspaceFileName = path.basename(options.workspacePath) + '.code-workspace';
      const workspaceFilePath = path.join(options.workspacePath, workspaceFileName);

      // Validate workspace configuration
      const validationResult = this.validateWorkspaceConfig(workspaceConfig);
      warnings.push(...validationResult.warnings);

      if (validationResult.errors.length > 0) {
        errors.push(...validationResult.errors);
        return { success: false, errors, warnings };
      }

      // Handle existing workspace if merge is enabled
      let finalConfig = workspaceConfig;
      if (options.mergeStrategy === 'merge') {
        finalConfig = await this.mergeWorkspaceConfig(workspaceFilePath, workspaceConfig);
      }

      // Write workspace configuration
      const workspaceJson = JSON.stringify(finalConfig, null, 2);
      await fs.writeFile(workspaceFilePath, workspaceJson, 'utf8');

      const stats = await fs.stat(workspaceFilePath);
      this.logger.log(`Workspace configuration written to: ${workspaceFilePath} (${stats.size} bytes)`);

      return {
        success: true,
        filePath: workspaceFilePath,
        errors,
        warnings,
        bytesWritten: stats.size,
      };

    } catch (error) {
      this.logger.error('Failed to write workspace configuration:', error);
      errors.push({
        component: 'workspace-config',
        type: 'file_operation',
        severity: 'high',
        message: `Failed to write workspace configuration: ${(error as Error).message}`,
        path: options.workspacePath || 'unknown',
        suggestion: 'Check workspace directory permissions and workspace configuration format',
      });

      return { success: false, errors, warnings };
    }
  }

  /**
   * Validate debug configuration
   */
  private validateDebugConfig(config: CursorDebugConfig): {
    errors: DeploymentError[];
    warnings: DeploymentWarning[];
  } {
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];

    if (!config.version) {
      errors.push({
        component: 'debug-config',
        type: 'configuration',
        severity: 'high',
        message: 'Debug configuration version is required',
        suggestion: 'Add a version field (e.g., "0.2.0")',
      });
    }

    if (!config.configurations || !Array.isArray(config.configurations)) {
      errors.push({
        component: 'debug-config',
        type: 'configuration',
        severity: 'high',
        message: 'Debug configurations array is required',
        suggestion: 'Add configurations array with debug configurations',
      });
    } else {
      config.configurations.forEach((cfg, index) => {
        if (!cfg.name) {
          errors.push({
            component: 'debug-config',
            type: 'configuration',
            severity: 'medium',
            message: `Debug configuration ${index} is missing name`,
            suggestion: 'Add a descriptive name for each debug configuration',
          });
        }

        if (!cfg.type) {
          errors.push({
            component: 'debug-config',
            type: 'configuration',
            severity: 'high',
            message: `Debug configuration "${cfg.name || index}" is missing type`,
            suggestion: 'Add a type (e.g., "node", "python", "chrome")',
          });
        }

        if (!cfg.request || !['launch', 'attach'].includes(cfg.request)) {
          errors.push({
            component: 'debug-config',
            type: 'configuration',
            severity: 'high',
            message: `Debug configuration "${cfg.name || index}" has invalid request type`,
            suggestion: 'Use "launch" or "attach" for request type',
          });
        }
      });

      if (config.configurations.length > 20) {
        warnings.push({
          component: 'debug-config',
          type: 'performance',
          message: `Large number of debug configurations (${config.configurations.length})`,
          suggestion: 'Consider organizing configurations or removing unused ones',
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate tasks configuration
   */
  private validateTasksConfig(config: CursorTasksConfig): {
    errors: DeploymentError[];
    warnings: DeploymentWarning[];
  } {
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];

    if (!config.version) {
      errors.push({
        component: 'tasks-config',
        type: 'configuration',
        severity: 'high',
        message: 'Tasks configuration version is required',
        suggestion: 'Add a version field (e.g., "2.0.0")',
      });
    }

    if (!config.tasks || !Array.isArray(config.tasks)) {
      errors.push({
        component: 'tasks-config',
        type: 'configuration',
        severity: 'high',
        message: 'Tasks array is required',
        suggestion: 'Add tasks array with task configurations',
      });
    } else {
      config.tasks.forEach((task, index) => {
        if (!task.label) {
          errors.push({
            component: 'tasks-config',
            type: 'configuration',
            severity: 'medium',
            message: `Task ${index} is missing label`,
            suggestion: 'Add a descriptive label for each task',
          });
        }

        if (!task.type) {
          errors.push({
            component: 'tasks-config',
            type: 'configuration',
            severity: 'high',
            message: `Task "${task.label || index}" is missing type`,
            suggestion: 'Add a type (e.g., "shell", "process", "npm")',
          });
        }

        if (!task.command) {
          errors.push({
            component: 'tasks-config',
            type: 'configuration',
            severity: 'high',
            message: `Task "${task.label || index}" is missing command`,
            suggestion: 'Add a command to execute',
          });
        }
      });

      if (config.tasks.length > 50) {
        warnings.push({
          component: 'tasks-config',
          type: 'performance',
          message: `Large number of tasks (${config.tasks.length})`,
          suggestion: 'Consider organizing tasks or removing unused ones',
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate snippets configuration
   */
  private validateSnippetsConfig(language: string, config: CursorSnippetsConfig): {
    errors: DeploymentError[];
    warnings: DeploymentWarning[];
  } {
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];

    const snippetNames = Object.keys(config);
    
    if (snippetNames.length === 0) {
      warnings.push({
        component: 'snippets',
        type: 'configuration',
        message: `No snippets defined for language: ${language}`,
        suggestion: 'Add snippets or remove the language configuration',
      });
    } else {
      snippetNames.forEach(snippetName => {
        const snippet = config[snippetName];

        if (!snippet.prefix) {
          errors.push({
            component: 'snippets',
            type: 'configuration',
            severity: 'high',
            message: `Snippet "${snippetName}" in ${language} is missing prefix`,
            suggestion: 'Add a prefix to trigger the snippet',
          });
        }

        if (!snippet.body) {
          errors.push({
            component: 'snippets',
            type: 'configuration',
            severity: 'high',
            message: `Snippet "${snippetName}" in ${language} is missing body`,
            suggestion: 'Add body content for the snippet',
          });
        }
      });

      if (snippetNames.length > 100) {
        warnings.push({
          component: 'snippets',
          type: 'performance',
          message: `Large number of snippets for ${language} (${snippetNames.length})`,
          suggestion: 'Consider splitting into multiple language files',
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate workspace configuration
   */
  private validateWorkspaceConfig(config: CursorWorkspaceConfig): {
    errors: DeploymentError[];
    warnings: DeploymentWarning[];
  } {
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];

    if (!config.folders || !Array.isArray(config.folders)) {
      errors.push({
        component: 'workspace-config',
        type: 'configuration',
        severity: 'high',
        message: 'Workspace folders array is required',
        suggestion: 'Add folders array with workspace folder configurations',
      });
    } else {
      config.folders.forEach((folder, index) => {
        if (!folder.path) {
          errors.push({
            component: 'workspace-config',
            type: 'configuration',
            severity: 'high',
            message: `Workspace folder ${index} is missing path`,
            suggestion: 'Add a path for each workspace folder',
          });
        }

        // Check for potentially dangerous paths
        if (folder.path.includes('..')) {
          warnings.push({
            component: 'workspace-config',
            type: 'security',
            message: `Workspace folder path contains parent directory references: ${folder.path}`,
            suggestion: 'Use absolute paths or safe relative paths',
          });
        }
      });

      if (config.folders.length > 20) {
        warnings.push({
          component: 'workspace-config',
          type: 'performance',
          message: `Large number of workspace folders (${config.folders.length})`,
          suggestion: 'Consider reducing the number of workspace folders for better performance',
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Merge debug configuration with existing
   */
  private async mergeDebugConfig(configPath: string, newConfig: CursorDebugConfig): Promise<CursorDebugConfig> {
    try {
      const existingContent = await fs.readFile(configPath, 'utf8');
      const existingConfig = JSON.parse(existingContent) as CursorDebugConfig;

      // Merge configurations, avoiding duplicates
      const mergedConfigurations = [...existingConfig.configurations];
      
      newConfig.configurations.forEach(newCfg => {
        const existingIndex = mergedConfigurations.findIndex(cfg => cfg.name === newCfg.name);
        if (existingIndex >= 0) {
          mergedConfigurations[existingIndex] = newCfg; // Replace existing
        } else {
          mergedConfigurations.push(newCfg); // Add new
        }
      });

      return {
        ...existingConfig,
        ...newConfig,
        configurations: mergedConfigurations,
      };
    } catch (error) {
      // File doesn't exist or is invalid, return new config
      return newConfig;
    }
  }

  /**
   * Merge tasks configuration with existing
   */
  private async mergeTasksConfig(configPath: string, newConfig: CursorTasksConfig): Promise<CursorTasksConfig> {
    try {
      const existingContent = await fs.readFile(configPath, 'utf8');
      const existingConfig = JSON.parse(existingContent) as CursorTasksConfig;

      // Merge tasks, avoiding duplicates
      const mergedTasks = [...existingConfig.tasks];
      
      newConfig.tasks.forEach(newTask => {
        const existingIndex = mergedTasks.findIndex(task => task.label === newTask.label);
        if (existingIndex >= 0) {
          mergedTasks[existingIndex] = newTask; // Replace existing
        } else {
          mergedTasks.push(newTask); // Add new
        }
      });

      return {
        ...existingConfig,
        ...newConfig,
        tasks: mergedTasks,
      };
    } catch (error) {
      // File doesn't exist or is invalid, return new config
      return newConfig;
    }
  }

  /**
   * Merge snippets with existing
   */
  private async mergeSnippets(configPath: string, newSnippets: CursorSnippetsConfig): Promise<CursorSnippetsConfig> {
    try {
      const existingContent = await fs.readFile(configPath, 'utf8');
      const existingSnippets = JSON.parse(existingContent) as CursorSnippetsConfig;

      return {
        ...existingSnippets,
        ...newSnippets,
      };
    } catch (error) {
      // File doesn't exist or is invalid, return new snippets
      return newSnippets;
    }
  }

  /**
   * Merge workspace configuration with existing
   */
  private async mergeWorkspaceConfig(configPath: string, newConfig: CursorWorkspaceConfig): Promise<CursorWorkspaceConfig> {
    try {
      const existingContent = await fs.readFile(configPath, 'utf8');
      const existingConfig = JSON.parse(existingContent) as CursorWorkspaceConfig;

      // Merge folders, avoiding duplicates
      const mergedFolders = [...existingConfig.folders];
      
      newConfig.folders.forEach(newFolder => {
        const existingIndex = mergedFolders.findIndex(folder => folder.path === newFolder.path);
        if (existingIndex >= 0) {
          mergedFolders[existingIndex] = newFolder; // Replace existing
        } else {
          mergedFolders.push(newFolder); // Add new
        }
      });

      // Merge settings deeply
      const mergedSettings = {
        ...existingConfig.settings,
        ...newConfig.settings,
      };

      return {
        ...existingConfig,
        ...newConfig,
        folders: mergedFolders,
        settings: mergedSettings,
      };
    } catch (error) {
      // File doesn't exist or is invalid, return new config
      return newConfig;
    }
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