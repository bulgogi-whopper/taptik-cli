import { Injectable, Logger } from '@nestjs/common';

import { TaptikContext, ProjectContext, PromptsContext, ToolsContext } from '../../context/interfaces/taptik-context.interface';
import {
  KiroGlobalSettings,
  KiroProjectSettings,
  KiroSteeringDocument,
  KiroSpecDocument,
  KiroAgentConfiguration,
  KiroTemplateConfiguration,
  KiroHookConfiguration,
  KiroDeploymentContext,
  KiroConfigurationPaths
} from '../interfaces/kiro-deployment.interface';

@Injectable()
export class KiroTransformerService {
  private readonly logger = new Logger(KiroTransformerService.name);

  /**
   * Transform TaptikContext personal data to Kiro global settings
   */
  transformPersonalContext(context: TaptikContext): KiroGlobalSettings {
    this.logger.debug('Transforming personal context to Kiro global settings');

    const personal = context.content.personal || {};
    const tools = context.content.tools || {};
    const ide = context.content.ide?.['kiro-ide'] || {};

    const globalSettings: KiroGlobalSettings = {
      version: context.metadata.version || '1.0.0',
      user: {
        profile: {
          name: personal.profile?.name || personal.name,
          email: personal.profile?.email || personal.email,
          experience_years: personal.profile?.experience_years,
          primary_role: personal.profile?.primary_role,
          secondary_roles: personal.profile?.secondary_roles,
          domain_knowledge: personal.profile?.domain_knowledge
        },
        preferences: {
          theme: personal.preferences?.theme,
          fontSize: personal.preferences?.fontSize,
          style: personal.preferences?.style,
          naming_convention: personal.preferences?.naming_convention,
          comment_style: personal.preferences?.comment_style,
          error_handling: personal.preferences?.error_handling,
          testing_approach: personal.preferences?.testing_approach
        },
        communication: {
          explanation_level: personal.communication?.explanation_level,
          code_review_tone: personal.communication?.code_review_tone,
          preferred_language: personal.communication?.preferred_language
        },
        tech_stack: {
          languages: personal.tech_stack?.languages,
          frameworks: personal.tech_stack?.frameworks,
          databases: personal.tech_stack?.databases,
          cloud: personal.tech_stack?.cloud
        }
      },
      ide: {
        default_project_template: ide.settings['default_project_template'] as string,
        auto_save: ide.settings['auto_save'] as boolean,
        backup_frequency: ide.settings['backup_frequency'] as string,
      }
    };

    // Transform agents if available
    if (tools.agents && Array.isArray(tools.agents)) {
      globalSettings.agents = tools.agents.map(agent => this.transformAgent(agent));
    }

    // Transform templates from prompts context
    const prompts = context.content.prompts || {};
    if (prompts.templates && Array.isArray(prompts.templates)) {
      globalSettings.templates = prompts.templates.map(template => this.transformTemplate(template));
    }

    this.logger.debug('Personal context transformation completed');
    return globalSettings;
  }

  /**
   * Transform TaptikContext project data to Kiro project settings and steering
   */
  transformProjectContext(context: TaptikContext): {
    settings: KiroProjectSettings;
    steering: KiroSteeringDocument[];
    specs: KiroSpecDocument[];
    hooks: KiroHookConfiguration[];
  } {
    this.logger.debug('Transforming project context to Kiro project settings');

    const project = context.content.project || {};
    const tools = context.content.tools || {};
    const ide = context.content.ide?.['kiro-ide'] || {};

    const projectSettings: KiroProjectSettings = {
      version: context.metadata.version || '1.0.0',
      project: {
        info: {
          name: project.info?.name || project.name,
          type: project.info?.type,
          domain: project.info?.domain,
          team_size: project.info?.team_size
        },
        architecture: {
          pattern: project.architecture?.pattern,
          database_pattern: project.architecture?.database_pattern,
          api_style: project.architecture?.api_style,
          auth_method: project.architecture?.auth_method
        },
        tech_stack: {
          runtime: project.tech_stack?.runtime,
          language: project.tech_stack?.language,
          framework: project.tech_stack?.framework,
          database: project.tech_stack?.database,
          orm: project.tech_stack?.orm,
          testing: project.tech_stack?.testing,
          deployment: project.tech_stack?.deployment
        },
        conventions: {
          file_naming: project.conventions?.file_naming,
          folder_structure: project.conventions?.folder_structure,
          commit_convention: project.conventions?.commit_convention,
          branch_strategy: project.conventions?.branch_strategy
        },
        constraints: {
          performance_requirements: project.constraints?.performance_requirements,
          security_level: project.constraints?.security_level,
          compliance: project.constraints?.compliance
        }
      }
    };

    // Transform steering documents from project context
    const steeringDocuments = this.transformSteeringDocuments(project, context.metadata.exportedAt);

    // Transform specs from IDE-specific context
    const specs = this.transformSpecs(ide, context.metadata.exportedAt);

    // Transform hooks from tools context
    const hooks = this.transformHooks(tools);

    // Set references in project settings
    if (steeringDocuments.length > 0) {
      projectSettings.steering_documents = steeringDocuments.map(doc => doc.name);
    }
    if (specs.length > 0) {
      projectSettings.specs = specs.map(spec => spec.name);
    }
    if (hooks.length > 0) {
      projectSettings.hooks = hooks;
    }

    this.logger.debug('Project context transformation completed');
    return {
      settings: projectSettings,
      steering: steeringDocuments,
      specs,
      hooks
    };
  }

  /**
   * Transform TaptikContext prompts to Kiro templates
   */
  transformPromptTemplates(prompts: PromptsContext): KiroTemplateConfiguration[] {
    this.logger.debug('Transforming prompt templates to Kiro templates');

    const templates: KiroTemplateConfiguration[] = [];

    // Transform system prompts
    if (prompts.system_prompts && Array.isArray(prompts.system_prompts)) {
      prompts.system_prompts.forEach((prompt, index) => {
        templates.push({
          id: `system-prompt-${index}`,
          name: prompt.name,
          description: `System prompt: ${prompt.name}`,
          category: prompt.category || 'system',
          content: prompt.content,
          variables: [], // System prompts typically don't have variables
          tags: prompt.tags || [],
          metadata: {
            version: '1.0.0',
            created_at: new Date().toISOString()
          }
        });
      });
    }

    // Transform prompt templates
    if (prompts.templates && Array.isArray(prompts.templates)) {
      prompts.templates.forEach(template => {
        templates.push(this.transformTemplate(template));
      });
    }

    // Transform examples as templates
    if (prompts.examples && Array.isArray(prompts.examples)) {
      prompts.examples.forEach((example, index) => {
        templates.push({
          id: `example-${index}`,
          name: example.name,
          description: example.use_case || `Example: ${example.name}`,
          category: 'example',
          content: example.prompt,
          variables: [],
          tags: ['example'],
          metadata: {
            version: '1.0.0',
            created_at: new Date().toISOString()
          }
        });
      });
    }

    this.logger.debug(`Transformed ${templates.length} prompt templates`);
    return templates;
  }

  /**
   * Create Kiro deployment context with configuration paths
   */
  createDeploymentContext(homeDirectory: string, projectDirectory: string): KiroDeploymentContext {
    const paths: KiroConfigurationPaths = {
      globalSettings: `${homeDirectory}/.kiro/settings.json`,
      projectSettings: `${projectDirectory}/.kiro/settings.json`,
      steeringDirectory: `${projectDirectory}/.kiro/steering`,
      specsDirectory: `${projectDirectory}/.kiro/specs`,
      hooksDirectory: `${projectDirectory}/.kiro/hooks`,
      agentsDirectory: `${homeDirectory}/.kiro/agents`,
      templatesDirectory: `${homeDirectory}/.kiro/templates`
    };

    return {
      homeDirectory,
      projectDirectory,
      paths
    };
  }

  /**
   * Validate transformation results
   */
  validateTransformation(globalSettings: KiroGlobalSettings, projectSettings: KiroProjectSettings): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate global settings
    if (!globalSettings.version) {
      errors.push('Global settings must have a version');
    }
    if (!globalSettings.user) {
      warnings.push('Global settings missing user information');
    }

    // Validate project settings
    if (!projectSettings.version) {
      errors.push('Project settings must have a version');
    }
    if (!projectSettings.project?.info?.name) {
      warnings.push('Project settings missing project name');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private transformAgent(agent: any): KiroAgentConfiguration { // eslint-disable-line @typescript-eslint/no-explicit-any
    return {
      name: agent.name || 'Unnamed Agent',
      description: agent.description || agent.content?.substring(0, 100) || 'No description',
      category: agent.metadata?.category || 'general',
      prompt: agent.content || '',
      capabilities: agent.capabilities || [],
      constraints: agent.constraints || [],
      examples: agent.examples || [],
      metadata: {
        author: agent.metadata?.author,
        version: agent.metadata?.version || '1.0.0',
        created_at: agent.metadata?.created_at || new Date().toISOString(),
        updated_at: agent.metadata?.updated_at
      }
    };
  }

  private transformTemplate(template: any): KiroTemplateConfiguration { // eslint-disable-line @typescript-eslint/no-explicit-any
    // Extract variables from template content
    const variables = this.extractVariables(template.template || template.content || '');

    return {
      id: template.id || `template-${Date.now()}`,
      name: template.name,
      description: template.description || `Template: ${template.name}`,
      category: template.category || 'general',
      content: template.template || template.content || '',
      variables,
      tags: template.tags || [],
      metadata: {
        version: template.version || '1.0.0',
        created_at: template.created_at || new Date().toISOString(),
        updated_at: template.updated_at
      }
    };
  }

  private transformSteeringDocuments(project: ProjectContext, createdAt: string): KiroSteeringDocument[] {
    const documents: KiroSteeringDocument[] = [];

    // Create steering document from project description
    if (project.description) {
      documents.push({
        name: 'project-overview',
        category: 'overview',
        content: project.description,
        tags: ['project', 'overview'],
        priority: 'high',
        created_at: createdAt
      });
    }

    // Create steering document from claude.md if available
    if (project.claudeMd) {
      documents.push({
        name: 'claude-instructions',
        category: 'instructions',
        content: project.claudeMd,
        tags: ['claude', 'instructions'],
        priority: 'high',
        created_at: createdAt
      });
    }

    // Create steering documents from custom settings
    if (project.customSettings) {
      Object.entries(project.customSettings).forEach(([key, value]) => {
        if (typeof value === 'string' && value.length > 0) {
          documents.push({
            name: `custom-${key}`,
            category: 'custom',
            content: value,
            tags: ['custom', key],
            priority: 'medium',
            created_at: createdAt
          });
        }
      });
    }

    return documents;
  }

  private transformSpecs(ideContext: any, createdAt: string): KiroSpecDocument[] { // eslint-disable-line @typescript-eslint/no-explicit-any
    const specs: KiroSpecDocument[] = [];

    // Transform specs from IDE context if available
    if (ideContext.specs) {
      Object.entries(ideContext.specs).forEach(([key, value]) => {
        if (typeof value === 'string') {
          specs.push({
            name: key,
            type: 'feature',
            status: 'active',
            content: value,
            created_at: createdAt
          });
        }
      });
    }

    return specs;
  }

  private transformHooks(tools: ToolsContext): KiroHookConfiguration[] {
    const hooks: KiroHookConfiguration[] = [];

    // Transform custom tools as hooks
    if (tools.custom_tools && Array.isArray(tools.custom_tools)) {
      tools.custom_tools.forEach(tool => {
        hooks.push({
          name: tool.name,
          type: 'custom',
          trigger: 'manual',
          command: tool.command,
          enabled: true,
          description: tool.description
        });
      });
    }

    return hooks;
  }

  private extractVariables(content: string): any[] { // eslint-disable-line @typescript-eslint/no-explicit-any
    const variableRegex = /{{(\w+)}}/g;
    const variables: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    let match;

    while ((match = variableRegex.exec(content)) !== null) {
      const variableName = match[1];
      if (!variables.some(v => v.name === variableName)) {
        variables.push({
          name: variableName,
          type: 'string',
          description: `Variable: ${variableName}`,
          required: true
        });
      }
    }

    return variables;
  }
}