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

  /**
   * Task 4.3: Validate workspace structure for Cursor compatibility
   */
  async validateWorkspaceStructure(workspaceConfig: any): Promise<{
    valid: boolean;
    issues: Array<{
      type: 'structure' | 'permissions' | 'size' | 'compatibility';
      severity: 'critical' | 'high' | 'medium' | 'low';
      message: string;
      path?: string;
      suggestion: string;
    }>;
    warnings: Array<{
      type: 'performance' | 'best_practice' | 'compatibility';
      message: string;
      path?: string;
      recommendation: string;
    }>;
    statistics: {
      totalFolders: number;
      totalSettings: number;
      largestFolder: { path: string; estimatedSize: number };
      settingsComplexity: 'low' | 'medium' | 'high';
      cursorSpecificSettings: number;
    };
  }> {
    this.logger.log('Validating workspace structure for Cursor compatibility...');

    const result = {
      valid: true,
      issues: [] as Array<{
        type: 'structure' | 'permissions' | 'size' | 'compatibility';
        severity: 'critical' | 'high' | 'medium' | 'low';
        message: string;
        path?: string;
        suggestion: string;
      }>,
      warnings: [] as Array<{
        type: 'performance' | 'best_practice' | 'compatibility';
        message: string;
        path?: string;
        recommendation: string;
      }>,
      statistics: {
        totalFolders: 0,
        totalSettings: 0,
        largestFolder: { path: '', estimatedSize: 0 },
        settingsComplexity: 'low' as 'low' | 'medium' | 'high',
        cursorSpecificSettings: 0,
      },
    };

    try {
      // Validate workspace name
      if (!workspaceConfig.name || typeof workspaceConfig.name !== 'string') {
        result.issues.push({
          type: 'structure',
          severity: 'medium',
          message: 'Workspace missing name or invalid name type',
          path: 'name',
          suggestion: 'Provide a valid string name for the workspace',
        });
      } else if (workspaceConfig.name.length > 100) {
        result.warnings.push({
          type: 'best_practice',
          message: 'Workspace name is very long',
          path: 'name',
          recommendation: 'Consider using a shorter, more descriptive name',
        });
      }

      // Validate folder structure
      if (workspaceConfig.folders && Array.isArray(workspaceConfig.folders)) {
        result.statistics.totalFolders = workspaceConfig.folders.length;
        
        for (let i = 0; i < workspaceConfig.folders.length; i++) {
          const folder = workspaceConfig.folders[i];
          await this.validateWorkspaceFolder(folder, i, result);
        }
      }

      // Validate settings
      if (workspaceConfig.settings && typeof workspaceConfig.settings === 'object') {
        result.statistics.totalSettings = Object.keys(workspaceConfig.settings).length;
        await this.validateWorkspaceSettings(workspaceConfig.settings, result);
      }

      // Validate extensions configuration
      if (workspaceConfig.extensions) {
        await this.validateWorkspaceExtensions(workspaceConfig.extensions, result);
      }

      // Check overall workspace complexity
      this.assessWorkspaceComplexity(workspaceConfig, result);

      // Determine overall validity
      result.valid = result.issues.length === 0 || 
        !result.issues.some(issue => issue.severity === 'critical' || issue.severity === 'high');

      return result;

    } catch (error) {
      this.logger.error('Workspace structure validation failed:', error);
      result.valid = false;
      result.issues.push({
        type: 'structure',
        severity: 'critical',
        message: `Workspace validation failed: ${(error as Error).message}`,
        suggestion: 'Check workspace configuration structure and fix any syntax errors',
      });
      return result;
    }
  }

  /**
   * Task 4.3: Validate snippet syntax for Cursor compatibility
   */
  async validateSnippetSyntax(snippetsConfig: Record<string, any>): Promise<{
    valid: boolean;
    issues: Array<{
      language: string;
      snippet: string;
      type: 'syntax' | 'format' | 'placeholder' | 'scope';
      severity: 'critical' | 'high' | 'medium' | 'low';
      message: string;
      line?: number;
      suggestion: string;
    }>;
    warnings: Array<{
      language: string;
      snippet: string;
      type: 'best_practice' | 'performance' | 'compatibility';
      message: string;
      recommendation: string;
    }>;
    statistics: {
      totalLanguages: number;
      totalSnippets: number;
      averageSnippetLength: number;
      mostComplexSnippet: { language: string; name: string; complexity: number };
      placeholderCount: number;
      scopeCount: number;
    };
  }> {
    this.logger.log('Validating snippet syntax for Cursor compatibility...');

    const result = {
      valid: true,
      issues: [] as Array<{
        language: string;
        snippet: string;
        type: 'syntax' | 'format' | 'placeholder' | 'scope';
        severity: 'critical' | 'high' | 'medium' | 'low';
        message: string;
        line?: number;
        suggestion: string;
      }>,
      warnings: [] as Array<{
        language: string;
        snippet: string;
        type: 'best_practice' | 'performance' | 'compatibility';
        message: string;
        recommendation: string;
      }>,
      statistics: {
        totalLanguages: 0,
        totalSnippets: 0,
        averageSnippetLength: 0,
        mostComplexSnippet: { language: '', name: '', complexity: 0 },
        placeholderCount: 0,
        scopeCount: 0,
      },
    };

    try {
      const languages = Object.keys(snippetsConfig);
      result.statistics.totalLanguages = languages.length;
      let totalSnippetLength = 0;
      let snippetCount = 0;

      for (const language of languages) {
        const languageSnippets = snippetsConfig[language];
        
        if (!languageSnippets || typeof languageSnippets !== 'object') {
          result.issues.push({
            language,
            snippet: '',
            type: 'format',
            severity: 'high',
            message: `Invalid snippets format for language: ${language}`,
            suggestion: 'Ensure snippets are defined as objects with snippet definitions',
          });
          continue;
        }

        const snippetNames = Object.keys(languageSnippets);
        result.statistics.totalSnippets += snippetNames.length;

        for (const snippetName of snippetNames) {
          const snippet = languageSnippets[snippetName];
          snippetCount++;

          await this.validateIndividualSnippet(language, snippetName, snippet, result);

          // Calculate snippet complexity and length
          const complexity = this.calculateSnippetComplexity(snippet);
          if (complexity > result.statistics.mostComplexSnippet.complexity) {
            result.statistics.mostComplexSnippet = {
              language,
              name: snippetName,
              complexity,
            };
          }

          if (snippet.body && Array.isArray(snippet.body)) {
            const snippetLength = snippet.body.join('\n').length;
            totalSnippetLength += snippetLength;

            // Count placeholders
            const placeholders = snippet.body.join('\n').match(/\$\{[^}]+\}/g);
            if (placeholders) {
              result.statistics.placeholderCount += placeholders.length;
            }
          }

          // Count scopes
          if (snippet.scope) {
            result.statistics.scopeCount++;
          }
        }
      }

      // Calculate average snippet length
      result.statistics.averageSnippetLength = snippetCount > 0 ? 
        Math.round(totalSnippetLength / snippetCount) : 0;

      // Determine overall validity
      result.valid = result.issues.length === 0 || 
        !result.issues.some(issue => issue.severity === 'critical' || issue.severity === 'high');

      return result;

    } catch (error) {
      this.logger.error('Snippet syntax validation failed:', error);
      result.valid = false;
      result.issues.push({
        language: '',
        snippet: '',
        type: 'syntax',
        severity: 'critical',
        message: `Snippet validation failed: ${(error as Error).message}`,
        suggestion: 'Check snippet configuration structure and fix any syntax errors',
      });
      return result;
    }
  }

  /**
   * Task 4.3: Enhanced Cursor version compatibility validation
   */
  async validateCursorVersionCompatibility(
    config: any,
    targetCursorVersion: string = this.CURRENT_CURSOR_VERSION
  ): Promise<{
    compatible: boolean;
    issues: Array<{
      component: string;
      type: 'version_mismatch' | 'feature_unavailable' | 'breaking_change';
      severity: 'critical' | 'high' | 'medium' | 'low';
      message: string;
      currentVersion?: string;
      requiredVersion?: string;
      suggestion: string;
    }>;
    warnings: Array<{
      component: string;
      type: 'deprecation' | 'compatibility' | 'performance';
      message: string;
      recommendation: string;
    }>;
    versionInfo: {
      targetVersion: string;
      minSupportedVersion: string;
      recommendedVersion: string;
      featureCompatibility: Record<string, boolean>;
      breakingChanges: string[];
    };
  }> {
    this.logger.log(`Validating compatibility with Cursor v${targetCursorVersion}...`);

    const result = {
      compatible: true,
      issues: [] as Array<{
        component: string;
        type: 'version_mismatch' | 'feature_unavailable' | 'breaking_change';
        severity: 'critical' | 'high' | 'medium' | 'low';
        message: string;
        currentVersion?: string;
        requiredVersion?: string;
        suggestion: string;
      }>,
      warnings: [] as Array<{
        component: string;
        type: 'deprecation' | 'compatibility' | 'performance';
        message: string;
        recommendation: string;
      }>,
      versionInfo: {
        targetVersion: targetCursorVersion,
        minSupportedVersion: this.MIN_CURSOR_VERSION,
        recommendedVersion: this.CURRENT_CURSOR_VERSION,
        featureCompatibility: {} as Record<string, boolean>,
        breakingChanges: [] as string[],
      },
    };

    try {
      // Check minimum version compatibility
      if (!this.isVersionGreaterOrEqual(targetCursorVersion, this.MIN_CURSOR_VERSION)) {
        result.issues.push({
          component: 'cursor-version',
          type: 'version_mismatch',
          severity: 'critical',
          message: `Target Cursor version ${targetCursorVersion} is below minimum supported version ${this.MIN_CURSOR_VERSION}`,
          currentVersion: targetCursorVersion,
          requiredVersion: this.MIN_CURSOR_VERSION,
          suggestion: `Upgrade to Cursor v${this.MIN_CURSOR_VERSION} or higher`,
        });
      }

      // Check feature compatibility based on version
      await this.validateVersionSpecificFeatures(targetCursorVersion, config, result);

      // Check for breaking changes
      await this.validateBreakingChanges(targetCursorVersion, config, result);

      // Validate extensions compatibility with target version
      if (config.extensions) {
        await this.validateExtensionVersionCompatibility(config.extensions, targetCursorVersion, result);
      }

      // Validate workspace features
      if (config.workspace) {
        await this.validateWorkspaceVersionCompatibility(config.workspace, targetCursorVersion, result);
      }

      // Check performance implications of version
      this.validateVersionPerformanceImplications(targetCursorVersion, result);

      // Determine overall compatibility
      result.compatible = result.issues.length === 0 || 
        !result.issues.some(issue => issue.severity === 'critical' || issue.severity === 'high');

      return result;

    } catch (error) {
      this.logger.error('Cursor version compatibility validation failed:', error);
      result.compatible = false;
      result.issues.push({
        component: 'version-validator',
        type: 'version_mismatch',
        severity: 'critical',
        message: `Version compatibility validation failed: ${(error as Error).message}`,
        suggestion: 'Check Cursor version format and try again',
      });
      return result;
    }
  }

  // Private helper methods for Task 4.3

  private async validateWorkspaceFolder(
    folder: any, 
    index: number, 
    result: any
  ): Promise<void> {
    const folderPath = `folders[${index}]`;

    // Validate path
    if (!folder.path || typeof folder.path !== 'string') {
      result.issues.push({
        type: 'structure',
        severity: 'high',
        message: `Folder at index ${index} missing or invalid path`,
        path: `${folderPath}.path`,
        suggestion: 'Provide a valid string path for the folder',
      });
    } else {
      // Check for problematic paths
      if (folder.path.includes('..')) {
        result.issues.push({
          type: 'permissions',
          severity: 'high',
          message: `Folder path contains parent directory references: ${folder.path}`,
          path: `${folderPath}.path`,
          suggestion: 'Use absolute or safe relative paths without ".."',
        });
      }

      // Estimate folder size (simplified)
      const estimatedSize = this.estimateFolderSize(folder.path);
      if (estimatedSize > result.statistics.largestFolder.estimatedSize) {
        result.statistics.largestFolder = {
          path: folder.path,
          estimatedSize,
        };
      }

      if (estimatedSize > 1024 * 1024 * 1024) { // 1GB
        result.warnings.push({
          type: 'performance',
          message: `Large folder detected: ${folder.path} (estimated ${Math.round(estimatedSize / (1024 * 1024))}MB)`,
          path: `${folderPath}.path`,
          recommendation: 'Consider excluding large directories to improve performance',
        });
      }
    }

    // Validate name
    if (folder.name && typeof folder.name !== 'string') {
      result.issues.push({
        type: 'structure',
        severity: 'medium',
        message: `Folder at index ${index} has invalid name type`,
        path: `${folderPath}.name`,
        suggestion: 'Use string type for folder name',
      });
    }
  }

  private async validateWorkspaceSettings(
    settings: Record<string, any>, 
    result: any
  ): Promise<void> {
    const cursorSpecificSettings = [
      'cursor.ai.enabled',
      'cursor.ai.model', 
      'cursor.completion.enabled',
      'cursor.chat.enabled',
      'cursor.security.allowedHosts',
    ];

    let cursorSettingsCount = 0;
    let settingsComplexity = 0;

    for (const [key, value] of Object.entries(settings)) {
      // Check for Cursor-specific settings
      if (cursorSpecificSettings.some(setting => key.startsWith(setting))) {
        cursorSettingsCount++;
      }

      // Assess setting complexity
      settingsComplexity += this.calculateSettingComplexity(key, value);

      // Check for potentially problematic settings
      if (key.includes('proxy') || key.includes('certificate')) {
        result.warnings.push({
          type: 'compatibility',
          message: `Network/security setting detected: ${key}`,
          path: `settings.${key}`,
          recommendation: 'Verify this setting works correctly with Cursor',
        });
      }

      // Check for very long setting values
      if (typeof value === 'string' && value.length > 1000) {
        result.warnings.push({
          type: 'performance',
          message: `Very long setting value: ${key}`,
          path: `settings.${key}`,
          recommendation: 'Consider using shorter values or external files',
        });
      }
    }

    result.statistics.cursorSpecificSettings = cursorSettingsCount;

    // Determine complexity level
    const avgComplexity = settingsComplexity / Object.keys(settings).length;
    if (avgComplexity > 10) {
      result.statistics.settingsComplexity = 'high';
    } else if (avgComplexity > 5) {
      result.statistics.settingsComplexity = 'medium';
    } else {
      result.statistics.settingsComplexity = 'low';
    }
  }

  private async validateWorkspaceExtensions(extensions: any, result: any): Promise<void> {
    if (extensions.recommendations && Array.isArray(extensions.recommendations)) {
      for (const extensionId of extensions.recommendations) {
        if (!this.isValidExtensionId(extensionId)) {
          result.issues.push({
            type: 'structure',
            severity: 'medium',
            message: `Invalid extension ID in workspace recommendations: ${extensionId}`,
            path: 'extensions.recommendations',
            suggestion: 'Use proper publisher.name format for extension IDs',
          });
        }
      }
    }
  }

  private assessWorkspaceComplexity(workspaceConfig: any, result: any): void {
    let complexityScore = 0;

    // Folder count impact
    complexityScore += (result.statistics.totalFolders || 0) * 2;

    // Settings count impact
    complexityScore += (result.statistics.totalSettings || 0) * 1;

    // Large folder impact
    if (result.statistics.largestFolder.estimatedSize > 500 * 1024 * 1024) { // 500MB
      complexityScore += 10;
    }

    if (complexityScore > 100) {
      result.warnings.push({
        type: 'performance',
        message: 'Complex workspace configuration detected',
        recommendation: 'Consider simplifying workspace structure for better performance',
      });
    }
  }

  private async validateIndividualSnippet(
    language: string, 
    snippetName: string, 
    snippet: any, 
    result: any
  ): Promise<void> {
    // Validate required fields
    if (!snippet.prefix || typeof snippet.prefix !== 'string') {
      result.issues.push({
        language,
        snippet: snippetName,
        type: 'format',
        severity: 'high',
        message: `Snippet "${snippetName}" missing or invalid prefix`,
        suggestion: 'Add a valid string prefix for snippet activation',
      });
    }

    if (!snippet.body || !Array.isArray(snippet.body)) {
      result.issues.push({
        language,
        snippet: snippetName,
        type: 'format',
        severity: 'high',
        message: `Snippet "${snippetName}" missing or invalid body`,
        suggestion: 'Define snippet body as an array of strings',
      });
    } else {
      // Validate snippet body syntax
      for (let i = 0; i < snippet.body.length; i++) {
        const line = snippet.body[i];
        if (typeof line !== 'string') {
          result.issues.push({
            language,
            snippet: snippetName,
            type: 'syntax',
            severity: 'medium',
            message: `Snippet "${snippetName}" has non-string body line at index ${i}`,
            line: i + 1,
            suggestion: 'Ensure all body lines are strings',
          });
        } else {
          // Check for invalid placeholder syntax
          const invalidPlaceholders = line.match(/\$(?!\{|\d)/g);
          if (invalidPlaceholders) {
            result.issues.push({
              language,
              snippet: snippetName,
              type: 'placeholder',
              severity: 'medium',
              message: `Snippet "${snippetName}" has invalid placeholder syntax on line ${i + 1}`,
              line: i + 1,
              suggestion: 'Use ${n:placeholder} or ${n} format for placeholders',
            });
          }
        }
      }
    }

    // Validate optional fields
    if (snippet.scope && typeof snippet.scope !== 'string') {
      result.warnings.push({
        language,
        snippet: snippetName,
        type: 'best_practice',
        message: `Snippet "${snippetName}" has invalid scope type`,
        recommendation: 'Use string type for snippet scope',
      });
    }

    // Check snippet length
    if (snippet.body && Array.isArray(snippet.body) && snippet.body.length > 50) {
      result.warnings.push({
        language,
        snippet: snippetName,
        type: 'performance',
        message: `Snippet "${snippetName}" is very long (${snippet.body.length} lines)`,
        recommendation: 'Consider splitting large snippets into smaller ones',
      });
    }
  }

  private calculateSnippetComplexity(snippet: any): number {
    let complexity = 0;

    if (snippet.body && Array.isArray(snippet.body)) {
      // Line count
      complexity += snippet.body.length;

      // Placeholder count
      const placeholders = snippet.body.join('\n').match(/\$\{[^}]+\}/g);
      complexity += (placeholders?.length || 0) * 2;

      // Nested structures
      const nestedStructures = snippet.body.join('\n').match(/\{[^}]*\{/g);
      complexity += (nestedStructures?.length || 0) * 3;
    }

    return complexity;
  }

  private async validateVersionSpecificFeatures(
    targetVersion: string, 
    config: any, 
    result: any
  ): Promise<void> {
    const features = {
      'aiCompletion': '0.39.0',
      'advancedDebugging': '0.40.0',
      'workspaceTemplates': '0.41.0',
      'multiCursor': '0.38.0',
    };

    for (const [feature, requiredVersion] of Object.entries(features)) {
      const isAvailable = this.isVersionGreaterOrEqual(targetVersion, requiredVersion);
      result.versionInfo.featureCompatibility[feature] = isAvailable;

      if (!isAvailable && this.configUsesFeature(config, feature)) {
        result.issues.push({
          component: feature,
          type: 'feature_unavailable',
          severity: 'high',
          message: `Feature "${feature}" requires Cursor v${requiredVersion} but target is v${targetVersion}`,
          requiredVersion,
          currentVersion: targetVersion,
          suggestion: `Upgrade to Cursor v${requiredVersion} or higher to use this feature`,
        });
      }
    }
  }

  private async validateBreakingChanges(
    targetVersion: string, 
    config: any, 
    result: any
  ): Promise<void> {
    const breakingChanges = [
      {
        version: '0.40.0',
        change: 'Settings schema updated',
        affectedConfig: 'settings',
        description: 'Some settings were renamed or moved',
      },
      {
        version: '0.41.0',
        change: 'Extension API changes',
        affectedConfig: 'extensions',
        description: 'Extension manifest format updated',
      },
    ];

    for (const breaking of breakingChanges) {
      if (this.isVersionGreaterOrEqual(targetVersion, breaking.version)) {
        result.versionInfo.breakingChanges.push(breaking.change);

        if (config[breaking.affectedConfig]) {
          result.warnings.push({
            component: breaking.affectedConfig,
            type: 'compatibility',
            message: `Breaking change in v${breaking.version}: ${breaking.description}`,
            recommendation: 'Review and update configuration for compatibility',
          });
        }
      }
    }
  }

  private async validateExtensionVersionCompatibility(
    extensions: any, 
    targetVersion: string, 
    result: any
  ): Promise<void> {
    // This would integrate with the existing extension validation
    if (extensions.recommendations) {
      for (const extensionId of extensions.recommendations) {
        const compatibility = await this.validateSingleExtension(extensionId, undefined, targetVersion);
        
        if (!compatibility.compatible) {
          result.issues.push({
            component: `extension:${extensionId}`,
            type: 'version_mismatch',
            severity: 'medium',
            message: `Extension ${extensionId} may not be compatible with Cursor v${targetVersion}`,
            currentVersion: targetVersion,
            suggestion: 'Check extension compatibility or find alternatives',
          });
        }
      }
    }
  }

  private async validateWorkspaceVersionCompatibility(
    workspace: any, 
    targetVersion: string, 
    result: any
  ): Promise<void> {
    // Check workspace-specific version requirements
    if (workspace.settings) {
      const cursorSpecificSettings = Object.keys(workspace.settings)
        .filter(key => key.startsWith('cursor.'));

      for (const setting of cursorSpecificSettings) {
        const requiredVersion = this.getSettingMinVersion(setting);
        if (requiredVersion && !this.isVersionGreaterOrEqual(targetVersion, requiredVersion)) {
          result.warnings.push({
            component: `workspace-setting:${setting}`,
            type: 'compatibility',
            message: `Setting "${setting}" may not be available in Cursor v${targetVersion}`,
            recommendation: `This setting requires Cursor v${requiredVersion} or higher`,
          });
        }
      }
    }
  }

  private validateVersionPerformanceImplications(targetVersion: string, result: any): void {
    // Version-specific performance considerations
    const performanceNotes = {
      '0.39.0': 'Improved startup performance',
      '0.40.0': 'Better memory management',
      '0.41.0': 'Enhanced extension loading',
    };

    for (const [version, note] of Object.entries(performanceNotes)) {
      if (this.isVersionGreaterOrEqual(targetVersion, version)) {
        result.warnings.push({
          component: 'performance',
          type: 'performance',
          message: `Performance improvement in v${version}: ${note}`,
          recommendation: 'Consider upgrading to benefit from performance improvements',
        });
      }
    }
  }

  // Additional utility methods

  private estimateFolderSize(path: string): number {
    // Simplified folder size estimation
    // In real implementation, this might use file system APIs
    const commonLargeFolders = ['node_modules', '.git', 'build', 'dist', '.next'];
    const folderName = path.split('/').pop() || '';
    
    if (commonLargeFolders.includes(folderName)) {
      return 100 * 1024 * 1024; // 100MB estimate
    }
    
    return 10 * 1024 * 1024; // 10MB default estimate
  }

  private calculateSettingComplexity(key: string, value: any): number {
    let complexity = 1; // Base complexity

    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        complexity += value.length;
      } else {
        complexity += Object.keys(value).length * 2;
      }
    }

    if (typeof value === 'string' && value.length > 100) {
      complexity += 2;
    }

    return complexity;
  }

  private isVersionGreaterOrEqual(version1: string, version2: string): boolean {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part > v2Part) return true;
      if (v1Part < v2Part) return false;
    }

    return true; // Equal versions
  }

  private configUsesFeature(config: any, feature: string): boolean {
    // Simple feature detection based on config content
    const configString = JSON.stringify(config).toLowerCase();
    
    switch (feature) {
      case 'aiCompletion':
        return configString.includes('ai') || configString.includes('completion');
      case 'advancedDebugging':
        return configString.includes('debug') && configString.includes('advanced');
      case 'workspaceTemplates':
        return configString.includes('template');
      case 'multiCursor':
        return configString.includes('multicursor') || configString.includes('multi-cursor');
      default:
        return false;
    }
  }

  private getSettingMinVersion(setting: string): string | null {
    const settingVersions: Record<string, string> = {
      'cursor.ai.enabled': '0.39.0',
      'cursor.ai.model': '0.39.0',
      'cursor.completion.enabled': '0.38.0',
      'cursor.chat.enabled': '0.40.0',
      'cursor.security.allowedHosts': '0.41.0',
    };

    return settingVersions[setting] || null;
  }
}