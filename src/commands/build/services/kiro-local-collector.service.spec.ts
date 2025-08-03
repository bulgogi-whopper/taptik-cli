import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { readFile, readdir, stat } from 'fs-extra';
import { Stats } from 'fs';

import { KiroLocalCollectorService } from './kiro-local-collector.service';
import { PathResolverUtil } from '../utils/path-resolver.util';
import { LocalSettings, CollectionError } from '../interfaces/collected-settings.interface';

// Mock fs-extra
vi.mock('fs-extra', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
}));

// Mock PathResolverUtil
vi.mock('../utils/path-resolver.util', () => ({
  PathResolverUtil: {
    getKiroSettingsPaths: vi.fn(),
    pathExists: vi.fn(),
    isReadable: vi.fn(),
    getPathErrorMessage: vi.fn(),
    getLocalKiroConfigDirectory: vi.fn(),
  },
}));

describe('KiroLocalCollectorService', () => {
  let service: KiroLocalCollectorService;
  let mockReadFile: Mock;
  let mockReaddir: Mock;
  let mockStat: Mock;
  let mockPathExists: Mock;
  let mockIsReadable: Mock;
  let mockGetKiroSettingsPaths: Mock;
  let mockGetPathErrorMessage: Mock;
  let mockGetLocalKiroConfigDirectory: Mock;

  const mockPaths = {
    local: {
      contextJson: '/project/.kiro/context.json',
      userPreferences: '/project/.kiro/user-preferences.json',
      projectSpec: '/project/.kiro/project-spec.json',
      promptsDir: '/project/.kiro/prompts',
      hooksDir: '/project/.kiro/hooks',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KiroLocalCollectorService],
    }).compile();

    service = module.get<KiroLocalCollectorService>(KiroLocalCollectorService);

    // Setup mocks
    mockReadFile = vi.mocked(readFile);
    mockReaddir = vi.mocked(readdir);
    mockStat = vi.mocked(stat);
    mockPathExists = vi.mocked(PathResolverUtil.pathExists);
    mockIsReadable = vi.mocked(PathResolverUtil.isReadable);
    mockGetKiroSettingsPaths = vi.mocked(PathResolverUtil.getKiroSettingsPaths);
    mockGetPathErrorMessage = vi.mocked(PathResolverUtil.getPathErrorMessage);
    mockGetLocalKiroConfigDirectory = vi.mocked(PathResolverUtil.getLocalKiroConfigDirectory);

    // Default mock implementations
    mockGetKiroSettingsPaths.mockReturnValue(mockPaths);
    mockPathExists.mockResolvedValue(true);
    mockIsReadable.mockResolvedValue(true);
    mockGetPathErrorMessage.mockImplementation((path, error) => `Error accessing ${path}: ${error.message}`);
    mockGetLocalKiroConfigDirectory.mockReturnValue('/project/.kiro');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('collectLocalSettings', () => {
    it('should collect all available local settings successfully', async () => {
      // Arrange
      const mockContextJson = { theme: 'dark', language: 'en' };
      const mockUserPreferences = { fontSize: 14, tabSize: 2 };
      const mockProjectSpec = { name: 'test-project', version: '1.0.0' };
      const mockPromptFiles = ['prompt1.json', 'prompt2.md'];
      const mockHookFiles = ['hook1.js', 'hook2.json'];

      // Mock file reads in the order they will be called
      mockReadFile
        .mockResolvedValueOnce(JSON.stringify(mockContextJson))    // context.json
        .mockResolvedValueOnce(JSON.stringify(mockUserPreferences)) // user-preferences.json
        .mockResolvedValueOnce(JSON.stringify(mockProjectSpec))    // project-spec.json
        .mockResolvedValueOnce('{"name": "prompt1", "content": "test"}') // prompt1.json
        .mockResolvedValueOnce('# Prompt 2\nThis is a markdown prompt')  // prompt2.md
        .mockResolvedValueOnce('console.log("hook1");')            // hook1.js
        .mockResolvedValueOnce('{"name": "hook2", "type": "pre-commit"}'); // hook2.json

      mockReaddir
        .mockResolvedValueOnce(mockPromptFiles)  // prompts directory
        .mockResolvedValueOnce(mockHookFiles);   // hooks directory

      // Mock stat calls - first for directories, then for files
      mockStat
        .mockResolvedValueOnce({ isDirectory: () => true } as Stats)  // prompts dir
        .mockResolvedValueOnce({ isDirectory: () => false } as Stats) // prompt1.json
        .mockResolvedValueOnce({ isDirectory: () => false } as Stats) // prompt2.md
        .mockResolvedValueOnce({ isDirectory: () => true } as Stats)  // hooks dir
        .mockResolvedValueOnce({ isDirectory: () => false } as Stats) // hook1.js
        .mockResolvedValueOnce({ isDirectory: () => false } as Stats); // hook2.json

      // Act
      const result = await service.collectLocalSettings();

      // Assert
      expect(result.settings.contextJson).toEqual(mockContextJson);
      expect(result.settings.userPreferencesJson).toEqual(mockUserPreferences);
      expect(result.settings.projectSpecJson).toEqual(mockProjectSpec);
      expect(result.settings.prompts).toEqual({
        'prompt1.json': { name: 'prompt1', content: 'test' },
        'prompt2.md': '# Prompt 2\nThis is a markdown prompt',
      });
      expect(result.settings.hooks).toEqual({
        'hook1.js': 'console.log("hook1");',
        'hook2.json': { name: 'hook2', type: 'pre-commit' },
      });
      expect(result.sourceFiles).toHaveLength(7);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle missing files gracefully', async () => {
      // Arrange
      mockPathExists
        .mockResolvedValueOnce(false) // context.json missing
        .mockResolvedValueOnce(true)  // user-preferences.json exists
        .mockResolvedValueOnce(false) // project-spec.json missing
        .mockResolvedValueOnce(false) // prompts dir missing
        .mockResolvedValueOnce(false); // hooks dir missing

      mockReadFile.mockResolvedValueOnce('{"setting": "value"}');

      // Act
      const result = await service.collectLocalSettings();

      // Assert
      expect(result.settings.contextJson).toBeUndefined();
      expect(result.settings.userPreferencesJson).toEqual({ setting: 'value' });
      expect(result.settings.projectSpecJson).toBeUndefined();
      expect(result.settings.prompts).toBeUndefined();
      expect(result.settings.hooks).toBeUndefined();
      expect(result.sourceFiles).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle permission denied errors', async () => {
      // Arrange
      mockIsReadable
        .mockResolvedValueOnce(false) // context.json not readable
        .mockResolvedValueOnce(true)  // user-preferences.json readable
        .mockResolvedValueOnce(true)  // project-spec.json readable
        .mockResolvedValueOnce(false) // prompts dir not readable
        .mockResolvedValueOnce(true); // hooks dir readable

      mockReadFile
        .mockResolvedValueOnce('{"setting": "value"}')
        .mockResolvedValueOnce('{"project": "test"}');

      mockReaddir.mockResolvedValueOnce([]);
      mockStat.mockResolvedValue({ isDirectory: () => true } as Stats);

      // Act
      const result = await service.collectLocalSettings();

      // Assert
      expect(result.settings.contextJson).toBeUndefined();
      expect(result.settings.userPreferencesJson).toEqual({ setting: 'value' });
      expect(result.settings.projectSpecJson).toEqual({ project: 'test' });
      expect(result.settings.prompts).toBeUndefined();
      expect(result.settings.hooks).toEqual({});
      expect(result.sourceFiles).toHaveLength(2);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].severity).toBe('error');
      expect(result.errors[0].error).toContain('Permission denied');
      expect(result.errors[1].severity).toBe('error');
      expect(result.errors[1].error).toContain('Permission denied');
    });

    it('should handle invalid JSON files', async () => {
      // Arrange
      mockReadFile
        .mockResolvedValueOnce('invalid json content')
        .mockResolvedValueOnce('{"valid": "json"}')
        .mockResolvedValueOnce('');

      mockReaddir.mockResolvedValue([]);
      mockStat.mockResolvedValue({ isDirectory: () => true } as Stats);

      // Act
      const result = await service.collectLocalSettings();

      // Assert
      expect(result.settings.contextJson).toBeUndefined();
      expect(result.settings.userPreferencesJson).toEqual({ valid: 'json' });
      expect(result.settings.projectSpecJson).toBeUndefined();
      expect(result.sourceFiles).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].severity).toBe('error');
      expect(result.errors[0].error).toContain('Invalid JSON format');
    });

    it('should handle file system errors', async () => {
      // Arrange
      const fileError = new Error('ENOENT: no such file or directory');
      mockReadFile.mockRejectedValueOnce(fileError);
      mockGetPathErrorMessage.mockReturnValueOnce('File system error: ENOENT');

      mockReadFile
        .mockResolvedValueOnce('{"valid": "json"}')
        .mockResolvedValueOnce('{"project": "test"}');

      mockReaddir.mockResolvedValue([]);
      mockStat.mockResolvedValue({ isDirectory: () => true } as Stats);

      // Act
      const result = await service.collectLocalSettings();

      // Assert
      expect(result.settings.contextJson).toBeUndefined();
      expect(result.settings.userPreferencesJson).toEqual({ valid: 'json' });
      expect(result.settings.projectSpecJson).toEqual({ project: 'test' });
      expect(result.sourceFiles).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].severity).toBe('error');
      expect(result.errors[0].error).toBe('File system error: ENOENT');
    });

    it('should handle directory scanning errors', async () => {
      // Arrange
      mockReadFile
        .mockResolvedValueOnce('{"context": "data"}')
        .mockResolvedValueOnce('{"user": "prefs"}')
        .mockResolvedValueOnce('{"project": "spec"}');

      const dirError = new Error('Permission denied');
      mockReaddir
        .mockRejectedValueOnce(dirError)
        .mockResolvedValueOnce(['hook1.js']);

      mockStat.mockResolvedValue({ isDirectory: () => true } as Stats);
      mockReadFile.mockResolvedValueOnce('console.log("hook");');
      mockGetPathErrorMessage.mockReturnValueOnce('Directory access error');

      // Act
      const result = await service.collectLocalSettings();

      // Assert
      expect(result.settings.contextJson).toEqual({ context: 'data' });
      expect(result.settings.userPreferencesJson).toEqual({ user: 'prefs' });
      expect(result.settings.projectSpecJson).toEqual({ project: 'spec' });
      expect(result.settings.prompts).toBeUndefined();
      expect(result.settings.hooks).toEqual({ 'hook1.js': 'console.log("hook");' });
      expect(result.sourceFiles).toHaveLength(4);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].severity).toBe('error');
      expect(result.errors[0].error).toBe('Directory access error');
    });

    it('should skip subdirectories in prompts and hooks folders', async () => {
      // Arrange
      mockReadFile
        .mockResolvedValueOnce('{"context": "data"}')
        .mockResolvedValueOnce('{"user": "prefs"}')
        .mockResolvedValueOnce('{"project": "spec"}');

      mockReaddir
        .mockResolvedValueOnce(['prompt1.json', 'subfolder', 'prompt2.md'])
        .mockResolvedValueOnce(['hook1.js', 'another-subfolder']);

      mockStat
        .mockResolvedValueOnce({ isDirectory: () => true } as Stats)  // prompts dir
        .mockResolvedValueOnce({ isDirectory: () => false } as Stats) // prompt1.json
        .mockResolvedValueOnce({ isDirectory: () => true } as Stats)  // subfolder (skip)
        .mockResolvedValueOnce({ isDirectory: () => false } as Stats) // prompt2.md
        .mockResolvedValueOnce({ isDirectory: () => true } as Stats)  // hooks dir
        .mockResolvedValueOnce({ isDirectory: () => false } as Stats) // hook1.js
        .mockResolvedValueOnce({ isDirectory: () => true } as Stats); // another-subfolder (skip)

      mockReadFile
        .mockResolvedValueOnce('{"name": "prompt1"}')
        .mockResolvedValueOnce('# Prompt 2')
        .mockResolvedValueOnce('console.log("hook1");');

      // Act
      const result = await service.collectLocalSettings();

      // Assert
      expect(result.settings.prompts).toEqual({
        'prompt1.json': { name: 'prompt1' },
        'prompt2.md': '# Prompt 2',
      });
      expect(result.settings.hooks).toEqual({
        'hook1.js': 'console.log("hook1");',
      });
      expect(result.sourceFiles).toHaveLength(5); // 3 JSON files + 2 directory files
      expect(result.errors).toHaveLength(0);
    });

    it('should handle non-directory paths for prompts and hooks', async () => {
      // Arrange
      mockReadFile
        .mockResolvedValueOnce('{"context": "data"}')
        .mockResolvedValueOnce('{"user": "prefs"}')
        .mockResolvedValueOnce('{"project": "spec"}');

      mockStat
        .mockResolvedValueOnce({ isDirectory: () => false } as Stats) // prompts is a file, not dir
        .mockResolvedValueOnce({ isDirectory: () => false } as Stats); // hooks is a file, not dir

      // Act
      const result = await service.collectLocalSettings();

      // Assert
      expect(result.settings.contextJson).toEqual({ context: 'data' });
      expect(result.settings.userPreferencesJson).toEqual({ user: 'prefs' });
      expect(result.settings.projectSpecJson).toEqual({ project: 'spec' });
      expect(result.settings.prompts).toBeUndefined();
      expect(result.settings.hooks).toBeUndefined();
      expect(result.sourceFiles).toHaveLength(3);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].severity).toBe('warning');
      expect(result.errors[0].error).toContain('Path exists but is not a directory');
      expect(result.errors[1].severity).toBe('warning');
      expect(result.errors[1].error).toContain('Path exists but is not a directory');
    });
  });

  describe('validateLocalConfiguration', () => {
    it('should return valid when local configuration exists and is accessible', async () => {
      // Arrange
      mockPathExists.mockResolvedValue(true);
      mockIsReadable.mockResolvedValue(true);
      mockStat.mockResolvedValue({ isDirectory: () => true } as Stats);

      // Act
      const result = await service.validateLocalConfiguration();

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.configDirectory).toBe('/project/.kiro');
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid when configuration directory does not exist', async () => {
      // Arrange
      mockPathExists.mockResolvedValue(false);

      // Act
      const result = await service.validateLocalConfiguration();

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.configDirectory).toBe('/project/.kiro');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Local Kiro configuration directory not found');
    });

    it('should return invalid when configuration directory is not readable', async () => {
      // Arrange
      mockPathExists.mockResolvedValue(true);
      mockIsReadable.mockResolvedValue(false);

      // Act
      const result = await service.validateLocalConfiguration();

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.configDirectory).toBe('/project/.kiro');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Cannot read local Kiro configuration directory');
    });

    it('should return invalid when path exists but is not a directory', async () => {
      // Arrange
      mockPathExists.mockResolvedValue(true);
      mockIsReadable.mockResolvedValue(true);
      mockStat.mockResolvedValue({ isDirectory: () => false } as Stats);

      // Act
      const result = await service.validateLocalConfiguration();

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.configDirectory).toBe('/project/.kiro');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Path exists but is not a directory');
    });

    it('should handle validation errors gracefully', async () => {
      // Arrange
      const validationError = new Error('Access denied');
      mockPathExists.mockRejectedValue(validationError);
      mockGetPathErrorMessage.mockReturnValue('Validation error: Access denied');

      // Act
      const result = await service.validateLocalConfiguration();

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.configDirectory).toBe('/project/.kiro');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe('Error validating local configuration: Validation error: Access denied');
    });
  });
});