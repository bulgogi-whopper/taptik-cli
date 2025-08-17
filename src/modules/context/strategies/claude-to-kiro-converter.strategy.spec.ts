/* eslint-disable unicorn/no-thenable */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AIPlatform, TaptikContext } from '../interfaces';

import { ClaudeToKiroConverterStrategy } from './claude-to-kiro-converter.strategy';

describe('ClaudeToKiroConverterStrategy', () => {
  let strategy: ClaudeToKiroConverterStrategy;
  let mockReverseFeatureMappingService: any;
  let mockFileSystem: any;

  beforeEach(() => {
    mockReverseFeatureMappingService = {
      reverseMap: vi.fn(),
    };

    mockFileSystem = {
      ensureDirectory: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      writeJson: vi.fn().mockResolvedValue(undefined),
    };

    strategy = new ClaudeToKiroConverterStrategy(
      mockReverseFeatureMappingService as any,
      mockFileSystem as any,
    );
  });

  describe('canConvert', () => {
    it('should always return true', () => {
      expect(strategy.canConvert()).toBe(true);
    });
  });

  describe('convert', () => {
    it('should successfully convert Claude Code context to Kiro', async () => {
      const context: TaptikContext = {
        version: '1.0.0',
        metadata: {
          name: 'test-claude-context',
          created_at: new Date().toISOString(),
          platforms: [AIPlatform.CLAUDE_CODE],
        },
        personal: {},
        project: {},
        prompts: {},
        tools: {},
        ide: {
          data: {
            claude_code: {
              claude_md: '# Project Instructions\n\nTest instructions',
              claude_local_md:
                '# Custom Instructions\n\nTest custom instructions',
              mcp_servers: [{ name: 'test-server' }],
              commands: [{ name: 'test-cmd', command: 'echo test' }],
              settings: { version: '1.0.0' },
            },
          },
        },
      };

      const mockMappingResult = {
        mappedFeatures: new Map([
          [
            'specs',
            { design: 'Test design', requirements: 'Test requirements' },
          ],
          ['steering_rules', [{ name: 'test_rule', rules: ['Rule content'] }]],
          ['hooks', [{ name: 'test_hook', command: 'echo test' }]],
          ['mcp_settings', [{ name: 'test-server' }]],
        ]),
        reversedFeatures: new Map([
          [
            'specs',
            { design: 'Test design', requirements: 'Test requirements' },
          ],
          ['steering_rules', [{ name: 'test_rule', rules: ['Rule content'] }]],
          ['hooks', [{ name: 'test_hook', command: 'echo test' }]],
          ['mcp_settings', [{ name: 'test-server' }]],
        ]),
        warnings: [],
        unmappedFeatures: [],
      };

      mockReverseFeatureMappingService.reverseMap.mockResolvedValue(
        mockMappingResult as any,
      );

      const result = await strategy.convert(context);

      expect(result.success).toBe(true);
      expect(result.context).toBeDefined();
      expect(result.context?.ide?.data?.kiro).toBeDefined();
      expect(result.context?.metadata?.conversion).toMatchObject({
        source: AIPlatform.CLAUDE_CODE,
        target: AIPlatform.KIRO,
      });
    });

    it('should handle missing Claude Code configuration', async () => {
      const context: TaptikContext = {
        version: '1.0.0',
        metadata: {
          name: 'test-claude-context-missing',
          created_at: new Date().toISOString(),
          platforms: [AIPlatform.CLAUDE_CODE],
        },
        personal: {},
        project: {},
        prompts: {},
        tools: {},
        ide: {
          data: {},
        },
      };

      const result = await strategy.convert(context);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'No Claude Code configuration found in context',
      );
    });

    it('should handle conversion errors', async () => {
      const context: TaptikContext = {
        version: '1.0.0',
        metadata: {
          name: 'test-claude-context-error',
          created_at: new Date().toISOString(),
          platforms: [AIPlatform.CLAUDE_CODE],
        },
        personal: {},
        project: {},
        prompts: {},
        tools: {},
        ide: {
          data: {
            claude_code: {
              claude_md: 'Test',
            },
          },
        },
      };

      mockReverseFeatureMappingService.reverseMap.mockRejectedValue(
        new Error('Mapping failed'),
      );

      const result = await strategy.convert(context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Mapping failed');
    });
  });

  describe('validateCompatibility', () => {
    it('should validate compatibility with all features', async () => {
      const context: TaptikContext = {
        version: '1.0.0',
        metadata: {
          name: 'test-claude-context-compatibility',
          created_at: new Date().toISOString(),
          platforms: [AIPlatform.CLAUDE_CODE],
        },
        personal: {},
        project: {},
        prompts: {},
        tools: {},
        ide: {
          data: {
            claude_code: {
              claude_md: '# Project Instructions',
              claude_local_md: '# Custom Instructions',
              mcp_servers: [{ name: 'test' }],
              commands: [{ name: 'cmd' }],
              settings: { version: '1.0.0' },
            },
          },
        },
      };

      const report = await strategy.validateCompatibility(context);

      expect(report.compatible).toBe(true);
      expect(report.score).toBeGreaterThanOrEqual(60);
      expect(report.supported_features).toContain('instructions');
      expect(report.supported_features).toContain('custom_instructions');
      expect(report.supported_features).toContain('mcp_servers');
    });

    it('should handle missing Claude Code configuration', async () => {
      const context: TaptikContext = {
        version: '1.0.0',
        metadata: {
          name: 'test-claude-context-no-config',
          created_at: new Date().toISOString(),
          platforms: [AIPlatform.CLAUDE_CODE],
        },
        personal: {},
        project: {},
        prompts: {},
        tools: {},
        ide: {
          data: {},
        },
      };

      const report = await strategy.validateCompatibility(context);

      expect(report.compatible).toBe(false);
      expect(report.score).toBe(0);
      expect(report.unsupported_features).toContain(
        'No Claude Code configuration found',
      );
    });
  });

  describe('getFeatureMapping', () => {
    it('should return correct feature mappings', () => {
      const mapping = strategy.getFeatureMapping();

      expect(mapping.direct_mappings.get('mcp_servers')).toBe('mcp_settings');
      expect(mapping.direct_mappings.get('mcp')).toBe('mcp_settings');

      expect(mapping.approximations.get('claude_md')).toMatchObject({
        source_feature: 'instructions',
        target_approximation: 'Kiro specs',
        confidence: 'high',
      });

      expect(mapping.unsupported).toContain('permissions');
      expect(mapping.unsupported).toContain('env');
    });
  });

  describe('deploy', () => {
    it('should successfully deploy Kiro configuration', async () => {
      const context: TaptikContext = {
        version: '1.0.0',
        metadata: {
          name: 'test-kiro-context',
          created_at: new Date().toISOString(),
          platforms: [AIPlatform.KIRO],
        },
        personal: {},
        project: {
          data: {
            claude_instructions: 'Test instructions',
          },
        },
        prompts: {},
        tools: {},
        ide: {
          data: {
            kiro: {
              specs_path: '.kiro/specs',
              steering_rules: [
                {
                  name: 'test_rule',
                  description: 'Test Rule',
                  rules: ['Rule content'],
                  priority: 0,
                },
              ],
              hooks: [
                {
                  name: 'test_hook',
                  enabled: true,
                  description: 'Test hook',
                  version: '1.0.0',
                  when: { type: 'manual', patterns: [] },
                   
                  then: { type: 'command', command: 'echo test' },
                },
              ],
              mcp_settings: { servers: [] },
              project_settings: {
                specification_driven: true,
                auto_test: true,
                incremental_progress: true,
                task_confirmation: true,
              },
            },
          },
        },
      };

      const result = await strategy.deploy(context);

      expect(result.success).toBe(true);
      expect(result.deployedFiles).toContain('.kiro/specs/requirements.md');
      expect(result.deployedFiles).toContain('.kiro/steering/test_rule.md');
      expect(result.deployedFiles).toContain('.kiro/hooks/hooks.json');
      expect(result.deployedFiles).toContain('.kiro/settings/mcp.json');
      expect(result.deployedFiles).toContain('.kiro/settings/project.json');

      expect(mockFileSystem.ensureDirectory).toHaveBeenCalledWith(
        expect.stringContaining('.kiro'),
      );
      expect(mockFileSystem.writeFile).toHaveBeenCalled();
      expect(mockFileSystem.writeJson).toHaveBeenCalled();
    });

    it('should handle missing Kiro configuration', async () => {
      const context: TaptikContext = {
        version: '1.0.0',
        metadata: {
          name: 'test-kiro-context-missing',
          created_at: new Date().toISOString(),
          platforms: [AIPlatform.KIRO],
        },
        personal: {},
        project: {},
        prompts: {},
        tools: {},
        ide: {
          data: {},
        },
      };

      const result = await strategy.deploy(context);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('No Kiro configuration in context');
    });

    it('should handle deployment errors', async () => {
      const context: TaptikContext = {
        version: '1.0.0',
        metadata: {
          name: 'test-kiro-context-error',
          created_at: new Date().toISOString(),
          platforms: [AIPlatform.KIRO],
        },
        personal: {},
        project: {},
        prompts: {},
        tools: {},
        ide: {
          data: {
            kiro: {
              specs_path: '.kiro/specs',
            },
          },
        },
      };

      mockFileSystem.ensureDirectory.mockRejectedValue(
        new Error('Permission denied'),
      );

      const result = await strategy.deploy(context);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Permission denied');
    });
  });

  describe('private methods', () => {
    describe('parseMarkdownToRules', () => {
      it('should parse markdown sections into steering rules', () => {
        const markdown = `## Code Style
Follow best practices

## Testing
Write comprehensive tests`;

        const parseMethod = strategy['parseMarkdownToRules'];
        const rules = parseMethod.call(strategy, markdown);

        expect(rules).toHaveLength(2);
        expect(rules[0]).toMatchObject({
          name: 'code_style',
          description: 'Code Style',
          rules: ['Follow best practices'],
        });
        expect(rules[1]).toMatchObject({
          name: 'testing',
          description: 'Testing',
          rules: ['Write comprehensive tests'],
        });
      });
    });

    describe('convertToHooks', () => {
      it('should convert array of commands to hooks', () => {
        const commands = [
          {
            name: 'build',
            command: 'npm run build',
            description: 'Build project',
          },
          { name: 'test', command: 'npm test' },
        ];

        const convertMethod = strategy['convertToHooks'];
        const hooks = convertMethod.call(strategy, commands);

        expect(hooks).toHaveLength(2);
        expect(hooks[0]).toMatchObject({
          name: 'build',
          enabled: true,
          description: 'Build project',
          when: { type: 'manual' },
          then: { type: 'command', command: 'npm run build' },
        });
      });

      it('should convert object of commands to hooks', () => {
        const commands = {
          build: 'npm run build',
          test: 'npm test',
        };

        const convertMethod = strategy['convertToHooks'];
        const hooks = convertMethod.call(strategy, commands);

        expect(hooks).toHaveLength(2);
        expect(hooks[0]).toMatchObject({
          name: 'build',
          enabled: true,
          then: { type: 'command', command: 'npm run build' },
        });
      });
    });
  });
});
