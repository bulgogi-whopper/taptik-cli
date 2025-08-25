import { createHash } from 'crypto';

import { Injectable } from '@nestjs/common';

export interface SanitizationPattern {
  name: string;
  pattern: RegExp;
  severity: 'high' | 'medium' | 'low';
  replacement?: string;
}

export interface SanitizationMatch {
  pattern: string;
  value: string;
  location: string;
  severity: 'high' | 'medium' | 'low';
}

export interface SanitizationReport {
  level: 'safe' | 'warning' | 'blocked';
  totalIssues: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  lowSeverityCount: number;
  matches: SanitizationMatch[];
  sanitizedLocations: string[];
  checksum: string;
  processedAt: Date;
}

export interface SanitizationOptions {
  removeSecrets: boolean;
  maskEmails: boolean;
  removeComments: boolean;
  strictMode: boolean;
}

@Injectable()
export class SanitizationService {
  private readonly SENSITIVE_PATTERNS: SanitizationPattern[] = [
    // API Keys and Tokens
    {
      name: 'API Key',
      pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["']?([\w-]{20,})["']?/gi,
      severity: 'high',
      replacement: 'API_KEY_REMOVED',
    },
    {
      name: 'Bearer Token',
      pattern: /bearer\s+([\w.-]+)/gi,
      severity: 'high',
      replacement: 'BEARER_TOKEN_REMOVED',
    },
    {
      name: 'Auth Token',
      pattern:
        /(?:auth[_-]?token|authorization)\s*[:=]\s*["']?([\w.-]{20,})["']?/gi,
      severity: 'high',
      replacement: 'AUTH_TOKEN_REMOVED',
    },
    {
      name: 'Access Token',
      pattern: /access[_-]?token\s*[:=]\s*["']?([\w.-]{20,})["']?/gi,
      severity: 'high',
      replacement: 'ACCESS_TOKEN_REMOVED',
    },
    {
      name: 'Refresh Token',
      pattern: /refresh[_-]?token\s*[:=]\s*["']?([\w.-]{20,})["']?/gi,
      severity: 'high',
      replacement: 'REFRESH_TOKEN_REMOVED',
    },
    // Secrets and Passwords
    {
      name: 'Secret Key',
      pattern: /(?:secret[_-]?key|secret)\s*[:=]\s*["']?([\w-]{10,})["']?/gi,
      severity: 'high',
      replacement: 'SECRET_REMOVED',
    },
    {
      name: 'Password',
      pattern:
        /(?:password|passwd|pwd)\s*[:=]\s*["']?([\w!#$%&*@^]{6,})["']?/gi,
      severity: 'high',
      replacement: 'PASSWORD_REMOVED',
    },
    {
      name: 'Private Key',
      pattern: /private[_-]?key\s*[:=]\s*["']?([\w-]{20,})["']?/gi,
      severity: 'high',
      replacement: 'PRIVATE_KEY_REMOVED',
    },
    // Database Credentials
    {
      name: 'PostgreSQL URI',
      pattern: /^postgres(?:ql)?:\/\/.+$/gi,
      severity: 'high',
      replacement: 'DATABASE_URL_REMOVED',
    },
    {
      name: 'MongoDB URI',
      pattern: /^mongodb(?:\+srv)?:\/\/.+$/gi,
      severity: 'high',
      replacement: 'MONGODB_URI_REMOVED',
    },
    {
      name: 'MySQL URI',
      pattern: /^mysql:\/\/.+$/gi,
      severity: 'high',
      replacement: 'MYSQL_URI_REMOVED',
    },
    // Cloud Provider Credentials
    {
      name: 'AWS Access Key',
      pattern: /\bAKIA[\dA-Z]{16}\b/g,
      severity: 'high',
      replacement: 'AWS_ACCESS_KEY_REMOVED',
    },
    {
      name: 'AWS Secret Key',
      pattern:
        /aws[_-]?secret[_-]?access[_-]?key\s*[:=]\s*["']?([\w+/=]{40})["']?/gi,
      severity: 'high',
      replacement: 'AWS_SECRET_KEY_REMOVED',
    },
    {
      name: 'Google API Key',
      pattern: /aiza[\w-]{35}/gi,
      severity: 'high',
      replacement: 'GOOGLE_API_KEY_REMOVED',
    },
    {
      name: 'Firebase Key',
      pattern:
        /(?:firebase[_-]?key|firebase[_-]?api[_-]?key)\s*[:=]\s*["']?([\w-]{20,})["']?/gi,
      severity: 'high',
      replacement: 'FIREBASE_KEY_REMOVED',
    },
    {
      name: 'Supabase URL',
      pattern: /https:\/\/[\da-z]+\.supabase\.co/gi,
      severity: 'medium',
      replacement: 'SUPABASE_URL_REMOVED',
    },
    {
      name: 'Supabase Anon Key',
      pattern: /eyJ(?:[\w-]+\.){2}[\w-]+/g,
      severity: 'high',
      replacement: 'SUPABASE_KEY_REMOVED',
    },
    // Personal Information
    {
      name: 'Email Address',
      pattern: /\b[\w%+.-]+@[\d.A-Za-z-]+\.[A-Za-z|]{2,}\b/g,
      severity: 'low',
      replacement: 'EMAIL_REMOVED',
    },
    {
      name: 'Phone Number',
      pattern: /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
      severity: 'low',
      replacement: 'PHONE_REMOVED',
    },
    {
      name: 'Social Security Number',
      pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
      severity: 'high',
      replacement: 'SSN_REMOVED',
    },
    {
      name: 'Credit Card',
      pattern: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
      severity: 'high',
      replacement: 'CREDIT_CARD_REMOVED',
    },
    // OAuth and Social Media
    {
      name: 'GitHub Token',
      pattern: /\bgh[ps]_[\dA-Za-z]{36}\b/g,
      severity: 'high',
      replacement: 'GITHUB_TOKEN_REMOVED',
    },
    {
      name: 'Slack Token',
      pattern: /xox[abprs]-[\da-z-]+/gi,
      severity: 'high',
      replacement: 'SLACK_TOKEN_REMOVED',
    },
    {
      name: 'Discord Token',
      pattern: /discord[_-]?token\s*[:=]\s*["']?([\w.-]{50,})["']?/gi,
      severity: 'high',
      replacement: 'DISCORD_TOKEN_REMOVED',
    },
    // Cryptocurrency
    {
      name: 'Bitcoin Private Key',
      pattern: /[5KL][1-9A-HJ-NP-Za-km-z]{50,51}/g,
      severity: 'high',
      replacement: 'BITCOIN_KEY_REMOVED',
    },
    {
      name: 'Ethereum Private Key',
      pattern: /0x[\dA-Fa-f]{64}/g,
      severity: 'high',
      replacement: 'ETHEREUM_KEY_REMOVED',
    },
    // Generic Patterns
    {
      name: 'Generic Token',
      pattern: /token\s*[:=]\s*["']?([\w.-]{20,})["']?/gi,
      severity: 'medium',
      replacement: 'TOKEN_REMOVED',
    },
    {
      name: 'Generic Secret',
      pattern: /secret\s*[:=]\s*["']?([\w-]{10,})["']?/gi,
      severity: 'medium',
      replacement: 'SECRET_REMOVED',
    },
    {
      name: 'Generic Key',
      pattern: /key\s*[:=]\s*["']?([\w-]{20,})["']?/gi,
      severity: 'low',
      replacement: 'KEY_REMOVED',
    },
  ];

  private readonly DEFAULT_OPTIONS: SanitizationOptions = {
    removeSecrets: true,
    maskEmails: true,
    removeComments: false,
    strictMode: false,
  };

  async sanitizePackage(
    packageBuffer: Buffer,
    options: Partial<SanitizationOptions> = {},
  ): Promise<{
    sanitizedBuffer: Buffer;
    report: SanitizationReport;
    level: 'safe' | 'warning' | 'blocked';
  }> {
    const mergedOptions = { ...this.DEFAULT_OPTIONS, ...options };
    const packageContent = packageBuffer.toString('utf-8');

    // Parse package content (assuming it's JSON or similar structured format)
    let parsedContent: unknown;
    try {
      parsedContent = JSON.parse(packageContent);
    } catch {
      // If not JSON, treat as plain text
      parsedContent = packageContent;
    }

    const matches: SanitizationMatch[] = [];
    const sanitizedLocations: string[] = [];

    // Perform sanitization
    const sanitizedContent = this.sanitizeContent(
      parsedContent,
      mergedOptions,
      matches,
      sanitizedLocations,
    );

    // Calculate severity counts
    const highSeverityCount = matches.filter(
      (m) => m.severity === 'high',
    ).length;
    const mediumSeverityCount = matches.filter(
      (m) => m.severity === 'medium',
    ).length;
    const lowSeverityCount = matches.filter((m) => m.severity === 'low').length;

    // Determine security level
    let level: 'safe' | 'warning' | 'blocked';
    if (highSeverityCount > 0 && mergedOptions.strictMode) {
      level = 'blocked';
    } else if (highSeverityCount > 0 || mediumSeverityCount > 3) {
      level = 'warning';
    } else {
      level = 'safe';
    }

    // Generate report
    const report: SanitizationReport = {
      level,
      totalIssues: matches.length,
      highSeverityCount,
      mediumSeverityCount,
      lowSeverityCount,
      matches,
      sanitizedLocations,
      checksum: this.generateChecksum(sanitizedContent),
      processedAt: new Date(),
    };

    // Convert sanitized content back to buffer
    const sanitizedBuffer = Buffer.from(
      typeof sanitizedContent === 'string'
        ? sanitizedContent
        : JSON.stringify(sanitizedContent, null, 2),
      'utf-8',
    );

    return {
      sanitizedBuffer,
      report,
      level,
    };
  }

  private sanitizeContent(
    content: unknown,
    options: SanitizationOptions,
    matches: SanitizationMatch[],
    sanitizedLocations: string[],
    path: string = '',
  ): unknown {
    if (typeof content === 'string') {
      return this.sanitizeString(
        content,
        options,
        matches,
        sanitizedLocations,
        path,
      );
    }

    if (Array.isArray(content)) {
      return content.map((item, index) =>
        this.sanitizeContent(
          item,
          options,
          matches,
          sanitizedLocations,
          `${path}[${index}]`,
        ),
      );
    }

    if (content && typeof content === 'object') {
      const sanitizedObj: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(
        content as Record<string, unknown>,
      )) {
        const currentPath = path ? `${path}.${key}` : key;

        // Special handling for known sensitive field names
        let sanitizedValue = value;
        if (typeof value === 'string' && this.isSensitiveFieldName(key)) {
          sanitizedValue = this.sanitizeByFieldName(
            key,
            value,
            options,
            matches,
            sanitizedLocations,
            currentPath,
          );
        } else {
          sanitizedValue = this.sanitizeContent(
            value,
            options,
            matches,
            sanitizedLocations,
            currentPath,
          );
        }

        sanitizedObj[key] = sanitizedValue;
      }
      return sanitizedObj;
    }

    return content;
  }

  private isSensitiveFieldName(fieldName: string): boolean {
    const sensitiveFieldPatterns = [
      /password/i,
      /passwd/i,
      /pwd/i,
      /secret/i,
      /api[_-]?key/i,
      /apikey/i,
      /token/i,
      /auth/i,
      /credential/i,
      /private[_-]?key/i,
      /access[_-]?key/i,
      /database[_-]?url/i,
      /db[_-]?url/i,
      /connection[_-]?string/i,
    ];

    return sensitiveFieldPatterns.some((pattern) => pattern.test(fieldName));
  }

  private sanitizeByFieldName(
    fieldName: string,
    value: string,
    options: SanitizationOptions,
    matches: SanitizationMatch[],
    sanitizedLocations: string[],
    path: string,
  ): string {
    // Determine the appropriate replacement based on field name
    let replacement = 'REDACTED';
    let patternName = 'Sensitive Field';
    const severity: 'high' | 'medium' | 'low' = 'high';

    // Check more specific patterns first
    if (/aws[_-]?secret[_-]?access[_-]?key/i.test(fieldName)) {
      replacement = 'AWS_SECRET_KEY_REMOVED';
      patternName = 'AWS Secret Key';
    } else if (/password|passwd|pwd/i.test(fieldName)) {
      replacement = 'PASSWORD_REMOVED';
      patternName = 'Password';
    } else if (/api[_-]?key|apikey/i.test(fieldName)) {
      replacement = 'API_KEY_REMOVED';
      patternName = 'API Key';
    } else if (
      /database[_-]?url|db[_-]?url|connection[_-]?string/i.test(fieldName)
    ) {
      replacement = 'DATABASE_URL_REMOVED';
      patternName = 'Database URL';
    } else if (/secret/i.test(fieldName)) {
      replacement = 'SECRET_REMOVED';
      // Use 'Secret Key' for secret_key field
      if (/secret[_-]?key/i.test(fieldName)) {
        patternName = 'Secret Key';
      } else {
        patternName = 'Generic Secret';
      }
    } else if (/token/i.test(fieldName)) {
      // Special check for GitHub token pattern
      if (value.match(/^gh[ps]_[\dA-Za-z]{36}$/)) {
        replacement = 'GITHUB_TOKEN_REMOVED';
        patternName = 'GitHub Token';
      } else {
        replacement = 'TOKEN_REMOVED';
        patternName = 'Generic Token';
      }
    } else if (/access[_-]?key/i.test(fieldName)) {
      // Check if it's an AWS access key by pattern
      if (value.match(/^AKIA[\dA-Z]{16}$/)) {
        replacement = 'AWS_ACCESS_KEY_REMOVED';
        patternName = 'AWS Access Key';
      } else {
        replacement = 'ACCESS_KEY_REMOVED';
        patternName = 'Access Key';
      }
    }

    matches.push({
      pattern: patternName,
      value: value.length > 20 ? `${value.substring(0, 20)}...` : value,
      location: path,
      severity,
    });

    if (options.removeSecrets) {
      sanitizedLocations.push(path);
      return replacement;
    }

    return value; // Return original value if removeSecrets is false
  }

  private sanitizeString(
    text: string,
    options: SanitizationOptions,
    matches: SanitizationMatch[],
    sanitizedLocations: string[],
    path: string,
  ): string {
    let sanitizedText = text;
    let hasChanges = false;

    for (const pattern of this.SENSITIVE_PATTERNS) {
      // Skip certain patterns based on options
      if (!options.removeSecrets && pattern.severity === 'high') {
        continue;
      }
      if (!options.maskEmails && pattern.name === 'Email Address') {
        continue;
      }

      // Ensure regex has global flag for matchAll
      const regex = pattern.pattern.global
        ? pattern.pattern
        : new RegExp(pattern.pattern.source, `${pattern.pattern.flags}g`);
      const foundMatches = text.matchAll(regex);

      for (const match of foundMatches) {
        matches.push({
          pattern: pattern.name,
          value:
            match[0].length > 20 ? `${match[0].substring(0, 20)}...` : match[0],
          location: path,
          severity: pattern.severity,
        });

        if (pattern.replacement) {
          sanitizedText = sanitizedText.replace(match[0], pattern.replacement);
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      sanitizedLocations.push(path);
    }

    return sanitizedText;
  }

  async generateAutoTags(packageContent: unknown): Promise<string[]> {
    const tags = new Set<string>();

    // Handle circular references by using try-catch for JSON.stringify
    let contentString: string;
    try {
      contentString = JSON.stringify(packageContent).toLowerCase();
    } catch {
      // If circular reference, just convert what we can
      contentString = String(packageContent).toLowerCase();
    }

    // Platform detection
    const platformPatterns = {
      'claude-code': /claude[_-]?code|anthropic/i,
      kiro: /kiro[_-]?ide|kiro/i,
      cursor: /cursor[_-]?ide|cursor/i,
      vscode: /vscode|visual[_-]?studio[_-]?code/i,
      jetbrains: /intellij|webstorm|pycharm|rider|goland/i,
    };

    // Technology detection
    const techPatterns = {
      typescript: /\.ts|typescript|tsconfig/i,
      javascript: /\.js|javascript|webpack|babel/i,
      react: /react|jsx|tsx/i,
      vue: /vue|\.vue/i,
      angular: /angular|\.ng/i,
      nodejs: /node|npm|yarn|pnpm/i,
      python: /python|\.py|pip|poetry/i,
      java: /java|\.java|maven|gradle/i,
      golang: /golang|\.go|go\.mod/i,
      rust: /rust|cargo|\.rs/i,
      docker: /docker|dockerfile|container/i,
      kubernetes: /kubernetes|k8s|kubectl/i,
      aws: /aws|amazon|s3|ec2|lambda/i,
      gcp: /google[_-]?cloud|gcp|firebase/i,
      azure: /azure|microsoft/i,
    };

    // Component detection
    const componentPatterns = {
      agent: /agent|assistant|ai/i,
      command: /command|cmd|cli/i,
      api: /api|rest|graphql|endpoint/i,
      database: /database|db|sql|nosql|mongodb|postgres/i,
      authentication: /auth|login|oauth|jwt/i,
      testing: /test|spec|jest|vitest|mocha/i,
      'ci-cd': /ci|cd|pipeline|github[_-]?actions|jenkins/i,
      monitoring: /monitor|logging|metrics|tracing/i,
      security: /security|encryption|ssl|tls|https/i,
      frontend: /frontend|ui|ux|css|html/i,
      backend: /backend|server|api|microservice/i,
      fullstack: /fullstack|full[_-]?stack/i,
    };

    // Check platform patterns
    for (const [tag, pattern] of Object.entries(platformPatterns)) {
      if (pattern.test(contentString)) {
        tags.add(tag);
      }
    }

    // Check technology patterns
    for (const [tag, pattern] of Object.entries(techPatterns)) {
      if (pattern.test(contentString)) {
        tags.add(tag);
      }
    }

    // Check component patterns
    for (const [tag, pattern] of Object.entries(componentPatterns)) {
      if (pattern.test(contentString)) {
        tags.add(tag);
      }
    }

    // Add metadata-based tags
    const content = packageContent as Record<string, unknown>;
    if (content.version && typeof content.version === 'string') {
      tags.add(`v${content.version.split('.')[0]}`);
    }

    if (content.platform && typeof content.platform === 'string') {
      tags.add(content.platform);
    }

    // Add size-based tags
    const sizeInBytes = Buffer.byteLength(contentString);
    if (sizeInBytes < 10000) {
      tags.add('small');
    } else if (sizeInBytes < 100000) {
      tags.add('medium');
    } else {
      tags.add('large');
    }

    // Add complexity tags based on structure depth
    const depth = this.calculateObjectDepth(packageContent);
    if (depth <= 2) {
      tags.add('simple');
    } else if (depth <= 4) {
      tags.add('moderate');
    } else {
      tags.add('complex');
    }

    return Array.from(tags).slice(0, 20); // Limit to 20 tags
  }

  private calculateObjectDepth(obj: unknown, currentDepth: number = 0): number {
    if (currentDepth > 10) return currentDepth; // Prevent infinite recursion

    if (!obj || typeof obj !== 'object') {
      return currentDepth;
    }

    let maxDepth = currentDepth + 1; // Count current level

    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') {
        const depth = this.calculateObjectDepth(value, currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    }

    return maxDepth;
  }

  private generateChecksum(content: unknown): string {
    const contentString =
      typeof content === 'string' ? content : JSON.stringify(content);
    return createHash('sha256').update(contentString).digest('hex');
  }

  validateSanitizationReport(report: SanitizationReport): boolean {
    // Validate report structure
    if (!report || typeof report !== 'object') {
      return false;
    }

    // Check required fields
    const requiredFields = [
      'level',
      'totalIssues',
      'highSeverityCount',
      'mediumSeverityCount',
      'lowSeverityCount',
      'matches',
      'sanitizedLocations',
      'checksum',
      'processedAt',
    ];

    for (const field of requiredFields) {
      if (!(field in report)) {
        return false;
      }
    }

    // Validate counts
    const calculatedTotal =
      report.highSeverityCount +
      report.mediumSeverityCount +
      report.lowSeverityCount;

    if (calculatedTotal !== report.totalIssues) {
      return false;
    }

    // Validate level logic
    if (report.highSeverityCount > 0 && report.level === 'safe') {
      return false;
    }

    return true;
  }

  getMaskedValue(value: string, pattern: SanitizationPattern): string {
    if (!pattern.replacement) {
      return value;
    }

    // For emails, mask but keep domain
    if (pattern.name === 'Email Address') {
      const parts = value.split('@');
      if (parts.length === 2) {
        return `***@${parts[1]}`;
      }
    }

    // For other patterns, use the replacement
    return pattern.replacement;
  }
}
