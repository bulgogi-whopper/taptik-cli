import { homedir } from 'node:os';
import { join } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import {
  TaptikContext,
  AIPlatform,
  ClaudeCodeConfig,
  ClaudeCodeSettings,
} from '../interfaces';
import {
  IContextBuilderStrategy,
  ValidationResult,
  ConversionResult,
} from '../interfaces/strategy.interface';
import { FileSystemUtility } from '../utils/file-system.utility';

interface ClaudeCodeExtractedData {
  settings?: ClaudeCodeSettings;
  mcpServers?: any[];
  claudeFiles?: {
    claudeMd?: string;
    claudeLocalMd?: string;
  };
  customCommands?: Record<string, string>;
}

@Injectable()
export class ClaudeCodeBuilderStrategy implements IContextBuilderStrategy {
  private readonly logger = new Logger(ClaudeCodeBuilderStrategy.name);
  readonly platform = AIPlatform.CLAUDE_CODE;

  constructor(private readonly fileSystem: FileSystemUtility) {}

  /**
   * Detect if the current directory is a Claude Code project
   */
  async detect(path?: string): Promise<boolean> {
    const basePath = path || process.cwd();

    try {
      // Check for Claude-specific files
      const claudeDir = join(basePath, '.claude');
      const claudeMd = join(basePath, 'CLAUDE.md');
      const claudeLocalMd = join(basePath, 'CLAUDE.local.md');

      // Check if .claude directory exists
      if (await this.fileSystem.exists(claudeDir)) {
        return true;
      }

      // Check if CLAUDE.md or CLAUDE.local.md exists
      if (await this.fileSystem.exists(claudeMd)) {
        return true;
      }

      if (await this.fileSystem.exists(claudeLocalMd)) {
        return true;
      }

      // Check for user-level Claude configuration
      const userClaudeDir = join(homedir(), '.claude');
      if (await this.fileSystem.exists(userClaudeDir)) {
        // Check if there are workspace-specific settings
        const workspaceSettings = join(claudeDir, 'settings.json');
        if (await this.fileSystem.exists(workspaceSettings)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      this.logger.error(
        `Failed to detect Claude Code project: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Extract Claude Code configuration from the project
   */
  async extract(path?: string): Promise<any> {
    const basePath = path || process.cwd();

    if (!(await this.detect(basePath))) {
      throw new Error('Not a Claude Code project');
    }

    const data: ClaudeCodeExtractedData = {};

    // Extract settings
    data.settings = await this.extractSettings(basePath);

    // Extract MCP servers
    data.mcpServers = await this.extractMcpServers(basePath);

    // Extract Claude files
    data.claudeFiles = await this.extractClaudeFiles(basePath);

    // Extract custom commands
    data.customCommands = await this.extractCustomCommands(basePath);

    return data;
  }

  /**
   * Normalize Claude Code data to universal TaptikContext format
   */
  async normalize(data: any): Promise<TaptikContext> {
    const now = new Date().toISOString();
    const claudeData = data as ClaudeCodeExtractedData;

    const claudeConfig: ClaudeCodeConfig = {
      settings: claudeData.settings,
      claude_md: claudeData.claudeFiles?.claudeMd,
    };

    // Add MCP configuration if present
    if (claudeData.mcpServers && claudeData.mcpServers.length > 0) {
      claudeConfig.mcp = {
        servers: claudeData.mcpServers.map((s) => s.name),
        config: claudeData.mcpServers.reduce((accumulator, s) => {
          accumulator[s.name] = s.config;
          return accumulator;
        }, {}),
      };
    }

    // Add custom commands if present
    if (
      claudeData.customCommands &&
      Object.keys(claudeData.customCommands).length > 0
    ) {
      claudeConfig.commands = claudeData.customCommands;
    }

    const context: TaptikContext = {
      version: '1.0.0',
      metadata: {
        name: 'Claude Code Context',
        created_at: now,
        updated_at: now,
        platforms: [AIPlatform.CLAUDE_CODE],
      },
      ide: {
        category: 'ide',
        spec_version: '1.0.0',
        data: {
          claude_code: claudeConfig,
        },
      },
    };

    // Add project context if CLAUDE.md exists
    if (claudeData.claudeFiles?.claudeMd) {
      context.project = {
        category: 'project',
        spec_version: '1.0.0',
        data: {
          claude_instructions: claudeData.claudeFiles.claudeMd,
        },
      };
    }

    // Add prompts context if CLAUDE.local.md exists
    if (claudeData.claudeFiles?.claudeLocalMd) {
      context.prompts = {
        category: 'prompts',
        spec_version: '1.0.0',
        data: {
          custom_instructions: [claudeData.claudeFiles.claudeLocalMd],
        },
      };
    }

    // Add tools context if MCP servers exist
    if (claudeData.mcpServers && claudeData.mcpServers.length > 0) {
      context.tools = {
        category: 'tools',
        spec_version: '1.0.0',
        data: {
          mcp_servers: claudeData.mcpServers,
        },
      };
    }

    return context;
  }

  /**
   * Validate extracted Claude Code data
   */
  async validate(data: any): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];
    const claudeData = data as ClaudeCodeExtractedData;

    // Check for at least one Claude Code configuration
    if (
      !claudeData.settings &&
      !claudeData.mcpServers?.length &&
      !claudeData.claudeFiles?.claudeMd &&
      !claudeData.claudeFiles?.claudeLocalMd
    ) {
      warnings.push({
        path: 'claude',
        message: 'No Claude Code configuration found',
        suggestion: 'Add .claude/settings.json or CLAUDE.md file',
      });
    }

    // Validate MCP servers
    if (claudeData.mcpServers) {
      for (const server of claudeData.mcpServers) {
        if (!server.name) {
          errors.push({
            path: 'mcp',
            message: 'MCP server missing required name field',
          });
        }
        if (!server.command && !server.url) {
          errors.push({
            path: `mcp.${server.name}`,
            message: 'MCP server must have either command or url',
          });
        }
      }
    }

    // Validate settings
    if (claudeData.settings) {
      // Check for sensitive data in settings
      const settingsString = JSON.stringify(claudeData.settings);
      if (
        settingsString.includes('api_key') ||
        settingsString.includes('apiKey') ||
        settingsString.includes('token')
      ) {
        warnings.push({
          path: 'settings',
          message: 'Settings may contain sensitive data',
          suggestion: 'Remove API keys and tokens before sharing',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Build complete context from Claude Code project
   */
  async build(path?: string): Promise<TaptikContext> {
    const data = await this.extract(path);
    const validation = await this.validate(data);

    if (!validation.valid) {
      throw new Error(
        `Claude Code data validation failed: ${JSON.stringify(validation.errors)}`,
      );
    }

    return this.normalize(data);
  }

  /**
   * Convert universal context back to Claude Code format
   */
  async convert(context: TaptikContext): Promise<ConversionResult> {
    try {
      if (!context.ide?.data?.claude_code) {
        return {
          success: false,
          error: 'No Claude Code configuration found in context',
        };
      }

      const claudeConfig = context.ide.data.claude_code;
      const claudeData: ClaudeCodeExtractedData = {
        settings: claudeConfig.settings,
        customCommands:
          typeof claudeConfig.commands === 'object' &&
          !Array.isArray(claudeConfig.commands)
            ? claudeConfig.commands
            : undefined,
      };

      // Extract Claude files from project context
      if (context.project?.data?.claude_instructions) {
        claudeData.claudeFiles = {
          claudeMd: context.project.data.claude_instructions,
        };
      }

      // Extract custom instructions from prompts
      if (context.prompts?.data?.custom_instructions?.length) {
        if (!claudeData.claudeFiles) {
          claudeData.claudeFiles = {};
        }
        claudeData.claudeFiles.claudeLocalMd =
          context.prompts.data.custom_instructions[0];
      }

      // Extract MCP servers from tools
      if (context.tools?.data?.mcp_servers) {
        claudeData.mcpServers = context.tools.data.mcp_servers;
      }

      return {
        success: true,
        data: claudeData,
      };
    } catch (error) {
      return {
        success: false,
        error: `Conversion failed: ${error.message}`,
      };
    }
  }

  /**
   * Extract settings from .claude/settings.json
   */
  private async extractSettings(
    basePath: string,
  ): Promise<ClaudeCodeSettings | undefined> {
    const paths = [
      join(basePath, '.claude', 'settings.json'),
      join(homedir(), '.claude', 'settings.json'),
    ];

    const settings: ClaudeCodeSettings = {};

    for (const settingsPath of paths) {
      try {
        if (await this.fileSystem.exists(settingsPath)) {
          const fileSettings =
            await this.fileSystem.readJson<any>(settingsPath);

          // Merge settings (workspace overrides user)
          Object.assign(settings, fileSettings);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to read settings from ${settingsPath}: ${error.message}`,
        );
      }
    }

    return Object.keys(settings).length > 0 ? settings : undefined;
  }

  /**
   * Extract MCP servers from mcp.json files
   */
  private async extractMcpServers(basePath: string): Promise<any[]> {
    const servers: any[] = [];
    const processedServers = new Set<string>();

    // Check workspace-level MCP configuration
    const workspaceMcpPath = join(basePath, '.claude', 'mcp.json');
    if (await this.fileSystem.exists(workspaceMcpPath)) {
      try {
        const mcpConfig = await this.fileSystem.readJson<any>(workspaceMcpPath);
        if (mcpConfig.mcpServers) {
          for (const [name, config] of Object.entries(mcpConfig.mcpServers)) {
            if (!processedServers.has(name)) {
              servers.push(this.normalizeMcpServer(name, config as any));
              processedServers.add(name);
            }
          }
        }
      } catch (error) {
        this.logger.warn(
          `Failed to read workspace MCP config: ${error.message}`,
        );
      }
    }

    // Check user-level MCP configuration
    const userMcpPath = join(homedir(), '.claude', 'mcp.json');
    if (await this.fileSystem.exists(userMcpPath)) {
      try {
        const mcpConfig = await this.fileSystem.readJson<any>(userMcpPath);
        if (mcpConfig.mcpServers) {
          for (const [name, config] of Object.entries(mcpConfig.mcpServers)) {
            if (!processedServers.has(name)) {
              servers.push(this.normalizeMcpServer(name, config as any));
              processedServers.add(name);
            }
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to read user MCP config: ${error.message}`);
      }
    }

    return servers;
  }

  /**
   * Extract Claude files (CLAUDE.md and CLAUDE.local.md)
   */
  private async extractClaudeFiles(basePath: string): Promise<any> {
    const files: any = {};

    // Read CLAUDE.md
    const claudeMdPath = join(basePath, 'CLAUDE.md');
    if (await this.fileSystem.exists(claudeMdPath)) {
      try {
        files.claudeMd = await this.fileSystem.readFile(claudeMdPath);
      } catch (error) {
        this.logger.warn(`Failed to read CLAUDE.md: ${error.message}`);
      }
    }

    // Read CLAUDE.local.md
    const claudeLocalMdPath = join(basePath, 'CLAUDE.local.md');
    if (await this.fileSystem.exists(claudeLocalMdPath)) {
      try {
        files.claudeLocalMd = await this.fileSystem.readFile(claudeLocalMdPath);
      } catch (error) {
        this.logger.warn(`Failed to read CLAUDE.local.md: ${error.message}`);
      }
    }

    return Object.keys(files).length > 0 ? files : undefined;
  }

  /**
   * Extract custom commands from configuration
   */
  private async extractCustomCommands(
    basePath: string,
  ): Promise<Record<string, string> | undefined> {
    // Custom commands might be defined in settings or a separate file
    const commandsPath = join(basePath, '.claude', 'commands.json');

    if (await this.fileSystem.exists(commandsPath)) {
      try {
        return await this.fileSystem.readJson<Record<string, string>>(
          commandsPath,
        );
      } catch (error) {
        this.logger.warn(`Failed to read custom commands: ${error.message}`);
      }
    }

    return undefined;
  }

  /**
   * Normalize MCP server configuration
   */
  private normalizeMcpServer(name: string, config: any): any {
    const server: any = {
      name,
      version: config.version || '1.0.0',
    };

    // Handle different MCP server configurations
    if (config.command) {
      server.command = config.command;
      server.args = config.args || [];
    }

    if (config.url) {
      server.url = config.url;
    }

    if (config.env) {
      server.env = config.env;
    }

    server.config = config.config || {};
    server.enabled = config.enabled !== false;

    return server;
  }
}
