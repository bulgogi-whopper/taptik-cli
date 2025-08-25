import { Injectable, Logger } from '@nestjs/common';

import { CursorExtensionsConfig, CursorInstalledExtension } from '../interfaces/cursor-extensions.interface';

export interface CursorExtensionCompatibilityResult {
  compatible: boolean;
  issues: CursorExtensionCompatibilityIssue[];
  warnings: CursorExtensionCompatibilityWarning[];
  recommendations: string[];
  statistics: CursorExtensionStatistics;
}

export interface CursorExtensionCompatibilityIssue {
  extensionId: string;
  type: 'version_conflict' | 'dependency_missing' | 'incompatible_engine' | 'security_risk' | 'marketplace_unavailable';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  details: any;
  fixable: boolean;
  solution?: string;
}

export interface CursorExtensionCompatibilityWarning {
  extensionId: string;
  type: 'deprecated' | 'outdated' | 'performance_impact' | 'license_issue' | 'experimental';
  message: string;
  details?: any;
  recommendation: string;
}

export interface CursorExtensionStatistics {
  totalExtensions: number;
  enabledExtensions: number;
  disabledExtensions: number;
  compatibleExtensions: number;
  incompatibleExtensions: number;
  securityRisks: number;
  performanceImpact: number;
  totalSize: number;
  averageRating: number;
  categories: Record<string, number>;
  publishers: Record<string, number>;
}

export interface CursorExtensionMetadata {
  id: string;
  displayName: string;
  description: string;
  version: string;
  publisher: string;
  categories: string[];
  engines: Record<string, string>;
  dependencies: string[];
  extensionDependencies: string[];
  rating: number;
  downloads: number;
  lastUpdated: string;
  license: string;
  repository?: string;
  bugs?: string;
  homepage?: string;
  preview?: boolean;
  deprecated?: boolean;
  securityRisk?: boolean;
  performanceImpact?: 'low' | 'medium' | 'high';
}

@Injectable()
export class CursorExtensionValidatorService {
  private readonly logger = new Logger(CursorExtensionValidatorService.name);

  // Minimum supported Cursor version
  private readonly MIN_CURSOR_VERSION = '0.38.0';
  private readonly CURRENT_CURSOR_VERSION = '0.41.0';

  // Known problematic extensions
  private readonly KNOWN_ISSUES = new Map<string, {
    type: 'security' | 'performance' | 'compatibility' | 'deprecated';
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    solution?: string;
  }>([
    ['ms-vscode.vscode-json', {
      type: 'deprecated',
      severity: 'low',
      message: 'This extension is deprecated and functionality is built into Cursor',
      solution: 'Remove this extension as it\'s no longer needed'
    }],
    ['ms-python.python', {
      type: 'performance',
      severity: 'medium',
      message: 'Large extension that may impact startup performance',
      solution: 'Consider using lighter alternatives if not actively developing Python'
    }],
    ['ms-vscode.cpptools', {
      type: 'performance',
      severity: 'high',
      message: 'C++ extension can significantly impact performance',
      solution: 'Only install if actively developing C/C++ projects'
    }]
  ]);

  // Extension categories and their typical performance impact
  private readonly CATEGORY_PERFORMANCE_IMPACT = new Map<string, 'low' | 'medium' | 'high'>([
    ['Programming Languages', 'high'],
    ['Debuggers', 'medium'],
    ['Formatters', 'low'],
    ['Linters', 'medium'],
    ['Themes', 'low'],
    ['Snippets', 'low'],
    ['Other', 'low'],
    ['Extension Packs', 'high']
  ]);

  // Trusted publishers
  private readonly TRUSTED_PUBLISHERS = new Set([
    'microsoft',
    'ms-vscode',
    'ms-python',
    'ms-dotnettools',
    'redhat',
    'golang',
    'rust-lang',
    'bradlc',
    'esbenp',
    'formulahendry',
    'ritwickdey',
    'pkief'
  ]);

  async validateExtensionCompatibility(
    config: CursorExtensionsConfig,
    cursorVersion: string = this.CURRENT_CURSOR_VERSION
  ): Promise<CursorExtensionCompatibilityResult> {
    this.logger.log(`Validating extension compatibility for Cursor v${cursorVersion}...`);

    const result: CursorExtensionCompatibilityResult = {
      compatible: true,
      issues: [],
      warnings: [],
      recommendations: [],
      statistics: {
        totalExtensions: 0,
        enabledExtensions: 0,
        disabledExtensions: 0,
        compatibleExtensions: 0,
        incompatibleExtensions: 0,
        securityRisks: 0,
        performanceImpact: 0,
        totalSize: 0,
        averageRating: 0,
        categories: {},
        publishers: {},
      },
    };

    try {
      // Validate recommendations
      if (config.recommendations) {
        await this.validateRecommendations(config.recommendations, result);
      }

      // Validate installed extensions
      if (config.installed) {
        await this.validateInstalledExtensions(config.installed, cursorVersion, result);
      }

      // Check for conflicts between recommendations and unwanted
      this.checkRecommendationConflicts(config, result);

      // Validate marketplace settings
      if (config.marketplace) {
        this.validateMarketplaceSettings(config.marketplace, result);
      }

      // Generate recommendations
      this.generateRecommendations(result);

      // Calculate final statistics
      this.calculateStatistics(config, result);

      // Determine overall compatibility
      result.compatible = result.issues.length === 0 || 
        !result.issues.some(issue => issue.severity === 'critical' || issue.severity === 'high');

      this.logger.log(`Extension compatibility validation completed: ${result.compatible ? 'COMPATIBLE' : 'INCOMPATIBLE'}`);
      this.logger.log(`Statistics: ${JSON.stringify(result.statistics)}`);

      return result;

    } catch (error) {
      this.logger.error('Extension compatibility validation failed:', error);
      result.compatible = false;
      result.issues.push({
        extensionId: 'system',
        type: 'incompatible_engine',
        severity: 'critical',
        message: `Validation failed: ${(error as Error).message}`,
        details: error,
        fixable: false,
      });
      return result;
    }
  }

  private async validateRecommendations(
    recommendations: string[],
    result: CursorExtensionCompatibilityResult
  ): Promise<void> {
    for (const extensionId of recommendations) {
      // Check for known issues
      const knownIssue = this.KNOWN_ISSUES.get(extensionId);
      if (knownIssue) {
        if (knownIssue.type === 'security') {
          result.issues.push({
            extensionId,
            type: 'security_risk',
            severity: knownIssue.severity,
            message: knownIssue.message,
            details: { reason: knownIssue.type },
            fixable: true,
            solution: knownIssue.solution,
          });
          result.statistics.securityRisks++;
        } else {
          result.warnings.push({
            extensionId,
            type: knownIssue.type,
            message: knownIssue.message,
            details: { severity: knownIssue.severity },
            recommendation: knownIssue.solution || 'Review extension necessity',
          });
        }
      }

      // Validate extension ID format
      if (!this.isValidExtensionId(extensionId)) {
        result.issues.push({
          extensionId,
          type: 'marketplace_unavailable',
          severity: 'medium',
          message: `Invalid extension ID format: ${extensionId}`,
          details: { format: 'Expected publisher.name format' },
          fixable: true,
          solution: 'Correct the extension ID to publisher.name format',
        });
      }

      // Check publisher trustworthiness
      const [publisher] = extensionId.split('.');
      if (publisher && !this.TRUSTED_PUBLISHERS.has(publisher)) {
        result.warnings.push({
          extensionId,
          type: 'security_risk',
          message: `Extension from untrusted publisher: ${publisher}`,
          recommendation: 'Verify publisher reputation before installation',
        });
      }

      // Update publisher statistics
      if (publisher) {
        result.statistics.publishers[publisher] = (result.statistics.publishers[publisher] || 0) + 1;
      }
    }
  }

  private async validateInstalledExtensions(
    installed: CursorInstalledExtension[],
    cursorVersion: string,
    result: CursorExtensionCompatibilityResult
  ): Promise<void> {
    result.statistics.totalExtensions = installed.length;

    for (const extension of installed) {
      // Count enabled/disabled
      if (extension.enabled) {
        result.statistics.enabledExtensions++;
      } else {
        result.statistics.disabledExtensions++;
      }

      // Validate extension metadata
      await this.validateExtensionMetadata(extension, cursorVersion, result);

      // Check for known issues
      const knownIssue = this.KNOWN_ISSUES.get(extension.id);
      if (knownIssue) {
        if (knownIssue.type === 'security') {
          result.issues.push({
            extensionId: extension.id,
            type: 'security_risk',
            severity: knownIssue.severity,
            message: knownIssue.message,
            details: { installed: true },
            fixable: true,
            solution: knownIssue.solution,
          });
          result.statistics.securityRisks++;
        } else if (knownIssue.severity === 'high') {
          result.issues.push({
            extensionId: extension.id,
            type: knownIssue.type as any,
            severity: knownIssue.severity,
            message: knownIssue.message,
            details: { installed: true },
            fixable: true,
            solution: knownIssue.solution,
          });
        }
      }

      // Check version compatibility
      if (extension.version && !this.isVersionCompatible(extension.version, cursorVersion)) {
        result.issues.push({
          extensionId: extension.id,
          type: 'version_conflict',
          severity: 'medium',
          message: `Extension version ${extension.version} may not be compatible with Cursor ${cursorVersion}`,
          details: { extensionVersion: extension.version, cursorVersion },
          fixable: true,
          solution: 'Update to a compatible version or check with extension publisher',
        });
        result.statistics.incompatibleExtensions++;
      } else {
        result.statistics.compatibleExtensions++;
      }

      // Check dependencies
      if (extension.dependencies) {
        await this.validateExtensionDependencies(extension, installed, result);
      }

      // Categorize extension
      if (extension.metadata?.categories) {
        for (const category of extension.metadata.categories) {
          result.statistics.categories[category] = (result.statistics.categories[category] || 0) + 1;
          
          // Check performance impact
          const impact = this.CATEGORY_PERFORMANCE_IMPACT.get(category);
          if (impact === 'high' || impact === 'medium') {
            result.statistics.performanceImpact++;
          }
        }
      }

      // Estimate size and add to total
      const estimatedSize = this.getExtensionSizeEstimate(extension);
      result.statistics.totalSize += estimatedSize;
    }
  }

  private async validateExtensionMetadata(
    extension: CursorInstalledExtension,
    cursorVersion: string,
    result: CursorExtensionCompatibilityResult
  ): Promise<void> {
    // Check engine compatibility
    if (extension.metadata?.engines) {
      const vscodeEngine = extension.metadata.engines.vscode;
      if (vscodeEngine && !this.isEngineCompatible(vscodeEngine, cursorVersion)) {
        result.issues.push({
          extensionId: extension.id,
          type: 'incompatible_engine',
          severity: 'high',
          message: `Extension requires VSCode engine ${vscodeEngine}, but Cursor ${cursorVersion} may not be compatible`,
          details: { requiredEngine: vscodeEngine, cursorVersion },
          fixable: false,
          solution: 'Update Cursor or find an alternative extension',
        });
      }
    }

    // Check if extension is deprecated
    if (extension.metadata?.deprecated) {
      result.warnings.push({
        extensionId: extension.id,
        type: 'deprecated',
        message: 'Extension is deprecated and may not receive updates',
        recommendation: 'Look for actively maintained alternatives',
      });
    }

    // Check if extension is in preview
    if (extension.metadata?.preview) {
      result.warnings.push({
        extensionId: extension.id,
        type: 'experimental',
        message: 'Extension is in preview and may be unstable',
        recommendation: 'Use with caution in production environments',
      });
    }

    // Check last update date
    if (extension.updateDate) {
      const lastUpdate = new Date(extension.updateDate);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      if (lastUpdate < sixMonthsAgo) {
        result.warnings.push({
          extensionId: extension.id,
          type: 'outdated',
          message: `Extension hasn't been updated in over 6 months (last update: ${extension.updateDate})`,
          recommendation: 'Check if extension is still maintained or find alternatives',
        });
      }
    }
  }

  private async validateExtensionDependencies(
    extension: CursorInstalledExtension,
    allExtensions: CursorInstalledExtension[],
    result: CursorExtensionCompatibilityResult
  ): Promise<void> {
    const installedIds = new Set(allExtensions.map(ext => ext.id));

    for (const dependency of extension.dependencies || []) {
      if (!installedIds.has(dependency)) {
        result.issues.push({
          extensionId: extension.id,
          type: 'dependency_missing',
          severity: 'high',
          message: `Missing required dependency: ${dependency}`,
          details: { missingDependency: dependency },
          fixable: true,
          solution: `Install the missing dependency: ${dependency}`,
        });
      }
    }

    // Check extension dependencies (VS Code specific)
    for (const extDependency of extension.extensionDependencies || []) {
      if (!installedIds.has(extDependency)) {
        result.issues.push({
          extensionId: extension.id,
          type: 'dependency_missing',
          severity: 'medium',
          message: `Missing extension dependency: ${extDependency}`,
          details: { missingExtensionDependency: extDependency },
          fixable: true,
          solution: `Install the missing extension dependency: ${extDependency}`,
        });
      }
    }
  }

  private checkRecommendationConflicts(
    config: CursorExtensionsConfig,
    result: CursorExtensionCompatibilityResult
  ): void {
    if (!config.recommendations || !config.unwantedRecommendations) {
      return;
    }

    const conflicts = config.recommendations.filter(rec => 
      config.unwantedRecommendations!.includes(rec)
    );

    for (const conflict of conflicts) {
      result.warnings.push({
        extensionId: conflict,
        type: 'deprecated',
        message: 'Extension is both recommended and unwanted',
        recommendation: 'Remove from one of the lists to resolve conflict',
      });
    }
  }

  private validateMarketplaceSettings(
    marketplace: any,
    result: CursorExtensionCompatibilityResult
  ): void {
    // Check update interval
    if (marketplace.checkUpdatesInterval && marketplace.checkUpdatesInterval < 3600000) { // 1 hour
      result.warnings.push({
        extensionId: 'marketplace',
        type: 'performance_impact',
        message: `Update check interval is very frequent: ${marketplace.checkUpdatesInterval}ms`,
        recommendation: 'Consider increasing interval to reduce performance impact',
      });
    }

    // Check trusted providers
    if (marketplace.trustedExtensionAuthenticationProviders && 
        marketplace.trustedExtensionAuthenticationProviders.length > 10) {
      result.warnings.push({
        extensionId: 'marketplace',
        type: 'security_risk',
        message: 'Many trusted authentication providers configured',
        recommendation: 'Review and limit trusted providers for security',
      });
    }
  }

  private generateRecommendations(result: CursorExtensionCompatibilityResult): void {
    // Performance recommendations
    if (result.statistics.performanceImpact > 10) {
      result.recommendations.push(
        'Consider disabling unused extensions to improve performance'
      );
    }

    // Security recommendations
    if (result.statistics.securityRisks > 0) {
      result.recommendations.push(
        'Review and remove extensions with security risks'
      );
    }

    // Compatibility recommendations
    if (result.statistics.incompatibleExtensions > 0) {
      result.recommendations.push(
        'Update or replace incompatible extensions'
      );
    }

    // General recommendations
    if (result.statistics.totalExtensions > 50) {
      result.recommendations.push(
        'Consider organizing extensions into profiles or removing unused ones'
      );
    }

    if (Object.keys(result.statistics.publishers).length > 20) {
      result.recommendations.push(
        'Many different publishers - consider consolidating to trusted publishers'
      );
    }
  }

  private calculateStatistics(
    config: CursorExtensionsConfig,
    result: CursorExtensionCompatibilityResult
  ): void {
    // Calculate average rating if available
    if (config.installed) {
      const ratingsSum = config.installed
        .map(ext => ext.metadata?.rating || 0)
        .reduce((sum, rating) => sum + rating, 0);
      
      result.statistics.averageRating = config.installed.length > 0 ? 
        ratingsSum / config.installed.length : 0;
    }
  }

  private isValidExtensionId(id: string): boolean {
    return /^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/i.test(id);
  }

  private isVersionCompatible(extensionVersion: string, cursorVersion: string): boolean {
    // Simple version compatibility check
    // In a real implementation, this would be more sophisticated
    try {
      const extParts = extensionVersion.split('.').map(Number);
      const cursorParts = cursorVersion.split('.').map(Number);
      
      // Major version compatibility
      return extParts[0] <= cursorParts[0];
    } catch {
      return false; // Invalid version format
    }
  }

  private isEngineCompatible(engineVersion: string, cursorVersion: string): boolean {
    // Check if Cursor version is compatible with required VSCode engine
    // This is a simplified check - real implementation would be more complex
    const engineMatch = engineVersion.match(/\^?(\d+)\.(\d+)\.(\d+)/);
    if (!engineMatch) return false;

    const requiredMajor = parseInt(engineMatch[1]);
    const requiredMinor = parseInt(engineMatch[2]);
    
    // Cursor 0.41.0 roughly corresponds to VSCode 1.74.0
    // This is a rough mapping and would need to be more accurate in production
    const cursorMajor = 1;
    const cursorMinor = 74;

    return cursorMajor > requiredMajor || 
           (cursorMajor === requiredMajor && cursorMinor >= requiredMinor);
  }

  private getExtensionSizeEstimate(extension: CursorInstalledExtension): number {
    // Estimate extension size based on category and complexity
    const baseSize = 1024 * 1024; // 1MB base
    let multiplier = 1;

    if (extension.metadata?.categories) {
      for (const category of extension.metadata.categories) {
        const impact = this.CATEGORY_PERFORMANCE_IMPACT.get(category);
        if (impact === 'high') {
          multiplier += 2;
        } else if (impact === 'medium') {
          multiplier += 1;
        }
      }
    }

    return Math.round(baseSize * multiplier);
  }

  // Public utility methods
  async validateSingleExtension(
    extensionId: string,
    version?: string,
    cursorVersion: string = this.CURRENT_CURSOR_VERSION
  ): Promise<{
    compatible: boolean;
    issues: CursorExtensionCompatibilityIssue[];
    warnings: CursorExtensionCompatibilityWarning[];
  }> {
    const config: CursorExtensionsConfig = {
      recommendations: [extensionId],
      installed: version ? [{ id: extensionId, version, enabled: true }] : undefined,
    };

    const result = await this.validateExtensionCompatibility(config, cursorVersion);
    
    return {
      compatible: !result.issues.some(issue => 
        issue.extensionId === extensionId && 
        (issue.severity === 'critical' || issue.severity === 'high')
      ),
      issues: result.issues.filter(issue => issue.extensionId === extensionId),
      warnings: result.warnings.filter(warning => warning.extensionId === extensionId),
    };
  }

  getKnownIssues(): Map<string, any> {
    return new Map(this.KNOWN_ISSUES);
  }

  getTrustedPublishers(): Set<string> {
    return new Set(this.TRUSTED_PUBLISHERS);
  }

  getCategoryPerformanceImpact(): Map<string, string> {
    return new Map(this.CATEGORY_PERFORMANCE_IMPACT);
  }
}