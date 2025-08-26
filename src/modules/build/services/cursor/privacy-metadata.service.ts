import * as crypto from 'crypto';

import { Injectable } from '@nestjs/common';

import {
  AnonymizedMetadata,
  GenericConfig,
  PrivacyOptOut,
  SettingsData,
  UsagePatterns,
  UserPreferences,
} from '../../interfaces/build-types.interface';

@Injectable()
export class CursorPrivacyMetadataService {
  generateAnonymizedMetadata(data: SettingsData): AnonymizedMetadata {
    const usagePatterns = this.extractUsagePatterns(data);
    const userPrefs = this.extractPreferences(data);
    
    return {
      hash: this.generateHash(data),
      features: this.extractFeatures(data),
      usagePatterns: {
        extensionCount: usagePatterns.extensionCount,
        settingsCount: Object.keys(data.settings || {}).length,
        keyboardShortcuts: 0, // Not available in current data
        hasCustomTheme: !!(data.settings as Record<string, unknown>)?.['workbench.colorTheme'],
      },
      preferences: {
        editorStyle: userPrefs.themeType === 'dark' ? 'dark' : 'light',
        workflowType: userPrefs.aiModelType === 'configured' ? 'ai-assisted' : 'traditional',
        collaborationLevel: data.extensions && data.extensions.length > 10 ? 'team' : 'individual',
      },
      compatibility: {
        platforms: [data.platform || 'cursor-ide'],
        versions: [data.version || '1.0.0'],
      },
    };
  }

  private extractFeatures(data: SettingsData): string[] {
    const features = [];
    
    if (data.settings?.editor) {
      features.push('editor-configured');
    }
    
    if (data.aiConfiguration) {
      features.push('ai-enabled');
    }
    
    if (data.extensions?.length > 0) {
      features.push(`extensions-${data.extensions.length}`);
    }
    
    if (data.snippets && Object.keys(data.snippets).length > 0) {
      features.push('snippets-configured');
    }

    return features;
  }

  private extractUsagePatterns(data: SettingsData): UsagePatterns {
    return {
      extensionCount: data.extensions?.length || 0,
      snippetLanguages: data.snippets ? Object.keys(data.snippets).length : 0,
      aiRulesCount: data.aiConfiguration?.rules?.length || 0,
      settingsCategories: this.getSettingsCategories(data.settings),
    };
  }

  private extractPreferences(data: SettingsData): UserPreferences {
    const prefs: UserPreferences = {};
    const settings = data.settings as Record<string, unknown> || {};

    // Check for theme preference in various locations
    const colorTheme = settings['workbench.colorTheme'] as string;
    if (colorTheme) {
      prefs.themeType = colorTheme.toLowerCase().includes('dark') ? 'dark' : 'light';
    }

    // Check for font size
    const fontSize = settings['editor.fontSize'] as number;
    if (fontSize) {
      prefs.fontSizeRange = this.getFontSizeRange(fontSize);
    }

    // Check if AI is configured
    if (data.aiConfiguration?.defaultModel) {
      prefs.aiModelType = 'configured';
    }

    return prefs;
  }

  private getSettingsCategories(settings: Record<string, unknown> | undefined): string[] {
    if (!settings) return [];
    
    const categories = [];
    if (settings.editor) categories.push('editor');
    if (settings.terminal) categories.push('terminal');
    if (settings.workbench) categories.push('workbench');
    if (settings.git) categories.push('git');
    if (settings.debug) categories.push('debug');
    
    return categories;
  }

  private getFontSizeRange(fontSize: number): 'small' | 'medium' | 'large' {
    if (fontSize < 12) return 'small';
    if (fontSize < 16) return 'medium';
    return 'large';
  }

  private generateHash(data: SettingsData): string {
    const sanitized = this.removeIdentifiableInfo(data);
    const str = JSON.stringify(sanitized);
    return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
  }

  private removeIdentifiableInfo(obj: unknown): unknown {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.removeIdentifiableInfo(item));
    }

    const cleaned: Record<string, unknown> = {};
    
    for (const key in obj) {
      if (this.isIdentifiableKey(key)) {
        continue;
      }
      
      if (typeof obj[key] === 'string' && this.containsIdentifiableInfo(obj[key])) {
        continue;
      }
      
      cleaned[key] = this.removeIdentifiableInfo(obj[key]);
    }

    return cleaned;
  }

  private isIdentifiableKey(key: string): boolean {
    const identifiableKeys = [
      'email', 'username', 'user', 'uuid',
      'path', 'home', 'directory', 'folder', 'file',
      'key', 'token', 'secret', 'password', 'credential',
      'host', 'hostname', 'ip', 'address', 'url',
    ];

    // Special cases to allow
    if (key === 'name' || key === 'id') {
      return false; // Allow standalone 'name' and 'id'
    }

    return identifiableKeys.some(k => key.toLowerCase().includes(k));
  }

  private containsIdentifiableInfo(value: string): boolean {
    const patterns = [
      /[\w%+.-]+@[\d.A-Za-z-]+\.[A-Za-z|]{2,}/, // Email
      /\/Users\/[^/]+/, // User paths
      /\/home\/[^/]+/, // Home paths
      /\b(?:\d{1,3}\.){3}\d{1,3}\b/, // IP addresses
      /[\dA-Za-z]{32,}/, // Potential tokens/keys
    ];

    return patterns.some(pattern => pattern.test(value));
  }

  createOptOutMechanism(): PrivacyOptOut {
    return {
      analytics: {
        enabled: false,
        level: 'none',
      },
      tracking: {
        enabled: false,
        categories: [],
      },
      sharing: {
        metadata: false,
        usage: false,
        errors: false,
      },
    };
  }

  validatePrivacyCompliance(metadata: GenericConfig): boolean {
    const str = JSON.stringify(metadata);
    
    // Check for common PII patterns
    const piiPatterns = [
      /[\w%+.-]+@[\d.A-Za-z-]+\.[A-Za-z|]{2,}/, // Email
      /\b(?:\d{1,3}\.){3}\d{1,3}\b/, // IP
      /\/Users\/[^/]+/, // User paths
      /\/home\/[^/]+/, // Home paths
    ];

    return !piiPatterns.some(pattern => pattern.test(str));
  }
}