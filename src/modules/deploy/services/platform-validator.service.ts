import { Injectable } from '@nestjs/common';

import {
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '../../context/dto/validation-result.dto';
import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import {
  AgentConfig,
  CommandConfig,
  ClaudeCodeSettings,
} from '../interfaces/platform-config.interface';

@Injectable()
export class PlatformValidatorService {
  private readonly SUPPORTED_PLATFORMS = {
    'claude-code': true,
    'kiro-ide': false, // Phase 2
    'cursor-ide': false, // Phase 2
  };

  async validateForPlatform(
    context: TaptikContext,
    platform: string,
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

    const ide = context.content.ide as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    // Validate agents if present
    if (ide?.agents && Array.isArray(ide.agents)) {
      const agentErrors = this.validateAgents(ide.agents);
      errors.push(...agentErrors.errors);
      warnings.push(...(agentErrors.warnings || []));
    }

    // Validate commands if present
    if (ide?.commands && Array.isArray(ide.commands)) {
      const commandErrors = this.validateCommands(ide.commands);
      errors.push(...commandErrors.errors);
      warnings.push(...(commandErrors.warnings || []));
    }

    // Validate settings if present
    if (ide?.settings) {
      const settingsErrors = this.validateSettings(ide.settings);
      errors.push(...settingsErrors.errors);
      warnings.push(...(settingsErrors.warnings || []));
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
}
