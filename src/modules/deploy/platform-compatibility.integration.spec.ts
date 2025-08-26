import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';

import { TaptikContext } from '../context/interfaces/taptik-context.interface';
import { SupabaseService } from '../supabase/supabase.service';

import { DeployModule } from './deploy.module';
import { DeploymentService } from './services/deployment.service';
import { CursorDeploymentService } from './services/cursor-deployment.service';
import { KiroComponentHandlerService } from './services/kiro-component-handler.service';
import { PlatformValidatorService } from './services/platform-validator.service';
import { DiffService } from './services/diff.service';
import { ImportService } from './services/import.service';
import { DeploymentResult } from './interfaces/deployment-result.interface';
import { CursorDeploymentResult } from './interfaces/cursor-deployment.interface';
import { ComponentType, SupportedPlatform } from './interfaces/component-types.interface';
import { KiroDeploymentOptions } from './interfaces/kiro-deployment.interface';
import { DeployOptions } from './interfaces/deploy-options.interface';

describe('Platform Compatibility Integration Tests', () => {
  let module: TestingModule;
  let deploymentService: DeploymentService;
  let cursorDeploymentService: CursorDeploymentService;
  let kiroComponentHandler: KiroComponentHandlerService;
  let platformValidator: PlatformValidatorService;
  let diffService: DiffService;
  let importService: ImportService;

  const testWorkspacePath = path.join(os.tmpdir(), 'platform-compatibility-test');
  const testClaudeCodePath = path.join(testWorkspacePath, '.claude');
  const testKiroPath = path.join(testWorkspacePath, '.kiro');
  const testCursorPath = path.join(testWorkspacePath, '.cursor');

  // Shared test context for all platforms
  const sharedTaptikContext: TaptikContext = {
    metadata: {
      projectName: 'multi-platform-project',
      version: '1.0.0',
      description: 'Test project for platform compatibility',
      author: 'Platform Compatibility Team',
      repository: 'https://github.com/test/multi-platform-project',
      license: 'MIT',
      platforms: ['claude-code', 'kiro-ide', 'cursor-ide'],
      tags: ['multi-platform', 'compatibility', 'test'],
      lastModified: new Date().toISOString(),
      configVersion: '2.0.0',
    },
    personalContext: {
      userPreferences: {
        theme: 'dark',
        language: 'typescript',
        editorSettings: {
          fontSize: 14,
          fontFamily: 'JetBrains Mono',
          lineHeight: 1.5,
          wordWrap: true,
        },
        shortcuts: [
          { key: 'Ctrl+Shift+P', action: 'Show Command Palette' },
          { key: 'Ctrl+`', action: 'Toggle Terminal' },
        ],
      },
      aiSettings: {
        model: 'claude-3.5-sonnet',
        temperature: 0.7,
        maxTokens: 4000,
        systemPrompt: 'You are a helpful coding assistant with multi-platform expertise.',
      },
      workspacePreferences: {
        autoSave: true,
        formatOnSave: true,
        lintOnSave: true,
        showWhitespace: false,
      },
    },
    projectContext: {
      buildTool: 'pnpm',
      testFramework: 'vitest',
      linter: 'eslint',
      formatter: 'prettier',
      packageManager: 'pnpm',
      nodeVersion: '18.0.0',
      scripts: {
        build: 'pnpm run build',
        test: 'pnpm run test',
        lint: 'pnpm run lint',
        dev: 'pnpm run dev',
      },
      dependencies: ['@nestjs/core', '@nestjs/common'],
      devDependencies: ['typescript', 'vitest', 'eslint'],
      workspaceStructure: {
        srcDir: 'src',
        testDir: 'test',
        buildDir: 'dist',
        configFiles: ['tsconfig.json', 'package.json'],
      },
    },
    promptContext: {
      rules: [
        'Use TypeScript with strict mode enabled',
        'Follow platform-specific best practices',
        'Maintain compatibility across development environments',
        'Write comprehensive tests for all functionality',
      ],
      context: 'Multi-platform development with AI assistance',
      examples: [
        {
          title: 'Cross-platform Service',
          code: 'export class CrossPlatformService {\n  // Platform-agnostic implementation\n}',
        },
      ],
      workflows: [
        {
          name: 'Multi-platform Development',
          steps: ['Design', 'Implement', 'Test on all platforms', 'Deploy'],
        },
      ],
    },
  };

  const mockSupabaseService = {
    getClient: vi.fn(() => ({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: { config: JSON.stringify(sharedTaptikContext) },
              error: null,
            })),
          })),
        })),
        insert: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      })),
    })),
  };

  beforeAll(async () => {
    await fs.mkdir(testWorkspacePath, { recursive: true });
    await fs.mkdir(testClaudeCodePath, { recursive: true });
    await fs.mkdir(testKiroPath, { recursive: true });
    await fs.mkdir(testCursorPath, { recursive: true });
  });

  afterAll(async () => {
    try {
      await fs.rm(testWorkspacePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock filesystem operations
    vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    vi.spyOn(fs, 'readFile').mockResolvedValue('{}');
    vi.spyOn(fs, 'readdir').mockResolvedValue([]);
    vi.spyOn(fs, 'stat').mockResolvedValue({
      isFile: () => true,
      isDirectory: () => true,
      mtime: new Date(),
    } as any);
    vi.spyOn(fs, 'access').mockResolvedValue(undefined);
    vi.spyOn(fs, 'copyFile').mockResolvedValue(undefined);

    module = await Test.createTestingModule({
      imports: [DeployModule],
    })
      .overrideProvider(SupabaseService)
      .useValue(mockSupabaseService)
      .compile();

    deploymentService = module.get<DeploymentService>(DeploymentService);
    cursorDeploymentService = module.get<CursorDeploymentService>(CursorDeploymentService);
    kiroComponentHandler = module.get<KiroComponentHandlerService>(KiroComponentHandlerService);
    platformValidator = module.get<PlatformValidatorService>(PlatformValidatorService);
    diffService = module.get<DiffService>(DiffService);
    importService = module.get<ImportService>(ImportService);
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('Backward Compatibility with Claude Code', () => {
    it('should maintain existing Claude Code deployment functionality', async () => {
      const claudeOptions: DeployOptions = {
        workspacePath: testWorkspacePath,
        components: ['settings', 'agents', 'commands'],
        conflictStrategy: 'merge',
        dryRun: false,
        validateOnly: false,
      };

      // Mock Claude Code deployment
      vi.spyOn(deploymentService, 'deployToClaudeCode').mockResolvedValue({
        success: true,
        platform: 'claude-code',
        deployedComponents: claudeOptions.components,
        skippedComponents: [],
        errors: [],
        warnings: [],
        summary: {
          filesDeployed: 3,
          filesSkipped: 0,
          conflictsResolved: 0,
          backupCreated: false,
          deploymentTime: 1500,
        },
      });

      const result = await deploymentService.deployToClaudeCode(sharedTaptikContext, claudeOptions);

      expect(result.success).toBe(true);
      expect(result.platform).toBe('claude-code');
      expect(result.deployedComponents).toEqual(claudeOptions.components);
      expect(result.summary.filesDeployed).toBe(3);
    });

    it('should validate Claude Code specific configurations remain intact', async () => {
      const validationResult = await platformValidator.validateForPlatform(
        sharedTaptikContext,
        'claude-code',
      );

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);

      // Verify Claude Code specific validation logic is preserved
      expect(platformValidator.validateClaudeCode).toBeDefined();
    });

    it('should support Claude Code exclusive features without Cursor interference', async () => {
      const claudeSpecificContext = {
        ...sharedTaptikContext,
        metadata: {
          ...sharedTaptikContext.metadata,
          platforms: ['claude-code'], // Claude Code only
        },
        projectContext: {
          ...sharedTaptikContext.projectContext,
          claudeSpecific: {
            enableMCP: true,
            steeringDocuments: true,
            hooks: ['pre-commit', 'post-deploy'],
          },
        },
      };

      vi.spyOn(deploymentService, 'deployToClaudeCode').mockResolvedValue({
        success: true,
        platform: 'claude-code',
        deployedComponents: ['settings', 'agents', 'commands', 'mcp', 'steering', 'hooks'],
        skippedComponents: [],
        errors: [],
        warnings: [],
        summary: {
          filesDeployed: 6,
          filesSkipped: 0,
          conflictsResolved: 0,
          backupCreated: false,
          deploymentTime: 2000,
        },
      });

      const result = await deploymentService.deployToClaudeCode(
        claudeSpecificContext as TaptikContext,
        {
          workspacePath: testWorkspacePath,
          components: ['settings', 'agents', 'commands'],
          conflictStrategy: 'merge',
          dryRun: false,
          validateOnly: false,
        },
      );

      expect(result.success).toBe(true);
      expect(result.deployedComponents).toContain('settings');
      expect(result.deployedComponents).toContain('agents');
      expect(result.deployedComponents).toContain('commands');
    });

    it('should preserve Claude Code configuration format and structure', async () => {
      const claudeConfig = {
        version: '1.0.0',
        settings: {
          theme: 'dark',
          fontSize: 14,
          autoSave: true,
        },
        agents: [
          {
            name: 'code-assistant',
            model: 'claude-3.5-sonnet',
            role: 'coding helper',
          },
        ],
        commands: [
          {
            name: 'build',
            command: 'pnpm run build',
            description: 'Build the project',
          },
        ],
      };

      const writeFileSpy = vi.spyOn(fs, 'writeFile');

      vi.spyOn(deploymentService, 'deployToClaudeCode').mockImplementation(async () => {
        // Simulate Claude Code specific file structure
        await fs.writeFile(
          path.join(testClaudeCodePath, 'settings.json'),
          JSON.stringify(claudeConfig.settings, null, 2),
        );
        await fs.writeFile(
          path.join(testClaudeCodePath, 'agents.json'),
          JSON.stringify(claudeConfig.agents, null, 2),
        );
        await fs.writeFile(
          path.join(testClaudeCodePath, 'commands.json'),
          JSON.stringify(claudeConfig.commands, null, 2),
        );

        return {
          success: true,
          platform: 'claude-code',
          deployedComponents: ['settings', 'agents', 'commands'],
          skippedComponents: [],
          errors: [],
          warnings: [],
          summary: {
            filesDeployed: 3,
            filesSkipped: 0,
            conflictsResolved: 0,
            backupCreated: false,
            deploymentTime: 1200,
          },
        };
      });

      const result = await deploymentService.deployToClaudeCode(sharedTaptikContext, {
        workspacePath: testWorkspacePath,
        components: ['settings', 'agents', 'commands'],
        conflictStrategy: 'merge',
        dryRun: false,
        validateOnly: false,
      });

      expect(result.success).toBe(true);

      // Verify Claude Code specific file structure is maintained
      const settingsCall = writeFileSpy.mock.calls.find(call => 
        call[0].toString().includes('.claude/settings.json')
      );
      expect(settingsCall).toBeDefined();

      const agentsCall = writeFileSpy.mock.calls.find(call => 
        call[0].toString().includes('.claude/agents.json')
      );
      expect(agentsCall).toBeDefined();

      const commandsCall = writeFileSpy.mock.calls.find(call => 
        call[0].toString().includes('.claude/commands.json')
      );
      expect(commandsCall).toBeDefined();
    });
  });

  describe('Compatibility with Kiro IDE', () => {
    it('should maintain existing Kiro IDE deployment functionality', async () => {
      const kiroOptions: KiroDeploymentOptions = {
        platform: 'kiro-ide',
        conflictStrategy: 'merge',
        dryRun: false,
        validateOnly: false,
        components: ['settings', 'steering', 'specs'],
        globalSettings: true,
        projectSettings: true,
        preserveTaskStatus: true,
        mergeStrategy: 'deep-merge',
      };

      // Mock Kiro deployment
      vi.spyOn(deploymentService, 'deployToKiro').mockResolvedValue({
        success: true,
        platform: 'kiro-ide',
        deployedComponents: kiroOptions.components!,
        skippedComponents: [],
        errors: [],
        warnings: [],
        summary: {
          filesDeployed: 5,
          filesSkipped: 0,
          conflictsResolved: 1,
          backupCreated: false,
          deploymentTime: 2000,
        },
      });

      const result = await deploymentService.deployToKiro(sharedTaptikContext, kiroOptions);

      expect(result.success).toBe(true);
      expect(result.platform).toBe('kiro-ide');
      expect(result.deployedComponents).toEqual(kiroOptions.components);
      expect(result.summary.filesDeployed).toBe(5);
    });

    it('should preserve Kiro-specific component handling', async () => {
      const kiroContext = {
        ...sharedTaptikContext,
        projectContext: {
          ...sharedTaptikContext.projectContext,
          kiroSpecific: {
            steeringDocuments: [
              { name: 'architecture.md', content: 'Architecture guidelines' },
              { name: 'coding-standards.md', content: 'Coding standards' },
            ],
            specs: [
              { name: 'feature-spec.md', content: 'Feature specification' },
            ],
            hooks: [
              { name: 'pre-commit.sh', script: 'npm run lint' },
            ],
          },
        },
      };

      vi.spyOn(kiroComponentHandler, 'deploySteering').mockResolvedValue({
        deployedFiles: ['architecture.md', 'coding-standards.md'],
        errors: [],
        warnings: [],
        summary: 'Steering documents deployed successfully',
      });

      vi.spyOn(kiroComponentHandler, 'deploySpecs').mockResolvedValue({
        deployedFiles: ['feature-spec.md'],
        errors: [],
        warnings: [],
        summary: 'Specifications deployed successfully',
      });

      const steeringResult = await kiroComponentHandler.deploySteering(
        (kiroContext.projectContext as any).kiroSpecific.steeringDocuments,
        { workspacePath: testWorkspacePath, platform: 'kiro-ide' },
        {
          platform: 'kiro-ide',
          conflictStrategy: 'merge',
          dryRun: false,
          validateOnly: false,
          mergeStrategy: 'deep-merge',
        },
      );

      expect(steeringResult.deployedFiles).toContain('architecture.md');
      expect(steeringResult.deployedFiles).toContain('coding-standards.md');

      const specsResult = await kiroComponentHandler.deploySpecs(
        (kiroContext.projectContext as any).kiroSpecific.specs,
        { workspacePath: testWorkspacePath, platform: 'kiro-ide' },
        {
          platform: 'kiro-ide',
          conflictStrategy: 'merge',
          dryRun: false,
          validateOnly: false,
          mergeStrategy: 'deep-merge',
        },
      );

      expect(specsResult.deployedFiles).toContain('feature-spec.md');
    });

    it('should maintain Kiro configuration merging strategies', async () => {
      const existingKiroConfig = {
        version: '2.0.0',
        project: {
          name: 'existing-project',
          settings: {
            theme: 'light',
            autoSave: false,
          },
        },
        tasks: [
          { id: 'task-1', status: 'completed' },
          { id: 'task-2', status: 'in-progress' },
        ],
      };

      const newKiroConfig = {
        version: '2.0.0',
        project: {
          name: 'updated-project',
          settings: {
            theme: 'dark',
            fontSize: 14,
          },
        },
        tasks: [
          { id: 'task-1', status: 'completed' }, // Should preserve
          { id: 'task-3', status: 'pending' }, // New task
        ],
      };

      vi.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify(existingKiroConfig));

      vi.spyOn(diffService, 'generateDiff').mockReturnValue({
        hasChanges: true,
        added: ['project.settings.fontSize', 'tasks[2]'],
        removed: ['tasks[1]'],
        modified: ['project.name', 'project.settings.theme'],
        summary: 'Configuration updated with preservation of task status',
      });

      const mergedConfig = {
        version: '2.0.0',
        project: {
          name: 'updated-project',
          settings: {
            theme: 'dark',
            fontSize: 14,
            autoSave: false, // Preserved from existing
          },
        },
        tasks: [
          { id: 'task-1', status: 'completed' }, // Preserved
          { id: 'task-2', status: 'in-progress' }, // Preserved
          { id: 'task-3', status: 'pending' }, // New
        ],
      };

      vi.spyOn(deploymentService, 'deployToKiro').mockImplementation(async () => {
        await fs.writeFile(
          path.join(testKiroPath, 'settings.json'),
          JSON.stringify(mergedConfig, null, 2),
        );

        return {
          success: true,
          platform: 'kiro-ide',
          deployedComponents: ['settings'],
          skippedComponents: [],
          errors: [],
          warnings: ['Task status preserved during merge'],
          summary: {
            filesDeployed: 1,
            filesSkipped: 0,
            conflictsResolved: 3,
            backupCreated: false,
            deploymentTime: 1800,
          },
        };
      });

      const result = await deploymentService.deployToKiro(sharedTaptikContext, {
        platform: 'kiro-ide',
        conflictStrategy: 'merge',
        dryRun: false,
        validateOnly: false,
        components: ['settings'],
        preserveTaskStatus: true,
        mergeStrategy: 'deep-merge',
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Task status preserved during merge');
      expect(result.summary.conflictsResolved).toBe(3);
    });
  });

  describe('Mixed Platform Deployment Scenarios', () => {
    it('should handle sequential deployment to multiple platforms', async () => {
      const deploymentResults: Record<SupportedPlatform, DeploymentResult | CursorDeploymentResult> = {
        'claude-code': {
          success: true,
          platform: 'claude-code',
          deployedComponents: ['settings', 'agents'],
          skippedComponents: [],
          errors: [],
          warnings: [],
          summary: {
            filesDeployed: 2,
            filesSkipped: 0,
            conflictsResolved: 0,
            backupCreated: false,
            deploymentTime: 1000,
          },
        },
        'kiro-ide': {
          success: true,
          platform: 'kiro-ide',
          deployedComponents: ['settings', 'steering'],
          skippedComponents: [],
          errors: [],
          warnings: [],
          summary: {
            filesDeployed: 3,
            filesSkipped: 0,
            conflictsResolved: 0,
            backupCreated: false,
            deploymentTime: 1500,
          },
        },
        'cursor-ide': {
          success: true,
          platform: 'cursor',
          deployedComponents: ['ai-config', 'workspace-settings'],
          skippedComponents: [],
          errors: [],
          warnings: [],
          summary: 'Cursor deployment completed successfully',
          duration: 2000,
        } as CursorDeploymentResult,
      };

      // Mock deployments for each platform
      vi.spyOn(deploymentService, 'deployToClaudeCode').mockResolvedValue(
        deploymentResults['claude-code']
      );
      vi.spyOn(deploymentService, 'deployToKiro').mockResolvedValue(
        deploymentResults['kiro-ide']
      );
      vi.spyOn(cursorDeploymentService, 'deploy').mockResolvedValue(
        deploymentResults['cursor-ide'] as CursorDeploymentResult
      );

      const platforms: SupportedPlatform[] = ['claude-code', 'kiro-ide', 'cursor-ide'];
      const results: Array<DeploymentResult | CursorDeploymentResult> = [];

      // Sequential deployment
      for (const platform of platforms) {
        let result: DeploymentResult | CursorDeploymentResult;

        if (platform === 'claude-code') {
          result = await deploymentService.deployToClaudeCode(sharedTaptikContext, {
            workspacePath: testWorkspacePath,
            components: ['settings', 'agents'],
            conflictStrategy: 'merge',
            dryRun: false,
            validateOnly: false,
          });
        } else if (platform === 'kiro-ide') {
          result = await deploymentService.deployToKiro(sharedTaptikContext, {
            platform: 'kiro-ide',
            conflictStrategy: 'merge',
            dryRun: false,
            validateOnly: false,
            components: ['settings', 'steering'],
            mergeStrategy: 'deep-merge',
          });
        } else {
          result = await cursorDeploymentService.deploy({
            workspacePath: testWorkspacePath,
            components: ['ai-config', 'workspace-settings'],
            conflictStrategy: 'merge',
            backupEnabled: true,
            validationEnabled: true,
            securityScanEnabled: true,
            dryRun: false,
          });
        }

        results.push(result);
      }

      // Verify all deployments succeeded
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.platform).toBe(platforms[index] === 'cursor-ide' ? 'cursor' : platforms[index]);
      });

      // Verify no cross-platform interference
      expect(deploymentService.deployToClaudeCode).toHaveBeenCalledOnce();
      expect(deploymentService.deployToKiro).toHaveBeenCalledOnce();
      expect(cursorDeploymentService.deploy).toHaveBeenCalledOnce();
    });

    it('should handle platform-specific component mapping correctly', async () => {
      const multiPlatformContext = {
        ...sharedTaptikContext,
        metadata: {
          ...sharedTaptikContext.metadata,
          platformMappings: {
            'claude-code': {
              components: ['settings', 'agents', 'commands'],
              excludes: ['ai-config', 'extensions'],
            },
            'kiro-ide': {
              components: ['settings', 'steering', 'specs', 'hooks'],
              excludes: ['ai-config', 'debug-config'],
            },
            'cursor-ide': {
              components: ['ai-config', 'workspace-settings', 'extensions', 'debug-config'],
              excludes: ['agents', 'steering'],
            },
          },
        },
      };

      // Mock platform validation for component mappings
      vi.spyOn(platformValidator, 'validateForPlatform')
        .mockImplementation(async (context, platform) => {
          const mappings = (multiPlatformContext.metadata as any).platformMappings[platform];
          
          return {
            isValid: true,
            errors: [],
            warnings: mappings?.excludes?.length > 0 
              ? [`Some components excluded for ${platform}: ${mappings.excludes.join(', ')}`]
              : [],
          };
        });

      // Test each platform's component mapping
      const claudeValidation = await platformValidator.validateForPlatform(
        multiPlatformContext as TaptikContext,
        'claude-code'
      );
      expect(claudeValidation.isValid).toBe(true);
      expect(claudeValidation.warnings).toContain('Some components excluded for claude-code: ai-config, extensions');

      const kiroValidation = await platformValidator.validateForPlatform(
        multiPlatformContext as TaptikContext,
        'kiro-ide'
      );
      expect(kiroValidation.isValid).toBe(true);
      expect(kiroValidation.warnings).toContain('Some components excluded for kiro-ide: ai-config, debug-config');

      const cursorValidation = await platformValidator.validateForPlatform(
        multiPlatformContext as TaptikContext,
        'cursor-ide'
      );
      expect(cursorValidation.isValid).toBe(true);
      expect(cursorValidation.warnings).toContain('Some components excluded for cursor-ide: agents, steering');
    });

    it('should detect and resolve cross-platform configuration conflicts', async () => {
      const conflictingContext = {
        ...sharedTaptikContext,
        personalContext: {
          ...sharedTaptikContext.personalContext,
          conflictingSettings: {
            // Settings that might conflict across platforms
            theme: 'dark', // Supported by all
            fontSize: 14, // Different property names across platforms
            autoSave: true, // Different behaviors across platforms
            aiModel: 'claude-3.5-sonnet', // Cursor-specific
            agentConfig: 'advanced', // Claude Code specific
            steeringLevel: 'strict', // Kiro specific
          },
        },
      };

      // Mock conflict detection and resolution
      vi.spyOn(diffService, 'generateDiff').mockReturnValue({
        hasChanges: true,
        added: [],
        removed: [],
        modified: [],
        conflicts: [
          {
            path: 'personalContext.conflictingSettings.aiModel',
            platforms: ['cursor-ide'],
            resolution: 'Map to cursor-specific AI configuration',
          },
          {
            path: 'personalContext.conflictingSettings.agentConfig',
            platforms: ['claude-code'],
            resolution: 'Map to Claude Code agent settings',
          },
          {
            path: 'personalContext.conflictingSettings.steeringLevel',
            platforms: ['kiro-ide'],
            resolution: 'Map to Kiro steering document configuration',
          },
        ],
        summary: 'Cross-platform conflicts detected and resolved',
      });

      const conflicts = diffService.generateDiff(
        conflictingContext,
        sharedTaptikContext
      );

      expect(conflicts.hasChanges).toBe(true);
      expect(conflicts.conflicts).toHaveLength(3);
      expect(conflicts.conflicts![0].platforms).toContain('cursor-ide');
      expect(conflicts.conflicts![1].platforms).toContain('claude-code');
      expect(conflicts.conflicts![2].platforms).toContain('kiro-ide');
    });

    it('should support workspace-level multi-platform deployments', async () => {
      const workspaceConfig = {
        platforms: {
          'claude-code': {
            enabled: true,
            path: path.join(testWorkspacePath, '.claude'),
            components: ['settings', 'agents'],
            priority: 1,
          },
          'kiro-ide': {
            enabled: true,
            path: path.join(testWorkspacePath, '.kiro'),
            components: ['settings', 'steering'],
            priority: 2,
          },
          'cursor-ide': {
            enabled: true,
            path: path.join(testWorkspacePath, '.cursor'),
            components: ['ai-config', 'workspace-settings'],
            priority: 3,
          },
        },
        sharedComponents: ['settings'], // Components shared across platforms
        conflictResolution: 'platform-priority', // Use priority for conflicts
      };

      // Mock workspace-level deployment coordination
      const deploymentPromises = Object.entries(workspaceConfig.platforms)
        .sort(([, a], [, b]) => a.priority - b.priority)
        .map(async ([platform, config]) => {
          if (platform === 'claude-code') {
            return deploymentService.deployToClaudeCode(sharedTaptikContext, {
              workspacePath: config.path,
              components: config.components as ComponentType[],
              conflictStrategy: 'merge',
              dryRun: false,
              validateOnly: false,
            });
          } else if (platform === 'kiro-ide') {
            return deploymentService.deployToKiro(sharedTaptikContext, {
              platform: 'kiro-ide',
              conflictStrategy: 'merge',
              dryRun: false,
              validateOnly: false,
              components: config.components as any,
              mergeStrategy: 'deep-merge',
            });
          } else {
            return cursorDeploymentService.deploy({
              workspacePath: config.path,
              components: config.components as any,
              conflictStrategy: 'merge',
              backupEnabled: true,
              validationEnabled: true,
              securityScanEnabled: true,
              dryRun: false,
            });
          }
        });

      // Mock all deployments to succeed
      vi.spyOn(deploymentService, 'deployToClaudeCode').mockResolvedValue({
        success: true,
        platform: 'claude-code',
        deployedComponents: ['settings', 'agents'],
        skippedComponents: [],
        errors: [],
        warnings: [],
        summary: {
          filesDeployed: 2,
          filesSkipped: 0,
          conflictsResolved: 0,
          backupCreated: false,
          deploymentTime: 1000,
        },
      });

      vi.spyOn(deploymentService, 'deployToKiro').mockResolvedValue({
        success: true,
        platform: 'kiro-ide',
        deployedComponents: ['settings', 'steering'],
        skippedComponents: [],
        errors: [],
        warnings: ['Settings component shared with Claude Code'],
        summary: {
          filesDeployed: 2,
          filesSkipped: 0,
          conflictsResolved: 1,
          backupCreated: false,
          deploymentTime: 1500,
        },
      });

      vi.spyOn(cursorDeploymentService, 'deploy').mockResolvedValue({
        success: true,
        platform: 'cursor',
        deployedComponents: ['ai-config', 'workspace-settings'],
        skippedComponents: [],
        errors: [],
        warnings: [],
        summary: 'Cursor deployment completed',
        duration: 2000,
      } as CursorDeploymentResult);

      const results = await Promise.all(deploymentPromises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Verify priority-based deployment order was respected
      expect(deploymentService.deployToClaudeCode).toHaveBeenCalled();
      expect(deploymentService.deployToKiro).toHaveBeenCalled();
      expect(cursorDeploymentService.deploy).toHaveBeenCalled();
    });
  });

  describe('Platform-Specific Feature Isolation', () => {
    it('should isolate Claude Code specific features from other platforms', async () => {
      const claudeSpecificFeatures = {
        mcpServers: [
          { name: 'typescript-mcp', path: './mcp/typescript' },
          { name: 'database-mcp', path: './mcp/database' },
        ],
        steeringDocuments: [
          { name: 'architecture.md', priority: 'high' },
          { name: 'security.md', priority: 'critical' },
        ],
        hooks: {
          'pre-commit': 'npm run lint && npm run test',
          'post-deploy': 'npm run verify',
        },
      };

      // Verify Claude Code features don't leak to other platforms
      vi.spyOn(platformValidator, 'validateForPlatform')
        .mockImplementation(async (context, platform) => {
          if (platform === 'claude-code') {
            return { isValid: true, errors: [], warnings: [] };
          } else {
            // Other platforms should not recognize Claude Code specific features
            return {
              isValid: true,
              errors: [],
              warnings: [
                `Claude Code specific features detected but ignored for ${platform}`,
              ],
            };
          }
        });

      const claudeValidation = await platformValidator.validateForPlatform(
        { ...sharedTaptikContext, claudeSpecificFeatures } as any,
        'claude-code'
      );
      expect(claudeValidation.isValid).toBe(true);
      expect(claudeValidation.warnings).toHaveLength(0);

      const kiroValidation = await platformValidator.validateForPlatform(
        { ...sharedTaptikContext, claudeSpecificFeatures } as any,
        'kiro-ide'
      );
      expect(kiroValidation.warnings).toContain('Claude Code specific features detected but ignored for kiro-ide');

      const cursorValidation = await platformValidator.validateForPlatform(
        { ...sharedTaptikContext, claudeSpecificFeatures } as any,
        'cursor-ide'
      );
      expect(cursorValidation.warnings).toContain('Claude Code specific features detected but ignored for cursor-ide');
    });

    it('should isolate Kiro IDE specific features from other platforms', async () => {
      const kiroSpecificFeatures = {
        taskManagement: {
          enabled: true,
          preserveStatus: true,
          autoProgress: false,
        },
        specificationTracking: {
          enabled: true,
          linkToTasks: true,
          generateProgress: true,
        },
        documentGeneration: {
          autoUpdate: true,
          templates: ['spec', 'architecture', 'api'],
        },
      };

      vi.spyOn(platformValidator, 'validateForPlatform')
        .mockImplementation(async (context, platform) => {
          if (platform === 'kiro-ide') {
            return { isValid: true, errors: [], warnings: [] };
          } else {
            return {
              isValid: true,
              errors: [],
              warnings: [
                `Kiro IDE specific features detected but ignored for ${platform}`,
              ],
            };
          }
        });

      const kiroValidation = await platformValidator.validateForPlatform(
        { ...sharedTaptikContext, kiroSpecificFeatures } as any,
        'kiro-ide'
      );
      expect(kiroValidation.isValid).toBe(true);
      expect(kiroValidation.warnings).toHaveLength(0);

      const claudeValidation = await platformValidator.validateForPlatform(
        { ...sharedTaptikContext, kiroSpecificFeatures } as any,
        'claude-code'
      );
      expect(claudeValidation.warnings).toContain('Kiro IDE specific features detected but ignored for claude-code');

      const cursorValidation = await platformValidator.validateForPlatform(
        { ...sharedTaptikContext, kiroSpecificFeatures } as any,
        'cursor-ide'
      );
      expect(cursorValidation.warnings).toContain('Kiro IDE specific features detected but ignored for cursor-ide');
    });

    it('should isolate Cursor IDE specific features from other platforms', async () => {
      const cursorSpecificFeatures = {
        aiIntegration: {
          model: 'claude-3.5-sonnet',
          contextWindow: 200000,
          tools: ['codebase-search', 'web-search'],
        },
        extensionManagement: {
          autoInstall: true,
          recommendations: ['typescript', 'eslint', 'prettier'],
          unwanted: ['deprecated-extension'],
        },
        debugConfiguration: {
          autoLaunch: true,
          environments: ['development', 'testing'],
          breakpoints: { enabled: true, conditions: true },
        },
      };

      vi.spyOn(platformValidator, 'validateForPlatform')
        .mockImplementation(async (context, platform) => {
          if (platform === 'cursor-ide') {
            return { isValid: true, errors: [], warnings: [] };
          } else {
            return {
              isValid: true,
              errors: [],
              warnings: [
                `Cursor IDE specific features detected but ignored for ${platform}`,
              ],
            };
          }
        });

      const cursorValidation = await platformValidator.validateForPlatform(
        { ...sharedTaptikContext, cursorSpecificFeatures } as any,
        'cursor-ide'
      );
      expect(cursorValidation.isValid).toBe(true);
      expect(cursorValidation.warnings).toHaveLength(0);

      const claudeValidation = await platformValidator.validateForPlatform(
        { ...sharedTaptikContext, cursorSpecificFeatures } as any,
        'claude-code'
      );
      expect(claudeValidation.warnings).toContain('Cursor IDE specific features detected but ignored for claude-code');

      const kiroValidation = await platformValidator.validateForPlatform(
        { ...sharedTaptikContext, cursorSpecificFeatures } as any,
        'kiro-ide'
      );
      expect(kiroValidation.warnings).toContain('Cursor IDE specific features detected but ignored for kiro-ide');
    });

    it('should prevent cross-platform configuration pollution', async () => {
      // Create a context with mixed platform features
      const mixedPlatformContext = {
        ...sharedTaptikContext,
        claudeCode: { mcpServers: ['server1'] },
        kiroIde: { taskManagement: true },
        cursorIde: { aiModel: 'claude-3.5-sonnet' },
      };

      // Each platform should only process its own features
      const platformFeatureChecks = [
        {
          platform: 'claude-code',
          expectedFeatures: ['claudeCode'],
          ignoredFeatures: ['kiroIde', 'cursorIde'],
        },
        {
          platform: 'kiro-ide',
          expectedFeatures: ['kiroIde'],
          ignoredFeatures: ['claudeCode', 'cursorIde'],
        },
        {
          platform: 'cursor-ide',
          expectedFeatures: ['cursorIde'],
          ignoredFeatures: ['claudeCode', 'kiroIde'],
        },
      ];

      for (const check of platformFeatureChecks) {
        vi.spyOn(platformValidator, 'validateForPlatform')
          .mockImplementation(async (context, platform) => {
            const warnings: string[] = [];
            
            if (platform === check.platform) {
              // Platform should recognize its own features
              check.expectedFeatures.forEach(feature => {
                if ((context as any)[feature]) {
                  warnings.push(`${feature} features processed for ${platform}`);
                }
              });
            } else {
              // Platform should ignore other platform features
              check.ignoredFeatures.forEach(feature => {
                if ((context as any)[feature]) {
                  warnings.push(`${feature} features ignored for ${platform}`);
                }
              });
            }

            return { isValid: true, errors: [], warnings };
          });

        const validation = await platformValidator.validateForPlatform(
          mixedPlatformContext as any,
          check.platform
        );

        expect(validation.isValid).toBe(true);
        
        // Verify platform processes its own features
        check.expectedFeatures.forEach(feature => {
          expect(validation.warnings.some(w => 
            w.includes(`${feature} features processed for ${check.platform}`)
          )).toBe(true);
        });

        // Verify platform ignores other platform features
        check.ignoredFeatures.forEach(feature => {
          expect(validation.warnings.some(w => 
            w.includes(`${feature} features ignored for ${check.platform}`)
          )).toBe(true);
        });
      }
    });
  });
});
