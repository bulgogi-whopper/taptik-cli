import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { CursorFileWriterService } from './cursor-file-writer.service';
import {
  CursorGlobalSettings,
  CursorProjectSettings,
  CursorDeploymentOptions,
  CursorAIConfig,
  CursorDebugConfig,
  CursorTasksConfig,
  CursorSnippetsConfig,
  CursorWorkspaceConfig,
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

  describe('writeAIConfig', () => {
    const mockOptions: CursorDeploymentOptions = {
      platform: 'cursor' as const,
      workspacePath: '/test/workspace',
      components: [],
      skipComponents: [],
    };

    const mockAIConfig: CursorAIConfig = {
      rules: [
        'Always use TypeScript for new files',
        'Follow ESLint rules strictly',
        'Write comprehensive unit tests',
      ],
      context: [
        'This is a React TypeScript project using Vite and Vitest',
        'We follow functional programming patterns when possible',
      ],
      prompts: [
        {
          name: 'Code Review',
          content: 'Please review this code for best practices and suggest improvements.',
          category: 'development',
        },
        {
          name: 'Bug Fix',
          content: 'Help me identify and fix this bug. Explain the root cause.',
          category: 'debugging',
        },
        {
          name: 'Refactor',
          content: 'Suggest refactoring improvements for better maintainability.',
        },
      ],
      systemPrompt: 'You are a senior TypeScript developer',
      codegenEnabled: true,
      chatEnabled: true,
      completionsEnabled: true,
    };

    beforeEach(() => {
      mockFs.mkdir = vi.fn().mockResolvedValue(undefined);
      mockFs.writeFile = vi.fn().mockResolvedValue(undefined);
      mockFs.stat = vi.fn().mockResolvedValue({ size: 1024 });
    });

    it('should write complete AI configuration successfully', async () => {
      const result = await service.writeAIConfig(mockAIConfig, mockOptions);

      expect(result.rulesWritten).toBe(true);
      expect(result.contextWritten).toBe(true);
      expect(result.promptsWritten).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.files.rules).toContain('.cursorrules');
      expect(result.files.context).toBeDefined();
      expect(result.files.prompts).toBeDefined();

      // Verify .cursorrules file was written
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.cursorrules'),
        expect.stringContaining('Always use TypeScript'),
        'utf8'
      );

      // Verify multiple directories were created
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('context'),
        { recursive: true }
      );
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('prompts'),
        { recursive: true }
      );
    });

    it('should handle rules-only configuration', async () => {
      const rulesOnlyConfig: CursorAIConfig = {
        rules: ['Use consistent naming conventions'],
      };

      const result = await service.writeAIConfig(rulesOnlyConfig, mockOptions);

      expect(result.rulesWritten).toBe(true);
      expect(result.contextWritten).toBe(false);
      expect(result.promptsWritten).toBe(false);
      expect(result.files.rules).toBeDefined();
      expect(result.files.context).toBeUndefined();
      expect(result.files.prompts).toBeUndefined();
    });

    it('should format .cursorrules content properly', async () => {
      const config: CursorAIConfig = {
        rules: ['Rule without number', '2. Rule with number'],
      };

      await service.writeAIConfig(config, mockOptions);

      const rulesWriteCall = (mockFs.writeFile as any).mock.calls.find(
        (call: any[]) => call[0].includes('.cursorrules')
      );
      
      expect(rulesWriteCall).toBeDefined();
      const rulesContent = rulesWriteCall[1];
      expect(rulesContent).toContain('# Cursor AI Rules');
      expect(rulesContent).toContain('1. Rule without number');
      expect(rulesContent).toContain('2. Rule with number');
      expect(rulesContent).toContain('Generated by Taptik CLI');
    });

    it('should organize prompts by category', async () => {
      const categorizedConfig: CursorAIConfig = {
        prompts: [
          { name: 'Debug Help', content: 'Help with debugging', category: 'debugging' },
          { name: 'Code Review', content: 'Review this code', category: 'development' },
          { name: 'General Help', content: 'General assistance' },
        ],
      };

      await service.writeAIConfig(categorizedConfig, mockOptions);

      // Check that category directories were created
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('debugging'),
        { recursive: true }
      );
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('development'),
        { recursive: true }
      );

      // Verify prompt files were written
      const promptWriteCalls = (mockFs.writeFile as any).mock.calls.filter(
        (call: any[]) => call[0].includes('.md') && !call[0].includes('README')
      );
      expect(promptWriteCalls.length).toBeGreaterThanOrEqual(3);
    });

    it('should create index files for navigation', async () => {
      await service.writeAIConfig(mockAIConfig, mockOptions);

      // Check that README files were created
      const readmeWriteCalls = (mockFs.writeFile as any).mock.calls.filter(
        (call: any[]) => call[0].includes('README.md')
      );
      
      expect(readmeWriteCalls.length).toBeGreaterThanOrEqual(2); // context and prompts READMEs
      
      // Verify README content
      const contextReadme = readmeWriteCalls.find(call => 
        call[0].includes('context') && call[1].includes('AI Context Files')
      );
      expect(contextReadme).toBeDefined();

      const promptsReadme = readmeWriteCalls.find(call => 
        call[0].includes('prompts') && call[1].includes('AI Prompt Templates')
      );
      expect(promptsReadme).toBeDefined();
    });

    it('should validate and warn about large content', async () => {
      const result = await service.writeAIConfig(mockAIConfig, mockOptions);

      // This test verifies that the AI content validation logic exists
      // The validation should pass for normal content size
      expect(result.rulesWritten).toBe(true);
      expect(result.contextWritten).toBe(true);
      expect(result.promptsWritten).toBe(true);
      // Note: Large content warnings are tested separately in integration tests
    });

    it('should detect sensitive information in rules', async () => {
      const sensitiveConfig: CursorAIConfig = {
        rules: ['Use API_KEY=secret123 for authentication'],
      };

      const result = await service.writeAIConfig(sensitiveConfig, mockOptions);

      expect(result.rulesWritten).toBe(false);
      expect(result.errors.some(e => e.type === 'security')).toBe(true);
    });

    it('should sanitize filenames properly', async () => {
      const specialCharsConfig: CursorAIConfig = {
        prompts: [
          { name: 'File/with<special>chars?', content: 'Test content' },
          { name: 'Very long filename that exceeds the character limit and should be truncated', content: 'Test' },
        ],
      };

      await service.writeAIConfig(specialCharsConfig, mockOptions);

      const promptWriteCalls = (mockFs.writeFile as any).mock.calls.filter(
        (call: any[]) => call[0].includes('.md') && !call[0].includes('README')
      );

      expect(promptWriteCalls.some(call => 
        call[0].includes('file_with_special_chars_.md')
      )).toBe(true);

      expect(promptWriteCalls.some(call => {
        const filename = path.basename(call[0]);
        return filename.length <= 53; // 50 chars + .md
      })).toBe(true);
    });

    it('should handle write errors gracefully', async () => {
      mockFs.writeFile = vi.fn().mockRejectedValue(new Error('Permission denied'));

      const result = await service.writeAIConfig(mockAIConfig, mockOptions);

      expect(result.rulesWritten).toBe(false);
      expect(result.contextWritten).toBe(false);
      expect(result.promptsWritten).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].component).toBe('cursor-rules');
    });

    it('should validate total AI content size', async () => {
      const largePrompts = Array(50).fill(0).map((_, i) => ({
        name: `Prompt ${i}`,
        content: 'x'.repeat(5000), // 5KB each = 250KB total
      }));

      const largeConfig: CursorAIConfig = {
        prompts: largePrompts,
      };

      const result = await service.writeAIConfig(largeConfig, mockOptions);

      expect(result.warnings.some(w => 
        w.component === 'ai-config' && w.type === 'performance'
      )).toBe(true);
    });

    it('should handle empty AI configuration', async () => {
      const emptyConfig: CursorAIConfig = {};

      const result = await service.writeAIConfig(emptyConfig, mockOptions);

      expect(result.rulesWritten).toBe(false);
      expect(result.contextWritten).toBe(false);
      expect(result.promptsWritten).toBe(false);
      expect(result.errors).toHaveLength(0);
    });

    it('should format context files with proper headers', async () => {
      const contextConfig: CursorAIConfig = {
        context: ['Project uses React with TypeScript'],
      };

      await service.writeAIConfig(contextConfig, mockOptions);

      const contextWriteCall = (mockFs.writeFile as any).mock.calls.find(
        (call: any[]) => call[0].includes('context_1.md')
      );

      expect(contextWriteCall).toBeDefined();
      const contextContent = contextWriteCall[1];
      expect(contextContent).toContain('# AI Context 1');
      expect(contextContent).toContain('Generated by Taptik CLI');
      expect(contextContent).toContain('Project uses React with TypeScript');
    });

    it('should format prompt files with metadata', async () => {
      const promptConfig: CursorAIConfig = {
        prompts: [{
          name: 'Test Prompt',
          content: 'Test content here',
          category: 'testing',
        }],
      };

      await service.writeAIConfig(promptConfig, mockOptions);

      const promptWriteCall = (mockFs.writeFile as any).mock.calls.find(
        (call: any[]) => call[0].includes('test_prompt.md')
      );

      expect(promptWriteCall).toBeDefined();
      const promptContent = promptWriteCall[1];
      expect(promptContent).toContain('# Test Prompt');
      expect(promptContent).toContain('**Category**: testing');
      expect(promptContent).toContain('**Generated**:');
      expect(promptContent).toContain('Test content here');
    });
  });

  describe('writeDebugConfig', () => {
    const mockOptions: CursorDeploymentOptions = {
      platform: 'cursor' as const,
      workspacePath: '/test/workspace',
      components: [],
      skipComponents: [],
    };

    const mockDebugConfig: CursorDebugConfig = {
      version: '0.2.0',
      configurations: [
        {
          name: 'Launch Node.js',
          type: 'node',
          request: 'launch',
          program: '${workspaceFolder}/app.js',
          args: ['--debug'],
          env: {
            NODE_ENV: 'development',
          },
          cwd: '${workspaceFolder}',
        },
        {
          name: 'Attach to Node.js',
          type: 'node',
          request: 'attach',
          port: 9229,
          host: 'localhost',
        },
      ],
    };

    beforeEach(() => {
      mockFs.mkdir = vi.fn().mockResolvedValue(undefined);
      mockFs.writeFile = vi.fn().mockResolvedValue(undefined);
      mockFs.stat = vi.fn().mockResolvedValue({ size: 512 });
      mockFs.readFile = vi.fn().mockRejectedValue(new Error('File not found'));
    });

    it('should write debug configuration successfully', async () => {
      const result = await service.writeDebugConfig(mockDebugConfig, mockOptions);

      expect(result.success).toBe(true);
      expect(result.filePath).toContain('launch.json');
      expect(result.bytesWritten).toBe(512);
      expect(result.errors).toHaveLength(0);

      // Verify debug configuration was written with correct structure
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('launch.json'),
        expect.stringContaining('"Launch Node.js"'),
        'utf8'
      );

      const writeCall = (mockFs.writeFile as any).mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1]);
      expect(writtenContent.version).toBe('0.2.0');
      expect(writtenContent.configurations).toHaveLength(2);
    });

    it('should validate debug configuration', async () => {
      const invalidConfig: CursorDebugConfig = {
        version: '',
        configurations: [],
      };

      const result = await service.writeDebugConfig(invalidConfig, mockOptions);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.component === 'debug-config')).toBe(true);
    });

    it('should require workspace path', async () => {
      const optionsWithoutWorkspace = { ...mockOptions, workspacePath: undefined };

      const result = await service.writeDebugConfig(mockDebugConfig, optionsWithoutWorkspace);

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('Workspace path is required');
    });

    it('should merge with existing debug configuration', async () => {
      const existingConfig = {
        version: '0.2.0',
        configurations: [
          { name: 'Existing Config', type: 'node', request: 'launch' },
        ],
      };

      mockFs.readFile = vi.fn().mockResolvedValue(JSON.stringify(existingConfig));
      const mergeOptions = { ...mockOptions, mergeStrategy: 'merge' as const };

      const result = await service.writeDebugConfig(mockDebugConfig, mergeOptions);

      expect(result.success).toBe(true);

      const writeCall = (mockFs.writeFile as any).mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1]);
      expect(writtenContent.configurations.length).toBeGreaterThan(2); // Should include existing + new
    });
  });

  describe('writeTasks', () => {
    const mockOptions: CursorDeploymentOptions = {
      platform: 'cursor' as const,
      workspacePath: '/test/workspace',
      components: [],
      skipComponents: [],
    };

    const mockTasksConfig: CursorTasksConfig = {
      version: '2.0.0',
      tasks: [
        {
          label: 'Build Project',
          type: 'npm',
          command: 'run',
          args: ['build'],
          group: 'build',
          presentation: {
            echo: true,
            reveal: 'always',
            focus: false,
          },
          problemMatcher: '$tsc',
        },
        {
          label: 'Run Tests',
          type: 'shell',
          command: 'npm test',
          group: { kind: 'test', isDefault: true },
          dependsOn: 'Build Project',
        },
      ],
    };

    beforeEach(() => {
      mockFs.mkdir = vi.fn().mockResolvedValue(undefined);
      mockFs.writeFile = vi.fn().mockResolvedValue(undefined);
      mockFs.stat = vi.fn().mockResolvedValue({ size: 768 });
      mockFs.readFile = vi.fn().mockRejectedValue(new Error('File not found'));
    });

    it('should write tasks configuration successfully', async () => {
      const result = await service.writeTasks(mockTasksConfig, mockOptions);

      expect(result.success).toBe(true);
      expect(result.filePath).toContain('tasks.json');
      expect(result.bytesWritten).toBe(768);
      expect(result.errors).toHaveLength(0);

      // Verify tasks configuration was written
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('tasks.json'),
        expect.stringContaining('"Build Project"'),
        'utf8'
      );

      const writeCall = (mockFs.writeFile as any).mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1]);
      expect(writtenContent.version).toBe('2.0.0');
      expect(writtenContent.tasks).toHaveLength(2);
    });

    it('should validate tasks configuration', async () => {
      const invalidConfig: CursorTasksConfig = {
        version: '',
        tasks: [{ label: '', type: '', command: '' }] as any,
      };

      const result = await service.writeTasks(invalidConfig, mockOptions);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should require workspace path', async () => {
      const optionsWithoutWorkspace = { ...mockOptions, workspacePath: undefined };

      const result = await service.writeTasks(mockTasksConfig, optionsWithoutWorkspace);

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('Workspace path is required');
    });
  });

  describe('writeSnippets', () => {
    const mockOptions: CursorDeploymentOptions = {
      platform: 'cursor' as const,
      components: [],
      skipComponents: [],
    };

    const mockSnippetsConfig: Record<string, CursorSnippetsConfig> = {
      javascript: {
        'console.log': {
          prefix: 'log',
          body: 'console.log($1);',
          description: 'Console log statement',
        },
        'function': {
          prefix: 'fn',
          body: ['function ${1:name}(${2:params}) {', '\t$3', '}'],
          description: 'Function declaration',
          scope: 'javascript,typescript',
        },
      },
      typescript: {
        'interface': {
          prefix: 'interface',
          body: ['interface ${1:Name} {', '\t$2', '}'],
          description: 'TypeScript interface',
        },
      },
    };

    beforeEach(() => {
      mockFs.mkdir = vi.fn().mockResolvedValue(undefined);
      mockFs.writeFile = vi.fn().mockResolvedValue(undefined);
      mockFs.readFile = vi.fn().mockRejectedValue(new Error('File not found'));
    });

    it('should write snippets for multiple languages', async () => {
      const result = await service.writeSnippets(mockSnippetsConfig, mockOptions);

      expect(result.success).toBe(true);
      expect(result.filePaths).toHaveLength(2);
      expect(result.filePaths.some(path => path.includes('javascript.json'))).toBe(true);
      expect(result.filePaths.some(path => path.includes('typescript.json'))).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Verify both snippet files were written
      expect(mockFs.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should validate snippet structure', async () => {
      const invalidSnippets: Record<string, CursorSnippetsConfig> = {
        javascript: {
          'invalid-snippet': {
            prefix: '',
            body: '',
          } as any,
        },
      };

      const result = await service.writeSnippets(invalidSnippets, mockOptions);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.component === 'snippets')).toBe(true);
    });

    it('should handle empty snippets configuration', async () => {
      const emptySnippets: Record<string, CursorSnippetsConfig> = {};

      const result = await service.writeSnippets(emptySnippets, mockOptions);

      expect(result.success).toBe(false);
      expect(result.filePaths).toHaveLength(0);
    });

    it('should merge with existing snippets', async () => {
      const existingSnippets = {
        'existing-snippet': {
          prefix: 'exist',
          body: 'existing code',
          description: 'Existing snippet',
        },
      };

      mockFs.readFile = vi.fn().mockResolvedValue(JSON.stringify(existingSnippets));
      const mergeOptions = { ...mockOptions, mergeStrategy: 'merge' as const };

      const result = await service.writeSnippets(mockSnippetsConfig, mergeOptions);

      expect(result.success).toBe(true);
      
      // Should contain both existing and new snippets
      const jsWriteCall = (mockFs.writeFile as any).mock.calls.find(
        (call: any[]) => call[0].includes('javascript.json')
      );
      const writtenContent = JSON.parse(jsWriteCall[1]);
      expect(writtenContent['existing-snippet']).toBeDefined();
      expect(writtenContent['console.log']).toBeDefined();
    });
  });

  describe('writeWorkspace', () => {
    const mockOptions: CursorDeploymentOptions = {
      platform: 'cursor' as const,
      workspacePath: '/test/workspace',
      components: [],
      skipComponents: [],
    };

    const mockWorkspaceConfig: CursorWorkspaceConfig = {
      folders: [
        { path: './src', name: 'Source' },
        { path: './tests', name: 'Tests' },
        { path: '../shared-lib', name: 'Shared Library' },
      ],
      settings: {
        'editor.fontSize': 14,
        'files.exclude': {
          '**/.git': true,
          '**/.DS_Store': true,
        },
      },
      extensions: {
        recommendations: ['ms-vscode.vscode-typescript-next'],
      },
    };

    beforeEach(() => {
      mockFs.writeFile = vi.fn().mockResolvedValue(undefined);
      mockFs.stat = vi.fn().mockResolvedValue({ size: 1024 });
      mockFs.readFile = vi.fn().mockRejectedValue(new Error('File not found'));
    });

    it('should write workspace configuration successfully', async () => {
      const result = await service.writeWorkspace(mockWorkspaceConfig, mockOptions);

      expect(result.success).toBe(true);
      expect(result.filePath).toContain('.code-workspace');
      expect(result.bytesWritten).toBe(1024);
      expect(result.errors).toHaveLength(0);

      // Verify workspace configuration was written
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.code-workspace'),
        expect.stringContaining('"Source"'),
        'utf8'
      );

      const writeCall = (mockFs.writeFile as any).mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1]);
      expect(writtenContent.folders).toHaveLength(3);
      expect(writtenContent.settings).toBeDefined();
    });

    it('should validate workspace configuration', async () => {
      // Make config actually invalid by omitting folders array completely
      const invalidConfig: CursorWorkspaceConfig = {} as any;

      const result = await service.writeWorkspace(invalidConfig, mockOptions);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.component === 'workspace-config')).toBe(true);
    });

    it('should warn about dangerous folder paths', async () => {
      const result = await service.writeWorkspace(mockWorkspaceConfig, mockOptions);

      expect(result.success).toBe(true);
      expect(result.warnings.some(w => 
        w.type === 'security' && w.message.includes('parent directory')
      )).toBe(true);
    });

    it('should require workspace path', async () => {
      const optionsWithoutWorkspace = { ...mockOptions, workspacePath: undefined };

      const result = await service.writeWorkspace(mockWorkspaceConfig, optionsWithoutWorkspace);

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('Workspace path is required');
    });

    it('should merge with existing workspace configuration', async () => {
      const existingConfig = {
        folders: [{ path: './existing', name: 'Existing' }],
        settings: { 'editor.tabSize': 2 },
      };

      mockFs.readFile = vi.fn().mockResolvedValue(JSON.stringify(existingConfig));
      const mergeOptions = { ...mockOptions, mergeStrategy: 'merge' as const };

      const result = await service.writeWorkspace(mockWorkspaceConfig, mergeOptions);

      expect(result.success).toBe(true);

      const writeCall = (mockFs.writeFile as any).mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1]);
      expect(writtenContent.folders.length).toBe(4); // 1 existing + 3 new = 4 total
      expect(writtenContent.settings['editor.tabSize']).toBe(2); // Should preserve existing
      expect(writtenContent.settings['editor.fontSize']).toBe(14); // Should add new
    });
  });
});