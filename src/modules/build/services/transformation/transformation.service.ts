import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import {
  ClaudeCodeLocalSettings,
  ClaudeCodeGlobalSettings,
  ClaudeCodeSettings,
  ClaudeAgent,
  ClaudeCommand,
  McpConfig,
  McpServerConfig,
  SteeringRule,
} from '../../../context/interfaces/cloud.interface';
import {
  HookFile,
  SettingsData,
} from '../../interfaces/settings-data.interface';
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
} from '../../interfaces/taptik-format.interface';
import {
  DataProcessingErrorHandler,
  DataProcessingErrorType,
  DataProcessingErrorResult,
} from '../../utils/data-processing-error-handler';

// Type definitions for parsed data structures
type ParsedValue = string | string[] | Record<string, unknown>;
type ParsedData = Record<string, ParsedValue>;

/**
 * Service responsible for transforming collected Kiro settings data
 * into taptik standard format for interoperability
 */
@Injectable()
export class TransformationService {
  private readonly logger = new Logger(TransformationService.name);

  /**
   * Transform personal context data from Kiro format to Taptik format
   * @param settingsData Raw settings data collected from Kiro
   * @returns Transformed personal context in Taptik format
   */
  async transformPersonalContext(
    settingsData: SettingsData,
  ): Promise<TaptikPersonalContext> {
    try {
      this.logger.log('Starting personal context transformation');

      const userPreferences = await this.extractUserPreferences(settingsData);
      const workStyle = await this.extractWorkStyle(settingsData);
      const communication = await this.extractCommunication(settingsData);
      const metadata = this.generatePersonalMetadata(settingsData);

      const personalContext: TaptikPersonalContext = {
        user_id: this.generateUserId(settingsData),
        preferences: userPreferences,
        work_style: workStyle,
        communication,
        metadata,
      };

      this.logger.log('Personal context transformation completed successfully');
      return personalContext;
    } catch (error) {
      const errorResult = DataProcessingErrorHandler.handleError(
        error,
        DataProcessingErrorType.TRANSFORMATION,
        {
          category: 'personal-context',
          operation: 'transforming personal context',
          filePath: settingsData.collectionMetadata.projectPath,
        },
      );

      DataProcessingErrorHandler.logErrorResult(errorResult);

      if (errorResult.isCritical) {
        throw new Error(errorResult.userMessage);
      } else {
        // Return minimal personal context with available data
        return this.createFallbackPersonalContext(
          settingsData,
          errorResult.partialData,
        );
      }
    }
  }

  /**
   * Transform project context data from Kiro format to Taptik format
   * @param settingsData Raw settings data collected from Kiro
   * @returns Transformed project context in Taptik format
   */
  async transformProjectContext(
    settingsData: SettingsData,
  ): Promise<TaptikProjectContext> {
    try {
      this.logger.log('Starting project context transformation');

      const projectInfo = await this.extractProjectInfo(settingsData);
      const technicalStack = await this.extractTechnicalStack(settingsData);
      const developmentGuidelines =
        await this.extractDevelopmentGuidelines(settingsData);
      const metadata = this.generateProjectMetadata(settingsData);

      const projectContext: TaptikProjectContext = {
        project_id: this.generateProjectId(settingsData),
        project_info: projectInfo,
        technical_stack: technicalStack,
        development_guidelines: developmentGuidelines,
        metadata,
      };

      this.logger.log('Project context transformation completed successfully');
      return projectContext;
    } catch (error) {
      const errorResult = DataProcessingErrorHandler.handleError(
        error,
        DataProcessingErrorType.TRANSFORMATION,
        {
          category: 'project-context',
          operation: 'transforming project context',
          filePath: settingsData.collectionMetadata.projectPath,
        },
      );

      DataProcessingErrorHandler.logErrorResult(errorResult);

      if (errorResult.isCritical) {
        throw new Error(errorResult.userMessage);
      } else {
        // Return minimal project context with available data
        return this.createFallbackProjectContext(
          settingsData,
          errorResult.partialData,
        );
      }
    }
  }

  /**
   * Transform prompt templates data from Kiro format to Taptik format
   * @param settingsData Raw settings data collected from Kiro
   * @returns Transformed prompt templates in Taptik format
   */
  async transformPromptTemplates(
    settingsData: SettingsData,
  ): Promise<TaptikPromptTemplates> {
    try {
      this.logger.log('Starting prompt templates transformation');

      const templates = await this.extractPromptTemplates(settingsData);
      const metadata = this.generatePromptMetadata(
        settingsData,
        templates.length,
      );

      const promptTemplates: TaptikPromptTemplates = {
        templates,
        metadata,
      };

      this.logger.log(
        `Prompt templates transformation completed successfully with ${templates.length} templates`,
      );
      return promptTemplates;
    } catch (error) {
      const errorResult = DataProcessingErrorHandler.handleError(
        error,
        DataProcessingErrorType.TRANSFORMATION,
        {
          category: 'prompt-templates',
          operation: 'transforming prompt templates',
          filePath: settingsData.collectionMetadata.globalPath,
        },
      );

      DataProcessingErrorHandler.logErrorResult(errorResult);

      if (errorResult.isCritical) {
        throw new Error(errorResult.userMessage);
      } else {
        // Return minimal prompt templates with available data
        return this.createFallbackPromptTemplates(
          settingsData,
          errorResult.partialData,
        );
      }
    }
  }

  /**
   * Extract user preferences from Kiro settings
   */
  private async extractUserPreferences(
    settingsData: SettingsData,
  ): Promise<UserPreferences> {
    const globalPreferences = this.parseKiroPreferences(
      settingsData.globalSettings.preferences,
    );
    const localPreferences = this.parseKiroPreferences(
      settingsData.localSettings.userPreferencesMd,
    );

    return {
      preferred_languages: this.extractPreferredLanguages(
        globalPreferences,
        localPreferences,
      ),
      coding_style: this.extractCodingStyle(
        globalPreferences,
        localPreferences,
      ),
      tools_and_frameworks: this.extractToolsAndFrameworks(
        globalPreferences,
        localPreferences,
      ),
      development_environment: this.extractDevelopmentEnvironment(
        globalPreferences,
        localPreferences,
      ),
    };
  }

  /**
   * Extract work style preferences from Kiro settings
   */
  private async extractWorkStyle(
    settingsData: SettingsData,
  ): Promise<WorkStyle> {
    const globalConfig = this.parseKiroConfig(
      settingsData.globalSettings.userConfig,
    );
    const projectSpec = this.parseKiroConfig(
      settingsData.localSettings.projectSpecMd,
    );

    return {
      preferred_workflow: this.extractWorkflow(globalConfig, projectSpec),
      problem_solving_approach: this.extractProblemSolvingApproach(
        globalConfig,
        projectSpec,
      ),
      documentation_level: this.extractDocumentationLevel(
        globalConfig,
        projectSpec,
      ),
      testing_approach: this.extractTestingApproach(globalConfig, projectSpec),
    };
  }

  /**
   * Extract communication preferences from Kiro settings
   */
  private async extractCommunication(
    settingsData: SettingsData,
  ): Promise<Communication> {
    const globalConfig = this.parseKiroConfig(
      settingsData.globalSettings.userConfig,
    );
    const preferences = this.parseKiroPreferences(
      settingsData.globalSettings.preferences,
    );

    return {
      preferred_explanation_style: this.extractExplanationStyle(
        globalConfig,
        preferences,
      ),
      technical_depth: this.extractTechnicalDepth(globalConfig, preferences),
      feedback_style: this.extractFeedbackStyle(globalConfig, preferences),
    };
  }

  /**
   * Generate metadata for personal context
   */
  private generatePersonalMetadata(
    settingsData: SettingsData,
  ): PersonalMetadata {
    return {
      source_platform: settingsData.collectionMetadata.sourcePlatform,
      created_at: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  /**
   * Generate unique user ID based on settings data
   */
  private generateUserId(_settingsData: SettingsData): string {
    return randomUUID();
  }

  /**
   * Parse Kiro preferences markdown content into structured data
   */
  private parseKiroPreferences(content?: string): ParsedData {
    if (!content) return {};

    try {
      const parsed: ParsedData = {};

      const lines = content.split('\n');
      let currentSection = 'root';
      let currentSubSection = '';

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith('#')) {
          currentSection = trimmedLine
            .replace(/^#+\s*/, '')
            .toLowerCase()
            .replaceAll(/\s+/g, '_');
          if (!parsed[currentSection]) {
            parsed[currentSection] = {};
          }
          currentSubSection = '';
        } else if (trimmedLine.includes(':')) {
          const colonIndex = trimmedLine.indexOf(':');
          const key = trimmedLine.slice(0, Math.max(0, colonIndex)).trim();
          const value = trimmedLine.slice(Math.max(0, colonIndex + 1)).trim();

          const normalizedKey = key.toLowerCase().replaceAll(/\s+/g, '_');

          if (currentSubSection) {
            if (!parsed[currentSection][currentSubSection]) {
              parsed[currentSection][currentSubSection] = {};
            }
            parsed[currentSection][currentSubSection][normalizedKey] = value;
          } else if (currentSection && currentSection !== 'root') {
            parsed[currentSection][normalizedKey] = value;
          } else {
            parsed[normalizedKey] = value;
          }

          if (value.includes(',')) {
            const arrayValue = value.split(',').map((v) => v.trim());
            if (currentSubSection) {
              parsed[currentSection][currentSubSection][normalizedKey] =
                arrayValue;
            } else if (currentSection && currentSection !== 'root') {
              parsed[currentSection][normalizedKey] = arrayValue;
            } else {
              parsed[normalizedKey] = arrayValue;
            }
          }
        } else if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
          const value = trimmedLine.replace(/^[*-]\s*/, '');
          const arrayKey = currentSubSection || 'items';

          if (!parsed[currentSection][arrayKey]) {
            parsed[currentSection][arrayKey] = [];
          }
          if (Array.isArray(parsed[currentSection][arrayKey])) {
            parsed[currentSection][arrayKey].push(value);
          }
        } else if (
          trimmedLine &&
          !trimmedLine.startsWith('#') &&
          currentSection !== 'root' &&
          trimmedLine.endsWith(':')
        ) {
          currentSubSection = trimmedLine
            .replace(':', '')
            .trim()
            .toLowerCase()
            .replaceAll(/\s+/g, '_');
          if (!parsed[currentSection][currentSubSection]) {
            parsed[currentSection][currentSubSection] = {};
          }
        }
      }

      return parsed;
    } catch (error) {
      const errorResult = DataProcessingErrorHandler.handleError(
        error,
        DataProcessingErrorType.MARKDOWN_PARSING,
        {
          operation: 'parsing Kiro preferences markdown',
          rawData: content,
        },
      );

      DataProcessingErrorHandler.logErrorResult(errorResult);

      // Return partial data if available, otherwise empty object
      return (errorResult.partialData as ParsedData) || ({} as ParsedData);
    }
  }

  /**
   * Parse Kiro configuration content
   */
  private parseKiroConfig(content?: string): ParsedData {
    return this.parseKiroPreferences(content);
  }

  /**
   * Extract preferred programming languages
   */
  private extractPreferredLanguages(
    globalPrefs: Record<string, unknown>,
    localPrefs: Record<string, unknown>,
  ): string[] {
    const languages = new Set<string>();

    // Try different possible locations for languages
    const globalLanguages = this.extractArrayFromParsedData(globalPrefs, [
      'languages',
      'preferred_languages',
    ]);
    const localLanguages = this.extractArrayFromParsedData(localPrefs, [
      'languages',
      'preferred_languages',
    ]);

    globalLanguages.forEach((lang) => languages.add(lang));
    localLanguages.forEach((lang) => languages.add(lang));

    if (languages.size === 0) {
      languages.add('typescript');
    }

    return [...languages];
  }

  /**
   * Helper method to extract arrays from parsed markdown data
   */
  private extractArrayFromParsedData(
    data: Record<string, unknown>,
    keys: string[],
  ): string[] {
    const result: string[] = [];

    for (const section of Object.keys(data || {})) {
      const sectionData = data[section];
      if (typeof sectionData === 'object' && sectionData !== null) {
        for (const key of keys) {
          const value = sectionData[key];
          if (Array.isArray(value)) {
            result.push(...value);
          } else if (typeof value === 'string') {
            if (value.includes(',')) {
              result.push(...value.split(',').map((v) => v.trim()));
            } else {
              result.push(value);
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Extract coding style preferences
   */
  private extractCodingStyle(
    globalPrefs: Record<string, unknown>,
    localPrefs: Record<string, unknown>,
  ): CodingStyle {
    const globalStyle =
      typeof globalPrefs.coding_style === 'object' &&
      globalPrefs.coding_style !== null
        ? (globalPrefs.coding_style as Record<string, unknown>)
        : {};
    const localStyle =
      typeof localPrefs.coding_style === 'object' &&
      localPrefs.coding_style !== null
        ? (localPrefs.coding_style as Record<string, unknown>)
        : {};
    const style = { ...globalStyle, ...localStyle };

    return {
      indentation:
        (typeof style.indentation === 'string' ? style.indentation : null) ||
        '2 spaces',
      naming_convention:
        (typeof style.naming_convention === 'string'
          ? style.naming_convention
          : null) || 'camelCase',
      comment_style:
        (typeof style.comment_style === 'string'
          ? style.comment_style
          : null) || 'minimal',
      code_organization:
        (typeof style.code_organization === 'string'
          ? style.code_organization
          : null) || 'feature-based',
    };
  }

  /**
   * Extract tools and frameworks preferences
   */
  private extractToolsAndFrameworks(
    globalPrefs: Record<string, unknown>,
    localPrefs: Record<string, unknown>,
  ): string[] {
    const tools = new Set<string>();

    const globalTools = this.extractArrayFromParsedData(globalPrefs, [
      'tools',
      'frameworks',
    ]);
    const localTools = this.extractArrayFromParsedData(localPrefs, [
      'tools',
      'frameworks',
    ]);

    globalTools.forEach((tool) => tools.add(tool));
    localTools.forEach((tool) => tools.add(tool));

    return [...tools];
  }

  /**
   * Extract development environment preferences
   */
  private extractDevelopmentEnvironment(
    globalPrefs: Record<string, unknown>,
    localPrefs: Record<string, unknown>,
  ): string[] {
    const environments = new Set<string>();

    const globalEnvironments = this.extractArrayFromParsedData(globalPrefs, [
      'environment',
      'dev_environment',
    ]);
    const localEnvironments = this.extractArrayFromParsedData(localPrefs, [
      'environment',
      'dev_environment',
    ]);

    globalEnvironments.forEach((env) => environments.add(env));
    localEnvironments.forEach((env) => environments.add(env));

    return [...environments];
  }

  /**
   * Extract workflow preferences
   */
  private extractWorkflow(
    globalConfig: Record<string, unknown>,
    projectSpec: Record<string, unknown>,
  ): string {
    return (
      (typeof projectSpec.workflow === 'string'
        ? projectSpec.workflow
        : null) ||
      (typeof globalConfig.workflow === 'string'
        ? globalConfig.workflow
        : null) ||
      'agile'
    );
  }

  /**
   * Extract problem solving approach
   */
  private extractProblemSolvingApproach(
    globalConfig: Record<string, unknown>,
    projectSpec: Record<string, unknown>,
  ): string {
    return (
      (typeof globalConfig.problem_solving === 'string'
        ? globalConfig.problem_solving
        : null) ||
      (typeof projectSpec.problem_solving === 'string'
        ? projectSpec.problem_solving
        : null) ||
      'incremental'
    );
  }

  /**
   * Extract documentation level preference
   */
  private extractDocumentationLevel(
    globalConfig: Record<string, unknown>,
    projectSpec: Record<string, unknown>,
  ): string {
    return (
      (typeof projectSpec.documentation === 'string'
        ? projectSpec.documentation
        : null) ||
      (typeof globalConfig.documentation === 'string'
        ? globalConfig.documentation
        : null) ||
      'minimal'
    );
  }

  /**
   * Extract testing approach preference
   */
  private extractTestingApproach(
    globalConfig: Record<string, unknown>,
    projectSpec: Record<string, unknown>,
  ): string {
    return (
      (typeof projectSpec.testing === 'string' ? projectSpec.testing : null) ||
      (typeof globalConfig.testing === 'string'
        ? globalConfig.testing
        : null) ||
      'unit-first'
    );
  }

  /**
   * Helper method to extract string values from parsed data
   */
  private extractStringFromParsedData(
    data: Record<string, unknown>,
    keys: string[],
    defaultValue: string,
  ): string {
    for (const section of Object.keys(data || {})) {
      const sectionData = data[section];
      if (typeof sectionData === 'object' && sectionData !== null) {
        for (const key of keys) {
          const value = sectionData[key];
          if (typeof value === 'string') {
            return value.toLowerCase();
          }
        }
      }
    }
    return defaultValue;
  }

  /**
   * Extract explanation style preference
   */
  private extractExplanationStyle(
    globalConfig: Record<string, unknown>,
    preferences: Record<string, unknown>,
  ): string {
    const globalValue = this.extractStringFromParsedData(
      globalConfig,
      ['explanation_style'],
      '',
    );
    const prefValue = this.extractStringFromParsedData(
      preferences,
      ['explanation_style'],
      '',
    );
    return prefValue || globalValue || 'concise';
  }

  /**
   * Extract technical depth preference
   */
  private extractTechnicalDepth(
    globalConfig: Record<string, unknown>,
    preferences: Record<string, unknown>,
  ): string {
    const globalValue = this.extractStringFromParsedData(
      globalConfig,
      ['technical_depth'],
      '',
    );
    const prefValue = this.extractStringFromParsedData(
      preferences,
      ['technical_depth'],
      '',
    );
    return prefValue || globalValue || 'intermediate';
  }

  /**
   * Extract feedback style preference
   */
  private extractFeedbackStyle(
    globalConfig: Record<string, unknown>,
    preferences: Record<string, unknown>,
  ): string {
    const globalValue = this.extractStringFromParsedData(
      globalConfig,
      ['feedback_style'],
      '',
    );
    const prefValue = this.extractStringFromParsedData(
      preferences,
      ['feedback_style'],
      '',
    );
    return prefValue || globalValue || 'direct';
  }

  /**
   * Extract project information from Kiro settings
   */
  private async extractProjectInfo(
    settingsData: SettingsData,
  ): Promise<ProjectInfo> {
    const contextData = this.parseKiroConfig(
      settingsData.localSettings.contextMd,
    );
    const projectSpecData = this.parseKiroConfig(
      settingsData.localSettings.projectSpecMd,
    );

    return {
      name: this.extractProjectName(contextData, projectSpecData, settingsData),
      description: this.extractProjectDescription(contextData, projectSpecData),
      version: this.extractProjectVersion(contextData, projectSpecData),
      repository: this.extractProjectRepository(contextData, projectSpecData),
    };
  }

  /**
   * Extract technical stack information from Kiro settings
   */
  private async extractTechnicalStack(
    settingsData: SettingsData,
  ): Promise<TechnicalStack> {
    const contextData = this.parseKiroConfig(
      settingsData.localSettings.contextMd,
    );
    const projectSpecData = this.parseKiroConfig(
      settingsData.localSettings.projectSpecMd,
    );
    const userPrefs = this.parseKiroPreferences(
      settingsData.localSettings.userPreferencesMd,
    );

    return {
      primary_language: this.extractPrimaryLanguage(
        contextData,
        projectSpecData,
        userPrefs,
      ),
      frameworks: this.extractFrameworks(
        contextData,
        projectSpecData,
        userPrefs,
      ),
      databases: this.extractDatabases(contextData, projectSpecData),
      tools: this.extractProjectTools(contextData, projectSpecData, userPrefs),
      deployment: this.extractDeployment(contextData, projectSpecData),
    };
  }

  /**
   * Extract development guidelines from Kiro settings
   */
  private async extractDevelopmentGuidelines(
    settingsData: SettingsData,
  ): Promise<DevelopmentGuidelines> {
    const steeringRules = this.extractSteeringRules(
      settingsData.localSettings.steeringFiles,
    );
    const projectSpecData = this.parseKiroConfig(
      settingsData.localSettings.projectSpecMd,
    );
    const { hooks } = settingsData.localSettings;

    return {
      coding_standards: this.extractCodingStandards(
        steeringRules,
        projectSpecData,
      ),
      testing_requirements: this.extractTestingRequirements(
        steeringRules,
        projectSpecData,
      ),
      documentation_standards: this.extractDocumentationStandards(
        steeringRules,
        projectSpecData,
      ),
      review_process: this.extractReviewProcess(steeringRules, hooks),
    };
  }

  /**
   * Generate metadata for project context
   */
  private generateProjectMetadata(settingsData: SettingsData): ProjectMetadata {
    return {
      source_platform: settingsData.collectionMetadata.sourcePlatform,
      source_path: settingsData.collectionMetadata.projectPath,
      created_at: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  /**
   * Generate unique project ID based on settings data
   */
  private generateProjectId(settingsData: SettingsData): string {
    const { projectPath } = settingsData.collectionMetadata;
    const projectName = projectPath.split('/').pop() || 'unknown-project';
    return `${projectName}-${randomUUID().slice(0, 8)}`;
  }

  /**
   * Extract project name from various sources
   */
  private extractProjectName(
    contextData: Record<string, unknown>,
    projectSpecData: Record<string, unknown>,
    settingsData: SettingsData,
  ): string {
    const projectName =
      this.extractStringFromParsedData(
        contextData,
        ['name', 'project_name', 'title'],
        '',
      ) ||
      this.extractStringFromParsedData(
        projectSpecData,
        ['name', 'project_name', 'title'],
        '',
      );

    if (projectName) {
      return projectName;
    }

    // Fallback to directory name
    const { projectPath } = settingsData.collectionMetadata;
    return projectPath.split('/').pop() || 'untitled-project';
  }

  /**
   * Extract project description
   */
  private extractProjectDescription(
    contextData: Record<string, unknown>,
    projectSpecData: Record<string, unknown>,
  ): string {
    return (
      this.extractStringFromParsedData(
        contextData,
        ['description', 'summary', 'about'],
        '',
      ) ||
      this.extractStringFromParsedData(
        projectSpecData,
        ['description', 'summary', 'about'],
        '',
      ) ||
      'No description available'
    );
  }

  /**
   * Extract project version
   */
  private extractProjectVersion(
    contextData: Record<string, unknown>,
    projectSpecData: Record<string, unknown>,
  ): string {
    return (
      this.extractStringFromParsedData(contextData, ['version'], '') ||
      this.extractStringFromParsedData(projectSpecData, ['version'], '') ||
      '1.0.0'
    );
  }

  /**
   * Extract project repository information
   */
  private extractProjectRepository(
    contextData: Record<string, unknown>,
    projectSpecData: Record<string, unknown>,
  ): string {
    return (
      this.extractStringFromParsedData(
        contextData,
        ['repository', 'repo', 'git_url'],
        '',
      ) ||
      this.extractStringFromParsedData(
        projectSpecData,
        ['repository', 'repo', 'git_url'],
        '',
      ) ||
      ''
    );
  }

  /**
   * Extract primary programming language
   */
  private extractPrimaryLanguage(
    contextData: Record<string, unknown>,
    projectSpecData: Record<string, unknown>,
    userPrefs: Record<string, unknown>,
  ): string {
    const languages = [
      ...this.extractArrayFromParsedData(contextData, [
        'language',
        'primary_language',
        'main_language',
      ]),
      ...this.extractArrayFromParsedData(projectSpecData, [
        'language',
        'primary_language',
        'main_language',
      ]),
      ...this.extractArrayFromParsedData(userPrefs, [
        'languages',
        'preferred_languages',
      ]),
    ];

    return languages[0] || 'typescript';
  }

  /**
   * Extract frameworks from project settings
   */
  private extractFrameworks(
    contextData: Record<string, unknown>,
    projectSpecData: Record<string, unknown>,
    userPrefs: Record<string, unknown>,
  ): string[] {
    const frameworks = new Set<string>();

    const contextFrameworks = this.extractArrayFromParsedData(contextData, [
      'frameworks',
      'framework',
      'libraries',
    ]);
    const specFrameworks = this.extractArrayFromParsedData(projectSpecData, [
      'frameworks',
      'framework',
      'libraries',
    ]);
    const prefFrameworks = this.extractArrayFromParsedData(userPrefs, [
      'frameworks',
      'tools',
    ]);

    [...contextFrameworks, ...specFrameworks, ...prefFrameworks].forEach((fw) =>
      frameworks.add(fw),
    );

    return [...frameworks];
  }

  /**
   * Extract databases from project settings
   */
  private extractDatabases(
    contextData: Record<string, unknown>,
    projectSpecData: Record<string, unknown>,
  ): string[] {
    const databases = new Set<string>();

    const contextDbs = this.extractArrayFromParsedData(contextData, [
      'databases',
      'database',
      'db',
    ]);
    const specDbs = this.extractArrayFromParsedData(projectSpecData, [
      'databases',
      'database',
      'db',
    ]);

    [...contextDbs, ...specDbs].forEach((db) => databases.add(db));

    return [...databases];
  }

  /**
   * Extract project tools
   */
  private extractProjectTools(
    contextData: Record<string, unknown>,
    projectSpecData: Record<string, unknown>,
    userPrefs: Record<string, unknown>,
  ): string[] {
    const tools = new Set<string>();

    const contextTools = this.extractArrayFromParsedData(contextData, [
      'tools',
      'build_tools',
      'dev_tools',
    ]);
    const specTools = this.extractArrayFromParsedData(projectSpecData, [
      'tools',
      'build_tools',
      'dev_tools',
    ]);
    const prefTools = this.extractArrayFromParsedData(userPrefs, [
      'tools',
      'development_tools',
    ]);

    [...contextTools, ...specTools, ...prefTools].forEach((tool) =>
      tools.add(tool),
    );

    return [...tools];
  }

  /**
   * Extract deployment information
   */
  private extractDeployment(
    contextData: Record<string, unknown>,
    projectSpecData: Record<string, unknown>,
  ): string[] {
    const deployment = new Set<string>();

    const contextDeploy = this.extractArrayFromParsedData(contextData, [
      'deployment',
      'deploy',
      'hosting',
    ]);
    const specDeploy = this.extractArrayFromParsedData(projectSpecData, [
      'deployment',
      'deploy',
      'hosting',
    ]);

    [...contextDeploy, ...specDeploy].forEach((dep) => deployment.add(dep));

    return [...deployment];
  }

  /**
   * Extract steering rules from steering files
   */
  private extractSteeringRules(steeringFiles: unknown[]): string[] {
    if (!Array.isArray(steeringFiles)) {
      return [];
    }

    return steeringFiles
      .map((file) => {
        if (typeof file === 'object' && file !== null) {
          const fileObj = file as Record<string, unknown>;
          if (typeof fileObj.content === 'string') {
            return fileObj.content.trim();
          }
        }
        return '';
      })
      .filter((content) => content.length > 0);
  }

  /**
   * Extract coding standards from steering rules and project spec
   */
  private extractCodingStandards(
    steeringRules: string[],
    projectSpecData: Record<string, unknown>,
  ): string[] {
    const standards = new Set<string>();

    // Extract from steering files
    steeringRules.forEach((rule) => {
      if (
        rule.toLowerCase().includes('standard') ||
        rule.toLowerCase().includes('convention')
      ) {
        standards.add(rule);
      }
    });

    // Extract from project spec
    const specStandards = this.extractArrayFromParsedData(projectSpecData, [
      'coding_standards',
      'standards',
      'conventions',
    ]);
    specStandards.forEach((std) => standards.add(std));

    return [...standards];
  }

  /**
   * Extract testing requirements
   */
  private extractTestingRequirements(
    steeringRules: string[],
    projectSpecData: Record<string, unknown>,
  ): string[] {
    const requirements = new Set<string>();

    // Extract from steering files
    steeringRules.forEach((rule) => {
      if (
        rule.toLowerCase().includes('test') ||
        rule.toLowerCase().includes('coverage')
      ) {
        requirements.add(rule);
      }
    });

    // Extract from project spec
    const specTests = this.extractArrayFromParsedData(projectSpecData, [
      'testing',
      'test_requirements',
      'coverage',
    ]);
    specTests.forEach((req) => requirements.add(req));

    return [...requirements];
  }

  /**
   * Extract documentation standards
   */
  private extractDocumentationStandards(
    steeringRules: string[],
    projectSpecData: Record<string, unknown>,
  ): string[] {
    const standards = new Set<string>();

    // Extract from steering files
    steeringRules.forEach((rule) => {
      if (
        rule.toLowerCase().includes('documentation') ||
        rule.toLowerCase().includes('comment')
      ) {
        standards.add(rule);
      }
    });

    // Extract from project spec
    const specDocumentation = this.extractArrayFromParsedData(projectSpecData, [
      'documentation',
      'docs',
      'comments',
    ]);
    specDocumentation.forEach((document) => standards.add(document));

    return [...standards];
  }

  /**
   * Extract review process guidelines
   */
  private extractReviewProcess(
    steeringRules: string[],
    hooks: HookFile[],
  ): string[] {
    const process = new Set<string>();

    // Extract from steering files
    steeringRules.forEach((rule) => {
      if (
        rule.toLowerCase().includes('review') ||
        rule.toLowerCase().includes('approval')
      ) {
        process.add(rule);
      }
    });

    // Extract from hooks - check if hooks contain review-related content
    if (Array.isArray(hooks)) {
      hooks.forEach((hook) => {
        if (typeof hook === 'object' && hook.content) {
          const content = hook.content.toLowerCase();
          if (
            content.includes('review') ||
            content.includes('lint') ||
            content.includes('check') ||
            content.includes('validate') ||
            content.includes('commit')
          ) {
            process.add(`Hook-based: ${hook.content.trim()}`);
          }
        }
      });
    }

    return [...process];
  }

  /**
   * Extract prompt templates from Kiro global settings
   */
  private async extractPromptTemplates(
    settingsData: SettingsData,
  ): Promise<PromptTemplateEntry[]> {
    const templates: PromptTemplateEntry[] = [];

    // Extract from global prompts with error handling
    if (
      settingsData.globalSettings.globalPrompts &&
      Array.isArray(settingsData.globalSettings.globalPrompts)
    ) {
      const { results, errors } = this.processArrayWithErrorHandling(
        settingsData.globalSettings.globalPrompts,
        (prompt, index) => this.convertKiroPromptToTaptik(prompt, index),
        {
          operation: 'converting Kiro prompts to Taptik format',
          category: 'prompt-templates',
        },
      );

      // Add successfully converted templates
      templates.push(...results.filter((template) => template !== null));

      // Log summary if there were errors
      if (errors.length > 0) {
        const summary = DataProcessingErrorHandler.createPartialSuccessSummary(
          settingsData.globalSettings.globalPrompts.length,
          results.length,
          errors as DataProcessingErrorResult[],
        );
        this.logger.warn(`Prompt conversion summary: ${summary.summary}`);
      }
    }

    // Extract from global settings content (markdown format) with error handling
    try {
      const additionalTemplates = this.extractTemplatesFromMarkdown(
        settingsData.globalSettings.userConfig,
      );
      templates.push(...additionalTemplates);
    } catch (error) {
      const errorResult = DataProcessingErrorHandler.handleError(
        error,
        DataProcessingErrorType.MARKDOWN_PARSING,
        {
          operation: 'extracting templates from markdown',
          category: 'prompt-templates',
          rawData: settingsData.globalSettings.userConfig,
        },
      );

      DataProcessingErrorHandler.logErrorResult(errorResult);

      // Continue without additional templates if markdown parsing fails
      this.logger.warn(
        'Skipping markdown template extraction due to parsing errors',
      );
    }

    // Sort templates by name for consistent ordering
    return templates.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Convert Kiro prompt format to Taptik template entry
   */
  private convertKiroPromptToTaptik(
    kiroPrompt: unknown,
    index: number,
  ): PromptTemplateEntry | null {
    if (!kiroPrompt || typeof kiroPrompt !== 'object' || kiroPrompt === null) {
      const errorResult = DataProcessingErrorHandler.handleError(
        new Error('Invalid prompt data structure'),
        DataProcessingErrorType.INVALID_DATA_FORMAT,
        {
          operation: `converting prompt ${index + 1}`,
          category: 'prompt-templates',
        },
      );

      DataProcessingErrorHandler.logErrorResult(errorResult);
      return null;
    }

    try {
      // Type guard to ensure kiroPrompt is an object with string properties
      const promptObj = kiroPrompt as Record<string, unknown>;

      const name =
        (typeof promptObj.name === 'string' ? promptObj.name : null) ||
        `Template ${index + 1}`;
      const id =
        (typeof promptObj.id === 'string' ? promptObj.id : null) ||
        this.generateTemplateIdFromName(name);
      const description =
        (typeof promptObj.description === 'string'
          ? promptObj.description
          : null) ||
        (typeof promptObj.summary === 'string' ? promptObj.summary : null) ||
        'No description available';
      const content =
        (typeof promptObj.content === 'string' ? promptObj.content : null) ||
        (typeof promptObj.template === 'string' ? promptObj.template : null) ||
        '';
      const category =
        (typeof promptObj.category === 'string' ? promptObj.category : null) ||
        (typeof promptObj.type === 'string' ? promptObj.type : null) ||
        this.inferCategoryFromName(name);

      if (!content) {
        const errorResult = DataProcessingErrorHandler.handleError(
          new Error('Template content is empty or missing'),
          DataProcessingErrorType.MISSING_REQUIRED_FIELD,
          {
            operation: `processing template "${name}"`,
            category: 'prompt-templates',
          },
        );

        DataProcessingErrorHandler.logErrorResult(errorResult);
        return null;
      }

      const variables = this.extractVariablesFromContent(content);
      const tags = this.extractTagsFromPrompt(promptObj);

      return {
        id,
        name,
        description,
        category,
        content,
        variables,
        tags,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to convert Kiro prompt at index ${index}`,
        error.message,
      );
      return null;
    }
  }

  /**
   * Extract templates from markdown content
   */
  private extractTemplatesFromMarkdown(
    markdownContent?: string,
  ): PromptTemplateEntry[] {
    if (!markdownContent) {
      return [];
    }

    const templates: PromptTemplateEntry[] = [];
    const parsedContent = this.parseKiroConfig(markdownContent);

    // Look for template sections in the markdown
    for (const section of Object.keys(parsedContent)) {
      const sectionData = parsedContent[section];
      if (
        typeof sectionData === 'object' &&
        sectionData !== null && // Check if this section contains template-like data
        this.isTemplateSection(section, sectionData)
      ) {
        const template = this.createTemplateFromSection(
          section,
          sectionData as Record<string, unknown>,
        );
        if (template) {
          templates.push(template);
        }
      }
    }

    return templates;
  }

  /**
   * Check if a markdown section represents a template
   */
  private isTemplateSection(
    sectionName: string,
    sectionData: unknown,
  ): boolean {
    const templateKeywords = ['template', 'prompt', 'instruction', 'guide'];
    const lowerSectionName = sectionName.toLowerCase();

    // Check if section name contains template keywords
    const hasTemplateKeyword = templateKeywords.some((keyword) =>
      lowerSectionName.includes(keyword),
    );

    // Check if section data has template-like content
    const hasTemplateContent =
      sectionData &&
      typeof sectionData === 'object' &&
      sectionData !== null &&
      (((sectionData as Record<string, unknown>).content &&
        typeof (sectionData as Record<string, unknown>).content === 'string') ||
        ((sectionData as Record<string, unknown>).template &&
          typeof (sectionData as Record<string, unknown>).template ===
            'string'));

    return hasTemplateKeyword || hasTemplateContent;
  }

  /**
   * Create a template entry from a markdown section
   */
  private createTemplateFromSection(
    sectionName: string,
    sectionData: Record<string, unknown>,
  ): PromptTemplateEntry | null {
    try {
      // Debug: log the section data to understand the structure
      this.logger.debug(
        `Creating template from section ${sectionName}`,
        JSON.stringify(sectionData),
      );

      const content =
        (typeof sectionData.content === 'string'
          ? sectionData.content
          : null) ||
        (typeof sectionData.template === 'string'
          ? sectionData.template
          : null) ||
        (typeof sectionData.text === 'string' ? sectionData.text : null) ||
        '';
      if (!content || typeof content !== 'string') {
        this.logger.warn(`No valid content found for section ${sectionName}`);
        return null;
      }

      const id = this.generateTemplateId(sectionName);
      const name = this.cleanTemplateName(sectionName);
      const description =
        (typeof sectionData.description === 'string'
          ? sectionData.description
          : null) ||
        (typeof sectionData.summary === 'string'
          ? sectionData.summary
          : null) ||
        `Template extracted from ${sectionName}`;
      const category =
        (typeof sectionData.category === 'string'
          ? sectionData.category
          : null) || this.inferCategoryFromName(sectionName);

      const variables = this.extractVariablesFromContent(content);
      const tags = this.extractTagsFromSection(sectionData);

      return {
        id,
        name,
        description,
        category,
        content,
        variables,
        tags,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to create template from section ${sectionName}`,
        error.message,
      );
      return null;
    }
  }

  /**
   * Extract variables from template content (patterns like {{variable}} or {variable})
   */
  private extractVariablesFromContent(content: string): string[] {
    const variables = new Set<string>();

    // Match {{variable}} pattern
    const doubleBacketMatches = content.match(/{{([^}]+)}}/g);
    if (doubleBacketMatches) {
      doubleBacketMatches.forEach((match) => {
        const variable = match.replaceAll(/{{|}}/g, '').trim();
        if (variable) {
          variables.add(variable);
        }
      });
    }

    // Match {variable} pattern
    const singleBracketMatches = content.match(/{([^}]+)}/g);
    if (singleBracketMatches) {
      singleBracketMatches.forEach((match) => {
        const variable = match.replaceAll(/{|}/g, '').trim();
        // Only add if it's not already caught by double bracket pattern
        if (variable && !variable.includes('{') && !variable.includes('}')) {
          variables.add(variable);
        }
      });
    }

    // Match $variable pattern
    const dollarMatches = content.match(/\$([A-Z_a-z]\w*)/g);
    if (dollarMatches) {
      dollarMatches.forEach((match) => {
        const variable = match.replace('$', '');
        if (variable) {
          variables.add(variable);
        }
      });
    }

    return [...variables].sort();
  }

  /**
   * Extract tags from Kiro prompt object
   */
  private extractTagsFromPrompt(kiroPrompt: Record<string, unknown>): string[] {
    const tags = new Set<string>();

    // Direct tags property
    if (kiroPrompt.tags && Array.isArray(kiroPrompt.tags)) {
      kiroPrompt.tags.forEach((tag: unknown) => {
        if (typeof tag === 'string') {
          tags.add(tag.toLowerCase().trim());
        }
      });
    }

    // Keywords property
    if (kiroPrompt.keywords && Array.isArray(kiroPrompt.keywords)) {
      kiroPrompt.keywords.forEach((keyword: unknown) => {
        if (typeof keyword === 'string') {
          tags.add(keyword.toLowerCase().trim());
        }
      });
    }

    // Category as tag
    if (kiroPrompt.category && typeof kiroPrompt.category === 'string') {
      tags.add(kiroPrompt.category.toLowerCase().trim());
    }

    // Type as tag
    if (kiroPrompt.type && typeof kiroPrompt.type === 'string') {
      tags.add(kiroPrompt.type.toLowerCase().trim());
    }

    // Generate default tags from name if no explicit tags found
    if (
      tags.size === 0 &&
      kiroPrompt.name &&
      typeof kiroPrompt.name === 'string'
    ) {
      const inferredTags = this.inferTagsFromName(kiroPrompt.name);
      inferredTags.forEach((tag) => tags.add(tag));
    }

    return [...tags];
  }

  /**
   * Extract tags from markdown section data
   */
  private extractTagsFromSection(
    sectionData: Record<string, unknown>,
  ): string[] {
    const tags = new Set<string>();

    if (sectionData.tags && Array.isArray(sectionData.tags)) {
      sectionData.tags.forEach((tag: unknown) => {
        if (typeof tag === 'string') {
          tags.add(tag.toLowerCase().trim());
        }
      });
    }

    if (sectionData.category && typeof sectionData.category === 'string') {
      tags.add(sectionData.category.toLowerCase().trim());
    }

    return [...tags];
  }

  /**
   * Generate unique template ID from section name
   */
  private generateTemplateId(sectionName: string): string {
    const cleanName = sectionName
      .toLowerCase()
      .replaceAll(/[^\da-z]/g, '-')
      .replaceAll(/-+/g, '-');
    const timestamp = Date.now().toString(36);
    return `${cleanName}-${timestamp}`;
  }

  /**
   * Clean template name for display
   */
  private cleanTemplateName(sectionName: string): string {
    return sectionName
      .replaceAll('_', ' ')
      .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase());
  }

  /**
   * Infer category from template name
   */
  private inferCategoryFromName(name: string): string {
    const lowerName = name.toLowerCase();

    // Check for explanation/documentation patterns first (higher priority)
    if (lowerName.includes('explain') || lowerName.includes('help')) {
      return 'documentation';
    }
    if (lowerName.includes('doc') || lowerName.includes('documentation')) {
      return 'documentation';
    }
    if (lowerName.includes('review') || lowerName.includes('feedback')) {
      return 'review';
    }
    if (lowerName.includes('test') || lowerName.includes('qa')) {
      return 'testing';
    }
    if (
      lowerName.includes('code') ||
      lowerName.includes('programming') ||
      lowerName.includes('dev') ||
      lowerName.includes('refactor')
    ) {
      return 'development';
    }

    return 'general';
  }

  /**
   * Generate metadata for prompt templates collection
   */
  private generatePromptMetadata(
    settingsData: SettingsData,
    templateCount: number,
  ): PromptMetadata {
    return {
      source_platform: settingsData.collectionMetadata.sourcePlatform,
      created_at: new Date().toISOString(),
      version: '1.0.0',
      total_templates: templateCount,
    };
  }

  /**
   * Validate template against taptik specification
   */
  private validateTemplate(template: PromptTemplateEntry): boolean {
    try {
      // Basic validation
      if (!template.id || typeof template.id !== 'string') {
        this.logger.warn('Template missing or invalid ID');
        return false;
      }

      if (!template.name || typeof template.name !== 'string') {
        this.logger.warn('Template missing or invalid name');
        return false;
      }

      if (!template.content || typeof template.content !== 'string') {
        this.logger.warn('Template missing or invalid content');
        return false;
      }

      if (!Array.isArray(template.variables)) {
        this.logger.warn('Template variables must be an array');
        return false;
      }

      if (!Array.isArray(template.tags)) {
        this.logger.warn('Template tags must be an array');
        return false;
      }

      // Content length validation
      if (template.content.length < 10) {
        this.logger.warn('Template content too short');
        return false;
      }

      if (template.content.length > 10_000) {
        this.logger.warn('Template content too long');
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Template validation failed', error.message);
      return false;
    }
  }

  /**
   * Create fallback personal context when transformation fails
   */
  private createFallbackPersonalContext(
    settingsData: SettingsData,
    partialData?: Record<string, unknown>,
  ): TaptikPersonalContext {
    this.logger.warn(
      'Creating fallback personal context due to transformation errors',
    );
    const { sourcePlatform } = settingsData.collectionMetadata;

    return {
      user_id: this.generateUserId(settingsData),
      preferences: {
        preferred_languages: (Array.isArray(partialData?.languages)
          ? partialData.languages
          : null) || ['typescript'],
        coding_style: {
          indentation: '2 spaces',
          naming_convention: 'camelCase',
          comment_style: 'minimal',
          code_organization: 'feature-based',
        },
        tools_and_frameworks:
          (Array.isArray(partialData?.tools) ? partialData.tools : null) || [],
        development_environment:
          (Array.isArray(partialData?.environment)
            ? partialData.environment
            : null) || [],
      },
      work_style: {
        preferred_workflow: 'agile',
        problem_solving_approach: 'incremental',
        documentation_level: 'minimal',
        testing_approach: 'unit-first',
      },
      communication: {
        preferred_explanation_style: 'concise',
        technical_depth: 'intermediate',
        feedback_style: 'direct',
      },
      metadata: {
        source_platform: sourcePlatform,
        created_at: new Date().toISOString(),
        version: '1.0.0',
      },
    };
  }

  /**
   * Create fallback project context when transformation fails
   */
  private createFallbackProjectContext(
    settingsData: SettingsData,
    partialData?: Record<string, unknown>,
  ): TaptikProjectContext {
    this.logger.warn(
      'Creating fallback project context due to transformation errors',
    );

    const { projectPath, sourcePlatform } = settingsData.collectionMetadata;
    const projectName = projectPath.split('/').pop() || 'untitled-project';

    return {
      project_id: this.generateProjectId(settingsData),
      project_info: {
        name:
          (typeof partialData?.name === 'string' ? partialData.name : null) ||
          projectName,
        description:
          (typeof partialData?.description === 'string'
            ? partialData.description
            : null) || 'No description available',
        version:
          (typeof partialData?.version === 'string'
            ? partialData.version
            : null) || '1.0.0',
        repository:
          (typeof partialData?.repository === 'string'
            ? partialData.repository
            : null) || '',
      },
      technical_stack: {
        primary_language:
          (typeof partialData?.language === 'string'
            ? partialData.language
            : null) || 'typescript',
        frameworks:
          (Array.isArray(partialData?.frameworks)
            ? partialData.frameworks
            : null) || [],
        databases:
          (Array.isArray(partialData?.databases)
            ? partialData.databases
            : null) || [],
        tools:
          (Array.isArray(partialData?.tools) ? partialData.tools : null) || [],
        deployment:
          (Array.isArray(partialData?.deployment)
            ? partialData.deployment
            : null) || [],
      },
      development_guidelines: {
        coding_standards:
          (Array.isArray(partialData?.standards)
            ? partialData.standards
            : null) || [],
        testing_requirements:
          (Array.isArray(partialData?.testing) ? partialData.testing : null) ||
          [],
        documentation_standards:
          (Array.isArray(partialData?.documentation)
            ? partialData.documentation
            : null) || [],
        review_process:
          (Array.isArray(partialData?.review) ? partialData.review : null) ||
          [],
      },
      metadata: {
        source_platform: sourcePlatform,
        source_path: projectPath,
        created_at: new Date().toISOString(),
        version: '1.0.0',
      },
    };
  }

  /**
   * Create fallback prompt templates when transformation fails
   */
  private createFallbackPromptTemplates(
    settingsData: SettingsData,
    partialData?: Record<string, unknown>,
  ): TaptikPromptTemplates {
    this.logger.warn(
      'Creating fallback prompt templates due to transformation errors',
    );

    const { sourcePlatform } = settingsData.collectionMetadata;
    const fallbackTemplates: PromptTemplateEntry[] = [];

    // Add any partial templates that were successfully processed
    if (partialData?.templates && Array.isArray(partialData.templates)) {
      fallbackTemplates.push(...partialData.templates);
    }

    // Add a basic default template if no templates were recovered
    if (fallbackTemplates.length === 0) {
      fallbackTemplates.push({
        id: 'default-template',
        name: 'Default Template',
        description: 'Default template created due to processing errors',
        content:
          'This is a default template created when original templates could not be processed.',
        category: 'general',
        variables: [],
        tags: ['default', 'fallback'],
      });
    }

    return {
      templates: fallbackTemplates,
      metadata: {
        source_platform: sourcePlatform,
        created_at: new Date().toISOString(),
        version: '1.0.0',
        total_templates: fallbackTemplates.length,
      },
    };
  }

  /**
   * Parse JSON content with enhanced error handling
   */
  private parseJsonWithErrorHandling(
    content: string,
    filePath?: string,
  ): unknown {
    try {
      return JSON.parse(content);
    } catch (error) {
      const errorResult = DataProcessingErrorHandler.handleError(
        error,
        DataProcessingErrorType.JSON_PARSING,
        {
          operation: 'parsing JSON content',
          filePath,
          rawData: content,
        },
      );

      DataProcessingErrorHandler.logErrorResult(errorResult);

      // Try to extract partial data from malformed JSON
      if (errorResult.partialData) {
        return errorResult.partialData;
      }

      // Return empty object as fallback
      return {};
    }
  }

  /**
   * Process array of items with individual error handling
   */
  private processArrayWithErrorHandling<T, R>(
    items: T[],
    processor: (item: T, index: number) => R,
    context: { operation: string; category?: string },
  ): { results: R[]; errors: unknown[] } {
    const results: R[] = [];
    const errors: unknown[] = [];

    for (const [i, item] of items.entries()) {
      try {
        const result = processor(item, i);
        results.push(result);
      } catch (error) {
        const errorResult = DataProcessingErrorHandler.handleError(
          error,
          DataProcessingErrorType.DATA_VALIDATION,
          {
            operation: `${context.operation} (item ${i + 1})`,
            category: context.category,
          },
        );

        errors.push(errorResult);

        // Log but continue processing other items
        DataProcessingErrorHandler.logErrorResult(errorResult);
      }
    }

    return { results, errors };
  }

  /**
   * Generate a template ID from the template name
   */
  private generateTemplateIdFromName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\d\sa-z-]/g, '') // Remove special characters except spaces and hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Infer tags from template name
   */
  private inferTagsFromName(name: string): string[] {
    const tags: string[] = [];
    const lowerName = name.toLowerCase();

    // Add category-based tags
    if (lowerName.includes('explain')) {
      tags.push('explanation', 'documentation');
    }
    if (lowerName.includes('help')) {
      tags.push('help', 'assistance');
    }
    if (lowerName.includes('refactor')) {
      tags.push('refactor', 'development');
    }
    if (lowerName.includes('review')) {
      tags.push('review', 'quality');
    }
    if (lowerName.includes('test')) {
      tags.push('testing', 'quality');
    }
    if (lowerName.includes('debug')) {
      tags.push('debug', 'troubleshooting');
    }
    if (lowerName.includes('code')) {
      tags.push('code');
    }

    return tags;
  }

  /**
   * Transform Claude Code personal context data to Taptik format
   */
  async transformClaudeCodePersonalContext(
    localData: ClaudeCodeLocalSettings,
    globalData: ClaudeCodeGlobalSettings,
  ): Promise<TaptikPersonalContext> {
    return {
      user_id: this.generateUserId({
        collectionMetadata: { sourcePlatform: 'claude-code' },
      } as SettingsData),
      preferences: {
        preferred_languages: this.extractLanguagesFromClaudeCode(
          localData,
          globalData,
        ),
        coding_style: {
          indentation: '2 spaces',
          naming_convention: 'camelCase',
          comment_style: 'minimal',
          code_organization: 'feature-based',
        },
        tools_and_frameworks: this.extractToolsFromClaudeCode(
          localData,
          globalData,
        ),
        development_environment: ['claude-code'],
      },
      work_style: {
        preferred_workflow: 'agile',
        problem_solving_approach: 'incremental',
        documentation_level: 'minimal',
        testing_approach: 'unit-first',
      },
      communication: {
        preferred_explanation_style: 'concise',
        technical_depth: 'intermediate',
        feedback_style: 'direct',
      },
      metadata: {
        source_platform: 'claude-code',
        created_at: new Date().toISOString(),
        version: '1.0.0',
      },
    };
  }

  /**
   * Transform Claude Code project context data to Taptik format
   */
  async transformClaudeCodeProjectContext(
    localData: ClaudeCodeLocalSettings,
    globalData: ClaudeCodeGlobalSettings,
  ): Promise<TaptikProjectContext> {
    const mergedMcp = this.mergeMcpConfigurations(
      localData?.mcpServers,
      globalData?.mcpServers,
    );
    const mergedCommands = this.mergeClaudeCommands(
      localData?.commands,
      globalData?.commands,
    );

    return {
      project_id: `claude-project-${randomUUID().slice(0, 8)}`,
      project_info: {
        name: 'Claude Code Project',
        description: 'Project configured with Claude Code',
        version: '1.0.0',
        repository: '',
      },
      technical_stack: {
        primary_language: 'typescript',
        frameworks: [],
        databases: [],
        tools: [
          ...this.extractMcpTools(mergedMcp),
          ...this.extractCommandTools(mergedCommands),
        ],
        deployment: [],
      },
      development_guidelines: {
        coding_standards: this.extractStandardsFromSteeringRules(
          localData?.steeringRules,
        ),
        testing_requirements: this.extractTestingFromSteeringRules(
          localData?.steeringRules,
        ),
        documentation_standards: [],
        review_process: [],
      },
      metadata: {
        source_platform: 'claude-code',
        source_path: '',
        created_at: new Date().toISOString(),
        version: '1.0.0',
      },
    };
  }

  /**
   * Transform Claude Code prompt templates
   */
  async transformClaudeCodePromptTemplates(
    localData: ClaudeCodeLocalSettings,
    globalData: ClaudeCodeGlobalSettings,
  ): Promise<TaptikPromptTemplates> {
    const templates: PromptTemplateEntry[] = [];

    // Transform agents to templates
    const allAgents = this.mergeClaudeAgents(
      localData?.agents,
      globalData?.agents,
    );
    for (const agent of allAgents) {
      if (agent && agent.name && agent.prompt) {
        templates.push({
          id: agent.id || this.generateTemplateIdFromName(agent.name),
          name: agent.name,
          description:
            typeof agent.description === 'string'
              ? agent.description
              : 'Claude Code Agent',
          category: 'claude-agent',
          content: agent.prompt,
          variables: this.extractVariablesFromContent(agent.prompt || ''),
          tags: ['claude-code', 'agent'],
        });
      }
    }

    // Transform steering rules to templates
    const steeringRules = localData?.steeringRules || [];
    for (const rule of steeringRules) {
      if (rule && rule.rule) {
        templates.push({
          id: this.generateTemplateIdFromName(`steering-${rule.pattern}`),
          name: `Steering Rule: ${rule.pattern}`,
          description: 'Claude Code Steering Rule',
          category: 'steering-rule',
          content: rule.rule,
          variables: [],
          tags: ['claude-code', 'steering'],
        });
      }
    }

    // Transform instructions to template
    const mergedInstructions = this.mergeClaudeInstructions(
      localData?.instructions?.global,
      localData?.instructions?.local,
    );
    if (mergedInstructions) {
      templates.push({
        id: 'claude-instructions',
        name: 'Claude Code Instructions',
        description: 'Merged Claude Code instructions',
        category: 'instructions',
        content: mergedInstructions,
        variables: [],
        tags: ['claude-code', 'instructions'],
      });
    }

    return {
      templates,
      metadata: {
        source_platform: 'claude-code',
        created_at: new Date().toISOString(),
        version: '1.0.0',
        total_templates: templates.length,
      },
    };
  }

  /**
   * Merge MCP configurations with local precedence
   */
  mergeMcpConfigurations(
    localConfig: McpConfig | undefined,
    globalConfig: McpConfig | undefined,
  ): McpConfig {
    if (!localConfig && !globalConfig) {
      return { servers: [] };
    }

    const servers = new Map<string, McpServerConfig>();

    // Add global servers first
    if (globalConfig?.servers) {
      for (const server of globalConfig.servers) {
        if (server?.name) {
          servers.set(server.name, server);
        }
      }
    }

    // Override with local servers
    if (localConfig?.servers) {
      for (const server of localConfig.servers) {
        if (server?.name) {
          servers.set(server.name, server);
        }
      }
    }

    return { servers: Array.from(servers.values()) };
  }

  /**
   * Merge Claude instruction files
   */
  mergeClaudeInstructions(
    globalInstructions: string | undefined,
    localInstructions: string | undefined,
  ): string {
    if (!globalInstructions && !localInstructions) {
      return '';
    }

    if (!globalInstructions) {
      return localInstructions || '';
    }

    if (!localInstructions) {
      return globalInstructions || '';
    }

    return `# Claude Code Instructions

## Global Configuration
${globalInstructions}

## Local Configuration
${localInstructions}`;
  }

  // Helper methods for Claude Code transformations
  private mergeClaudeSettings(
    localSettings: ClaudeCodeSettings | undefined,
    globalSettings: ClaudeCodeSettings | undefined,
  ): ClaudeCodeSettings {
    return { ...globalSettings, ...localSettings } as ClaudeCodeSettings;
  }

  private extractLanguagesFromClaudeCode(
    localData: ClaudeCodeLocalSettings,
    globalData: ClaudeCodeGlobalSettings,
  ): string[] {
    const languages = new Set<string>();

    // Extract from settings - safely handle unknown type
    if (localData?.settings) {
      const langs = (localData.settings as Record<string, unknown>).languages;
      if (Array.isArray(langs)) {
        for (const lang of langs) {
          if (typeof lang === 'string') {
            languages.add(lang);
          }
        }
      }
    }

    if (globalData?.settings) {
      const langs = (globalData.settings as Record<string, unknown>).languages;
      if (Array.isArray(langs)) {
        for (const lang of langs) {
          if (typeof lang === 'string') {
            languages.add(lang);
          }
        }
      }
    }

    return languages.size > 0 ? Array.from(languages) : ['typescript'];
  }

  private extractToolsFromClaudeCode(
    localData: ClaudeCodeLocalSettings,
    globalData: ClaudeCodeGlobalSettings,
  ): string[] {
    const tools = new Set<string>();

    // Extract from settings - safely handle unknown type
    if (localData?.settings) {
      const toolList = (localData.settings as Record<string, unknown>).tools;
      if (Array.isArray(toolList)) {
        for (const tool of toolList) {
          if (typeof tool === 'string') {
            tools.add(tool);
          }
        }
      }
    }

    if (globalData?.settings) {
      const toolList = (globalData.settings as Record<string, unknown>).tools;
      if (Array.isArray(toolList)) {
        for (const tool of toolList) {
          if (typeof tool === 'string') {
            tools.add(tool);
          }
        }
      }
    }

    return Array.from(tools);
  }

  private extractAiPreferencesFromAgents(
    agents: ClaudeAgent[] | undefined,
  ): string[] {
    if (!agents || !Array.isArray(agents)) {
      return [];
    }

    return agents
      .filter((agent) => agent && agent.name)
      .map((agent) => agent.name);
  }

  private mergeClaudeAgents(
    localAgents: ClaudeAgent[] | undefined,
    globalAgents: ClaudeAgent[] | undefined,
  ): ClaudeAgent[] {
    const agents = new Map<string, ClaudeAgent>();

    // Add global agents first
    if (globalAgents && Array.isArray(globalAgents)) {
      for (const agent of globalAgents) {
        if (agent?.id) {
          agents.set(agent.id, agent);
        }
      }
    }

    // Override with local agents
    if (localAgents && Array.isArray(localAgents)) {
      for (const agent of localAgents) {
        if (agent?.id) {
          agents.set(agent.id, agent);
        }
      }
    }

    return Array.from(agents.values());
  }

  private mergeClaudeCommands(
    localCommands: ClaudeCommand[] | undefined,
    globalCommands: ClaudeCommand[] | undefined,
  ): ClaudeCommand[] {
    const commands = new Map<string, ClaudeCommand>();

    // Add global commands first
    if (globalCommands && Array.isArray(globalCommands)) {
      for (const command of globalCommands) {
        if (command?.name) {
          commands.set(command.name, command);
        }
      }
    }

    // Override with local commands
    if (localCommands && Array.isArray(localCommands)) {
      for (const command of localCommands) {
        if (command?.name) {
          commands.set(command.name, command);
        }
      }
    }

    return Array.from(commands.values());
  }

  private extractMcpTools(mcpConfig: McpConfig): string[] {
    if (!mcpConfig?.servers || !Array.isArray(mcpConfig.servers)) {
      return [];
    }

    return mcpConfig.servers
      .filter((server) => {
        const serverWithDisabled = server as McpServerConfig & {
          disabled?: boolean;
        };
        return server && server.name && !serverWithDisabled.disabled;
      })
      .map(
        (server) =>
          `${server.name}: ${server.command || server.url || 'configured'}`,
      );
  }

  private extractCommandTools(commands: ClaudeCommand[]): string[] {
    if (!commands || !Array.isArray(commands)) {
      return [];
    }

    return commands
      .filter((cmd) => cmd && cmd.name && cmd.command)
      .map((cmd) => `${cmd.name}: ${cmd.command}`);
  }

  private extractStandardsFromSteeringRules(
    steeringRules: SteeringRule[] | undefined,
  ): string[] {
    if (!steeringRules || !Array.isArray(steeringRules)) {
      return [];
    }

    return steeringRules
      .filter((rule) => rule && rule.rule)
      .filter(
        (rule) =>
          rule.rule.toLowerCase().includes('standard') ||
          rule.rule.toLowerCase().includes('convention') ||
          rule.rule.toLowerCase().includes('style'),
      )
      .map((rule) => rule.rule);
  }

  private extractTestingFromSteeringRules(
    steeringRules: SteeringRule[] | undefined,
  ): string[] {
    if (!steeringRules || !Array.isArray(steeringRules)) {
      return [];
    }

    return steeringRules
      .filter((rule) => rule && rule.rule)
      .filter(
        (rule) =>
          rule.rule.toLowerCase().includes('test') ||
          rule.rule.toLowerCase().includes('tdd') ||
          rule.rule.toLowerCase().includes('coverage'),
      )
      .map((rule) => rule.rule);
  }
}
