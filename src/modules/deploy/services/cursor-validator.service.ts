import { Injectable, Logger } from '@nestjs/common';

import {
  CursorGlobalSettings,
  CursorProjectSettings,
  CursorAIConfig,
  CursorExtensionsConfig,
  CursorDebugConfig,
  CursorTasksConfig,
  CursorSnippetsConfig,
  CursorWorkspaceConfig,
} from '../interfaces/cursor-config.interface';
import { CursorTransformationResult } from './cursor-transformer.service';
import { CursorContentValidatorService } from './cursor-content-validator.service';
import { CursorSchemaValidatorService } from './cursor-schema-validator.service';
import { CursorExtensionValidatorService } from './cursor-extension-validator.service';

export interface CursorValidationResult {
  valid: boolean;
  errors: CursorValidationError[];
  warnings: CursorValidationWarning[];
  statistics: CursorValidationStatistics;
  validationLog: CursorValidationLogEntry[];
}

export interface CursorValidationError {
  code: string;
  message: string;
  component: string;
  field?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestion: string;
}

export interface CursorValidationWarning {
  code: string;
  message: string;
  component: string;
  field?: string;
  suggestion: string;
}

export interface CursorValidationStatistics {
  totalComponents: number;
  validatedComponents: number;
  errorCount: number;
  warningCount: number;
  validationTime: number;
  securityIssues: number;
  compatibilityIssues: number;
}

export interface CursorValidationLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  component: string;
  message: string;
  details?: any;
}

export interface CursorValidationOptions {
  strictMode?: boolean;
  skipSecurityScan?: boolean;
  skipCompatibilityCheck?: boolean;
  targetCursorVersion?: string;
  validateAllComponents?: boolean;
}

@Injectable()
export class CursorValidatorService {
  private readonly logger = new Logger(CursorValidatorService.name);

  constructor(
    private readonly contentValidator: CursorContentValidatorService,
    private readonly schemaValidator: CursorSchemaValidatorService,
    private readonly extensionValidator: CursorExtensionValidatorService
  ) {}

  /**
   * Validate complete Cursor configuration
   */
  async validateConfiguration(
    config: CursorTransformationResult,
    options: CursorValidationOptions = {}
  ): Promise<CursorValidationResult> {
    const startTime = Date.now();
    const result = this.initializeValidationResult();

    this.addLogEntry(result, 'info', 'validation', 'Starting configuration validation');

    try {
      // Count total components
      result.statistics.totalComponents = this.countComponents(config);

      // Validate global settings
      if (config.globalSettings) {
        await this.validateGlobalSettings(config.globalSettings, result, options);
        result.statistics.validatedComponents++;
      }

      // Validate project settings
      if (config.projectSettings) {
        await this.validateProjectSettings(config.projectSettings, result, options);
        result.statistics.validatedComponents++;
      }

      // Validate AI configuration
      if (config.aiConfig) {
        await this.validateAIConfiguration(config.aiConfig, result, options);
        result.statistics.validatedComponents++;
      }

      // Validate extensions configuration
      if (config.extensionsConfig) {
        await this.validateExtensionsConfiguration(config.extensionsConfig, result, options);
        result.statistics.validatedComponents++;
      }

      // Validate debug configuration
      if (config.debugConfig) {
        await this.validateDebugConfiguration(config.debugConfig, result, options);
        result.statistics.validatedComponents++;
      }

      // Validate tasks configuration
      if (config.tasksConfig) {
        await this.validateTasksConfiguration(config.tasksConfig, result, options);
        result.statistics.validatedComponents++;
      }

      // Validate snippets configuration
      if (config.snippetsConfig) {
        await this.validateSnippetsConfiguration(config.snippetsConfig, result, options);
        result.statistics.validatedComponents++;
      }

      // Validate workspace configuration
      if (config.workspaceConfig) {
        await this.validateWorkspaceConfiguration(config.workspaceConfig, result, options);
        result.statistics.validatedComponents++;
      }

      // Perform cross-component validation
      await this.validateComponentCompatibility(config, result, options);

      // Finalize validation result
      this.finalizeValidationResult(result, startTime);
      
      this.addLogEntry(result, 'info', 'validation', 
        `Configuration validation completed: ${result.errors.length} errors, ${result.warnings.length} warnings`
      );

    } catch (error) {
      this.addError(result, 'VALIDATION_FAILURE', 
        `Configuration validation failed: ${(error as Error).message}`,
        'validation',
        undefined,
        'critical',
        'Check validation setup and configuration structure'
      );
    }

    return result;
  }

  /**
   * Validate individual component
   */
  async validateComponent(
    componentType: string,
    component: any,
    options: CursorValidationOptions = {}
  ): Promise<CursorValidationResult> {
    const startTime = Date.now();
    const result = this.initializeValidationResult();

    this.addLogEntry(result, 'info', 'component-validation', 
      `Starting validation for component: ${componentType}`
    );

    try {
      result.statistics.totalComponents = 1;

      switch (componentType.toLowerCase()) {
        case 'globalsettings':
          await this.validateGlobalSettings(component as CursorGlobalSettings, result, options);
          break;
        case 'projectsettings':
          await this.validateProjectSettings(component as CursorProjectSettings, result, options);
          break;
        case 'aiconfig':
          await this.validateAIConfiguration(component as CursorAIConfig, result, options);
          break;
        case 'extensionsconfig':
          await this.validateExtensionsConfiguration(component as CursorExtensionsConfig, result, options);
          break;
        case 'debugconfig':
          await this.validateDebugConfiguration(component as CursorDebugConfig, result, options);
          break;
        case 'tasksconfig':
          await this.validateTasksConfiguration(component as CursorTasksConfig, result, options);
          break;
        case 'snippetsconfig':
          await this.validateSnippetsConfiguration(component as CursorSnippetsConfig, result, options);
          break;
        case 'workspaceconfig':
          await this.validateWorkspaceConfiguration(component as CursorWorkspaceConfig, result, options);
          break;
        default:
          this.addError(result, 'UNKNOWN_COMPONENT',
            `Unknown component type: ${componentType}`,
            'component-validation',
            undefined,
            'medium',
            'Use a valid component type for validation'
          );
      }

      if (result.errors.length === 0) {
        result.statistics.validatedComponents = 1;
      }

      this.finalizeValidationResult(result, startTime);
      
      this.addLogEntry(result, 'info', 'component-validation', 
        `Component validation completed for ${componentType}: ${result.errors.length} errors, ${result.warnings.length} warnings`
      );

    } catch (error) {
      this.addError(result, 'COMPONENT_VALIDATION_FAILURE',
        `Component validation failed: ${(error as Error).message}`,
        'component-validation',
        undefined,
        'high',
        'Check component structure and validation logic'
      );
    }

    return result;
  }

  /**
   * Validate global settings
   */
  private async validateGlobalSettings(
    settings: CursorGlobalSettings,
    result: CursorValidationResult,
    options: CursorValidationOptions
  ): Promise<void> {
    this.addLogEntry(result, 'debug', 'global-settings', 'Validating global settings');

    // Schema validation
    if (!options.skipSecurityScan) {
      try {
        const schemaResult = await this.schemaValidator.validateGlobalSettings(settings);
        if (!schemaResult.valid) {
          schemaResult.errors.forEach(error => {
            this.addError(result, 'SCHEMA_VALIDATION_ERROR', error, 'global-settings', 
              undefined, 'medium', 'Fix schema validation errors');
          });
        }
      } catch (error) {
        this.addWarning(result, 'SCHEMA_VALIDATION_FAILED',
          `Schema validation failed for global settings: ${(error as Error).message}`,
          'global-settings',
          undefined,
          'Manual validation recommended'
        );
      }
    }

    // Validate editor settings
    if (settings.editor) {
      this.validateEditorSettings(settings.editor, result);
    }

    // Validate workbench settings
    if (settings.workbench) {
      this.validateWorkbenchSettings(settings.workbench, result);
    }

    // Validate file settings
    if (settings.files) {
      this.validateFileSettings(settings.files, result);
    }

    // Validate terminal settings
    if (settings.terminal) {
      this.validateTerminalSettings(settings.terminal, result);
    }
  }

  /**
   * Validate project settings
   */
  private async validateProjectSettings(
    settings: CursorProjectSettings,
    result: CursorValidationResult,
    options: CursorValidationOptions
  ): Promise<void> {
    this.addLogEntry(result, 'debug', 'project-settings', 'Validating project settings');

    // Schema validation
    if (!options.skipSecurityScan) {
      try {
        const schemaResult = await this.schemaValidator.validateProjectSettings(settings);
        if (!schemaResult.valid) {
          schemaResult.errors.forEach(error => {
            this.addError(result, 'SCHEMA_VALIDATION_ERROR', error, 'project-settings',
              undefined, 'medium', 'Fix schema validation errors');
          });
        }
      } catch (error) {
        this.addWarning(result, 'SCHEMA_VALIDATION_FAILED',
          `Schema validation failed for project settings: ${(error as Error).message}`,
          'project-settings',
          undefined,
          'Manual validation recommended'
        );
      }
    }

    // Validate search settings
    if (settings.search) {
      this.validateSearchSettings(settings.search, result);
    }

    // Validate language-specific settings
    this.validateLanguageSettings(settings, result);
  }

  /**
   * Validate AI configuration
   */
  private async validateAIConfiguration(
    config: CursorAIConfig,
    result: CursorValidationResult,
    options: CursorValidationOptions
  ): Promise<void> {
    this.addLogEntry(result, 'debug', 'ai-config', 'Validating AI configuration');

    // Use content validator for AI-specific security checks
    if (!options.skipSecurityScan) {
      try {
        const aiValidationResult = await this.contentValidator.validateAIContent(config);
        if (!aiValidationResult.valid) {
          aiValidationResult.errors.forEach(error => {
            this.addError(result, 'AI_SECURITY_ERROR', error, 'ai-config',
              undefined, 'high', 'Review and sanitize AI content');
            result.statistics.securityIssues++;
          });
        }

        aiValidationResult.warnings.forEach(warning => {
          this.addWarning(result, 'AI_SECURITY_WARNING', warning, 'ai-config',
            undefined, 'Consider reviewing AI content'
          );
        });
      } catch (error) {
        this.addWarning(result, 'AI_VALIDATION_FAILED',
          `AI content validation failed: ${(error as Error).message}`,
          'ai-config',
          undefined,
          'Manual security review recommended'
        );
      }
    }

    // Validate AI rules
    if (config.rules && Array.isArray(config.rules)) {
      this.validateAIRules(config.rules, result);
    }

    // Validate AI context files
    if (config.contextFiles && Array.isArray(config.contextFiles)) {
      this.validateAIContextFiles(config.contextFiles, result);
    }

    // Validate AI prompts
    if (config.prompts && Array.isArray(config.prompts)) {
      this.validateAIPrompts(config.prompts, result);
    }
  }

  /**
   * Validate extensions configuration
   */
  private async validateExtensionsConfiguration(
    config: CursorExtensionsConfig,
    result: CursorValidationResult,
    options: CursorValidationOptions
  ): Promise<void> {
    this.addLogEntry(result, 'debug', 'extensions-config', 'Validating extensions configuration');

    // Validate recommended extensions
    if (config.recommendations && Array.isArray(config.recommendations)) {
      for (const extensionId of config.recommendations) {
        if (!this.isValidExtensionId(extensionId)) {
          this.addError(result, 'INVALID_EXTENSION_ID',
            `Invalid extension ID format: ${extensionId}`,
            'extensions-config',
            'recommendations',
            'medium',
            'Use proper publisher.name format for extension IDs'
          );
        } else if (!options.skipCompatibilityCheck) {
          // Check extension compatibility
          try {
            const isCompatible = await this.extensionValidator.validateExtensionCompatibility(extensionId);
            if (!isCompatible) {
              this.addWarning(result, 'EXTENSION_COMPATIBILITY',
                `Extension may not be compatible with target Cursor version: ${extensionId}`,
                'extensions-config',
                'recommendations',
                'Verify extension compatibility with target Cursor version'
              );
              result.statistics.compatibilityIssues++;
            }
          } catch (error) {
            this.addWarning(result, 'EXTENSION_CHECK_FAILED',
              `Failed to check extension compatibility: ${extensionId}`,
              'extensions-config',
              'recommendations',
              'Manual compatibility verification recommended'
            );
          }
        }
      }
    }

    // Validate unwanted recommendations
    if (config.unwantedRecommendations && Array.isArray(config.unwantedRecommendations)) {
      for (const extensionId of config.unwantedRecommendations) {
        if (!this.isValidExtensionId(extensionId)) {
          this.addError(result, 'INVALID_EXTENSION_ID',
            `Invalid extension ID format: ${extensionId}`,
            'extensions-config',
            'unwantedRecommendations',
            'medium',
            'Use proper publisher.name format for extension IDs'
          );
        }
      }
    }
  }

  /**
   * Validate debug configuration
   */
  private async validateDebugConfiguration(
    config: CursorDebugConfig,
    result: CursorValidationResult,
    options: CursorValidationOptions
  ): Promise<void> {
    this.addLogEntry(result, 'debug', 'debug-config', 'Validating debug configuration');

    // Validate version
    if (!config.version) {
      this.addError(result, 'MISSING_VERSION',
        'Debug configuration missing version field',
        'debug-config',
        'version',
        'high',
        'Add version field to debug configuration'
      );
    } else if (!this.isValidDebugVersion(config.version)) {
      this.addError(result, 'INVALID_VERSION',
        `Invalid debug configuration version: ${config.version}`,
        'debug-config',
        'version',
        'medium',
        'Use supported debug configuration version (0.2.0)'
      );
    }

    // Validate configurations
    if (!config.configurations || !Array.isArray(config.configurations)) {
      this.addError(result, 'MISSING_CONFIGURATIONS',
        'Debug configuration missing configurations array',
        'debug-config',
        'configurations',
        'high',
        'Add configurations array to debug configuration'
      );
    } else {
      config.configurations.forEach((debugConfig, index) => {
        this.validateDebugConfigurationItem(debugConfig, index, result);
      });
    }
  }

  /**
   * Validate tasks configuration
   */
  private async validateTasksConfiguration(
    config: CursorTasksConfig,
    result: CursorValidationResult,
    options: CursorValidationOptions
  ): Promise<void> {
    this.addLogEntry(result, 'debug', 'tasks-config', 'Validating tasks configuration');

    // Validate version
    if (!config.version) {
      this.addError(result, 'MISSING_VERSION',
        'Tasks configuration missing version field',
        'tasks-config',
        'version',
        'high',
        'Add version field to tasks configuration'
      );
    } else if (!this.isValidTasksVersion(config.version)) {
      this.addError(result, 'INVALID_VERSION',
        `Invalid tasks configuration version: ${config.version}`,
        'tasks-config',
        'version',
        'medium',
        'Use supported tasks configuration version (2.0.0)'
      );
    }

    // Validate tasks
    if (!config.tasks || !Array.isArray(config.tasks)) {
      this.addError(result, 'MISSING_TASKS',
        'Tasks configuration missing tasks array',
        'tasks-config',
        'tasks',
        'high',
        'Add tasks array to tasks configuration'
      );
    } else {
      config.tasks.forEach((task, index) => {
        this.validateTaskItem(task, index, result);
      });
    }
  }

  /**
   * Validate snippets configuration
   */
  private async validateSnippetsConfiguration(
    config: CursorSnippetsConfig,
    result: CursorValidationResult,
    options: CursorValidationOptions
  ): Promise<void> {
    this.addLogEntry(result, 'debug', 'snippets-config', 'Validating snippets configuration');

    const languageKeys = Object.keys(config);
    if (languageKeys.length === 0) {
      this.addWarning(result, 'EMPTY_SNIPPETS',
        'Snippets configuration is empty',
        'snippets-config',
        undefined,
        'Add snippet definitions for supported languages'
      );
    }

    languageKeys.forEach(language => {
      this.validateLanguageSnippets(language, config[language], result);
    });
  }

  /**
   * Validate workspace configuration
   */
  private async validateWorkspaceConfiguration(
    config: CursorWorkspaceConfig,
    result: CursorValidationResult,
    options: CursorValidationOptions
  ): Promise<void> {
    this.addLogEntry(result, 'debug', 'workspace-config', 'Validating workspace configuration');

    // Validate workspace name
    if (!config.name || typeof config.name !== 'string') {
      this.addError(result, 'INVALID_WORKSPACE_NAME',
        'Workspace configuration missing or invalid name',
        'workspace-config',
        'name',
        'medium',
        'Provide a valid workspace name'
      );
    }

    // Validate folders
    if (config.folders && Array.isArray(config.folders)) {
      config.folders.forEach((folder, index) => {
        this.validateWorkspaceFolder(folder, index, result);
      });
    }

    // Validate settings
    if (config.settings && typeof config.settings === 'object') {
      this.validateWorkspaceSettings(config.settings, result);
    }
  }

  /**
   * Validate component compatibility
   */
  private async validateComponentCompatibility(
    config: CursorTransformationResult,
    result: CursorValidationResult,
    options: CursorValidationOptions
  ): Promise<void> {
    if (options.skipCompatibilityCheck) return;

    this.addLogEntry(result, 'debug', 'compatibility', 'Validating component compatibility');

    // Check for conflicting settings
    this.validateSettingsCompatibility(config, result);

    // Check for missing dependencies
    this.validateDependencies(config, result);

    // Check for version mismatches
    this.validateVersionCompatibility(config, result, options);
  }

  // Private helper methods
  private initializeValidationResult(): CursorValidationResult {
    return {
      valid: true,
      errors: [],
      warnings: [],
      statistics: {
        totalComponents: 0,
        validatedComponents: 0,
        errorCount: 0,
        warningCount: 0,
        validationTime: 0,
        securityIssues: 0,
        compatibilityIssues: 0,
      },
      validationLog: [],
    };
  }

  private finalizeValidationResult(result: CursorValidationResult, startTime: number): void {
    result.statistics.errorCount = result.errors.length;
    result.statistics.warningCount = result.warnings.length;
    result.statistics.validationTime = Date.now() - startTime;
    result.valid = result.errors.length === 0;
  }

  private countComponents(config: CursorTransformationResult): number {
    let count = 0;
    if (config.globalSettings) count++;
    if (config.projectSettings) count++;
    if (config.aiConfig) count++;
    if (config.extensionsConfig) count++;
    if (config.debugConfig) count++;
    if (config.tasksConfig) count++;
    if (config.snippetsConfig) count++;
    if (config.workspaceConfig) count++;
    return count;
  }

  private addError(
    result: CursorValidationResult,
    code: string,
    message: string,
    component: string,
    field?: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    suggestion: string = 'Please review and fix the issue'
  ): void {
    result.errors.push({
      code,
      message,
      component,
      field,
      severity,
      suggestion,
    });

    this.addLogEntry(result, 'error', component, message, { code, field, severity });
  }

  private addWarning(
    result: CursorValidationResult,
    code: string,
    message: string,
    component: string,
    field?: string,
    suggestion: string = 'Consider reviewing this item'
  ): void {
    result.warnings.push({
      code,
      message,
      component,
      field,
      suggestion,
    });

    this.addLogEntry(result, 'warn', component, message, { code, field });
  }

  private addLogEntry(
    result: CursorValidationResult,
    level: 'info' | 'warn' | 'error' | 'debug',
    component: string,
    message: string,
    details?: any
  ): void {
    result.validationLog.push({
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      details,
    });

    // Also log to service logger
    if (this.logger && typeof this.logger[level] === 'function') {
      this.logger[level](`[${component}] ${message}`, details);
    }
  }

  // Specific validation methods
  private validateEditorSettings(editor: any, result: CursorValidationResult): void {
    if (editor.fontSize && (typeof editor.fontSize !== 'number' || editor.fontSize < 6 || editor.fontSize > 72)) {
      this.addError(result, 'INVALID_FONT_SIZE',
        `Invalid editor font size: ${editor.fontSize}`,
        'global-settings',
        'editor.fontSize',
        'low',
        'Use font size between 6 and 72'
      );
    }

    if (editor.tabSize && (typeof editor.tabSize !== 'number' || editor.tabSize < 1 || editor.tabSize > 8)) {
      this.addError(result, 'INVALID_TAB_SIZE',
        `Invalid editor tab size: ${editor.tabSize}`,
        'global-settings',
        'editor.tabSize',
        'low',
        'Use tab size between 1 and 8'
      );
    }
  }

  private validateWorkbenchSettings(workbench: any, result: CursorValidationResult): void {
    const validThemes = ['dark', 'light', 'auto'];
    if (workbench.colorTheme && !validThemes.includes(workbench.colorTheme)) {
      this.addWarning(result, 'UNKNOWN_THEME',
        `Unknown color theme: ${workbench.colorTheme}`,
        'global-settings',
        'workbench.colorTheme',
        'Verify theme availability in target Cursor version'
      );
    }
  }

  private validateFileSettings(files: any, result: CursorValidationResult): void {
    if (files.autoSaveDelay && (typeof files.autoSaveDelay !== 'number' || files.autoSaveDelay < 0)) {
      this.addError(result, 'INVALID_AUTO_SAVE_DELAY',
        `Invalid auto save delay: ${files.autoSaveDelay}`,
        'global-settings',
        'files.autoSaveDelay',
        'low',
        'Use non-negative number for auto save delay'
      );
    }
  }

  private validateTerminalSettings(terminal: any, result: CursorValidationResult): void {
    if (terminal.integrated?.shell) {
      const shells = terminal.integrated.shell;
      Object.keys(shells).forEach(platform => {
        if (!['osx', 'linux', 'windows'].includes(platform)) {
          this.addWarning(result, 'UNKNOWN_PLATFORM',
            `Unknown platform in terminal shell config: ${platform}`,
            'global-settings',
            `terminal.integrated.shell.${platform}`,
            'Verify platform identifier'
          );
        }
      });
    }
  }

  private validateSearchSettings(search: any, result: CursorValidationResult): void {
    if (search.exclude && typeof search.exclude !== 'object') {
      this.addError(result, 'INVALID_SEARCH_EXCLUDE',
        'Search exclude must be an object',
        'project-settings',
        'search.exclude',
        'medium',
        'Use object format for search exclude patterns'
      );
    }
  }

  private validateLanguageSettings(settings: CursorProjectSettings, result: CursorValidationResult): void {
    if (settings.typescript) {
      this.validateTypeScriptSettings(settings.typescript, result);
    }

    if (settings.javascript) {
      this.validateJavaScriptSettings(settings.javascript, result);
    }
  }

  private validateTypeScriptSettings(typescript: any, result: CursorValidationResult): void {
    if (typescript.preferences?.quoteStyle && !['single', 'double'].includes(typescript.preferences.quoteStyle)) {
      this.addError(result, 'INVALID_QUOTE_STYLE',
        `Invalid TypeScript quote style: ${typescript.preferences.quoteStyle}`,
        'project-settings',
        'typescript.preferences.quoteStyle',
        'low',
        'Use "single" or "double" for quote style'
      );
    }
  }

  private validateJavaScriptSettings(javascript: any, result: CursorValidationResult): void {
    if (javascript.preferences?.quoteStyle && !['single', 'double'].includes(javascript.preferences.quoteStyle)) {
      this.addError(result, 'INVALID_QUOTE_STYLE',
        `Invalid JavaScript quote style: ${javascript.preferences.quoteStyle}`,
        'project-settings',
        'javascript.preferences.quoteStyle',
        'low',
        'Use "single" or "double" for quote style'
      );
    }
  }

  private validateAIRules(rules: any[], result: CursorValidationResult): void {
    rules.forEach((rule, index) => {
      if (!rule.id || typeof rule.id !== 'string') {
        this.addError(result, 'MISSING_AI_RULE_ID',
          `AI rule at index ${index} missing ID`,
          'ai-config',
          `rules[${index}].id`,
          'high',
          'Provide unique ID for each AI rule'
        );
      }

      if (!rule.content || typeof rule.content !== 'string') {
        this.addError(result, 'MISSING_AI_RULE_CONTENT',
          `AI rule at index ${index} missing content`,
          'ai-config',
          `rules[${index}].content`,
          'high',
          'Provide content for each AI rule'
        );
      }
    });
  }

  private validateAIContextFiles(contextFiles: any[], result: CursorValidationResult): void {
    contextFiles.forEach((file, index) => {
      if (!file.id || typeof file.id !== 'string') {
        this.addError(result, 'MISSING_AI_CONTEXT_ID',
          `AI context file at index ${index} missing ID`,
          'ai-config',
          `contextFiles[${index}].id`,
          'high',
          'Provide unique ID for each AI context file'
        );
      }

      if (!file.content || typeof file.content !== 'string') {
        this.addError(result, 'MISSING_AI_CONTEXT_CONTENT',
          `AI context file at index ${index} missing content`,
          'ai-config',
          `contextFiles[${index}].content`,
          'high',
          'Provide content for each AI context file'
        );
      }

      // Check file size
      if (file.content && file.content.length > 1024 * 1024) { // 1MB limit
        this.addWarning(result, 'LARGE_AI_CONTEXT',
          `AI context file at index ${index} is very large (${file.content.length} characters)`,
          'ai-config',
          `contextFiles[${index}].content`,
          'Consider splitting large context files'
        );
      }
    });
  }

  private validateAIPrompts(prompts: any[], result: CursorValidationResult): void {
    prompts.forEach((prompt, index) => {
      if (!prompt.id || typeof prompt.id !== 'string') {
        this.addError(result, 'MISSING_AI_PROMPT_ID',
          `AI prompt at index ${index} missing ID`,
          'ai-config',
          `prompts[${index}].id`,
          'high',
          'Provide unique ID for each AI prompt'
        );
      }

      if (!prompt.content || typeof prompt.content !== 'string') {
        this.addError(result, 'MISSING_AI_PROMPT_CONTENT',
          `AI prompt at index ${index} missing content`,
          'ai-config',
          `prompts[${index}].content`,
          'high',
          'Provide content for each AI prompt'
        );
      }
    });
  }

  private validateDebugConfigurationItem(debugConfig: any, index: number, result: CursorValidationResult): void {
    if (!debugConfig.name || typeof debugConfig.name !== 'string') {
      this.addError(result, 'MISSING_DEBUG_CONFIG_NAME',
        `Debug configuration at index ${index} missing name`,
        'debug-config',
        `configurations[${index}].name`,
        'high',
        'Provide name for each debug configuration'
      );
    }

    if (!debugConfig.type || typeof debugConfig.type !== 'string') {
      this.addError(result, 'MISSING_DEBUG_CONFIG_TYPE',
        `Debug configuration at index ${index} missing type`,
        'debug-config',
        `configurations[${index}].type`,
        'high',
        'Provide type for each debug configuration'
      );
    }

    if (!debugConfig.request || !['launch', 'attach'].includes(debugConfig.request)) {
      this.addError(result, 'INVALID_DEBUG_CONFIG_REQUEST',
        `Debug configuration at index ${index} has invalid request: ${debugConfig.request}`,
        'debug-config',
        `configurations[${index}].request`,
        'high',
        'Use "launch" or "attach" for debug configuration request'
      );
    }
  }

  private validateTaskItem(task: any, index: number, result: CursorValidationResult): void {
    if (!task.label || typeof task.label !== 'string') {
      this.addError(result, 'MISSING_TASK_LABEL',
        `Task at index ${index} missing label`,
        'tasks-config',
        `tasks[${index}].label`,
        'high',
        'Provide label for each task'
      );
    }

    if (!task.type || typeof task.type !== 'string') {
      this.addError(result, 'MISSING_TASK_TYPE',
        `Task at index ${index} missing type`,
        'tasks-config',
        `tasks[${index}].type`,
        'high',
        'Provide type for each task'
      );
    }

    const validTaskTypes = ['shell', 'process', 'npm', 'typescript', 'grunt', 'gulp', 'jake'];
    if (task.type && !validTaskTypes.includes(task.type)) {
      this.addWarning(result, 'UNKNOWN_TASK_TYPE',
        `Unknown task type at index ${index}: ${task.type}`,
        'tasks-config',
        `tasks[${index}].type`,
        'Verify task type compatibility with Cursor'
      );
    }
  }

  private validateLanguageSnippets(language: string, snippets: any, result: CursorValidationResult): void {
    if (!snippets || typeof snippets !== 'object') {
      this.addError(result, 'INVALID_SNIPPETS_FORMAT',
        `Invalid snippets format for language: ${language}`,
        'snippets-config',
        language,
        'medium',
        'Use object format for language snippets'
      );
      return;
    }

    Object.keys(snippets).forEach(snippetName => {
      const snippet = snippets[snippetName];
      if (!snippet.prefix || typeof snippet.prefix !== 'string') {
        this.addError(result, 'MISSING_SNIPPET_PREFIX',
          `Snippet "${snippetName}" in ${language} missing prefix`,
          'snippets-config',
          `${language}.${snippetName}.prefix`,
          'medium',
          'Provide prefix for each snippet'
        );
      }

      if (!snippet.body || !Array.isArray(snippet.body)) {
        this.addError(result, 'MISSING_SNIPPET_BODY',
          `Snippet "${snippetName}" in ${language} missing or invalid body`,
          'snippets-config',
          `${language}.${snippetName}.body`,
          'medium',
          'Provide body array for each snippet'
        );
      }
    });
  }

  private validateWorkspaceFolder(folder: any, index: number, result: CursorValidationResult): void {
    if (!folder.path || typeof folder.path !== 'string') {
      this.addError(result, 'MISSING_FOLDER_PATH',
        `Workspace folder at index ${index} missing path`,
        'workspace-config',
        `folders[${index}].path`,
        'high',
        'Provide path for each workspace folder'
      );
    }

    if (folder.name && typeof folder.name !== 'string') {
      this.addError(result, 'INVALID_FOLDER_NAME',
        `Workspace folder at index ${index} has invalid name`,
        'workspace-config',
        `folders[${index}].name`,
        'medium',
        'Use string for folder name'
      );
    }
  }

  private validateWorkspaceSettings(settings: any, result: CursorValidationResult): void {
    // Validate common workspace settings
    Object.keys(settings).forEach(key => {
      if (key.includes('..') || key.startsWith('/')) {
        this.addWarning(result, 'SUSPICIOUS_SETTING_KEY',
          `Suspicious workspace setting key: ${key}`,
          'workspace-config',
          `settings.${key}`,
          'Review setting key for security implications'
        );
      }
    });
  }

  private validateSettingsCompatibility(config: CursorTransformationResult, result: CursorValidationResult): void {
    // Check for conflicting editor settings between global and workspace
    if (config.globalSettings?.editor && config.workspaceConfig?.settings) {
      const globalEditor = config.globalSettings.editor;
      const workspaceSettings = config.workspaceConfig.settings;

      // Check for conflicting font settings
      if (globalEditor.fontSize && workspaceSettings['editor.fontSize'] && 
          globalEditor.fontSize !== workspaceSettings['editor.fontSize']) {
        this.addWarning(result, 'CONFLICTING_FONT_SIZE',
          'Conflicting font size settings between global and workspace configuration',
          'compatibility',
          undefined,
          'Ensure consistent font size settings'
        );
      }
    }
  }

  private validateDependencies(config: CursorTransformationResult, result: CursorValidationResult): void {
    // Check if debug configurations have corresponding tasks
    if (config.debugConfig?.configurations && config.tasksConfig?.tasks) {
      config.debugConfig.configurations.forEach((debugConfig, index) => {
        if (debugConfig.preLaunchTask) {
          const taskExists = config.tasksConfig!.tasks.some(task => task.label === debugConfig.preLaunchTask);
          if (!taskExists) {
            this.addError(result, 'MISSING_DEBUG_TASK',
              `Debug configuration "${debugConfig.name}" references non-existent task: ${debugConfig.preLaunchTask}`,
              'compatibility',
              `debug.configurations[${index}].preLaunchTask`,
              'high',
              'Create the referenced task or remove the preLaunchTask reference'
            );
          }
        }
      });
    }
  }

  private validateVersionCompatibility(
    config: CursorTransformationResult,
    result: CursorValidationResult,
    options: CursorValidationOptions
  ): void {
    const targetVersion = options.targetCursorVersion;
    if (!targetVersion) return;

    // Check debug configuration version compatibility
    if (config.debugConfig?.version && !this.isVersionCompatible(config.debugConfig.version, targetVersion, 'debug')) {
      this.addWarning(result, 'VERSION_COMPATIBILITY',
        `Debug configuration version ${config.debugConfig.version} may not be compatible with Cursor ${targetVersion}`,
        'compatibility',
        'debug.version',
        'Verify version compatibility with target Cursor version'
      );
      result.statistics.compatibilityIssues++;
    }

    // Check tasks configuration version compatibility
    if (config.tasksConfig?.version && !this.isVersionCompatible(config.tasksConfig.version, targetVersion, 'tasks')) {
      this.addWarning(result, 'VERSION_COMPATIBILITY',
        `Tasks configuration version ${config.tasksConfig.version} may not be compatible with Cursor ${targetVersion}`,
        'compatibility',
        'tasks.version',
        'Verify version compatibility with target Cursor version'
      );
      result.statistics.compatibilityIssues++;
    }
  }

  // Utility validation methods
  private isValidExtensionId(extensionId: string): boolean {
    // Extension ID format: publisher.name
    const extensionIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z0-9][a-zA-Z0-9-]*$/;
    return extensionIdPattern.test(extensionId);
  }

  private isValidDebugVersion(version: string): boolean {
    const validVersions = ['0.2.0'];
    return validVersions.includes(version);
  }

  private isValidTasksVersion(version: string): boolean {
    const validVersions = ['2.0.0'];
    return validVersions.includes(version);
  }

  private isVersionCompatible(configVersion: string, targetVersion: string, type: 'debug' | 'tasks'): boolean {
    // Simple compatibility check - in real implementation, this would be more sophisticated
    return true;
  }
}