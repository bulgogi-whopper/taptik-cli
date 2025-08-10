import { Test, TestingModule } from '@nestjs/testing';
import { TransformationService } from './transformation.service';
import { SettingsData } from '../interfaces/settings-data.interface';
import { TaptikPersonalContext } from '../interfaces/taptik-format.interface';

describe('TransformationService', () => {
  let service: TransformationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransformationService],
    }).compile();

    service = module.get<TransformationService>(TransformationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('transformPersonalContext', () => {
    const mockSettingsData: SettingsData = {
      localSettings: {
        contextMd: '# Project Context\nThis is a test project',
        userPreferencesMd: `# User Preferences
Languages: TypeScript, JavaScript
Coding Style:
  Indentation: 2 spaces
  Naming Convention: camelCase
Tools: NestJS, React, Vitest`,
        projectSpecMd: '# Project Spec\nWorkflow: agile\nTesting: unit-first',
        steeringFiles: [],
        hooks: [],
      },
      globalSettings: {
        userConfig: `# User Config
Explanation Style: concise
Technical Depth: expert
Feedback Style: direct`,
        preferences: `# Global Preferences
Languages: TypeScript, Python
Environment: VS Code, Docker`,
        globalPrompts: [],
      },
      collectionMetadata: {
        sourcePlatform: 'kiro',
        collectionTimestamp: '2025-01-04T10:30:00Z',
        projectPath: '/test/project',
        globalPath: '/home/user/.kiro',
        warnings: [],
        errors: [],
      },
    };

    it('should transform Kiro settings to Taptik personal context format', async () => {
      const result = await service.transformPersonalContext(mockSettingsData);

      expect(result).toBeDefined();
      expect(result.user_id).toBeDefined();
      expect(result.preferences).toBeDefined();
      expect(result.work_style).toBeDefined();
      expect(result.communication).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should extract preferred languages correctly', async () => {
      const result = await service.transformPersonalContext(mockSettingsData);

      expect(result.preferences.preferred_languages).toContain('TypeScript');
      expect(result.preferences.preferred_languages).toContain('JavaScript');
      expect(result.preferences.preferred_languages).toContain('Python');
    });

    it('should extract coding style preferences correctly', async () => {
      const result = await service.transformPersonalContext(mockSettingsData);

      expect(result.preferences.coding_style.indentation).toBe('2 spaces');
      expect(result.preferences.coding_style.naming_convention).toBe('camelCase');
      expect(result.preferences.coding_style.comment_style).toBe('minimal');
      expect(result.preferences.coding_style.code_organization).toBe('feature-based');
    });

    it('should extract work style preferences correctly', async () => {
      const result = await service.transformPersonalContext(mockSettingsData);

      expect(result.work_style.preferred_workflow).toBe('agile');
      expect(result.work_style.testing_approach).toBe('unit-first');
      expect(result.work_style.problem_solving_approach).toBe('incremental');
      expect(result.work_style.documentation_level).toBe('minimal');
    });

    it('should extract communication preferences correctly', async () => {
      const result = await service.transformPersonalContext(mockSettingsData);

      expect(result.communication.preferred_explanation_style).toBe('concise');
      expect(result.communication.technical_depth).toBe('expert');
      expect(result.communication.feedback_style).toBe('direct');
    });

    it('should set correct metadata', async () => {
      const result = await service.transformPersonalContext(mockSettingsData);

      expect(result.metadata.source_platform).toBe('kiro');
      expect(result.metadata.version).toBe('1.0.0');
      expect(result.metadata.created_at).toBeDefined();
      expect(new Date(result.metadata.created_at)).toBeInstanceOf(Date);
    });

    it('should handle missing preferences gracefully', async () => {
      const minimalSettingsData: SettingsData = {
        localSettings: {
          steeringFiles: [],
          hooks: [],
        },
        globalSettings: {
          globalPrompts: [],
        },
        collectionMetadata: {
          sourcePlatform: 'kiro',
          collectionTimestamp: '2025-01-04T10:30:00Z',
          projectPath: '/test/project',
          globalPath: '/home/user/.kiro',
          warnings: [],
          errors: [],
        },
      };

      const result = await service.transformPersonalContext(minimalSettingsData);

      expect(result).toBeDefined();
      expect(result.preferences.preferred_languages).toContain('typescript');
      expect(result.preferences.coding_style.indentation).toBe('2 spaces');
      expect(result.work_style.preferred_workflow).toBe('agile');
      expect(result.communication.preferred_explanation_style).toBe('concise');
    });

    it('should handle malformed markdown content gracefully', async () => {
      const malformedSettingsData: SettingsData = {
        ...mockSettingsData,
        localSettings: {
          ...mockSettingsData.localSettings,
          userPreferencesMd: 'Invalid markdown content without proper structure',
        },
        globalSettings: {
          ...mockSettingsData.globalSettings,
          userConfig: '# Invalid\nMalformed: content: with: multiple: colons',
        },
      };

      const result = await service.transformPersonalContext(malformedSettingsData);

      expect(result).toBeDefined();
      // Should still extract from global preferences that are properly formatted
      expect(result.preferences.preferred_languages.length).toBeGreaterThan(0);
    });

    it('should handle empty content gracefully', async () => {
      const emptySettingsData: SettingsData = {
        localSettings: {
          contextMd: '',
          userPreferencesMd: '',
          projectSpecMd: '',
          steeringFiles: [],
          hooks: [],
        },
        globalSettings: {
          userConfig: '',
          preferences: '',
          globalPrompts: [],
        },
        collectionMetadata: {
          sourcePlatform: 'kiro',
          collectionTimestamp: '2025-01-04T10:30:00Z',
          projectPath: '/test/project',
          globalPath: '/home/user/.kiro',
          warnings: [],
          errors: [],
        },
      };

      const result = await service.transformPersonalContext(emptySettingsData);

      expect(result).toBeDefined();
      expect(result.user_id).toBeDefined();
      expect(result.metadata.source_platform).toBe('kiro');
    });

    it('should throw error when critical transformation fails', async () => {
      const invalidSettingsData = null as any;

      await expect(service.transformPersonalContext(invalidSettingsData))
        .rejects.toThrow('Personal context transformation failed');
    });

    it('should generate unique user IDs for different transformations', async () => {
      const result1 = await service.transformPersonalContext(mockSettingsData);
      const result2 = await service.transformPersonalContext(mockSettingsData);

      expect(result1.user_id).toBeDefined();
      expect(result2.user_id).toBeDefined();
      expect(result1.user_id).not.toBe(result2.user_id);
    });

    it('should merge local and global preferences correctly', async () => {
      const mergeTestData: SettingsData = {
        localSettings: {
          userPreferencesMd: `# Local Preferences
Languages: JavaScript, Go
Tools: Jest, Express`,
          steeringFiles: [],
          hooks: [],
        },
        globalSettings: {
          preferences: `# Global Preferences  
Languages: TypeScript, Python
Tools: Docker, Kubernetes
Environment: VS Code`,
          globalPrompts: [],
        },
        collectionMetadata: {
          sourcePlatform: 'kiro',
          collectionTimestamp: '2025-01-04T10:30:00Z',
          projectPath: '/test/project',
          globalPath: '/home/user/.kiro',
          warnings: [],
          errors: [],
        },
      };

      const result = await service.transformPersonalContext(mergeTestData);

      expect(result.preferences.preferred_languages).toContain('JavaScript');
      expect(result.preferences.preferred_languages).toContain('Go');
      expect(result.preferences.preferred_languages).toContain('TypeScript');
      expect(result.preferences.preferred_languages).toContain('Python');

      expect(result.preferences.tools_and_frameworks).toContain('Jest');
      expect(result.preferences.tools_and_frameworks).toContain('Express');
      expect(result.preferences.tools_and_frameworks).toContain('Docker');
      expect(result.preferences.tools_and_frameworks).toContain('Kubernetes');

      expect(result.preferences.development_environment).toContain('VS Code');
    });
  });
});