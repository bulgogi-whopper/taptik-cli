import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CollectionService, LocalSettingsData, GlobalSettingsData } from './collection.service';

// Mock the fs module
vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    readdir: vi.fn(),
    readFile: vi.fn(),
  },
}));

// Mock the os module
vi.mock('os', () => ({
  homedir: vi.fn(),
}));

describe('CollectionService', () => {
  let service: CollectionService;
  const mockFs = fs as any;
  const mockOs = os as any;

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

  describe('collectGlobalSettings', () => {
    beforeEach(() => {
      mockOs.homedir.mockReturnValue('/home/user');
    });

    it('should throw error when ~/.kiro directory does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('Directory not found'));

      await expect(service.collectGlobalSettings()).rejects.toThrow(
        'No global .kiro directory found at: /home/user/.kiro'
      );
    });

    it('should collect data from complete ~/.kiro directory structure', async () => {
      const homeDir = '/home/user';
      const globalKiroPath = path.join(homeDir, '.kiro');

      // Mock ~/.kiro directory exists
      mockFs.access.mockImplementation((dirPath: string) => {
        if (dirPath === globalKiroPath || 
            dirPath === path.join(globalKiroPath, 'templates') ||
            dirPath === path.join(globalKiroPath, 'config')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Not found'));
      });

      // Mock readdir for templates and config
      mockFs.readdir.mockImplementation((dirPath: string) => {
        if (dirPath === path.join(globalKiroPath, 'templates')) {
          return Promise.resolve(['prompt1.md', 'prompt2.txt', 'other.json']);
        }
        if (dirPath === path.join(globalKiroPath, 'config')) {
          return Promise.resolve(['app.json', 'settings.yaml', 'readme.md', 'script.sh']);
        }
        return Promise.resolve([]);
      });

      // Mock readFile
      mockFs.readFile.mockImplementation((filePath: string) => {
        const basename = path.basename(filePath);
        switch (basename) {
          case 'user-config.md':
            return Promise.resolve('# User Config\nUser configuration content');
          case 'global-preferences.md':
            return Promise.resolve('# Global Preferences\napi_key=secret123\npreference=value');
          case 'prompt1.md':
            return Promise.resolve('# Prompt 1\nPrompt template content');
          case 'prompt2.txt':
            return Promise.resolve('Prompt template 2 content');
          case 'app.json':
            return Promise.resolve('{"app": "config", "token": "abc123"}');
          case 'settings.yaml':
            return Promise.resolve('setting: value\nsecret: hidden');
          case 'readme.md':
            return Promise.resolve('# Config Readme');
          default:
            return Promise.reject(new Error('File not found'));
        }
      });

      const result = await service.collectGlobalSettings();

      expect(result).toEqual({
        userConfig: '# User Config\nUser configuration content',
        globalPreferences: '# Global Preferences\napi_key=[REDACTED]\npreference=value',
        promptTemplates: [
          {
            filename: 'prompt1.md',
            content: '# Prompt 1\nPrompt template content',
            path: path.join(globalKiroPath, 'templates', 'prompt1.md'),
          },
          {
            filename: 'prompt2.txt',
            content: 'Prompt template 2 content',
            path: path.join(globalKiroPath, 'templates', 'prompt2.txt'),
          },
        ],
        configFiles: [
          {
            filename: 'app.json',
            content: '{"app": "config", "token":[REDACTED]}',
            path: path.join(globalKiroPath, 'config', 'app.json'),
          },
          {
            filename: 'settings.yaml',
            content: 'setting: value\nsecret:[REDACTED]',
            path: path.join(globalKiroPath, 'config', 'settings.yaml'),
          },
          {
            filename: 'readme.md',
            content: '# Config Readme',
            path: path.join(globalKiroPath, 'config', 'readme.md'),
          },
        ],
        sourcePath: globalKiroPath,
        collectedAt: expect.any(String),
        securityFiltered: true,
      });

      expect(result.collectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle missing templates directory gracefully', async () => {
      const homeDir = '/home/user';
      const globalKiroPath = path.join(homeDir, '.kiro');

      mockFs.access.mockImplementation((dirPath: string) => {
        if (dirPath === globalKiroPath) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Directory not found'));
      });

      mockFs.readFile.mockImplementation((filePath: string) => {
        const basename = path.basename(filePath);
        if (basename === 'user-config.md') {
          return Promise.resolve('User config content');
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await service.collectGlobalSettings();

      expect(result.promptTemplates).toEqual([]);
      expect(result.configFiles).toEqual([]);
      expect(result.userConfig).toBe('User config content');
    });

    it('should handle missing config directory gracefully', async () => {
      const homeDir = '/home/user';
      const globalKiroPath = path.join(homeDir, '.kiro');

      mockFs.access.mockImplementation((dirPath: string) => {
        if (dirPath === globalKiroPath || dirPath === path.join(globalKiroPath, 'templates')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Directory not found'));
      });

      mockFs.readdir.mockImplementation((dirPath: string) => {
        if (dirPath === path.join(globalKiroPath, 'templates')) {
          return Promise.resolve(['template.md']);
        }
        return Promise.resolve([]);
      });

      mockFs.readFile.mockImplementation((filePath: string) => {
        return Promise.resolve('File content');
      });

      const result = await service.collectGlobalSettings();

      expect(result.configFiles).toEqual([]);
      expect(result.promptTemplates).toHaveLength(1);
    });

    it('should apply security filtering correctly', async () => {
      const homeDir = '/home/user';
      const globalKiroPath = path.join(homeDir, '.kiro');

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue([]);

      // Test with sensitive content
      mockFs.readFile.mockImplementation((filePath: string) => {
        const basename = path.basename(filePath);
        if (basename === 'user-config.md') {
          return Promise.resolve(`
            API_KEY=sk-1234567890abcdef1234567890abcdef
            database_url=postgres://user:password123@localhost/db
            access_token=ghp_1234567890abcdef1234567890abcdef123456
            normal_setting=value
          `);
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await service.collectGlobalSettings();

      expect(result.userConfig).toContain('[REDACTED]');
      expect(result.userConfig).not.toContain('sk-1234567890abcdef1234567890abcdef');
      expect(result.userConfig).not.toContain('password123');
      expect(result.userConfig).not.toContain('ghp_1234567890abcdef1234567890abcdef123456');
      expect(result.userConfig).toContain('normal_setting=value');
      expect(result.securityFiltered).toBe(true);
    });

    it('should handle file read errors gracefully', async () => {
      const homeDir = '/home/user';
      const globalKiroPath = path.join(homeDir, '.kiro');

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue([]);
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      const result = await service.collectGlobalSettings();

      expect(result).toEqual({
        userConfig: undefined,
        globalPreferences: undefined,
        promptTemplates: [],
        configFiles: [],
        sourcePath: globalKiroPath,
        collectedAt: expect.any(String),
        securityFiltered: false,
      });
    });

    it('should handle readdir errors gracefully', async () => {
      const homeDir = '/home/user';
      const globalKiroPath = path.join(homeDir, '.kiro');

      mockFs.access.mockImplementation((dirPath: string) => {
        if (dirPath === globalKiroPath ||
            dirPath === path.join(globalKiroPath, 'templates') ||
            dirPath === path.join(globalKiroPath, 'config')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Directory not found'));
      });

      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));
      mockFs.readFile.mockResolvedValue('File content');

      const result = await service.collectGlobalSettings();

      expect(result.promptTemplates).toEqual([]);
      expect(result.configFiles).toEqual([]);
    });

    it('should filter files correctly in templates and config directories', async () => {
      const homeDir = '/home/user';
      const globalKiroPath = path.join(homeDir, '.kiro');

      mockFs.access.mockImplementation((dirPath: string) => {
        if (dirPath === globalKiroPath ||
            dirPath === path.join(globalKiroPath, 'templates') ||
            dirPath === path.join(globalKiroPath, 'config')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Directory not found'));
      });

      mockFs.readdir.mockImplementation((dirPath: string) => {
        if (dirPath === path.join(globalKiroPath, 'templates')) {
          return Promise.resolve(['valid.md', 'valid.txt', 'invalid.json', 'another.md']);
        }
        if (dirPath === path.join(globalKiroPath, 'config')) {
          return Promise.resolve(['valid.json', 'valid.yaml', 'valid.yml', 'valid.md', 'invalid.txt']);
        }
        return Promise.resolve([]);
      });

      mockFs.readFile.mockImplementation((filePath: string) => {
        const basename = path.basename(filePath);
        return Promise.resolve(`Content of ${basename}`);
      });

      const result = await service.collectGlobalSettings();

      expect(result.promptTemplates).toHaveLength(3);
      expect(result.promptTemplates.map(f => f.filename)).toEqual(['valid.md', 'valid.txt', 'another.md']);

      expect(result.configFiles).toHaveLength(4);
      expect(result.configFiles.map(f => f.filename)).toEqual(['valid.json', 'valid.yaml', 'valid.yml', 'valid.md']);
    });
  });
});