import { Injectable, Logger } from '@nestjs/common';

import { plainToClass } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

import {
  TaptikContext,
  PersonalContext,
  ProjectContext,
  PromptContext,
  ToolContext,
  IdeContext,
  AIPlatform,
  ValidationResult,
  ValidationIssue,
  isPersonalContext,
  isProjectContext,
  isPromptContext,
  isToolContext,
  isIdeContext,
} from '../interfaces';

interface ValidationRule {
  name: string;
  validate: (context: any) => ValidationIssue | null;
}

@Injectable()
export class ContextValidatorService {
  private readonly logger = new Logger(ContextValidatorService.name);
  private readonly requiredFields: ValidationRule[] = [
    {
      name: 'version',
      validate: (context) => {
        if (!context.version) {
          return {
            path: 'version',
            message: 'Version is required',
          };
        }
        if (typeof context.version !== 'string') {
          return {
            path: 'version',
            message: 'Version must be a string',
          };
        }
        // Validate semver format
        const semverRegex = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;
        if (!semverRegex.test(context.version)) {
          return {
            path: 'version',
            message: 'Version must follow semantic versioning (e.g., 1.0.0)',
          };
        }
        return null;
      },
    },
    {
      name: 'metadata',
      validate: (context) => {
        if (!context.metadata) {
          return {
            path: 'metadata',
            message: 'Metadata is required',
          };
        }
        if (typeof context.metadata !== 'object') {
          return {
            path: 'metadata',
            message: 'Metadata must be an object',
          };
        }
        return null;
      },
    },
    {
      name: 'metadata.name',
      validate: (context) => {
        if (!context.metadata?.name) {
          return {
            path: 'metadata.name',
            message: 'Context name is required',
          };
        }
        if (typeof context.metadata.name !== 'string') {
          return {
            path: 'metadata.name',
            message: 'Context name must be a string',
          };
        }
        if (context.metadata.name.length < 3) {
          return {
            path: 'metadata.name',
            message: 'Context name must be at least 3 characters long',
          };
        }
        return null;
      },
    },
    {
      name: 'metadata.created_at',
      validate: (context) => {
        if (!context.metadata?.created_at) {
          return {
            path: 'metadata.created_at',
            message: 'Creation timestamp is required',
          };
        }
        // Validate ISO 8601 format
        const date = new Date(context.metadata.created_at);
        if (Number.isNaN(date.getTime())) {
          return {
            path: 'metadata.created_at',
            message: 'Creation timestamp must be a valid ISO 8601 date',
          };
        }
        return null;
      },
    },
  ];

  private readonly platformRules: Map<AIPlatform, ValidationRule[]> = new Map([
    [
      AIPlatform.KIRO,
      [
        {
          name: 'kiro-specs',
          validate: (context) => {
            if (context.project?.data?.kiro_specs) {
              const specs = context.project.data.kiro_specs;
              if (!Array.isArray(specs)) {
                return {
                  path: 'project.data.kiro_specs',
                  message: 'Kiro specs must be an array',
                };
              }
            }
            return null;
          },
        },
      ],
    ],
    [
      AIPlatform.CLAUDE_CODE,
      [
        {
          name: 'claude-instructions',
          validate: (context) => {
            if (context.project?.data?.claude_instructions) {
              const instructions = context.project.data.claude_instructions;
              if (typeof instructions !== 'string') {
                return {
                  path: 'project.data.claude_instructions',
                  message: 'Claude instructions must be a string',
                };
              }
            }
            return null;
          },
        },
      ],
    ],
  ]);

  /**
   * Validate a TaptikContext
   */
  async validateContext(context: TaptikContext): Promise<ValidationResult> {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    // Validate required fields
    for (const rule of this.requiredFields) {
      const issue = rule.validate(context);
      if (issue) {
        errors.push(issue);
      }
    }

    // Validate context categories
    const categories = ['personal', 'project', 'prompts', 'tools', 'ide'];
    const presentCategories = categories.filter((cat) => context[cat]);

    if (presentCategories.length === 0) {
      warnings.push({
        path: 'context',
        message:
          'No context categories found. At least one category is recommended.',
        suggestion: 'Add personal, project, prompts, tools, or ide context',
      });
    }

    // Validate each category
    if (context.personal) {
      const issues = await this.validatePersonalContext(context.personal);
      errors.push(...issues.errors);
      warnings.push(...issues.warnings);
    }

    if (context.project) {
      const issues = await this.validateProjectContext(context.project);
      errors.push(...issues.errors);
      warnings.push(...issues.warnings);
    }

    if (context.prompts) {
      const issues = await this.validatePromptContext(context.prompts);
      errors.push(...issues.errors);
      warnings.push(...issues.warnings);
    }

    if (context.tools) {
      const issues = await this.validateToolContext(context.tools);
      errors.push(...issues.errors);
      warnings.push(...issues.warnings);
    }

    if (context.ide) {
      const issues = await this.validateIdeContext(context.ide);
      errors.push(...issues.errors);
      warnings.push(...issues.warnings);
    }

    // Platform-specific validation
    if (context.metadata?.platforms) {
      for (const platform of context.metadata.platforms) {
        const platformRules = this.platformRules.get(platform);
        if (platformRules) {
          for (const rule of platformRules) {
            const issue = rule.validate(context);
            if (issue) {
              warnings.push(issue);
            }
          }
        }
      }
    }

    // Check for compatibility issues
    const compatibilityIssues = this.checkCompatibility(context);
    warnings.push(...compatibilityIssues);

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Validate a PersonalContext
   */
  private async validatePersonalContext(
    context: PersonalContext,
  ): Promise<{ errors: ValidationIssue[]; warnings: ValidationIssue[] }> {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    if (!isPersonalContext(context)) {
      errors.push({
        path: 'personal',
        message: 'Invalid personal context structure',
      });
      return { errors, warnings };
    }

    if (!context.spec_version) {
      errors.push({
        path: 'personal.spec_version',
        message: 'Spec version is required for personal context',
      });
    }

    // Check for recommended fields
    if (!context.data?.developer_profile) {
      warnings.push({
        path: 'personal.data.developer_profile',
        message: 'Developer profile is recommended for personal context',
        suggestion: 'Add experience_years, primary_role, specializations',
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate a ProjectContext
   */
  private async validateProjectContext(
    context: ProjectContext,
  ): Promise<{ errors: ValidationIssue[]; warnings: ValidationIssue[] }> {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    if (!isProjectContext(context)) {
      errors.push({
        path: 'project',
        message: 'Invalid project context structure',
      });
      return { errors, warnings };
    }

    if (!context.spec_version) {
      errors.push({
        path: 'project.spec_version',
        message: 'Spec version is required for project context',
      });
    }

    // Check for recommended fields
    if (!context.data?.project_name) {
      warnings.push({
        path: 'project.data.project_name',
        message: 'Project name is recommended',
      });
    }

    if (!context.data?.tech_stack) {
      warnings.push({
        path: 'project.data.tech_stack',
        message: 'Tech stack information is recommended',
        suggestion: 'Add languages, frameworks, databases, tools',
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate a PromptContext
   */
  private async validatePromptContext(
    context: PromptContext,
  ): Promise<{ errors: ValidationIssue[]; warnings: ValidationIssue[] }> {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    if (!isPromptContext(context)) {
      errors.push({
        path: 'prompts',
        message: 'Invalid prompts context structure',
      });
      return { errors, warnings };
    }

    if (!context.spec_version) {
      errors.push({
        path: 'prompts.spec_version',
        message: 'Spec version is required for prompts context',
      });
    }

    // Validate prompt arrays
    if (
      context.data?.system_prompts &&
      !Array.isArray(context.data.system_prompts)
    ) {
      errors.push({
        path: 'prompts.data.system_prompts',
        message: 'System prompts must be an array',
      });
    }

    if (
      context.data?.custom_instructions &&
      !Array.isArray(context.data.custom_instructions)
    ) {
      errors.push({
        path: 'prompts.data.custom_instructions',
        message: 'Custom instructions must be an array',
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate a ToolContext
   */
  private async validateToolContext(
    context: ToolContext,
  ): Promise<{ errors: ValidationIssue[]; warnings: ValidationIssue[] }> {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    if (!isToolContext(context)) {
      errors.push({
        path: 'tools',
        message: 'Invalid tools context structure',
      });
      return { errors, warnings };
    }

    if (!context.spec_version) {
      errors.push({
        path: 'tools.spec_version',
        message: 'Spec version is required for tools context',
      });
    }

    // Validate MCP servers
    if (context.data?.mcp_servers) {
      if (!Array.isArray(context.data.mcp_servers)) {
        errors.push({
          path: 'tools.data.mcp_servers',
          message: 'MCP servers must be an array',
        });
      } else {
        context.data.mcp_servers.forEach((server, index) => {
          if (!server.name) {
            errors.push({
              path: `tools.data.mcp_servers[${index}].name`,
              message: 'MCP server name is required',
            });
          }
          if (!server.config) {
            warnings.push({
              path: `tools.data.mcp_servers[${index}].config`,
              message: 'MCP server configuration is recommended',
            });
          }
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate an IdeContext
   */
  private async validateIdeContext(
    context: IdeContext,
  ): Promise<{ errors: ValidationIssue[]; warnings: ValidationIssue[] }> {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    if (!isIdeContext(context)) {
      errors.push({
        path: 'ide',
        message: 'Invalid IDE context structure',
      });
      return { errors, warnings };
    }

    if (!context.spec_version) {
      errors.push({
        path: 'ide.spec_version',
        message: 'Spec version is required for IDE context',
      });
    }

    return { errors, warnings };
  }

  /**
   * Check for compatibility issues between platforms
   */
  private checkCompatibility(context: TaptikContext): ValidationIssue[] {
    const warnings: ValidationIssue[] = [];

    if (
      !context.metadata?.platforms ||
      context.metadata.platforms.length === 0
    ) {
      warnings.push({
        path: 'metadata.platforms',
        message: 'No target platforms specified',
        suggestion: 'Add target platforms to metadata.platforms array',
      });
      return warnings;
    }

    // Check for platform-specific features that may not be compatible
    const { platforms } = context.metadata;

    if (
      platforms.includes(AIPlatform.KIRO) &&
      platforms.includes(AIPlatform.CLAUDE_CODE)
    ) {
      // Check for Kiro-specific features
      if (context.project?.data?.kiro_specs) {
        warnings.push({
          path: 'project.data.kiro_specs',
          message: 'Kiro specs may not be fully compatible with Claude Code',
          suggestion: 'Consider using universal project documentation format',
        });
      }

      // Check for Claude-specific features
      if (context.project?.data?.claude_instructions) {
        warnings.push({
          path: 'project.data.claude_instructions',
          message: 'Claude instructions may not be fully compatible with Kiro',
          suggestion: 'Consider using universal prompt format',
        });
      }
    }

    return warnings;
  }

  /**
   * Validate using class-validator decorators
   */
  async validateWithDecorators<T extends object>(
    targetClass: new () => T,
    object: any,
  ): Promise<ValidationError[]> {
    const instance = plainToClass(targetClass, object);
    return validate(instance);
  }

  /**
   * Check if a context is compatible with a specific platform
   */
  isPlatformCompatible(context: TaptikContext, platform: AIPlatform): boolean {
    if (!context.metadata?.platforms) {
      return false;
    }
    return context.metadata.platforms.includes(platform);
  }

  /**
   * Get validation schema for a specific platform
   */
  getPlatformSchema(platform: AIPlatform): any {
    // This could return JSON Schema or other schema definitions
    // For now, returning a simple structure
    return {
      platform,
      requiredFields: ['version', 'metadata', 'metadata.name'],
      optionalFields: ['personal', 'project', 'prompts', 'tools', 'ide'],
      platformSpecific:
        this.platformRules.get(platform)?.map((r) => r.name) || [],
    };
  }

  /**
   * Validate a context object
   */
  async validate(context: TaptikContext): Promise<ValidationResult> {
    try {
      const errors: ValidationIssue[] = [];
      const warnings: ValidationIssue[] = [];

      // Check required fields
      for (const rule of this.requiredFields) {
        const issue = rule.validate(context);
        if (issue) {
          errors.push(issue);
        }
      }

      // Validate metadata if present
      if (context.metadata) {
        const metadataIssues = await this.validateMetadata(context.metadata);
        // Separate errors and warnings based on object structure
        const metadataErrors = metadataIssues.filter(
          (issue) => 'code' in issue,
        );
        const metadataWarnings = metadataIssues.filter(
          (issue) => 'suggestion' in issue,
        );

        errors.push(...metadataErrors);
        warnings.push(...metadataWarnings);
      }

      // Validate each context section
      if (
        context.personal && // Basic validation for personal context
        (!context.personal.category || context.personal.category !== 'personal')
      ) {
        errors.push({
          path: 'personal.category',
          message: 'Personal context must have category set to "personal"',
        });
      }

      if (
        context.project && // Basic validation for project context
        (!context.project.category || context.project.category !== 'project')
      ) {
        errors.push({
          path: 'project.category',
          message: 'Project context must have category set to "project"',
        });
      }

      // Check for platform-specific requirements
      if (context.metadata?.platforms) {
        for (const platform of context.metadata.platforms) {
          const platformRules = this.platformRules.get(platform) || [];
          for (const rule of platformRules) {
            const issue = rule.validate(context);
            if (issue) {
              // Check if it's an error (has 'code' property) or warning (has 'suggestion' property)
              if ('code' in issue) {
                errors.push(issue);
              } else {
                warnings.push(issue);
              }
            }
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      this.logger.error(`Validation failed: ${error.message}`);
      return {
        valid: false,
        errors: [
          {
            path: 'context',
            message: `Validation error: ${error.message}`,
          },
        ],
      };
    }
  }

  /**
   * Validate metadata section
   */
  private async validateMetadata(metadata: any): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    if (!metadata.name || typeof metadata.name !== 'string') {
      issues.push({
        path: 'metadata.name',
        message: 'Context name is required and must be a string',
        code: 'MISSING_NAME',
      });
    }

    if (metadata.created && typeof metadata.created !== 'string') {
      issues.push({
        path: 'metadata.created',
        message: 'Created timestamp must be a string',
        suggestion: 'Use ISO 8601 date format',
      });
    }

    return issues;
  }
}
