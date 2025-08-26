import { Injectable, Logger } from '@nestjs/common';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import { DANGEROUS_COMMAND_PATTERNS, WHITELISTED_COMMANDS, DEFAULT_SECURITY_CONFIG } from '../constants/security.constants';
import {
  AI_INJECTION_PATTERNS,
  MALICIOUS_AI_PATTERNS,
  TRUSTED_AI_PROVIDERS,
  BLOCKED_AI_PROVIDERS,
  TRUSTED_CURSOR_EXTENSION_PUBLISHERS,
  BLOCKED_CURSOR_EXTENSIONS,
  RISKY_EXTENSION_PATTERNS,
  ALLOWED_CURSOR_DEBUG_COMMANDS,
  BLOCKED_CURSOR_TASK_TYPES,
  DANGEROUS_DEBUG_PATTERNS,
  WORKSPACE_TRUST_INDICATORS,
  WORKSPACE_RISK_INDICATORS,
  AI_CONTENT_LIMITS,
  EXTENSION_SECURITY_THRESHOLDS,
  WORKSPACE_TRUST_THRESHOLDS,
  TASK_COMPLEXITY_LIMITS,
  DEFAULT_CURSOR_SECURITY_CONFIG,
  CURSOR_SECURITY_TIMEOUTS,
} from '../constants/cursor-security.constants';
import { CursorDeploymentError, CursorErrorContext } from '../errors/cursor-deployment.error';
import { DeployErrorCode } from '../errors/deploy.error';
import {
  CursorGlobalSettings,
  CursorProjectSettings,
  CursorAIConfig,
  CursorExtensionsConfig,
  CursorDebugConfig,
  CursorTasksConfig,
  CursorSnippetsConfig,
  CursorWorkspaceConfig,
} from '../interfaces/cursor-config.interface';
import {
  SecurityScanResult,
  SecuritySeverity,
  SecurityWarning,
  SecurityError,
  SecurityBlocker,
} from '../interfaces/security-config.interface';

export interface CursorSecurityConfig {
  // AI-specific security rules
  maxAIContentSize: number;
  maxPromptLength: number;
  allowedAIProviders: string[];
  blockedAIPatterns: RegExp[];
  
  // Extension security rules
  trustedExtensionPublishers: string[];
  blockedExtensions: string[];
  requireSignedExtensions: boolean;
  
  // Workspace trust settings
  trustedWorkspacePaths: string[];
  requireExplicitTrust: boolean;
  autoTrustThreshold: number;
  
  // Debug and task security
  allowedDebugCommands: string[];
  blockedTaskTypes: string[];
  maxTaskComplexity: number;
}

export interface CursorAISecurityScanResult extends SecurityScanResult {
  aiContentSize: number;
  promptInjectionDetected: boolean;
  maliciousAIPatterns: string[];
  oversizedPrompts: string[];
  untrustedProviders: string[];
}

export interface CursorExtensionSecurityResult {
  passed: boolean;
  trustedExtensions: string[];
  untrustedExtensions: string[];
  maliciousExtensions: string[];
  signatureValidation: Array<{
    id: string;
    signed: boolean;
    trusted: boolean;
  }>;
}

export interface CursorWorkspaceSecurityResult {
  passed: boolean;
  trustLevel: 'trusted' | 'restricted' | 'untrusted';
  securityViolations: string[];
  requiresUserConfirmation: boolean;
  trustPath?: string;
}

export interface CursorDebugTaskSecurityResult {
  passed: boolean;
  blockedDebugConfigs: string[];
  suspiciousTasks: string[];
  complexityViolations: string[];
  commandValidationResults: Array<{
    command: string;
    safe: boolean;
    issues?: string[];
  }>;
}

@Injectable()
export class CursorSecurityEnforcer {
  private readonly logger = new Logger(CursorSecurityEnforcer.name);
  private readonly config: CursorSecurityConfig;

  constructor() {
    this.config = this.getDefaultSecurityConfig();
  }

  /**
   * Comprehensive security scan for Cursor deployment
   */
  async scanCursorDeployment(
    context: TaptikContext,
    cursorContext: CursorErrorContext,
  ): Promise<CursorAISecurityScanResult> {
    const result: CursorAISecurityScanResult = {
      passed: true,
      warnings: [],
      errors: [],
      blockers: [],
      summary: {
        totalIssues: 0,
        warnings: 0,
        errors: 0,
        blockers: 0,
        highSeverity: 0,
        mediumSeverity: 0,
        lowSeverity: 0,
      },
      aiContentSize: 0,
      promptInjectionDetected: false,
      maliciousAIPatterns: [],
      oversizedPrompts: [],
      untrustedProviders: [],
    };

    try {
      // 1. AI Content Security Scan
      const aiScanResult = await this.scanAIContent(context);
      this.mergeSecurityResults(result, aiScanResult);

      // 2. Prompt Injection Detection
      const injectionResult = await this.detectPromptInjection(context);
      if (injectionResult.detected) {
        result.promptInjectionDetected = true;
        result.maliciousAIPatterns.push(...injectionResult.patterns);
        this.addSecurityError(result, 'AI prompt injection detected', 'ai_content', SecuritySeverity.HIGH);
      }

      // 3. AI Provider Validation
      const providerResult = await this.validateAIProviders(context);
      if (providerResult.untrustedProviders.length > 0) {
        result.untrustedProviders = providerResult.untrustedProviders;
        this.addSecurityWarning(result, `Untrusted AI providers detected: ${providerResult.untrustedProviders.join(', ')}`, 'ai_config', SecuritySeverity.MEDIUM);
      }

      // 4. Content Size Validation
      if (result.aiContentSize > this.config.maxAIContentSize) {
        result.oversizedPrompts.push('Global AI content exceeds size limit');
        this.addSecurityError(result, `AI content size (${result.aiContentSize} bytes) exceeds limit (${this.config.maxAIContentSize} bytes)`, 'ai_content', SecuritySeverity.HIGH);
      }

      this.finalizeSecurityResult(result);
      this.logger.log(`Cursor deployment security scan completed: ${result.passed ? 'PASSED' : 'FAILED'}`);

      return result;
    } catch (error) {
      this.logger.error('Security scan failed', error);
      throw CursorDeploymentError.createCursorError(
        DeployErrorCode.SECURITY_VIOLATION,
        `Security scan failed: ${(error as Error).message}`,
        cursorContext,
        error as Error,
      );
    }
  }

  /**
   * Validate Cursor extensions for security compliance
   */
  async validateExtensions(
    extensionsConfig: CursorExtensionsConfig,
    cursorContext: CursorErrorContext,
  ): Promise<CursorExtensionSecurityResult> {
    const result: CursorExtensionSecurityResult = {
      passed: true,
      trustedExtensions: [],
      untrustedExtensions: [],
      maliciousExtensions: [],
      signatureValidation: [],
    };

    try {
      const extensions = extensionsConfig.recommendations || [];

      for (const extension of extensions) {
        const extensionId = typeof extension === 'string' ? extension : extension.id || '';
        
        // Check against blocked extensions
        if (this.config.blockedExtensions.includes(extensionId)) {
          result.maliciousExtensions.push(extensionId);
          result.passed = false;
          continue;
        }

        // Check publisher trust
        const publisher = extensionId.split('.')[0];
        const isTrusted = this.config.trustedExtensionPublishers.includes(publisher);
        
        if (isTrusted) {
          result.trustedExtensions.push(extensionId);
        } else {
          result.untrustedExtensions.push(extensionId);
          if (this.config.requireSignedExtensions) {
            result.passed = false;
          }
        }

        // Signature validation (mock implementation)
        const signatureValid = await this.validateExtensionSignature(extensionId);
        result.signatureValidation.push({
          id: extensionId,
          signed: signatureValid,
          trusted: isTrusted && signatureValid,
        });

        if (this.config.requireSignedExtensions && !signatureValid) {
          result.passed = false;
        }
      }

      return result;
    } catch (error) {
      throw CursorDeploymentError.createCursorError(
        DeployErrorCode.CURSOR_EXTENSION_CONFLICT,
        `Extension validation failed: ${(error as Error).message}`,
        cursorContext,
        error as Error,
      );
    }
  }

  /**
   * Validate workspace trust settings
   */
  async validateWorkspaceTrust(
    workspacePath: string,
    workspaceConfig: CursorWorkspaceConfig,
    cursorContext: CursorErrorContext,
  ): Promise<CursorWorkspaceSecurityResult> {
    const result: CursorWorkspaceSecurityResult = {
      passed: true,
      trustLevel: 'untrusted',
      securityViolations: [],
      requiresUserConfirmation: false,
    };

    try {
      // Check if workspace is in trusted paths
      const isTrusted = this.config.trustedWorkspacePaths.some(trustedPath =>
        workspacePath.startsWith(trustedPath)
      );

      if (isTrusted) {
        result.trustLevel = 'trusted';
      } else {
        // Calculate trust score based on various factors
        const trustScore = await this.calculateWorkspaceTrustScore(workspacePath, workspaceConfig);
        
        if (trustScore >= this.config.autoTrustThreshold) {
          result.trustLevel = 'restricted';
        } else {
          result.trustLevel = 'untrusted';
          result.requiresUserConfirmation = this.config.requireExplicitTrust;
        }
      }

      // Check for security violations in workspace configuration
      const violations = await this.scanWorkspaceForViolations(workspaceConfig);
      result.securityViolations = violations;

      if (violations.length > 0) {
        result.passed = false;
      }

      return result;
    } catch (error) {
      throw CursorDeploymentError.createCursorError(
        DeployErrorCode.CURSOR_WORKSPACE_LOCKED,
        `Workspace trust validation failed: ${(error as Error).message}`,
        cursorContext,
        error as Error,
      );
    }
  }

  /**
   * Scan debug and task configurations for security issues
   */
  async scanDebugAndTaskConfigs(
    debugConfig: CursorDebugConfig,
    tasksConfig: CursorTasksConfig,
    cursorContext: CursorErrorContext,
  ): Promise<CursorDebugTaskSecurityResult> {
    const result: CursorDebugTaskSecurityResult = {
      passed: true,
      blockedDebugConfigs: [],
      suspiciousTasks: [],
      complexityViolations: [],
      commandValidationResults: [],
    };

    try {
      // Scan debug configurations
      if (debugConfig.configurations) {
        for (const config of debugConfig.configurations) {
          const configName = config.name || 'unnamed';
          
          // Check for dangerous commands in debug config
          if (config.program && this.containsDangerousCommand(config.program)) {
            result.blockedDebugConfigs.push(configName);
            result.passed = false;
          }

          // Validate debug commands
          if (config.console) {
            const commandResult = await this.validateDebugCommand(config.console);
            result.commandValidationResults.push({
              command: config.console,
              safe: commandResult.safe,
              issues: commandResult.issues,
            });

            if (!commandResult.safe) {
              result.passed = false;
            }
          }
        }
      }

      // Scan task configurations
      if (tasksConfig.tasks) {
        for (const task of tasksConfig.tasks) {
          const taskLabel = task.label || 'unnamed';
          
          // Check task complexity
          const complexity = this.calculateTaskComplexity(task);
          if (complexity > this.config.maxTaskComplexity) {
            result.complexityViolations.push(taskLabel);
            result.passed = false;
          }

          // Check for blocked task types
          if (task.type && this.config.blockedTaskTypes.includes(task.type)) {
            result.suspiciousTasks.push(taskLabel);
            result.passed = false;
          }

          // Validate task commands
          if (task.command) {
            const commandResult = await this.validateTaskCommand(task.command);
            result.commandValidationResults.push({
              command: task.command,
              safe: commandResult.safe,
              issues: commandResult.issues,
            });

            if (!commandResult.safe) {
              result.passed = false;
            }
          }
        }
      }

      return result;
    } catch (error) {
      throw CursorDeploymentError.createCursorError(
        DeployErrorCode.CURSOR_DEBUG_CONFIG_INVALID,
        `Debug/Task configuration security scan failed: ${(error as Error).message}`,
        cursorContext,
        error as Error,
      );
    }
  }

  /**
   * Private helper methods
   */
  private getDefaultSecurityConfig(): CursorSecurityConfig {
    return DEFAULT_CURSOR_SECURITY_CONFIG;
  }

  private async scanAIContent(context: TaptikContext): Promise<Partial<CursorAISecurityScanResult>> {
    const result: Partial<CursorAISecurityScanResult> = {
      aiContentSize: 0,
      maliciousAIPatterns: [],
    };

    // Calculate total AI content size
    let totalSize = 0;
    const maliciousPatterns: string[] = [];

    // Scan project context for AI content
    if (context.projectContext?.aiRules) {
      const aiRulesContent = JSON.stringify(context.projectContext.aiRules);
      totalSize += aiRulesContent.length;

      // Check for malicious patterns
      for (const pattern of this.config.blockedAIPatterns) {
        const matches = aiRulesContent.match(pattern);
        if (matches) {
          maliciousPatterns.push(...matches);
        }
      }
    }

    // Scan prompt templates
    if (context.promptTemplates) {
      for (const template of context.promptTemplates) {
        const templateContent = JSON.stringify(template);
        totalSize += templateContent.length;

        // Check for malicious patterns
        for (const pattern of this.config.blockedAIPatterns) {
          const matches = templateContent.match(pattern);
          if (matches) {
            maliciousPatterns.push(...matches);
          }
        }
      }
    }

    result.aiContentSize = totalSize;
    result.maliciousAIPatterns = maliciousPatterns;

    return result;
  }

  private async detectPromptInjection(context: TaptikContext): Promise<{
    detected: boolean;
    patterns: string[];
  }> {
    const patterns: string[] = [];
    const content = JSON.stringify(context);

    for (const pattern of this.config.blockedAIPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        patterns.push(...matches);
      }
    }

    return {
      detected: patterns.length > 0,
      patterns,
    };
  }

  private async validateAIProviders(context: TaptikContext): Promise<{
    untrustedProviders: string[];
  }> {
    const untrustedProviders: string[] = [];
    
    // This would typically scan the context for AI provider configurations
    // For now, we'll mock this functionality
    
    return { untrustedProviders };
  }

  private async validateExtensionSignature(extensionId: string): Promise<boolean> {
    // Mock implementation - in reality, this would validate extension signatures
    // Trusted publishers are considered "signed"
    const publisher = extensionId.split('.')[0];
    const isTrustedPublisher = TRUSTED_CURSOR_EXTENSION_PUBLISHERS.includes(publisher);
    
    // Check for risky patterns in extension ID
    const hasRiskyPattern = RISKY_EXTENSION_PATTERNS.some(pattern => 
      pattern.test(extensionId)
    );
    
    // Extension is considered "signed" if it's from trusted publisher and has no risky patterns
    return isTrustedPublisher && !hasRiskyPattern;
  }

  /**
   * Advanced extension security validation
   */
  private async validateExtensionSecurity(extensionId: string): Promise<{
    safe: boolean;
    trustScore: number;
    issues: string[];
    riskLevel: 'low' | 'medium' | 'high';
  }> {
    const issues: string[] = [];
    let trustScore = 0.5; // Start with neutral score
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    const publisher = extensionId.split('.')[0];
    const extensionName = extensionId.split('.')[1] || '';

    // Check publisher trust
    if (TRUSTED_CURSOR_EXTENSION_PUBLISHERS.includes(publisher)) {
      trustScore += 0.4;
    } else if (BLOCKED_CURSOR_EXTENSIONS.includes(extensionId)) {
      trustScore = 0;
      riskLevel = 'high';
      issues.push('Extension is in blocked list');
    }

    // Check for risky patterns
    for (const pattern of RISKY_EXTENSION_PATTERNS) {
      if (pattern.test(extensionId)) {
        trustScore -= 0.3;
        riskLevel = 'high';
        issues.push(`Matches risky pattern: ${pattern.source}`);
      }
    }

    // Check extension name for suspicious keywords
    const suspiciousKeywords = ['keylog', 'spy', 'steal', 'hack', 'crack'];
    for (const keyword of suspiciousKeywords) {
      if (extensionName.toLowerCase().includes(keyword)) {
        trustScore -= 0.5;
        riskLevel = 'high';
        issues.push(`Suspicious keyword in name: ${keyword}`);
      }
    }

    // Determine overall risk level
    if (trustScore >= 0.7) {
      riskLevel = 'low';
    } else if (trustScore >= 0.3) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'high';
    }

    return {
      safe: trustScore >= 0.3 && riskLevel !== 'high',
      trustScore: Math.max(0, Math.min(1, trustScore)),
      issues,
      riskLevel,
    };
  }

  private async calculateWorkspaceTrustScore(
    workspacePath: string,
    workspaceConfig: CursorWorkspaceConfig,
  ): Promise<number> {
    let score = 0.0;
    let riskScore = 0.0;

    // Positive trust indicators
    for (const indicator of WORKSPACE_TRUST_INDICATORS) {
      if (indicator.pattern.test(workspacePath)) {
        score += indicator.score;
        this.logger.debug(`Trust indicator matched: ${indicator.description} (+${indicator.score})`);
      }
    }

    // Negative risk indicators
    for (const riskIndicator of WORKSPACE_RISK_INDICATORS) {
      if (riskIndicator.pattern.test(workspacePath)) {
        const penalty = riskIndicator.severity === 'high' ? 0.5 : 
                       riskIndicator.severity === 'medium' ? 0.3 : 0.1;
        riskScore += penalty;
        this.logger.warn(`Risk indicator matched: ${riskIndicator.description} (-${penalty})`);
      }
    }

    // Workspace configuration quality check
    if (workspaceConfig.settings && Object.keys(workspaceConfig.settings).length > 0) {
      score += 0.1; // Has meaningful configuration
    }

    // Check for common development files
    const devFileIndicators = [
      'package.json', 'Cargo.toml', 'pyproject.toml', 'requirements.txt',
      '.gitignore', 'README.md', 'tsconfig.json', 'webpack.config.js'
    ];
    
    for (const file of devFileIndicators) {
      if (workspacePath.includes(file)) {
        score += 0.05; // Small bonus for each dev file
      }
    }

    // Apply risk penalty
    score = Math.max(0, score - riskScore);

    // Final score normalization
    const finalScore = Math.min(1.0, Math.max(0.0, score));
    
    this.logger.debug(`Workspace trust score: ${finalScore} (positive: ${score + riskScore}, risk penalty: ${riskScore})`);
    
    return finalScore;
  }

  /**
   * Enhanced workspace security scanning
   */
  private async performAdvancedWorkspaceSecurityScan(
    workspacePath: string,
    workspaceConfig: CursorWorkspaceConfig,
  ): Promise<{
    trustScore: number;
    riskLevel: 'low' | 'medium' | 'high';
    violations: string[];
    recommendations: string[];
  }> {
    const violations: string[] = [];
    const recommendations: string[] = [];
    
    const trustScore = await this.calculateWorkspaceTrustScore(workspacePath, workspaceConfig);
    
    // Determine risk level based on trust score
    let riskLevel: 'low' | 'medium' | 'high';
    if (trustScore >= WORKSPACE_TRUST_THRESHOLDS.TRUSTED_THRESHOLD) {
      riskLevel = 'low';
    } else if (trustScore >= WORKSPACE_TRUST_THRESHOLDS.RESTRICTED_THRESHOLD) {
      riskLevel = 'medium';
      recommendations.push('Consider moving workspace to a trusted directory');
    } else {
      riskLevel = 'high';
      violations.push('Workspace is in an untrusted location');
      recommendations.push('Move workspace to a secure, designated development directory');
    }

    // Check for specific security violations
    if (workspacePath.includes('/tmp/') || workspacePath.includes('/Downloads/')) {
      violations.push('Workspace is in a temporary or download directory');
      riskLevel = 'high';
    }

    // Check workspace configuration for security issues
    if (workspaceConfig.settings) {
      const settingsStr = JSON.stringify(workspaceConfig.settings);
      
      // Scan for dangerous patterns in settings
      for (const pattern of DANGEROUS_DEBUG_PATTERNS) {
        if (pattern.test(settingsStr)) {
          violations.push('Dangerous command pattern detected in workspace settings');
          riskLevel = 'high';
        }
      }

      // Check for exposed credentials
      const credentialPatterns = [
        /password\s*[:=]\s*['"]\w+['"]/gi,
        /api[_-]?key\s*[:=]\s*['"]\w+['"]/gi,
        /secret\s*[:=]\s*['"]\w+['"]/gi,
      ];

      for (const pattern of credentialPatterns) {
        if (pattern.test(settingsStr)) {
          violations.push('Potential credentials exposed in workspace settings');
          recommendations.push('Remove sensitive data from workspace configuration');
        }
      }
    }

    return {
      trustScore,
      riskLevel,
      violations,
      recommendations,
    };
  }

  private async scanWorkspaceForViolations(
    workspaceConfig: CursorWorkspaceConfig,
  ): Promise<string[]> {
    const violations: string[] = [];

    // Check for suspicious settings
    if (workspaceConfig.settings) {
      const settingsStr = JSON.stringify(workspaceConfig.settings);
      
      // Check for dangerous patterns
      for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
        if (pattern.test(settingsStr)) {
          violations.push(`Dangerous command pattern detected in workspace settings`);
        }
      }
    }

    return violations;
  }

  private containsDangerousCommand(command: string): boolean {
    return DANGEROUS_COMMAND_PATTERNS.some(pattern => pattern.test(command));
  }

  private async validateDebugCommand(command: string): Promise<{
    safe: boolean;
    issues?: string[];
    riskLevel: 'low' | 'medium' | 'high';
  }> {
    const issues: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Check against dangerous patterns
    if (this.containsDangerousCommand(command)) {
      issues.push('Contains dangerous command patterns');
      riskLevel = 'high';
    }

    // Check against specific dangerous debug patterns
    for (const pattern of DANGEROUS_DEBUG_PATTERNS) {
      if (pattern.test(command)) {
        issues.push(`Matches dangerous debug pattern: ${pattern.source}`);
        riskLevel = 'high';
      }
    }

    // Check if command is in allowed list
    const commandName = command.split(' ')[0];
    if (!ALLOWED_CURSOR_DEBUG_COMMANDS.includes(commandName)) {
      issues.push(`Command '${commandName}' is not in allowed debug commands list`);
      riskLevel = riskLevel === 'high' ? 'high' : 'medium';
    }

    // Check for command injection patterns
    const injectionPatterns = [
      /;\s*rm\s/gi,
      /\|\s*sh/gi,
      /&&\s*curl/gi,
      /`.*`/gi, // Command substitution
      /\$\(.*\)/gi, // Command substitution
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(command)) {
        issues.push('Potential command injection detected');
        riskLevel = 'high';
      }
    }

    // Check for network commands in debug context
    const networkCommands = ['curl', 'wget', 'nc', 'telnet', 'ssh', 'scp'];
    if (networkCommands.some(cmd => command.toLowerCase().includes(cmd))) {
      issues.push('Network commands detected in debug configuration');
      riskLevel = riskLevel === 'high' ? 'high' : 'medium';
    }

    return {
      safe: issues.length === 0,
      issues: issues.length > 0 ? issues : undefined,
      riskLevel,
    };
  }

  private async validateTaskCommand(command: string): Promise<{
    safe: boolean;
    issues?: string[];
    riskLevel: 'low' | 'medium' | 'high';
  }> {
    // Enhanced validation for task commands
    const debugResult = await this.validateDebugCommand(command);
    const issues = debugResult.issues ? [...debugResult.issues] : [];
    let riskLevel = debugResult.riskLevel;

    // Additional checks specific to tasks
    const taskSpecificPatterns = [
      /exec\s*\(/gi,
      /spawn\s*\(/gi,
      /child_process/gi,
      /require\s*\(.*shell.*\)/gi,
    ];

    for (const pattern of taskSpecificPatterns) {
      if (pattern.test(command)) {
        issues.push('Potentially unsafe process execution pattern in task');
        riskLevel = 'high';
      }
    }

    // Check for file system modification commands
    const fsModificationCommands = ['rm', 'rmdir', 'del', 'move', 'mv', 'cp', 'copy'];
    if (fsModificationCommands.some(cmd => command.toLowerCase().startsWith(cmd + ' '))) {
      issues.push('File system modification command detected in task');
      riskLevel = riskLevel === 'high' ? 'high' : 'medium';
    }

    return {
      safe: issues.length === 0,
      issues: issues.length > 0 ? issues : undefined,
      riskLevel,
    };
  }

  /**
   * Enhanced task complexity calculation
   */
  private calculateTaskComplexity(task: any): number {
    let complexity = 1; // Base complexity

    // Command complexity
    if (task.command) {
      const command = task.command;
      
      // Multiple commands connected with operators
      complexity += (command.match(/&&/g) || []).length * 2;
      complexity += (command.match(/\|\|/g) || []).length * 2;
      complexity += (command.match(/\|/g) || []).length * 1;
      
      // Complex shell patterns
      complexity += (command.match(/\$\(/g) || []).length * 3; // Command substitution
      complexity += (command.match(/`/g) || []).length / 2 * 3; // Backticks
      complexity += (command.match(/>/g) || []).length * 1; // Redirections
      complexity += (command.match(/</g) || []).length * 1; // Input redirections
      
      // Loops and conditionals
      complexity += (command.match(/for\s+\w+\s+in/g) || []).length * 4;
      complexity += (command.match(/while\s+/g) || []).length * 4;
      complexity += (command.match(/if\s+/g) || []).length * 3;
    }

    // Dependency complexity
    if (task.dependsOn) {
      const deps = Array.isArray(task.dependsOn) ? task.dependsOn : [task.dependsOn];
      complexity += deps.length * 2;
    }

    // Options complexity
    if (task.options) {
      complexity += Object.keys(task.options).length * 0.5;
    }

    // Problem matcher complexity
    if (task.problemMatcher) {
      const matchers = Array.isArray(task.problemMatcher) ? task.problemMatcher : [task.problemMatcher];
      complexity += matchers.length;
    }

    return Math.round(complexity);
  }

  /**
   * Comprehensive debug and task security analysis
   */
  private async performAdvancedDebugTaskSecurity(
    debugConfig: CursorDebugConfig,
    tasksConfig: CursorTasksConfig,
  ): Promise<{
    overallRisk: 'low' | 'medium' | 'high';
    debugRisks: Array<{ name: string; risk: 'low' | 'medium' | 'high'; issues: string[] }>;
    taskRisks: Array<{ name: string; complexity: number; risk: 'low' | 'medium' | 'high'; issues: string[] }>;
    recommendations: string[];
  }> {
    const debugRisks: Array<{ name: string; risk: 'low' | 'medium' | 'high'; issues: string[] }> = [];
    const taskRisks: Array<{ name: string; complexity: number; risk: 'low' | 'medium' | 'high'; issues: string[] }> = [];
    const recommendations: string[] = [];

    // Analyze debug configurations
    if (debugConfig.configurations) {
      for (const config of debugConfig.configurations) {
        const configName = config.name || 'unnamed';
        const issues: string[] = [];
        let risk: 'low' | 'medium' | 'high' = 'low';

        if (config.program) {
          const validation = await this.validateDebugCommand(config.program);
          if (!validation.safe) {
            issues.push(...(validation.issues || []));
            risk = validation.riskLevel;
          }
        }

        if (config.console && config.console !== 'internalConsole') {
          issues.push('External console configuration detected');
          risk = risk === 'high' ? 'high' : 'medium';
        }

        debugRisks.push({ name: configName, risk, issues });
      }
    }

    // Analyze task configurations
    if (tasksConfig.tasks) {
      for (const task of tasksConfig.tasks) {
        const taskLabel = task.label || 'unnamed';
        const issues: string[] = [];
        let risk: 'low' | 'medium' | 'high' = 'low';

        const complexity = this.calculateTaskComplexity(task);
        if (complexity > TASK_COMPLEXITY_LIMITS.MAX_COMPLEXITY_SCORE) {
          issues.push(`Task complexity (${complexity}) exceeds limit (${TASK_COMPLEXITY_LIMITS.MAX_COMPLEXITY_SCORE})`);
          risk = 'high';
        }

        if (task.command) {
          const validation = await this.validateTaskCommand(task.command);
          if (!validation.safe) {
            issues.push(...(validation.issues || []));
            risk = validation.riskLevel;
          }
        }

        if (task.type && BLOCKED_CURSOR_TASK_TYPES.includes(task.type)) {
          issues.push(`Task type '${task.type}' is blocked`);
          risk = 'high';
        }

        taskRisks.push({ name: taskLabel, complexity, risk, issues });
      }
    }

    // Determine overall risk
    const highRiskCount = debugRisks.filter(r => r.risk === 'high').length + 
                         taskRisks.filter(r => r.risk === 'high').length;
    const mediumRiskCount = debugRisks.filter(r => r.risk === 'medium').length + 
                           taskRisks.filter(r => r.risk === 'medium').length;

    let overallRisk: 'low' | 'medium' | 'high';
    if (highRiskCount > 0) {
      overallRisk = 'high';
      recommendations.push('Remove or modify high-risk debug configurations and tasks');
    } else if (mediumRiskCount > 3) {
      overallRisk = 'high';
      recommendations.push('Too many medium-risk items, consider simplifying configuration');
    } else if (mediumRiskCount > 0) {
      overallRisk = 'medium';
      recommendations.push('Review medium-risk items and consider alternatives');
    } else {
      overallRisk = 'low';
    }

    // Additional recommendations
    if (taskRisks.some(t => t.complexity > 10)) {
      recommendations.push('Consider breaking down complex tasks into smaller, simpler ones');
    }

    if (debugRisks.some(d => d.issues.some(i => i.includes('network')))) {
      recommendations.push('Avoid network commands in debug configurations');
    }

    return {
      overallRisk,
      debugRisks,
      taskRisks,
      recommendations,
    };
  }

  private calculateTaskComplexity(task: any): number {
    let complexity = 0;

    // Base complexity
    complexity += 1;

    // Add complexity for command
    if (task.command) {
      complexity += task.command.split('&&').length; // Multiple commands
      complexity += task.command.split('|').length - 1; // Pipes
    }

    // Add complexity for dependencies
    if (task.dependsOn) {
      complexity += Array.isArray(task.dependsOn) ? task.dependsOn.length : 1;
    }

    return complexity;
  }

  private mergeSecurityResults(
    target: CursorAISecurityScanResult,
    source: Partial<CursorAISecurityScanResult>,
  ): void {
    if (source.aiContentSize) {
      target.aiContentSize += source.aiContentSize;
    }
    if (source.maliciousAIPatterns) {
      target.maliciousAIPatterns.push(...source.maliciousAIPatterns);
    }
  }

  private addSecurityWarning(
    result: CursorAISecurityScanResult,
    message: string,
    location: string,
    severity: SecuritySeverity,
  ): void {
    const warning: SecurityWarning = {
      type: 'data',
      message,
      location,
      severity,
    };
    
    result.warnings.push(warning);
    result.summary.warnings++;
    result.summary.totalIssues++;
    
    if (severity === SecuritySeverity.HIGH) {
      result.summary.highSeverity++;
    } else if (severity === SecuritySeverity.MEDIUM) {
      result.summary.mediumSeverity++;
    } else {
      result.summary.lowSeverity++;
    }
  }

  private addSecurityError(
    result: CursorAISecurityScanResult,
    message: string,
    location: string,
    severity: SecuritySeverity,
  ): void {
    const error: SecurityError = {
      type: 'data',
      message,
      location,
      severity,
      recoverable: severity !== SecuritySeverity.HIGH,
    };
    
    result.errors.push(error);
    result.summary.errors++;
    result.summary.totalIssues++;
    result.passed = false;
    
    if (severity === SecuritySeverity.HIGH) {
      result.summary.highSeverity++;
    } else if (severity === SecuritySeverity.MEDIUM) {
      result.summary.mediumSeverity++;
    } else {
      result.summary.lowSeverity++;
    }
  }

  private finalizeSecurityResult(result: CursorAISecurityScanResult): void {
    // Mark as failed if there are high severity issues or blockers
    if (result.summary.highSeverity > 0 || result.summary.blockers > 0) {
      result.passed = false;
    }

    // Additional checks for AI-specific issues
    if (result.promptInjectionDetected || result.maliciousAIPatterns.length > 0) {
      result.passed = false;
    }
  }
}