import { describe, it, expect, beforeEach } from 'vitest';

import { DiffService } from './diff.service';
import { createMockTaptikContext } from './test-helpers';

describe('DiffService', () => {
  let service: DiffService;

  beforeEach(() => {
    service = new DiffService();
  });

  describe('generateDiff', () => {
    it('should detect no changes when contexts are identical', () => {
      const source = createMockTaptikContext();
      const target = createMockTaptikContext();

      const diff = service.generateDiff(source.content, target.content);

      expect(diff.hasChanges).toBe(false);
      expect(diff.additions).toEqual([]);
      expect(diff.modifications).toEqual([]);
      expect(diff.deletions).toEqual([]);
    });

    it('should detect additions in source context', () => {
      const target = createMockTaptikContext();
      const source = createMockTaptikContext();
      source.content.project = {
        ...source.content.project,
        customSettings: { theme: 'dark' },
      };

      const diff = service.generateDiff(source.content, target.content);

      expect(diff.hasChanges).toBe(true);
      expect(diff.additions.length).toBeGreaterThan(0);
      const addition = diff.additions.find((a) =>
        a.path.includes('customSettings'),
      );
      expect(addition).toBeDefined();
      expect(addition?.newValue).toEqual({ theme: 'dark' });
    });

    it('should detect modifications in target context', () => {
      const source = createMockTaptikContext();
      const target = createMockTaptikContext();
      source.content.personal = { name: 'Jane', email: 'jane@example.com' };
      target.content.personal = { name: 'John', email: 'john@example.com' };

      const diff = service.generateDiff(source.content, target.content);

      expect(diff.hasChanges).toBe(true);
      expect(diff.modifications).toHaveLength(2);
      const nameModule = diff.modifications.find((m) =>
        m.path.includes('name'),
      );
      expect(nameModule).toBeDefined();
      expect(nameModule?.oldValue).toBe('John');
      expect(nameModule?.newValue).toBe('Jane');
    });

    it('should detect deletions in target context', () => {
      const source = createMockTaptikContext();
      const target = createMockTaptikContext();
      source.content.project = { name: 'Test Project' };
      target.content.project = {
        name: 'Test Project',
        description: 'Test Description',
      };

      const diff = service.generateDiff(source.content, target.content);

      expect(diff.hasChanges).toBe(true);
      expect(diff.deletions.length).toBeGreaterThan(0);
      const deletion = diff.deletions.find((d) =>
        d.path.includes('description'),
      );
      expect(deletion).toBeDefined();
      expect(deletion?.oldValue).toBe('Test Description');
    });

    it('should handle array differences correctly', () => {
      const source = createMockTaptikContext();
      const target = createMockTaptikContext();
      source.content.prompts = [
        { id: '1', name: 'Prompt 1' },
        { id: '2', name: 'Prompt 2' },
      ];
      target.content.prompts = [
        { id: '1', name: 'Prompt 1' },
        { id: '3', name: 'Prompt 3' },
      ];

      const diff = service.generateDiff(source.content, target.content);

      expect(diff.hasChanges).toBe(true);
      expect(diff.modifications.length).toBeGreaterThan(0);
      const promptModule = diff.modifications.find((m) =>
        m.path.includes('prompts'),
      );
      expect(promptModule).toBeDefined();
    });
  });

  describe('formatDiffForDisplay', () => {
    it('should format diff in human-readable format', () => {
      const diff = {
        hasChanges: true,
        additions: [
          { path: 'content.test', type: 'addition' as const, newValue: 'new' },
        ],
        modifications: [
          {
            path: 'content.name',
            type: 'modification' as const,
            oldValue: 'old',
            newValue: 'new',
          },
        ],
        deletions: [
          {
            path: 'content.removed',
            type: 'deletion' as const,
            oldValue: 'old',
          },
        ],
      };

      const formatted = service.formatDiffForDisplay(diff);

      expect(formatted).toContain('Additions (1)');
      expect(formatted).toContain('+ content.test');
      expect(formatted).toContain('Modifications (1)');
      expect(formatted).toContain('~ content.name');
      expect(formatted).toContain('Deletions (1)');
      expect(formatted).toContain('- content.removed');
    });

    it('should show "No changes detected" when diff is empty', () => {
      const diff = {
        hasChanges: false,
        additions: [],
        modifications: [],
        deletions: [],
      };

      const formatted = service.formatDiffForDisplay(diff);

      expect(formatted).toBe('No changes detected');
    });

    it('should format with colors when color option is enabled', () => {
      const diff = {
        hasChanges: true,
        additions: [
          { path: 'content.test', type: 'addition' as const, newValue: 'new' },
        ],
        modifications: [],
        deletions: [],
      };

      const formatted = service.formatDiffForDisplay(diff, { color: true });

      expect(formatted).toContain('\x1B[32m'); // Green color code
      expect(formatted).toContain('\x1B[0m'); // Reset color code
    });
  });

  describe('mergeConfigurations', () => {
    it('should merge with skip strategy', () => {
      const source = createMockTaptikContext({
        content: {
          personal: { name: 'Source' },
        },
      });
      const target = createMockTaptikContext({
        content: {
          personal: { name: 'Target' },
        },
      });

      const merged = service.mergeConfigurations(source, target, 'skip');

      expect((merged.content as any)?.personal?.name).toBe('Target');
    });

    it('should merge with overwrite strategy', () => {
      const source = createMockTaptikContext({
        content: {
          personal: { name: 'Source' },
        },
      });
      const target = createMockTaptikContext({
        content: {
          personal: { name: 'Target' },
        },
      });

      const merged = service.mergeConfigurations(source, target, 'overwrite');

      expect((merged.content as any)?.personal?.name).toBe('Source');
    });

    it('should merge with merge strategy (deep merge)', () => {
      const source = createMockTaptikContext({
        content: {
          personal: { name: 'Source', newField: 'new' },
        },
      });
      const target = createMockTaptikContext({
        content: {
          personal: { name: 'Target', email: 'target@example.com' },
        },
      });

      const merged = service.mergeConfigurations(source, target, 'merge');

      expect((merged.content as any)?.personal).toEqual({
        name: 'Source',
        email: 'target@example.com',
        newField: 'new',
      });
    });

    it('should handle backup strategy by creating backup info', () => {
      const source = createMockTaptikContext();
      const target = createMockTaptikContext();

      const merged = service.mergeConfigurations(source, target, 'backup');

      expect((merged.metadata as any)?.backupCreated).toBe(true);
      // Remove backupCreated before comparing the rest
      const { backupCreated: _backupCreated, ...restMetadata } =
        (merged.metadata as any) || {};
      expect({ ...merged, metadata: restMetadata }).toEqual({
        ...source,
        metadata: source.metadata,
      });
    });

    it('should merge arrays intelligently in merge strategy', () => {
      const source = createMockTaptikContext({
        content: {
          prompts: [
            { id: '1', name: 'Source Prompt' },
            { id: '3', name: 'New Prompt' },
          ],
        },
      });
      const target = createMockTaptikContext({
        content: {
          prompts: [
            { id: '1', name: 'Target Prompt' },
            { id: '2', name: 'Existing Prompt' },
          ],
        },
      });

      const merged = service.mergeConfigurations(source, target, 'merge');

      expect((merged.content as any)?.prompts).toHaveLength(3);
      expect((merged.content as any)?.prompts).toContainEqual({
        id: '1',
        name: 'Source Prompt',
      });
      expect((merged.content as any)?.prompts).toContainEqual({
        id: '2',
        name: 'Existing Prompt',
      });
      expect((merged.content as any)?.prompts).toContainEqual({
        id: '3',
        name: 'New Prompt',
      });
    });
  });

  describe('getConflicts', () => {
    it('should identify conflicts between configurations', () => {
      const source = createMockTaptikContext({
        content: {
          personal: { name: 'Source', email: 'source@example.com' },
        },
      });
      const target = createMockTaptikContext({
        content: {
          personal: { name: 'Target', email: 'target@example.com' },
        },
      });

      const conflicts = service.getConflicts(source, target);

      expect(conflicts).toHaveLength(2);
      expect(conflicts).toContainEqual({
        path: 'content.personal.name',
        sourceValue: 'Source',
        targetValue: 'Target',
        type: 'value_conflict',
      });
      expect(conflicts).toContainEqual({
        path: 'content.personal.email',
        sourceValue: 'source@example.com',
        targetValue: 'target@example.com',
        type: 'value_conflict',
      });
    });

    it('should not report conflicts for identical values', () => {
      const source = createMockTaptikContext();
      const target = createMockTaptikContext();

      const conflicts = service.getConflicts(source, target);

      expect(conflicts).toHaveLength(0);
    });

    it('should identify type conflicts', () => {
      const source = createMockTaptikContext({
        content: {
          personal: { name: 'String Value' },
        },
      });
      const target = createMockTaptikContext({
        content: {
          personal: { name: ['Array', 'Value'] as any },
        },
      });

      const conflicts = service.getConflicts(source, target);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toMatchObject({
        path: 'content.personal.name',
        type: 'type_conflict',
      });
    });
  });

  describe('applyPatch', () => {
    it('should apply addition patches', () => {
      const target = createMockTaptikContext();
      const patches = [
        {
          path: 'content.newField',
          type: 'addition' as const,
          newValue: 'added value',
        },
      ];

      const result = service.applyPatch(target, patches);

      expect(result.content).toHaveProperty('newField', 'added value');
    });

    it('should apply modification patches', () => {
      const target = createMockTaptikContext({
        content: {
          personal: { name: 'Original' },
        },
      });
      const patches = [
        {
          path: 'content.personal.name',
          type: 'modification' as const,
          oldValue: 'Original',
          newValue: 'Modified',
        },
      ];

      const result = service.applyPatch(target, patches);

      expect(result.content.personal.name).toBe('Modified');
    });

    it('should apply deletion patches', () => {
      const target = createMockTaptikContext({
        content: {
          personal: { name: 'Name', email: 'email@example.com' },
        },
      });
      const patches = [
        {
          path: 'content.personal.email',
          type: 'deletion' as const,
          oldValue: 'email@example.com',
        },
      ];

      const result = service.applyPatch(target, patches);

      expect(result.content.personal).not.toHaveProperty('email');
      expect(result.content.personal.name).toBe('Name');
    });

    it('should handle nested path creation for additions', () => {
      const target = createMockTaptikContext();
      const patches = [
        {
          path: 'content.deeply.nested.value',
          type: 'addition' as const,
          newValue: 'deep value',
        },
      ];

      const result = service.applyPatch(target, patches);

      expect(result.content).toHaveProperty('deeply');
      expect(result.content.deeply).toHaveProperty('nested');
      expect(result.content.deeply.nested).toHaveProperty(
        'value',
        'deep value',
      );
    });
  });
});
