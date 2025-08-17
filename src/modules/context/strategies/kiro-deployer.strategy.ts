/* eslint-disable no-await-in-loop */
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

export interface KiroDeploymentOptions {
  overwrite?: boolean;
  backup?: boolean;
  dryRun?: boolean;
  preserveExisting?: boolean;
  mergeSpecs?: boolean;
}

export interface KiroStructure {
  specs: {
    [key: string]: {
      requirements?: string;
      design?: string;
      tasks?: string;
    };
  };
  steering: {
    [key: string]: string;
  };
  hooks: {
    [key: string]: any;
  };
  settings: {
    mcp?: any;
    [key: string]: any;
  };
}

@Injectable()
export class KiroDeployerStrategy implements IContextDeployerStrategy {
  readonly platform = AIPlatform.KIRO;
  private readonly logger = new Logger(KiroDeployerStrategy.name);
  private readonly KIRO_ROOT = '.kiro';

  constructor(
    private readonly fileSystem: FileSystemUtility,
    private readonly progress: ProgressUtility,
  ) {}

  /**
   * Check if Kiro can be deployed to this environment
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
   * Deploy Kiro context to the target environment
   */
  async deploy(
    context: TaptikContext,
    targetPath: string,
    options?: KiroDeploymentOptions,
  ): Promise<DeploymentResult> {
    try {
      this.logger.log(`Deploying Kiro context to ${targetPath}`);

      // Validate deployment
      if (!(await this.canDeploy(targetPath))) {
        return {
          success: false,
          deployed_items: [],
          errors: [
            {
              item: 'targetPath',
              error: 'Target path is not valid or writable',
              recoverable: false,
            },
          ],
          warnings: [],
          rollback_available: false,
        };
      }

      // Extract Kiro-specific data
      const kiroData = this.extractKiroData(context);
      if (!kiroData) {
        return {
          success: false,
          deployed_items: [],
          errors: [
            {
              item: 'context',
              error: 'No Kiro configuration found in context',
              recoverable: false,
            },
          ],
          warnings: [],
          rollback_available: false,
        };
      }

      // Create backup if requested
      if (options?.backup && !options?.dryRun) {
        await this.createBackup();
      }

      const deployedItems: Array<{
        type: 'file' | 'setting' | 'command' | 'hook';
        path: string;
        status: 'created' | 'updated' | 'skipped';
      }> = [];
      const errors: Array<{
        item: string;
        error: string;
        recoverable: boolean;
      }> = [];
      const warnings: string[] = [];

      // Deploy specs
      if (kiroData.specs) {
        const specsResult = await this.deploySpecs(
          kiroData.specs,
          targetPath,
          options,
        );
        deployedItems.push(...specsResult.items);
        errors.push(...specsResult.errors);
        warnings.push(...specsResult.warnings);
      }

      // Deploy steering rules
      if (kiroData.steering) {
        const steeringResult = await this.deploySteering(
          kiroData.steering,
          targetPath,
          options,
        );
        deployedItems.push(...steeringResult.items);
        errors.push(...steeringResult.errors);
        warnings.push(...steeringResult.warnings);
      }

      // Deploy hooks
      if (kiroData.hooks) {
        const hooksResult = await this.deployHooks(
          kiroData.hooks,
          targetPath,
          options,
        );
        deployedItems.push(...hooksResult.items);
        errors.push(...hooksResult.errors);
        warnings.push(...hooksResult.warnings);
      }

      // Deploy settings
      if (kiroData.settings) {
        const settingsResult = await this.deploySettings(
          kiroData.settings,
          targetPath,
          options,
        );
        deployedItems.push(...settingsResult.items);
        errors.push(...settingsResult.errors);
        warnings.push(...settingsResult.warnings);
      }

      return {
        success: errors.length === 0,
        deployed_items: deployedItems,
        errors,
        warnings,
        rollback_available: true,
      };
    } catch (error) {
      this.logger.error(`Failed to deploy Kiro context: ${error.message}`);
      return {
        success: false,
        deployed_items: [],
        errors: [
          { item: 'deployment', error: error.message, recoverable: false },
        ],
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

    // Check if Kiro data exists
    if (!context.ide?.data?.kiro) {
      issues.push('No Kiro configuration found in context');
    }

    // Check target path
    if (!(await this.canDeploy(targetPath))) {
      issues.push('Target path is not valid or writable');
    }

    // Check for existing Kiro configuration
    const kiroPath = path.join(targetPath, this.KIRO_ROOT);
    if (await fs.pathExists(kiroPath)) {
      const existingStructure = await this.analyzeExistingStructure(kiroPath);
      if (existingStructure.hasCustomizations) {
        issues.push(
          'Existing Kiro configuration has customizations that may be overwritten',
        );
      }
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
      const kiroPath = path.join(targetPath, this.KIRO_ROOT);

      if (await fs.pathExists(kiroPath)) {
        await fs.remove(kiroPath);
        this.logger.log(`Removed Kiro configuration from ${targetPath}`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Failed to undeploy: ${error.message}`);
      return false;
    }
  }

  // Private helper methods

  private extractKiroData(context: TaptikContext): KiroStructure | null {
    const kiroData = context.ide?.data?.kiro;
    if (!kiroData) {
      return null;
    }

    // Extract specs from project.data.kiro_specs
    const specs: KiroStructure['specs'] = {};
    if (context.project?.data?.kiro_specs && Array.isArray(context.project.data.kiro_specs)) {
      for (const spec of context.project.data.kiro_specs) {
        const specData = spec as Record<string, unknown>;
        specs[specData.name as string] = {
          requirements: specData.requirements as string,
          design: specData.design as string,
          tasks: specData.tasks as string,
        };
      }
    }

    // Extract settings from kiroData (mcp_settings and project_settings)
    const settings: KiroStructure['settings'] = {};
    if (kiroData.mcp_settings) {
      settings.mcp = kiroData.mcp_settings;
    }
    if (kiroData.project_settings) {
      settings.project = kiroData.project_settings;
    }

    return {
      specs,
      steering: Array.isArray(kiroData.steering_rules)
        ? Object.fromEntries(
            kiroData.steering_rules.map((rule) => [
              rule.name,
              rule.rules.join('\n'),
            ]),
          )
        : kiroData.steering_rules || {},
      hooks: Array.isArray(kiroData.hooks)
        ? Object.fromEntries(kiroData.hooks.map((hook) => [hook.name, hook]))
        : kiroData.hooks || {},
      settings,
    };
  }

  private async deploySpecs(
    specs: KiroStructure['specs'],
    targetPath: string,
    options?: KiroDeploymentOptions,
  ): Promise<{
    items: Array<{
      type: 'file' | 'setting' | 'command' | 'hook';
      path: string;
      status: 'created' | 'updated' | 'skipped';
    }>;
    errors: Array<{ item: string; error: string; recoverable: boolean }>;
    warnings: string[];
  }> {
    const items: Array<{
      type: 'file' | 'setting' | 'command' | 'hook';
      path: string;
      status: 'created' | 'updated' | 'skipped';
    }> = [];
    const errors: Array<{ item: string; error: string; recoverable: boolean }> =
      [];
    const warnings: string[] = [];
    const specsPath = path.join(targetPath, this.KIRO_ROOT, 'specs');

    try {
      if (!options?.dryRun) {
        await fs.ensureDir(specsPath);
      }

      for (const [specName, specContent] of Object.entries(specs)) {
        const specDir = path.join(specsPath, specName);

        if (!options?.dryRun) {
          await fs.ensureDir(specDir);
        }

        // Write requirements.md
        if (specContent.requirements) {
          const reqPath = path.join(specDir, 'requirements.md');
          if (await this.shouldWriteFile(reqPath, options)) {
            if (!options?.dryRun) {
              await fs.writeFile(reqPath, specContent.requirements, 'utf8');
            }
            items.push({ type: 'file', path: reqPath, status: 'created' });
          } else {
            warnings.push(`Skipped existing file: ${reqPath}`);
          }
        }

        // Write design.md
        if (specContent.design) {
          const designPath = path.join(specDir, 'design.md');
          if (await this.shouldWriteFile(designPath, options)) {
            if (!options?.dryRun) {
              await fs.writeFile(designPath, specContent.design, 'utf8');
            }
            items.push({ type: 'file', path: designPath, status: 'created' });
          } else {
            warnings.push(`Skipped existing file: ${designPath}`);
          }
        }

        // Write tasks.md
        if (specContent.tasks) {
          const tasksPath = path.join(specDir, 'tasks.md');
          if (await this.shouldWriteFile(tasksPath, options)) {
            if (!options?.dryRun) {
              await fs.writeFile(tasksPath, specContent.tasks, 'utf8');
            }
            items.push({ type: 'file', path: tasksPath, status: 'created' });
          } else {
            warnings.push(`Skipped existing file: ${tasksPath}`);
          }
        }
      }
    } catch (error) {
      errors.push({
        item: 'specs',
        error: `Failed to deploy specs: ${error.message}`,
        recoverable: true,
      });
    }

    return { items, errors, warnings };
  }

  private async deploySteering(
    steering: KiroStructure['steering'],
    targetPath: string,
    options?: KiroDeploymentOptions,
  ): Promise<{
    items: Array<{
      type: 'file' | 'setting' | 'command' | 'hook';
      path: string;
      status: 'created' | 'updated' | 'skipped';
    }>;
    errors: Array<{ item: string; error: string; recoverable: boolean }>;
    warnings: string[];
  }> {
    const items: Array<{
      type: 'file' | 'setting' | 'command' | 'hook';
      path: string;
      status: 'created' | 'updated' | 'skipped';
    }> = [];
    const errors: Array<{ item: string; error: string; recoverable: boolean }> =
      [];
    const warnings: string[] = [];
    const steeringPath = path.join(targetPath, this.KIRO_ROOT, 'steering');

    try {
      if (!options?.dryRun) {
        await fs.ensureDir(steeringPath);
      }

      for (const [ruleName, ruleContent] of Object.entries(steering)) {
        const rulePath = path.join(steeringPath, `${ruleName}.md`);

        if (await this.shouldWriteFile(rulePath, options)) {
          if (!options?.dryRun) {
            await fs.writeFile(rulePath, ruleContent, 'utf8');
          }
          items.push({ type: 'file', path: rulePath, status: 'created' });
        } else {
          warnings.push(`Skipped existing file: ${rulePath}`);
        }
      }
    } catch (error) {
      errors.push({
        item: 'steering',
        error: `Failed to deploy steering rules: ${error.message}`,
        recoverable: true,
      });
    }

    return { items, errors, warnings };
  }

  private async deployHooks(
    hooks: KiroStructure['hooks'],
    targetPath: string,
    options?: KiroDeploymentOptions,
  ): Promise<{
    items: Array<{
      type: 'file' | 'setting' | 'command' | 'hook';
      path: string;
      status: 'created' | 'updated' | 'skipped';
    }>;
    errors: Array<{ item: string; error: string; recoverable: boolean }>;
    warnings: string[];
  }> {
    const items: Array<{
      type: 'file' | 'setting' | 'command' | 'hook';
      path: string;
      status: 'created' | 'updated' | 'skipped';
    }> = [];
    const errors: Array<{ item: string; error: string; recoverable: boolean }> =
      [];
    const warnings: string[] = [];
    const hooksPath = path.join(targetPath, this.KIRO_ROOT, 'hooks');

    try {
      if (!options?.dryRun) {
        await fs.ensureDir(hooksPath);
      }

      for (const [hookName, hookContent] of Object.entries(hooks)) {
        const hookPath = path.join(hooksPath, hookName);
        const hookFile = hookPath.endsWith('.json')
          ? hookPath
          : `${hookPath}.json`;

        if (await this.shouldWriteFile(hookFile, options)) {
          if (!options?.dryRun) {
            const content =
              typeof hookContent === 'string'
                ? hookContent
                : JSON.stringify(hookContent, null, 2);
            await fs.writeFile(hookFile, content, 'utf8');
          }
          items.push({ type: 'hook', path: hookFile, status: 'created' });
        } else {
          warnings.push(`Skipped existing file: ${hookFile}`);
        }
      }
    } catch (error) {
      errors.push({
        item: 'hooks',
        error: `Failed to deploy hooks: ${error.message}`,
        recoverable: true,
      });
    }

    return { items, errors, warnings };
  }

  private async deploySettings(
    settings: KiroStructure['settings'],
    targetPath: string,
    options?: KiroDeploymentOptions,
  ): Promise<{
    items: Array<{
      type: 'file' | 'setting' | 'command' | 'hook';
      path: string;
      status: 'created' | 'updated' | 'skipped';
    }>;
    errors: Array<{ item: string; error: string; recoverable: boolean }>;
    warnings: string[];
  }> {
    const items: Array<{
      type: 'file' | 'setting' | 'command' | 'hook';
      path: string;
      status: 'created' | 'updated' | 'skipped';
    }> = [];
    const errors: Array<{ item: string; error: string; recoverable: boolean }> =
      [];
    const warnings: string[] = [];
    const settingsPath = path.join(targetPath, this.KIRO_ROOT, 'settings');

    try {
      if (!options?.dryRun) {
        await fs.ensureDir(settingsPath);
      }

      // Deploy MCP settings
      if (settings.mcp) {
        const mcpPath = path.join(settingsPath, 'mcp.json');

        if (await this.shouldWriteFile(mcpPath, options)) {
          if (!options?.dryRun) {
            await fs.writeJson(mcpPath, settings.mcp, { spaces: 2 });
          }
          items.push({ type: 'setting', path: mcpPath, status: 'created' });
        } else {
          warnings.push(`Skipped existing file: ${mcpPath}`);
        }
      }

      // Deploy other settings files
      for (const [settingName, settingContent] of Object.entries(settings)) {
        if (settingName === 'mcp') continue; // Already handled

        const settingPath = path.join(settingsPath, `${settingName}.json`);

        if (await this.shouldWriteFile(settingPath, options)) {
          if (!options?.dryRun) {
            await fs.writeJson(settingPath, settingContent, { spaces: 2 });
          }
          items.push({ type: 'setting', path: settingPath, status: 'created' });
        } else {
          warnings.push(`Skipped existing file: ${settingPath}`);
        }
      }
    } catch (error) {
      errors.push({
        item: 'settings',
        error: `Failed to deploy settings: ${error.message}`,
        recoverable: true,
      });
    }

    return { items, errors, warnings };
  }

  private async shouldWriteFile(
    filePath: string,
    options?: KiroDeploymentOptions,
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

  async createBackup(): Promise<BackupInfo> {
    const kiroPath = path.join(process.cwd(), this.KIRO_ROOT);
    const backupId = `kiro-backup-${Date.now()}`;
    const backupPath = `${kiroPath}.backup.${Date.now()}`;
    
    const items: any[] = [];
    
    if (await fs.pathExists(kiroPath)) {
      await fs.copy(kiroPath, backupPath);
      this.logger.log(`Created backup at ${backupPath}`);
      
      // Get all files in the backup
      const files = await this.fileSystem.getAllFiles(backupPath);
      for (const file of files) {
        const content = await fs.readFile(file, 'utf8');
        items.push({
          path: path.relative(backupPath, file),
          content,
          type: 'file' as const,
        });
      }
    }
    
    return {
      id: backupId,
      platform: AIPlatform.KIRO,
      created_at: new Date().toISOString(),
      items,
      size: JSON.stringify(items).length,
    };
  }

  async restoreBackup(backupId: string): Promise<void> {
    // Implementation for restore backup
    const backupPath = path.join(process.cwd(), `${this.KIRO_ROOT}.backup.${backupId.replace('kiro-backup-', '')}`);
    const kiroPath = path.join(process.cwd(), this.KIRO_ROOT);
    
    if (await fs.pathExists(backupPath)) {
      // Remove current .kiro directory if it exists
      if (await fs.pathExists(kiroPath)) {
        await fs.remove(kiroPath);
      }
      
      // Restore from backup
      await fs.copy(backupPath, kiroPath);
      this.logger.log(`Restored backup from ${backupPath}`);
    } else {
      throw new Error(`Backup ${backupId} not found at ${backupPath}`);
    }
  }

  async validateDeployment(context: TaptikContext): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];
    
    try {
      const kiroPath = path.join(process.cwd(), this.KIRO_ROOT);
      
      // Check if .kiro directory exists
      if (!await fs.pathExists(kiroPath)) {
        errors.push({
          path: kiroPath,
          message: '.kiro directory not found',
          code: 'MISSING_DIRECTORY'
        });
      }
      
      // Validate specs structure if present  
      if (context.ide?.data?.kiro?.specs_path) {
        const specsPath = path.join(kiroPath, 'specs');
        if (!await fs.pathExists(specsPath)) {
          warnings.push({
            path: specsPath,
            message: 'specs directory not found',
            suggestion: 'Specs may not have been deployed'
          });
        }
      }
      
      // Validate steering rules if present
      if (context.ide?.data?.kiro?.steering_rules) {
        const steeringPath = path.join(kiroPath, 'steering');
        if (!await fs.pathExists(steeringPath)) {
          warnings.push({
            path: steeringPath,
            message: 'steering directory not found',
            suggestion: 'Steering rules may not have been deployed'
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
    kiroPath: string,
  ): Promise<{ hasCustomizations: boolean; files: string[] }> {
    const files: string[] = [];
    let hasCustomizations = false;

    try {
      // Check for non-standard files or directories
      const entries = await fs.readdir(kiroPath);
      const standardDirectories = new Set([
        'specs',
        'steering',
        'hooks',
        'settings',
      ]);

      for (const entry of entries) {
        const entryPath = path.join(kiroPath, entry);
        const stats = await fs.stat(entryPath);

        if (stats.isDirectory() && !standardDirectories.has(entry)) {
          hasCustomizations = true;
        }

        if (stats.isFile()) {
          files.push(entryPath);
          // Check if it's a non-standard file
          if (!entry.endsWith('.md') && !entry.endsWith('.json')) {
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
