/* eslint-disable unicorn/no-thenable */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AIPlatform } from '../interfaces';

import { KiroBuilderStrategy } from './kiro-builder.strategy';

describe('KiroBuilderStrategy', () => {
  let strategy: KiroBuilderStrategy;
  let fileSystemUtility: any;

  beforeEach(() => {
    fileSystemUtility = {
      exists: vi.fn(),
      readFile: vi.fn(),
      readJson: vi.fn(),
      readDirectory: vi.fn(),
      isDirectory: vi.fn(),
    };

    strategy = new KiroBuilderStrategy(fileSystemUtility);
  });

  describe('detect', () => {
    it('should detect a valid Kiro project', async () => {
      vi.mocked(fileSystemUtility.exists).mockImplementation((path: string) => {
        if (path.endsWith('.kiro')) return Promise.resolve(true);
        if (path.endsWith('specs')) return Promise.resolve(true);
        if (path.endsWith('steering')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      const result = await strategy.detect('/project');
      expect(result).toBe(true);
    });

    it('should return false if .kiro directory does not exist', async () => {
      vi.mocked(fileSystemUtility.exists).mockResolvedValue(false);

      const result = await strategy.detect('/project');
      expect(result).toBe(false);
    });

    it('should return false if neither specs nor steering directories exist', async () => {
      vi.mocked(fileSystemUtility.exists).mockImplementation((path: string) => {
        if (path.endsWith('.kiro')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      const result = await strategy.detect('/project');
      expect(result).toBe(false);
    });

    it('should detect with specs directory only', async () => {
      vi.mocked(fileSystemUtility.exists).mockImplementation((path: string) => {
        if (path.endsWith('.kiro')) return Promise.resolve(true);
        if (path.endsWith('specs')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      const result = await strategy.detect('/project');
      expect(result).toBe(true);
    });

    it('should detect with steering directory only', async () => {
      vi.mocked(fileSystemUtility.exists).mockImplementation((path: string) => {
        if (path.endsWith('.kiro')) return Promise.resolve(true);
        if (path.endsWith('steering')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      const result = await strategy.detect('/project');
      expect(result).toBe(true);
    });
  });

  describe('extract', () => {
    beforeEach(() => {
      // Setup default mock for detect
      vi.mocked(fileSystemUtility.exists).mockImplementation((path: string) => {
        if (path.endsWith('.kiro')) return Promise.resolve(true);
        if (path.endsWith('specs')) return Promise.resolve(true);
        if (path.endsWith('steering')) return Promise.resolve(true);
        return Promise.resolve(false);
      });
    });

    it('should extract specs from .kiro/specs directory', async () => {
      vi.mocked(fileSystemUtility.exists).mockImplementation((path: string) => {
        if (path.endsWith('.kiro')) return Promise.resolve(true);
        if (path.endsWith('specs')) return Promise.resolve(true);
        if (path.endsWith('steering')) return Promise.resolve(true);
        if (path.endsWith('.md')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      vi.mocked(fileSystemUtility.readDirectory).mockImplementation(
        (path: string) => {
          if (path.endsWith('specs')) {
            return Promise.resolve(['feature1', 'feature2']);
          }
          if (path.endsWith('steering')) {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        },
      );

      vi.mocked(fileSystemUtility.isDirectory).mockResolvedValue(true);

      vi.mocked(fileSystemUtility.readFile).mockImplementation(
        (path: string) => {
          if (path.includes('design.md')) {
            return Promise.resolve('# Design\nDesign content');
          }
          if (path.includes('requirements.md')) {
            return Promise.resolve('# Requirements\nRequirements content');
          }
          if (path.includes('tasks.md')) {
            return Promise.resolve('# Tasks\nTasks content');
          }
          return Promise.resolve('');
        },
      );

      const result = await strategy.extract('/project');

      expect(result.specs).toHaveLength(2);
      expect(result.specs[0]).toHaveProperty('name', 'feature1');
      expect(result.specs[0]).toHaveProperty('design');
      expect(result.specs[0]).toHaveProperty('requirements');
      expect(result.specs[0]).toHaveProperty('tasks');
    });

    it('should extract steering rules from .kiro/steering directory', async () => {
      vi.mocked(fileSystemUtility.readDirectory).mockImplementation(
        (path: string) => {
          if (path.endsWith('steering')) {
            return Promise.resolve(['principle.md', 'persona.md', 'test.txt']);
          }
          return Promise.resolve([]);
        },
      );

      vi.mocked(fileSystemUtility.readFile).mockImplementation(
        (path: string) => {
          if (path.includes('principle.md')) {
            return Promise.resolve(
              '# Principles\nCore development principles\n- Clean code\n- Test driven\n- Documentation',
            );
          }
          if (path.includes('persona.md')) {
            return Promise.resolve(
              '# Persona\nAgent behavior\n- Professional\n- Helpful',
            );
          }
          return Promise.resolve('');
        },
      );

      const result = await strategy.extract('/project');

      expect(result.steeringRules).toHaveLength(2);
      expect(result.steeringRules[0]).toHaveProperty('name', 'principle');
      expect(result.steeringRules[0]).toHaveProperty(
        'description',
        'Core development principles',
      );
      expect(result.steeringRules[0].rules).toContain('Clean code');
      expect(result.steeringRules[0].priority).toBe(100);
    });

    it('should extract hooks from .kiro/hooks directory', async () => {
      vi.mocked(fileSystemUtility.readDirectory).mockImplementation(
        (path: string) => {
          if (path.endsWith('hooks')) {
            return Promise.resolve(['pre-commit.json', 'post-task.json']);
          }
          return Promise.resolve([]);
        },
      );

      vi.mocked(fileSystemUtility.exists).mockImplementation((path: string) => {
        if (path.includes('hooks')) return Promise.resolve(true);
        if (path.endsWith('.kiro')) return Promise.resolve(true);
        if (path.endsWith('specs')) return Promise.resolve(true);
        if (path.endsWith('steering')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      vi.mocked(fileSystemUtility.readJson).mockImplementation(
        (path: string) => {
          if (path.includes('pre-commit.json')) {
            return Promise.resolve({
              name: 'pre-commit',
              version: '1.0.0',
              enabled: true,
              description: 'Run tests before commit',
              when: { type: 'pre-commit' },
              then: { type: 'command', command: 'npm test' },
            });
          }
          if (path.includes('post-task.json')) {
            return Promise.resolve({
              name: 'post-task',
              version: '1.0.0',
              enabled: false,
              when: { type: 'post-task' },
              then: { type: 'prompt', prompt: 'Task completed!' },
            });
          }
          return Promise.resolve({});
        },
      );

      const result = await strategy.extract('/project');

      expect(result.hooks).toHaveLength(2);
      expect(result.hooks[0]).toHaveProperty('name', 'pre-commit');
      expect(result.hooks[0]).toHaveProperty('enabled', true);
      expect(result.hooks[1]).toHaveProperty('enabled', false);
    });

    it('should extract MCP settings', async () => {
      vi.mocked(fileSystemUtility.exists).mockImplementation((path: string) => {
        if (path.includes('mcp.json')) return Promise.resolve(true);
        if (path.endsWith('.kiro')) return Promise.resolve(true);
        if (path.endsWith('specs')) return Promise.resolve(true);
        if (path.endsWith('steering')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      vi.mocked(fileSystemUtility.readJson).mockImplementation(
        (path: string) => {
          if (path.includes('mcp.json')) {
            return Promise.resolve({
              servers: [
                {
                  name: 'test-server',
                  version: '1.0.0',
                  config: { port: 3000 },
                },
              ],
            });
          }
          return Promise.resolve({});
        },
      );

      vi.mocked(fileSystemUtility.readDirectory).mockResolvedValue([]);

      const result = await strategy.extract('/project');

      expect(result.mcpSettings).toBeDefined();
      expect(result.mcpSettings.servers).toHaveLength(1);
      expect(result.mcpSettings.servers[0].name).toBe('test-server');
    });

    it('should throw error if not a Kiro project', async () => {
      vi.mocked(fileSystemUtility.exists).mockResolvedValue(false);

      await expect(strategy.extract('/project')).rejects.toThrow(
        'Not a Kiro project',
      );
    });
  });

  describe('normalize', () => {
    it('should normalize Kiro data to TaptikContext', async () => {
      const kiroData = {
        specs: [
          {
            name: 'feature1',
            design: 'Design content',
            requirements: 'Requirements content',
            tasks: 'Tasks content',
          },
        ],
        steeringRules: [
          {
            name: 'principle',
            description: 'Core principles',
            rules: ['Clean code', 'Test driven'],
            priority: 100,
          },
        ],
        hooks: [
          {
            name: 'pre-commit',
            version: '1.0.0',
            enabled: true,
            description: 'Pre-commit hook',
            when: { type: 'pre-commit' },
            then: { type: 'command', command: 'npm test' },
          },
        ],
        mcpSettings: {
          servers: [
            {
              name: 'test-server',
              version: '1.0.0',
              config: {},
            },
          ],
        },
        taskTemplates: [],
        projectSettings: {
          specification_driven: true,
          auto_test: true,
        },
      };

      const context = await strategy.normalize(kiroData);

      expect(context.version).toBe('1.0.0');
      expect(context.metadata.platforms).toContain(AIPlatform.KIRO);
      expect(context.ide?.data?.kiro).toBeDefined();
      expect(context.ide?.data?.kiro?.steering_rules).toHaveLength(1);
      expect(context.ide?.data?.kiro?.hooks).toHaveLength(1);
      expect(context.project?.data?.kiro_specs).toHaveLength(1);
      expect(context.tools?.data?.mcp_servers).toHaveLength(1);
    });

    it('should create minimal context without optional data', async () => {
      const kiroData = {
        specs: [],
        steeringRules: [],
        hooks: [],
        taskTemplates: [],
      };

      const context = await strategy.normalize(kiroData);

      expect(context.version).toBe('1.0.0');
      expect(context.metadata.platforms).toContain(AIPlatform.KIRO);
      expect(context.ide?.data?.kiro).toBeDefined();
      expect(context.project).toBeUndefined();
      expect(context.tools).toBeUndefined();
    });
  });

  describe('validate', () => {
    it('should validate valid Kiro data', async () => {
      const kiroData = {
        specs: [{ name: 'feature1' }],
        steeringRules: [{ name: 'principle' }],
        hooks: [
          {
            name: 'pre-commit',
            version: '1.0.0',
            enabled: true,
            when: { type: 'pre-commit' },
            then: { type: 'command' },
          },
        ],
      };

      const result = await strategy.validate(kiroData);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should warn when no specs found', async () => {
      const kiroData = {
        specs: [],
        steeringRules: [{ name: 'principle' }],
      };

      const result = await strategy.validate(kiroData);

      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.[0].message).toContain('No specifications found');
    });

    it('should warn when no steering rules found', async () => {
      const kiroData = {
        specs: [{ name: 'feature1' }],
        steeringRules: [],
      };

      const result = await strategy.validate(kiroData);

      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.[0].message).toContain('No steering rules found');
    });

    it('should error on invalid hook without name', async () => {
      const kiroData = {
        specs: [],
        steeringRules: [],
        hooks: [
          {
            version: '1.0.0',
            enabled: true,
          } as any,
        ],
      };

      const result = await strategy.validate(kiroData);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].message).toContain('missing required name');
    });

    it('should error on invalid hook without version', async () => {
      const kiroData = {
        specs: [],
        steeringRules: [],
        hooks: [
          {
            name: 'test-hook',
            enabled: true,
          } as any,
        ],
      };

      const result = await strategy.validate(kiroData);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].message).toContain('missing required version');
    });
  });

  describe('build', () => {
    it('should build complete context from Kiro project', async () => {
      // Mock detect to return true
      vi.mocked(fileSystemUtility.exists).mockImplementation((path: string) => {
        if (path.endsWith('.kiro')) return Promise.resolve(true);
        if (path.endsWith('specs')) return Promise.resolve(true);
        if (path.endsWith('steering')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      // Mock empty directories for simple extraction
      vi.mocked(fileSystemUtility.readDirectory).mockResolvedValue([]);

      const context = await strategy.build('/project');

      expect(context.version).toBe('1.0.0');
      expect(context.metadata.platforms).toContain(AIPlatform.KIRO);
      expect(context.ide?.data?.kiro).toBeDefined();
    });

    it('should complete build even with invalid hooks filtered out', async () => {
      // Mock detect to return true
      vi.mocked(fileSystemUtility.exists).mockImplementation((path: string) => {
        if (path.endsWith('.kiro')) return Promise.resolve(true);
        if (path.endsWith('specs')) return Promise.resolve(true);
        if (path.endsWith('steering')) return Promise.resolve(true);
        if (path.endsWith('hooks')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      vi.mocked(fileSystemUtility.readDirectory).mockImplementation(
        (path: string) => {
          if (path.endsWith('hooks')) {
            return Promise.resolve(['invalid.json']);
          }
          return Promise.resolve([]);
        },
      );

      vi.mocked(fileSystemUtility.readJson).mockResolvedValue({
        // Invalid hook without name - will be filtered out
        version: '1.0.0',
        enabled: true,
      });

      // Should succeed because invalid hooks are filtered out
      const context = await strategy.build('/project');
      expect(context).toBeDefined();
      expect(context.ide?.data?.kiro?.hooks).toEqual([]);
    });
  });

  describe('convert', () => {
    it('should convert TaptikContext back to Kiro format', async () => {
      const context = {
        version: '1.0.0',
        metadata: {
          name: 'Test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          platforms: [AIPlatform.KIRO],
        },
        ide: {
          category: 'ide' as const,
          spec_version: '1.0.0',
          data: {
            kiro: {
              steering_rules: [
                {
                  name: 'principle',
                  rules: ['Clean code'],
                  priority: 100,
                },
              ],
              hooks: [
                {
                  name: 'pre-commit',
                  version: '1.0.0',
                  enabled: true,
                  when: { type: 'pre-commit' },
                  then: { type: 'command', command: 'npm test' },
                },
              ],
            },
          },
        },
        project: {
          category: 'project' as const,
          spec_version: '1.0.0',
          data: {
            kiro_specs: [{ name: 'feature1' }],
          },
        },
        tools: {
          category: 'tools' as const,
          spec_version: '1.0.0',
          data: {
            mcp_servers: [
              {
                name: 'test-server',
                version: '1.0.0',
                config: {},
              },
            ],
          },
        },
      };

      const result = await strategy.convert(context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      const data = result.data as Record<string, any>;
      expect(data?.specs).toHaveLength(1);
      expect(data?.steeringRules).toHaveLength(1);
      expect(data?.hooks).toHaveLength(1);
      expect(data?.mcpSettings?.servers).toHaveLength(1);
    });

    it('should fail conversion without Kiro configuration', async () => {
      const context = {
        version: '1.0.0',
        metadata: {
          name: 'Test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      const result = await strategy.convert(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No Kiro configuration found');
    });
  });
});
