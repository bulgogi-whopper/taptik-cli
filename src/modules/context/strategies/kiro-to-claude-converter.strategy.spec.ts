import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AIPlatform } from '../interfaces';

import { KiroToClaudeConverterStrategy } from './kiro-to-claude-converter.strategy';

describe('KiroToClaudeConverterStrategy', () => {
  let strategy: KiroToClaudeConverterStrategy;
  let mockFeatureMappingService: any;
  let mockFileSystem: any;

  const mockKiroContext = {
    version: '1.0.0',
    metadata: {
      name: 'Kiro Context',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      platforms: [AIPlatform.KIRO],
    },
    ide: {
      category: 'ide' as const,
      spec_version: '1.0.0',
      data: {
        kiro: {
          specs_path: '.kiro/specs',
          steering_rules: [
            { file: 'principle.md', content: 'Always write clean code' },
            { file: 'TDD.md', content: 'Follow TDD practices' },
          ],
          hooks: [
            {
              name: 'pre-commit',
              command: 'npm run lint',
              enabled: true,
              version: '1.0.0',
              when: { type: 'pre-commit' },
              // eslint-disable-next-line unicorn/no-thenable
              then: { type: 'command', command: 'npm run lint' },
            },
          ],
          mcp_settings: {
            servers: [{ name: 'test-server', command: 'test-cmd' }],
          },
          task_templates: [
            { name: 'template1', tasks: ['task1'] },
            { name: 'template2', tasks: ['task2'] },
          ],
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

  beforeEach(() => {
    mockFeatureMappingService = {
      mapFeatures: vi.fn().mockResolvedValue({
        success: true,
        mappedFeatures: new Map<string, any>([
          [
            'instructions',
            '# Project Instructions\n\n## Specs\nConverted specs content',
          ],
          [
            'custom_instructions',
            '# Custom Instructions\n\nSteering rules content',
          ],
          [
            'commands',
            { commands: [{ name: 'pre-commit', command: 'npm run lint' }] },
          ],
          ['mcp_servers', [{ name: 'test-server', command: 'test-cmd' }]],
          ['settings', { theme: 'dark', fontSize: 14 }],
        ]),
        unmappedFeatures: ['task_templates'],
        warnings: [],
      }),
    };

    mockFileSystem = {
      ensureDirectory: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn().mockResolvedValue(undefined),
      writeJson: vi.fn().mockResolvedValue(undefined),
    };

    strategy = new KiroToClaudeConverterStrategy(
      mockFeatureMappingService as any,
      mockFileSystem,
    );
  });

  describe('canConvert', () => {
    it('should always return true for Kiro to Claude conversion', () => {
      expect(strategy.canConvert()).toBe(true);
    });
  });

  describe('convert', () => {
    it('should successfully convert Kiro context to Claude Code', async () => {
      const result = await strategy.convert(mockKiroContext);

      expect(result.success).toBe(true);
      expect(result.context).toBeDefined();
      expect(result.context?.ide?.data?.claude_code).toBeDefined();
      expect(result.context?.metadata?.platforms).toContain(
        AIPlatform.CLAUDE_CODE,
      );
    });

    it('should include converted CLAUDE.md from specs', async () => {
      const result = await strategy.convert(mockKiroContext);

      expect(result.success).toBe(true);
      expect(result.context?.ide?.data?.claude_code?.claude_md).toContain(
        'Project Instructions',
      );
    });

    it('should include converted CLAUDE.local.md from steering rules', async () => {
      const result = await strategy.convert(mockKiroContext);

      expect(result.success).toBe(true);
      expect(result.context?.ide?.data?.claude_code?.claude_local_md).toContain(
        'Custom Instructions',
      );
    });

    it('should convert hooks to commands', async () => {
      const result = await strategy.convert(mockKiroContext);

      expect(result.success).toBe(true);
      expect(result.context?.ide?.data?.claude_code?.commands).toBeDefined();
      expect(result.context?.ide?.data?.claude_code?.commands).toHaveLength(1);
      expect(result.context?.ide?.data?.claude_code?.commands[0].name).toBe(
        'pre-commit',
      );
    });

    it('should map MCP servers directly', async () => {
      const result = await strategy.convert(mockKiroContext);

      expect(result.success).toBe(true);
      expect(result.context?.ide?.data?.claude_code?.mcp_servers).toBeDefined();
      expect(result.context?.ide?.data?.claude_code?.mcp_servers).toHaveLength(
        1,
      );
    });

    it('should convert settings appropriately', async () => {
      const result = await strategy.convert(mockKiroContext);

      expect(result.success).toBe(true);
      expect(result.context?.ide?.data?.claude_code?.settings).toBeDefined();
      expect(result.context?.ide?.data?.claude_code?.settings.theme).toBe(
        'dark',
      );
    });

    it('should report unsupported features', async () => {
      const result = await strategy.convert(mockKiroContext);

      expect(result.success).toBe(true);
      expect(result.unsupported_features).toContain('task_templates');
    });

    it('should fail when no Kiro configuration found', async () => {
      const invalidContext = {
        ...mockKiroContext,
        ide: {
          ...mockKiroContext.ide,
          data: {},
        },
      };

      const result = await strategy.convert(invalidContext as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No Kiro configuration found');
    });

    it('should add conversion metadata', async () => {
      const result = await strategy.convert(mockKiroContext);

      expect(result.success).toBe(true);
      expect(result.context?.metadata?.conversion).toBeDefined();
      expect(result.context?.metadata?.conversion?.source).toBe(
        AIPlatform.KIRO,
      );
      expect(result.context?.metadata?.conversion?.target).toBe(
        AIPlatform.CLAUDE_CODE,
      );
    });

    it('should handle empty mappedFeatures gracefully', async () => {
      mockFeatureMappingService.mapFeatures.mockResolvedValue({
        success: true,
        mappedFeatures: new Map(),
        unmappedFeatures: [],
        warnings: [],
      });

      const result = await strategy.convert(mockKiroContext);

      expect(result.success).toBe(true);
      expect(result.context?.ide?.data?.claude_code?.settings).toBeDefined();
      expect(result.context?.ide?.data?.claude_code?.settings.version).toBe(
        '1.0.0',
      );
    });
  });

  describe('validateCompatibility', () => {
    it('should validate compatible features', async () => {
      const report = await strategy.validateCompatibility(mockKiroContext);

      expect(report.compatible).toBe(true);
      expect(report.score).toBeGreaterThan(60);
      expect(report.supported_features).toContain('specs');
      expect(report.supported_features).toContain('steering_rules');
      expect(report.supported_features).toContain('mcp_servers');
    });

    it('should identify unsupported features', async () => {
      const report = await strategy.validateCompatibility(mockKiroContext);

      expect(report.unsupported_features).toContain('task_templates');
    });

    it('should provide partial support details', async () => {
      const report = await strategy.validateCompatibility(mockKiroContext);

      const specsSupport = report.partial_support.find(
        (p) => p.feature === 'specs',
      );
      expect(specsSupport).toBeDefined();
      expect(specsSupport?.support_level).toBe(80);
      expect(specsSupport?.notes).toContain('CLAUDE.md');
    });

    it('should handle missing Kiro configuration', async () => {
      const invalidContext = {
        ...mockKiroContext,
        ide: {
          ...mockKiroContext.ide,
          data: {},
        },
      };

      const report = await strategy.validateCompatibility(
        invalidContext as any,
      );

      expect(report.compatible).toBe(false);
      expect(report.score).toBe(0);
      expect(report.unsupported_features).toContain(
        'No Kiro configuration found',
      );
    });

    it('should calculate compatibility score correctly', async () => {
      const minimalContext = {
        ...mockKiroContext,
        ide: {
          ...mockKiroContext.ide,
          data: {
            kiro: {
              specs_path: '.kiro/specs',
            },
          },
        },
      };

      const report = await strategy.validateCompatibility(minimalContext);

      expect(report.compatible).toBe(true);
      expect(report.score).toBeGreaterThan(0);
    });
  });

  describe('getFeatureMapping', () => {
    it('should provide complete feature mapping', () => {
      const mapping = strategy.getFeatureMapping();

      expect(mapping.direct_mappings.has('mcp_settings')).toBe(true);
      expect(mapping.direct_mappings.get('mcp_settings')).toBe('mcp_servers');

      expect(mapping.approximations.has('specs_path')).toBe(true);
      expect(mapping.approximations.has('steering_rules')).toBe(true);
      expect(mapping.approximations.has('hooks')).toBe(true);

      expect(mapping.unsupported).toContain('task_templates');
    });

    it('should provide confidence levels for approximations', () => {
      const mapping = strategy.getFeatureMapping();

      const specsApprox = mapping.approximations.get('specs_path');
      expect(specsApprox?.confidence).toBe('high');

      const hooksApprox = mapping.approximations.get('hooks');
      expect(hooksApprox?.confidence).toBe('medium');
    });
  });

  describe('deploy', () => {
    it('should deploy converted context to file system', async () => {
      const convertedContext = {
        ...mockKiroContext,
        ide: {
          ...mockKiroContext.ide,
          data: {
            ...mockKiroContext.ide.data,
            claude_code: {
              claude_md: '# Project Instructions',
              claude_local_md: '# Custom Instructions',
              settings: { specification_driven: true },
              mcp_servers: [{ name: 'server1', command: 'cmd1' }],
              commands: [{ name: 'cmd1', command: 'npm test' }],
            },
          },
        },
      };

      const result = await strategy.deploy(convertedContext, '/test/path');

      expect(result.success).toBe(true);
      expect(result.deployedFiles).toContain('CLAUDE.md');
      expect(result.deployedFiles).toContain('CLAUDE.local.md');
      expect(result.deployedFiles).toContain('.claude/settings.json');
      expect(result.deployedFiles).toContain('.claude/mcp.json');
      expect(result.deployedFiles).toContain('.claude/commands.json');
    });

    it('should create .claude directory if it does not exist', async () => {
      const convertedContext = {
        ...mockKiroContext,
        ide: {
          ...mockKiroContext.ide,
          data: {
            claude_code: {
              settings: { specification_driven: true },
            },
          },
        },
      };

      await strategy.deploy(convertedContext, '/test/path');

      expect(mockFileSystem.ensureDirectory).toHaveBeenCalledWith(
        '/test/path/.claude',
      );
    });

    it('should handle partial deployments', async () => {
      const convertedContext = {
        ...mockKiroContext,
        ide: {
          ...mockKiroContext.ide,
          data: {
            claude_code: {
              claude_md: '# Project Instructions',
              // Only CLAUDE.md, no other files
            },
          },
        },
      };

      const result = await strategy.deploy(convertedContext, '/test/path');

      expect(result.success).toBe(true);
      expect(result.deployedFiles).toContain('CLAUDE.md');
      expect(result.deployedFiles).toHaveLength(1);
    });

    it('should fail when no Claude Code configuration found', async () => {
      const invalidContext = {
        ...mockKiroContext,
        ide: {
          ...mockKiroContext.ide,
          data: {},
        },
      };

      const result = await strategy.deploy(invalidContext as any, '/test/path');

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'No Claude Code configuration in context',
      );
    });

    it('should handle deployment errors gracefully', async () => {
      mockFileSystem.ensureDirectory.mockRejectedValue(
        new Error('Permission denied'),
      );

      const convertedContext = {
        ...mockKiroContext,
        ide: {
          ...mockKiroContext.ide,
          data: {
            claude_code: {
              settings: { specification_driven: true },
            },
          },
        },
      };

      const result = await strategy.deploy(convertedContext, '/test/path');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Permission denied');
    });
  });
});
