import * as crypto from 'crypto';

import { Injectable } from '@nestjs/common';

@Injectable()
export class CursorPrivacyMetadataService {
  generateAnonymizedMetadata(data: any): any {
    const metadata = {
      timestamp: new Date().toISOString(),
      version: data.version || 'unknown',
      platform: data.platform || 'cursor-ide',
      features: this.extractFeatures(data),
      usage: this.extractUsagePatterns(data),
      preferences: this.extractPreferences(data),
      hash: this.generateHash(data),
    };

    // Don't filter the metadata itself, it's already clean
    return metadata;
  }

  private extractFeatures(data: any): string[] {
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

  private extractUsagePatterns(data: any): any {
    return {
      extensionCount: data.extensions?.length || 0,
      snippetLanguages: data.snippets ? Object.keys(data.snippets).length : 0,
      aiRulesCount: data.aiConfiguration?.rules?.length || 0,
      settingsCategories: this.getSettingsCategories(data.settings),
    };
  }

  private extractPreferences(data: any): any {
    const prefs: any = {};

    if (data.settings?.editor?.theme) {
      prefs.themeType = data.settings.editor.theme.includes('dark') ? 'dark' : 'light';
    }

    if (data.settings?.editor?.fontSize) {
      prefs.fontSizeRange = this.getFontSizeRange(data.settings.editor.fontSize);
    }

    if (data.aiConfiguration?.defaultModel) {
      prefs.aiModelType = 'configured';
    }

    return prefs;
  }

  private getSettingsCategories(settings: any): string[] {
    if (!settings) return [];
    
    const categories = [];
    if (settings.editor) categories.push('editor');
    if (settings.terminal) categories.push('terminal');
    if (settings.workbench) categories.push('workbench');
    if (settings.git) categories.push('git');
    if (settings.debug) categories.push('debug');
    
    return categories;
  }

  private getFontSizeRange(fontSize: number): string {
    if (fontSize < 12) return 'small';
    if (fontSize < 16) return 'medium';
    return 'large';
  }

  private generateHash(data: any): string {
    const sanitized = this.removeIdentifiableInfo(data);
    const str = JSON.stringify(sanitized);
    return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
  }

  private removeIdentifiableInfo(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.removeIdentifiableInfo(item));
    }

    const cleaned: any = {};
    
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

  createOptOutMechanism(): any {
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

  validatePrivacyCompliance(metadata: any): boolean {
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