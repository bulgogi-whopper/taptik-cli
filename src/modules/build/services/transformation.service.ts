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
}