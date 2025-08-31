/**
 * Tests for CursorCollectionService
 */

import * as fs from 'fs/promises';
import { homedir } from 'os';
import * as path from 'path';

import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';


import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CURSOR_TEST_FIXTURES } from '../test-fixtures/cursor-ide-fixtures';

import { CursorCollectionService } from './cursor-collection.service';

vi.mock('fs/promises');
vi.mock('os');

describe('CursorCollectionService', () => {
  let service: CursorCollectionService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CursorCollectionService,
        {
          provide: Logger,
          useValue: {
            log: () => {},
            warn: () => {},
            error: () => {},
            debug: () => {},
          },
        },
      ],
    }).compile();

    service = module.get<CursorCollectionService>(CursorCollectionService);
    vi.clearAllMocks();
  });

  describe('collectCursorLocalSettings', () => {
    it('should collect local settings from .vscode directory', async () => {
      const projectPath = '/test/project';
      const vscodePath = path.join(projectPath, '.vscode');
      
      // Mock file system
      vi.mocked(fs.access).mockImplementation(async (checkPath) => {
        if (checkPath.toString() === vscodePath) {
          return Promise.resolve();
        }
        throw new Error('ENOENT');
      });
      
      vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
        const file = filePath.toString();
        if (file.endsWith('settings.json')) {
          return JSON.stringify(CURSOR_TEST_FIXTURES.settings.valid);
        }
        if (file.endsWith('extensions.json')) {
          return JSON.stringify({
            recommendations: ['dbaeumer.vscode-eslint'],
          });
        }
        throw { code: 'ENOENT' };
      });
      
      vi.mocked(fs.readdir).mockResolvedValue([] as any);

      const result = await service.collectCursorLocalSettings(projectPath);

      expect(result).toBeDefined();
      expect(result?.projectPath).toBe(projectPath);
      expect(result?.isGlobal).toBe(false);
      expect(result?.settings).toBeDefined();
      expect(result?.extensions?.recommendations).toContain('dbaeumer.vscode-eslint');
    });

    it('should collect local settings from .cursor directory', async () => {
      const projectPath = '/test/project';
      const cursorPath = path.join(projectPath, '.cursor');
      
      // Mock file system
      vi.mocked(fs.access).mockImplementation(async (path) => {
        if (path === cursorPath) {
          return Promise.resolve();
        }
        throw new Error('ENOENT');
      });
      
      vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
        const file = filePath.toString();
        if (file.endsWith('settings.json')) {
          return JSON.stringify({
            'editor.fontSize': 14,
            'cursor.aiProvider': 'openai',
          });
        }
        if (file.endsWith('ai-rules.json')) {
          return JSON.stringify({
            rules: [
              {
                name: 'Test Rule',
                pattern: '*.ts',
                prompt: 'Generate docs',
              },
            ],
          });
        }
        throw new Error('ENOENT');
      });
      
      vi.mocked(fs.readdir).mockResolvedValue(['package.json'] as any);

      const result = await service.collectCursorLocalSettings(projectPath);

      expect(result).toBeDefined();
      expect(result?.projectPath).toBe(projectPath);
      expect(result?.projectAiRules).toBeDefined();
      expect(result?.projectAiRules?.rules).toHaveLength(1);
      expect(result?.workspaceType).toBe('single');
    });

    it('should handle missing local settings gracefully', async () => {
      const projectPath = '/test/project';
      
      // Mock file system - no .vscode or .cursor directory
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
      
      const result = await service.collectCursorLocalSettings(projectPath);

      expect(result).toBeNull();
    });

    it('should detect multi-root workspace', async () => {
      const projectPath = '/test/project';
      const vscodePath = path.join(projectPath, '.vscode');
      
      vi.mocked(fs.access).mockImplementation(async (path) => {
        if (path === vscodePath) {
          return Promise.resolve();
        }
        throw new Error('ENOENT');
      });
      
      vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
        const file = filePath.toString();
        if (file.endsWith('settings.json')) {
          return JSON.stringify({});
        }
        if (file.endsWith('.code-workspace')) {
          return JSON.stringify({
            folders: [
              { path: 'frontend' },
              { path: 'backend' },
            ],
          });
        }
        // Return error for other files (launch.json, tasks.json, etc.)
        throw new Error('ENOENT');
      });
      
      vi.mocked(fs.readdir).mockResolvedValue([
        'project.code-workspace',
        'package.json',
      ] as any);

      const result = await service.collectCursorLocalSettings(projectPath);

      expect(result?.workspaceType).toBe('multi-root');
    });
  });

  describe('collectCursorGlobalSettings', () => {
    it('should collect global settings from Cursor directory', async () => {
      const mockHomeDir = '/Users/test';
      vi.mocked(homedir).mockReturnValue(mockHomeDir);
      
      const {platform} = process;
      let globalPath: string;
      
      if (platform === 'darwin') {
        globalPath = path.join(mockHomeDir, '.cursor');
      } else if (platform === 'win32') {
        globalPath = path.join(mockHomeDir, 'AppData', 'Roaming', 'Cursor');
      } else {
        globalPath = path.join(mockHomeDir, '.config', 'Cursor');
      }
      
      // Mock file system
      vi.mocked(fs.access).mockImplementation(async (path) => {
        if (path === globalPath) {
          return Promise.resolve();
        }
        throw new Error('ENOENT');
      });
      
      vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
        const file = filePath.toString();
        if (file.endsWith('settings.json')) {
          return JSON.stringify({
            'editor.fontSize': 14,
            'workbench.colorTheme': 'One Dark Pro',
          });
        }
        if (file.endsWith('keybindings.json')) {
          return JSON.stringify([
            {
              key: 'cmd+k',
              command: 'cursor.aiChat',
            },
          ]);
        }
        throw new Error('ENOENT');
      });
      
      vi.mocked(fs.readdir).mockResolvedValue([] as any);

      const result = await service.collectCursorGlobalSettings();

      expect(result).toBeDefined();
      expect(result?.isGlobal).toBe(true);
      expect(result?.userHome).toBe(mockHomeDir);
      expect(result?.settings).toBeDefined();
      expect(result?.keybindings).toHaveLength(1);
    });

    it('should handle missing Cursor installation', async () => {
      const mockHomeDir = '/Users/test';
      vi.mocked(homedir).mockReturnValue(mockHomeDir);
      
      // Mock file system - no Cursor directory found
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
      
      const result = await service.collectCursorGlobalSettings();

      expect(result).toBeNull();
    });

    it('should collect installed extensions', async () => {
      const mockHomeDir = '/Users/test';
      vi.mocked(homedir).mockReturnValue(mockHomeDir);
      
      const globalPath = path.join(mockHomeDir, '.cursor');
      const extensionsPath = path.join(mockHomeDir, '.cursor', 'extensions');
      
      vi.mocked(fs.access).mockImplementation(async (path) => {
        if (path === globalPath) {
          return Promise.resolve();
        }
        throw new Error('ENOENT');
      });
      
      vi.mocked(fs.readdir).mockImplementation(async (pathToRead) => {
        if (pathToRead === extensionsPath) {
          return ['dbaeumer.vscode-eslint-2.4.0', 'esbenp.prettier-vscode-10.1.0'] as any;
        }
        return [] as any;
      });
      
      vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
        const file = filePath.toString();
        if (file.includes('dbaeumer.vscode-eslint') && file.endsWith('package.json')) {
          return JSON.stringify({
            name: 'vscode-eslint',
            publisher: 'dbaeumer',
            version: '2.4.0',
            displayName: 'ESLint',
          });
        }
        if (file.includes('esbenp.prettier-vscode') && file.endsWith('package.json')) {
          return JSON.stringify({
            name: 'prettier-vscode',
            publisher: 'esbenp',
            version: '10.1.0',
            displayName: 'Prettier',
          });
        }
        if (file.endsWith('settings.json')) {
          return JSON.stringify({});
        }
        throw new Error('ENOENT');
      });

      const result = await service.collectCursorGlobalSettings();

      expect(result?.globalExtensions).toHaveLength(2);
      expect(result?.globalExtensions?.[0].id).toBe('dbaeumer.vscode-eslint');
      expect(result?.globalExtensions?.[1].id).toBe('esbenp.prettier-vscode');
    });
  });

  describe('parseSettingsJson', () => {
    it('should parse valid settings JSON', async () => {
      const filePath = '/test/settings.json';
      const mockSettings = {
        'editor.fontSize': 14,
        'editor.tabSize': 2,
      };
      
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSettings));

      const result = await service.parseSettingsJson(filePath);

      expect(result).toEqual(mockSettings);
    });

    it('should handle missing settings file', async () => {
      const filePath = '/test/settings.json';
      
      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });

      const result = await service.parseSettingsJson(filePath);

      expect(result).toBeUndefined();
    });

    it('should handle invalid JSON', async () => {
      const filePath = '/test/settings.json';
      
      vi.mocked(fs.readFile).mockResolvedValue('invalid json');

      const result = await service.parseSettingsJson(filePath);

      expect(result).toBeUndefined();
    });
  });

  describe('parseCursorAiConfig', () => {
    it('should parse AI rules configuration', async () => {
      const dirPath = '/test/.cursor';
      
      vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
        const file = filePath.toString();
        if (file.endsWith('ai-rules.json')) {
          return JSON.stringify({
            rules: [
              {
                name: 'Documentation',
                pattern: '/**',
                prompt: 'Generate JSDoc',
              },
            ],
          });
        }
        throw new Error('ENOENT');
      });

      const result = await service.parseCursorAiConfig(dirPath);

      expect(result).toBeDefined();
      expect(result?.rules).toHaveLength(1);
      expect(result?.rules?.[0].name).toBe('Documentation');
    });

    it('should parse copilot settings', async () => {
      const dirPath = '/test/.cursor';
      
      vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
        const file = filePath.toString();
        if (file.endsWith('copilot-settings.json')) {
          return JSON.stringify({
            enable: true,
            inlineSuggest: {
              enable: true,
              delay: 100,
            },
          });
        }
        throw new Error('ENOENT');
      });

      const result = await service.parseCursorAiConfig(dirPath);

      expect(result).toBeDefined();
      expect(result?.copilot?.enable).toBe(true);
      expect(result?.copilot?.inlineSuggest?.delay).toBe(100);
    });

    it('should return null when no AI configuration found', async () => {
      const dirPath = '/test/.cursor';
      
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const result = await service.parseCursorAiConfig(dirPath);

      expect(result).toBeNull();
    });

    it('should merge multiple AI configuration files', async () => {
      const dirPath = '/test/.cursor';
      
      vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
        const file = filePath.toString();
        if (file.endsWith('ai-rules.json')) {
          return JSON.stringify({
            rules: [{ name: 'Rule1', pattern: '*.ts', prompt: 'Test' }],
          });
        }
        if (file.endsWith('cursor-config.json')) {
          return JSON.stringify({
            modelConfig: {
              provider: 'openai',
              model: 'gpt-4',
            },
          });
        }
        throw new Error('ENOENT');
      });

      const result = await service.parseCursorAiConfig(dirPath);

      expect(result).toBeDefined();
      expect(result?.rules).toHaveLength(1);
      expect(result?.modelConfig?.provider).toBe('openai');
    });
  });

  describe('collectSnippets', () => {
    it('should collect snippets from directory', async () => {
      const dirPath = '/test/.vscode';
      
      vi.mocked(fs.readdir).mockResolvedValue(['typescript.json', 'javascript.json'] as any);
      vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
        const file = filePath.toString();
        if (file.includes('typescript.json')) {
          return JSON.stringify({
            'Console Log': {
              prefix: 'cl',
              body: ['console.log($1);'],
              description: 'Log to console',
            },
          });
        }
        if (file.includes('javascript.json')) {
          return JSON.stringify({
            'Arrow Function': {
              prefix: 'af',
              body: ['const $1 = ($2) => {', '\t$3', '}'],
            },
          });
        }
        throw new Error('ENOENT');
      });

      const result = await service.collectSnippets(dirPath);

      expect(result).toBeDefined();
      expect(result?.typescript).toBeDefined();
      expect(result?.typescript?.['Console Log'].prefix).toBe('cl');
      expect(result?.javascript?.['Arrow Function'].prefix).toBe('af');
    });

    it('should return undefined when no snippets found', async () => {
      const dirPath = '/test/.vscode';
      
      vi.mocked(fs.readdir).mockRejectedValue(new Error('ENOENT'));

      const result = await service.collectSnippets(dirPath);

      expect(result).toBeUndefined();
    });
  });
});