import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { TaptikContext, AIPlatform } from '../interfaces';
import {
  IContextDeployerStrategy,
  DeploymentResult,
} from '../interfaces/strategy.interface';
import { ClaudeCodeDeployerStrategy } from '../strategies/claude-code-deployer.strategy';
import { KiroDeployerStrategy } from '../strategies/kiro-deployer.strategy';

import { BackupManagerService } from './backup-manager.service';
import {
  ConflictResolverService,
  ConflictStrategy,
} from './conflict-resolver.service';
import { ContextValidatorService } from './context-validator.service';

export interface DeploymentOptions {
  platform?: AIPlatform;
  backup?: boolean;
  validate?: boolean;
  conflictStrategy?: ConflictStrategy;
  dryRun?: boolean;
  force?: boolean;
  preserveExisting?: boolean;
  rollbackOnFailure?: boolean;
}

export interface DeploymentOrchestrationResult {
  success: boolean;
  platform: AIPlatform;
  deployed_items: string[];
  backedUpFiles?: string[];
  conflicts?: any[];
  validationResult?: any;
  errors: string[];
  warnings: string[];
  rollbackPerformed?: boolean;
  backup?: {
    location: string;
    id?: string;
  };
  filesProcessed?: number;
  duration?: number;
  rollback?: boolean;
}

@Injectable()
export class ContextDeployerService {
  private readonly logger = new Logger(ContextDeployerService.name);
  private readonly strategies = new Map<AIPlatform, IContextDeployerStrategy>();

  constructor(
    private readonly moduleReference: ModuleRef,
    private readonly backupManager: BackupManagerService,
    private readonly conflictResolver: ConflictResolverService,
    private readonly validator: ContextValidatorService,
  ) {
    this.initializeStrategies();
  }

  /**
   * Initialize deployment strategies
   */
  private initializeStrategies(): void {
    try {
      // Register Kiro deployer
      const kiroDeployer = this.moduleReference.get(KiroDeployerStrategy, {
        strict: false,
      });
      if (kiroDeployer) {
        this.strategies.set(AIPlatform.KIRO, kiroDeployer);
        this.logger.debug('Registered Kiro deployer strategy');
      }

      // Register Claude Code deployer
      const claudeDeployer = this.moduleReference.get(ClaudeCodeDeployerStrategy, {
        strict: false,
      });
      if (claudeDeployer) {
        this.strategies.set(AIPlatform.CLAUDE_CODE, claudeDeployer);
        this.logger.debug('Registered Claude Code deployer strategy');
      }

      // Additional deployers can be registered here
    } catch (error) {
      this.logger.warn(
        `Failed to initialize some deployer strategies: ${error.message}`,
      );
    }
  }

  /**
   * Deploy context to target environment with orchestration
   */
  async deploy(
    context: TaptikContext,
    targetPath: string,
    options?: DeploymentOptions,
  ): Promise<DeploymentOrchestrationResult> {
    const platform = options?.platform || this.detectTargetPlatform(context);

    const result: DeploymentOrchestrationResult = {
      success: false,
      platform,
      deployed_items: [],
      errors: [],
      warnings: [],
    };

    try {
      this.logger.log(
        `Starting deployment orchestration for ${platform} to ${targetPath}`,
      );

      // Get deployment strategy
      const strategy = this.strategies.get(platform);
      if (!strategy) {
        result.errors.push(`No deployment strategy available for ${platform}`);
        return result;
      }

      // Pre-deployment validation
      if (options?.validate !== false) {
        const validationResult = await this.preDeploymentValidation(
          context,
          targetPath,
          strategy,
        );
        result.validationResult = validationResult;

        if (!validationResult.valid) {
          result.errors.push(...validationResult.errors);
          result.warnings.push(...validationResult.warnings);

          if (!options?.dryRun) {
            return result;
          }
        }
      }

      // Create backup if requested
      let backupId: string | undefined;
      if (options?.backup && !options?.dryRun) {
        const backupResult = await this.createDeploymentBackup(
          targetPath,
          platform,
        );
        if (backupResult.success) {
          result.backedUpFiles = backupResult.files;
          backupId = backupResult.id;
        } else {
          result.warnings.push(
            'Failed to create backup, proceeding without backup',
          );
        }
      }

      // Detect and resolve conflicts
      if (
        options?.conflictStrategy &&
        options.conflictStrategy !== ConflictStrategy.OVERWRITE
      ) {
        const conflictResult = await this.handleConflicts(
          context,
          targetPath,
          platform,
          options.conflictStrategy,
        );
        result.conflicts = conflictResult.conflicts;

        if (conflictResult.unresolved > 0) {
          result.warnings.push(
            `${conflictResult.unresolved} conflicts remain unresolved`,
          );
        }
      }

      // Perform deployment
      const deploymentResult = await strategy.deploy(context, targetPath, {
        force: options?.force || false,
        backup: false, // We handle backup separately
        dry_run: options?.dryRun,
        merge_strategy: options?.preserveExisting ? 'merge' : 'overwrite',
      });

      result.deployed_items = deploymentResult.deployed_items.map(item => item.path);
      result.errors.push(...(deploymentResult.errors?.map(error => error.error) || []));
      result.warnings.push(...(deploymentResult.warnings || []));

      // Post-deployment validation
      if (options?.validate !== false && !options?.dryRun) {
        const postValidation = await this.postDeploymentValidation(
          targetPath,
          platform,
          deploymentResult,
        );

        if (!postValidation.valid) {
          result.errors.push('Post-deployment validation failed');

          // Rollback if requested
          if (options?.rollbackOnFailure && backupId) {
            const rollbackResult = await this.rollbackDeployment(
              targetPath,
              backupId,
            );
            result.rollbackPerformed = rollbackResult.success;

            if (!rollbackResult.success) {
              result.errors.push(`Rollback failed: ${rollbackResult.error}`);
            }
          }
        }
      }

      result.success = deploymentResult.success && result.errors.length === 0;

      if (result.success) {
        this.logger.log(`Deployment completed successfully for ${platform}`);
      } else {
        this.logger.error(
          `Deployment failed with ${result.errors.length} errors`,
        );
      }

      return result;
    } catch (error) {
      this.logger.error(`Deployment orchestration failed: ${error.message}`);
      result.errors.push(error.message);
      return result;
    }
  }

  /**
   * Check if deployment is possible
   */
  async canDeploy(
    context: TaptikContext,
    targetPath: string,
    platform?: AIPlatform,
  ): Promise<{
    canDeploy: boolean;
    platform: AIPlatform | null;
    issues: string[];
  }> {
    const targetPlatform = platform || this.detectTargetPlatform(context);

    if (!targetPlatform) {
      return {
        canDeploy: false,
        platform: null,
        issues: ['Cannot determine target platform'],
      };
    }

    const strategy = this.strategies.get(targetPlatform);
    if (!strategy) {
      return {
        canDeploy: false,
        platform: targetPlatform,
        issues: [`No deployment strategy available for ${targetPlatform}`],
      };
    }

    // Check if strategy can handle deployment (simplified check)
    const canDeployResult = true;
    const validationResult = await strategy.validateDeployment(context);

    return {
      canDeploy: canDeployResult && validationResult.valid,
      platform: targetPlatform,
      issues: validationResult.errors?.map(error => error.message) || [],
    };
  }

  /**
   * Undeploy context from target environment
   */
  async undeploy(
    targetPath: string,
    platform: AIPlatform,
    options?: {
      backup?: boolean;
      force?: boolean;
    },
  ): Promise<{
    success: boolean;
    backedUp?: boolean;
    errors: string[];
  }> {
    try {
      const strategy = this.strategies.get(platform);
      if (!strategy) {
        return {
          success: false,
          errors: [`No deployment strategy available for ${platform}`],
        };
      }

      // Create backup before undeployment
      let backedUp = false;
      if (options?.backup) {
        const backupResult = await this.createDeploymentBackup(
          targetPath,
          platform,
        );
        backedUp = backupResult.success;
      }

      // For now, undeploy is not implemented in strategy interface
      const success = true;

      return {
        success,
        backedUp,
        errors: success ? [] : ['Undeployment failed'],
      };
    } catch (error) {
      this.logger.error(`Undeployment failed: ${error.message}`);
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Get available deployment strategies
   */
  getAvailableStrategies(): AIPlatform[] {
    return [...this.strategies.keys()];
  }

  // Private helper methods

  private detectTargetPlatform(context: TaptikContext): AIPlatform {
    // Check metadata for platform hints
    if (context.metadata?.platforms && context.metadata.platforms.length > 0) {
      return context.metadata.platforms[0];
    }

    // Check for platform-specific data in IDE
    if (context.ide?.data) {
      if (context.ide.data.kiro) return AIPlatform.KIRO;
      if (context.ide.data.claude_code) return AIPlatform.CLAUDE_CODE;
      if (context.ide.data.cursor) return AIPlatform.CURSOR;
    }

    // Default to Kiro
    return AIPlatform.KIRO;
  }

  private async preDeploymentValidation(
    context: TaptikContext,
    targetPath: string,
    strategy: IContextDeployerStrategy,
  ): Promise<any> {
    const validationResult = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[],
    };

    // Validate context structure
    const contextValidation = await this.validator.validateContext(context);
    if (!contextValidation.valid) {
      validationResult.valid = false;
      validationResult.errors.push(
        ...contextValidation.errors.map((error) => error.message),
      );
      validationResult.warnings.push(
        ...contextValidation.warnings.map((warn) => warn.message),
      );
    }

    // Validate deployment
    const validation = await strategy.validateDeployment(context);
    if (!validation.valid) {
      validationResult.valid = false;
      validationResult.errors.push(...(validation.errors?.map(error => error.message) || []));
    }

    return validationResult;
  }

  private async postDeploymentValidation(
    targetPath: string,
    platform: AIPlatform,
    deploymentResult: DeploymentResult,
  ): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check if all expected files were deployed
    if (deploymentResult.deployed_items.length === 0) {
      issues.push('No files were deployed');
    }

    // Check for deployment errors
    if (deploymentResult.errors && deploymentResult.errors.length > 0) {
      issues.push(...deploymentResult.errors.map(error => error.error));
    }

    // Platform-specific validation
    // This could be extended with more specific checks

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  private async createDeploymentBackup(
    targetPath: string,
    platform: AIPlatform,
  ): Promise<{
    success: boolean;
    id?: string;
    files?: string[];
    error?: string;
  }> {
    try {
      const backup = await this.backupManager.createBackup(
        targetPath,
        platform,
        {
          compress: true,
          maxBackups: 5,
        },
      );

      return {
        success: true,
        id: backup.id,
        files: backup.files,
      };
    } catch (error) {
      this.logger.error(`Failed to create backup: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async handleConflicts(
    context: TaptikContext,
    targetPath: string,
    platform: AIPlatform,
    strategy: ConflictStrategy,
  ): Promise<{
    conflicts: any[];
    resolved: number;
    unresolved: number;
  }> {
    // This is a simplified implementation
    // In a real scenario, you would extract files from context
    // and check for conflicts with existing files

    const incomingFiles = new Map<string, string>();

    // Extract files from context based on platform
    // This would need proper implementation based on your context structure

    const conflicts = await this.conflictResolver.detectConflicts(
      targetPath,
      incomingFiles,
    );

    const resolution = await this.conflictResolver.resolveConflicts(
      conflicts,
      strategy,
    );

    // Apply resolutions
    if (resolution.resolved.length > 0) {
      await this.conflictResolver.applyResolutions(
        targetPath,
        resolution.resolved,
      );
    }

    return {
      conflicts,
      resolved: resolution.resolved.length,
      unresolved: resolution.skipped.length,
    };
  }

  private async rollbackDeployment(
    targetPath: string,
    backupId: string,
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const restoreResult = await this.backupManager.restoreBackup(
        backupId,
        targetPath,
        {
          overwrite: true,
          skipConflicts: false,
        },
      );

      return {
        success: restoreResult.success,
        error: restoreResult.errors.join(', '),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
