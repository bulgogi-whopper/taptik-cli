import { describe, it, expect, beforeEach } from 'vitest';

import { AIPlatform } from '../interfaces';

import { FeatureMappingService } from './feature-mapping.service';

describe('FeatureMappingService', () => {
  let service: FeatureMappingService;

  beforeEach(() => {
    service = new FeatureMappingService();
  });

  describe('getMappings', () => {
    it('should get Kiro to Claude Code mappings', () => {
      const mappings = service.getMappings(
        AIPlatform.KIRO,
        AIPlatform.CLAUDE_CODE,
      );

      expect(mappings).toBeDefined();
      expect(mappings.length).toBeGreaterThan(0);

      // Check for essential mappings
      const specMapping = mappings.find((m) => m.source.feature === 'specs');
      expect(specMapping).toBeDefined();
      expect(specMapping?.target.feature).toBe('instructions');

      const steeringMapping = mappings.find(
        (m) => m.source.feature === 'steering',
      );
      expect(steeringMapping).toBeDefined();
      expect(steeringMapping?.target.feature).toBe('custom_instructions');
    });

    it('should get Claude Code to Kiro mappings', () => {
      const mappings = service.getMappings(
        AIPlatform.CLAUDE_CODE,
        AIPlatform.KIRO,
      );

      expect(mappings).toBeDefined();
      expect(mappings.length).toBeGreaterThan(0);

      const instructionMapping = mappings.find(
        (m) => m.source.feature === 'instructions',
      );
      expect(instructionMapping).toBeDefined();
      expect(instructionMapping?.target.feature).toBe('specs');
    });

    it('should get Kiro to Cursor mappings', () => {
      const mappings = service.getMappings(AIPlatform.KIRO, AIPlatform.CURSOR);

      expect(mappings).toBeDefined();
      expect(mappings.length).toBeGreaterThan(0);

      const rulesMapping = mappings.find(
        (m) => m.source.feature === 'steering',
      );
      expect(rulesMapping).toBeDefined();
      expect(rulesMapping?.target.feature).toBe('rules');
    });

    it('should return empty array for unsupported mapping', () => {
      const mappings = service.getMappings(
        AIPlatform.CURSOR,
        AIPlatform.CLAUDE_CODE,
      );

      expect(mappings).toEqual([]);
    });
  });

  describe('mapFeatures', () => {
    it('should map Kiro specs to Claude instructions', async () => {
      const sourceData = {
        specs: [
          {
            name: 'Feature A',
            design: 'Design content',
            requirements: 'Requirements content',
            tasks: 'Tasks content',
          },
        ],
      };

      const result = await service.mapFeatures(
        sourceData,
        AIPlatform.KIRO,
        AIPlatform.CLAUDE_CODE,
      );

      expect(result.success).toBe(true);
      expect(result.mappedFeatures.has('instructions')).toBe(true);

      const instructions = result.mappedFeatures.get('instructions');
      expect(instructions).toContain('# Project Instructions');
      expect(instructions).toContain('## Feature A');
      expect(instructions).toContain('### Design');
      expect(instructions).toContain('Design content');
    });

    it('should map Kiro steering to Claude custom instructions', async () => {
      const sourceData = {
        steering: [
          { content: 'Principle 1: Always write clean code' },
          { content: 'Principle 2: Follow TDD' },
        ],
      };

      const result = await service.mapFeatures(
        sourceData,
        AIPlatform.KIRO,
        AIPlatform.CLAUDE_CODE,
      );

      expect(result.success).toBe(true);
      expect(result.mappedFeatures.has('custom_instructions')).toBe(true);

      const custom = result.mappedFeatures.get('custom_instructions');
      expect(custom).toContain('# Custom Instructions');
      expect(custom).toContain('Principle 1: Always write clean code');
      expect(custom).toContain('Principle 2: Follow TDD');
    });

    it('should map Kiro hooks to Claude commands', async () => {
      const sourceData = {
        hooks: [
          {
            name: 'pre-commit',
            event: 'pre-commit',
            command: 'npm run lint',
            description: 'Run linter before commit',
          },
        ],
      };

      const result = await service.mapFeatures(
        sourceData,
        AIPlatform.KIRO,
        AIPlatform.CLAUDE_CODE,
      );

      expect(result.success).toBe(true);
      expect(result.mappedFeatures.has('commands')).toBe(true);

      const commands = result.mappedFeatures.get('commands');
      expect(commands.commands).toHaveLength(1);
      expect(commands.commands[0].name).toBe('pre-commit');
      expect(commands.commands[0].command).toBe('npm run lint');
    });

    it('should handle MCP servers bidirectionally', async () => {
      const sourceData = {
        mcp_servers: {
          servers: [{ name: 'test-server', command: 'test-cmd' }],
        },
      };

      const result = await service.mapFeatures(
        sourceData,
        AIPlatform.KIRO,
        AIPlatform.CLAUDE_CODE,
      );

      expect(result.success).toBe(true);
      expect(result.mappedFeatures.has('mcp_servers')).toBe(true);

      const servers = result.mappedFeatures.get('mcp_servers');
      expect(servers).toEqual(sourceData.mcp_servers);
    });

    it('should track unmapped features', async () => {
      const sourceData = {
        unknown_feature: 'some value',
      };

      const result = await service.mapFeatures(
        sourceData,
        AIPlatform.KIRO,
        AIPlatform.CLAUDE_CODE,
      );

      expect(result.unmappedFeatures).toContain('specs');
      expect(result.unmappedFeatures).toContain('steering');
      expect(result.unmappedFeatures).toContain('hooks');
    });

    it('should handle mapping errors gracefully', async () => {
      const sourceData = {
        specs: null, // This might cause an error in transform
      };

      const result = await service.mapFeatures(
        sourceData,
        AIPlatform.KIRO,
        AIPlatform.CLAUDE_CODE,
      );

      // Should still return a result, even if some mappings fail
      expect(result).toBeDefined();
      expect(result.unmappedFeatures).toContain('specs');
    });

    it('should respect mapping priority', async () => {
      const sourceData = {
        specs: [{ name: 'Spec1' }],
        steering: [{ content: 'Rule1' }],
        hooks: [{ name: 'Hook1' }],
      };

      const result = await service.mapFeatures(
        sourceData,
        AIPlatform.KIRO,
        AIPlatform.CLAUDE_CODE,
      );

      // Mappings should be processed in priority order
      expect(result.mappedFeatures.has('instructions')).toBe(true); // priority 1
      expect(result.mappedFeatures.has('custom_instructions')).toBe(true); // priority 2
      expect(result.mappedFeatures.has('commands')).toBe(true); // priority 3
    });
  });

  describe('reverse mappings', () => {
    it('should map Claude instructions to Kiro specs', async () => {
      const sourceData = {
        instructions: `# Project Instructions

## Feature A
This is the feature A description.

## Feature B
This is the feature B description.`,
      };

      const result = await service.mapFeatures(
        sourceData,
        AIPlatform.CLAUDE_CODE,
        AIPlatform.KIRO,
      );

      expect(result.success).toBe(true);
      expect(result.mappedFeatures.has('specs')).toBe(true);

      const specs = result.mappedFeatures.get('specs');
      expect(Array.isArray(specs)).toBe(true);
      expect(specs.length).toBeGreaterThan(0);
    });

    it('should map Claude commands to Kiro hooks', async () => {
      const sourceData = {
        commands: {
          commands: [
            {
              name: 'test-command',
              command: 'npm test',
              trigger: 'pre-push',
              description: 'Run tests',
            },
          ],
        },
      };

      const result = await service.mapFeatures(
        sourceData,
        AIPlatform.CLAUDE_CODE,
        AIPlatform.KIRO,
      );

      expect(result.success).toBe(true);
      expect(result.mappedFeatures.has('hooks')).toBe(true);

      const hooks = result.mappedFeatures.get('hooks');
      expect(Array.isArray(hooks)).toBe(true);
      expect(hooks[0].name).toBe('test-command');
      expect(hooks[0].event).toBe('pre-push');
    });
  });

  describe('cursor mappings', () => {
    it('should map Kiro steering to Cursor rules', async () => {
      const sourceData = {
        steering: [
          { content: 'Rule 1: Use TypeScript' },
          { content: 'Rule 2: Write tests' },
        ],
      };

      const result = await service.mapFeatures(
        sourceData,
        AIPlatform.KIRO,
        AIPlatform.CURSOR,
      );

      expect(result.success).toBe(true);
      expect(result.mappedFeatures.has('rules')).toBe(true);

      const rules = result.mappedFeatures.get('rules');
      expect(rules).toContain('Rule 1: Use TypeScript');
      expect(rules).toContain('Rule 2: Write tests');
    });

    it('should map Cursor rules to Kiro steering', async () => {
      const sourceData = {
        rules: `Rule 1: Always use async/await
Rule 2: Prefer functional programming`,
      };

      const result = await service.mapFeatures(
        sourceData,
        AIPlatform.CURSOR,
        AIPlatform.KIRO,
      );

      expect(result.success).toBe(true);
      expect(result.mappedFeatures.has('steering')).toBe(true);

      const steering = result.mappedFeatures.get('steering');
      expect(Array.isArray(steering)).toBe(true);
      expect(steering[0].name).toBe('cursor-rules');
      expect(steering[0].source).toBe('cursor');
    });
  });

  describe('validateMapping', () => {
    it('should validate supported mappings', () => {
      const validation = service.validateMapping(
        AIPlatform.KIRO,
        AIPlatform.CLAUDE_CODE,
      );

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should invalidate unsupported mappings', () => {
      const validation = service.validateMapping(
        AIPlatform.CURSOR,
        AIPlatform.CLAUDE_CODE,
      );

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        'No mappings defined for cursor to claude-code',
      );
    });
  });

  describe('getReverseMapping', () => {
    it('should return reverse mapping for bidirectional features', () => {
      const mappings = service.getMappings(
        AIPlatform.KIRO,
        AIPlatform.CLAUDE_CODE,
      );
      const mcpMapping = mappings.find(
        (m) => m.source.feature === 'mcp_servers',
      );

      expect(mcpMapping?.bidirectional).toBe(true);

      const reverse = service.getReverseMapping(mcpMapping!);

      expect(reverse).toBeDefined();
      expect(reverse?.source.feature).toBe('mcp_servers');
      expect(reverse?.target.feature).toBe('mcp_servers');
      expect(reverse?.bidirectional).toBe(true);
    });

    it('should return null for non-bidirectional features', () => {
      const mappings = service.getMappings(
        AIPlatform.KIRO,
        AIPlatform.CLAUDE_CODE,
      );
      const specMapping = mappings.find((m) => m.source.feature === 'specs');

      expect(specMapping?.bidirectional).toBeUndefined();

      const reverse = service.getReverseMapping(specMapping!);

      expect(reverse).toBeNull();
    });
  });
});
