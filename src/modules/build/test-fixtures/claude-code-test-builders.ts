/**
 * Claude Code test data builders for dynamic test case generation
 * Provides builder patterns for creating customized test data
 */

import {
  ClaudeCodeSettings,
  ClaudeAgent,
  ClaudeCommand,
  McpServerConfig,
  ClaudeCodeLocalSettingsData,
  CloudMetadata,
  SanitizationResult,
  ValidationResult,
} from '../interfaces/claude-code.interfaces';

// ============================================================================
// Base Builder Class
// ============================================================================

abstract class BaseBuilder<T> {
  protected data: Partial<T> = {};

  build(): T {
    return this.data as T;
  }

  reset(): this {
    this.data = {};
    return this;
  }
}

// ============================================================================
// Claude Code Settings Builder
// ============================================================================

export class ClaudeCodeSettingsBuilder extends BaseBuilder<ClaudeCodeSettings> {
  constructor() {
    super();
    this.withDefaults();
  }

  withDefaults(): this {
    this.data = {
      theme: 'dark',
      fontSize: 14,
      keyboardShortcuts: {},
      extensions: [],
      preferences: {},
    };
    return this;
  }

  withTheme(theme: string): this {
    this.data.theme = theme;
    return this;
  }

  withFontSize(size: number): this {
    this.data.fontSize = size;
    return this;
  }

  withKeyboardShortcut(key: string, action: string): this {
    if (!this.data.keyboardShortcuts) {
      this.data.keyboardShortcuts = {};
    }
    this.data.keyboardShortcuts[key] = action;
    return this;
  }

  withExtension(extension: string): this {
    if (!this.data.extensions) {
      this.data.extensions = [];
    }
    this.data.extensions.push(extension);
    return this;
  }

  withPreference(key: string, value: unknown): this {
    if (!this.data.preferences) {
      this.data.preferences = {};
    }
    this.data.preferences[key] = value;
    return this;
  }

  withAdvancedPreferences(): this {
    this.data.preferences = {
      ...this.data.preferences,
      autoSave: true,
      autoFormat: true,
      tabSize: 2,
      insertSpaces: true,
      wordWrap: 'on',
      minimap: {
        enabled: true,
        scale: 1,
      },
      terminal: {
        fontSize: 12,
        fontFamily: 'monospace',
      },
    };
    return this;
  }
}

// ============================================================================
// Claude Agent Builder
// ============================================================================

export class ClaudeAgentBuilder extends BaseBuilder<ClaudeAgent> {
  constructor() {
    super();
    this.withDefaults();
  }

  withDefaults(): this {
    this.data = {
      name: 'Test Agent',
      description: 'A test agent',
      instructions: 'Test instructions',
    };
    return this;
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withDescription(description: string): this {
    this.data.description = description;
    return this;
  }

  withInstructions(instructions: string): this {
    this.data.instructions = instructions;
    return this;
  }

  withTools(tools: string[]): this {
    this.data.tools = tools;
    return this;
  }

  withMetadata(metadata: Record<string, unknown>): this {
    this.data.metadata = metadata;
    return this;
  }

  asCodeReviewer(): this {
    this.data = {
      name: 'Code Reviewer',
      description: 'Reviews code for quality',
      instructions: 'Review code for best practices, bugs, and improvements',
      tools: ['read', 'search', 'lint'],
      metadata: {
        version: '1.0.0',
        tags: ['review', 'quality'],
      },
    };
    return this;
  }

  asTestGenerator(): this {
    this.data = {
      name: 'Test Generator',
      description: 'Generates unit and integration tests',
      instructions: 'Create comprehensive tests with good coverage',
      tools: ['read', 'write', 'test'],
      metadata: {
        version: '1.0.0',
        tags: ['testing', 'tdd'],
      },
    };
    return this;
  }
}

// ============================================================================
// Claude Command Builder
// ============================================================================

export class ClaudeCommandBuilder extends BaseBuilder<ClaudeCommand> {
  constructor() {
    super();
    this.withDefaults();
  }

  withDefaults(): this {
    this.data = {
      name: 'test-command',
      description: 'A test command',
      command: 'echo "test"',
    };
    return this;
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withDescription(description: string): this {
    this.data.description = description;
    return this;
  }

  withCommand(command: string): this {
    this.data.command = command;
    return this;
  }

  withArgs(args: string[]): this {
    this.data.args = args;
    return this;
  }

  withMetadata(metadata: Record<string, unknown>): this {
    this.data.metadata = metadata;
    return this;
  }

  asNpmScript(scriptName: string): this {
    this.data = {
      name: scriptName,
      description: `Run npm ${scriptName}`,
      command: 'npm run',
      args: [scriptName],
    };
    return this;
  }

  asGitCommand(operation: string): this {
    this.data = {
      name: `git-${operation}`,
      description: `Git ${operation} operation`,
      command: 'git',
      args: [operation],
    };
    return this;
  }
}

// ============================================================================
// MCP Config Builder
// ============================================================================

export class McpConfigBuilder extends BaseBuilder<McpServerConfig> {
  constructor() {
    super();
    this.withDefaults();
  }

  withDefaults(): this {
    this.data = {
      mcpServers: {},
    };
    return this;
  }

  withServer(
    name: string,
    config: {
      command: string;
      args: string[];
      env?: Record<string, string>;
      disabled?: boolean;
      autoApprove?: string[];
    },
  ): this {
    if (!this.data.mcpServers) {
      this.data.mcpServers = {};
    }
    this.data.mcpServers[name] = config;
    return this;
  }

  withFilesystemServer(): this {
    return this.withServer('filesystem', {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      env: {
        MCP_PROJECT_ROOT: '/project',
      },
    });
  }

  withGithubServer(token?: string): this {
    return this.withServer('github', {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {
        GITHUB_TOKEN: token || '${GITHUB_TOKEN}',
      },
      autoApprove: ['repo:read'],
    });
  }

  withDisabledServer(name: string): this {
    return this.withServer(name, {
      command: 'node',
      args: ['server.js'],
      disabled: true,
    });
  }
}

// ============================================================================
// Local Settings Data Builder
// ============================================================================

export class LocalSettingsDataBuilder extends BaseBuilder<ClaudeCodeLocalSettingsData> {
  constructor() {
    super();
    this.withDefaults();
  }

  withDefaults(): this {
    this.data = {
      steeringFiles: [],
      agents: [],
      commands: [],
      hooks: [],
      sourcePath: '/project',
      collectedAt: new Date().toISOString(),
    };
    return this;
  }

  withSettings(settings: ClaudeCodeSettings): this {
    this.data.settings = settings;
    return this;
  }

  withClaudeMd(content: string): this {
    this.data.claudeMd = content;
    return this;
  }

  withClaudeLocalMd(content: string): this {
    this.data.claudeLocalMd = content;
    return this;
  }

  withSteeringFile(filename: string, content: string): this {
    if (!this.data.steeringFiles) {
      this.data.steeringFiles = [];
    }
    this.data.steeringFiles.push({
      filename,
      content,
      path: `.claude/steering/${filename}`,
    });
    return this;
  }

  withAgent(filename: string, agent: ClaudeAgent): this {
    if (!this.data.agents) {
      this.data.agents = [];
    }
    this.data.agents.push({
      filename,
      content: JSON.stringify(agent, null, 2),
      path: `.claude/agents/${filename}`,
      parsed: agent,
    });
    return this;
  }

  withCommand(filename: string, command: ClaudeCommand): this {
    if (!this.data.commands) {
      this.data.commands = [];
    }
    this.data.commands.push({
      filename,
      content: JSON.stringify(command, null, 2),
      path: `.claude/commands/${filename}`,
      parsed: command,
    });
    return this;
  }

  withHook(filename: string, content: string): this {
    if (!this.data.hooks) {
      this.data.hooks = [];
    }
    this.data.hooks.push({
      filename,
      content,
      path: `.claude/hooks/${filename}`,
    });
    return this;
  }

  withMcpConfig(config: McpServerConfig): this {
    this.data.mcpConfig = config;
    return this;
  }

  withSourcePath(path: string): this {
    this.data.sourcePath = path;
    return this;
  }

  withCompleteSetup(): this {
    const settingsBuilder = new ClaudeCodeSettingsBuilder();
    const agentBuilder = new ClaudeAgentBuilder();
    const commandBuilder = new ClaudeCommandBuilder();
    const mcpBuilder = new McpConfigBuilder();

    return this.withSettings(settingsBuilder.withAdvancedPreferences().build())
      .withClaudeMd('# Project Instructions')
      .withClaudeLocalMd('# Local Setup')
      .withSteeringFile('principle.md', '# Principles')
      .withSteeringFile('persona.md', '# Persona')
      .withAgent('reviewer.json', agentBuilder.asCodeReviewer().build())
      .withCommand('test.json', commandBuilder.asNpmScript('test').build())
      .withHook('pre-commit.sh', '#!/bin/bash\nnpm test')
      .withMcpConfig(mcpBuilder.withFilesystemServer().build());
  }
}

// ============================================================================
// Cloud Metadata Builder
// ============================================================================

export class CloudMetadataBuilder extends BaseBuilder<CloudMetadata> {
  constructor() {
    super();
    this.withDefaults();
  }

  withDefaults(): this {
    this.data = {
      title: 'Test Configuration',
      description: 'Test configuration package',
      tags: [],
      source_ide: 'claude-code',
      target_ides: ['claude-code'],
      component_summary: {
        agents: 0,
        commands: 0,
        steering_rules: 0,
        mcp_servers: [],
        settings_categories: [],
        estimated_size: 0,
      },
      schema_version: '1.0.0',
      version_info: {
        schema_version: '1.0.0',
        source_version: '1.0.0',
        build_version: '1.0.0',
        compatibility: ['claude-code'],
      },
      search_keywords: [],
      auto_generated_tags: [],
    };
    return this;
  }

  withTitle(title: string): this {
    this.data.title = title;
    return this;
  }

  withDescription(description: string): this {
    this.data.description = description;
    return this;
  }

  withTags(tags: string[]): this {
    this.data.tags = tags;
    return this;
  }

  withComponentSummary(
    summary: Partial<CloudMetadata['component_summary']>,
  ): this {
    this.data.component_summary = {
      ...this.data.component_summary,
      ...summary,
    };
    return this;
  }

  withSearchKeywords(keywords: string[]): this {
    this.data.search_keywords = keywords;
    return this;
  }

  withAutoGeneratedTags(tags: string[]): this {
    this.data.auto_generated_tags = tags;
    return this;
  }

  forFullStackProject(): this {
    return this.withTitle('Full Stack Development Configuration')
      .withDescription(
        'Complete setup for full-stack development with testing and deployment',
      )
      .withTags(['fullstack', 'typescript', 'testing', 'ci-cd'])
      .withComponentSummary({
        agents: 5,
        commands: 10,
        steering_rules: 4,
        mcp_servers: ['filesystem', 'github', 'database'],
        settings_categories: ['editor', 'terminal', 'debugging'],
        estimated_size: 50000,
      })
      .withSearchKeywords(['react', 'node', 'typescript', 'jest', 'docker'])
      .withAutoGeneratedTags(['development', 'testing', 'deployment']);
  }
}

// ============================================================================
// Sanitization Result Builder
// ============================================================================

export class SanitizationResultBuilder extends BaseBuilder<SanitizationResult> {
  constructor() {
    super();
    this.withDefaults();
  }

  withDefaults(): this {
    this.data = {
      sanitizedData: {},
      removedItems: [],
      securityLevel: 'safe',
      sanitizationReport: {
        totalItemsProcessed: 0,
        itemsRemoved: 0,
        securityIssuesFound: [],
        recommendations: [],
      },
    };
    return this;
  }

  withSanitizedData(data: unknown): this {
    this.data.sanitizedData = data as Record<string, unknown>;
    return this;
  }

  withRemovedItem(type: string, location: string, reason: string): this {
    if (!this.data.removedItems) {
      this.data.removedItems = [];
    }
    this.data.removedItems.push({
      type: type as 'api_key' | 'token' | 'password' | 'url' | 'email' | 'path',
      location,
      reason,
    });
    return this;
  }

  withSecurityLevel(level: 'safe' | 'warning' | 'blocked'): this {
    this.data.securityLevel = level;
    return this;
  }

  withSanitizationReport(
    report: Partial<SanitizationResult['sanitizationReport']>,
  ): this {
    this.data.sanitizationReport = {
      ...this.data.sanitizationReport,
      ...report,
    };
    return this;
  }

  withSensitiveDataRemoved(): this {
    return this.withRemovedItem(
      'api_key',
      'settings.apiKey',
      'API key detected',
    )
      .withRemovedItem('password', 'database.password', 'Password detected')
      .withRemovedItem('token', 'github.token', 'Access token detected')
      .withSecurityLevel('warning')
      .withSanitizationReport({
        totalItemsProcessed: 100,
        itemsRemoved: 3,
        securityIssuesFound: [
          {
            type: 'api_key' as const,
            location: 'settings.apiKey',
            reason: 'API key detected',
          },
        ],
        recommendations: [
          'Use environment variables for sensitive data',
          'Never commit credentials to version control',
        ],
      });
  }
}

// ============================================================================
// Validation Result Builder
// ============================================================================

export class ValidationResultBuilder extends BaseBuilder<ValidationResult> {
  constructor() {
    super();
    this.withDefaults();
  }

  withDefaults(): this {
    this.data = {
      isValid: true,
      errors: [],
      warnings: [],
      cloudCompatibility: {
        canUpload: true,
        estimatedUploadSize: 0,
        supportedFeatures: [],
        unsupportedFeatures: [],
        recommendations: [],
      },
    };
    return this;
  }

  withError(field: string, message: string): this {
    if (!this.data.errors) {
      this.data.errors = [];
    }
    this.data.errors.push({
      field,
      message,
      severity: 'error' as const,
    });
    this.data.isValid = false;
    return this;
  }

  withWarning(field: string, message: string): this {
    if (!this.data.warnings) {
      this.data.warnings = [];
    }
    this.data.warnings.push({
      field,
      message,
      severity: 'warning',
    });
    return this;
  }

  withCloudCompatibility(
    compatibility: Partial<ValidationResult['cloudCompatibility']>,
  ): this {
    this.data.cloudCompatibility = {
      ...this.data.cloudCompatibility,
      ...compatibility,
    };
    return this;
  }

  asInvalid(): this {
    return this.withError('manifest.version', 'Invalid version format')
      .withError('files[0].checksum', 'Checksum mismatch')
      .withWarning('metadata.tags', 'Too many tags (max 10)')
      .withCloudCompatibility({
        canUpload: false,
        estimatedUploadSize: 100000000,
        supportedFeatures: ['agents', 'commands'],
        unsupportedFeatures: ['custom-runtime'],
        recommendations: [
          'Reduce package size to under 50MB',
          'Fix validation errors before uploading',
        ],
      });
  }

  asValidWithWarnings(): this {
    return this.withWarning('metadata.description', 'Description is too short')
      .withWarning('files[2].size', 'File is large (>5MB)')
      .withCloudCompatibility({
        canUpload: true,
        estimatedUploadSize: 25000000,
        supportedFeatures: ['agents', 'commands', 'mcp', 'steering'],
        unsupportedFeatures: [],
        recommendations: [
          'Consider adding more descriptive metadata',
          'Optimize large files for better performance',
        ],
      });
  }
}

// ============================================================================
// Test Scenario Factory
// ============================================================================

export class TestScenarioFactory {
  static createMinimalScenario() {
    return {
      settings: new ClaudeCodeSettingsBuilder().build(),
      agent: new ClaudeAgentBuilder().build(),
      command: new ClaudeCommandBuilder().build(),
      mcpConfig: new McpConfigBuilder().build(),
      localSettings: new LocalSettingsDataBuilder().build(),
    };
  }

  static createCompleteScenario() {
    return {
      settings: new ClaudeCodeSettingsBuilder()
        .withAdvancedPreferences()
        .build(),
      agent: new ClaudeAgentBuilder().asCodeReviewer().build(),
      command: new ClaudeCommandBuilder().asNpmScript('test').build(),
      mcpConfig: new McpConfigBuilder()
        .withFilesystemServer()
        .withGithubServer()
        .build(),
      localSettings: new LocalSettingsDataBuilder().withCompleteSetup().build(),
      metadata: new CloudMetadataBuilder().forFullStackProject().build(),
      sanitization: new SanitizationResultBuilder()
        .withSensitiveDataRemoved()
        .build(),
      validation: new ValidationResultBuilder().asValidWithWarnings().build(),
    };
  }

  static createErrorScenario() {
    return {
      validation: new ValidationResultBuilder().asInvalid().build(),
      sanitization: new SanitizationResultBuilder()
        .withSecurityLevel('blocked')
        .withRemovedItem('api_key', 'config.secret', 'Blocked for security')
        .build(),
    };
  }

  static createPerformanceScenario(itemCount: number = 100) {
    const localSettings = new LocalSettingsDataBuilder();

    for (let i = 0; i < itemCount; i++) {
      localSettings.withAgent(
        `agent-${i}.json`,
        new ClaudeAgentBuilder()
          .withName(`Agent ${i}`)
          .withDescription(`Test agent ${i}`)
          .build(),
      );

      if (i % 2 === 0) {
        localSettings.withCommand(
          `command-${i}.json`,
          new ClaudeCommandBuilder()
            .withName(`command-${i}`)
            .withCommand(`echo "Command ${i}"`)
            .build(),
        );
      }

      if (i % 3 === 0) {
        localSettings.withSteeringFile(
          `rule-${i}.md`,
          `# Rule ${i}\n\nContent for rule ${i}`,
        );
      }
    }

    return {
      localSettings: localSettings.build(),
      metadata: new CloudMetadataBuilder()
        .withComponentSummary({
          agents: itemCount,
          commands: Math.floor(itemCount / 2),
          steering_rules: Math.floor(itemCount / 3),
          mcp_servers: [],
          settings_categories: [],
          estimated_size: itemCount * 1000,
        })
        .build(),
    };
  }
}
