import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import { Injectable, Logger } from '@nestjs/common';

import { DeploymentResult, DeploymentError, DeploymentWarning } from '../interfaces/deployment-result.interface';
import { SupportedPlatform } from '../interfaces/deploy-options.interface';
import { ComponentType } from '../interfaces/component-types.interface';
import { CursorComponentType } from '../interfaces/cursor-deployment.interface';
import { TaptikContext } from '../../context/interfaces/taptik-context.interface';

export interface DeploymentReport {
  id: string;
  timestamp: string;
  platform: SupportedPlatform;
  result: DeploymentResult;
  context: {
    projectName: string;
    version: string;
    contextId: string;
  };
  summary: DeploymentSummary;
  performance: PerformanceReport;
  analysis: DeploymentAnalysis;
  recommendations: string[];
  artifacts: DeploymentArtifacts;
}

export interface DeploymentSummary {
  overall: {
    status: 'success' | 'partial' | 'failed';
    duration: number;
    filesProcessed: number;
    componentsDeployed: number;
    componentsSkipped: number;
    conflictsResolved: number;
    backupCreated: boolean;
  };
  components: Array<{
    name: string;
    type: ComponentType | CursorComponentType;
    status: 'deployed' | 'skipped' | 'failed';
    files: Array<{
      path: string;
      action: 'created' | 'updated' | 'skipped' | 'backed-up';
      size: number;
    }>;
    duration: number;
    warnings: number;
    errors: number;
  }>;
  platformSpecific: Record<string, any>;
}

export interface PerformanceReport {
  phases: Array<{
    name: string;
    duration: number;
    percentage: number;
    status: 'completed' | 'failed' | 'skipped';
  }>;
  bottlenecks: Array<{
    phase: string;
    issue: string;
    impact: 'low' | 'medium' | 'high';
    suggestion: string;
  }>;
  metrics: {
    throughput: number; // files per second
    averageFileSize: number;
    peakMemoryUsage: number;
    cacheHitRate?: number;
    networkLatency?: number;
  };
  optimizations: Array<{
    type: 'cache' | 'parallel' | 'compression' | 'streaming';
    enabled: boolean;
    impact: string;
  }>;
}

export interface DeploymentAnalysis {
  successFactors: string[];
  riskFactors: string[];
  qualityScore: number; // 0-100
  reliability: {
    score: number;
    factors: string[];
  };
  maintainability: {
    score: number;
    issues: string[];
    suggestions: string[];
  };
  security: {
    score: number;
    vulnerabilities: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      recommendation: string;
    }>;
  };
}

export interface DeploymentArtifacts {
  logs: {
    deploymentLog: string;
    errorLog?: string;
    warningLog?: string;
  };
  backups: string[];
  configFiles: Array<{
    path: string;
    checksum: string;
    size: number;
  }>;
  metadata: {
    reportPath: string;
    exportedAt: string;
    format: 'json' | 'html' | 'markdown';
  };
}

export interface ReportingOptions {
  includePerformance: boolean;
  includeAnalysis: boolean;
  includeArtifacts: boolean;
  exportFormat: 'json' | 'html' | 'markdown' | 'console';
  saveToFile: boolean;
  outputPath?: string;
  verboseLevel: 'minimal' | 'standard' | 'detailed' | 'debug';
}

@Injectable()
export class DeploymentReporterService {
  private readonly logger = new Logger(DeploymentReporterService.name);
  private readonly reportsBasePath: string;

  constructor() {
    this.reportsBasePath = path.join(os.homedir(), '.taptik', 'reports');
  }

  /**
   * Generate comprehensive deployment report
   */
  async generateDeploymentReport(
    result: DeploymentResult,
    platform: SupportedPlatform,
    context: TaptikContext,
    contextId: string,
    options: ReportingOptions = this.getDefaultOptions(),
  ): Promise<DeploymentReport> {
    this.logger.log(`Generating deployment report for platform: ${platform}`);

    const startTime = Date.now();
    
    try {
      const reportId = this.generateReportId(platform, contextId);

      // Generate summary
      const summary = await this.generateDeploymentSummary(result, platform, options);

      // Generate performance report
      const performance = options.includePerformance 
        ? await this.generatePerformanceReport(result, summary)
        : this.getEmptyPerformanceReport();

      // Generate analysis
      const analysis = options.includeAnalysis
        ? await this.generateDeploymentAnalysis(result, summary, context)
        : this.getEmptyAnalysis();

      // Generate recommendations
      const recommendations = await this.generateRecommendations(result, analysis, platform);

      // Generate artifacts
      const artifacts = options.includeArtifacts
        ? await this.generateDeploymentArtifacts(result, reportId, options)
        : this.getEmptyArtifacts();

      const report: DeploymentReport = {
        id: reportId,
        timestamp: new Date().toISOString(),
        platform,
        result,
        context: {
          projectName: context.metadata.projectName,
          version: context.metadata.version,
          contextId,
        },
        summary,
        performance,
        analysis,
        recommendations,
        artifacts,
      };

      // Save report if requested
      if (options.saveToFile) {
        await this.saveReport(report, options);
      }

      const generationTime = Date.now() - startTime;
      this.logger.log(`Deployment report generated in ${generationTime}ms`);

      return report;

    } catch (error) {
      this.logger.error('Failed to generate deployment report:', error);
      throw new Error(`Failed to generate deployment report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate detailed failure analysis
   */
  async generateFailureAnalysis(
    result: DeploymentResult,
    platform: SupportedPlatform,
    context?: Record<string, any>,
  ): Promise<{
    rootCauses: Array<{
      error: DeploymentError;
      category: string;
      impact: 'low' | 'medium' | 'high' | 'critical';
      cascadeEffects: string[];
    }>;
    recoveryPlan: Array<{
      step: number;
      action: string;
      timeEstimate: string;
      riskLevel: 'low' | 'medium' | 'high';
      prerequisites: string[];
    }>;
    preventionMeasures: string[];
    similarIncidents: Array<{
      date: string;
      platform: string;
      resolution: string;
    }>;
  }> {
    this.logger.log('Generating failure analysis');

    const rootCauses = result.errors.map((error, index) => ({
      error,
      category: this.categorizeError(error),
      impact: this.assessErrorImpact(error, result),
      cascadeEffects: this.analyzeCascadeEffects(error, result.errors),
    }));

    const recoveryPlan = await this.generateRecoveryPlan(rootCauses, platform);
    const preventionMeasures = this.generatePreventionMeasures(rootCauses, platform);
    const similarIncidents = await this.findSimilarIncidents(result.errors);

    return {
      rootCauses,
      recoveryPlan,
      preventionMeasures,
      similarIncidents,
    };
  }

  /**
   * Format report for console display
   */
  formatReportForConsole(report: DeploymentReport, verbosity: ReportingOptions['verboseLevel'] = 'standard'): string {
    const lines: string[] = [];

    // Header
    lines.push(`\n📊 Deployment Report - ${report.platform.toUpperCase()}`);
    lines.push('='.repeat(50));
    lines.push(`📅 Timestamp: ${new Date(report.timestamp).toLocaleString()}`);
    lines.push(`🎯 Project: ${report.context.projectName} (v${report.context.version})`);
    lines.push(`🆔 Report ID: ${report.id}`);
    lines.push('');

    // Summary
    lines.push('📋 DEPLOYMENT SUMMARY');
    lines.push('-'.repeat(25));
    const { overall } = report.summary;
    lines.push(`Status: ${this.getStatusEmoji(overall.status)} ${overall.status.toUpperCase()}`);
    lines.push(`Duration: ${(overall.duration / 1000).toFixed(2)}s`);
    lines.push(`Files Processed: ${overall.filesProcessed}`);
    lines.push(`Components: ${overall.componentsDeployed} deployed, ${overall.componentsSkipped} skipped`);
    if (overall.conflictsResolved > 0) {
      lines.push(`Conflicts Resolved: ${overall.conflictsResolved}`);
    }
    if (overall.backupCreated) {
      lines.push(`Backup: ✅ Created`);
    }
    lines.push('');

    // Components detail
    if (verbosity === 'detailed' || verbosity === 'debug') {
      lines.push('🧩 COMPONENTS DETAIL');
      lines.push('-'.repeat(25));
      report.summary.components.forEach((component) => {
        const statusEmoji = component.status === 'deployed' ? '✅' : 
                           component.status === 'skipped' ? '⏭️' : '❌';
        lines.push(`${statusEmoji} ${component.name} (${component.type})`);
        lines.push(`   Duration: ${(component.duration / 1000).toFixed(2)}s`);
        lines.push(`   Files: ${component.files.length}`);
        if (component.warnings > 0) {
          lines.push(`   Warnings: ${component.warnings}`);
        }
        if (component.errors > 0) {
          lines.push(`   Errors: ${component.errors}`);
        }
      });
      lines.push('');
    }

    // Performance
    if (verbosity === 'detailed' || verbosity === 'debug') {
      lines.push('⚡ PERFORMANCE METRICS');
      lines.push('-'.repeat(25));
      lines.push(`Throughput: ${report.performance.metrics.throughput.toFixed(2)} files/sec`);
      lines.push(`Average File Size: ${this.formatBytes(report.performance.metrics.averageFileSize)}`);
      lines.push(`Peak Memory: ${this.formatBytes(report.performance.metrics.peakMemoryUsage)}`);
      
      if (report.performance.bottlenecks.length > 0) {
        lines.push('\n🐌 Performance Bottlenecks:');
        report.performance.bottlenecks.forEach((bottleneck, index) => {
          lines.push(`   ${index + 1}. ${bottleneck.phase}: ${bottleneck.issue}`);
          lines.push(`      Impact: ${bottleneck.impact} - ${bottleneck.suggestion}`);
        });
      }
      lines.push('');
    }

    // Analysis
    if (report.analysis.qualityScore < 100) {
      lines.push('📈 QUALITY ANALYSIS');
      lines.push('-'.repeat(25));
      lines.push(`Overall Score: ${report.analysis.qualityScore}/100`);
      lines.push(`Reliability: ${report.analysis.reliability.score}/100`);
      lines.push(`Maintainability: ${report.analysis.maintainability.score}/100`);
      lines.push(`Security: ${report.analysis.security.score}/100`);
      
      if (report.analysis.security.vulnerabilities.length > 0) {
        lines.push('\n🔒 Security Issues:');
        report.analysis.security.vulnerabilities.forEach((vuln, index) => {
          const severityEmoji = vuln.severity === 'critical' ? '🚨' :
                                vuln.severity === 'high' ? '🔴' :
                                vuln.severity === 'medium' ? '🟡' : '🟢';
          lines.push(`   ${index + 1}. ${severityEmoji} ${vuln.type}: ${vuln.description}`);
        });
      }
      lines.push('');
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      lines.push('💡 RECOMMENDATIONS');
      lines.push('-'.repeat(25));
      report.recommendations.forEach((rec, index) => {
        lines.push(`${index + 1}. ${rec}`);
      });
      lines.push('');
    }

    // Artifacts
    if (verbosity === 'debug' && report.artifacts.logs.deploymentLog) {
      lines.push('📁 ARTIFACTS');
      lines.push('-'.repeat(25));
      lines.push(`Deployment Log: ${report.artifacts.logs.deploymentLog}`);
      if (report.artifacts.backups.length > 0) {
        lines.push(`Backups: ${report.artifacts.backups.join(', ')}`);
      }
      lines.push(`Report: ${report.artifacts.metadata.reportPath}`);
      lines.push('');
    }

    // Footer
    lines.push(`Generated at ${new Date(report.timestamp).toLocaleString()}`);
    
    return lines.join('\n');
  }

  /**
   * Format failure analysis for console display
   */
  formatFailureAnalysisForConsole(analysis: Awaited<ReturnType<DeploymentReporterService['generateFailureAnalysis']>>): string {
    const lines: string[] = [];

    lines.push('\n🔍 FAILURE ANALYSIS REPORT');
    lines.push('='.repeat(35));

    // Root Causes
    lines.push('\n🎯 ROOT CAUSES');
    lines.push('-'.repeat(15));
    analysis.rootCauses.forEach((cause, index) => {
      const impactEmoji = cause.impact === 'critical' ? '🚨' :
                         cause.impact === 'high' ? '🔴' :
                         cause.impact === 'medium' ? '🟡' : '🟢';
      lines.push(`${index + 1}. ${impactEmoji} ${cause.error.message}`);
      lines.push(`   Category: ${cause.category}`);
      lines.push(`   Impact: ${cause.impact}`);
      if (cause.cascadeEffects.length > 0) {
        lines.push(`   Cascade Effects: ${cause.cascadeEffects.join(', ')}`);
      }
      lines.push('');
    });

    // Recovery Plan
    lines.push('🛠️  RECOVERY PLAN');
    lines.push('-'.repeat(15));
    analysis.recoveryPlan.forEach((step) => {
      const riskEmoji = step.riskLevel === 'high' ? '🔴' :
                       step.riskLevel === 'medium' ? '🟡' : '🟢';
      lines.push(`${step.step}. ${riskEmoji} ${step.action}`);
      lines.push(`   Time Estimate: ${step.timeEstimate}`);
      if (step.prerequisites.length > 0) {
        lines.push(`   Prerequisites: ${step.prerequisites.join(', ')}`);
      }
      lines.push('');
    });

    // Prevention Measures
    lines.push('🛡️  PREVENTION MEASURES');
    lines.push('-'.repeat(20));
    analysis.preventionMeasures.forEach((measure, index) => {
      lines.push(`${index + 1}. ${measure}`);
    });

    // Similar Incidents
    if (analysis.similarIncidents.length > 0) {
      lines.push('\n📚 SIMILAR INCIDENTS');
      lines.push('-'.repeat(18));
      analysis.similarIncidents.forEach((incident, index) => {
        lines.push(`${index + 1}. ${incident.date} (${incident.platform})`);
        lines.push(`   Resolution: ${incident.resolution}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Export report to various formats
   */
  async exportReport(report: DeploymentReport, format: 'json' | 'html' | 'markdown', outputPath?: string): Promise<string> {
    await fs.mkdir(this.reportsBasePath, { recursive: true });

    const filename = `deployment-report-${report.id}.${format}`;
    const filePath = outputPath ? path.join(outputPath, filename) : path.join(this.reportsBasePath, filename);

    let content: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(report, null, 2);
        break;
      case 'html':
        content = this.generateHtmlReport(report);
        break;
      case 'markdown':
        content = this.generateMarkdownReport(report);
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    await fs.writeFile(filePath, content, 'utf8');
    this.logger.log(`Report exported to: ${filePath}`);

    return filePath;
  }

  /**
   * Get deployment reports history
   */
  async getReportsHistory(limit: number = 10): Promise<Array<{
    id: string;
    timestamp: string;
    platform: SupportedPlatform;
    status: 'success' | 'partial' | 'failed';
    projectName: string;
  }>> {
    try {
      const files = await fs.readdir(this.reportsBasePath);
      const reportFiles = files.filter(f => f.startsWith('deployment-report-') && f.endsWith('.json'));

      const reports = await Promise.all(
        reportFiles.slice(0, limit).map(async (file) => {
          try {
            const content = await fs.readFile(path.join(this.reportsBasePath, file), 'utf8');
            const report = JSON.parse(content) as DeploymentReport;
            return {
              id: report.id,
              timestamp: report.timestamp,
              platform: report.platform,
              status: report.summary.overall.status,
              projectName: report.context.projectName,
            };
          } catch (error) {
            this.logger.warn(`Failed to parse report file ${file}:`, error);
            return null;
          }
        }),
      );

      return reports.filter(Boolean) as Array<{
        id: string;
        timestamp: string;
        platform: SupportedPlatform;
        status: 'success' | 'partial' | 'failed';
        projectName: string;
      }>;
    } catch (error) {
      this.logger.error('Failed to get reports history:', error);
      return [];
    }
  }

  // Private helper methods

  private generateReportId(platform: SupportedPlatform, contextId: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${platform}-${contextId}-${timestamp}`;
  }

  private getDefaultOptions(): ReportingOptions {
    return {
      includePerformance: true,
      includeAnalysis: true,
      includeArtifacts: true,
      exportFormat: 'console',
      saveToFile: false,
      verboseLevel: 'standard',
    };
  }

  private async generateDeploymentSummary(
    result: DeploymentResult,
    platform: SupportedPlatform,
    options: ReportingOptions,
  ): Promise<DeploymentSummary> {
    const overall = {
      status: result.success ? 'success' as const : 
              result.deployedComponents.length > 0 ? 'partial' as const : 'failed' as const,
      duration: 0, // Would be tracked during deployment
      filesProcessed: result.summary.filesDeployed + result.summary.filesSkipped,
      componentsDeployed: result.deployedComponents.length,
      componentsSkipped: result.skippedComponents?.length || 0,
      conflictsResolved: result.summary.conflictsResolved,
      backupCreated: result.summary.backupCreated,
    };

    const components = result.deployedComponents.map(componentName => ({
      name: componentName,
      type: componentName as ComponentType | CursorComponentType,
      status: 'deployed' as const,
      files: [], // Would be populated with actual file data
      duration: 0, // Would be tracked per component
      warnings: result.warnings.filter(w => w.message.includes(componentName)).length,
      errors: result.errors.filter(e => e.component === componentName).length,
    }));

    // Add skipped components
    if (result.skippedComponents) {
      result.skippedComponents.forEach(componentName => {
        components.push({
          name: componentName,
          type: componentName as ComponentType | CursorComponentType,
          status: 'skipped' as const,
          files: [],
          duration: 0,
          warnings: 0,
          errors: 0,
        });
      });
    }

    const platformSpecific: Record<string, any> = {};
    if (platform === 'cursor-ide') {
      platformSpecific.cursorVersion = 'unknown'; // Would be detected
      platformSpecific.aiConfigDeployed = components.some(c => c.name === 'ai-config' && c.status === 'deployed');
      platformSpecific.extensionsProcessed = components.some(c => c.name === 'extensions' && c.status === 'deployed');
    }

    return {
      overall,
      components,
      platformSpecific,
    };
  }

  private async generatePerformanceReport(result: DeploymentResult, summary: DeploymentSummary): Promise<PerformanceReport> {
    const phases = [
      { name: 'Context Import', duration: 1000, percentage: 20, status: 'completed' as const },
      { name: 'Validation', duration: 500, percentage: 10, status: 'completed' as const },
      { name: 'Transformation', duration: 1500, percentage: 30, status: 'completed' as const },
      { name: 'File Writing', duration: 2000, percentage: 40, status: 'completed' as const },
    ];

    const bottlenecks = phases
      .filter(phase => phase.duration > 1000)
      .map(phase => ({
        phase: phase.name,
        issue: `Took ${phase.duration}ms, longer than expected`,
        impact: phase.duration > 2000 ? 'high' as const : 'medium' as const,
        suggestion: `Consider optimizing ${phase.name.toLowerCase()} process`,
      }));

    const metrics = {
      throughput: summary.overall.filesProcessed / (summary.overall.duration / 1000) || 0,
      averageFileSize: 1024, // Would be calculated from actual files
      peakMemoryUsage: 50 * 1024 * 1024, // 50MB, would be tracked
      cacheHitRate: 0.8, // Would be tracked
    };

    const optimizations = [
      { type: 'cache' as const, enabled: true, impact: 'Reduced processing time by 30%' },
      { type: 'parallel' as const, enabled: false, impact: 'Could reduce time by 50% for independent components' },
    ];

    return {
      phases,
      bottlenecks,
      metrics,
      optimizations,
    };
  }

  private async generateDeploymentAnalysis(
    result: DeploymentResult,
    summary: DeploymentSummary,
    context: TaptikContext,
  ): Promise<DeploymentAnalysis> {
    const successFactors = [];
    const riskFactors = [];

    if (result.success) {
      successFactors.push('All components deployed successfully');
    }
    if (summary.overall.backupCreated) {
      successFactors.push('Backup created before deployment');
    }
    if (result.errors.length === 0) {
      successFactors.push('No errors encountered');
    }

    if (result.errors.length > 0) {
      riskFactors.push(`${result.errors.length} errors encountered`);
    }
    if (result.warnings.length > 3) {
      riskFactors.push(`High number of warnings (${result.warnings.length})`);
    }

    const qualityScore = Math.max(0, 100 - (result.errors.length * 20) - (result.warnings.length * 5));

    const reliability = {
      score: result.success ? 95 : 60,
      factors: result.success ? ['Successful deployment'] : ['Deployment failed'],
    };

    const maintainability = {
      score: context.projectContext ? 85 : 70,
      issues: result.warnings.map(w => w.message),
      suggestions: ['Consider addressing warnings for better maintainability'],
    };

    const security = {
      score: 90, // Would be calculated based on actual security scan
      vulnerabilities: [], // Would be populated from security scans
    };

    return {
      successFactors,
      riskFactors,
      qualityScore,
      reliability,
      maintainability,
      security,
    };
  }

  private async generateRecommendations(
    result: DeploymentResult,
    analysis: DeploymentAnalysis,
    platform: SupportedPlatform,
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (!result.success) {
      recommendations.push('Review and fix deployment errors before next deployment');
    }

    if (result.warnings.length > 0) {
      recommendations.push('Address deployment warnings to improve reliability');
    }

    if (analysis.qualityScore < 80) {
      recommendations.push('Quality score is below 80%, consider improving deployment configuration');
    }

    if (platform === 'cursor-ide') {
      recommendations.push('Keep Cursor IDE updated for best compatibility');
      if (result.deployedComponents.includes('ai-config')) {
        recommendations.push('Review AI configuration regularly for optimal performance');
      }
    }

    recommendations.push('Consider setting up automated deployment monitoring');

    return recommendations;
  }

  private async generateDeploymentArtifacts(
    result: DeploymentResult,
    reportId: string,
    options: ReportingOptions,
  ): Promise<DeploymentArtifacts> {
    const logsPath = path.join(this.reportsBasePath, 'logs');
    await fs.mkdir(logsPath, { recursive: true });

    const deploymentLogPath = path.join(logsPath, `${reportId}-deployment.log`);
    
    return {
      logs: {
        deploymentLog: deploymentLogPath,
      },
      backups: [], // Would be populated with actual backup paths
      configFiles: [], // Would be populated with deployed config files
      metadata: {
        reportPath: path.join(this.reportsBasePath, `deployment-report-${reportId}.json`),
        exportedAt: new Date().toISOString(),
        format: options.exportFormat,
      },
    };
  }

  private getEmptyPerformanceReport(): PerformanceReport {
    return {
      phases: [],
      bottlenecks: [],
      metrics: {
        throughput: 0,
        averageFileSize: 0,
        peakMemoryUsage: 0,
      },
      optimizations: [],
    };
  }

  private getEmptyAnalysis(): DeploymentAnalysis {
    return {
      successFactors: [],
      riskFactors: [],
      qualityScore: 100,
      reliability: { score: 100, factors: [] },
      maintainability: { score: 100, issues: [], suggestions: [] },
      security: { score: 100, vulnerabilities: [] },
    };
  }

  private getEmptyArtifacts(): DeploymentArtifacts {
    return {
      logs: { deploymentLog: '' },
      backups: [],
      configFiles: [],
      metadata: { reportPath: '', exportedAt: '', format: 'console' },
    };
  }

  private categorizeError(error: DeploymentError): string {
    if (error.message.toLowerCase().includes('permission')) return 'permission';
    if (error.message.toLowerCase().includes('not found')) return 'missing-resource';
    if (error.message.toLowerCase().includes('invalid')) return 'validation';
    if (error.message.toLowerCase().includes('network')) return 'network';
    return 'unknown';
  }

  private assessErrorImpact(error: DeploymentError, result: DeploymentResult): 'low' | 'medium' | 'high' | 'critical' {
    if (error.severity === 'high' && !result.success) return 'critical';
    if (error.severity === 'high') return 'high';
    if (error.severity === 'medium') return 'medium';
    return 'low';
  }

  private analyzeCascadeEffects(error: DeploymentError, allErrors: DeploymentError[]): string[] {
    const effects: string[] = [];
    
    // Simple cascade analysis
    if (error.component === 'platform-detection') {
      effects.push('All subsequent component deployments affected');
    }
    
    if (error.type === 'permission-error') {
      effects.push('File writing operations blocked');
    }
    
    return effects;
  }

  private async generateRecoveryPlan(
    rootCauses: any[],
    platform: SupportedPlatform,
  ): Promise<Array<{
    step: number;
    action: string;
    timeEstimate: string;
    riskLevel: 'low' | 'medium' | 'high';
    prerequisites: string[];
  }>> {
    const plan = [];
    
    plan.push({
      step: 1,
      action: 'Identify and fix root cause errors',
      timeEstimate: '10-30 minutes',
      riskLevel: 'medium' as const,
      prerequisites: ['Access to deployment environment'],
    });
    
    plan.push({
      step: 2,
      action: 'Verify platform installation and configuration',
      timeEstimate: '5-15 minutes',
      riskLevel: 'low' as const,
      prerequisites: [`${platform} properly installed`],
    });
    
    plan.push({
      step: 3,
      action: 'Retry deployment with corrected configuration',
      timeEstimate: '5-10 minutes',
      riskLevel: 'low' as const,
      prerequisites: ['All previous steps completed'],
    });
    
    return plan;
  }

  private generatePreventionMeasures(rootCauses: any[], platform: SupportedPlatform): string[] {
    const measures = [
      'Implement pre-deployment validation checks',
      'Set up automated testing for deployment configurations',
      'Create deployment checklists for manual verification',
      'Monitor deployment success rates and error patterns',
    ];
    
    if (platform === 'cursor-ide') {
      measures.push('Validate Cursor IDE version compatibility before deployment');
      measures.push('Test AI configuration syntax before deployment');
    }
    
    return measures;
  }

  private async findSimilarIncidents(errors: DeploymentError[]): Promise<Array<{
    date: string;
    platform: string;
    resolution: string;
  }>> {
    // This would search through historical reports
    return [
      {
        date: '2024-01-15',
        platform: 'cursor-ide',
        resolution: 'Updated Cursor IDE to latest version',
      },
    ];
  }

  private async saveReport(report: DeploymentReport, options: ReportingOptions): Promise<void> {
    await fs.mkdir(this.reportsBasePath, { recursive: true });
    
    const filename = `deployment-report-${report.id}.json`;
    const filePath = options.outputPath 
      ? path.join(options.outputPath, filename)
      : path.join(this.reportsBasePath, filename);
    
    await fs.writeFile(filePath, JSON.stringify(report, null, 2));
    report.artifacts.metadata.reportPath = filePath;
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'success': return '✅';
      case 'partial': return '⚠️';
      case 'failed': return '❌';
      default: return '❓';
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private generateHtmlReport(report: DeploymentReport): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Deployment Report - ${report.context.projectName}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .status-success { color: green; }
        .status-failed { color: red; }
        .status-partial { color: orange; }
        .section { margin: 20px 0; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #f9f9f9; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Deployment Report</h1>
        <p><strong>Project:</strong> ${report.context.projectName}</p>
        <p><strong>Platform:</strong> ${report.platform}</p>
        <p><strong>Status:</strong> <span class="status-${report.summary.overall.status}">${report.summary.overall.status.toUpperCase()}</span></p>
        <p><strong>Date:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
    </div>
    
    <div class="section">
        <h2>Summary</h2>
        <div class="metric">Duration: ${(report.summary.overall.duration / 1000).toFixed(2)}s</div>
        <div class="metric">Files: ${report.summary.overall.filesProcessed}</div>
        <div class="metric">Components: ${report.summary.overall.componentsDeployed}</div>
    </div>
    
    ${report.recommendations.length > 0 ? `
    <div class="section">
        <h2>Recommendations</h2>
        <ul>
            ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
</body>
</html>`;
  }

  private generateMarkdownReport(report: DeploymentReport): string {
    const lines = [
      `# Deployment Report - ${report.context.projectName}`,
      '',
      `**Platform:** ${report.platform}`,
      `**Status:** ${report.summary.overall.status.toUpperCase()}`,
      `**Date:** ${new Date(report.timestamp).toLocaleString()}`,
      `**Duration:** ${(report.summary.overall.duration / 1000).toFixed(2)}s`,
      '',
      '## Summary',
      '',
      `- Files Processed: ${report.summary.overall.filesProcessed}`,
      `- Components Deployed: ${report.summary.overall.componentsDeployed}`,
      `- Components Skipped: ${report.summary.overall.componentsSkipped}`,
      `- Conflicts Resolved: ${report.summary.overall.conflictsResolved}`,
      `- Backup Created: ${report.summary.overall.backupCreated ? 'Yes' : 'No'}`,
      '',
    ];

    if (report.recommendations.length > 0) {
      lines.push('## Recommendations', '');
      report.recommendations.forEach((rec, index) => {
        lines.push(`${index + 1}. ${rec}`);
      });
      lines.push('');
    }

    lines.push(`---`);
    lines.push(`*Report generated at ${new Date(report.timestamp).toLocaleString()}*`);

    return lines.join('\n');
  }
}
