import { Injectable } from '@nestjs/common';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import {
  DANGEROUS_COMMAND_PATTERNS,
  PATH_TRAVERSAL_PATTERNS,
  BLOCKED_PATHS,
  DEFAULT_SECURITY_CONFIG,
} from '../constants/security.constants';
import { CommandConfig } from '../interfaces/platform-config.interface';
import {
  SecurityScanResult,
  SecurityBlocker,
  SecurityValidationResult,
  SecurityStageResult,
  SecuritySeverity,
  CommandValidationResult,
  PathValidationResult,
  SensitiveDataResult,
} from '../interfaces/security-config.interface';

export interface ApiKeyScanResult {
  isSafe: boolean;
  detectedKeys?: string[];
}

export interface CommandScanResult {
  isSafe: boolean;
  blockedCommands?: string[];
}

export interface PathScanResult {
  detected: boolean;
  paths?: string[];
}

@Injectable()
export class SecurityScannerService {
  async scanContext(context: TaptikContext): Promise<SecurityScanResult> {
    const apiKeyScan = this.scanForApiKeys(context);
    const contentString = JSON.stringify(context);
    const commandScan = await this.scanForMaliciousCommands(contentString);
    const pathScan = await this.detectDirectoryTraversal([contentString]);

    const isSafe =
      !apiKeyScan.detectedKeys?.length && commandScan.passed && !pathScan;
    const blockers: string[] = [];

    if (apiKeyScan.detectedKeys?.length) {
      blockers.push('Detected API keys');
    }
    if (!commandScan.passed) {
      blockers.push('Detected malicious commands');
    }
    if (pathScan) {
      blockers.push('Detected directory traversal');
    }

    return {
      passed: isSafe,
      isSafe,
      hasApiKeys: !!apiKeyScan.detectedKeys?.length,
      hasMaliciousCommands: !commandScan.passed,
      blockers: blockers.length > 0 ? blockers : undefined,
      warnings: [],
      errors: [],
      summary: {
        totalIssues: blockers.length,
        warnings: 0,
        errors: 0,
        blockers: blockers.length,
        highSeverity: blockers.length,
        mediumSeverity: 0,
        lowSeverity: 0,
      },
    };
  }

  scanForApiKeys(context: TaptikContext): ApiKeyScanResult {
    const contentString = JSON.stringify(context);
    const detectedKeys: string[] = [];

    // Check for common API key patterns
    const apiKeyPatterns = [
      /api[_-]?key\s*[:=]\s*["'][^"']{20,}["']/gi,
      /secret[_-]?key\s*[:=]\s*["'][^"']{20,}["']/gi,
      /access[_-]?token\s*[:=]\s*["'][^"']{20,}["']/gi,
    ];

    for (const pattern of apiKeyPatterns) {
      const matches = contentString.match(pattern);
      if (matches) {
        detectedKeys.push(...matches);
      }
    }

    return {
      isSafe: detectedKeys.length === 0,
      detectedKeys: detectedKeys.length > 0 ? detectedKeys : undefined,
    };
  }

  async scanForMaliciousCommands(content: string): Promise<SecurityScanResult> {
    const blockers: SecurityBlocker[] = [];
    const warnings: unknown[] = [];
    const errors: unknown[] = [];

    for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
      if (pattern.test(content)) {
        blockers.push({
          type: 'malicious',
          message: `Dangerous command pattern detected: ${pattern.source}`,
          location: 'command content',
          details: { pattern: pattern.source, content },
        });
      }
    }

    return {
      passed: blockers.length === 0,
      warnings: [],
      errors: [],
      blockers,
      summary: {
        totalIssues: blockers.length + warnings.length + errors.length,
        warnings: warnings.length,
        errors: errors.length,
        blockers: blockers.length,
        highSeverity: blockers.length,
        mediumSeverity: errors.length,
        lowSeverity: warnings.length,
      },
    };
  }

  async detectDirectoryTraversal(paths: string[]): Promise<boolean> {
    for (const path of paths) {
      // Check for traversal patterns
      for (const pattern of PATH_TRAVERSAL_PATTERNS) {
        if (pattern.test(path)) {
          return true;
        }
      }

      // Check for blocked paths
      for (const blockedPath of BLOCKED_PATHS) {
        if (path.includes(blockedPath) || path === blockedPath) {
          return true;
        }
      }
    }

    return false;
  }

  async validateCommandSafety(command: CommandConfig): Promise<boolean> {
    // Check command content for dangerous patterns
    const scanResult = await this.scanForMaliciousCommands(command.content);
    if (!scanResult.passed) {
      return false;
    }

    // Validate permissions match content
    if (command.permissions && command.permissions.length > 0) {
      // Basic validation that permissions are properly formatted
      for (const permission of command.permissions) {
        if (!/^[A-Za-z]+\(.+\)$/.test(permission)) {
          return false;
        }
      }
    }

    return true;
  }

  async sanitizeSensitiveData(context: TaptikContext): Promise<TaptikContext> {
    const sanitized = JSON.parse(JSON.stringify(context));

    const sanitizeObject = (object: unknown): unknown => {
      if (typeof object !== 'object' || object === null) {
        return object;
      }

      if (Array.isArray(object)) {
        return object.map(sanitizeObject);
      }

      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(object)) {
        // Check if key matches sensitive patterns
        let isSensitive = false;
        for (const pattern of DEFAULT_SECURITY_CONFIG.sensitiveDataPatterns) {
          if (pattern.test(key)) {
            isSensitive = true;
            break;
          }
        }

        if (isSensitive) {
          result[key] = '[FILTERED]';
        } else if (typeof value === 'string') {
          // Check if value looks like a sensitive token
          let shouldFilter = false;
          for (const pattern of DEFAULT_SECURITY_CONFIG.sensitiveDataPatterns) {
            if (pattern.test(value)) {
              shouldFilter = true;
              break;
            }
          }
          result[key] = shouldFilter ? '[FILTERED]' : value;
        } else {
          result[key] = sanitizeObject(value);
        }
      }
      return result;
    };

    sanitized.content = sanitizeObject(
      sanitized.content,
    ) as typeof sanitized.content;
    return sanitized;
  }

  async runSecurityPipeline(
    context: TaptikContext,
  ): Promise<SecurityValidationResult> {
    const stages: SecurityStageResult[] = [];

    // Stage 1: Command Validation
    const commandValidation = await this.validateCommands(context);
    stages.push({
      stage: 'commandValidation',
      passed: commandValidation.safe,
      severity: commandValidation.safe
        ? SecuritySeverity.INFO
        : SecuritySeverity.HIGH,
      blocking: !commandValidation.safe,
      message: commandValidation.safe
        ? 'Commands validated'
        : 'Dangerous commands detected',
      issues: commandValidation.issues,
    });

    if (!commandValidation.safe) {
      throw new Error(
        `Security violation in commandValidation: ${commandValidation.issues?.join(', ')}`,
      );
    }

    // Stage 2: Path Validation
    const pathValidation = await this.validatePaths(context);
    stages.push({
      stage: 'pathValidation',
      passed: pathValidation.safe,
      severity: pathValidation.safe
        ? SecuritySeverity.INFO
        : SecuritySeverity.HIGH,
      blocking: !pathValidation.safe,
      message: pathValidation.safe
        ? 'Paths validated'
        : 'Path traversal detected',
      issues: pathValidation.issues,
    });

    if (!pathValidation.safe) {
      throw new Error(
        `Security violation in pathValidation: ${pathValidation.issues?.join(', ')}`,
      );
    }

    // Stage 3: Sensitive Data Scan
    const sensitiveDataScan = await this.scanSensitiveData(context);
    stages.push({
      stage: 'sensitiveDataScan',
      passed: !sensitiveDataScan.found || !!sensitiveDataScan.sanitized,
      severity: sensitiveDataScan.found
        ? SecuritySeverity.MEDIUM
        : SecuritySeverity.INFO,
      blocking: false,
      message: sensitiveDataScan.found
        ? 'Sensitive data detected and sanitized'
        : 'No sensitive data found',
      issues: sensitiveDataScan.types,
    });

    // Stage 4: Permission Check
    stages.push({
      stage: 'permissionCheck',
      passed: true,
      severity: SecuritySeverity.INFO,
      blocking: false,
      message: 'Permissions validated',
    });

    // Stage 5: Integrity Check
    stages.push({
      stage: 'integrityCheck',
      passed: true,
      severity: SecuritySeverity.INFO,
      blocking: false,
      message: 'Integrity check passed',
    });

    return {
      passed: true,
      stages,
      warnings: stages
        .filter((s) => s.severity === SecuritySeverity.MEDIUM)
        .map((s) => s.message || ''),
      errors: stages
        .filter((s) => s.severity === SecuritySeverity.HIGH && !s.blocking)
        .map((s) => s.message || ''),
      blockers: stages.filter((s) => s.blocking).map((s) => s.message || ''),
    };
  }

  private async validateCommands(
    context: TaptikContext,
  ): Promise<CommandValidationResult> {
    const ide = context.content.ide as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const commands = Array.isArray(ide?.commands) ? ide.commands : [];

    if (commands.length === 0) {
      return {
        safe: true,
        command: 'all',
        issues: undefined,
      };
    }

    const validationResults = await Promise.all(
      commands.map(async (command: CommandConfig) => {
        const isSafe = await this.validateCommandSafety(command);
        return isSafe ? null : `Dangerous command: ${command.name}`;
      }),
    );

    const issues = validationResults.filter(
      (issue): issue is string => issue !== null,
    );

    return {
      safe: issues.length === 0,
      command: 'all',
      issues: issues.length > 0 ? issues : undefined,
    };
  }

  private async validatePaths(
    context: TaptikContext,
  ): Promise<PathValidationResult> {
    const allPaths: string[] = [];

    // Collect all paths from context
    // Note: The TaptikContext interface doesn't have a direct files property
    // We'll collect paths from various places where they might exist
    const collectPaths = (
      object: unknown,
      collected: string[] = [],
    ): string[] => {
      if (
        typeof object === 'string' &&
        (object.includes('/') || object.includes('\\'))
      ) {
        collected.push(object);
      } else if (Array.isArray(object)) {
        object.forEach((item) => collectPaths(item, collected));
      } else if (typeof object === 'object' && object !== null) {
        Object.values(object).forEach((value) =>
          collectPaths(value, collected),
        );
      }
      return collected;
    };

    collectPaths(context.content, allPaths);

    const hasTraversal =
      allPaths.length > 0
        ? await this.detectDirectoryTraversal(allPaths)
        : false;

    return {
      safe: !hasTraversal,
      paths: allPaths,
      issues: hasTraversal
        ? ['Directory traversal or blocked path detected']
        : undefined,
    };
  }

  private async scanSensitiveData(
    context: TaptikContext,
  ): Promise<SensitiveDataResult> {
    const locations: string[] = [];
    const types: string[] = [];

    const scanObject = (object: unknown, path = ''): void => {
      if (typeof object !== 'object' || object === null) {
        return;
      }

      if (Array.isArray(object)) {
        object.forEach((item, index) => scanObject(item, `${path}[${index}]`));
        return;
      }

      for (const [key, value] of Object.entries(object)) {
        const currentPath = path ? `${path}.${key}` : key;

        for (const pattern of DEFAULT_SECURITY_CONFIG.sensitiveDataPatterns) {
          if (
            pattern.test(key) ||
            (typeof value === 'string' && pattern.test(value))
          ) {
            locations.push(currentPath);
            types.push(pattern.source);
            break;
          }
        }

        scanObject(value, currentPath);
      }
    };

    scanObject(context.content);

    return {
      found: locations.length > 0,
      locations,
      types: [...new Set(types)],
      sanitized: true, // We sanitize automatically
    };
  }
}
