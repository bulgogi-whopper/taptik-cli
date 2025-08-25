import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CursorTransformerService } from './cursor-transformer.service';
import { CursorContentValidatorService } from './cursor-content-validator.service';
import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import { 
  CursorGlobalSettings, 
  CursorProjectSettings, 
  CursorAIConfig,
  CursorExtensionsConfig,
  CursorDebugConfig,
  CursorTasksConfig,
  CursorSnippetsConfig,
  CursorWorkspaceConfig
} from '../interfaces/cursor-config.interface';

describe('CursorTransformerService', () => {
  let service: CursorTransformerService;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CursorTransformerService,
        {
          provide: Logger,
          useValue: {
            debug: vi.fn(),
            log: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            verbose: vi.fn(),
          },
        },
        {
          provide: CursorContentValidatorService,
          useValue: {
            validateAIContent: vi.fn().mockResolvedValue({
              valid: true,
              errors: [],
              warnings: [],
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CursorTransformerService>(CursorTransformerService);
    logger = module.get<Logger>(Logger);
  });

  describe('transformContext', () => {
    it('should transform complete TaptikContext to Cursor configuration', async () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '2.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide'],
          title: 'Test Configuration',
          description: 'Test configuration for Cursor IDE'
        },
        content: {
          personal: {
            profile: {
              name: 'John Doe',
              email: 'john@example.com',
              experience_years: 5,
              primary_role: 'Full Stack Developer'
            },
            preferences: {
              theme: 'dark',
              fontSize: 14,
              style: 'typescript'
            }
          },
          project: {
            name: 'Test Project',
            description: 'A test project',
            info: {
              name: 'test-project',
              type: 'web-app'
            }
          }
        },
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: {
            passed: true,
            warnings: []
          }
        }
      };

      const result = await service.transformContext(mockContext);

      expect(result.globalSettings).toBeDefined();
      expect(result.projectSettings).toBeDefined();
      expect(result.snippetsConfig).toBeDefined();
      expect(result.workspaceConfig).toBeDefined();
      expect(result.statistics).toBeDefined();
    });

    it('should handle empty context gracefully', async () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide']
        },
        content: {},
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: {
            passed: true,
            warnings: []
          }
        }
      };

      const result = await service.transformContext(mockContext);

      expect(result.snippetsConfig).toBeDefined();
      expect(result.workspaceConfig).toBeDefined();
      expect(result.statistics.transformedComponents).toBe(1);
    });
  });

  describe('transformPersonalContext', () => {
    it('should transform personal context to global settings', () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide']
        },
        content: {
          personal: {
            profile: {
              name: 'Jane Doe',
              email: 'jane@example.com',
              experience_years: 3
            },
            preferences: {
              theme: 'light',
              fontSize: 16,
              style: 'javascript'
            },
            communication: {
              explanation_level: 'detailed',
              code_review_tone: 'constructive'
            },
            tech_stack: {
              languages: ['TypeScript', 'Python'],
              frameworks: ['React', 'NestJS']
            }
          }
        },
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: {
            passed: true,
            warnings: []
          }
        }
      };

      const result = service.transformPersonalContext(mockContext);

      expect(result.editor).toBeDefined();
      expect(result.editor.theme).toBe('light');
      expect(result.editor.fontSize).toBe(16);
      expect(result.workbench).toBeDefined();
      expect(result.files).toBeDefined();
      expect(result.terminal).toBeDefined();
    });

    it('should handle missing personal context', () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide']
        },
        content: {},
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: {
            passed: true,
            warnings: []
          }
        }
      };

      const result = service.transformPersonalContext(mockContext);

      expect(result.editor).toBeDefined();
      expect(result.workbench).toBeDefined();
      expect(result.files).toBeDefined();
      expect(result.terminal).toBeDefined();
    });
  });

  describe('transformProjectContext', () => {
    it('should transform project context to project settings', () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide']
        },
        content: {
          project: {
            name: 'Test Project',
            description: 'A comprehensive test project',
            info: {
              name: 'test-project',
              type: 'library',
              domain: 'testing',
              team_size: 5
            },
            tech_stack: {
              runtime: 'Node.js',
              language: 'TypeScript',
              framework: 'NestJS',
              database: 'PostgreSQL'
            },
            conventions: {
              file_naming: 'kebab-case',
              folder_structure: 'feature-based'
            }
          }
        },
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: {
            passed: true,
            warnings: []
          }
        }
      };

      const result = service.transformProjectContext(mockContext);

      expect(result.folders).toBeDefined();
      expect(result.search).toBeDefined();
      expect(result.files).toBeDefined();
      expect(result.emmet).toBeDefined();
      expect(result.typescript).toBeDefined();
      expect(result.javascript).toBeDefined();
    });

    it('should handle missing project context', () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide']
        },
        content: {},
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: {
            passed: true,
            warnings: []
          }
        }
      };

      const result = service.transformProjectContext(mockContext);

      expect(result.folders).toBeDefined();
      expect(result.search).toBeDefined();
      expect(result.files).toBeDefined();
    });
  });

  describe('transformAIContent', () => {
    it('should transform AI content to Cursor AI configuration', () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide']
        },
        content: {
          prompts: {
            system_prompts: [
              {
                name: 'Code Review',
                content: 'Please review this code for best practices',
                category: 'review',
                tags: ['code', 'review']
              }
            ],
            templates: [
              {
                name: 'API Template',
                template: 'Create API endpoint for {{feature}}',
                variables: ['feature'],
                description: 'Template for creating API endpoints'
              }
            ],
            examples: [
              {
                name: 'Component Example',
                prompt: 'Create a React component',
                use_case: 'React development'
              }
            ]
          }
        },
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: {
            passed: true,
            warnings: []
          }
        }
      };

      const result = service.transformAIContent(mockContext);

      expect(result.rules).toBeDefined();
      expect(result.rules.length).toBeGreaterThan(0);
      expect(result.contextFiles).toBeDefined();
      expect(result.contextFiles.length).toBeGreaterThan(0);
      expect(result.prompts).toBeDefined();
      expect(result.prompts.length).toBeGreaterThan(0);
    });

    it('should handle missing prompts context', () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide']
        },
        content: {},
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: {
            passed: true,
            warnings: []
          }
        }
      };

      const result = service.transformAIContent(mockContext);

      expect(result.rules).toEqual([]);
      expect(result.contextFiles).toEqual([]);
      expect(result.prompts).toEqual([]);
    });
  });

  describe('transformExtensions', () => {
    it('should transform tools to extensions configuration', () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide']
        },
        content: {
          tools: {
            integrations: [
              {
                name: 'prettier',
                type: 'formatter',
                config: { semi: false },
                enabled: true
              },
              {
                name: 'eslint',
                type: 'linter',
                config: { extends: ['@typescript-eslint'] },
                enabled: true
              }
            ]
          }
        },
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: {
            passed: true,
            warnings: []
          }
        }
      };

      const result = service.transformExtensions(mockContext);

      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBe(2);
      expect(result.recommendations).toContain('esbenp.prettier-vscode');
      expect(result.recommendations).toContain('dbaeumer.vscode-eslint');
      expect(result.unwantedRecommendations).toBeDefined();
    });

    it('should handle missing tools context', () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide']
        },
        content: {},
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: {
            passed: true,
            warnings: []
          }
        }
      };

      const result = service.transformExtensions(mockContext);

      expect(result.recommendations).toEqual([]);
      expect(result.unwantedRecommendations).toEqual([]);
    });
  });

  describe('transformDebugTasks', () => {
    it('should transform custom tools to debug and tasks configuration', () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide']
        },
        content: {
          tools: {
            custom_tools: [
              {
                name: 'test',
                command: 'npm test',
                description: 'Run tests',
                category: 'testing'
              },
              {
                name: 'build',
                command: 'npm run build',
                description: 'Build project',
                category: 'build'
              }
            ]
          }
        },
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: {
            passed: true,
            warnings: []
          }
        }
      };

      const result = service.transformDebugTasks(mockContext);

      expect(result.debug.configurations).toBeDefined();
      expect(result.tasks.tasks).toBeDefined();
      expect(result.tasks.tasks.length).toBe(2);
      expect(result.tasks.tasks[0].label).toBe('test');
      expect(result.tasks.tasks[0].command).toBe('npm test');
      expect(result.tasks.tasks[1].label).toBe('build');
      expect(result.tasks.tasks[1].command).toBe('npm run build');
    });

    it('should handle missing custom tools', () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide']
        },
        content: {},
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: {
            passed: true,
            warnings: []
          }
        }
      };

      const result = service.transformDebugTasks(mockContext);

      expect(result.debug.configurations).toEqual([]);
      expect(result.tasks.tasks).toEqual([]);
    });
  });

  describe('transformSnippetsWorkspace', () => {
    it('should transform prompts to snippets and workspace configuration', () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide']
        },
        content: {
          prompts: {
            templates: [
              {
                name: 'React Component',
                template: 'function {{name}}() {\n  return <div>{{content}}</div>;\n}',
                variables: ['name', 'content'],
                description: 'Create a React functional component'
              }
            ]
          },
          project: {
            name: 'My Project',
            description: 'Project description'
          }
        },
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: {
            passed: true,
            warnings: []
          }
        }
      };

      const result = service.transformSnippetsWorkspace(mockContext);

      expect(result.snippets.typescript).toBeDefined();
      expect(result.snippets.typescript['React Component']).toBeDefined();
      expect(result.snippets.typescript['React Component'].prefix).toBe('react-component');
      expect(result.snippets.typescript['React Component'].body).toContain('function ${1:name}() {');
      expect(result.workspace.name).toBe('My Project');
      expect(result.workspace.folders).toEqual([]);
      expect(result.workspace.settings).toEqual({});
    });

    it('should handle missing templates and project info', () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide']
        },
        content: {},
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: {
            passed: true,
            warnings: []
          }
        }
      };

      const result = service.transformSnippetsWorkspace(mockContext);

      expect(result.snippets.typescript).toEqual({});
      expect(result.snippets.javascript).toEqual({});
      expect(result.workspace.name).toBe('Untitled Project');
      expect(result.workspace.folders).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle transformation errors gracefully', async () => {
      const invalidContext = {} as TaptikContext;

      const result = await service.transformContext(invalidContext);

      expect(result).toBeDefined();
      expect(result.statistics).toBeDefined();
      expect(result.statistics.errors).toBeGreaterThan(0);
    });

    it('should create transformation log entries', async () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['cursor-ide']
        },
        content: {},
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: {
            passed: true,
            warnings: []
          }
        }
      };

      const result = await service.transformContext(mockContext);

      expect(result.transformationLog).toBeDefined();
      expect(result.transformationLog.length).toBeGreaterThan(0);
      expect(result.transformationLog[0].message).toContain('Starting context transformation');
    });
  });

  describe('utility methods', () => {
    it('should convert template variables correctly', () => {
      const template = 'Hello {{name}}, welcome to {{project}}!';
      const expectedBody = 'Hello ${1:name}, welcome to ${2:project}!';
      
      // Access private method through any type assertion for testing
      const result = (service as any).convertTemplateVariables(template, ['name', 'project']);
      
      expect(result).toBe(expectedBody);
    });

    it('should generate snippet prefix correctly', () => {
      const name = 'React Functional Component';
      const expectedPrefix = 'react-functional-component';
      
      // Access private method through any type assertion for testing
      const result = (service as any).generateSnippetPrefix(name);
      
      expect(result).toBe(expectedPrefix);
    });

    it('should map tool to extension correctly', () => {
      const tool = {
        name: 'prettier',
        type: 'formatter',
        config: {},
        enabled: true
      };
      
      // Access private method through any type assertion for testing
      const result = (service as any).mapToolToExtension(tool);
      
      expect(result).toBe('esbenp.prettier-vscode');
    });
  });
});