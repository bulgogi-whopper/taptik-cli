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
import { CursorComponentHandlerService } from './cursor-component-handler.service';
import { CursorConflictResolverService } from './cursor-conflict-resolver.service';
import { CursorParallelProcessorService } from './cursor-parallel-processor.service';
import { CursorPerformanceMonitorService } from './cursor-performance-monitor.service';
import { CursorTransformerService } from './cursor-transformer.service';
import { CursorValidatorService } from './cursor-validator.service';
import { DiffService } from './diff.service';
import { ErrorRecoveryService } from './error-recovery.service';
import { KiroComponentHandlerService } from './kiro-component-handler.service';
import { KiroInstallationDetectorService } from './kiro-installation-detector.service';
import { KiroTransformerService } from './kiro-transformer.service';
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
    private readonly kiroTransformer: KiroTransformerService,
    private readonly kiroComponentHandler: KiroComponentHandlerService,
    private readonly kiroInstallationDetector: KiroInstallationDetectorService,
    private readonly cursorTransformer: CursorTransformerService,
    private readonly cursorValidator: CursorValidatorService,
    private readonly cursorComponentHandler: CursorComponentHandlerService,
    private readonly cursorConflictResolver: CursorConflictResolverService,
    private readonly cursorPerformanceMonitor: CursorPerformanceMonitorService,
    private readonly cursorParallelProcessor: CursorParallelProcessorService,
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
      this.performanceMonitor.recordMemoryUsage(
        deploymentId,
        'validation-start',
      );
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

      // Deploy components in parallel for better performance
      const deploymentTasks = componentsToDeploy.map(async (component) => {
        try {
          // Start component timing
          this.performanceMonitor.startComponentTiming(deploymentId, component);

          if (component === 'settings') {
            // Deploy settings even if empty for testing purposes
            const settings = context.content.ide?.claudeCode?.settings || {};
            await this.deployGlobalSettings(settings);
            (result.deployedComponents as string[]).push('settings');
            result.summary.filesDeployed++;
          } else if (component === 'agents' && context.content.tools?.agents) {
            await this.deployAgents(context.content.tools.agents);
            (result.deployedComponents as string[]).push('agents');
            result.summary.filesDeployed++;
          } else if (
            component === 'commands' &&
            context.content.tools?.commands
          ) {
            await this.deployCommands(context.content.tools.commands);
            (result.deployedComponents as string[]).push('commands');
            result.summary.filesDeployed++;
          } else if (
            component === 'project' &&
            context.content.project &&
            Object.keys(context.content.project).length > 0
          ) {
            await this.deployProjectSettings(
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
      });

      // Wait for all deployments to complete
      await Promise.all(deploymentTasks);

      result.success = true;

      // End performance monitoring and generate report
      this.performanceMonitor.endDeploymentTiming(deploymentId);
      this.performanceMonitor.recordMemoryUsage(deploymentId, 'end');

      const performanceReport =
        this.performanceMonitor.generatePerformanceReport(deploymentId);
      const performanceViolations =
        this.performanceMonitor.checkPerformanceThresholds(deploymentId);

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
      this.cursorPerformanceMonitor.endCursorMonitoring(deploymentId);
      // Optional: Clear metrics after a delay to allow for inspection
      setTimeout(() => {
        this.performanceMonitor.clearMetrics(deploymentId);
      }, 60000); // Clear after 1 minute
    }
  }

  /**
   * Get components to process based on options
   */
  private getComponentsToProcess(options: DeployOptions): string[] {
    let componentsToProcess = [
      'settings',
      'extensions',
      'snippets',
      'ai-prompts',
      'tasks',
      'launch',
    ];
    
    if (options.components && options.components.length > 0) {
      componentsToProcess = options.components.filter((c) =>
        componentsToProcess.includes(c),
      );
    }
    
    if (options.skipComponents && options.skipComponents.length > 0) {
      componentsToProcess = componentsToProcess.filter(
        (c) => !options.skipComponents!.includes(c as ComponentType),
      );
    }
    
    return componentsToProcess;
  }

  /**
   * Create Cursor deployment context for parallel processing
   */
  private createCursorDeploymentContext(): any {
    const homeDir = os.homedir();
    const projectDir = process.cwd();
    
    return {
      globalSettingsPath: path.join(homeDir, '.cursor', 'settings.json'),
      projectSettingsPath: path.join(projectDir, '.cursor', 'settings.json'),
      aiPromptsPath: path.join(projectDir, '.cursor', 'ai', 'prompts'),
      aiRulesPath: path.join(projectDir, '.cursor', 'ai', 'rules'),
      aiContextPath: path.join(projectDir, '.cursor', 'ai', 'context.json'),
      extensionsPath: path.join(projectDir, '.cursor', 'extensions.json'),
      snippetsPath: path.join(homeDir, '.cursor', 'snippets'),
      tasksPath: path.join(projectDir, '.cursor', 'tasks.json'),
      launchPath: path.join(projectDir, '.cursor', 'launch.json'),
    };
  }

  async deployToKiro(
    context: TaptikContext,
    options: DeployOptions,
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
      errors: [],
      warnings: [],
      metadata: {
        deploymentId,
        performanceReport: 'Kiro deployment initialized',
      },
    };

    try {
      // Step 1: Check Kiro installation and compatibility
      this.performanceMonitor.recordMemoryUsage(
        deploymentId,
        'installation-check-start',
      );

      const installationInfo =
        await this.kiroInstallationDetector.detectKiroInstallation();

      if (!installationInfo.isInstalled) {
        result.errors.push({
          message:
            'Kiro IDE is not installed or not found in expected locations',
          code: 'KIRO_NOT_INSTALLED',
          severity: 'CRITICAL',
        });
        this.performanceMonitor.endDeploymentTiming(deploymentId);
        result.metadata!.performanceReport =
          'Kiro deployment failed - installation not found';
        return result;
      }

      // Add installation info to warnings for user visibility
      result.warnings.push({
        message: `Kiro IDE detected: v${installationInfo.version || 'unknown'} at ${installationInfo.installationPath}`,
        code: 'KIRO_INSTALLATION_DETECTED',
      });

      // Check compatibility
      if (!installationInfo.isCompatible) {
        const compatibilityResult =
          await this.kiroInstallationDetector.checkCompatibility(
            installationInfo.version,
          );

        // Add compatibility issues as warnings or errors based on severity
        for (const issue of compatibilityResult.issues) {
          if (issue.severity === 'critical') {
            result.errors.push({
              message: `Compatibility issue: ${issue.message}`,
              code: 'KIRO_COMPATIBILITY_ERROR',
              severity: 'HIGH',
            });
          } else {
            result.warnings.push({
              message: `Compatibility warning: ${issue.message}`,
              code: 'KIRO_COMPATIBILITY_WARNING',
            });
          }
        }

        // Stop deployment if critical compatibility issues exist
        if (
          compatibilityResult.issues.some(
            (issue) => issue.severity === 'critical',
          )
        ) {
          this.performanceMonitor.endDeploymentTiming(deploymentId);
          result.metadata!.performanceReport =
            'Kiro deployment failed - compatibility issues';
          return result;
        }

        // Add recommendations
        for (const recommendation of compatibilityResult.recommendations) {
          result.warnings.push({
            message: `Recommendation: ${recommendation}`,
            code: 'KIRO_RECOMMENDATION',
          });
        }
      }

      this.performanceMonitor.recordMemoryUsage(
        deploymentId,
        'installation-check-end',
      );

      // Step 2: Validate configuration for Kiro platform
      this.performanceMonitor.recordMemoryUsage(
        deploymentId,
        'validation-start',
      );
      const validationResult = await this.validatorService.validateForPlatform(
        context,
        'kiro-ide',
        options,
      );
      this.performanceMonitor.recordMemoryUsage(deploymentId, 'validation-end');

      if (!validationResult.isValid) {
        result.errors = validationResult.errors.map((error) => ({
          message: error.message,
          code: error.code || 'VALIDATION_ERROR',
          severity: error.severity,
        }));
        this.performanceMonitor.endDeploymentTiming(deploymentId);
        result.metadata!.performanceReport =
          'Kiro deployment failed - validation errors';
        return result;
      }

      // Add validation warnings
      if (validationResult.warnings && validationResult.warnings.length > 0) {
        result.warnings = validationResult.warnings.map((warn) => ({
          message: warn.message,
          code: warn.code || 'WARNING',
        }));
      }

      // Step 3: Return early for validation-only mode
      if (options.validateOnly) {
        result.success = true;
        result.metadata!.performanceReport =
          'Kiro validation completed successfully';
        this.performanceMonitor.endDeploymentTiming(deploymentId);
        return result;
      }

      // Step 4: Security scan for Kiro components
      this.performanceMonitor.recordMemoryUsage(deploymentId, 'security-start');

      // Transform TaptikContext to Kiro formats for security scanning
      const globalSettings =
        this.kiroTransformer.transformPersonalContext(context);
      const projectTransformation =
        this.kiroTransformer.transformProjectContext(context);
      const templates = this.kiroTransformer.transformPromptTemplates(
        context.content.prompts || {},
      );

      // Prepare components for security scanning
      const componentsForScan = [
        ...projectTransformation.hooks.map((hook) => ({
          type: 'hooks' as const,
          name: hook.name,
          content: hook,
        })),
        ...templates.map((template) => ({
          type: 'templates' as const,
          name: template.name,
          content: template,
        })),
        {
          type: 'settings' as const,
          name: 'global-settings',
          content: globalSettings,
        },
        {
          type: 'settings' as const,
          name: 'project-settings',
          content: projectTransformation.settings,
        },
        ...projectTransformation.steering.map((doc, index) => ({
          type: 'steering' as const,
          name: `steering-${index}`,
          content: doc,
        })),
        ...projectTransformation.specs.map((spec, index) => ({
          type: 'specs' as const,
          name: `spec-${index}`,
          content: spec,
        })),
      ];

      const securityOptions = {
        platform: 'kiro-ide' as const,
        conflictStrategy: options.conflictStrategy,
        dryRun: options.dryRun,
        validateOnly: options.validateOnly,
      };

      const securityResult = await this.securityService.scanKiroComponents(
        componentsForScan,
        securityOptions,
      );
      this.performanceMonitor.recordMemoryUsage(deploymentId, 'security-end');

      if (!securityResult.isSafe || !securityResult.passed) {
        const quarantinedComponents =
          securityResult.quarantinedComponents || [];
        const securityViolations = securityResult.securityViolations || [];

        result.errors.push({
          message: `Kiro security check failed: ${quarantinedComponents.length} component(s) quarantined, ${securityViolations.length} violation(s) found`,
          code: 'KIRO_SECURITY_CHECK_FAILED',
          severity: 'HIGH',
        });

        // Add detailed security violation information
        for (const violation of securityViolations) {
          result.warnings.push({
            message: `${violation.component} (${violation.componentType}): ${violation.description}`,
            code: `KIRO_SECURITY_${violation.severity.toUpperCase()}`,
          });
        }

        return result;
      }

      // Add security scan summary to warnings
      if (securityResult.summary && securityResult.summary.totalIssues === 0) {
        result.warnings.push({
          message: 'Kiro security scan passed - no issues found',
          code: 'KIRO_SECURITY_PASSED',
        });
      } else if (securityResult.summary) {
        result.warnings.push({
          message: `Kiro security scan: ${securityResult.summary.totalIssues} total issues (${securityResult.summary.highSeverity} high, ${securityResult.summary.mediumSeverity} medium, ${securityResult.summary.lowSeverity} low)`,
          code: 'KIRO_SECURITY_SUMMARY',
        });
      }

      // Step 5: Validate transformation results
      const validation = this.kiroTransformer.validateTransformation(
        globalSettings,
        projectTransformation.settings,
      );

      if (!validation.isValid) {
        result.errors.push(
          ...validation.errors.map((error) => ({
            message: error,
            code: 'KIRO_TRANSFORMATION_ERROR',
            severity: 'error',
          })),
        );

        this.performanceMonitor.endDeploymentTiming(deploymentId);
        result.metadata!.performanceReport =
          'Kiro deployment failed - transformation validation errors';
        return result;
      }

      // Add validation warnings
      if (validation.warnings.length > 0) {
        result.warnings.push(
          ...validation.warnings.map((warning) => ({
            message: warning,
            code: 'KIRO_TRANSFORMATION_WARNING',
          })),
        );
      }

      // Step 6: Create deployment context
      const homeDirectory = os.homedir();
      const projectDirectory = process.cwd();
      const deploymentContext = this.kiroTransformer.createDeploymentContext(
        homeDirectory,
        projectDirectory,
      );

      // Step 7: Apply deployment options filtering
      let componentsToProcess = [
        'settings',
        'steering',
        'specs',
        'hooks',
        'agents',
        'templates',
      ];
      if (options.components && options.components.length > 0) {
        componentsToProcess = options.components.filter((c) =>
          componentsToProcess.includes(c),
        );
      }
      if (options.skipComponents && options.skipComponents.length > 0) {
        componentsToProcess = componentsToProcess.filter(
          (c) => !options.skipComponents!.includes(c as ComponentType),
        );
      }

      // Step 8: Prepare deployment result with transformation data
      result.success = true;
      result.deployedComponents = componentsToProcess;
      result.summary.filesDeployed = componentsToProcess.length; // Will be updated when actual file writing is implemented
      result.summary.backupCreated = false; // Will be updated when backup service is integrated

      // Log deployment context paths for debugging
      result.warnings.push({
        message: `Deployment paths: ${JSON.stringify(deploymentContext.paths)}`,
        code: 'KIRO_DEPLOYMENT_PATHS',
      });

      // Add transformation results as warnings for now (until actual deployment is implemented)
      result.warnings.push({
        message: `Transformed ${Object.keys(globalSettings.user.profile).length} user profile fields`,
        code: 'KIRO_TRANSFORMATION_INFO',
      });

      result.warnings.push({
        message: `Generated ${projectTransformation.steering.length} steering documents`,
        code: 'KIRO_TRANSFORMATION_INFO',
      });

      result.warnings.push({
        message: `Generated ${projectTransformation.specs.length} spec documents`,
        code: 'KIRO_TRANSFORMATION_INFO',
      });

      result.warnings.push({
        message: `Generated ${projectTransformation.hooks.length} hooks`,
        code: 'KIRO_TRANSFORMATION_INFO',
      });

      result.warnings.push({
        message: `Generated ${templates.length} templates`,
        code: 'KIRO_TRANSFORMATION_INFO',
      });

      // Step 9: Handle backup strategy
      if (options.conflictStrategy === 'backup') {
        try {
          const backupPath = await this.createKiroBackup();
          result.summary.backupCreated = true;
          result.backupPath = backupPath;
          result.warnings.push({
            message: `Backup created at: ${backupPath}`,
            code: 'KIRO_BACKUP_CREATED',
          });
        } catch (backupError) {
          result.warnings.push({
            message: `Failed to create backup: ${(backupError as Error).message}`,
            code: 'KIRO_BACKUP_FAILED',
          });
        }
      }

      // Step 10: Return early for dry-run mode
      if (options.dryRun) {
        result.success = true;
        result.warnings.push({
          message: 'Dry run mode - no files were actually written to disk',
          code: 'KIRO_DRY_RUN',
        });
        this.performanceMonitor.endDeploymentTiming(deploymentId);
        result.metadata!.performanceReport =
          'Kiro dry-run completed successfully';
        return result;
      }

      // Step 11: Deploy components using component handler
      const kiroOptions = {
        platform: 'kiro-ide' as const,
        conflictStrategy: options.conflictStrategy,
        dryRun: options.dryRun,
        validateOnly: options.validateOnly,
        globalSettings: true,
        projectSettings: true,
        preserveTaskStatus: true,
        mergeStrategy: 'deep-merge' as const,
      };

      let actualFilesDeployed = 0;

      // Deploy settings if included
      if (componentsToProcess.includes('settings')) {
        const settingsResult = await this.kiroComponentHandler.deploySettings(
          globalSettings,
          projectTransformation.settings,
          deploymentContext,
          kiroOptions,
        );

        if (settingsResult.globalDeployed || settingsResult.projectDeployed) {
          actualFilesDeployed +=
            (settingsResult.globalDeployed ? 1 : 0) +
            (settingsResult.projectDeployed ? 1 : 0);
        }

        result.errors.push(...settingsResult.errors);
        result.warnings.push(...settingsResult.warnings);
      }

      // Deploy steering documents if included
      if (
        componentsToProcess.includes('steering') &&
        projectTransformation.steering.length > 0
      ) {
        const steeringResult = await this.kiroComponentHandler.deploySteering(
          projectTransformation.steering,
          deploymentContext,
          kiroOptions,
        );

        actualFilesDeployed += steeringResult.deployedFiles.length;
        result.errors.push(...steeringResult.errors);
        result.warnings.push(...steeringResult.warnings);
      }

      // Deploy specs if included
      if (
        componentsToProcess.includes('specs') &&
        projectTransformation.specs.length > 0
      ) {
        const specsResult = await this.kiroComponentHandler.deploySpecs(
          projectTransformation.specs,
          deploymentContext,
          kiroOptions,
        );

        actualFilesDeployed += specsResult.deployedFiles.length;
        result.errors.push(...specsResult.errors);
        result.warnings.push(...specsResult.warnings);
      }

      // Deploy hooks if included
      if (
        componentsToProcess.includes('hooks') &&
        projectTransformation.hooks.length > 0
      ) {
        const hooksResult = await this.kiroComponentHandler.deployHooks(
          projectTransformation.hooks,
          deploymentContext,
          kiroOptions,
        );

        actualFilesDeployed += hooksResult.deployedFiles.length;
        result.errors.push(...hooksResult.errors);
        result.warnings.push(...hooksResult.warnings);
      }

      // Deploy agents if included
      if (
        componentsToProcess.includes('agents') &&
        globalSettings.agents &&
        globalSettings.agents.length > 0
      ) {
        const agentsResult = await this.kiroComponentHandler.deployAgents(
          globalSettings.agents,
          deploymentContext,
          kiroOptions,
        );

        actualFilesDeployed += agentsResult.deployedFiles.length;
        result.errors.push(...agentsResult.errors);
        result.warnings.push(...agentsResult.warnings);
      }

      // Deploy templates if included
      if (componentsToProcess.includes('templates') && templates.length > 0) {
        const templatesResult = await this.kiroComponentHandler.deployTemplates(
          templates,
          deploymentContext,
          kiroOptions,
        );

        actualFilesDeployed += templatesResult.deployedFiles.length;
        result.errors.push(...templatesResult.errors);
        result.warnings.push(...templatesResult.warnings);
      }

      // Update deployment summary with actual results
      result.summary.filesDeployed = actualFilesDeployed;

      if (result.errors.length > 0) {
        result.success = false;
        result.warnings.push({
          message: `Deployment completed with ${result.errors.length} errors`,
          code: 'KIRO_DEPLOYMENT_PARTIAL_SUCCESS',
        });
      } else {
        result.warnings.push({
          message: `Successfully deployed ${actualFilesDeployed} files to Kiro IDE`,
          code: 'KIRO_DEPLOYMENT_SUCCESS',
        });
      }

      // Update deployment summary with actual results
      result.summary.filesDeployed = actualFilesDeployed;

      if (result.errors.length > 0) {
        result.success = false;
        result.warnings.push({
          message: `Deployment completed with ${result.errors.length} errors`,
          code: 'KIRO_DEPLOYMENT_PARTIAL_SUCCESS',
        });
      } else {
        result.warnings.push({
          message: `Successfully deployed ${actualFilesDeployed} files to Kiro IDE`,
          code: 'KIRO_DEPLOYMENT_SUCCESS',
        });
      }

      // End performance monitoring
      this.performanceMonitor.endDeploymentTiming(deploymentId);
      result.metadata.performanceReport = `Kiro deployment completed: ${result.summary.filesDeployed} files deployed`;

      return result;
    } catch (error) {
      // Add error to result
      result.errors.push({
        message: `Unexpected error during Kiro deployment: ${(error as Error).message}`,
        code: 'KIRO_UNEXPECTED_ERROR',
        severity: 'HIGH',
      });

      // Attempt error recovery if backup was created
      if (result.summary.backupCreated && result.backupPath) {
        try {
          const recoveryResult =
            await this.errorRecoveryService.recoverFromFailure(result, {
              platform: 'kiro-ide',
              backupId: result.backupPath
                ? path.basename(result.backupPath)
                : undefined,
              forceRecovery: true,
            });

          const recoverySuccess = recoveryResult.success;

          if (recoverySuccess) {
            result.warnings.push({
              message:
                'Deployment failed but was successfully recovered from backup',
              code: 'KIRO_RECOVERED_FROM_BACKUP',
            });
          } else {
            result.errors.push({
              message: 'Recovery from backup also failed',
              code: 'KIRO_RECOVERY_FAILED',
              severity: 'CRITICAL',
            });
          }
        } catch (recoveryError) {
          result.errors.push({
            message: `Recovery failed: ${(recoveryError as Error).message}`,
            code: 'KIRO_RECOVERY_ERROR',
            severity: 'CRITICAL',
          });
        }
      }

      // End performance monitoring even on error
      this.performanceMonitor.endDeploymentTiming(deploymentId);
      result.metadata.performanceReport =
        'Kiro deployment failed with error recovery attempted';

      return result;
    } finally {
      // Clear metrics after a delay to allow for inspection
      setTimeout(() => {
        this.performanceMonitor.clearMetrics(deploymentId);
      }, 60000); // Clear after 1 minute
    }
  }

  /**
   * Deploy configuration to Cursor IDE
   */
  async deployToCursor(
    context: TaptikContext,
    options: DeployOptions,
  ): Promise<DeploymentResult> {
    // Generate unique deployment ID for performance tracking
    const deploymentId = `cursor-deploy-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    // Start Cursor-specific performance monitoring
    const componentsToProcess = this.getComponentsToProcess(options);
    this.cursorPerformanceMonitor.startCursorMonitoring(
      deploymentId,
      await this.cursorTransformer.transform(context),
      componentsToProcess as any[],
    );

    // Also start base performance monitoring for compatibility
    this.performanceMonitor.startDeploymentTiming(deploymentId);
    this.performanceMonitor.recordMemoryUsage(deploymentId, 'start');

    const result: DeploymentResult = {
      success: false,
      platform: 'cursor-ide',
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
        performanceReport: 'Cursor deployment initialized',
      },
    };

    try {
      // Step 1: Validate configuration for Cursor platform
      this.performanceMonitor.recordMemoryUsage(
        deploymentId,
        'validation-start',
      );
      const validationResult = await this.cursorValidator.validate(context);
      this.performanceMonitor.recordMemoryUsage(deploymentId, 'validation-end');

      if (!validationResult.isValid) {
        result.errors = validationResult.errors.map((error) => ({
          message: error.message,
          code: error.code || 'VALIDATION_ERROR',
          severity: error.severity,
        }));
        this.performanceMonitor.endDeploymentTiming(deploymentId);
        result.metadata!.performanceReport =
          'Cursor deployment failed - validation errors';
        return result;
      }

      // Add validation warnings
      if (validationResult.warnings && validationResult.warnings.length > 0) {
        result.warnings = validationResult.warnings.map((warn) => ({
          message: warn.message,
          code: warn.code || 'WARNING',
        }));
      }

      // Step 2: Return early for validation-only mode
      if (options.validateOnly) {
        result.success = true;
        result.metadata!.performanceReport =
          'Cursor validation completed successfully';
        this.performanceMonitor.endDeploymentTiming(deploymentId);
        return result;
      }

      // Step 3: Security scan
      this.performanceMonitor.recordMemoryUsage(deploymentId, 'security-start');
      const securityResult = await this.securityService.scanContext(context);
      this.performanceMonitor.recordMemoryUsage(deploymentId, 'security-end');

      if (!securityResult.isSafe) {
        result.errors = [
          {
            message: `Security check failed: ${securityResult.blockers?.join(', ') || 'Unknown security issue'}`,
            code: 'CURSOR_SECURITY_CHECK_FAILED',
            severity: 'HIGH',
          },
        ];
        return result;
      }

      // Step 4: Transform context to Cursor configuration
      this.performanceMonitor.recordMemoryUsage(
        deploymentId,
        'transformation-start',
      );
      this.cursorPerformanceMonitor.recordCursorMemorySnapshot(deploymentId, 'transformation-start');
      
      const cursorConfig = await this.cursorTransformer.transform(context);
      
      this.performanceMonitor.recordMemoryUsage(
        deploymentId,
        'transformation-end',
      );
      this.cursorPerformanceMonitor.recordCursorMemorySnapshot(deploymentId, 'transformation-end');

      // Check if we should use streaming for large configurations
      const configSize = JSON.stringify(cursorConfig).length;
      const shouldUseStreaming = configSize > 10 * 1024 * 1024; // 10MB threshold
      
      if (shouldUseStreaming) {
        this.cursorPerformanceMonitor.recordStreamingUsage(
          deploymentId,
          Math.ceil(configSize / (2 * 1024 * 1024)), // 2MB chunks
          configSize,
          0, // Will be updated after processing
        );
      }

      // Step 5: Handle backup strategy
      if (options.conflictStrategy === 'backup') {
        try {
          const backupPath = await this.createCursorBackup();
          result.summary.backupCreated = true;
          result.backupPath = backupPath;
          result.warnings.push({
            message: `Backup created at: ${backupPath}`,
            code: 'CURSOR_BACKUP_CREATED',
          });
        } catch (backupError) {
          result.warnings.push({
            message: `Failed to create backup: ${(backupError as Error).message}`,
            code: 'CURSOR_BACKUP_FAILED',
          });
        }
      }

      // Step 6: Return early for dry-run mode
      if (options.dryRun) {
        result.success = true;
        result.warnings.push({
          message: 'Dry run mode - no files were actually written to disk',
          code: 'CURSOR_DRY_RUN',
        });
        this.performanceMonitor.endDeploymentTiming(deploymentId);
        result.metadata!.performanceReport =
          'Cursor dry-run completed successfully';
        return result;
      }

      // Step 7: Apply deployment options filtering
      let componentsToProcess = [
        'settings',
        'extensions',
        'snippets',
        'ai-prompts',
        'tasks',
        'launch',
      ];
      if (options.components && options.components.length > 0) {
        componentsToProcess = options.components.filter((c) =>
          componentsToProcess.includes(c),
        );
      }
      if (options.skipComponents && options.skipComponents.length > 0) {
        componentsToProcess = componentsToProcess.filter(
          (c) => !options.skipComponents!.includes(c as ComponentType),
        );
      }

      // Step 8: Deploy components using component handler with performance optimization
      this.performanceMonitor.recordMemoryUsage(
        deploymentId,
        'deployment-start',
      );
      this.cursorPerformanceMonitor.recordCursorMemorySnapshot(deploymentId, 'deployment-start');

      // Check if we should use parallel processing
      const shouldUseParallel = componentsToProcess.length >= 3;
      
      let deployResult;
      
      if (shouldUseParallel) {
        // Use parallel processing for multiple components
        const parallelResult = await this.cursorParallelProcessor.processComponentsInParallel(
          cursorConfig,
          componentsToProcess as any[],
          this.createCursorDeploymentContext(),
          {
            platform: 'cursor-ide' as const,
            conflictStrategy: options.conflictStrategy,
            dryRun: options.dryRun,
            validateOnly: options.validateOnly,
            components: componentsToProcess,
            skipComponents: options.skipComponents,
            enableLargeFileStreaming: options.enableLargeFileStreaming,
            onProgress: options.onProgress,
          },
          deploymentId,
          {
            maxConcurrency: 3,
            batchSize: 5,
            enableFileSystemOptimization: true,
            safetyChecks: true,
          },
        );

        this.cursorPerformanceMonitor.recordParallelProcessingUsage(
          deploymentId,
          parallelResult.totalBatches,
          3, // concurrency
          parallelResult.totalProcessingTime,
        );

        // Convert parallel result to deployment result format
        deployResult = {
          success: parallelResult.success,
          deployedComponents: componentsToProcess,
          conflicts: [],
          summary: {
            filesDeployed: parallelResult.successfulFiles,
            filesSkipped: parallelResult.failedFiles,
            conflictsResolved: 0,
            backupCreated: false,
          },
          errors: parallelResult.errors.map(error => ({
            message: error,
            code: 'PARALLEL_PROCESSING_ERROR',
            severity: 'HIGH' as const,
          })),
          warnings: [],
        };
      } else {
        // Use standard component handler for fewer components
        deployResult = await this.cursorComponentHandler.deploy(
          cursorConfig,
          {
            platform: 'cursor-ide' as const,
            conflictStrategy: options.conflictStrategy,
            dryRun: options.dryRun,
            validateOnly: options.validateOnly,
            components: componentsToProcess,
            skipComponents: options.skipComponents,
            enableLargeFileStreaming: options.enableLargeFileStreaming,
            onProgress: options.onProgress,
          },
        );
      }

      this.performanceMonitor.recordMemoryUsage(deploymentId, 'deployment-end');
      this.cursorPerformanceMonitor.recordCursorMemorySnapshot(deploymentId, 'deployment-end');

      // Step 9: Process deployment results
      result.success = deployResult.success;
      result.deployedComponents = deployResult.deployedComponents || [];
      result.conflicts = deployResult.conflicts || [];
      result.summary = {
        ...result.summary,
        ...deployResult.summary,
      };
      result.errors.push(...(deployResult.errors || []));
      result.warnings.push(...(deployResult.warnings || []));

      if (result.success) {
        result.warnings.push({
          message: `Successfully deployed ${result.summary.filesDeployed} files to Cursor IDE`,
          code: 'CURSOR_DEPLOYMENT_SUCCESS',
        });
      } else {
        result.warnings.push({
          message: `Deployment completed with ${result.errors.length} errors`,
          code: 'CURSOR_DEPLOYMENT_PARTIAL_SUCCESS',
        });
      }

      // End performance monitoring and generate comprehensive report
      this.performanceMonitor.endDeploymentTiming(deploymentId);
      this.cursorPerformanceMonitor.endCursorMonitoring(deploymentId);
      
      // Generate Cursor-specific performance report
      const cursorPerformanceReport = this.cursorPerformanceMonitor.generateCursorPerformanceReport(deploymentId);
      if (cursorPerformanceReport) {
        result.metadata.cursorPerformanceReport = cursorPerformanceReport;
        result.metadata.performanceReport = `Cursor deployment completed: ${result.summary.filesDeployed} files deployed. Performance: ${cursorPerformanceReport.summary.overallRating}`;
        
        // Add performance recommendations as warnings
        for (const recommendation of cursorPerformanceReport.recommendations) {
          if (recommendation.priority === 'high') {
            result.warnings.push({
              message: `Performance Recommendation: ${recommendation.title} - ${recommendation.description}`,
              code: 'CURSOR_PERFORMANCE_RECOMMENDATION',
            });
          }
        }
      } else {
        result.metadata.performanceReport = `Cursor deployment completed: ${result.summary.filesDeployed} files deployed`;
      }

      return result;
    } catch (error) {
      // Add error to result
      result.errors.push({
        message: `Unexpected error during Cursor deployment: ${(error as Error).message}`,
        code: 'CURSOR_UNEXPECTED_ERROR',
        severity: 'HIGH',
      });

      // Attempt error recovery if backup was created
      if (result.summary.backupCreated && result.backupPath) {
        try {
          const recoveryResult =
            await this.errorRecoveryService.recoverFromFailure(result, {
              platform: 'cursor-ide',
              backupId: result.backupPath
                ? path.basename(result.backupPath)
                : undefined,
              forceRecovery: true,
            });

          if (recoveryResult.success) {
            result.warnings.push({
              message:
                'Deployment failed but was successfully recovered from backup',
              code: 'CURSOR_RECOVERED_FROM_BACKUP',
            });
          } else {
            result.errors.push({
              message: 'Recovery from backup also failed',
              code: 'CURSOR_RECOVERY_FAILED',
              severity: 'CRITICAL',
            });
          }
        } catch (recoveryError) {
          result.errors.push({
            message: `Recovery failed: ${(recoveryError as Error).message}`,
            code: 'CURSOR_RECOVERY_ERROR',
            severity: 'CRITICAL',
          });
        }
      }

      // End performance monitoring even on error
      this.performanceMonitor.endDeploymentTiming(deploymentId);
      result.metadata.performanceReport =
        'Cursor deployment failed with error recovery attempted';

      return result;
    } finally {
      // Clear metrics after a delay to allow for inspection
      setTimeout(() => {
        this.performanceMonitor.clearMetrics(deploymentId);
      }, 60000); // Clear after 1 minute
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
      const onProgress =
        options.onProgress ||
        ((_progress) => {
          // Default: log progress (disabled for production - could use logger instead)
          // if (progress.percentage % 25 === 0) {
          //   console.log(`Deployment progress: ${progress.percentage}%`);
          // }
        });

      // Use streaming processor to handle the large configuration
      const streamResult =
        await this.largeFileStreamer.streamProcessConfiguration(
          context,
          async (chunk: unknown, chunkIndex: number) =>
            // For deployment, we process chunks by validating and preparing them
            // The actual file operations happen after streaming processing
            ({
              processed: true,
              chunkIndex,
              size: Buffer.byteLength(JSON.stringify(chunk), 'utf8'),
            }),
          {
            chunkSize: 2 * 1024 * 1024, // 2MB chunks for deployment
            onProgress,
            enableGarbageCollection: true,
            memoryThreshold: 100 * 1024 * 1024, // 100MB
          },
        );

      if (!streamResult.success) {
        result.errors.push({
          message: `Large file streaming failed: ${streamResult.error}`,
          code: 'STREAMING_ERROR',
          severity: 'HIGH',
        });
        return result;
      }

      this.performanceMonitor.recordMemoryUsage(
        deploymentId,
        'streaming-complete',
      );

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

      // Create deployment tasks for all components
      const deploymentTasks = componentsToDeploy.map(async (component) => {
        try {
          this.performanceMonitor.startComponentTiming(deploymentId, component);
          this.performanceMonitor.recordMemoryUsage(
            deploymentId,
            `component-${component}-start`,
          );

          let deployed = false;

          if (component === 'settings') {
            const settings = context.content.ide?.claudeCode?.settings || {};
            await this.deployGlobalSettings(settings);
            deployed = true;
          } else if (component === 'agents' && context.content.tools?.agents) {
            // For large configurations, deploy agents in smaller batches
            await this.deployAgentsStreaming(context.content.tools.agents);
            deployed = true;
          } else if (
            component === 'commands' &&
            context.content.tools?.commands
          ) {
            await this.deployCommandsStreaming(context.content.tools.commands);
            deployed = true;
          } else if (
            component === 'project' &&
            context.content.project &&
            Object.keys(context.content.project).length > 0
          ) {
            await this.deployProjectSettings(
              context.content.project as Record<string, unknown>,
            );
            deployed = true;
          }

          this.performanceMonitor.endComponentTiming(deploymentId, component);
          this.performanceMonitor.recordMemoryUsage(
            deploymentId,
            `component-${component}-end`,
          );

          if (deployed) {
            (result.deployedComponents as string[]).push(component);
            result.summary.filesDeployed++;
          }

          // Return component for memory optimization after all deployments
          return component;
        } catch (componentError) {
          result.errors.push({
            message: `Failed to deploy ${component}: ${(componentError as Error).message}`,
            code: 'COMPONENT_DEPLOYMENT_ERROR',
            severity: 'HIGH',
          });
          return null;
        }
      });

      // Execute all deployment tasks in parallel
      await Promise.all(deploymentTasks);

      // Optimize memory after all components are deployed
      await this.largeFileStreamer.optimizeMemoryUsage({
        memoryThreshold: 100 * 1024 * 1024,
        enableGarbageCollection: true,
        clearCaches: true,
      });

      result.success = true;

      // End performance monitoring
      this.performanceMonitor.endDeploymentTiming(deploymentId);
      this.performanceMonitor.recordMemoryUsage(deploymentId, 'large-end');

      const performanceReport =
        this.performanceMonitor.generatePerformanceReport(deploymentId);
      const performanceViolations =
        this.performanceMonitor.checkPerformanceThresholds(deploymentId);

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

    // Create batches of write operations
    const batches: Array<Promise<void>[]> = [];
    for (let i = 0; i < validAgents.length; i += batchSize) {
      const batch = validAgents.slice(i, i + batchSize);
      const writePromises = batch.map((agent) => {
        const agentPath = path.join(agentsDirectory, `${agent.name}.md`);
        return fs.writeFile(agentPath, agent.content);
      });
      batches.push(writePromises);
    }

    // Execute batches sequentially to manage memory using reduce to avoid await in loop
    await batches.reduce(async (previousBatch, currentBatch) => {
      await previousBatch;
      await Promise.all(currentBatch);

      // Trigger GC between batches for large collections
      if (validAgents.length > 100 && global.gc) {
        global.gc();
      }
    }, Promise.resolve());
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
    const validCommands = commands.filter(
      (command) => command.name && command.content,
    );

    // Create batches of write operations
    const batches: Array<Promise<void>[]> = [];
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
      batches.push(writePromises);
    }

    // Execute batches sequentially to manage memory using reduce to avoid await in loop
    await batches.reduce(async (previousBatch, currentBatch) => {
      await previousBatch;
      await Promise.all(currentBatch);

      // Trigger GC between batches
      if (validCommands.length > 100 && global.gc) {
        global.gc();
      }
    }, Promise.resolve());
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

  private async createKiroBackup(): Promise<string> {
    // Create backup of existing Kiro configuration
    const homeDirectory = os.homedir();
    const projectDirectory = process.cwd();
    const kiroPaths = [
      path.join(homeDirectory, '.kiro', 'settings.json'),
      path.join(homeDirectory, '.kiro', 'agents'),
      path.join(projectDirectory, '.kiro', 'settings.json'),
      path.join(projectDirectory, '.kiro', 'steering'),
      path.join(projectDirectory, '.kiro', 'specs'),
      path.join(projectDirectory, '.kiro', 'hooks'),
      path.join(projectDirectory, '.kiro', 'templates'),
    ];

    // Find the first existing path to use as backup base
    const pathChecks = kiroPaths.map(async (kiroPath) => {
      try {
        await fs.access(kiroPath);
        return { path: kiroPath, exists: true };
      } catch {
        return { path: kiroPath, exists: false };
      }
    });

    const results = await Promise.all(pathChecks);
    const existingPath = results.find((result) => result.exists);

    if (existingPath) {
      return await this.backupService.createBackup(existingPath.path);
    }

    // No existing Kiro config found, create empty backup
    return '';
  }

  private async createCursorBackup(): Promise<string> {
    // Create backup of existing Cursor configuration
    const homeDirectory = os.homedir();
    const projectDirectory = process.cwd();
    const cursorPaths = [
      path.join(homeDirectory, '.cursor', 'settings.json'),
      path.join(homeDirectory, '.cursor', 'keybindings.json'),
      path.join(homeDirectory, '.cursor', 'snippets'),
      path.join(homeDirectory, '.cursor', 'extensions'),
      path.join(homeDirectory, '.cursor', 'ai'),
      path.join(projectDirectory, '.cursor', 'settings.json'),
      path.join(projectDirectory, '.cursor', 'launch.json'),
      path.join(projectDirectory, '.cursor', 'tasks.json'),
      path.join(projectDirectory, '.cursor', 'extensions.json'),
      path.join(projectDirectory, '.cursor', 'ai'),
    ];

    // Find the first existing path to use as backup base
    const pathChecks = cursorPaths.map(async (cursorPath) => {
      try {
        await fs.access(cursorPath);
        return { path: cursorPath, exists: true };
      } catch {
        return { path: cursorPath, exists: false };
      }
    });

    const results = await Promise.all(pathChecks);
    const existingPath = results.find((result) => result.exists);

    if (existingPath) {
      return await this.backupService.createBackup(existingPath.path);
    }

    // No existing Cursor config found, create empty backup
    return '';
  }
}
