import { Test, TestingModule } from '@nestjs/testing';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';

import { KiroTransformerService } from './kiro-transformer.service';

describe('KiroTransformerService', () => {
  let service: KiroTransformerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KiroTransformerService],
    }).compile();

    service = module.get<KiroTransformerService>(KiroTransformerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('transformPersonalContext', () => {
    it('should transform personal context to Kiro global settings', () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['kiro-ide'],
        },
        content: {
          personal: {
            name: 'John Doe',
            email: 'john@example.com',
            profile: {
              experience_years: 5,
              primary_role: 'Full Stack Developer',
              domain_knowledge: ['web-development', 'nodejs']
            },
            preferences: {
              theme: 'dark',
              naming_convention: 'camelCase',
              testing_approach: 'unit-first'
            },
            communication: {
              explanation_level: 'detailed',
              preferred_language: 'en'
            },
            tech_stack: {
              languages: ['TypeScript', 'JavaScript'],
              frameworks: ['NestJS', 'React']
            }
          },
          tools: {
            agents: [
              {
                name: 'Test Agent',
                content: 'Test agent content',
                metadata: { category: 'testing' }
              }
            ]
          }
        },
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: { passed: true, warnings: [] }
        }
      };

      const result = service.transformPersonalContext(mockContext);

      expect(result.version).toBe('1.0.0');
      expect(result.user.profile.name).toBe('John Doe');
      expect(result.user.profile.email).toBe('john@example.com');
      expect(result.user.profile.experience_years).toBe(5);
      expect(result.user.preferences.theme).toBe('dark');
      expect(result.user.tech_stack.languages).toEqual(['TypeScript', 'JavaScript']);
      expect(result.agents).toHaveLength(1);
      expect(result.agents![0].name).toBe('Test Agent');
    });

    it('should handle missing personal context gracefully', () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['kiro-ide'],
        },
        content: {},
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: { passed: true, warnings: [] }
        }
      };

      const result = service.transformPersonalContext(mockContext);

      expect(result.version).toBe('1.0.0');
      expect(result.user.profile.name).toBeUndefined();
      expect(result.user.preferences.theme).toBeUndefined();
    });
  });

  describe('transformProjectContext', () => {
    it('should transform project context to Kiro project settings', () => {
      const mockContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00Z',
          sourceIde: 'claude-code',
          targetIdes: ['kiro-ide'],
        },
        content: {
          project: {
            name: 'Test Project',
            description: 'A test project for transformation',
            info: {
              type: 'web-app',
              team_size: 3
            },
            tech_stack: {
              language: 'TypeScript',
              framework: 'NestJS',
              database: 'PostgreSQL'
            },
            conventions: {
              commit_convention: 'conventional-commits'
            }
          },
          tools: {
            custom_tools: [
              {
                name: 'Test Tool',
                command: 'npm test',
                description: 'Run tests'
              }
            ]
          }
        },
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: { passed: true, warnings: [] }
        }
      };

      const result = service.transformProjectContext(mockContext);

      expect(result.settings.version).toBe('1.0.0');
      expect(result.settings.project.info.name).toBe('Test Project');
      expect(result.settings.project.tech_stack.language).toBe('TypeScript');
      expect(result.steering).toHaveLength(1);
      expect(result.steering[0].name).toBe('project-overview');
      expect(result.steering[0].content).toBe('A test project for transformation');
      expect(result.hooks).toHaveLength(1);
      expect(result.hooks[0].name).toBe('Test Tool');
    });
  });

  describe('transformPromptTemplates', () => {
    it('should transform prompts to Kiro templates', () => {
      const mockPrompts = {
        system_prompts: [
          {
            name: 'System Prompt',
            content: 'You are a helpful assistant',
            category: 'system'
          }
        ],
        templates: [
          {
            id: 'template-1',
            name: 'Test Template',
            template: 'Hello {{name}}',
            description: 'A greeting template',
            variables: ['name']
          }
        ],
        examples: [
          {
            name: 'Example 1',
            prompt: 'Generate a function',
            use_case: 'Code generation'
          }
        ]
      };

      const result = service.transformPromptTemplates(mockPrompts);

      expect(result).toHaveLength(3);
      
      // System prompt
      expect(result[0].name).toBe('System Prompt');
      expect(result[0].category).toBe('system');
      
      // Template
      expect(result[1].id).toBe('template-1');
      expect(result[1].variables).toHaveLength(1);
      expect(result[1].variables[0].name).toBe('name');
      
      // Example
      expect(result[2].name).toBe('Example 1');
      expect(result[2].category).toBe('example');
    });
  });

  describe('createDeploymentContext', () => {
    it('should create deployment context with correct paths', () => {
      const homeDir = '/home/user';
      const projectDir = '/home/user/project';

      const result = service.createDeploymentContext(homeDir, projectDir);

      expect(result.homeDirectory).toBe(homeDir);
      expect(result.projectDirectory).toBe(projectDir);
      expect(result.paths.globalSettings).toBe('/home/user/.kiro/settings.json');
      expect(result.paths.projectSettings).toBe('/home/user/project/.kiro/settings.json');
      expect(result.paths.steeringDirectory).toBe('/home/user/project/.kiro/steering');
      expect(result.paths.agentsDirectory).toBe('/home/user/.kiro/agents');
    });
  });

  describe('validateTransformation', () => {
    it('should validate successful transformation', () => {
      const globalSettings = {
        version: '1.0.0',
        user: {
          profile: { name: 'Test User' },
          preferences: {},
          communication: {},
          tech_stack: {}
        },
        ide: {}
      };

      const projectSettings = {
        version: '1.0.0',
        project: {
          info: { name: 'Test Project' },
          architecture: {},
          tech_stack: {},
          conventions: {},
          constraints: {}
        }
      };

      const result = service.validateTransformation(globalSettings, projectSettings);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect validation errors', () => {
      const globalSettings = {
        version: '',
        user: {
          profile: {},
          preferences: {},
          communication: {},
          tech_stack: {}
        },
        ide: {}
      };

      const projectSettings = {
        version: '',
        project: {
          info: {},
          architecture: {},
          tech_stack: {},
          conventions: {},
          constraints: {}
        }
      };

      const result = service.validateTransformation(globalSettings, projectSettings);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Global settings must have a version');
      expect(result.errors).toContain('Project settings must have a version');
    });
  });

  describe('private method testing via public methods', () => {
    it('should extract variables from template content', () => {
      const mockPrompts = {
        templates: [
          {
            id: 'test',
            name: 'Test',
            template: 'Hello {{name}}, welcome to {{platform}}!',
            description: 'Test template'
          }
        ]
      };

      const result = service.transformPromptTemplates(mockPrompts);

      expect(result[0].variables).toHaveLength(2);
      expect(result[0].variables.map(v => v.name)).toContain('name');
      expect(result[0].variables.map(v => v.name)).toContain('platform');
    });

    it('should handle templates without variables', () => {
      const mockPrompts = {
        templates: [
          {
            id: 'test',
            name: 'Test',
            template: 'Hello world!',
            description: 'Static template'
          }
        ]
      };

      const result = service.transformPromptTemplates(mockPrompts);

      expect(result[0].variables).toHaveLength(0);
    });
  });
});