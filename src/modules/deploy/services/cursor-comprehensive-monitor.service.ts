import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import { Injectable, Logger } from '@nestjs/common';

import { CursorAuditLoggerService, CursorAuditEntry, CursorAuditStats } from './cursor-audit-logger.service';
import { CursorDeploymentError, CursorErrorContext } from '../errors/cursor-deployment.error';
import { CursorAISecurityScanResult } from './cursor-security-enforcer.service';
import { DeploymentResult } from '../interfaces/deployment-result.interface';
import { PerformanceMonitorService, DeploymentMetrics, PerformanceViolation } from './performance-monitor.service';

export interface CursorPerformanceMetrics {
  deploymentId: string;
  timestamp: string;
  platform: 'cursor';
  userId?: string;
  configId?: string;
  workspacePath?: string;
  
  // Deployment status
  deploymentStatus: 'in_progress' | 'success' | 'failed' | 'partial_success';
  deploymentErrors: Array<{
    code: string;
    message: string;
    component?: string;
    recoverable: boolean;
  }>;
  
  // Timing metrics
  totalDuration: number;
  transformationTime: number;
  validationTime: number;
  securityScanTime: number;
  fileWriteTime: number;
  rollbackTime?: number;
  
  // Resource metrics
  peakMemoryUsage: number;
  averageMemoryUsage: number;
  diskSpaceUsed: number;
  
  // Component metrics
  componentMetrics: Array<{
    type: string;
    name: string;
    size: number;
    processingTime: number;
    status: 'success' | 'failed' | 'skipped' | 'rolled_back';
    errorCode?: string;
    retryCount?: number;
  }>;
  
  // Security metrics
  securityViolations: number;
  securityWarnings: number;
  securityScore: number; // 0-100
  
  // Quality metrics
  configurationScore: number; // 0-100
  complexityScore: number;
  trustScore: number;
  
  // Success/failure metrics
  successMetrics: {
    totalComponents: number;
    successfulComponents: number;
    failedComponents: number;
    skippedComponents: number;
    rolledBackComponents: number;
    successRate: number; // percentage
    recoveryAttempts: number;
    successfulRecoveries: number;
  };
}

export interface CursorDeploymentReport {
  deploymentId: string;
  timestamp: string;
  success: boolean;
  
  // Summary
  summary: {
    totalComponents: number;
    successfulComponents: number;
    failedComponents: number;
    duration: number;
    securityScore: number;
  };
  
  // Details
  components: Array<{
    type: string;
    name: string;
    status: 'success' | 'failed' | 'skipped';
    duration: number;
    size: number;
    issues?: string[];
  }>;
  
  // Security analysis
  security: {
    overallScore: number;
    violations: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high';
      message: string;
      component?: string;
    }>;
    recommendations: string[];
  };
  
  // Performance analysis
  performance: {
    score: number; // 0-100
    bottlenecks: Array<{
      component: string;
      issue: string;
      impact: 'low' | 'medium' | 'high';
    }>;
    resourceUsage: {
      memory: { peak: number; average: number };
      disk: { used: number; available: number };
      cpu: { usage: number };
    };
  };
  
  // Recommendations
  recommendations: Array<{
    category: 'performance' | 'security' | 'configuration';
    priority: 'low' | 'medium' | 'high';
    message: string;
    action?: string;
  }>;
}

export interface CursorTrendAnalysis {
  period: string; // 'daily' | 'weekly' | 'monthly'
  dateRange: { start: string; end: string };
  
  // Deployment trends
  deploymentTrends: {
    totalDeployments: number;
    successRate: number;
    averageDuration: number;
    trendDirection: 'improving' | 'stable' | 'declining';
  };
  
  // Performance trends
  performanceTrends: {
    averageSecurityScore: number;
    averagePerformanceScore: number;
    commonBottlenecks: Array<{ issue: string; frequency: number }>;
    memoryUsageTrend: Array<{ date: string; usage: number }>;
  };
  
  // Error analysis
  errorAnalysis: {
    mostCommonErrors: Array<{ code: string; count: number; trend: 'up' | 'down' | 'stable' }>;
    errorsByComponent: Array<{ component: string; errorCount: number }>;
    recoveryRate: number;
  };
  
  // User activity
  userActivity: {
    activeUsers: number;
    deploymentsPerUser: number;
    mostActiveWorkspaces: Array<{ path: string; deployments: number }>;
  };
}

export interface CursorAlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  
  // Conditions
  conditions: {
    metric: string;
    operator: '>' | '<' | '==' | '!=' | '>=' | '<=';
    threshold: number;
    timeWindow?: number; // minutes
  };
  
  // Actions
  actions: {
    log: boolean;
    email?: string[];
    webhook?: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
  };
}

@Injectable()
export class CursorComprehensiveMonitor {
  private readonly logger = new Logger(CursorComprehensiveMonitor.name);
  private readonly metricsPath: string;
  private readonly reportsPath: string;
  private readonly alertRules: Map<string, CursorAlertRule> = new Map();

  constructor(
    private readonly auditLogger: CursorAuditLoggerService,
    private readonly performanceMonitor: PerformanceMonitorService,
  ) {
    const monitorDir = path.join(os.homedir(), '.taptik', 'monitor', 'cursor');
    this.metricsPath = path.join(monitorDir, 'metrics');
    this.reportsPath = path.join(monitorDir, 'reports');
    this.initializeMonitoring();
  }

  /**
   * Start monitoring a Cursor deployment
   */
  async startDeploymentMonitoring(
    deploymentId: string,
    context: CursorErrorContext,
    components: string[],
  ): Promise<void> {
    const startTime = Date.now();
    
    // Initialize performance monitoring
    await this.performanceMonitor.startDeploymentMetrics(deploymentId);
    
    // Log deployment start with enhanced metrics
    await this.auditLogger.logDeploymentStart(
      context.configId || deploymentId,
      context.workspacePath || 'unknown',
      components,
      context.userId,
    );
    
    // Record initial metrics
    const initialMetrics: CursorPerformanceMetrics = {
      deploymentId,
      timestamp: new Date().toISOString(),
      platform: 'cursor',
      userId: context.userId,
      configId: context.configId,
      workspacePath: context.workspacePath,
      deploymentStatus: 'in_progress',
      deploymentErrors: [],
      totalDuration: 0,
      transformationTime: 0,
      validationTime: 0,
      securityScanTime: 0,
      fileWriteTime: 0,
      peakMemoryUsage: process.memoryUsage().heapUsed,
      averageMemoryUsage: process.memoryUsage().heapUsed,
      diskSpaceUsed: 0,
      componentMetrics: [],
      securityViolations: 0,
      securityWarnings: 0,
      securityScore: 100,
      configurationScore: 100,
      complexityScore: 0,
      trustScore: 100,
      successMetrics: {
        totalComponents: components.length,
        successfulComponents: 0,
        failedComponents: 0,
        skippedComponents: 0,
        rolledBackComponents: 0,
        successRate: 0,
        recoveryAttempts: 0,
        successfulRecoveries: 0,
      },
    };
    
    await this.recordMetrics(initialMetrics);
    
    this.logger.log(`Started monitoring deployment: ${deploymentId}`);
  }

  /**
   * Record component processing metrics
   */
  async recordComponentMetrics(
    deploymentId: string,
    componentType: string,
    componentName: string,
    metrics: {
      size: number;
      processingTime: number;
      status: 'success' | 'failed' | 'skipped' | 'rolled_back';
      errorCode?: string;
      retryCount?: number;
      issues?: string[];
    },
  ): Promise<void> {
    const componentMetric = {
      type: componentType,
      name: componentName,
      size: metrics.size,
      processingTime: metrics.processingTime,
      status: metrics.status,
      errorCode: metrics.errorCode,
      retryCount: metrics.retryCount || 0,
    };
    
    // Update stored metrics
    await this.updateDeploymentMetrics(deploymentId, (current) => {
      current.componentMetrics.push(componentMetric);
      
      // Update success metrics
      switch (metrics.status) {
        case 'success':
          current.successMetrics.successfulComponents++;
          break;
        case 'failed':
          current.successMetrics.failedComponents++;
          if (metrics.errorCode) {
            current.deploymentErrors.push({
              code: metrics.errorCode,
              message: metrics.issues?.[0] || 'Component processing failed',
              component: componentName,
              recoverable: metrics.retryCount ? metrics.retryCount > 0 : false,
            });
          }
          break;
        case 'skipped':
          current.successMetrics.skippedComponents++;
          break;
        case 'rolled_back':
          current.successMetrics.rolledBackComponents++;
          break;
      }
      
      // Update success rate
      const processedComponents = current.successMetrics.successfulComponents + 
                                  current.successMetrics.failedComponents;
      if (processedComponents > 0) {
        current.successMetrics.successRate = 
          (current.successMetrics.successfulComponents / processedComponents) * 100;
      }
      
      // Update timing
      switch (componentType) {
        case 'transformation':
          current.transformationTime += metrics.processingTime;
          break;
        case 'validation':
          current.validationTime += metrics.processingTime;
          break;
        case 'security':
          current.securityScanTime += metrics.processingTime;
          break;
        case 'filewrite':
          current.fileWriteTime += metrics.processingTime;
          break;
        case 'rollback':
          current.rollbackTime = (current.rollbackTime || 0) + metrics.processingTime;
          break;
      }
      
      return current;
    });

    this.logger.debug(`Recorded component metrics: ${componentType}/${componentName} (${metrics.processingTime}ms) - ${metrics.status}`);
  }

  /**
   * Record deployment error and recovery attempts
   */
  async recordDeploymentError(
    deploymentId: string,
    error: CursorDeploymentError,
    recoveryAttempted: boolean = false,
    recoverySuccessful: boolean = false,
  ): Promise<void> {
    await this.updateDeploymentMetrics(deploymentId, (current) => {
      // Add error to deployment errors
      current.deploymentErrors.push({
        code: error.code,
        message: error.message,
        component: error.component,
        recoverable: error.isAutoRecoverable(),
      });
      
      // Update recovery metrics
      if (recoveryAttempted) {
        current.successMetrics.recoveryAttempts++;
        if (recoverySuccessful) {
          current.successMetrics.successfulRecoveries++;
        }
      }
      
      // Update deployment status
      const hasUnrecoverableErrors = current.deploymentErrors.some(e => !e.recoverable);
      const allComponentsProcessed = current.componentMetrics.length >= current.successMetrics.totalComponents;
      
      if (hasUnrecoverableErrors) {
        current.deploymentStatus = 'failed';
      } else if (allComponentsProcessed) {
        if (current.successMetrics.failedComponents > 0) {
          current.deploymentStatus = 'partial_success';
        } else {
          current.deploymentStatus = 'success';
        }
      }
      
      return current;
    });

    this.logger.debug(`Recorded deployment error: ${error.code} - Recovery attempted: ${recoveryAttempted}, successful: ${recoverySuccessful}`);
  }

  /**
   * Record security scan results
   */
  async recordSecurityMetrics(
    deploymentId: string,
    securityResult: CursorAISecurityScanResult,
  ): Promise<void> {
    const violations = securityResult.errors.length;
    const warnings = securityResult.warnings.length;
    const securityScore = Math.max(0, 100 - (violations * 20) - (warnings * 5));
    
    await this.updateDeploymentMetrics(deploymentId, (current) => {
      current.securityViolations = violations;
      current.securityWarnings = warnings;
      current.securityScore = securityScore;
      return current;
    });
    
    // Check for security alerts
    await this.checkSecurityAlerts(deploymentId, securityResult);
    
    this.logger.debug(`Recorded security metrics: ${violations} violations, ${warnings} warnings, score: ${securityScore}`);
  }

  /**
   * Complete deployment monitoring
   */
  async completeDeploymentMonitoring(
    deploymentId: string,
    result: DeploymentResult,
    totalDuration: number,
  ): Promise<CursorDeploymentReport> {
    // Finalize metrics
    const finalMetrics = await this.updateDeploymentMetrics(deploymentId, (current) => {
      current.totalDuration = totalDuration;
      current.peakMemoryUsage = Math.max(current.peakMemoryUsage, process.memoryUsage().heapUsed);
      
      // Calculate averages
      if (current.componentMetrics.length > 0) {
        current.averageMemoryUsage = current.componentMetrics.reduce(
          (sum, comp) => sum + (comp.size || 0), 
          0
        ) / current.componentMetrics.length;
      }
      
      // Final deployment status determination
      if (current.deploymentStatus === 'in_progress') {
        if (result.success) {
          current.deploymentStatus = current.successMetrics.failedComponents > 0 ? 'partial_success' : 'success';
        } else {
          current.deploymentStatus = 'failed';
        }
      }
      
      // Final success rate calculation
      const totalProcessed = current.successMetrics.successfulComponents + 
                            current.successMetrics.failedComponents + 
                            current.successMetrics.skippedComponents;
      if (totalProcessed > 0) {
        current.successMetrics.successRate = 
          (current.successMetrics.successfulComponents / totalProcessed) * 100;
      }
      
      return current;
    });
    
    // Log completion to audit
    if (result.success) {
      await this.auditLogger.logDeploymentSuccess(result, totalDuration);
    } else {
      // This would be called elsewhere for errors
      this.logger.warn(`Deployment ${deploymentId} completed with errors - Status: ${finalMetrics.deploymentStatus}`);
    }
    
    // Generate deployment report
    const report = await this.generateDeploymentReport(deploymentId, result, finalMetrics);
    
    // Save report
    await this.saveDeploymentReport(report);
    
    // Check for performance alerts
    await this.checkPerformanceAlerts(finalMetrics);
    
    // Log final metrics summary
    this.logger.log(
      `Completed monitoring deployment: ${deploymentId} (${totalDuration}ms) - ` +
      `Status: ${finalMetrics.deploymentStatus}, Success Rate: ${finalMetrics.successMetrics.successRate.toFixed(1)}%, ` +
      `Components: ${finalMetrics.successMetrics.successfulComponents}/${finalMetrics.successMetrics.totalComponents}`
    );
    
    return report;
  }

  /**
   * Get comprehensive deployment statistics
   */
  async getDeploymentStatistics(
    period: 'daily' | 'weekly' | 'monthly' = 'weekly',
  ): Promise<CursorTrendAnalysis> {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'daily':
        startDate.setDate(endDate.getDate() - 1);
        break;
      case 'weekly':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
    }
    
    // Get audit statistics
    const auditStats = await this.auditLogger.getAuditStats({
      startDate,
      endDate,
    });
    
    // Get performance metrics
    const performanceMetrics = await this.getPerformanceMetrics(startDate, endDate);
    
    // Analyze trends
    const trendAnalysis: CursorTrendAnalysis = {
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      deploymentTrends: {
        totalDeployments: auditStats.totalDeployments,
        successRate: auditStats.totalDeployments > 0 
          ? (auditStats.successfulDeployments / auditStats.totalDeployments) * 100 
          : 0,
        averageDuration: auditStats.averageDeploymentTime,
        trendDirection: await this.calculateTrendDirection('deployments', period),
      },
      performanceTrends: {
        averageSecurityScore: performanceMetrics.averageSecurityScore,
        averagePerformanceScore: performanceMetrics.averagePerformanceScore,
        commonBottlenecks: performanceMetrics.commonBottlenecks,
        memoryUsageTrend: performanceMetrics.memoryUsageTrend,
      },
      errorAnalysis: {
        mostCommonErrors: auditStats.mostCommonErrors.map(error => ({
          code: error.code,
          count: error.count,
          trend: 'stable' as const, // Would need historical data to determine trend
        })),
        errorsByComponent: await this.getErrorsByComponent(startDate, endDate),
        recoveryRate: auditStats.recoverySuccessRate,
      },
      userActivity: {
        activeUsers: await this.getActiveUserCount(startDate, endDate),
        deploymentsPerUser: auditStats.totalDeployments / Math.max(1, await this.getActiveUserCount(startDate, endDate)),
        mostActiveWorkspaces: await this.getMostActiveWorkspaces(startDate, endDate),
      },
    };
    
    return trendAnalysis;
  }

  /**
   * Configure alert rules
   */
  async configureAlert(alertRule: CursorAlertRule): Promise<void> {
    this.alertRules.set(alertRule.id, alertRule);
    
    // Persist alert configuration
    const alertConfigPath = path.join(this.metricsPath, 'alerts.json');
    const allRules = Array.from(this.alertRules.values());
    await fs.writeFile(alertConfigPath, JSON.stringify(allRules, null, 2));
    
    this.logger.log(`Configured alert rule: ${alertRule.name}`);
  }

  /**
   * Get real-time deployment status
   */
  async getRealTimeStatus(): Promise<{
    activeDeployments: number;
    averageDeploymentTime: number;
    currentSecurityScore: number;
    recentErrors: Array<{ timestamp: string; error: string; severity: string }>;
    systemHealth: 'healthy' | 'warning' | 'critical';
  }> {
    // This would typically query active deployments from memory/cache
    const recentEntries = await this.auditLogger.getAuditEntries({
      startDate: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
    });
    
    const activeDeployments = recentEntries.filter(e => 
      e.eventType === 'deployment_start' && 
      !recentEntries.some(end => 
        end.configId === e.configId && 
        (end.eventType === 'deployment_success' || end.eventType === 'deployment_error')
      )
    ).length;
    
    const recentErrors = recentEntries
      .filter(e => e.eventType === 'deployment_error')
      .slice(0, 10)
      .map(e => ({
        timestamp: e.timestamp,
        error: e.errorDetails?.message || 'Unknown error',
        severity: e.errorDetails?.severity || 'unknown',
      }));
    
    // Calculate system health
    let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (recentErrors.filter(e => e.severity === 'high').length > 0) {
      systemHealth = 'critical';
    } else if (recentErrors.length > 3) {
      systemHealth = 'warning';
    }
    
    return {
      activeDeployments,
      averageDeploymentTime: 0, // Would be calculated from active deployments
      currentSecurityScore: 95, // Would be calculated from recent deployments
      recentErrors,
      systemHealth,
    };
  }

  /**
   * Private helper methods
   */
  private async initializeMonitoring(): Promise<void> {
    try {
      await fs.mkdir(this.metricsPath, { recursive: true });
      await fs.mkdir(this.reportsPath, { recursive: true });
      
      // Load existing alert rules
      const alertConfigPath = path.join(this.metricsPath, 'alerts.json');
      try {
        const alertData = await fs.readFile(alertConfigPath, 'utf-8');
        const rules = JSON.parse(alertData) as CursorAlertRule[];
        rules.forEach(rule => this.alertRules.set(rule.id, rule));
      } catch {
        // File doesn't exist yet, use defaults
        await this.setupDefaultAlerts();
      }
      
      this.logger.log('Cursor monitoring system initialized');
    } catch (error) {
      this.logger.error('Failed to initialize monitoring system', error);
    }
  }

  private async setupDefaultAlerts(): Promise<void> {
    const defaultAlerts: CursorAlertRule[] = [
      {
        id: 'high-security-violations',
        name: 'High Security Violations',
        description: 'Alert when security violations exceed threshold',
        enabled: true,
        conditions: {
          metric: 'securityViolations',
          operator: '>',
          threshold: 5,
        },
        actions: {
          log: true,
          severity: 'critical',
        },
      },
      {
        id: 'slow-deployment',
        name: 'Slow Deployment',
        description: 'Alert when deployment takes too long',
        enabled: true,
        conditions: {
          metric: 'totalDuration',
          operator: '>',
          threshold: 30000, // 30 seconds
        },
        actions: {
          log: true,
          severity: 'warning',
        },
      },
      {
        id: 'low-security-score',
        name: 'Low Security Score',
        description: 'Alert when security score is too low',
        enabled: true,
        conditions: {
          metric: 'securityScore',
          operator: '<',
          threshold: 70,
        },
        actions: {
          log: true,
          severity: 'warning',
        },
      },
    ];

    for (const alert of defaultAlerts) {
      await this.configureAlert(alert);
    }
  }

  private async recordMetrics(metrics: CursorPerformanceMetrics): Promise<void> {
    const metricsFile = path.join(this.metricsPath, `${metrics.deploymentId}.json`);
    await fs.writeFile(metricsFile, JSON.stringify(metrics, null, 2));
  }

  private async updateDeploymentMetrics(
    deploymentId: string,
    updater: (current: CursorPerformanceMetrics) => CursorPerformanceMetrics,
  ): Promise<CursorPerformanceMetrics> {
    const metricsFile = path.join(this.metricsPath, `${deploymentId}.json`);
    
    try {
      const currentData = await fs.readFile(metricsFile, 'utf-8');
      const current = JSON.parse(currentData) as CursorPerformanceMetrics;
      const updated = updater(current);
      await fs.writeFile(metricsFile, JSON.stringify(updated, null, 2));
      return updated;
    } catch (error) {
      this.logger.warn(`Failed to update metrics for ${deploymentId}:`, error);
      throw error;
    }
  }

  private async generateDeploymentReport(
    deploymentId: string,
    result: DeploymentResult,
    metrics: CursorPerformanceMetrics,
  ): Promise<CursorDeploymentReport> {
    const report: CursorDeploymentReport = {
      deploymentId,
      timestamp: new Date().toISOString(),
      success: result.success,
      summary: {
        totalComponents: metrics.componentMetrics.length,
        successfulComponents: metrics.componentMetrics.filter(c => c.success).length,
        failedComponents: metrics.componentMetrics.filter(c => !c.success).length,
        duration: metrics.totalDuration,
        securityScore: metrics.securityScore,
      },
      components: metrics.componentMetrics.map(comp => ({
        type: comp.type,
        name: comp.name,
        status: comp.success ? 'success' : 'failed',
        duration: comp.processingTime,
        size: comp.size,
      })),
      security: {
        overallScore: metrics.securityScore,
        violations: result.errors?.map(e => ({
          type: 'error',
          severity: 'high' as const,
          message: e.message,
          component: e.component,
        })) || [],
        recommendations: [],
      },
      performance: {
        score: this.calculatePerformanceScore(metrics),
        bottlenecks: this.identifyBottlenecks(metrics),
        resourceUsage: {
          memory: {
            peak: metrics.peakMemoryUsage,
            average: metrics.averageMemoryUsage,
          },
          disk: {
            used: metrics.diskSpaceUsed,
            available: 0, // Would need system call to get this
          },
          cpu: {
            usage: 0, // Would need to track during deployment
          },
        },
      },
      recommendations: this.generateRecommendations(metrics, result),
    };

    return report;
  }

  private async saveDeploymentReport(report: CursorDeploymentReport): Promise<void> {
    const reportFile = path.join(this.reportsPath, `${report.deploymentId}-report.json`);
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
  }

  private calculatePerformanceScore(metrics: CursorPerformanceMetrics): number {
    let score = 100;
    
    // Penalize slow deployments
    if (metrics.totalDuration > 30000) score -= 20; // > 30s
    if (metrics.totalDuration > 60000) score -= 30; // > 1min
    
    // Penalize high memory usage
    if (metrics.peakMemoryUsage > 500 * 1024 * 1024) score -= 15; // > 500MB
    
    // Penalize failed components
    const failedComponents = metrics.componentMetrics.filter(c => !c.success).length;
    score -= failedComponents * 10;
    
    return Math.max(0, score);
  }

  private identifyBottlenecks(metrics: CursorPerformanceMetrics): Array<{
    component: string;
    issue: string;
    impact: 'low' | 'medium' | 'high';
  }> {
    const bottlenecks: Array<{ component: string; issue: string; impact: 'low' | 'medium' | 'high' }> = [];
    
    // Find slow components
    const slowComponents = metrics.componentMetrics
      .filter(c => c.processingTime > 5000) // > 5s
      .sort((a, b) => b.processingTime - a.processingTime);
    
    slowComponents.forEach(comp => {
      bottlenecks.push({
        component: comp.name,
        issue: `Slow processing time (${comp.processingTime}ms)`,
        impact: comp.processingTime > 15000 ? 'high' : 'medium',
      });
    });
    
    return bottlenecks;
  }

  private generateRecommendations(
    metrics: CursorPerformanceMetrics,
    result: DeploymentResult,
  ): Array<{
    category: 'performance' | 'security' | 'configuration';
    priority: 'low' | 'medium' | 'high';
    message: string;
    action?: string;
  }> {
    const recommendations: Array<{
      category: 'performance' | 'security' | 'configuration';
      priority: 'low' | 'medium' | 'high';
      message: string;
      action?: string;
    }> = [];
    
    // Performance recommendations
    if (metrics.totalDuration > 30000) {
      recommendations.push({
        category: 'performance',
        priority: 'medium',
        message: 'Deployment is slower than recommended',
        action: 'Consider optimizing configuration size or splitting into smaller components',
      });
    }
    
    // Security recommendations
    if (metrics.securityScore < 80) {
      recommendations.push({
        category: 'security',
        priority: 'high',
        message: 'Security score is below recommended threshold',
        action: 'Review security violations and fix identified issues',
      });
    }
    
    return recommendations;
  }

  private async checkSecurityAlerts(deploymentId: string, securityResult: CursorAISecurityScanResult): Promise<void> {
    for (const [id, rule] of this.alertRules) {
      if (!rule.enabled) continue;
      
      let shouldAlert = false;
      let value: number = 0;
      
      switch (rule.conditions.metric) {
        case 'securityViolations':
          value = securityResult.errors.length;
          break;
        case 'securityScore':
          value = Math.max(0, 100 - (securityResult.errors.length * 20) - (securityResult.warnings.length * 5));
          break;
      }
      
      shouldAlert = this.evaluateCondition(value, rule.conditions.operator, rule.conditions.threshold);
      
      if (shouldAlert) {
        await this.triggerAlert(rule, deploymentId, value);
      }
    }
  }

  private async checkPerformanceAlerts(metrics: CursorPerformanceMetrics): Promise<void> {
    for (const [id, rule] of this.alertRules) {
      if (!rule.enabled) continue;
      
      let shouldAlert = false;
      let value: number = 0;
      
      switch (rule.conditions.metric) {
        case 'totalDuration':
          value = metrics.totalDuration;
          break;
        case 'securityScore':
          value = metrics.securityScore;
          break;
      }
      
      shouldAlert = this.evaluateCondition(value, rule.conditions.operator, rule.conditions.threshold);
      
      if (shouldAlert) {
        await this.triggerAlert(rule, metrics.deploymentId, value);
      }
    }
  }

  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      case '!=': return value !== threshold;
      default: return false;
    }
  }

  private async triggerAlert(rule: CursorAlertRule, deploymentId: string, value: number): Promise<void> {
    const alertMessage = `Alert: ${rule.name} - Deployment ${deploymentId} - Value: ${value}, Threshold: ${rule.conditions.threshold}`;
    
    if (rule.actions.log) {
      switch (rule.actions.severity) {
        case 'critical':
          this.logger.error(alertMessage);
          break;
        case 'error':
          this.logger.error(alertMessage);
          break;
        case 'warning':
          this.logger.warn(alertMessage);
          break;
        default:
          this.logger.log(alertMessage);
      }
    }
    
    // Additional alert actions could be implemented here
    // (email, webhook, etc.)
  }

  private async getPerformanceMetrics(startDate: Date, endDate: Date): Promise<{
    averageSecurityScore: number;
    averagePerformanceScore: number;
    commonBottlenecks: Array<{ issue: string; frequency: number }>;
    memoryUsageTrend: Array<{ date: string; usage: number }>;
  }> {
    // Mock implementation - would query actual metrics files
    return {
      averageSecurityScore: 85,
      averagePerformanceScore: 78,
      commonBottlenecks: [
        { issue: 'Slow AI content processing', frequency: 12 },
        { issue: 'Large workspace validation', frequency: 8 },
      ],
      memoryUsageTrend: [
        { date: startDate.toISOString().split('T')[0], usage: 120 },
        { date: endDate.toISOString().split('T')[0], usage: 135 },
      ],
    };
  }

  private async calculateTrendDirection(metric: string, period: string): Promise<'improving' | 'stable' | 'declining'> {
    // Mock implementation - would compare with previous period
    return 'stable';
  }

  private async getErrorsByComponent(startDate: Date, endDate: Date): Promise<Array<{ component: string; errorCount: number }>> {
    // Mock implementation - would analyze error logs
    return [
      { component: 'ai-content', errorCount: 3 },
      { component: 'extensions', errorCount: 1 },
    ];
  }

  private async getActiveUserCount(startDate: Date, endDate: Date): Promise<number> {
    const entries = await this.auditLogger.getAuditEntries({ startDate, endDate });
    const uniqueUsers = new Set(entries.map(e => e.userId).filter(Boolean));
    return uniqueUsers.size;
  }

  private async getMostActiveWorkspaces(startDate: Date, endDate: Date): Promise<Array<{ path: string; deployments: number }>> {
    const entries = await this.auditLogger.getAuditEntries({ 
      startDate, 
      endDate,
      eventType: 'deployment_start',
    });
    
    const workspaceCounts = new Map<string, number>();
    entries.forEach(entry => {
      if (entry.workspacePath) {
        workspaceCounts.set(entry.workspacePath, (workspaceCounts.get(entry.workspacePath) || 0) + 1);
      }
    });
    
    return Array.from(workspaceCounts.entries())
      .map(([path, deployments]) => ({ path, deployments }))
      .sort((a, b) => b.deployments - a.deployments)
      .slice(0, 10);
  }
}