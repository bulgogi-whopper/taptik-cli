import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { CursorFileWriterService } from './cursor-file-writer.service';
import {
  CursorGlobalSettings,
  CursorProjectSettings,
  CursorDeploymentOptions,
} from '../interfaces/cursor-deployment.interface';
import { CursorExtensionsConfig } from '../interfaces/cursor-config.interface';

// Mock fs module
vi.mock('node:fs/promises');

describe('CursorFileWriterService', () => {
  let service: CursorFileWriterService;
  let mockFs: typeof fs;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CursorFileWriterService],
    }).compile();

    service = module.get<CursorFileWriterService>(CursorFileWriterService);
    mockFs = fs as any;

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('writeSettings', () => {
    const mockOptions: CursorDeploymentOptions = {
      platform: 'cursor' as const,
      cursorPath: '/test/cursor',
      workspacePath: '/test/workspace',
      globalSettings: true,
      projectSettings: true,
      mergeStrategy: 'replace',
      components: [],
      skipComponents: [],
    };

    const mockGlobalSettings: CursorGlobalSettings = {
      editor: {
        fontSize: 14,
        tabSize: 2,
        theme: 'dark',
      },
      ai: {
        enabled: true,
        model: 'gpt-4',
      },
    };

    const mockProjectSettings: CursorProjectSettings = {
      editor: {
        fontSize: 12,
      },
      files: {
        exclude: {
          '**/.git': true,
          '**/node_modules': true,
        },
      },
    };

    beforeEach(() => {
      mockFs.mkdir = vi.fn().mockResolvedValue(undefined);
      mockFs.writeFile = vi.fn().mockResolvedValue(undefined);
      mockFs.stat = vi.fn().mockResolvedValue({ size: 256 });
      mockFs.readFile = vi.fn().mockRejectedValue(new Error('File not found'));
    });

    it('should write global and project settings successfully', async () => {
      const result = await service.writeSettings(
        mockGlobalSettings,
        mockProjectSettings,
        mockOptions
      );

      expect(result.globalWritten).toBe(true);
      expect(result.projectWritten).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.paths.globalSettings).toContain('settings.json');
      expect(result.paths.projectSettings).toContain('settings.json');

      // Verify directories were created
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('User'),
        { recursive: true }
      );
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.vscode'),
        { recursive: true }
      );

      // Verify settings files were written
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('settings.json'),
        expect.stringContaining('"editor.fontSize": 14'),
        'utf8'
      );
    });

    it('should handle global settings only when project settings disabled', async () => {
      const optionsNoProject = { ...mockOptions, projectSettings: false };

      const result = await service.writeSettings(
        mockGlobalSettings,
        mockProjectSettings,
        optionsNoProject
      );

      expect(result.globalWritten).toBe(true);
      expect(result.projectWritten).toBe(false);
      expect(result.paths.globalSettings).toBeDefined();
      expect(result.paths.projectSettings).toBeUndefined();
    });

    it('should handle missing workspace path for project settings', async () => {
      const optionsNoWorkspace = { ...mockOptions, workspacePath: undefined };

      const result = await service.writeSettings(
        mockGlobalSettings,
        mockProjectSettings,
        optionsNoWorkspace
      );

      expect(result.globalWritten).toBe(true);
      expect(result.projectWritten).toBe(false);
    });

    it('should merge settings when merge strategy is enabled', async () => {
      const existingSettings = {
        'editor.theme': 'light',
        'files.autoSave': 'afterDelay',
      };

      mockFs.readFile = vi.fn().mockResolvedValue(JSON.stringify(existingSettings));
      const mergeOptions = { ...mockOptions, mergeStrategy: 'merge' as const };

      const result = await service.writeSettings(
        mockGlobalSettings,
        null,
        mergeOptions
      );

      expect(result.globalWritten).toBe(true);
      
      // Verify merge occurred by checking the write call
      const writeCall = (mockFs.writeFile as any).mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1]);
      expect(writtenContent['editor.theme']).toBe('dark'); // New value should override
      expect(writtenContent['files.autoSave']).toBe('afterDelay'); // Existing value should remain
      expect(writtenContent['editor.fontSize']).toBe(14); // New value should be added
    });

    it('should handle file write errors gracefully', async () => {
      // Mock mkdir to succeed so we get to the writeFile step
      mockFs.mkdir = vi.fn().mockResolvedValue(undefined);
      mockFs.writeFile = vi.fn().mockRejectedValue(new Error('Permission denied'));

      const result = await service.writeSettings(
        mockGlobalSettings,
        mockProjectSettings,
        mockOptions
      );

      expect(result.globalWritten).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].component).toBe('global-settings');
      expect(result.errors[0].type).toBe('file_operation');
    });

    it('should flatten nested settings correctly', async () => {
      await service.writeSettings(mockGlobalSettings, null, mockOptions);

      const writeCall = (mockFs.writeFile as any).mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1]);
      
      expect(writtenContent).toEqual({
        'editor.fontSize': 14,
        'editor.tabSize': 2,
        'editor.theme': 'dark',
        'cursor.ai.enabled': true,
        'cursor.ai.model': 'gpt-4',
      });
    });
  });

  describe('writeExtensions', () => {
    const mockOptions: CursorDeploymentOptions = {
      platform: 'cursor' as const,
      cursorPath: '/test/cursor',
      components: [],
      skipComponents: [],
    };

    const mockExtensionsConfig: CursorExtensionsConfig = {
      recommendations: [
        'ms-vscode.vscode-typescript-next',
        'esbenp.prettier-vscode',
      ],
      unwanted: [
        'ms-vscode.vscode-json',
      ],
      settings: {
        autoUpdate: true,
        ignoreRecommendations: false,
      },
    };

    beforeEach(() => {
      mockFs.mkdir = vi.fn().mockResolvedValue(undefined);
      mockFs.writeFile = vi.fn().mockResolvedValue(undefined);
      mockFs.stat = vi.fn().mockResolvedValue({ size: 512 });
    });

    it('should write extensions configuration successfully', async () => {
      const result = await service.writeExtensions(mockExtensionsConfig, mockOptions);

      expect(result.success).toBe(true);
      expect(result.filePath).toContain('extensions.json');
      expect(result.bytesWritten).toBe(512);
      expect(result.errors).toHaveLength(0);

      // Verify extensions file was written with correct structure
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('extensions.json'),
        expect.stringContaining('"recommendations"'),
        'utf8'
      );

      const writeCall = (mockFs.writeFile as any).mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1]);
      expect(writtenContent.recommendations).toEqual(mockExtensionsConfig.recommendations);
      expect(writtenContent.unwantedRecommendations).toEqual(mockExtensionsConfig.unwanted);
      expect(writtenContent.settings).toEqual(mockExtensionsConfig.settings);
    });

    it('should handle minimal extensions config', async () => {
      const minimalConfig: CursorExtensionsConfig = {
        recommendations: ['ms-vscode.vscode-typescript-next'],
      };

      const result = await service.writeExtensions(minimalConfig, mockOptions);

      expect(result.success).toBe(true);
      
      const writeCall = (mockFs.writeFile as any).mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1]);
      expect(writtenContent.recommendations).toEqual(['ms-vscode.vscode-typescript-next']);
      expect(writtenContent.unwantedRecommendations).toEqual([]);
      expect(writtenContent.settings).toBeUndefined();
    });

    it('should validate extensions and provide warnings', async () => {
      const largeExtensionsConfig: CursorExtensionsConfig = {
        recommendations: Array(60).fill(0).map((_, i) => `extension-${i}`),
      };

      const result = await service.writeExtensions(largeExtensionsConfig, mockOptions);

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].type).toBe('performance');
    });

    it('should detect conflicting extensions', async () => {
      const conflictingConfig: CursorExtensionsConfig = {
        recommendations: ['ms-vscode.typescript', 'esbenp.prettier-vscode'],
        unwanted: ['ms-vscode.typescript'],
      };

      const result = await service.writeExtensions(conflictingConfig, mockOptions);

      expect(result.success).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'configuration',
          message: expect.stringContaining('listed in both recommendations and unwanted'),
        })
      );
    });

    it('should handle file write errors', async () => {
      mockFs.writeFile = vi.fn().mockRejectedValue(new Error('Disk full'));

      const result = await service.writeExtensions(mockExtensionsConfig, mockOptions);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].component).toBe('extensions');
      expect(result.errors[0].severity).toBe('high');
    });
  });

  describe('ensureCursorDirectories', () => {
    it('should create all required directories', async () => {
      const options: CursorDeploymentOptions = {
        platform: 'cursor' as const,
        cursorPath: '/test/cursor',
        workspacePath: '/test/workspace',
        components: [],
        skipComponents: [],
      };

      mockFs.mkdir = vi.fn().mockResolvedValue(undefined);

      const result = await service.ensureCursorDirectories(options);

      expect(result.globalConfigDir).toContain('User');
      expect(result.projectConfigDir).toContain('.vscode');
      expect(result.extensionsDir).toBeDefined();
      expect(result.snippetsDir).toBeDefined();
      expect(result.aiConfigDir).toBeDefined();

      // Verify all directories were created
      expect(mockFs.mkdir).toHaveBeenCalledTimes(5);
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      );
    });

    it('should handle directories without workspace path', async () => {
      const options: CursorDeploymentOptions = {
        platform: 'cursor' as const,
        cursorPath: '/test/cursor',
        components: [],
        skipComponents: [],
      };

      mockFs.mkdir = vi.fn().mockResolvedValue(undefined);

      const result = await service.ensureCursorDirectories(options);

      expect(result.globalConfigDir).toBeDefined();
      expect(result.projectConfigDir).toBeUndefined();
      expect(result.debugConfigDir).toBeUndefined();
      expect(result.tasksConfigDir).toBeUndefined();

      // Should create 4 directories (without project-specific ones)
      expect(mockFs.mkdir).toHaveBeenCalledTimes(4);
    });

    it('should handle directory creation errors', async () => {
      const options: CursorDeploymentOptions = {
        platform: 'cursor' as const,
        components: [],
        skipComponents: [],
      };

      mockFs.mkdir = vi.fn().mockRejectedValue(new Error('Permission denied'));

      await expect(service.ensureCursorDirectories(options)).rejects.toThrow(
        'Unable to create directory structure'
      );
    });

    it('should use default paths when cursorPath is not provided', async () => {
      const options: CursorDeploymentOptions = {
        platform: 'cursor' as const,
        components: [],
        skipComponents: [],
      };

      mockFs.mkdir = vi.fn().mockResolvedValue(undefined);
      
      // Mock process.platform and process.env for testing
      const originalPlatform = process.platform;
      const originalHome = process.env.HOME;
      
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      process.env.HOME = '/Users/testuser';

      try {
        const result = await service.ensureCursorDirectories(options);
        expect(result.globalConfigDir).toContain('Library/Application Support/Cursor/User');
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
        process.env.HOME = originalHome;
      }
    });

    it('should handle different operating systems', async () => {
      const options: CursorDeploymentOptions = {
        platform: 'cursor' as const,
        components: [],
        skipComponents: [],
      };

      mockFs.mkdir = vi.fn().mockResolvedValue(undefined);
      
      const originalPlatform = process.platform;
      
      // Test Linux
      Object.defineProperty(process, 'platform', { value: 'linux' });
      process.env.HOME = '/home/testuser';

      try {
        const linuxResult = await service.ensureCursorDirectories(options);
        expect(linuxResult.globalConfigDir).toContain('.config/Cursor/User');
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      }
    });

    it('should throw error for unsupported platforms', async () => {
      const options: CursorDeploymentOptions = {
        platform: 'cursor' as const,
        components: [],
        skipComponents: [],
      };

      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'freebsd' });

      try {
        await expect(service.ensureCursorDirectories(options)).rejects.toThrow(
          'Unsupported platform: freebsd'
        );
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      }
    });
  });
});