/**
 * Tests for CursorTransformationService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  CursorLocalSettingsData,
  CursorGlobalSettingsData,
  CursorAiConfiguration,
} from '../interfaces/cursor-ide.interfaces';
import { CURSOR_TEST_FIXTURES } from '../test-fixtures/cursor-ide-fixtures';

import { CursorTransformationService } from './cursor-transformation.service';
import { CursorValidationService } from './cursor-validation.service';

describe('CursorTransformationService', () => {
  let service: CursorTransformationService;
  let validationService: CursorValidationService;

  beforeEach(() => {
    // Create mock validation service with all methods
    validationService = {
      sanitizeAiConfiguration: vi.fn((config) => config),
      checkExtensionCompatibility: vi.fn((extensionIds) => Promise.resolve({
        vsCodeCompatible: true,
        incompatibleSettings: [],
        incompatibleExtensions: extensionIds.filter((id: string) => id.includes('cursor')),
        alternativeExtensions: {},
        migrationSuggestions: [],
      })),
      validateVSCodeSchema: vi.fn(() => ({ isValid: true, errors: [] })),
      generateSecurityReport: vi.fn(() => ({ 
        hasSensitiveData: false,
        filteredFields: [],
        warnings: [],
      })),
    } as any;

    // Create service with mock dependency
    service = new CursorTransformationService(validationService);

    vi.clearAllMocks();
  });

  describe('transformCursorPersonalContext', () => {
    it('should transform global settings to personal context', async () => {
      const globalSettings: CursorGlobalSettingsData = {
        userHome: '/Users/test',
        settings: {
          'editor.fontSize': 14,
          'editor.tabSize': 2,
          'editor.wordWrap': 'on' as any,
          'workbench.colorTheme': 'One Dark Pro',
        },
        keybindings: CURSOR_TEST_FIXTURES.keybindings.valid,
        snippets: CURSOR_TEST_FIXTURES.snippets,
        globalExtensions: [
          {
            id: 'dbaeumer.vscode-eslint',
            name: 'ESLint',
            publisher: 'dbaeumer',
            version: '2.4.0',
            enabled: true,
          },
        ],
        sourcePath: '/Users/test/.cursor',
        collectedAt: new Date().toISOString(),
        isGlobal: true,
      };

      const result = await service.transformCursorPersonalContext(globalSettings);

      expect(result).toBeDefined();
      expect(result.user_id).toBeDefined();
      expect(result.preferences).toBeDefined();
      expect(result.preferences.preferred_languages).toContain('javascript');
      expect(result.preferences.coding_style.indentation).toBe('2 spaces');
      expect(result.preferences.coding_style.naming_convention).toBe('camelCase');
      expect(result.preferences.tools_and_frameworks).toContain('eslint');
      expect(result.metadata.source_platform).toBe('cursor-ide');
    });

    it('should detect languages from settings and extensions', async () => {
      const globalSettings: CursorGlobalSettingsData = {
        userHome: '/Users/test',
        globalAiRules: CURSOR_TEST_FIXTURES.aiRules.valid,
        settings: {
          'typescript.tsdk': './node_modules/typescript/lib',
          'python.defaultInterpreterPath': '/usr/bin/python3',
        },
        globalExtensions: [
          {
            id: 'ms-python.python',
            name: 'Python',
            enabled: true,
          },
        ],
        sourcePath: '/Users/test/.cursor',
        collectedAt: new Date().toISOString(),
        isGlobal: true,
      };

      const result = await service.transformCursorPersonalContext(globalSettings);

      expect(result.preferences.preferred_languages).toContain('typescript');
      expect(result.preferences.preferred_languages).toContain('python');
    });

    it('should handle missing global settings gracefully', async () => {
      const globalSettings: CursorGlobalSettingsData = {
        userHome: '/Users/test',
        sourcePath: '/Users/test/.cursor',
        collectedAt: new Date().toISOString(),
        isGlobal: true,
      };

      const result = await service.transformCursorPersonalContext(globalSettings);

      expect(result).toBeDefined();
      expect(result.user_id).toBeDefined();
      expect(result.preferences.preferred_languages).toContain('javascript');
      expect(result.metadata.source_platform).toBe('cursor-ide');
    });
  });

  describe('transformCursorProjectContext', () => {
    it('should transform local settings to project context', async () => {
      const localSettings: CursorLocalSettingsData = {
        projectPath: '/test/project',
        workspaceType: 'single',
        settings: {
          'editor.formatOnSave': true,
          'files.autoSave': 'afterDelay',
          'typescript.tsdk': './node_modules/typescript/lib',
        },
        extensions: {
          recommendations: ['dbaeumer.vscode-eslint', 'esbenp.prettier-vscode'],
        },
        sourcePath: '/test/project/.vscode',
        collectedAt: new Date().toISOString(),
        isGlobal: false,
      };

      const result = await service.transformCursorProjectContext(localSettings);

      expect(result).toBeDefined();
      expect(result.project_id).toBeDefined();
      expect(result.project_info.name).toBe('project');
      expect(result.project_info.description).toContain('Cursor IDE project');
      expect(result.technical_stack.primary_language).toBe('typescript');
      expect(result.technical_stack.frameworks).toBeDefined();
      expect(result.development_guidelines.coding_standards).toContain('Format on save enabled');
      expect(result.metadata.source_platform).toBe('cursor-ide');
      expect(result.metadata.source_path).toBe('/test/project');
    });

    it('should detect frameworks from extensions', async () => {
      const localSettings: CursorLocalSettingsData = {
        projectPath: '/test/project',
        workspaceType: 'single',
        extensions: {
          recommendations: ['angular.ng-template', 'vuejs.volar', 'fivethree.vscode-nestjs-snippets'],
        },
        sourcePath: '/test/project/.vscode',
        collectedAt: new Date().toISOString(),
        isGlobal: false,
      };

      const result = await service.transformCursorProjectContext(localSettings);

      expect(result.technical_stack.frameworks).toContain('angular');
      expect(result.technical_stack.frameworks).toContain('vue');
      expect(result.technical_stack.frameworks).toContain('nestjs');
    });

    it('should handle empty local settings gracefully', async () => {
      const localSettings: CursorLocalSettingsData = {
        projectPath: '/test/empty-project',
        workspaceType: 'none',
        sourcePath: '/test/empty-project/.cursor',
        collectedAt: new Date().toISOString(),
        isGlobal: false,
      };

      const result = await service.transformCursorProjectContext(localSettings);

      expect(result).toBeDefined();
      expect(result.project_info.name).toBe('empty-project');
      expect(result.technical_stack.primary_language).toBe('javascript');
      expect(result.development_guidelines.coding_standards).toContain('ESLint enforced');
    });
  });

  describe('transformCursorPromptTemplates', () => {
    it('should transform AI rules to prompt templates', async () => {
      const aiConfig: CursorAiConfiguration = CURSOR_TEST_FIXTURES.aiRules.valid;

      const result = await service.transformCursorPromptTemplates(aiConfig);

      expect(result).toBeDefined();
      // 2 enabled rules + 2 global prompts = 4 templates
      expect(result.templates).toHaveLength(4);
      
      // Check the first rule (Documentation)
      const docTemplate = result.templates.find(t => t.name === 'Documentation');
      expect(docTemplate).toBeDefined();
      expect(docTemplate?.description).toContain('AI rule for');
      expect(docTemplate?.content).toBe('Generate JSDoc documentation for this code');
      expect(docTemplate?.category).toBe('documentation');
      expect(docTemplate?.tags).toContain('cursor-ide');
      
      // Check a global prompt
      const reviewTemplate = result.templates.find(t => t.name === 'codeReview');
      expect(reviewTemplate).toBeDefined();
      expect(reviewTemplate?.description).toContain('Global prompt');
      expect(reviewTemplate?.content).toBe('Review this code for best practices');
      
      expect(result.metadata.source_platform).toBe('cursor-ide');
      expect(result.metadata.total_templates).toBe(4);
    });

    it('should categorize templates based on content', async () => {
      const aiConfig: CursorAiConfiguration = {
        version: '1.0.0',
        rules: [
          { name: 'Test Generation', pattern: '*.spec.ts', prompt: 'Generate unit tests' },
          { name: 'Code Review', pattern: '*.ts', prompt: 'Review for best practices' },
          { name: 'Security Check', pattern: '*.js', prompt: 'Check for vulnerabilities' },
        ],
      };

      const result = await service.transformCursorPromptTemplates(aiConfig);

      expect(result.templates[0].category).toBe('testing');
      expect(result.templates[1].category).toBe('review');
      expect(result.templates[2].category).toBe('security');
    });

    it('should handle global prompts', async () => {
      const aiConfig: CursorAiConfiguration = {
        version: '1.0.0',
        globalPrompts: {
          codeReview: 'Review this code for best practices',
          testing: 'Generate unit tests for this function',
        },
      };

      const result = await service.transformCursorPromptTemplates(aiConfig);

      expect(result.templates).toHaveLength(2);
      expect(result.templates[0].name).toBe('codeReview');
      expect(result.templates[1].name).toBe('testing');
    });

    it('should handle empty AI configuration', async () => {
      const result = await service.transformCursorPromptTemplates(undefined);

      expect(result).toBeDefined();
      expect(result.templates).toHaveLength(0);
      expect(result.metadata.source_platform).toBe('cursor-ide');
      expect(result.metadata.total_templates).toBe(0);
    });
  });

  describe('mapCursorExtensions', () => {
    it('should map Cursor extensions to platform-agnostic format', async () => {
      const extensions = [
        {
          id: 'dbaeumer.vscode-eslint',
          name: 'ESLint',
          publisher: 'dbaeumer',
          version: '2.4.0',
          enabled: true,
        },
        {
          id: 'cursor.cursor-ai',
          name: 'Cursor AI',
          publisher: 'cursor',
          version: '1.0.0',
          enabled: true,
        },
      ];

      // Update mock for this test
      vi.mocked(validationService.checkExtensionCompatibility).mockReturnValue(Promise.resolve({
        vsCodeCompatible: true,
        incompatibleSettings: [],
        incompatibleExtensions: ['cursor.cursor-ai'],
        alternativeExtensions: {},
        migrationSuggestions: ['cursor.cursor-ai is Cursor-specific and has no VS Code equivalent'],
      }));

      const result = await service.mapCursorExtensions(extensions);

      expect(result).toBeDefined();
      expect(result.extensions).toHaveLength(2);
      expect(result.compatibility.vscode).toContain('dbaeumer.vscode-eslint');
      expect(result.compatibility.cursor_specific).toContain('cursor.cursor-ai');
      expect(result.metadata).toBeDefined();
      expect(result.metadata.total_count).toBe(2);
      expect(result.metadata.compatible_count).toBe(1);
    });

    it('should handle empty extension list', async () => {
      const result = await service.mapCursorExtensions([]);

      expect(result).toBeDefined();
      expect(result.extensions).toHaveLength(0);
      expect(result.compatibility.vscode).toHaveLength(0);
      expect(result.metadata.total_count).toBe(0);
    });

    it('should provide alternative suggestions', async () => {
      const extensions = [
        {
          id: 'cursor.cursor-ai',
          name: 'Cursor AI',
          enabled: true,
        },
      ];

      vi.mocked(validationService.checkExtensionCompatibility).mockReturnValue(Promise.resolve({
        vsCodeCompatible: false,
        incompatibleSettings: [],
        incompatibleExtensions: ['cursor.cursor-ai'],
        alternativeExtensions: {
          'cursor.cursor-ai': 'github.copilot',
        },
        migrationSuggestions: ['cursor.cursor-ai has no VS Code equivalent, consider GitHub Copilot'],
      }));

      const result = await service.mapCursorExtensions(extensions);

      expect(result.alternatives).toBeDefined();
      expect(result.alternatives?.['cursor.cursor-ai']).toBe('github.copilot');
    });
  });
});