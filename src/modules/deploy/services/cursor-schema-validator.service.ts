import { Injectable, Logger } from '@nestjs/common';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import {
  CURSOR_SCHEMA_REGISTRY,
  CursorSchemaType,
  CursorValidationSchema,
} from '../schemas/cursor-validation.schema';
import {
  CursorContentValidatorService,
  CursorContentValidationResult,
} from './cursor-content-validator.service';
import {
  CursorExtensionValidatorService,
  CursorExtensionCompatibilityResult,
} from './cursor-extension-validator.service';
import {
  CursorGlobalSettings,
  CursorProjectSettings,
  CursorAIConfig,
} from '../interfaces/cursor-config.interface';
import {
  CursorExtensionsConfig,
  CursorDebugConfig,
  CursorTasksConfig,
  CursorSnippetsConfig,
  CursorWorkspaceConfig,
} from '../interfaces';

export interface CursorSchemaValidationResult {
  valid: boolean;
  schemaErrors: CursorSchemaError[];
  contentValidation?: CursorContentValidationResult;
  extensionValidation?: CursorExtensionCompatibilityResult;
  warnings: CursorSchemaWarning[];
  suggestions: string[];
  statistics: CursorValidationStatistics;
}

export interface CursorSchemaError {
  schemaType: CursorSchemaType;
  path: string;
  message: string;
  value?: any;
  expectedType?: string;
  constraint?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  fixable: boolean;
  suggestion?: string;
}

export interface CursorSchemaWarning {
  schemaType: CursorSchemaType;
  path: string;
  message: string;
  recommendation: string;
  impact: 'performance' | 'compatibility' | 'security' | 'usability';
}

export interface CursorValidationStatistics {
  totalSchemas: number;
  validSchemas: number;
  invalidSchemas: number;
  totalErrors: number;
  totalWarnings: number;
  performanceIssues: number;
  securityIssues: number;
  compatibilityIssues: number;
  validationTime: number;
}

export interface CursorValidationOptions {
  validateContent?: boolean;
  validateExtensions?: boolean;
  cursorVersion?: string;
  strictMode?: boolean;
  includeWarnings?: boolean;
  includeSuggestions?: boolean;
}

@Injectable()
export class CursorSchemaValidatorService {
  private readonly logger = new Logger(CursorSchemaValidatorService.name);
  private readonly ajv: Ajv;

  constructor(
    private readonly contentValidator: CursorContentValidatorService,
    private readonly extensionValidator: CursorExtensionValidatorService
  ) {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
      removeAdditional: false,
      useDefaults: true,
      coerceTypes: false,
    });

    // Add format validators
    addFormats(this.ajv);

    // Add custom formats
    this.addCustomFormats();

    // Compile all schemas
    this.compileSchemas();
  }

  async validateConfiguration(
    config: any,
    schemaType: CursorSchemaType,
    options: CursorValidationOptions = {}
  ): Promise<CursorSchemaValidationResult> {
    const startTime = Date.now();
    this.logger.log(`Validating ${schemaType} configuration...`);

    const result: CursorSchemaValidationResult = {
      valid: true,
      schemaErrors: [],
      warnings: [],
      suggestions: [],
      statistics: {
        totalSchemas: 1,
        validSchemas: 0,
        invalidSchemas: 0,
        totalErrors: 0,
        totalWarnings: 0,
        performanceIssues: 0,
        securityIssues: 0,
        compatibilityIssues: 0,
        validationTime: 0,
      },
    };

    try {
      // Schema validation
      const schemaValid = await this.validateSchema(config, schemaType, result, options);
      
      if (schemaValid) {
        result.statistics.validSchemas++;
      } else {
        result.statistics.invalidSchemas++;
      }

      // Content validation for AI configurations
      if (options.validateContent && this.isAIRelated(schemaType)) {
        try {
          result.contentValidation = await this.contentValidator.validateAIContent(config as CursorAIConfig);
          
          // Convert content validation results to schema errors/warnings
          this.integrateContentValidation(result);
        } catch (error) {
          this.logger.warn('Content validation failed:', error);
          result.warnings.push({
            schemaType,
            path: 'content-validation',
            message: `Content validation failed: ${(error as Error).message}`,
            recommendation: 'Check AI content manually for issues',
            impact: 'security',
          });
        }
      }

      // Extension validation for extension configurations
      if (options.validateExtensions && schemaType === 'cursor-extensions') {
        try {
          result.extensionValidation = await this.extensionValidator.validateExtensionCompatibility(
            config as CursorExtensionsConfig,
            options.cursorVersion
          );
          
          // Convert extension validation results to schema errors/warnings
          this.integrateExtensionValidation(result);
        } catch (error) {
          this.logger.warn('Extension validation failed:', error);
          result.warnings.push({
            schemaType,
            path: 'extension-validation',
            message: `Extension validation failed: ${(error as Error).message}`,
            recommendation: 'Check extension configuration manually',
            impact: 'compatibility',
          });
        }
      }

      // Generate suggestions
      if (options.includeSuggestions) {
        this.generateSuggestions(result, schemaType);
      }

      // Calculate final statistics
      result.statistics.totalErrors = result.schemaErrors.length;
      result.statistics.totalWarnings = result.warnings.length;
      result.statistics.validationTime = Date.now() - startTime;

      // Determine overall validity
      result.valid = result.schemaErrors.length === 0 || 
        !result.schemaErrors.some(error => error.severity === 'critical' || error.severity === 'high');

      this.logger.log(`Validation completed in ${result.statistics.validationTime}ms: ${result.valid ? 'VALID' : 'INVALID'}`);
      
      return result;

    } catch (error) {
      this.logger.error('Schema validation failed:', error);
      
      result.valid = false;
      result.schemaErrors.push({
        schemaType,
        path: 'root',
        message: `Validation failed: ${(error as Error).message}`,
        severity: 'critical',
        fixable: false,
      });
      
      result.statistics.invalidSchemas++;
      result.statistics.totalErrors++;
      result.statistics.validationTime = Date.now() - startTime;
      
      return result;
    }
  }

  async validateMultipleConfigurations(
    configurations: Array<{ config: any; schemaType: CursorSchemaType; name?: string }>,
    options: CursorValidationOptions = {}
  ): Promise<CursorSchemaValidationResult> {
    const startTime = Date.now();
    this.logger.log(`Validating ${configurations.length} configurations...`);

    const combinedResult: CursorSchemaValidationResult = {
      valid: true,
      schemaErrors: [],
      warnings: [],
      suggestions: [],
      statistics: {
        totalSchemas: configurations.length,
        validSchemas: 0,
        invalidSchemas: 0,
        totalErrors: 0,
        totalWarnings: 0,
        performanceIssues: 0,
        securityIssues: 0,
        compatibilityIssues: 0,
        validationTime: 0,
      },
    };

    for (let i = 0; i < configurations.length; i++) {
      const { config, schemaType, name } = configurations[i];
      const configName = name || `config-${i}`;

      try {
        const result = await this.validateConfiguration(config, schemaType, {
          ...options,
          includeSuggestions: false, // We'll generate suggestions at the end
        });

        // Merge results
        combinedResult.schemaErrors.push(
          ...result.schemaErrors.map(error => ({
            ...error,
            path: `${configName}.${error.path}`,
          }))
        );

        combinedResult.warnings.push(
          ...result.warnings.map(warning => ({
            ...warning,
            path: `${configName}.${warning.path}`,
          }))
        );

        // Update statistics
        if (result.valid) {
          combinedResult.statistics.validSchemas++;
        } else {
          combinedResult.statistics.invalidSchemas++;
        }

        combinedResult.statistics.performanceIssues += result.statistics.performanceIssues;
        combinedResult.statistics.securityIssues += result.statistics.securityIssues;
        combinedResult.statistics.compatibilityIssues += result.statistics.compatibilityIssues;

      } catch (error) {
        this.logger.error(`Validation failed for ${configName}:`, error);
        
        combinedResult.schemaErrors.push({
          schemaType,
          path: configName,
          message: `Configuration validation failed: ${(error as Error).message}`,
          severity: 'critical',
          fixable: false,
        });
        
        combinedResult.statistics.invalidSchemas++;
      }
    }

    // Generate combined suggestions
    if (options.includeSuggestions) {
      this.generateCombinedSuggestions(combinedResult);
    }

    // Calculate final statistics
    combinedResult.statistics.totalErrors = combinedResult.schemaErrors.length;
    combinedResult.statistics.totalWarnings = combinedResult.warnings.length;
    combinedResult.statistics.validationTime = Date.now() - startTime;

    // Determine overall validity
    combinedResult.valid = combinedResult.schemaErrors.length === 0 || 
      !combinedResult.schemaErrors.some(error => error.severity === 'critical');

    this.logger.log(`Multi-configuration validation completed in ${combinedResult.statistics.validationTime}ms`);
    
    return combinedResult;
  }

  private async validateSchema(
    config: any,
    schemaType: CursorSchemaType,
    result: CursorSchemaValidationResult,
    options: CursorValidationOptions
  ): Promise<boolean> {
    const schemaId = `cursor-schema-${schemaType}`;
    const validateFunction = this.ajv.getSchema(schemaId);

    if (!validateFunction) {
      result.schemaErrors.push({
        schemaType,
        path: 'schema',
        message: `Schema not found for type: ${schemaType}`,
        severity: 'critical',
        fixable: false,
      });
      return false;
    }

    const valid = validateFunction(config);

    if (!valid && validateFunction.errors) {
      for (const error of validateFunction.errors) {
        const schemaError: CursorSchemaError = {
          schemaType,
          path: error.instancePath || error.schemaPath || 'root',
          message: this.formatErrorMessage(error),
          value: error.data,
          expectedType: this.getExpectedType(error),
          constraint: error.keyword,
          severity: this.getErrorSeverity(error, options.strictMode),
          fixable: this.isErrorFixable(error),
          suggestion: this.getErrorSuggestion(error),
        };

        result.schemaErrors.push(schemaError);

        // Update issue counters
        this.updateIssueCounters(schemaError, result.statistics);
      }
    }

    // Additional validations based on schema type
    if (valid || !options.strictMode) {
      this.performAdditionalValidations(config, schemaType, result);
    }

    return valid;
  }

  private integrateContentValidation(result: CursorSchemaValidationResult): void {
    if (!result.contentValidation) return;

    // Convert security issues to schema errors
    for (const securityIssue of result.contentValidation.securityIssues) {
      result.schemaErrors.push({
        schemaType: 'cursor-ai',
        path: securityIssue.location || 'ai-content',
        message: `Security Issue: ${securityIssue.message}`,
        severity: securityIssue.severity,
        fixable: true,
        suggestion: securityIssue.mitigation,
      });
      result.statistics.securityIssues++;
    }

    // Convert size issues to schema errors
    for (const sizeIssue of result.contentValidation.sizeIssues) {
      const severity = sizeIssue.severity === 'high' ? 'high' as const : 'medium' as const;
      result.schemaErrors.push({
        schemaType: 'cursor-ai',
        path: sizeIssue.location || 'ai-content',
        message: `Size Issue: ${sizeIssue.message}`,
        severity,
        fixable: true,
        suggestion: sizeIssue.suggestion,
      });
    }

    // Convert warnings
    for (const warning of result.contentValidation.warnings) {
      result.warnings.push({
        schemaType: 'cursor-ai',
        path: warning.location || 'ai-content',
        message: warning.message,
        recommendation: warning.recommendation || 'Review AI content configuration',
        impact: 'security',
      });
    }
  }

  private integrateExtensionValidation(result: CursorSchemaValidationResult): void {
    if (!result.extensionValidation) return;

    // Convert extension issues to schema errors
    for (const issue of result.extensionValidation.issues) {
      result.schemaErrors.push({
        schemaType: 'cursor-extensions',
        path: `extensions.${issue.extensionId}`,
        message: issue.message,
        severity: issue.severity,
        fixable: issue.fixable,
        suggestion: issue.solution,
      });

      this.updateIssueCounters({ severity: issue.severity } as any, result.statistics);
    }

    // Convert extension warnings
    for (const warning of result.extensionValidation.warnings) {
      result.warnings.push({
        schemaType: 'cursor-extensions',
        path: `extensions.${warning.extensionId}`,
        message: warning.message,
        recommendation: warning.recommendation,
        impact: 'compatibility',
      });
    }
  }

  private updateIssueCounters(error: CursorSchemaError, stats: CursorValidationStatistics): void {
    if (error.message.toLowerCase().includes('security') || error.message.toLowerCase().includes('sensitive')) {
      stats.securityIssues++;
    }
    if (error.message.toLowerCase().includes('performance') || error.message.toLowerCase().includes('size')) {
      stats.performanceIssues++;
    }
    if (error.message.toLowerCase().includes('compatible') || error.message.toLowerCase().includes('version')) {
      stats.compatibilityIssues++;
    }
  }

  private performAdditionalValidations(
    config: any,
    schemaType: CursorSchemaType,
    result: CursorSchemaValidationResult
  ): void {
    // Schema-specific additional validations
    switch (schemaType) {
      case 'cursor-global-settings':
        this.validateGlobalSettingsLogic(config, result);
        break;
      case 'cursor-debug':
        this.validateDebugConfigLogic(config, result);
        break;
      case 'cursor-tasks':
        this.validateTasksConfigLogic(config, result);
        break;
      case 'cursor-workspace':
        this.validateWorkspaceConfigLogic(config, result);
        break;
    }
  }

  private validateGlobalSettingsLogic(config: CursorGlobalSettings, result: CursorSchemaValidationResult): void {
    // Check for conflicting settings
    if (config.editor?.formatOnSave && config.editor?.formatOnType && config.editor?.formatOnPaste) {
      result.warnings.push({
        schemaType: 'cursor-global-settings',
        path: 'editor.format',
        message: 'All format options are enabled, which may cause conflicts',
        recommendation: 'Consider enabling only necessary format options',
        impact: 'performance',
      });
    }

    // Check for resource-intensive settings
    if (config.editor?.minimap?.enabled && config.editor?.rulers && config.editor.rulers.length > 5) {
      result.warnings.push({
        schemaType: 'cursor-global-settings',
        path: 'editor.performance',
        message: 'Multiple rulers with minimap may impact performance',
        recommendation: 'Consider reducing the number of rulers',
        impact: 'performance',
      });
    }
  }

  private validateDebugConfigLogic(config: CursorDebugConfig, result: CursorSchemaValidationResult): void {
    // Check for common misconfigurations
    for (let i = 0; i < config.configurations.length; i++) {
      const conf = config.configurations[i];
      
      if (conf.type === 'node' && conf.request === 'launch' && !conf.program) {
        result.warnings.push({
          schemaType: 'cursor-debug',
          path: `configurations[${i}].program`,
          message: 'Node.js launch configuration missing program path',
          recommendation: 'Specify the program path for Node.js debugging',
          impact: 'usability',
        });
      }
    }
  }

  private validateTasksConfigLogic(config: CursorTasksConfig, result: CursorSchemaValidationResult): void {
    // Check for task dependency cycles
    const taskNames = new Set(config.tasks.map(task => task.label));
    
    for (let i = 0; i < config.tasks.length; i++) {
      const task = config.tasks[i];
      
      if (task.dependsOn) {
        const dependencies = Array.isArray(task.dependsOn) ? task.dependsOn : [task.dependsOn];
        
        for (const dep of dependencies) {
          const depName = typeof dep === 'string' ? dep : dep.task;
          if (!taskNames.has(depName)) {
            result.warnings.push({
              schemaType: 'cursor-tasks',
              path: `tasks[${i}].dependsOn`,
              message: `Task dependency '${depName}' not found`,
              recommendation: 'Ensure all task dependencies exist',
              impact: 'usability',
            });
          }
        }
      }
    }
  }

  private validateWorkspaceConfigLogic(config: CursorWorkspaceConfig, result: CursorSchemaValidationResult): void {
    // Check for duplicate folder paths
    const folderPaths = config.folders.map(folder => folder.path);
    const uniquePaths = new Set(folderPaths);
    
    if (folderPaths.length !== uniquePaths.size) {
      result.warnings.push({
        schemaType: 'cursor-workspace',
        path: 'folders',
        message: 'Duplicate folder paths detected in workspace',
        recommendation: 'Remove duplicate folder entries',
        impact: 'usability',
      });
    }
  }

  private generateSuggestions(result: CursorSchemaValidationResult, schemaType: CursorSchemaType): void {
    // Generate suggestions based on common patterns
    const errorTypes = result.schemaErrors.map(e => e.constraint).filter(Boolean);
    const uniqueErrorTypes = [...new Set(errorTypes)];

    if (uniqueErrorTypes.includes('required')) {
      result.suggestions.push('Review required fields and ensure all necessary properties are provided');
    }

    if (uniqueErrorTypes.includes('type')) {
      result.suggestions.push('Check data types - ensure strings, numbers, and booleans are correctly formatted');
    }

    if (uniqueErrorTypes.includes('enum')) {
      result.suggestions.push('Verify that enumerated values match the allowed options');
    }

    if (result.statistics.securityIssues > 0) {
      result.suggestions.push('Remove sensitive data and use environment variables or secure storage instead');
    }

    if (result.statistics.performanceIssues > 0) {
      result.suggestions.push('Optimize configuration for better performance - consider reducing content size and complexity');
    }

    // Schema-specific suggestions
    this.addSchemaSpecificSuggestions(result, schemaType);
  }

  private generateCombinedSuggestions(result: CursorSchemaValidationResult): void {
    if (result.statistics.invalidSchemas > result.statistics.validSchemas) {
      result.suggestions.push('Most configurations have validation errors - consider reviewing configuration format');
    }

    if (result.statistics.securityIssues > 5) {
      result.suggestions.push('Multiple security issues detected - implement a security review process');
    }

    if (result.statistics.performanceIssues > 10) {
      result.suggestions.push('Many performance issues detected - consider optimizing configuration size and complexity');
    }
  }

  private addSchemaSpecificSuggestions(result: CursorSchemaValidationResult, schemaType: CursorSchemaType): void {
    switch (schemaType) {
      case 'cursor-ai':
        if (result.contentValidation?.statistics.totalSize && 
            result.contentValidation.statistics.totalSize > 500000) {
          result.suggestions.push('Consider breaking large AI content into smaller, more focused pieces');
        }
        break;
      case 'cursor-extensions':
        if (result.extensionValidation?.statistics.totalExtensions && 
            result.extensionValidation.statistics.totalExtensions > 50) {
          result.suggestions.push('Consider organizing extensions into profiles or removing unused ones');
        }
        break;
    }
  }

  private addCustomFormats(): void {
    // Add custom format validators
    this.ajv.addFormat('hostname', {
      type: 'string',
      validate: (value: string) => /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(value)
    });
  }

  private compileSchemas(): void {
    for (const [schemaType, schema] of Object.entries(CURSOR_SCHEMA_REGISTRY)) {
      try {
        this.ajv.addSchema(schema, `cursor-schema-${schemaType}`);
        this.logger.debug(`Compiled schema: ${schemaType}`);
      } catch (error) {
        this.logger.error(`Failed to compile schema ${schemaType}:`, error);
      }
    }
  }

  private isAIRelated(schemaType: CursorSchemaType): boolean {
    return schemaType === 'cursor-ai' || schemaType === 'cursor-global-settings';
  }

  private formatErrorMessage(error: any): string {
    let message = error.message || 'Validation error';
    
    if (error.keyword === 'required') {
      message = `Missing required property: ${error.params?.missingProperty || 'unknown'}`;
    } else if (error.keyword === 'type') {
      message = `Invalid type: expected ${error.schema}, got ${typeof error.data}`;
    } else if (error.keyword === 'enum') {
      message = `Invalid value: must be one of ${JSON.stringify(error.schema)}`;
    } else if (error.keyword === 'format') {
      message = `Invalid format: ${error.message}`;
    }

    return message;
  }

  private getExpectedType(error: any): string | undefined {
    return error.schema?.type || error.schema;
  }

  private getErrorSeverity(error: any, strictMode?: boolean): 'critical' | 'high' | 'medium' | 'low' {
    if (error.keyword === 'required') {
      return 'high';
    }
    if (error.keyword === 'type') {
      return strictMode ? 'high' : 'medium';
    }
    if (error.keyword === 'enum' || error.keyword === 'format') {
      return 'medium';
    }
    return 'low';
  }

  private isErrorFixable(error: any): boolean {
    return ['required', 'type', 'enum', 'format', 'minimum', 'maximum'].includes(error.keyword);
  }

  private getErrorSuggestion(error: any): string | undefined {
    switch (error.keyword) {
      case 'required':
        return `Add the required property: ${error.params?.missingProperty}`;
      case 'type':
        return `Change value to ${error.schema} type`;
      case 'enum':
        return `Use one of: ${JSON.stringify(error.schema)}`;
      case 'format':
        return `Ensure value matches ${error.schema} format`;
      case 'minimum':
        return `Use a value >= ${error.schema}`;
      case 'maximum':
        return `Use a value <= ${error.schema}`;
      default:
        return undefined;
    }
  }

  // Public utility methods
  getAvailableSchemas(): CursorSchemaType[] {
    return Object.keys(CURSOR_SCHEMA_REGISTRY) as CursorSchemaType[];
  }

  getSchema(schemaType: CursorSchemaType): CursorValidationSchema | undefined {
    return CURSOR_SCHEMA_REGISTRY[schemaType];
  }
}