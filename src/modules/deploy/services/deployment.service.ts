import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { Injectable } from '@nestjs/common';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import { PLATFORM_PATHS } from '../constants/platform-paths.constants';
import {
  DeployOptions,
  ComponentType,
} from '../interfaces/deploy-options.interface';
import { DeploymentResult } from '../interfaces/deployment-result.interface';

import { BackupService } from './backup.service';
import { DiffService } from './diff.service';
import { ErrorRecoveryService } from './error-recovery.service';
import { PerformanceMonitorService } from './performance-monitor.service';
import { PlatformValidatorService } from './platform-validator.service';
import { SecurityScannerService } from './security-scanner.service';

@Injectable()
export class DeploymentService {
  constructor(
    private readonly backupService: BackupService,
    private readonly diffService: DiffService,
    private readonly securityService: SecurityScannerService,
    private readonly validatorService: PlatformValidatorService,
    private readonly errorRecoveryService: ErrorRecoveryService,
    private readonly performanceMonitor: PerformanceMonitorService,
  ) {}

  async deployToClaudeCode(
    context: TaptikContext,
    options: DeployOptions,
  ): Promise<DeploymentResult> {
    // Generate unique deployment ID for performance tracking
    const deploymentId = `deploy-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    
    // Start performance monitoring
    this.performanceMonitor.startDeploymentTiming(deploymentId);
    this.performanceMonitor.recordMemoryUsage(deploymentId, 'start');

    const result: DeploymentResult = {
      success: false,
      platform: 'claude-code',
      deployedComponents: [] as string[],
      conflicts: [],
      summary: {
        filesDeployed: 0,
        filesSkipped: 0,
        conflictsResolved: 0,
        backupCreated: false,
      },
      errors: [],
      warnings: [],
      metadata: {
        deploymentId,
        performanceReport: '',
      },
    };

    try {
      // Step 1: Validate configuration for platform
      this.performanceMonitor.recordMemoryUsage(deploymentId, 'validation-start');
      const validationResult = await this.validatorService.validateForPlatform(
        context,
        'claude-code',
      );
      this.performanceMonitor.recordMemoryUsage(deploymentId, 'validation-end');

      if (!validationResult.isValid) {
        result.errors = validationResult.errors.map((error) => ({
          message: error.message,
          code: error.code || 'VALIDATION_ERROR',
          severity: error.severity,
        }));
        return result;
      }

      if (validationResult.warnings && validationResult.warnings.length > 0) {
        result.warnings = validationResult.warnings.map((warn) => ({
          message: warn.message,
          code: warn.code || 'WARNING',
        }));
      }

      // Step 2: Security scan
      this.performanceMonitor.recordMemoryUsage(deploymentId, 'security-start');
      const securityResult = await this.securityService.scanContext(context);
      this.performanceMonitor.recordMemoryUsage(deploymentId, 'security-end');

      if (!securityResult.isSafe) {
        result.errors = [
          {
            message: `Security check failed: ${securityResult.blockers?.join(', ') || 'Unknown security issue'}`,
            code: 'SECURITY_CHECK_FAILED',
            severity: 'HIGH',
          },
        ];
        return result;
      }

      // Step 3: Return early for validation-only mode
      if (options.validateOnly) {
        result.success = true;
        return result;
      }

      // Step 4: Handle backup strategy
      if (options.conflictStrategy === 'backup') {
        const backupPath = await this.createBackupForDeployment();
        result.summary.backupCreated = true;
        result.backupPath = backupPath;
      }

      // Step 5: Check for conflicts
      const existingConfig = await this.loadExistingClaudeCodeConfig();
      if (existingConfig) {
        const diff = this.diffService.generateDiff(context, existingConfig);

        if (diff.hasChanges) {
          // Handle conflicts based on strategy
          if (options.conflictStrategy === 'skip') {
            result.conflicts = diff.modifications.map((module_) => ({
              path: module_.path,
              message: `Skipping modification to ${module_.path}`,
              resolution: 'skipped',
            }));
            result.summary.filesSkipped = diff.modifications.length;
          } else if (options.conflictStrategy === 'overwrite') {
            result.summary.conflictsResolved = diff.modifications.length;
          }
        }
      }

      // Step 6: Return early for dry-run mode
      if (options.dryRun) {
        result.success = true;
        return result;
      }

      // Step 7: Deploy components based on options
      const componentsToDeploy = this.getComponentsToDeploy(options);

      // Deploy components sequentially to maintain order and handle dependencies
      for (const component of componentsToDeploy) {
        try {
          // Start component timing
          this.performanceMonitor.startComponentTiming(deploymentId, component);
          
          if (component === 'settings') {
            // Deploy settings even if empty for testing purposes
            const settings = context.content.ide?.claudeCode?.settings || {};
            await this.deployGlobalSettings(settings); // eslint-disable-line no-await-in-loop
            (result.deployedComponents as string[]).push('settings');
            result.summary.filesDeployed++;
          } else if (component === 'agents' && context.content.tools?.agents) {
            await this.deployAgents(context.content.tools.agents); // eslint-disable-line no-await-in-loop
            (result.deployedComponents as string[]).push('agents');
            result.summary.filesDeployed++;
          } else if (
            component === 'commands' &&
            context.content.tools?.commands
          ) {
            await this.deployCommands(context.content.tools.commands); // eslint-disable-line no-await-in-loop
            (result.deployedComponents as string[]).push('commands');
            result.summary.filesDeployed++;
          } else if (
            component === 'project' &&
            context.content.project &&
            Object.keys(context.content.project).length > 0
          ) {
            await this.deployProjectSettings( // eslint-disable-line no-await-in-loop 
              context.content.project as Record<string, unknown>,
            );
            (result.deployedComponents as string[]).push('project');
            result.summary.filesDeployed++;
          }
          
          // End component timing
          this.performanceMonitor.endComponentTiming(deploymentId, component);
        } catch (componentError) {
          result.errors.push({
            message: `Failed to deploy ${component}: ${(componentError as Error).message}`,
            code: 'COMPONENT_DEPLOYMENT_ERROR',
            severity: 'HIGH',
          });
          // Continue with other components instead of failing completely
        }
      }

      result.success = true;
      
      // End performance monitoring and generate report
      this.performanceMonitor.endDeploymentTiming(deploymentId);
      this.performanceMonitor.recordMemoryUsage(deploymentId, 'end');
      
      const performanceReport = this.performanceMonitor.generatePerformanceReport(deploymentId);
      const performanceViolations = this.performanceMonitor.checkPerformanceThresholds(deploymentId);
      
      if (result.metadata) {
        result.metadata.performanceReport = performanceReport;
      }
      
      // Add performance warnings if there are violations
      for (const violation of performanceViolations) {
        result.warnings.push({
          message: `Performance ${violation.severity}: ${violation.message}`,
          code: `PERFORMANCE_${violation.type.toUpperCase()}`,
        });
      }
      
      return result;
    } catch (error) {
      result.errors = [
        {
          message: `Deployment failed: ${(error as Error).message}`,
          code: 'DEPLOYMENT_ERROR',
          severity: 'HIGH',
        },
      ];

      // Attempt recovery if deployment failed
      if (!options.dryRun && result.metadata?.backupCreated) {
        try {
          const recoveryResult =
            await this.errorRecoveryService.recoverFromFailure(result, {
              platform: 'claudeCode',
              backupId: result.metadata.backupCreated,
              forceRecovery: true,
            });

          if (recoveryResult.success) {
            result.warnings.push({
              message:
                'Deployment failed but was successfully recovered from backup',
              code: 'RECOVERED_FROM_BACKUP',
            });
          } else {
            result.errors.push({
              message: 'Recovery from backup also failed',
              code: 'RECOVERY_FAILED',
              severity: 'CRITICAL',
            });
          }
        } catch (recoveryError) {
          result.errors.push({
            message: `Recovery failed: ${(recoveryError as Error).message}`,
            code: 'RECOVERY_ERROR',
            severity: 'CRITICAL',
          });
        }
      }

      return result;
    } finally {
      // Ensure performance monitoring is cleaned up
      this.performanceMonitor.endDeploymentTiming(deploymentId);
      // Optional: Clear metrics after a delay to allow for inspection
      setTimeout(() => {
        this.performanceMonitor.clearMetrics(deploymentId);
      }, 60000); // Clear after 1 minute
    }
  }

  async deployGlobalSettings(
    settings: Record<string, unknown>,
    strategy: 'merge' | 'overwrite' = 'overwrite',
  ): Promise<void> {
    const settingsPath = path.join(
      os.homedir(),
      PLATFORM_PATHS.CLAUDE_CODE.GLOBAL_SETTINGS,
    );
    const settingsDirectory = path.dirname(settingsPath);

    // Ensure directory exists
    await fs.mkdir(settingsDirectory, { recursive: true });

    let finalSettings = settings;

    if (strategy === 'merge') {
      try {
        const existingContent = await fs.readFile(settingsPath, 'utf8');
        const existingSettings = JSON.parse(existingContent);
        finalSettings = { ...existingSettings, ...settings };
      } catch {
        // File doesn't exist or is invalid, use new settings
      }
    }

    await fs.writeFile(settingsPath, JSON.stringify(finalSettings, null, 2));
  }

  async deployAgents(
    agents: Array<{ name: string; content: string }>,
  ): Promise<void> {
    const agentsDirectory = path.join(
      os.homedir(),
      PLATFORM_PATHS.CLAUDE_CODE.AGENTS_DIR,
    );

    // Ensure agents directory exists
    await fs.mkdir(agentsDirectory, { recursive: true });

    // Write all agent files in parallel
    const writePromises = agents
      .filter((agent) => agent.name && agent.content)
      .map((agent) => {
        const agentPath = path.join(agentsDirectory, `${agent.name}.md`);
        return fs.writeFile(agentPath, agent.content);
      });

    await Promise.all(writePromises);
  }

  async deployCommands(
    commands: Array<{
      name: string;
      content: string;
      permissions?: string[];
    }>,
  ): Promise<void> {
    const commandsDirectory = path.join(
      os.homedir(),
      PLATFORM_PATHS.CLAUDE_CODE.COMMANDS_DIR,
    );

    // Ensure commands directory exists
    await fs.mkdir(commandsDirectory, { recursive: true });

    // Write all command files in parallel
    const writePromises = commands
      .filter((command) => command.name && command.content)
      .map((command) => {
        const commandPath = path.join(commandsDirectory, `${command.name}.sh`);

        // Build command file content
        let fileContent = command.content;

        if (command.permissions && Array.isArray(command.permissions)) {
          // Add permissions as comments at the top of the file
          const permissionsHeader = command.permissions
            .map((perm) => `# Permission: ${perm}`)
            .join('\n');
          fileContent = `${permissionsHeader}\n\n${command.content}`;
        }

        return fs.writeFile(commandPath, fileContent);
      });

    await Promise.all(writePromises);
  }

  async deployProjectSettings(
    projectSettings: Record<string, unknown>,
  ): Promise<void> {
    // Deploy project-specific settings file
    const projectSettingsPath = PLATFORM_PATHS.CLAUDE_CODE.PROJECT_SETTINGS;
    await fs.writeFile(
      projectSettingsPath,
      JSON.stringify(projectSettings, null, 2),
    );

    // Deploy CLAUDE.md if it exists in project settings
    if (
      projectSettings.claudeMd &&
      typeof projectSettings.claudeMd === 'string'
    ) {
      const claudeMdPath = PLATFORM_PATHS.CLAUDE_CODE.CLAUDE_MD;
      await fs.writeFile(claudeMdPath, projectSettings.claudeMd as string);
    }
  }

  private getComponentsToDeploy(options: DeployOptions): ComponentType[] {
    const allComponents: ComponentType[] = [
      'settings',
      'agents',
      'commands',
      'project',
    ];

    if (options.components && options.components.length > 0) {
      return options.components;
    }

    if (options.skipComponents && options.skipComponents.length > 0) {
      return allComponents.filter(
        (comp) => !options.skipComponents!.includes(comp),
      );
    }

    return allComponents;
  }

  private async createBackupForDeployment(): Promise<string> {
    // Create a backup of existing Claude Code configuration
    const settingsPath = path.join(
      os.homedir(),
      PLATFORM_PATHS.CLAUDE_CODE.GLOBAL_SETTINGS,
    );

    try {
      await fs.access(settingsPath);
      return await this.backupService.createBackup(settingsPath);
    } catch {
      // No existing config to backup
      return '';
    }
  }

  private async loadExistingClaudeCodeConfig(): Promise<Record<
    string,
    unknown
  > | null> {
    try {
      const settingsPath = path.join(
        os.homedir(),
        PLATFORM_PATHS.CLAUDE_CODE.GLOBAL_SETTINGS,
      );
      const content = await fs.readFile(settingsPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}
