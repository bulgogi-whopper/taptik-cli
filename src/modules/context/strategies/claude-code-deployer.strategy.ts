import * as os from 'node:os';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import * as fs from 'fs-extra';

import { TaptikContext, AIPlatform } from '../interfaces';
import {
  IContextDeployerStrategy,
  DeploymentResult,
  BackupInfo,
  ValidationResult,
} from '../interfaces/strategy.interface';
import { FileSystemUtility } from '../utils/file-system.utility';
import { ProgressUtility } from '../utils/progress.utility';

export interface ClaudeCodeDeploymentOptions {
  overwrite?: boolean;
  backup?: boolean;
  dryRun?: boolean;
  preserveExisting?: boolean;
  mergeSettings?: boolean;
  deployGlobal?: boolean;
  deployLocal?: boolean;
}

export interface ClaudeCodeStructure {
  settings?: {
    global?: any;
    local?: any;
  };
  mcp?: {
    workspace?: any;
    user?: any;
  };
  claudeFiles?: {
    main?: string;
    local?: string;
  };
  customCommands?: any[];
}

@Injectable()
export class ClaudeCodeDeployerStrategy implements IContextDeployerStrategy {
  readonly platform = AIPlatform.CLAUDE_CODE;
  private readonly logger = new Logger(ClaudeCodeDeployerStrategy.name);
  private readonly CLAUDE_DIR = '.claude';
  private readonly CLAUDE_GLOBAL_DIR = path.join(os.homedir(), '.claude');

  constructor(
    private readonly fileSystem: FileSystemUtility,
    private readonly progress: ProgressUtility,
  ) {}

  /**
   * Check if Claude Code can be deployed to this environment
   */
  async canDeploy(targetPath: string): Promise<boolean> {
    try {
      // Check if it's a valid directory
      const stats = await fs.stat(targetPath);
      if (!stats.isDirectory()) {
        return false;
      }

      // Check write permissions
      await fs.access(targetPath, fs.constants.W_OK);

      return true;
    } catch (error) {
      this.logger.warn(`Cannot deploy to ${targetPath}: ${error.message}`);
      return false;
    }
  }

  /**
   * Deploy Claude Code context to the target environment
   */
  async deploy(
    context: TaptikContext,
    targetPath: string,
    options?: ClaudeCodeDeploymentOptions,
  ): Promise<DeploymentResult> {
    try {
      this.logger.log(`Deploying Claude Code context to ${targetPath}`);

      // Validate deployment
      if (!(await this.canDeploy(targetPath))) {
        return {
          success: false,
          deployed_items: [],
          errors: [{ item: 'target_path', error: 'Target path is not valid or writable', recoverable: false }],
          warnings: [],
          rollback_available: false,
        };
      }

      // Extract Claude Code-specific data
      const claudeData = this.extractClaudeCodeData(context);
      if (!claudeData) {
        return {
          success: false,
          deployed_items: [],
          errors: [{ item: 'context', error: 'No Claude Code configuration found in context', recoverable: false }],
          warnings: [],
          rollback_available: false,
        };
      }

      // Create backup if requested
      if (options?.backup && !options?.dryRun) {
        await this.createBackup();
      }

      const deployedFiles: string[] = [];
      const errors: string[] = [];
      const warnings: string[] = [];

      // Deploy local settings
      if (claudeData.settings?.local && options?.deployLocal !== false) {
        const settingsResult = await this.deployLocalSettings(
          claudeData.settings.local,
          targetPath,
          options,
        );
        deployedFiles.push(...settingsResult.files);
        errors.push(...settingsResult.errors);
        warnings.push(...settingsResult.warnings);
      }

      // Deploy global settings
      if (claudeData.settings?.global && options?.deployGlobal) {
        const globalResult = await this.deployGlobalSettings(
          claudeData.settings.global,
          options,
        );
        deployedFiles.push(...globalResult.files);
        errors.push(...globalResult.errors);
        warnings.push(...globalResult.warnings);
      }

      // Deploy MCP servers
      if (claudeData.mcp) {
        const mcpResult = await this.deployMcpServers(
          claudeData.mcp,
          targetPath,
          options,
        );
        deployedFiles.push(...mcpResult.files);
        errors.push(...mcpResult.errors);
        warnings.push(...mcpResult.warnings);
      }

      // Deploy CLAUDE.md files
      if (claudeData.claudeFiles) {
        const filesResult = await this.deployClaudeFiles(
          claudeData.claudeFiles,
          targetPath,
          options,
        );
        deployedFiles.push(...filesResult.files);
        errors.push(...filesResult.errors);
        warnings.push(...filesResult.warnings);
      }

      // Deploy custom commands
      if (claudeData.customCommands && claudeData.customCommands.length > 0) {
        const commandsResult = await this.deployCustomCommands(
          claudeData.customCommands,
          targetPath,
          options,
        );
        deployedFiles.push(...commandsResult.files);
        errors.push(...commandsResult.errors);
        warnings.push(...commandsResult.warnings);
      }

      return {
        success: errors.length === 0,
        deployed_items: deployedFiles.map(file => ({
          type: 'file' as const,
          path: file,
          status: 'created' as const
        })),
        errors: errors.map(error => ({
          item: 'deployment',
          error,
          recoverable: false
        })),
        warnings,
        rollback_available: true,
      };
    } catch (error) {
      this.logger.error(
        `Failed to deploy Claude Code context: ${error.message}`,
      );
      return {
        success: false,
        deployed_items: [],
        errors: [{ item: 'deployment', error: error.message, recoverable: false }],
        warnings: [],
        rollback_available: false,
      };
    }
  }

  /**
   * Validate deployment compatibility
   */
  async validateCompatibility(
    context: TaptikContext,
    targetPath: string,
  ): Promise<{
    compatible: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check if Claude Code data exists
    if (!context.ide?.data?.claude_code) {
      issues.push('No Claude Code configuration found in context');
    }

    // Check target path
    if (!(await this.canDeploy(targetPath))) {
      issues.push('Target path is not valid or writable');
    }

    // Check for existing Claude Code configuration
    const claudePath = path.join(targetPath, this.CLAUDE_DIR);
    if (await fs.pathExists(claudePath)) {
      const existingStructure = await this.analyzeExistingStructure(claudePath);
      if (existingStructure.hasCustomizations) {
        issues.push(
          'Existing Claude Code configuration has customizations that may be overwritten',
        );
      }
    }

    // Check for CLAUDE.md files
    const claudeMdPath = path.join(targetPath, 'CLAUDE.md');
    if (await fs.pathExists(claudeMdPath)) {
      issues.push('CLAUDE.md already exists and may be overwritten');
    }

    return {
      compatible: issues.length === 0,
      issues,
    };
  }

  /**
   * Remove deployed configuration
   */
  async undeploy(targetPath: string): Promise<boolean> {
    try {
      const removedItems: string[] = [];

      // Remove .claude directory
      const claudePath = path.join(targetPath, this.CLAUDE_DIR);
      if (await fs.pathExists(claudePath)) {
        await fs.remove(claudePath);
        removedItems.push(claudePath);
      }

      // Remove CLAUDE.md
      const claudeMdPath = path.join(targetPath, 'CLAUDE.md');
      if (await fs.pathExists(claudeMdPath)) {
        await fs.remove(claudeMdPath);
        removedItems.push(claudeMdPath);
      }

      // Remove CLAUDE.local.md
      const claudeLocalPath = path.join(targetPath, 'CLAUDE.local.md');
      if (await fs.pathExists(claudeLocalPath)) {
        await fs.remove(claudeLocalPath);
        removedItems.push(claudeLocalPath);
      }

      // Remove mcp.json
      const mcpPath = path.join(targetPath, 'mcp.json');
      if (await fs.pathExists(mcpPath)) {
        await fs.remove(mcpPath);
        removedItems.push(mcpPath);
      }

      // Remove .mcp.json
      const dotMcpPath = path.join(targetPath, '.mcp.json');
      if (await fs.pathExists(dotMcpPath)) {
        await fs.remove(dotMcpPath);
        removedItems.push(dotMcpPath);
      }

      if (removedItems.length > 0) {
        this.logger.log(
          `Removed Claude Code configuration from ${targetPath}: ${removedItems.join(', ')}`,
        );
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Failed to undeploy: ${error.message}`);
      return false;
    }
  }

  // Private helper methods

  private extractClaudeCodeData(
    context: TaptikContext,
  ): ClaudeCodeStructure | null {
    const claudeData = context.ide?.data?.claude_code;
    if (!claudeData) {
      return null;
    }

    return {
      settings: {
        local: claudeData.settings,
        global: undefined, // global_settings doesn't exist in ClaudeCodeConfig
      },
      mcp: {
        workspace: claudeData.mcp_servers,
        user: undefined, // user_mcp_servers doesn't exist in ClaudeCodeConfig
      },
      claudeFiles: {
        main: claudeData.claude_md,
        local: claudeData.claude_local_md,
      },
      customCommands: Array.isArray(claudeData.commands) ? claudeData.commands : (claudeData.commands ? Object.entries(claudeData.commands).map(([key, value]) => ({ [key]: value })) : []),
    };
  }

  private async deployLocalSettings(
    settings: any,
    targetPath: string,
    options?: ClaudeCodeDeploymentOptions,
  ): Promise<{ files: string[]; errors: string[]; warnings: string[] }> {
    const files: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const claudePath = path.join(targetPath, this.CLAUDE_DIR);
    const settingsPath = path.join(claudePath, 'settings.json');

    try {
      if (!options?.dryRun) {
        await fs.ensureDir(claudePath);
      }

      if (await this.shouldWriteFile(settingsPath, options)) {
        if (options?.mergeSettings && (await fs.pathExists(settingsPath))) {
          // Merge with existing settings
          const existing = await fs.readJson(settingsPath);
          const merged = this.mergeSettings(existing, settings);

          if (!options?.dryRun) {
            await fs.writeJson(settingsPath, merged, { spaces: 2 });
          }
          files.push(settingsPath);
          warnings.push(`Merged settings with existing configuration`);
        } else {
          // Overwrite or create new
          if (!options?.dryRun) {
            await fs.writeJson(settingsPath, settings, { spaces: 2 });
          }
          files.push(settingsPath);
        }
      } else {
        warnings.push(`Skipped existing file: ${settingsPath}`);
      }
    } catch (error) {
      errors.push(`Failed to deploy local settings: ${error.message}`);
    }

    return { files, errors, warnings };
  }

  private async deployGlobalSettings(
    settings: any,
    options?: ClaudeCodeDeploymentOptions,
  ): Promise<{ files: string[]; errors: string[]; warnings: string[] }> {
    const files: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const settingsPath = path.join(this.CLAUDE_GLOBAL_DIR, 'settings.json');

    try {
      if (!options?.dryRun) {
        await fs.ensureDir(this.CLAUDE_GLOBAL_DIR);
      }

      if (await this.shouldWriteFile(settingsPath, options)) {
        if (options?.mergeSettings && (await fs.pathExists(settingsPath))) {
          // Merge with existing settings
          const existing = await fs.readJson(settingsPath);
          const merged = this.mergeSettings(existing, settings);

          if (!options?.dryRun) {
            await fs.writeJson(settingsPath, merged, { spaces: 2 });
          }
          files.push(settingsPath);
          warnings.push(`Merged global settings with existing configuration`);
        } else {
          // Overwrite or create new
          if (!options?.dryRun) {
            await fs.writeJson(settingsPath, settings, { spaces: 2 });
          }
          files.push(settingsPath);
        }
      } else {
        warnings.push(`Skipped existing global settings`);
      }
    } catch (error) {
      errors.push(`Failed to deploy global settings: ${error.message}`);
    }

    return { files, errors, warnings };
  }

  private async deployMcpServers(
    mcp: { workspace?: any; user?: any },
    targetPath: string,
    options?: ClaudeCodeDeploymentOptions,
  ): Promise<{ files: string[]; errors: string[]; warnings: string[] }> {
    const files: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Deploy workspace MCP servers
      if (mcp.workspace) {
        const mcpPath = path.join(targetPath, 'mcp.json');

        if (await this.shouldWriteFile(mcpPath, options)) {
          if (!options?.dryRun) {
            await fs.writeJson(mcpPath, mcp.workspace, { spaces: 2 });
          }
          files.push(mcpPath);
        } else {
          warnings.push(`Skipped existing file: ${mcpPath}`);
        }
      }

      // Deploy user MCP servers (hidden file)
      if (mcp.user) {
        const dotMcpPath = path.join(targetPath, '.mcp.json');

        if (await this.shouldWriteFile(dotMcpPath, options)) {
          if (!options?.dryRun) {
            await fs.writeJson(dotMcpPath, mcp.user, { spaces: 2 });
          }
          files.push(dotMcpPath);
        } else {
          warnings.push(`Skipped existing file: ${dotMcpPath}`);
        }
      }
    } catch (error) {
      errors.push(`Failed to deploy MCP servers: ${error.message}`);
    }

    return { files, errors, warnings };
  }

  private async deployClaudeFiles(
    claudeFiles: { main?: string; local?: string },
    targetPath: string,
    options?: ClaudeCodeDeploymentOptions,
  ): Promise<{ files: string[]; errors: string[]; warnings: string[] }> {
    const files: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Deploy CLAUDE.md
      if (claudeFiles.main) {
        const claudeMdPath = path.join(targetPath, 'CLAUDE.md');

        if (await this.shouldWriteFile(claudeMdPath, options)) {
          if (!options?.dryRun) {
            await fs.writeFile(claudeMdPath, claudeFiles.main, 'utf8');
          }
          files.push(claudeMdPath);
        } else {
          warnings.push(`Skipped existing file: ${claudeMdPath}`);
        }
      }

      // Deploy CLAUDE.local.md
      if (claudeFiles.local) {
        const claudeLocalPath = path.join(targetPath, 'CLAUDE.local.md');

        if (await this.shouldWriteFile(claudeLocalPath, options)) {
          if (!options?.dryRun) {
            await fs.writeFile(claudeLocalPath, claudeFiles.local, 'utf8');
          }
          files.push(claudeLocalPath);
        } else {
          warnings.push(`Skipped existing file: ${claudeLocalPath}`);
        }
      }
    } catch (error) {
      errors.push(`Failed to deploy Claude files: ${error.message}`);
    }

    return { files, errors, warnings };
  }

  private async deployCustomCommands(
    commands: any[],
    targetPath: string,
    options?: ClaudeCodeDeploymentOptions,
  ): Promise<{ files: string[]; errors: string[]; warnings: string[] }> {
    const files: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const commandsPath = path.join(
      targetPath,
      this.CLAUDE_DIR,
      'commands.json',
    );

    try {
      const claudePath = path.join(targetPath, this.CLAUDE_DIR);
      if (!options?.dryRun) {
        await fs.ensureDir(claudePath);
      }

      if (await this.shouldWriteFile(commandsPath, options)) {
        if (!options?.dryRun) {
          await fs.writeJson(commandsPath, commands, { spaces: 2 });
        }
        files.push(commandsPath);
      } else {
        warnings.push(`Skipped existing file: ${commandsPath}`);
      }
    } catch (error) {
      errors.push(`Failed to deploy custom commands: ${error.message}`);
    }

    return { files, errors, warnings };
  }

  private async shouldWriteFile(
    filePath: string,
    options?: ClaudeCodeDeploymentOptions,
  ): Promise<boolean> {
    if (options?.dryRun) {
      return true; // In dry run, assume we would write
    }

    if (!(await fs.pathExists(filePath))) {
      return true; // File doesn't exist, safe to write
    }

    if (options?.overwrite) {
      return true; // Overwrite is enabled
    }

    if (options?.preserveExisting) {
      return false; // Preserve existing files
    }

    // Default behavior: don't overwrite
    return false;
  }

  private mergeSettings(existing: any, incoming: any): any {
    // Deep merge settings objects
    const merged = { ...existing };

    for (const key in incoming) {
      merged[key] =
        typeof incoming[key] === 'object' && !Array.isArray(incoming[key])
          ? this.mergeSettings(existing[key] || {}, incoming[key])
          : incoming[key];
    }

    return merged;
  }

  async createBackup(): Promise<BackupInfo> {
    const backupId = `claude-code-backup-${Date.now()}`;
    const items: any[] = [];
    
    // Backup local .claude directory
    const claudePath = path.join(process.cwd(), this.CLAUDE_DIR);
    if (await fs.pathExists(claudePath)) {
      const files = await this.fileSystem.getAllFiles(claudePath);
      for (const file of files) {
        const content = await fs.readFile(file, 'utf8');
        items.push({
          path: path.relative(claudePath, file),
          content,
          type: 'file' as const,
        });
      }
    }

    // Backup CLAUDE.md files
    const claudeMdPath = path.join(process.cwd(), 'CLAUDE.md');
    if (await fs.pathExists(claudeMdPath)) {
      const content = await fs.readFile(claudeMdPath, 'utf8');
      items.push({
        path: 'CLAUDE.md',
        content,
        type: 'file' as const,
      });
    }

    return {
      id: backupId,
      platform: AIPlatform.CLAUDE_CODE,
      created_at: new Date().toISOString(),
      items,
      size: JSON.stringify(items).length,
    };
  }

  async restoreBackup(_backupId: string): Promise<void> {
    // Implementation for restore backup
    throw new Error('Restore backup not yet implemented for Claude Code');
  }

  async validateDeployment(context: TaptikContext): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];
    
    try {
      // Validate .claude directory structure
      const claudePath = path.join(process.cwd(), this.CLAUDE_DIR);
      
      // Check if deployment was successful
      if (context.ide?.data?.claude_code?.settings && !await fs.pathExists(claudePath)) {
        errors.push({
          path: claudePath,
          message: '.claude directory not found after deployment',
          code: 'MISSING_DIRECTORY'
        });
      }
      
      // Validate CLAUDE.md if present
      if (context.ide?.data?.claude_code?.claude_md) {
        const claudeMdPath = path.join(process.cwd(), 'CLAUDE.md');
        if (!await fs.pathExists(claudeMdPath)) {
          warnings.push({
            path: claudeMdPath,
            message: 'CLAUDE.md not found after deployment',
            suggestion: 'CLAUDE.md may not have been deployed correctly'
          });
        }
      }
      
    } catch (error) {
      errors.push({
        path: 'validation',
        message: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
        code: 'VALIDATION_ERROR'
      });
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  private async analyzeExistingStructure(
    claudePath: string,
  ): Promise<{ hasCustomizations: boolean; files: string[] }> {
    const files: string[] = [];
    let hasCustomizations = false;

    try {
      // Check for non-standard files
      const entries = await fs.readdir(claudePath);
      const standardFiles = new Set(['settings.json', 'commands.json']);

      for (const entry of entries) {
        const entryPath = path.join(claudePath, entry);
        const stats = await fs.stat(entryPath);

        if (stats.isFile()) {
          files.push(entryPath);
          // Check if it's a non-standard file
          if (!standardFiles.has(entry)) {
            hasCustomizations = true;
          }
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to analyze existing structure: ${error.message}`,
      );
    }

    return { hasCustomizations, files };
  }
}
