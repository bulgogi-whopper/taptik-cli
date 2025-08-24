import { Injectable } from '@nestjs/common';

import {
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '../../context/dto/validation-result.dto';
import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import {
  KiroGlobalSettings,
  KiroProjectSettings,
  KiroSteeringDocument,
  KiroSpecDocument,
  KiroHookConfiguration,
  KiroAgentConfiguration,
  KiroTemplateConfiguration,
  KiroComponentType,
  KiroValidationResult,
  KiroDeploymentOptions,
} from '../interfaces/kiro-deployment.interface';

@Injectable()
export class KiroValidatorService {
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly MAX_AGENTS = 50;
  private readonly MAX_TEMPLATES = 100;
  private readonly MAX_HOOKS = 20;
  private readonly VALID_HOOK_TYPES = ['pre-commit', 'post-commit', 'file-save', 'session-start', 'custom'];
  private readonly VALID_SPEC_TYPES = ['feature', 'bug', 'enhancement', 'refactor', 'docs'];
  private readonly VALID_SPEC_STATUSES = ['draft', 'active', 'completed', 'archived'];
  private readonly VALID_TASK_STATUSES = ['pending', 'in_progress', 'completed', 'blocked'];
  private readonly VALID_PRIORITIES = ['low', 'medium', 'high'];

  async validateForKiro(
    context: TaptikContext,
    options: KiroDeploymentOptions,
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate context structure
    if (!context) {
      errors.push({
        field: 'context',
        message: 'Context is required for Kiro validation',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
      return { isValid: false, errors, warnings };
    }

    if (!context.content) {
      errors.push({
        field: 'context.content',
        message: 'Context content is required',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
      return { isValid: false, errors, warnings };
    }

    // Validate platform compatibility
    if (
      context.metadata?.targetIdes &&
      !context.metadata.targetIdes.includes('kiro-ide')
    ) {
      errors.push({
        field: 'metadata.targetIdes',
        message: `Configuration is not compatible with Kiro IDE. Compatible platforms: ${context.metadata.targetIdes.join(', ')}`,
        code: 'PLATFORM_INCOMPATIBLE',
        severity: 'HIGH',
      });
    }

    // Validate each component type based on what's present
    if (context.content.personal) {
      const personalResult = this.validatePersonalContext(context.content.personal);
      errors.push(...personalResult.errors);
      warnings.push(...(personalResult.warnings || []));
    }

    if (context.content.project) {
      const projectResult = this.validateProjectContext(context.content.project);
      errors.push(...projectResult.errors);
      warnings.push(...(projectResult.warnings || []));
    }

    if (context.content.components) {
      const componentsResult = this.validateComponents(context.content.components);
      errors.push(...componentsResult.errors);
      warnings.push(...(componentsResult.warnings || []));
    }

    // Validate deployment options
    const optionsResult = this.validateDeploymentOptions(options);
    errors.push(...optionsResult.errors);
    warnings.push(...(optionsResult.warnings || []));

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async validateKiroComponent(
    component: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    componentType: KiroComponentType,
  ): Promise<KiroValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    switch (componentType) {
      case 'settings': {
        const settingsResult = this.validateSettings(component);
        errors.push(...settingsResult.errors);
        warnings.push(...(settingsResult.warnings || []));
        break;
      }

      case 'steering': {
        const steeringResult = this.validateSteeringDocument(component);
        errors.push(...steeringResult.errors);
        warnings.push(...(steeringResult.warnings || []));
        break;
      }

      case 'specs': {
        const specsResult = this.validateSpecDocument(component);
        errors.push(...specsResult.errors);
        warnings.push(...(specsResult.warnings || []));
        break;
      }

      case 'hooks': {
        const hooksResult = this.validateHookConfiguration(component);
        errors.push(...hooksResult.errors);
        warnings.push(...(hooksResult.warnings || []));
        break;
      }

      case 'agents': {
        const agentsResult = this.validateAgentConfiguration(component);
        errors.push(...agentsResult.errors);
        warnings.push(...(agentsResult.warnings || []));
        break;
      }

      case 'templates': {
        const templatesResult = this.validateTemplateConfiguration(component);
        errors.push(...templatesResult.errors);
        warnings.push(...(templatesResult.warnings || []));
        break;
      }

      default:
        errors.push({
          field: 'componentType',
          message: `Unknown component type: ${componentType}`,
          code: 'INVALID_COMPONENT_TYPE',
          severity: 'HIGH',
        });
    }

    return {
      isValid: errors.length === 0,
      component: componentType,
      errors,
      warnings,
      suggestions,
    };
  }

  private validatePersonalContext(personal: any): ValidationResult { // eslint-disable-line @typescript-eslint/no-explicit-any
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for security risks in personal context
    if (personal.secrets || personal.tokens || personal.apiKeys) {
      errors.push({
        field: 'personal.secrets',
        message: 'Personal context should not contain secrets, tokens, or API keys',
        code: 'SECURITY_VIOLATION',
        severity: 'HIGH',
      });
    }

    // Warn about email exposure
    if (personal.profile?.email || personal.email) {
      warnings.push({
        field: 'personal.email',
        message: 'Email address will be included in Kiro global settings',
        suggestion: 'Ensure this is intended for the deployment environment',
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateProjectContext(project: any): ValidationResult { // eslint-disable-line @typescript-eslint/no-explicit-any
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate project name
    if (project.info?.name && typeof project.info.name !== 'string') {
      errors.push({
        field: 'project.info.name',
        message: 'Project name must be a string',
        code: 'INVALID_TYPE',
        severity: 'MEDIUM',
      });
    }

    // Validate team size
    if (project.info?.team_size && !Number.isInteger(project.info.team_size)) {
      errors.push({
        field: 'project.info.team_size',
        message: 'Team size must be an integer',
        code: 'INVALID_TYPE',
        severity: 'LOW',
      });
    }

    // Check for security violations in project context
    if (project.secrets || project.credentials || project.tokens) {
      errors.push({
        field: 'project.secrets',
        message: 'Project context should not contain secrets or credentials',
        code: 'SECURITY_VIOLATION',
        severity: 'HIGH',
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateComponents(components: any): ValidationResult { // eslint-disable-line @typescript-eslint/no-explicit-any
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!Array.isArray(components)) {
      errors.push({
        field: 'components',
        message: 'Components must be an array',
        code: 'INVALID_TYPE',
        severity: 'HIGH',
      });
      return { isValid: false, errors, warnings };
    }

    components.forEach((component, index) => {
      if (!component.type) {
        errors.push({
          field: `components[${index}].type`,
          message: 'Component type is required',
          code: 'REQUIRED_FIELD',
          severity: 'HIGH',
        });
      }

      if (!component.content) {
        errors.push({
          field: `components[${index}].content`,
          message: 'Component content is required',
          code: 'REQUIRED_FIELD',
          severity: 'HIGH',
        });
      }

      // Check content size
      if (component.content && JSON.stringify(component.content).length > this.MAX_FILE_SIZE) {
        errors.push({
          field: `components[${index}].content`,
          message: `Component content exceeds maximum size of ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`,
          code: 'SIZE_LIMIT_EXCEEDED',
          severity: 'HIGH',
        });
      }
    });

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateSettings(settings: KiroGlobalSettings | KiroProjectSettings): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!settings.version) {
      errors.push({
        field: 'settings.version',
        message: 'Settings version is required',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
    } else if (!/^\d+\.\d+\.\d+$/.test(settings.version)) {
      warnings.push({
        field: 'settings.version',
        message: 'Version should follow semantic versioning (e.g., "1.0.0")',
        suggestion: 'Use format: major.minor.patch',
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateSteeringDocument(document: KiroSteeringDocument): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!document.name) {
      errors.push({
        field: 'steering.name',
        message: 'Steering document name is required',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
    }

    if (!document.category) {
      errors.push({
        field: 'steering.category',
        message: 'Steering document category is required',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
    }

    if (!document.content) {
      errors.push({
        field: 'steering.content',
        message: 'Steering document content is required',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
    }

    if (document.priority && !this.VALID_PRIORITIES.includes(document.priority)) {
      errors.push({
        field: 'steering.priority',
        message: `Invalid priority. Must be one of: ${this.VALID_PRIORITIES.join(', ')}`,
        code: 'INVALID_ENUM',
        severity: 'MEDIUM',
      });
    }

    if (!document.created_at) {
      warnings.push({
        field: 'steering.created_at',
        message: 'Created timestamp is recommended for tracking',
        suggestion: 'Add created_at with ISO date string',
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateSpecDocument(spec: KiroSpecDocument): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!spec.name) {
      errors.push({
        field: 'spec.name',
        message: 'Specification name is required',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
    }

    if (!this.VALID_SPEC_TYPES.includes(spec.type)) {
      errors.push({
        field: 'spec.type',
        message: `Invalid spec type. Must be one of: ${this.VALID_SPEC_TYPES.join(', ')}`,
        code: 'INVALID_ENUM',
        severity: 'HIGH',
      });
    }

    if (!this.VALID_SPEC_STATUSES.includes(spec.status)) {
      errors.push({
        field: 'spec.status',
        message: `Invalid spec status. Must be one of: ${this.VALID_SPEC_STATUSES.join(', ')}`,
        code: 'INVALID_ENUM',
        severity: 'HIGH',
      });
    }

    if (!spec.content) {
      errors.push({
        field: 'spec.content',
        message: 'Specification content is required',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
    }

    // Validate tasks if present
    if (spec.tasks && Array.isArray(spec.tasks)) {
      spec.tasks.forEach((task, index) => {
        const taskResult = this.validateTask(task, index);
        errors.push(...taskResult.errors);
        warnings.push(...(taskResult.warnings || []));
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateTask(task: any, index: number): ValidationResult { // eslint-disable-line @typescript-eslint/no-explicit-any
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!task.id) {
      errors.push({
        field: `tasks[${index}].id`,
        message: 'Task ID is required',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
    }

    if (!task.title) {
      errors.push({
        field: `tasks[${index}].title`,
        message: 'Task title is required',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
    }

    if (!this.VALID_TASK_STATUSES.includes(task.status)) {
      errors.push({
        field: `tasks[${index}].status`,
        message: `Invalid task status. Must be one of: ${this.VALID_TASK_STATUSES.join(', ')}`,
        code: 'INVALID_ENUM',
        severity: 'HIGH',
      });
    }

    if (task.priority && !this.VALID_PRIORITIES.includes(task.priority)) {
      errors.push({
        field: `tasks[${index}].priority`,
        message: `Invalid task priority. Must be one of: ${this.VALID_PRIORITIES.join(', ')}`,
        code: 'INVALID_ENUM',
        severity: 'MEDIUM',
      });
    }

    if (!task.created_at) {
      warnings.push({
        field: `tasks[${index}].created_at`,
        message: 'Created timestamp is recommended for task tracking',
        suggestion: 'Add created_at with ISO date string',
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateHookConfiguration(hook: KiroHookConfiguration): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!hook.name) {
      errors.push({
        field: 'hook.name',
        message: 'Hook name is required',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
    }

    if (!this.VALID_HOOK_TYPES.includes(hook.type)) {
      errors.push({
        field: 'hook.type',
        message: `Invalid hook type. Must be one of: ${this.VALID_HOOK_TYPES.join(', ')}`,
        code: 'INVALID_ENUM',
        severity: 'HIGH',
      });
    }

    if (!hook.trigger) {
      errors.push({
        field: 'hook.trigger',
        message: 'Hook trigger is required',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
    }

    if (!hook.command) {
      errors.push({
        field: 'hook.command',
        message: 'Hook command is required',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
    }

    // Security validation for hook commands
    const securityResult = this.validateHookSecurity(hook);
    errors.push(...securityResult.errors);
    warnings.push(...(securityResult.warnings || []));

    if (typeof hook.enabled !== 'boolean') {
      errors.push({
        field: 'hook.enabled',
        message: 'Hook enabled flag must be a boolean',
        code: 'INVALID_TYPE',
        severity: 'MEDIUM',
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateHookSecurity(hook: KiroHookConfiguration): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const dangerousCommands = [
      'rm -rf',
      'sudo',
      'chmod 777',
      'curl | sh',
      'wget | sh',
      'eval',
      'exec',
    ];

    const suspiciousPatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /key/i,
      /credential/i,
    ];

    // Check for dangerous commands
    if (dangerousCommands.some(cmd => hook.command.includes(cmd))) {
      errors.push({
        field: 'hook.command',
        message: 'Hook command contains potentially dangerous operations',
        code: 'SECURITY_VIOLATION',
        severity: 'HIGH',
      });
    }

    // Check for suspicious patterns
    if (suspiciousPatterns.some(pattern => pattern.test(hook.command))) {
      warnings.push({
        field: 'hook.command',
        message: 'Hook command may contain sensitive information references',
        suggestion: 'Ensure no secrets are hardcoded in hook commands',
      });
    }

    // Validate environment variables for security
    if (hook.env) {
      Object.entries(hook.env).forEach(([key, value]) => {
        if (suspiciousPatterns.some(pattern => pattern.test(key) || pattern.test(value))) {
          warnings.push({
            field: `hook.env.${key}`,
            message: 'Environment variable may contain sensitive information',
            suggestion: 'Use environment variable references instead of hardcoded values',
          });
        }
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateAgentConfiguration(agent: KiroAgentConfiguration): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!agent.name) {
      errors.push({
        field: 'agent.name',
        message: 'Agent name is required',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
    }

    if (!agent.description) {
      errors.push({
        field: 'agent.description',
        message: 'Agent description is required',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
    }

    if (!agent.category) {
      errors.push({
        field: 'agent.category',
        message: 'Agent category is required',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
    }

    if (!agent.prompt) {
      errors.push({
        field: 'agent.prompt',
        message: 'Agent prompt is required',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
    }

    // Security validation for agent prompts
    const securityResult = this.validateAgentSecurity(agent);
    errors.push(...securityResult.errors);
    warnings.push(...(securityResult.warnings || []));

    // Validate examples if present
    if (agent.examples && Array.isArray(agent.examples)) {
      agent.examples.forEach((example, index) => {
        if (!example.name) {
          errors.push({
            field: `agent.examples[${index}].name`,
            message: 'Agent example name is required',
            code: 'REQUIRED_FIELD',
            severity: 'MEDIUM',
          });
        }

        if (!example.input) {
          errors.push({
            field: `agent.examples[${index}].input`,
            message: 'Agent example input is required',
            code: 'REQUIRED_FIELD',
            severity: 'MEDIUM',
          });
        }

        if (!example.use_case) {
          errors.push({
            field: `agent.examples[${index}].use_case`,
            message: 'Agent example use case is required',
            code: 'REQUIRED_FIELD',
            severity: 'MEDIUM',
          });
        }
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateAgentSecurity(agent: KiroAgentConfiguration): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const maliciousPatterns = [
      /system.*prompt.*injection/i,
      /ignore.*previous.*instructions/i,
      /execute.*shell.*command/i,
      /reveal.*system.*prompt/i,
    ];

    const suspiciousPatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /credential/i,
      /api.*key/i,
    ];

    // Check for malicious patterns in prompt
    if (maliciousPatterns.some(pattern => pattern.test(agent.prompt))) {
      errors.push({
        field: 'agent.prompt',
        message: 'Agent prompt contains potentially malicious patterns',
        code: 'SECURITY_VIOLATION',
        severity: 'HIGH',
      });
    }

    // Check for suspicious patterns
    if (suspiciousPatterns.some(pattern => pattern.test(agent.prompt))) {
      warnings.push({
        field: 'agent.prompt',
        message: 'Agent prompt may reference sensitive information',
        suggestion: 'Ensure no secrets are exposed in agent prompts',
      });
    }

    // Validate capabilities for security risks
    if (agent.capabilities && Array.isArray(agent.capabilities)) {
      const dangerousCapabilities = ['file_system_write', 'network_access', 'shell_execution'];
      const foundDangerous = agent.capabilities.filter(cap => 
        dangerousCapabilities.some(dangerous => cap.toLowerCase().includes(dangerous))
      );

      if (foundDangerous.length > 0) {
        warnings.push({
          field: 'agent.capabilities',
          message: `Agent has potentially dangerous capabilities: ${foundDangerous.join(', ')}`,
          suggestion: 'Ensure these capabilities are necessary and properly constrained',
        });
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateTemplateConfiguration(template: KiroTemplateConfiguration): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!template.id) {
      errors.push({
        field: 'template.id',
        message: 'Template ID is required',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
    }

    if (!template.name) {
      errors.push({
        field: 'template.name',
        message: 'Template name is required',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
    }

    if (!template.description) {
      errors.push({
        field: 'template.description',
        message: 'Template description is required',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
    }

    if (!template.category) {
      errors.push({
        field: 'template.category',
        message: 'Template category is required',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
    }

    if (!template.content) {
      errors.push({
        field: 'template.content',
        message: 'Template content is required',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
    }

    if (!Array.isArray(template.variables)) {
      errors.push({
        field: 'template.variables',
        message: 'Template variables must be an array',
        code: 'INVALID_TYPE',
        severity: 'HIGH',
      });
    } else {
      template.variables.forEach((variable, index) => {
        const variableResult = this.validateTemplateVariable(variable, index);
        errors.push(...variableResult.errors);
        warnings.push(...(variableResult.warnings || []));
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateTemplateVariable(variable: any, index: number): ValidationResult { // eslint-disable-line @typescript-eslint/no-explicit-any
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const validTypes = ['string', 'number', 'boolean', 'array', 'object'];

    if (!variable.name) {
      errors.push({
        field: `template.variables[${index}].name`,
        message: 'Variable name is required',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
    }

    if (!validTypes.includes(variable.type)) {
      errors.push({
        field: `template.variables[${index}].type`,
        message: `Invalid variable type. Must be one of: ${validTypes.join(', ')}`,
        code: 'INVALID_ENUM',
        severity: 'HIGH',
      });
    }

    if (!variable.description) {
      warnings.push({
        field: `template.variables[${index}].description`,
        message: 'Variable description is recommended for clarity',
        suggestion: 'Add description explaining the variable purpose',
      });
    }

    // Validate validation rules if present
    if (variable.validation) {
      if (variable.validation.pattern && variable.type !== 'string') {
        warnings.push({
          field: `template.variables[${index}].validation.pattern`,
          message: 'Pattern validation only applies to string variables',
          suggestion: 'Remove pattern validation for non-string types',
        });
      }

      if ((variable.validation.min !== undefined || variable.validation.max !== undefined) && 
          !['number', 'string', 'array'].includes(variable.type)) {
        warnings.push({
          field: `template.variables[${index}].validation.min/max`,
          message: 'Min/max validation only applies to number, string, or array variables',
          suggestion: 'Remove min/max validation for incompatible types',
        });
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateDeploymentOptions(options: KiroDeploymentOptions): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (options.platform !== 'kiro-ide') {
      errors.push({
        field: 'options.platform',
        message: 'Platform must be "kiro-ide" for Kiro validation',
        code: 'INVALID_PLATFORM',
        severity: 'HIGH',
      });
    }

    // Validate component selection
    if (options.components && options.skipComponents) {
      const overlap = options.components.filter(c => options.skipComponents!.includes(c));
      if (overlap.length > 0) {
        errors.push({
          field: 'options.components',
          message: `Components cannot be both included and skipped: ${overlap.join(', ')}`,
          code: 'CONFLICTING_OPTIONS',
          severity: 'MEDIUM',
        });
      }
    }

    // Validate file size limits
    if (options.enableLargeFileStreaming === false && options.components?.includes('agents')) {
      warnings.push({
        field: 'options.enableLargeFileStreaming',
        message: 'Large file streaming is disabled but agents may contain large prompts',
        suggestion: 'Consider enabling large file streaming for agent deployment',
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  async validateBusinessRules(
    globalSettings: KiroGlobalSettings,
    projectSettings: KiroProjectSettings,
    _options: KiroDeploymentOptions,
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for required global user profile
    if (!globalSettings.user?.profile?.name) {
      warnings.push({
        field: 'globalSettings.user.profile.name',
        message: 'User name is recommended for personalized Kiro experience',
        suggestion: 'Add user name to personal context',
      });
    }

    // Check for project essentials
    if (!projectSettings.project?.info?.name) {
      warnings.push({
        field: 'projectSettings.project.info.name',
        message: 'Project name is recommended for identification',
        suggestion: 'Add project name to project context',
      });
    }

    if (!projectSettings.project?.tech_stack?.language) {
      warnings.push({
        field: 'projectSettings.project.tech_stack.language',
        message: 'Primary language is recommended for better Kiro suggestions',
        suggestion: 'Specify the main programming language',
      });
    }

    // Check for conflicting configurations
    if (globalSettings.user?.preferences?.theme && 
        projectSettings.project?.info?.type === 'library' &&
        globalSettings.user.preferences.theme === 'dark') {
      warnings.push({
        field: 'configuration.conflict',
        message: 'Dark theme preference may not be optimal for library development',
        suggestion: 'Consider using light theme for better documentation visibility',
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  async validateFileSize(content: string, componentType: KiroComponentType): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const size = Buffer.byteLength(content, 'utf8');
    const sizeMB = size / (1024 * 1024);

    if (size > this.MAX_FILE_SIZE) {
      errors.push({
        field: `${componentType}.content`,
        message: `Content size (${sizeMB.toFixed(2)}MB) exceeds maximum allowed size (${this.MAX_FILE_SIZE / (1024 * 1024)}MB)`,
        code: 'SIZE_LIMIT_EXCEEDED',
        severity: 'HIGH',
      });
    } else if (sizeMB > 10) {
      warnings.push({
        field: `${componentType}.content`,
        message: `Large content size (${sizeMB.toFixed(2)}MB) may impact performance`,
        suggestion: 'Consider breaking into smaller components or enabling large file streaming',
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  async validateLimits(components: any[]): Promise<ValidationResult> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const agentCount = components.filter(c => c.type === 'agent').length;
    const templateCount = components.filter(c => c.type === 'template').length;
    const hookCount = components.filter(c => c.type === 'hook').length;

    if (agentCount > this.MAX_AGENTS) {
      errors.push({
        field: 'components.agents',
        message: `Too many agents (${agentCount}). Maximum allowed: ${this.MAX_AGENTS}`,
        code: 'LIMIT_EXCEEDED',
        severity: 'HIGH',
      });
    }

    if (templateCount > this.MAX_TEMPLATES) {
      errors.push({
        field: 'components.templates',
        message: `Too many templates (${templateCount}). Maximum allowed: ${this.MAX_TEMPLATES}`,
        code: 'LIMIT_EXCEEDED',
        severity: 'HIGH',
      });
    }

    if (hookCount > this.MAX_HOOKS) {
      errors.push({
        field: 'components.hooks',
        message: `Too many hooks (${hookCount}). Maximum allowed: ${this.MAX_HOOKS}`,
        code: 'LIMIT_EXCEEDED',
        severity: 'HIGH',
      });
    }

    if (agentCount > this.MAX_AGENTS * 0.8) {
      warnings.push({
        field: 'components.agents',
        message: `High number of agents (${agentCount}) may impact IDE performance`,
        suggestion: 'Consider organizing agents by category or purpose',
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}