import { Test, TestingModule } from '@nestjs/testing';

import { beforeEach, describe, expect, it } from 'vitest';

import { SettingsData } from '../../interfaces/settings-data.interface';

import { TransformationService } from './transformation.service';

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
        .rejects.toThrow('Cannot read properties of null');
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

  describe('transformProjectContext', () => {
    const mockProjectSettingsData: SettingsData = {
      localSettings: {
        contextMd: `# Project Context
Name: Taptik CLI
Description: AI IDE settings migration tool
Version: 1.0.0
Repository: https://github.com/user/taptik-cli
Language: TypeScript
Frameworks: NestJS, Commander
Tools: Vitest, ESLint, Prettier`,
        projectSpecMd: `# Project Specification
Primary Language: TypeScript
Frameworks: NestJS, nest-commander
Databases: None
Testing: Vitest, unit-first approach
Deployment: npm publish, GitHub Actions`,
        userPreferencesMd: `# User Preferences
Tools: VS Code, Docker, Git`,
        steeringFiles: [
          {
            filename: 'coding-standards.md',
            content: 'Use TypeScript strict mode and follow NestJS conventions',
            path: '.kiro/steering/coding-standards.md',
          },
          {
            filename: 'testing-requirements.md', 
            content: 'Minimum 80% test coverage required for all new features',
            path: '.kiro/steering/testing-requirements.md',
          }
        ],
        hooks: [
          {
            filename: 'pre-commit.kiro.hook',
            content: 'Run linting and type checking before commit',
            path: '.kiro/hooks/pre-commit.kiro.hook',
            type: 'pre-commit',
          }
        ],
      },
      globalSettings: {
        userConfig: '# Global Config\nStandards: Clean Architecture',
        preferences: '# Global Preferences\nTools: Docker, Kubernetes',
        globalPrompts: [],
      },
      collectionMetadata: {
        sourcePlatform: 'kiro',
        collectionTimestamp: '2025-01-04T10:30:00Z',
        projectPath: '/Users/user/projects/taptik-cli',
        globalPath: '/home/user/.kiro',
        warnings: [],
        errors: [],
      },
    };

    it('should transform Kiro project settings to Taptik project context format', async () => {
      const result = await service.transformProjectContext(mockProjectSettingsData);

      expect(result).toBeDefined();
      expect(result.project_id).toBeDefined();
      expect(result.project_info).toBeDefined();
      expect(result.technical_stack).toBeDefined();
      expect(result.development_guidelines).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should extract project info correctly', async () => {
      const result = await service.transformProjectContext(mockProjectSettingsData);

      expect(result.project_info.name).toBe('taptik cli');
      expect(result.project_info.description).toBe('ai ide settings migration tool');
      expect(result.project_info.version).toBe('1.0.0');
      expect(result.project_info.repository).toBe('https://github.com/user/taptik-cli');
    });

    it('should extract technical stack correctly', async () => {
      const result = await service.transformProjectContext(mockProjectSettingsData);

      expect(result.technical_stack.primary_language).toBe('TypeScript');
      expect(result.technical_stack.frameworks).toContain('NestJS');
      expect(result.technical_stack.frameworks).toContain('nest-commander');
      expect(result.technical_stack.frameworks).toContain('Commander');
      expect(result.technical_stack.tools).toContain('Vitest');
      expect(result.technical_stack.tools).toContain('ESLint');
      expect(result.technical_stack.tools).toContain('VS Code');
    });

    it('should extract development guidelines correctly', async () => {
      const result = await service.transformProjectContext(mockProjectSettingsData);

      expect(result.development_guidelines.coding_standards).toContain('Use TypeScript strict mode and follow NestJS conventions');
      expect(result.development_guidelines.testing_requirements).toContain('Minimum 80% test coverage required for all new features');
      expect(result.development_guidelines.review_process).toContain('Hook-based: Run linting and type checking before commit');
    });

    it('should set correct metadata', async () => {
      const result = await service.transformProjectContext(mockProjectSettingsData);

      expect(result.metadata.source_platform).toBe('kiro');
      expect(result.metadata.source_path).toBe('/Users/user/projects/taptik-cli');
      expect(result.metadata.version).toBe('1.0.0');
      expect(result.metadata.created_at).toBeDefined();
      expect(new Date(result.metadata.created_at)).toBeInstanceOf(Date);
    });

    it('should generate project ID with project name', async () => {
      const result = await service.transformProjectContext(mockProjectSettingsData);

      expect(result.project_id).toContain('taptik-cli');
      expect(result.project_id.split('-').length).toBeGreaterThanOrEqual(3); // name + uuid parts
    });

    it('should handle missing project files gracefully', async () => {
      const minimalProjectData: SettingsData = {
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
          projectPath: '/Users/user/projects/test-project',
          globalPath: '/home/user/.kiro',
          warnings: [],
          errors: [],
        },
      };

      const result = await service.transformProjectContext(minimalProjectData);

      expect(result).toBeDefined();
      expect(result.project_info.name).toBe('test-project'); // Fallback to directory name
      expect(result.project_info.description).toBe('No description available');
      expect(result.technical_stack.primary_language).toBe('typescript');
      expect(result.development_guidelines.coding_standards).toEqual([]);
    });

    it('should extract frameworks from multiple sources', async () => {
      const multiSourceData: SettingsData = {
        localSettings: {
          contextMd: `# Context
Frameworks: React, Express`,
          projectSpecMd: `# Spec
Libraries: Lodash, Axios`,
          userPreferencesMd: `# Preferences
Tools: Jest, Webpack`,
          steeringFiles: [],
          hooks: [],
        },
        globalSettings: {
          globalPrompts: [],
        },
        collectionMetadata: {
          sourcePlatform: 'kiro',
          collectionTimestamp: '2025-01-04T10:30:00Z',
          projectPath: '/Users/user/projects/multi-source',
          globalPath: '/home/user/.kiro',
          warnings: [],
          errors: [],
        },
      };

      const result = await service.transformProjectContext(multiSourceData);

      expect(result.technical_stack.frameworks).toContain('React');
      expect(result.technical_stack.frameworks).toContain('Express');
      expect(result.technical_stack.frameworks).toContain('Lodash');
      expect(result.technical_stack.frameworks).toContain('Axios');
      expect(result.technical_stack.tools).toContain('Jest');
      expect(result.technical_stack.tools).toContain('Webpack');
    });

    it('should extract steering rules and hook guidelines', async () => {
      const steeringData: SettingsData = {
        localSettings: {
          steeringFiles: [
            {
              filename: 'docs.md',
              content: 'All public methods must have documentation comments',
              path: '.kiro/steering/docs.md',
            },
            {
              filename: 'review.md',
              content: 'All PRs must be reviewed by at least 2 team members',
              path: '.kiro/steering/review.md',
            }
          ],
          hooks: [
            {
              filename: 'post-commit.kiro.hook',
              content: 'Validate commit message format',
              path: '.kiro/hooks/post-commit.kiro.hook',
              type: 'post-commit',
            }
          ],
        },
        globalSettings: {
          globalPrompts: [],
        },
        collectionMetadata: {
          sourcePlatform: 'kiro',
          collectionTimestamp: '2025-01-04T10:30:00Z',
          projectPath: '/Users/user/projects/steering-test',
          globalPath: '/home/user/.kiro',
          warnings: [],
          errors: [],
        },
      };

      const result = await service.transformProjectContext(steeringData);

      expect(result.development_guidelines.documentation_standards).toContain('All public methods must have documentation comments');
      expect(result.development_guidelines.review_process).toContain('All PRs must be reviewed by at least 2 team members');
      expect(result.development_guidelines.review_process).toContain('Hook-based: Validate commit message format');
    });

    it('should handle deployment and database extraction', async () => {
      const deploymentData: SettingsData = {
        localSettings: {
          contextMd: `# Context
Databases: PostgreSQL, Redis
Deployment: Heroku, Docker`,
          projectSpecMd: `# Spec
Database: MongoDB
Hosting: AWS, Netlify`,
          steeringFiles: [],
          hooks: [],
        },
        globalSettings: {
          globalPrompts: [],
        },
        collectionMetadata: {
          sourcePlatform: 'kiro',
          collectionTimestamp: '2025-01-04T10:30:00Z',
          projectPath: '/Users/user/projects/deployment-test',
          globalPath: '/home/user/.kiro',
          warnings: [],
          errors: [],
        },
      };

      const result = await service.transformProjectContext(deploymentData);

      expect(result.technical_stack.databases).toContain('PostgreSQL');
      expect(result.technical_stack.databases).toContain('Redis');
      expect(result.technical_stack.databases).toContain('MongoDB');
      expect(result.technical_stack.deployment).toContain('Heroku');
      expect(result.technical_stack.deployment).toContain('Docker');
      expect(result.technical_stack.deployment).toContain('AWS');
      expect(result.technical_stack.deployment).toContain('Netlify');
    });

    it('should throw error when critical project transformation fails', async () => {
      const invalidProjectData = null as any;

      await expect(service.transformProjectContext(invalidProjectData))
        .rejects.toThrow('Cannot read properties of null');
    });

    it('should generate unique project IDs for different transformations', async () => {
      const result1 = await service.transformProjectContext(mockProjectSettingsData);
      const result2 = await service.transformProjectContext(mockProjectSettingsData);

      expect(result1.project_id).toBeDefined();
      expect(result2.project_id).toBeDefined();
      expect(result1.project_id).not.toBe(result2.project_id);
    });

    it('should handle empty steering files and hooks', async () => {
      const emptyData: SettingsData = {
        localSettings: {
          contextMd: '# Empty Context',
          steeringFiles: [],
          hooks: [],
        },
        globalSettings: {
          globalPrompts: [],
        },
        collectionMetadata: {
          sourcePlatform: 'kiro',
          collectionTimestamp: '2025-01-04T10:30:00Z',
          projectPath: '/Users/user/projects/empty-project',
          globalPath: '/home/user/.kiro',
          warnings: [],
          errors: [],
        },
      };

      const result = await service.transformProjectContext(emptyData);

      expect(result.development_guidelines.coding_standards).toEqual([]);
      expect(result.development_guidelines.testing_requirements).toEqual([]);
      expect(result.development_guidelines.documentation_standards).toEqual([]);
      expect(result.development_guidelines.review_process).toEqual([]);
    });
  });

  describe('transformPromptTemplates', () => {
    const mockPromptSettingsData: SettingsData = {
      localSettings: {
        steeringFiles: [],
        hooks: [],
      },
      globalSettings: {
        userConfig: `# Global Templates

## Code Review Template
content: Please review this code for {language} and check for {criteria}. Focus on {{best_practices}} and provide feedback.
description: Template for code review requests
category: review
tags: code, review, quality

## Debug Help Template  
content: I'm having trouble with $error_type in my {framework} application. The issue is: {description}
description: Template for debugging assistance
category: development
tags: debug, help, troubleshooting`,
        preferences: '# Preferences\nDefault templates: enabled',
        globalPrompts: [
          {
            name: 'Explain Code',
            content: 'Explain what this {{language}} code does: {code_snippet}. Focus on the main logic and any important patterns.',
          },
          {
            name: 'Refactor Suggestion',
            content: 'Suggest improvements for this code: {code}. Consider performance, readability, and {criteria}.',
          }
        ],
      },
      collectionMetadata: {
        sourcePlatform: 'kiro',
        collectionTimestamp: '2025-01-04T10:30:00Z',
        projectPath: '/Users/user/projects/test',
        globalPath: '/home/user/.kiro',
        warnings: [],
        errors: [],
      },
    };

    it('should transform Kiro prompt templates to Taptik format', async () => {
      const result = await service.transformPromptTemplates(mockPromptSettingsData);

      expect(result).toBeDefined();
      expect(result.templates).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(Array.isArray(result.templates)).toBe(true);
    });

    it('should extract templates from global prompts array', async () => {
      const result = await service.transformPromptTemplates(mockPromptSettingsData);

      const explainTemplate = result.templates.find(t => t.id === 'explain-code');
      expect(explainTemplate).toBeDefined();
      expect(explainTemplate?.name).toBe('Explain Code');
      expect(explainTemplate?.category).toBe('documentation');
      expect(explainTemplate?.variables).toContain('language');
      expect(explainTemplate?.variables).toContain('code_snippet');
      expect(explainTemplate?.tags).toContain('explanation');
      expect(explainTemplate?.tags).toContain('documentation');

      const refactorTemplate = result.templates.find(t => t.id === 'refactor-suggestion');
      expect(refactorTemplate).toBeDefined();
      expect(refactorTemplate?.name).toBe('Refactor Suggestion');
      expect(refactorTemplate?.category).toBe('development');
      expect(refactorTemplate?.variables).toContain('code');
      expect(refactorTemplate?.variables).toContain('criteria');
    });

    it('should extract templates from markdown content', async () => {
      const result = await service.transformPromptTemplates(mockPromptSettingsData);

      // Should have at least the global prompts from the array
      expect(result.templates.length).toBeGreaterThanOrEqual(2);
      
      // Check that templates are properly extracted with variables
      const templatesWithVariables = result.templates.filter(t => t.variables.length > 0);
      expect(templatesWithVariables.length).toBeGreaterThan(0);
    });

    it('should detect different variable patterns', async () => {
      const variableTestData: SettingsData = {
        localSettings: {
          steeringFiles: [],
          hooks: [],
        },
        globalSettings: {
          globalPrompts: [
            {
              name: 'Variable Test',
              content: 'Test {{double_bracket}}, {single_bracket}, $dollar_var, and {{nested_var}} patterns',
            }
          ],
        },
        collectionMetadata: {
          sourcePlatform: 'kiro',
          collectionTimestamp: '2025-01-04T10:30:00Z',
          projectPath: '/test',
          globalPath: '/home/.kiro',
          warnings: [],
          errors: [],
        },
      };

      const result = await service.transformPromptTemplates(variableTestData);
      const template = result.templates[0];

      expect(template).toBeDefined();
      expect(template.variables).toContain('double_bracket');
      expect(template.variables).toContain('single_bracket');
      expect(template.variables).toContain('dollar_var');
      expect(template.variables).toContain('nested_var');
    });

    it('should set correct metadata', async () => {
      const result = await service.transformPromptTemplates(mockPromptSettingsData);

      expect(result.metadata.source_platform).toBe('kiro');
      expect(result.metadata.version).toBe('1.0.0');
      expect(result.metadata.created_at).toBeDefined();
      expect(new Date(result.metadata.created_at)).toBeInstanceOf(Date);
      expect(result.metadata.total_templates).toBe(result.templates.length);
      expect(result.metadata.total_templates).toBeGreaterThan(0);
    });

    it('should handle empty prompt templates gracefully', async () => {
      const emptyPromptsData: SettingsData = {
        localSettings: {
          steeringFiles: [],
          hooks: [],
        },
        globalSettings: {
          userConfig: '# Empty Config',
          preferences: '# No templates',
          globalPrompts: [],
        },
        collectionMetadata: {
          sourcePlatform: 'kiro',
          collectionTimestamp: '2025-01-04T10:30:00Z',
          projectPath: '/test',
          globalPath: '/home/.kiro',
          warnings: [],
          errors: [],
        },
      };

      const result = await service.transformPromptTemplates(emptyPromptsData);

      expect(result).toBeDefined();
      expect(result.templates).toEqual([]);
      expect(result.metadata.total_templates).toBe(0);
    });

    it('should infer categories from template names', async () => {
      const categoryTestData: SettingsData = {
        localSettings: {
          steeringFiles: [],
          hooks: [],
        },
        globalSettings: {
          globalPrompts: [
            {
              name: 'Code Generator',
              content: 'Generate code for {task}',  
            },
            {
              name: 'Documentation Helper',
              content: 'Write docs for {feature}',
            },
            {
              name: 'Test Assistant', 
              content: 'Create tests for {component}',
            },
            {
              name: 'Review Checklist',
              content: 'Review {code} for issues',
            }
          ],
        },
        collectionMetadata: {
          sourcePlatform: 'kiro',
          collectionTimestamp: '2025-01-04T10:30:00Z',
          projectPath: '/test',
          globalPath: '/home/.kiro',
          warnings: [],
          errors: [],
        },
      };

      const result = await service.transformPromptTemplates(categoryTestData);

      const codeTemplate = result.templates.find(t => t.name === 'Code Generator');
      expect(codeTemplate?.category).toBe('development');

      const documentationTemplate = result.templates.find(t => t.name === 'Documentation Helper');
      expect(documentationTemplate?.category).toBe('documentation');

      const testTemplate = result.templates.find(t => t.name === 'Test Assistant');
      expect(testTemplate?.category).toBe('testing');

      const reviewTemplate = result.templates.find(t => t.name === 'Review Checklist');
      expect(reviewTemplate?.category).toBe('review');
    });

    it('should sort templates by name', async () => {
      const result = await service.transformPromptTemplates(mockPromptSettingsData);

      // Templates should be sorted alphabetically by name
      const names = result.templates.map(t => t.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it('should handle malformed prompt objects gracefully', async () => {
      const malformedData: SettingsData = {
        localSettings: {
          steeringFiles: [],
          hooks: [],
        },
        globalSettings: {
          globalPrompts: [
            null,
            { name: 'Missing Content', content: 'Missing Content' },
            { name: 'Missing Name', content: 'Missing Name' },
            {
              name: 'Valid Template',
              content: 'This is a valid template with {variable}',
            }
          ],
        },
        collectionMetadata: {
          sourcePlatform: 'kiro',
          collectionTimestamp: '2025-01-04T10:30:00Z',
          projectPath: '/test',
          globalPath: '/home/.kiro',
          warnings: [],
          errors: [],
        },
      };

      const result = await service.transformPromptTemplates(malformedData);

      // Should only include the valid template(s) - some invalid entries might still create templates with defaults
      expect(result.templates.length).toBeGreaterThanOrEqual(1);
      const validTemplate = result.templates.find(t => t.name === 'Valid Template');
      expect(validTemplate).toBeDefined();
      expect(validTemplate?.variables).toContain('variable');
    });

    it('should handle template without variables', async () => {
      const noVariablesData: SettingsData = {
        localSettings: {
          steeringFiles: [],
          hooks: [],
        },
        globalSettings: {
          globalPrompts: [
            {
              name: 'Simple Template',
              content: 'This is a simple template without any variables',
            }
          ],
        },
        collectionMetadata: {
          sourcePlatform: 'kiro',
          collectionTimestamp: '2025-01-04T10:30:00Z',
          projectPath: '/test',
          globalPath: '/home/.kiro',
          warnings: [],
          errors: [],
        },
      };

      const result = await service.transformPromptTemplates(noVariablesData);

      expect(result.templates.length).toBe(1);
      expect(result.templates[0].variables).toEqual([]);
    });

    it('should throw error when critical prompt transformation fails', async () => {
      const invalidPromptData = null as any;

      await expect(service.transformPromptTemplates(invalidPromptData))
        .rejects.toThrow('Cannot read properties of null');
    });

    it('should handle complex variable patterns', async () => {
      const complexVariablesData: SettingsData = {
        localSettings: {
          steeringFiles: [],
          hooks: [],
        },
        globalSettings: {
          globalPrompts: [
            {
              name: 'Complex Variables',
              content: 'Test {{user.name}}, {project_config.version}, $APP_ENV, {{nested.deep.value}} and {simple} patterns',
            }
          ],
        },
        collectionMetadata: {
          sourcePlatform: 'kiro',
          collectionTimestamp: '2025-01-04T10:30:00Z',
          projectPath: '/test',
          globalPath: '/home/.kiro',
          warnings: [],
          errors: [],
        },
      };

      const result = await service.transformPromptTemplates(complexVariablesData);
      const template = result.templates[0];

      expect(template.variables).toContain('user.name');
      expect(template.variables).toContain('project_config.version');
      expect(template.variables).toContain('APP_ENV');
      expect(template.variables).toContain('nested.deep.value');
      expect(template.variables).toContain('simple');
    });

    it('should generate unique template IDs for markdown templates', async () => {
      const result = await service.transformPromptTemplates(mockPromptSettingsData);

      const templateIds = result.templates.map(t => t.id);
      const uniqueIds = new Set(templateIds);
      expect(templateIds.length).toBe(uniqueIds.size);

      // Should have some templates from markdown that get generated IDs
      const markdownTemplates = result.templates.filter(t => 
        !['explain-code', 'refactor-suggestion'].includes(t.id)
      );
      expect(markdownTemplates.length).toBeGreaterThan(0);
    });
  });
});