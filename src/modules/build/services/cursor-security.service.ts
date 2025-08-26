/**
 * CursorSecurityService - Advanced security filtering and protection for Cursor IDE configurations
 * Provides comprehensive security filtering, pattern detection, and audit capabilities
 */

import { Injectable, Logger } from '@nestjs/common';

import {
  CursorSettingsData,
  SecurityReport,
} from '../interfaces/cursor-ide.interfaces';

/**
 * Security pattern definition
 */
interface SecurityPattern {
  pattern: RegExp;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  replacement?: string;
}

/**
 * Security level types
 */
export type SecurityLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * Security audit entry
 */
export interface SecurityAuditEntry {
  timestamp: string;
  action: 'filtered' | 'detected' | 'blocked' | 'sanitized';
  type: string;
  field?: string;
  severity: string;
  details: string;
  path?: string;
  pattern?: string;
}

/**
 * Security filtering result
 */
export interface SecurityFilterResult {
  filtered: unknown;
  report: SecurityReport;
  auditLog: SecurityAuditEntry[];
  statistics: {
    totalFieldsScanned: number;
    totalFieldsFiltered: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
  };
}

/**
 * Advanced security filtering service for Cursor IDE configurations
 */
@Injectable()
export class CursorSecurityService {
  private readonly logger = new Logger(CursorSecurityService.name);
  private auditLog: SecurityAuditEntry[] = [];

  // Comprehensive security patterns with categories
  private readonly SECURITY_PATTERNS: SecurityPattern[] = [
    // API Keys and Tokens
    {
      pattern: /sk-[\da-z-]{20,}/gi,
      type: 'apiKey',
      severity: 'critical',
      category: 'api_keys',
      description: 'OpenAI API key detected',
      replacement: '[FILTERED]',
    },
    {
      pattern: /sk-ant-[\da-z-]{10,}/gi,
      type: 'apiKey',
      severity: 'critical',
      category: 'api_keys',
      description: 'Anthropic API key detected',
      replacement: '[FILTERED]',
    },
    {
      pattern: /sk-proj-[\da-z-]{20,}/gi,
      type: 'apiKey',
      severity: 'critical',
      category: 'api_keys',
      description: 'OpenAI project key detected',
      replacement: '[FILTERED]',
    },
    {
      pattern: /ghp_[\da-z]{30,}/gi,
      type: 'githubToken',
      severity: 'high',
      category: 'tokens',
      description: 'GitHub personal access token detected',
      replacement: '[FILTERED]',
    },
    {
      pattern: /ghs_[\dA-Za-z]{36,}/g,
      type: 'github_server_token',
      severity: 'critical',
      category: 'tokens',
      description: 'GitHub server token detected',
      replacement: 'ghs_***FILTERED***',
    },
    {
      pattern: /github_pat_[\dA-Za-z]{22}_[\dA-Za-z]{59}/g,
      type: 'github_fine_grained_pat',
      severity: 'critical',
      category: 'tokens',
      description: 'GitHub fine-grained personal access token detected',
      replacement: 'github_pat_***FILTERED***',
    },
    {
      pattern: /Bearer\s+[\w+./~-]+=*/g,
      type: 'bearer_token',
      severity: 'high',
      category: 'tokens',
      description: 'Bearer token detected',
      replacement: 'Bearer ***FILTERED***',
    },
    {
      pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["']?([\w+./~-]{20,})["']?/gi,
      type: 'generic_api_key',
      severity: 'high',
      category: 'api_keys',
      description: 'Generic API key pattern detected',
      replacement: 'api_key=***FILTERED***',
    },
    
    // Cloud Provider Credentials
    {
      pattern: /akia[\da-z]{16}/gi,
      type: 'aws_access_key',
      severity: 'critical',
      category: 'cloud_credentials',
      description: 'AWS access key ID detected',
      replacement: '[FILTERED]',
    },
    {
      pattern: /AIza[\w-]{35}/g,
      type: 'gcp_api_key',
      severity: 'critical',
      category: 'cloud_credentials',
      description: 'Google Cloud API key detected',
      replacement: 'AIza***FILTERED***',
    },
    {
      pattern: /[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}/gi,
      type: 'azure_subscription_id',
      severity: 'medium',
      category: 'cloud_credentials',
      description: 'Potential Azure subscription ID detected',
    },
    
    // Database and Connection Strings
    {
      pattern: /mongodb(?:\+srv)?:\/{2}[^:]+:([^@]+)@[^/]+/gi,
      type: 'databaseUrl',
      severity: 'high',
      category: 'database',
      description: 'MongoDB connection string with credentials detected',
      replacement: '[FILTERED]',
    },
    {
      pattern: /https?:\/\/[^:]+:[^@]+@[^/]+/g,
      type: 'proxy_url',
      severity: 'high',
      category: 'credentials',
      description: 'URL with embedded credentials detected',
      replacement: '[FILTERED]',
    },
    {
      pattern: /postgres(?:ql)?:\/{2}[^:]+:([^@]+)@[^/]+/gi,
      type: 'postgresql_connection',
      severity: 'critical',
      category: 'database',
      description: 'PostgreSQL connection string with credentials detected',
      replacement: 'postgresql://***FILTERED***@***',
    },
    {
      pattern: /mysql:\/{2}[^:]+:([^@]+)@[^/]+/gi,
      type: 'mysql_connection',
      severity: 'critical',
      category: 'database',
      description: 'MySQL connection string with credentials detected',
      replacement: 'mysql://***FILTERED***@***',
    },
    
    // Passwords and Secrets
    {
      pattern: /(?:password|passwd|pwd)\s*[:=]\s*["']?([^\s"']{8,})["']?/gi,
      type: 'password',
      severity: 'critical',
      category: 'credentials',
      description: 'Password detected',
      replacement: 'password=***FILTERED***',
    },
    {
      pattern: /(?:secret|client_secret)\s*[:=]\s*["']?([^\s"']{8,})["']?/gi,
      type: 'secret',
      severity: 'critical',
      category: 'credentials',
      description: 'Secret detected',
      replacement: 'secret=***FILTERED***',
    },
    
    // SSH Keys
    {
      pattern: /-{5}BEGIN (?:RSA|DSA|EC|OPENS{2}H)? ?PRIVATE KEY-{5}[\S\s]*?(?:-{5}END|$)/g,
      type: 'privateKey',
      severity: 'critical',
      category: 'ssh_keys',
      description: 'Private SSH key detected',
      replacement: '[FILTERED]',
    },
    {
      pattern: /-{5}BEGIN RSA PRIVATE KEY-{5}[\S\s]*?(?:-{5}END|$)/g,
      type: 'sshKey',
      severity: 'critical',
      category: 'ssh_keys',
      description: 'RSA Private key detected',
      replacement: '[FILTERED]',
    },
    
    // Webhook URLs
    {
      pattern: /https:\/\/hooks\.slack\.com\/services\/[\d/a-z]+/gi,
      type: 'slack_webhook',
      severity: 'high',
      category: 'webhooks',
      description: 'Slack webhook URL detected',
      replacement: 'https://hooks.slack.com/services/***FILTERED***',
    },
    {
      pattern: /https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+/gi,
      type: 'discord_webhook',
      severity: 'high',
      category: 'webhooks',
      description: 'Discord webhook URL detected',
      replacement: 'https://discord.com/api/webhooks/***FILTERED***',
    },
    
    // Cryptocurrency
    {
      pattern: /(?:bc1|[13])[\dA-HJ-NP-Za-z]{25,62}/g,
      type: 'bitcoin_address',
      severity: 'medium',
      category: 'cryptocurrency',
      description: 'Bitcoin address detected',
    },
    {
      pattern: /0x[\dA-Fa-f]{40}/g,
      type: 'ethereum_address',
      severity: 'medium',
      category: 'cryptocurrency',
      description: 'Ethereum address detected',
    },
    
    // Credit Cards
    {
      pattern: /\b4\d{12}(?:\d{3})?\b/g,
      type: 'credit_card',
      severity: 'critical',
      category: 'financial',
      description: 'Visa card number detected',
      replacement: '[FILTERED]',
    },
    {
      pattern: /\b5[1-5]\d{14}\b/g,
      type: 'credit_card',
      severity: 'critical',
      category: 'financial',
      description: 'MasterCard number detected',
      replacement: '[FILTERED]',
    },
    {
      pattern: /\b3[47]\d{13}\b/g,
      type: 'credit_card',
      severity: 'critical',
      category: 'financial',
      description: 'American Express number detected',
      replacement: '[FILTERED]',
    },
    {
      pattern: /\b3[47]\d{2}[\s-]?\d{6}[\s-]?\d{5}\b/g,
      type: 'credit_card',
      severity: 'critical',
      category: 'financial',
      description: 'American Express number detected (formatted)',
      replacement: '[FILTERED]',
    },
    {
      pattern: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
      type: 'credit_card',
      severity: 'critical',
      category: 'financial',
      description: 'Credit card number detected',
      replacement: '[FILTERED]',
    },
    
    // JWT Tokens
    {
      pattern: /(?:eyJ[\w-]+\.){2}[\w+./-]*/g,
      type: 'jwt_token',
      severity: 'high',
      category: 'tokens',
      description: 'JWT token detected',
      replacement: '[FILTERED]',
    },
    {
      pattern: /bearer\s+[\w.-]+/gi,
      type: 'bearer_token',
      severity: 'high',
      category: 'tokens',
      description: 'Bearer token detected',
      replacement: '[FILTERED]',
    },
    
    // Environment Variables
    {
      pattern: /process\.env\.[_a-z]+(?:key|token|secret|password)/gi,
      type: 'env_variable_reference',
      severity: 'low',
      category: 'environment',
      description: 'Environment variable reference detected',
    },
  ];

  // Context-aware filtering rules
  private readonly CONTEXT_RULES = {
    aiConfig: {
      allowedFields: ['modelConfig.provider', 'modelConfig.model', 'modelConfig.temperature'],
      blockedFields: ['apiKeys', 'tokens', 'credentials'],
      sensitiveFields: ['modelConfig.apiKey', 'rules.*.apiKey'],
    },
    settings: {
      allowedPrefixes: ['editor.', 'workbench.', 'files.', 'terminal.'],
      blockedPrefixes: ['cursor.api', 'auth.', 'credentials.'],
    },
    extensions: {
      allowedPublishers: ['microsoft', 'github', 'redhat', 'golang'],
      suspiciousPatterns: ['crack', 'hack', 'keygen', 'activator'],
    },
  };

  /**
   * Perform comprehensive security filtering on configuration data
   */
  async performComprehensiveSecurityFiltering(
    data: CursorSettingsData,
    options?: {
      mode: 'strict' | 'moderate' | 'lenient';
      enableAudit?: boolean;
      enableContextAnalysis?: boolean;
      customPatterns?: SecurityPattern[];
    },
  ): Promise<SecurityFilterResult> {
    const mode = options?.mode || 'strict';
    const enableAudit = options?.enableAudit !== false;
    const enableContextAnalysis = options?.enableContextAnalysis !== false;
    const customPatterns = options?.customPatterns || [];

    // Reset audit log for new filtering session
    if (enableAudit) {
      this.auditLog = [];
    }

    // Combine default and custom patterns
    const patterns = [...this.SECURITY_PATTERNS, ...customPatterns];

    // Apply security level filtering based on mode
    const activePatterns = this.filterPatternsByMode(patterns, mode);

    // Deep clone data for filtering
    const filtered = JSON.parse(JSON.stringify(data));
    
    // Statistics tracking
    const stats = {
      totalFieldsScanned: 0,
      totalFieldsFiltered: 0,
      criticalIssues: 0,
      highIssues: 0,
      mediumIssues: 0,
      lowIssues: 0,
    };

    // Perform recursive filtering
    const filteredData = await this.recursiveSecurityFilter(
      filtered,
      activePatterns,
      '',
      stats,
      enableAudit,
    );

    // Context-aware analysis
    if (enableContextAnalysis) {
      await this.performContextAnalysis(filteredData, stats, enableAudit);
    }

    // Generate security report
    const report = await this.generateAdvancedSecurityReport(
      data,
      filteredData,
      stats,
      activePatterns,
    );

    return {
      filtered: filteredData,
      report,
      auditLog: this.auditLog,
      statistics: stats,
    };
  }

  /**
   * Filter patterns based on security mode
   */
  private filterPatternsByMode(
    patterns: SecurityPattern[],
    mode: 'strict' | 'moderate' | 'lenient',
  ): SecurityPattern[] {
    switch (mode) {
      case 'strict':
        return patterns; // All patterns active
      case 'moderate':
        return patterns.filter(p => p.severity !== 'low');
      case 'lenient':
        return patterns.filter(p => p.severity === 'critical');
      default:
        return patterns;
    }
  }

  /**
   * Recursive security filtering with path tracking
   */
  private async recursiveSecurityFilter(
    obj: any,
    patterns: SecurityPattern[],
    path: string,
    stats: any,
    enableAudit: boolean,
  ): Promise<any> {
    if (!obj || typeof obj !== 'object') {
      stats.totalFieldsScanned++;
      
      // Check string values for sensitive patterns
      if (typeof obj === 'string') {
        return this.filterStringValue(obj, patterns, path, stats, enableAudit);
      }
      
      return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return Promise.all(
        obj.map((item, index) => 
          this.recursiveSecurityFilter(
            item,
            patterns,
            `${path}[${index}]`,
            stats,
            enableAudit,
          ),
        ),
      );
    }

    // Handle objects
    const filtered: any = {};
    const entries = Object.entries(obj);
    
    // Process all entries in parallel to avoid await in loop
    const processedEntries = await Promise.all(
      entries.map(async ([key, value]) => {
        const fieldPath = path ? `${path}.${key}` : key;
        stats.totalFieldsScanned++;

        // Check if key itself contains sensitive patterns
        if (this.isKeySensitive(key, patterns)) {
          stats.totalFieldsFiltered++;
          this.logAudit('filtered', 'sensitive_key', fieldPath, 'high', `Key contains sensitive pattern: ${key}`, enableAudit);
          return [key, '[FILTERED]'];
        }

        // Recursively filter the value
        const filteredValue = await this.recursiveSecurityFilter(
          value,
          patterns,
          fieldPath,
          stats,
          enableAudit,
        );

        // Check if value was filtered
        if (filteredValue !== value) {
          stats.totalFieldsFiltered++;
        }

        return [key, filteredValue];
      }),
    );
    
    // Reconstruct object from processed entries
    for (const [key, value] of processedEntries) {
      filtered[key] = value;
    }

    return filtered;
  }

  /**
   * Filter string value for sensitive patterns
   */
  private filterStringValue(
    value: string,
    patterns: SecurityPattern[],
    path: string,
    stats: any,
    enableAudit: boolean,
  ): string {
    let filtered = value;

    for (const pattern of patterns) {
      pattern.pattern.lastIndex = 0; // Reset regex
      
      if (pattern.pattern.test(value)) {
        // Update statistics based on severity
        this.updateSeverityStats(stats, pattern.severity);
        
        // Log the detection
        this.logAudit(
          'detected',
          pattern.type,
          path,
          pattern.severity,
          pattern.description,
          enableAudit,
        );

        // Apply replacement if defined
        if (pattern.replacement) {
          filtered = '[FILTERED]'; // Always use [FILTERED] for consistency
          
          this.logAudit(
            'sanitized',
            pattern.type,
            path,
            pattern.severity,
            `Replaced with: [FILTERED]`,
            enableAudit,
          );
        } else if (pattern.severity === 'critical' || pattern.severity === 'high') {
          // For critical/high severity without replacement, redact entirely
          filtered = '[FILTERED]';
          
          this.logAudit(
            'filtered',
            pattern.type,
            path,
            pattern.severity,
            'Value completely filtered',
            enableAudit,
          );
          break; // No need to check other patterns
        }
      }
    }

    return filtered;
  }

  /**
   * Check if a key name is sensitive
   */
  private isKeySensitive(key: string, _patterns: SecurityPattern[]): boolean {
    const sensitiveKeywords = [
      'apikey', 'api_key', 'api-key',
      'secret', 'password', 'passwd', 'pwd',
      'token', 'auth', 'credential',
      'private', 'privatekey', 'private_key',
      'clientsecret', 'client_secret',
    ];

    const lowerKey = key.toLowerCase();
    return sensitiveKeywords.some(keyword => lowerKey.includes(keyword));
  }

  /**
   * Perform context-aware analysis
   */
  private async performContextAnalysis(
    data: any,
    stats: any,
    enableAudit: boolean,
  ): Promise<void> {
    // Check AI configuration context
    if (data.aiConfig) {
      for (const blockedField of this.CONTEXT_RULES.aiConfig.blockedFields) {
        if (this.hasNestedField(data.aiConfig, blockedField)) {
          stats.totalFieldsFiltered++;
          stats.criticalIssues++;
          
          this.logAudit(
            'blocked',
            'context_violation',
            `aiConfig.${blockedField}`,
            'critical',
            'Blocked field in AI configuration',
            enableAudit,
          );
        }
      }
    }

    // Check settings context
    if (data.settings) {
      for (const [key] of Object.entries(data.settings)) {
        const isBlocked = this.CONTEXT_RULES.settings.blockedPrefixes.some(
          prefix => key.startsWith(prefix),
        );
        
        if (isBlocked) {
          stats.totalFieldsFiltered++;
          stats.highIssues++;
          
          this.logAudit(
            'blocked',
            'context_violation',
            `settings.${key}`,
            'high',
            'Blocked settings prefix detected',
            enableAudit,
          );
        }
      }
    }

    // Check extensions for suspicious patterns
    if (data.extensions?.installed) {
      for (const ext of data.extensions.installed) {
        const isSuspicious = this.CONTEXT_RULES.extensions.suspiciousPatterns.some(
          pattern => ext.id?.toLowerCase().includes(pattern),
        );
        
        if (isSuspicious) {
          stats.mediumIssues++;
          
          this.logAudit(
            'detected',
            'suspicious_extension',
            `extensions.${ext.id}`,
            'medium',
            'Suspicious extension pattern detected',
            enableAudit,
          );
        }
      }
    }
  }

  /**
   * Check if object has nested field
   */
  private hasNestedField(obj: any, path: string): boolean {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (part === '*') {
        // Wildcard - check all array items or object values
        if (Array.isArray(current)) {
          return current.some(item => this.hasNestedField(item, parts.slice(parts.indexOf(part) + 1).join('.')));
        } else if (typeof current === 'object' && current !== null) {
          return Object.values(current).some(value => 
            this.hasNestedField(value, parts.slice(parts.indexOf(part) + 1).join('.')),
          );
        }
        return false;
      }
      
      if (!current || typeof current !== 'object' || !(part in current)) {
        return false;
      }
      
      current = current[part];
    }
    
    return true;
  }

  /**
   * Update severity statistics
   */
  private updateSeverityStats(stats: any, severity: string): void {
    switch (severity) {
      case 'critical':
        stats.criticalIssues++;
        break;
      case 'high':
        stats.highIssues++;
        break;
      case 'medium':
        stats.mediumIssues++;
        break;
      case 'low':
        stats.lowIssues++;
        break;
    }
  }

  /**
   * Log security audit entry
   */
  private logAudit(
    action: SecurityAuditEntry['action'],
    type: string,
    field: string,
    severity: string,
    details: string,
    enableAudit: boolean,
  ): void {
    if (!enableAudit) return;

    const entry: SecurityAuditEntry = {
      timestamp: new Date().toISOString(),
      action,
      type,
      field,
      severity,
      details,
    };

    this.auditLog.push(entry);
    
    // Also log to NestJS logger for debugging
    this.logger.debug(`Security ${action}: ${type} at ${field} - ${details}`);
  }

  /**
   * Generate advanced security report
   */
  private async generateAdvancedSecurityReport(
    original: any,
    filtered: any,
    stats: any,
    patterns: SecurityPattern[],
  ): Promise<SecurityReport> {
    const filteredFields: string[] = [];
    const recommendations: string[] = [];

    // Calculate security level
    let securityLevel: 'safe' | 'warning' | 'unsafe';
    if (stats.criticalIssues > 0) {
      securityLevel = 'unsafe';
      recommendations.push('CRITICAL: Remove all sensitive data before sharing');
    } else if (stats.highIssues > 0) {
      securityLevel = 'unsafe';
      recommendations.push('HIGH: Review and remove sensitive information');
    } else if (stats.mediumIssues > 0) {
      securityLevel = 'warning';
      recommendations.push('MEDIUM: Consider removing potentially sensitive data');
    } else {
      securityLevel = 'safe';
      recommendations.push('Configuration appears safe for sharing');
    }

    // Add pattern-specific recommendations
    const detectedCategories = new Set<string>();
    for (const entry of this.auditLog) {
      if (entry.action === 'detected' || entry.action === 'filtered') {
        const pattern = patterns.find(p => p.type === entry.type);
        if (pattern) {
          detectedCategories.add(pattern.category);
        }
        if (entry.field) {
          filteredFields.push(entry.field);
        }
      }
    }

    // Category-specific recommendations
    if (detectedCategories.has('api_keys')) {
      recommendations.push('Store API keys in environment variables or secure vaults');
    }
    if (detectedCategories.has('database')) {
      recommendations.push('Use connection pooling and secure credential management');
    }
    if (detectedCategories.has('ssh_keys')) {
      recommendations.push('Never commit private SSH keys to repositories');
    }
    if (detectedCategories.has('tokens')) {
      recommendations.push('Use short-lived tokens and implement token rotation');
    }

    // Add statistics to recommendations
    if (stats.totalFieldsFiltered > 0) {
      recommendations.push(
        `Filtered ${stats.totalFieldsFiltered} fields out of ${stats.totalFieldsScanned} scanned`,
      );
    }

    return {
      hasApiKeys: detectedCategories.has('api_keys'),
      hasTokens: detectedCategories.has('tokens'),
      hasSensitiveData: stats.totalFieldsFiltered > 0,
      filteredFields: [...new Set(filteredFields)], // Remove duplicates
      securityLevel,
      recommendations,
    };
  }

  /**
   * Validate configuration for team sharing
   */
  async validateForTeamSharing(
    data: CursorSettingsData,
  ): Promise<{
    isSafe: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const result = await this.performComprehensiveSecurityFiltering(data, {
      mode: 'strict',
      enableAudit: true,
      enableContextAnalysis: true,
    });

    const isSafe = result.report.securityLevel === 'safe';
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Extract issues from audit log
    for (const entry of result.auditLog) {
      if (entry.action !== 'detected') continue;
      
      if (entry.severity === 'critical' || entry.severity === 'high') {
        issues.push(`${entry.severity.toUpperCase()}: ${entry.details} at ${entry.field}`);
      }
    }

    // Add team-specific recommendations
    if (!isSafe) {
      recommendations.push('Run security filtering before sharing with team');
      recommendations.push('Review all detected issues and remove sensitive data');
    }

    if (result.statistics.criticalIssues === 0 && result.statistics.highIssues === 0) {
      recommendations.push('Consider using encrypted storage for team settings');
      recommendations.push('Implement access controls for shared configurations');
    }

    return {
      isSafe,
      issues,
      recommendations: [...result.report.recommendations, ...recommendations],
    };
  }

  /**
   * Public method: Filter sensitive data from configuration
   */
  async filterSensitiveData(data: any): Promise<any> {
    const result = await this.performComprehensiveSecurityFiltering(data, {
      mode: 'strict',
      enableAudit: true,
      enableContextAnalysis: true,
    });
    return result.filtered;
  }

  /**
   * Public method: Generate security report
   */
  async generateSecurityReport(data: any): Promise<SecurityReport & { 
    level: SecurityLevel;
    filteredItems: number;
    categories: string[];
    details: any;
    auditTrail: SecurityAuditEntry[];
  }> {
    const result = await this.performComprehensiveSecurityFiltering(data, {
      mode: 'strict',
      enableAudit: true,
      enableContextAnalysis: true,
    });

    // Determine security level
    let level: SecurityLevel = 'low';
    if (result.statistics.criticalIssues > 0) {
      level = 'critical';
    } else if (result.statistics.highIssues > 0) {
      level = 'high';
    } else if (result.statistics.mediumIssues > 0) {
      level = 'medium';
    }

    // Extract categories from audit log
    const categories = new Set<string>();
    for (const entry of result.auditLog) {
      const pattern = this.SECURITY_PATTERNS.find(p => p.type === entry.type);
      if (pattern) {
        categories.add(pattern.category);
      }
    }

    return {
      ...result.report,
      level,
      filteredItems: result.statistics.totalFieldsFiltered,
      categories: Array.from(categories),
      details: result.statistics,
      auditTrail: result.auditLog,
    };
  }

  /**
   * Public method: Classify security level for a pattern type
   */
  classifySecurityLevel(patternType: string): SecurityLevel {
    // Find pattern by type or category
    const pattern = this.SECURITY_PATTERNS.find(
      p => p.type === patternType || p.category === patternType
    );

    if (pattern) {
      return pattern.severity as SecurityLevel;
    }

    // Default mappings for common types
    const levelMap: Record<string, SecurityLevel> = {
      privateKey: 'critical',
      sshKey: 'critical',
      apiKey: 'high',
      githubToken: 'high',
      databaseUrl: 'high',
      webhook: 'medium',
      email: 'low',
    };

    return levelMap[patternType] || 'low';
  }

  /**
   * Public method: Check if data is safe for team sharing
   */
  async isTeamSharingCompatible(data: any): Promise<{
    compatible: boolean;
    issues: string[];
    requiredActions: string[];
  }> {
    const result = await this.validateForTeamSharing(data);
    
    const requiredActions: string[] = [];
    if (!result.isSafe) {
      // Map issues to required actions
      for (const issue of result.issues) {
        if (issue.includes('API key')) {
          requiredActions.push('Remove or replace API keys with environment variables');
        }
        if (issue.includes('database') || issue.includes('connection string')) {
          requiredActions.push('Remove or replace database connection strings');
        }
        if (issue.includes('token')) {
          requiredActions.push('Remove or replace authentication tokens');
        }
      }
    }

    return {
      compatible: result.isSafe,
      issues: result.issues,
      requiredActions: [...new Set(requiredActions)], // Remove duplicates
    };
  }

  /**
   * Public method: Validate compliance requirements
   */
  async validateComplianceRequirements(data: any): Promise<{
    compliant: boolean;
    violations: string[];
  }> {
    await this.generateComplianceReport(data, ['gdpr', 'pci-dss']);
    
    const violations: string[] = [];
    
    // Check for PII patterns
    const dataStr = JSON.stringify(data);
    if (/\b\d{3}-\d{2}-\d{4}\b/.test(dataStr)) {
      violations.push('PII detected: SSN pattern found');
    }
    
    // Check for credit cards
    const creditCardPatterns = [
      /\b4\d{12}(?:\d{3})?\b/, // Visa
      /\b5[1-5]\d{14}\b/, // MasterCard  
      /\b3[47]\d{13}\b/, // American Express
    ];
    
    for (const pattern of creditCardPatterns) {
      if (pattern.test(dataStr)) {
        violations.push('PCI DSS: Credit card number detected');
        break;
      }
    }
    
    return {
      compliant: violations.length === 0,
      violations,
    };
  }

  /**
   * Generate security compliance report
   */
  async generateComplianceReport(
    data: CursorSettingsData,
    standards: ('gdpr' | 'hipaa' | 'pci-dss' | 'sox')[] = ['gdpr'],
  ): Promise<{
    compliant: boolean;
    violations: Array<{
      standard: string;
      requirement: string;
      violation: string;
      severity: string;
    }>;
    recommendations: string[];
  }> {
    const violations: Array<{
      standard: string;
      requirement: string;
      violation: string;
      severity: string;
    }> = [];
    
    const result = await this.performComprehensiveSecurityFiltering(data, {
      mode: 'strict',
      enableAudit: true,
    });

    // Check GDPR compliance
    if (standards.includes('gdpr')) {
      // Check for personal data
      const personalDataPatterns = [
        /\b[\w%+.-]+@[\d.a-z-]+\.[a-z]{2,}\b/gi, // Email
        /\b(?:\d{3}[.-]?){2}\d{4}\b/g, // Phone
        /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      ];

      const dataStr = JSON.stringify(data);
      for (const pattern of personalDataPatterns) {
        if (pattern.test(dataStr)) {
          violations.push({
            standard: 'GDPR',
            requirement: 'Personal data protection',
            violation: 'Personal information detected in configuration',
            severity: 'high',
          });
          break;
        }
      }
    }

    // Check PCI-DSS compliance
    if (standards.includes('pci-dss')) {
      if (result.statistics.criticalIssues > 0) {
        violations.push({
          standard: 'PCI-DSS',
          requirement: 'Protect cardholder data',
          violation: 'Sensitive payment or authentication data detected',
          severity: 'critical',
        });
      }
    }

    // Generate recommendations based on violations
    const recommendations: string[] = [];
    if (violations.length > 0) {
      recommendations.push('Implement data encryption at rest');
      recommendations.push('Use tokenization for sensitive data');
      recommendations.push('Establish data retention policies');
      recommendations.push('Implement audit logging for compliance');
    }

    return {
      compliant: violations.length === 0,
      violations,
      recommendations,
    };
  }
}