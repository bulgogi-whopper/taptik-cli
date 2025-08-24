import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach } from 'vitest';

import {
  ClaudeCodeLocalSettings,
  ClaudeCodeGlobalSettings,
  ClaudeAgent,
  McpConfig,
} from '../../../context/interfaces/cloud.interface';

import { TransformationService } from './transformation.service';

describe('TransformationService - Claude Code Extensions', () => {
  let service: TransformationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransformationService],
    }).compile();

    service = module.get<TransformationService>(TransformationService);
  });

  describe('transformClaudeCodePersonalContext', () => {
    it('should transform Claude Code personal settings to Taptik format', async () => {
      const localData: ClaudeCodeLocalSettings = {
        settings: {
          theme: 'dark',
          autoSave: true,
          features: {
            gitIntegration: true,
            dockerSupport: false,
            autocomplete: true,
          },
        },
        agents: [
          {
            id: 'agent1',
            name: 'Code Review Agent',
            prompt: 'Review code for best practices',
          },
        ],
      };

      const globalData: ClaudeCodeGlobalSettings = {
        settings: {
          theme: 'light',
          autoSave: false,
        },
      };

      const result = await service.transformClaudeCodePersonalContext(
        localData,
        globalData,
      );

      expect(result).toBeDefined();
      expect(result.preferences).toBeDefined();
      expect(result.preferences.preferred_languages).toContain('typescript');
      expect(result.metadata).toBeDefined();
      expect(result.metadata.created_at).toBeDefined();
    });

    it('should handle missing local settings gracefully', async () => {
      const localData: ClaudeCodeLocalSettings = {};
      const globalData: ClaudeCodeGlobalSettings = {
        settings: {
          theme: 'light',
        },
      };

      const result = await service.transformClaudeCodePersonalContext(
        localData,
        globalData,
      );

      expect(result).toBeDefined();
      expect(result.preferences).toBeDefined();
      expect(result.preferences.preferred_languages).toContain('typescript');
    });

    it('should prioritize local settings over global settings', async () => {
      const localData: ClaudeCodeLocalSettings = {
        settings: {
          theme: 'dark',
          autoSave: true,
        },
      };

      const globalData: ClaudeCodeGlobalSettings = {
        settings: {
          theme: 'light',
          autoSave: false,
        },
      };

      const result = await service.transformClaudeCodePersonalContext(
        localData,
        globalData,
      );

      expect(result.preferences.preferred_languages).toContain('typescript');
    });

    it('should map Claude agents to personal context', async () => {
      const localData: ClaudeCodeLocalSettings = {
        agents: [
          {
            id: 'agent1',
            name: 'Test Agent',
            prompt: 'Test prompt',
          },
        ],
      };

      const globalData: ClaudeCodeGlobalSettings = {};

      const result = await service.transformClaudeCodePersonalContext(
        localData,
        globalData,
      );

      expect(result.work_style).toBeDefined();
      expect(result.work_style.preferred_workflow).toBe('agile');
    });

    it('should handle empty input data', async () => {
      const localData: ClaudeCodeLocalSettings = {};
      const globalData: ClaudeCodeGlobalSettings = {};

      const result = await service.transformClaudeCodePersonalContext(
        localData,
        globalData,
      );

      expect(result).toBeDefined();
      expect(result.preferences).toBeDefined();
      expect(result.metadata).toBeDefined();
    });
  });

  describe('transformClaudeCodeProjectContext', () => {
    it('should transform Claude Code project configuration to Taptik format', async () => {
      const localData: ClaudeCodeLocalSettings = {
        mcpServers: {
          servers: [
            {
              name: 'test-server',
              protocol: 'http',
              command: 'npm run server',
            },
          ],
        },
        steeringRules: [
          {
            pattern: '*.ts',
            rule: 'use TypeScript',
          },
        ],
      };

      const globalData: ClaudeCodeGlobalSettings = {};

      const result = await service.transformClaudeCodeProjectContext(
        localData,
        globalData,
      );

      expect(result).toBeDefined();
      expect(result.project_info).toBeDefined();
      expect(result.technical_stack).toBeDefined();
      expect(result.technical_stack.tools).toContain(
        'test-server: npm run server',
      );
    });

    it('should merge MCP configurations with project-level precedence', async () => {
      const localData: ClaudeCodeLocalSettings = {
        mcpServers: {
          servers: [
            {
              name: 'local-server',
              protocol: 'http',
              command: 'npm run local',
            },
          ],
        },
      };

      const globalData: ClaudeCodeGlobalSettings = {
        mcpServers: {
          servers: [
            {
              name: 'global-server',
              protocol: 'http',
              command: 'npm run global',
            },
            {
              name: 'local-server',
              protocol: 'ws',
              command: 'npm run global-local',
            },
          ],
        },
      };

      const result = await service.transformClaudeCodeProjectContext(
        localData,
        globalData,
      );

      expect(result.technical_stack.tools).toContain(
        'local-server: npm run local',
      );
      expect(result.technical_stack.tools).toContain(
        'global-server: npm run global',
      );
      const localServerConfig = result.technical_stack.tools.find(
        (tool: string) => tool.includes('local-server'),
      );
      expect(localServerConfig).toContain('npm run local');
    });

    it('should transform steering rules to development guidelines', async () => {
      const localData: ClaudeCodeLocalSettings = {
        steeringRules: [
          {
            pattern: '*.tsx',
            rule: 'use React best practices',
          },
          {
            pattern: '*.spec.ts',
            rule: 'follow TDD principles',
          },
        ],
      };

      const globalData: ClaudeCodeGlobalSettings = {};

      const result = await service.transformClaudeCodeProjectContext(
        localData,
        globalData,
      );

      expect(result.development_guidelines).toBeDefined();
      expect(result.development_guidelines.testing_requirements).toBeDefined();
      expect(result.development_guidelines.testing_requirements).toEqual([
        'follow TDD principles',
      ]);
      expect(result.development_guidelines.review_process).toBeDefined();
    });

    it('should handle commands as part of project context', async () => {
      const localData: ClaudeCodeLocalSettings = {
        commands: [
          {
            name: 'build',
            command: 'npm run build',
          },
          {
            name: 'test',
            command: 'npm test',
          },
        ],
      };

      const globalData: ClaudeCodeGlobalSettings = {};

      const result = await service.transformClaudeCodeProjectContext(
        localData,
        globalData,
      );

      expect(result.technical_stack.tools).toContain('build: npm run build');
      expect(result.technical_stack.tools).toContain('test: npm test');
    });

    it('should include project metadata', async () => {
      const localData: ClaudeCodeLocalSettings = {};
      const globalData: ClaudeCodeGlobalSettings = {};

      const result = await service.transformClaudeCodeProjectContext(
        localData,
        globalData,
      );

      expect(result.metadata).toBeDefined();
      expect(result.metadata.created_at).toBeDefined();
      expect(result.metadata.version).toBeDefined();
    });
  });

  describe('transformClaudeCodePromptTemplates', () => {
    it('should transform Claude agents to prompt templates', async () => {
      const localData: ClaudeCodeLocalSettings = {
        agents: [
          {
            id: 'review-agent',
            name: 'Code Review Agent',
            prompt: 'Review code for quality and suggest improvements',
          },
          {
            id: 'test-agent',
            name: 'Test Writer',
            prompt: 'Write comprehensive unit tests',
          },
        ],
      };

      const globalData: ClaudeCodeGlobalSettings = {};

      const result = await service.transformClaudeCodePromptTemplates(
        localData,
        globalData,
      );

      expect(result).toBeDefined();
      expect(result.templates).toHaveLength(2);
      expect(result.templates[0].name).toBe('Code Review Agent');
      expect(result.templates[0].content).toContain('Review code for quality');
      expect(result.templates[0].category).toBe('claude-agent');
    });

    it('should transform steering rules to prompt templates', async () => {
      const localData: ClaudeCodeLocalSettings = {
        steeringRules: [
          {
            pattern: '*.ts',
            rule: 'Always use TypeScript strict mode',
          },
        ],
      };

      const globalData: ClaudeCodeGlobalSettings = {};

      const result = await service.transformClaudeCodePromptTemplates(
        localData,
        globalData,
      );

      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].category).toBe('steering-rule');
      expect(result.templates[0].content).toContain('TypeScript strict mode');
    });

    it('should merge Claude instruction files (CLAUDE.md + CLAUDE.local.md)', async () => {
      const localData: ClaudeCodeLocalSettings = {
        instructions: {
          global: '# Global Instructions\nFollow project standards',
          local: '# Local Instructions\nUse specific tooling',
        },
      };

      const globalData: ClaudeCodeGlobalSettings = {
        instructions: {
          global: '# Default Global\nGeneral guidelines',
        },
      };

      const result = await service.transformClaudeCodePromptTemplates(
        localData,
        globalData,
      );

      const instructionTemplate = result.templates.find(
        (t) => t.category === 'instructions',
      );
      expect(instructionTemplate).toBeDefined();
      expect(instructionTemplate?.content).toContain(
        'Follow project standards',
      );
      expect(instructionTemplate?.content).toContain('Use specific tooling');
    });

    it('should combine agents from both local and global settings', async () => {
      const localData: ClaudeCodeLocalSettings = {
        agents: [
          {
            id: 'local-agent',
            name: 'Local Agent',
            prompt: 'Local prompt',
          },
        ],
      };

      const globalData: ClaudeCodeGlobalSettings = {
        agents: [
          {
            id: 'global-agent',
            name: 'Global Agent',
            prompt: 'Global prompt',
          },
        ],
      };

      const result = await service.transformClaudeCodePromptTemplates(
        localData,
        globalData,
      );

      expect(result.templates).toHaveLength(2);
      const agentNames = result.templates.map((t) => t.name);
      expect(agentNames).toContain('Local Agent');
      expect(agentNames).toContain('Global Agent');
    });

    it('should include metadata for each prompt template', async () => {
      const localData: ClaudeCodeLocalSettings = {
        agents: [
          {
            id: 'test',
            name: 'Test Agent',
            prompt: 'Test prompt',
            metadata: { version: '1.0' },
          },
        ],
      };

      const globalData: ClaudeCodeGlobalSettings = {};

      const result = await service.transformClaudeCodePromptTemplates(
        localData,
        globalData,
      );

      expect(result.templates[0].tags).toContain('claude-code');
      expect(result.templates[0].category).toBe('claude-agent');
    });

    it('should handle empty templates gracefully', async () => {
      const localData: ClaudeCodeLocalSettings = {};
      const globalData: ClaudeCodeGlobalSettings = {};

      const result = await service.transformClaudeCodePromptTemplates(
        localData,
        globalData,
      );

      expect(result).toBeDefined();
      expect(result.templates).toBeDefined();
      expect(result.templates).toHaveLength(0);
      expect(result.metadata).toBeDefined();
    });
  });

  describe('MCP Configuration Merging', () => {
    it('should merge MCP configurations with local precedence', async () => {
      const localConfig: McpConfig = {
        servers: [
          {
            name: 'local-mcp',
            protocol: 'http',
            command: 'local-command',
          },
        ],
      };

      const globalConfig: McpConfig = {
        servers: [
          {
            name: 'global-mcp',
            protocol: 'ws',
            url: 'ws://global',
          },
          {
            name: 'local-mcp',
            protocol: 'http',
            command: 'global-command',
          },
        ],
      };

      const merged = service.mergeMcpConfigurations(localConfig, globalConfig);

      expect(merged.servers).toHaveLength(2);
      expect(merged.servers.find((s) => s.name === 'local-mcp')?.command).toBe(
        'local-command',
      );
      expect(merged.servers.find((s) => s.name === 'global-mcp')).toBeDefined();
    });

    it('should handle undefined MCP configurations', async () => {
      const merged = service.mergeMcpConfigurations(undefined, undefined);

      expect(merged).toBeDefined();
      expect(merged.servers).toHaveLength(0);
    });

    it('should preserve disabled servers', async () => {
      const localConfig: McpConfig = {
        servers: [
          {
            name: 'test-server',
            protocol: 'http',
            command: 'test',
            disabled: true,
          },
        ],
      };

      const globalConfig: McpConfig = {
        servers: [],
      };

      const merged = service.mergeMcpConfigurations(localConfig, globalConfig);

      expect(merged.servers[0].disabled).toBe(true);
    });
  });

  describe('Claude Instruction File Merging', () => {
    it('should merge CLAUDE.md and CLAUDE.local.md files', async () => {
      const globalInstructions =
        '# Global Instructions\n\nFollow these guidelines';
      const localInstructions =
        '# Local Instructions\n\nProject-specific rules';

      const merged = service.mergeClaudeInstructions(
        globalInstructions,
        localInstructions,
      );

      expect(merged).toContain('Global Instructions');
      expect(merged).toContain('Local Instructions');
      expect(merged).toContain('Follow these guidelines');
      expect(merged).toContain('Project-specific rules');
    });

    it('should handle missing instruction files', async () => {
      const merged = service.mergeClaudeInstructions(undefined, undefined);

      expect(merged).toBe('');
    });

    it('should use local instructions when global is missing', async () => {
      const localInstructions = '# Local Only\n\nLocal content';

      const merged = service.mergeClaudeInstructions(
        undefined,
        localInstructions,
      );

      expect(merged).toBe(localInstructions);
    });

    it('should use global instructions when local is missing', async () => {
      const globalInstructions = '# Global Only\n\nGlobal content';

      const merged = service.mergeClaudeInstructions(
        globalInstructions,
        undefined,
      );

      expect(merged).toBe(globalInstructions);
    });

    it('should properly format merged instructions', async () => {
      const globalInstructions = '# Global\n\nContent 1';
      const localInstructions = '# Local\n\nContent 2';

      const merged = service.mergeClaudeInstructions(
        globalInstructions,
        localInstructions,
      );

      expect(merged).toContain('# Claude Code Instructions');
      expect(merged).toContain('## Global Configuration');
      expect(merged).toContain('## Local Configuration');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed Claude agent data', async () => {
      const localData: ClaudeCodeLocalSettings = {
        agents: [
          {
            id: '',
            name: '',
            prompt: '',
          } as ClaudeAgent,
        ],
      };

      const globalData: ClaudeCodeGlobalSettings = {};

      const result = await service.transformClaudeCodePromptTemplates(
        localData,
        globalData,
      );

      expect(result.templates).toHaveLength(0);
    });

    it('should handle circular references in settings', async () => {
      const circularSettings: { theme: string; self?: unknown } = {
        theme: 'dark',
      };
      circularSettings.self = circularSettings;

      const localData: ClaudeCodeLocalSettings = {
        settings: circularSettings,
      };

      const globalData: ClaudeCodeGlobalSettings = {};

      await expect(
        service.transformClaudeCodePersonalContext(localData, globalData),
      ).resolves.toBeDefined();
    });

    it('should handle invalid MCP server configurations', async () => {
      const localData: ClaudeCodeLocalSettings = {
        mcpServers: {
          servers: [
            {
              name: '',
              protocol: '',
            } as any,
          ],
        },
      };

      const globalData: ClaudeCodeGlobalSettings = {};

      const result = await service.transformClaudeCodeProjectContext(
        localData,
        globalData,
      );

      expect(result.technical_stack.tools).toHaveLength(0);
    });

    it('should handle partial data recovery', async () => {
      const localData: ClaudeCodeLocalSettings = {
        settings: {
          theme: 'dark',
        },
        agents: [
          null as any,
          {
            id: 'valid',
            name: 'Valid Agent',
            prompt: 'Valid prompt',
          },
        ],
      };

      const globalData: ClaudeCodeGlobalSettings = {};

      const personalResult = await service.transformClaudeCodePersonalContext(
        localData,
        globalData,
      );
      expect(personalResult.preferences.preferred_languages).toContain(
        'typescript',
      );

      const promptResult = await service.transformClaudeCodePromptTemplates(
        localData,
        globalData,
      );
      expect(promptResult.templates).toHaveLength(1);
      expect(promptResult.templates[0].name).toBe('Valid Agent');
    });
  });
});
