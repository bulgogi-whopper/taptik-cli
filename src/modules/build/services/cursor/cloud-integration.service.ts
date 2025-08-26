import { Injectable } from '@nestjs/common';

import { SupabaseService } from 'src/modules/supabase/supabase.service';

import { CursorValidationService } from '../cursor-validation.service';

import { CursorPrivacyMetadataService } from './privacy-metadata.service';

export interface CursorCloudMetadata {
  platform: 'cursor-ide';
  version: string;
  compatibility: {
    vsCode: boolean;
    vscodeVersion?: string;
    cursorFeatures: string[];
  };
  features: {
    ai: boolean;
    extensions: number;
    snippets: number;
    themes: string[];
    languages: string[];
  };
  tags: string[];
  categories: string[];
  searchTerms: string[];
}

@Injectable()
export class CursorCloudIntegrationService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly validationService: CursorValidationService,
    private readonly privacyService: CursorPrivacyMetadataService,
  ) {}

  async prepareCursorMetadata(
    cursorData: any,
    options: {
      includeCompatibility?: boolean;
      generateTags?: boolean;
      privacyLevel?: 'minimal' | 'standard' | 'full';
    } = {},
  ): Promise<CursorCloudMetadata> {
    const { includeCompatibility = true, generateTags = true, privacyLevel = 'standard' } = options;

    // Generate privacy-preserving metadata
    const _anonymizedData = this.privacyService?.generateAnonymizedMetadata?.(cursorData) || cursorData;

    // Check VS Code compatibility
    let compatibility: CursorCloudMetadata['compatibility'] = {
      vsCode: false,
      cursorFeatures: [],
    };

    if (includeCompatibility && this.validationService) {
      const compatReport = await this.validationService.generateComprehensiveCompatibilityReport(cursorData);
      compatibility = {
        vsCode: compatReport.report.vsCodeCompatible,
        vscodeVersion: '1.80.0', // Default supported version
        cursorFeatures: this.extractCursorFeatures(cursorData),
      };
    }

    // Extract features
    const features = this.extractFeatures(cursorData, privacyLevel);

    // Generate tags and categories
    const tags = generateTags ? this.generateTags(cursorData) : [];
    const categories = this.categorizeConfiguration(cursorData);
    const searchTerms = this.generateSearchTerms(cursorData, features);

    return {
      platform: 'cursor-ide',
      version: cursorData.version || '1.0.0',
      compatibility,
      features,
      tags,
      categories,
      searchTerms,
    };
  }

  private extractCursorFeatures(data: any): string[] {
    const features: string[] = [];

    if (data.aiConfiguration?.enabled) {
      features.push('ai-powered');
      if (data.aiConfiguration.defaultModel) {
        features.push(`ai-model-${data.aiConfiguration.defaultModel}`);
      }
    }

    if (data.settings?.['cursor.aiProvider']) {
      features.push('custom-ai-provider');
    }

    if (data.settings?.['cursor.copilotEnabled']) {
      features.push('copilot-integration');
    }

    if (data.extensions?.some((e: any) => e.id?.includes('cursor'))) {
      features.push('cursor-extensions');
    }

    return features;
  }

  private extractFeatures(data: any, privacyLevel: string): CursorCloudMetadata['features'] {
    const features: CursorCloudMetadata['features'] = {
      ai: false,
      extensions: 0,
      snippets: 0,
      themes: [],
      languages: [],
    };

    // AI features
    features.ai = !!(data.aiConfiguration?.enabled || data.settings?.['cursor.aiProvider']);

    // Extensions count
    features.extensions = data.extensions?.length || 0;

    // Snippets count
    if (data.snippets) {
      let snippetCount = 0;
      for (const lang of Object.values(data.snippets)) {
        if (lang && typeof lang === 'object') {
          const langObj = lang as Record<string, unknown>;
          snippetCount += Object.keys(langObj).length;
        }
      }
      features.snippets = snippetCount;
      features.languages = Object.keys(data.snippets);
    }

    // Themes (only if privacy allows)
    if (privacyLevel !== 'minimal' && data.settings?.workbench?.colorTheme) {
      features.themes = [data.settings.workbench.colorTheme];
    }

    return features;
  }

  private generateTags(data: any): string[] {
    const tags = new Set<string>();

    // Platform tags
    tags.add('cursor-ide');
    tags.add('ide-config');

    // AI tags
    if (data.aiConfiguration?.enabled) {
      tags.add('ai-enabled');
      tags.add('llm-integration');
      
      if (data.aiConfiguration.defaultModel) {
        const model = data.aiConfiguration.defaultModel.toLowerCase();
        if (model.includes('gpt')) tags.add('openai');
        if (model.includes('claude')) tags.add('anthropic');
        if (model.includes('llama')) tags.add('meta');
      }
    }

    // Language tags
    if (data.snippets) {
      Object.keys(data.snippets).forEach(lang => {
        tags.add(lang.toLowerCase());
      });
    }

    // Extension-based tags
    if (data.extensions?.length > 0) {
      const extTags = this.extractExtensionTags(data.extensions);
      extTags.forEach(tag => tags.add(tag));
    }

    // Theme tags
    if (data.settings?.workbench?.colorTheme) {
      const theme = data.settings.workbench.colorTheme.toLowerCase();
      if (theme.includes('dark')) tags.add('dark-theme');
      if (theme.includes('light')) tags.add('light-theme');
    }

    return Array.from(tags);
  }

  private extractExtensionTags(extensions: any[]): string[] {
    const tags = new Set<string>();
    const techKeywords = {
      react: ['react', 'jsx'],
      vue: ['vue'],
      angular: ['angular'],
      svelte: ['svelte'],
      python: ['python', 'jupyter'],
      rust: ['rust'],
      go: ['go', 'golang'],
      docker: ['docker', 'container'],
      kubernetes: ['k8s', 'kubernetes'],
      aws: ['aws', 'amazon'],
      azure: ['azure', 'microsoft'],
      gcp: ['gcp', 'google-cloud'],
    };

    extensions.forEach(ext => {
      const id = (ext.id || '').toLowerCase();
      const name = (ext.name || '').toLowerCase();
      const combined = `${id} ${name}`;

      for (const [tag, keywords] of Object.entries(techKeywords)) {
        if (keywords.some(kw => combined.includes(kw))) {
          tags.add(tag);
        }
      }
    });

    return Array.from(tags);
  }

  private categorizeConfiguration(data: any): string[] {
    const categories: string[] = [];

    // Development category
    if (data.extensions?.length > 5 || data.snippets) {
      categories.push('development');
    }

    // AI/ML category
    if (data.aiConfiguration?.enabled) {
      categories.push('ai-ml');
    }

    // Web development
    const webExtensions = ['html', 'css', 'javascript', 'typescript', 'react', 'vue', 'angular'];
    if (data.snippets && webExtensions.some(lang => lang in data.snippets)) {
      categories.push('web-development');
    }

    // Data science
    if (data.snippets?.python || data.snippets?.r || data.snippets?.julia) {
      categories.push('data-science');
    }

    // DevOps
    if (data.snippets?.yaml || data.snippets?.dockerfile || data.extensions?.some((e: any) => 
      e.id?.toLowerCase().includes('docker') || e.id?.toLowerCase().includes('kubernetes')
    )) {
      categories.push('devops');
    }

    return categories.length > 0 ? categories : ['general'];
  }

  private generateSearchTerms(data: any, features: CursorCloudMetadata['features']): string[] {
    const terms = new Set<string>();

    // Add platform terms
    terms.add('cursor');
    terms.add('cursor-ide');
    terms.add('ide');
    terms.add('configuration');

    // Add AI terms if applicable
    if (features.ai) {
      terms.add('ai');
      terms.add('artificial-intelligence');
      terms.add('llm');
      terms.add('copilot');
    }

    // Add language terms
    features.languages.forEach(lang => {
      terms.add(lang.toLowerCase());
      terms.add(`${lang.toLowerCase()}-development`);
    });

    // Add feature-based terms
    if (features.extensions > 10) {
      terms.add('full-stack');
      terms.add('professional');
    }

    if (features.themes.some(t => t.toLowerCase().includes('dark'))) {
      terms.add('dark-mode');
    }

    return Array.from(terms);
  }

  async addSupabaseMetadata(
    packageData: any,
    cursorMetadata: CursorCloudMetadata,
  ): Promise<any> {
    return {
      ...packageData,
      metadata: {
        ...packageData.metadata,
        cursor: cursorMetadata,
        searchable: {
          tags: cursorMetadata.tags,
          categories: cursorMetadata.categories,
          terms: cursorMetadata.searchTerms,
          platform: 'cursor-ide',
          hasAi: cursorMetadata.features.ai,
          extensionCount: cursorMetadata.features.extensions,
          languages: cursorMetadata.features.languages,
        },
      },
    };
  }

  validateCloudReadiness(data: any): {
    ready: boolean;
    issues: string[];
    warnings: string[];
  } {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check for sensitive data
    if (this.privacyService && !this.privacyService.validatePrivacyCompliance(data)) {
      issues.push('Configuration contains potentially sensitive information');
    }

    // Check size constraints
    const dataSize = JSON.stringify(data).length;
    if (dataSize > 10 * 1024 * 1024) { // 10MB limit
      issues.push('Configuration exceeds maximum size limit (10MB)');
    }

    // Check required fields
    if (!data.platform || data.platform !== 'cursor-ide') {
      warnings.push('Missing or invalid platform identifier');
    }

    if (!data.version) {
      warnings.push('Missing version information');
    }

    // Check for minimal content
    if (!data.settings && !data.extensions && !data.snippets) {
      issues.push('Configuration contains no meaningful content');
    }

    return {
      ready: issues.length === 0,
      issues,
      warnings,
    };
  }
}