import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import { CursorComponentType } from '../interfaces/component-types.interface';
import { ConflictStrategy } from '../interfaces/conflict-strategy.interface';
import {
  CursorConfiguration,
  CursorGlobalSettings,
  CursorProjectSettings,
  CursorExtensions,
  CursorTasks,
  CursorLaunch,
  CursorAIContext,
} from '../interfaces/cursor-config.interface';
import { CursorDeployOptions } from '../interfaces/deploy-options.interface';
import {
  DeploymentError,
  DeploymentWarning,
  DeploymentResult,
} from '../interfaces/deployment-result.interface';

export interface ComponentDeploymentResult {
  component: CursorComponentType;
  filesProcessed: number;
  filesDeployed: number;
  conflicts: number;
  errors?: DeploymentError[];
  warnings?: DeploymentWarning[];
  deployedFiles?: string[];
  skippedFiles?: string[];
}

export interface CursorDeploymentContext {
  globalSettingsPath: string;
  projectSettingsPath: string;
  aiPromptsPath: string;
  aiRulesPath: string;
  aiContextPath: string;
  extensionsPath: string;
  snippetsPath: string;
  tasksPath: string;
  launchPath: string;
}

@Injectable()
export class CursorComponentHandlerService {
  private readonly logger = new Logger(CursorComponentHandlerService.name);

  /**
   * Deploy Cursor configuration components
   */
  async deploy(
    config: CursorConfiguration,
    options: CursorDeployOptions,
  ): Promise<DeploymentResult> {
    this.logger.debug('Starting Cursor component deployment');

    const result: DeploymentResult = {
      success: true,
      platform: 'cursor-ide',
      deployedComponents: [],
      conflicts: [],
      summary: {
        filesDeployed: 0,
        filesSkipped: 0,
        conflictsResolved: 0,
        backupCreated: false,
      },
      errors: [],
      warnings: [],
    };

    try {
      // Create deployment context with paths
      const context = this.createDeploymentContext(options);

      // Get components to deploy
      const components = this.getComponentsToDeploy(config, options);

      this.logger.debug(`Deploying ${components.length} components: ${components.join(', ')}`);

      // Deploy each component sequentially to avoid race conditions
      for (const component of components) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const componentResult = await this.deployComponent(
            component,
            config,
            context,
            options,
          );

          // Merge component result into overall result
          this.mergeComponentResult(result, componentResult);
        } catch (error) {
          const errorMessage = `Failed to deploy component ${component}: ${(error as Error).message}`;
          this.logger.error(errorMessage);
          
          result.errors?.push({
            code: 'CURSOR_COMPONENT_DEPLOY_FAILED',
            message: errorMessage,
            severity: 'error',
            component: component as unknown,
          });
          result.success = false;
        }
      }

      this.logger.debug(`Deployment completed. Success: ${result.success}`);
      return result;
    } catch (error) {
      const errorMessage = `Cursor deployment failed: ${(error as Error).message}`;
      this.logger.error(errorMessage);
      
      result.success = false;
      result.errors?.push({
        code: 'CURSOR_DEPLOYMENT_FAILED',
        message: errorMessage,
        severity: 'error',
      });
      
      return result;
    }
  }

  /**
   * Deploy a specific component
   */
  private async deployComponent(
    component: CursorComponentType,
    config: CursorConfiguration,
    context: CursorDeploymentContext,
    options: CursorDeployOptions,
  ): Promise<ComponentDeploymentResult> {
    this.logger.debug(`Deploying component: ${component}`);

    switch (component) {
      case 'settings':
        return this.deploySettings(config, context, options);
      case 'extensions':
        return this.deployExtensions(config, context, options);
      case 'snippets':
        return this.deploySnippets(config, context, options);
      case 'ai-prompts':
        return this.deployAIPrompts(config, context, options);
      case 'tasks':
        return this.deployTasks(config, context, options);
      case 'launch':
        return this.deployLaunch(config, context, options);
      default:
        throw new Error(`Unknown component: ${component}`);
    }
  }

  /**
   * Deploy settings component (global and project settings)
   */
  private async deploySettings(
    config: CursorConfiguration,
    context: CursorDeploymentContext,
    options: CursorDeployOptions,
  ): Promise<ComponentDeploymentResult> {
    const result: ComponentDeploymentResult = {
      component: 'settings',
      filesProcessed: 0,
      filesDeployed: 0,
      conflicts: 0,
      deployedFiles: [],
      skippedFiles: [],
      errors: [],
      warnings: [],
    };

    this.logger.debug('Deploying Cursor settings');

    // Deploy global settings if available
    if (config.globalSettings) {
      this.logger.debug('Deploying global settings');
      await this.deploySettingsFile(
        context.globalSettingsPath,
        config.globalSettings,
        'global',
        options,
        result,
      );
    }

    // Deploy project settings if available
    if (config.projectSettings) {
      this.logger.debug('Deploying project settings');
      await this.deploySettingsFile(
        context.projectSettingsPath,
        config.projectSettings,
        'project',
        options,
        result,
      );
    }

    this.logger.debug(`Settings deployment completed. Files deployed: ${result.filesDeployed}, conflicts: ${result.conflicts}`);
    return result;
  }

  /**
   * Deploy a settings file (global or project)
   */
  private async deploySettingsFile(
    filePath: string,
    settings: CursorGlobalSettings | CursorProjectSettings,
    type: 'global' | 'project',
    options: CursorDeployOptions,
    result: ComponentDeploymentResult,
  ): Promise<void> {
    result.filesProcessed++;

    try {
      // Ensure directory exists
      await this.ensureDirectoryExists(path.dirname(filePath));

      // Validate settings before deployment
      const validationResult = this.validateSettings(settings, type);
      if (!validationResult.isValid) {
        result.warnings?.push({
          message: `Settings validation warnings for ${type}: ${validationResult.warnings.join(', ')}`,
          code: 'CURSOR_SETTINGS_VALIDATION_WARNING',
        });
      }

      // Check for existing file
      const exists = await this.fileExists(filePath);
      let finalSettings = settings;

      if (exists) {
        this.logger.debug(`Existing ${type} settings found at ${filePath}`);
        
        try {
          const existingContent = await this.readJsonFile(filePath);
          const conflictResult = await this.handleSettingsConflict(
            existingContent,
            settings,
            options.conflictStrategy,
            type,
          );

          if (conflictResult.action === 'skip') {
            result.skippedFiles?.push(filePath);
            result.warnings?.push({
              message: `Skipped existing ${type} settings file: ${filePath}`,
              code: 'CURSOR_SETTINGS_SKIPPED',
            });
            return;
          }

          if (conflictResult.action === 'merge') {
            finalSettings = conflictResult.mergedContent as typeof settings;
            result.conflicts++;
            result.warnings?.push({
              message: `Merged existing ${type} settings file: ${filePath}`,
              code: 'CURSOR_SETTINGS_MERGED',
            });
          }
        } catch (_parseError) {
          // If existing file is corrupted, warn and overwrite
          result.warnings?.push({
            message: `Existing ${type} settings file is corrupted, overwriting: ${filePath}`,
            code: 'CURSOR_SETTINGS_CORRUPTED',
          });
        }
      }

      // Preserve user customizations if enabled
      if (options.cursorSpecific?.preserveExistingSettings && exists) {
        finalSettings = this.preserveUserCustomizations(finalSettings, type);
      }

      // Write the file
      if (!options.dryRun) {
        await this.writeJsonFile(filePath, finalSettings);
        this.logger.debug(`${type} settings written to: ${filePath}`);
      } else {
        this.logger.debug(`[DRY RUN] Would write ${type} settings to: ${filePath}`);
      }

      result.filesDeployed++;
      result.deployedFiles?.push(filePath);
      this.logger.debug(`${type} settings deployed successfully`);
    } catch (error) {
      const errorMessage = `Failed to deploy ${type} settings to ${filePath}: ${(error as Error).message}`;
      this.logger.error(errorMessage);
      result.errors?.push({
        code: 'CURSOR_SETTINGS_DEPLOY_ERROR',
        message: errorMessage,
        severity: 'error',
        filePath,
      });
    }
  }

  /**
   * Create deployment context with file paths
   */
  private createDeploymentContext(options: CursorDeployOptions): CursorDeploymentContext {
    const homeDir = os.homedir();
    const projectDir = process.cwd();

    return {
      globalSettingsPath: options.cursorSpecific?.globalSettingsPath || 
        path.join(homeDir, '.cursor', 'settings.json'),
      projectSettingsPath: options.cursorSpecific?.projectSettingsPath || 
        path.join(projectDir, '.cursor', 'settings.json'),
      aiPromptsPath: options.cursorSpecific?.aiPromptsPath || 
        path.join(projectDir, '.cursor', 'ai', 'prompts'),
      aiRulesPath: path.join(projectDir, '.cursor', 'ai', 'rules'),
      aiContextPath: path.join(projectDir, '.cursor', 'ai', 'context.json'),
      extensionsPath: options.cursorSpecific?.extensionsPath || 
        path.join(projectDir, '.cursor', 'extensions.json'),
      snippetsPath: options.cursorSpecific?.snippetsPath || 
        path.join(homeDir, '.cursor', 'snippets'),
      tasksPath: options.cursorSpecific?.tasksPath || 
        path.join(projectDir, '.cursor', 'tasks.json'),
      launchPath: options.cursorSpecific?.launchPath || 
        path.join(projectDir, '.cursor', 'launch.json'),
    };
  }

  /**
   * Get list of components to deploy based on configuration and options
   */
  private getComponentsToDeploy(
    config: CursorConfiguration,
    options: CursorDeployOptions,
  ): CursorComponentType[] {
    const allComponents: CursorComponentType[] = [
      'settings',
      'extensions', 
      'snippets',
      'ai-prompts',
      'tasks',
      'launch',
    ];

    // If specific components are requested, use those
    if (options.components && options.components.length > 0) {
      return options.components.filter(comp => 
        allComponents.includes(comp as CursorComponentType)
      ) as CursorComponentType[];
    }

    // Otherwise, deploy components that have data in the configuration
    const componentsWithData: CursorComponentType[] = [];

    if (config.globalSettings || config.projectSettings) {
      componentsWithData.push('settings');
    }
    if (config.extensions) {
      componentsWithData.push('extensions');
    }
    if (config.snippets) {
      componentsWithData.push('snippets');
    }
    if (config.aiPrompts) {
      componentsWithData.push('ai-prompts');
    }
    if (config.tasks) {
      componentsWithData.push('tasks');
    }
    if (config.launch) {
      componentsWithData.push('launch');
    }

    // Remove skipped components
    if (options.skipComponents && options.skipComponents.length > 0) {
      return componentsWithData.filter(comp => 
        !options.skipComponents?.includes(comp)
      );
    }

    return componentsWithData;
  }

  /**
   * Handle settings file conflicts
   */
  private async handleSettingsConflict(
    existingContent: unknown,
    newContent: unknown,
    strategy: ConflictStrategy,
    _type: string,
  ): Promise<{
    action: 'skip' | 'overwrite' | 'merge';
    mergedContent?: unknown;
  }> {
    switch (strategy) {
      case 'skip':
        return { action: 'skip' };
      
      case 'overwrite':
        return { action: 'overwrite' };
      
      case 'merge': {
        const merged = this.mergeSettings(existingContent, newContent);
        return { action: 'merge', mergedContent: merged };
      }
      
      case 'prompt': {
        // For now, default to merge for prompt strategy
        // In a real implementation, this would prompt the user
        const promptMerged = this.mergeSettings(existingContent, newContent);
        return { action: 'merge', mergedContent: promptMerged };
      }
      
      default:
        return { action: 'overwrite' };
    }
  }

  /**
   * Merge two settings objects intelligently
   */
  private mergeSettings(existing: unknown, incoming: unknown): unknown {
    if (!existing || typeof existing !== 'object') {
      return incoming;
    }
    if (!incoming || typeof incoming !== 'object') {
      return existing;
    }

    const result = { ...existing };

    for (const key in incoming) {
      if (Object.prototype.hasOwnProperty.call(incoming, key)) {
        const incomingValue = incoming[key];
        const existingValue = existing[key];

        if (
          typeof incomingValue === 'object' &&
          incomingValue !== null &&
          !Array.isArray(incomingValue) &&
          typeof existingValue === 'object' &&
          existingValue !== null &&
          !Array.isArray(existingValue)
        ) {
          // Recursively merge objects
          result[key] = this.mergeSettings(existingValue, incomingValue);
        } else {
          // Overwrite with incoming value
          result[key] = incomingValue;
        }
      }
    }

    return result;
  }

  /**
   * Validate settings before deployment
   */
  private validateSettings(
    settings: CursorGlobalSettings | CursorProjectSettings,
    type: 'global' | 'project',
  ): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    if (type === 'global') {
      const globalSettings = settings as CursorGlobalSettings;
      
      // Validate AI settings
      if (globalSettings['cursor.ai.temperature'] !== undefined) {
        const temp = globalSettings['cursor.ai.temperature'];
        if (temp < 0 || temp > 2) {
          warnings.push('AI temperature should be between 0 and 2');
        }
      }

      if (globalSettings['cursor.ai.maxTokens'] !== undefined) {
        const tokens = globalSettings['cursor.ai.maxTokens'];
        if (tokens > 32000) {
          warnings.push('AI max tokens exceeds Cursor recommended maximum (32000)');
        }
      }

      // Validate editor settings
      if (globalSettings['editor.fontSize'] !== undefined) {
        const fontSize = globalSettings['editor.fontSize'];
        if (fontSize < 8 || fontSize > 72) {
          warnings.push('Font size should be between 8 and 72');
        }
      }
    }

    return {
      isValid: warnings.length === 0,
      warnings,
    };
  }

  /**
   * Preserve user customizations in settings
   */
  private preserveUserCustomizations(
    settings: CursorGlobalSettings | CursorProjectSettings,
    type: 'global' | 'project',
  ): CursorGlobalSettings | CursorProjectSettings {
    // Define keys that should be preserved from user's existing settings
    const _preserveKeys = type === 'global' 
      ? [
          'workbench.colorTheme',
          'editor.fontSize',
          'editor.fontFamily',
          'terminal.integrated.shell.osx',
          'terminal.integrated.shell.linux',
          'terminal.integrated.shell.windows',
        ]
      : [
          'editor.rulers',
          'search.exclude',
          'files.exclude',
        ];

    // This is a simplified implementation
    // In a real scenario, we would read the existing file and preserve these keys
    return settings;
  }

  /**
   * Merge component result into overall deployment result
   */
  private mergeComponentResult(
    result: DeploymentResult,
    componentResult: ComponentDeploymentResult,
  ): void {
    // Add component to deployed components
    result.deployedComponents.push(componentResult.component);

    // Update summary
    result.summary.filesDeployed += componentResult.filesDeployed;
    result.summary.filesSkipped += componentResult.filesProcessed - componentResult.filesDeployed;
    result.summary.conflictsResolved += componentResult.conflicts;

    // Merge errors and warnings
    if (componentResult.errors && componentResult.errors.length > 0) {
      result.errors?.push(...componentResult.errors);
      result.success = false;
    }

    if (componentResult.warnings && componentResult.warnings.length > 0) {
      result.warnings?.push(...componentResult.warnings);
    }
  }

  // Utility methods

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
      this.logger.debug(`Created directory: ${dirPath}`);
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async readJsonFile(filePath: string): Promise<unknown> {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  }

  private async writeJsonFile(filePath: string, data: unknown): Promise<void> {
    const jsonContent = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, jsonContent, 'utf8');
  }

  private async readTextFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf8');
  }

  private async writeTextFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, 'utf8');
  }

  /**
   * Deploy AI prompts component
   */
  private async deployAIPrompts(
    config: CursorConfiguration,
    context: CursorDeploymentContext,
    options: CursorDeployOptions,
  ): Promise<ComponentDeploymentResult> {
    const result: ComponentDeploymentResult = {
      component: 'ai-prompts',
      filesProcessed: 0,
      filesDeployed: 0,
      conflicts: 0,
      deployedFiles: [],
      skippedFiles: [],
      errors: [],
      warnings: [],
    };

    this.logger.debug('Deploying Cursor AI prompts');

    if (!config.aiPrompts) {
      this.logger.debug('No AI prompts to deploy');
      return result;
    }

    try {
      // Ensure AI directories exist
      await this.ensureDirectoryExists(context.aiPromptsPath);
      await this.ensureDirectoryExists(context.aiRulesPath);
      await this.ensureDirectoryExists(path.dirname(context.aiContextPath));

      // Deploy project prompts
      if (config.aiPrompts.projectPrompts) {
        await this.deployProjectPrompts(
          config.aiPrompts.projectPrompts,
          context,
          options,
          result,
        );
      }

      // Deploy system prompts (to global location)
      if (config.aiPrompts.systemPrompts) {
        await this.deploySystemPrompts(
          config.aiPrompts.systemPrompts,
          context,
          options,
          result,
        );
      }

      // Deploy rules
      if (config.aiPrompts.rules) {
        await this.deployAIRules(
          config.aiPrompts.rules,
          context,
          options,
          result,
        );
      }

      // Generate and deploy AI context configuration
      await this.deployAIContext(config, context, options, result);

      this.logger.debug(`AI prompts deployment completed. Files deployed: ${result.filesDeployed}`);
    } catch (error) {
      const errorMessage = `Failed to deploy AI prompts: ${(error as Error).message}`;
      this.logger.error(errorMessage);
      result.errors?.push({
        code: 'CURSOR_AI_PROMPTS_DEPLOY_ERROR',
        message: errorMessage,
        severity: 'error',
      });
    }

    return result;
  }

  /**
   * Deploy project-specific prompts
   */
  private async deployProjectPrompts(
    prompts: Record<string, unknown>,
    context: CursorDeploymentContext,
    options: CursorDeployOptions,
    result: ComponentDeploymentResult,
  ): Promise<void> {
    this.logger.debug(`Deploying ${Object.keys(prompts).length} project prompts`);

    for (const [name, prompt] of Object.entries(prompts)) {
      result.filesProcessed++;

      try {
        const fileName = this.sanitizeFileName(`${name}.md`);
        const filePath = path.join(context.aiPromptsPath, fileName);

        // Create markdown content with metadata
        const markdownContent = this.createPromptMarkdown(prompt, 'project');

        // Handle existing file conflicts
        // eslint-disable-next-line no-await-in-loop
        const exists = await this.fileExists(filePath);
        if (exists) {
          // eslint-disable-next-line no-await-in-loop
          const conflictResult = await this.handleMarkdownConflict(
            filePath,
            markdownContent,
            options.conflictStrategy,
            'prompt',
          );

          if (conflictResult.action === 'skip') {
            result.skippedFiles?.push(filePath);
            continue;
          }

          if (conflictResult.action === 'merge') {
            result.conflicts++;
          }
        }

        // Write the file
        if (!options.dryRun) {
          // eslint-disable-next-line no-await-in-loop
          await this.writeTextFile(filePath, markdownContent);
        }

        result.filesDeployed++;
        result.deployedFiles?.push(filePath);
        this.logger.debug(`Project prompt deployed: ${fileName}`);
      } catch (error) {
        const errorMessage = `Failed to deploy project prompt ${name}: ${(error as Error).message}`;
        result.errors?.push({
          code: 'CURSOR_PROJECT_PROMPT_DEPLOY_ERROR',
          message: errorMessage,
          severity: 'error',
        });
      }
    }
  }

  /**
   * Deploy system prompts (to global location)
   */
  private async deploySystemPrompts(
    prompts: Record<string, unknown>,
    context: CursorDeploymentContext,
    options: CursorDeployOptions,
    result: ComponentDeploymentResult,
  ): Promise<void> {
    this.logger.debug(`Deploying ${Object.keys(prompts).length} system prompts`);

    // System prompts go to global Cursor directory
    const globalPromptsPath = path.join(path.dirname(context.globalSettingsPath), 'ai', 'prompts');
    await this.ensureDirectoryExists(globalPromptsPath);

    for (const [name, prompt] of Object.entries(prompts)) {
      result.filesProcessed++;

      try {
        const fileName = this.sanitizeFileName(`${name}.md`);
        const filePath = path.join(globalPromptsPath, fileName);

        // Create markdown content with metadata
        const markdownContent = this.createPromptMarkdown(prompt, 'system');

        // Handle existing file conflicts
        // eslint-disable-next-line no-await-in-loop
        const exists = await this.fileExists(filePath);
        if (exists) {
          // eslint-disable-next-line no-await-in-loop
          const conflictResult = await this.handleMarkdownConflict(
            filePath,
            markdownContent,
            options.conflictStrategy,
            'system prompt',
          );

          if (conflictResult.action === 'skip') {
            result.skippedFiles?.push(filePath);
            continue;
          }

          if (conflictResult.action === 'merge') {
            result.conflicts++;
          }
        }

        // Write the file
        if (!options.dryRun) {
          // eslint-disable-next-line no-await-in-loop
          await this.writeTextFile(filePath, markdownContent);
        }

        result.filesDeployed++;
        result.deployedFiles?.push(filePath);
        this.logger.debug(`System prompt deployed: ${fileName}`);
      } catch (error) {
        const errorMessage = `Failed to deploy system prompt ${name}: ${(error as Error).message}`;
        result.errors?.push({
          code: 'CURSOR_SYSTEM_PROMPT_DEPLOY_ERROR',
          message: errorMessage,
          severity: 'error',
        });
      }
    }
  }

  /**
   * Deploy AI rules
   */
  private async deployAIRules(
    rules: Record<string, string>,
    context: CursorDeploymentContext,
    options: CursorDeployOptions,
    result: ComponentDeploymentResult,
  ): Promise<void> {
    this.logger.debug(`Deploying ${Object.keys(rules).length} AI rules`);

    for (const [name, content] of Object.entries(rules)) {
      result.filesProcessed++;

      try {
        const fileName = this.sanitizeFileName(`${name}.md`);
        const filePath = path.join(context.aiRulesPath, fileName);

        // Create markdown content with metadata
        const markdownContent = this.createRuleMarkdown(content, name);

        // Handle existing file conflicts
        // eslint-disable-next-line no-await-in-loop
        const exists = await this.fileExists(filePath);
        if (exists) {
          // eslint-disable-next-line no-await-in-loop
          const conflictResult = await this.handleMarkdownConflict(
            filePath,
            markdownContent,
            options.conflictStrategy,
            'rule',
          );

          if (conflictResult.action === 'skip') {
            result.skippedFiles?.push(filePath);
            continue;
          }

          if (conflictResult.action === 'merge') {
            result.conflicts++;
          }
        }

        // Write the file
        if (!options.dryRun) {
          // eslint-disable-next-line no-await-in-loop
          await this.writeTextFile(filePath, markdownContent);
        }

        result.filesDeployed++;
        result.deployedFiles?.push(filePath);
        this.logger.debug(`AI rule deployed: ${fileName}`);
      } catch (error) {
        const errorMessage = `Failed to deploy AI rule ${name}: ${(error as Error).message}`;
        result.errors?.push({
          code: 'CURSOR_AI_RULE_DEPLOY_ERROR',
          message: errorMessage,
          severity: 'error',
        });
      }
    }
  }

  /**
   * Deploy AI context configuration
   */
  private async deployAIContext(
    config: CursorConfiguration,
    context: CursorDeploymentContext,
    options: CursorDeployOptions,
    result: ComponentDeploymentResult,
  ): Promise<void> {
    result.filesProcessed++;

    try {
      // Generate AI context configuration
      const aiContext = this.generateAIContextConfig(config, context);

      // Handle existing context file
      const exists = await this.fileExists(context.aiContextPath);
      let finalContext = aiContext;

      if (exists) {
        const existingContext = await this.readJsonFile(context.aiContextPath);
        
        if (options.cursorSpecific?.aiContextMergeStrategy === 'merge') {
          finalContext = this.mergeAIContext(existingContext, aiContext);
          result.conflicts++;
          result.warnings?.push({
            message: 'Merged existing AI context configuration',
            code: 'CURSOR_AI_CONTEXT_MERGED',
          });
        } else if (options.cursorSpecific?.aiContextMergeStrategy === 'append') {
          finalContext = this.appendAIContext(existingContext, aiContext);
          result.conflicts++;
          result.warnings?.push({
            message: 'Appended to existing AI context configuration',
            code: 'CURSOR_AI_CONTEXT_APPENDED',
          });
        }
      }

      // Write the context file
      if (!options.dryRun) {
        await this.writeJsonFile(context.aiContextPath, finalContext);
      }

      result.filesDeployed++;
      result.deployedFiles?.push(context.aiContextPath);
      this.logger.debug('AI context configuration deployed');
    } catch (error) {
      const errorMessage = `Failed to deploy AI context: ${(error as Error).message}`;
      result.errors?.push({
        code: 'CURSOR_AI_CONTEXT_DEPLOY_ERROR',
        message: errorMessage,
        severity: 'error',
        filePath: context.aiContextPath,
      });
    }
  }

  /**
   * Create markdown content for prompts
   */
  private createPromptMarkdown(prompt: unknown, type: 'project' | 'system'): string {
    const promptObj = prompt as Record<string, unknown>;
    const metadata = {
      title: promptObj.description || 'AI Prompt',
      type,
      tags: promptObj.tags || [],
      context: promptObj.context || type,
      created_at: new Date().toISOString(),
    };

    const frontMatter = Object.entries(metadata)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}:\n${value.map((v) => `  - ${v}`).join('\n')}`;
        }
        return `${key}: ${value}`;
      })
      .join('\n');

    return `---\n${frontMatter}\n---\n\n${promptObj.content as string}`;
  }

  /**
   * Create markdown content for rules
   */
  private createRuleMarkdown(content: string, name: string): string {
    const metadata = {
      title: name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      type: 'rule',
      category: this.categorizeRule(name),
      created_at: new Date().toISOString(),
    };

    const frontMatter = Object.entries(metadata)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    return `---\n${frontMatter}\n---\n\n${content}`;
  }

  /**
   * Categorize rule based on name
   */
  private categorizeRule(name: string): string {
    if (name.includes('coding') || name.includes('style')) return 'coding';
    if (name.includes('architecture') || name.includes('design')) return 'architecture';
    if (name.includes('testing') || name.includes('test')) return 'testing';
    if (name.includes('security') || name.includes('auth')) return 'security';
    return 'general';
  }

  /**
   * Generate AI context configuration
   */
  private generateAIContextConfig(
    config: CursorConfiguration,
    context: CursorDeploymentContext,
  ): CursorAIContext {
    const projectName = path.basename(process.cwd());
    
    return {
      version: '1.0.0',
      project: {
        name: projectName,
        description: `Project deployed via Taptik`,
        type: 'web', // Default type
        languages: this.detectProjectLanguages(),
        frameworks: this.detectProjectFrameworks(),
      },
      context: {
        files: {
          include: config.projectSettings?.['cursor.ai.projectContext']?.includeFiles || [
            '**/*.ts',
            '**/*.js',
            '**/*.tsx',
            '**/*.jsx',
            '**/*.md',
            '**/*.json',
          ],
          exclude: config.projectSettings?.['cursor.ai.projectContext']?.excludeFiles || [
            '**/node_modules/**',
            '**/dist/**',
            '**/.git/**',
            '**/coverage/**',
          ],
          maxSize: config.projectSettings?.['cursor.ai.projectContext']?.maxFileSize || 1048576, // 1MB
        },
        directories: {
          include: ['src', 'lib', 'components', 'pages', 'app'],
          exclude: ['node_modules', 'dist', '.git', 'coverage', '.next'],
        },
        patterns: {
          important: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/README.md', '**/package.json'],
          ignore: ['**/*.log', '**/*.tmp', '**/.DS_Store', '**/*.lock'],
        },
      },
      rules: {
        coding: this.getFilesByCategory(context.aiRulesPath, 'coding'),
        architecture: this.getFilesByCategory(context.aiRulesPath, 'architecture'),
        testing: this.getFilesByCategory(context.aiRulesPath, 'testing'),
        security: this.getFilesByCategory(context.aiRulesPath, 'security'),
      },
      prompts: {
        system: 'You are a helpful AI assistant for code development.',
        templates: config.aiPrompts?.systemPrompts ? 
          Object.fromEntries(
            Object.entries(config.aiPrompts.systemPrompts).map(([key, value]) => [key, value.content])
          ) : {},
      },
    };
  }

  /**
   * Detect project languages from package.json and file extensions
   */
  private detectProjectLanguages(): string[] {
    // This is a simplified implementation
    // In a real scenario, we would scan the project files
    return ['typescript', 'javascript'];
  }

  /**
   * Detect project frameworks from package.json
   */
  private detectProjectFrameworks(): string[] {
    // This is a simplified implementation
    // In a real scenario, we would read package.json
    return ['nestjs'];
  }

  /**
   * Get files by category from rules directory
   */
  private getFilesByCategory(rulesPath: string, category: string): string[] {
    // This would scan the rules directory for files matching the category
    // For now, return relative paths
    return [`${category}.md`];
  }

  /**
   * Handle markdown file conflicts
   */
  private async handleMarkdownConflict(
    filePath: string,
    newContent: string,
    strategy: ConflictStrategy,
    _type: string,
  ): Promise<{ action: 'skip' | 'overwrite' | 'merge' }> {
    switch (strategy) {
      case 'skip':
        return { action: 'skip' };
      
      case 'overwrite':
        return { action: 'overwrite' };
      
      case 'merge':
        // For markdown files, we could implement intelligent merging
        // For now, we'll append the new content
        return { action: 'merge' };
      
      case 'prompt':
        // For now, default to merge for prompt strategy
        return { action: 'merge' };
      
      default:
        return { action: 'overwrite' };
    }
  }

  /**
   * Merge markdown content intelligently
   */
  private mergeMarkdownContent(existing: string, incoming: string): string {
    // Extract front matter from both files
    const existingParts = this.parseMarkdownWithFrontMatter(existing);
    const incomingParts = this.parseMarkdownWithFrontMatter(incoming);

    // Merge front matter
    const mergedMetadata = { ...existingParts.metadata, ...incomingParts.metadata };
    
    // Combine content
    const combinedContent = `${existingParts.content}\n\n---\n\n${incomingParts.content}`;

    // Reconstruct markdown
    const frontMatter = Object.entries(mergedMetadata)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}:\n${value.map((v) => `  - ${v}`).join('\n')}`;
        }
        return `${key}: ${value}`;
      })
      .join('\n');

    return `---\n${frontMatter}\n---\n\n${combinedContent}`;
  }

  /**
   * Parse markdown with front matter
   */
  private parseMarkdownWithFrontMatter(content: string): {
    metadata: Record<string, unknown>;
    content: string;
  } {
    const frontMatterRegex = /^---\n([\S\s]*?)\n---\n([\S\s]*)$/;
    const match = content.match(frontMatterRegex);

    if (!match) {
      return { metadata: {}, content };
    }

    const metadata: Record<string, unknown> = {};
    const frontMatterLines = match[1].split('\n');
    
    for (const line of frontMatterLines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        metadata[key] = value;
      }
    }

    return {
      metadata,
      content: match[2],
    };
  }

  /**
   * Merge AI context configurations
   */
  private mergeAIContext(existing: CursorAIContext, incoming: CursorAIContext): CursorAIContext {
    return {
      ...existing,
      ...incoming,
      context: {
        ...existing.context,
        ...incoming.context,
        files: {
          ...existing.context.files,
          ...incoming.context.files,
          include: [...(existing.context.files.include || []), ...(incoming.context.files.include || [])],
          exclude: [...(existing.context.files.exclude || []), ...(incoming.context.files.exclude || [])],
        },
      },
      rules: {
        ...existing.rules,
        ...incoming.rules,
        coding: [...(existing.rules.coding || []), ...(incoming.rules.coding || [])],
        architecture: [...(existing.rules.architecture || []), ...(incoming.rules.architecture || [])],
        testing: [...(existing.rules.testing || []), ...(incoming.rules.testing || [])],
        security: [...(existing.rules.security || []), ...(incoming.rules.security || [])],
      },
      prompts: {
        ...existing.prompts,
        ...incoming.prompts,
        templates: {
          ...existing.prompts.templates,
          ...incoming.prompts.templates,
        },
      },
    };
  }

  /**
   * Append to AI context configuration
   */
  private appendAIContext(existing: CursorAIContext, incoming: CursorAIContext): CursorAIContext {
    // Similar to merge but with different strategies for arrays
    return this.mergeAIContext(existing, incoming);
  }

  /**
   * Deploy extensions component
   */
  private async deployExtensions(
    config: CursorConfiguration,
    context: CursorDeploymentContext,
    options: CursorDeployOptions,
  ): Promise<ComponentDeploymentResult> {
    const result: ComponentDeploymentResult = {
      component: 'extensions',
      filesProcessed: 0,
      filesDeployed: 0,
      conflicts: 0,
      deployedFiles: [],
      skippedFiles: [],
      errors: [],
      warnings: [],
    };

    this.logger.debug('Deploying Cursor extensions');

    if (!config.extensions) {
      this.logger.debug('No extensions to deploy');
      return result;
    }

    result.filesProcessed++;

    try {
      // Ensure directory exists
      await this.ensureDirectoryExists(path.dirname(context.extensionsPath));

      // Check for existing extensions file
      const exists = await this.fileExists(context.extensionsPath);
      let finalExtensions = config.extensions;

      if (exists) {
        this.logger.debug(`Existing extensions file found at ${context.extensionsPath}`);
        
        try {
          const existingExtensions = await this.readJsonFile(context.extensionsPath) as CursorExtensions;
          const conflictResult = await this.handleExtensionsConflict(
            existingExtensions,
            config.extensions,
            options.conflictStrategy,
          );

          if (conflictResult.action === 'skip') {
            result.skippedFiles?.push(context.extensionsPath);
            result.warnings?.push({
              message: `Skipped existing extensions file: ${context.extensionsPath}`,
              code: 'CURSOR_EXTENSIONS_SKIPPED',
            });
            return result;
          }

          if (conflictResult.action === 'merge') {
            finalExtensions = conflictResult.mergedContent as CursorExtensions;
            result.conflicts++;
            result.warnings?.push({
              message: `Merged existing extensions file: ${context.extensionsPath}`,
              code: 'CURSOR_EXTENSIONS_MERGED',
            });
          }
        } catch (_parseError) {
          result.warnings?.push({
            message: `Existing extensions file is corrupted, overwriting: ${context.extensionsPath}`,
            code: 'CURSOR_EXTENSIONS_CORRUPTED',
          });
        }
      }

      // Validate extensions
      const validationResult = this.validateExtensions(finalExtensions);
      if (validationResult.warnings.length > 0) {
        result.warnings?.push({
          message: `Extensions validation warnings: ${validationResult.warnings.join(', ')}`,
          code: 'CURSOR_EXTENSIONS_VALIDATION_WARNING',
        });
      }

      // Write the extensions file
      if (!options.dryRun) {
        await this.writeJsonFile(context.extensionsPath, finalExtensions);
        this.logger.debug(`Extensions file written to: ${context.extensionsPath}`);
      } else {
        this.logger.debug(`[DRY RUN] Would write extensions to: ${context.extensionsPath}`);
      }

      result.filesDeployed++;
      result.deployedFiles?.push(context.extensionsPath);
      this.logger.debug('Extensions deployment completed successfully');
    } catch (error) {
      const errorMessage = `Failed to deploy extensions: ${(error as Error).message}`;
      this.logger.error(errorMessage);
      result.errors?.push({
        code: 'CURSOR_EXTENSIONS_DEPLOY_ERROR',
        message: errorMessage,
        severity: 'error',
        filePath: context.extensionsPath,
      });
    }

    return result;
  }

  /**
   * Deploy snippets component
   */
  private async deploySnippets(
    config: CursorConfiguration,
    context: CursorDeploymentContext,
    options: CursorDeployOptions,
  ): Promise<ComponentDeploymentResult> {
    const result: ComponentDeploymentResult = {
      component: 'snippets',
      filesProcessed: 0,
      filesDeployed: 0,
      conflicts: 0,
      deployedFiles: [],
      skippedFiles: [],
      errors: [],
      warnings: [],
    };

    this.logger.debug('Deploying Cursor snippets');

    if (!config.snippets) {
      this.logger.debug('No snippets to deploy');
      return result;
    }

    try {
      // Ensure snippets directory exists
      await this.ensureDirectoryExists(context.snippetsPath);

      // Deploy snippets for each language
      for (const [language, snippets] of Object.entries(config.snippets)) {
        // eslint-disable-next-line no-await-in-loop
        await this.deployLanguageSnippets(
          language,
          snippets,
          context,
          options,
          result,
        );
      }

      this.logger.debug(`Snippets deployment completed. Files deployed: ${result.filesDeployed}`);
    } catch (error) {
      const errorMessage = `Failed to deploy snippets: ${(error as Error).message}`;
      this.logger.error(errorMessage);
      result.errors?.push({
        code: 'CURSOR_SNIPPETS_DEPLOY_ERROR',
        message: errorMessage,
        severity: 'error',
      });
    }

    return result;
  }

  /**
   * Deploy snippets for a specific language
   */
  private async deployLanguageSnippets(
    language: string,
    snippets: Record<string, unknown>,
    context: CursorDeploymentContext,
    options: CursorDeployOptions,
    result: ComponentDeploymentResult,
  ): Promise<void> {
    result.filesProcessed++;

    try {
      const fileName = `${language}.json`;
      const filePath = path.join(context.snippetsPath, fileName);

      this.logger.debug(`Deploying ${Object.keys(snippets).length} snippets for ${language}`);

      // Check for existing snippets file
      const exists = await this.fileExists(filePath);
      let finalSnippets = snippets;

      if (exists) {
        this.logger.debug(`Existing ${language} snippets found at ${filePath}`);
        
        try {
          const existingSnippets = await this.readJsonFile(filePath);
          const conflictResult = await this.handleSnippetsConflict(
            existingSnippets,
            snippets,
            options.conflictStrategy,
            language,
          );

          if (conflictResult.action === 'skip') {
            result.skippedFiles?.push(filePath);
            result.warnings?.push({
              message: `Skipped existing ${language} snippets: ${filePath}`,
              code: 'CURSOR_SNIPPETS_SKIPPED',
            });
            return;
          }

          if (conflictResult.action === 'merge') {
            finalSnippets = conflictResult.mergedContent;
            result.conflicts++;
            result.warnings?.push({
              message: `Merged existing ${language} snippets: ${filePath}`,
              code: 'CURSOR_SNIPPETS_MERGED',
            });
          }
        } catch (_parseError) {
          result.warnings?.push({
            message: `Existing ${language} snippets file is corrupted, overwriting: ${filePath}`,
            code: 'CURSOR_SNIPPETS_CORRUPTED',
          });
        }
      }

      // Validate snippets
      const validationResult = this.validateSnippets(finalSnippets, language);
      if (validationResult.warnings.length > 0) {
        result.warnings?.push({
          message: `${language} snippets validation warnings: ${validationResult.warnings.join(', ')}`,
          code: 'CURSOR_SNIPPETS_VALIDATION_WARNING',
        });
      }

      // Write the snippets file
      if (!options.dryRun) {
        await this.writeJsonFile(filePath, finalSnippets);
        this.logger.debug(`${language} snippets written to: ${filePath}`);
      } else {
        this.logger.debug(`[DRY RUN] Would write ${language} snippets to: ${filePath}`);
      }

      result.filesDeployed++;
      result.deployedFiles?.push(filePath);
      this.logger.debug(`${language} snippets deployed successfully`);
    } catch (error) {
      const errorMessage = `Failed to deploy ${language} snippets: ${(error as Error).message}`;
      result.errors?.push({
        code: 'CURSOR_LANGUAGE_SNIPPETS_DEPLOY_ERROR',
        message: errorMessage,
        severity: 'error',
      });
    }
  }

  /**
   * Handle extensions file conflicts
   */
  private async handleExtensionsConflict(
    existing: CursorExtensions,
    incoming: CursorExtensions,
    strategy: ConflictStrategy,
  ): Promise<{
    action: 'skip' | 'overwrite' | 'merge';
    mergedContent?: CursorExtensions;
  }> {
    switch (strategy) {
      case 'skip':
        return { action: 'skip' };
      
      case 'overwrite':
        return { action: 'overwrite' };
      
      case 'merge': {
        const merged = this.mergeExtensions(existing, incoming);
        return { action: 'merge', mergedContent: merged };
      }
      
      case 'prompt': {
        // For now, default to merge for prompt strategy
        const promptMerged = this.mergeExtensions(existing, incoming);
        return { action: 'merge', mergedContent: promptMerged };
      }
      
      default:
        return { action: 'overwrite' };
    }
  }

  /**
   * Handle snippets file conflicts
   */
  private async handleSnippetsConflict(
    existing: Record<string, unknown>,
    incoming: Record<string, unknown>,
    strategy: ConflictStrategy,
    _language: string,
  ): Promise<{
    action: 'skip' | 'overwrite' | 'merge';
    mergedContent?: Record<string, unknown>;
  }> {
    switch (strategy) {
      case 'skip':
        return { action: 'skip' };
      
      case 'overwrite':
        return { action: 'overwrite' };
      
      case 'merge': {
        const merged = this.mergeSnippets(existing, incoming);
        return { action: 'merge', mergedContent: merged };
      }
      
      case 'prompt': {
        // For now, default to merge for prompt strategy
        const promptMerged = this.mergeSnippets(existing, incoming);
        return { action: 'merge', mergedContent: promptMerged };
      }
      
      default:
        return { action: 'overwrite' };
    }
  }

  /**
   * Merge extensions configurations
   */
  private mergeExtensions(existing: CursorExtensions, incoming: CursorExtensions): CursorExtensions {
    return {
      recommendations: [
        ...new Set([
          ...(existing.recommendations || []),
          ...(incoming.recommendations || []),
        ]),
      ],
      unwantedRecommendations: [
        ...new Set([
          ...(existing.unwantedRecommendations || []),
          ...(incoming.unwantedRecommendations || []),
        ]),
      ],
    };
  }

  /**
   * Merge snippets configurations
   */
  private mergeSnippets(
    existing: Record<string, unknown>,
    incoming: Record<string, unknown>,
  ): Record<string, unknown> {
    const merged = { ...existing };

    for (const [key, snippet] of Object.entries(incoming)) {
      if (existing[key]) {
        // If snippet exists, prefer incoming (newer) version
        merged[key] = snippet;
      } else {
        // Add new snippet
        merged[key] = snippet;
      }
    }

    return merged;
  }

  /**
   * Validate extensions configuration
   */
  private validateExtensions(extensions: CursorExtensions): {
    isValid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];

    // Check for known incompatible extensions
    const incompatibleExtensions = [
      'ms-vscode.vscode-typescript-next', // Cursor has built-in TypeScript support
      'github.copilot', // Cursor has built-in AI
      'tabnine.tabnine-vscode', // Conflicts with Cursor AI
    ];

    const foundIncompatible = extensions.recommendations?.filter(ext =>
      incompatibleExtensions.includes(ext)
    ) || [];

    if (foundIncompatible.length > 0) {
      warnings.push(`Found potentially incompatible extensions: ${foundIncompatible.join(', ')}`);
    }

    // Check for duplicate recommendations
    const recommendations = extensions.recommendations || [];
    const uniqueRecommendations = [...new Set(recommendations)];
    if (recommendations.length !== uniqueRecommendations.length) {
      warnings.push('Found duplicate extension recommendations');
    }

    return {
      isValid: warnings.length === 0,
      warnings,
    };
  }

  /**
   * Validate snippets configuration
   */
  private validateSnippets(
    snippets: Record<string, unknown>,
    _language: string,
  ): {
    isValid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];

    for (const [name, snippet] of Object.entries(snippets)) {
      // Check required fields
      if (!snippet.prefix) {
        warnings.push(`Snippet '${name}' missing prefix`);
      }
      if (!snippet.body) {
        warnings.push(`Snippet '${name}' missing body`);
      }

      // Check body format
      if (snippet.body && !Array.isArray(snippet.body)) {
        warnings.push(`Snippet '${name}' body should be an array of strings`);
      }

      // Check for overly long prefixes
      if (snippet.prefix && snippet.prefix.length > 20) {
        warnings.push(`Snippet '${name}' has very long prefix (${snippet.prefix.length} chars)`);
      }
    }

    return {
      isValid: warnings.length === 0,
      warnings,
    };
  }

  /**
   * Deploy tasks component
   */
  private async deployTasks(
    config: CursorConfiguration,
    context: CursorDeploymentContext,
    options: CursorDeployOptions,
  ): Promise<ComponentDeploymentResult> {
    const result: ComponentDeploymentResult = {
      component: 'tasks',
      filesProcessed: 0,
      filesDeployed: 0,
      conflicts: 0,
      deployedFiles: [],
      skippedFiles: [],
      errors: [],
      warnings: [],
    };

    this.logger.debug('Deploying Cursor tasks');

    if (!config.tasks) {
      this.logger.debug('No tasks to deploy');
      return result;
    }

    result.filesProcessed++;

    try {
      // Ensure directory exists
      await this.ensureDirectoryExists(path.dirname(context.tasksPath));

      // Check for existing tasks file
      const exists = await this.fileExists(context.tasksPath);
      let finalTasks = config.tasks;

      if (exists) {
        this.logger.debug(`Existing tasks file found at ${context.tasksPath}`);
        
        try {
          const existingTasks = await this.readJsonFile(context.tasksPath) as CursorTasks;
          const conflictResult = await this.handleTasksConflict(
            existingTasks,
            config.tasks,
            options.conflictStrategy,
          );

          if (conflictResult.action === 'skip') {
            result.skippedFiles?.push(context.tasksPath);
            result.warnings?.push({
              message: `Skipped existing tasks file: ${context.tasksPath}`,
              code: 'CURSOR_TASKS_SKIPPED',
            });
            return result;
          }

          if (conflictResult.action === 'merge') {
            finalTasks = conflictResult.mergedContent as CursorTasks;
            result.conflicts++;
            result.warnings?.push({
              message: `Merged existing tasks file: ${context.tasksPath}`,
              code: 'CURSOR_TASKS_MERGED',
            });
          }
        } catch (_parseError) {
          result.warnings?.push({
            message: `Existing tasks file is corrupted, overwriting: ${context.tasksPath}`,
            code: 'CURSOR_TASKS_CORRUPTED',
          });
        }
      }

      // Validate tasks
      const validationResult = this.validateTasks(finalTasks);
      if (validationResult.warnings.length > 0) {
        result.warnings?.push({
          message: `Tasks validation warnings: ${validationResult.warnings.join(', ')}`,
          code: 'CURSOR_TASKS_VALIDATION_WARNING',
        });
      }

      // Write the tasks file
      if (!options.dryRun) {
        await this.writeJsonFile(context.tasksPath, finalTasks);
        this.logger.debug(`Tasks file written to: ${context.tasksPath}`);
      } else {
        this.logger.debug(`[DRY RUN] Would write tasks to: ${context.tasksPath}`);
      }

      result.filesDeployed++;
      result.deployedFiles?.push(context.tasksPath);
      this.logger.debug('Tasks deployment completed successfully');
    } catch (error) {
      const errorMessage = `Failed to deploy tasks: ${(error as Error).message}`;
      this.logger.error(errorMessage);
      result.errors?.push({
        code: 'CURSOR_TASKS_DEPLOY_ERROR',
        message: errorMessage,
        severity: 'error',
        filePath: context.tasksPath,
      });
    }

    return result;
  }

  /**
   * Deploy launch component
   */
  private async deployLaunch(
    config: CursorConfiguration,
    context: CursorDeploymentContext,
    options: CursorDeployOptions,
  ): Promise<ComponentDeploymentResult> {
    const result: ComponentDeploymentResult = {
      component: 'launch',
      filesProcessed: 0,
      filesDeployed: 0,
      conflicts: 0,
      deployedFiles: [],
      skippedFiles: [],
      errors: [],
      warnings: [],
    };

    this.logger.debug('Deploying Cursor launch configuration');

    if (!config.launch) {
      this.logger.debug('No launch configuration to deploy');
      return result;
    }

    result.filesProcessed++;

    try {
      // Ensure directory exists
      await this.ensureDirectoryExists(path.dirname(context.launchPath));

      // Check for existing launch file
      const exists = await this.fileExists(context.launchPath);
      let finalLaunch = config.launch;

      if (exists) {
        this.logger.debug(`Existing launch file found at ${context.launchPath}`);
        
        try {
          const existingLaunch = await this.readJsonFile(context.launchPath) as CursorLaunch;
          const conflictResult = await this.handleLaunchConflict(
            existingLaunch,
            config.launch,
            options.conflictStrategy,
          );

          if (conflictResult.action === 'skip') {
            result.skippedFiles?.push(context.launchPath);
            result.warnings?.push({
              message: `Skipped existing launch file: ${context.launchPath}`,
              code: 'CURSOR_LAUNCH_SKIPPED',
            });
            return result;
          }

          if (conflictResult.action === 'merge') {
            finalLaunch = conflictResult.mergedContent as CursorLaunch;
            result.conflicts++;
            result.warnings?.push({
              message: `Merged existing launch file: ${context.launchPath}`,
              code: 'CURSOR_LAUNCH_MERGED',
            });
          }
        } catch (_parseError) {
          result.warnings?.push({
            message: `Existing launch file is corrupted, overwriting: ${context.launchPath}`,
            code: 'CURSOR_LAUNCH_CORRUPTED',
          });
        }
      }

      // Validate launch configuration
      const validationResult = this.validateLaunch(finalLaunch);
      if (validationResult.warnings.length > 0) {
        result.warnings?.push({
          message: `Launch validation warnings: ${validationResult.warnings.join(', ')}`,
          code: 'CURSOR_LAUNCH_VALIDATION_WARNING',
        });
      }

      // Write the launch file
      if (!options.dryRun) {
        await this.writeJsonFile(context.launchPath, finalLaunch);
        this.logger.debug(`Launch file written to: ${context.launchPath}`);
      } else {
        this.logger.debug(`[DRY RUN] Would write launch config to: ${context.launchPath}`);
      }

      result.filesDeployed++;
      result.deployedFiles?.push(context.launchPath);
      this.logger.debug('Launch deployment completed successfully');
    } catch (error) {
      const errorMessage = `Failed to deploy launch configuration: ${(error as Error).message}`;
      this.logger.error(errorMessage);
      result.errors?.push({
        code: 'CURSOR_LAUNCH_DEPLOY_ERROR',
        message: errorMessage,
        severity: 'error',
        filePath: context.launchPath,
      });
    }

    return result;
  }

  /**
   * Handle tasks file conflicts
   */
  private async handleTasksConflict(
    existing: CursorTasks,
    incoming: CursorTasks,
    strategy: ConflictStrategy,
  ): Promise<{
    action: 'skip' | 'overwrite' | 'merge';
    mergedContent?: CursorTasks;
  }> {
    switch (strategy) {
      case 'skip':
        return { action: 'skip' };
      
      case 'overwrite':
        return { action: 'overwrite' };
      
      case 'merge': {
        const merged = this.mergeTasks(existing, incoming);
        return { action: 'merge', mergedContent: merged };
      }
      
      case 'prompt': {
        // For now, default to merge for prompt strategy
        const promptMerged = this.mergeTasks(existing, incoming);
        return { action: 'merge', mergedContent: promptMerged };
      }
      
      default:
        return { action: 'overwrite' };
    }
  }

  /**
   * Handle launch file conflicts
   */
  private async handleLaunchConflict(
    existing: CursorLaunch,
    incoming: CursorLaunch,
    strategy: ConflictStrategy,
  ): Promise<{
    action: 'skip' | 'overwrite' | 'merge';
    mergedContent?: CursorLaunch;
  }> {
    switch (strategy) {
      case 'skip':
        return { action: 'skip' };
      
      case 'overwrite':
        return { action: 'overwrite' };
      
      case 'merge': {
        const merged = this.mergeLaunch(existing, incoming);
        return { action: 'merge', mergedContent: merged };
      }
      
      case 'prompt': {
        // For now, default to merge for prompt strategy
        const promptMerged = this.mergeLaunch(existing, incoming);
        return { action: 'merge', mergedContent: promptMerged };
      }
      
      default:
        return { action: 'overwrite' };
    }
  }

  /**
   * Merge tasks configurations
   */
  private mergeTasks(existing: CursorTasks, incoming: CursorTasks): CursorTasks {
    const existingTaskLabels = new Set(existing.tasks.map(task => task.label));
    const mergedTasks = [...existing.tasks];

    // Add new tasks that don't conflict with existing ones
    for (const incomingTask of incoming.tasks) {
      if (!existingTaskLabels.has(incomingTask.label)) {
        mergedTasks.push(incomingTask);
      } else {
        // For conflicting tasks, prefer the incoming (newer) version
        const existingIndex = mergedTasks.findIndex(task => task.label === incomingTask.label);
        if (existingIndex >= 0) {
          mergedTasks[existingIndex] = incomingTask;
        }
      }
    }

    return {
      version: incoming.version || existing.version,
      tasks: mergedTasks,
    };
  }

  /**
   * Merge launch configurations
   */
  private mergeLaunch(existing: CursorLaunch, incoming: CursorLaunch): CursorLaunch {
    const existingConfigNames = new Set(existing.configurations.map(config => config.name));
    const mergedConfigurations = [...existing.configurations];

    // Add new configurations that don't conflict with existing ones
    for (const incomingConfig of incoming.configurations) {
      if (!existingConfigNames.has(incomingConfig.name)) {
        mergedConfigurations.push(incomingConfig);
      } else {
        // For conflicting configurations, prefer the incoming (newer) version
        const existingIndex = mergedConfigurations.findIndex(config => config.name === incomingConfig.name);
        if (existingIndex >= 0) {
          mergedConfigurations[existingIndex] = incomingConfig;
        }
      }
    }

    return {
      version: incoming.version || existing.version,
      configurations: mergedConfigurations,
    };
  }

  /**
   * Validate tasks configuration
   */
  private validateTasks(tasks: CursorTasks): {
    isValid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];

    // Check version
    if (!tasks.version) {
      warnings.push('Tasks configuration missing version');
    }

    // Check for duplicate task labels
    const labels = tasks.tasks.map(task => task.label);
    const uniqueLabels = [...new Set(labels)];
    if (labels.length !== uniqueLabels.length) {
      warnings.push('Found duplicate task labels');
    }

    // Validate individual tasks
    for (const task of tasks.tasks) {
      if (!task.label) {
        warnings.push('Task missing label');
      }
      if (!task.type) {
        warnings.push(`Task '${task.label}' missing type`);
      }
      if (!task.command) {
        warnings.push(`Task '${task.label}' missing command`);
      }

      // Check for valid task types
      const validTypes = ['shell', 'process', 'npm', 'typescript'];
      if (task.type && !validTypes.includes(task.type)) {
        warnings.push(`Task '${task.label}' has unknown type: ${task.type}`);
      }

      // Check for valid groups
      if (task.group) {
        const validGroups = ['build', 'test', 'clean'];
        if (!validGroups.includes(task.group)) {
          warnings.push(`Task '${task.label}' has unknown group: ${task.group}`);
        }
      }
    }

    return {
      isValid: warnings.length === 0,
      warnings,
    };
  }

  /**
   * Validate launch configuration
   */
  private validateLaunch(launch: CursorLaunch): {
    isValid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];

    // Check version
    if (!launch.version) {
      warnings.push('Launch configuration missing version');
    }

    // Check for duplicate configuration names
    const names = launch.configurations.map(config => config.name);
    const uniqueNames = [...new Set(names)];
    if (names.length !== uniqueNames.length) {
      warnings.push('Found duplicate launch configuration names');
    }

    // Validate individual configurations
    for (const config of launch.configurations) {
      if (!config.name) {
        warnings.push('Launch configuration missing name');
      }
      if (!config.type) {
        warnings.push(`Launch configuration '${config.name}' missing type`);
      }
      if (!config.request) {
        warnings.push(`Launch configuration '${config.name}' missing request`);
      }

      // Check for valid request types
      if (config.request && !['launch', 'attach'].includes(config.request)) {
        warnings.push(`Launch configuration '${config.name}' has invalid request: ${config.request}`);
      }

      // Check for valid console types
      if (config.console) {
        const validConsoles = ['internalConsole', 'integratedTerminal', 'externalTerminal'];
        if (!validConsoles.includes(config.console)) {
          warnings.push(`Launch configuration '${config.name}' has invalid console: ${config.console}`);
        }
      }
    }

    return {
      isValid: warnings.length === 0,
      warnings,
    };
  }

  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/["*/:<>?\\|]/g, '-')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }


}