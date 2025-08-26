import { Test, TestingModule } from '@nestjs/testing';

import { describe, beforeEach, it, expect } from 'vitest';

import { CursorPrivacyMetadataService } from './privacy-metadata.service';

describe('CursorPrivacyMetadataService', () => {
  let service: CursorPrivacyMetadataService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CursorPrivacyMetadataService],
    }).compile();

    service = module.get<CursorPrivacyMetadataService>(CursorPrivacyMetadataService);
  });

  describe('generateAnonymizedMetadata', () => {
    it('should generate anonymized metadata without PII', () => {
      const data = {
        version: '1.0.0',
        platform: 'cursor-ide',
        settings: {
          editor: {
            theme: 'dark-theme',
            fontSize: 14,
          },
          'user.email': 'test@example.com',
        },
        aiConfiguration: {
          defaultModel: 'gpt-4',
          rules: ['rule1', 'rule2'],
        },
        extensions: ['ext1', 'ext2', 'ext3'],
        snippets: {
          javascript: {},
          typescript: {},
        },
        userPath: '/Users/johndoe/projects',
      };

      const metadata = service.generateAnonymizedMetadata(data);

      expect(metadata).toBeDefined();
      expect(metadata.features).toContain('editor-configured');
      expect(metadata.features).toContain('ai-enabled');
      expect(metadata.usagePatterns.extensionCount).toBe(3);
      expect(metadata.preferences.editorStyle).toBeDefined();
      
      // Ensure no PII is present
      const metadataStr = JSON.stringify(metadata);
      expect(metadataStr).not.toContain('test@example.com');
      expect(metadataStr).not.toContain('johndoe');
      expect(metadataStr).not.toContain('/Users/');
    });

    it('should extract correct usage patterns', () => {
      const data = {
        extensions: new Array(5).fill('ext'),
        snippets: {
          javascript: {},
          typescript: {},
          python: {},
        },
        aiConfiguration: {
          rules: new Array(10).fill('rule'),
        },
        settings: {
          editor: {},
          terminal: {},
          git: {},
        },
      };

      const metadata = service.generateAnonymizedMetadata(data);

      expect(metadata.usagePatterns.extensionCount).toBe(5);
      expect(metadata.usagePatterns.settingsCount).toBeGreaterThan(0);
    });

    it('should categorize font sizes correctly', () => {
      const smallFont = {
        settings: { editor: { fontSize: 10 } },
      };
      const mediumFont = {
        settings: { editor: { fontSize: 14 } },
      };
      const largeFont = {
        settings: { editor: { fontSize: 18 } },
      };

      expect(service.generateAnonymizedMetadata(smallFont).preferences.editorStyle).toBeDefined();
      expect(service.generateAnonymizedMetadata(mediumFont).preferences.editorStyle).toBeDefined();
      expect(service.generateAnonymizedMetadata(largeFont).preferences.editorStyle).toBeDefined();
    });

    it('should generate consistent hash for same data', () => {
      const data = {
        version: '1.0.0',
        settings: { editor: { theme: 'dark' } },
      };

      const metadata1 = service.generateAnonymizedMetadata(data);
      const metadata2 = service.generateAnonymizedMetadata(data);

      expect(metadata1.hash).toBe(metadata2.hash);
      expect(metadata1.hash).toHaveLength(16);
    });
  });

  describe('createOptOutMechanism', () => {
    it('should create opt-out configuration', () => {
      const optOut = service.createOptOutMechanism();

      expect(optOut.analytics.enabled).toBe(false);
      expect(optOut.analytics.level).toBe('none');
      expect(optOut.tracking.enabled).toBe(false);
      expect(optOut.sharing.metadata).toBe(false);
      expect(optOut.sharing.usage).toBe(false);
      expect(optOut.sharing.errors).toBe(false);
    });
  });

  describe('validatePrivacyCompliance', () => {
    it('should validate clean metadata as compliant', () => {
      const cleanMetadata = {
        version: '1.0.0',
        features: ['editor', 'ai'],
        usage: { extensionCount: 5 },
      };

      expect(service.validatePrivacyCompliance(cleanMetadata)).toBe(true);
    });

    it('should detect email in metadata', () => {
      const metadataWithEmail = {
        settings: {
          userEmail: 'test@example.com',
        },
      };

      expect(service.validatePrivacyCompliance(metadataWithEmail)).toBe(false);
    });

    it('should detect IP addresses in metadata', () => {
      const metadataWithIP = {
        connection: {
          host: '192.168.1.1',
        },
      };

      expect(service.validatePrivacyCompliance(metadataWithIP)).toBe(false);
    });

    it('should detect user paths in metadata', () => {
      const metadataWithPath = {
        projectPath: '/Users/johndoe/project',
      };

      expect(service.validatePrivacyCompliance(metadataWithPath)).toBe(false);
    });

    it('should detect home paths in metadata', () => {
      const metadataWithHome = {
        configPath: '/home/username/config',
      };

      expect(service.validatePrivacyCompliance(metadataWithHome)).toBe(false);
    });
  });
});