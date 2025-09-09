import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, vi } from 'vitest';

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

    it('should handle transformation errors gracefully', async () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide'],
        },
        content: {
          personal: null as any, // Invalid data to trigger error
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

      // Mock the private method to throw an error
      const transformGlobalSettingsSpy = vi.spyOn(service as any, 'transformGlobalSettings');
      transformGlobalSettingsSpy.mockRejectedValue(new Error('Transformation failed'));

      await expect(service.transform(mockContext)).rejects.toThrow('Cursor transformation failed: Transformation failed');
    });

    it('should transform font family preferences correctly', async () => {
      const fontStyles = [
        { input: 'monospace', expected: 'Consolas, "Courier New", monospace' },
        { input: 'modern', expected: 'Fira Code, Consolas, monospace' },
        { input: 'classic', expected: 'Monaco, Menlo, "Ubuntu Mono", monospace' },
        { input: 'system', expected: 'SF Mono, Monaco, Inconsolata, "Roboto Mono", Consolas, "Courier New", monospace' },
        { input: 'unknown', expected: 'Consolas, "Courier New", monospace' },
      ];

      for (const fontStyle of fontStyles) {
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
                style: fontStyle.input,
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
        expect(result.globalSettings?.['editor.fontFamily']).toBe(fontStyle.expected);
      }
    });

    it('should transform different programming languages correctly', async () => {
      const languages = ['typescript', 'javascript', 'python', 'java', 'csharp', 'go', 'rust'];

      for (const language of languages) {
        const mockContext: TaptikContext = {
          metadata: {
            version: '1.0.0',
            exportedAt: '2024-01-01T00:00:00Z',
            sourceIde: 'claude-code',
            targetIdes: ['cursor-ide'],
          },
          content: {
            project: {
              name: 'test-project',
              tech_stack: {
                language,
                framework: 'express',
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
        expect(result.projectSettings?.['cursor.ai.projectContext']?.includeFiles).toBeDefined();
        
        // Verify language-specific file patterns are included
        const includeFiles = result.projectSettings?.['cursor.ai.projectContext']?.includeFiles || [];
        expect(includeFiles.length).toBeGreaterThan(0);
      }
    });

    it('should transform different frameworks correctly', async () => {
      const frameworks = ['nestjs', 'nextjs', 'react', 'vue', 'angular', 'express'];

      for (const framework of frameworks) {
        const mockContext: TaptikContext = {
          metadata: {
            version: '1.0.0',
            exportedAt: '2024-01-01T00:00:00Z',
            sourceIde: 'claude-code',
            targetIdes: ['cursor-ide'],
          },
          content: {
            project: {
              name: 'test-project',
              tech_stack: {
                language: 'typescript',
                framework,
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
        expect(result.extensions?.recommendations).toBeDefined();
        expect(result.extensions?.recommendations.length).toBeGreaterThan(0);
      }
    });

    it('should transform AI prompts from different sources', async () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide'],
        },
        content: {
          prompts: {
            system_prompts: [
              {
                name: 'system-prompt',
                content: 'System prompt content',
                category: 'system',
              },
            ],
            templates: [
              {
                name: 'template-prompt',
                template: 'Template content',
                description: 'Template description',
              },
            ],
            examples: [
              {
                name: 'example-prompt',
                prompt: 'Example content',
                use_case: 'testing',
              },
            ],
          },
          tools: {
            agents: [
              {
                name: 'test-agent',
                content: 'Agent content',
              },
            ],
            commands: [
              {
                name: 'test-command',
                content: 'Command content',
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

      expect(result.aiPrompts?.systemPrompts['system-prompt']).toBeDefined();
      expect(result.aiPrompts?.systemPrompts['template-prompt']).toBeDefined();
      expect(result.aiPrompts?.projectPrompts['example-prompt']).toBeDefined();
      expect(result.aiPrompts?.projectPrompts['test-agent']).toBeDefined();
      expect(result.aiPrompts?.projectPrompts['test-command']).toBeDefined();
    });

    it('should generate project rules from project context', async () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide'],
        },
        content: {
          project: {
            name: 'test-project',
            info: {
              name: 'Test Project',
              type: 'web-app',
            },
            architecture: {
              pattern: 'MVC',
              database_pattern: 'Repository',
              api_style: 'REST',
            },
            tech_stack: {
              language: 'typescript',
              framework: 'nestjs',
              database: 'postgresql',
              orm: 'typeorm',
              testing: ['jest', 'supertest'],
            },
            conventions: {
              file_naming: 'kebab-case',
              folder_structure: 'feature-based',
              commit_convention: 'conventional',
              branch_strategy: 'git-flow',
            },
            constraints: {
              security_level: 'high',
              compliance: ['GDPR', 'SOC2'],
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

      expect(result.aiPrompts?.rules['architecture']).toBeDefined();
      expect(result.aiPrompts?.rules['coding-style']).toBeDefined();
      expect(result.aiPrompts?.rules['testing']).toBeDefined();
      expect(result.aiPrompts?.rules['security']).toBeDefined();

      // Verify rule content contains expected information
      expect(result.aiPrompts?.rules['architecture']).toContain('Test Project');
      expect(result.aiPrompts?.rules['architecture']).toContain('MVC');
      expect(result.aiPrompts?.rules['coding-style']).toContain('kebab-case');
      expect(result.aiPrompts?.rules['testing']).toContain('jest');
      expect(result.aiPrompts?.rules['security']).toContain('high');
    });

    it('should handle Claude MD content transformation', async () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide'],
        },
        content: {
          project: {
            name: 'test-project',
            claudeMd: 'Claude MD content from project',
          },
          ide: {
            'claude-code': {
              claude_md: 'Claude MD content from IDE',
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

      expect(result.aiPrompts?.projectPrompts['claude-md']).toBeDefined();
      expect(result.aiPrompts?.projectPrompts['claude-md'].content).toBe('Claude MD content from project');
      expect(result.aiPrompts?.projectPrompts['claude-md'].tags).toContain('claude-code');
    });

    it('should merge existing IDE settings correctly', async () => {
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
              fontSize: 14,
            },
          },
          ide: {
            'cursor-ide': {
              settings: {
                'editor.fontSize': 18, // Should override personal preference
                'custom.setting': 'custom-value',
              },
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

      expect(result.globalSettings?.['editor.fontSize']).toBe(18); // IDE setting should override
      expect(result.globalSettings?.['custom.setting']).toBe('custom-value'); // Custom setting should be preserved
    });

    it('should handle snippets transformation from multiple sources', async () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide'],
        },
        content: {
          project: {
            name: 'test-project',
            tech_stack: {
              language: 'typescript',
              framework: 'nestjs',
            },
          },
          ide: {
            'claude-code': {
              snippets: {
                typescript: {
                  'test-snippet': {
                    prefix: 'test',
                    body: ['console.log("test");'],
                    description: 'Test snippet',
                  },
                },
              },
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

      expect(result.snippets).toBeDefined();
      expect(result.snippets?.typescript).toBeDefined();
    });

    it('should apply project conventions to settings', async () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide'],
        },
        content: {
          project: {
            name: 'test-project',
            conventions: {
              file_naming: 'kebab-case',
              commit_convention: 'conventional',
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

      expect(result.projectSettings?.['files.associations']).toBeDefined();
      expect(result.projectSettings?.['git.inputValidation']).toBe('always');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle null/undefined values gracefully', async () => {
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
              theme: null as any,
              fontSize: undefined as any,
              style: '',
            },
          },
          project: {
            name: 'test-project',
            tech_stack: {
              language: null as any,
              framework: undefined as any,
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

      expect(result).toBeDefined();
      expect(result.globalSettings?.['editor.fontSize']).toBe(14); // Default value
      expect(result.globalSettings?.['workbench.colorTheme']).toBe('Default Dark+'); // Default theme
    });

    it('should handle malformed data structures', async () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide'],
        },
        content: {
          prompts: {
            system_prompts: 'invalid-data' as any, // Should be array
            templates: null as any,
          },
          tools: {
            agents: undefined as any,
            commands: [] as any,
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

      // Should not throw error, but handle gracefully
      const result = await service.transform(mockContext);
      expect(result).toBeDefined();
    });

    it('should handle very large data sets', async () => {
      const largePrompts = Array.from({ length: 100 }, (_, i) => ({
        name: `prompt-${i}`,
        content: 'A'.repeat(1000), // 1KB content each
        category: 'test',
      }));

      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide'],
        },
        content: {
          prompts: {
            system_prompts: largePrompts,
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
      expect(result.aiPrompts?.systemPrompts).toBeDefined();
      expect(Object.keys(result.aiPrompts?.systemPrompts || {})).toHaveLength(100);
    });

    it('should handle circular references gracefully', async () => {
      const circularObject: any = { name: 'test' };
      circularObject.self = circularObject;

      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide'],
        },
        content: {
          project: circularObject,
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

      // Should handle without infinite loops
      const result = await service.transform(mockContext);
      expect(result).toBeDefined();
    });
  });
});