import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CursorDeploymentOptions, CursorDeploymentResult, CursorComponentType } from '../interfaces/cursor-deployment.interface';
import { DeploymentError, DeploymentWarning } from '../interfaces/deployment-result.interface';

/**
 * Task 6.2: Cursor deployment state manager for interrupted deployment recovery
 */
@Injectable()
export class CursorDeploymentStateService {
  private readonly logger = new Logger(CursorDeploymentStateService.name);
  private readonly stateBasePath: string;

  constructor() {
    // Create state directory in system temp or user home
    this.stateBasePath = path.join(
      process.env.HOME || process.env.USERPROFILE || '/tmp', 
      '.taptik-cli', 
      'deployment-states'
    );
  }

  /**
   * Save deployment state for recovery
   */
  async saveDeploymentState(
    deploymentId: string,
    options: CursorDeploymentOptions,
    progress: DeploymentProgress
  ): Promise<void> {
    this.logger.debug(`Saving deployment state: ${deploymentId}`);

    try {
      await fs.mkdir(this.stateBasePath, { recursive: true });
      
      const state: DeploymentState = {
        deploymentId,
        timestamp: new Date().toISOString(),
        status: progress.status,
        options,
        progress,
        version: '1.0.0',
      };

      const statePath = path.join(this.stateBasePath, `${deploymentId}.json`);
      await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf8');
      
      this.logger.debug(`Deployment state saved: ${statePath}`);
    } catch (error) {
      this.logger.error(`Failed to save deployment state for ${deploymentId}:`, error);
      // Don't throw - state saving is optional
    }
  }

  /**
   * Load deployment state
   */
  async loadDeploymentState(deploymentId: string): Promise<DeploymentState | null> {
    try {
      const statePath = path.join(this.stateBasePath, `${deploymentId}.json`);
      const stateContent = await fs.readFile(statePath, 'utf8');
      const state: DeploymentState = JSON.parse(stateContent);
      
      this.logger.debug(`Loaded deployment state: ${deploymentId}`);
      return state;
    } catch (error) {
      this.logger.debug(`No deployment state found for ${deploymentId}:`, error);
      return null;
    }
  }

  /**
   * Check for interrupted deployments
   */
  async findInterruptedDeployments(): Promise<DeploymentState[]> {
    this.logger.log('Checking for interrupted deployments...');

    try {
      await fs.mkdir(this.stateBasePath, { recursive: true });
      const stateFiles = await fs.readdir(this.stateBasePath);
      const interruptedDeployments: DeploymentState[] = [];

      for (const stateFile of stateFiles) {
        if (!stateFile.endsWith('.json')) continue;

        try {
          const statePath = path.join(this.stateBasePath, stateFile);
          const stateContent = await fs.readFile(statePath, 'utf8');
          const state: DeploymentState = JSON.parse(stateContent);

          // Check if deployment was interrupted
          if (this.isDeploymentInterrupted(state)) {
            interruptedDeployments.push(state);
            this.logger.log(`Found interrupted deployment: ${state.deploymentId}`);
          }
        } catch (error) {
          this.logger.warn(`Failed to parse state file ${stateFile}:`, error);
        }
      }

      this.logger.log(`Found ${interruptedDeployments.length} interrupted deployments`);
      return interruptedDeployments.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      this.logger.error('Failed to check for interrupted deployments:', error);
      return [];
    }
  }

  /**
   * Resume interrupted deployment
   */
  async resumeDeployment(deploymentId: string): Promise<DeploymentRecoveryPlan> {
    this.logger.log(`Planning recovery for interrupted deployment: ${deploymentId}`);

    const state = await this.loadDeploymentState(deploymentId);
    if (!state) {
      throw new Error(`Deployment state not found: ${deploymentId}`);
    }

    const recoveryPlan: DeploymentRecoveryPlan = {
      deploymentId,
      originalOptions: state.options,
      recoveryActions: [],
      remainingComponents: [],
      completedComponents: state.progress.completedComponents,
      failedComponents: state.progress.failedComponents,
      estimatedTimeRemaining: 0,
    };

    // Determine what needs to be done
    const allComponents = state.options.components || this.getDefaultComponents();
    const completedComponents = state.progress.completedComponents;
    const failedComponents = state.progress.failedComponents;
    
    recoveryPlan.remainingComponents = allComponents.filter(component => 
      !completedComponents.includes(component) && !failedComponents.includes(component)
    );

    // Plan recovery actions
    if (failedComponents.length > 0) {
      recoveryPlan.recoveryActions.push({
        type: 'retry_failed',
        description: `Retry failed components: ${failedComponents.join(', ')}`,
        components: failedComponents,
        priority: 'high',
      });
    }

    if (recoveryPlan.remainingComponents.length > 0) {
      recoveryPlan.recoveryActions.push({
        type: 'complete_remaining',
        description: `Complete remaining components: ${recoveryPlan.remainingComponents.join(', ')}`,
        components: recoveryPlan.remainingComponents,
        priority: 'medium',
      });
    }

    // Check for partial component deployments that need cleanup
    const partialComponents = this.detectPartialDeployments(state);
    if (partialComponents.length > 0) {
      recoveryPlan.recoveryActions.push({
        type: 'cleanup_partial',
        description: `Clean up partially deployed components: ${partialComponents.join(', ')}`,
        components: partialComponents,
        priority: 'high',
      });
    }

    // Estimate recovery time
    recoveryPlan.estimatedTimeRemaining = this.estimateRecoveryTime(recoveryPlan);

    this.logger.log(`Recovery plan created: ${recoveryPlan.recoveryActions.length} actions, ` +
                   `${recoveryPlan.remainingComponents.length} remaining components`);

    return recoveryPlan;
  }

  /**
   * Mark deployment as completed
   */
  async markDeploymentCompleted(deploymentId: string, result: CursorDeploymentResult): Promise<void> {
    this.logger.debug(`Marking deployment as completed: ${deploymentId}`);

    try {
      const state = await this.loadDeploymentState(deploymentId);
      if (state) {
        state.status = result.success ? 'completed' : 'failed';
        state.progress.completedAt = new Date().toISOString();
        state.progress.finalResult = result;

        const statePath = path.join(this.stateBasePath, `${deploymentId}.json`);
        await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf8');
      }

      // Schedule cleanup of old completed states
      this.scheduleStateCleanup();
    } catch (error) {
      this.logger.error(`Failed to mark deployment as completed: ${deploymentId}:`, error);
    }
  }

  /**
   * Update deployment progress
   */
  async updateDeploymentProgress(
    deploymentId: string,
    component: CursorComponentType,
    status: 'started' | 'completed' | 'failed',
    error?: DeploymentError
  ): Promise<void> {
    this.logger.debug(`Updating deployment progress: ${deploymentId}, ${component}, ${status}`);

    try {
      const state = await this.loadDeploymentState(deploymentId);
      if (!state) {
        this.logger.warn(`No state found for deployment: ${deploymentId}`);
        return;
      }

      // Update progress based on status
      switch (status) {
        case 'started':
          if (!state.progress.inProgressComponents.includes(component)) {
            state.progress.inProgressComponents.push(component);
          }
          break;

        case 'completed':
          state.progress.inProgressComponents = state.progress.inProgressComponents
            .filter(c => c !== component);
          if (!state.progress.completedComponents.includes(component)) {
            state.progress.completedComponents.push(component);
          }
          break;

        case 'failed':
          state.progress.inProgressComponents = state.progress.inProgressComponents
            .filter(c => c !== component);
          if (!state.progress.failedComponents.includes(component)) {
            state.progress.failedComponents.push(component);
          }
          if (error) {
            state.progress.componentErrors[component] = error;
          }
          break;
      }

      // Update overall status
      this.updateOverallStatus(state);

      // Save updated state
      const statePath = path.join(this.stateBasePath, `${deploymentId}.json`);
      await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf8');
    } catch (error) {
      this.logger.error(`Failed to update deployment progress for ${deploymentId}:`, error);
    }
  }

  /**
   * Clean up old deployment states
   */
  async cleanupOldStates(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    this.logger.log('Cleaning up old deployment states...');

    try {
      const stateFiles = await fs.readdir(this.stateBasePath);
      const cutoffTime = Date.now() - maxAge;
      let cleaned = 0;

      for (const stateFile of stateFiles) {
        if (!stateFile.endsWith('.json')) continue;

        try {
          const statePath = path.join(this.stateBasePath, stateFile);
          const stats = await fs.stat(statePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            // Check if it's a completed deployment
            const stateContent = await fs.readFile(statePath, 'utf8');
            const state: DeploymentState = JSON.parse(stateContent);
            
            if (state.status === 'completed' || state.status === 'failed') {
              await fs.unlink(statePath);
              cleaned++;
              this.logger.debug(`Cleaned up old state: ${stateFile}`);
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to process state file ${stateFile}:`, error);
        }
      }

      this.logger.log(`Cleaned up ${cleaned} old deployment states`);
    } catch (error) {
      this.logger.error('Failed to cleanup old states:', error);
    }
  }

  /**
   * Check if deployment is interrupted
   */
  private isDeploymentInterrupted(state: DeploymentState): boolean {
    // Consider deployment interrupted if:
    // 1. Status is 'in_progress' and it's been more than 30 minutes
    // 2. There are components in progress but no recent activity
    
    if (state.status !== 'in_progress') {
      return false;
    }

    const timeSinceLastUpdate = Date.now() - new Date(state.timestamp).getTime();
    const maxInactiveTime = 30 * 60 * 1000; // 30 minutes

    // If it's been too long since last update, consider it interrupted
    if (timeSinceLastUpdate > maxInactiveTime) {
      return true;
    }

    // If there are components in progress but deployment seems stuck
    if (state.progress.inProgressComponents.length > 0 && timeSinceLastUpdate > 10 * 60 * 1000) {
      return true;
    }

    return false;
  }

  /**
   * Detect partially deployed components
   */
  private detectPartialDeployments(state: DeploymentState): CursorComponentType[] {
    // In a real implementation, this would check file system state
    // For now, return components that were in progress when deployment was interrupted
    return state.progress.inProgressComponents;
  }

  /**
   * Estimate recovery time
   */
  private estimateRecoveryTime(plan: DeploymentRecoveryPlan): number {
    // Rough estimation based on component count and action types
    let estimatedSeconds = 0;
    
    for (const action of plan.recoveryActions) {
      switch (action.type) {
        case 'retry_failed':
          estimatedSeconds += action.components.length * 30; // 30 seconds per failed component retry
          break;
        case 'complete_remaining':
          estimatedSeconds += action.components.length * 15; // 15 seconds per remaining component
          break;
        case 'cleanup_partial':
          estimatedSeconds += action.components.length * 10; // 10 seconds per partial cleanup
          break;
      }
    }
    
    return Math.max(estimatedSeconds, 10); // Minimum 10 seconds
  }

  /**
   * Update overall deployment status
   */
  private updateOverallStatus(state: DeploymentState): void {
    const allComponents = state.options.components || this.getDefaultComponents();
    const completed = state.progress.completedComponents.length;
    const failed = state.progress.failedComponents.length;
    const total = allComponents.length;

    if (completed + failed >= total) {
      state.status = failed > 0 ? 'failed' : 'completed';
    } else {
      state.status = 'in_progress';
    }

    state.timestamp = new Date().toISOString(); // Update last activity time
  }

  /**
   * Get default components list
   */
  private getDefaultComponents(): CursorComponentType[] {
    return [
      'global-settings',
      'project-settings',
      'ai-config',
      'extensions-config',
      'debug-config',
      'tasks-config',
      'snippets-config',
      'workspace-config',
    ];
  }

  /**
   * Schedule periodic cleanup of old states
   */
  private scheduleStateCleanup(): void {
    // In a real implementation, this might use a job scheduler
    // For now, just run cleanup occasionally
    if (Math.random() < 0.1) { // 10% chance
      setTimeout(() => this.cleanupOldStates(), 1000);
    }
  }
}

/**
 * Deployment state information
 */
export interface DeploymentState {
  deploymentId: string;
  timestamp: string;
  status: DeploymentStatus;
  options: CursorDeploymentOptions;
  progress: DeploymentProgress;
  version: string;
}

/**
 * Deployment progress tracking
 */
export interface DeploymentProgress {
  status: DeploymentStatus;
  startedAt: string;
  completedAt?: string;
  completedComponents: CursorComponentType[];
  failedComponents: CursorComponentType[];
  inProgressComponents: CursorComponentType[];
  componentErrors: Record<CursorComponentType, DeploymentError>;
  finalResult?: CursorDeploymentResult;
}

/**
 * Deployment status types
 */
export type DeploymentStatus = 'initializing' | 'in_progress' | 'completed' | 'failed' | 'interrupted';

/**
 * Deployment recovery plan
 */
export interface DeploymentRecoveryPlan {
  deploymentId: string;
  originalOptions: CursorDeploymentOptions;
  recoveryActions: RecoveryAction[];
  remainingComponents: CursorComponentType[];
  completedComponents: CursorComponentType[];
  failedComponents: CursorComponentType[];
  estimatedTimeRemaining: number;
}

/**
 * Recovery action
 */
export interface RecoveryAction {
  type: 'retry_failed' | 'complete_remaining' | 'cleanup_partial';
  description: string;
  components: CursorComponentType[];
  priority: 'low' | 'medium' | 'high';
}