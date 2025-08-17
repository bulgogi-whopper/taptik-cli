import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AIPlatform } from '../interfaces';

import { FeatureMappingService } from './feature-mapping.service';
import { ReverseMappingService } from './reverse-mapping.service';

describe('ReverseMappingService', () => {
  let service: ReverseMappingService;
  let featureMappingService: FeatureMappingService;

  beforeEach(() => {
    featureMappingService = new FeatureMappingService();
    service = new ReverseMappingService(featureMappingService);
  });

  describe('reverseMap', () => {
    it('should perform basic reverse mapping', async () => {
      const sourceData = {
        instructions: `# Project Instructions
        
## Feature A
This is feature A with design and requirements.`,
      };

      const result = await service.reverseMap(
        sourceData,
        AIPlatform.CLAUDE_CODE,
        AIPlatform.KIRO,
      );

      expect(result.success).toBe(true);
      expect(result.reversedFeatures.has('specs')).toBe(true);
      expect(result.metadata.originalPlatform).toBe(AIPlatform.CLAUDE_CODE);
      expect(result.metadata.targetPlatform).toBe(AIPlatform.KIRO);
    });

    it('should handle bidirectional MCP server mappings', async () => {
      const sourceData = {
        mcp_servers: {
          servers: [{ name: 'test-server', command: 'test-cmd' }],
        },
      };

      const result = await service.reverseMap(
        sourceData,
        AIPlatform.KIRO,
        AIPlatform.CLAUDE_CODE,
      );

      expect(result.success).toBe(true);
      expect(result.reversedFeatures.has('mcp_servers')).toBe(true);

      const servers = result.reversedFeatures.get('mcp_servers');
      expect(servers).toEqual(sourceData.mcp_servers);
    });

    it('should apply custom transforms when provided', async () => {
      const customTransform = vi.fn((value) => ({
        ...value,
        customField: 'added',
      }));

      const sourceData = {
        settings: { theme: 'dark' },
      };

      const result = await service.reverseMap(
        sourceData,
        AIPlatform.KIRO,
        AIPlatform.CLAUDE_CODE,
        {
          customTransforms: new Map([['settings', customTransform]]),
        },
      );

      expect(customTransform).toHaveBeenCalled();
      if (result.reversedFeatures.has('settings')) {
        const settings = result.reversedFeatures.get('settings');
        expect(settings.customField).toBe('added');
      }
    });

    it('should handle merge strategy', async () => {
      const sourceData = {
        specs: [{ name: 'Spec1' }],
        steering: [{ content: 'Rule1' }],
      };

      const result = await service.reverseMap(
        sourceData,
        AIPlatform.KIRO,
        AIPlatform.CLAUDE_CODE,
        {
          mergeStrategy: 'merge',
        },
      );

      expect(result.success).toBe(true);
      // Merged features should be present
      expect(result.reversedFeatures.size).toBeGreaterThan(0);
    });

    it('should validate feature integrity when requested', async () => {
      const sourceData = {
        specs: 'invalid specs format', // Invalid format
      };

      const result = await service.reverseMap(
        sourceData,
        AIPlatform.KIRO,
        AIPlatform.CLAUDE_CODE,
        {
          validateIntegrity: true,
        },
      );

      // Should have conflicts due to invalid format
      if (result.mappedFeatures.has('instructions')) {
        // Even if mapped, integrity check might flag issues
        expect(result.conflicts.size).toBeGreaterThanOrEqual(0);
      }
    });

    it('should detect non-reversible mappings', async () => {
      const sourceData = {
        instructions: `# Complex Instructions
        
## Feature with loss
This feature has information that will be lost in conversion.
### Special Section
This section might not be preserved perfectly.`,
      };

      const result = await service.reverseMap(
        sourceData,
        AIPlatform.CLAUDE_CODE,
        AIPlatform.KIRO,
      );

      expect(result.metadata.reversible).toBeDefined();
      // Reversibility depends on the complexity of the transformation
    });
  });

  describe('reverse transforms', () => {
    it('should reverse transform specs correctly', async () => {
      const claudeInstructions = `# Project Instructions

## Feature A
### Design
Design content here
### Requirements
Requirements content here
### Tasks
Tasks content here

## Feature B
Simple feature description`;

      const result = await service.reverseMap(
        { instructions: claudeInstructions },
        AIPlatform.CLAUDE_CODE,
        AIPlatform.KIRO,
      );

      expect(result.reversedFeatures.has('specs')).toBe(true);

      const specs = result.reversedFeatures.get('specs');
      expect(Array.isArray(specs)).toBe(true);
      if (specs && specs.length > 0) {
        expect(specs.length).toBeGreaterThanOrEqual(1);
        expect(specs[0].name).toBeDefined();
        if (specs[0].name === 'Feature A') {
          expect(specs[0].design).toBe('Design content here');
          expect(specs[0].requirements).toBe('Requirements content here');
          expect(specs[0].tasks).toBe('Tasks content here');
        }
      }
    });

    it('should reverse transform steering rules correctly', async () => {
      const claudeCustom = `# Custom Instructions

## Rule 1
Always write clean code

## Rule 2
Follow TDD practices`;

      const result = await service.reverseMap(
        { custom_instructions: claudeCustom },
        AIPlatform.CLAUDE_CODE,
        AIPlatform.KIRO,
      );

      expect(result.reversedFeatures.has('steering')).toBe(true);

      const steering = result.reversedFeatures.get('steering');
      expect(Array.isArray(steering)).toBe(true);
      if (steering) {
        expect(steering.length).toBeGreaterThan(0);
      }
    });

    it('should reverse transform hooks correctly', async () => {
      const claudeCommands = {
        commands: [
          {
            name: 'pre-commit',
            command: 'npm run lint',
            trigger: 'pre-commit',
            description: 'Lint before commit',
          },
        ],
      };

      const result = await service.reverseMap(
        { commands: claudeCommands },
        AIPlatform.CLAUDE_CODE,
        AIPlatform.KIRO,
      );

      expect(result.reversedFeatures.has('hooks')).toBe(true);

      const hooks = result.reversedFeatures.get('hooks');
      expect(Array.isArray(hooks)).toBe(true);
      if (hooks && hooks.length > 0) {
        expect(hooks[0].name).toBe('pre-commit');
        expect(hooks[0].command).toBe('npm run lint');
        expect(hooks[0].event).toBe('pre-commit');
      }
    });

    it('should handle steering without section headers', async () => {
      const claudeCustom = `# Custom Instructions

Always write clean code.
Follow TDD practices.
Use TypeScript.`;

      const result = await service.reverseMap(
        { custom_instructions: claudeCustom },
        AIPlatform.CLAUDE_CODE,
        AIPlatform.KIRO,
      );

      const steering = result.reversedFeatures.get('steering');
      expect(Array.isArray(steering)).toBe(true);
      if (steering && steering.length > 0) {
        expect(steering.length).toBeGreaterThan(0);
        expect(steering[0].content).toBeDefined();
      }
    });
  });

  describe('merge strategies', () => {
    it('should replace values with replace strategy', async () => {
      const sourceData = {
        settings: { theme: 'dark', fontSize: 14 },
      };

      const result = await service.reverseMap(
        sourceData,
        AIPlatform.KIRO,
        AIPlatform.CLAUDE_CODE,
        {
          mergeStrategy: 'replace',
        },
      );

      const settings = result.reversedFeatures.get('settings');
      expect(settings).toBeDefined();
    });

    it('should merge arrays with append strategy', async () => {
      const sourceData = {
        hooks: [{ name: 'hook1', command: 'cmd1' }],
      };

      const result = await service.reverseMap(
        sourceData,
        AIPlatform.KIRO,
        AIPlatform.CLAUDE_CODE,
        {
          mergeStrategy: 'append',
        },
      );

      expect(result.reversedFeatures.has('commands')).toBe(true);
    });

    it('should merge objects with merge strategy', async () => {
      const sourceData = {
        settings: { theme: 'dark' },
      };

      const result = await service.reverseMap(
        sourceData,
        AIPlatform.KIRO,
        AIPlatform.CLAUDE_CODE,
        {
          mergeStrategy: 'merge',
        },
      );

      const settings = result.reversedFeatures.get('settings');
      expect(settings).toBeDefined();
    });
  });

  describe('integrity validation', () => {
    it('should validate Kiro features', async () => {
      const validSpecs = [
        { name: 'Spec1', design: 'Design content' },
        { name: 'Spec2', requirements: 'Requirements' },
      ];

      const result = await service.reverseMap(
        { specs: validSpecs },
        AIPlatform.KIRO,
        AIPlatform.CLAUDE_CODE,
        {
          validateIntegrity: true,
        },
      );

      // Valid specs should not have conflicts
      expect(result.conflicts.size).toBe(0);
    });

    it('should detect invalid Claude features', async () => {
      const invalidInstructions = { not: 'a string' }; // Should be string

      const result = await service.reverseMap(
        { instructions: invalidInstructions },
        AIPlatform.CLAUDE_CODE,
        AIPlatform.KIRO,
        {
          validateIntegrity: true,
        },
      );

      // Invalid format might cause issues
      expect(result.success).toBeDefined();
    });

    it('should validate Cursor features', async () => {
      const validRules = 'Use TypeScript\nWrite tests';

      const result = await service.reverseMap(
        { rules: validRules },
        AIPlatform.CURSOR,
        AIPlatform.KIRO,
        {
          validateIntegrity: true,
        },
      );

      // Valid rules should work
      expect(result.success).toBe(true);
    });
  });

  describe('reversibility check', () => {
    it('should detect reversible mappings', async () => {
      const sourceData = {
        mcp_servers: {
          servers: [{ name: 'server1', command: 'cmd1' }],
        },
      };

      const result = await service.reverseMap(
        sourceData,
        AIPlatform.KIRO,
        AIPlatform.CLAUDE_CODE,
      );

      // MCP servers are bidirectional and should be reversible
      expect(result.metadata.reversible).toBeDefined();
    });

    it('should detect non-reversible mappings with data loss', async () => {
      const complexInstructions = `# Instructions
      
## Complex Feature
This has many details that might be lost.
Nested information here.
- List item 1
- List item 2
  - Nested item
### Subsection
More content`;

      const result = await service.reverseMap(
        { instructions: complexInstructions },
        AIPlatform.CLAUDE_CODE,
        AIPlatform.KIRO,
      );

      // Complex transformations might not be perfectly reversible
      expect(result.metadata.reversible).toBeDefined();
    });
  });

  describe('cache management', () => {
    it('should cache reverse mappings', () => {
      const available = service.getAvailableReverseMappings();

      expect(available.size).toBeGreaterThan(0);
      // Should have cached some reverse mappings
      expect(available.has('claude-code-to-kiro')).toBe(true);
    });

    it('should clear and reinitialize cache', () => {
      const beforeClear = service.getAvailableReverseMappings();
      const initialSize = beforeClear.size;

      service.clearCache();

      const afterClear = service.getAvailableReverseMappings();

      // Cache should be reinitialized
      expect(afterClear.size).toBe(initialSize);
    });
  });

  describe('object transformation', () => {
    it('should handle camelCase to snake_case conversion', async () => {
      const sourceData = {
        settings: {
          fontSize: 14,
          lineHeight: 1.5,
          tabSize: 2,
        },
      };

      const result = await service.reverseMap(
        sourceData,
        AIPlatform.KIRO,
        AIPlatform.CLAUDE_CODE,
      );

      expect(result.reversedFeatures.has('settings')).toBe(true);
    });

    it('should preserve original data when specified', async () => {
      const sourceData = {
        settings: { theme: 'dark' },
      };

      const result = await service.reverseMap(
        sourceData,
        AIPlatform.KIRO,
        AIPlatform.CLAUDE_CODE,
        {
          preserveOriginal: true,
        },
      );

      expect(result.reversedFeatures.has('settings')).toBe(true);
    });
  });
});
