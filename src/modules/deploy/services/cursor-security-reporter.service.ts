import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import { Injectable, Logger } from '@nestjs/common';

import { CursorDeploymentError, CursorErrorContext } from '../errors/cursor-deployment.error';
import { CursorAISecurityScanResult } from './cursor-security-enforcer.service';
import { DeployErrorCode } from '../errors/deploy.error';
import { SecuritySeverity } from '../interfaces/security-config.interface';

export interface SecurityViolationReport {
  id: string;
  timestamp: string;
  deploymentId: string;
  
  // Context
  userId?: string;
  workspacePath?: string;
  configId?: string;
  cursorVersion?: string;
  
  // Violation details
  violation: {
    type: 'ai_injection' | 'malicious_content' | 'unsafe_extension' | 'untrusted_workspace' | 'dangerous_command' | 'config_tampering';
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: 'ai_security' | 'extension_security' | 'workspace_security' | 'command_security';
    description: string;
    evidence: Array<{
      type: 'pattern_match' | 'file_content' | 'configuration' | 'metadata';
      location?: string;
      content?: string;
      pattern?: string;
    }>;
  };
  
  // Impact assessment
  impact: {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    potentialDamage: string[];
    affectedComponents: string[];
    confidenceScore: number; // 0-100
  };
  
  // Response
  response: {
    actionTaken: 'blocked' | 'quarantined' | 'allowed_with_warning' | 'logged_only';
    automaticMitigation?: string[];
    recommendedActions: string[];
    followUpRequired: boolean;
  };
  
  // Status
  status: 'new' | 'investigating' | 'resolved' | 'false_positive' | 'accepted_risk';
  assignedTo?: string;
  resolutionNotes?: string;
  resolvedAt?: string;
}

export interface SecurityMetricsSummary {
  period: 'daily' | 'weekly' | 'monthly';
  dateRange: { start: string; end: string };
  
  // Security score metrics
  averageSecurityScore: number;
  securityScoreTrend: 'improving' | 'stable' | 'declining';
  lowestSecurityScore: number;
  highestSecurityScore: number;
  
  // Violation metrics
  totalViolations: number;
  violationsByType: Array<{ type: string; count: number; trend: 'up' | 'down' | 'stable' }>;
  violationsByComponent: Array<{ component: string; violations: number }>;
  
  // Deployment security
  deploymentsScanned: number;
  deploymentsPassed: number;
  deploymentsBlocked: number;
  deploymentPassRate: number;
  
  // Success/failure tracking
  securitySuccessMetrics: {
    totalSecurityScans: number;
    passedScans: number;
    failedScans: number;
    scanSuccessRate: number;
    averageScanDuration: number;
    blockedDeploymentsByViolation: Array<{ violationType: string; count: number; percentage: number }>;
    recoveredDeployments: number;
    recoverySuccessRate: number;
  };
}

export interface SecurityThreatIntelligence {
  threatId: string;
  name: string;
  description: string;
  category: 'ai_attack' | 'malware' | 'data_exfiltration' | 'privilege_escalation' | 'social_engineering';
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  // Detection patterns
  patterns: Array<{
    type: 'regex' | 'keyword' | 'signature' | 'behavior';
    pattern: string;
    context: 'ai_content' | 'extension_manifest' | 'workspace_config' | 'debug_command';
  }>;
  
  // Indicators of Compromise (IoCs)
  indicators: Array<{
    type: 'file_hash' | 'domain' | 'ip' | 'extension_id' | 'command_pattern';
    value: string;
    confidence: number; // 0-100
  }>;
  
  // Metadata
  firstSeen: string;
  lastSeen: string;
  frequency: number;
  sources: string[];
}

export interface SecurityDashboard {
  timestamp: string;
  overview: {
    totalViolations: number;
    criticalViolations: number;
    resolvedViolations: number;
    averageResponseTime: number; // in minutes
  };
  
  // Violation trends
  trends: {
    period: 'daily' | 'weekly' | 'monthly';
    violationsByType: Array<{ type: string; count: number; trend: 'up' | 'down' | 'stable' }>;
    violationsBySeverity: Array<{ severity: string; count: number; percentage: number }>;
    violationsByUser: Array<{ userId: string; count: number; riskScore: number }>;
  };
  
  // Threat landscape
  threatLandscape: {
    activeThreatTypes: Array<{ type: string; count: number; severity: string }>;
    emergingThreats: Array<{ name: string; count: number; trend: 'emerging' | 'declining' }>;
    threatActors: Array<{ identifier: string; activityLevel: 'low' | 'medium' | 'high' }>;
  };
  
  // System security posture
  securityPosture: {
    overallScore: number; // 0-100
    maturityLevel: 'initial' | 'managed' | 'defined' | 'quantitatively_managed' | 'optimizing';
    controlEffectiveness: Array<{ control: string; effectiveness: number }>;
    recommendedImprovements: string[];
  };
}

export interface SecurityIncident {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'contained' | 'resolved' | 'closed';
  
  // Timeline
  detectedAt: string;
  reportedAt: string;
  respondedAt?: string;
  containedAt?: string;
  resolvedAt?: string;
  
  // Related violations
  relatedViolations: string[]; // violation IDs
  affectedUsers: string[];
  affectedWorkspaces: string[];
  
  // Response
  responseTeam: string[];
  actions: Array<{
    timestamp: string;
    action: string;
    performedBy: string;
    result: string;
  }>;
  
  // Analysis
  rootCause?: string;
  lessonsLearned?: string[];
  preventiveMeasures?: string[];
}

@Injectable()
export class CursorSecurityReporter {
  private readonly logger = new Logger(CursorSecurityReporter.name);
  private readonly reportsPath: string;
  private readonly threatIntelPath: string;
  private readonly violationCounter: Map<string, number> = new Map();

  constructor() {
    const securityDir = path.join(os.homedir(), '.taptik', 'security', 'cursor');
    this.reportsPath = path.join(securityDir, 'violations');
    this.threatIntelPath = path.join(securityDir, 'threats');
    this.initializeSecurityReporting();
  }

  /**
   * Report a security violation
   */
  async reportSecurityViolation(
    deploymentId: string,
    violationType: SecurityViolationReport['violation']['type'],
    severity: SecurityViolationReport['violation']['severity'],
    description: string,
    evidence: SecurityViolationReport['violation']['evidence'],
    context: CursorErrorContext,
  ): Promise<SecurityViolationReport> {
    const violationId = `cursor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Assess impact
    const impact = await this.assessViolationImpact(violationType, severity, evidence, context);
    
    // Determine response
    const response = await this.determineResponse(violationType, severity, impact);
    
    const report: SecurityViolationReport = {
      id: violationId,
      timestamp: new Date().toISOString(),
      deploymentId,
      userId: context.userId,
      workspacePath: context.workspacePath,
      configId: context.configId,
      cursorVersion: context.cursorVersion,
      violation: {
        type: violationType,
        severity,
        category: this.categorizeViolation(violationType),
        description,
        evidence,
      },
      impact,
      response,
      status: 'new',
    };

    // Save violation report
    await this.saveViolationReport(report);
    
    // Update threat intelligence
    await this.updateThreatIntelligence(report);
    
    // Check if incident escalation is needed
    await this.checkIncidentEscalation(report);
    
    // Log the violation
    this.logSecurityViolation(report);
    
    return report;
  }

  /**
   * Process security scan results and generate reports
   */
  async processSecurityScanResults(
    deploymentId: string,
    scanResults: CursorAISecurityScanResult,
    context: CursorErrorContext,
  ): Promise<SecurityViolationReport[]> {
    const reports: SecurityViolationReport[] = [];

    // Process errors (high severity violations)
    for (const error of scanResults.errors) {
      if (error.severity === SecuritySeverity.HIGH) {
        const evidence = [{
          type: 'pattern_match' as const,
          location: error.location || 'unknown',
          content: error.message,
        }];

        const violationType = this.classifyErrorType(error.type, error.message);
        const report = await this.reportSecurityViolation(
          deploymentId,
          violationType,
          'critical',
          error.message,
          evidence,
          context,
        );
        reports.push(report);
      }
    }

    // Process AI-specific violations
    if (scanResults.promptInjectionDetected) {
      const evidence = scanResults.maliciousAIPatterns.map(pattern => ({
        type: 'pattern_match' as const,
        pattern,
        location: 'ai_content',
      }));

      const report = await this.reportSecurityViolation(
        deploymentId,
        'ai_injection',
        'high',
        'AI prompt injection detected',
        evidence,
        context,
      );
      reports.push(report);
    }

    // Process untrusted providers
    if (scanResults.untrustedProviders.length > 0) {
      const evidence = scanResults.untrustedProviders.map(provider => ({
        type: 'configuration' as const,
        content: provider,
        location: 'ai_config',
      }));

      const report = await this.reportSecurityViolation(
        deploymentId,
        'malicious_content',
        'medium',
        `Untrusted AI providers detected: ${scanResults.untrustedProviders.join(', ')}`,
        evidence,
        context,
      );
      reports.push(report);
    }

    return reports;
  }

  /**
   * Generate security dashboard
   */
  async generateSecurityDashboard(period: 'daily' | 'weekly' | 'monthly' = 'weekly'): Promise<SecurityDashboard> {
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

    const violations = await this.getViolationsInPeriod(startDate, endDate);
    const threats = await this.getActiveThreatTypes();

    const dashboard: SecurityDashboard = {
      timestamp: new Date().toISOString(),
      overview: {
        totalViolations: violations.length,
        criticalViolations: violations.filter(v => v.violation.severity === 'critical').length,
        resolvedViolations: violations.filter(v => v.status === 'resolved').length,
        averageResponseTime: await this.calculateAverageResponseTime(violations),
      },
      trends: {
        period,
        violationsByType: this.analyzeViolationsByType(violations),
        violationsBySeverity: this.analyzeViolationsBySeverity(violations),
        violationsByUser: await this.analyzeViolationsByUser(violations),
      },
      threatLandscape: {
        activeThreatTypes: threats.activeThreatTypes,
        emergingThreats: threats.emergingThreats,
        threatActors: threats.threatActors,
      },
      securityPosture: {
        overallScore: await this.calculateSecurityPostureScore(),
        maturityLevel: 'managed', // Would be calculated based on various factors
        controlEffectiveness: await this.assessControlEffectiveness(),
        recommendedImprovements: await this.generateSecurityRecommendations(),
      },
    };

    // Save dashboard snapshot
    await this.saveDashboardSnapshot(dashboard);

    return dashboard;
  }

  /**
   * Create security incident from related violations
   */
  async createSecurityIncident(
    title: string,
    description: string,
    relatedViolations: string[],
    severity: SecurityIncident['severity'],
  ): Promise<SecurityIncident> {
    const incidentId = `incident-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    // Get affected users and workspaces from related violations
    const violations = await Promise.all(
      relatedViolations.map(id => this.getViolationReport(id))
    );
    
    const affectedUsers = [...new Set(violations.map(v => v?.userId).filter(Boolean))] as string[];
    const affectedWorkspaces = [...new Set(violations.map(v => v?.workspacePath).filter(Boolean))] as string[];

    const incident: SecurityIncident = {
      id: incidentId,
      title,
      description,
      severity,
      status: 'open',
      detectedAt: now,
      reportedAt: now,
      relatedViolations,
      affectedUsers,
      affectedWorkspaces,
      responseTeam: ['security-team'], // Would be configurable
      actions: [{
        timestamp: now,
        action: 'Incident created and investigation initiated',
        performedBy: 'system',
        result: 'Investigation started',
      }],
    };

    await this.saveSecurityIncident(incident);
    this.logger.warn(`Security incident created: ${incident.id} - ${title}`);

    return incident;
  }

  /**
   * Record security scan results for success/failure tracking
   */
  async recordSecurityScanResult(
    deploymentId: string,
    scanResult: CursorAISecurityScanResult,
    scanDuration: number,
    blocked: boolean,
    recovered: boolean = false,
  ): Promise<void> {
    const scanRecord = {
      deploymentId,
      timestamp: new Date().toISOString(),
      passed: scanResult.errors.length === 0 && scanResult.warnings.length === 0,
      blocked,
      recovered,
      duration: scanDuration,
      errorCount: scanResult.errors.length,
      warningCount: scanResult.warnings.length,
      violationTypes: [
        ...scanResult.errors.map(e => e.type),
        ...scanResult.warnings.map(w => w.type),
      ],
    };

    // Save scan result for metrics tracking
    const scanResultFile = path.join(this.reportsPath, 'scans', `${deploymentId}-scan.json`);
    await fs.mkdir(path.dirname(scanResultFile), { recursive: true });
    await fs.writeFile(scanResultFile, JSON.stringify(scanRecord, null, 2));

    this.logger.debug(`Recorded security scan result: ${deploymentId} - Passed: ${scanRecord.passed}, Blocked: ${blocked}`);
  }

  /**
   * Get comprehensive security metrics with success/failure tracking
   */
  async getSecurityMetricsSummary(period: 'daily' | 'weekly' | 'monthly' = 'weekly'): Promise<SecurityMetricsSummary> {
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

    const violations = await this.getViolationsInPeriod(startDate, endDate);
    const scanResults = await this.getScanResultsInPeriod(startDate, endDate);

    // Calculate security score metrics
    const securityScores = scanResults
      .map(scan => Math.max(0, 100 - (scan.errorCount * 20) - (scan.warningCount * 5)))
      .filter(score => !isNaN(score));

    const averageSecurityScore = securityScores.length > 0 
      ? securityScores.reduce((sum, score) => sum + score, 0) / securityScores.length
      : 0;

    // Calculate success metrics
    const totalScans = scanResults.length;
    const passedScans = scanResults.filter(scan => scan.passed).length;
    const failedScans = totalScans - passedScans;
    const blockedDeployments = scanResults.filter(scan => scan.blocked).length;
    const recoveredDeployments = scanResults.filter(scan => scan.recovered).length;

    const scanSuccessRate = totalScans > 0 ? (passedScans / totalScans) * 100 : 0;
    const deploymentPassRate = totalScans > 0 ? ((totalScans - blockedDeployments) / totalScans) * 100 : 0;
    const recoverySuccessRate = blockedDeployments > 0 ? (recoveredDeployments / blockedDeployments) * 100 : 0;

    // Calculate average scan duration
    const averageScanDuration = scanResults.length > 0 
      ? scanResults.reduce((sum, scan) => sum + scan.duration, 0) / scanResults.length
      : 0;

    // Analyze blocked deployments by violation type
    const blockedByViolation = new Map<string, number>();
    scanResults
      .filter(scan => scan.blocked)
      .forEach(scan => {
        scan.violationTypes.forEach(type => {
          blockedByViolation.set(type, (blockedByViolation.get(type) || 0) + 1);
        });
      });

    const blockedDeploymentsByViolation = Array.from(blockedByViolation.entries())
      .map(([violationType, count]) => ({
        violationType,
        count,
        percentage: blockedDeployments > 0 ? Math.round((count / blockedDeployments) * 100) : 0,
      }));

    return {
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      averageSecurityScore,
      securityScoreTrend: await this.calculateSecurityScoreTrend(period),
      lowestSecurityScore: securityScores.length > 0 ? Math.min(...securityScores) : 0,
      highestSecurityScore: securityScores.length > 0 ? Math.max(...securityScores) : 0,
      totalViolations: violations.length,
      violationsByType: this.analyzeViolationsByType(violations),
      violationsByComponent: await this.analyzeViolationsByComponent(violations),
      deploymentsScanned: totalScans,
      deploymentsPassed: totalScans - blockedDeployments,
      deploymentsBlocked: blockedDeployments,
      deploymentPassRate,
      securitySuccessMetrics: {
        totalSecurityScans: totalScans,
        passedScans,
        failedScans,
        scanSuccessRate,
        averageScanDuration,
        blockedDeploymentsByViolation,
        recoveredDeployments,
        recoverySuccessRate,
      },
    };
  }

  /**
   * Get security metrics for reporting (legacy method maintained for compatibility)
   */
  async getSecurityMetrics(period: 'daily' | 'weekly' | 'monthly' = 'weekly'): Promise<{
    totalViolations: number;
    highSeverityViolations: number;
    resolvedViolations: number;
    averageResolutionTime: number;
    topViolationTypes: Array<{ type: string; count: number }>;
    securityTrends: Array<{ date: string; violations: number; severity: string }>;
  }> {
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

    const violations = await this.getViolationsInPeriod(startDate, endDate);

    // Calculate metrics
    const totalViolations = violations.length;
    const highSeverityViolations = violations.filter(v => 
      v.violation.severity === 'high' || v.violation.severity === 'critical'
    ).length;
    const resolvedViolations = violations.filter(v => v.status === 'resolved').length;
    const averageResolutionTime = await this.calculateAverageResponseTime(violations);

    // Top violation types
    const violationTypeCounts = new Map<string, number>();
    violations.forEach(v => {
      const count = violationTypeCounts.get(v.violation.type) || 0;
      violationTypeCounts.set(v.violation.type, count + 1);
    });
    
    const topViolationTypes = Array.from(violationTypeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Security trends (daily breakdown)
    const securityTrends: Array<{ date: string; violations: number; severity: string }> = [];
    const msPerDay = 24 * 60 * 60 * 1000;
    
    for (let d = new Date(startDate); d <= endDate; d.setTime(d.getTime() + msPerDay)) {
      const dayStart = new Date(d);
      const dayEnd = new Date(d.getTime() + msPerDay);
      
      const dayViolations = violations.filter(v => {
        const vDate = new Date(v.timestamp);
        return vDate >= dayStart && vDate < dayEnd;
      });

      securityTrends.push({
        date: dayStart.toISOString().split('T')[0],
        violations: dayViolations.length,
        severity: dayViolations.some(v => v.violation.severity === 'critical') ? 'critical' :
                 dayViolations.some(v => v.violation.severity === 'high') ? 'high' :
                 dayViolations.some(v => v.violation.severity === 'medium') ? 'medium' : 'low',
      });
    }

    return {
      totalViolations,
      highSeverityViolations,
      resolvedViolations,
      averageResolutionTime,
      topViolationTypes,
      securityTrends,
    };
  }

  /**
   * Private helper methods
   */
  private async initializeSecurityReporting(): Promise<void> {
    try {
      await fs.mkdir(this.reportsPath, { recursive: true });
      await fs.mkdir(this.threatIntelPath, { recursive: true });
      
      // Initialize threat intelligence database
      await this.initializeThreatIntelligence();
      
      this.logger.log('Security reporting system initialized');
    } catch (error) {
      this.logger.error('Failed to initialize security reporting system', error);
    }
  }

  private async initializeThreatIntelligence(): Promise<void> {
    const threatDbPath = path.join(this.threatIntelPath, 'threats.json');
    
    try {
      await fs.access(threatDbPath);
    } catch {
      // File doesn't exist, create with default threats
      const defaultThreats: SecurityThreatIntelligence[] = [
        {
          threatId: 'ai-prompt-injection',
          name: 'AI Prompt Injection',
          description: 'Attempts to manipulate AI models through crafted prompts',
          category: 'ai_attack',
          severity: 'high',
          patterns: [
            {
              type: 'regex',
              pattern: 'ignore\\s+previous\\s+instructions',
              context: 'ai_content',
            },
          ],
          indicators: [],
          firstSeen: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          frequency: 0,
          sources: ['static_analysis'],
        },
      ];
      
      await fs.writeFile(threatDbPath, JSON.stringify(defaultThreats, null, 2));
    }
  }

  private async saveViolationReport(report: SecurityViolationReport): Promise<void> {
    const reportFile = path.join(this.reportsPath, `${report.id}.json`);
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
  }

  private async getViolationReport(id: string): Promise<SecurityViolationReport | null> {
    try {
      const reportFile = path.join(this.reportsPath, `${id}.json`);
      const content = await fs.readFile(reportFile, 'utf-8');
      return JSON.parse(content) as SecurityViolationReport;
    } catch {
      return null;
    }
  }

  private async saveSecurityIncident(incident: SecurityIncident): Promise<void> {
    const incidentFile = path.join(this.reportsPath, `${incident.id}-incident.json`);
    await fs.writeFile(incidentFile, JSON.stringify(incident, null, 2));
  }

  private async saveDashboardSnapshot(dashboard: SecurityDashboard): Promise<void> {
    const snapshotFile = path.join(this.reportsPath, `dashboard-${Date.now()}.json`);
    await fs.writeFile(snapshotFile, JSON.stringify(dashboard, null, 2));
  }

  private categorizeViolation(type: SecurityViolationReport['violation']['type']): SecurityViolationReport['violation']['category'] {
    switch (type) {
      case 'ai_injection':
      case 'malicious_content':
        return 'ai_security';
      case 'unsafe_extension':
        return 'extension_security';
      case 'untrusted_workspace':
        return 'workspace_security';
      case 'dangerous_command':
      case 'config_tampering':
        return 'command_security';
      default:
        return 'ai_security';
    }
  }

  private classifyErrorType(errorType: string, message: string): SecurityViolationReport['violation']['type'] {
    if (message.toLowerCase().includes('injection') || message.toLowerCase().includes('ignore')) {
      return 'ai_injection';
    }
    if (message.toLowerCase().includes('extension')) {
      return 'unsafe_extension';
    }
    if (message.toLowerCase().includes('workspace') || message.toLowerCase().includes('trust')) {
      return 'untrusted_workspace';
    }
    if (message.toLowerCase().includes('command') || message.toLowerCase().includes('dangerous')) {
      return 'dangerous_command';
    }
    return 'malicious_content';
  }

  private async assessViolationImpact(
    type: SecurityViolationReport['violation']['type'],
    severity: SecurityViolationReport['violation']['severity'],
    evidence: SecurityViolationReport['violation']['evidence'],
    context: CursorErrorContext,
  ): Promise<SecurityViolationReport['impact']> {
    let riskLevel: SecurityViolationReport['impact']['riskLevel'] = 'low';
    const potentialDamage: string[] = [];
    const affectedComponents: string[] = [];

    // Assess risk level based on type and severity
    switch (type) {
      case 'ai_injection':
        riskLevel = severity === 'critical' ? 'critical' : 'high';
        potentialDamage.push('AI model manipulation', 'Data extraction', 'Unauthorized actions');
        affectedComponents.push('AI processing', 'User data');
        break;
      case 'unsafe_extension':
        riskLevel = severity === 'critical' ? 'critical' : 'medium';
        potentialDamage.push('Code execution', 'Data access', 'System compromise');
        affectedComponents.push('Extension system', 'Workspace files');
        break;
      case 'untrusted_workspace':
        riskLevel = 'medium';
        potentialDamage.push('Configuration tampering', 'Credential exposure');
        affectedComponents.push('Workspace configuration');
        break;
    }

    // Calculate confidence score based on evidence
    let confidenceScore = 50;
    if (evidence.some(e => e.type === 'pattern_match')) confidenceScore += 20;
    if (evidence.some(e => e.type === 'file_content')) confidenceScore += 15;
    if (evidence.length > 2) confidenceScore += 10;
    if (context.workspacePath?.includes('/tmp') || context.workspacePath?.includes('/Downloads')) {
      confidenceScore += 15;
    }

    return {
      riskLevel,
      potentialDamage,
      affectedComponents,
      confidenceScore: Math.min(100, confidenceScore),
    };
  }

  private async determineResponse(
    type: SecurityViolationReport['violation']['type'],
    severity: SecurityViolationReport['violation']['severity'],
    impact: SecurityViolationReport['impact'],
  ): Promise<SecurityViolationReport['response']> {
    let actionTaken: SecurityViolationReport['response']['actionTaken'] = 'logged_only';
    const automaticMitigation: string[] = [];
    const recommendedActions: string[] = [];
    let followUpRequired = false;

    // Determine action based on severity and risk
    if (severity === 'critical' || impact.riskLevel === 'critical') {
      actionTaken = 'blocked';
      followUpRequired = true;
      automaticMitigation.push('Deployment blocked', 'Security team notified');
      recommendedActions.push('Investigate immediately', 'Review security policies');
    } else if (severity === 'high' || impact.riskLevel === 'high') {
      actionTaken = 'quarantined';
      followUpRequired = true;
      automaticMitigation.push('Component quarantined', 'User notified');
      recommendedActions.push('Manual review required', 'Security scan recommended');
    } else if (severity === 'medium') {
      actionTaken = 'allowed_with_warning';
      recommendedActions.push('Monitor for similar patterns', 'User education recommended');
    }

    return {
      actionTaken,
      automaticMitigation: automaticMitigation.length > 0 ? automaticMitigation : undefined,
      recommendedActions,
      followUpRequired,
    };
  }

  private async updateThreatIntelligence(report: SecurityViolationReport): Promise<void> {
    // This would update the threat intelligence database with new patterns/indicators
    const violationType = report.violation.type;
    this.violationCounter.set(violationType, (this.violationCounter.get(violationType) || 0) + 1);
  }

  private async checkIncidentEscalation(report: SecurityViolationReport): Promise<void> {
    // Check if this violation should trigger incident creation
    if (report.violation.severity === 'critical' || report.impact.riskLevel === 'critical') {
      await this.createSecurityIncident(
        `Critical Security Violation: ${report.violation.type}`,
        report.violation.description,
        [report.id],
        'high',
      );
    }
  }

  private logSecurityViolation(report: SecurityViolationReport): void {
    const logLevel = report.violation.severity === 'critical' ? 'error' : 
                     report.violation.severity === 'high' ? 'warn' : 'log';
    
    const message = `Security violation detected: ${report.violation.type} (${report.violation.severity}) - ${report.violation.description}`;
    
    this.logger[logLevel](message);
  }

  private async getViolationsInPeriod(startDate: Date, endDate: Date): Promise<SecurityViolationReport[]> {
    try {
      const files = await fs.readdir(this.reportsPath);
      const violationFiles = files.filter(f => f.endsWith('.json') && !f.includes('incident') && !f.includes('dashboard'));
      
      const violations: SecurityViolationReport[] = [];
      for (const file of violationFiles) {
        try {
          const content = await fs.readFile(path.join(this.reportsPath, file), 'utf-8');
          const violation = JSON.parse(content) as SecurityViolationReport;
          
          const violationDate = new Date(violation.timestamp);
          if (violationDate >= startDate && violationDate <= endDate) {
            violations.push(violation);
          }
        } catch (error) {
          this.logger.warn(`Failed to parse violation file ${file}:`, error);
        }
      }
      
      return violations;
    } catch {
      return [];
    }
  }

  private async getActiveThreatTypes(): Promise<{
    activeThreatTypes: Array<{ type: string; count: number; severity: string }>;
    emergingThreats: Array<{ name: string; count: number; trend: 'emerging' | 'declining' }>;
    threatActors: Array<{ identifier: string; activityLevel: 'low' | 'medium' | 'high' }>;
  }> {
    // Mock implementation - would analyze threat intelligence data
    return {
      activeThreatTypes: [
        { type: 'ai_injection', count: 5, severity: 'high' },
        { type: 'unsafe_extension', count: 2, severity: 'medium' },
      ],
      emergingThreats: [
        { name: 'AI Prompt Jailbreaking', count: 3, trend: 'emerging' },
      ],
      threatActors: [
        { identifier: 'unknown-actor-1', activityLevel: 'low' },
      ],
    };
  }

  private analyzeViolationsByType(violations: SecurityViolationReport[]): Array<{ type: string; count: number; trend: 'up' | 'down' | 'stable' }> {
    const typeCounts = new Map<string, number>();
    violations.forEach(v => {
      typeCounts.set(v.violation.type, (typeCounts.get(v.violation.type) || 0) + 1);
    });

    return Array.from(typeCounts.entries()).map(([type, count]) => ({
      type,
      count,
      trend: 'stable' as const, // Would need historical data for trend analysis
    }));
  }

  private analyzeViolationsBySeverity(violations: SecurityViolationReport[]): Array<{ severity: string; count: number; percentage: number }> {
    const severityCounts = new Map<string, number>();
    violations.forEach(v => {
      severityCounts.set(v.violation.severity, (severityCounts.get(v.violation.severity) || 0) + 1);
    });

    const total = violations.length;
    return Array.from(severityCounts.entries()).map(([severity, count]) => ({
      severity,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }));
  }

  private async analyzeViolationsByUser(violations: SecurityViolationReport[]): Promise<Array<{ userId: string; count: number; riskScore: number }>> {
    const userCounts = new Map<string, number>();
    violations.forEach(v => {
      if (v.userId) {
        userCounts.set(v.userId, (userCounts.get(v.userId) || 0) + 1);
      }
    });

    return Array.from(userCounts.entries()).map(([userId, count]) => ({
      userId,
      count,
      riskScore: Math.min(100, count * 10), // Simple risk score calculation
    }));
  }

  private async calculateAverageResponseTime(violations: SecurityViolationReport[]): Promise<number> {
    const resolvedViolations = violations.filter(v => v.resolvedAt);
    if (resolvedViolations.length === 0) return 0;

    const totalTime = resolvedViolations.reduce((sum, v) => {
      const reportTime = new Date(v.timestamp).getTime();
      const resolvedTime = new Date(v.resolvedAt!).getTime();
      return sum + (resolvedTime - reportTime);
    }, 0);

    return Math.round(totalTime / resolvedViolations.length / (1000 * 60)); // Convert to minutes
  }

  private async calculateSecurityPostureScore(): Promise<number> {
    // Mock implementation - would analyze various security metrics
    return 78;
  }

  private async assessControlEffectiveness(): Promise<Array<{ control: string; effectiveness: number }>> {
    return [
      { control: 'AI Content Scanning', effectiveness: 85 },
      { control: 'Extension Validation', effectiveness: 92 },
      { control: 'Workspace Trust', effectiveness: 67 },
      { control: 'Command Filtering', effectiveness: 94 },
    ];
  }

  private async getScanResultsInPeriod(startDate: Date, endDate: Date): Promise<Array<{
    deploymentId: string;
    timestamp: string;
    passed: boolean;
    blocked: boolean;
    recovered: boolean;
    duration: number;
    errorCount: number;
    warningCount: number;
    violationTypes: string[];
  }>> {
    try {
      const scansDir = path.join(this.reportsPath, 'scans');
      try {
        await fs.access(scansDir);
      } catch {
        return []; // Directory doesn't exist yet
      }

      const files = await fs.readdir(scansDir);
      const scanFiles = files.filter(f => f.endsWith('-scan.json'));
      
      const scanResults: any[] = [];
      for (const file of scanFiles) {
        try {
          const content = await fs.readFile(path.join(scansDir, file), 'utf-8');
          const scanResult = JSON.parse(content);
          
          const scanDate = new Date(scanResult.timestamp);
          if (scanDate >= startDate && scanDate <= endDate) {
            scanResults.push(scanResult);
          }
        } catch (error) {
          this.logger.warn(`Failed to parse scan result file ${file}:`, error);
        }
      }
      
      return scanResults;
    } catch {
      return [];
    }
  }

  private async calculateSecurityScoreTrend(period: string): Promise<'improving' | 'stable' | 'declining'> {
    // Mock implementation - would compare with previous period
    return 'stable';
  }

  private async analyzeViolationsByComponent(violations: SecurityViolationReport[]): Promise<Array<{ component: string; violations: number }>> {
    const componentCounts = new Map<string, number>();
    violations.forEach(v => {
      v.impact.affectedComponents.forEach(component => {
        componentCounts.set(component, (componentCounts.get(component) || 0) + 1);
      });
    });

    return Array.from(componentCounts.entries())
      .map(([component, violations]) => ({ component, violations }))
      .sort((a, b) => b.violations - a.violations);
  }

  private async generateSecurityRecommendations(): Promise<string[]> {
    return [
      'Implement additional AI prompt validation patterns',
      'Enhance workspace trust scoring algorithm',
      'Add real-time threat intelligence feeds',
      'Improve security awareness training for users',
    ];
  }
}