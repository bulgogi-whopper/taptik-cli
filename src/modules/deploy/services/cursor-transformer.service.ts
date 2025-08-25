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
        result.aiConfig = await this.transformAIContent(context);
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
   * Transform AI content to Cursor AI configuration (enhanced version)
   */
  async transformAIContent(context: TaptikContext): Promise<CursorAIConfig> {
    const prompts = context.content.prompts || {};
    const result = this.initializeTransformationResult();

    const aiConfig: CursorAIConfig = {
      rules: [],
      contextFiles: [],
      prompts: [],
    };

    // Transform AI rules with security scanning
    const transformedRules = await this.transformAIRules(context, result);
    aiConfig.rules = transformedRules;

    // Transform AI context files with validation
    const transformedContext = await this.transformAIContext(context, result);
    aiConfig.contextFiles = transformedContext;

    // Transform prompt templates with optimization
    const transformedPrompts = await this.transformPromptTemplates(context, result);
    aiConfig.prompts = transformedPrompts;

    // Perform security scan on AI content
    await this.scanAIContentForSecurity(aiConfig, result);

    return aiConfig;
  }

  /**
   * Transform AI rules to Cursor format with security validation
   */
  async transformAIRules(context: TaptikContext, result: CursorTransformationResult): Promise<CursorAIRule[]> {
    this.addLogEntry(result, 'info', 'ai-rules', 'Starting AI rules transformation');
    
    const prompts = context.content.prompts || {};
    const rules: CursorAIRule[] = [];

    // Transform system prompts to AI rules
    if (prompts.system_prompts && Array.isArray(prompts.system_prompts)) {
      for (const prompt of prompts.system_prompts) {
        try {
          // Create temporary rule for security validation
          const tempRule: CursorAIRule = {
            id: 'temp',
            name: prompt.name,
            content: prompt.content,
            enabled: true,
            priority: 5,
            scope: 'workspace'
          };

          // Security scan for malicious content
          const securityResult = this.contentValidator 
            ? await this.contentValidator.validateAIContent({
                rules: [tempRule],
                contextFiles: [],
                prompts: []
              })
            : { valid: true, errors: [], warnings: [] };

          if (!securityResult.valid) {
            this.addWarning(result, 'security',
              `AI rule "${prompt.name}" failed security validation`,
              'ai-rules-transform',
              'Review and sanitize AI rule content',
              'high'
            );
            continue;
          }

          const rule = this.createAIRule(prompt, result);
          if (rule) {
            rules.push(rule);
            result.statistics.mappingsApplied++;
          }

        } catch (error) {
          this.addWarning(result, 'validation',
            `Error processing AI rule "${prompt.name}": ${(error as Error).message}`,
            'ai-rules-transform',
            'Check rule format and content',
            'medium'
          );
        }
      }
    }

    // Transform agents to AI rules if available
    if (context.content.tools?.agents && Array.isArray(context.content.tools.agents)) {
      for (const agent of context.content.tools.agents) {
        try {
          const rule = this.createAIRuleFromAgent(agent, result);
          if (rule) {
            const securityResult = this.contentValidator 
              ? await this.contentValidator.validateAIContent({
                  rules: [rule],
                  contextFiles: [],
                  prompts: []
                })
              : { valid: true, errors: [], warnings: [] };

            if (securityResult.valid) {
              rules.push(rule);
              result.statistics.mappingsApplied++;
            } else {
              this.addWarning(result, 'security',
                `Agent-based AI rule "${agent.name}" failed security validation`,
                'ai-rules-transform',
                'Review agent content for security issues',
                'high'
              );
            }
          }
        } catch (error) {
          this.addWarning(result, 'validation',
            `Error processing agent "${agent.name}": ${(error as Error).message}`,
            'ai-rules-transform',
            'Check agent format and content',
            'medium'
          );
        }
      }
    }

    this.addLogEntry(result, 'info', 'ai-rules', `Transformed ${rules.length} AI rules`);
    return rules;
  }

  /**
   * Transform AI context files with validation and optimization
   */
  async transformAIContext(context: TaptikContext, result: CursorTransformationResult): Promise<CursorAIContext[]> {
    this.addLogEntry(result, 'info', 'ai-context', 'Starting AI context transformation');
    
    const prompts = context.content.prompts || {};
    const project = context.content.project || {};
    const contextFiles: CursorAIContext[] = [];

    // Transform templates to context files
    if (prompts.templates && Array.isArray(prompts.templates)) {
      for (const template of prompts.templates) {
        try {
          const contextFile = this.createAIContextFile(template, 'template', result);
          if (contextFile) {
            // Validate content size and format
            if (await this.validateContextFileSize(contextFile, result)) {
              contextFiles.push(contextFile);
              result.statistics.mappingsApplied++;
            }
          }
        } catch (error) {
          this.addWarning(result, 'validation',
            `Error processing template "${template.name}": ${(error as Error).message}`,
            'ai-context-transform',
            'Check template format and content',
            'medium'
          );
        }
      }
    }

    // Transform project documentation to context files
    if (project.claudeMd) {
      try {
        const contextFile: CursorAIContext = {
          id: this.generateAIContextId('project-context'),
          name: 'Project Context',
          content: project.claudeMd,
          description: 'Project-specific AI context from CLAUDE.md',
          type: 'documentation',
          enabled: true,
          priority: 8,
          scope: 'workspace',
        };

        if (await this.validateContextFileSize(contextFile, result)) {
          contextFiles.push(contextFile);
          result.statistics.mappingsApplied++;
        }
      } catch (error) {
        this.addWarning(result, 'validation',
          `Error processing project context: ${(error as Error).message}`,
          'ai-context-transform',
          'Check CLAUDE.md content format',
          'medium'
        );
      }
    }

    // Transform custom settings to context files
    if (project.customSettings && typeof project.customSettings === 'object') {
      for (const [key, value] of Object.entries(project.customSettings)) {
        if (typeof value === 'string' && value.length > 0) {
          try {
            const contextFile: CursorAIContext = {
              id: this.generateAIContextId(`custom-${key}`),
              name: `Custom ${key}`,
              content: value,
              description: `Custom setting: ${key}`,
              type: 'custom',
              enabled: true,
              priority: 4,
              scope: 'workspace',
            };

            if (await this.validateContextFileSize(contextFile, result)) {
              contextFiles.push(contextFile);
              result.statistics.mappingsApplied++;
            }
          } catch (error) {
            this.addWarning(result, 'validation',
              `Error processing custom setting "${key}": ${(error as Error).message}`,
              'ai-context-transform',
              'Check custom setting content',
              'low'
            );
          }
        }
      }
    }

    this.addLogEntry(result, 'info', 'ai-context', `Transformed ${contextFiles.length} context files`);
    return contextFiles;
  }

  /**
   * Transform prompt templates with variable optimization
   */
  async transformPromptTemplates(context: TaptikContext, result: CursorTransformationResult): Promise<CursorAIPrompt[]> {
    this.addLogEntry(result, 'info', 'ai-prompts', 'Starting prompt templates transformation');
    
    const prompts = context.content.prompts || {};
    const aiPrompts: CursorAIPrompt[] = [];

    // Transform examples to optimized prompts
    if (prompts.examples && Array.isArray(prompts.examples)) {
      for (const example of prompts.examples) {
        try {
          const optimizedPrompt = this.optimizePromptForCursor(example, result);
          if (optimizedPrompt) {
            // Security scan for prompt injection
            if (await this.validatePromptSecurity(optimizedPrompt, result)) {
              aiPrompts.push(optimizedPrompt);
              result.statistics.mappingsApplied++;
            }
          }
        } catch (error) {
          this.addWarning(result, 'validation',
            `Error processing prompt example "${example.name}": ${(error as Error).message}`,
            'ai-prompts-transform',
            'Check prompt example format',
            'medium'
          );
        }
      }
    }

    // Transform system prompts to interactive prompts
    if (prompts.system_prompts && Array.isArray(prompts.system_prompts)) {
      for (const systemPrompt of prompts.system_prompts) {
        if (systemPrompt.category === 'interactive' || systemPrompt.tags?.includes('interactive')) {
          try {
            const interactivePrompt: CursorAIPrompt = {
              id: this.generateAIPromptId(systemPrompt.name),
              name: systemPrompt.name,
              content: systemPrompt.content,
              description: `Interactive system prompt: ${systemPrompt.name}`,
              enabled: true,
              priority: 7,
              scope: 'workspace',
            };

            if (await this.validatePromptSecurity(interactivePrompt, result)) {
              aiPrompts.push(interactivePrompt);
              result.statistics.mappingsApplied++;
            }
          } catch (error) {
            this.addWarning(result, 'validation',
              `Error processing interactive prompt "${systemPrompt.name}": ${(error as Error).message}`,
              'ai-prompts-transform',
              'Check system prompt content',
              'medium'
            );
          }
        }
      }
    }

    this.addLogEntry(result, 'info', 'ai-prompts', `Transformed ${aiPrompts.length} AI prompts`);
    return aiPrompts;
  }

  /**
   * Perform comprehensive security scan on AI content
   */
  async scanAIContentForSecurity(aiConfig: CursorAIConfig, result: CursorTransformationResult): Promise<void> {
    this.addLogEntry(result, 'info', 'ai-security', 'Starting AI content security scan');

    if (this.contentValidator) {
      try {
        const validationResult = await this.contentValidator.validateAIContent(aiConfig);
        
        if (!validationResult.valid) {
          for (const error of validationResult.errors) {
            this.addWarning(result, 'security',
              `AI content security issue: ${error}`,
              'ai-security-scan',
              'Review and sanitize AI content',
              'high'
            );
          }
        }

        for (const warning of validationResult.warnings) {
          this.addWarning(result, 'security',
            `AI content security warning: ${warning}`,
            'ai-security-scan',
            'Consider reviewing AI content',
            'medium'
          );
        }

        this.addLogEntry(result, 'info', 'ai-security', 
          `Security scan completed: ${validationResult.errors.length} errors, ${validationResult.warnings.length} warnings`);
        
      } catch (error) {
        this.addWarning(result, 'validation',
          `AI security scan failed: ${(error as Error).message}`,
          'ai-security-scan',
          'Manual security review recommended',
          'high'
        );
      }
    } else {
      this.addLogEntry(result, 'info', 'ai-security', 'Security scan skipped - validator not available');
    }
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

  // AI-specific helper methods
  private createAIRule(prompt: any, result: CursorTransformationResult): CursorAIRule | null {
    if (!prompt.name || !prompt.content) {
      this.addWarning(result, 'mapping',
        'AI rule missing required fields (name/content)',
        'ai-rule-creation',
        'Ensure AI rules have name and content fields',
        'medium'
      );
      return null;
    }

    return {
      id: this.generateAIRuleId(prompt.name),
      name: prompt.name,
      content: this.optimizeAIRuleContent(prompt.content),
      enabled: true,
      priority: this.determineAIRulePriorityNumber(prompt),
      category: prompt.category || 'general',
      tags: prompt.tags || [],
      scope: 'workspace',
    };
  }

  private createAIRuleFromAgent(agent: any, result: CursorTransformationResult): CursorAIRule | null {
    if (!agent.name || !agent.content) {
      this.addWarning(result, 'mapping',
        'Agent missing required fields (name/content)',
        'agent-to-rule',
        'Ensure agents have name and content fields',
        'medium'
      );
      return null;
    }

    return {
      id: this.generateAIRuleId(`agent-${agent.name}`),
      name: `Agent: ${agent.name}`,
      content: this.optimizeAgentContentForAI(agent.content, agent.capabilities),
      enabled: true,
      priority: 8, // High priority for agents
      category: agent.metadata?.category || 'agent',
      tags: ['agent', ...(agent.metadata?.tags || [])],
      scope: 'workspace',
    };
  }

  private createAIContextFile(template: any, type: string, result: CursorTransformationResult): CursorAIContext | null {
    if (!template.name) {
      this.addWarning(result, 'mapping',
        'Template missing name field',
        'context-file-creation',
        'Ensure templates have name field',
        'medium'
      );
      return null;
    }

    const content = template.template || template.content || '';
    if (content.length === 0) {
      this.addWarning(result, 'mapping',
        `Template "${template.name}" has empty content`,
        'context-file-creation',
        'Templates should have meaningful content',
        'low'
      );
      return null;
    }

    return {
      id: this.generateAIContextId(template.name),
      name: template.name,
      content: this.optimizeContextFileContent(content, template.variables),
      description: template.description || `${type}: ${template.name}`,
      type: type as any,
      enabled: true,
      priority: 5,
      scope: 'workspace',
    };
  }

  private optimizePromptForCursor(example: any, result: CursorTransformationResult): CursorAIPrompt | null {
    if (!example.name || !example.prompt) {
      this.addWarning(result, 'mapping',
        'Prompt example missing required fields (name/prompt)',
        'prompt-optimization',
        'Ensure prompt examples have name and prompt fields',
        'medium'
      );
      return null;
    }

    return {
      id: this.generateAIPromptId(example.name),
      name: example.name,
      content: this.enhancePromptForCursor(example.prompt, example.expected_response),
      description: example.use_case || `Example: ${example.name}`,
      enabled: true,
      priority: 5,
      scope: 'workspace',
    };
  }

  private optimizeAIRuleContent(content: string): string {
    // Remove excessive whitespace and normalize formatting
    let optimized = content.trim().replace(/\n\s*\n\s*\n/g, '\n\n');
    
    // Add Cursor-specific formatting hints
    if (!optimized.startsWith('---')) {
      optimized = `---\nrule_type: ai_instruction\ncontext: cursor_ide\n---\n\n${optimized}`;
    }

    return optimized;
  }

  private optimizeAgentContentForAI(content: string, capabilities?: string[]): string {
    let optimized = content.trim();

    // Add agent capabilities context
    if (capabilities && capabilities.length > 0) {
      optimized += `\n\n**Agent Capabilities:**\n${capabilities.map(cap => `- ${cap}`).join('\n')}`;
    }

    // Format for Cursor AI consumption
    optimized = `---\nrule_type: agent_instruction\ncontext: cursor_ide\n---\n\n${optimized}`;

    return optimized;
  }

  private optimizeContextFileContent(content: string, variables?: string[]): string {
    let optimized = content.trim();

    // Add variable documentation if present
    if (variables && variables.length > 0) {
      optimized = `${optimized}\n\n<!-- Template Variables: ${variables.join(', ')} -->`;
    }

    // Ensure proper markdown formatting
    if (!optimized.startsWith('#')) {
      optimized = `# Context File\n\n${optimized}`;
    }

    return optimized;
  }

  private enhancePromptForCursor(prompt: string, expectedResponse?: string): string {
    let enhanced = prompt.trim();

    // Add expected response as context if available
    if (expectedResponse) {
      enhanced += `\n\n**Expected Response Style:**\n${expectedResponse}`;
    }

    // Add Cursor-specific prompt enhancement
    enhanced += '\n\n*This prompt is optimized for Cursor AI assistant.*';

    return enhanced;
  }

  private determineAIRulePriorityNumber(prompt: any): number {
    if (typeof prompt.priority === 'number') {
      return Math.max(0, Math.min(10, prompt.priority));
    }

    // Determine priority based on content and tags
    const content = prompt.content?.toLowerCase() || '';
    const category = prompt.category?.toLowerCase() || '';
    const tags = prompt.tags || [];

    if (category === 'security' || tags.includes('security') || content.includes('security')) {
      return 9; // High priority
    }

    if (category === 'style' || tags.includes('style') || content.includes('format')) {
      return 6; // Medium-high priority
    }

    if (category === 'review' || tags.includes('review')) {
      return 7; // High-medium priority
    }

    return 5; // Medium priority
  }

  private generateAIRuleId(name: string): string {
    return `ai-rule-${this.sanitizeFileName(name)}-${Date.now()}`;
  }

  private generateAIContextId(name: string): string {
    return `ai-context-${this.sanitizeFileName(name)}-${Date.now()}`;
  }

  private generateAIPromptId(name: string): string {
    return `ai-prompt-${this.sanitizeFileName(name)}-${Date.now()}`;
  }

  private sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async validateContextFileSize(contextFile: CursorAIContext, result: CursorTransformationResult): Promise<boolean> {
    const maxSize = 1024 * 1024; // 1MB limit
    const contentSize = Buffer.byteLength(contextFile.content, 'utf8');

    if (contentSize > maxSize) {
      this.addWarning(result, 'validation',
        `Context file "${contextFile.name}" exceeds size limit (${contentSize} > ${maxSize} bytes)`,
        'context-file-validation',
        'Consider splitting large context files into smaller ones',
        'high'
      );
      return false;
    }

    return true;
  }

  private async validatePromptSecurity(prompt: CursorAIPrompt, result: CursorTransformationResult): Promise<boolean> {
    // Check for prompt injection patterns
    const dangerousPatterns = [
      /ignore\s+previous\s+instructions/i,
      /forget\s+everything/i,
      /system\s*:\s*you\s+are/i,
      /\[INST\]/i,
      /<\|im_start\|>/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(prompt.content)) {
        this.addWarning(result, 'security',
          `Prompt "${prompt.name}" contains potential injection pattern`,
          'prompt-security-validation',
          'Review prompt content for security issues',
          'high'
        );
        return false;
      }
    }

    return true;
  }

  private addWarning(
    result: CursorTransformationResult,
    type: CursorTransformationWarning['type'],
    message: string,
    source: string,
    suggestion: string,
    impact: 'low' | 'medium' | 'high'
  ): void {
    result.warnings.push({
      type,
      message,
      source,
      suggestion,
      impact,
    });

    this.addLogEntry(result, 'warn', 'warning', message, { type, source, impact });
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