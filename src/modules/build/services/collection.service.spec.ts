import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { CollectionService, LocalSettingsData } from './collection.service';

// Mock the fs module
vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    readdir: vi.fn(),
    readFile: vi.fn(),
  },
}));

describe('CollectionService', () => {
  let service: CollectionService;
  const mockFs = fs as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CollectionService],
    }).compile();

    service = module.get<CollectionService>(CollectionService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('collectLocalSettings', () => {
    it('should throw error when .kiro directory does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('Directory not found'));

      await expect(service.collectLocalSettings('/test/path')).rejects.toThrow(
        'No .kiro directory found at: /test/path/.kiro'
      );
    });

    it('should collect data from complete .kiro directory structure', async () => {
      const testPath = '/test/project';
      const kiroPath = path.join(testPath, '.kiro');

      // Mock .kiro directory exists
      mockFs.access.mockImplementation((dirPath: string) => {
        if (dirPath === kiroPath || 
            dirPath === path.join(kiroPath, 'settings') ||
            dirPath === path.join(kiroPath, 'steering') ||
            dirPath === path.join(kiroPath, 'hooks')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Not found'));
      });

      // Mock readdir for steering and hooks
      mockFs.readdir.mockImplementation((dirPath: string) => {
        if (dirPath === path.join(kiroPath, 'steering')) {
          return Promise.resolve(['feature.md', 'guidelines.md', 'other.txt']);
        }
        if (dirPath === path.join(kiroPath, 'hooks')) {
          return Promise.resolve(['pre-commit.kiro.hook', 'post-build.kiro.hook', 'script.sh']);
        }
        return Promise.resolve([]);
      });

      // Mock readFile
      mockFs.readFile.mockImplementation((filePath: string) => {
        const basename = path.basename(filePath);
        switch (basename) {
          case 'context.md':
            return Promise.resolve('# Context\nProject context content');
          case 'user-preferences.md':
            return Promise.resolve('# User Preferences\nUser preferences content');
          case 'project-spec.md':
            return Promise.resolve('# Project Spec\nProject specification content');
          case 'feature.md':
            return Promise.resolve('# Feature\nFeature steering content');
          case 'guidelines.md':
            return Promise.resolve('# Guidelines\nGuidelines steering content');
          case 'pre-commit.kiro.hook':
            return Promise.resolve('#!/bin/bash\necho "Pre-commit hook"');
          case 'post-build.kiro.hook':
            return Promise.resolve('#!/bin/bash\necho "Post-build hook"');
          default:
            return Promise.reject(new Error('File not found'));
        }
      });

      const result = await service.collectLocalSettings(testPath);

      expect(result).toEqual({
        context: '# Context\nProject context content',
        userPreferences: '# User Preferences\nUser preferences content',
        projectSpec: '# Project Spec\nProject specification content',
        steeringFiles: [
          {
            filename: 'feature.md',
            content: '# Feature\nFeature steering content',
            path: path.join(kiroPath, 'steering', 'feature.md'),
          },
          {
            filename: 'guidelines.md',
            content: '# Guidelines\nGuidelines steering content',
            path: path.join(kiroPath, 'steering', 'guidelines.md'),
          },
        ],
        hookFiles: [
          {
            filename: 'pre-commit.kiro.hook',
            content: '#!/bin/bash\necho "Pre-commit hook"',
            path: path.join(kiroPath, 'hooks', 'pre-commit.kiro.hook'),
          },
          {
            filename: 'post-build.kiro.hook',
            content: '#!/bin/bash\necho "Post-build hook"',
            path: path.join(kiroPath, 'hooks', 'post-build.kiro.hook'),
          },
        ],
        sourcePath: kiroPath,
        collectedAt: expect.any(String),
      });

      expect(result.collectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle missing settings directory gracefully', async () => {
      const testPath = '/test/project';
      const kiroPath = path.join(testPath, '.kiro');

      mockFs.access.mockImplementation((dirPath: string) => {
        if (dirPath === kiroPath) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Directory not found'));
      });

      mockFs.readdir.mockResolvedValue([]);

      const result = await service.collectLocalSettings(testPath);

      expect(result).toEqual({
        context: undefined,
        userPreferences: undefined,
        projectSpec: undefined,
        steeringFiles: [],
        hookFiles: [],
        sourcePath: kiroPath,
        collectedAt: expect.any(String),
      });
    });

    it('should handle missing steering directory gracefully', async () => {
      const testPath = '/test/project';
      const kiroPath = path.join(testPath, '.kiro');

      mockFs.access.mockImplementation((dirPath: string) => {
        if (dirPath === kiroPath || dirPath === path.join(kiroPath, 'settings')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Directory not found'));
      });

      mockFs.readFile.mockImplementation((filePath: string) => {
        const basename = path.basename(filePath);
        if (basename === 'context.md') {
          return Promise.resolve('Context content');
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await service.collectLocalSettings(testPath);

      expect(result.steeringFiles).toEqual([]);
      expect(result.context).toBe('Context content');
    });

    it('should handle missing hooks directory gracefully', async () => {
      const testPath = '/test/project';
      const kiroPath = path.join(testPath, '.kiro');

      mockFs.access.mockImplementation((dirPath: string) => {
        if (dirPath === kiroPath || dirPath === path.join(kiroPath, 'settings')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Directory not found'));
      });

      mockFs.readFile.mockResolvedValue('File content');

      const result = await service.collectLocalSettings(testPath);

      expect(result.hookFiles).toEqual([]);
    });

    it('should handle file read errors gracefully', async () => {
      const testPath = '/test/project';
      const kiroPath = path.join(testPath, '.kiro');

      mockFs.access.mockImplementation((dirPath: string) => {
        if (dirPath === kiroPath || dirPath === path.join(kiroPath, 'settings')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Directory not found'));
      });

      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      const result = await service.collectLocalSettings(testPath);

      expect(result).toEqual({
        context: undefined,
        userPreferences: undefined,
        projectSpec: undefined,
        steeringFiles: [],
        hookFiles: [],
        sourcePath: kiroPath,
        collectedAt: expect.any(String),
      });
    });

    it('should use current working directory when no path provided', async () => {
      const currentDir = process.cwd();
      const kiroPath = path.join(currentDir, '.kiro');

      mockFs.access.mockImplementation((dirPath: string) => {
        if (dirPath === kiroPath) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Directory not found'));
      });

      mockFs.readdir.mockResolvedValue([]);

      const result = await service.collectLocalSettings();

      expect(result.sourcePath).toBe(kiroPath);
    });

    it('should filter files correctly in steering and hooks directories', async () => {
      const testPath = '/test/project';
      const kiroPath = path.join(testPath, '.kiro');

      mockFs.access.mockImplementation((dirPath: string) => {
        if (dirPath === kiroPath ||
            dirPath === path.join(kiroPath, 'steering') ||
            dirPath === path.join(kiroPath, 'hooks')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Directory not found'));
      });

      mockFs.readdir.mockImplementation((dirPath: string) => {
        if (dirPath === path.join(kiroPath, 'steering')) {
          return Promise.resolve(['valid.md', 'invalid.txt', 'another.md']);
        }
        if (dirPath === path.join(kiroPath, 'hooks')) {
          return Promise.resolve(['valid.kiro.hook', 'invalid.hook', 'another.kiro.hook']);
        }
        return Promise.resolve([]);
      });

      mockFs.readFile.mockImplementation((filePath: string) => {
        const basename = path.basename(filePath);
        return Promise.resolve(`Content of ${basename}`);
      });

      const result = await service.collectLocalSettings(testPath);

      expect(result.steeringFiles).toHaveLength(2);
      expect(result.steeringFiles.map(f => f.filename)).toEqual(['valid.md', 'another.md']);

      expect(result.hookFiles).toHaveLength(2);
      expect(result.hookFiles.map(f => f.filename)).toEqual(['valid.kiro.hook', 'another.kiro.hook']);
    });

    it('should handle readdir errors gracefully', async () => {
      const testPath = '/test/project';
      const kiroPath = path.join(testPath, '.kiro');

      mockFs.access.mockImplementation((dirPath: string) => {
        if (dirPath === kiroPath ||
            dirPath === path.join(kiroPath, 'steering') ||
            dirPath === path.join(kiroPath, 'hooks')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Directory not found'));
      });

      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      const result = await service.collectLocalSettings(testPath);

      expect(result.steeringFiles).toEqual([]);
      expect(result.hookFiles).toEqual([]);
    });
  });
});