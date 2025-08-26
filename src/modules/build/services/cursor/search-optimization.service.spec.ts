import { describe, it, expect, beforeEach } from 'vitest';

import { CursorSearchOptimizationService } from './search-optimization.service';

describe('CursorSearchOptimizationService', () => {
  let service: CursorSearchOptimizationService;

  beforeEach(() => {
    service = new CursorSearchOptimizationService();
  });

  describe('generateSearchMetadata', () => {
    it('should generate metadata for AI-enabled config', () => {
      const data = {
        sourcePath: '/test/path',
        collectedAt: new Date().toISOString(),
        isGlobal: true,
        aiConfiguration: { enabled: true, defaultModel: 'gpt-4' },
        snippets: { javascript: {}, python: {} },
        extensions: {
          installed: [{ id: 'react' }]
        },
      };

      const metadata = service.generateSearchMetadata(data);

      expect(metadata.title).toContain('AI-Powered');
      expect(metadata.tags).toContain('ai');
      expect(metadata.tags).toContain('javascript');
      expect(metadata.categories).toContain('AI Development');
      expect(metadata.difficulty).toBe('intermediate');
    });

    it('should categorize web development configs', () => {
      const data = {
        sourcePath: '/test/path',
        collectedAt: new Date().toISOString(),
        isGlobal: true,
        snippets: { javascript: {}, typescript: {}, html: {} },
      };

      const metadata = service.generateSearchMetadata(data);

      expect(metadata.categories).toContain('Web Development');
    });

    it('should detect advanced difficulty', () => {
      const data = {
        sourcePath: '/test/path',
        collectedAt: new Date().toISOString(),
        isGlobal: true,
        extensions: {
          installed: new Array(15).fill({ id: 'ext' })
        },
        aiConfiguration: { enabled: true },
        snippets: { a: {}, b: {}, c: {}, d: {}, e: {}, f: {} },
        settings: Object.fromEntries(new Array(25).fill(null).map((_, i) => [`key${i}`, i])),
      };

      const metadata = service.generateSearchMetadata(data);

      expect(metadata.difficulty).toBe('advanced');
    });
  });

  describe('generateDeploymentMetadata', () => {
    it('should generate deployment metadata', () => {
      const data = {
        sourcePath: '/test/path',
        collectedAt: new Date().toISOString(),
        isGlobal: true,
        vsCodeCompatible: true,
        extensions: {
          installed: [{ id: 'ext1' }, { id: 'ext2' }]
        },
        settings: { 'cursor.copilotEnabled': true },
      };

      const deployment = service.generateDeploymentMetadata(data);

      expect(deployment.targetPlatforms).toContain('cursor-ide');
      expect(deployment.targetPlatforms).toContain('vscode');
      expect(deployment.compatibility[1].supported).toBe(true);
      expect(deployment.requirements.extensions).toEqual(['ext1', 'ext2']);
      expect(deployment.requirements.features).toContain('copilot-integration');
    });
  });

  describe('optimizeForSearch', () => {
    it('should optimize metadata for search', () => {
      const metadata = {
        title: 'Test Config',
        description: 'A test configuration',
        tags: ['ai', 'test'],
        categories: ['Test'],
        keywords: ['test', 'config'],
        technologies: ['React', 'Python', 'Docker', 'Kubernetes'],
        primaryLanguage: 'typescript',
        difficulty: 'advanced' as const,
        popularity: 0,
      };

      const optimized = service.optimizeForSearch(metadata);

      expect(optimized.searchableText).toContain('test config');
      expect(optimized.searchableText).toContain('ai');
      expect(optimized.boost).toBeGreaterThan(1.0);
      expect(optimized.boost).toBeLessThanOrEqual(2.0);
    });
  });
});