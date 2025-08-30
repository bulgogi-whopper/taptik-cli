import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import { Injectable, Logger } from '@nestjs/common';

import { CursorDeploymentError, CursorErrorContext } from '../errors/cursor-deployment.error';
import { DeploymentResult } from '../interfaces/deployment-result.interface';

export interface CursorAuditEntry {
  timestamp: string;
  eventType: 'deployment_start' | 'deployment_success' | 'deployment_error' | 'recovery_attempt' | 'rollback';
  platform: 'cursor';
  userId?: string;
  configId?: string;
  workspacePath?: string;
  components?: string[];
  errorDetails?: {
    code: string;
    message: string;
    severity: string;
    recoveryActions?: string[];
  };
  metadata?: Record<string, unknown>;
  duration?: number;
}

export interface CursorAuditFilter {
  startDate?: Date;
  endDate?: Date;
  eventType?: CursorAuditEntry['eventType'];
  userId?: string;
  workspacePath?: string;
  errorCode?: string;
}

export interface CursorAuditStats {
  totalDeployments: number;
  successfulDeployments: number;
  failedDeployments: number;
  mostCommonErrors: Array<{ code: string; count: number; message: string }>;
  averageDeploymentTime: number;
  recoverySuccessRate: number;
}

@Injectable()
export class CursorAuditLoggerService {
  private readonly logger = new Logger(CursorAuditLoggerService.name);
  private readonly auditLogPath: string;

  constructor() {
    // Store audit logs in a dedicated directory
    const auditDir = path.join(os.homedir(), '.taptik', 'audit', 'cursor');
    this.auditLogPath = path.join(auditDir, 'deployment-audit.log');
    this.ensureAuditDirectory();
  }

  /**
   * Log deployment start event
   */
  async logDeploymentStart(
    configId: string,
    workspacePath: string,
    components: string[],
    userId?: string,
  ): Promise<void> {
    const entry: CursorAuditEntry = {
      timestamp: new Date().toISOString(),
      eventType: 'deployment_start',
      platform: 'cursor',
      userId,
      configId,
      workspacePath,
      components,
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    };

    await this.writeAuditEntry(entry);
    this.logger.log(`Deployment started - Config: ${configId}, Workspace: ${workspacePath}`);
  }

  /**
   * Log deployment success event
   */
  async logDeploymentSuccess(
    result: DeploymentResult,
    duration: number,
  ): Promise<void> {
    const entry: CursorAuditEntry = {
      timestamp: new Date().toISOString(),
      eventType: 'deployment_success',
      platform: 'cursor',
      userId: result.metadata?.userId,
      configId: result.metadata?.configId,
      workspacePath: result.metadata?.workspacePath,
      components: result.deployedComponents || [],
      duration,
      metadata: {
        backupCreated: result.metadata?.backupCreated,
        componentsCount: result.deployedComponents?.length || 0,
        warnings: result.warnings?.length || 0,
      },
    };

    await this.writeAuditEntry(entry);
    this.logger.log(`Deployment successful in ${duration}ms - ${result.deployedComponents?.length || 0} components`);
  }

  /**
   * Log deployment error event
   */
  async logDeploymentError(
    error: CursorDeploymentError,
    context?: CursorErrorContext,
  ): Promise<void> {
    const entry: CursorAuditEntry = {
      timestamp: new Date().toISOString(),
      eventType: 'deployment_error',
      platform: 'cursor',
      userId: context?.userId,
      configId: context?.configId,
      workspacePath: context?.workspacePath,
      errorDetails: {
        code: error.code.toString(),
        message: error.message,
        severity: error.severity,
        recoveryActions: error.recoveryActions.map(action => action.type),
      },
      metadata: {
        cursorVersion: context?.cursorVersion,
        extensionId: context?.extensionId,
        configSection: context?.configSection,
        aiContentSize: context?.aiContentSize,
        autoRecoverable: error.isAutoRecoverable(),
        requiresRestart: error.requiresCursorRestart(),
      },
    };

    await this.writeAuditEntry(entry);
    this.logger.error(`Deployment error - Code: ${error.code}, Message: ${error.message}`);
  }

  /**
   * Log recovery attempt event
   */
  async logRecoveryAttempt(
    originalError: CursorDeploymentError,
    recoveryAction: string,
    success: boolean,
    details?: Record<string, unknown>,
  ): Promise<void> {
    const entry: CursorAuditEntry = {
      timestamp: new Date().toISOString(),
      eventType: 'recovery_attempt',
      platform: 'cursor',
      userId: originalError.cursorContext.userId,
      configId: originalError.cursorContext.configId,
      workspacePath: originalError.cursorContext.workspacePath,
      errorDetails: {
        code: originalError.code.toString(),
        message: originalError.message,
        severity: originalError.severity,
      },
      metadata: {
        recoveryAction,
        recoverySuccess: success,
        recoveryDetails: details,
      },
    };

    await this.writeAuditEntry(entry);
    this.logger.log(`Recovery attempt: ${recoveryAction} - ${success ? 'Success' : 'Failed'}`);
  }

  /**
   * Log rollback event
   */
  async logRollback(
    reason: string,
    backupId?: string,
    success: boolean = true,
    context?: CursorErrorContext,
  ): Promise<void> {
    const entry: CursorAuditEntry = {
      timestamp: new Date().toISOString(),
      eventType: 'rollback',
      platform: 'cursor',
      userId: context?.userId,
      configId: context?.configId,
      workspacePath: context?.workspacePath,
      metadata: {
        rollbackReason: reason,
        backupId,
        rollbackSuccess: success,
      },
    };

    await this.writeAuditEntry(entry);
    this.logger.warn(`Rollback ${success ? 'completed' : 'failed'}: ${reason}`);
  }

  /**
   * Get audit entries with optional filtering
   */
  async getAuditEntries(filter?: CursorAuditFilter): Promise<CursorAuditEntry[]> {
    try {
      const content = await fs.readFile(this.auditLogPath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      let entries = lines.map(line => {
        try {
          return JSON.parse(line) as CursorAuditEntry;
        } catch {
          return null;
        }
      }).filter((entry): entry is CursorAuditEntry => entry !== null);

      // Apply filters
      if (filter) {
        entries = entries.filter(entry => {
          if (filter.startDate && new Date(entry.timestamp) < filter.startDate) return false;
          if (filter.endDate && new Date(entry.timestamp) > filter.endDate) return false;
          if (filter.eventType && entry.eventType !== filter.eventType) return false;
          if (filter.userId && entry.userId !== filter.userId) return false;
          if (filter.workspacePath && entry.workspacePath !== filter.workspacePath) return false;
          if (filter.errorCode && entry.errorDetails?.code !== filter.errorCode) return false;
          return true;
        });
      }

      return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []; // No audit log file yet
      }
      throw error;
    }
  }

  /**
   * Get audit statistics
   */
  async getAuditStats(filter?: CursorAuditFilter): Promise<CursorAuditStats> {
    const entries = await this.getAuditEntries(filter);
    
    const deploymentStarts = entries.filter(e => e.eventType === 'deployment_start');
    const deploymentSuccesses = entries.filter(e => e.eventType === 'deployment_success');
    const deploymentErrors = entries.filter(e => e.eventType === 'deployment_error');
    const recoveryAttempts = entries.filter(e => e.eventType === 'recovery_attempt');

    // Calculate error frequency
    const errorCounts = new Map<string, { count: number; message: string }>();
    deploymentErrors.forEach(entry => {
      if (entry.errorDetails) {
        const key = entry.errorDetails.code;
        const existing = errorCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          errorCounts.set(key, {
            count: 1,
            message: entry.errorDetails.message,
          });
        }
      }
    });

    const mostCommonErrors = Array.from(errorCounts.entries())
      .map(([code, data]) => ({ code, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate average deployment time
    const successfulWithDuration = deploymentSuccesses.filter(e => e.duration);
    const averageDeploymentTime = successfulWithDuration.length > 0
      ? successfulWithDuration.reduce((sum, e) => sum + (e.duration || 0), 0) / successfulWithDuration.length
      : 0;

    // Calculate recovery success rate
    const successfulRecoveries = recoveryAttempts.filter(e => e.metadata?.recoverySuccess === true);
    const recoverySuccessRate = recoveryAttempts.length > 0
      ? (successfulRecoveries.length / recoveryAttempts.length) * 100
      : 0;

    return {
      totalDeployments: deploymentStarts.length,
      successfulDeployments: deploymentSuccesses.length,
      failedDeployments: deploymentErrors.length,
      mostCommonErrors,
      averageDeploymentTime: Math.round(averageDeploymentTime),
      recoverySuccessRate: Math.round(recoverySuccessRate * 100) / 100,
    };
  }

  /**
   * Clean up old audit entries
   */
  async cleanupOldEntries(retentionDays: number = 90): Promise<number> {
    const entries = await this.getAuditEntries();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const recentEntries = entries.filter(entry => new Date(entry.timestamp) > cutoffDate);
    const removedCount = entries.length - recentEntries.length;

    if (removedCount > 0) {
      // Rewrite the file with only recent entries
      const content = recentEntries.map(entry => JSON.stringify(entry)).join('\n');
      await fs.writeFile(this.auditLogPath, content + '\n');
      this.logger.log(`Cleaned up ${removedCount} old audit entries (retention: ${retentionDays} days)`);
    }

    return removedCount;
  }

  /**
   * Write a single audit entry to the log file
   */
  private async writeAuditEntry(entry: CursorAuditEntry): Promise<void> {
    const logLine = JSON.stringify(entry) + '\n';
    
    try {
      await fs.appendFile(this.auditLogPath, logLine);
    } catch (error) {
      this.logger.error('Failed to write audit entry', error);
      // Don't throw - audit logging should not break deployments
    }
  }

  /**
   * Ensure audit directory exists
   */
  private async ensureAuditDirectory(): Promise<void> {
    try {
      const auditDir = path.dirname(this.auditLogPath);
      await fs.mkdir(auditDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create audit directory', error);
    }
  }
}