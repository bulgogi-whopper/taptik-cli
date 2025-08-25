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
}