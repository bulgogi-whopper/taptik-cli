import { Injectable, Logger } from '@nestjs/common';

import { TaptikContext, PersonalContext, ProjectContext } from '../../context/interfaces/taptik-context.interface';
import {
  CursorGlobalSettings,
  CursorProjectSettings,
  CursorAIConfig,
  CursorAIRule,
  CursorAIContext,
  CursorAIPrompt,
} from '../interfaces/cursor-config.interface';
import {
  CursorExtensionsConfig,
  CursorDebugConfig,
  CursorTasksConfig,
  CursorSnippetsConfig,
  CursorWorkspaceConfig,
} from '../interfaces';
import { CursorDeploymentResult } from '../interfaces/cursor-deployment.interface';
import { CursorContentValidatorService } from './cursor-content-validator.service';

export interface CursorTransformationResult {
  globalSettings?: CursorGlobalSettings;
  projectSettings?: CursorProjectSettings;
  aiConfig?: CursorAIConfig;
  extensionsConfig?: CursorExtensionsConfig;
  debugConfig?: CursorDebugConfig;
  tasksConfig?: CursorTasksConfig;
  snippetsConfig?: CursorSnippetsConfig;
  workspaceConfig?: CursorWorkspaceConfig;
  warnings: CursorTransformationWarning[];
  statistics: CursorTransformationStatistics;
  transformationLog: CursorTransformationLogEntry[];
}

export interface CursorTransformationWarning {
  type: 'mapping' | 'validation' | 'security' | 'compatibility';
  message: string;
  source: string;
  suggestion: string;
  impact: 'low' | 'medium' | 'high';
}

export interface CursorTransformationStatistics {
  transformedComponents: number;
  mappingsApplied: number;
  warningsCount: number;
  errors: number;
  transformationTime: number;
  contentSize: {
    original: number;
    transformed: number;
    compressionRatio: number;
  };
}

export interface CursorTransformationLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  component: string;
  message: string;
  details?: any;
}

export interface CursorTransformationOptions {
  preserveComments?: boolean;
  optimizeForSize?: boolean;
  strictMapping?: boolean;
  targetCursorVersion?: string;
  securityScan?: boolean;
}

@Injectable()
export class CursorTransformerService {
  private readonly logger = new Logger(CursorTransformerService.name);

  constructor(
    private readonly contentValidator: CursorContentValidatorService
  ) {}

  /**
   * Transform TaptikContext to complete Cursor configuration set
   */
  async transformContext(
    context: TaptikContext,
    options: CursorTransformationOptions = {}
  ): Promise<CursorTransformationResult> {
    const startTime = Date.now();
    const result = this.initializeTransformationResult();

    this.addLogEntry(result, 'info', 'transform', 'Starting context transformation', {
      sourceIde: context.metadata?.sourceIde || 'unknown',
      version: context.metadata?.version || 'unknown'
    });

    try {
      // Transform different sections
      if (context.content.personal) {
        result.globalSettings = this.transformPersonalContext(context);
        result.statistics.transformedComponents++;
      }

      if (context.content.project) {
        result.projectSettings = this.transformProjectContext(context);
        result.statistics.transformedComponents++;
      }

      if (context.content.prompts) {
        result.aiConfig = this.transformAIContent(context);
        result.statistics.transformedComponents++;
      }

      if (context.content.tools) {
        result.extensionsConfig = this.transformExtensions(context);
        const { debug, tasks } = this.transformDebugTasks(context);
        result.debugConfig = debug;
        result.tasksConfig = tasks;
        result.statistics.transformedComponents += 2;
      }

      const { snippets, workspace } = this.transformSnippetsWorkspace(context);
      result.snippetsConfig = snippets;
      result.workspaceConfig = workspace;
      result.statistics.transformedComponents++;

      this.finalizeStatistics(result, startTime);
      this.addLogEntry(result, 'info', 'transform', 'Context transformation completed');

    } catch (error) {
      result.statistics.errors++;
      this.addLogEntry(result, 'error', 'transform', `Transformation failed: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Transform personal context to Cursor global settings
   */
  transformPersonalContext(context: TaptikContext): CursorGlobalSettings {
    const personal = context.content.personal || {};

    const settings: CursorGlobalSettings = {
      editor: {
        theme: personal.preferences?.theme || 'dark',
        fontSize: personal.preferences?.fontSize || 14,
        fontFamily: 'Consolas, monospace',
        tabSize: 2,
        insertSpaces: true,
        autoSave: 'afterDelay',
        formatOnSave: true,
      },
      workbench: {
        colorTheme: personal.preferences?.theme || 'dark',
        iconTheme: 'vscode-icons',
        startupEditor: 'welcomePage',
      },
      files: {
        autoSave: 'afterDelay',
        autoSaveDelay: 1000,
        exclude: {
          '**/.git': true,
          '**/.DS_Store': true,
          '**/node_modules': true,
        },
      },
      terminal: {
        integrated: {
          shell: {
            osx: '/bin/zsh',
            linux: '/bin/bash',
            windows: 'powershell.exe',
          },
        },
      },
    };

    return settings;
  }

  /**
   * Transform project context to Cursor project settings
   */
  transformProjectContext(context: TaptikContext): CursorProjectSettings {
    const project = context.content.project || {};

    const settings: CursorProjectSettings = {
      folders: [],
      search: {
        exclude: {
          '**/node_modules': true,
          '**/dist': true,
          '**/build': true,
        },
      },
      files: {
        associations: {},
        exclude: {
          '**/node_modules': true,
          '**/.git': true,
          '**/dist': true,
        },
      },
      emmet: {
        includeLanguages: {
          javascript: 'javascriptreact',
          typescript: 'typescriptreact',
        },
      },
      typescript: {
        preferences: {
          includePackageJsonAutoImports: 'on',
          importModuleSpecifier: 'relative',
          quoteStyle: 'single',
        },
        suggest: {
          enabled: true,
          autoImports: true,
          completeFunctionCalls: true,
        },
        format: {
          enable: true,
          semicolons: 'insert',
        },
      },
      javascript: {
        preferences: {
          quoteStyle: 'single',
        },
        format: {
          semicolons: 'insert',
        },
      },
    };

    return settings;
  }

  /**
   * Transform AI content to Cursor AI configuration
   */
  transformAIContent(context: TaptikContext): CursorAIConfig {
    const prompts = context.content.prompts || {};

    const aiConfig: CursorAIConfig = {
      rules: [],
      contextFiles: [],
      prompts: [],
    };

    // Transform system prompts to rules
    if (prompts.system_prompts && Array.isArray(prompts.system_prompts)) {
      prompts.system_prompts.forEach(prompt => {
        aiConfig.rules.push({
          name: prompt.name,
          content: prompt.content,
          enabled: true,
          priority: 'medium',
          category: prompt.category || 'general',
          tags: prompt.tags || [],
        });
      });
    }

    // Transform templates to context files
    if (prompts.templates && Array.isArray(prompts.templates)) {
      prompts.templates.forEach(template => {
        aiConfig.contextFiles.push({
          path: `templates/${template.name}.md`,
          content: template.template || template.content || '',
          description: template.description || `Template: ${template.name}`,
        });
      });
    }

    // Transform examples to prompts
    if (prompts.examples && Array.isArray(prompts.examples)) {
      prompts.examples.forEach(example => {
        aiConfig.prompts.push({
          name: example.name,
          content: example.prompt,
          description: example.use_case || `Example: ${example.name}`,
        });
      });
    }

    return aiConfig;
  }

  /**
   * Transform tools to extensions configuration
   */
  transformExtensions(context: TaptikContext): CursorExtensionsConfig {
    const tools = context.content.tools || {};

    const config: CursorExtensionsConfig = {
      recommendations: [],
      unwantedRecommendations: [],
    };

    if (tools.integrations && Array.isArray(tools.integrations)) {
      tools.integrations.forEach(tool => {
        if (tool.enabled !== false) {
          const extensionId = this.mapToolToExtension(tool);
          if (extensionId) {
            config.recommendations.push(extensionId);
          }
        }
      });
    }

    return config;
  }

  /**
   * Transform debug and tasks configuration
   */
  transformDebugTasks(context: TaptikContext): { debug: CursorDebugConfig; tasks: CursorTasksConfig } {
    const tools = context.content.tools || {};

    const debugConfig: CursorDebugConfig = {
      version: '0.2.0',
      configurations: [],
    };

    const tasksConfig: CursorTasksConfig = {
      version: '2.0.0',
      tasks: [],
    };

    if (tools.custom_tools && Array.isArray(tools.custom_tools)) {
      tools.custom_tools.forEach(tool => {
        tasksConfig.tasks.push({
          label: tool.name,
          type: 'shell',
          command: tool.command,
          group: tool.category || 'build',
          presentation: {
            echo: true,
            reveal: 'always',
            focus: false,
            panel: 'shared',
          },
        });
      });
    }

    return { debug: debugConfig, tasks: tasksConfig };
  }

  /**
   * Transform snippets and workspace configuration
   */
  transformSnippetsWorkspace(context: TaptikContext): { snippets: CursorSnippetsConfig; workspace: CursorWorkspaceConfig } {
    const prompts = context.content.prompts || {};
    const project = context.content.project || {};

    const snippets: CursorSnippetsConfig = {
      typescript: {},
      javascript: {},
    };

    const workspace: CursorWorkspaceConfig = {
      name: project.name || 'Untitled Project',
      folders: [],
      settings: {},
    };

    if (prompts.templates && Array.isArray(prompts.templates)) {
      prompts.templates.forEach(template => {
        const prefix = this.generateSnippetPrefix(template.name);
        const body = this.convertTemplateVariables(template.template || template.content || '', template.variables || []);

        snippets.typescript[template.name] = {
          prefix,
          body: body.split('\n'),
          description: template.description || `Template: ${template.name}`,
        };
      });
    }

    return { snippets, workspace };
  }

  // Private helper methods
  private initializeTransformationResult(): CursorTransformationResult {
    return {
      warnings: [],
      statistics: {
        transformedComponents: 0,
        mappingsApplied: 0,
        warningsCount: 0,
        errors: 0,
        transformationTime: 0,
        contentSize: {
          original: 0,
          transformed: 0,
          compressionRatio: 1,
        },
      },
      transformationLog: [],
    };
  }

  private mapToolToExtension(tool: any): string | null {
    const mappings: Record<string, string> = {
      prettier: 'esbenp.prettier-vscode',
      eslint: 'dbaeumer.vscode-eslint',
      typescript: 'ms-vscode.vscode-typescript-next',
      jest: 'Orta.vscode-jest',
    };

    return mappings[tool.name.toLowerCase()] || null;
  }

  private generateSnippetPrefix(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '-');
  }

  private convertTemplateVariables(template: string, variables: string[]): string {
    let result = template;
    variables.forEach((variable, index) => {
      const placeholder = `{{${variable}}}`;
      const snippet = `\${${index + 1}:${variable}}`;
      result = result.replace(new RegExp(placeholder, 'g'), snippet);
    });
    return result;
  }

  private finalizeStatistics(result: CursorTransformationResult, startTime: number): void {
    result.statistics.transformationTime = Date.now() - startTime;
    result.statistics.warningsCount = result.warnings.length;
  }

  private addLogEntry(
    result: CursorTransformationResult,
    level: 'info' | 'warn' | 'error' | 'debug',
    component: string,
    message: string,
    details?: any
  ): void {
    result.transformationLog.push({
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      details,
    });

    // Also log to service logger with safe method access
    if (this.logger && typeof this.logger[level] === 'function') {
      this.logger[level](`[${component}] ${message}`, details);
    }
  }
}