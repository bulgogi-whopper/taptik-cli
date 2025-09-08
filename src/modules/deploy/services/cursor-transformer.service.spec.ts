import { Test, TestingModule } from '@nestjs/testing';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';

import { CursorTransformerService } from './cursor-transformer.service';

describe('CursorTransformerService', () => {
  let service: CursorTransformerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CursorTransformerService],
    }).compile();

    service = module.get<CursorTransformerService>(CursorTransformerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('transform', () => {
    it('should transform basic TaptikContext to CursorConfiguration', async () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide'],
        },
        content: {
          personal: {
            preferences: {
              theme: 'dark',
              fontSize: 16,
              style: 'modern',
            },
          },
          project: {
            name: 'test-project',
            tech_stack: {
              language: 'typescript',
              framework: 'nestjs',
              testing: ['jest'],
            },
          },
          prompts: {
            system_prompts: [
              {
                name: 'test-prompt',
                content: 'Test prompt content',
                category: 'general',
              },
            ],
          },
        },
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: {
            passed: true,
            warnings: [],
          },
        },
      };

      const result = await service.transform(mockContext);

      expect(result).toBeDefined();
      expect(result.globalSettings).toBeDefined();
      expect(result.projectSettings).toBeDefined();
      expect(result.aiPrompts).toBeDefined();
      expect(result.extensions).toBeDefined();
      expect(result.tasks).toBeDefined();

      // Verify global settings transformation
      expect(result.globalSettings?.['editor.fontSize']).toBe(16);
      expect(result.globalSettings?.['workbench.colorTheme']).toBe('Default Dark+');
      expect(result.globalSettings?.['cursor.ai.enabled']).toBe(true);

      // Verify project settings transformation
      expect(result.projectSettings?.['cursor.ai.projectContext']).toBeDefined();
      expect(result.projectSettings?.['[typescript]']).toBeDefined();

      // Verify AI prompts transformation
      expect(result.aiPrompts?.systemPrompts['test-prompt']).toBeDefined();
      expect(result.aiPrompts?.systemPrompts['test-prompt'].content).toBe('Test prompt content');

      // Verify extensions transformation
      expect(result.extensions?.recommendations).toContain('esbenp.prettier-vscode');
      expect(result.extensions?.recommendations).toContain('dbaeumer.vscode-eslint');

      // Verify tasks transformation
      expect(result.tasks?.tasks).toBeDefined();
      expect(result.tasks?.tasks.length).toBeGreaterThan(0);
    });

    it('should handle empty context gracefully', async () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide'],
        },
        content: {},
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: {
            passed: true,
            warnings: [],
          },
        },
      };

      const result = await service.transform(mockContext);

      expect(result).toBeDefined();
      expect(result.globalSettings).toBeUndefined();
      expect(result.projectSettings).toBeUndefined();
      expect(result.aiPrompts).toBeUndefined();
      expect(result.extensions).toBeUndefined();
      expect(result.snippets).toBeUndefined();
      expect(result.tasks).toBeUndefined();
      expect(result.launch).toBeUndefined();
    });

    it('should transform theme preferences correctly', async () => {
      const themes = [
        { input: 'dark', expected: 'Default Dark+' },
        { input: 'light', expected: 'Default Light+' },
        { input: 'high-contrast', expected: 'Default High Contrast' },
        { input: 'unknown', expected: 'Default Dark+' },
      ];

      for (const theme of themes) {
        const mockContext: TaptikContext = {
          metadata: {
            version: '1.0.0',
            exportedAt: '2024-01-01T00:00:00Z',
            sourceIde: 'claude-code',
            targetIdes: ['cursor-ide'],
          },
          content: {
            personal: {
              preferences: {
                theme: theme.input,
              },
            },
          },
          security: {
            hasApiKeys: false,
            filteredFields: [],
            scanResults: {
              passed: true,
              warnings: [],
            },
          },
        };

        const result = await service.transform(mockContext);
        expect(result.globalSettings?.['workbench.colorTheme']).toBe(theme.expected);
      }
    });

    it('should filter incompatible extensions', async () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide'],
        },
        content: {
          ide: {
            'claude-code': {
              extensions: [
                'esbenp.prettier-vscode', // Compatible
                'github.copilot', // Incompatible
                'dbaeumer.vscode-eslint', // Compatible
                'tabnine.tabnine-vscode', // Incompatible
              ],
            },
          },
        },
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: {
            passed: true,
            warnings: [],
          },
        },
      };

      const result = await service.transform(mockContext);

      expect(result.extensions?.recommendations).toContain('esbenp.prettier-vscode');
      expect(result.extensions?.recommendations).toContain('dbaeumer.vscode-eslint');
      expect(result.extensions?.recommendations).not.toContain('github.copilot');
      expect(result.extensions?.recommendations).not.toContain('tabnine.tabnine-vscode');

      expect(result.extensions?.unwantedRecommendations).toContain('github.copilot');
      expect(result.extensions?.unwantedRecommendations).toContain('tabnine.tabnine-vscode');
    });
  });
});