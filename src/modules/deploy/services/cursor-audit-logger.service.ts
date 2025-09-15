import { Injectable, Logger } from '@nestjs/common';

import { AuditLoggerService, AuditEventType, SecurityContext, AuditLogEntry } from '../../push/services/audit-logger.service';

import { CursorSecurityViolation } from './cursor-security-scanner.service';

export enum CursorAuditEventType {
  // Cursor deployment events
  CURSOR_DEPLOYMENT_STARTED = 'CURSOR_DEPLOYMENT_STARTED',
  CURSOR_DEPLOYMENT_COMPLETED = 'CURSOR_DEPLOYMENT_COMPLETED',
  CURSOR_DEPLOYMENT_FAILED = 'CURSOR_DEPLOYMENT_FAILED',
  CURSOR_COMPONENT_DEPLOYED = 'CURSOR_COMPONENT_DEPLOYED',
  CURSOR_COMPONENT_SKIPPED = 'CURSOR_COMPONENT_SKIPPED',
  CURSOR_COMPONENT_QUARANTINED = 'CURSOR_COMPONENT_QUARANTINED',

  // Cursor security events
  CURSOR_SECURITY_SCAN_STARTED = 'CURSOR_SECURITY_SCAN_STARTED',
  CURSOR_SECURITY_SCAN_COMPLETED = 'CURSOR_SECURITY_SCAN_COMPLETED',
  CURSOR_SECURITY_VIOLATION_DETECTED = 'CURSOR_SECURITY_VIOLATION_DETECTED',
  CURSOR_AI_INJECTION_BLOCKED = 'CURSOR_AI_INJECTION_BLOCKED',
  CURSOR_DANGEROUS_TASK_BLOCKED = 'CURSOR_DANGEROUS_TASK_BLOCKED',
  CURSOR_UNSAFE_EXTENSION_BLOCKED = 'CURSOR_UNSAFE_EXTENSION_BLOCKED',
  CURSOR_SENSITIVE_DATA_DETECTED = 'CURSOR_SENSITIVE_DATA_DETECTED',

  // Cursor file operations
  CURSOR_FILE_BACKUP_CREATED = 'CURSOR_FILE_BACKUP_CREATED',
  CURSOR_FILE_RESTORED = 'CURSOR_FILE_RESTORED',
  CURSOR_CONFLICT_RESOLVED = 'CURSOR_CONFLICT_RESOLVED',
  CURSOR_ROLLBACK_PERFORMED = 'CURSOR_ROLLBACK_PERFORMED',

  // Cursor validation events
  CURSOR_VALIDATION_STARTED = 'CURSOR_VALIDATION_STARTED',
  CURSOR_VALIDATION_COMPLETED = 'CURSOR_VALIDATION_COMPLETED',
  CURSOR_VALIDATION_FAILED = 'CURSOR_VALIDATION_FAILED',
  CURSOR_TRANSFORMATION_STARTED = 'CURSOR_TRANSFORMATION_STARTED',
  CURSOR_TRANSFORMATION_COMPLETED = 'CURSOR_TRANSFORMATION_COMPLETED',
  CURSOR_TRANSFORMATION_FAILED = 'CURSOR_TRANSFORMATION_FAILED',
}

export interface CursorAuditLogEntry {
  id?: string;
  timestamp: Date;
  eventType: CursorAuditEventType;
  userId?: string;
  configId?: string;
  deploymentId?: string;
  componentType?: string;
  componentName?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
  duration?: number;
  securityViolations?: CursorSecurityViolation[];
}

export interface CursorDeploymentContext {
  deploymentId: string;
  configId: string;
  userId?: string;
  platform: 'cursor-ide';
  components: string[];
  options: Record<string, unknown>;
  securityContext: SecurityContext;
}

@Injectable()
export class CursorAuditLoggerService {
  private readonly logger = new Logger(CursorAuditLoggerService.name);

  constructor(private readonly auditLogger: AuditLoggerService) {}

  /**
   * Log Cursor deployment start
   */
  async logDeploymentStart(
    context: CursorDeploymentContext,
    startTime: Date,
  ): Promise<void> {
    const entry: CursorAuditLogEntry = {
      timestamp: startTime,
      eventType: CursorAuditEventType.CURSOR_DEPLOYMENT_STARTED,
      userId: context.userId,
      configId: context.configId,
      deploymentId: context.deploymentId,
      ipAddress: context.securityContext.ipAddress,
      userAgent: context.securityContext.userAgent,
      metadata: {
        platform: context.platform,
        components: context.components,
        options: this.sanitizeOptions(context.options),
        startTime: startTime.toISOString(),
      },
      success: true,
    };

    await this.logCursorEvent(entry);
    this.logger.log(`Cursor deployment started: ${context.deploymentId}`);
  }

  /**
   * Log Cursor deployment completion
   */
  async logDeploymentComplete(
    context: CursorDeploymentContext,
    startTime: Date,
    endTime: Date,
    deployedComponents: string[],
    skippedComponents: string[],
  ): Promise<void> {
    const duration = endTime.getTime() - startTime.getTime();

    const entry: CursorAuditLogEntry = {
      timestamp: endTime,
      eventType: CursorAuditEventType.CURSOR_DEPLOYMENT_COMPLETED,
      userId: context.userId,
      configId: context.configId,
      deploymentId: context.deploymentId,
      ipAddress: context.securityContext.ipAddress,
      userAgent: context.securityContext.userAgent,
      metadata: {
        platform: context.platform,
        deployedComponents,
        skippedComponents,
        totalComponents: context.components.length,
        deployedCount: deployedComponents.length,
        skippedCount: skippedComponents.length,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
      success: true,
      duration,
    };

    await this.logCursorEvent(entry);
    this.logger.log(
      `Cursor deployment completed: ${context.deploymentId} (${deployedComponents.length}/${context.components.length} components deployed)`,
    );
  }

  /**
   * Log Cursor deployment failure
   */
  async logDeploymentFailure(
    context: CursorDeploymentContext,
    startTime: Date,
    endTime: Date,
    error: Error,
    partiallyDeployedComponents?: string[],
  ): Promise<void> {
    const duration = endTime.getTime() - startTime.getTime();

    const entry: CursorAuditLogEntry = {
      timestamp: endTime,
      eventType: CursorAuditEventType.CURSOR_DEPLOYMENT_FAILED,
      userId: context.userId,
      configId: context.configId,
      deploymentId: context.deploymentId,
      ipAddress: context.securityContext.ipAddress,
      userAgent: context.securityContext.userAgent,
      metadata: {
        platform: context.platform,
        partiallyDeployedComponents: partiallyDeployedComponents || [],
        totalComponents: context.components.length,
        errorType: error.constructor.name,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
      success: false,
      errorMessage: error.message,
      duration,
    };

    await this.logCursorEvent(entry);
    this.logger.error(
      `Cursor deployment failed: ${context.deploymentId} - ${error.message}`,
    );
  }

  /**
   * Log component deployment
   */
  async logComponentDeployment(
    context: CursorDeploymentContext,
    componentType: string,
    componentName: string,
    success: boolean,
    duration: number,
    error?: Error,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const entry: CursorAuditLogEntry = {
      timestamp: new Date(),
      eventType: success
        ? CursorAuditEventType.CURSOR_COMPONENT_DEPLOYED
        : CursorAuditEventType.CURSOR_COMPONENT_SKIPPED,
      userId: context.userId,
      configId: context.configId,
      deploymentId: context.deploymentId,
      componentType,
      componentName,
      ipAddress: context.securityContext.ipAddress,
      userAgent: context.securityContext.userAgent,
      metadata: {
        ...metadata,
        componentType,
        componentName,
      },
      success,
      errorMessage: error?.message,
      duration,
    };

    await this.logCursorEvent(entry);

    if (success) {
      this.logger.debug(
        `Component deployed: ${componentType}/${componentName} (${duration}ms)`,
      );
    } else {
      this.logger.warn(
        `Component skipped: ${componentType}/${componentName} - ${error?.message}`,
      );
    }
  }

  /**
   * Log security scan start
   */
  async logSecurityScanStart(
    context: CursorDeploymentContext,
    scanStartTime: Date,
  ): Promise<void> {
    const entry: CursorAuditLogEntry = {
      timestamp: scanStartTime,
      eventType: CursorAuditEventType.CURSOR_SECURITY_SCAN_STARTED,
      userId: context.userId,
      configId: context.configId,
      deploymentId: context.deploymentId,
      ipAddress: context.securityContext.ipAddress,
      userAgent: context.securityContext.userAgent,
      metadata: {
        scanStartTime: scanStartTime.toISOString(),
        components: context.components,
      },
      success: true,
    };

    await this.logCursorEvent(entry);
    this.logger.debug(`Security scan started for deployment: ${context.deploymentId}`);
  }

  /**
   * Log security scan completion
   */
  async logSecurityScanComplete(
    context: CursorDeploymentContext,
    scanStartTime: Date,
    scanEndTime: Date,
    violations: CursorSecurityViolation[],
    quarantinedComponents: string[],
  ): Promise<void> {
    const duration = scanEndTime.getTime() - scanStartTime.getTime();

    const entry: CursorAuditLogEntry = {
      timestamp: scanEndTime,
      eventType: CursorAuditEventType.CURSOR_SECURITY_SCAN_COMPLETED,
      userId: context.userId,
      configId: context.configId,
      deploymentId: context.deploymentId,
      ipAddress: context.securityContext.ipAddress,
      userAgent: context.securityContext.userAgent,
      metadata: {
        scanStartTime: scanStartTime.toISOString(),
        scanEndTime: scanEndTime.toISOString(),
        totalViolations: violations.length,
        criticalViolations: violations.filter((v) => v.severity === 'critical').length,
        highViolations: violations.filter((v) => v.severity === 'high').length,
        mediumViolations: violations.filter((v) => v.severity === 'medium').length,
        lowViolations: violations.filter((v) => v.severity === 'low').length,
        quarantinedComponents,
        violationTypes: [...new Set(violations.map((v) => v.violationType))],
      },
      success: true,
      duration,
      securityViolations: violations,
    };

    await this.logCursorEvent(entry);

    if (violations.length > 0) {
      this.logger.warn(
        `Security scan completed with ${violations.length} violations (${quarantinedComponents.length} components quarantined)`,
      );
    } else {
      this.logger.log(`Security scan completed - no violations detected`);
    }
  }

  /**
   * Log security violation detection
   */
  async logSecurityViolation(
    context: CursorDeploymentContext,
    violation: CursorSecurityViolation,
    blocked: boolean,
  ): Promise<void> {
    let eventType: CursorAuditEventType;

    switch (violation.violationType) {
      case 'ai_prompt_injection':
        eventType = CursorAuditEventType.CURSOR_AI_INJECTION_BLOCKED;
        break;
      case 'dangerous_task':
        eventType = CursorAuditEventType.CURSOR_DANGEROUS_TASK_BLOCKED;
        break;
      case 'unsafe_extension':
        eventType = CursorAuditEventType.CURSOR_UNSAFE_EXTENSION_BLOCKED;
        break;
      case 'sensitive_data':
        eventType = CursorAuditEventType.CURSOR_SENSITIVE_DATA_DETECTED;
        break;
      default:
        eventType = CursorAuditEventType.CURSOR_SECURITY_VIOLATION_DETECTED;
    }

    const entry: CursorAuditLogEntry = {
      timestamp: new Date(),
      eventType,
      userId: context.userId,
      configId: context.configId,
      deploymentId: context.deploymentId,
      componentType: violation.componentType,
      componentName: violation.component,
      ipAddress: context.securityContext.ipAddress,
      userAgent: context.securityContext.userAgent,
      metadata: {
        violationType: violation.violationType,
        severity: violation.severity,
        description: violation.description,
        recommendation: violation.recommendation,
        quarantined: violation.quarantined,
        blocked,
      },
      success: !blocked,
      securityViolations: [violation],
    };

    await this.logCursorEvent(entry);

    // Also log to the main audit logger for security events
    await this.auditLogger.logSecurityEvent(
      AuditEventType.MALICIOUS_CONTENT_DETECTED,
      context.userId,
      context.securityContext,
      {
        platform: 'cursor-ide',
        deploymentId: context.deploymentId,
        componentType: violation.componentType,
        componentName: violation.component,
        violationType: violation.violationType,
        severity: violation.severity,
        blocked,
      },
    );

    if (blocked) {
      this.logger.error(
        `Security violation blocked: ${violation.violationType} in ${violation.componentType}/${violation.component}`,
      );
    } else {
      this.logger.warn(
        `Security violation detected: ${violation.violationType} in ${violation.componentType}/${violation.component}`,
      );
    }
  }

  /**
   * Log component quarantine
   */
  async logComponentQuarantine(
    context: CursorDeploymentContext,
    componentType: string,
    componentName: string,
    violations: CursorSecurityViolation[],
  ): Promise<void> {
    const entry: CursorAuditLogEntry = {
      timestamp: new Date(),
      eventType: CursorAuditEventType.CURSOR_COMPONENT_QUARANTINED,
      userId: context.userId,
      configId: context.configId,
      deploymentId: context.deploymentId,
      componentType,
      componentName,
      ipAddress: context.securityContext.ipAddress,
      userAgent: context.securityContext.userAgent,
      metadata: {
        componentType,
        componentName,
        violationCount: violations.length,
        violationTypes: [...new Set(violations.map((v) => v.violationType))],
        severities: [...new Set(violations.map((v) => v.severity))],
      },
      success: false,
      securityViolations: violations,
    };

    await this.logCursorEvent(entry);
    this.logger.warn(
      `Component quarantined: ${componentType}/${componentName} (${violations.length} violations)`,
    );
  }

  /**
   * Log file backup creation
   */
  async logFileBackup(
    context: CursorDeploymentContext,
    filePath: string,
    backupPath: string,
    success: boolean,
    error?: Error,
  ): Promise<void> {
    const entry: CursorAuditLogEntry = {
      timestamp: new Date(),
      eventType: CursorAuditEventType.CURSOR_FILE_BACKUP_CREATED,
      userId: context.userId,
      configId: context.configId,
      deploymentId: context.deploymentId,
      ipAddress: context.securityContext.ipAddress,
      userAgent: context.securityContext.userAgent,
      metadata: {
        filePath: this.sanitizeFilePath(filePath),
        backupPath: this.sanitizeFilePath(backupPath),
      },
      success,
      errorMessage: error?.message,
    };

    await this.logCursorEvent(entry);

    if (success) {
      this.logger.debug(`File backup created: ${filePath} -> ${backupPath}`);
    } else {
      this.logger.error(`File backup failed: ${filePath} - ${error?.message}`);
    }
  }

  /**
   * Log conflict resolution
   */
  async logConflictResolution(
    context: CursorDeploymentContext,
    filePath: string,
    strategy: string,
    success: boolean,
    error?: Error,
  ): Promise<void> {
    const entry: CursorAuditLogEntry = {
      timestamp: new Date(),
      eventType: CursorAuditEventType.CURSOR_CONFLICT_RESOLVED,
      userId: context.userId,
      configId: context.configId,
      deploymentId: context.deploymentId,
      ipAddress: context.securityContext.ipAddress,
      userAgent: context.securityContext.userAgent,
      metadata: {
        filePath: this.sanitizeFilePath(filePath),
        strategy,
      },
      success,
      errorMessage: error?.message,
    };

    await this.logCursorEvent(entry);

    if (success) {
      this.logger.debug(`Conflict resolved: ${filePath} (strategy: ${strategy})`);
    } else {
      this.logger.error(`Conflict resolution failed: ${filePath} - ${error?.message}`);
    }
  }

  /**
   * Log rollback operation
   */
  async logRollback(
    context: CursorDeploymentContext,
    reason: string,
    restoredFiles: string[],
    success: boolean,
    error?: Error,
  ): Promise<void> {
    const entry: CursorAuditLogEntry = {
      timestamp: new Date(),
      eventType: CursorAuditEventType.CURSOR_ROLLBACK_PERFORMED,
      userId: context.userId,
      configId: context.configId,
      deploymentId: context.deploymentId,
      ipAddress: context.securityContext.ipAddress,
      userAgent: context.securityContext.userAgent,
      metadata: {
        reason,
        restoredFiles: restoredFiles.map((f) => this.sanitizeFilePath(f)),
        restoredCount: restoredFiles.length,
      },
      success,
      errorMessage: error?.message,
    };

    await this.logCursorEvent(entry);

    if (success) {
      this.logger.warn(`Rollback completed: ${reason} (${restoredFiles.length} files restored)`);
    } else {
      this.logger.error(`Rollback failed: ${reason} - ${error?.message}`);
    }
  }

  /**
   * Log validation events
   */
  async logValidation(
    context: CursorDeploymentContext,
    eventType: CursorAuditEventType,
    duration?: number,
    success: boolean = true,
    error?: Error,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const entry: CursorAuditLogEntry = {
      timestamp: new Date(),
      eventType,
      userId: context.userId,
      configId: context.configId,
      deploymentId: context.deploymentId,
      ipAddress: context.securityContext.ipAddress,
      userAgent: context.securityContext.userAgent,
      metadata,
      success,
      errorMessage: error?.message,
      duration,
    };

    await this.logCursorEvent(entry);

    const operation = eventType.replace('CURSOR_', '').replace('_', ' ').toLowerCase();
    if (success) {
      this.logger.debug(`${operation} completed${duration ? ` (${duration}ms)` : ''}`);
    } else {
      this.logger.error(`${operation} failed - ${error?.message}`);
    }
  }

  /**
   * Query Cursor audit logs
   */
  async queryCursorLogs(filters: {
    userId?: string;
    configId?: string;
    deploymentId?: string;
    eventType?: CursorAuditEventType;
    componentType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<CursorAuditLogEntry[]> {
    // This would typically query a dedicated Cursor audit log table
    // For now, we'll use the main audit logger with cursor-specific filters
    const mainFilters = {
      userId: filters.userId,
      configId: filters.configId,
      startDate: filters.startDate,
      endDate: filters.endDate,
      limit: filters.limit,
    };

    const logs = await this.auditLogger.queryLogs(mainFilters);

    // Filter for Cursor-specific events
    return logs
      .filter((log) => {
        const metadata = log.metadata as any;
        return metadata?.platform === 'cursor-ide' || 
               metadata?.deploymentId === filters.deploymentId ||
               (filters.componentType && metadata?.componentType === filters.componentType);
      })
      .map((log) => this.convertToCursorLogEntry(log));
  }

  /**
   * Get deployment summary
   */
  async getDeploymentSummary(deploymentId: string): Promise<{
    deploymentId: string;
    status: 'started' | 'completed' | 'failed';
    startTime?: Date;
    endTime?: Date;
    duration?: number;
    componentsDeployed: number;
    componentsSkipped: number;
    securityViolations: number;
    quarantinedComponents: number;
    errors: string[];
  }> {
    const logs = await this.queryCursorLogs({ deploymentId });

    const startLog = logs.find((l) => l.eventType === CursorAuditEventType.CURSOR_DEPLOYMENT_STARTED);
    const endLog = logs.find((l) => 
      l.eventType === CursorAuditEventType.CURSOR_DEPLOYMENT_COMPLETED ||
      l.eventType === CursorAuditEventType.CURSOR_DEPLOYMENT_FAILED
    );

    const componentLogs = logs.filter((l) => 
      l.eventType === CursorAuditEventType.CURSOR_COMPONENT_DEPLOYED ||
      l.eventType === CursorAuditEventType.CURSOR_COMPONENT_SKIPPED
    );

    const securityLogs = logs.filter((l) => 
      l.eventType === CursorAuditEventType.CURSOR_SECURITY_VIOLATION_DETECTED ||
      l.eventType === CursorAuditEventType.CURSOR_AI_INJECTION_BLOCKED ||
      l.eventType === CursorAuditEventType.CURSOR_DANGEROUS_TASK_BLOCKED ||
      l.eventType === CursorAuditEventType.CURSOR_UNSAFE_EXTENSION_BLOCKED ||
      l.eventType === CursorAuditEventType.CURSOR_SENSITIVE_DATA_DETECTED
    );

    const quarantineLogs = logs.filter((l) => 
      l.eventType === CursorAuditEventType.CURSOR_COMPONENT_QUARANTINED
    );

    const errorLogs = logs.filter((l) => !l.success);

    let status: 'started' | 'completed' | 'failed' = 'started';
    if (endLog) {
      status = endLog.eventType === CursorAuditEventType.CURSOR_DEPLOYMENT_COMPLETED 
        ? 'completed' 
        : 'failed';
    }

    return {
      deploymentId,
      status,
      startTime: startLog?.timestamp,
      endTime: endLog?.timestamp,
      duration: startLog && endLog 
        ? endLog.timestamp.getTime() - startLog.timestamp.getTime()
        : undefined,
      componentsDeployed: componentLogs.filter((l) => 
        l.eventType === CursorAuditEventType.CURSOR_COMPONENT_DEPLOYED
      ).length,
      componentsSkipped: componentLogs.filter((l) => 
        l.eventType === CursorAuditEventType.CURSOR_COMPONENT_SKIPPED
      ).length,
      securityViolations: securityLogs.length,
      quarantinedComponents: quarantineLogs.length,
      errors: errorLogs.map((l) => l.errorMessage || 'Unknown error'),
    };
  }

  /**
   * Log Cursor event to the main audit logger
   */
  private async logCursorEvent(entry: CursorAuditLogEntry): Promise<void> {
    // Convert to main audit log format and log
    // This ensures all Cursor events are also captured in the main audit trail
    const mainEventType = this.mapToMainEventType(entry.eventType);
    
    if (mainEventType) {
      await this.auditLogger.logSecurityEvent(
        mainEventType,
        entry.userId,
        {
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
        {
          platform: 'cursor-ide',
          cursorEventType: entry.eventType,
          deploymentId: entry.deploymentId,
          componentType: entry.componentType,
          componentName: entry.componentName,
          ...entry.metadata,
        },
      );
    }
  }

  /**
   * Map Cursor event types to main audit event types
   */
  private mapToMainEventType(cursorEventType: CursorAuditEventType): AuditEventType | null {
    switch (cursorEventType) {
      case CursorAuditEventType.CURSOR_AI_INJECTION_BLOCKED:
      case CursorAuditEventType.CURSOR_DANGEROUS_TASK_BLOCKED:
      case CursorAuditEventType.CURSOR_UNSAFE_EXTENSION_BLOCKED:
      case CursorAuditEventType.CURSOR_SECURITY_VIOLATION_DETECTED:
        return AuditEventType.MALICIOUS_CONTENT_DETECTED;
      case CursorAuditEventType.CURSOR_SENSITIVE_DATA_DETECTED:
        return AuditEventType.SENSITIVE_DATA_DETECTED;
      default:
        return null; // Don't map deployment events to main audit events
    }
  }

  /**
   * Convert main audit log entry to Cursor format
   */
  private convertToCursorLogEntry(log: AuditLogEntry): CursorAuditLogEntry {
    return {
      id: log.id,
      timestamp: new Date(log.timestamp),
      eventType: log.metadata?.cursorEventType as any || CursorAuditEventType.CURSOR_DEPLOYMENT_STARTED,
      userId: log.userId,
      configId: log.configId,
      deploymentId: log.metadata?.deploymentId as any,
      componentType: log.metadata?.componentType as any,
      componentName: log.metadata?.componentName as any,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: log.metadata,
      success: log.success,
      errorMessage: log.errorMessage,
      duration: log.duration,
    };
  }

  /**
   * Sanitize file paths to remove sensitive information
   */
  private sanitizeFilePath(filePath: string): string {
    // Replace user home directory with ~
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    if (homeDir && filePath.startsWith(homeDir)) {
      return filePath.replace(homeDir, '~');
    }
    return filePath;
  }

  /**
   * Sanitize deployment options to remove sensitive data
   */
  private sanitizeOptions(options: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(options)) {
      // Don't log sensitive option values
      if (['password', 'token', 'secret', 'apikey', 'auth'].some(s => 
        key.toLowerCase().includes(s.toLowerCase())
      )) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}