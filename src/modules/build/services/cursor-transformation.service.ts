/**
 * CursorTransformationService - Service for transforming Cursor IDE configurations
 * Converts collected Cursor settings into Taptik standard format
 */

import { randomUUID } from 'node:crypto';
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
} from '../interfaces/cursor-ide.interfaces';
import {
  TaptikPersonalContext,
  TaptikProjectContext,
  TaptikPromptTemplates,
  UserPreferences,
  CodingStyle,
  WorkStyle,
  Communication,
  PersonalMetadata,
  ProjectInfo,
  TechnicalStack,
  DevelopmentGuidelines,
  ProjectMetadata,
  PromptTemplateEntry,
  PromptMetadata,
} from '../interfaces/taptik-format.interface';
import { CursorValidationService } from './cursor-validation.service';

/**
 * Extension mapping result structure
 */
export interface ExtensionMappingResult {
  extensions: Array<{
    id: string;
    name?: string;
    publisher?: string;
    version?: string;
    enabled?: boolean;
    platform_specific: boolean;
  }>;
  compatibility: {
    vscode: string[];
    cursor_specific: string[];
    universal: string[];
  };
  alternatives?: Record<string, string>;
  metadata: {
    total_count: number;
    compatible_count: number;
    warnings?: string[];
  };
}

/**
 * Service for transforming Cursor IDE configurations to Taptik format
 */
@Injectable()
export class CursorTransformationService {
  private readonly logger = new Logger(CursorTransformationService.name);

  constructor(
    private readonly validationService: CursorValidationService,
  ) {}

  /**
   * Transform Cursor global settings to Taptik personal context
   */
  async transformCursorPersonalContext(
    globalSettings: CursorGlobalSettingsData,
  ): Promise<TaptikPersonalContext> {
    this.logger.log('Transforming Cursor global settings to personal context');

    try {
      const preferences = await this.extractUserPreferences(globalSettings);
      const workStyle = await this.extractWorkStyle(globalSettings);
      const communication = await this.extractCommunication(globalSettings);
      const metadata = this.generatePersonalMetadata(globalSettings);

      const personalContext: TaptikPersonalContext = {
        user_id: this.generateUserId(globalSettings),
        preferences,
        work_style: workStyle,
        communication,
        metadata,
      };

      this.logger.log('Personal context transformation completed');
      return personalContext;
    } catch (error) {
      this.logger.error(`Error transforming personal context: ${error}`);
      // Return minimal context on error
      return this.createFallbackPersonalContext(globalSettings);
    }
  }

  /**
   * Transform Cursor local settings to Taptik project context
   */
  async transformCursorProjectContext(
    localSettings: CursorLocalSettingsData,
  ): Promise<TaptikProjectContext> {
    this.logger.log('Transforming Cursor local settings to project context');

    try {
      const projectInfo = await this.extractProjectInfo(localSettings);
      const technicalStack = await this.extractTechnicalStack(localSettings);
      const developmentGuidelines = await this.extractDevelopmentGuidelines(localSettings);
      const metadata = this.generateProjectMetadata(localSettings);

      const projectContext: TaptikProjectContext = {
        project_id: this.generateProjectId(localSettings),
        project_info: projectInfo,
        technical_stack: technicalStack,
        development_guidelines: developmentGuidelines,
        metadata,
      };

      // Add workspace configuration if multi-root
      if (localSettings.workspaceType === 'multi-root') {
        projectContext.workspace_config = localSettings.workspace;
      }

      // Add AI context if available
      if (localSettings.projectAiRules) {
        const sanitizedAiConfig = this.validationService.sanitizeAiConfiguration(
          localSettings.projectAiRules,
        );
        projectContext.ai_context = sanitizedAiConfig;
      }

      this.logger.log('Project context transformation completed');
      return projectContext;
    } catch (error) {
      this.logger.error(`Error transforming project context: ${error}`);
      // Return minimal context on error
      return this.createFallbackProjectContext(localSettings);
    }
  }

  /**
   * Transform Cursor AI configuration to Taptik prompt templates
   */
  async transformCursorPromptTemplates(
    aiConfig?: CursorAiConfiguration,
  ): Promise<TaptikPromptTemplates> {
    this.logger.log('Transforming Cursor AI configuration to prompt templates');

    const templates: PromptTemplateEntry[] = [];
    
    if (aiConfig) {
      // Transform AI rules
      if (aiConfig.rules) {
        for (const rule of aiConfig.rules) {
          if (rule.enabled !== false) {
            templates.push({
              id: randomUUID(),
              name: rule.name,
              content: rule.prompt,
              category: this.categorizePrompt(rule.prompt, rule.name),
              tags: ['cursor-ide', 'ai-rule', rule.pattern].filter(Boolean),
              variables: this.extractTemplateVariables(rule.prompt),
              metadata: {
                source: 'cursor-ide',
                pattern: rule.pattern,
                created_at: new Date().toISOString(),
              },
            });
          }
        }
      }

      // Transform global prompts
      if (aiConfig.globalPrompts) {
        for (const [key, prompt] of Object.entries(aiConfig.globalPrompts)) {
          templates.push({
            id: randomUUID(),
            name: key,
            content: prompt,
            category: this.categorizePrompt(prompt, key),
            tags: ['cursor-ide', 'global-prompt'],
            variables: this.extractTemplateVariables(prompt),
            metadata: {
              source: 'cursor-ide',
              created_at: new Date().toISOString(),
            },
          });
        }
      }
    }

    return {
      templates,
      metadata: {
        source: 'cursor-ide',
        total_count: templates.length,
        created_at: new Date().toISOString(),
        version: '1.0.0',
      },
    };
  }

  /**
   * Map Cursor extensions to platform-agnostic format
   */
  async mapCursorExtensions(
    extensions: CursorExtension[],
  ): Promise<ExtensionMappingResult> {
    this.logger.log(`Mapping ${extensions.length} Cursor extensions`);

    if (!extensions || extensions.length === 0) {
      return {
        extensions: [],
        compatibility: {
          vscode: [],
          cursor_specific: [],
          universal: [],
        },
        metadata: {
          total_count: 0,
          compatible_count: 0,
        },
      };
    }

    // Check compatibility with VS Code
    const compatibilityResult = this.validationService.checkExtensionCompatibility(extensions);
    
    const mappedExtensions = extensions.map(ext => ({
      id: ext.id,
      name: ext.name,
      publisher: ext.publisher,
      version: ext.version,
      enabled: ext.enabled,
      platform_specific: compatibilityResult.incompatibleExtensions.some(
        incomp => incomp.id === ext.id
      ),
    }));

    const result: ExtensionMappingResult = {
      extensions: mappedExtensions,
      compatibility: {
        vscode: compatibilityResult.compatibleExtensions.map(e => e.id),
        cursor_specific: compatibilityResult.incompatibleExtensions.map(e => e.id),
        universal: compatibilityResult.compatibleExtensions
          .filter(e => this.isUniversalExtension(e.id))
          .map(e => e.id),
      },
      metadata: {
        total_count: extensions.length,
        compatible_count: compatibilityResult.compatibleExtensions.length,
        warnings: compatibilityResult.warnings,
      },
    };

    // Add alternatives if available
    if (compatibilityResult.alternatives) {
      result.alternatives = compatibilityResult.alternatives;
    }

    return result;
  }

  /**
   * Extract user preferences from global settings
   */
  private async extractUserPreferences(
    globalSettings: CursorGlobalSettingsData,
  ): Promise<UserPreferences> {
    const settings = globalSettings.settings || {};
    
    const preferences: UserPreferences = {
      theme: this.extractTheme(settings),
      editor_settings: this.extractEditorSettings(settings),
      extensions: globalSettings.globalExtensions?.map(e => e.id) || [],
      keybindings: this.extractKeybindingSummary(globalSettings.keybindings),
    };

    // Add AI settings if available
    if (settings['cursor.aiProvider'] || settings['cursor.aiModel'] || globalSettings.globalAiRules) {
      preferences.ai_settings = {
        provider: settings['cursor.aiProvider'] as string || 'default',
        model: settings['cursor.aiModel'] as string,
        temperature: settings['cursor.temperature'] as number,
        maxTokens: settings['cursor.maxTokens'] as number,
      };
    }

    // Add sanitized AI rules if available
    if (globalSettings.globalAiRules) {
      const sanitizedRules = this.validationService.sanitizeAiConfiguration(
        globalSettings.globalAiRules,
      );
      if (sanitizedRules.rules?.length) {
        preferences.ai_rules = sanitizedRules.rules;
      }
    }

    return preferences;
  }

  /**
   * Extract work style from global settings
   */
  private async extractWorkStyle(
    globalSettings: CursorGlobalSettingsData,
  ): Promise<WorkStyle> {
    const settings = globalSettings.settings || {};

    return {
      workflow_preferences: {
        auto_save: settings['files.autoSave'] !== 'off',
        format_on_save: Boolean(settings['editor.formatOnSave']),
        auto_close_brackets: settings['editor.autoClosingBrackets'] !== 'never',
      },
      collaboration_tools: this.extractCollaborationTools(settings),
      productivity_features: this.extractProductivityFeatures(settings),
    };
  }

  /**
   * Extract communication preferences
   */
  private async extractCommunication(
    globalSettings: CursorGlobalSettingsData,
  ): Promise<Communication> {
    const settings = globalSettings.settings || {};

    return {
      code_comments: settings['editor.quickSuggestions'] ? 'detailed' : 'minimal',
      documentation_style: 'standard',
      language_preferences: ['en'],
    };
  }

  /**
   * Extract project information from local settings
   */
  private async extractProjectInfo(
    localSettings: CursorLocalSettingsData,
  ): Promise<ProjectInfo> {
    const projectName = path.basename(localSettings.projectPath);

    return {
      name: projectName,
      description: `Cursor IDE project: ${projectName}`,
      type: localSettings.workspaceType === 'multi-root' ? 'multi-root' : 'single-root',
      repository_url: '',
      primary_language: await this.detectPrimaryLanguage(localSettings),
    };
  }

  /**
   * Extract technical stack from local settings
   */
  private async extractTechnicalStack(
    localSettings: CursorLocalSettingsData,
  ): Promise<TechnicalStack> {
    return {
      languages: await this.detectLanguages(localSettings),
      frameworks: await this.detectFrameworks(localSettings),
      tools: await this.detectTools(localSettings),
      extensions: localSettings.extensions?.recommendations || [],
    };
  }

  /**
   * Extract development guidelines from local settings
   */
  private async extractDevelopmentGuidelines(
    localSettings: CursorLocalSettingsData,
  ): Promise<DevelopmentGuidelines> {
    const settings = localSettings.settings || {};

    return {
      code_style: {
        indentation: settings['editor.tabSize'] as number || 2,
        quotes: settings['prettier.singleQuote'] ? 'single' : 'double',
        semicolons: !settings['prettier.semi'] === false,
      },
      conventions: {
        naming: 'camelCase',
        file_structure: 'standard',
      },
      best_practices: [],
    };
  }

  /**
   * Extract theme from settings
   */
  private extractTheme(settings: VSCodeSettings): string {
    return (settings['workbench.colorTheme'] as string) || 'Default Dark+';
  }

  /**
   * Extract editor settings
   */
  private extractEditorSettings(settings: VSCodeSettings): CodingStyle {
    return {
      tabSize: (settings['editor.tabSize'] as number) || 2,
      insertSpaces: settings['editor.insertSpaces'] !== false,
      wordWrap: (settings['editor.wordWrap'] as string) || 'off',
      fontSize: (settings['editor.fontSize'] as number) || 14,
      fontFamily: (settings['editor.fontFamily'] as string) || 'Consolas, Courier New, monospace',
    };
  }

  /**
   * Extract keybinding summary
   */
  private extractKeybindingSummary(keybindings?: CursorKeybinding[]): string[] {
    if (!keybindings) return [];
    return keybindings.slice(0, 10).map(kb => `${kb.key}: ${kb.command}`);
  }

  /**
   * Extract collaboration tools from settings
   */
  private extractCollaborationTools(settings: VSCodeSettings): string[] {
    const tools: string[] = [];
    
    if (settings['liveshare.presence']) tools.push('live-share');
    if (settings['gitlens.enabled'] !== false) tools.push('gitlens');
    if (settings['git.enabled'] !== false) tools.push('git');
    
    return tools;
  }

  /**
   * Extract productivity features
   */
  private extractProductivityFeatures(settings: VSCodeSettings): string[] {
    const features: string[] = [];
    
    if (settings['editor.snippetSuggestions']) features.push('snippets');
    if (settings['editor.suggestOnTriggerCharacters']) features.push('intellisense');
    if (settings['editor.wordBasedSuggestions']) features.push('word-suggestions');
    
    return features;
  }

  /**
   * Detect primary language from project settings
   */
  private async detectPrimaryLanguage(localSettings: CursorLocalSettingsData): Promise<string> {
    const settings = localSettings.settings || {};
    
    if (settings['typescript.tsdk']) return 'typescript';
    if (settings['python.defaultInterpreterPath']) return 'python';
    if (settings['java.home']) return 'java';
    if (settings['go.gopath']) return 'go';
    if (settings['rust-analyzer.server.path']) return 'rust';
    
    return 'javascript';
  }

  /**
   * Detect languages used in project
   */
  private async detectLanguages(localSettings: CursorLocalSettingsData): Promise<string[]> {
    const languages: Set<string> = new Set();
    const settings = localSettings.settings || {};
    
    if (settings['typescript.tsdk']) languages.add('typescript');
    if (settings['javascript.validate.enable']) languages.add('javascript');
    if (settings['python.linting.enabled']) languages.add('python');
    if (settings['java.configuration.runtimes']) languages.add('java');
    if (settings['csharp.enabled']) languages.add('csharp');
    if (settings['go.buildOnSave']) languages.add('go');
    if (settings['rust-analyzer.checkOnSave']) languages.add('rust');
    
    // Add based on extensions
    if (localSettings.extensions?.recommendations) {
      const recs = localSettings.extensions.recommendations;
      if (recs.some(e => e.includes('python'))) languages.add('python');
      if (recs.some(e => e.includes('typescript'))) languages.add('typescript');
      if (recs.some(e => e.includes('rust'))) languages.add('rust');
    }
    
    return Array.from(languages);
  }

  /**
   * Detect frameworks used in project
   */
  private async detectFrameworks(localSettings: CursorLocalSettingsData): Promise<string[]> {
    const frameworks: Set<string> = new Set();
    const settings = localSettings.settings || {};
    
    if (settings['angular.enable']) frameworks.add('angular');
    if (settings['vue.server.path']) frameworks.add('vue');
    if (settings['svelte.enable']) frameworks.add('svelte');
    
    // Detect from extensions
    if (localSettings.extensions?.recommendations) {
      const recs = localSettings.extensions.recommendations;
      if (recs.some(e => e.includes('angular'))) frameworks.add('angular');
      if (recs.some(e => e.includes('vue'))) frameworks.add('vue');
      if (recs.some(e => e.includes('react'))) frameworks.add('react');
      if (recs.some(e => e.includes('svelte'))) frameworks.add('svelte');
    }
    
    return Array.from(frameworks);
  }

  /**
   * Detect development tools
   */
  private async detectTools(localSettings: CursorLocalSettingsData): Promise<string[]> {
    const tools: Set<string> = new Set();
    const settings = localSettings.settings || {};
    
    if (settings['eslint.enable'] !== false) tools.add('eslint');
    if (settings['prettier.enable'] !== false) tools.add('prettier');
    if (settings['jest.autoRun']) tools.add('jest');
    if (settings['vitest.enable']) tools.add('vitest');
    if (settings['docker.enableDockerComposeLanguageService']) tools.add('docker');
    
    return Array.from(tools);
  }

  /**
   * Categorize prompt based on content
   */
  private categorizePrompt(prompt: string, name: string): string {
    const lowerPrompt = prompt.toLowerCase();
    const lowerName = name.toLowerCase();
    
    if (lowerPrompt.includes('test') || lowerName.includes('test')) return 'testing';
    if (lowerPrompt.includes('document') || lowerName.includes('doc')) return 'documentation';
    if (lowerPrompt.includes('review') || lowerName.includes('review')) return 'review';
    if (lowerPrompt.includes('refactor') || lowerName.includes('refactor')) return 'refactoring';
    if (lowerPrompt.includes('security') || lowerPrompt.includes('vulnerab')) return 'security';
    if (lowerPrompt.includes('performance') || lowerPrompt.includes('optim')) return 'optimization';
    if (lowerPrompt.includes('debug') || lowerPrompt.includes('fix')) return 'debugging';
    
    return 'general';
  }

  /**
   * Extract template variables from prompt
   */
  private extractTemplateVariables(prompt: string): string[] {
    const variablePattern = /\{\{(\w+)\}\}|\$\{(\w+)\}|\$(\w+)/g;
    const variables: Set<string> = new Set();
    
    let match;
    while ((match = variablePattern.exec(prompt)) !== null) {
      variables.add(match[1] || match[2] || match[3]);
    }
    
    return Array.from(variables);
  }

  /**
   * Check if extension is universal across platforms
   */
  private isUniversalExtension(extensionId: string): boolean {
    const universalPublishers = ['microsoft', 'redhat', 'golang', 'rust-lang'];
    const publisher = extensionId.split('.')[0];
    return universalPublishers.includes(publisher);
  }

  /**
   * Generate user ID from global settings
   */
  private generateUserId(globalSettings: CursorGlobalSettingsData): string {
    const base = `${globalSettings.userHome}_cursor`;
    return randomUUID();
  }

  /**
   * Generate project ID from local settings
   */
  private generateProjectId(localSettings: CursorLocalSettingsData): string {
    const base = `${localSettings.projectPath}_cursor`;
    return randomUUID();
  }

  /**
   * Generate personal metadata
   */
  private generatePersonalMetadata(globalSettings: CursorGlobalSettingsData): PersonalMetadata {
    return {
      source: 'cursor-ide',
      version: '1.0.0',
      created_at: new Date().toISOString(),
      platform: process.platform,
      home_directory: globalSettings.userHome,
    };
  }

  /**
   * Generate project metadata
   */
  private generateProjectMetadata(localSettings: CursorLocalSettingsData): ProjectMetadata {
    return {
      source: 'cursor-ide',
      version: '1.0.0',
      created_at: new Date().toISOString(),
      platform: process.platform,
      project_path: localSettings.projectPath,
      workspace_type: localSettings.workspaceType,
    };
  }

  /**
   * Create fallback personal context on error
   */
  private createFallbackPersonalContext(
    globalSettings: CursorGlobalSettingsData,
  ): TaptikPersonalContext {
    return {
      user_id: this.generateUserId(globalSettings),
      preferences: {
        theme: 'Default',
        editor_settings: {
          tabSize: 2,
          insertSpaces: true,
          wordWrap: 'off',
          fontSize: 14,
          fontFamily: 'monospace',
        },
        extensions: [],
        keybindings: [],
      },
      work_style: {
        workflow_preferences: {
          auto_save: false,
          format_on_save: false,
          auto_close_brackets: true,
        },
        collaboration_tools: [],
        productivity_features: [],
      },
      communication: {
        code_comments: 'standard',
        documentation_style: 'standard',
        language_preferences: ['en'],
      },
      metadata: this.generatePersonalMetadata(globalSettings),
    };
  }

  /**
   * Create fallback project context on error
   */
  private createFallbackProjectContext(
    localSettings: CursorLocalSettingsData,
  ): TaptikProjectContext {
    const projectName = path.basename(localSettings.projectPath);
    
    return {
      project_id: this.generateProjectId(localSettings),
      project_info: {
        name: projectName,
        description: `Cursor IDE project: ${projectName}`,
        type: localSettings.workspaceType === 'multi-root' ? 'multi-root' : 'single-root',
        repository_url: '',
        primary_language: 'unknown',
      },
      technical_stack: {
        languages: [],
        frameworks: [],
        tools: [],
        extensions: [],
      },
      development_guidelines: {
        code_style: {
          indentation: 2,
          quotes: 'single',
          semicolons: true,
        },
        conventions: {
          naming: 'camelCase',
          file_structure: 'standard',
        },
        best_practices: [],
      },
      metadata: this.generateProjectMetadata(localSettings),
    };
  }
}