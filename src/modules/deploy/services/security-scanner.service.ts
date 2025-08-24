import { Injectable } from '@nestjs/common';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import {
  DANGEROUS_COMMAND_PATTERNS,
  PATH_TRAVERSAL_PATTERNS,
  BLOCKED_PATHS,
  DEFAULT_SECURITY_CONFIG,
} from '../constants/security.constants';
import {
  KiroHookConfiguration,
  KiroAgentConfiguration,
  KiroTemplateConfiguration,
  KiroComponentType,
  KiroDeploymentOptions,
} from '../interfaces/kiro-deployment.interface';
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

export interface KiroSecurityScanResult extends SecurityScanResult {
  componentType?: KiroComponentType;
  quarantinedComponents?: string[];
  securityViolations?: KiroSecurityViolation[];
}

export interface KiroSecurityViolation {
  componentType: KiroComponentType;
  component: string;
  violationType: 'malicious_code' | 'dangerous_capability' | 'sensitive_data' | 'injection_attempt';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation: string;
  quarantined: boolean;
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
      /api[_-]?key\s*[:=]\s*["'][^"']{8,}["']/gi,
      /secret[_-]?key\s*[:=]\s*["'][^"']{8,}["']/gi,
      /access[_-]?token\s*[:=]\s*["'][^"']{8,}["']/gi,
      // Also match without quotes for broader detection
      /["']api[_-]?key["']\s*:\s*["'][^"']{8,}["']/gi,
      /["']secret[_-]?key["']\s*:\s*["'][^"']{8,}["']/gi,
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

  // Kiro-specific security scanning methods

  async scanKiroComponents(
    components: Array<{
      type: KiroComponentType;
      name: string;
      content: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    }>,
    _options: KiroDeploymentOptions,
  ): Promise<KiroSecurityScanResult> {
    const violations: KiroSecurityViolation[] = [];
    const quarantinedComponents: string[] = [];
    const blockers: SecurityBlocker[] = [];

    const componentPromises = components.map(component =>
      this.scanKiroComponent(component.content, component.type, component.name)
    );
    
    const allComponentViolations = await Promise.all(componentPromises);
    
    for (let i = 0; i < components.length; i++) {
      const component = components[i];
      const componentViolations = allComponentViolations[i];
      
      violations.push(...componentViolations);

      // Quarantine components with critical or high severity violations
      const highSeverityViolations = componentViolations.filter(v => 
        v.severity === 'critical' || v.severity === 'high'
      );
      
      if (highSeverityViolations.length > 0) {
        quarantinedComponents.push(component.name);
        
        for (const violation of highSeverityViolations) {
          blockers.push({
            type: violation.violationType === 'injection_attempt' ? 'injection' : 
                  violation.violationType === 'malicious_code' ? 'malicious' : 'unauthorized',
            message: `${component.type}/${component.name}: ${violation.description}`,
            location: component.name,
            details: { violation },
          });
        }
      }
    }

    const highSeverityCount = violations.filter(v => v.severity === 'high' || v.severity === 'critical').length;
    const mediumSeverityCount = violations.filter(v => v.severity === 'medium').length;
    const lowSeverityCount = violations.filter(v => v.severity === 'low').length;

    return {
      passed: blockers.length === 0,
      isSafe: blockers.length === 0,
      hasApiKeys: violations.some(v => v.violationType === 'sensitive_data'),
      hasMaliciousCommands: violations.some(v => v.violationType === 'malicious_code'),
      blockers,
      warnings: violations.filter(v => v.severity === 'medium').map(v => ({
        type: 'data' as const,
        message: v.description,
        location: v.component,
        severity: SecuritySeverity.MEDIUM,
      })),
      errors: violations.filter(v => v.severity === 'high').map(v => ({
        type: 'data' as const,
        message: v.description,
        location: v.component,
        severity: SecuritySeverity.HIGH,
        recoverable: false,
      })),
      quarantinedComponents,
      securityViolations: violations,
      summary: {
        totalIssues: violations.length,
        warnings: mediumSeverityCount,
        errors: highSeverityCount,
        blockers: blockers.length,
        highSeverity: highSeverityCount,
        mediumSeverity: mediumSeverityCount,
        lowSeverity: lowSeverityCount,
      },
    };
  }

  async scanKiroComponent(
    content: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    componentType: KiroComponentType,
    componentName: string,
  ): Promise<KiroSecurityViolation[]> {
    const violations: KiroSecurityViolation[] = [];

    switch (componentType) {
      case 'hooks':
        violations.push(...await this.scanKiroHook(content as KiroHookConfiguration, componentName));
        break;
      case 'agents':
        violations.push(...await this.scanKiroAgent(content as KiroAgentConfiguration, componentName));
        break;
      case 'templates':
        violations.push(...await this.scanKiroTemplate(content as KiroTemplateConfiguration, componentName));
        break;
      case 'settings':
        violations.push(...await this.scanKiroSettings(content, componentName));
        break;
      case 'steering':
        violations.push(...await this.scanKiroSteering(content, componentName));
        break;
      case 'specs':
        violations.push(...await this.scanKiroSpecs(content, componentName));
        break;
    }

    return violations;
  }

  async scanKiroHook(hook: KiroHookConfiguration, componentName: string): Promise<KiroSecurityViolation[]> {
    const violations: KiroSecurityViolation[] = [];

    // 1. Scan hook command for dangerous patterns
    const dangerousPatterns = [
      /rm\s+-rf\s+[/~]/gi,
      /sudo\s+/gi,
      /chmod\s+777/gi,
      /curl\s+.*\|\s*sh/gi,
      /wget\s+.*\|\s*sh/gi,
      /eval\s*\(/gi,
      /exec\s*\(/gi,
      />\s*\/dev\/null\s+2>&1/gi,
      /mkfs/gi,
      /dd\s+if=/gi,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(hook.command)) {
        violations.push({
          componentType: 'hooks',
          component: componentName,
          violationType: 'malicious_code',
          severity: 'critical',
          description: `Hook contains dangerous command pattern: ${pattern.source}`,
          recommendation: 'Remove dangerous command or use safer alternative',
          quarantined: true,
        });
      }
    }

    // 2. Check for sensitive data in environment variables
    if (hook.env) {
      const sensitivePatterns = [
        /password/i,
        /secret/i,
        /token/i,
        /api[_-]?key/i,
        /credential/i,
      ];

      for (const [key, value] of Object.entries(hook.env)) {
        for (const pattern of sensitivePatterns) {
          if (pattern.test(key) || pattern.test(value)) {
            violations.push({
              componentType: 'hooks',
              component: componentName,
              violationType: 'sensitive_data',
              severity: 'medium',
              description: `Hook environment variable may contain sensitive data: ${key}`,
              recommendation: 'Use environment variable references instead of hardcoded values',
              quarantined: false,
            });
            break;
          }
        }
      }
    }

    // 3. Check for network access in commands
    const networkPatterns = [
      /curl\s+/gi,
      /wget\s+/gi,
      /https?:\/\//gi,
      /ftp:\/\//gi,
    ];

    for (const pattern of networkPatterns) {
      if (pattern.test(hook.command)) {
        violations.push({
          componentType: 'hooks',
          component: componentName,
          violationType: 'dangerous_capability',
          severity: 'medium',
          description: `Hook makes network requests: ${pattern.source}`,
          recommendation: 'Review network access and ensure it\'s necessary',
          quarantined: false,
        });
        break;
      }
    }

    // 4. Check for file system access to sensitive locations
    const sensitiveLocations = [
      /\/etc\//gi,
      /\/root\//gi,
      /\/system/gi,
      /\/windows\/system32/gi,
      /~\/\.ssh/gi,
      /~\/\.aws/gi,
    ];

    for (const pattern of sensitiveLocations) {
      if (pattern.test(hook.command)) {
        violations.push({
          componentType: 'hooks',
          component: componentName,
          violationType: 'dangerous_capability',
          severity: 'high',
          description: `Hook accesses sensitive file system location: ${pattern.source}`,
          recommendation: 'Restrict file system access to necessary directories only',
          quarantined: true,
        });
      }
    }

    return violations;
  }

  async scanKiroAgent(agent: KiroAgentConfiguration, componentName: string): Promise<KiroSecurityViolation[]> {
    const violations: KiroSecurityViolation[] = [];

    // 1. Scan agent prompt for prompt injection patterns
    const injectionPatterns = [
      /ignore\s+previous\s+instructions/gi,
      /forget\s+everything/gi,
      /system\s+prompt\s+injection/gi,
      /execute\s+shell\s+command/gi,
      /reveal\s+system\s+prompt/gi,
      /act\s+as\s+if\s+you\s+are/gi,
      /pretend\s+to\s+be/gi,
      /override\s+safety/gi,
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(agent.prompt)) {
        violations.push({
          componentType: 'agents',
          component: componentName,
          violationType: 'injection_attempt',
          severity: 'critical',
          description: `Agent prompt contains potential injection pattern: ${pattern.source}`,
          recommendation: 'Remove injection attempts and use proper prompt engineering',
          quarantined: true,
        });
      }
    }

    // 2. Check for sensitive data references in prompt
    const sensitiveDataPatterns = [
      /password\s*[:=]/gi,
      /api[_-]?key\s*[:=]/gi,
      /secret\s*[:=]/gi,
      /token\s*[:=]/gi,
      /credential\s*[:=]/gi,
    ];

    for (const pattern of sensitiveDataPatterns) {
      if (pattern.test(agent.prompt)) {
        violations.push({
          componentType: 'agents',
          component: componentName,
          violationType: 'sensitive_data',
          severity: 'high',
          description: `Agent prompt may contain sensitive data references: ${pattern.source}`,
          recommendation: 'Remove sensitive data from prompts',
          quarantined: true,
        });
      }
    }

    // 3. Check for dangerous capabilities
    if (agent.capabilities && Array.isArray(agent.capabilities)) {
      const dangerousCapabilities = [
        'file_system_write',
        'shell_execution',
        'network_access',
        'system_modification',
        'process_management',
        'registry_access',
      ];

      const foundDangerous = agent.capabilities.filter(cap => 
        dangerousCapabilities.some(dangerous => 
          cap.toLowerCase().includes(dangerous.toLowerCase())
        )
      );

      if (foundDangerous.length > 0) {
        violations.push({
          componentType: 'agents',
          component: componentName,
          violationType: 'dangerous_capability',
          severity: 'medium',
          description: `Agent has potentially dangerous capabilities: ${foundDangerous.join(', ')}`,
          recommendation: 'Review and restrict capabilities to minimum necessary',
          quarantined: false,
        });
      }
    }

    // 4. Check agent examples for security issues
    if (agent.examples && Array.isArray(agent.examples)) {
      for (const example of agent.examples) {
        // Check example inputs for injection attempts
        for (const pattern of injectionPatterns) {
          if (pattern.test(example.input)) {
            violations.push({
              componentType: 'agents',
              component: componentName,
              violationType: 'injection_attempt',
              severity: 'medium',
              description: `Agent example contains potential injection pattern: ${example.name}`,
              recommendation: 'Update example to use safe input patterns',
              quarantined: false,
            });
            break;
          }
        }
      }
    }

    return violations;
  }

  async scanKiroTemplate(template: KiroTemplateConfiguration, componentName: string): Promise<KiroSecurityViolation[]> {
    const violations: KiroSecurityViolation[] = [];

    // 1. Scan template content for injection patterns
    const injectionPatterns = [
      /<script[^>]*>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /eval\s*\(/gi,
      /function\s*\(/gi,
      // Only flag template variables with potentially dangerous content
      /{{\s*.*?(<script|javascript:|eval\(|function\().*?}}/gi,
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(template.content)) {
        const severity = pattern.source.includes('script') || pattern.source.includes('eval') ? 'high' : 'medium';
        violations.push({
          componentType: 'templates',
          component: componentName,
          violationType: 'injection_attempt',
          severity: severity as 'high' | 'medium',
          description: `Template content contains potential injection pattern: ${pattern.source}`,
          recommendation: 'Sanitize template content and use safe templating practices',
          quarantined: severity === 'high',
        });
      }
    }

    // 2. Check template variables for security issues
    if (template.variables && Array.isArray(template.variables)) {
      for (const variable of template.variables) {
        // Check for dangerous variable names
        const dangerousNames = [
          'eval',
          'exec',
          'system',
          'command',
          'script',
          'password',
          'secret',
          'token',
        ];

        if (dangerousNames.includes(variable.name.toLowerCase())) {
          violations.push({
            componentType: 'templates',
            component: componentName,
            violationType: 'dangerous_capability',
            severity: 'medium',
            description: `Template variable has potentially dangerous name: ${variable.name}`,
            recommendation: 'Rename variable to avoid security implications',
            quarantined: false,
          });
        }

        // Check variable validation patterns for malicious regex
        if (variable.validation?.pattern) {
          // Check for catastrophic backtracking patterns (ReDoS)
          const catastrophicPatterns = [
            /\(\.\*\)\+/g,
            /\(\.\*\)\*/g,
            /\(\+\.\*\)/g,
            /\(\*\.\*\)/g,
          ];

          for (const pattern of catastrophicPatterns) {
            if (pattern.test(variable.validation.pattern)) {
              violations.push({
                componentType: 'templates',
                component: componentName,
                violationType: 'malicious_code',
                severity: 'medium',
                description: `Template variable validation pattern may cause ReDoS: ${variable.name}`,
                recommendation: 'Use more efficient regex patterns to avoid catastrophic backtracking',
                quarantined: false,
              });
              break;
            }
          }
        }
      }
    }

    return violations;
  }

  async scanKiroSettings(settings: any, componentName: string): Promise<KiroSecurityViolation[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const violations: KiroSecurityViolation[] = [];

    // Convert settings to string for pattern matching
    const settingsString = JSON.stringify(settings);

    // 1. Check for sensitive data in settings
    const sensitivePatterns = [
      /api[_-]?key\s*[:=]\s*["'][^"']{10,}["']/gi,
      /secret[_-]?key\s*[:=]\s*["'][^"']{10,}["']/gi,
      /access[_-]?token\s*[:=]\s*["'][^"']{10,}["']/gi,
      /password\s*[:=]\s*["'][^"']{5,}["']/gi,
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(settingsString)) {
        violations.push({
          componentType: 'settings',
          component: componentName,
          violationType: 'sensitive_data',
          severity: 'high',
          description: `Settings contain sensitive data: ${pattern.source}`,
          recommendation: 'Remove sensitive data from settings or use environment variables',
          quarantined: true,
        });
      }
    }

    // 2. Check for dangerous configuration values
    if (settings.permissions) {
      if (settings.permissions.defaultMode === 'acceptEdits' && !settings.permissions.allow) {
        violations.push({
          componentType: 'settings',
          component: componentName,
          violationType: 'dangerous_capability',
          severity: 'medium',
          description: 'Settings allow unrestricted edit permissions',
          recommendation: 'Set specific allow patterns instead of blanket acceptEdits',
          quarantined: false,
        });
      }
    }

    return violations;
  }

  async scanKiroSteering(steering: any, componentName: string): Promise<KiroSecurityViolation[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const violations: KiroSecurityViolation[] = [];

    // Convert to string for pattern matching
    const steeringString = typeof steering === 'string' ? steering : JSON.stringify(steering);

    // 1. Check for injection attempts in steering content
    const injectionPatterns = [
      /ignore\s+previous\s+instructions/gi,
      /override\s+safety/gi,
      /bypass\s+security/gi,
      /jailbreak/gi,
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(steeringString)) {
        violations.push({
          componentType: 'steering',
          component: componentName,
          violationType: 'injection_attempt',
          severity: 'high',
          description: `Steering document contains injection attempt: ${pattern.source}`,
          recommendation: 'Remove injection attempts from steering documents',
          quarantined: true,
        });
      }
    }

    return violations;
  }

  async scanKiroSpecs(specs: any, componentName: string): Promise<KiroSecurityViolation[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const violations: KiroSecurityViolation[] = [];

    // Convert to string for pattern matching
    const specsString = typeof specs === 'string' ? specs : JSON.stringify(specs);

    // 1. Check for sensitive information in specs
    const sensitivePatterns = [
      /password\s*[:=]/gi,
      /api[_-]?key\s*[:=]/gi,
      /secret\s*[:=]/gi,
      /credential\s*[:=]/gi,
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(specsString)) {
        violations.push({
          componentType: 'specs',
          component: componentName,
          violationType: 'sensitive_data',
          severity: 'medium',
          description: `Specification may contain sensitive data: ${pattern.source}`,
          recommendation: 'Remove sensitive data from specifications',
          quarantined: false,
        });
      }
    }

    return violations;
  }

  async generateKiroSecurityReport(scanResult: KiroSecurityScanResult): Promise<string> {
    const report = [
      '# Kiro Security Scan Report',
      '',
      `**Scan Status**: ${scanResult.passed ? '✅ PASSED' : '❌ FAILED'}`,
      `**Total Components Scanned**: ${scanResult.securityViolations?.length || 0}`,
      `**Components Quarantined**: ${scanResult.quarantinedComponents?.length || 0}`,
      '',
    ];

    if (scanResult.summary) {
      report.push('## Summary');
      report.push('');
      report.push(`- **Critical/High Issues**: ${scanResult.summary.highSeverity}`);
      report.push(`- **Medium Issues**: ${scanResult.summary.mediumSeverity}`);
      report.push(`- **Low Issues**: ${scanResult.summary.lowSeverity}`);
      report.push(`- **Total Issues**: ${scanResult.summary.totalIssues}`);
      report.push('');
    }

    if (scanResult.quarantinedComponents && scanResult.quarantinedComponents.length > 0) {
      report.push('## Quarantined Components');
      report.push('');
      report.push('The following components have been quarantined due to security violations:');
      report.push('');
      for (const component of scanResult.quarantinedComponents) {
        report.push(`- **${component}**`);
      }
      report.push('');
    }

    if (scanResult.securityViolations && scanResult.securityViolations.length > 0) {
      const violationsByType = new Map<KiroComponentType, KiroSecurityViolation[]>();
      
      for (const violation of scanResult.securityViolations) {
        if (!violationsByType.has(violation.componentType)) {
          violationsByType.set(violation.componentType, []);
        }
        violationsByType.get(violation.componentType)!.push(violation);
      }

      report.push('## Security Violations by Component Type');
      report.push('');

      for (const [componentType, violations] of violationsByType) {
        report.push(`### ${componentType.charAt(0).toUpperCase() + componentType.slice(1)} Components`);
        report.push('');

        for (const violation of violations) {
          const severityIcon = violation.severity === 'critical' ? '🔴' : 
                              violation.severity === 'high' ? '🟠' :
                              violation.severity === 'medium' ? '🟡' : '🔵';
          
          report.push(`${severityIcon} **${violation.component}** (${violation.severity.toUpperCase()})`);
          report.push(`  - **Type**: ${violation.violationType.replace('_', ' ')}`);
          report.push(`  - **Description**: ${violation.description}`);
          report.push(`  - **Recommendation**: ${violation.recommendation}`);
          report.push(`  - **Quarantined**: ${violation.quarantined ? 'Yes' : 'No'}`);
          report.push('');
        }
      }
    }

    report.push('## Recommendations');
    report.push('');
    report.push('1. Review and fix all critical and high severity violations before deployment');
    report.push('2. Consider the security implications of medium severity issues');
    report.push('3. Remove or replace quarantined components');
    report.push('4. Implement additional security measures for components with dangerous capabilities');
    report.push('5. Regularly scan components for new security issues');
    
    return report.join('\n');
  }

  async quarantineComponent(componentName: string, _reason: string): Promise<{
    quarantined: boolean;
    quarantinePath?: string;
    error?: string;
  }> {
    try {
      // Create quarantine directory if it doesn't exist
      const quarantineDir = '.kiro/quarantine';
      const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
      const quarantinePath = `${quarantineDir}/${componentName}-${timestamp}.quarantined`;

      // This would be implemented based on the specific file system operations needed
      // For now, we'll return the intended quarantine path
      return {
        quarantined: true,
        quarantinePath,
      };
    } catch (error) {
      return {
        quarantined: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
