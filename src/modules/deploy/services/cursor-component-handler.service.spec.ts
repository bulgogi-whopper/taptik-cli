import * as fs from 'node:fs/promises';

import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import {
  CursorConfiguration,
  CursorGlobalSettings,
  CursorProjectSettings,
} from '../interfaces/cursor-config.interface';
import { CursorDeployOptions } from '../interfaces/deploy-options.interface';

import { CursorComponentHandlerService } from './cursor-component-handler.service';

// Mock fs promises
vi.mock('node:fs/promises');
const mockFs = fs as any;

describe('CursorComponentHandlerService', () => {
  let service: CursorComponentHandlerService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [CursorComponentHandlerService],
    }).compile();

    service = module.get<CursorComponentHandlerService>(CursorComponentHandlerService);

    // Setup default mocks
    mockFs.access = vi.fn().mockRejectedValue(new Error('File not found'));
    mockFs.mkdir = vi.fn().mockResolvedValue(undefined);
    mockFs.readFile = vi.fn().mockResolvedValue('{}');
    mockFs.writeFile = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('deploy', () => {
    it('should deploy settings component successfully', async () => {
      const config: CursorConfiguration = {
        globalSettings: {
          'editor.fontSize': 14,
          'editor.fontFamily': 'Consolas',
          'workbench.colorTheme': 'Default Dark+',
        } as CursorGlobalSettings,
        projectSettings: {
          'editor.rulers': [80, 120],
          'search.exclude': { '**/node_modules': true },
        } as CursorProjectSettings,
      };

      const options: CursorDeployOptions = {
        platform: 'cursor-ide',
        conflictStrategy: 'overwrite',
        dryRun: false,
        validateOnly: false,
      };

      const result = await service.deploy(config, options);

      expect(result.success).toBe(true);
      expect(result.platform).toBe('cursor-ide');
      expect(result.deployedComponents).toContain('settings');
      expect(result.summary.filesDeployed).toBeGreaterThan(0);
    });

    it('should handle dry run mode', async () => {
      const config: CursorConfiguration = {
        globalSettings: {
          'editor.fontSize': 16,
        } as CursorGlobalSettings,
      };

      const options: CursorDeployOptions = {
        platform: 'cursor-ide',
        conflictStrategy: 'overwrite',
        dryRun: true,
        validateOnly: false,
      };

      const result = await service.deploy(config, options);

      expect(result.success).toBe(true);
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle file conflicts with merge strategy', async () => {
      const existingSettings = {
        'editor.fontSize': 12,
        'workbench.colorTheme': 'Light Theme',
      };

      mockFs.access = vi.fn().mockResolvedValue(undefined); // File exists
      mockFs.readFile = vi.fn().mockResolvedValue(JSON.stringify(existingSettings));

      const config: CursorConfiguration = {
        globalSettings: {
          'editor.fontSize': 14,
          'editor.fontFamily': 'Monaco',
        } as CursorGlobalSettings,
      };

      const options: CursorDeployOptions = {
        platform: 'cursor-ide',
        conflictStrategy: 'merge',
        dryRun: false,
        validateOnly: false,
      };

      const result = await service.deploy(config, options);

      expect(result.success).toBe(true);
      expect(result.summary.conflictsResolved).toBeGreaterThan(0);
      
      // Verify merged content was written
      expect(mockFs.writeFile).toHaveBeenCalled();
      const writtenContent = JSON.parse(mockFs.writeFile.mock.calls[0][1]);
      expect(writtenContent['editor.fontSize']).toBe(14); // New value
      expect(writtenContent['workbench.colorTheme']).toBe('Light Theme'); // Preserved
      expect(writtenContent['editor.fontFamily']).toBe('Monaco'); // New value
    });

    it('should skip deployment when conflict strategy is skip', async () => {
      mockFs.access = vi.fn().mockResolvedValue(undefined); // File exists
      mockFs.readFile = vi.fn().mockResolvedValue('{"existing": "settings"}');

      const config: CursorConfiguration = {
        globalSettings: {
          'editor.fontSize': 14,
        } as CursorGlobalSettings,
      };

      const options: CursorDeployOptions = {
        platform: 'cursor-ide',
        conflictStrategy: 'skip',
        dryRun: false,
        validateOnly: false,
      };

      const result = await service.deploy(config, options);

      expect(result.success).toBe(true);
      expect(result.summary.filesSkipped).toBeGreaterThan(0);
      expect(result.warnings?.some(w => w.code === 'CURSOR_SETTINGS_SKIPPED')).toBe(true);
    });

    it('should handle AI prompts deployment', async () => {
      const config: CursorConfiguration = {
        aiPrompts: {
          systemPrompts: {
            'code-review': {
              content: 'Review this code for best practices',
              description: 'Code review prompt',
              tags: ['review', 'quality'],
            },
          },
          projectPrompts: {
            'architecture': {
              content: 'Follow the project architecture guidelines',
              description: 'Architecture prompt',
              context: 'project',
              tags: ['architecture'],
            },
          },
          rules: {
            'coding-standards': 'Follow TypeScript coding standards',
            'security': 'Always validate user input',
          },
        },
      };

      const options: CursorDeployOptions = {
        platform: 'cursor-ide',
        conflictStrategy: 'overwrite',
        dryRun: false,
        validateOnly: false,
      };

      const result = await service.deploy(config, options);

      expect(result.success).toBe(true);
      expect(result.deployedComponents).toContain('ai-prompts');
      expect(result.summary.filesDeployed).toBeGreaterThan(0);
    });

    it('should handle extensions deployment', async () => {
      const config: CursorConfiguration = {
        extensions: {
          recommendations: [
            'esbenp.prettier-vscode',
            'ms-vscode.vscode-typescript-next',
          ],
          unwantedRecommendations: [
            'ms-vscode.vscode-json',
          ],
        },
      };

      const options: CursorDeployOptions = {
        platform: 'cursor-ide',
        conflictStrategy: 'overwrite',
        dryRun: false,
        validateOnly: false,
      };

      const result = await service.deploy(config, options);

      expect(result.success).toBe(true);
      expect(result.deployedComponents).toContain('extensions');
      expect(result.warnings?.some(w => w.message.includes('incompatible extensions'))).toBe(true);
    });

    it('should handle snippets deployment', async () => {
      const config: CursorConfiguration = {
        snippets: {
          typescript: {
            'console-log': {
              prefix: 'cl',
              body: ['console.log($1);'],
              description: 'Console log',
            },
            'arrow-function': {
              prefix: 'af',
              body: ['const $1 = ($2) => {', '  $3', '};'],
              description: 'Arrow function',
            },
          },
          javascript: {
            'function': {
              prefix: 'fn',
              body: ['function $1($2) {', '  $3', '}'],
              description: 'Function declaration',
            },
          },
        },
      };

      const options: CursorDeployOptions = {
        platform: 'cursor-ide',
        conflictStrategy: 'overwrite',
        dryRun: false,
        validateOnly: false,
      };

      const result = await service.deploy(config, options);

      expect(result.success).toBe(true);
      expect(result.deployedComponents).toContain('snippets');
      expect(result.summary.filesDeployed).toBe(2); // typescript.json and javascript.json
    });

    it('should handle tasks deployment', async () => {
      const config: CursorConfiguration = {
        tasks: {
          version: '2.0.0',
          tasks: [
            {
              label: 'build',
              type: 'npm',
              command: 'run',
              args: ['build'],
              group: 'build',
            },
            {
              label: 'test',
              type: 'npm',
              command: 'run',
              args: ['test'],
              group: 'test',
            },
          ],
        },
      };

      const options: CursorDeployOptions = {
        platform: 'cursor-ide',
        conflictStrategy: 'overwrite',
        dryRun: false,
        validateOnly: false,
      };

      const result = await service.deploy(config, options);

      expect(result.success).toBe(true);
      expect(result.deployedComponents).toContain('tasks');
    });

    it('should handle launch configuration deployment', async () => {
      const config: CursorConfiguration = {
        launch: {
          version: '0.2.0',
          configurations: [
            {
              name: 'Launch Program',
              type: 'node',
              request: 'launch',
              program: '${workspaceFolder}/dist/main.js',
              console: 'integratedTerminal',
            },
            {
              name: 'Attach to Process',
              type: 'node',
              request: 'attach',
              port: 9229,
            },
          ],
        },
      };

      const options: CursorDeployOptions = {
        platform: 'cursor-ide',
        conflictStrategy: 'overwrite',
        dryRun: false,
        validateOnly: false,
      };

      const result = await service.deploy(config, options);

      expect(result.success).toBe(true);
      expect(result.deployedComponents).toContain('launch');
    });

    it('should handle deployment errors gracefully', async () => {
      mockFs.mkdir = vi.fn().mockRejectedValue(new Error('Permission denied'));

      const config: CursorConfiguration = {
        globalSettings: {
          'editor.fontSize': 14,
        } as CursorGlobalSettings,
      };

      const options: CursorDeployOptions = {
        platform: 'cursor-ide',
        conflictStrategy: 'overwrite',
        dryRun: false,
        validateOnly: false,
      };

      const result = await service.deploy(config, options);

      expect(result.success).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should deploy only specified components', async () => {
      const config: CursorConfiguration = {
        globalSettings: {
          'editor.fontSize': 14,
        } as CursorGlobalSettings,
        extensions: {
          recommendations: ['esbenp.prettier-vscode'],
          unwantedRecommendations: [],
        },
        snippets: {
          typescript: {
            'test': {
              prefix: 'test',
              body: ['test'],
              description: 'Test',
            },
          },
        },
      };

      const options: CursorDeployOptions = {
        platform: 'cursor-ide',
        conflictStrategy: 'overwrite',
        dryRun: false,
        validateOnly: false,
        components: ['settings', 'extensions'], // Only deploy these
      };

      const result = await service.deploy(config, options);

      expect(result.success).toBe(true);
      expect(result.deployedComponents).toContain('settings');
      expect(result.deployedComponents).toContain('extensions');
      expect(result.deployedComponents).not.toContain('snippets');
    });

    it('should skip specified components', async () => {
      const config: CursorConfiguration = {
        globalSettings: {
          'editor.fontSize': 14,
        } as CursorGlobalSettings,
        extensions: {
          recommendations: ['esbenp.prettier-vscode'],
          unwantedRecommendations: [],
        },
      };

      const options: CursorDeployOptions = {
        platform: 'cursor-ide',
        conflictStrategy: 'overwrite',
        dryRun: false,
        validateOnly: false,
        skipComponents: ['extensions'], // Skip this component
      };

      const result = await service.deploy(config, options);

      expect(result.success).toBe(true);
      expect(result.deployedComponents).toContain('settings');
      expect(result.deployedComponents).not.toContain('extensions');
    });
  });
});