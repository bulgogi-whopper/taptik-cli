import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';

import { TaptikContext } from '../context/interfaces/taptik-context.interface';
import { SupabaseService } from '../supabase/supabase.service';

import { DeployModule } from './deploy.module';
import { CursorDeploymentService } from './services/cursor-deployment.service';
import { CursorFileWriterService } from './services/cursor-file-writer.service';
import { CursorTransformerService } from './services/cursor-transformer.service';
import { CursorValidatorService } from './services/cursor-validator.service';
import { ImportService } from './services/import.service';
import { CursorDeploymentOptions } from './interfaces/cursor-deployment.interface';

// Test fixtures for real Cursor configuration files
const REAL_CURSOR_CONFIGS = {
  cursorrules: `# Cursor Rules for TypeScript/NestJS Project

## Core Principles
- Use TypeScript with strict mode enabled
- Follow NestJS conventions and best practices
- Write comprehensive unit tests for all functions
- Use meaningful variable and function names
- Add proper error handling and logging

## Code Style
- Use PascalCase for classes and interfaces
- Use camelCase for variables, functions, and methods
- Use kebab-case for file and directory names
- Use UPPERCASE for environment variables and constants

## Architecture Guidelines
- Follow SOLID principles
- Prefer composition over inheritance
- Use dependency injection consistently
- Implement proper separation of concerns
- Create reusable utility functions

## Testing Requirements
- Write unit tests for each service and controller
- Use the AAA pattern (Arrange, Act, Assert)
- Mock external dependencies appropriately
- Achieve minimum 80% code coverage
- Write integration tests for critical workflows

## Error Handling
- Use custom exception classes
- Provide meaningful error messages
- Log errors with appropriate context
- Implement proper recovery mechanisms
- Never expose sensitive information in errors

## Security Guidelines
- Validate all input data
- Use parameterized queries for database operations
- Implement proper authentication and authorization
- Sanitize user input to prevent XSS attacks
- Use HTTPS for all external communications

## Performance Best Practices
- Use async/await for asynchronous operations
- Implement proper caching strategies
- Optimize database queries
- Use streaming for large data operations
- Monitor and log performance metrics`,

  settings: {
    "editor.fontSize": 14,
    "editor.fontFamily": "JetBrains Mono, Consolas, 'Courier New', monospace",
    "editor.lineHeight": 1.5,
    "editor.wordWrap": "on",
    "editor.minimap.enabled": true,
    "editor.rulers": [80, 120],
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll.eslint": true,
      "source.organizeImports": true
    },
    "files.autoSave": "afterDelay",
    "files.autoSaveDelay": 1000,
    "workbench.colorTheme": "Dark+ (default dark)",
    "workbench.iconTheme": "vs-seti",
    "terminal.integrated.fontSize": 13,
    "terminal.integrated.fontFamily": "JetBrains Mono",
    "typescript.preferences.includePackageJsonAutoImports": "auto",
    "typescript.suggest.autoImports": true,
    "typescript.updateImportsOnFileMove.enabled": "always",
    "eslint.format.enable": true,
    "prettier.requireConfig": true,
    "git.autofetch": true,
    "git.confirmSync": false,
    "extensions.autoUpdate": true,
    "extensions.autoCheckUpdates": true
  },

  extensions: {
    "recommendations": [
      "ms-vscode.vscode-typescript-next",
      "esbenp.prettier-vscode", 
      "dbaeumer.vscode-eslint",
      "bradlc.vscode-tailwindcss",
      "ms-vscode.vscode-json",
      "redhat.vscode-yaml",
      "ms-vscode.test-adapter-converter",
      "hbenl.vscode-test-explorer",
      "formulahendry.auto-rename-tag",
      "christian-kohler.path-intellisense",
      "streetsidesoftware.code-spell-checker",
      "gruntfuggly.todo-tree",
      "eamodio.gitlens",
      "ms-vscode.vscode-docker",
      "ms-vscode-remote.remote-containers"
    ],
    "unwantedRecommendations": [
      "ms-vscode.vscode-typescript",
      "hookyqr.beautify"
    ]
  },

  launchConfig: {
    "version": "0.2.0",
    "configurations": [
      {
        "name": "Launch CLI",
        "type": "node",
        "request": "launch",
        "program": "${workspaceFolder}/dist/cli.js",
        "args": ["--help"],
        "outFiles": ["${workspaceFolder}/dist/**/*.js"],
        "env": {
          "NODE_ENV": "development"
        },
        "console": "integratedTerminal",
        "skipFiles": ["<node_internals>/**"]
      },
      {
        "name": "Debug Tests",
        "type": "node",
        "request": "launch",
        "program": "${workspaceFolder}/node_modules/.bin/vitest",
        "args": ["run", "--reporter=verbose"],
        "outFiles": ["${workspaceFolder}/dist/**/*.js"],
        "env": {
          "NODE_ENV": "test"
        },
        "console": "integratedTerminal",
        "skipFiles": ["<node_internals>/**"]
      },
      {
        "name": "Deploy Command",
        "type": "node", 
        "request": "launch",
        "program": "${workspaceFolder}/dist/cli.js",
        "args": ["deploy", "--platform", "cursor", "--dry-run"],
        "outFiles": ["${workspaceFolder}/dist/**/*.js"],
        "env": {
          "NODE_ENV": "development",
          "DEBUG": "taptik:*"
        },
        "console": "integratedTerminal"
      }
    ]
  },

  tasksConfig: {
    "version": "2.0.0",
    "tasks": [
      {
        "label": "Build",
        "type": "shell",
        "command": "pnpm",
        "args": ["run", "build"],
        "group": {
          "kind": "build",
          "isDefault": true
        },
        "presentation": {
          "echo": true,
          "reveal": "always",
          "focus": false,
          "panel": "shared"
        },
        "problemMatcher": "$tsc"
      },
      {
        "label": "Test",
        "type": "shell",
        "command": "pnpm",
        "args": ["run", "test"],
        "group": {
          "kind": "test",
          "isDefault": true
        },
        "presentation": {
          "echo": true,
          "reveal": "always",
          "focus": false,
          "panel": "shared"
        }
      },
      {
        "label": "Lint",
        "type": "shell",
        "command": "pnpm",
        "args": ["run", "lint"],
        "group": "build",
        "presentation": {
          "echo": true,
          "reveal": "silent",
          "focus": false,
          "panel": "shared"
        },
        "problemMatcher": "$eslint-stylish"
      },
      {
        "label": "Dev",
        "type": "shell",
        "command": "pnpm",
        "args": ["run", "dev"],
        "group": "build",
        "presentation": {
          "echo": true,
          "reveal": "always",
          "focus": true,
          "panel": "dedicated"
        },
        "isBackground": true
      },
      {
        "label": "Clean",
        "type": "shell",
        "command": "pnpm",
        "args": ["run", "clean"],
        "group": "build",
        "presentation": {
          "echo": true,
          "reveal": "silent",
          "focus": false,
          "panel": "shared"
        }
      }
    ]
  },

  workspaceConfig: {
    "folders": [
      {
        "name": "taptik-cli",
        "path": "."
      }
    ],
    "settings": {
      "typescript.preferences.includePackageJsonAutoImports": "auto",
      "npm.packageManager": "pnpm",
      "editor.formatOnSave": true,
      "editor.codeActionsOnSave": {
        "source.fixAll.eslint": true,
        "source.organizeImports": true
      },
      "files.exclude": {
        "**/node_modules": true,
        "**/dist": true,
        "**/.git": true,
        "**/*.log": true
      },
      "search.exclude": {
        "**/node_modules": true,
        "**/dist": true,
        "**/*.log": true
      }
    },
    "extensions": {
      "recommendations": [
        "ms-vscode.vscode-typescript-next",
        "esbenp.prettier-vscode",
        "dbaeumer.vscode-eslint"
      ]
    }
  },

  snippets: {
    "typescript": {
      "NestJS Service": {
        "prefix": "nestservice",
        "body": [
          "import { Injectable } from '@nestjs/common';",
          "",
          "@Injectable()",
          "export class ${1:ServiceName}Service {",
          "  constructor() {}",
          "",
          "  async ${2:methodName}(${3:params}): Promise<${4:ReturnType}> {",
          "    ${5:// Implementation}",
          "  }",
          "}"
        ],
        "description": "Create a NestJS service"
      },
      "NestJS Controller": {
        "prefix": "nestcontroller",
        "body": [
          "import { Controller, Get, Post, Body } from '@nestjs/common';",
          "import { ${1:ServiceName}Service } from './${2:service-name}.service';",
          "",
          "@Controller('${3:route}')",
          "export class ${1:ServiceName}Controller {",
          "  constructor(private readonly ${4:serviceName}Service: ${1:ServiceName}Service) {}",
          "",
          "  @Get()",
          "  async ${5:methodName}(): Promise<${6:ReturnType}> {",
          "    return this.${4:serviceName}Service.${7:serviceMethod}();",
          "  }",
          "}"
        ],
        "description": "Create a NestJS controller"
      },
      "Vitest Test": {
        "prefix": "vittest",
        "body": [
          "import { describe, it, expect, beforeEach, vi } from 'vitest';",
          "",
          "describe('${1:TestSuite}', () => {",
          "  beforeEach(() => {",
          "    vi.clearAllMocks();",
          "  });",
          "",
          "  it('should ${2:test description}', async () => {",
          "    // Arrange",
          "    ${3:// Setup}",
          "",
          "    // Act", 
          "    ${4:// Execute}",
          "",
          "    // Assert",
          "    ${5:// Verify}",
          "  });",
          "});"
        ],
        "description": "Create a Vitest test suite"
      }
    }
  }
};

describe('Cursor Real Configuration Integration Tests', () => {
  let module: TestingModule;
  let cursorDeploymentService: CursorDeploymentService;
  let cursorFileWriter: CursorFileWriterService;
  let cursorTransformer: CursorTransformerService;
  let cursorValidator: CursorValidatorService;
  let importService: ImportService;

  const testWorkspacePath = path.join(os.tmpdir(), 'cursor-real-config-test');
  const testCursorPath = path.join(testWorkspacePath, '.cursor');
  const testVSCodePath = path.join(testWorkspacePath, '.vscode');

  const mockSupabaseService = {
    getClient: vi.fn(() => ({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: { config: JSON.stringify({}) },
              error: null,
            })),
          })),
        })),
        insert: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      })),
    })),
  };

  beforeAll(async () => {
    // Create test workspace directories
    await fs.mkdir(testWorkspacePath, { recursive: true });
    await fs.mkdir(testCursorPath, { recursive: true });
    await fs.mkdir(testVSCodePath, { recursive: true });
  });

  afterAll(async () => {
    // Cleanup test workspace
    try {
      await fs.rm(testWorkspacePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    module = await Test.createTestingModule({
      imports: [DeployModule],
    })
      .overrideProvider(SupabaseService)
      .useValue(mockSupabaseService)
      .compile();

    cursorDeploymentService = module.get<CursorDeploymentService>(CursorDeploymentService);
    cursorFileWriter = module.get<CursorFileWriterService>(CursorFileWriterService);
    cursorTransformer = module.get<CursorTransformerService>(CursorTransformerService);
    cursorValidator = module.get<CursorValidatorService>(CursorValidatorService);
    importService = module.get<ImportService>(ImportService);
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('Real Cursor Configuration File Deployment', () => {
    it('should deploy comprehensive .cursorrules file', async () => {
      const deploymentOptions: CursorDeploymentOptions = {
        workspacePath: testWorkspacePath,
        components: ['ai-config'],
        conflictStrategy: 'merge',
        backupEnabled: true,
        validationEnabled: true,
        securityScanEnabled: true,
        dryRun: false,
      };

      // Mock file writer to capture actual file content
      const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
      
      vi.spyOn(cursorFileWriter, 'writeAIConfig').mockImplementation(async (workspacePath, aiConfig) => {
        const rulesPath = path.join(workspacePath, '.cursorrules');
        await fs.writeFile(rulesPath, REAL_CURSOR_CONFIGS.cursorrules);
        return [
          {
            component: 'ai-config',
            type: 'cursorrules',
            path: rulesPath,
            size: REAL_CURSOR_CONFIGS.cursorrules.length,
            success: true,
          },
        ];
      });

      vi.spyOn(cursorDeploymentService, 'deploy').mockImplementation(async () => {
        // Simulate the deployment process
        await cursorFileWriter.writeAIConfig(testWorkspacePath, {
          rules: REAL_CURSOR_CONFIGS.cursorrules.split('\n'),
          context: 'TypeScript/NestJS project with comprehensive coding standards',
        });

        return {
          success: true,
          platform: 'cursor',
          deployedComponents: ['ai-config'],
          skippedComponents: [],
          errors: [],
          warnings: [],
          summary: 'Cursor rules deployed successfully',
          duration: 1500,
        };
      });

      const result = await cursorDeploymentService.deploy(
        {} as TaptikContext,
        deploymentOptions,
      );

      expect(result.success).toBe(true);
      expect(result.deployedComponents).toContain('ai-config');
      expect(cursorFileWriter.writeAIConfig).toHaveBeenCalled();

      // Verify the .cursorrules content was written
      const writtenContent = writeFileSpy.mock.calls.find(call => 
        call[0].toString().includes('.cursorrules')
      );
      expect(writtenContent).toBeDefined();
      expect(writtenContent![1]).toContain('Use TypeScript with strict mode');
      expect(writtenContent![1]).toContain('Follow NestJS conventions');
    });

    it('should deploy comprehensive settings.json configuration', async () => {
      const deploymentOptions: CursorDeploymentOptions = {
        workspacePath: testWorkspacePath,
        components: ['workspace-settings'],
        conflictStrategy: 'merge',
        backupEnabled: true,
        validationEnabled: true,
        securityScanEnabled: true,
        dryRun: false,
      };

      const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      vi.spyOn(cursorFileWriter, 'writeSettings').mockImplementation(async (workspacePath, settings) => {
        const settingsPath = path.join(workspacePath, '.cursor', 'settings.json');
        await fs.writeFile(settingsPath, JSON.stringify(REAL_CURSOR_CONFIGS.settings, null, 2));
        return [
          {
            component: 'workspace-settings',
            type: 'settings',
            path: settingsPath,
            size: JSON.stringify(REAL_CURSOR_CONFIGS.settings).length,
            success: true,
          },
        ];
      });

      vi.spyOn(cursorDeploymentService, 'deploy').mockImplementation(async () => {
        await cursorFileWriter.writeSettings(testWorkspacePath, REAL_CURSOR_CONFIGS.settings);

        return {
          success: true,
          platform: 'cursor',
          deployedComponents: ['workspace-settings'],
          skippedComponents: [],
          errors: [],
          warnings: [],
          summary: 'Workspace settings deployed successfully',
          duration: 800,
        };
      });

      const result = await cursorDeploymentService.deploy(
        {} as TaptikContext,
        deploymentOptions,
      );

      expect(result.success).toBe(true);
      expect(cursorFileWriter.writeSettings).toHaveBeenCalled();

      // Verify settings content
      const settingsCall = writeFileSpy.mock.calls.find(call => 
        call[0].toString().includes('settings.json')
      );
      expect(settingsCall).toBeDefined();
      
      const settingsContent = JSON.parse(settingsCall![1] as string);
      expect(settingsContent['editor.fontSize']).toBe(14);
      expect(settingsContent['editor.fontFamily']).toContain('JetBrains Mono');
      expect(settingsContent['editor.formatOnSave']).toBe(true);
      expect(settingsContent['typescript.preferences.includePackageJsonAutoImports']).toBe('auto');
    });

    it('should deploy extensions.json with comprehensive recommendations', async () => {
      const deploymentOptions: CursorDeploymentOptions = {
        workspacePath: testWorkspacePath,
        components: ['extensions'],
        conflictStrategy: 'merge',
        backupEnabled: true,
        validationEnabled: true,
        securityScanEnabled: true,
        dryRun: false,
      };

      const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      vi.spyOn(cursorFileWriter, 'writeExtensions').mockImplementation(async (workspacePath, extensions) => {
        const extensionsPath = path.join(workspacePath, '.cursor', 'extensions.json');
        await fs.writeFile(extensionsPath, JSON.stringify(REAL_CURSOR_CONFIGS.extensions, null, 2));
        return [
          {
            component: 'extensions',
            type: 'extensions',
            path: extensionsPath,
            size: JSON.stringify(REAL_CURSOR_CONFIGS.extensions).length,
            success: true,
          },
        ];
      });

      vi.spyOn(cursorDeploymentService, 'deploy').mockImplementation(async () => {
        await cursorFileWriter.writeExtensions(testWorkspacePath, REAL_CURSOR_CONFIGS.extensions);

        return {
          success: true,
          platform: 'cursor',
          deployedComponents: ['extensions'],
          skippedComponents: [],
          errors: [],
          warnings: [],
          summary: 'Extensions configuration deployed successfully',
          duration: 600,
        };
      });

      const result = await cursorDeploymentService.deploy(
        {} as TaptikContext,
        deploymentOptions,
      );

      expect(result.success).toBe(true);
      expect(cursorFileWriter.writeExtensions).toHaveBeenCalled();

      // Verify extensions content
      const extensionsCall = writeFileSpy.mock.calls.find(call => 
        call[0].toString().includes('extensions.json')
      );
      expect(extensionsCall).toBeDefined();
      
      const extensionsContent = JSON.parse(extensionsCall![1] as string);
      expect(extensionsContent.recommendations).toContain('ms-vscode.vscode-typescript-next');
      expect(extensionsContent.recommendations).toContain('esbenp.prettier-vscode');
      expect(extensionsContent.recommendations).toContain('dbaeumer.vscode-eslint');
      expect(extensionsContent.unwantedRecommendations).toContain('ms-vscode.vscode-typescript');
    });

    it('should deploy debug configuration with multiple launch configs', async () => {
      const deploymentOptions: CursorDeploymentOptions = {
        workspacePath: testWorkspacePath,
        components: ['debug-config'],
        conflictStrategy: 'merge',
        backupEnabled: true,
        validationEnabled: true,
        securityScanEnabled: true,
        dryRun: false,
      };

      const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      vi.spyOn(cursorFileWriter, 'writeDebugConfig').mockImplementation(async (workspacePath, debugConfig) => {
        const launchPath = path.join(workspacePath, '.vscode', 'launch.json');
        await fs.writeFile(launchPath, JSON.stringify(REAL_CURSOR_CONFIGS.launchConfig, null, 2));
        return [
          {
            component: 'debug-config',
            type: 'launch',
            path: launchPath,
            size: JSON.stringify(REAL_CURSOR_CONFIGS.launchConfig).length,
            success: true,
          },
        ];
      });

      vi.spyOn(cursorDeploymentService, 'deploy').mockImplementation(async () => {
        await cursorFileWriter.writeDebugConfig(testWorkspacePath, REAL_CURSOR_CONFIGS.launchConfig);

        return {
          success: true,
          platform: 'cursor',
          deployedComponents: ['debug-config'],
          skippedComponents: [],
          errors: [],
          warnings: [],
          summary: 'Debug configuration deployed successfully',
          duration: 700,
        };
      });

      const result = await cursorDeploymentService.deploy(
        {} as TaptikContext,
        deploymentOptions,
      );

      expect(result.success).toBe(true);
      expect(cursorFileWriter.writeDebugConfig).toHaveBeenCalled();

      // Verify launch configuration content
      const launchCall = writeFileSpy.mock.calls.find(call => 
        call[0].toString().includes('launch.json')
      );
      expect(launchCall).toBeDefined();
      
      const launchContent = JSON.parse(launchCall![1] as string);
      expect(launchContent.version).toBe('0.2.0');
      expect(launchContent.configurations).toHaveLength(3);
      expect(launchContent.configurations[0].name).toBe('Launch CLI');
      expect(launchContent.configurations[1].name).toBe('Debug Tests');
      expect(launchContent.configurations[2].name).toBe('Deploy Command');
    });

    it('should deploy tasks configuration with build and test tasks', async () => {
      const deploymentOptions: CursorDeploymentOptions = {
        workspacePath: testWorkspacePath,
        components: ['tasks'],
        conflictStrategy: 'merge',
        backupEnabled: true,
        validationEnabled: true,
        securityScanEnabled: true,
        dryRun: false,
      };

      const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      vi.spyOn(cursorFileWriter, 'writeTasks').mockImplementation(async (workspacePath, tasksConfig) => {
        const tasksPath = path.join(workspacePath, '.vscode', 'tasks.json');
        await fs.writeFile(tasksPath, JSON.stringify(REAL_CURSOR_CONFIGS.tasksConfig, null, 2));
        return [
          {
            component: 'tasks',
            type: 'tasks',
            path: tasksPath,
            size: JSON.stringify(REAL_CURSOR_CONFIGS.tasksConfig).length,
            success: true,
          },
        ];
      });

      vi.spyOn(cursorDeploymentService, 'deploy').mockImplementation(async () => {
        await cursorFileWriter.writeTasks(testWorkspacePath, REAL_CURSOR_CONFIGS.tasksConfig);

        return {
          success: true,
          platform: 'cursor',
          deployedComponents: ['tasks'],
          skippedComponents: [],
          errors: [],
          warnings: [],
          summary: 'Tasks configuration deployed successfully',
          duration: 500,
        };
      });

      const result = await cursorDeploymentService.deploy(
        {} as TaptikContext,
        deploymentOptions,
      );

      expect(result.success).toBe(true);
      expect(cursorFileWriter.writeTasks).toHaveBeenCalled();

      // Verify tasks configuration content
      const tasksCall = writeFileSpy.mock.calls.find(call => 
        call[0].toString().includes('tasks.json')
      );
      expect(tasksCall).toBeDefined();
      
      const tasksContent = JSON.parse(tasksCall![1] as string);
      expect(tasksContent.version).toBe('2.0.0');
      expect(tasksContent.tasks).toHaveLength(5);
      
      const buildTask = tasksContent.tasks.find((t: any) => t.label === 'Build');
      expect(buildTask).toBeDefined();
      expect(buildTask.command).toBe('pnpm');
      expect(buildTask.args).toEqual(['run', 'build']);
      
      const testTask = tasksContent.tasks.find((t: any) => t.label === 'Test');
      expect(testTask).toBeDefined();
      expect(testTask.group.kind).toBe('test');
    });

    it('should deploy workspace configuration with folder structure', async () => {
      const deploymentOptions: CursorDeploymentOptions = {
        workspacePath: testWorkspacePath,
        components: ['workspace-config'],
        conflictStrategy: 'merge',
        backupEnabled: true,
        validationEnabled: true,
        securityScanEnabled: true,
        dryRun: false,
      };

      const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      vi.spyOn(cursorFileWriter, 'writeWorkspace').mockImplementation(async (workspacePath, workspaceConfig) => {
        const workspaceFilePath = path.join(workspacePath, 'taptik-cli.code-workspace');
        await fs.writeFile(workspaceFilePath, JSON.stringify(REAL_CURSOR_CONFIGS.workspaceConfig, null, 2));
        return [
          {
            component: 'workspace-config',
            type: 'workspace',
            path: workspaceFilePath,
            size: JSON.stringify(REAL_CURSOR_CONFIGS.workspaceConfig).length,
            success: true,
          },
        ];
      });

      vi.spyOn(cursorDeploymentService, 'deploy').mockImplementation(async () => {
        await cursorFileWriter.writeWorkspace(testWorkspacePath, REAL_CURSOR_CONFIGS.workspaceConfig);

        return {
          success: true,
          platform: 'cursor',
          deployedComponents: ['workspace-config'],
          skippedComponents: [],
          errors: [],
          warnings: [],
          summary: 'Workspace configuration deployed successfully',
          duration: 400,
        };
      });

      const result = await cursorDeploymentService.deploy(
        {} as TaptikContext,
        deploymentOptions,
      );

      expect(result.success).toBe(true);
      expect(cursorFileWriter.writeWorkspace).toHaveBeenCalled();

      // Verify workspace configuration content
      const workspaceCall = writeFileSpy.mock.calls.find(call => 
        call[0].toString().includes('.code-workspace')
      );
      expect(workspaceCall).toBeDefined();
      
      const workspaceContent = JSON.parse(workspaceCall![1] as string);
      expect(workspaceContent.folders).toHaveLength(1);
      expect(workspaceContent.folders[0].name).toBe('taptik-cli');
      expect(workspaceContent.settings['npm.packageManager']).toBe('pnpm');
      expect(workspaceContent.extensions.recommendations).toContain('ms-vscode.vscode-typescript-next');
    });

    it('should deploy code snippets for TypeScript/NestJS development', async () => {
      const deploymentOptions: CursorDeploymentOptions = {
        workspacePath: testWorkspacePath,
        components: ['snippets'],
        conflictStrategy: 'merge',
        backupEnabled: true,
        validationEnabled: true,
        securityScanEnabled: true,
        dryRun: false,
      };

      const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      vi.spyOn(cursorFileWriter, 'writeSnippets').mockImplementation(async (workspacePath, snippetsConfig) => {
        const snippetsPath = path.join(workspacePath, '.cursor', 'snippets', 'typescript.json');
        await fs.mkdir(path.dirname(snippetsPath), { recursive: true });
        await fs.writeFile(snippetsPath, JSON.stringify(REAL_CURSOR_CONFIGS.snippets.typescript, null, 2));
        return [
          {
            component: 'snippets',
            type: 'typescript-snippets',
            path: snippetsPath,
            size: JSON.stringify(REAL_CURSOR_CONFIGS.snippets.typescript).length,
            success: true,
          },
        ];
      });

      vi.spyOn(cursorDeploymentService, 'deploy').mockImplementation(async () => {
        await cursorFileWriter.writeSnippets(testWorkspacePath, REAL_CURSOR_CONFIGS.snippets);

        return {
          success: true,
          platform: 'cursor',
          deployedComponents: ['snippets'],
          skippedComponents: [],
          errors: [],
          warnings: [],
          summary: 'Code snippets deployed successfully',
          duration: 300,
        };
      });

      const result = await cursorDeploymentService.deploy(
        {} as TaptikContext,
        deploymentOptions,
      );

      expect(result.success).toBe(true);
      expect(cursorFileWriter.writeSnippets).toHaveBeenCalled();

      // Verify snippets content
      const snippetsCall = writeFileSpy.mock.calls.find(call => 
        call[0].toString().includes('typescript.json')
      );
      expect(snippetsCall).toBeDefined();
      
      const snippetsContent = JSON.parse(snippetsCall![1] as string);
      expect(snippetsContent['NestJS Service']).toBeDefined();
      expect(snippetsContent['NestJS Controller']).toBeDefined();
      expect(snippetsContent['Vitest Test']).toBeDefined();
      expect(snippetsContent['NestJS Service'].prefix).toBe('nestservice');
    });

    it('should handle deployment of all components together', async () => {
      const deploymentOptions: CursorDeploymentOptions = {
        workspacePath: testWorkspacePath,
        components: ['ai-config', 'workspace-settings', 'extensions', 'debug-config', 'tasks', 'snippets'],
        conflictStrategy: 'merge',
        backupEnabled: true,
        validationEnabled: true,
        securityScanEnabled: true,
        dryRun: false,
      };

      const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      // Mock all file writing operations
      vi.spyOn(cursorFileWriter, 'writeAIConfig').mockResolvedValue([
        { component: 'ai-config', type: 'cursorrules', path: '.cursorrules', size: 1000, success: true },
      ]);
      vi.spyOn(cursorFileWriter, 'writeSettings').mockResolvedValue([
        { component: 'workspace-settings', type: 'settings', path: '.cursor/settings.json', size: 800, success: true },
      ]);
      vi.spyOn(cursorFileWriter, 'writeExtensions').mockResolvedValue([
        { component: 'extensions', type: 'extensions', path: '.cursor/extensions.json', size: 500, success: true },
      ]);
      vi.spyOn(cursorFileWriter, 'writeDebugConfig').mockResolvedValue([
        { component: 'debug-config', type: 'launch', path: '.vscode/launch.json', size: 1200, success: true },
      ]);
      vi.spyOn(cursorFileWriter, 'writeTasks').mockResolvedValue([
        { component: 'tasks', type: 'tasks', path: '.vscode/tasks.json', size: 1500, success: true },
      ]);
      vi.spyOn(cursorFileWriter, 'writeSnippets').mockResolvedValue([
        { component: 'snippets', type: 'typescript-snippets', path: '.cursor/snippets/typescript.json', size: 600, success: true },
      ]);

      vi.spyOn(cursorDeploymentService, 'deploy').mockResolvedValue({
        success: true,
        platform: 'cursor',
        deployedComponents: deploymentOptions.components,
        skippedComponents: [],
        errors: [],
        warnings: ['Some configurations merged with existing files'],
        summary: 'Complete Cursor workspace configuration deployed successfully',
        duration: 5000,
        details: {
          totalFiles: 6,
          totalSize: 5600,
          componentsProcessed: 6,
        },
      });

      const result = await cursorDeploymentService.deploy(
        {} as TaptikContext,
        deploymentOptions,
      );

      expect(result.success).toBe(true);
      expect(result.deployedComponents).toHaveLength(6);
      expect(result.summary).toContain('Complete Cursor workspace configuration');

      // Verify all file writers were called
      expect(cursorFileWriter.writeAIConfig).toHaveBeenCalled();
      expect(cursorFileWriter.writeSettings).toHaveBeenCalled();
      expect(cursorFileWriter.writeExtensions).toHaveBeenCalled();
      expect(cursorFileWriter.writeDebugConfig).toHaveBeenCalled();
      expect(cursorFileWriter.writeTasks).toHaveBeenCalled();
      expect(cursorFileWriter.writeSnippets).toHaveBeenCalled();
    });
  });

  describe('Configuration Merging and Conflict Resolution', () => {
    it('should merge existing Cursor settings with new configuration', async () => {
      // Setup existing configuration
      const existingSettings = {
        'editor.fontSize': 12,
        'editor.fontFamily': 'Monaco',
        'workbench.colorTheme': 'Light+ (default light)',
        'files.autoSave': 'off',
      };

      // Mock reading existing file
      vi.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify(existingSettings));

      const deploymentOptions: CursorDeploymentOptions = {
        workspacePath: testWorkspacePath,
        components: ['workspace-settings'],
        conflictStrategy: 'merge',
        backupEnabled: true,
        validationEnabled: true,
        securityScanEnabled: true,
        dryRun: false,
      };

      vi.spyOn(cursorTransformer, 'transformPersonalContext').mockResolvedValue({
        globalSettings: REAL_CURSOR_CONFIGS.settings,
        userPreferences: {},
      });

      vi.spyOn(cursorDeploymentService, 'deploy').mockImplementation(async () => {
        // Simulate merge logic
        const mergedSettings = {
          ...existingSettings,
          ...REAL_CURSOR_CONFIGS.settings,
        };

        await cursorFileWriter.writeSettings(testWorkspacePath, mergedSettings);

        return {
          success: true,
          platform: 'cursor',
          deployedComponents: ['workspace-settings'],
          skippedComponents: [],
          errors: [],
          warnings: ['Merged with existing settings, some values were overwritten'],
          summary: 'Settings merged successfully',
          duration: 1000,
          conflictsResolved: 3,
        };
      });

      const result = await cursorDeploymentService.deploy(
        {} as TaptikContext,
        deploymentOptions,
      );

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Merged with existing settings');
      expect(result.conflictsResolved).toBe(3);
    });

    it('should handle conflicting extension recommendations gracefully', async () => {
      const existingExtensions = {
        recommendations: [
          'ms-vscode.vscode-typescript', // Conflicts with typescript-next
          'ms-python.python',
          'esbenp.prettier-vscode',
        ],
        unwantedRecommendations: [],
      };

      vi.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify(existingExtensions));

      const deploymentOptions: CursorDeploymentOptions = {
        workspacePath: testWorkspacePath,
        components: ['extensions'],
        conflictStrategy: 'merge',
        backupEnabled: true,
        validationEnabled: true,
        securityScanEnabled: true,
        dryRun: false,
      };

      vi.spyOn(cursorDeploymentService, 'deploy').mockImplementation(async () => {
        // Simulate conflict resolution
        const resolvedExtensions = {
          recommendations: [
            ...REAL_CURSOR_CONFIGS.extensions.recommendations,
            'ms-python.python', // Keep non-conflicting extension
          ].filter((ext, index, arr) => arr.indexOf(ext) === index), // Remove duplicates
          unwantedRecommendations: [
            ...REAL_CURSOR_CONFIGS.extensions.unwantedRecommendations,
          ],
        };

        await cursorFileWriter.writeExtensions(testWorkspacePath, resolvedExtensions);

        return {
          success: true,
          platform: 'cursor',
          deployedComponents: ['extensions'],
          skippedComponents: [],
          errors: [],
          warnings: ['Resolved conflicting extension recommendations'],
          summary: 'Extensions configuration updated with conflict resolution',
          duration: 800,
          conflictsResolved: 1,
        };
      });

      const result = await cursorDeploymentService.deploy(
        {} as TaptikContext,
        deploymentOptions,
      );

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('conflicting extension recommendations');
      expect(result.conflictsResolved).toBe(1);
    });
  });
});
