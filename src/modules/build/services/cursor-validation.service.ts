/**
 * CursorValidationService - Validation service for Cursor IDE configurations
 * Handles VS Code schema validation, security filtering, and compatibility checking
 */

import { Injectable, Logger } from '@nestjs/common';

import {
  VSCodeSchemaDefinition,
  SecurityPattern,
  ExtensionCompatibilityInfo,
} from '../interfaces/build-types.interface';
import {
  CursorSettingsData,
  CursorValidationResult,
  ValidationError,
  ValidationWarning,
  SecurityReport,
  CompatibilityReport,
  VSCodeSettings,
  CursorAiConfiguration,
  CursorPromptTemplate,
  DeploymentGuidance,
  MigrationPlan,
  MigrationStep,
} from '../interfaces/cursor-ide.interfaces';

/**
 * Service for validating and securing Cursor IDE configurations
 */
@Injectable()
export class CursorValidationService {
  private readonly logger = new Logger(CursorValidationService.name);

  // VS Code schema definitions (subset for validation)
  private readonly VSCODE_SETTINGS_SCHEMA: Record<string, VSCodeSchemaDefinition> = {
    'editor.fontSize': { type: 'number', min: 6, max: 100 },
    'editor.fontFamily': { type: 'string' },
    'editor.tabSize': { type: 'number', min: 1, max: 100 },
    'editor.insertSpaces': { type: 'boolean' },
    'editor.wordWrap': {
      type: 'string',
      enum: ['off', 'on', 'wordWrapColumn', 'bounded'],
    },
    'editor.lineNumbers': {
      type: 'string',
      enum: ['off', 'on', 'relative', 'interval'],
    },
    'files.autoSave': {
      type: 'string',
      enum: ['off', 'afterDelay', 'onFocusChange', 'onWindowChange'],
    },
    'files.autoSaveDelay': { type: 'number', min: 0 },
  };

  // Security patterns for sensitive data detection
  private readonly SECURITY_PATTERNS: SecurityPattern[] = [
    {
      pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["']?([\w-]{20,})["']?/gi,
      type: 'api_key',
      severity: 'critical' as const,
    },
    {
      pattern: /(?:token|access[_-]?token|auth[_-]?token)\s*[:=]\s*["']?([\w.-]{20,})["']?/gi,
      type: 'token',
      severity: 'critical' as const,
    },
    {
      pattern: /(?:password|passwd|pwd)\s*[:=]\s*["']?([^\s"']{8,})["']?/gi,
      type: 'password',
      severity: 'critical' as const,
    },
    {
      pattern: /sk-[\dA-Za-z]{10,}/g,  // Reduced minimum length for testing
      type: 'openai_key',
      severity: 'critical' as const,
    },
    {
      pattern: /ghp_[\dA-Za-z]{20,}/g,  // Adjusted length
      type: 'github_token',
      severity: 'critical' as const,
    },
    {
      pattern: /Bearer\s+[\w.-]+/g,
      type: 'bearer_token',
      severity: 'critical' as const,
    },
  ];

  // Extension compatibility mapping
  private readonly EXTENSION_COMPATIBILITY: Record<string, ExtensionCompatibilityInfo> = {
    // Cursor-specific extensions
    'cursor.cursor-ai': {
      compatible: false,
      reason: 'Cursor-specific extension',
    },
    'cursor.cursor-copilot': {
      compatible: false,
      reason: 'Cursor-specific extension',
      alternative: 'github.copilot',
    },
    'cursor.cursor-chat': {
      compatible: false,
      reason: 'Cursor-specific chat interface',
    },
    
    // AI extensions
    'github.copilot': {
      compatible: true,
    },
    'github.copilot-chat': {
      compatible: true,
    },
    'tabnine.tabnine-vscode': {
      compatible: true,
    },
    'amazonwebservices.aws-toolkit-vscode': {
      compatible: true,
    },
    
    // Linting and formatting
    'dbaeumer.vscode-eslint': {
      compatible: true,
    },
    'esbenp.prettier-vscode': {
      compatible: true,
    },
    'ms-vscode.vscode-typescript-tslint-plugin': {
      compatible: true,
    },
    
    // Language support
    'ms-vscode.typescript-language-features': {
      compatible: true,
    },
    'ms-python.python': {
      compatible: true,
    },
    'golang.go': {
      compatible: true,
    },
    'rust-lang.rust-analyzer': {
      compatible: true,
    },
    
    // Popular extensions
    'ritwickdey.liveserver': {
      compatible: true,
    },
    'formulahendry.auto-rename-tag': {
      compatible: true,
    },
    'christian-kohler.path-intellisense': {
      compatible: true,
    },
    'visualstudioexptteam.vscodeintellicode': {
      compatible: true,
    },
  };

  /**
   * Validate VS Code schema compatibility
   */
  async validateVSCodeSchema(settings: VSCodeSettings): Promise<{
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
  }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const [key, value] of Object.entries(settings)) {
      const schema = this.VSCODE_SETTINGS_SCHEMA[key];

      // Check if setting is Cursor-specific
      if (key.startsWith('cursor.')) {
        warnings.push({
          code: 'CURSOR_SPECIFIC',
          message: `Setting "${key}" is Cursor-specific and not compatible with VS Code`,
          field: key,
          suggestion: 'Remove this setting when migrating to VS Code',
          severity: 'warning',
        });
        continue;
      }

      // Validate against schema if available
      if (schema) {
        const validationResult = this.validateValue(key, value, schema);
        if (validationResult.error) {
          errors.push(validationResult.error);
        }
        if (validationResult.warning) {
          warnings.push(validationResult.warning);
        }
      } else if (!key.includes('.')) {
        // Invalid setting format
        errors.push({
          code: 'INVALID_SETTING_FORMAT',
          message: `Invalid setting format: "${key}"`,
          field: key,
          severity: 'error',
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a single value against its schema
   */
  private validateValue(
    key: string,
    value: unknown,
    schema: VSCodeSchemaDefinition,
  ): {
    error?: ValidationError;
    warning?: ValidationWarning;
  } {
    const result: {
      error?: ValidationError;
      warning?: ValidationWarning;
    } = {};

    // Type validation
    if (schema.type) {
      const actualType = typeof value;
      if (actualType !== schema.type) {
        result.error = {
          code: 'TYPE_MISMATCH',
          message: `Expected ${schema.type} for "${key}", got ${actualType}`,
          field: key,
          severity: 'error',
        };
        return result;
      }
    }

    // Enum validation
    if (schema.enum && typeof value === 'string' && !schema.enum.includes(value)) {
      result.error = {
        code: 'INVALID_ENUM_VALUE',
        message: `Invalid value for "${key}": ${value}. Expected one of: ${schema.enum.join(', ')}`,
        field: key,
        severity: 'error',
      };
      return result;
    }

    // Number range validation
    if (schema.type === 'number') {
      const num = value as number;
      if (schema.min !== undefined && num < schema.min) {
        result.error = {
          code: 'VALUE_TOO_SMALL',
          message: `Value for "${key}" is too small: ${num} (minimum: ${schema.min})`,
          field: key,
          severity: 'error',
        };
      }
      if (schema.max !== undefined && num > schema.max) {
        result.error = {
          code: 'VALUE_TOO_LARGE',
          message: `Value for "${key}" is too large: ${num} (maximum: ${schema.max})`,
          field: key,
          severity: 'error',
        };
      }
    }

    return result;
  }

  /**
   * Validate AI model configuration
   */
  async validateAiModelConfig(
    modelConfig: CursorAiConfiguration['modelConfig'],
  ): Promise<{
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    capabilities: string[];
  }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const capabilities: string[] = [];

    if (!modelConfig) {
      return { isValid: true, errors: [], warnings: [], capabilities: [] };
    }

    // Validate provider
    const validProviders = ['openai', 'anthropic', 'azure', 'custom'];
    if (!validProviders.includes(modelConfig.provider)) {
      errors.push({
        code: 'INVALID_AI_PROVIDER',
        message: `Invalid AI provider: ${modelConfig.provider}. Must be one of: ${validProviders.join(', ')}`,
        field: 'modelConfig.provider',
        severity: 'error',
      });
    }

    // Validate model based on provider
    const modelValidation = this.validateModelSelection(modelConfig.provider, modelConfig.model);
    if (!modelValidation.valid) {
      errors.push({
        code: 'INVALID_MODEL',
        message: modelValidation.message,
        field: 'modelConfig.model',
        severity: 'error',
      });
    } else {
      capabilities.push(...modelValidation.capabilities);
    }

    // Validate temperature
    if (modelConfig.temperature !== undefined) {
      if (modelConfig.temperature < 0 || modelConfig.temperature > 2) {
        errors.push({
          code: 'INVALID_TEMPERATURE',
          message: `Temperature must be between 0 and 2, got ${modelConfig.temperature}`,
          field: 'modelConfig.temperature',
          severity: 'error',
        });
      }
    }

    // Validate maxTokens
    if (modelConfig.maxTokens !== undefined) {
      const maxTokenLimits: Record<string, number> = {
        'gpt-4': 8192,
        'gpt-4-turbo': 128000,
        'gpt-3.5-turbo': 16384,
        'claude-3-opus': 200000,
        'claude-3-sonnet': 200000,
      };

      const limit = maxTokenLimits[modelConfig.model] || 4096;
      if (modelConfig.maxTokens > limit) {
        warnings.push({
          code: 'HIGH_TOKEN_LIMIT',
          message: `maxTokens (${modelConfig.maxTokens}) exceeds model limit (${limit})`,
          field: 'modelConfig.maxTokens',
          suggestion: `Set maxTokens to ${limit} or lower`,
          severity: 'warning',
        });
      }
    }

    // Check for API key presence (security warning)
    if ('apiKey' in modelConfig) {
      warnings.push({
        code: 'API_KEY_IN_CONFIG',
        message: 'API key detected in model configuration. This will be filtered during sanitization.',
        field: 'modelConfig.apiKey',
        suggestion: 'Use environment variables for API keys instead',
        severity: 'warning',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      capabilities,
    };
  }

  /**
   * Validate model selection based on provider
   */
  private validateModelSelection(
    provider: string,
    model: string,
  ): {
    valid: boolean;
    message: string;
    capabilities: string[];
  } {
    const providerModels: Record<string, { models: string[]; capabilities: string[] }> = {
      openai: {
        models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini'],
        capabilities: ['code-completion', 'chat', 'function-calling', 'vision'],
      },
      anthropic: {
        models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-2.1'],
        capabilities: ['code-completion', 'chat', 'long-context', 'constitutional-ai'],
      },
      azure: {
        models: ['gpt-4', 'gpt-4-turbo', 'gpt-35-turbo'],
        capabilities: ['code-completion', 'chat', 'function-calling', 'azure-integration'],
      },
      custom: {
        models: [], // Any model allowed for custom
        capabilities: ['custom-endpoint'],
      },
    };

    const providerInfo = providerModels[provider];
    if (!providerInfo) {
      return {
        valid: false,
        message: `Unknown provider: ${provider}`,
        capabilities: [],
      };
    }

    if (provider === 'custom') {
      return {
        valid: true,
        message: '',
        capabilities: providerInfo.capabilities,
      };
    }

    if (!providerInfo.models.includes(model)) {
      return {
        valid: false,
        message: `Model '${model}' is not available for provider '${provider}'. Available models: ${providerInfo.models.join(', ')}`,
        capabilities: [],
      };
    }

    return {
      valid: true,
      message: '',
      capabilities: providerInfo.capabilities,
    };
  }

  /**
   * Validate custom prompts for security and best practices
   */
  async validateCustomPrompts(
    prompts: CursorAiConfiguration['globalPrompts'] | CursorPromptTemplate[],
  ): Promise<{
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    securityIssues: string[];
  }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const securityIssues: string[] = [];

    if (!prompts) {
      return { isValid: true, errors: [], warnings: [], securityIssues: [] };
    }

    // Handle both global prompts (Record) and template arrays
    const promptsToValidate: { key: string; content: string }[] = [];
    
    if (Array.isArray(prompts)) {
      // Handle template array
      prompts.forEach((template, index) => {
        promptsToValidate.push({ 
          key: template.name || `template_${index}`, 
          content: template.prompt 
        });
      });
    } else {
      // Handle global prompts object
      Object.entries(prompts).forEach(([key, prompt]) => {
        if (typeof prompt === 'string') {
          promptsToValidate.push({ key, content: prompt });
        }
      });
    }

    for (const { key, content } of promptsToValidate) {
      // Check for sensitive data
      if (this.containsSensitiveData(content)) {
        securityIssues.push(`Prompt '${key}' contains sensitive data`);
        errors.push({
          code: 'SENSITIVE_DATA_IN_PROMPT',
          message: `Prompt '${key}' contains sensitive information that should not be stored`,
          field: key,
          severity: 'critical',
        });
      }

      // Check for injection vulnerabilities
      const injectionPatterns = [
        /system\s*\(\s*["'`].*["'`]\s*\)/gi,
        /eval\s*\(\s*["'`].*["'`]\s*\)/gi,
        /exec\s*\(\s*["'`].*["'`]\s*\)/gi,
        /<script[^>]*>.*<\/script>/gi,
        /\${.*}/g, // Template injection
      ];

      for (const pattern of injectionPatterns) {
        if (pattern.test(content)) {
          warnings.push({
            code: 'POTENTIAL_INJECTION',
            message: `Prompt '${key}' contains potentially unsafe patterns`,
            field: key,
            suggestion: 'Review prompt for injection vulnerabilities',
            severity: 'warning',
          });
        }
      }

      // Check prompt length
      if (content.length > 10000) {
        warnings.push({
          code: 'PROMPT_TOO_LONG',
          message: `Prompt '${key}' is very long (${content.length} characters)`,
          field: key,
          suggestion: 'Consider breaking down into smaller, more focused prompts',
          severity: 'info',
        });
      }

      // Check for best practices
      if (!content.includes('{') && !content.includes('${')) {
        warnings.push({
          code: 'NO_VARIABLES',
          message: `Prompt '${key}' does not use any variables`,
          field: key,
          suggestion: 'Consider adding variables for dynamic content',
          severity: 'info',
        });
      }
    }

    return {
      isValid: errors.filter(e => e.severity === 'critical').length === 0,
      errors,
      warnings,
      securityIssues,
    };
  }

  /**
   * Detect AI capabilities from configuration
   */
  async detectAiCapabilities(
    config: CursorAiConfiguration,
  ): Promise<{
    capabilities: string[];
    metadata: Record<string, unknown>;
  }> {
    const capabilities: string[] = [];
    const metadata: Record<string, unknown> = {};

    // Detect model capabilities
    if (config.modelConfig) {
      const modelValidation = await this.validateAiModelConfig(config.modelConfig);
      capabilities.push(...modelValidation.capabilities);
      metadata.provider = config.modelConfig.provider;
      metadata.model = config.modelConfig.model;
    }

    // Detect Copilot integration
    if (config.copilot?.enable) {
      capabilities.push('copilot-integration');
      metadata.copilotEnabled = true;
      
      if (config.copilot.inlineSuggest?.enable) {
        capabilities.push('inline-suggestions');
      }
      
      if (config.copilot.editor?.enableAutoCompletions) {
        capabilities.push('auto-completions');
      }
    }

    // Detect security features
    if (config.security?.filterSensitiveData) {
      capabilities.push('sensitive-data-filtering');
    }

    if (config.security?.allowPublicCodeSuggestions === false) {
      capabilities.push('private-code-only');
    }

    // Detect rule-based automation
    if (config.rules && config.rules.length > 0) {
      capabilities.push('rule-based-automation');
      const enabledRules = config.rules.filter(r => r.enabled !== false);
      metadata.ruleCount = config.rules.length;
      metadata.enabledRuleCount = enabledRules.length;
      
      // Analyze rule contexts
      const contexts = new Set(config.rules.map(r => r.context || 'file'));
      if (contexts.has('workspace')) capabilities.push('workspace-context');
      if (contexts.has('selection')) capabilities.push('selection-context');
    }

    // Detect template usage
    if (config.templates && config.templates.length > 0) {
      capabilities.push('prompt-templates');
      metadata.templateCount = config.templates.length;
      
      // Analyze template complexity
      const complexTemplates = config.templates.filter(t => 
        t.variables && t.variables.length > 2
      );
      if (complexTemplates.length > 0) {
        capabilities.push('advanced-templates');
      }
    }

    // Detect global prompts
    if (config.globalPrompts && Object.keys(config.globalPrompts).length > 0) {
      capabilities.push('global-prompts');
      metadata.globalPromptCount = Object.keys(config.globalPrompts).length;
    }

    return {
      capabilities,
      metadata,
    };
  }

  /**
   * Comprehensive AI configuration validation
   */
  async validateAiConfiguration(
    config: CursorAiConfiguration,
  ): Promise<{
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    securityReport: SecurityReport;
    capabilities: string[];
    metadata: Record<string, unknown>;
  }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Validate model configuration
    if (config.modelConfig) {
      const modelValidation = await this.validateAiModelConfig(config.modelConfig);
      errors.push(...modelValidation.errors);
      warnings.push(...modelValidation.warnings);
    }

    // Validate prompts
    const promptValidations = [];
    
    if (config.globalPrompts) {
      promptValidations.push(await this.validateCustomPrompts(config.globalPrompts));
    }
    
    if (config.templates) {
      promptValidations.push(await this.validateCustomPrompts(config.templates));
    }
    
    for (const validation of promptValidations) {
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);
    }

    // Validate rules
    if (config.rules) {
      for (const rule of config.rules) {
        if (!rule.name || !rule.pattern || !rule.prompt) {
          errors.push({
            code: 'INCOMPLETE_RULE',
            message: `Rule is missing required fields (name, pattern, prompt)`,
            field: 'rules',
            severity: 'error',
          });
        }
      }
    }

    // Generate security report
    const securityReport = await this.generateAiSecurityReport(config);
    
    // Detect capabilities
    const { capabilities, metadata } = await this.detectAiCapabilities(config);

    return {
      isValid: errors.filter(e => e.severity === 'error' || e.severity === 'critical').length === 0,
      errors,
      warnings,
      securityReport,
      capabilities,
      metadata,
    };
  }

  /**
   * Generate AI-specific security report
   */
  private async generateAiSecurityReport(
    config: CursorAiConfiguration,
  ): Promise<SecurityReport> {
    const filteredFields: string[] = [];
    let hasApiKeys = false;
    let hasTokens = false;
    let hasSensitiveData = false;
    const recommendations: string[] = [];

    // Check for API keys
    const configStr = JSON.stringify(config);
    for (const { pattern, type } of this.SECURITY_PATTERNS) {
      if (pattern.test(configStr)) {
        if (type.includes('key')) hasApiKeys = true;
        if (type.includes('token')) hasTokens = true;
        hasSensitiveData = true;
      }
    }

    // Check specific fields
    if (config.modelConfig && 'apiKey' in config.modelConfig) {
      hasApiKeys = true;
      filteredFields.push('modelConfig.apiKey');
      recommendations.push('Store API keys in environment variables');
    }

    if (config.apiKeys) {
      hasApiKeys = true;
      filteredFields.push('apiKeys');
    }

    if (config.tokens) {
      hasTokens = true;
      filteredFields.push('tokens');
    }

    if (config.credentials) {
      hasSensitiveData = true;
      filteredFields.push('credentials');
    }

    // Determine security level
    let securityLevel: 'safe' | 'warning' | 'unsafe';
    if (hasApiKeys || hasTokens) {
      securityLevel = 'unsafe';
      recommendations.push('Remove all API keys and tokens before sharing');
    } else if (hasSensitiveData) {
      securityLevel = 'warning';
      recommendations.push('Review configuration for sensitive data');
    } else {
      securityLevel = 'safe';
    }

    // Add security best practices
    if (!config.security?.filterSensitiveData) {
      recommendations.push('Enable sensitive data filtering in security settings');
    }

    if (config.security?.allowPublicCodeSuggestions !== false) {
      recommendations.push('Consider disabling public code suggestions for proprietary code');
    }

    return {
      hasApiKeys,
      hasTokens,
      hasSensitiveData,
      filteredFields,
      securityLevel,
      recommendations,
    };
  }

  /**
   * Sanitize AI configuration by removing sensitive data
   */
  async sanitizeAiConfiguration(
    config: CursorAiConfiguration,
  ): Promise<{
    sanitized: CursorAiConfiguration;
    report: SecurityReport;
  }> {
    const sanitized = JSON.parse(JSON.stringify(config));
    const filteredFields: string[] = [];
    let hasApiKeys = false;
    let hasTokens = false;

    // Remove API keys from model config
    if (sanitized.modelConfig) {
      if ('apiKey' in sanitized.modelConfig) {
        delete (sanitized.modelConfig as Record<string, unknown>).apiKey;
        filteredFields.push('modelConfig.apiKey');
        hasApiKeys = true;
      }
    }

    // Remove API keys from rules
    if (sanitized.rules) {
      sanitized.rules = sanitized.rules.map((rule, index) => {
        if (rule.apiKey) {
          filteredFields.push(`rules[${index}].apiKey`);
          hasApiKeys = true;
          const { apiKey: _apiKey, ...cleanRule } = rule;
          return cleanRule;
        }
        return rule;
      });
    }

    // Remove global API keys
    if (sanitized.apiKeys) {
      filteredFields.push('apiKeys');
      hasApiKeys = true;
      delete sanitized.apiKeys;
    }

    // Remove tokens
    if (sanitized.tokens) {
      filteredFields.push('tokens');
      hasTokens = true;
      delete sanitized.tokens;
    }

    // Remove credentials
    if (sanitized.credentials) {
      filteredFields.push('credentials');
      hasApiKeys = true;
      delete sanitized.credentials;
    }

    // Check prompts for sensitive data
    if (sanitized.globalPrompts) {
      for (const [key, prompt] of Object.entries(sanitized.globalPrompts)) {
        if (typeof prompt === 'string' && this.containsSensitiveData(prompt)) {
          sanitized.globalPrompts[key] = '[FILTERED: Contains sensitive data]';
          filteredFields.push(`globalPrompts.${key}`);
        }
      }
    }

    // Check for any other properties that might contain sensitive data
    const additionalKeys = Object.keys(sanitized).filter(key => 
      !['version', 'modelConfig', 'rules', 'apiKeys', 'tokens', 'credentials', 'globalPrompts', 'security', 'copilot', 'templates'].includes(key)
    );
    
    for (const topKey of additionalKeys) {
      const topValue = (sanitized as Record<string, unknown>)[topKey];
      
      // Check for sensitive data in additional properties
      if (topValue !== null && topValue !== undefined) {
        const valueStr = JSON.stringify(topValue);
        if (this.containsSensitiveData(valueStr)) {
          filteredFields.push(topKey);
          // Check if it contains API keys or tokens
          for (const { pattern, type } of this.SECURITY_PATTERNS) {
            pattern.lastIndex = 0;
            if (pattern.test(valueStr)) {
              if (type.includes('key')) hasApiKeys = true;
              if (type.includes('token')) hasTokens = true;
              break;
            }
          }
          delete (sanitized as Record<string, unknown>)[topKey];
        }
      }
    }

    const securityLevel = 
      hasApiKeys || hasTokens ? 'unsafe' :
      filteredFields.length > 0 ? 'warning' :
      'safe';

    const recommendations: string[] = [];
    if (hasApiKeys) {
      recommendations.push('Store API keys in environment variables or secure vaults');
    }
    if (hasTokens) {
      recommendations.push('Use secure token management instead of hardcoding');
    }
    if (filteredFields.length > 0) {
      recommendations.push('Review and remove all sensitive data before sharing');
    }

    return {
      sanitized,
      report: {
        hasApiKeys,
        hasTokens,
        hasSensitiveData: filteredFields.length > 0,
        filteredFields,
        securityLevel,
        recommendations,
      },
    };
  }

  /**
   * Check if a string contains sensitive data
   */
  private containsSensitiveData(text: string): boolean {
    return this.SECURITY_PATTERNS.some(({ pattern }) => {
      // Reset regex state for global patterns
      pattern.lastIndex = 0;
      return pattern.test(text);
    });
  }

  /**
   * Generate comprehensive compatibility report
   */
  async generateComprehensiveCompatibilityReport(
    data: CursorSettingsData,
    aiConfig?: CursorAiConfiguration,
  ): Promise<{
    report: CompatibilityReport;
    deploymentGuide: DeploymentGuidance;
    migrationPlan: MigrationPlan;
  }> {
    // Check extension compatibility
    const extensionIds = data.extensions?.recommendations || [];
    const extensionReport = await this.checkExtensionCompatibility(extensionIds);

    // Check settings compatibility
    const settingsReport = data.settings 
      ? await this.validateVSCodeSettings(data.settings)
      : { incompatibleSettings: [], settingsSuggestions: [] };

    // Check AI configuration compatibility
    const aiCompatibility = aiConfig 
      ? await this.checkAiConfigCompatibility(aiConfig)
      : { compatible: true, issues: [] };

    // Generate platform-specific deployment guidance
    const deploymentGuide = await this.generateDeploymentGuidance({
      extensionReport,
      settingsReport,
      aiCompatibility,
    });

    // Create migration plan
    const migrationPlan = await this.createMigrationPlan({
      incompatibleExtensions: extensionReport.incompatibleExtensions,
      incompatibleSettings: settingsReport.incompatibleSettings,
      alternativeExtensions: extensionReport.alternativeExtensions,
    });

    // Combine into comprehensive report
    const report: CompatibilityReport = {
      vsCodeCompatible: extensionReport.vsCodeCompatible && 
                        settingsReport.incompatibleSettings.length === 0,
      incompatibleSettings: settingsReport.incompatibleSettings,
      incompatibleExtensions: extensionReport.incompatibleExtensions,
      alternativeExtensions: extensionReport.alternativeExtensions,
      migrationSuggestions: [
        ...extensionReport.migrationSuggestions,
        ...settingsReport.settingsSuggestions,
        ...(aiCompatibility.issues || []),
      ],
    };

    return {
      report,
      deploymentGuide,
      migrationPlan,
    };
  }

  /**
   * Validate VS Code settings for compatibility
   */
  private async validateVSCodeSettings(
    settings: VSCodeSettings,
  ): Promise<{
    incompatibleSettings: string[];
    settingsSuggestions: string[];
  }> {
    const incompatibleSettings: string[] = [];
    const settingsSuggestions: string[] = [];

    // Check for Cursor-specific settings
    for (const key of Object.keys(settings)) {
      if (key.startsWith('cursor.')) {
        incompatibleSettings.push(key);
        
        // Provide migration suggestions for common Cursor settings
        if (key === 'cursor.aiProvider') {
          settingsSuggestions.push(
            `Setting "${key}" is Cursor-specific. Consider using GitHub Copilot or other VS Code AI extensions.`,
          );
        } else if (key === 'cursor.apiKey') {
          settingsSuggestions.push(
            `Setting "${key}" contains sensitive data and is Cursor-specific. Remove before sharing.`,
          );
        } else {
          settingsSuggestions.push(
            `Setting "${key}" is Cursor-specific and will be ignored in VS Code.`,
          );
        }
      }
    }

    return {
      incompatibleSettings,
      settingsSuggestions,
    };
  }

  /**
   * Check AI configuration compatibility
   */
  private async checkAiConfigCompatibility(
    aiConfig: CursorAiConfiguration,
  ): Promise<{
    compatible: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check if AI features are compatible with other IDEs
    if (aiConfig.modelConfig) {
      if (aiConfig.modelConfig.provider === 'custom') {
        issues.push('Custom AI providers may not be supported in other IDEs');
      }
    }

    if (aiConfig.rules && aiConfig.rules.length > 0) {
      issues.push('AI rules are Cursor-specific and will need to be reconfigured in other IDEs');
    }

    if (aiConfig.copilot?.enable === false) {
      issues.push('Consider enabling GitHub Copilot for AI assistance in VS Code');
    }

    return {
      compatible: issues.length === 0,
      issues,
    };
  }

  /**
   * Generate platform-specific deployment guidance
   */
  private async generateDeploymentGuidance(context: {
    extensionReport: CompatibilityReport;
    settingsReport: { incompatibleSettings: string[]; settingsSuggestions: string[] };
    aiCompatibility: { compatible: boolean; issues: string[] };
  }): Promise<DeploymentGuidance> {
    const guidance: DeploymentGuidance = {
      vscode: {
        compatible: context.extensionReport.vsCodeCompatible && 
                   context.settingsReport.incompatibleSettings.length === 0,
        steps: [],
        warnings: [],
        recommendations: [],
      },
      cursorIde: {
        compatible: true, // Always compatible with itself
        steps: ['Configuration can be directly imported into Cursor IDE'],
        warnings: [],
        recommendations: [],
      },
      claudeCode: {
        compatible: true, // Generally compatible
        steps: [],
        warnings: [],
        recommendations: [],
      },
    };

    // VS Code deployment guidance
    if (!guidance.vscode.compatible) {
      guidance.vscode.steps = [
        '1. Remove or replace incompatible extensions',
        '2. Update settings to remove Cursor-specific configurations',
        '3. Install recommended VS Code alternatives',
        '4. Test configuration in VS Code',
      ];
      
      if (context.extensionReport.incompatibleExtensions.length > 0) {
        guidance.vscode.warnings.push(
          `${context.extensionReport.incompatibleExtensions.length} extensions are not compatible with VS Code`,
        );
      }
      
      if (context.settingsReport.incompatibleSettings.length > 0) {
        guidance.vscode.warnings.push(
          `${context.settingsReport.incompatibleSettings.length} settings are Cursor-specific`,
        );
      }
    }

    // Add AI-specific recommendations
    if (!context.aiCompatibility.compatible) {
      guidance.vscode.recommendations.push(
        'Install GitHub Copilot for AI code assistance',
        'Consider using VS Code AI extensions for similar functionality',
      );
    }

    // Claude Code guidance
    guidance.claudeCode.steps = [
      '1. Export configuration from Cursor',
      '2. Use Taptik CLI to transform to Claude Code format',
      '3. Import into Claude Code settings',
    ];
    
    guidance.claudeCode.recommendations = [
      'Claude Code supports most VS Code extensions',
      'AI features may need reconfiguration',
    ];

    return guidance;
  }

  /**
   * Create detailed migration plan
   */
  private async createMigrationPlan(context: {
    incompatibleExtensions: string[];
    incompatibleSettings: string[];
    alternativeExtensions: Record<string, string>;
  }): Promise<MigrationPlan> {
    const steps: MigrationStep[] = [];
    let estimatedTime = 0;

    // Plan extension migrations
    for (const ext of context.incompatibleExtensions) {
      const alternative = context.alternativeExtensions[ext];
      steps.push({
        type: 'extension',
        action: alternative ? 'replace' : 'remove',
        target: ext,
        alternative,
        description: alternative 
          ? `Replace ${ext} with ${alternative}`
          : `Remove ${ext} (no alternative available)`,
        estimatedMinutes: 2,
        priority: 'high',
      });
      estimatedTime += 2;
    }

    // Plan settings migrations
    for (const setting of context.incompatibleSettings) {
      steps.push({
        type: 'setting',
        action: 'remove',
        target: setting,
        description: `Remove Cursor-specific setting: ${setting}`,
        estimatedMinutes: 1,
        priority: setting.includes('apiKey') ? 'critical' : 'medium',
      });
      estimatedTime += 1;
    }

    // Add testing step
    steps.push({
      type: 'validation',
      action: 'test',
      target: 'full-configuration',
      description: 'Test migrated configuration in target IDE',
      estimatedMinutes: 10,
      priority: 'high',
    });
    estimatedTime += 10;

    return {
      steps,
      estimatedMinutes: estimatedTime,
      automationLevel: this.calculateAutomationLevel(steps),
      riskLevel: this.calculateRiskLevel(context),
    };
  }

  /**
   * Calculate automation level for migration
   */
  private calculateAutomationLevel(steps: MigrationStep[]): 'full' | 'partial' | 'manual' {
    const automatable = steps.filter(s => 
      s.action === 'replace' || s.action === 'remove'
    ).length;
    const ratio = automatable / steps.length;
    
    if (ratio >= 0.8) return 'full';
    if (ratio >= 0.4) return 'partial';
    return 'manual';
  }

  /**
   * Calculate risk level for migration
   */
  private calculateRiskLevel(context: {
    incompatibleExtensions: string[];
    incompatibleSettings: string[];
  }): 'low' | 'medium' | 'high' {
    const totalIssues = context.incompatibleExtensions.length + 
                        context.incompatibleSettings.length;
    
    if (totalIssues === 0) return 'low';
    if (totalIssues <= 5) return 'medium';
    return 'high';
  }

  /**
   * Check extension compatibility with VS Code
   */
  async checkExtensionCompatibility(
    extensions: string[],
  ): Promise<CompatibilityReport> {
    const incompatibleExtensions: string[] = [];
    const alternativeExtensions: Record<string, string> = {};
    const migrationSuggestions: string[] = [];

    // Extended compatibility database with more extensions
    const extendedCompatibility: Record<string, {
      compatible: boolean;
      alternative?: string;
      reason?: string;
      category?: string;
    }> = {
      ...this.EXTENSION_COMPATIBILITY,
      // Add more Cursor-specific extensions
      'cursor.cursor-terminal': {
        compatible: false,
        reason: 'Cursor-specific terminal integration',
        category: 'terminal',
      },
      'cursor.cursor-search': {
        compatible: false,
        reason: 'Cursor-specific search features',
        category: 'search',
      },
      // AI-related extensions
      'continue.continue': {
        compatible: true,
        category: 'ai',
      },
      'codeium.codeium': {
        compatible: true,
        category: 'ai',
      },
    };

    // Categorize incompatible extensions for better reporting
    const categorizedIncompatible: Record<string, string[]> = {};

    for (const extensionId of extensions) {
      const compatibility = extendedCompatibility[extensionId] || 
                           this.EXTENSION_COMPATIBILITY[extensionId];
      
      if (compatibility) {
        if (!compatibility.compatible) {
          incompatibleExtensions.push(extensionId);
          
          const category = (compatibility as ExtensionCompatibilityInfo & { category?: string }).category || 'general';
          if (!categorizedIncompatible[category]) {
            categorizedIncompatible[category] = [];
          }
          categorizedIncompatible[category].push(extensionId);
          
          if (compatibility.alternative) {
            alternativeExtensions[extensionId] = compatibility.alternative;
            migrationSuggestions.push(
              `✓ Replace "${extensionId}" with "${compatibility.alternative}"`,
            );
          } else if (compatibility.reason) {
            migrationSuggestions.push(
              `✗ Remove "${extensionId}" (${compatibility.reason})`,
            );
          }
        }
      }
    }

    const vsCodeCompatible = incompatibleExtensions.length === 0;

    // Generate categorized migration suggestions
    if (!vsCodeCompatible) {
      migrationSuggestions.unshift(
        '📋 Extension Compatibility Report:',
        `  - ${incompatibleExtensions.length} incompatible extensions found`,
        `  - ${Object.keys(alternativeExtensions).length} have alternatives`,
        '',
      );

      // Add category-specific suggestions
      if (categorizedIncompatible.ai) {
        migrationSuggestions.push(
          '🤖 AI Extensions:',
          '  Consider installing GitHub Copilot or Continue for AI assistance',
        );
      }
    } else {
      migrationSuggestions.push('✅ All extensions are compatible with VS Code');
    }

    return {
      vsCodeCompatible,
      incompatibleSettings: [], // Will be populated from VS Code schema validation
      incompatibleExtensions,
      alternativeExtensions,
      migrationSuggestions,
    };
  }

  /**
   * Generate security report for configuration data
   */
  async generateSecurityReport(
    data: CursorSettingsData,
  ): Promise<SecurityReport> {
    const filteredFields: string[] = [];
    let hasApiKeys = false;
    let hasTokens = false;

    // Check settings for sensitive data
    if (data.settings) {
      const settingsStr = JSON.stringify(data.settings);
      
      // Check for cursor-specific API keys
      for (const [key] of Object.entries(data.settings)) {
        if (key.toLowerCase().includes('apikey') || key === 'cursor.apiKey') {
          hasApiKeys = true;
          filteredFields.push(`settings.${key}`);
          this.logger.warn(`Critical security issue found: API key in settings.${key}`);
        }
      }
      
      // Check for pattern matches in entire settings
      for (const { pattern, type, severity } of this.SECURITY_PATTERNS) {
        pattern.lastIndex = 0; // Reset regex state
        const matches = settingsStr.match(pattern);
        if (matches && matches.length > 0) {
          if (type.includes('key')) hasApiKeys = true;
          if (type.includes('token')) hasTokens = true;
          filteredFields.push(`settings (${type})`);
          
          if (severity === 'critical') {
            this.logger.warn(`Critical security issue found: ${type} in settings`);
          }
        }
      }
    }

    // Check workspace configuration
    if (data.workspace?.launch) {
      const launchStr = JSON.stringify(data.workspace.launch);
      if (this.containsSensitiveData(launchStr)) {
        filteredFields.push('workspace.launch');
        hasApiKeys = true;
      }
    }

    const securityLevel = 
      hasApiKeys || hasTokens ? 'unsafe' :
      filteredFields.length > 0 ? 'warning' :
      'safe';

    const recommendations: string[] = [];
    
    if (securityLevel === 'unsafe') {
      recommendations.push('CRITICAL: Remove all API keys and tokens before sharing');
      recommendations.push('Use environment variables for sensitive configuration');
    } else if (securityLevel === 'warning') {
      recommendations.push('Review configuration for potential sensitive data');
      recommendations.push('Consider using secure storage for credentials');
    } else {
      recommendations.push('Configuration appears safe for sharing');
    }

    return {
      hasApiKeys,
      hasTokens,
      hasSensitiveData: filteredFields.length > 0,
      filteredFields: [...new Set(filteredFields)], // Remove duplicates
      securityLevel,
      recommendations,
    };
  }

  /**
   * Filter sensitive data from configuration
   */
  async filterSensitiveData(
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const filtered = JSON.parse(JSON.stringify(data));
    
    const filterObject = (obj: Record<string, unknown> | unknown, path: string = ''): void => {
      if (!obj || typeof obj !== 'object') {
        return;
      }

      const objRecord = obj as Record<string, unknown>;
      for (const [key, value] of Object.entries(objRecord)) {
        const currentPath = path ? `${path}.${key}` : key;

        // Check if key contains sensitive patterns
        const sensitiveKeyPatterns = [
          /^(api[_-]?key|apikey)$/i,
          /^(token|access[_-]?token|auth[_-]?token)$/i,
          /^(secret|client[_-]?secret)$/i,
          /^(password|passwd|pwd)$/i,
          /^(credential|credentials)$/i,
        ];

        // Check if key contains sensitive words (for deletion)
        const keyHasSensitiveWord = [
          /token/i,  // Specifically for tokens
          /password/i,
        ].some(pattern => pattern.test(key));

        // If key explicitly matches sensitive patterns, delete it
        if (sensitiveKeyPatterns.some(pattern => pattern.test(key))) {
          this.logger.debug(`Filtering sensitive field: ${currentPath}`);
          delete objRecord[key];
          continue;
        }

        // Special handling for keys containing 'Token' (like githubToken)
        if (keyHasSensitiveWord) {
          this.logger.debug(`Filtering field with sensitive word: ${currentPath}`);
          delete objRecord[key];
          continue;
        }

        // Check if value contains sensitive data
        if (typeof value === 'string') {
          if (this.containsSensitiveData(value)) {
            // For values that look like keys/tokens but the field name doesn't indicate it
            // Replace with [FILTERED]
            this.logger.debug(`Filtering sensitive value at: ${currentPath}`);
            objRecord[key] = '[FILTERED]';
            continue;
          }
        }

        // Recurse for nested objects
        if (typeof value === 'object' && value !== null) {
          filterObject(value, currentPath);
        }
      }
    };

    filterObject(filtered);
    return filtered;
  }

  /**
   * Validate complete Cursor configuration
   */
  async validateCursorConfiguration(
    data: CursorSettingsData,
  ): Promise<CursorValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate VS Code settings
    if (data.settings) {
      const schemaValidation = await this.validateVSCodeSchema(data.settings);
      errors.push(...schemaValidation.errors);
      warnings.push(...schemaValidation.warnings);
    }

    // Check extension compatibility
    let compatibilityReport: CompatibilityReport | undefined;
    if (data.extensions?.recommendations) {
      compatibilityReport = await this.checkExtensionCompatibility(
        data.extensions.recommendations,
      );
      
      if (!compatibilityReport.vsCodeCompatible) {
        warnings.push({
          code: 'INCOMPATIBLE_EXTENSIONS',
          message: `${compatibilityReport.incompatibleExtensions.length} extensions are not compatible with VS Code`,
          severity: 'warning',
          suggestion: compatibilityReport.migrationSuggestions[0],
        });
      }
    }

    // Generate security report
    const securityReport = await this.generateSecurityReport(data);
    
    if (securityReport.securityLevel === 'unsafe') {
      // For Cursor-specific settings, generate warning instead of error
      // to allow user choice in sanitization
      warnings.push({
        code: 'SECURITY_WARNING',
        message: 'Configuration contains sensitive data that should be removed',
        severity: 'warning',
        suggestion: securityReport.recommendations[0],
      });
    } else if (securityReport.securityLevel === 'warning') {
      warnings.push({
        code: 'SECURITY_WARNING',
        message: 'Configuration may contain sensitive data',
        severity: 'warning',
        suggestion: securityReport.recommendations[0],
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      securityReport,
      compatibilityReport,
    };
  }
}