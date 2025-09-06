import { Injectable } from '@nestjs/common';

import {
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '../../context/dto/validation-result.dto';
import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import { DeployOptions } from '../interfaces/deploy-options.interface';
import { KiroDeploymentOptions } from '../interfaces/kiro-deployment.interface';
import {
  AgentConfig,
  CommandConfig,
  ClaudeCodeSettings,
} from '../interfaces/platform-config.interface';

import { KiroValidatorService } from './kiro-validator.service';

@Injectable()
export class PlatformValidatorService {
  constructor(private readonly kiroValidator: KiroValidatorService) {}
  private readonly SUPPORTED_PLATFORMS = {
    'claude-code': true,
    'kiro-ide': true,
    'cursor-ide': true, // Task 7.1: Enable Cursor IDE support
  };

  async validateForPlatform(
    context: TaptikContext,
    platform: string,
    options?: DeployOptions | KiroDeploymentOptions,
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check if platform is known
    if (!(platform in this.SUPPORTED_PLATFORMS)) {
      errors.push({
        field: 'platform',
        message: `Platform '${platform}' is not recognized`,
        code: 'PLATFORM_UNSUPPORTED',
        severity: 'HIGH',
      });

      return {
        isValid: false,
        errors,
        warnings,
      };
    }

    // Check if platform is supported in current phase
    if (
      !this.SUPPORTED_PLATFORMS[
        platform as keyof typeof this.SUPPORTED_PLATFORMS
      ]
    ) {
      warnings.push({
        field: 'platform',
        message: `Platform '${platform}' is not yet supported. Only 'claude-code' is currently available.`,
        suggestion: 'Use --platform claude-code for now',
      });

      errors.push({
        field: 'platform',
        message: `Platform '${platform}' support is planned for Phase 2`,
        code: 'PLATFORM_NOT_IMPLEMENTED',
        severity: 'HIGH',
      });

      return {
        isValid: false,
        errors,
        warnings,
      };
    }

    // Check platform compatibility from metadata
    if (
      context.metadata?.targetIdes &&
      !context.metadata.targetIdes.includes(platform)
    ) {
      errors.push({
        field: 'metadata.targetIdes',
        message: `Configuration is not compatible with '${platform}'. Compatible platforms: ${context.metadata.targetIdes.join(', ')}`,
        code: 'PLATFORM_INCOMPATIBLE',
        severity: 'HIGH',
      });
    }

    // Platform-specific validation
    if (platform === 'claude-code') {
      const claudeResult = await this.validateClaudeCode(context);
      errors.push(...claudeResult.errors);
      warnings.push(...(claudeResult.warnings || []));
    } else if (platform === 'kiro-ide') {
      const kiroOptions = options as KiroDeploymentOptions;
      if (kiroOptions) {
        const kiroResult = await this.kiroValidator.validateForKiro(
          context,
          kiroOptions,
        );
        errors.push(...kiroResult.errors);
        warnings.push(...(kiroResult.warnings || []));
      }
    } else if (platform === 'cursor-ide') {
      // Task 7.1: Add Cursor IDE validation
      const cursorResult = await this.validateCursor(context);
      errors.push(...cursorResult.errors);
      warnings.push(...(cursorResult.warnings || []));
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async validateClaudeCode(context: TaptikContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const { tools } = context.content;

    // Validate agents if present (from tools context or ide context)
    const agentsFromTools =
      tools?.agents && Array.isArray(tools.agents) ? tools.agents : [];
    const allAgents = [...agentsFromTools];

    if (allAgents.length > 0) {
      const adaptedAgents = allAgents.map((agent) => ({
        name: agent.name,
        description:
          (agent.metadata?.description as string) || '',
        content: agent.content,
        metadata: {
          version: (agent.metadata?.version as string) || '1.0.0',
          author: (agent.metadata?.author as string) || '',
          tags: (agent.metadata?.tags as string[]) || [],
          created: agent.metadata?.created as Date,
          updated: agent.metadata?.updated as Date,
        },
      }));

      const agentErrors = this.validateAgents(adaptedAgents);
      errors.push(...agentErrors.errors);
      warnings.push(...(agentErrors.warnings || []));
    }

    // Validate commands if present (from tools context or ide context)
    const commandsFromTools =
      tools?.commands && Array.isArray(tools.commands) ? tools.commands : [];
    const allCommands = [...commandsFromTools];

    if (allCommands.length > 0) {
      const adaptedCommands = allCommands.map((command) => ({
        name: command.name,
        description:
          (command.metadata?.description as string) ||
          '',
        content: command.content,
        permissions: command.permissions || [],
        metadata: {
          version: (command.metadata?.version as string) || '1.0.0',
          author: (command.metadata?.author as string) || '',
          created: command.metadata?.created as Date,
          updated: command.metadata?.updated as Date,
        },
      }));

      const commandErrors = this.validateCommands(adaptedCommands);
      errors.push(...commandErrors.errors);
      warnings.push(...(commandErrors.warnings || []));
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async checkPlatformSupport(platform: string): Promise<boolean> {
    return (
      this.SUPPORTED_PLATFORMS[
        platform as keyof typeof this.SUPPORTED_PLATFORMS
      ] === true
    );
  }

  private validateAgents(agents: AgentConfig[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    agents.forEach((agent, index) => {
      if (!agent.name) {
        errors.push({
          field: `agents[${index}].name`,
          message: 'Agent name is required',
          code: 'REQUIRED_FIELD',
          severity: 'HIGH',
        });
      }

      if (!agent.content) {
        errors.push({
          field: `agents[${index}].content`,
          message: 'Agent content is required',
          code: 'REQUIRED_FIELD',
          severity: 'HIGH',
        });
      }

      if (!agent.metadata?.version) {
        warnings.push({
          field: `agents[${index}].metadata.version`,
          message: 'Agent version is recommended for tracking',
          suggestion: 'Add version like "1.0.0"',
        });
      }
    });

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateCommands(commands: CommandConfig[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    commands.forEach((command, index) => {
      if (!command.name) {
        errors.push({
          field: `commands[${index}].name`,
          message: 'Command name is required',
          code: 'REQUIRED_FIELD',
          severity: 'HIGH',
        });
      }

      if (!command.content) {
        errors.push({
          field: `commands[${index}].content`,
          message: 'Command content is required',
          code: 'REQUIRED_FIELD',
          severity: 'HIGH',
        });
      }

      // Validate permissions format
      if (command.permissions && Array.isArray(command.permissions)) {
        command.permissions.forEach((permission, pIndex) => {
          if (!this.isValidPermissionFormat(permission)) {
            errors.push({
              field: `commands[${index}].permissions[${pIndex}]`,
              message: `Invalid permission format: ${permission}. Expected format: Tool(pattern)`,
              code: 'INVALID_PERMISSION_FORMAT',
              severity: 'MEDIUM',
            });
          }
        });
      }

      if (!command.metadata?.version) {
        warnings.push({
          field: `commands[${index}].metadata.version`,
          message: 'Command version is recommended for tracking',
          suggestion: 'Add version like "1.0.0"',
        });
      }
    });

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateSettings(settings: ClaudeCodeSettings): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate permissions structure
    if (settings.permissions) {
      if (
        settings.permissions.allow &&
        !Array.isArray(settings.permissions.allow)
      ) {
        errors.push({
          field: 'settings.permissions.allow',
          message: 'Permissions allow list must be an array',
          code: 'INVALID_TYPE',
          severity: 'HIGH',
        });
      }

      if (
        settings.permissions.deny &&
        !Array.isArray(settings.permissions.deny)
      ) {
        errors.push({
          field: 'settings.permissions.deny',
          message: 'Permissions deny list must be an array',
          code: 'INVALID_TYPE',
          severity: 'HIGH',
        });
      }

      // Validate defaultMode if present
      const validModes = ['acceptEdits', 'askFirst', 'deny'];
      if (
        settings.permissions.defaultMode &&
        !validModes.includes(settings.permissions.defaultMode)
      ) {
        errors.push({
          field: 'settings.permissions.defaultMode',
          message: `Invalid defaultMode. Must be one of: ${validModes.join(', ')}`,
          code: 'INVALID_ENUM',
          severity: 'MEDIUM',
        });
      }
    }

    // Validate statusLine if present
    if (settings.statusLine) {
      if (
        settings.statusLine.type &&
        !['command', 'text'].includes(settings.statusLine.type)
      ) {
        errors.push({
          field: 'settings.statusLine.type',
          message: 'StatusLine type must be "command" or "text"',
          code: 'INVALID_ENUM',
          severity: 'MEDIUM',
        });
      }

      if (
        settings.statusLine.type === 'command' &&
        !settings.statusLine.command
      ) {
        errors.push({
          field: 'settings.statusLine.command',
          message: 'Command is required when statusLine type is "command"',
          code: 'REQUIRED_FIELD',
          severity: 'MEDIUM',
        });
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private isValidPermissionFormat(permission: string): boolean {
    // Check for format: Tool(pattern)
    return /^[A-Z_a-z]+\(.+\)$/.test(permission);
  }

  /**
   * Task 7.1: Validate Cursor IDE configuration
   */
  async validateCursor(context: TaptikContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic context validation
    if (!context.content) {
      errors.push({
        field: 'context.content',
        message: 'Context content is required for Cursor IDE deployment',
        code: 'REQUIRED_FIELD',
        severity: 'HIGH',
      });
      return { isValid: false, errors, warnings };
    }

    // Validate AI configuration if present
    if (context.content.ai) {
      const aiValidation = this.validateCursorAIConfig(context.content.ai);
      errors.push(...aiValidation.errors);
      warnings.push(...(aiValidation.warnings || []));
    }

    // Validate IDE-specific settings
    if (context.content.ide?.cursorIDE) {
      const ideValidation = this.validateCursorIDESettings(context.content.ide.cursorIDE);
      errors.push(...ideValidation.errors);
      warnings.push(...(ideValidation.warnings || []));
    }

    // Validate project context for workspace settings
    if (context.content.project) {
      const projectValidation = this.validateCursorProjectSettings(context.content.project);
      errors.push(...projectValidation.errors);
      warnings.push(...(projectValidation.warnings || []));
    }

    // Add Cursor-specific warnings
    warnings.push({
      field: 'platform',
      message: 'Cursor IDE support includes AI configuration, extensions, snippets, and workspace settings',
      suggestion: 'Ensure your context includes relevant AI rules and project settings for optimal Cursor integration',
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateCursorAIConfig(aiConfig: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for AI rules
    if (aiConfig.rules && Array.isArray(aiConfig.rules)) {
      for (const rule of aiConfig.rules) {
        if (typeof rule !== 'string' || rule.trim().length === 0) {
          errors.push({
            field: 'ai.rules',
            message: 'AI rules must be non-empty strings',
            code: 'INVALID_TYPE',
            severity: 'MEDIUM',
          });
        }
      }

      // Check for overly long rules
      const longRules = aiConfig.rules.filter((rule: string) => rule.length > 1000);
      if (longRules.length > 0) {
        warnings.push({
          field: 'ai.rules',
          message: `${longRules.length} AI rules exceed 1000 characters`,
          suggestion: 'Consider breaking down long rules into smaller, more specific ones',
        });
      }
    }

    // Check for AI context
    if (aiConfig.context && typeof aiConfig.context !== 'string') {
      errors.push({
        field: 'ai.context',
        message: 'AI context must be a string',
        code: 'INVALID_TYPE',
        severity: 'MEDIUM',
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateCursorIDESettings(settings: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate editor settings
    if (settings.editor) {
      if (settings.editor.fontSize && (typeof settings.editor.fontSize !== 'number' || settings.editor.fontSize < 8 || settings.editor.fontSize > 72)) {
        errors.push({
          field: 'ide.cursorIDE.editor.fontSize',
          message: 'Font size must be a number between 8 and 72',
          code: 'INVALID_RANGE',
          severity: 'MEDIUM',
        });
      }

      if (settings.editor.tabSize && (typeof settings.editor.tabSize !== 'number' || settings.editor.tabSize < 1 || settings.editor.tabSize > 8)) {
        errors.push({
          field: 'ide.cursorIDE.editor.tabSize',
          message: 'Tab size must be a number between 1 and 8',
          code: 'INVALID_RANGE',
          severity: 'MEDIUM',
        });
      }
    }

    // Validate extensions if present
    if (settings.extensions && !Array.isArray(settings.extensions)) {
      errors.push({
        field: 'ide.cursorIDE.extensions',
        message: 'Extensions must be an array',
        code: 'INVALID_TYPE',
        severity: 'MEDIUM',
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateCursorProjectSettings(projectSettings: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate debug configuration
    if (projectSettings.debug && Array.isArray(projectSettings.debug)) {
      for (const config of projectSettings.debug) {
        if (!config.name || typeof config.name !== 'string') {
          errors.push({
            field: 'project.debug.name',
            message: 'Debug configuration name is required and must be a string',
            code: 'REQUIRED_FIELD',
            severity: 'MEDIUM',
          });
        }

        if (!config.type || typeof config.type !== 'string') {
          errors.push({
            field: 'project.debug.type',
            message: 'Debug configuration type is required and must be a string',
            code: 'REQUIRED_FIELD',
            severity: 'MEDIUM',
          });
        }
      }
    }

    // Validate tasks configuration
    if (projectSettings.tasks && Array.isArray(projectSettings.tasks)) {
      for (const task of projectSettings.tasks) {
        if (!task.label || typeof task.label !== 'string') {
          errors.push({
            field: 'project.tasks.label',
            message: 'Task label is required and must be a string',
            code: 'REQUIRED_FIELD',
            severity: 'MEDIUM',
          });
        }

        if (!task.command || typeof task.command !== 'string') {
          errors.push({
            field: 'project.tasks.command',
            message: 'Task command is required and must be a string',
            code: 'REQUIRED_FIELD',
            severity: 'MEDIUM',
          });
        }
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}
