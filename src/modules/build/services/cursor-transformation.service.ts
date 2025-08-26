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
} from '../interfaces/taptik-format.interface';

import { CursorSecurityService } from './cursor-security.service';
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
    private readonly securityService: CursorSecurityService,
    private readonly validationService: CursorValidationService,
  ) {}

  /**
   * Transform Cursor global settings to Taptik personal context
   */
  async transformCursorPersonalContext(
    globalSettings: CursorGlobalSettingsData,
    applySecurityFilter: boolean = true,
  ): Promise<TaptikPersonalContext> {
    this.logger.log('Transforming Cursor global settings to personal context');

    try {
      // Apply security filtering if enabled
      const settings = applySecurityFilter
        ? await this.securityService.filterSensitiveData(globalSettings)
        : globalSettings;

      const preferences = await this.extractUserPreferences(settings);
      const workStyle = await this.extractWorkStyle(settings);
      const communication = await this.extractCommunication(settings);
      const metadata = this.generatePersonalMetadata(settings);

      const personalContext: TaptikPersonalContext = {
        user_id: this.generateUserId(settings),
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
    applySecurityFilter: boolean = true,
  ): Promise<TaptikProjectContext> {
    this.logger.log('Transforming Cursor local settings to project context');

    try {
      // Apply security filtering if enabled
      const settings = applySecurityFilter
        ? await this.securityService.filterSensitiveData(localSettings)
        : localSettings;

      const projectInfo = await this.extractProjectInfo(settings);
      const technicalStack = await this.extractTechnicalStack(settings);
      const developmentGuidelines = await this.extractDevelopmentGuidelines(settings);
      const metadata = this.generateProjectMetadata(settings);

      const projectContext: TaptikProjectContext = {
        project_id: this.generateProjectId(settings),
        project_info: projectInfo,
        technical_stack: technicalStack,
        development_guidelines: developmentGuidelines,
        metadata,
      };

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
    applySecurityFilter: boolean = true,
  ): Promise<TaptikPromptTemplates> {
    this.logger.log('Transforming Cursor AI configuration to prompt templates');

    const templates: PromptTemplateEntry[] = [];
    
    if (aiConfig) {
      // Apply security filtering if enabled
      const config = applySecurityFilter
        ? await this.securityService.filterSensitiveData(aiConfig)
        : aiConfig;

      // Transform AI rules
      if (config.rules) {
        for (const rule of config.rules) {
          if (rule.enabled !== false) {
            templates.push({
              id: randomUUID(),
              name: rule.name,
              description: `AI rule for ${rule.pattern} files`,
              category: this.categorizePrompt(rule.prompt, rule.name),
              content: rule.prompt,
              variables: this.extractTemplateVariables(rule.prompt),
              tags: ['cursor-ide', 'ai-rule', rule.pattern].filter(Boolean),
            });
          }
        }
      }

      // Transform global prompts
      if (config.globalPrompts) {
        for (const [key, prompt] of Object.entries(config.globalPrompts)) {
          const promptStr = String(prompt);
          templates.push({
            id: randomUUID(),
            name: key,
            description: `Global prompt: ${key}`,
            category: this.categorizePrompt(promptStr, key),
            content: promptStr,
            variables: this.extractTemplateVariables(promptStr),
            tags: ['cursor-ide', 'global-prompt'],
          });
        }
      }
    }

    return {
      templates,
      metadata: {
        source_platform: 'cursor-ide',
        created_at: new Date().toISOString(),
        version: '1.0.0',
        total_templates: templates.length,
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
    const extensionIds = extensions.map(e => e.id);
    const compatibilityResult = await this.validationService.checkExtensionCompatibility(extensionIds);
    
    const mappedExtensions = extensions.map(ext => ({
      id: ext.id,
      name: ext.name,
      publisher: ext.publisher,
      version: ext.version,
      enabled: ext.enabled,
      platform_specific: compatibilityResult.incompatibleExtensions.includes(ext.id),
    }));

    const compatibleExtensions = extensions.filter(
      ext => !compatibilityResult.incompatibleExtensions.includes(ext.id)
    );

    const result: ExtensionMappingResult = {
      extensions: mappedExtensions,
      compatibility: {
        vscode: compatibleExtensions.map(e => e.id),
        cursor_specific: compatibilityResult.incompatibleExtensions,
        universal: compatibleExtensions
          .filter(e => this.isUniversalExtension(e.id))
          .map(e => e.id),
      },
      metadata: {
        total_count: extensions.length,
        compatible_count: compatibleExtensions.length,
        warnings: compatibilityResult.migrationSuggestions,
      },
    };

    // Add alternatives if available
    if (Object.keys(compatibilityResult.alternativeExtensions).length > 0) {
      result.alternatives = compatibilityResult.alternativeExtensions;
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
    
    // Extract preferred languages based on installed extensions and settings
    const preferredLanguages = this.detectPreferredLanguages(globalSettings);
    
    // Extract coding style from editor settings
    const codingStyle = this.extractCodingStyle(settings);
    
    // Extract tools and frameworks from extensions
    const toolsAndFrameworks = this.extractToolsAndFrameworks(globalSettings);
    
    // Extract development environment preferences
    const developmentEnvironment = this.extractDevelopmentEnvironment(settings);

    return {
      preferred_languages: preferredLanguages,
      coding_style: codingStyle,
      tools_and_frameworks: toolsAndFrameworks,
      development_environment: developmentEnvironment,
    };
  }

  /**
   * Extract work style from global settings
   */
  private async extractWorkStyle(
    globalSettings: CursorGlobalSettingsData,
  ): Promise<WorkStyle> {
    const settings = globalSettings.settings || {};

    // Infer workflow preferences
    const preferredWorkflow = this.inferWorkflow(settings, globalSettings);
    
    // Determine problem-solving approach
    const problemSolvingApproach = this.inferProblemSolving(settings);
    
    // Determine documentation level
    const documentationLevel = this.inferDocumentationLevel(settings);
    
    // Determine testing approach
    const testingApproach = this.inferTestingApproach(settings, globalSettings);

    return {
      preferred_workflow: preferredWorkflow,
      problem_solving_approach: problemSolvingApproach,
      documentation_level: documentationLevel,
      testing_approach: testingApproach,
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
      preferred_explanation_style: this.inferExplanationStyle(settings),
      technical_depth: 'intermediate', // Default, could be inferred from extensions
      feedback_style: 'direct',
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
      version: '1.0.0', // Default version
      repository: '', // Would need to detect from .git
    };
  }

  /**
   * Extract technical stack from local settings
   */
  private async extractTechnicalStack(
    localSettings: CursorLocalSettingsData,
  ): Promise<TechnicalStack> {
    return {
      primary_language: await this.detectPrimaryLanguage(localSettings),
      frameworks: await this.detectFrameworks(localSettings),
      databases: [], // Would need to detect from config files
      tools: await this.detectTools(localSettings),
      deployment: [], // Would need to detect from config files
    };
  }

  /**
   * Extract development guidelines from local settings
   */
  private async extractDevelopmentGuidelines(
    localSettings: CursorLocalSettingsData,
  ): Promise<DevelopmentGuidelines> {
    const settings = localSettings.settings || {};
    
    const codingStandards: string[] = [];
    const testingRequirements: string[] = [];
    const documentationStandards: string[] = [];
    const reviewProcess: string[] = [];

    // Infer coding standards from settings
    if (settings['editor.formatOnSave']) {
      codingStandards.push('Format on save enabled');
    }
    if (settings['eslint.enable'] !== false) {
      codingStandards.push('ESLint enforced');
    }
    if (settings['prettier.enable'] !== false) {
      codingStandards.push('Prettier formatting');
    }

    // Infer testing requirements
    if (settings['jest.autoRun']) {
      testingRequirements.push('Jest auto-run enabled');
    }
    if (settings['vitest.enable']) {
      testingRequirements.push('Vitest testing framework');
    }

    // Add default standards if none detected
    if (codingStandards.length === 0) {
      codingStandards.push('Standard code formatting');
    }
    if (testingRequirements.length === 0) {
      testingRequirements.push('Unit testing recommended');
    }
    if (documentationStandards.length === 0) {
      documentationStandards.push('Inline documentation');
    }
    if (reviewProcess.length === 0) {
      reviewProcess.push('Peer review recommended');
    }

    return {
      coding_standards: codingStandards,
      testing_requirements: testingRequirements,
      documentation_standards: documentationStandards,
      review_process: reviewProcess,
    };
  }

  /**
   * Detect preferred languages from settings and extensions
   */
  private detectPreferredLanguages(globalSettings: CursorGlobalSettingsData): string[] {
    const languages: Set<string> = new Set();
    const settings = globalSettings.settings || {};
    
    // Check language-specific settings
    if (settings['typescript.tsdk']) languages.add('typescript');
    if (settings['python.defaultInterpreterPath']) languages.add('python');
    if (settings['java.home']) languages.add('java');
    if (settings['go.gopath']) languages.add('go');
    if (settings['rust-analyzer.server.path']) languages.add('rust');
    
    // Check extensions for language support
    if (globalSettings.globalExtensions) {
      for (const ext of globalSettings.globalExtensions) {
        const id = ext.id.toLowerCase();
        if (id.includes('python')) languages.add('python');
        if (id.includes('typescript')) languages.add('typescript');
        if (id.includes('javascript')) languages.add('javascript');
        if (id.includes('rust')) languages.add('rust');
        if (id.includes('golang') || id.includes('go')) languages.add('go');
        if (id.includes('java')) languages.add('java');
        if (id.includes('csharp')) languages.add('csharp');
      }
    }
    
    // Default to JavaScript if no languages detected
    if (languages.size === 0) {
      languages.add('javascript');
    }
    
    return Array.from(languages);
  }

  /**
   * Extract coding style from settings
   */
  private extractCodingStyle(settings: VSCodeSettings): CodingStyle {
    const tabSize = (settings['editor.tabSize'] as number) || 2;
    const insertSpaces = settings['editor.insertSpaces'] !== false;
    const indentation = insertSpaces ? `${tabSize} spaces` : 'tabs';
    
    // Infer naming convention from settings or default
    let namingConvention = 'camelCase';
    if (settings['python.linting.enabled']) {
      namingConvention = 'snake_case';
    }
    
    // Infer comment style
    let commentStyle = 'standard';
    if (settings['editor.quickSuggestions']) {
      commentStyle = 'detailed';
    }
    
    return {
      indentation,
      naming_convention: namingConvention,
      comment_style: commentStyle,
      code_organization: 'feature-based',
    };
  }

  /**
   * Extract tools and frameworks from extensions
   */
  private extractToolsAndFrameworks(globalSettings: CursorGlobalSettingsData): string[] {
    const tools: Set<string> = new Set();
    
    if (globalSettings.globalExtensions) {
      for (const ext of globalSettings.globalExtensions) {
        const id = ext.id.toLowerCase();
        // Frameworks
        if (id.includes('angular')) tools.add('angular');
        if (id.includes('react')) tools.add('react');
        if (id.includes('vue')) tools.add('vue');
        if (id.includes('svelte')) tools.add('svelte');
        // Tools
        if (id.includes('eslint')) tools.add('eslint');
        if (id.includes('prettier')) tools.add('prettier');
        if (id.includes('docker')) tools.add('docker');
        if (id.includes('git')) tools.add('git');
      }
    }
    
    return Array.from(tools);
  }

  /**
   * Extract development environment preferences
   */
  private extractDevelopmentEnvironment(settings: VSCodeSettings): string[] {
    const env: string[] = [];
    
    const theme = (settings['workbench.colorTheme'] as string) || 'Default Dark+';
    env.push(`Theme: ${theme}`);
    
    const fontSize = (settings['editor.fontSize'] as number) || 14;
    env.push(`Font size: ${fontSize}`);
    
    if (settings['editor.minimap.enabled'] !== false) {
      env.push('Minimap enabled');
    }
    
    if (settings['editor.wordWrap'] === 'on') {
      env.push('Word wrap enabled');
    }
    
    return env;
  }

  /**
   * Infer workflow from settings
   */
  private inferWorkflow(settings: VSCodeSettings, globalSettings: CursorGlobalSettingsData): string {
    // Check for TDD indicators
    if (settings['jest.autoRun'] || settings['vitest.enable']) {
      return 'TDD';
    }
    
    // Check for agile/scrum indicators in extensions
    if (globalSettings.globalExtensions?.some(e => 
      e.id.toLowerCase().includes('jira') || 
      e.id.toLowerCase().includes('azure-devops')
    )) {
      return 'agile';
    }
    
    return 'iterative';
  }

  /**
   * Infer problem-solving approach
   */
  private inferProblemSolving(settings: VSCodeSettings): string {
    if (settings['editor.quickSuggestions']) {
      return 'incremental';
    }
    return 'holistic';
  }

  /**
   * Infer documentation level
   */
  private inferDocumentationLevel(settings: VSCodeSettings): string {
    if (settings['editor.quickSuggestions'] && settings['editor.suggestOnTriggerCharacters']) {
      return 'comprehensive';
    }
    return 'standard';
  }

  /**
   * Infer testing approach
   */
  private inferTestingApproach(settings: VSCodeSettings, globalSettings: CursorGlobalSettingsData): string {
    if (settings['jest.autoRun'] || settings['vitest.enable']) {
      return 'unit-first';
    }
    
    if (globalSettings.globalExtensions?.some(e => 
      e.id.toLowerCase().includes('cypress') || 
      e.id.toLowerCase().includes('playwright')
    )) {
      return 'e2e-focused';
    }
    
    return 'balanced';
  }

  /**
   * Infer explanation style
   */
  private inferExplanationStyle(settings: VSCodeSettings): string {
    if (settings['editor.quickSuggestions']) {
      return 'detailed';
    }
    return 'concise';
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
      if (recs.some(e => e.includes('nestjs'))) frameworks.add('nestjs');
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
    const variablePattern = /{{(\w+)}}|\${(\w+)}|\$(\w+)/g;
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
  private generateUserId(_globalSettings: CursorGlobalSettingsData): string {
    return randomUUID();
  }

  /**
   * Generate project ID from local settings
   */
  private generateProjectId(_localSettings: CursorLocalSettingsData): string {
    return randomUUID();
  }

  /**
   * Generate personal metadata
   */
  private generatePersonalMetadata(_globalSettings: CursorGlobalSettingsData): PersonalMetadata {
    return {
      source_platform: 'cursor-ide',
      created_at: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  /**
   * Generate project metadata
   */
  private generateProjectMetadata(localSettings: CursorLocalSettingsData): ProjectMetadata {
    return {
      source_platform: 'cursor-ide',
      source_path: localSettings.projectPath,
      created_at: new Date().toISOString(),
      version: '1.0.0',
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
        preferred_languages: ['javascript'],
        coding_style: {
          indentation: '2 spaces',
          naming_convention: 'camelCase',
          comment_style: 'standard',
          code_organization: 'feature-based',
        },
        tools_and_frameworks: [],
        development_environment: ['Default settings'],
      },
      work_style: {
        preferred_workflow: 'iterative',
        problem_solving_approach: 'incremental',
        documentation_level: 'standard',
        testing_approach: 'balanced',
      },
      communication: {
        preferred_explanation_style: 'concise',
        technical_depth: 'intermediate',
        feedback_style: 'direct',
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
        version: '1.0.0',
        repository: '',
      },
      technical_stack: {
        primary_language: 'javascript',
        frameworks: [],
        databases: [],
        tools: [],
        deployment: [],
      },
      development_guidelines: {
        coding_standards: ['Standard code formatting'],
        testing_requirements: ['Unit testing recommended'],
        documentation_standards: ['Inline documentation'],
        review_process: ['Peer review recommended'],
      },
      metadata: this.generateProjectMetadata(localSettings),
    };
  }
}