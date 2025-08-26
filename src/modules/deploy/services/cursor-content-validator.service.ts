import { Injectable, Logger } from '@nestjs/common';

import { CursorAIConfig, CursorAIRule, CursorAIContext, CursorAIPrompt } from '../interfaces/cursor-config.interface';

export interface CursorContentValidationResult {
  valid: boolean;
  errors: CursorContentValidationError[];
  warnings: CursorContentValidationWarning[];
  securityIssues: CursorSecurityIssue[];
  sizeIssues: CursorSizeIssue[];
  statistics: CursorContentStatistics;
}

export interface CursorContentValidationError {
  type: 'security' | 'size' | 'format' | 'content' | 'encoding';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  location?: string;
  details?: any;
  fixable: boolean;
  suggestion?: string;
}

export interface CursorContentValidationWarning {
  type: 'performance' | 'compatibility' | 'best_practice' | 'deprecated';
  message: string;
  location?: string;
  details?: any;
  recommendation?: string;
}

export interface CursorSecurityIssue {
  type: 'sensitive_data' | 'injection' | 'malicious_content' | 'unsafe_pattern' | 'privilege_escalation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  content: string;
  location?: string;
  pattern: string;
  mitigation: string;
}

export interface CursorSizeIssue {
  type: 'content_too_large' | 'total_size_exceeded' | 'count_exceeded' | 'nesting_too_deep';
  severity: 'high' | 'medium' | 'low';
  message: string;
  current: number;
  limit: number;
  location?: string;
  suggestion: string;
}

export interface CursorContentStatistics {
  totalSize: number;
  aiRulesCount: number;
  aiContextCount: number;
  aiPromptsCount: number;
  averageContentLength: number;
  largestContentSize: number;
  securityPatternsFound: number;
  encodingIssues: number;
}

@Injectable()
export class CursorContentValidatorService {
  private readonly logger = new Logger(CursorContentValidatorService.name);

  // Security patterns to detect sensitive information
  private readonly SENSITIVE_PATTERNS = [
    {
      name: 'API Key',
      pattern: /(?:api.?key|access.?token|secret.?key)[:\s=]+[a-zA-Z0-9_-]{10,}/gi,
      severity: 'critical' as const,
      mitigation: 'Remove API keys and use environment variables instead'
    },
    {
      name: 'Password',
      pattern: /(?:password|passwd|pwd)["\s]*[:=]["\s]*["']([^"']{8,})["']/gi,
      severity: 'critical' as const,
      mitigation: 'Remove passwords and use secure authentication methods'
    },
    {
      name: 'SSH Key',
      pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/gi,
      severity: 'critical' as const,
      mitigation: 'Remove SSH private keys from configuration'
    },
    {
      name: 'JWT Token',
      pattern: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
      severity: 'high' as const,
      mitigation: 'Remove JWT tokens and use secure token storage'
    },
    {
      name: 'Credit Card',
      pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      severity: 'critical' as const,
      mitigation: 'Remove credit card numbers from configuration'
    },
    {
      name: 'Email Address',
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      severity: 'medium' as const,
      mitigation: 'Consider removing email addresses or using placeholders'
    },
    {
      name: 'Phone Number',
      pattern: /\+?1?[-.\s]?(\d{3})[-.\s]?(\d{3})[-.\s]?(\d{4})/g,
      severity: 'low' as const,
      mitigation: 'Consider removing phone numbers or using placeholders'
    },
    {
      name: 'IP Address',
      pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
      severity: 'medium' as const,
      mitigation: 'Consider removing IP addresses or using placeholders'
    },
    {
      name: 'Database Connection String',
      pattern: /(?:mongodb|mysql|postgresql|sqlite):\/\/[^\s"'<>]+/gi,
      severity: 'high' as const,
      mitigation: 'Remove database connection strings and use environment variables'
    },
    {
      name: 'AWS Access Key',
      pattern: /AKIA[0-9A-Z]{16}/g,
      severity: 'critical' as const,
      mitigation: 'Remove AWS access keys and use IAM roles'
    }
  ];

  // Malicious content patterns
  private readonly MALICIOUS_PATTERNS = [
    {
      name: 'Command Injection',
      pattern: /(?:exec|eval|system|shell_exec|passthru|proc_open)\s*\(/gi,
      severity: 'critical' as const,
      mitigation: 'Remove dangerous command execution patterns'
    },
    {
      name: 'Script Injection',
      pattern: /<script[^>]*>.*?<\/script>/gis,
      severity: 'high' as const,
      mitigation: 'Remove script tags from content'
    },
    {
      name: 'SQL Injection Pattern',
      pattern: /(?:union|select|insert|delete|update|drop|create|alter)\s+(?:all\s+)?(?:from|into|table)/gi,
      severity: 'high' as const,
      mitigation: 'Remove potential SQL injection patterns'
    },
    {
      name: 'Path Traversal',
      pattern: /\.\.\/|\.\.\\|\.\.[\/\\]/g,
      severity: 'medium' as const,
      mitigation: 'Remove path traversal patterns'
    },
    {
      name: 'Dangerous File Operations',
      pattern: /(?:rm\s+-rf|del\s+\/[sq]|format\s+[cd]:)/gi,
      severity: 'critical' as const,
      mitigation: 'Remove dangerous file operation commands'
    }
  ];

  // Prompt injection patterns
  private readonly PROMPT_INJECTION_PATTERNS = [
    {
      name: 'Ignore Previous Instructions',
      pattern: /(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|earlier|above)\s+(?:instructions?|prompts?|rules?|commands?)/gi,
      severity: 'high' as const,
      mitigation: 'Remove prompt injection attempts'
    },
    {
      name: 'System Override',
      pattern: /(?:system\s*:|assistant\s*:|user\s*:)\s*(?:you\s+(?:are|must|should|will)|now\s+(?:act|behave|respond)\s+as)/gi,
      severity: 'high' as const,
      mitigation: 'Remove system role override attempts'
    },
    {
      name: 'Role Manipulation',
      pattern: /(?:pretend|act|behave|roleplay)\s+(?:as|like|to\s+be)\s+(?:a\s+|an\s+)?(?:admin|administrator|root|sudo|system|developer)/gi,
      severity: 'high' as const,
      mitigation: 'Remove role manipulation attempts'
    },
    {
      name: 'Instruction Termination',
      pattern: /(?:---|\*\*\*|###|\[END\]|\[STOP\])\s*(?:ignore|new\s+instructions?|system\s+prompt)/gi,
      severity: 'medium' as const,
      mitigation: 'Remove instruction termination patterns'
    },
    {
      name: 'Jailbreak Attempt',
      pattern: /(?:DAN|jailbreak|break\s+(?:out|free)|bypass|circumvent)\s*(?:all\s*)?(?:restrictions?|limitations?|rules?|guidelines?)/gi,
      severity: 'high' as const,
      mitigation: 'Remove jailbreak attempts'
    },
    {
      name: 'Token Manipulation',
      pattern: /(?:<\|.*?\|>|\[INST\]|\[\/INST\]|<s>|<\/s>|<system>|<\/system>)/gi,
      severity: 'medium' as const,
      mitigation: 'Remove special token manipulation'
    },
    {
      name: 'Code Execution Request',
      pattern: /(?:execute|run|eval)\s+(?:this\s+)?(?:code|script|command|function)/gi,
      severity: 'high' as const,
      mitigation: 'Remove code execution requests'
    },
    {
      name: 'Information Extraction',
      pattern: /(?:tell\s+me|show\s+me|reveal|disclose)\s+(?:your|the)\s+(?:system\s+prompt|instructions?|rules?|guidelines?)/gi,
      severity: 'medium' as const,
      mitigation: 'Remove information extraction attempts'
    }
  ];

  // Content size limits
  private readonly SIZE_LIMITS = {
    MAX_AI_RULE_SIZE: 10000, // 10KB per rule
    MAX_AI_CONTEXT_SIZE: 50000, // 50KB per context
    MAX_AI_PROMPT_SIZE: 5000, // 5KB per prompt
    MAX_TOTAL_AI_CONTENT: 1024 * 1024, // 1MB total
    MAX_AI_RULES_COUNT: 100,
    MAX_AI_CONTEXT_COUNT: 50,
    MAX_AI_PROMPTS_COUNT: 200,
    MAX_NESTING_DEPTH: 10,
  };

  async validateAIContent(aiConfig: CursorAIConfig): Promise<CursorContentValidationResult> {
    this.logger.log('Validating AI content for security and size constraints...');

    const result: CursorContentValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      securityIssues: [],
      sizeIssues: [],
      statistics: {
        totalSize: 0,
        aiRulesCount: 0,
        aiContextCount: 0,
        aiPromptsCount: 0,
        averageContentLength: 0,
        largestContentSize: 0,
        securityPatternsFound: 0,
        encodingIssues: 0,
      },
    };

    try {
      // Validate input
      if (!aiConfig) {
        result.errors.push({
          type: 'content',
          severity: 'critical',
          message: 'AI configuration is null or undefined',
          fixable: false,
        });
        result.valid = false;
        return result;
      }

      // Validate AI rules
      if (aiConfig.rules) {
        result.statistics.aiRulesCount = aiConfig.rules.length;
        await this.validateAIRules(aiConfig.rules, result);
      }

      // Validate AI context
      if (aiConfig.context) {
        result.statistics.aiContextCount = aiConfig.context.length;
        await this.validateAIContext(aiConfig.context, result);
      }

      // Validate AI prompts
      if (aiConfig.prompts) {
        result.statistics.aiPromptsCount = aiConfig.prompts.length;
        await this.validateAIPrompts(aiConfig.prompts, result);
      }

      // Validate system prompt
      if (aiConfig.systemPrompt) {
        await this.validateContent(aiConfig.systemPrompt, 'system-prompt', result);
      }

      // Check total size limits
      this.validateTotalSizeLimits(result);

      // Calculate statistics
      this.calculateStatistics(result);

      // Determine overall validity - consider security issues as making it invalid
      result.valid = result.errors.length === 0 && result.securityIssues.length === 0 && result.sizeIssues.length === 0;

      this.logger.log(`AI content validation completed: ${result.valid ? 'PASSED' : 'FAILED'}`);
      this.logger.log(`Statistics: ${JSON.stringify(result.statistics)}`);

      return result;

    } catch (error) {
      this.logger.error('AI content validation failed:', error);
      result.valid = false;
      result.errors.push({
        type: 'content',
        severity: 'critical',
        message: `Validation failed: ${(error as Error).message}`,
        fixable: false,
      });
      return result;
    }
  }

  private async validateAIRules(rules: CursorAIRule[], result: CursorContentValidationResult): Promise<void> {
    if (rules.length > this.SIZE_LIMITS.MAX_AI_RULES_COUNT) {
      result.sizeIssues.push({
        type: 'count_exceeded',
        severity: 'medium',
        message: `Too many AI rules: ${rules.length}`,
        current: rules.length,
        limit: this.SIZE_LIMITS.MAX_AI_RULES_COUNT,
        location: 'ai.rules',
        suggestion: 'Reduce the number of AI rules or combine similar rules',
      });
    }

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const location = `ai.rules[${i}]`;

      // Validate rule content
      if (rule.content) {
        await this.validateContent(rule.content, `${location}.content`, result);
        
        const contentSize = Buffer.byteLength(rule.content, 'utf8');
        result.statistics.totalSize += contentSize;

        if (contentSize > this.SIZE_LIMITS.MAX_AI_RULE_SIZE) {
          result.sizeIssues.push({
            type: 'content_too_large',
            severity: 'medium',
            message: `AI rule content too large: ${contentSize} bytes`,
            current: contentSize,
            limit: this.SIZE_LIMITS.MAX_AI_RULE_SIZE,
            location: `${location}.content`,
            suggestion: 'Split large rules into smaller, more focused rules',
          });
        }
      }

      // Validate rule metadata
      this.validateRuleMetadata(rule, location, result);
    }
  }

  private async validateAIContext(contexts: CursorAIContext[], result: CursorContentValidationResult): Promise<void> {
    if (contexts.length > this.SIZE_LIMITS.MAX_AI_CONTEXT_COUNT) {
      result.sizeIssues.push({
        type: 'count_exceeded',
        severity: 'medium',
        message: `Too many AI context items: ${contexts.length}`,
        current: contexts.length,
        limit: this.SIZE_LIMITS.MAX_AI_CONTEXT_COUNT,
        location: 'ai.context',
        suggestion: 'Reduce the number of context items or consolidate similar contexts',
      });
    }

    for (let i = 0; i < contexts.length; i++) {
      const context = contexts[i];
      const location = `ai.context[${i}]`;

      if (context.content) {
        await this.validateContent(context.content, `${location}.content`, result);
        
        const contentSize = Buffer.byteLength(context.content, 'utf8');
        result.statistics.totalSize += contentSize;

        if (contentSize > this.SIZE_LIMITS.MAX_AI_CONTEXT_SIZE) {
          result.sizeIssues.push({
            type: 'content_too_large',
            severity: 'high',
            message: `AI context content too large: ${contentSize} bytes`,
            current: contentSize,
            limit: this.SIZE_LIMITS.MAX_AI_CONTEXT_SIZE,
            location: `${location}.content`,
            suggestion: 'Split large context into smaller, more specific contexts',
          });
        }

        // Check if context exceeds maxLength setting
        if (context.maxLength && contentSize > context.maxLength) {
          result.warnings.push({
            type: 'performance',
            message: `Context content exceeds specified maxLength: ${contentSize} > ${context.maxLength}`,
            location: `${location}.content`,
            recommendation: 'Trim content or increase maxLength setting',
          });
        }
      }
    }
  }

  private async validateAIPrompts(prompts: CursorAIPrompt[], result: CursorContentValidationResult): Promise<void> {
    if (prompts.length > this.SIZE_LIMITS.MAX_AI_PROMPTS_COUNT) {
      result.sizeIssues.push({
        type: 'count_exceeded',
        severity: 'low',
        message: `Many AI prompts defined: ${prompts.length}`,
        current: prompts.length,
        limit: this.SIZE_LIMITS.MAX_AI_PROMPTS_COUNT,
        location: 'ai.prompts',
        suggestion: 'Consider organizing prompts into categories or removing unused ones',
      });
    }

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      const location = `ai.prompts[${i}]`;

      if (prompt.content) {
        await this.validateContent(prompt.content, `${location}.content`, result);
        
        const contentSize = Buffer.byteLength(prompt.content, 'utf8');
        result.statistics.totalSize += contentSize;

        if (contentSize > this.SIZE_LIMITS.MAX_AI_PROMPT_SIZE) {
          result.sizeIssues.push({
            type: 'content_too_large',
            severity: 'medium',
            message: `AI prompt content too large: ${contentSize} bytes`,
            current: contentSize,
            limit: this.SIZE_LIMITS.MAX_AI_PROMPT_SIZE,
            location: `${location}.content`,
            suggestion: 'Simplify prompt or break into multiple prompts',
          });
        }
      }

      // Validate prompt variables
      if (prompt.variables) {
        this.validatePromptVariables(prompt.variables, location, result);
      }
    }
  }

  private async validateContent(content: string, location: string, result: CursorContentValidationResult): Promise<void> {
    // Check for sensitive data
    for (const pattern of this.SENSITIVE_PATTERNS) {
      const matches = Array.from(content.matchAll(pattern.pattern));
      for (const match of matches) {
        result.securityIssues.push({
          type: 'sensitive_data',
          severity: pattern.severity,
          message: `${pattern.name} detected in content`,
          content: this.maskSensitiveContent(match[0]),
          location,
          pattern: pattern.name,
          mitigation: pattern.mitigation,
        });
        result.statistics.securityPatternsFound++;
      }
    }

    // Check for malicious patterns
    for (const pattern of this.MALICIOUS_PATTERNS) {
      const matches = Array.from(content.matchAll(pattern.pattern));
      for (const match of matches) {
        result.securityIssues.push({
          type: 'malicious_content',
          severity: pattern.severity,
          message: `Potentially malicious pattern detected: ${pattern.name}`,
          content: this.maskSensitiveContent(match[0]),
          location,
          pattern: pattern.name,
          mitigation: pattern.mitigation,
        });
        result.statistics.securityPatternsFound++;
      }
    }

    // Check for prompt injection patterns
    for (const pattern of this.PROMPT_INJECTION_PATTERNS) {
      const matches = Array.from(content.matchAll(pattern.pattern));
      for (const match of matches) {
        result.securityIssues.push({
          type: 'injection',
          severity: pattern.severity,
          message: `Prompt injection pattern detected: ${pattern.name}`,
          content: this.maskSensitiveContent(match[0]),
          location,
          pattern: pattern.name,
          mitigation: pattern.mitigation,
        });
        result.statistics.securityPatternsFound++;
      }
    }

    // Check for encoding issues
    try {
      // Test if content is valid UTF-8
      const buffer = Buffer.from(content, 'utf8');
      const decoded = buffer.toString('utf8');
      if (decoded !== content) {
        result.warnings.push({
          type: 'compatibility',
          message: 'Potential encoding issue detected',
          location,
          recommendation: 'Ensure content is properly UTF-8 encoded',
        });
        result.statistics.encodingIssues++;
      }
    } catch (error) {
      result.errors.push({
        type: 'encoding',
        severity: 'medium',
        message: `Encoding validation failed: ${(error as Error).message}`,
        location,
        fixable: true,
        suggestion: 'Fix encoding issues before deployment',
      });
      result.statistics.encodingIssues++;
    }

    // Check for extremely long lines
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > 1000) {
        result.warnings.push({
          type: 'performance',
          message: `Very long line detected: ${lines[i].length} characters`,
          location: `${location}:${i + 1}`,
          recommendation: 'Consider breaking long lines for better readability',
        });
      }
    }

    // Update largest content size
    const size = Buffer.byteLength(content, 'utf8');
    if (size > result.statistics.largestContentSize) {
      result.statistics.largestContentSize = size;
    }
  }

  private validateRuleMetadata(rule: CursorAIRule, location: string, result: CursorContentValidationResult): void {
    // Validate required fields
    if (!rule.id || rule.id.length === 0) {
      result.errors.push({
        type: 'format',
        severity: 'high',
        message: 'AI rule missing required id field',
        location: `${location}.id`,
        fixable: true,
        suggestion: 'Add a unique identifier for the rule',
      });
    }

    if (!rule.name || rule.name.length === 0) {
      result.errors.push({
        type: 'format',
        severity: 'high',
        message: 'AI rule missing required name field',
        location: `${location}.name`,
        fixable: true,
        suggestion: 'Add a descriptive name for the rule',
      });
    }

    // Validate priority
    if (rule.priority !== undefined && (rule.priority < 1 || rule.priority > 100)) {
      result.warnings.push({
        type: 'best_practice',
        message: `Rule priority out of recommended range: ${rule.priority}`,
        location: `${location}.priority`,
        recommendation: 'Use priority values between 1 and 100',
      });
    }

    // Validate languages array
    if (rule.languages && rule.languages.length > 20) {
      result.warnings.push({
        type: 'performance',
        message: `Too many languages specified: ${rule.languages.length}`,
        location: `${location}.languages`,
        recommendation: 'Consider limiting to relevant languages only',
      });
    }

    // Validate file patterns
    if (rule.filePatterns) {
      for (let i = 0; i < rule.filePatterns.length; i++) {
        if (rule.filePatterns[i].length > 200) {
          result.warnings.push({
            type: 'performance',
            message: `File pattern too long: ${rule.filePatterns[i].length} characters`,
            location: `${location}.filePatterns[${i}]`,
            recommendation: 'Simplify file patterns for better performance',
          });
        }
      }
    }
  }

  private validatePromptVariables(variables: any[], location: string, result: CursorContentValidationResult): void {
    for (let i = 0; i < variables.length; i++) {
      const variable = variables[i];
      const varLocation = `${location}.variables[${i}]`;

      if (!variable.name) {
        result.errors.push({
          type: 'format',
          severity: 'medium',
          message: 'Prompt variable missing name',
          location: `${varLocation}.name`,
          fixable: true,
          suggestion: 'Add a name for the variable',
        });
      }

      if (!variable.type) {
        result.errors.push({
          type: 'format',
          severity: 'medium',
          message: 'Prompt variable missing type',
          location: `${varLocation}.type`,
          fixable: true,
          suggestion: 'Specify variable type (string, number, boolean, etc.)',
        });
      }

      // Validate select options
      if (variable.type === 'select' || variable.type === 'multiselect') {
        if (!variable.options || variable.options.length === 0) {
          result.errors.push({
            type: 'format',
            severity: 'medium',
            message: 'Select variable missing options',
            location: `${varLocation}.options`,
            fixable: true,
            suggestion: 'Add options for select variables',
          });
        }
      }
    }
  }

  private validateTotalSizeLimits(result: CursorContentValidationResult): void {
    if (result.statistics.totalSize > this.SIZE_LIMITS.MAX_TOTAL_AI_CONTENT) {
      result.sizeIssues.push({
        type: 'total_size_exceeded',
        severity: 'high',
        message: `Total AI content size exceeds limit: ${result.statistics.totalSize} bytes`,
        current: result.statistics.totalSize,
        limit: this.SIZE_LIMITS.MAX_TOTAL_AI_CONTENT,
        suggestion: 'Reduce content size or optimize large content items',
      });
    }
  }

  private calculateStatistics(result: CursorContentValidationResult): void {
    const totalItems = result.statistics.aiRulesCount + 
                      result.statistics.aiContextCount + 
                      result.statistics.aiPromptsCount;
    
    result.statistics.averageContentLength = totalItems > 0 ? 
      Math.round(result.statistics.totalSize / totalItems) : 0;
  }

  private maskSensitiveContent(content: string): string {
    // Mask sensitive content for logging/display
    if (content.length <= 10) {
      return '*'.repeat(content.length);
    }
    const start = content.substring(0, 3);
    const end = content.substring(content.length - 3);
    const middle = '*'.repeat(Math.min(10, content.length - 6));
    return `${start}${middle}${end}`;
  }

  // Public utility methods for external validation
  async validateSingleContent(content: string, type: 'rule' | 'context' | 'prompt' = 'rule'): Promise<{
    securityIssues: CursorSecurityIssue[];
    sizeValid: boolean;
    encodingValid: boolean;
  }> {
    const result: CursorContentValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      securityIssues: [],
      sizeIssues: [],
      statistics: {
        totalSize: 0,
        aiRulesCount: 0,
        aiContextCount: 0,
        aiPromptsCount: 0,
        averageContentLength: 0,
        largestContentSize: 0,
        securityPatternsFound: 0,
        encodingIssues: 0,
      },
    };

    await this.validateContent(content, type, result);

    const size = Buffer.byteLength(content, 'utf8');
    let sizeLimit: number;
    
    switch (type) {
      case 'context':
        sizeLimit = this.SIZE_LIMITS.MAX_AI_CONTEXT_SIZE;
        break;
      case 'prompt':
        sizeLimit = this.SIZE_LIMITS.MAX_AI_PROMPT_SIZE;
        break;
      default:
        sizeLimit = this.SIZE_LIMITS.MAX_AI_RULE_SIZE;
    }

    return {
      securityIssues: result.securityIssues,
      sizeValid: size <= sizeLimit,
      encodingValid: result.statistics.encodingIssues === 0,
    };
  }

  getSizeLimits() {
    return { ...this.SIZE_LIMITS };
  }

  getSecurityPatterns() {
    return this.SENSITIVE_PATTERNS.map(p => ({
      name: p.name,
      severity: p.severity,
      mitigation: p.mitigation,
    }));
  }

  /**
   * Task 4.2: Validate AI configuration specifically for Cursor IDE
   */
  async validateAIConfiguration(aiConfig: CursorAIConfig): Promise<CursorContentValidationResult> {
    this.logger.log('Validating AI configuration for Cursor IDE compatibility...');
    
    const result = await this.validateAIContent(aiConfig);
    
    // Additional Cursor-specific validations
    await this.validateCursorAICompatibility(aiConfig, result);
    
    return result;
  }

  /**
   * Task 4.2: Scan AI content specifically for security issues
   */
  async scanAIContentForSecurity(aiConfig: CursorAIConfig): Promise<{
    securityIssues: CursorSecurityIssue[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    recommendations: string[];
  }> {
    this.logger.log('Scanning AI content for security vulnerabilities...');

    const result = await this.validateAIContent(aiConfig);
    
    // Determine risk level based on security issues
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const recommendations: string[] = [];

    if (result.securityIssues.length === 0) {
      riskLevel = 'low';
      recommendations.push('AI content passed all security checks');
    } else {
      const criticalIssues = result.securityIssues.filter(issue => issue.severity === 'critical');
      const highIssues = result.securityIssues.filter(issue => issue.severity === 'high');
      const mediumIssues = result.securityIssues.filter(issue => issue.severity === 'medium');

      if (criticalIssues.length > 0) {
        riskLevel = 'critical';
        recommendations.push(`Address ${criticalIssues.length} critical security issues immediately`);
        recommendations.push('Consider removing all sensitive data and malicious patterns');
      } else if (highIssues.length > 0) {
        riskLevel = 'high';
        recommendations.push(`Address ${highIssues.length} high-severity security issues`);
        recommendations.push('Review and sanitize AI content before deployment');
      } else if (mediumIssues.length > 0) {
        riskLevel = 'medium';
        recommendations.push(`Consider addressing ${mediumIssues.length} medium-severity security issues`);
      }

      // Add specific recommendations based on issue types
      const injectionIssues = result.securityIssues.filter(issue => issue.type === 'injection');
      if (injectionIssues.length > 0) {
        recommendations.push('Remove prompt injection patterns to prevent AI manipulation');
      }

      const sensitiveDataIssues = result.securityIssues.filter(issue => issue.type === 'sensitive_data');
      if (sensitiveDataIssues.length > 0) {
        recommendations.push('Remove sensitive data like API keys, passwords, and personal information');
      }

      const maliciousContentIssues = result.securityIssues.filter(issue => issue.type === 'malicious_content');
      if (maliciousContentIssues.length > 0) {
        recommendations.push('Remove potentially malicious code patterns and commands');
      }
    }

    return {
      securityIssues: result.securityIssues,
      riskLevel,
      recommendations,
    };
  }

  /**
   * Task 4.2: Validate AI content size and format constraints
   */
  async validateAIContentSizeAndFormat(aiConfig: CursorAIConfig): Promise<{
    sizeValid: boolean;
    formatValid: boolean;
    issues: Array<{
      type: 'size' | 'format';
      severity: 'low' | 'medium' | 'high';
      message: string;
      location: string;
      suggestion: string;
    }>;
    statistics: {
      totalSize: number;
      componentsCount: number;
      averageSize: number;
      largestComponent: { type: string; size: number; location: string };
    };
  }> {
    this.logger.log('Validating AI content size and format constraints...');

    const result = await this.validateAIContent(aiConfig);
    const issues: Array<{
      type: 'size' | 'format';
      severity: 'low' | 'medium' | 'high';
      message: string;
      location: string;
      suggestion: string;
    }> = [];

    // Convert size issues
    result.sizeIssues.forEach(sizeIssue => {
      issues.push({
        type: 'size',
        severity: sizeIssue.severity === 'high' ? 'high' : sizeIssue.severity === 'medium' ? 'medium' : 'low',
        message: sizeIssue.message,
        location: sizeIssue.location || 'unknown',
        suggestion: sizeIssue.suggestion,
      });
    });

    // Convert format errors
    result.errors.filter(error => error.type === 'format').forEach(formatError => {
      issues.push({
        type: 'format',
        severity: formatError.severity === 'critical' ? 'high' : 
                 formatError.severity === 'high' ? 'high' : 
                 formatError.severity === 'medium' ? 'medium' : 'low',
        message: formatError.message,
        location: formatError.location || 'unknown',
        suggestion: formatError.suggestion || 'Fix format issues',
      });
    });

    // Find largest component
    let largestComponent = { type: 'unknown', size: 0, location: 'unknown' };
    
    if (aiConfig.rules) {
      aiConfig.rules.forEach((rule, index) => {
        if (rule.content) {
          const size = Buffer.byteLength(rule.content, 'utf8');
          if (size > largestComponent.size) {
            largestComponent = { type: 'rule', size, location: `rules[${index}]` };
          }
        }
      });
    }

    if (aiConfig.context) {
      aiConfig.context.forEach((context, index) => {
        if (context.content) {
          const size = Buffer.byteLength(context.content, 'utf8');
          if (size > largestComponent.size) {
            largestComponent = { type: 'context', size, location: `context[${index}]` };
          }
        }
      });
    }

    if (aiConfig.prompts) {
      aiConfig.prompts.forEach((prompt, index) => {
        if (prompt.content) {
          const size = Buffer.byteLength(prompt.content, 'utf8');
          if (size > largestComponent.size) {
            largestComponent = { type: 'prompt', size, location: `prompts[${index}]` };
          }
        }
      });
    }

    const totalComponents = (aiConfig.rules?.length || 0) + 
                           (aiConfig.context?.length || 0) + 
                           (aiConfig.prompts?.length || 0);

    return {
      sizeValid: result.sizeIssues.length === 0,
      formatValid: result.errors.filter(e => e.type === 'format').length === 0,
      issues,
      statistics: {
        totalSize: result.statistics.totalSize,
        componentsCount: totalComponents,
        averageSize: result.statistics.averageContentLength,
        largestComponent,
      },
    };
  }

  /**
   * Task 4.2: Prevent prompt injection attacks
   */
  async validatePromptInjectionPrevention(content: string, location: string = 'content'): Promise<{
    safe: boolean;
    injectionAttempts: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high';
      pattern: string;
      match: string;
      location: string;
      mitigation: string;
    }>;
    riskScore: number; // 0-100, higher is more risky
  }> {
    this.logger.log('Checking content for prompt injection attempts...');

    const injectionAttempts: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high';
      pattern: string;
      match: string;
      location: string;
      mitigation: string;
    }> = [];

    let riskScore = 0;

    // Check each prompt injection pattern
    for (const pattern of this.PROMPT_INJECTION_PATTERNS) {
      const matches = Array.from(content.matchAll(pattern.pattern));
      
      for (const match of matches) {
        const severity = pattern.severity === 'critical' ? 'high' : 
                        pattern.severity === 'high' ? 'high' : 
                        pattern.severity === 'medium' ? 'medium' : 'low';

        injectionAttempts.push({
          type: pattern.name,
          severity,
          pattern: pattern.name,
          match: this.maskSensitiveContent(match[0]),
          location,
          mitigation: pattern.mitigation,
        });

        // Calculate risk score
        switch (severity) {
          case 'high':
            riskScore += 25;
            break;
          case 'medium':
            riskScore += 10;
            break;
          case 'low':
            riskScore += 5;
            break;
        }
      }
    }

    // Cap risk score at 100
    riskScore = Math.min(100, riskScore);

    return {
      safe: injectionAttempts.length === 0,
      injectionAttempts,
      riskScore,
    };
  }

  /**
   * Cursor-specific AI compatibility validation
   */
  private async validateCursorAICompatibility(
    aiConfig: CursorAIConfig, 
    result: CursorContentValidationResult
  ): Promise<void> {
    // Check for Cursor-specific AI rule requirements
    if (aiConfig.rules) {
      aiConfig.rules.forEach((rule, index) => {
        const location = `rules[${index}]`;

        // Cursor requires rule IDs to be unique and follow naming convention
        if (rule.id && !/^[a-zA-Z0-9_-]+$/.test(rule.id)) {
          result.warnings.push({
            type: 'compatibility',
            message: 'Rule ID contains invalid characters for Cursor compatibility',
            location: `${location}.id`,
            recommendation: 'Use only alphanumeric characters, underscores, and hyphens in rule IDs',
          });
        }

        // Check for Cursor-specific metadata
        if (!rule.scope) {
          result.warnings.push({
            type: 'compatibility',
            message: 'Rule missing scope field (recommended for Cursor)',
            location: `${location}.scope`,
            recommendation: 'Add scope field: "global", "workspace", or "file"',
          });
        }

        // Validate priority range for Cursor
        if (rule.priority !== undefined && (rule.priority < 1 || rule.priority > 10)) {
          result.warnings.push({
            type: 'compatibility',
            message: 'Rule priority outside Cursor recommended range (1-10)',
            location: `${location}.priority`,
            recommendation: 'Use priority values between 1 and 10 for optimal Cursor compatibility',
          });
        }
      });
    }

    // Check for Cursor-specific context file requirements
    if (aiConfig.context) {
      aiConfig.context.forEach((context, index) => {
        const location = `context[${index}]`;

        // Cursor prefers specific context types
        const validTypes = ['documentation', 'example', 'template', 'custom', 'style_guide', 'api_reference'];
        if (context.type && !validTypes.includes(context.type)) {
          result.warnings.push({
            type: 'compatibility',
            message: `Context type "${context.type}" may not be optimally handled by Cursor`,
            location: `${location}.type`,
            recommendation: `Use one of: ${validTypes.join(', ')}`,
          });
        }
      });
    }

    // Validate overall configuration structure for Cursor
    const totalRules = aiConfig.rules?.length || 0;
    const totalContext = aiConfig.context?.length || 0;
    const totalPrompts = aiConfig.prompts?.length || 0;

    if (totalRules + totalContext + totalPrompts > 50) {
      result.warnings.push({
        type: 'performance',
        message: 'Large number of AI components may impact Cursor performance',
        recommendation: 'Consider consolidating similar rules/contexts or using more specific scoping',
      });
    }
  }

  /**
   * Get prompt injection patterns for reference
   */
  getPromptInjectionPatterns() {
    return this.PROMPT_INJECTION_PATTERNS.map(p => ({
      name: p.name,
      severity: p.severity,
      mitigation: p.mitigation,
    }));
  }
}