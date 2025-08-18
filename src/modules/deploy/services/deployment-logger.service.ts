import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { Injectable } from '@nestjs/common';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import { DeployOptions } from '../interfaces/deploy-options.interface';
import { DeploymentResult } from '../interfaces/deployment-result.interface';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  AUDIT = 'AUDIT',
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  operation?: string;
  userId?: string;
  configId?: string;
  platform?: string;
  component?: string;
  duration?: number;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

export interface AuditEntry extends LogEntry {
  level: LogLevel.AUDIT;
  action: string;
  result: 'success' | 'failure';
  changes?: Record<string, unknown>;
  securityContext?: {
    hasApiKeys: boolean;
    filteredFields: string[];
    maliciousPatterns?: string[];
  };
}

@Injectable()
export class DeploymentLoggerService {
  private readonly logDir = path.join(os.homedir(), '.taptik', 'logs');
  private readonly auditDir = path.join(os.homedir(), '.taptik', 'audit');
  private readonly maxLogSize = 10 * 1024 * 1024; // 10MB
  private readonly maxLogAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  private currentLogFile: string;
  private currentAuditFile: string;

  constructor() {
    const date = new Date().toISOString().split('T')[0];
    this.currentLogFile = path.join(this.logDir, `deploy-${date}.log`);
    this.currentAuditFile = path.join(this.auditDir, `audit-${date}.log`);

    // Ensure directories exist
    this.ensureDirectories();
  }

  /**
   * Log deployment start
   */
  async logDeploymentStart(
    context: TaptikContext,
    options: DeployOptions,
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.INFO,
      message: 'Deployment started',
      operation: 'deployment_start',
      configId: context.metadata.title,
      platform: options.platform,
      context: {
        sourceIde: context.metadata.sourceIde,
        targetIdes: context.metadata.targetIdes,
        components: options.components,
        skipComponents: options.skipComponents,
        dryRun: options.dryRun,
        validateOnly: options.validateOnly,
        conflictStrategy: options.conflictStrategy,
      },
    };

    await this.writeLog(entry);
    await this.writeAudit({
      ...entry,
      level: LogLevel.AUDIT,
      action: 'DEPLOYMENT_INITIATED',
      result: 'success',
      securityContext: context.security,
    } as AuditEntry);
  }

  /**
   * Log deployment completion
   */
  async logDeploymentComplete(
    result: DeploymentResult,
    duration: number,
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: result.success ? LogLevel.INFO : LogLevel.ERROR,
      message: `Deployment ${result.success ? 'completed successfully' : 'failed'}`,
      operation: 'deployment_complete',
      platform: result.platform,
      duration,
      context: {
        deployedComponents: result.deployedComponents,
        filesDeployed: result.summary.filesDeployed,
        filesSkipped: result.summary.filesSkipped,
        conflictsResolved: result.summary.conflictsResolved,
        backupCreated: result.summary.backupCreated,
        errors: result.errors,
        warnings: result.warnings,
      },
    };

    await this.writeLog(entry);
    await this.writeAudit({
      ...entry,
      level: LogLevel.AUDIT,
      action: 'DEPLOYMENT_COMPLETED',
      result: result.success ? 'success' : 'failure',
      changes: {
        deployedComponents: result.deployedComponents,
        filesModified: result.summary.filesDeployed,
      },
    } as AuditEntry);
  }

  /**
   * Log component deployment
   */
  async logComponentDeployment(
    component: string,
    success: boolean,
    files: string[],
    errors?: string[],
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: success ? LogLevel.INFO : LogLevel.WARN,
      message: `Component '${component}' deployment ${success ? 'succeeded' : 'failed'}`,
      operation: 'component_deployment',
      component,
      context: {
        filesDeployed: files,
        fileCount: files.length,
        errors,
      },
    };

    await this.writeLog(entry);
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, unknown>,
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date(),
      level:
        severity === 'critical' || severity === 'high'
          ? LogLevel.ERROR
          : LogLevel.WARN,
      message: `Security event: ${event}`,
      operation: 'security_event',
      context: {
        severity,
        event,
        ...details,
      },
    };

    await this.writeLog(entry);
    await this.writeAudit({
      ...entry,
      level: LogLevel.AUDIT,
      action: 'SECURITY_EVENT',
      result: 'failure',
      securityContext: details as Record<string, unknown>,
    } as AuditEntry);
  }

  /**
   * Log error with full context
   */
  async logError(
    error: Error,
    context: Record<string, unknown> = {},
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.ERROR,
      message: error.message,
      operation: (context.operation as string) || 'error',
      context,
      error: {
        code:
          ((error as unknown as Record<string, unknown>).code as string) ||
          'UNKNOWN',
        message: error.message,
        stack: error.stack,
      },
    };

    await this.writeLog(entry);
  }

  /**
   * Log warning
   */
  async logWarning(
    message: string,
    context: Record<string, unknown> = {},
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.WARN,
      message,
      context,
    };

    await this.writeLog(entry);
  }

  /**
   * Log debug information
   */
  async logDebug(
    message: string,
    context: Record<string, unknown> = {},
  ): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      const entry: LogEntry = {
        timestamp: new Date(),
        level: LogLevel.DEBUG,
        message,
        context,
      };

      await this.writeLog(entry);
    }
  }

  /**
   * Log rollback operation
   */
  async logRollback(
    backupId: string,
    success: boolean,
    filesRestored: number,
    errors?: string[],
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: success ? LogLevel.INFO : LogLevel.ERROR,
      message: `Rollback ${success ? 'completed successfully' : 'failed'}`,
      operation: 'rollback',
      context: {
        backupId,
        filesRestored,
        errors,
      },
    };

    await this.writeLog(entry);
    await this.writeAudit({
      ...entry,
      level: LogLevel.AUDIT,
      action: 'ROLLBACK_EXECUTED',
      result: success ? 'success' : 'failure',
      changes: {
        filesRestored,
        backupId,
      },
    } as AuditEntry);
  }

  /**
   * Write log entry to file
   */
  private async writeLog(entry: LogEntry): Promise<void> {
    try {
      await this.ensureDirectories();

      // Format log entry
      const logLine = this.formatLogEntry(entry);

      // Check log rotation
      await this.rotateLogsIfNeeded();

      // Append to log file
      await fs.appendFile(this.currentLogFile, `${logLine}\n`, 'utf8');

      // Also log to console in development
      if (
        process.env.NODE_ENV !== 'production' ||
        entry.level === LogLevel.ERROR
      ) {
        this.logToConsole(entry);
      }
    } catch (error) {
      // Fallback to console if file writing fails
      console.error('Failed to write log:', error); // eslint-disable-line no-console
      this.logToConsole(entry);
    }
  }

  /**
   * Write audit entry to file
   */
  private async writeAudit(entry: AuditEntry): Promise<void> {
    try {
      await this.ensureDirectories();

      // Format audit entry as JSON for structured querying
      const auditLine = JSON.stringify({
        ...entry,
        timestamp: entry.timestamp.toISOString(),
      });

      // Append to audit file
      await fs.appendFile(this.currentAuditFile, `${auditLine}\n`, 'utf8');
    } catch (error) {
      console.error('Failed to write audit log:', error); // eslint-disable-line no-console
    }
  }

  /**
   * Format log entry for human-readable output
   */
  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.padEnd(5);
    const operation = entry.operation ? `[${entry.operation}]` : '';

    let message = `${timestamp} ${level} ${operation} ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      // Sanitize sensitive data
      const sanitizedContext = this.sanitizeContext(entry.context);
      message += ` | Context: ${JSON.stringify(sanitizedContext)}`;
    }

    if (entry.error) {
      message += ` | Error: ${entry.error.code} - ${entry.error.message}`;
    }

    if (entry.duration) {
      message += ` | Duration: ${entry.duration}ms`;
    }

    return message;
  }

  /**
   * Sanitize sensitive data from context
   */
  private sanitizeContext(
    context: Record<string, unknown>,
  ): Record<string, unknown> {
    const sensitiveKeys = ['password', 'apiKey', 'secret', 'token', 'auth'];
    const sanitized = { ...context };

    for (const key of Object.keys(sanitized)) {
      if (
        sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))
      ) {
        sanitized[key] = '[REDACTED]';
      } else if (
        typeof sanitized[key] === 'object' &&
        sanitized[key] !== null
      ) {
        sanitized[key] = this.sanitizeContext(
          sanitized[key] as Record<string, unknown>,
        );
      }
    }

    return sanitized;
  }

  /**
   * Log to console with color formatting
   */
  private logToConsole(entry: LogEntry): void {
    const colors = {
      DEBUG: '\x1B[36m', // Cyan
      INFO: '\x1B[32m', // Green
      WARN: '\x1B[33m', // Yellow
      ERROR: '\x1B[31m', // Red
      AUDIT: '\x1B[35m', // Magenta
    };
    const reset = '\x1B[0m';

    const color = colors[entry.level];
    const prefix = `${color}[${entry.level}]${reset}`;

    if (entry.level === LogLevel.ERROR) {
      console.error(prefix, entry.message, entry.context || ''); // eslint-disable-line no-console
    } else if (entry.level === LogLevel.WARN) {
      console.warn(prefix, entry.message, entry.context || ''); // eslint-disable-line no-console
    } else {
      console.log(prefix, entry.message, entry.context || ''); // eslint-disable-line no-console
    }
  }

  /**
   * Ensure log directories exist
   */
  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
      await fs.mkdir(this.auditDir, { recursive: true });
    } catch {
      // Directories might already exist
    }
  }

  /**
   * Rotate logs if needed
   */
  private async rotateLogsIfNeeded(): Promise<void> {
    try {
      const stats = await fs.stat(this.currentLogFile);

      // Rotate if file is too large
      if (stats.size > this.maxLogSize) {
        const timestamp = new Date().toISOString().replaceAll(/[.:]/g, '-');
        const rotatedFile = this.currentLogFile.replace(
          '.log',
          `-${timestamp}.log`,
        );
        await fs.rename(this.currentLogFile, rotatedFile);
      }
    } catch {
      // File might not exist yet
    }

    // Clean up old logs
    await this.cleanupOldLogs();
  }

  /**
   * Clean up logs older than retention period
   */
  private async cleanupOldLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.logDir);
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        const stats = await fs.stat(filePath); // eslint-disable-line no-await-in-loop

        if (now - stats.mtime.getTime() > this.maxLogAge) {
          await fs.unlink(filePath); // eslint-disable-line no-await-in-loop
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Get recent logs for debugging
   */
  async getRecentLogs(lines = 100): Promise<string[]> {
    try {
      const content = await fs.readFile(this.currentLogFile, 'utf8');
      const allLines = content.split('\n');
      return allLines.slice(-lines);
    } catch {
      return [];
    }
  }

  /**
   * Get audit trail for specific operation
   */
  async getAuditTrail(configId?: string, limit = 100): Promise<AuditEntry[]> {
    try {
      const content = await fs.readFile(this.currentAuditFile, 'utf8');
      const lines = content.split('\n').filter((line) => line.trim());

      const entries: AuditEntry[] = lines
        .map((line) => {
          try {
            return JSON.parse(line) as AuditEntry;
          } catch {
            return null;
          }
        })
        .filter((entry) => entry !== null)
        .filter((entry) => !configId || entry.configId === configId)
        .slice(-limit);

      return entries;
    } catch {
      return [];
    }
  }
}
