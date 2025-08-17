import { Injectable, Logger } from '@nestjs/common';

import { TaptikContext, AIPlatform } from '../interfaces';
import { ConversionResult } from '../interfaces/strategy.interface';

export interface ConversionReport {
  id: string;
  timestamp: string;
  source: {
    platform: AIPlatform;
    version?: string;
    features: string[];
  };
  target: {
    platform: AIPlatform;
    version?: string;
    features: string[];
  };
  mapping: {
    direct: number;
    approximated: number;
    unsupported: number;
    total: number;
  };
  compatibility: {
    score: number;
    rating: 'excellent' | 'good' | 'fair' | 'poor';
    reversible: boolean;
  };
  dataLoss: {
    features: string[];
    severity: 'none' | 'low' | 'medium' | 'high';
    details: Array<{
      feature: string;
      reason: string;
      impact: string;
    }>;
  };
  performance: {
    duration: number;
    contextSize: number;
    compressionRatio?: number;
  };
  recommendations: string[];
  warnings: string[];
  errors: string[];
}

export interface ValidationReport {
  valid: boolean;
  score: number;
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    field: string;
    message: string;
    suggestion?: string;
  }>;
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
}

@Injectable()
export class ConversionReporterService {
  private readonly logger = new Logger(ConversionReporterService.name);
  private reports: Map<string, ConversionReport> = new Map();

  /**
   * Generate a conversion report
   */
  generateReport(
    sourceContext: TaptikContext,
    targetContext: TaptikContext | undefined,
    result: ConversionResult,
    duration: number,
  ): ConversionReport {
    const reportId = this.generateReportId();
    const sourcePlatform = this.detectPlatform(sourceContext);
    const targetPlatform = targetContext ? this.detectPlatform(targetContext) : null;

    const report: ConversionReport = {
      id: reportId,
      timestamp: new Date().toISOString(),
      source: {
        platform: sourcePlatform || AIPlatform.KIRO,
        version: sourceContext.version,
        features: this.extractFeatures(sourceContext),
      },
      target: {
        platform: targetPlatform || AIPlatform.CLAUDE_CODE,
        version: targetContext?.version,
        features: targetContext ? this.extractFeatures(targetContext) : [],
      },
      mapping: this.calculateMappingStats(result),
      compatibility: this.calculateCompatibility(result),
      dataLoss: this.analyzeDataLoss(result),
      performance: {
        duration,
        contextSize: this.calculateContextSize(sourceContext),
        compressionRatio: this.calculateCompressionRatio(sourceContext, targetContext),
      },
      recommendations: this.generateRecommendations(result),
      warnings: result.warnings || [],
      errors: result.error ? [result.error] : [],
    };

    // Store report
    this.reports.set(reportId, report);

    return report;
  }

  /**
   * Validate conversion result
   */
  validateConversion(
    sourceContext: TaptikContext,
    targetContext: TaptikContext,
    expectedFeatures?: string[],
  ): ValidationReport {
    const issues: ValidationReport['issues'] = [];
    const sourceFeatures = this.extractFeatures(sourceContext);
    const targetFeatures = this.extractFeatures(targetContext);

    // Check for missing critical features
    const criticalFeatures = expectedFeatures || this.getCriticalFeatures(sourceContext);
    for (const feature of criticalFeatures) {
      if (sourceFeatures.includes(feature) && !targetFeatures.includes(feature)) {
        issues.push({
          severity: 'error',
          field: feature,
          message: `Critical feature '${feature}' was lost during conversion`,
          suggestion: 'Check if the target platform supports this feature',
        });
      }
    }

    // Check for data integrity
    const integrityIssues = this.validateDataIntegrity(sourceContext, targetContext);
    issues.push(...integrityIssues);

    // Check for structural consistency
    const structureIssues = this.validateStructure(targetContext);
    issues.push(...structureIssues);

    // Calculate validation score
    const score = this.calculateValidationScore(issues);

    return {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      score,
      issues,
      summary: {
        errors: issues.filter(i => i.severity === 'error').length,
        warnings: issues.filter(i => i.severity === 'warning').length,
        info: issues.filter(i => i.severity === 'info').length,
      },
    };
  }

  /**
   * Compare two contexts for differences
   */
  compareContexts(
    context1: TaptikContext,
    context2: TaptikContext,
  ): {
    identical: boolean;
    differences: Array<{
      path: string;
      value1: any;
      value2: any;
      type: 'added' | 'removed' | 'modified';
    }>;
    similarity: number;
  } {
    const differences: any[] = [];
    
    // Deep comparison
    this.deepCompare(context1, context2, '', differences);

    // Calculate similarity score
    const similarity = this.calculateSimilarity(context1, context2, differences);

    return {
      identical: differences.length === 0,
      differences,
      similarity,
    };
  }

  /**
   * Format report for display
   */
  formatReport(report: ConversionReport, format: 'text' | 'json' | 'markdown' = 'text'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);

      case 'markdown':
        return this.formatMarkdownReport(report);

      case 'text':
      default:
        return this.formatTextReport(report);
    }
  }

  /**
   * Get stored report by ID
   */
  getReport(reportId: string): ConversionReport | undefined {
    return this.reports.get(reportId);
  }

  /**
   * Get all reports
   */
  getAllReports(): ConversionReport[] {
    return [...this.reports.values()];
  }

  /**
   * Clear stored reports
   */
  clearReports(): void {
    this.reports.clear();
  }

  // Private helper methods

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  private detectPlatform(context: TaptikContext): AIPlatform | null {
    if (context.metadata?.platforms && context.metadata.platforms.length > 0) {
      return context.metadata.platforms[0];
    }

    if (context.ide?.data) {
      if (context.ide.data.kiro) return AIPlatform.KIRO;
      if (context.ide.data.claude_code) return AIPlatform.CLAUDE_CODE;
      if (context.ide.data.cursor) return AIPlatform.CURSOR;
    }

    return null;
  }

  private extractFeatures(context: TaptikContext): string[] {
    const features: string[] = [];

    // Extract from IDE data
    if (context.ide?.data) {
      const platformData = Object.values(context.ide.data)[0];
      if (platformData && typeof platformData === 'object') {
        for (const [key, value] of Object.entries(platformData)) {
          if (this.isValidFeature(value)) {
            features.push(key);
          }
        }
      }
    }

    // Extract from other categories
    if (context.personal && Object.keys(context.personal).length > 0) {
      features.push('personal_settings');
    }
    if (context.project && Object.keys(context.project).length > 0) {
      features.push('project_config');
    }
    if (context.prompts && Object.keys(context.prompts).length > 0) {
      features.push('prompts');
    }
    if (context.tools && Object.keys(context.tools).length > 0) {
      features.push('tools');
    }

    return features;
  }

  private isValidFeature(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    if (typeof value === 'string') return value.length > 0;
    return true;
  }

  private calculateMappingStats(result: ConversionResult): ConversionReport['mapping'] {
    const direct = result.context ? this.extractFeatures(result.context).length : 0;
    const approximated = result.approximations?.length || 0;
    const unsupported = result.unsupported_features?.length || 0;
    const total = direct + approximated + unsupported;

    return {
      direct,
      approximated,
      unsupported,
      total,
    };
  }

  private calculateCompatibility(result: ConversionResult): ConversionReport['compatibility'] {
    const mapping = this.calculateMappingStats(result);
    const score = mapping.total > 0
      ? Math.round(((mapping.direct + mapping.approximated * 0.7) / mapping.total) * 100)
      : 0;

    const rating = 
      score >= 90 ? 'excellent' :
      score >= 70 ? 'good' :
      score >= 50 ? 'fair' : 'poor';

    const reversible = mapping.unsupported === 0 && mapping.approximated < mapping.total * 0.3;

    return {
      score,
      rating,
      reversible,
    };
  }

  private analyzeDataLoss(result: ConversionResult): ConversionReport['dataLoss'] {
    const features = result.unsupported_features || [];
    const details = features.map(feature => ({
      feature,
      reason: 'Feature not supported in target platform',
      impact: this.assessImpact(feature),
    }));

    const severity = 
      features.length === 0 ? 'none' :
      features.length <= 2 ? 'low' :
      features.length <= 5 ? 'medium' : 'high';

    return {
      features,
      severity,
      details,
    };
  }

  private assessImpact(feature: string): string {
    // Assess impact based on feature type
    const criticalFeatures = ['auth', 'security', 'permissions', 'credentials'];
    const importantFeatures = ['settings', 'configuration', 'preferences'];
    
    if (criticalFeatures.some(cf => feature.toLowerCase().includes(cf))) {
      return 'Critical - May affect security or authentication';
    }
    if (importantFeatures.some(importantFeature => feature.toLowerCase().includes(importantFeature))) {
      return 'Important - May affect functionality';
    }
    return 'Minor - Cosmetic or optional feature';
  }

  private calculateContextSize(context: TaptikContext): number {
    const json = JSON.stringify(context);
    return Buffer.byteLength(json, 'utf8');
  }

  private calculateCompressionRatio(
    source: TaptikContext,
    target: TaptikContext | undefined,
  ): number | undefined {
    if (!target) return undefined;
    
    const sourceSize = this.calculateContextSize(source);
    const targetSize = this.calculateContextSize(target);
    
    return sourceSize > 0 ? targetSize / sourceSize : undefined;
  }

  private generateRecommendations(result: ConversionResult): string[] {
    const recommendations: string[] = [];

    if (result.unsupported_features && result.unsupported_features.length > 0) {
      recommendations.push('Review unsupported features and consider manual migration');
    }

    if (result.approximations && result.approximations.length > 0) {
      recommendations.push('Test approximated features thoroughly after conversion');
    }

    if (result.warnings && result.warnings.length > 0) {
      recommendations.push('Address warnings before deploying converted context');
    }

    if (!result.success) {
      recommendations.push('Conversion failed - check error messages and retry');
    }

    return recommendations;
  }

  private getCriticalFeatures(context: TaptikContext): string[] {
    const features: string[] = [];
    
    // Platform-specific critical features
    const platform = this.detectPlatform(context);
    
    switch (platform) {
      case AIPlatform.KIRO:
        features.push('specs_path', 'steering_rules', 'hooks');
        break;
      case AIPlatform.CLAUDE_CODE:
        features.push('claude_md', 'mcp_servers', 'settings');
        break;
      case AIPlatform.CURSOR:
        features.push('rules', 'settings');
        break;
    }

    return features;
  }

  private validateDataIntegrity(
    source: TaptikContext,
    target: TaptikContext,
  ): ValidationReport['issues'] {
    const issues: ValidationReport['issues'] = [];

    // Check version compatibility
    if (!target.version) {
      issues.push({
        severity: 'warning',
        field: 'version',
        message: 'Target context missing version information',
      });
    }

    // Check metadata
    if (!target.metadata) {
      issues.push({
        severity: 'error',
        field: 'metadata',
        message: 'Target context missing metadata',
      });
    }

    return issues;
  }

  private validateStructure(context: TaptikContext): ValidationReport['issues'] {
    const issues: ValidationReport['issues'] = [];

    // Check required fields
    if (!context.version) {
      issues.push({
        severity: 'error',
        field: 'version',
        message: 'Context missing required version field',
      });
    }

    if (!context.metadata) {
      issues.push({
        severity: 'error',
        field: 'metadata',
        message: 'Context missing required metadata field',
      });
    }

    // Check IDE data structure
    if (context.ide && !context.ide.data) {
      issues.push({
        severity: 'error',
        field: 'ide.data',
        message: 'IDE configuration missing data field',
      });
    }

    return issues;
  }

  private calculateValidationScore(issues: ValidationReport['issues']): number {
    const errorWeight = 10;
    const warningWeight = 3;
    const infoWeight = 1;

    const totalWeight = 
      issues.filter(i => i.severity === 'error').length * errorWeight +
      issues.filter(i => i.severity === 'warning').length * warningWeight +
      issues.filter(i => i.severity === 'info').length * infoWeight;

    return Math.max(0, 100 - totalWeight);
  }

  private deepCompare(object1: any, object2: any, path: string, differences: any[]): void {
    if (object1 === object2) return;

    if (typeof object1 !== typeof object2) {
      differences.push({
        path,
        value1: object1,
        value2: object2,
        type: 'modified',
      });
      return;
    }

    if (typeof object1 !== 'object' || object1 === null || object2 === null) {
      if (object1 !== object2) {
        differences.push({
          path,
          value1: object1,
          value2: object2,
          type: 'modified',
        });
      }
      return;
    }

    // Compare objects
    const keys1 = Object.keys(object1);
    const keys2 = Object.keys(object2);
    const allKeys = new Set([...keys1, ...keys2]);

    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key;
      
      if (!(key in object1)) {
        differences.push({
          path: newPath,
          value1: undefined,
          value2: object2[key],
          type: 'added',
        });
      } else if (!(key in object2)) {
        differences.push({
          path: newPath,
          value1: object1[key],
          value2: undefined,
          type: 'removed',
        });
      } else {
        this.deepCompare(object1[key], object2[key], newPath, differences);
      }
    }
  }

  private calculateSimilarity(
    context1: TaptikContext,
    context2: TaptikContext,
    differences: any[],
  ): number {
    const features1 = this.extractFeatures(context1);
    const features2 = this.extractFeatures(context2);
    
    const allFeatures = new Set([...features1, ...features2]);
    const commonFeatures = features1.filter(f => features2.includes(f));
    
    if (allFeatures.size === 0) return 100;
    
    const featureSimilarity = (commonFeatures.length / allFeatures.size) * 100;
    const differencePenalty = Math.min(differences.length * 2, 50);
    
    return Math.max(0, Math.round(featureSimilarity - differencePenalty));
  }

  private formatTextReport(report: ConversionReport): string {
    const lines: string[] = [
      '=== Conversion Report ===',
      `ID: ${report.id}`,
      `Timestamp: ${report.timestamp}`,
      '',
      `Source: ${report.source.platform} (${report.source.features.length} features)`,
      `Target: ${report.target.platform} (${report.target.features.length} features)`,
      '',
      '--- Mapping Statistics ---',
      `Direct mappings: ${report.mapping.direct}`,
      `Approximations: ${report.mapping.approximated}`,
      `Unsupported: ${report.mapping.unsupported}`,
      `Total features: ${report.mapping.total}`,
      '',
      '--- Compatibility ---',
      `Score: ${report.compatibility.score}%`,
      `Rating: ${report.compatibility.rating}`,
      `Reversible: ${report.compatibility.reversible ? 'Yes' : 'No'}`,
      '',
      '--- Data Loss ---',
      `Severity: ${report.dataLoss.severity}`,
      `Lost features: ${report.dataLoss.features.join(', ') || 'None'}`,
      '',
      '--- Performance ---',
      `Duration: ${report.performance.duration}ms`,
      `Context size: ${report.performance.contextSize} bytes`,
    ];

    if (report.performance.compressionRatio !== undefined) {
      lines.push(`Compression ratio: ${report.performance.compressionRatio.toFixed(2)}`);
    }

    if (report.recommendations.length > 0) {
      lines.push('', '--- Recommendations ---');
      report.recommendations.forEach(rec => lines.push(`• ${rec}`));
    }

    if (report.warnings.length > 0) {
      lines.push('', '--- Warnings ---');
      report.warnings.forEach(warn => lines.push(`⚠ ${warn}`));
    }

    if (report.errors.length > 0) {
      lines.push('', '--- Errors ---');
      report.errors.forEach(error => lines.push(`✗ ${error}`));
    }

    return lines.join('\n');
  }

  private formatMarkdownReport(report: ConversionReport): string {
    const lines: string[] = [
      '# Conversion Report',
      '',
      `**ID:** ${report.id}  `,
      `**Timestamp:** ${report.timestamp}  `,
      '',
      '## Platforms',
      `- **Source:** ${report.source.platform} (${report.source.features.length} features)`,
      `- **Target:** ${report.target.platform} (${report.target.features.length} features)`,
      '',
      '## Mapping Statistics',
      '| Type | Count |',
      '|------|-------|',
      `| Direct mappings | ${report.mapping.direct} |`,
      `| Approximations | ${report.mapping.approximated} |`,
      `| Unsupported | ${report.mapping.unsupported} |`,
      `| **Total** | **${report.mapping.total}** |`,
      '',
      '## Compatibility',
      `- **Score:** ${report.compatibility.score}%`,
      `- **Rating:** ${report.compatibility.rating}`,
      `- **Reversible:** ${report.compatibility.reversible ? '✓' : '✗'}`,
      '',
      '## Data Loss',
      `- **Severity:** ${report.dataLoss.severity}`,
      `- **Lost features:** ${report.dataLoss.features.length > 0 ? report.dataLoss.features.join(', ') : 'None'}`,
    ];

    if (report.dataLoss.details.length > 0) {
      lines.push('', '### Details');
      report.dataLoss.details.forEach(detail => {
        lines.push(`- **${detail.feature}**: ${detail.reason} (${detail.impact})`);
      });
    }

    lines.push(
      '',
      '## Performance',
      `- **Duration:** ${report.performance.duration}ms`,
      `- **Context size:** ${report.performance.contextSize} bytes`,
    );

    if (report.performance.compressionRatio !== undefined) {
      lines.push(`- **Compression ratio:** ${report.performance.compressionRatio.toFixed(2)}`);
    }

    if (report.recommendations.length > 0) {
      lines.push('', '## Recommendations');
      report.recommendations.forEach(rec => lines.push(`- ${rec}`));
    }

    if (report.warnings.length > 0) {
      lines.push('', '## ⚠️ Warnings');
      report.warnings.forEach(warn => lines.push(`- ${warn}`));
    }

    if (report.errors.length > 0) {
      lines.push('', '## ❌ Errors');
      report.errors.forEach(error => lines.push(`- ${error}`));
    }

    return lines.join('\n');
  }
}