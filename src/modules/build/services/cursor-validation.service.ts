/**
 * CursorValidationService - Validation service for Cursor IDE configurations
 * Handles VS Code schema validation, security filtering, and compatibility checking
 */

import { Injectable, Logger } from '@nestjs/common';

import {
  CursorSettingsData,
  CursorValidationResult,
  ValidationError,
  ValidationWarning,
  SecurityReport,
  CompatibilityReport,
  VSCodeSettings,
  CursorAiConfiguration,
} from '../interfaces/cursor-ide.interfaces';

/**
 * Service for validating and securing Cursor IDE configurations
 */
@Injectable()
export class CursorValidationService {
  private readonly logger = new Logger(CursorValidationService.name);

  // VS Code schema definitions (subset for validation)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly VSCODE_SETTINGS_SCHEMA: Record<string, any> = {
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
  private readonly SECURITY_PATTERNS = [
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
  private readonly EXTENSION_COMPATIBILITY: Record<string, {
    compatible: boolean;
    alternative?: string;
    reason?: string;
  }> = {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: any,
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
    if (schema.enum && !schema.enum.includes(value)) {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (sanitized.modelConfig as any).apiKey;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topValue = (sanitized as any)[topKey];
      
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (sanitized as any)[topKey];
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
   * Check extension compatibility with VS Code
   */
  async checkExtensionCompatibility(
    extensions: string[],
  ): Promise<CompatibilityReport> {
    const incompatibleExtensions: string[] = [];
    const alternativeExtensions: Record<string, string> = {};
    const migrationSuggestions: string[] = [];

    for (const extensionId of extensions) {
      const compatibility = this.EXTENSION_COMPATIBILITY[extensionId];
      
      if (compatibility) {
        if (!compatibility.compatible) {
          incompatibleExtensions.push(extensionId);
          if (compatibility.alternative) {
            alternativeExtensions[extensionId] = compatibility.alternative;
            migrationSuggestions.push(
              `Replace "${extensionId}" with "${compatibility.alternative}"`,
            );
          } else if (compatibility.reason) {
            migrationSuggestions.push(
              `Remove "${extensionId}" (${compatibility.reason})`,
            );
          }
        }
      }
    }

    const vsCodeCompatible = incompatibleExtensions.length === 0;

    if (!vsCodeCompatible) {
      migrationSuggestions.unshift(
        'The following extensions are not compatible with VS Code:',
      );
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
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filterObject = (obj: any, path: string = ''): void => {
      if (!obj || typeof obj !== 'object') {
        return;
      }

      for (const [key, value] of Object.entries(obj)) {
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
          delete obj[key];
          continue;
        }

        // Special handling for keys containing 'Token' (like githubToken)
        if (keyHasSensitiveWord) {
          this.logger.debug(`Filtering field with sensitive word: ${currentPath}`);
          delete obj[key];
          continue;
        }

        // Check if value contains sensitive data
        if (typeof value === 'string') {
          if (this.containsSensitiveData(value)) {
            // For values that look like keys/tokens but the field name doesn't indicate it
            // Replace with [FILTERED]
            this.logger.debug(`Filtering sensitive value at: ${currentPath}`);
            obj[key] = '[FILTERED]';
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