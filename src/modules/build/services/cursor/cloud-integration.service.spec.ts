import { describe, it, expect } from 'vitest';

import { CursorCloudIntegrationService } from './cloud-integration.service';

describe('CursorCloudIntegrationService - Simple Tests', () => {
  const createService = () => {
    const mockSupabase = {} as any;
    const mockValidation = {
      generateComprehensiveCompatibilityReport: async () => ({
        report: {
          vsCodeCompatible: true,
          targetVersion: '1.85.0',
          compatibilityScore: 0.9,
          issues: [],
          warnings: [],
        },
      }),
    } as any;
    const mockPrivacy = {
      generateAnonymizedMetadata: (data: any) => ({ ...data, anonymized: true }),
      validatePrivacyCompliance: () => true,
    } as any;

    return new CursorCloudIntegrationService(mockSupabase, mockValidation, mockPrivacy);
  };

  describe('prepareCursorMetadata', () => {
    it('should prepare metadata with AI features', async () => {
      const service = createService();
      const cursorData = {
        version: '1.0.0',
        aiConfiguration: {
          enabled: true,
          defaultModel: 'gpt-4',
        },
        settings: {
          'cursor.aiProvider': 'openai',
          'cursor.copilotEnabled': true,
        },
        extensions: [
          { id: 'cursor.ai-extension', name: 'Cursor AI' },
        ],
        snippets: {
          javascript: { log: 'console.log' },
          python: { print: 'print()' },
        },
      };

      const metadata = await service.prepareCursorMetadata(cursorData);

      expect(metadata.platform).toBe('cursor-ide');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.compatibility.vsCode).toBe(true);
      expect(metadata.features.ai).toBe(true);
      expect(metadata.features.extensions).toBe(1);
      expect(metadata.features.snippets).toBe(2);
      expect(metadata.features.languages).toContain('javascript');
      expect(metadata.features.languages).toContain('python');
      expect(metadata.tags).toContain('ai-enabled');
      expect(metadata.tags).toContain('openai');
      expect(metadata.categories).toContain('ai-ml');
    });

    it('should handle minimal privacy level', async () => {
      const service = createService();
      const cursorData = {
        settings: {
          workbench: {
            colorTheme: 'Dark+ Theme',
          },
        },
      };

      const metadata = await service.prepareCursorMetadata(cursorData, {
        privacyLevel: 'minimal',
      });

      expect(metadata.features.themes).toEqual([]);
    });

    it('should generate appropriate tags for extensions', async () => {
      const service = createService();
      const cursorData = {
        extensions: [
          { id: 'ms-python.python', name: 'Python' },
          { id: 'esbenp.prettier-vscode', name: 'Prettier' },
          { id: 'ms-azuretools.vscode-docker', name: 'Docker' },
          { id: 'ms-kubernetes-tools.vscode-kubernetes-tools', name: 'Kubernetes' },
        ],
      };

      const metadata = await service.prepareCursorMetadata(cursorData);

      expect(metadata.tags).toContain('python');
      expect(metadata.tags).toContain('docker');
      expect(metadata.tags).toContain('kubernetes');
    });

    it('should categorize web development configurations', async () => {
      const service = createService();
      const cursorData = {
        snippets: {
          javascript: {},
          typescript: {},
          html: {},
          css: {},
        },
      };

      const metadata = await service.prepareCursorMetadata(cursorData);

      expect(metadata.categories).toContain('web-development');
      expect(metadata.categories).toContain('development');
    });

    it('should categorize data science configurations', async () => {
      const service = createService();
      const cursorData = {
        snippets: {
          python: {},
          r: {},
          julia: {},
        },
      };

      const metadata = await service.prepareCursorMetadata(cursorData);

      expect(metadata.categories).toContain('data-science');
    });

    it('should generate search terms', async () => {
      const service = createService();
      const cursorData = {
        aiConfiguration: {
          enabled: true,
        },
        snippets: {
          typescript: {},
          python: {},
        },
        extensions: new Array(15).fill({ id: 'ext' }),
      };

      const metadata = await service.prepareCursorMetadata(cursorData);

      expect(metadata.searchTerms).toContain('cursor');
      expect(metadata.searchTerms).toContain('ai');
      expect(metadata.searchTerms).toContain('typescript');
      expect(metadata.searchTerms).toContain('python-development');
      expect(metadata.searchTerms).toContain('full-stack');
      expect(metadata.searchTerms).toContain('professional');
    });
  });

  describe('addSupabaseMetadata', () => {
    it('should add cursor metadata to package data', async () => {
      const service = createService();
      const packageData = {
        name: 'test-package',
        metadata: {
          created: '2024-01-01',
        },
      };

      const cursorMetadata = {
        platform: 'cursor-ide' as const,
        version: '1.0.0',
        compatibility: {
          vsCode: true,
          cursorFeatures: [],
        },
        features: {
          ai: true,
          extensions: 5,
          snippets: 10,
          themes: ['dark'],
          languages: ['javascript'],
        },
        tags: ['ai', 'javascript'],
        categories: ['development'],
        searchTerms: ['cursor', 'ai'],
      };

      const result = await service.addSupabaseMetadata(packageData, cursorMetadata);

      expect(result.metadata.cursor).toBeDefined();
      expect(result.metadata.cursor).toEqual(cursorMetadata);
      expect(result.metadata.searchable).toBeDefined();
      expect(result.metadata.searchable.platform).toBe('cursor-ide');
      expect(result.metadata.searchable.hasAi).toBe(true);
      expect(result.metadata.searchable.extensionCount).toBe(5);
      expect(result.metadata.searchable.languages).toContain('javascript');
    });
  });

  describe('validateCloudReadiness', () => {
    it('should validate a ready configuration', () => {
      const service = createService();
      const data = {
        platform: 'cursor-ide',
        version: '1.0.0',
        settings: {
          editor: {},
        },
      };

      const result = service.validateCloudReadiness(data);

      expect(result.ready).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect missing platform', () => {
      const service = createService();
      const data = {
        version: '1.0.0',
        settings: {},
      };

      const result = service.validateCloudReadiness(data);

      expect(result.warnings).toContain('Missing or invalid platform identifier');
    });

    it('should detect missing version', () => {
      const service = createService();
      const data = {
        platform: 'cursor-ide',
        settings: {},
      };

      const result = service.validateCloudReadiness(data);

      expect(result.warnings).toContain('Missing version information');
    });

    it('should detect no meaningful content', () => {
      const service = createService();
      const data = {
        platform: 'cursor-ide',
        version: '1.0.0',
      };

      const result = service.validateCloudReadiness(data);

      expect(result.ready).toBe(false);
      expect(result.issues).toContain('Configuration contains no meaningful content');
    });

    it('should detect oversized configurations', () => {
      const service = createService();
      const data = {
        platform: 'cursor-ide',
        version: '1.0.0',
        settings: {
          huge: 'x'.repeat(11 * 1024 * 1024), // 11MB of data
        },
      };

      const result = service.validateCloudReadiness(data);

      expect(result.ready).toBe(false);
      expect(result.issues).toContain('Configuration exceeds maximum size limit (10MB)');
    });
  });
});