/**
 * Tests for Cursor IDE workspace and multi-root project support
 */

import * as fs from 'fs/promises';
import { homedir } from 'os';
import * as path from 'path';

import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CursorCollectionService } from '../cursor-collection.service';

vi.mock('fs/promises');
vi.mock('os');

describe('CursorCollectionService - Workspace Support', () => {
  let service: CursorCollectionService;
  const mockFs = vi.mocked(fs);
  const mockHomedir = vi.mocked(homedir);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CursorCollectionService],
    }).compile();

    service = module.get<CursorCollectionService>(CursorCollectionService);
    mockHomedir.mockReturnValue('/home/user');
    vi.clearAllMocks();
  });

  describe('determineWorkspaceType', () => {
    it('should detect multi-root workspace', async () => {
      const projectPath = '/path/to/project';
      const workspaceContent = {
        folders: [
          { path: 'frontend' },
          { path: 'backend' },
          { path: 'shared' },
        ],
        settings: {
          'editor.fontSize': 14,
        },
      };

      // Need multiple readdir calls: workspace type detection and workspace config collection
      mockFs.readdir.mockResolvedValue([
        'project.code-workspace',
        '.vscode',
        'README.md',
      ] as any);
      
      // Mock for workspace file and settings
      mockFs.readFile.mockImplementation(async (filePath) => {
        if (filePath.toString().endsWith('.code-workspace')) {
          return JSON.stringify(workspaceContent);
        }
        if (filePath.toString().endsWith('settings.json')) {
          return JSON.stringify({});
        }
        throw new Error('File not found');
      });
      
      // Mock access - .vscode exists
      mockFs.access.mockResolvedValueOnce(undefined);
      
      const result = await service.collectCursorLocalSettings(projectPath);
      
      expect(result?.workspaceType).toBe('multi-root');
      expect(result?.workspaceConfig).toBeDefined();
      expect(result?.workspaceConfig?.folders).toHaveLength(3);
    });

    it('should detect single workspace', async () => {
      const projectPath = '/path/to/project';
      const workspaceContent = {
        folders: [
          { path: '.' },
        ],
        settings: {
          'editor.fontSize': 14,
        },
      };

      mockFs.readdir
        .mockResolvedValueOnce([
          'project.cursor-workspace',
          '.cursor',
          'package.json',
        ] as any)
        .mockResolvedValueOnce([  // For workspace configuration collection
          'project.cursor-workspace',
          '.cursor',
          'package.json',
        ] as any);
      
      mockFs.readFile.mockImplementation(async (filePath) => {
        if (filePath.toString().endsWith('.cursor-workspace')) {
          return JSON.stringify(workspaceContent);
        }
        if (filePath.toString().endsWith('settings.json')) {
          return JSON.stringify({});
        }
        throw new Error('File not found');
      });
      
      // Mock access - try .vscode first (fails), then .cursor (succeeds)
      mockFs.access
        .mockRejectedValueOnce(new Error('No .vscode'))
        .mockResolvedValueOnce(undefined);
      
      const result = await service.collectCursorLocalSettings(projectPath);
      
      expect(result?.workspaceType).toBe('single');
    });

    it('should detect single project without workspace file', async () => {
      const projectPath = '/path/to/project';

      mockFs.readdir.mockResolvedValueOnce([
        'package.json',
        'tsconfig.json',
        'src',
      ] as any);
      
      // No workspace file, but has project markers
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.access.mockRejectedValue(new Error('No .vscode'));
      
      const result = await service.collectCursorLocalSettings(projectPath);
      
      // Without .vscode or .cursor directory, result will be null
      expect(result).toBeNull();
    });
  });

  describe('collectWorkspaceConfiguration', () => {
    it('should collect complete workspace configuration', async () => {
      const projectPath = '/path/to/project';
      const workspaceContent = {
        folders: [
          { path: 'apps/web', name: 'Web App' },
          { path: 'apps/api', name: 'API Server' },
          { path: 'packages/shared' },
        ],
        settings: {
          'editor.fontSize': 14,
          'files.exclude': {
            '**/node_modules': true,
          },
        },
        launch: {
          version: '0.2.0',
          configurations: [
            {
              type: 'node',
              request: 'launch',
              name: 'Debug API',
              program: '${workspaceFolder}/apps/api/src/main.ts',
            },
          ],
        },
        tasks: {
          version: '2.0.0',
          tasks: [
            {
              label: 'Build All',
              type: 'shell',
              command: 'npm run build',
            },
          ],
        },
        extensions: {
          recommendations: [
            'dbaeumer.vscode-eslint',
            'esbenp.prettier-vscode',
          ],
        },
        remoteAuthority: 'ssh-remote+devserver',
      };

      // First call for determineWorkspaceType, second for collectWorkspaceConfiguration
      mockFs.readdir.mockResolvedValue([
        'monorepo.code-workspace',
        '.vscode',
        'package.json',
      ] as any);
      
      mockFs.readFile.mockImplementation(async (filePath) => {
        if (filePath.toString().endsWith('.code-workspace')) {
          return JSON.stringify(workspaceContent);
        }
        if (filePath.toString().endsWith('settings.json')) {
          return JSON.stringify({});
        }
        throw new Error('File not found');
      });

      // .vscode exists
      mockFs.access.mockResolvedValueOnce(undefined);

      const result = await service.collectCursorLocalSettings(projectPath);
      const workspace = result?.workspaceConfig;
      
      expect(workspace).toBeDefined();
      expect(workspace?.folders).toHaveLength(3);
      expect(workspace?.folders[0].name).toBe('Web App');
      expect(workspace?.settings).toBeDefined();
      expect(workspace?.launch).toBeDefined();
      expect(workspace?.tasks).toBeDefined();
      expect(workspace?.extensions?.recommendations).toContain('dbaeumer.vscode-eslint');
      expect(workspace?.remoteAuthority).toBe('ssh-remote+devserver');
    });
  });

  describe('variable substitution', () => {
    it('should substitute VS Code variables in launch configuration', async () => {
      const projectPath = '/path/to/project';
      
      const launchConfig = {
        version: '0.2.0',
        configurations: [
          {
            type: 'node',
            request: 'launch',
            name: 'Debug',
            program: '${workspaceFolder}/src/main.ts',
            cwd: '${workspaceFolder}',
            args: ['--config', '${workspaceFolder}/config.json'],
            env: {
              HOME: '${userHome}',
              SEP: '${pathSeparator}',
            },
          },
        ],
      };

      // For workspace type detection then for configuration
      mockFs.readdir
        .mockResolvedValueOnce(['.vscode', 'package.json'] as any)  // determineWorkspaceType
        .mockResolvedValueOnce(['.vscode', 'package.json'] as any); // collectWorkspaceConfiguration
      
      mockFs.access.mockResolvedValueOnce(undefined); // .vscode exists
      
      mockFs.readFile.mockImplementation(async (filePath) => {
        const file = filePath.toString();
        if (file.endsWith('launch.json')) {
          return JSON.stringify(launchConfig);
        }
        if (file.endsWith('settings.json')) {
          return JSON.stringify({});
        }
        throw new Error('File not found');
      });

      const result = await service.collectCursorLocalSettings(projectPath);
      const launch = result?.workspace?.launch;
      
      expect(launch?.configurations[0].program).toBe('/path/to/project/src/main.ts');
      expect(launch?.configurations[0].cwd).toBe('/path/to/project');
      expect(launch?.configurations[0].args).toContain('/path/to/project/config.json');
      expect((launch?.configurations[0].env as any)?.HOME).toBe('/home/user');
      expect((launch?.configurations[0].env as any)?.SEP).toBe(path.sep);
    });

    it('should substitute variables in task configuration', async () => {
      const projectPath = '/path/to/project';
      
      const tasksConfig = {
        version: '2.0.0',
        tasks: [
          {
            label: 'Build',
            type: 'shell',
            command: 'npm',
            args: ['run', 'build'],
            options: {
              cwd: '${workspaceFolder}/packages/app',
            },
          },
          {
            label: 'Test',
            type: 'shell',
            command: '${workspaceFolder}/scripts/test.sh',
            args: ['--workspace', '${workspaceFolderBasename}'],
          },
        ],
      };

      // For workspace type detection then for configuration
      mockFs.readdir
        .mockResolvedValueOnce(['.vscode', 'package.json'] as any)  // determineWorkspaceType
        .mockResolvedValueOnce(['.vscode', 'package.json'] as any); // collectWorkspaceConfiguration
      
      mockFs.access.mockResolvedValueOnce(undefined); // .vscode exists
      
      mockFs.readFile.mockImplementation(async (filePath) => {
        const file = filePath.toString();
        if (file.endsWith('tasks.json')) {
          return JSON.stringify(tasksConfig);
        }
        if (file.endsWith('settings.json')) {
          return JSON.stringify({});
        }
        throw new Error('File not found');
      });

      const result = await service.collectCursorLocalSettings(projectPath);
      const tasks = result?.workspace?.tasks;
      
      expect((tasks?.tasks[0] as any).options?.cwd).toBe('/path/to/project/packages/app');
      expect(tasks?.tasks[1].command).toBe('/path/to/project/scripts/test.sh');
      expect(tasks?.tasks[1].args).toContain('project');
    });
  });

  describe('generateProjectMetadata', () => {
    it('should detect Node.js project with framework', async () => {
      const projectPath = '/path/to/project';
      const packageJson = {
        name: 'test-app',
        dependencies: {
          '@nestjs/core': '^9.0.0',
          'express': '^4.18.0',
        },
        devDependencies: {
          'typescript': '^5.0.0',
          'vitest': '^0.34.0',
        },
      };

      mockFs.readdir.mockResolvedValue([
        'package.json',
        'tsconfig.json',
        '.git',
        'Dockerfile',
        'src',
      ] as any);
      
      mockFs.readFile.mockImplementation(async (filePath) => {
        if (filePath.toString().endsWith('package.json')) {
          return JSON.stringify(packageJson);
        }
        throw new Error('File not found');
      });

      const metadata = await service.generateProjectMetadata(projectPath);
      
      expect(metadata.type).toBe('node');
      expect(metadata.framework).toBe('nestjs');
      expect(metadata.dependencies).toBe(2);
      expect(metadata.devDependencies).toBe(2);
      expect(metadata.vcs).toBe('git');
      expect(metadata.docker).toBe(true);
    });

    it('should detect multiple languages in project', async () => {
      const projectPath = '/path/to/project';

      mockFs.readdir.mockResolvedValue([
        'main.ts',
        'app.tsx',
        'script.py',
        'lib.rs',
        'handler.go',
        'styles.css',
        'index.html',
      ] as any);
      
      mockFs.readFile.mockRejectedValue(new Error('No package.json'));

      const metadata = await service.generateProjectMetadata(projectPath);
      const languages = metadata.languages as string[];
      
      expect(languages).toContain('typescript');
      expect(languages).toContain('javascript'); // TSX includes JS
      expect(languages).toContain('python');
      expect(languages).toContain('rust');
      expect(languages).toContain('go');
    });

    it('should detect Python project', async () => {
      const projectPath = '/path/to/project';

      mockFs.readdir.mockResolvedValue([
        'requirements.txt',
        'main.py',
        'test_main.py',
        '.git',
      ] as any);
      
      mockFs.readFile.mockRejectedValue(new Error('No package.json'));

      const metadata = await service.generateProjectMetadata(projectPath);
      
      expect(metadata.type).toBe('python');
      expect((metadata.languages as string[])).toContain('python');
      expect(metadata.vcs).toBe('git');
    });

    it('should detect Rust project', async () => {
      const projectPath = '/path/to/project';

      mockFs.readdir.mockResolvedValue([
        'Cargo.toml',
        'src',
        'main.rs',
        '.git',
      ] as any);
      
      mockFs.readFile.mockRejectedValue(new Error('No package.json'));

      const metadata = await service.generateProjectMetadata(projectPath);
      
      expect(metadata.type).toBe('rust');
      expect((metadata.languages as string[])).toContain('rust');
    });
  });
});