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
import { LargeFileStreamerService } from './large-file-streamer.service';
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
    private readonly largeFileStreamer: LargeFileStreamerService,
  ) {}

  async deployToClaudeCode(
    context: TaptikContext,
    options: DeployOptions,
  ): Promise<DeploymentResult> {
    // Generate unique deployment ID for performance tracking
    const deploymentId = `deploy-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    
    // Check if this is a large configuration that should use streaming
    const contextSize = Buffer.byteLength(JSON.stringify(context), 'utf8');
    const isLargeConfig = contextSize > 10 * 1024 * 1024; // 10MB threshold
    
    if (isLargeConfig && options.enableLargeFileStreaming !== false) {
      return this.deployLargeConfiguration(context, options, deploymentId);
    }
    
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
              platform: 'claude-code',
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

  async deployToKiro(
    _context: TaptikContext,
    _options: DeployOptions,
  ): Promise<DeploymentResult> {
    // Generate unique deployment ID for performance tracking
    const deploymentId = `kiro-deploy-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    
    // Start performance monitoring
    this.performanceMonitor.startDeploymentTiming(deploymentId);
    this.performanceMonitor.recordMemoryUsage(deploymentId, 'start');

    const result: DeploymentResult = {
      success: false,
      platform: 'kiro-ide',
      deployedComponents: [] as string[],
      conflicts: [],
      summary: {
        filesDeployed: 0,
        filesSkipped: 0,
        conflictsResolved: 0,
        backupCreated: false,
      },
      errors: [
        {
          message: 'Kiro IDE deployment is not yet implemented. This feature is under development.',
          code: 'KIRO_NOT_IMPLEMENTED',
          severity: 'error',
        },
      ],
      warnings: [
        {
          message: 'Kiro IDE deployment will be available in upcoming releases. Currently implementing: data transformation, component handlers, and validation services.',
          code: 'KIRO_FEATURE_PREVIEW',
        },
      ],
      metadata: {
        deploymentId,
        performanceReport: 'Deployment not executed - feature under development',
      },
    };

    try {
      // TODO: Implement Kiro deployment logic in upcoming tasks
      // Task 2.1: Kiro-specific interfaces and types
      // Task 2.2: Kiro data transformation service  
      // Task 2.3: Kiro component deployment handlers
      // Task 3.1: Kiro validation service
      
      // End performance monitoring
      this.performanceMonitor.endDeploymentTiming(deploymentId);
      result.metadata.performanceReport = 'Kiro deployment completed - feature under development';
      
      return result;
    } catch (error) {
      // Add error to result
      result.errors.push({
        message: `Unexpected error during Kiro deployment: ${(error as Error).message}`,
        code: 'KIRO_UNEXPECTED_ERROR',
        severity: 'error',
      });
      
      // End performance monitoring even on error
      this.performanceMonitor.endDeploymentTiming(deploymentId);
      result.metadata.performanceReport = 'Kiro deployment failed - feature under development';
      
      return result;
    }
  }

  /**
   * Deploy large configuration using streaming optimization
   */
  async deployLargeConfiguration(
    context: TaptikContext,
    options: DeployOptions,
    deploymentId: string,
  ): Promise<DeploymentResult> {
    // Start performance monitoring
    this.performanceMonitor.startDeploymentTiming(deploymentId);
    this.performanceMonitor.recordMemoryUsage(deploymentId, 'large-start');

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
        isLargeConfiguration: true,
      },
    };

    try {
      const contextSize = Buffer.byteLength(JSON.stringify(context), 'utf8');
      const sizeMB = Math.round(contextSize / 1024 / 1024);
      
      result.warnings.push({
        message: `Deploying large configuration (${sizeMB}MB) with streaming optimization`,
        code: 'LARGE_CONFIG_DETECTED',
      });

      // Progress tracking
      const onProgress = options.onProgress || ((_progress) => {
        // Default: log progress (disabled for production - could use logger instead)
        // if (progress.percentage % 25 === 0) {
        //   console.log(`Deployment progress: ${progress.percentage}%`);
        // }
      });

      // Use streaming processor to handle the large configuration
      const streamResult = await this.largeFileStreamer.streamProcessConfiguration(
        context,
        async (chunk: unknown, chunkIndex: number) => 
          // For deployment, we process chunks by validating and preparing them
          // The actual file operations happen after streaming processing
           ({ 
            processed: true, 
            chunkIndex,
            size: Buffer.byteLength(JSON.stringify(chunk), 'utf8'),
          })
        ,
        {
          chunkSize: 2 * 1024 * 1024, // 2MB chunks for deployment
          onProgress,
          enableGarbageCollection: true,
          memoryThreshold: 100 * 1024 * 1024, // 100MB
        }
      );

      if (!streamResult.success) {
        result.errors.push({
          message: `Large file streaming failed: ${streamResult.error}`,
          code: 'STREAMING_ERROR',
          severity: 'HIGH',
        });
        return result;
      }

      this.performanceMonitor.recordMemoryUsage(deploymentId, 'streaming-complete');

      // After successful streaming, perform standard validation and deployment
      // Step 1: Validate configuration for platform
      const validationResult = await this.validatorService.validateForPlatform(
        context,
        'claude-code',
      );

      if (!validationResult.isValid) {
        result.errors = validationResult.errors.map((error) => ({
          message: error.message,
          code: error.code || 'VALIDATION_ERROR',
          severity: error.severity,
        }));
        return result;
      }

      // Step 2: Security scan
      const securityResult = await this.securityService.scanContext(context);

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

      // Step 5: Return early for dry-run mode
      if (options.dryRun) {
        result.success = true;
        return result;
      }

      // Step 6: Deploy components with memory optimization
      const componentsToDeploy = this.getComponentsToDeploy(options);

      for (const component of componentsToDeploy) {
        try {
          this.performanceMonitor.startComponentTiming(deploymentId, component);
          this.performanceMonitor.recordMemoryUsage(deploymentId, `component-${component}-start`);

          if (component === 'settings') {
            const settings = context.content.ide?.claudeCode?.settings || {};
            await this.deployGlobalSettings(settings); // eslint-disable-line no-await-in-loop
            (result.deployedComponents as string[]).push('settings');
            result.summary.filesDeployed++;
          } else if (component === 'agents' && context.content.tools?.agents) {
            // For large configurations, deploy agents in smaller batches
            await this.deployAgentsStreaming(context.content.tools.agents); // eslint-disable-line no-await-in-loop
            (result.deployedComponents as string[]).push('agents');
            result.summary.filesDeployed++;
          } else if (component === 'commands' && context.content.tools?.commands) {
            await this.deployCommandsStreaming(context.content.tools.commands); // eslint-disable-line no-await-in-loop
            (result.deployedComponents as string[]).push('commands');
            result.summary.filesDeployed++;
          } else if (component === 'project' && context.content.project && Object.keys(context.content.project).length > 0) {
            await this.deployProjectSettings(context.content.project as Record<string, unknown>); // eslint-disable-line no-await-in-loop
            (result.deployedComponents as string[]).push('project');
            result.summary.filesDeployed++;
          }

          this.performanceMonitor.endComponentTiming(deploymentId, component);
          this.performanceMonitor.recordMemoryUsage(deploymentId, `component-${component}-end`);

          // Trigger memory optimization after each component
          await this.largeFileStreamer.optimizeMemoryUsage({ // eslint-disable-line no-await-in-loop
            memoryThreshold: 100 * 1024 * 1024,
            enableGarbageCollection: true,
            clearCaches: true,
          });

        } catch (componentError) {
          result.errors.push({
            message: `Failed to deploy ${component}: ${(componentError as Error).message}`,
            code: 'COMPONENT_DEPLOYMENT_ERROR',
            severity: 'HIGH',
          });
        }
      }

      result.success = true;
      
      // End performance monitoring
      this.performanceMonitor.endDeploymentTiming(deploymentId);
      this.performanceMonitor.recordMemoryUsage(deploymentId, 'large-end');
      
      const performanceReport = this.performanceMonitor.generatePerformanceReport(deploymentId);
      const performanceViolations = this.performanceMonitor.checkPerformanceThresholds(deploymentId);
      
      if (result.metadata) {
        result.metadata.performanceReport = performanceReport;
        result.metadata.streamingMetrics = {
          chunksProcessed: streamResult.chunksProcessed,
          totalSize: streamResult.totalSize,
          processingTime: streamResult.processingTime,
          memoryUsagePeak: streamResult.memoryUsagePeak,
        };
      }
      
      // Add performance warnings
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
          message: `Large configuration deployment failed: ${(error as Error).message}`,
          code: 'LARGE_DEPLOYMENT_ERROR',
          severity: 'HIGH',
        },
      ];
      return result;

    } finally {
      // Cleanup and memory optimization
      await this.largeFileStreamer.optimizeMemoryUsage({
        memoryThreshold: 50 * 1024 * 1024,
        enableGarbageCollection: true,
        clearCaches: true,
      });
      
      this.performanceMonitor.endDeploymentTiming(deploymentId);
      setTimeout(() => {
        this.performanceMonitor.clearMetrics(deploymentId);
      }, 60000);
    }
  }

  /**
   * Deploy agents with streaming optimization for large collections
   */
  async deployAgentsStreaming(
    agents: Array<{ name: string; content: string }>,
  ): Promise<void> {
    const agentsDirectory = path.join(
      os.homedir(),
      PLATFORM_PATHS.CLAUDE_CODE.AGENTS_DIR,
    );

    await fs.mkdir(agentsDirectory, { recursive: true });

    // Process agents in batches to avoid memory issues
    const batchSize = 50; // 50 agents per batch
    const validAgents = agents.filter((agent) => agent.name && agent.content);

    for (let i = 0; i < validAgents.length; i += batchSize) {
      const batch = validAgents.slice(i, i + batchSize);
      
      const writePromises = batch.map((agent) => {
        const agentPath = path.join(agentsDirectory, `${agent.name}.md`);
        return fs.writeFile(agentPath, agent.content);
      });

      await Promise.all(writePromises); // eslint-disable-line no-await-in-loop

      // Trigger GC between batches for large collections
      if (validAgents.length > 100 && global.gc) {
        global.gc();
      }
    }
  }

  /**
   * Deploy commands with streaming optimization for large collections
   */
  async deployCommandsStreaming(
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

    await fs.mkdir(commandsDirectory, { recursive: true });

    // Process commands in batches
    const batchSize = 50;
    const validCommands = commands.filter((command) => command.name && command.content);

    for (let i = 0; i < validCommands.length; i += batchSize) {
      const batch = validCommands.slice(i, i + batchSize);
      
      const writePromises = batch.map((command) => {
        const commandPath = path.join(commandsDirectory, `${command.name}.sh`);

        let fileContent = command.content;
        if (command.permissions && Array.isArray(command.permissions)) {
          const permissionsHeader = command.permissions
            .map((perm) => `# Permission: ${perm}`)
            .join('\n');
          fileContent = `${permissionsHeader}\n\n${command.content}`;
        }

        return fs.writeFile(commandPath, fileContent);
      });

      await Promise.all(writePromises); // eslint-disable-line no-await-in-loop

      // Trigger GC between batches
      if (validCommands.length > 100 && global.gc) {
        global.gc();
      }
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
