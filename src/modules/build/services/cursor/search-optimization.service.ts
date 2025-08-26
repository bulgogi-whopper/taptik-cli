import { Injectable } from '@nestjs/common';

import {
  SearchMetadata,
  DeploymentMetadata,
} from '../../interfaces/build-types.interface';
import { CursorSettingsData } from '../../interfaces/cursor-ide.interfaces';

@Injectable()
export class CursorSearchOptimizationService {
  generateSearchMetadata(cursorData: CursorSettingsData): SearchMetadata {
    const tags = this.extractTags(cursorData);
    const categories = this.categorizeConfig(cursorData);
    const keywords = this.extractKeywords(cursorData);
    const technologies = this.detectTechnologies(cursorData);
    
    return {
      title: this.generateTitle(cursorData),
      description: this.generateDescription(cursorData),
      tags,
      categories,
      keywords,
      technologies,
      difficulty: this.assessDifficulty(cursorData),
      primaryLanguage: this.detectPrimaryLanguage(cursorData),
      popularity: 0,
    };
  }

  generateDeploymentMetadata(cursorData: CursorSettingsData & { vsCodeCompatible?: boolean }): DeploymentMetadata {
    return {
      targetPlatforms: ['cursor-ide', 'vscode', 'vscode-insiders'],
      compatibility: [
        { platform: 'cursor-ide', version: '1.0.0', supported: true },
        { platform: 'vscode', version: '1.85.0', supported: cursorData.vsCodeCompatible || false },
      ],
      requirements: {
        minVersion: '1.0.0',
        extensions: cursorData.extensions?.recommendations || [],
        features: this.extractRequiredFeatures(cursorData),
      },
    };
  }

  private generateTitle(data: CursorSettingsData & { aiConfiguration?: { enabled: boolean } }): string {
    const parts = [];
    
    if (data.aiConfiguration?.enabled) {
      parts.push('AI-Powered');
    }
    
    const mainLang = this.detectPrimaryLanguage(data);
    if (mainLang) {
      parts.push(mainLang);
    }
    
    parts.push('Development Setup');
    
    return parts.join(' ');
  }

  private generateDescription(data: CursorSettingsData & { aiConfiguration?: { enabled: boolean } }): string {
    const features = [];
    
    if (data.aiConfiguration?.enabled) {
      features.push('AI assistance');
    }
    
    if (data.extensions?.recommendations && data.extensions.recommendations.length > 0) {
      features.push(`${data.extensions.recommendations.length} extensions`);
    }
    
    if (data.snippets && Object.keys(data.snippets).length > 0) {
      features.push('custom snippets');
    }
    
    return `Cursor IDE configuration with ${features.join(', ')}`;
  }

  private extractTags(data: CursorSettingsData & { aiConfiguration?: { enabled: boolean } }): string[] {
    const tags = new Set<string>();
    
    tags.add('cursor-ide');
    
    if (data.aiConfiguration?.enabled) {
      tags.add('ai');
      tags.add('llm');
    }
    
    if (data.snippets) {
      Object.keys(data.snippets).forEach(lang => {
        tags.add(lang.toLowerCase());
      });
    }
    
    return Array.from(tags);
  }

  private categorizeConfig(data: CursorSettingsData & { aiConfiguration?: { enabled: boolean } }): string[] {
    const categories = [];
    
    if (data.aiConfiguration?.enabled) {
      categories.push('AI Development');
    }
    
    const langs = data.snippets ? Object.keys(data.snippets) : [];
    if (langs.includes('javascript') || langs.includes('typescript')) {
      categories.push('Web Development');
    }
    
    if (langs.includes('python')) {
      categories.push('Data Science');
    }
    
    return categories.length > 0 ? categories : ['General Development'];
  }

  private extractKeywords(data: CursorSettingsData & { aiConfiguration?: { enabled?: boolean; defaultModel?: string } }): string[] {
    const keywords = new Set<string>();
    
    keywords.add('cursor');
    keywords.add('ide');
    keywords.add('configuration');
    
    if (data.aiConfiguration?.defaultModel) {
      keywords.add(data.aiConfiguration.defaultModel);
    }
    
    return Array.from(keywords);
  }

  private detectTechnologies(data: CursorSettingsData): string[] {
    const tech = new Set<string>();
    
    data.extensions?.recommendations?.forEach((extId: string) => {
      const id = extId.toLowerCase() || '';
      if (id.includes('react')) tech.add('React');
      if (id.includes('vue')) tech.add('Vue');
      if (id.includes('angular')) tech.add('Angular');
      if (id.includes('docker')) tech.add('Docker');
      if (id.includes('python')) tech.add('Python');
    });
    
    return Array.from(tech);
  }

  private detectPrimaryLanguage(data: CursorSettingsData): string | null {
    if (!data.snippets) return null;
    
    const langs = Object.keys(data.snippets);
    const priority = ['typescript', 'javascript', 'python', 'java', 'go', 'rust'];
    
    for (const lang of priority) {
      if (langs.includes(lang)) {
        return lang.charAt(0).toUpperCase() + lang.slice(1);
      }
    }
    
    return langs.length > 0 ? langs[0] : null;
  }

  private assessDifficulty(data: CursorSettingsData & { aiConfiguration?: { enabled: boolean } }): 'beginner' | 'intermediate' | 'advanced' {
    let complexity = 0;
    
    if (data.extensions?.recommendations && data.extensions.recommendations.length > 10) complexity++;
    if (data.aiConfiguration?.enabled) complexity++;
    if (data.snippets && Object.keys(data.snippets).length > 5) complexity++;
    if (data.settings && Object.keys(data.settings).length > 20) complexity++;
    
    if (complexity >= 3) return 'advanced';
    if (complexity >= 1) return 'intermediate';
    return 'beginner';
  }

  private extractRequiredFeatures(data: CursorSettingsData & { aiConfiguration?: { enabled: boolean } }): string[] {
    const features = [];
    
    if (data.aiConfiguration?.enabled) {
      features.push('ai-support');
    }
    
    if (data.settings?.['cursor.copilotEnabled']) {
      features.push('copilot-integration');
    }
    
    return features;
  }

  optimizeForSearch(metadata: SearchMetadata): SearchMetadata & {
    searchableText: string;
    boost: number;
  } {
    return {
      ...metadata,
      searchableText: `${metadata.title} ${metadata.description} ${metadata.tags.join(' ')} ${metadata.keywords.join(' ')}`.toLowerCase(),
      boost: this.calculateBoost(metadata),
    };
  }

  private calculateBoost(metadata: SearchMetadata): number {
    let boost = 1.0;
    
    if (metadata.technologies.length > 3) boost += 0.2;
    if (metadata.tags.includes('ai')) boost += 0.3;
    if (metadata.difficulty === 'advanced') boost += 0.1;
    
    return Math.min(boost, 2.0);
  }
}