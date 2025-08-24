/**
 * Interface compliance tests for Claude Code data structures
 * RED Phase: These tests verify type safety and interface compliance
 */

import { describe, it, expect } from 'vitest';

import {
  // Enums need to be imported as values
  BuildPlatform,
  BuildPhase,

  // Type Guards need to be imported as values
  isClaudeCodeSettings,
  isClaudeAgent,
  isClaudeCommand,
  isMcpServerConfig,
  isSanitizationResult,
  isValidationResult,
} from './claude-code.interfaces';

import type {
  ClaudeCodeErrorType,
  ClaudeCodeError,
  CollectionError,
  SanitizationError,
  ValidationError,
  PackageError,
  // Core Configuration Interfaces
  ClaudeCodeSettings,
  ClaudeAgent,
  ClaudeCommand,
  McpServerConfig,

  // Collection Data Interfaces
  ClaudeCodeLocalSettingsData,
  ClaudeCodeGlobalSettingsData,

  // Cloud-Oriented Interfaces
  CloudMetadata,
  SanitizationResult,
  SanitizationReport,

  // Package Interfaces
  TaptikPackage,

  // Validation Interfaces
  ValidationResult,

  // Transformation Interfaces
  TransformationResult,
  MergedConfiguration,

  // Platform Integration Interfaces
  PlatformCapabilities,

  // Progress and Status Interfaces
  BuildProgress,
  BuildResult,

  // CLI Option Interfaces
  ClaudeCodeBuildOptions,
} from './claude-code.interfaces';

describe('Claude Code Interface Compliance Tests', () => {
  describe('Core Configuration Interfaces', () => {
    describe('ClaudeCodeSettings', () => {
      it('should accept valid settings structure', () => {
        const settings: ClaudeCodeSettings = {
          theme: 'dark',
          fontSize: 14,
          keyboardShortcuts: { 'cmd+s': 'save' },
          extensions: ['prettier', 'eslint'],
          preferences: { autoSave: true },
        };

        expect(settings.theme).toBe('dark');
        expect(settings.fontSize).toBe(14);
        expect(settings.keyboardShortcuts?.['cmd+s']).toBe('save');
        expect(settings.extensions).toContain('prettier');
        expect(settings.preferences?.autoSave).toBe(true);
      });

      it('should accept minimal settings', () => {
        const settings: ClaudeCodeSettings = {};
        expect(settings).toBeDefined();
      });

      it('should enforce optional fields', () => {
        const settings: ClaudeCodeSettings = {
          theme: undefined,
          fontSize: undefined,
        };
        expect(settings.theme).toBeUndefined();
        expect(settings.fontSize).toBeUndefined();
      });
    });

    describe('ClaudeAgent', () => {
      it('should enforce required fields', () => {
        const agent: ClaudeAgent = {
          name: 'Test Agent',
          description: 'A test agent',
          instructions: 'Do something',
        };

        expect(agent.name).toBeDefined();
        expect(agent.description).toBeDefined();
        expect(agent.instructions).toBeDefined();
      });

      it('should accept optional tools and metadata', () => {
        const agent: ClaudeAgent = {
          name: 'Test Agent',
          description: 'A test agent',
          instructions: 'Do something',
          tools: ['read', 'write'],
          metadata: { version: '1.0.0' },
        };

        expect(agent.tools).toHaveLength(2);
        expect(agent.metadata?.version).toBe('1.0.0');
      });
    });

    describe('ClaudeCommand', () => {
      it('should enforce required fields', () => {
        const command: ClaudeCommand = {
          name: 'test-command',
          description: 'A test command',
          command: 'npm test',
        };

        expect(command.name).toBeDefined();
        expect(command.description).toBeDefined();
        expect(command.command).toBeDefined();
      });

      it('should accept optional args and metadata', () => {
        const command: ClaudeCommand = {
          name: 'test-command',
          description: 'A test command',
          command: 'npm',
          args: ['test', '--coverage'],
          metadata: { requiresAuth: true },
        };

        expect(command.args).toHaveLength(2);
        expect(command.metadata?.requiresAuth).toBe(true);
      });
    });

    describe('McpServerConfig', () => {
      it('should enforce required mcpServers field', () => {
        const config: McpServerConfig = {
          mcpServers: {
            filesystem: {
              command: 'node',
              args: ['./server.js'],
            },
          },
        };

        expect(config.mcpServers).toBeDefined();
        expect(config.mcpServers.filesystem).toBeDefined();
      });

      it('should accept multiple servers with optional fields', () => {
        const config: McpServerConfig = {
          mcpServers: {
            filesystem: {
              command: 'node',
              args: ['./fs-server.js'],
              env: { NODE_ENV: 'production' },
              disabled: false,
              autoApprove: ['read', 'write'],
            },
            github: {
              command: 'python',
              args: ['./github-server.py'],
            },
          },
        };

        expect(Object.keys(config.mcpServers)).toHaveLength(2);
        expect(config.mcpServers.filesystem.env?.NODE_ENV).toBe('production');
        expect(config.mcpServers.filesystem.autoApprove).toContain('read');
      });
    });
  });

  describe('Collection Data Interfaces', () => {
    describe('ClaudeCodeLocalSettingsData', () => {
      it('should accept complete local settings data', () => {
        const data: ClaudeCodeLocalSettingsData = {
          settings: { theme: 'dark' },
          claudeMd: 'Project instructions',
          claudeLocalMd: 'Local instructions',
          steeringFiles: [
            {
              filename: 'rule1.md',
              content: 'Rule content',
              path: '.claude/steering/rule1.md',
            },
          ],
          agents: [
            {
              filename: 'agent1.json',
              content: '{}',
              path: '.claude/agents/agent1.json',
              parsed: {
                name: 'Agent 1',
                description: 'Test agent',
                instructions: 'Do something',
              },
            },
          ],
          commands: [
            {
              filename: 'cmd1.json',
              content: '{}',
              path: '.claude/commands/cmd1.json',
            },
          ],
          hooks: [
            {
              filename: 'pre-commit',
              content: '#!/bin/bash',
              path: '.claude/hooks/pre-commit',
            },
          ],
          mcpConfig: {
            mcpServers: {},
          },
          sourcePath: '/project',
          collectedAt: new Date().toISOString(),
        };

        expect(data.settings).toBeDefined();
        expect(data.steeringFiles).toHaveLength(1);
        expect(data.agents[0].parsed?.name).toBe('Agent 1');
        expect(data.sourcePath).toBe('/project');
      });

      it('should enforce required array fields', () => {
        const data: ClaudeCodeLocalSettingsData = {
          steeringFiles: [],
          agents: [],
          commands: [],
          hooks: [],
          sourcePath: '/project',
          collectedAt: new Date().toISOString(),
        };

        expect(data.steeringFiles).toBeDefined();
        expect(data.agents).toBeDefined();
        expect(data.commands).toBeDefined();
        expect(data.hooks).toBeDefined();
      });
    });

    describe('ClaudeCodeGlobalSettingsData', () => {
      it('should include security filtering flag', () => {
        const data: ClaudeCodeGlobalSettingsData = {
          settings: { theme: 'light' },
          agents: [],
          commands: [],
          mcpConfig: { mcpServers: {} },
          sourcePath: '~/.claude',
          collectedAt: new Date().toISOString(),
          securityFiltered: true,
        };

        expect(data.securityFiltered).toBe(true);
        expect(data.sourcePath).toBe('~/.claude');
      });
    });
  });

  describe('Cloud-Oriented Interfaces', () => {
    describe('CloudMetadata', () => {
      it('should enforce all required metadata fields', () => {
        const metadata: CloudMetadata = {
          title: 'My Configuration',
          description: 'Test configuration',
          tags: ['test', 'claude-code'],
          source_ide: 'claude-code',
          target_ides: ['claude-code', 'kiro'],
          component_summary: {
            agents: 5,
            commands: 3,
            steering_rules: 2,
            mcp_servers: ['filesystem', 'github'],
            settings_categories: ['theme', 'editor'],
            estimated_size: 10240,
          },
          schema_version: '1.0.0',
          version_info: {
            schema_version: '1.0.0',
            source_version: '0.1.0',
            build_version: '2024.1.1',
            compatibility: ['1.0.0', '1.1.0'],
          },
          search_keywords: ['frontend', 'react'],
          auto_generated_tags: ['javascript', 'typescript'],
        };

        expect(metadata.title).toBeDefined();
        expect(metadata.source_ide).toBe('claude-code');
        expect(metadata.component_summary.agents).toBe(5);
        expect(metadata.version_info.compatibility).toContain('1.0.0');
      });
    });

    describe('SanitizationResult', () => {
      it('should enforce security level enum values', () => {
        const result: SanitizationResult = {
          sanitizedData: { key: 'value' },
          removedItems: [
            {
              type: 'api_key',
              location: 'settings.apiKey',
              originalValue: 'sk-xxx',
              reason: 'API key detected',
            },
          ],
          securityLevel: 'warning',
          sanitizationReport: {
            totalItemsProcessed: 100,
            itemsRemoved: 1,
            securityIssuesFound: [],
            recommendations: ['Review remaining configuration'],
          },
        };

        expect(['safe', 'warning', 'blocked']).toContain(result.securityLevel);
        expect(result.removedItems[0].type).toBe('api_key');
      });
    });
  });

  describe('Package Interfaces', () => {
    describe('TaptikPackage', () => {
      it('should include all required package components', () => {
        const pkg: TaptikPackage = {
          manifest: {
            package_id: 'pkg-123',
            name: 'Test Package',
            version: '1.0.0',
            created_at: new Date().toISOString(),
            source_platform: 'claude-code',
            files: [
              {
                path: 'settings.json',
                size: 1024,
                checksum: 'abc123',
                type: 'json',
              },
            ],
            dependencies: [],
            cloud_metadata: {} as CloudMetadata,
            sanitization_info: {
              items_removed: 0,
              security_level: 'safe',
              safe_for_sharing: true,
              sanitization_timestamp: new Date().toISOString(),
            },
          },
          files: [
            {
              filename: 'settings.json',
              content: '{}',
              type: 'json',
              size: 1024,
              checksum: 'abc123',
            },
          ],
          checksums: {
            'settings.json': 'abc123',
          },
          metadata: {} as CloudMetadata,
        };

        expect(pkg.manifest.package_id).toBe('pkg-123');
        expect(pkg.files[0].type).toBe('json');
        expect(pkg.checksums['settings.json']).toBe('abc123');
      });
    });
  });

  describe('Validation Interfaces', () => {
    describe('ValidationResult', () => {
      it('should include all validation components', () => {
        const result: ValidationResult = {
          isValid: false,
          errors: [
            {
              field: 'settings.theme',
              message: 'Invalid theme value',
              severity: 'error',
            },
          ],
          warnings: [
            {
              field: 'settings.fontSize',
              message: 'Font size may be too small',
              severity: 'warning',
            },
          ],
          cloudCompatibility: {
            canUpload: true,
            estimatedUploadSize: 5120,
            supportedFeatures: ['agents', 'commands'],
            unsupportedFeatures: ['custom-hooks'],
            recommendations: ['Remove custom hooks before upload'],
          },
        };

        expect(result.isValid).toBe(false);
        expect(result.errors[0].severity).toBe('error');
        expect(result.cloudCompatibility.canUpload).toBe(true);
      });
    });
  });

  describe('Transformation Interfaces', () => {
    describe('TransformationResult', () => {
      it('should accept partial transformation results', () => {
        const result: TransformationResult = {
          personal: {
            settings: { theme: 'dark' },
            globalAgents: [],
            globalCommands: [],
            timestamp: new Date().toISOString(),
          },
          errors: [
            {
              source: 'project-settings',
              error: 'File not found',
              recoverable: true,
              suggestion: 'Create .claude/settings.json',
            },
          ],
        };

        expect(result.personal).toBeDefined();
        expect(result.project).toBeUndefined();
        expect(result.errors?.[0].recoverable).toBe(true);
      });
    });

    describe('MergedConfiguration', () => {
      it('should include all merged components', () => {
        const merged: MergedConfiguration = {
          settings: { theme: 'dark' },
          agents: [],
          commands: [],
          mcpServers: { mcpServers: {} },
          instructions: 'Combined instructions',
          timestamp: new Date().toISOString(),
        };

        expect(merged.settings).toBeDefined();
        expect(merged.instructions).toBe('Combined instructions');
      });
    });
  });

  describe('Platform Integration', () => {
    describe('BuildPlatform enum', () => {
      it('should include Claude Code platform', () => {
        expect(BuildPlatform.CLAUDE_CODE).toBe('claude-code');
        expect(BuildPlatform.KIRO).toBe('kiro');
        expect(BuildPlatform.CURSOR).toBe('cursor');
        expect(BuildPlatform.UNKNOWN).toBe('unknown');
      });
    });

    describe('PlatformCapabilities', () => {
      it('should define platform capabilities', () => {
        const capabilities: PlatformCapabilities = {
          platform: BuildPlatform.CLAUDE_CODE,
          features: ['agents', 'commands', 'mcp', 'steering'],
          limitations: ['no-custom-hooks'],
          version: '1.0.0',
        };

        expect(capabilities.platform).toBe(BuildPlatform.CLAUDE_CODE);
        expect(capabilities.features).toContain('agents');
        expect(capabilities.limitations).toContain('no-custom-hooks');
      });
    });
  });

  describe('Build Progress and Status', () => {
    describe('BuildProgress', () => {
      it('should track build phase and progress', () => {
        const progress: BuildProgress = {
          phase: BuildPhase.COLLECTION,
          step: 'Collecting local settings',
          progress: 25,
          message: 'Scanning .claude directory',
          details: { filesProcessed: 10 },
        };

        expect(progress.phase).toBe(BuildPhase.COLLECTION);
        expect(progress.progress).toBe(25);
        expect(progress.details.filesProcessed).toBe(10);
      });
    });

    describe('BuildResult', () => {
      it('should include comprehensive build results', () => {
        const result: BuildResult = {
          success: true,
          platform: BuildPlatform.CLAUDE_CODE,
          outputPath: '/output/claude-code',
          packagePath: '/output/package.taptik',
          metadata: {} as CloudMetadata,
          sanitizationReport: {} as SanitizationReport,
          validationReport: {} as ValidationResult,
          errors: [],
          warnings: ['Some non-critical warning'],
          statistics: {
            filesProcessed: 25,
            agentsFound: 5,
            commandsFound: 3,
            steeringRulesFound: 2,
            mcpServersConfigured: 2,
            sensitiveItemsRemoved: 1,
            packageSizeBytes: 10240,
            processingTimeMs: 1500,
          },
        };

        expect(result.success).toBe(true);
        expect(result.statistics?.filesProcessed).toBe(25);
        expect(result.warnings).toHaveLength(1);
      });
    });
  });

  describe('CLI Options', () => {
    describe('ClaudeCodeBuildOptions', () => {
      it('should accept all CLI options', () => {
        const options: ClaudeCodeBuildOptions = {
          platform: BuildPlatform.CLAUDE_CODE,
          output: '/output/path',
          dryRun: true,
          verbose: true,
          quiet: false,
          categories: ['agents', 'commands'],
          skipSanitization: false,
          skipValidation: false,
          includeGlobal: true,
          excludePatterns: ['*.test.js', '*.spec.ts'],
          autoUpload: true,
          uploadConfig: {
            endpoint: 'https://api.taptik.com',
            token: 'auth-token',
            public: true,
            title: 'My Config',
            description: 'Test configuration',
            tags: ['test', 'claude-code'],
          },
        };

        expect(options.platform).toBe(BuildPlatform.CLAUDE_CODE);
        expect(options.dryRun).toBe(true);
        expect(options.categories).toContain('agents');
        expect(options.uploadConfig?.public).toBe(true);
      });
    });
  });

  describe('Type Guards', () => {
    describe('isClaudeCodeSettings', () => {
      it('should validate settings objects', () => {
        expect(isClaudeCodeSettings({ theme: 'dark' })).toBe(true);
        expect(isClaudeCodeSettings({ theme: 123 })).toBe(false);
        expect(isClaudeCodeSettings({ fontSize: 14 })).toBe(true);
        expect(isClaudeCodeSettings({ fontSize: '14' })).toBe(false);
        expect(isClaudeCodeSettings(null)).toBe(false);
        expect(isClaudeCodeSettings(undefined)).toBe(false);
        expect(isClaudeCodeSettings('not an object')).toBe(false);
      });
    });

    describe('isClaudeAgent', () => {
      it('should validate agent objects', () => {
        const validAgent = {
          name: 'Test',
          description: 'Test agent',
          instructions: 'Do something',
        };

        const invalidAgent = {
          name: 123,
          description: 'Test agent',
          instructions: 'Do something',
        };

        expect(isClaudeAgent(validAgent)).toBe(true);
        expect(isClaudeAgent(invalidAgent)).toBe(false);
        expect(isClaudeAgent({ name: 'Test' })).toBe(false); // Missing required fields
        expect(isClaudeAgent(null)).toBe(false);
      });
    });

    describe('isClaudeCommand', () => {
      it('should validate command objects', () => {
        const validCommand = {
          name: 'test',
          description: 'Test command',
          command: 'npm test',
        };

        const invalidCommand = {
          name: 'test',
          description: 'Test command',
          // Missing required 'command' field
        };

        expect(isClaudeCommand(validCommand)).toBe(true);
        expect(isClaudeCommand(invalidCommand)).toBe(false);
        expect(isClaudeCommand({ command: 'npm test' })).toBe(false); // Missing required fields
      });
    });

    describe('isMcpServerConfig', () => {
      it('should validate MCP server configurations', () => {
        const validConfig = {
          mcpServers: {
            filesystem: {
              command: 'node',
              args: ['./server.js'],
            },
          },
        };

        const invalidConfig = {
          servers: {}, // Wrong field name
        };

        expect(isMcpServerConfig(validConfig)).toBe(true);
        expect(isMcpServerConfig(invalidConfig)).toBe(false);
        expect(isMcpServerConfig({ mcpServers: 'not an object' })).toBe(false);
      });
    });

    describe('isSanitizationResult', () => {
      it('should validate sanitization results', () => {
        const validResult = {
          sanitizedData: {},
          removedItems: [],
          securityLevel: 'safe',
          sanitizationReport: {},
        };

        const invalidResult = {
          sanitizedData: {},
          removedItems: [],
          securityLevel: 'invalid', // Invalid enum value
        };

        expect(isSanitizationResult(validResult)).toBe(true);
        expect(isSanitizationResult(invalidResult)).toBe(false);
        expect(isSanitizationResult({ removedItems: [] })).toBe(false); // Missing required fields
      });
    });

    describe('isValidationResult', () => {
      it('should validate validation results', () => {
        const validResult = {
          isValid: true,
          errors: [],
          warnings: [],
          cloudCompatibility: {},
        };

        const invalidResult = {
          isValid: 'true', // Wrong type
          errors: [],
          warnings: [],
        };

        expect(isValidationResult(validResult)).toBe(true);
        expect(isValidationResult(invalidResult)).toBe(false);
        expect(isValidationResult({ isValid: true })).toBe(false); // Missing required fields
      });
    });
  });

  describe('Error Interfaces', () => {
    describe('ClaudeCodeError', () => {
      it('should extend Error with additional properties', () => {
        class TestError extends Error implements ClaudeCodeError {
          type: ClaudeCodeErrorType;
          filePath?: string;
          lineNumber?: number;
          suggestedResolution?: string;

          constructor(message: string, type: ClaudeCodeErrorType) {
            super(message);
            this.type = type;
            this.name = 'ClaudeCodeError';
          }
        }

        const error = new TestError('Test error', 'INVALID_SETTINGS_JSON');
        error.filePath = '/test/path';
        error.lineNumber = 10;
        error.suggestedResolution = 'Check configuration';

        expect(error).toBeInstanceOf(Error);
        expect(error.type).toBe('INVALID_SETTINGS_JSON');
        expect(error.filePath).toBe('/test/path');
        expect(error.suggestedResolution).toBe('Check configuration');
      });
    });

    describe('Specialized Error Types', () => {
      it('should define collection errors', () => {
        class TestCollectionError extends Error implements CollectionError {
          type: ClaudeCodeErrorType = 'CLAUDE_NOT_FOUND';
          path?: string;
          fileType?: string;
          filePath?: string;
          lineNumber?: number;
          suggestedResolution?: string;

          constructor(message: string, path?: string) {
            super(message);
            this.path = path;
            this.name = 'CollectionError';
          }
        }

        const error = new TestCollectionError(
          'File not found',
          '/path/to/file',
        );
        expect(error.path).toBe('/path/to/file');
      });

      it('should define sanitization errors', () => {
        class TestSanitizationError extends Error implements SanitizationError {
          type: ClaudeCodeErrorType = 'PERMISSION_DENIED';
          filePath?: string;
          lineNumber?: number;
          suggestedResolution?: string;
          sensitiveDataFound?: boolean;
          blockedItems?: string[];

          constructor(message: string) {
            super(message);
            this.name = 'SanitizationError';
            this.sensitiveDataFound = true;
            this.blockedItems = ['api_key', 'password'];
          }
        }

        const error = new TestSanitizationError('Sensitive data detected');
        expect(error.sensitiveDataFound).toBe(true);
        expect(error.blockedItems).toContain('api_key');
      });

      it('should define validation errors with detailed issues', () => {
        class TestValidationError extends Error implements ValidationError {
          type: ClaudeCodeErrorType = 'INVALID_SETTINGS_JSON';
          filePath?: string;
          lineNumber?: number;
          suggestedResolution?: string;
          validationErrors?: Array<{ field: string; message: string }>;

          constructor(message: string) {
            super(message);
            this.name = 'ValidationError';
            this.validationErrors = [
              { field: 'settings.theme', message: 'Invalid theme' },
              { field: 'agent.name', message: 'Name too long' },
            ];
          }
        }

        const error = new TestValidationError('Validation failed');
        expect(error.validationErrors).toHaveLength(2);
        expect(error.validationErrors?.[0].field).toBe('settings.theme');
      });

      it('should define package errors', () => {
        class TestPackageError extends Error implements PackageError {
          type: ClaudeCodeErrorType = 'MISSING_REQUIRED_FIELD';
          filePath?: string;
          lineNumber?: number;
          suggestedResolution?: string;
          packageId?: string;
          operation?: string;

          constructor(message: string, packageId: string) {
            super(message);
            this.name = 'PackageError';
            this.packageId = packageId;
            this.operation = 'create';
          }
        }

        const error = new TestPackageError(
          'Package creation failed',
          'pkg-123',
        );
        expect(error.packageId).toBe('pkg-123');
        expect(error.operation).toBe('create');
      });
    });
  });
});
