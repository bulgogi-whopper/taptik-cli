import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CursorDeploymentOptions, CursorComponentType } from '../interfaces/cursor-deployment.interface';
import { DeploymentError, DeploymentWarning } from '../interfaces/deployment-result.interface';

/**
 * Task 6.2: Cursor conflict resolver for intelligent configuration merging
 */
@Injectable()
export class CursorConflictResolverService {
  private readonly logger = new Logger(CursorConflictResolverService.name);

  /**
   * Resolve conflicts with existing configuration
   */
  async resolveConfigurationConflicts(
    component: CursorComponentType,
    newConfig: any,
    options: CursorDeploymentOptions
  ): Promise<ConflictResolutionResult> {
    this.logger.log(`Resolving conflicts for component: ${component}`);

    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];
    const conflicts: ConfigurationConflict[] = [];
    
    try {
      // Get existing configuration
      const existingConfig = await this.getExistingConfiguration(component, options);
      
      if (!existingConfig) {
        // No existing configuration, no conflicts
        return {
          hasConflicts: false,
          resolvedConfig: newConfig,
          conflicts: [],
          resolutionStrategy: 'no_existing_config',
          errors,
          warnings,
        };
      }

      // Detect conflicts
      const detectedConflicts = this.detectConflicts(component, existingConfig, newConfig);
      
      if (detectedConflicts.length === 0) {
        // No conflicts detected, can merge safely
        return {
          hasConflicts: false,
          resolvedConfig: this.mergeConfigurations(component, existingConfig, newConfig, 'merge'),
          conflicts: [],
          resolutionStrategy: 'auto_merge',
          errors,
          warnings,
        };
      }

      // Apply conflict resolution strategy
      const strategy = this.determineResolutionStrategy(component, options, detectedConflicts);
      const resolvedConfig = this.applyResolutionStrategy(
        component,
        existingConfig,
        newConfig,
        strategy,
        detectedConflicts
      );

      // Add warnings for resolved conflicts
      for (const conflict of detectedConflicts) {
        warnings.push({
          component,
          type: 'conflict',
          message: `Configuration conflict resolved: ${conflict.path}`,
          suggestion: `Used ${strategy} strategy: ${conflict.description}`,
        });
      }

      return {
        hasConflicts: true,
        resolvedConfig,
        conflicts: detectedConflicts,
        resolutionStrategy: strategy,
        errors,
        warnings,
      };

    } catch (error) {
      this.logger.error(`Failed to resolve conflicts for ${component}:`, error);
      errors.push({
        component,
        type: 'conflict_resolution',
        severity: 'high',
        message: `Failed to resolve configuration conflicts: ${(error as Error).message}`,
        suggestion: 'Check configuration format and file accessibility',
      });

      return {
        hasConflicts: false,
        resolvedConfig: newConfig, // Fall back to new config
        conflicts: [],
        resolutionStrategy: 'fallback_new',
        errors,
        warnings,
      };
    }
  }

  /**
   * Detect conflicts between configurations
   */
  private detectConflicts(
    component: CursorComponentType,
    existingConfig: any,
    newConfig: any
  ): ConfigurationConflict[] {
    const conflicts: ConfigurationConflict[] = [];

    switch (component) {
      case 'global-settings':
      case 'project-settings':
        conflicts.push(...this.detectSettingsConflicts(existingConfig, newConfig));
        break;

      case 'ai-config':
        conflicts.push(...this.detectAIConfigConflicts(existingConfig, newConfig));
        break;

      case 'extensions-config':
        conflicts.push(...this.detectExtensionsConflicts(existingConfig, newConfig));
        break;

      case 'debug-config':
        conflicts.push(...this.detectDebugConfigConflicts(existingConfig, newConfig));
        break;

      case 'tasks-config':
        conflicts.push(...this.detectTasksConfigConflicts(existingConfig, newConfig));
        break;

      case 'snippets-config':
        conflicts.push(...this.detectSnippetsConflicts(existingConfig, newConfig));
        break;

      case 'workspace-config':
        conflicts.push(...this.detectWorkspaceConflicts(existingConfig, newConfig));
        break;

      default:
        this.logger.warn(`Unknown component type for conflict detection: ${component}`);
    }

    return conflicts;
  }

  /**
   * Detect conflicts in settings configurations
   */
  private detectSettingsConflicts(existing: any, newConfig: any): ConfigurationConflict[] {
    const conflicts: ConfigurationConflict[] = [];

    for (const key in newConfig) {
      if (existing.hasOwnProperty(key)) {
        const existingValue = existing[key];
        const newValue = newConfig[key];

        if (JSON.stringify(existingValue) !== JSON.stringify(newValue)) {
          conflicts.push({
            path: key,
            type: 'value_mismatch',
            existingValue,
            newValue,
            description: `Setting '${key}' has different values`,
            severity: this.getConflictSeverity(key),
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Detect conflicts in AI configurations
   */
  private detectAIConfigConflicts(existing: any, newConfig: any): ConfigurationConflict[] {
    const conflicts: ConfigurationConflict[] = [];

    // Check rules conflicts
    if (existing.rules && newConfig.rules) {
      const existingRules = new Set(existing.rules);
      const conflictingRules = newConfig.rules.filter((rule: string) => 
        existingRules.has(rule) && rule !== newConfig.rules.find((r: string) => r === rule)
      );

      if (conflictingRules.length > 0) {
        conflicts.push({
          path: 'rules',
          type: 'array_overlap',
          existingValue: existing.rules,
          newValue: newConfig.rules,
          description: `Overlapping AI rules detected`,
          severity: 'medium',
        });
      }
    }

    // Check system prompt conflicts
    if (existing.systemPrompt && newConfig.systemPrompt && existing.systemPrompt !== newConfig.systemPrompt) {
      conflicts.push({
        path: 'systemPrompt',
        type: 'value_mismatch',
        existingValue: existing.systemPrompt,
        newValue: newConfig.systemPrompt,
        description: 'Different system prompts',
        severity: 'high',
      });
    }

    return conflicts;
  }

  /**
   * Detect conflicts in extensions configurations
   */
  private detectExtensionsConflicts(existing: any, newConfig: any): ConfigurationConflict[] {
    const conflicts: ConfigurationConflict[] = [];

    // Check recommendations conflicts
    if (existing.recommendations && newConfig.recommendations) {
      const duplicates = existing.recommendations.filter((ext: string) => 
        newConfig.recommendations.includes(ext)
      );

      if (duplicates.length > 0) {
        conflicts.push({
          path: 'recommendations',
          type: 'array_overlap',
          existingValue: existing.recommendations,
          newValue: newConfig.recommendations,
          description: `Duplicate extension recommendations: ${duplicates.join(', ')}`,
          severity: 'low',
        });
      }
    }

    return conflicts;
  }

  /**
   * Detect conflicts in debug configurations
   */
  private detectDebugConfigConflicts(existing: any, newConfig: any): ConfigurationConflict[] {
    const conflicts: ConfigurationConflict[] = [];

    if (existing.configurations && newConfig.configurations) {
      const existingNames = existing.configurations.map((c: any) => c.name);
      const newNames = newConfig.configurations.map((c: any) => c.name);
      const duplicateNames = existingNames.filter((name: string) => newNames.includes(name));

      if (duplicateNames.length > 0) {
        conflicts.push({
          path: 'configurations',
          type: 'name_collision',
          existingValue: existingNames,
          newValue: newNames,
          description: `Debug configuration name conflicts: ${duplicateNames.join(', ')}`,
          severity: 'medium',
        });
      }
    }

    return conflicts;
  }

  /**
   * Detect conflicts in tasks configurations
   */
  private detectTasksConfigConflicts(existing: any, newConfig: any): ConfigurationConflict[] {
    const conflicts: ConfigurationConflict[] = [];

    if (existing.tasks && newConfig.tasks) {
      const existingLabels = existing.tasks.map((t: any) => t.label);
      const newLabels = newConfig.tasks.map((t: any) => t.label);
      const duplicateLabels = existingLabels.filter((label: string) => newLabels.includes(label));

      if (duplicateLabels.length > 0) {
        conflicts.push({
          path: 'tasks',
          type: 'name_collision',
          existingValue: existingLabels,
          newValue: newLabels,
          description: `Task label conflicts: ${duplicateLabels.join(', ')}`,
          severity: 'medium',
        });
      }
    }

    return conflicts;
  }

  /**
   * Detect conflicts in snippets configurations
   */
  private detectSnippetsConflicts(existing: any, newConfig: any): ConfigurationConflict[] {
    const conflicts: ConfigurationConflict[] = [];

    for (const language in newConfig) {
      if (existing[language]) {
        const existingSnippets = Object.keys(existing[language]);
        const newSnippets = Object.keys(newConfig[language]);
        const duplicateSnippets = existingSnippets.filter(name => newSnippets.includes(name));

        if (duplicateSnippets.length > 0) {
          conflicts.push({
            path: `${language}.snippets`,
            type: 'name_collision',
            existingValue: existingSnippets,
            newValue: newSnippets,
            description: `Snippet name conflicts in ${language}: ${duplicateSnippets.join(', ')}`,
            severity: 'low',
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Detect conflicts in workspace configurations
   */
  private detectWorkspaceConflicts(existing: any, newConfig: any): ConfigurationConflict[] {
    const conflicts: ConfigurationConflict[] = [];

    // Check folder path conflicts
    if (existing.folders && newConfig.folders) {
      const existingPaths = existing.folders.map((f: any) => f.path);
      const newPaths = newConfig.folders.map((f: any) => f.path);
      const duplicatePaths = existingPaths.filter((path: string) => newPaths.includes(path));

      if (duplicatePaths.length > 0) {
        conflicts.push({
          path: 'folders',
          type: 'path_collision',
          existingValue: existingPaths,
          newValue: newPaths,
          description: `Workspace folder path conflicts: ${duplicatePaths.join(', ')}`,
          severity: 'medium',
        });
      }
    }

    // Check settings conflicts
    if (existing.settings && newConfig.settings) {
      conflicts.push(...this.detectSettingsConflicts(existing.settings, newConfig.settings));
    }

    return conflicts;
  }

  /**
   * Determine resolution strategy based on component and options
   */
  private determineResolutionStrategy(
    component: CursorComponentType,
    options: CursorDeploymentOptions,
    conflicts: ConfigurationConflict[]
  ): ConflictResolutionStrategy {
    // Check if user specified merge strategy
    if (options.mergeStrategy) {
      switch (options.mergeStrategy) {
        case 'overwrite':
          return 'overwrite_existing';
        case 'merge':
          return 'intelligent_merge';
        case 'skip':
          return 'keep_existing';
        default:
          return 'intelligent_merge';
      }
    }

    // Auto-determine strategy based on conflict severity
    const hasHighSeverityConflicts = conflicts.some(c => c.severity === 'high');
    const hasMediumSeverityConflicts = conflicts.some(c => c.severity === 'medium');

    if (hasHighSeverityConflicts) {
      return 'user_prompt'; // Would require user intervention in real implementation
    } else if (hasMediumSeverityConflicts) {
      return 'intelligent_merge';
    } else {
      return 'auto_merge';
    }
  }

  /**
   * Apply resolution strategy
   */
  private applyResolutionStrategy(
    component: CursorComponentType,
    existingConfig: any,
    newConfig: any,
    strategy: ConflictResolutionStrategy,
    conflicts: ConfigurationConflict[]
  ): any {
    switch (strategy) {
      case 'overwrite_existing':
        return newConfig;
      
      case 'keep_existing':
        return existingConfig;
      
      case 'auto_merge':
      case 'intelligent_merge':
        return this.mergeConfigurations(component, existingConfig, newConfig, 'merge');
      
      case 'user_prompt':
        // In real implementation, this would prompt user
        // For now, fall back to intelligent merge
        return this.mergeConfigurations(component, existingConfig, newConfig, 'merge');
      
      case 'fallback_new':
      default:
        return newConfig;
    }
  }

  /**
   * Merge configurations intelligently
   */
  private mergeConfigurations(
    component: CursorComponentType,
    existing: any,
    newConfig: any,
    strategy: 'merge' | 'overwrite' | 'keep'
  ): any {
    if (strategy === 'overwrite') {
      return newConfig;
    } else if (strategy === 'keep') {
      return existing;
    }

    // Intelligent merge based on component type
    switch (component) {
      case 'global-settings':
      case 'project-settings':
        return { ...existing, ...newConfig }; // New values override existing
      
      case 'ai-config':
        return this.mergeAIConfig(existing, newConfig);
      
      case 'extensions-config':
        return this.mergeExtensionsConfig(existing, newConfig);
      
      case 'debug-config':
        return this.mergeDebugConfig(existing, newConfig);
      
      case 'tasks-config':
        return this.mergeTasksConfig(existing, newConfig);
      
      case 'snippets-config':
        return this.mergeSnippetsConfig(existing, newConfig);
      
      case 'workspace-config':
        return this.mergeWorkspaceConfig(existing, newConfig);
      
      default:
        return { ...existing, ...newConfig };
    }
  }

  /**
   * Merge AI configurations
   */
  private mergeAIConfig(existing: any, newConfig: any): any {
    const merged = { ...existing, ...newConfig };
    
    // Merge rules arrays
    if (existing.rules && newConfig.rules) {
      merged.rules = [...new Set([...existing.rules, ...newConfig.rules])];
    }
    
    // Merge context arrays
    if (existing.context && newConfig.context) {
      merged.context = [...new Set([...existing.context, ...newConfig.context])];
    }
    
    // Merge prompts arrays
    if (existing.prompts && newConfig.prompts) {
      const existingPromptNames = existing.prompts.map((p: any) => p.name);
      const newPrompts = newConfig.prompts.filter((p: any) => !existingPromptNames.includes(p.name));
      merged.prompts = [...existing.prompts, ...newPrompts];
    }
    
    return merged;
  }

  /**
   * Merge extensions configurations
   */
  private mergeExtensionsConfig(existing: any, newConfig: any): any {
    const merged = { ...existing, ...newConfig };
    
    // Merge recommendations arrays
    if (existing.recommendations && newConfig.recommendations) {
      merged.recommendations = [...new Set([...existing.recommendations, ...newConfig.recommendations])];
    }
    
    // Merge unwanted recommendations
    if (existing.unwantedRecommendations && newConfig.unwantedRecommendations) {
      merged.unwantedRecommendations = [...new Set([...existing.unwantedRecommendations, ...newConfig.unwantedRecommendations])];
    }
    
    return merged;
  }

  /**
   * Merge debug configurations
   */
  private mergeDebugConfig(existing: any, newConfig: any): any {
    const merged = { ...existing, ...newConfig };
    
    if (existing.configurations && newConfig.configurations) {
      const existingNames = existing.configurations.map((c: any) => c.name);
      const newConfigurations = newConfig.configurations.filter((c: any) => !existingNames.includes(c.name));
      merged.configurations = [...existing.configurations, ...newConfigurations];
    }
    
    return merged;
  }

  /**
   * Merge tasks configurations
   */
  private mergeTasksConfig(existing: any, newConfig: any): any {
    const merged = { ...existing, ...newConfig };
    
    if (existing.tasks && newConfig.tasks) {
      const existingLabels = existing.tasks.map((t: any) => t.label);
      const newTasks = newConfig.tasks.filter((t: any) => !existingLabels.includes(t.label));
      merged.tasks = [...existing.tasks, ...newTasks];
    }
    
    return merged;
  }

  /**
   * Merge snippets configurations
   */
  private mergeSnippetsConfig(existing: any, newConfig: any): any {
    const merged = { ...existing };
    
    for (const language in newConfig) {
      if (merged[language]) {
        merged[language] = { ...merged[language], ...newConfig[language] };
      } else {
        merged[language] = newConfig[language];
      }
    }
    
    return merged;
  }

  /**
   * Merge workspace configurations
   */
  private mergeWorkspaceConfig(existing: any, newConfig: any): any {
    const merged = { ...existing, ...newConfig };
    
    // Merge folders array
    if (existing.folders && newConfig.folders) {
      const existingPaths = existing.folders.map((f: any) => f.path);
      const newFolders = newConfig.folders.filter((f: any) => !existingPaths.includes(f.path));
      merged.folders = [...existing.folders, ...newFolders];
    }
    
    // Merge settings
    if (existing.settings && newConfig.settings) {
      merged.settings = { ...existing.settings, ...newConfig.settings };
    }
    
    return merged;
  }

  /**
   * Get existing configuration for component
   */
  private async getExistingConfiguration(
    component: CursorComponentType,
    options: CursorDeploymentOptions
  ): Promise<any | null> {
    try {
      const filePath = this.getConfigurationFilePath(component, options);
      if (!filePath) return null;

      const exists = await this.fileExists(filePath);
      if (!exists) return null;

      const content = await fs.readFile(filePath, 'utf8');
      
      if (component === 'ai-config' && filePath.endsWith('.cursorrules')) {
        // Parse .cursorrules file
        return { rules: content.split('\n').filter(line => line.trim()) };
      } else {
        // Parse JSON files
        return JSON.parse(content);
      }
    } catch (error) {
      this.logger.debug(`Failed to read existing config for ${component}:`, error);
      return null;
    }
  }

  /**
   * Get configuration file path for component
   */
  private getConfigurationFilePath(component: CursorComponentType, options: CursorDeploymentOptions): string | null {
    const cursorPath = options.cursorPath || this.getDefaultCursorPath();
    const workspacePath = options.workspacePath;
    
    switch (component) {
      case 'global-settings':
        return path.join(cursorPath, 'User', 'settings.json');
      case 'project-settings':
        return workspacePath ? path.join(workspacePath, '.vscode', 'settings.json') : null;
      case 'ai-config':
        return workspacePath ? path.join(workspacePath, '.cursorrules') : path.join(cursorPath, '.cursorrules');
      case 'extensions-config':
        return path.join(cursorPath, 'User', 'extensions.json');
      case 'debug-config':
        return workspacePath ? path.join(workspacePath, '.vscode', 'launch.json') : null;
      case 'tasks-config':
        return workspacePath ? path.join(workspacePath, '.vscode', 'tasks.json') : null;
      case 'snippets-config':
        return path.join(cursorPath, 'User', 'snippets', 'global.json');
      case 'workspace-config':
        return workspacePath ? path.join(workspacePath, path.basename(workspacePath) + '.code-workspace') : null;
      default:
        return null;
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get default Cursor path
   */
  private getDefaultCursorPath(): string {
    const platform = process.platform;
    const home = process.env.HOME || process.env.USERPROFILE || '/tmp';
    
    switch (platform) {
      case 'darwin':
        return path.join(home, 'Library', 'Application Support', 'Cursor');
      case 'win32':
        return path.join(home, 'AppData', 'Roaming', 'Cursor');
      case 'linux':
        return path.join(home, '.config', 'Cursor');
      default:
        return path.join(home, '.cursor');
    }
  }

  /**
   * Get conflict severity based on setting key
   */
  private getConflictSeverity(key: string): 'low' | 'medium' | 'high' {
    const highSeverityKeys = ['editor.fontFamily', 'editor.fontSize', 'workbench.colorTheme'];
    const mediumSeverityKeys = ['editor.tabSize', 'editor.insertSpaces', 'files.autoSave'];
    
    if (highSeverityKeys.includes(key)) return 'high';
    if (mediumSeverityKeys.includes(key)) return 'medium';
    return 'low';
  }
}

/**
 * Conflict resolution result
 */
export interface ConflictResolutionResult {
  hasConflicts: boolean;
  resolvedConfig: any;
  conflicts: ConfigurationConflict[];
  resolutionStrategy: ConflictResolutionStrategy;
  errors: DeploymentError[];
  warnings: DeploymentWarning[];
}

/**
 * Configuration conflict
 */
export interface ConfigurationConflict {
  path: string;
  type: 'value_mismatch' | 'array_overlap' | 'name_collision' | 'path_collision';
  existingValue: any;
  newValue: any;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Conflict resolution strategies
 */
export type ConflictResolutionStrategy = 
  | 'no_existing_config'
  | 'auto_merge' 
  | 'intelligent_merge'
  | 'overwrite_existing' 
  | 'keep_existing' 
  | 'user_prompt'
  | 'fallback_new';