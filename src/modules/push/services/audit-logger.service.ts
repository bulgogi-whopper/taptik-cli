import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { PackageMetadata } from '../interfaces';

export enum AuditEventType {
  // Package operations
  PACKAGE_UPLOADED = 'PACKAGE_UPLOADED',
  PACKAGE_UPDATED = 'PACKAGE_UPDATED',
  PACKAGE_DELETED = 'PACKAGE_DELETED',
  PACKAGE_DOWNLOADED = 'PACKAGE_DOWNLOADED',
  PACKAGE_VISIBILITY_CHANGED = 'PACKAGE_VISIBILITY_CHANGED',

  // Security events
  AUTH_FAILED = 'AUTH_FAILED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  MALICIOUS_CONTENT_DETECTED = 'MALICIOUS_CONTENT_DETECTED',
  SENSITIVE_DATA_DETECTED = 'SENSITIVE_DATA_DETECTED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // System events
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  SANITIZATION_PERFORMED = 'SANITIZATION_PERFORMED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
}

export interface AuditLogEntry {
  id?: string;
  timestamp: Date;
  eventType: AuditEventType;
  userId?: string;
  packageId?: string;
  configId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
  duration?: number;
}

export interface SecurityContext {
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
}

@Injectable()
export class AuditLoggerService {
  private readonly logger = new Logger(AuditLoggerService.name);
  private readonly auditBuffer: AuditLogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  private readonly FLUSH_INTERVAL = 5000; // 5 seconds
  private readonly BUFFER_SIZE = 50;

  constructor(private readonly supabaseService: SupabaseService) {
    // Start auto-flush timer
    this.startAutoFlush();
  }

  /**
   * Log a package upload event
   */
  async logPackageUpload(
    userId: string,
    packageMetadata: PackageMetadata,
    securityContext: SecurityContext,
    duration: number,
    success: boolean,
    error?: Error,
  ): Promise<void> {
    const entry: AuditLogEntry = {
      timestamp: new Date(),
      eventType: success
        ? AuditEventType.PACKAGE_UPLOADED
        : AuditEventType.UPLOAD_FAILED,
      userId,
      packageId: packageMetadata.id,
      configId: packageMetadata.configId,
      ipAddress: securityContext.ipAddress,
      userAgent: securityContext.userAgent,
      metadata: {
        packageName: packageMetadata.name,
        platform: packageMetadata.platform,
        version: packageMetadata.version,
        size: packageMetadata.packageSize,
        isPublic: packageMetadata.isPublic,
        sanitizationLevel: packageMetadata.sanitizationLevel,
      },
      success,
      errorMessage: error?.message,
      duration,
    };

    await this.addToBuffer(entry);
  }

  /**
   * Log a package update event
   */
  async logPackageUpdate(
    userId: string,
    configId: string,
    changes: Record<string, unknown>,
    securityContext: SecurityContext,
  ): Promise<void> {
    const entry: AuditLogEntry = {
      timestamp: new Date(),
      eventType: AuditEventType.PACKAGE_UPDATED,
      userId,
      configId,
      ipAddress: securityContext.ipAddress,
      userAgent: securityContext.userAgent,
      metadata: {
        changes: this.sanitizeChanges(changes),
      },
      success: true,
    };

    await this.addToBuffer(entry);
  }

  /**
   * Log a package deletion event
   */
  async logPackageDeletion(
    userId: string,
    configId: string,
    packageName: string,
    securityContext: SecurityContext,
  ): Promise<void> {
    const entry: AuditLogEntry = {
      timestamp: new Date(),
      eventType: AuditEventType.PACKAGE_DELETED,
      userId,
      configId,
      ipAddress: securityContext.ipAddress,
      userAgent: securityContext.userAgent,
      metadata: {
        packageName,
        deletedAt: new Date().toISOString(),
      },
      success: true,
    };

    await this.addToBuffer(entry);
  }

  /**
   * Log a package download event
   */
  async logPackageDownload(
    userId: string | undefined,
    configId: string,
    securityContext: SecurityContext,
  ): Promise<void> {
    const entry: AuditLogEntry = {
      timestamp: new Date(),
      eventType: AuditEventType.PACKAGE_DOWNLOADED,
      userId,
      configId,
      ipAddress: securityContext.ipAddress,
      userAgent: securityContext.userAgent,
      metadata: {
        anonymous: !userId,
      },
      success: true,
    };

    await this.addToBuffer(entry);
  }

  /**
   * Log a visibility change event
   */
  async logVisibilityChange(
    userId: string,
    configId: string,
    fromPublic: boolean,
    toPublic: boolean,
    securityContext: SecurityContext,
  ): Promise<void> {
    const entry: AuditLogEntry = {
      timestamp: new Date(),
      eventType: AuditEventType.PACKAGE_VISIBILITY_CHANGED,
      userId,
      configId,
      ipAddress: securityContext.ipAddress,
      userAgent: securityContext.userAgent,
      metadata: {
        fromVisibility: fromPublic ? 'public' : 'private',
        toVisibility: toPublic ? 'public' : 'private',
      },
      success: true,
    };

    await this.addToBuffer(entry);
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(
    eventType: AuditEventType,
    userId: string | undefined,
    securityContext: SecurityContext,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const entry: AuditLogEntry = {
      timestamp: new Date(),
      eventType,
      userId,
      ipAddress: securityContext.ipAddress,
      userAgent: securityContext.userAgent,
      metadata: this.sanitizeMetadata(metadata),
      success: false,
    };

    await this.addToBuffer(entry);

    // Security events should be logged immediately
    if (this.isHighPriorityEvent(eventType)) {
      await this.flush();
    }
  }

  /**
   * Log an authentication failure
   */
  async logAuthFailure(
    attemptedUserId: string | undefined,
    securityContext: SecurityContext,
    reason: string,
  ): Promise<void> {
    await this.logSecurityEvent(
      AuditEventType.AUTH_FAILED,
      attemptedUserId,
      securityContext,
      { reason },
    );
  }

  /**
   * Log unauthorized access attempt
   */
  async logUnauthorizedAccess(
    userId: string | undefined,
    resource: string,
    action: string,
    securityContext: SecurityContext,
  ): Promise<void> {
    await this.logSecurityEvent(
      AuditEventType.UNAUTHORIZED_ACCESS,
      userId,
      securityContext,
      { resource, action },
    );
  }

  /**
   * Log malicious content detection
   */
  async logMaliciousContent(
    userId: string,
    configId: string | undefined,
    detectionType: string,
    securityContext: SecurityContext,
  ): Promise<void> {
    await this.logSecurityEvent(
      AuditEventType.MALICIOUS_CONTENT_DETECTED,
      userId,
      securityContext,
      {
        configId,
        detectionType,
        blocked: true,
      },
    );
  }

  /**
   * Query audit logs
   */
  async queryLogs(filters: {
    userId?: string;
    configId?: string;
    eventType?: AuditEventType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    try {
      const client = this.supabaseService.getClient();
      let query = client.from('audit_logs').select('*');

      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters.configId) {
        query = query.eq('config_id', filters.configId);
      }
      if (filters.eventType) {
        query = query.eq('event_type', filters.eventType);
      }
      if (filters.startDate) {
        query = query.gte('timestamp', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        query = query.lte('timestamp', filters.endDate.toISOString());
      }

      query = query.order('timestamp', { ascending: false });

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) {
        this.logger.error('Failed to query audit logs', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Error querying audit logs', error);
      return [];
    }
  }

  /**
   * Get security summary for a user
   */
  async getUserSecuritySummary(
    userId: string,
    days: number = 30,
  ): Promise<{
    totalEvents: number;
    securityEvents: number;
    failedAttempts: number;
    suspiciousActivities: number;
    lastSecurityEvent?: Date;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await this.queryLogs({
      userId,
      startDate,
    });

    const securityEventTypes = [
      AuditEventType.AUTH_FAILED,
      AuditEventType.UNAUTHORIZED_ACCESS,
      AuditEventType.MALICIOUS_CONTENT_DETECTED,
      AuditEventType.SENSITIVE_DATA_DETECTED,
      AuditEventType.RATE_LIMIT_EXCEEDED,
    ];

    const securityEvents = logs.filter((log) =>
      securityEventTypes.includes(log.eventType),
    );

    const failedEvents = logs.filter((log) => !log.success);

    return {
      totalEvents: logs.length,
      securityEvents: securityEvents.length,
      failedAttempts: failedEvents.length,
      suspiciousActivities: securityEvents.filter((e) =>
        [
          AuditEventType.MALICIOUS_CONTENT_DETECTED,
          AuditEventType.UNAUTHORIZED_ACCESS,
        ].includes(e.eventType),
      ).length,
      lastSecurityEvent:
        securityEvents.length > 0
          ? new Date(securityEvents[0].timestamp)
          : undefined,
    };
  }

  /**
   * Add entry to buffer and flush if needed
   */
  private async addToBuffer(entry: AuditLogEntry): Promise<void> {
    this.auditBuffer.push(entry);

    if (this.auditBuffer.length >= this.BUFFER_SIZE) {
      await this.flush();
    }
  }

  /**
   * Flush audit buffer to database
   */
  private async flush(): Promise<void> {
    if (this.auditBuffer.length === 0) {
      return;
    }

    const entriesToFlush = [...this.auditBuffer];
    this.auditBuffer.length = 0;

    try {
      const client = this.supabaseService.getClient();

      const { error } = await client.from('audit_logs').insert(
        entriesToFlush.map((entry) => ({
          timestamp: entry.timestamp,
          event_type: entry.eventType,
          user_id: entry.userId,
          package_id: entry.packageId,
          config_id: entry.configId,
          ip_address: entry.ipAddress,
          user_agent: entry.userAgent,
          metadata: entry.metadata,
          success: entry.success,
          error_message: entry.errorMessage,
          duration: entry.duration,
        })),
      );

      if (error) {
        this.logger.error('Failed to flush audit logs', error);
        // Re-add entries to buffer for retry
        this.auditBuffer.unshift(...entriesToFlush);
      } else {
        this.logger.debug(`Flushed ${entriesToFlush.length} audit log entries`);
      }
    } catch (error) {
      this.logger.error('Error flushing audit logs', error);
      // Re-add entries to buffer for retry
      this.auditBuffer.unshift(...entriesToFlush);
    }
  }

  /**
   * Start auto-flush timer
   */
  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch((error) =>
        this.logger.error('Auto-flush failed', error),
      );
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Check if event is high priority
   */
  private isHighPriorityEvent(eventType: AuditEventType): boolean {
    return [
      AuditEventType.MALICIOUS_CONTENT_DETECTED,
      AuditEventType.UNAUTHORIZED_ACCESS,
      AuditEventType.AUTH_FAILED,
    ].includes(eventType);
  }

  /**
   * Sanitize changes to remove sensitive data
   */
  private sanitizeChanges(
    changes: Record<string, unknown>,
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(changes)) {
      // Don't log sensitive field values
      if (['password', 'token', 'secret', 'apiKey'].includes(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize metadata to remove sensitive information
   */
  private sanitizeMetadata(
    metadata?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!metadata) return undefined;

    return this.sanitizeChanges(metadata);
  }

  /**
   * Clean up resources
   */
  onModuleDestroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Final flush
    this.flush().catch((error) =>
      this.logger.error('Final flush failed', error),
    );
  }
}
