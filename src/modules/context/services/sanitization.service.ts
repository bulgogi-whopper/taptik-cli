import { Injectable, Logger } from '@nestjs/common';

import { SanitizationResult } from '../interfaces/cloud.interface';

interface SeverityBreakdown {
  safe: number;
  low: number;
  medium: number;
  critical: number;
}

interface DetailedFinding {
  category: string;
  severity: string;
  count: number;
  path?: string;
}

interface SanitizationStats {
  sanitizedFields: number;
  totalFields: number;
}

@Injectable()
export class SanitizationService {
  private readonly logger = new Logger(SanitizationService.name);

  // Performance optimization: Cache for processed paths
  private processedCache = new Map<string, unknown>();
  private readonly CACHE_SIZE_LIMIT = 1000;
  // Enhanced patterns with severity levels and comprehensive coverage
  private readonly sensitivePatterns = {
    apiKeys: [
      /api[_-]?key/i,
      /apikey/i,
      /api[_-]?secret/i,
      /api[_-]?id/i,
      /client[_-]?secret/i,
      /app[_-]?secret/i,
      /consumer[_-]?key/i,
      /consumer[_-]?secret/i,
      /sk-[\dA-Za-z]{20,}/, // OpenAI and similar
      /OPENAI_API_KEY/,
      /AIza[\w-]{35}/, // Google API keys
      /[\da-f]{32}-us\d{1,2}/, // Mailchimp
      /key-[\dA-Za-z]{32}/, // Mailgun
      /rzp_[A-Za-z]{4,}_[\dA-Za-z]{14}/, // Razorpay
      /pk_[A-Za-z]{4,}_[\dA-Za-z]{20,}/, // Stripe publishable
      /sk_[A-Za-z]{4,}_[\dA-Za-z]{20,}/, // Stripe secret
    ],
    tokens: [
      /token/i,
      /bearer/i,
      /jwt/i,
      /access[_-]?token/i,
      /auth[_-]?token/i,
      /refresh[_-]?token/i,
      /id[_-]?token/i,
      /github[_-]?token/i,
      /personal[_-]?access[_-]?token/i,
      /pat[_-]?token/i,
      /ghp_[\dA-Za-z]{36}/, // GitHub personal access token
      /gho_[\dA-Za-z]{36}/, // GitHub OAuth token
      /ghu_[\dA-Za-z]{36}/, // GitHub user token
      /ghs_[\dA-Za-z]{36}/, // GitHub server token
      /ghr_[\dA-Za-z]{36}/, // GitHub refresh token
      /(?:eyJ[\dA-Za-z]+\.){2}[\w-]+/, // JWT
      /xox[abprs](?:-\d{10,13}){2}-[\dA-Za-z]{24,32}/, // Slack tokens
      /sq0[a-z]{3}-[\w-]{22}/, // Square OAuth
      /AC[\da-z]{32}/, // Twilio
      /SG\.[\w-]{22}\.[\w-]{43}/, // SendGrid
    ],
    passwords: [
      /passw(or)?d/i,
      /pass$/i,
      /passwd/i,
      /pwd/i,
      /secret/i,
      /credential/i,
      /auth/i,
      /login[_-]?pass/i,
      /user[_-]?pass/i,
      /admin[_-]?pass/i,
      /db[_-]?pass/i,
      /database[_-]?pass/i,
    ],
    privateKeys: [
      /-{5}BEGIN [\s\w]+ PRIVATE KEY-{5}/,
      /-----BEGIN CERTIFICATE-----/,
      /-----BEGIN RSA PRIVATE KEY-----/,
      /-----BEGIN DSA PRIVATE KEY-----/,
      /-----BEGIN EC PRIVATE KEY-----/,
      /-----BEGIN OPENSSH PRIVATE KEY-----/,
      /-----BEGIN PGP PRIVATE KEY BLOCK-----/,
      /-----BEGIN ENCRYPTED PRIVATE KEY-----/,
    ],
    emails: [
      /[\dA-Za-z][\w%+.-]{0,63}@[\dA-Za-z][\d.A-Za-z-]{0,62}\.[A-Za-z]{2,}/,
    ],
    sshKeys: [
      /ssh-rsa [\d+/A-Za-z]+={0,2}/,
      /ssh-ed25519 [\d+/A-Za-z]+={0,2}/,
      /ssh-dss [\d+/A-Za-z]+={0,2}/,
      /ecdsa-sha2-nistp256 [\d+/A-Za-z]+={0,2}/,
    ],
    awsKeys: [
      /aws[_-]?access[_-]?key[_-]?id/i,
      /aws[_-]?secret[_-]?access[_-]?key/i,
      /aws[_-]?session[_-]?token/i,
      /AKIA[\dA-Z]{16}/, // AWS Access Key
      /ASIA[\dA-Z]{16}/, // AWS Temporary Key
      /AGPA[\dA-Z]{16}/, // AWS Group Key
      /AIDA[\dA-Z]{16}/, // AWS User Key
      /AROA[\dA-Z]{16}/, // AWS Role Key
    ],
    connectionStrings: [
      /postgresql:\/\/[^@]+@/,
      /postgres:\/\/[^@]+@/,
      /mysql:\/\/[^@]+@/,
      /mariadb:\/\/[^@]+@/,
      /mongodb(\+srv)?:\/\/[^@]+@/,
      /redis:\/\/[^@]+@/,
      /rediss:\/\/[^@]+@/,
      /amqp:\/\/[^@]+@/,
      /amqps:\/\/[^@]+@/,
      /kafka:\/\/[^@]+@/,
      /cassandra:\/\/[^@]+@/,
      /couchdb:\/\/[^@]+@/,
      /influxdb:\/\/[^@]+@/,
      /clickhouse:\/\/[^@]+@/,
      /server=[^;]+;(user id|uid)=[^;]+;(password|pwd)=[^;]+/i, // SQL Server
    ],
    webhooks: [
      /https:\/\/hooks\.slack\.com\/services\/[\d/A-Z]+/,
      /https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+/,
      /https:\/\/discordapp\.com\/api\/webhooks\/\d+\/[\w-]+/,
      /https:\/\/(?:canary|ptb)\.discord\.com\/api\/webhooks\/\d+\/[\w-]+/,
      /https:\/\/api\.telegram\.org\/bot\d+:[\w-]+/,
      /https:\/\/outlook\.office\.com\/webhook\/[\da-f-]+@[\da-f-]+\/IncomingWebhook\/[\da-f]+\/[\da-f-]+/,
    ],
    envVars: [
      /\${[A-Z_][\dA-Z_]*}/,
      /\$[A-Z_][\dA-Z_]*/,
      /process\.env\.[A-Z_][\dA-Z_]*/,
      /%[A-Z_][\dA-Z_]*%/, // Windows style
    ],
    ipAddresses: [
      /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\b/, // IPv4
      /\b(?:[\dA-Fa-f]{1,4}:){7}[\dA-Fa-f]{1,4}\b/, // IPv6
    ],
    base64Secrets: [
      /^[\d+/A-Za-z]{40,}={0,2}$/, // Minimum 40 chars for potential secrets
    ],
  };

  sanitizeForCloudUpload(config: unknown): SanitizationResult {
    const startTime = Date.now();

    // Clear cache if it gets too large (performance optimization)
    if (this.processedCache.size > this.CACHE_SIZE_LIMIT) {
      this.processedCache.clear();
      this.logger.debug('Cleared sanitization cache due to size limit');
    }

    const findings: string[] = [];
    const severityBreakdown = {
      safe: 0,
      low: 0,
      medium: 0,
      critical: 0,
    };
    const detailedFindings: DetailedFinding[] = [];

    const stats: SanitizationStats = { sanitizedFields: 0, totalFields: 0 };

    const sanitizedData = this.sanitizeObject(
      config,
      findings,
      severityBreakdown,
      stats,
      detailedFindings,
      '',
    );

    const processingTime = Date.now() - startTime;
    const securityLevel = this.determineSecurityLevel(
      severityBreakdown,
      findings,
    );
    const recommendations = this.generateRecommendations(
      findings,
      severityBreakdown,
      detailedFindings,
    );

    // Log performance metrics
    this.logger.debug(
      `Sanitization completed in ${processingTime}ms: ${stats.sanitizedFields}/${stats.totalFields} fields sanitized, security level: ${securityLevel}`,
    );

    return {
      sanitizedData,
      securityLevel,
      findings: this.consolidateFindings(findings),
      report: {
        totalFields: stats.totalFields,
        sanitizedFields: stats.sanitizedFields,
        safeFields: stats.totalFields - stats.sanitizedFields,
        timestamp: new Date(),
        summary: `${stats.sanitizedFields} fields sanitized out of ${stats.totalFields} total fields`,
        processingTimeMs: processingTime,
        detailedFindings,
      },
      severityBreakdown,
      recommendations,
    };
  }

  private sanitizeObject(
    obj: unknown,
    findings: string[],
    severityBreakdown: SeverityBreakdown,
    stats: SanitizationStats,
    detailedFindings: DetailedFinding[],
    path: string,
  ): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Performance optimization: Check cache first
    const cacheKey = `${path}_${typeof obj}_${JSON.stringify(obj).substring(0, 100)}`;
    if (this.processedCache.has(cacheKey)) {
      return this.processedCache.get(cacheKey);
    }

    let result: unknown;

    if (typeof obj === 'string') {
      stats.totalFields++;
      result = this.sanitizeString(
        obj,
        path,
        findings,
        severityBreakdown,
        stats,
        detailedFindings,
      );
    } else if (Array.isArray(obj)) {
      result = obj.map((item, index) =>
        this.sanitizeObject(
          item,
          findings,
          severityBreakdown,
          stats,
          detailedFindings,
          `${path}[${index}]`,
        ),
      );
    } else if (typeof obj === 'object') {
      result = {};
      for (const [key, value] of Object.entries(
        obj as Record<string, unknown>,
      )) {
        const newPath = path ? `${path}.${key}` : key;

        if (value === null || value === undefined || value === '') {
          (result as Record<string, unknown>)[key] = value;
          continue;
        }

        (result as Record<string, unknown>)[key] = this.sanitizeValue(
          key,
          value,
          findings,
          severityBreakdown,
          stats,
          detailedFindings,
          newPath,
        );
      }
    } else {
      stats.totalFields++;
      result = obj;
    }

    // Cache the result (only if reasonable size)
    if (JSON.stringify(result).length < 10000) {
      this.processedCache.set(cacheKey, result);
    }

    return result;
  }

  private sanitizeValue(
    key: string,
    value: unknown,
    findings: string[],
    severityBreakdown: SeverityBreakdown,
    stats: SanitizationStats,
    detailedFindings: DetailedFinding[],
    path: string,
  ): unknown {
    stats.totalFields++;

    if (typeof value === 'string') {
      return this.sanitizeString(
        value,
        key,
        findings,
        severityBreakdown,
        stats,
        detailedFindings,
      );
    }

    if (typeof value === 'object') {
      return this.sanitizeObject(
        value,
        findings,
        severityBreakdown,
        stats,
        detailedFindings,
        path,
      );
    }

    return value;
  }

  private sanitizeString(
    value: string,
    key: string,
    findings: string[],
    severityBreakdown: SeverityBreakdown,
    stats: SanitizationStats,
    detailedFindings: DetailedFinding[],
  ): string {
    if (!value || value === '') {
      return value;
    }

    // Check for private keys (critical)
    for (const pattern of this.sensitivePatterns.privateKeys) {
      if (pattern.test(value)) {
        findings.push('Critical security risk: Private keys detected');
        severityBreakdown.critical++;
        stats.sanitizedFields++;
        this.addDetailedFinding(detailedFindings, 'privateKeys', 'critical');
        return '[BLOCKED]';
      }
    }

    // Check for AWS keys (critical)
    for (const pattern of this.sensitivePatterns.awsKeys) {
      if (pattern.test(key) || pattern.test(value)) {
        findings.push('Critical security risk: AWS keys detected');
        severityBreakdown.critical++;
        stats.sanitizedFields++;
        this.addDetailedFinding(detailedFindings, 'awsKeys', 'critical');
        return '[BLOCKED]';
      }
    }

    // Check for environment variables first
    for (const pattern of this.sensitivePatterns.envVars) {
      if (pattern.test(value)) {
        findings.push('Environment variable references sanitized');
        severityBreakdown.low++;
        stats.sanitizedFields++;
        if (value.includes('://')) {
          return '[ENV_VAR_URL]';
        }
        return '[ENV_VAR]';
      }
    }

    // Check for API keys (medium) - also check special characters in key
    for (const pattern of this.sensitivePatterns.apiKeys) {
      if (pattern.test(key) || pattern.test(value)) {
        findings.push('API keys detected and removed');
        severityBreakdown.medium++;
        stats.sanitizedFields++;
        this.addDetailedFinding(detailedFindings, 'apiKeys', 'medium');
        return '[REDACTED]';
      }
    }

    // Also check key with special characters replaced
    const normalizedKey = key.replace(/[.[\]-]/g, '_');
    for (const pattern of this.sensitivePatterns.apiKeys) {
      if (pattern.test(normalizedKey)) {
        findings.push('API keys detected and removed');
        severityBreakdown.medium++;
        stats.sanitizedFields++;
        this.addDetailedFinding(detailedFindings, 'apiKeys', 'medium');
        return '[REDACTED]';
      }
    }

    // Check for base64 encoded secrets before tokens
    if (this.isBase64Secret(value)) {
      findings.push('Base64 encoded secrets detected');
      severityBreakdown.medium++;
      stats.sanitizedFields++;
      return '[ENCODED_SECRET]';
    }

    // Check for tokens (medium)
    for (const pattern of this.sensitivePatterns.tokens) {
      if (pattern.test(key) || pattern.test(value)) {
        findings.push('Tokens detected and removed');
        severityBreakdown.medium++;
        stats.sanitizedFields++;
        return '[REDACTED]';
      }
    }

    // Check for passwords (medium)
    for (const pattern of this.sensitivePatterns.passwords) {
      if (pattern.test(key)) {
        findings.push('Passwords detected and removed');
        severityBreakdown.medium++;
        stats.sanitizedFields++;
        return '[REDACTED]';
      }
    }

    // Check for SSH keys
    for (const pattern of this.sensitivePatterns.sshKeys) {
      if (pattern.test(value)) {
        findings.push('SSH keys detected');
        severityBreakdown.medium++;
        stats.sanitizedFields++;
        return '[SSH_KEY_REDACTED]';
      }
    }

    // Check for connection strings
    for (const pattern of this.sensitivePatterns.connectionStrings) {
      if (pattern.test(value)) {
        findings.push('Database connection strings sanitized');
        severityBreakdown.medium++;
        stats.sanitizedFields++;
        const protocol = value.split('://')[0];
        const parts = value.split('@');
        if (parts.length > 1) {
          return `${protocol}://[REDACTED]@${parts[1]}`;
        }
        return '[REDACTED]';
      }
    }

    // Check for webhooks
    for (const pattern of this.sensitivePatterns.webhooks) {
      if (pattern.test(value)) {
        findings.push('Webhook URLs sanitized');
        severityBreakdown.medium++;
        stats.sanitizedFields++;
        if (value.includes('slack.com')) {
          return 'https://hooks.slack.com/services/[REDACTED]';
        }
        if (value.includes('discord.com')) {
          return 'https://discord.com/api/webhooks/[REDACTED]';
        }
        return '[WEBHOOK_REDACTED]';
      }
    }

    // Check for emails (low)
    for (const pattern of this.sensitivePatterns.emails) {
      if (pattern.test(value)) {
        findings.push('Email addresses removed for privacy');
        severityBreakdown.low++;
        stats.sanitizedFields++;
        return '[EMAIL_REDACTED]';
      }
    }

    // Check for file paths
    if (this.isSensitivePath(value)) {
      findings.push('Sensitive file paths sanitized');
      severityBreakdown.low++;
      stats.sanitizedFields++;
      return this.sanitizePath(value);
    }

    // Check for custom secrets
    if (
      key.toLowerCase().includes('secret') ||
      key.toLowerCase().includes('internal')
    ) {
      if (value && typeof value === 'string' && value.length > 0) {
        findings.push('Custom secrets detected');
        severityBreakdown.medium++;
        stats.sanitizedFields++;
        return '[REDACTED]';
      }
    }

    severityBreakdown.safe++;
    return value;
  }

  private isSensitivePath(value: string): boolean {
    const sensitivePathPatterns = [
      /^\/Users\/[^/]+\//,
      /^\/home\/[^/]+\//,
      /^C:\\Users\\[^\\]+\\/,
      /\.ssh\//,
      /\.aws\//,
      /\.config\//,
      /\.gnupg\//,
      /\.docker\//,
      /\.kube\//,
      /\.npm\//,
      /\/\.git\//,
      /\/node_modules\//,
    ];

    return sensitivePathPatterns.some((pattern) => pattern.test(value));
  }

  private sanitizePath(path: string): string {
    if (path.includes('.ssh')) {
      return '~/.ssh/[REDACTED]';
    }
    if (path.includes('.aws')) {
      return '~/.aws/[REDACTED]';
    }
    if (path.includes('.docker')) {
      return '~/.docker/[REDACTED]';
    }
    if (path.includes('.kube')) {
      return '~/.kube/[REDACTED]';
    }
    if (path.match(/^\/Users\/[^/]+\//)) {
      const parts = path.split('/');
      return `~/${parts.slice(3).join('/')}`.replace(/\/+$/, '');
    }
    if (path.match(/^\/home\/[^/]+\//)) {
      const parts = path.split('/');
      return `~/${parts.slice(3).join('/')}`.replace(/\/+$/, '');
    }
    if (path.match(/^C:\\Users\\[^\\]+\\/)) {
      return '[REDACTED_PATH]';
    }
    return '[REDACTED_PATH]';
  }

  private isBase64Secret(value: string): boolean {
    if (value.length < 20) return false;

    // Skip JWT tokens (they have dots or start with eyJ)
    if (value.includes('.') || value.startsWith('eyJ')) {
      return false;
    }

    // Check if it looks like base64 (must have = padding for secrets)
    if (!/^[\d+/A-Za-z]+={1,2}$/.test(value)) {
      return false;
    }

    try {
      const decoded = Buffer.from(value, 'base64').toString('utf-8');
      const suspiciousPatterns = [
        /password/i,
        /api[_-]?key/i,
        /secret/i,
        /token/i,
        /:/, // Common in credentials like "password:admin123"
      ];
      return suspiciousPatterns.some((pattern) => pattern.test(decoded));
    } catch {
      return false;
    }
  }

  private determineSecurityLevel(
    severityBreakdown: SeverityBreakdown,
    _findings: string[],
  ): 'safe' | 'warning' | 'blocked' {
    if (severityBreakdown.critical > 0) {
      return 'blocked';
    }
    if (severityBreakdown.medium > 0 || severityBreakdown.low > 0) {
      return 'warning';
    }
    return 'safe';
  }

  private consolidateFindings(findings: string[]): string[] {
    const unique = new Set(findings);
    return Array.from(unique);
  }

  private generateRecommendations(
    findings: string[],
    severityBreakdown: SeverityBreakdown,
    detailedFindings: DetailedFinding[],
  ): string[] {
    const recommendations: string[] = [];

    // Check for specific categories in detailed findings
    const hasApiKeys = detailedFindings.some((f) => f.category === 'apiKeys');
    const hasPrivateKeys = detailedFindings.some(
      (f) => f.category === 'privateKeys',
    );
    const hasPasswords = detailedFindings.some(
      (f) => f.category === 'passwords',
    );
    const hasTokens = detailedFindings.some((f) => f.category === 'tokens');
    const hasConnectionStrings = detailedFindings.some(
      (f) => f.category === 'connectionStrings',
    );
    const hasAwsKeys = detailedFindings.some((f) => f.category === 'awsKeys');

    if (hasApiKeys) {
      recommendations.push('Use environment variables for API keys');
      recommendations.push('Consider using a secrets management service');
    }

    if (hasPrivateKeys) {
      recommendations.push('Never include private keys in configurations');
      recommendations.push(
        'Use secure key management systems for production deployments',
      );
      recommendations.push(
        'Consider using certificate-based authentication instead of embedded keys',
      );
    }

    if (hasPasswords) {
      recommendations.push(
        'Replace hardcoded passwords with secure credential storage',
      );
      recommendations.push(
        'Use OAuth or token-based authentication where possible',
      );
    }

    if (hasTokens) {
      recommendations.push(
        'Tokens should be stored securely and rotated regularly',
      );
      recommendations.push('Use short-lived tokens with refresh mechanisms');
    }

    if (hasConnectionStrings) {
      recommendations.push(
        'Store database credentials separately from connection strings',
      );
      recommendations.push(
        'Use connection pooling with encrypted credential storage',
      );
    }

    if (hasAwsKeys) {
      recommendations.push(
        'AWS credentials detected - use IAM roles instead of access keys when possible',
      );
      recommendations.push('Enable AWS CloudTrail to monitor credential usage');
    }

    if (severityBreakdown.critical > 0) {
      recommendations.unshift(
        'CRITICAL: Configuration contains highly sensitive data that must be removed before sharing',
      );
    }

    if (severityBreakdown.medium > 2) {
      recommendations.push(
        'Consider implementing a pre-commit hook to prevent sensitive data from being committed',
      );
      recommendations.push(
        'Use tools like git-secrets or detect-secrets for automated scanning',
      );
    }

    // Add IP address recommendations
    if (detailedFindings.some((f) => f.category === 'ipAddresses')) {
      recommendations.push(
        'Replace hardcoded IP addresses with configuration variables',
      );
    }

    // Add general best practices
    if (recommendations.length === 0) {
      recommendations.push('✅ Configuration appears safe for cloud sharing');
      recommendations.push('Continue following security best practices');
      recommendations.push('Regular security audits are recommended');
    }

    return recommendations;
  }

  // Enhanced helper methods

  private isCustomSecret(key: string, value: string): boolean {
    const secretKeyPatterns = [
      /secret/i,
      /internal/i,
      /private/i,
      /confidential/i,
      /sensitive/i,
      /hidden/i,
    ];

    return (
      secretKeyPatterns.some((pattern) => pattern.test(key)) &&
      value &&
      typeof value === 'string' &&
      value.length > 0 &&
      !this.isEnvironmentVariable(value)
    ); // Don't flag env vars as secrets
  }

  private isEnvironmentVariable(value: string): boolean {
    return (
      /^\${[A-Z_][\dA-Z_]*}$/.test(value) ||
      /^\$[A-Z_][\dA-Z_]*$/.test(value) ||
      /^%[A-Z_][\dA-Z_]*%$/.test(value)
    );
  }

  private addDetailedFinding(
    detailedFindings: DetailedFinding[],
    category: string,
    severity: string,
  ): void {
    const existingFinding = detailedFindings.find(
      (f) => f.category === category,
    );
    if (existingFinding) {
      existingFinding.count++;
    } else {
      detailedFindings.push({ category, severity, count: 1 });
    }
  }
}
