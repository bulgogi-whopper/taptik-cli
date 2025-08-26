/**
 * Tests for CursorTransformationService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  CursorLocalSettingsData,
  CursorGlobalSettingsData,
  VSCodeSettings,
  CursorAiConfiguration,
} from '../interfaces/cursor-ide.interfaces';
import { 
  TaptikPersonalContext,
  TaptikProjectContext,
  TaptikPromptTemplates,
} from '../interfaces/taptik-format.interface';
import { CURSOR_TEST_FIXTURES } from '../test-fixtures/cursor-ide-fixtures';

import { CursorTransformationService } from './cursor-transformation.service';
import { CursorValidationService } from './cursor-validation.service';

describe('CursorTransformationService', () => {
  let service: CursorTransformationService;
  let validationService: CursorValidationService;

  beforeEach(() => {
    // Create mock validation service
    validationService = {
      sanitizeAiConfiguration: vi.fn((config) => config),
      checkExtensionCompatibility: vi.fn((extensions) => ({
        compatibleExtensions: extensions.filter((e: any) => !e.id.includes('cursor')),
        incompatibleExtensions: extensions.filter((e: any) => e.id.includes('cursor')),
        warnings: [],
        alternatives: undefined,
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
        settings: CURSOR_TEST_FIXTURES.settings.valid,
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
      expect(result.preferences.theme).toBe('One Dark Pro');
      expect(result.preferences.editor_settings.fontSize).toBe(14);
      expect(result.preferences.editor_settings.tabSize).toBe(2);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.source).toBe('cursor-ide');
    });

    it('should handle AI configuration in personal context', async () => {
      const globalSettings: CursorGlobalSettingsData = {
        userHome: '/Users/test',
        globalAiRules: CURSOR_TEST_FIXTURES.aiRules.valid,
        settings: {
          'cursor.aiProvider': 'openai',
          'cursor.aiModel': 'gpt-4',
          'cursor.temperature': 0.7,
        },
        sourcePath: '/Users/test/.cursor',
        collectedAt: new Date().toISOString(),
        isGlobal: true,
      };


      const result = await service.transformCursorPersonalContext(globalSettings);

      expect(result.preferences.ai_settings).toBeDefined();
      expect(result.preferences.ai_settings?.provider).toBe('openai');
      expect(result.preferences.ai_settings?.model).toBe('gpt-4');
      expect(result.preferences.ai_settings?.temperature).toBe(0.7);
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
      expect(result.preferences).toBeDefined();
      expect(result.metadata.source).toBe('cursor-ide');
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
      expect(result.project_info.type).toBe('single-root');
      expect(result.technical_stack.extensions).toContain('dbaeumer.vscode-eslint');
      expect(result.development_guidelines.code_style).toBeDefined();
      expect(result.metadata.source).toBe('cursor-ide');
    });

    it('should handle multi-root workspace', async () => {
      const localSettings: CursorLocalSettingsData = {
        projectPath: '/test/workspace',
        workspaceType: 'multi-root',
        workspace: {
          settings: {
            'editor.formatOnSave': true,
          },
        },
        sourcePath: '/test/workspace/.vscode',
        collectedAt: new Date().toISOString(),
        isGlobal: false,
      };

      const result = await service.transformCursorProjectContext(localSettings);

      expect(result.project_info.type).toBe('multi-root');
      expect(result.workspace_config).toBeDefined();
    });

    it('should handle AI rules in project context', async () => {
      const localSettings: CursorLocalSettingsData = {
        projectPath: '/test/project',
        workspaceType: 'single',
        projectAiRules: CURSOR_TEST_FIXTURES.aiRules.valid,
        sourcePath: '/test/project/.cursor',
        collectedAt: new Date().toISOString(),
        isGlobal: false,
      };


      const result = await service.transformCursorProjectContext(localSettings);

      expect(result.ai_context).toBeDefined();
      expect(result.ai_context?.rules).toHaveLength(3);
      expect(result.ai_context?.rules?.[0].name).toBe('Documentation');
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
      expect(docTemplate?.content).toBe('Generate JSDoc documentation for this code');
      expect(docTemplate?.category).toBe('documentation');
      expect(docTemplate?.tags).toContain('cursor-ide');
      
      // Check a global prompt
      const reviewTemplate = result.templates.find(t => t.name === 'codeReview');
      expect(reviewTemplate).toBeDefined();
      expect(reviewTemplate?.content).toBe('Review this code for best practices');
      
      expect(result.metadata.source).toBe('cursor-ide');
    });

    it('should categorize templates based on content', async () => {
      const aiConfig: CursorAiConfiguration = {
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
      expect(result.metadata.source).toBe('cursor-ide');
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

      // Mock validation service
      vi.mocked(validationService.checkExtensionCompatibility).mockImplementation((exts) => ({
        compatibleExtensions: exts.filter(e => !e.id.includes('cursor')),
        incompatibleExtensions: exts.filter(e => e.id.includes('cursor')),
        warnings: ['cursor.cursor-ai is Cursor-specific and has no VS Code equivalent'],
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

      vi.mocked(validationService.checkExtensionCompatibility).mockReturnValue({
        compatibleExtensions: [],
        incompatibleExtensions: extensions,
        warnings: ['cursor.cursor-ai has no VS Code equivalent, consider GitHub Copilot'],
        alternatives: {
          'cursor.cursor-ai': 'github.copilot',
        },
      });

      const result = await service.mapCursorExtensions(extensions);

      expect(result.alternatives).toBeDefined();
      expect(result.alternatives?.['cursor.cursor-ai']).toBe('github.copilot');
    });
  });
});