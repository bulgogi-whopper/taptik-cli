import { Injectable, Logger } from '@nestjs/common';
import { SettingsData } from '../interfaces/settings-data.interface';
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
import { randomUUID } from 'crypto';

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
  async transformPersonalContext(settingsData: SettingsData): Promise<TaptikPersonalContext> {
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
        communication: communication,
        metadata: metadata,
      };

      this.logger.log('Personal context transformation completed successfully');
      return personalContext;
    } catch (error) {
      this.logger.error('Failed to transform personal context', error.stack);
      throw new Error(`Personal context transformation failed: ${error.message}`);
    }
  }

  /**
   * Transform project context data from Kiro format to Taptik format
   * @param settingsData Raw settings data collected from Kiro
   * @returns Transformed project context in Taptik format
   */
  async transformProjectContext(settingsData: SettingsData): Promise<TaptikProjectContext> {
    try {
      this.logger.log('Starting project context transformation');

      const projectInfo = await this.extractProjectInfo(settingsData);
      const technicalStack = await this.extractTechnicalStack(settingsData);
      const developmentGuidelines = await this.extractDevelopmentGuidelines(settingsData);
      const metadata = this.generateProjectMetadata(settingsData);

      const projectContext: TaptikProjectContext = {
        project_id: this.generateProjectId(settingsData),
        project_info: projectInfo,
        technical_stack: technicalStack,
        development_guidelines: developmentGuidelines,
        metadata: metadata,
      };

      this.logger.log('Project context transformation completed successfully');
      return projectContext;
    } catch (error) {
      this.logger.error('Failed to transform project context', error.stack);
      throw new Error(`Project context transformation failed: ${error.message}`);
    }
  }

  /**
   * Extract user preferences from Kiro settings
   */
  private async extractUserPreferences(settingsData: SettingsData): Promise<UserPreferences> {
    const globalPreferences = this.parseKiroPreferences(settingsData.globalSettings.preferences);
    const localPreferences = this.parseKiroPreferences(settingsData.localSettings.userPreferencesMd);

    return {
      preferred_languages: this.extractPreferredLanguages(globalPreferences, localPreferences),
      coding_style: this.extractCodingStyle(globalPreferences, localPreferences),
      tools_and_frameworks: this.extractToolsAndFrameworks(globalPreferences, localPreferences),
      development_environment: this.extractDevelopmentEnvironment(globalPreferences, localPreferences),
    };
  }

  /**
   * Extract work style preferences from Kiro settings
   */
  private async extractWorkStyle(settingsData: SettingsData): Promise<WorkStyle> {
    const globalConfig = this.parseKiroConfig(settingsData.globalSettings.userConfig);
    const projectSpec = this.parseKiroConfig(settingsData.localSettings.projectSpecMd);

    return {
      preferred_workflow: this.extractWorkflow(globalConfig, projectSpec),
      problem_solving_approach: this.extractProblemSolvingApproach(globalConfig, projectSpec),
      documentation_level: this.extractDocumentationLevel(globalConfig, projectSpec),
      testing_approach: this.extractTestingApproach(globalConfig, projectSpec),
    };
  }

  /**
   * Extract communication preferences from Kiro settings
   */
  private async extractCommunication(settingsData: SettingsData): Promise<Communication> {
    const globalConfig = this.parseKiroConfig(settingsData.globalSettings.userConfig);
    const preferences = this.parseKiroPreferences(settingsData.globalSettings.preferences);

    return {
      preferred_explanation_style: this.extractExplanationStyle(globalConfig, preferences),
      technical_depth: this.extractTechnicalDepth(globalConfig, preferences),
      feedback_style: this.extractFeedbackStyle(globalConfig, preferences),
    };
  }

  /**
   * Generate metadata for personal context
   */
  private generatePersonalMetadata(settingsData: SettingsData): PersonalMetadata {
    return {
      source_platform: settingsData.collectionMetadata.sourcePlatform,
      created_at: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  /**
   * Generate unique user ID based on settings data
   */
  private generateUserId(settingsData: SettingsData): string {
    return randomUUID();
  }

  /**
   * Parse Kiro preferences markdown content into structured data
   */
  private parseKiroPreferences(content?: string): Record<string, any> {
    if (!content) return {};

    try {
      const parsed: Record<string, any> = {};
      
      const lines = content.split('\n');
      let currentSection = 'root';
      let currentSubSection = '';
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('#')) {
          currentSection = trimmedLine.replace(/^#+\s*/, '').toLowerCase().replace(/\s+/g, '_');
          if (!parsed[currentSection]) {
            parsed[currentSection] = {};
          }
          currentSubSection = '';
        } else if (trimmedLine.includes(':')) {
          const colonIndex = trimmedLine.indexOf(':');
          const key = trimmedLine.substring(0, colonIndex).trim();
          const value = trimmedLine.substring(colonIndex + 1).trim();
          
          const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
          
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
            const arrayValue = value.split(',').map(v => v.trim());
            if (currentSubSection) {
              parsed[currentSection][currentSubSection][normalizedKey] = arrayValue;
            } else if (currentSection && currentSection !== 'root') {
              parsed[currentSection][normalizedKey] = arrayValue;
            } else {
              parsed[normalizedKey] = arrayValue;
            }
          }
        } else if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
          const value = trimmedLine.replace(/^[-*]\s*/, '');
          const arrayKey = currentSubSection || 'items';
          
          if (!parsed[currentSection][arrayKey]) {
            parsed[currentSection][arrayKey] = [];
          }
          if (Array.isArray(parsed[currentSection][arrayKey])) {
            parsed[currentSection][arrayKey].push(value);
          }
        } else if (trimmedLine && !trimmedLine.startsWith('#') && currentSection !== 'root') {
          if (trimmedLine.endsWith(':')) {
            currentSubSection = trimmedLine.replace(':', '').trim().toLowerCase().replace(/\s+/g, '_');
            if (!parsed[currentSection][currentSubSection]) {
              parsed[currentSection][currentSubSection] = {};
            }
          }
        }
      }

      return parsed;
    } catch (error) {
      this.logger.warn('Failed to parse Kiro preferences, using defaults', error.message);
      return {};
    }
  }

  /**
   * Parse Kiro configuration content
   */
  private parseKiroConfig(content?: string): Record<string, any> {
    return this.parseKiroPreferences(content);
  }

  /**
   * Extract preferred programming languages
   */
  private extractPreferredLanguages(globalPrefs: Record<string, any>, localPrefs: Record<string, any>): string[] {
    const languages = new Set<string>();

    // Try different possible locations for languages
    const globalLanguages = this.extractArrayFromParsedData(globalPrefs, ['languages', 'preferred_languages']);
    const localLanguages = this.extractArrayFromParsedData(localPrefs, ['languages', 'preferred_languages']);

    globalLanguages.forEach(lang => languages.add(lang));
    localLanguages.forEach(lang => languages.add(lang));

    if (languages.size === 0) {
      languages.add('typescript');
    }

    return Array.from(languages);
  }

  /**
   * Helper method to extract arrays from parsed markdown data
   */
  private extractArrayFromParsedData(data: Record<string, any>, keys: string[]): string[] {
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
              result.push(...value.split(',').map(v => v.trim()));
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
  private extractCodingStyle(globalPrefs: Record<string, any>, localPrefs: Record<string, any>): CodingStyle {
    const style = {
      ...globalPrefs?.coding_style,
      ...localPrefs?.coding_style,
    };

    return {
      indentation: style?.indentation || '2 spaces',
      naming_convention: style?.naming_convention || 'camelCase',
      comment_style: style?.comment_style || 'minimal',
      code_organization: style?.code_organization || 'feature-based',
    };
  }

  /**
   * Extract tools and frameworks preferences
   */
  private extractToolsAndFrameworks(globalPrefs: Record<string, any>, localPrefs: Record<string, any>): string[] {
    const tools = new Set<string>();

    const globalTools = this.extractArrayFromParsedData(globalPrefs, ['tools', 'frameworks']);
    const localTools = this.extractArrayFromParsedData(localPrefs, ['tools', 'frameworks']);

    globalTools.forEach(tool => tools.add(tool));
    localTools.forEach(tool => tools.add(tool));

    return Array.from(tools);
  }

  /**
   * Extract development environment preferences
   */
  private extractDevelopmentEnvironment(globalPrefs: Record<string, any>, localPrefs: Record<string, any>): string[] {
    const envs = new Set<string>();

    const globalEnvs = this.extractArrayFromParsedData(globalPrefs, ['environment', 'dev_environment']);
    const localEnvs = this.extractArrayFromParsedData(localPrefs, ['environment', 'dev_environment']);

    globalEnvs.forEach(env => envs.add(env));
    localEnvs.forEach(env => envs.add(env));

    return Array.from(envs);
  }

  /**
   * Extract workflow preferences
   */
  private extractWorkflow(globalConfig: Record<string, any>, projectSpec: Record<string, any>): string {
    return projectSpec?.workflow || globalConfig?.workflow || 'agile';
  }

  /**
   * Extract problem solving approach
   */
  private extractProblemSolvingApproach(globalConfig: Record<string, any>, projectSpec: Record<string, any>): string {
    return globalConfig?.problem_solving || projectSpec?.problem_solving || 'incremental';
  }

  /**
   * Extract documentation level preference
   */
  private extractDocumentationLevel(globalConfig: Record<string, any>, projectSpec: Record<string, any>): string {
    return projectSpec?.documentation || globalConfig?.documentation || 'minimal';
  }

  /**
   * Extract testing approach preference
   */
  private extractTestingApproach(globalConfig: Record<string, any>, projectSpec: Record<string, any>): string {
    return projectSpec?.testing || globalConfig?.testing || 'unit-first';
  }

  /**
   * Helper method to extract string values from parsed data
   */
  private extractStringFromParsedData(data: Record<string, any>, keys: string[], defaultValue: string): string {
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
  private extractExplanationStyle(globalConfig: Record<string, any>, preferences: Record<string, any>): string {
    const globalValue = this.extractStringFromParsedData(globalConfig, ['explanation_style'], '');
    const prefValue = this.extractStringFromParsedData(preferences, ['explanation_style'], '');
    return prefValue || globalValue || 'concise';
  }

  /**
   * Extract technical depth preference
   */
  private extractTechnicalDepth(globalConfig: Record<string, any>, preferences: Record<string, any>): string {
    const globalValue = this.extractStringFromParsedData(globalConfig, ['technical_depth'], '');
    const prefValue = this.extractStringFromParsedData(preferences, ['technical_depth'], '');
    return prefValue || globalValue || 'intermediate';
  }

  /**
   * Extract feedback style preference
   */
  private extractFeedbackStyle(globalConfig: Record<string, any>, preferences: Record<string, any>): string {
    const globalValue = this.extractStringFromParsedData(globalConfig, ['feedback_style'], '');
    const prefValue = this.extractStringFromParsedData(preferences, ['feedback_style'], '');
    return prefValue || globalValue || 'direct';
  }

  /**
   * Extract project information from Kiro settings
   */
  private async extractProjectInfo(settingsData: SettingsData): Promise<ProjectInfo> {
    const contextData = this.parseKiroConfig(settingsData.localSettings.contextMd);
    const projectSpecData = this.parseKiroConfig(settingsData.localSettings.projectSpecMd);

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
  private async extractTechnicalStack(settingsData: SettingsData): Promise<TechnicalStack> {
    const contextData = this.parseKiroConfig(settingsData.localSettings.contextMd);
    const projectSpecData = this.parseKiroConfig(settingsData.localSettings.projectSpecMd);
    const userPrefs = this.parseKiroPreferences(settingsData.localSettings.userPreferencesMd);

    return {
      primary_language: this.extractPrimaryLanguage(contextData, projectSpecData, userPrefs),
      frameworks: this.extractFrameworks(contextData, projectSpecData, userPrefs),
      databases: this.extractDatabases(contextData, projectSpecData),
      tools: this.extractProjectTools(contextData, projectSpecData, userPrefs),
      deployment: this.extractDeployment(contextData, projectSpecData),
    };
  }

  /**
   * Extract development guidelines from Kiro settings
   */
  private async extractDevelopmentGuidelines(settingsData: SettingsData): Promise<DevelopmentGuidelines> {
    const steeringRules = this.extractSteeringRules(settingsData.localSettings.steeringFiles);
    const projectSpecData = this.parseKiroConfig(settingsData.localSettings.projectSpecMd);
    const hooks = settingsData.localSettings.hooks;

    return {
      coding_standards: this.extractCodingStandards(steeringRules, projectSpecData),
      testing_requirements: this.extractTestingRequirements(steeringRules, projectSpecData),
      documentation_standards: this.extractDocumentationStandards(steeringRules, projectSpecData),
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
    const projectPath = settingsData.collectionMetadata.projectPath;
    const projectName = projectPath.split('/').pop() || 'unknown-project';
    return `${projectName}-${randomUUID().substring(0, 8)}`;
  }

  /**
   * Extract project name from various sources
   */
  private extractProjectName(contextData: Record<string, any>, projectSpecData: Record<string, any>, settingsData: SettingsData): string {
    const projectName = this.extractStringFromParsedData(contextData, ['name', 'project_name', 'title'], '') ||
                       this.extractStringFromParsedData(projectSpecData, ['name', 'project_name', 'title'], '');

    if (projectName) {
      return projectName;
    }

    // Fallback to directory name
    const projectPath = settingsData.collectionMetadata.projectPath;
    return projectPath.split('/').pop() || 'untitled-project';
  }

  /**
   * Extract project description
   */
  private extractProjectDescription(contextData: Record<string, any>, projectSpecData: Record<string, any>): string {
    return this.extractStringFromParsedData(contextData, ['description', 'summary', 'about'], '') ||
           this.extractStringFromParsedData(projectSpecData, ['description', 'summary', 'about'], '') ||
           'No description available';
  }

  /**
   * Extract project version
   */
  private extractProjectVersion(contextData: Record<string, any>, projectSpecData: Record<string, any>): string {
    return this.extractStringFromParsedData(contextData, ['version'], '') ||
           this.extractStringFromParsedData(projectSpecData, ['version'], '') ||
           '1.0.0';
  }

  /**
   * Extract project repository information
   */
  private extractProjectRepository(contextData: Record<string, any>, projectSpecData: Record<string, any>): string {
    return this.extractStringFromParsedData(contextData, ['repository', 'repo', 'git_url'], '') ||
           this.extractStringFromParsedData(projectSpecData, ['repository', 'repo', 'git_url'], '') ||
           '';
  }

  /**
   * Extract primary programming language
   */
  private extractPrimaryLanguage(contextData: Record<string, any>, projectSpecData: Record<string, any>, userPrefs: Record<string, any>): string {
    const languages = [
      ...this.extractArrayFromParsedData(contextData, ['language', 'primary_language', 'main_language']),
      ...this.extractArrayFromParsedData(projectSpecData, ['language', 'primary_language', 'main_language']),
      ...this.extractArrayFromParsedData(userPrefs, ['languages', 'preferred_languages']),
    ];

    return languages[0] || 'typescript';
  }

  /**
   * Extract frameworks from project settings
   */
  private extractFrameworks(contextData: Record<string, any>, projectSpecData: Record<string, any>, userPrefs: Record<string, any>): string[] {
    const frameworks = new Set<string>();

    const contextFrameworks = this.extractArrayFromParsedData(contextData, ['frameworks', 'framework', 'libraries']);
    const specFrameworks = this.extractArrayFromParsedData(projectSpecData, ['frameworks', 'framework', 'libraries']);
    const prefFrameworks = this.extractArrayFromParsedData(userPrefs, ['frameworks', 'tools']);

    [...contextFrameworks, ...specFrameworks, ...prefFrameworks].forEach(fw => frameworks.add(fw));

    return Array.from(frameworks);
  }

  /**
   * Extract databases from project settings
   */
  private extractDatabases(contextData: Record<string, any>, projectSpecData: Record<string, any>): string[] {
    const databases = new Set<string>();

    const contextDbs = this.extractArrayFromParsedData(contextData, ['databases', 'database', 'db']);
    const specDbs = this.extractArrayFromParsedData(projectSpecData, ['databases', 'database', 'db']);

    [...contextDbs, ...specDbs].forEach(db => databases.add(db));

    return Array.from(databases);
  }

  /**
   * Extract project tools
   */
  private extractProjectTools(contextData: Record<string, any>, projectSpecData: Record<string, any>, userPrefs: Record<string, any>): string[] {
    const tools = new Set<string>();

    const contextTools = this.extractArrayFromParsedData(contextData, ['tools', 'build_tools', 'dev_tools']);
    const specTools = this.extractArrayFromParsedData(projectSpecData, ['tools', 'build_tools', 'dev_tools']);
    const prefTools = this.extractArrayFromParsedData(userPrefs, ['tools', 'development_tools']);

    [...contextTools, ...specTools, ...prefTools].forEach(tool => tools.add(tool));

    return Array.from(tools);
  }

  /**
   * Extract deployment information
   */
  private extractDeployment(contextData: Record<string, any>, projectSpecData: Record<string, any>): string[] {
    const deployment = new Set<string>();

    const contextDeploy = this.extractArrayFromParsedData(contextData, ['deployment', 'deploy', 'hosting']);
    const specDeploy = this.extractArrayFromParsedData(projectSpecData, ['deployment', 'deploy', 'hosting']);

    [...contextDeploy, ...specDeploy].forEach(dep => deployment.add(dep));

    return Array.from(deployment);
  }

  /**
   * Extract steering rules from steering files
   */
  private extractSteeringRules(steeringFiles: any[]): string[] {
    if (!Array.isArray(steeringFiles)) {
      return [];
    }

    return steeringFiles.map(file => {
      if (typeof file === 'object' && file.content) {
        return file.content.trim();
      }
      return '';
    }).filter(content => content.length > 0);
  }

  /**
   * Extract coding standards from steering rules and project spec
   */
  private extractCodingStandards(steeringRules: string[], projectSpecData: Record<string, any>): string[] {
    const standards = new Set<string>();

    // Extract from steering files
    steeringRules.forEach(rule => {
      if (rule.toLowerCase().includes('standard') || rule.toLowerCase().includes('convention')) {
        standards.add(rule);
      }
    });

    // Extract from project spec
    const specStandards = this.extractArrayFromParsedData(projectSpecData, ['coding_standards', 'standards', 'conventions']);
    specStandards.forEach(std => standards.add(std));

    return Array.from(standards);
  }

  /**
   * Extract testing requirements
   */
  private extractTestingRequirements(steeringRules: string[], projectSpecData: Record<string, any>): string[] {
    const requirements = new Set<string>();

    // Extract from steering files
    steeringRules.forEach(rule => {
      if (rule.toLowerCase().includes('test') || rule.toLowerCase().includes('coverage')) {
        requirements.add(rule);
      }
    });

    // Extract from project spec
    const specTests = this.extractArrayFromParsedData(projectSpecData, ['testing', 'test_requirements', 'coverage']);
    specTests.forEach(req => requirements.add(req));

    return Array.from(requirements);
  }

  /**
   * Extract documentation standards
   */
  private extractDocumentationStandards(steeringRules: string[], projectSpecData: Record<string, any>): string[] {
    const standards = new Set<string>();

    // Extract from steering files
    steeringRules.forEach(rule => {
      if (rule.toLowerCase().includes('documentation') || rule.toLowerCase().includes('comment')) {
        standards.add(rule);
      }
    });

    // Extract from project spec
    const specDocs = this.extractArrayFromParsedData(projectSpecData, ['documentation', 'docs', 'comments']);
    specDocs.forEach(doc => standards.add(doc));

    return Array.from(standards);
  }

  /**
   * Extract review process guidelines
   */
  private extractReviewProcess(steeringRules: string[], hooks: any[]): string[] {
    const process = new Set<string>();

    // Extract from steering files
    steeringRules.forEach(rule => {
      if (rule.toLowerCase().includes('review') || rule.toLowerCase().includes('approval')) {
        process.add(rule);
      }
    });

    // Extract from hooks - check if hooks contain review-related content
    if (Array.isArray(hooks)) {
      hooks.forEach(hook => {
        if (typeof hook === 'object' && hook.content) {
          const content = hook.content.toLowerCase();
          if (content.includes('review') || content.includes('lint') || content.includes('check') || content.includes('validate') || content.includes('commit')) {
            process.add(`Hook-based: ${hook.content.trim()}`);
          }
        }
      });
    }

    return Array.from(process);
  }

  /**
   * Extract hook guidelines from hook files
   */
  private extractHookGuidelines(hooks: any[]): string[] {
    if (!Array.isArray(hooks)) {
      return [];
    }

    return hooks.map(hook => {
      if (typeof hook === 'object' && hook.content && hook.filename) {
        return `${hook.filename}: ${hook.content.trim()}`;
      }
      return '';
    }).filter(content => content.length > 0);
  }
}