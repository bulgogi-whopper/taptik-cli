import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { KiroConflictResolverService, ConflictResolutionResult } from './kiro-conflict-resolver.service';
import { BackupService } from './backup.service';
import { KiroComponentType } from '../interfaces/kiro-deployment.interface';

vi.mock('node:fs/promises');
vi.mock('./backup.service');

describe('KiroConflictResolverService', () => {
  let service: KiroConflictResolverService;
  let mockBackupService: any;

  beforeEach(async () => {
    mockBackupService = {
      createBackup: vi.fn(),
      restoreBackup: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KiroConflictResolverService,
        { provide: BackupService, useValue: mockBackupService },
      ],
    }).compile();

    service = module.get<KiroConflictResolverService>(KiroConflictResolverService);
    
    // Mock filesystem functions
    vi.mocked(fs.access).mockImplementation(() => Promise.resolve());
    vi.mocked(fs.readFile).mockImplementation(() => Promise.resolve(''));
    vi.mocked(fs.writeFile).mockImplementation(() => Promise.resolve());
    vi.mocked(fs.copyFile).mockImplementation(() => Promise.resolve());
  });

  describe('detectConflicts', () => {
    it('should detect no conflicts for new files', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      const conflicts = await service.detectConflicts(
        '/test/path/new-file.json',
        '{"test": "content"}',
        'settings',
      );

      expect(conflicts).toHaveLength(0);
    });

    it('should detect content differences', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('{"existing": "content"}');

      const conflicts = await service.detectConflicts(
        '/test/path/existing-file.json',
        '{"new": "content"}',
        'settings',
      );

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts.some(c => c.conflictType === 'content_differs')).toBe(true);
    });

    it('should detect no conflicts for identical content', async () => {
      const content = '{"same": "content"}';
      vi.mocked(fs.readFile).mockResolvedValue(content);

      const conflicts = await service.detectConflicts(
        '/test/path/same-file.json',
        content,
        'settings',
      );

      expect(conflicts).toHaveLength(0);
    });

    it('should detect JSON structure conflicts', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        '{"version": "1.0.0", "oldKey": "value"}'
      );

      const conflicts = await service.detectConflicts(
        '/test/path/settings.json',
        '{"version": "2.0.0", "newKey": "value"}',
        'settings',
      );

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts.some(c => c.conflictType === 'version_conflict')).toBe(true);
      expect(conflicts.some(c => c.conflictType === 'structure_mismatch')).toBe(true);
    });
  });

  describe('resolveConflict', () => {
    it('should resolve conflicts with skip strategy', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('existing content');

      const result = await service.resolveConflict(
        '/test/path/file.json',
        'new content',
        'settings',
        'skip',
      );

      expect(result.resolved).toBe(true);
      expect(result.strategy).toBe('skip');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('CONFLICT_SKIPPED');
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should resolve conflicts with overwrite strategy', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('existing content');

      const result = await service.resolveConflict(
        '/test/path/file.json',
        'new content',
        'settings',
        'overwrite',
      );

      expect(result.resolved).toBe(true);
      expect(result.strategy).toBe('overwrite');
      expect(fs.writeFile).toHaveBeenCalledWith('/test/path/file.json', 'new content', 'utf-8');
    });

    it('should resolve conflicts with backup strategy', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('existing content');

      const result = await service.resolveConflict(
        '/test/path/file.json',
        'new content',
        'settings',
        'backup',
      );

      expect(result.resolved).toBe(true);
      expect(result.strategy).toBe('backup');
      expect(result.backupPath).toBeDefined();
      expect(fs.writeFile).toHaveBeenCalledWith('/test/path/file.json', 'new content', 'utf-8');
    });

    it('should merge JSON files with deep-merge strategy', async () => {
      const existingJson = {
        version: '1.0.0',
        user: { name: 'John', age: 30 },
        settings: { theme: 'dark' },
      };
      const newJson = {
        version: '1.0.0',
        user: { name: 'John', email: 'john@example.com' },
        settings: { language: 'en' },
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingJson, null, 2));

      const result = await service.resolveConflict(
        '/test/path/settings.json',
        JSON.stringify(newJson, null, 2),
        'settings',
        'merge-intelligent',
        'deep-merge',
      );

      expect(result.resolved).toBe(true);
      expect(result.mergedContent).toBeDefined();
      
      const merged = JSON.parse(result.mergedContent!);
      expect(merged.user.name).toBe('John');
      expect(merged.user.age).toBe(30);
      expect(merged.user.email).toBe('john@example.com');
      expect(merged.settings.theme).toBe('dark');
      expect(merged.settings.language).toBe('en');
    });

    it('should preserve task status in markdown files', async () => {
      const existingMarkdown = `
# Task List

- [x] 1.1 Completed task
- [ ] 1.2 Pending task
- [x] 1.3 Another completed task
      `;

      const newMarkdown = `
# Task List

- [ ] 1.1 Completed task
- [ ] 1.2 Updated pending task
- [ ] 1.4 New task
      `;

      vi.mocked(fs.readFile).mockResolvedValue(existingMarkdown);

      const result = await service.resolveConflict(
        '/test/path/tasks.md',
        newMarkdown,
        'specs',
        'preserve-tasks',
      );

      expect(result.resolved).toBe(true);
      expect(result.mergedContent).toContain('- [x] 1.1 Completed task');
      expect(result.mergedContent).toContain('- [ ] 1.2 Updated pending task');
      expect(result.mergedContent).toContain('- [ ] 1.4 New task');
    });

    it('should handle invalid conflict strategy', async () => {
      const result = await service.resolveConflict(
        '/test/path/file.json',
        'content',
        'settings',
        'invalid-strategy' as any,
      );

      expect(result.resolved).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_STRATEGY');
    });
  });

  describe('JSON merging', () => {
    it('should merge arrays with array-append strategy', async () => {
      const existingJson = {
        languages: ['javascript', 'typescript'],
        frameworks: ['react'],
      };
      const newJson = {
        languages: ['python', 'typescript'],
        frameworks: ['vue', 'react'],
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingJson, null, 2));

      const result = await service.resolveConflict(
        '/test/path/config.json',
        JSON.stringify(newJson, null, 2),
        'settings',
        'merge-intelligent',
        'array-append',
      );

      expect(result.resolved).toBe(true);
      
      const merged = JSON.parse(result.mergedContent!);
      expect(merged.languages).toContain('javascript');
      expect(merged.languages).toContain('typescript');
      expect(merged.languages).toContain('python');
      expect(merged.frameworks).toContain('react');
      expect(merged.frameworks).toContain('vue');
    });
  });

  describe('Markdown merging', () => {
    it('should merge markdown by sections', async () => {
      const existingMarkdown = `
# Section 1
Existing content for section 1

# Section 2
Existing content for section 2
      `;

      const newMarkdown = `
# Section 1
New content for section 1

# Section 3
New section 3 content
      `;

      vi.mocked(fs.readFile).mockResolvedValue(existingMarkdown);

      const result = await service.resolveConflict(
        '/test/path/document.md',
        newMarkdown,
        'steering',
        'merge-intelligent',
        'markdown-section-merge',
      );

      expect(result.resolved).toBe(true);
      expect(result.mergedContent).toContain('# Section 1');
      expect(result.mergedContent).toContain('# Section 2');
      expect(result.mergedContent).toContain('# Section 3');
      expect(result.mergedContent).toContain('New content for section 1');
      expect(result.mergedContent).toContain('Existing content for section 2');
    });

    it('should preserve completed tasks in task lists', async () => {
      const existingTasks = `
- [x] 1.1 First task completed
- [ ] 1.2 Second task pending
- [x] 1.3 Third task completed
      `;

      const newTasks = `
- [ ] 1.1 First task updated
- [ ] 1.2 Second task updated
- [ ] 1.3 Third task updated
- [ ] 1.4 New fourth task
      `;

      vi.mocked(fs.readFile).mockResolvedValue(existingTasks);

      const result = await service.resolveConflict(
        '/test/path/tasks.md',
        newTasks,
        'specs',
        'preserve-tasks',
      );

      expect(result.resolved).toBe(true);
      expect(result.mergedContent).toContain('- [x] 1.1 First task updated');
      expect(result.mergedContent).toContain('- [ ] 1.2 Second task updated');
      expect(result.mergedContent).toContain('- [x] 1.3 Third task updated');
      expect(result.mergedContent).toContain('- [ ] 1.4 New fourth task');
    });
  });

  describe('suggestOptimalStrategy', () => {
    it('should suggest merge strategy for settings', async () => {
      const conflicts = [
        {
          filePath: '/test/settings.json',
          componentType: 'settings' as KiroComponentType,
          conflictType: 'content_differs' as const,
          description: 'Settings differ',
        },
      ];

      const suggestion = await service.suggestOptimalStrategy(conflicts, 'settings');

      expect(suggestion.strategy).toBe('merge-intelligent');
      expect(suggestion.mergeStrategy).toBe('deep-merge');
      expect(suggestion.reasoning).toContain('intelligent merging');
    });

    it('should suggest preserve-tasks strategy for specs', async () => {
      const conflicts = [
        {
          filePath: '/test/spec.md',
          componentType: 'specs' as KiroComponentType,
          conflictType: 'content_differs' as const,
          description: 'Spec content differs',
        },
      ];

      const suggestion = await service.suggestOptimalStrategy(conflicts, 'specs');

      expect(suggestion.strategy).toBe('preserve-tasks');
      expect(suggestion.mergeStrategy).toBe('task-status-preserve');
      expect(suggestion.reasoning).toContain('preserve task completion status');
    });

    it('should suggest prompt strategy for hooks', async () => {
      const conflicts = [
        {
          filePath: '/test/hook.json',
          componentType: 'hooks' as KiroComponentType,
          conflictType: 'content_differs' as const,
          description: 'Hook config differs',
        },
      ];

      const suggestion = await service.suggestOptimalStrategy(conflicts, 'hooks');

      expect(suggestion.strategy).toBe('prompt');
      expect(suggestion.reasoning).toContain('security implications');
    });
  });

  describe('generateConflictReport', () => {
    it('should generate empty report for no conflicts', async () => {
      const report = await service.generateConflictReport([]);

      expect(report).toBe('No conflicts detected.');
    });

    it('should generate detailed conflict report', async () => {
      const conflicts = [
        {
          filePath: '/test/settings.json',
          componentType: 'settings' as KiroComponentType,
          conflictType: 'version_conflict' as const,
          description: 'Version mismatch',
        },
        {
          filePath: '/test/tasks.md',
          componentType: 'specs' as KiroComponentType,
          conflictType: 'content_differs' as const,
          description: 'Task content differs',
        },
      ];

      const report = await service.generateConflictReport(conflicts);

      expect(report).toContain('# Kiro Deployment Conflict Report');
      expect(report).toContain('Total conflicts detected: 2');
      expect(report).toContain('## Settings Conflicts');
      expect(report).toContain('## Specs Conflicts');
      expect(report).toContain('/test/settings.json');
      expect(report).toContain('/test/tasks.md');
      expect(report).toContain('Version mismatch');
      expect(report).toContain('Task content differs');
    });
  });

  describe('validateMergeCompatibility', () => {
    it('should validate JSON file compatibility', async () => {
      const result = await service.validateMergeCompatibility(
        '/test/settings.json',
        'settings',
        'deep-merge',
      );

      expect(result.compatible).toBe(true);
    });

    it('should reject incompatible JSON merge strategy', async () => {
      const result = await service.validateMergeCompatibility(
        '/test/settings.json',
        'settings',
        'markdown-section-merge',
      );

      expect(result.compatible).toBe(false);
      expect(result.reason).toContain('not compatible with JSON files');
    });

    it('should validate markdown file compatibility', async () => {
      const result = await service.validateMergeCompatibility(
        '/test/document.md',
        'steering',
        'markdown-section-merge',
      );

      expect(result.compatible).toBe(true);
    });

    it('should reject incompatible markdown merge strategy', async () => {
      const result = await service.validateMergeCompatibility(
        '/test/document.md',
        'steering',
        'deep-merge',
      );

      expect(result.compatible).toBe(false);
      expect(result.reason).toContain('not compatible with Markdown files');
    });
  });

  describe('resolveMultipleConflicts', () => {
    it('should resolve multiple conflicts sequentially', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('existing content');

      const conflicts = [
        {
          filePath: '/test/file1.json',
          newContent: '{"new": "content1"}',
          componentType: 'settings' as KiroComponentType,
        },
        {
          filePath: '/test/file2.json',
          newContent: '{"new": "content2"}',
          componentType: 'settings' as KiroComponentType,
        },
      ];

      const results = await service.resolveMultipleConflicts(conflicts, 'overwrite');

      expect(results).toHaveLength(2);
      expect(results[0].resolved).toBe(true);
      expect(results[1].resolved).toBe(true);
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('task preservation', () => {
    it('should extract completed tasks correctly', async () => {
      const markdownContent = `
# Implementation Plan

- [x] 1.1 First completed task
- [ ] 1.2 Pending task
- [x] 1.3 Another completed task
- [ ] 2.1 Different section task

## Other Section

Some other content
      `;

      vi.mocked(fs.readFile).mockResolvedValue(markdownContent);

      const newContent = `
# Implementation Plan

- [ ] 1.1 First completed task
- [ ] 1.2 Updated pending task
- [ ] 1.3 Another completed task
- [ ] 1.4 New task
      `;

      const result = await service.resolveConflict(
        '/test/tasks.md',
        newContent,
        'specs',
        'preserve-tasks',
      );

      expect(result.resolved).toBe(true);
      expect(result.mergedContent).toContain('- [x] 1.1 First completed task');
      expect(result.mergedContent).toContain('- [ ] 1.2 Updated pending task');
      expect(result.mergedContent).toContain('- [x] 1.3 Another completed task');
      expect(result.mergedContent).toContain('- [ ] 1.4 New task');
    });

    it('should handle complex task numbering schemes', async () => {
      const existingTasks = `
- [x] 2.1.1 Nested completed task
- [ ] 2.1.2 Nested pending task
- [x] 2.2 Simple completed task
      `;

      const newTasks = `
- [ ] 2.1.1 Nested completed task (updated)
- [ ] 2.1.2 Nested pending task (updated)
- [ ] 2.2 Simple completed task (updated)
- [ ] 2.3 New task
      `;

      vi.mocked(fs.readFile).mockResolvedValue(existingTasks);

      const result = await service.resolveConflict(
        '/test/nested-tasks.md',
        newTasks,
        'specs',
        'preserve-tasks',
      );

      expect(result.resolved).toBe(true);
      expect(result.mergedContent).toContain('- [x] 2.1.1 Nested completed task');
      expect(result.mergedContent).toContain('- [x] 2.2 Simple completed task');
      expect(result.mergedContent).toContain('- [ ] 2.3 New task');
    });
  });

  describe('error handling', () => {
    it('should handle file access errors gracefully', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Permission denied'));

      const result = await service.resolveConflict(
        '/test/protected-file.json',
        'new content',
        'settings',
        'merge',
      );

      expect(result.resolved).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MERGE_ERROR');
    });

    it('should handle invalid JSON gracefully', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('invalid json content {');

      const result = await service.resolveConflict(
        '/test/invalid.json',
        '{"valid": "json"}',
        'settings',
        'merge',
      );

      expect(result.resolved).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MERGE_ERROR');
    });
  });

  describe('merge information tracking', () => {
    it('should track merge information correctly', async () => {
      const existingContent = '{"small": "content"}';
      const newContent = '{"larger": "content", "with": "more", "properties": true}';
      
      vi.mocked(fs.readFile).mockResolvedValue(existingContent);

      const result = await service.resolveConflict(
        '/test/settings.json',
        newContent,
        'settings',
        'merge-intelligent',
        'deep-merge',
      );

      expect(result.resolved).toBe(true);
      expect(result.mergeInfo).toBeDefined();
      expect(result.mergeInfo!.filePath).toBe('/test/settings.json');
      expect(result.mergeInfo!.componentType).toBe('settings');
      expect(result.mergeInfo!.mergeStrategy).toBe('deep-merge');
      expect(result.mergeInfo!.originalSize).toBeLessThan(result.mergeInfo!.finalSize);
    });
  });
});