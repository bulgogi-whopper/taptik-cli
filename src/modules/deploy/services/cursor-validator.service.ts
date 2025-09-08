import { Injectable } from '@nestjs/common';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import { CursorComponentType } from '../interfaces/component-types.interface';
import {
  CursorValidationResult,
  CursorValidationError,
  CursorValidationWarning,
} from '../interfaces/cursor-config.interface';

/**
 * CursorValidatorService
 * 
 * Validates Taptik context for Cursor IDE deployment compatibility.
 * Performs comprehensive validation including basic structure, compatibility,
 * AI settings, file sizes, and security checks.
 */
@Injectable()
export class CursorValidatorService {
  /**
   * Main validation method that orchestrates all validation checks
   * @param context - The Taptik context to validate
   * @returns Promise<CursorValidationResult> - Comprehensive validation result
   */
  async validate(context: TaptikContext): Promise<CursorValidationResult> {
    const errors: CursorValidationError[] = [];
    const warnings: CursorValidationWarning[] = [];
    const supportedComponents: CursorComponentType[] = [];

    try {
      // 1. Basic structure validation
      await this.validateBasicStructure(context, errors, warnings);

      // 2. Cursor compatibility validation
      await this.validateCursorCompatibility(context, errors, warnings);

      // 3. AI settings validation
      await this.validateAISettings(context, errors, warnings);

      // 4. File sizes validation
      await this.validateFileSizes(context, errors, warnings);

      // 5. Security validation
      await this.validateSecurity(context, errors, warnings);

      // Determine supported components based on available data
      supportedComponents.push(...this.determineSupportedComponents(context));

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        supportedComponents,
      };
    } catch (error) {
      errors.push({
        code: 'VALIDATION_SYSTEM_ERROR',
        message: `Validation system error: ${error.message}`,
        severity: 'error',
      });

      return {
        isValid: false,
        errors,
        warnings,
        supportedComponents: [],
      };
    }
  }

  /**
   * Validates basic structure requirements for Cursor deployment
   * @param context - The Taptik context to validate
   * @param errors - Array to collect validation errors
   * @param warnings - Array to collect validation warnings
   */
  private async validateBasicStructure(
    context: TaptikContext,
    errors: CursorValidationError[],
    warnings: CursorValidationWarning[],
  ): Promise<void> {
    // Check if context exists
    if (!context) {
      errors.push({
        code: 'MISSING_CONTEXT',
        message: 'Taptik context is required for Cursor IDE deployment',
        severity: 'error',
      });
      return;
    }

    // Check if metadata exists
    if (!context.metadata) {
      errors.push({
        code: 'MISSING_METADATA',
        message: 'Context metadata is required',
        severity: 'error',
      });
    } else {
      // Validate version information
      if (!context.metadata.version) {
        warnings.push({
          code: 'MISSING_VERSION',
          message: 'Context version is missing, using default compatibility mode',
          severity: 'warning',
        });
      } else {
        // Check version compatibility
        const {version} = context.metadata;
        const majorVersion = parseInt(version.split('.')[0], 10);
        
        if (isNaN(majorVersion)) {
          warnings.push({
            code: 'INVALID_VERSION_FORMAT',
            message: `Invalid version format: ${version}. Expected semantic version (e.g., 1.0.0)`,
            severity: 'warning',
          });
        } else if (majorVersion > 2) {
          warnings.push({
            code: 'FUTURE_VERSION',
            message: `Context version ${version} is newer than supported. Some features may not work correctly`,
            severity: 'warning',
          });
        }
      }

      // Validate source IDE
      if (!context.metadata.sourceIde) {
        warnings.push({
          code: 'MISSING_SOURCE_IDE',
          message: 'Source IDE information is missing',
          severity: 'warning',
        });
      }

      // Check if target IDEs include cursor-ide
      if (context.metadata.targetIdes && !context.metadata.targetIdes.includes('cursor-ide')) {
        warnings.push({
          code: 'CURSOR_NOT_TARGET',
          message: 'Cursor IDE is not listed as a target IDE. Deployment may have limited compatibility',
          severity: 'warning',
        });
      }
    }

    // Check if content exists
    if (!context.content) {
      errors.push({
        code: 'MISSING_CONTENT',
        message: 'Context content is required',
        severity: 'error',
      });
      return;
    }

    // Check if at least one content section exists
    const hasPersonal = context.content.personal && Object.keys(context.content.personal).length > 0;
    const hasProject = context.content.project && Object.keys(context.content.project).length > 0;
    const hasPrompts = context.content.prompts && Object.keys(context.content.prompts).length > 0;
    const hasTools = context.content.tools && Object.keys(context.content.tools).length > 0;
    const hasIde = context.content.ide && Object.keys(context.content.ide).length > 0;

    if (!hasPersonal && !hasProject && !hasPrompts && !hasTools && !hasIde) {
      errors.push({
        code: 'EMPTY_CONTENT',
        message: 'Context content is empty. At least one content section (personal, project, prompts, tools, or ide) is required',
        severity: 'error',
      });
    }

    // Validate security information
    if (!context.security) {
      warnings.push({
        code: 'MISSING_SECURITY_INFO',
        message: 'Security information is missing. Security scan may be incomplete',
        severity: 'warning',
      });
    } else {
      // Check if security scan was performed
      if (!context.security.scanResults) {
        warnings.push({
          code: 'MISSING_SECURITY_SCAN',
          message: 'Security scan results are missing',
          severity: 'warning',
        });
      } else if (!context.security.scanResults.passed) {
        warnings.push({
          code: 'SECURITY_SCAN_FAILED',
          message: 'Security scan failed. Review security warnings before deployment',
          severity: 'warning',
        });
      }

      // Check for filtered sensitive data
      if (context.security.hasApiKeys) {
        warnings.push({
          code: 'API_KEYS_DETECTED',
          message: 'API keys or secrets were detected and filtered. Verify configuration completeness after deployment',
          severity: 'warning',
        });
      }
    }

    // Validate file size if available
    if (context.metadata.fileSize) {
      const fileSizeMB = context.metadata.fileSize / (1024 * 1024);
      
      if (fileSizeMB > 100) {
        warnings.push({
          code: 'LARGE_CONFIGURATION',
          message: `Configuration file is large (${fileSizeMB.toFixed(2)}MB). Deployment may take longer`,
          severity: 'warning',
        });
      }
      
      if (fileSizeMB > 500) {
        errors.push({
          code: 'CONFIGURATION_TOO_LARGE',
          message: `Configuration file is too large (${fileSizeMB.toFixed(2)}MB). Maximum supported size is 500MB`,
          severity: 'error',
        });
      }
    }
  }

  /**
   * Validates Cursor IDE specific compatibility requirements
   * @param context - The Taptik context to validate
   * @param errors - Array to collect validation errors
   * @param warnings - Array to collect validation warnings
   */
  private async validateCursorCompatibility(
    context: TaptikContext,
    errors: CursorValidationError[],
    warnings: CursorValidationWarning[],
  ): Promise<void> {
    // Validate AI settings compatibility
    if (context.content.personal?.preferences) {
      const prefs = context.content.personal.preferences;
      
      // Check AI temperature range
      if (prefs.temperature !== undefined) {
        const temp = typeof prefs.temperature === 'string' ? parseFloat(prefs.temperature) : prefs.temperature;
        if (isNaN(temp) || temp < 0 || temp > 2) {
          errors.push({
            code: 'INVALID_AI_TEMPERATURE',
            message: `AI temperature must be between 0 and 2, got: ${prefs.temperature}`,
            component: 'ai-prompts',
            field: 'personal.preferences.temperature',
            severity: 'error',
          });
        }
      }
    }

    // Validate project AI settings
    if (context.content.project?.tech_stack) {
      const techStack = context.content.project.tech_stack;
      
      // Check for unsupported languages that might cause issues
      const unsupportedLanguages = ['cobol', 'fortran', 'assembly'];
      if (techStack.languages) {
        const problematicLangs = techStack.languages.filter(lang => 
          unsupportedLanguages.includes(lang.toLowerCase())
        );
        
        if (problematicLangs.length > 0) {
          warnings.push({
            code: 'UNSUPPORTED_LANGUAGES',
            message: `Some languages may have limited Cursor IDE support: ${problematicLangs.join(', ')}`,
            component: 'settings',
            field: 'project.tech_stack.languages',
            severity: 'warning',
          });
        }
      }
    }

    // Validate extensions compatibility
    const extensions = this.extractExtensions(context);
    if (extensions.length > 0) {
      const incompatibleExtensions = this.getIncompatibleExtensions(extensions);
      
      if (incompatibleExtensions.length > 0) {
        warnings.push({
          code: 'INCOMPATIBLE_EXTENSIONS',
          message: `Some extensions may not be compatible with Cursor IDE: ${incompatibleExtensions.join(', ')}`,
          component: 'extensions',
          severity: 'warning',
        });
      }

      // Check for too many extensions
      if (extensions.length > 100) {
        warnings.push({
          code: 'TOO_MANY_EXTENSIONS',
          message: `Large number of extensions (${extensions.length}) may impact Cursor IDE performance. Consider reducing to essential extensions`,
          component: 'extensions',
          severity: 'warning',
        });
      }
    }

    // Validate IDE-specific settings
    const cursorIdeSettings = context.content.ide?.['cursor-ide'];
    const claudeCodeSettings = context.content.ide?.['claude-code'] || context.content.ide?.claudeCode;
    
    if (cursorIdeSettings) {
      // Validate existing Cursor IDE settings structure
      if (cursorIdeSettings.settings && typeof cursorIdeSettings.settings !== 'object') {
        errors.push({
          code: 'INVALID_CURSOR_SETTINGS_FORMAT',
          message: 'Cursor IDE settings must be an object',
          component: 'settings',
          field: 'ide.cursor-ide.settings',
          severity: 'error',
        });
      }
    }

    if (claudeCodeSettings) {
      // Check for Claude Code specific features that need special handling
      if (claudeCodeSettings.mcp_config) {
        warnings.push({
          code: 'MCP_CONFIG_CONVERSION',
          message: 'MCP configurations from Claude Code will be adapted for Cursor IDE compatibility',
          component: 'settings',
          severity: 'warning',
        });
      }
    }

    // Validate workspace constraints
    if (context.content.project?.constraints) {
      const {constraints} = context.content.project;
      
      // Check performance requirements
      if (constraints.performance_requirements) {
        const perfReq = constraints.performance_requirements.toLowerCase();
        if (perfReq.includes('real-time') || perfReq.includes('low-latency')) {
          warnings.push({
            code: 'PERFORMANCE_REQUIREMENTS',
            message: 'High performance requirements detected. Consider optimizing Cursor AI settings for better responsiveness',
            component: 'settings',
            severity: 'warning',
          });
        }
      }

      // Check security level
      if (constraints.security_level) {
        const secLevel = constraints.security_level.toLowerCase();
        if (secLevel.includes('high') || secLevel.includes('enterprise')) {
          warnings.push({
            code: 'HIGH_SECURITY_REQUIREMENTS',
            message: 'High security requirements detected. Review AI data sharing settings in Cursor IDE',
            component: 'settings',
            severity: 'warning',
          });
        }
      }
    }

    // Validate file patterns and exclusions
    if (context.content.project?.conventions?.folder_structure) {
      const folderStructure = context.content.project.conventions.folder_structure;
      
      // Check for deeply nested structures that might cause issues
      const maxDepth = this.calculateMaxFolderDepth(folderStructure);
      if (maxDepth > 10) {
        warnings.push({
          code: 'DEEP_FOLDER_STRUCTURE',
          message: `Very deep folder structure detected (${maxDepth} levels). This may impact Cursor IDE file indexing performance`,
          component: 'settings',
          severity: 'warning',
        });
      }
    }
  }

  /**
   * Validates AI settings and configurations
   * @param context - The Taptik context to validate
   * @param errors - Array to collect validation errors
   * @param warnings - Array to collect validation warnings
   */
  private async validateAISettings(
    context: TaptikContext,
    errors: CursorValidationError[],
    warnings: CursorValidationWarning[],
  ): Promise<void> {
    // Validate AI prompts
    if (context.content.prompts) {
      // Check system prompts
      if (context.content.prompts.system_prompts) {
        const systemPrompts = context.content.prompts.system_prompts;
        
        if (Array.isArray(systemPrompts)) {
          systemPrompts.forEach((prompt, index) => {
            if (!prompt.content) {
              errors.push({
                code: 'EMPTY_SYSTEM_PROMPT',
                message: `System prompt at index ${index} has no content`,
                component: 'ai-prompts',
                field: `prompts.system_prompts[${index}].content`,
                severity: 'error',
              });
            } else if (prompt.content.length > 50000) {
              warnings.push({
                code: 'LARGE_SYSTEM_PROMPT',
                message: `System prompt '${prompt.name || index}' is very large (${prompt.content.length} chars). This may affect Cursor AI performance`,
                component: 'ai-prompts',
                field: `prompts.system_prompts[${index}].content`,
                severity: 'warning',
              });
            }

            // Check for potentially problematic content
            if (prompt.content.includes('<?php') || prompt.content.includes('<%')) {
              warnings.push({
                code: 'TEMPLATE_CODE_IN_PROMPT',
                message: `System prompt '${prompt.name || index}' contains template code that may not work well with Cursor AI`,
                component: 'ai-prompts',
                severity: 'warning',
              });
            }
          });
        }
      }

      // Check prompt templates
      if (context.content.prompts.templates) {
        const {templates} = context.content.prompts;
        
        if (Array.isArray(templates)) {
          templates.forEach((template, index) => {
            if (!template.template) {
              errors.push({
                code: 'EMPTY_PROMPT_TEMPLATE',
                message: `Prompt template at index ${index} has no template content`,
                component: 'ai-prompts',
                field: `prompts.templates[${index}].template`,
                severity: 'error',
              });
            }

            // Check for undefined variables
            if (template.template && template.variables) {
              const templateVars = template.template.match(/{{(\w+)}}/g) || [];
              const definedVars = template.variables || [];
              
              templateVars.forEach(varMatch => {
                const varName = varMatch.replace(/[{}]/g, '');
                if (!definedVars.includes(varName)) {
                  warnings.push({
                    code: 'UNDEFINED_TEMPLATE_VARIABLE',
                    message: `Template '${template.name || index}' uses undefined variable: ${varName}`,
                    component: 'ai-prompts',
                    severity: 'warning',
                  });
                }
              });
            }
          });
        }
      }
    }

    // Validate AI context settings from project
    if (context.content.project) {
      // Check for AI context file patterns
      const {project} = context.content;
      
      if (project.tech_stack?.languages) {
        const {languages} = project.tech_stack;
        const totalLanguages = languages.length;
        
        if (totalLanguages > 10) {
          warnings.push({
            code: 'TOO_MANY_LANGUAGES',
            message: `Project uses many languages (${totalLanguages}). This may overwhelm Cursor AI context. Consider focusing on primary languages`,
            component: 'ai-prompts',
            severity: 'warning',
          });
        }
      }

      // Check architecture complexity
      if (project.architecture?.pattern) {
        const pattern = project.architecture.pattern.toLowerCase();
        const complexPatterns = ['microservices', 'event-sourcing', 'cqrs', 'hexagonal'];
        
        if (complexPatterns.some(p => pattern.includes(p))) {
          warnings.push({
            code: 'COMPLEX_ARCHITECTURE',
            message: `Complex architecture pattern detected (${project.architecture.pattern}). Consider providing detailed architectural prompts for better AI assistance`,
            component: 'ai-prompts',
            severity: 'warning',
          });
        }
      }
    }

    // Validate personal AI preferences
    if (context.content.personal?.preferences) {
      const prefs = context.content.personal.preferences;
      
      // Check explanation level
      if (prefs.explanation_level && !['beginner', 'intermediate', 'expert'].includes(prefs.explanation_level)) {
        warnings.push({
          code: 'INVALID_EXPLANATION_LEVEL',
          message: `Invalid explanation level: ${prefs.explanation_level}. Should be 'beginner', 'intermediate', or 'expert'`,
          component: 'ai-prompts',
          severity: 'warning',
        });
      }
    }
  }

  /**
   * Validates file sizes and limits
   * @param context - The Taptik context to validate
   * @param errors - Array to collect validation errors
   * @param warnings - Array to collect validation warnings
   */
  private async validateFileSizes(
    context: TaptikContext,
    errors: CursorValidationError[],
    warnings: CursorValidationWarning[],
  ): Promise<void> {
    // Validate overall context size
    const contextSize = this.estimateContextSize(context);
    const contextSizeMB = contextSize / (1024 * 1024);

    if (contextSizeMB > 100) {
      warnings.push({
        code: 'LARGE_CONTEXT_SIZE',
        message: `Context size is large (${contextSizeMB.toFixed(2)}MB). This may impact Cursor IDE performance`,
        severity: 'warning',
      });
    }

    if (contextSizeMB > 1000) {
      errors.push({
        code: 'CONTEXT_TOO_LARGE',
        message: `Context size exceeds maximum limit (${contextSizeMB.toFixed(2)}MB). Maximum supported size is 1GB`,
        severity: 'error',
      });
    }

    // Validate individual prompt sizes
    if (context.content.prompts?.system_prompts) {
      const systemPrompts = context.content.prompts.system_prompts;
      
      if (Array.isArray(systemPrompts)) {
        systemPrompts.forEach((prompt, index) => {
          if (prompt.content) {
            const promptSize = new Blob([prompt.content]).size;
            const promptSizeKB = promptSize / 1024;
            
            if (promptSizeKB > 100) {
              warnings.push({
                code: 'LARGE_PROMPT_SIZE',
                message: `System prompt '${prompt.name || index}' is large (${promptSizeKB.toFixed(2)}KB). Consider breaking into smaller prompts`,
                component: 'ai-prompts',
                severity: 'warning',
              });
            }
          }
        });
      }
    }

    // Validate AI context file limits
    const estimatedContextFiles = this.estimateAIContextFiles(context);
    
    if (estimatedContextFiles > 1000) {
      warnings.push({
        code: 'TOO_MANY_CONTEXT_FILES',
        message: `Estimated AI context includes many files (${estimatedContextFiles}). This may slow down Cursor AI responses`,
        component: 'ai-prompts',
        severity: 'warning',
      });
    }

    if (estimatedContextFiles > 5000) {
      errors.push({
        code: 'CONTEXT_FILES_LIMIT_EXCEEDED',
        message: `Too many files for AI context (${estimatedContextFiles}). Maximum recommended is 5000 files`,
        component: 'ai-prompts',
        severity: 'error',
      });
    }

    // Validate extension data size
    const extensions = this.extractExtensions(context);
    if (extensions.length > 0) {
      const extensionDataSize = this.estimateExtensionDataSize(extensions);
      const extensionSizeMB = extensionDataSize / (1024 * 1024);
      
      if (extensionSizeMB > 50) {
        warnings.push({
          code: 'LARGE_EXTENSION_DATA',
          message: `Extension configuration is large (${extensionSizeMB.toFixed(2)}MB). This may slow down Cursor IDE startup`,
          component: 'extensions',
          severity: 'warning',
        });
      }
    }

    // Validate IDE-specific settings size
    if (context.content.ide) {
      const ideDataSize = this.estimateObjectSize(context.content.ide);
      const ideDataSizeMB = ideDataSize / (1024 * 1024);
      
      if (ideDataSizeMB > 10) {
        warnings.push({
          code: 'LARGE_IDE_SETTINGS',
          message: `IDE settings are large (${ideDataSizeMB.toFixed(2)}MB). Consider removing unused configurations`,
          component: 'settings',
          severity: 'warning',
        });
      }
    }
  }

  /**
   * Validates security aspects of the configuration
   * @param context - The Taptik context to validate
   * @param errors - Array to collect validation errors
   * @param warnings - Array to collect validation warnings
   */
  private async validateSecurity(
    context: TaptikContext,
    errors: CursorValidationError[],
    warnings: CursorValidationWarning[],
  ): Promise<void> {
    // Check security scan results
    if (context.security?.scanResults) {
      const {scanResults} = context.security;
      
      if (!scanResults.passed) {
        if (scanResults.errors && scanResults.errors.length > 0) {
          scanResults.errors.forEach(error => {
            errors.push({
              code: 'SECURITY_SCAN_ERROR',
              message: `Security scan failed: ${error}`,
              severity: 'error',
            });
          });
        }
        
        if (scanResults.warnings && scanResults.warnings.length > 0) {
          scanResults.warnings.forEach(warning => {
            warnings.push({
              code: 'SECURITY_SCAN_WARNING',
              message: `Security warning: ${warning}`,
              severity: 'warning',
            });
          });
        }
      }
    }

    // Check for sensitive data patterns
    await this.scanForSensitivePatterns(context, errors, warnings);

    // Validate AI prompt security
    await this.validateAIPromptSecurity(context, errors, warnings);

    // Validate tool and command security
    await this.validateToolSecurity(context, errors, warnings);

    // Check for potentially malicious content
    await this.scanForMaliciousPatterns(context, errors, warnings);

    // Validate file path security
    await this.validateFilePathSecurity(context, errors, warnings);
  }

  /**
   * Determines which Cursor components are supported based on available data
   * @param context - The Taptik context to analyze
   * @returns Array of supported Cursor component types
   */
  private determineSupportedComponents(context: TaptikContext): CursorComponentType[] {
    const components: CursorComponentType[] = [];

    // Check for settings data
    if (context.content.personal?.preferences || context.content.project?.info) {
      components.push('settings');
    }

    // Check for extensions data
    if (context.content.ide?.['cursor-ide']?.extensions || 
        context.content.ide?.claudeCode?.extensions ||
        context.content.ide?.['claude-code']?.extensions) {
      components.push('extensions');
    }

    // Check for AI prompts data
    if (context.content.prompts?.system_prompts || 
        context.content.prompts?.templates ||
        context.content.project?.architecture) {
      components.push('ai-prompts');
    }

    // Check for tools/commands that can be converted to tasks
    if (context.content.tools?.custom_tools || 
        context.content.tools?.commands) {
      components.push('tasks');
    }

    // Snippets are typically generated from project conventions
    if (context.content.project?.conventions) {
      components.push('snippets');
    }

    // Launch configurations can be derived from project tech stack
    if (context.content.project?.tech_stack) {
      components.push('launch');
    }

    return components;
  }

  /**
   * Extracts extension list from various sources in the context
   * @param context - The Taptik context
   * @returns Array of extension identifiers
   */
  private extractExtensions(context: TaptikContext): string[] {
    const extensions: string[] = [];

    // From Cursor IDE settings
    if (context.content.ide?.['cursor-ide']?.extensions) {
      extensions.push(...context.content.ide['cursor-ide'].extensions);
    }

    // From Claude Code settings
    if (context.content.ide?.['claude-code']?.extensions) {
      extensions.push(...context.content.ide['claude-code'].extensions);
    }

    if (context.content.ide?.claudeCode?.extensions) {
      extensions.push(...context.content.ide.claudeCode.extensions);
    }

    // Remove duplicates
    return [...new Set(extensions)];
  }

  /**
   * Identifies extensions that are known to be incompatible with Cursor IDE
   * @param extensions - Array of extension identifiers
   * @returns Array of incompatible extension identifiers
   */
  private getIncompatibleExtensions(extensions: string[]): string[] {
    const incompatibleExtensions = [
      'ms-vscode.vscode-typescript-next', // Cursor has built-in TypeScript support
      'github.copilot', // Cursor has built-in AI
      'github.copilot-chat', // Cursor has built-in AI chat
      'tabnine.tabnine-vscode', // Conflicts with Cursor AI
      'visualstudioexptteam.vscodeintellicode', // Conflicts with Cursor AI
      'ms-python.pylance', // May conflict with Cursor's Python support
      'ms-toolsai.jupyter', // Cursor has different notebook support
    ];

    return extensions.filter(ext => 
      incompatibleExtensions.some(incompatible => 
        ext.toLowerCase().includes(incompatible.toLowerCase())
      )
    );
  }

  /**
   * Calculates the maximum folder depth from a folder structure description
   * @param folderStructure - Description of folder structure
   * @returns Maximum depth level
   */
  private calculateMaxFolderDepth(folderStructure: string): number {
    if (!folderStructure || typeof folderStructure !== 'string') {
      return 0;
    }

    // Simple heuristic: count forward slashes and backslashes
    const forwardSlashes = (folderStructure.match(/\//g) || []).length;
    const backSlashes = (folderStructure.match(/\\/g) || []).length;
    const maxSlashes = Math.max(forwardSlashes, backSlashes);

    // Add 1 because depth is one more than separator count
    return maxSlashes + 1;
  }

  /**
   * Estimates the total size of the context in bytes
   * @param context - The Taptik context
   * @returns Estimated size in bytes
   */
  private estimateContextSize(context: TaptikContext): number {
    try {
      const jsonString = JSON.stringify(context);
      return new Blob([jsonString]).size;
    } catch (_error) {
      // Fallback estimation
      return JSON.stringify(context).length * 2; // Rough UTF-8 estimation
    }
  }

  /**
   * Estimates the size of an object in bytes
   * @param obj - The object to measure
   * @returns Estimated size in bytes
   */
  private estimateObjectSize(obj: unknown): number {
    try {
      const jsonString = JSON.stringify(obj);
      return new Blob([jsonString]).size;
    } catch (_error) {
      return JSON.stringify(obj).length * 2;
    }
  }

  /**
   * Estimates the number of files that would be included in AI context
   * @param context - The Taptik context
   * @returns Estimated number of files
   */
  private estimateAIContextFiles(context: TaptikContext): number {
    let fileCount = 0;

    // Count from project tech stack
    if (context.content.project?.tech_stack?.languages) {
      const {languages} = context.content.project.tech_stack;
      // Rough estimation: 50 files per language on average
      fileCount += languages.length * 50;
    }

    // Count from project type
    if (context.content.project?.info?.type) {
      const projectType = context.content.project.info.type.toLowerCase();
      
      // Different project types have different typical file counts
      const typeMultipliers: Record<string, number> = {
        'web': 200,
        'mobile': 150,
        'desktop': 100,
        'library': 50,
        'microservice': 75,
        'monolith': 500,
      };
      
      const multiplier = typeMultipliers[projectType] || 100;
      fileCount = Math.max(fileCount, multiplier);
    }

    // Add files from tools and configurations
    if (context.content.tools?.custom_tools) {
      fileCount += context.content.tools.custom_tools.length * 2; // Config files
    }

    return fileCount;
  }

  /**
   * Estimates the data size for extensions
   * @param extensions - Array of extension identifiers
   * @returns Estimated size in bytes
   */
  private estimateExtensionDataSize(extensions: string[]): number {
    // Rough estimation: each extension adds about 1KB of configuration
    return extensions.length * 1024;
  }

  /**
   * Scans for sensitive data patterns in the context
   * @param context - The Taptik context
   * @param errors - Array to collect validation errors
   * @param warnings - Array to collect validation warnings
   */
  private async scanForSensitivePatterns(
    context: TaptikContext,
    errors: CursorValidationError[],
    warnings: CursorValidationWarning[],
  ): Promise<void> {
    const sensitivePatterns = [
      { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["']?([\w-]{20,})["']?/gi, name: 'API Key' },
      { pattern: /(?:secret[_-]?key|secretkey)\s*[:=]\s*["']?([\w-]{20,})["']?/gi, name: 'Secret Key' },
      { pattern: /(?:password|pwd)\s*[:=]\s*["']?([^\s"']{8,})["']?/gi, name: 'Password' },
      { pattern: /token\s*[:=]\s*["']?([\w-]{20,})["']?/gi, name: 'Token' },
      { pattern: /(?:private[_-]?key|privatekey)\s*[:=]\s*["']?([\w-]{20,})["']?/gi, name: 'Private Key' },
      { pattern: /-{5}begin\s+(?:rsa\s+)?private\s+key-{5}/gi, name: 'Private Key Block' },
      { pattern: /(?:database[_-]?url|db[_-]?url)\s*[:=]\s*["']?([^\s"']+)["']?/gi, name: 'Database URL' },
    ];

    const contextString = JSON.stringify(context);
    
    sensitivePatterns.forEach(({ pattern, name }) => {
      const matches = contextString.match(pattern);
      if (matches && matches.length > 0) {
        warnings.push({
          code: 'SENSITIVE_DATA_DETECTED',
          message: `Potential ${name} detected in configuration. Ensure sensitive data is properly filtered before deployment`,
          severity: 'warning',
        });
      }
    });

    // Check if sensitive data was already filtered
    if (context.security?.hasApiKeys) {
      warnings.push({
        code: 'FILTERED_SENSITIVE_DATA',
        message: 'Sensitive data was detected and filtered. Verify configuration completeness after deployment',
        severity: 'warning',
      });
    }

    // Check filtered fields
    if (context.security?.filteredFields && context.security.filteredFields.length > 0) {
      warnings.push({
        code: 'FIELDS_FILTERED',
        message: `${context.security.filteredFields.length} fields were filtered for security: ${context.security.filteredFields.slice(0, 3).join(', ')}${context.security.filteredFields.length > 3 ? '...' : ''}`,
        severity: 'warning',
      });
    }
  }

  /**
   * Validates AI prompt content for security issues
   * @param context - The Taptik context
   * @param errors - Array to collect validation errors
   * @param warnings - Array to collect validation warnings
   */
  private async validateAIPromptSecurity(
    context: TaptikContext,
    errors: CursorValidationError[],
    warnings: CursorValidationWarning[],
  ): Promise<void> {
    if (!context.content.prompts) return;

    const maliciousPatterns = [
      { pattern: /(?:ignore|forget|disregard)\s+(?:previous|all|above)\s+(?:instructions|prompts|rules)/gi, name: 'Prompt Injection' },
      { pattern: /(?:system|admin|root)\s+(?:override|bypass|disable)/gi, name: 'System Override' },
      { pattern: /(?:execute|run|eval)\s*\(/gi, name: 'Code Execution' },
      { pattern: /<script[^>]*>.*?<\/script>/gi, name: 'Script Tag' },
      { pattern: /javascript\s*:/gi, name: 'JavaScript Protocol' },
    ];

    // Check system prompts
    if (context.content.prompts.system_prompts && Array.isArray(context.content.prompts.system_prompts)) {
      context.content.prompts.system_prompts.forEach((prompt, index) => {
        if (prompt.content) {
          maliciousPatterns.forEach(({ pattern, name }) => {
            if (pattern.test(prompt.content)) {
              warnings.push({
                code: 'SUSPICIOUS_PROMPT_CONTENT',
                message: `System prompt '${prompt.name || index}' contains potentially suspicious content (${name})`,
                component: 'ai-prompts',
                severity: 'warning',
              });
            }
          });
        }
      });
    }

    // Check prompt templates
    if (context.content.prompts.templates && Array.isArray(context.content.prompts.templates)) {
      context.content.prompts.templates.forEach((template, index) => {
        if (template.template) {
          maliciousPatterns.forEach(({ pattern, name }) => {
            if (pattern.test(template.template)) {
              warnings.push({
                code: 'SUSPICIOUS_TEMPLATE_CONTENT',
                message: `Prompt template '${template.name || index}' contains potentially suspicious content (${name})`,
                component: 'ai-prompts',
                severity: 'warning',
              });
            }
          });
        }
      });
    }
  }

  /**
   * Validates tool and command security
   * @param context - The Taptik context
   * @param errors - Array to collect validation errors
   * @param warnings - Array to collect validation warnings
   */
  private async validateToolSecurity(
    context: TaptikContext,
    errors: CursorValidationError[],
    warnings: CursorValidationWarning[],
  ): Promise<void> {
    if (!context.content.tools) return;

    const dangerousCommands = [
      'rm', 'del', 'format', 'fdisk', 'mkfs',
      'sudo', 'su', 'chmod', 'chown',
      'curl', 'wget', 'nc', 'netcat',
      'eval', 'exec', 'system',
    ];

    // Check custom tools
    if (context.content.tools.custom_tools && Array.isArray(context.content.tools.custom_tools)) {
      context.content.tools.custom_tools.forEach((tool, index) => {
        if (tool.command) {
          const commandParts = tool.command.toLowerCase().split(/\s+/);
          const baseCommand = commandParts[0];
          
          if (dangerousCommands.includes(baseCommand)) {
            warnings.push({
              code: 'DANGEROUS_COMMAND',
              message: `Custom tool '${tool.name || index}' uses potentially dangerous command: ${baseCommand}`,
              component: 'tasks',
              severity: 'warning',
            });
          }

          // Check for shell injection patterns
          if (tool.command.includes('$(') || tool.command.includes('`') || tool.command.includes('|')) {
            warnings.push({
              code: 'SHELL_INJECTION_RISK',
              message: `Custom tool '${tool.name || index}' contains shell metacharacters that could be exploited`,
              component: 'tasks',
              severity: 'warning',
            });
          }
        }
      });
    }

    // Check Claude Code commands
    if (context.content.tools.commands && Array.isArray(context.content.tools.commands)) {
      context.content.tools.commands.forEach((command, index) => {
        if (command.content) {
          // Check for dangerous patterns in command content
          if (command.content.includes('rm -rf') || command.content.includes('del /f')) {
            errors.push({
              code: 'DESTRUCTIVE_COMMAND',
              message: `Command '${command.name || index}' contains destructive operations`,
              component: 'tasks',
              severity: 'error',
            });
          }
        }

        // Check permissions
        if (command.permissions && Array.isArray(command.permissions)) {
          const dangerousPermissions = ['file_system_write', 'network_access', 'system_commands'];
          const hasDangerousPerms = command.permissions.some(perm => 
            dangerousPermissions.includes(perm)
          );
          
          if (hasDangerousPerms) {
            warnings.push({
              code: 'ELEVATED_PERMISSIONS',
              message: `Command '${command.name || index}' requests elevated permissions: ${command.permissions.join(', ')}`,
              component: 'tasks',
              severity: 'warning',
            });
          }
        }
      });
    }
  }

  /**
   * Scans for malicious patterns in the entire context
   * @param context - The Taptik context
   * @param errors - Array to collect validation errors
   * @param warnings - Array to collect validation warnings
   */
  private async scanForMaliciousPatterns(
    context: TaptikContext,
    errors: CursorValidationError[],
    warnings: CursorValidationWarning[],
  ): Promise<void> {
    const contextString = JSON.stringify(context);
    
    const maliciousPatterns = [
      { pattern: /(?:powershell|cmd)\.exe/gi, name: 'System Shell' },
      { pattern: /(?:base64|atob|btoa)\s*\(/gi, name: 'Base64 Encoding' },
      { pattern: /(?:document\.write|innerhtml|outerhtml)\s*=/gi, name: 'DOM Manipulation' },
      { pattern: /(?:fetch|xmlhttprequest|axios)\s*\(/gi, name: 'Network Request' },
      { pattern: /localstorage|sessionstorage|indexeddb/gi, name: 'Browser Storage' },
    ];

    maliciousPatterns.forEach(({ pattern, name }) => {
      const matches = contextString.match(pattern);
      if (matches && matches.length > 0) {
        warnings.push({
          code: 'SUSPICIOUS_PATTERN_DETECTED',
          message: `Potentially suspicious pattern detected (${name}). Review configuration for security implications`,
          severity: 'warning',
        });
      }
    });
  }

  /**
   * Validates file paths for security issues
   * @param context - The Taptik context
   * @param errors - Array to collect validation errors
   * @param warnings - Array to collect validation warnings
   */
  private async validateFilePathSecurity(
    context: TaptikContext,
    errors: CursorValidationError[],
    warnings: CursorValidationWarning[],
  ): Promise<void> {
    const contextString = JSON.stringify(context);
    
    // Check for path traversal patterns
    const pathTraversalPatterns = [
      /\.\.\/\.\.\//g,
      new RegExp('\\.\\.\\\\\\.\\.\\\\\\\\/', 'g'),
      /%2e%2e%2f/gi,
      /%2e%2e%5c/gi,
    ];

    pathTraversalPatterns.forEach(pattern => {
      if (pattern.test(contextString)) {
        warnings.push({
          code: 'PATH_TRAVERSAL_DETECTED',
          message: 'Potential path traversal patterns detected in configuration',
          severity: 'warning',
        });
      }
    });

    // Check for absolute paths that might be problematic
    const absolutePathPattern = /C:\\|\/(?:etc|usr|var|root|home)\//g;
    const matches = contextString.match(absolutePathPattern);
    
    if (matches && matches.length > 0) {
      warnings.push({
        code: 'ABSOLUTE_PATHS_DETECTED',
        message: 'Absolute file paths detected. These may not work correctly on different systems',
        severity: 'warning',
      });
    }
  }
}