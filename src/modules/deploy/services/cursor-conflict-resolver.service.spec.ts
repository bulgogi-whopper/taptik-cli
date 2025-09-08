import { Test, TestingModule } from '@nestjs/testing';


import { expect, it , describe , beforeEach  } from 'vitest';

import { ConflictStrategy } from '../interfaces/conflict-strategy.interface';

import { CursorConflictResolverService, ConflictContext, ConflictResolutionResult } from './cursor-conflict-resolver.service';

describe('CursorConflictResolverService', () => {
  let service: CursorConflictResolverService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CursorConflictResolverService],
    }).compile();

    service = module.get<CursorConflictResolverService>(CursorConflictResolverService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resolveConflict', () => {
    it('should skip conflict when strategy is skip', async () => {
      const context: ConflictContext = {
        filePath: 'test.json',
        existingContent: { key: 'old' },
        newContent: { key: 'new' },
        strategy: 'skip',
        fileType: 'json',
      };

      const result = await service.resolveConflict(context);

      expect(result.action).toBe('skip');
      expect(result.message).toContain('Skipped test.json');
    });

    it('should overwrite when strategy is overwrite', async () => {
      const context: ConflictContext = {
        filePath: 'test.json',
        existingContent: { key: 'old' },
        newContent: { key: 'new' },
        strategy: 'overwrite',
        fileType: 'json',
      };

      const result = await service.resolveConflict(context);

      expect(result.action).toBe('overwrite');
      expect(result.mergedContent).toEqual({ key: 'new' });
    });

    it('should backup and overwrite when strategy is backup', async () => {
      const context: ConflictContext = {
        filePath: 'test.json',
        existingContent: { key: 'old' },
        newContent: { key: 'new' },
        strategy: 'backup',
        fileType: 'json',
      };

      const result = await service.resolveConflict(context);

      expect(result.action).toBe('backup');
      expect(result.mergedContent).toEqual({ key: 'new' });
      expect(result.backupPath).toContain('test.json.backup.');
    });

    it('should throw error for unsupported strategy', async () => {
      const context: ConflictContext = {
        filePath: 'test.json',
        existingContent: { key: 'old' },
        newContent: { key: 'new' },
        strategy: 'invalid' as ConflictStrategy,
        fileType: 'json',
      };

      await expect(service.resolveConflict(context)).rejects.toThrow('Unsupported conflict strategy: invalid');
    });
  });

  describe('resolveSettingsConflict', () => {
    it('should merge JSON settings intelligently', async () => {
      const existingSettings = {
        'editor.fontSize': 16, // User customization
        'editor.tabSize': 2,
        'cursor.ai.enabled': false, // System setting
      };

      const newSettings = {
        'editor.fontSize': 14, // Default value
        'editor.tabSize': 4,
        'cursor.ai.enabled': true, // System setting update
        'workbench.colorTheme': 'Dark+', // New setting
      };

      const result = await service.resolveSettingsConflict(existingSettings, newSettings, 'merge');

      expect(result.action).toBe('merge');
      expect(result.mergedContent['editor.fontSize']).toBe(16); // Preserved user customization
      expect(result.mergedContent['cursor.ai.enabled']).toBe(true); // Updated system setting
      expect(result.mergedContent['workbench.colorTheme']).toBe('Dark+'); // Added new setting
    });

    it('should preserve user customizations for known settings', async () => {
      const existingSettings = {
        'editor.fontSize': 18, // Non-default user value
        'workbench.colorTheme': 'Custom Theme',
      };

      const newSettings = {
        'editor.fontSize': 14, // Default value
        'workbench.colorTheme': 'Default Dark+',
      };

      const result = await service.resolveSettingsConflict(existingSettings, newSettings, 'merge');

      expect(result.mergedContent['editor.fontSize']).toBe(18); // Preserved
      expect(result.mergedContent['workbench.colorTheme']).toBe('Custom Theme'); // Preserved
    });

    it('should update default values with new content', async () => {
      const existingSettings = {
        'editor.fontSize': 14, // Default value
        'editor.fontFamily': 'Consolas', // Default value
      };

      const newSettings = {
        'editor.fontSize': 16,
        'editor.fontFamily': 'Monaco',
      };

      const result = await service.resolveSettingsConflict(existingSettings, newSettings, 'merge');

      expect(result.mergedContent['editor.fontSize']).toBe(16); // Updated from default
      expect(result.mergedContent['editor.fontFamily']).toBe('Monaco'); // Updated from default
    });
  });

  describe('resolveMarkdownConflict', () => {
    it('should merge markdown content without structural changes', async () => {
      const existingContent = `# Title
Content line 1
Content line 2`;

      const newContent = `# Title
Content line 1
Updated content line 2`;

      const result = await service.resolveMarkdownConflict(existingContent, newContent, 'merge', 'test.md');

      expect(result.action).toBe('merge');
      expect(result.mergedContent).toContain('Updated content line 2');
    });

    it('should handle additive markdown changes', async () => {
      const existingContent = `# Section 1
Content 1`;

      const newContent = `# Section 1
Content 1

# Section 2
New content`;

      const result = await service.resolveMarkdownConflict(existingContent, newContent, 'merge', 'test.md');

      expect(result.action).toBe('merge');
      expect(result.mergedContent).toContain('# Section 1');
      expect(result.mergedContent).toContain('# Section 2');
      expect(result.mergedContent).toContain('New content');
    });

    it('should handle complex structural changes with preservation', async () => {
      const existingContent = `# Old Title
Old content`;

      const newContent = `# New Title
Completely new content`;

      const result = await service.resolveMarkdownConflict(existingContent, newContent, 'merge', 'test.md');

      expect(result.action).toBe('merge');
      expect(result.mergedContent).toContain('# New Title');
      expect(result.mergedContent).toContain('Merge Note');
      expect(result.mergedContent).toContain('Old Title');
    });
  });

  describe('validateResolutionResult', () => {
    it('should validate merge result', () => {
      const result: ConflictResolutionResult = {
        action: 'merge',
        mergedContent: { key: 'value' },
      };

      expect(service.validateResolutionResult(result)).toBe(true);
    });

    it('should validate backup result', () => {
      const result: ConflictResolutionResult = {
        action: 'backup',
        mergedContent: { key: 'value' },
        backupPath: '/path/to/backup',
      };

      expect(service.validateResolutionResult(result)).toBe(true);
    });

    it('should validate skip result', () => {
      const result: ConflictResolutionResult = {
        action: 'skip',
      };

      expect(service.validateResolutionResult(result)).toBe(true);
    });

    it('should invalidate incomplete merge result', () => {
      const result: ConflictResolutionResult = {
        action: 'merge',
        // Missing mergedContent
      };

      expect(service.validateResolutionResult(result)).toBe(false);
    });

    it('should invalidate incomplete backup result', () => {
      const result: ConflictResolutionResult = {
        action: 'backup',
        mergedContent: { key: 'value' },
        // Missing backupPath
      };

      expect(service.validateResolutionResult(result)).toBe(false);
    });
  });

  describe('getConflictStats', () => {
    it('should analyze JSON conflict stats', () => {
      const context: ConflictContext = {
        filePath: 'settings.json',
        existingContent: {
          'editor.fontSize': 16,
          'editor.tabSize': 2,
          'workbench.colorTheme': 'Dark+',
        },
        newContent: {
          'editor.fontSize': 14,
          'editor.tabSize': 4,
          'workbench.colorTheme': 'Light+',
          'cursor.ai.enabled': true,
        },
        strategy: 'merge',
        fileType: 'json',
      };

      const stats = service.getConflictStats(context);

      expect(stats.conflictCount).toBe(3); // Three conflicting keys
      expect(stats.conflictType).toBe('settings');
      expect(stats.complexity).toBe('low'); // <= 3 conflicts
      expect(stats.recommendation).toBe('merge');
    });

    it('should analyze markdown conflict stats', () => {
      const context: ConflictContext = {
        filePath: 'prompt.md',
        existingContent: '# Title\nOld content',
        newContent: '# New Title\nNew content',
        strategy: 'merge',
        fileType: 'markdown',
      };

      const stats = service.getConflictStats(context);

      expect(stats.conflictType).toBe('structural'); // Header changed
      expect(stats.complexity).toBe('high'); // Structural changes
    });

    it('should recommend appropriate strategy based on complexity', () => {
      const simpleContext: ConflictContext = {
        filePath: 'settings.json',
        existingContent: { 'editor.fontSize': 16 },
        newContent: { 'editor.fontSize': 14 },
        strategy: 'merge',
        fileType: 'json',
      };

      const stats = service.getConflictStats(simpleContext);
      expect(stats.recommendation).toBe('merge');

      const complexContext: ConflictContext = {
        filePath: 'settings.json',
        existingContent: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`key${i}`, `old${i}`])),
        newContent: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`key${i}`, `new${i}`])),
        strategy: 'merge',
        fileType: 'json',
      };

      const complexStats = service.getConflictStats(complexContext);
      expect(complexStats.recommendation).toBe('backup');
    });
  });

  describe('resolveBatchConflicts', () => {
    it('should resolve multiple conflicts with individual strategies', async () => {
      const contexts: ConflictContext[] = [
        {
          filePath: 'file1.json',
          existingContent: { key: 'old1' },
          newContent: { key: 'new1' },
          strategy: 'merge',
          fileType: 'json',
        },
        {
          filePath: 'file2.json',
          existingContent: { key: 'old2' },
          newContent: { key: 'new2' },
          strategy: 'skip',
          fileType: 'json',
        },
      ];

      const results = await service.resolveBatchConflicts(contexts);

      expect(results).toHaveLength(2);
      expect(results[0].action).toBe('merge');
      expect(results[1].action).toBe('skip');
    });

    it('should resolve multiple conflicts with global strategy', async () => {
      const contexts: ConflictContext[] = [
        {
          filePath: 'file1.json',
          existingContent: { key: 'old1' },
          newContent: { key: 'new1' },
          strategy: 'merge',
          fileType: 'json',
        },
        {
          filePath: 'file2.json',
          existingContent: { key: 'old2' },
          newContent: { key: 'new2' },
          strategy: 'skip',
          fileType: 'json',
        },
      ];

      const results = await service.resolveBatchConflicts(contexts, 'overwrite');

      expect(results).toHaveLength(2);
      expect(results[0].action).toBe('overwrite');
      expect(results[1].action).toBe('overwrite');
    });
  });

  describe('suggestBatchStrategy', () => {
    it('should suggest strategy with high confidence for consistent contexts', () => {
      const contexts: ConflictContext[] = [
        {
          filePath: 'file1.json',
          existingContent: { key1: 'old1' },
          newContent: { key1: 'new1' },
          strategy: 'merge',
          fileType: 'json',
        },
        {
          filePath: 'file2.json',
          existingContent: { key2: 'old2' },
          newContent: { key2: 'new2' },
          strategy: 'merge',
          fileType: 'json',
        },
      ];

      const suggestion = service.suggestBatchStrategy(contexts);

      expect(suggestion.recommendedStrategy).toBe('merge');
      expect(suggestion.confidence).toBe('high');
      expect(suggestion.reasoning).toContain('Strong consensus');
    });

    it('should suggest prompt strategy for mixed contexts', () => {
      const contexts: ConflictContext[] = [
        {
          filePath: 'simple.json',
          existingContent: { key: 'old' },
          newContent: { key: 'new' },
          strategy: 'merge',
          fileType: 'json',
        },
        {
          filePath: 'complex.json',
          existingContent: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`key${i}`, `old${i}`])),
          newContent: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`key${i}`, `new${i}`])),
          strategy: 'backup',
          fileType: 'json',
        },
      ];

      const suggestion = service.suggestBatchStrategy(contexts);

      expect(suggestion.confidence).toBe('low');
      expect(suggestion.recommendedStrategy).toBe('prompt');
    });

    it('should handle empty contexts', () => {
      const suggestion = service.suggestBatchStrategy([]);

      expect(suggestion.recommendedStrategy).toBe('skip');
      expect(suggestion.confidence).toBe('high');
      expect(suggestion.reasoning).toBe('No conflicts to resolve');
    });
  });
});