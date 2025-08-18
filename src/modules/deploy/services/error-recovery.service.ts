import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import { PLATFORM_PATHS } from '../constants/platform-paths.constants';
import {
  ComponentType,
  SupportedPlatform,
} from '../interfaces/component-types.interface';
import { DeploymentResult } from '../interfaces/deployment-result.interface';

import { BackupService } from './backup.service';
import { LockingService } from './locking.service';

export interface RecoveryOptions {
  platform: SupportedPlatform;
  backupId?: string;
  forceRecovery?: boolean;
  cleanupOnly?: boolean;
}

export interface RecoveryResult {
  success: boolean;
  recoveredComponents: ComponentType[];
  errors: Array<{
    component: ComponentType;
    error: string;
  }>;
  cleanedUp: boolean;
  backupRestored?: string;
}

@Injectable()
export class ErrorRecoveryService {
  private readonly logger = new Logger(ErrorRecoveryService.name);

  constructor(
    private readonly backupService: BackupService,
    private readonly lockingService: LockingService,
  ) {}

  /**
   * Attempt to recover from a failed deployment
   */
  async recoverFromFailure(
    deploymentResult: DeploymentResult,
    options: RecoveryOptions,
  ): Promise<RecoveryResult> {
    const result: RecoveryResult = {
      success: false,
      recoveredComponents: [],
      errors: [],
      cleanedUp: false,
    };

    try {
      // Step 1: Release any locks
      await this.releaseLocks(options.platform);
      result.cleanedUp = true;

      // Step 2: If cleanup only, stop here
      if (options.cleanupOnly) {
        result.success = true;
        return result;
      }

      // Step 3: Restore from backup if available
      if (deploymentResult.metadata?.backupCreated || options.backupId) {
        const backupId =
          options.backupId || deploymentResult.metadata?.backupCreated;

        if (backupId) {
          try {
            await this.backupService.restore(backupId, options.platform);
            result.backupRestored = backupId;
            result.success = true;
            this.logger.log(`Successfully restored backup: ${backupId}`);
          } catch (restoreError) {
            this.logger.error('Failed to restore backup', restoreError);
            result.errors.push({
              component: 'backup' as ComponentType,
              error: `Backup restore failed: ${(restoreError as Error).message}`,
            });
          }
        }
      }

      // Step 4: Attempt component-specific recovery
      const deployedComponents = deploymentResult.deployedComponents || [];

      for (const component of deployedComponents) {
        try {
          await this.recoverComponent(component as ComponentType, options); // eslint-disable-line no-await-in-loop
          result.recoveredComponents.push(component as ComponentType);
        } catch (componentError) {
          result.errors.push({
            component: component as ComponentType,
            error: (componentError as Error).message,
          });
        }
      }

      // Step 5: Clean up partial deployments
      await this.cleanupPartialDeployments(options.platform);

      result.success = result.errors.length === 0;
      return result;
    } catch (error) {
      this.logger.error('Recovery process failed', error);
      throw new Error(`Recovery failed: ${(error as Error).message}`);
    }
  }

  /**
   * Recover a specific component
   */
  private async recoverComponent(
    component: ComponentType,
    options: RecoveryOptions,
  ): Promise<void> {
    switch (component) {
      case 'settings':
        await this.recoverSettings(options);
        break;
      case 'agents':
        await this.recoverAgents(options);
        break;
      case 'commands':
        await this.recoverCommands(options);
        break;
      case 'project':
        await this.recoverProject(options);
        break;
      default:
        this.logger.warn(`Unknown component type for recovery: ${component}`);
    }
  }

  /**
   * Recover settings component
   */
  private async recoverSettings(_options: RecoveryOptions): Promise<void> {
    const settingsPath = path.join(
      os.homedir(),
      PLATFORM_PATHS.CLAUDE_CODE.GLOBAL_SETTINGS,
    );

    // Validate settings file integrity
    try {
      await fs.access(settingsPath);
    } catch {
      throw new Error('Settings path validation failed during recovery');
    }

    // Additional recovery logic for settings
    this.logger.log('Settings component recovered');
  }

  /**
   * Recover agents component
   */
  private async recoverAgents(_options: RecoveryOptions): Promise<void> {
    const agentsPath = path.join(
      os.homedir(),
      PLATFORM_PATHS.CLAUDE_CODE.AGENTS_DIR,
    );

    // Validate agents directory
    try {
      await fs.access(agentsPath);
    } catch {
      throw new Error('Agents path validation failed during recovery');
    }

    // Additional recovery logic for agents
    this.logger.log('Agents component recovered');
  }

  /**
   * Recover commands component
   */
  private async recoverCommands(_options: RecoveryOptions): Promise<void> {
    const commandsPath = path.join(
      os.homedir(),
      PLATFORM_PATHS.CLAUDE_CODE.COMMANDS_DIR,
    );

    // Validate commands directory
    try {
      await fs.access(commandsPath);
    } catch {
      throw new Error('Commands path validation failed during recovery');
    }

    // Additional recovery logic for commands
    this.logger.log('Commands component recovered');
  }

  /**
   * Recover project settings
   */
  private async recoverProject(_options: RecoveryOptions): Promise<void> {
    const projectPath = PLATFORM_PATHS.CLAUDE_CODE.PROJECT_SETTINGS;

    // Validate project path
    try {
      await fs.access(projectPath);
    } catch {
      throw new Error('Project path validation failed during recovery');
    }

    // Additional recovery logic for project settings
    this.logger.log('Project component recovered');
  }

  /**
   * Release all locks for a platform
   */
  private async releaseLocks(platform: SupportedPlatform): Promise<void> {
    try {
      await this.lockingService.releaseAll(platform);
      this.logger.log(`Released all locks for platform: ${platform}`);
    } catch (error) {
      this.logger.warn(`Failed to release locks: ${(error as Error).message}`);
    }
  }

  /**
   * Clean up partial deployments
   */
  private async cleanupPartialDeployments(
    platform: SupportedPlatform,
  ): Promise<void> {
    try {
      // Clean up stale lock files
      await this.lockingService.cleanupStaleLocks();

      // Clean up old backups
      const retention = platform === 'claudeCode' ? 5 : 10;
      await this.backupService.cleanupOldBackups(retention);

      this.logger.log('Cleaned up partial deployments');
    } catch (error) {
      this.logger.warn(`Cleanup failed: ${(error as Error).message}`);
    }
  }

  /**
   * Validate recovery was successful
   */
  async validateRecovery(
    result: RecoveryResult,
    expectedComponents: ComponentType[],
  ): Promise<boolean> {
    // Check all expected components were recovered
    const recoveredSet = new Set(result.recoveredComponents);
    const allRecovered = expectedComponents.every((comp) =>
      recoveredSet.has(comp),
    );

    if (!allRecovered) {
      this.logger.warn('Not all components were recovered');
      return false;
    }

    // Check no errors occurred
    if (result.errors.length > 0) {
      this.logger.warn(
        `Recovery completed with ${result.errors.length} errors`,
      );
      return false;
    }

    return result.success;
  }
}
