/* eslint-disable no-await-in-loop */
import { join } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import {
  TaptikContext,
  AIPlatform,
  KiroConfig,
  SteeringRule,
  Hook,
  TaskTemplate,
} from '../interfaces';
import {
  IContextBuilderStrategy,
  KiroExtractedData,
  ValidationResult,
  ConversionResult,
} from '../interfaces/strategy.interface';
import { FileSystemUtility } from '../utils/file-system.utility';

@Injectable()
export class KiroBuilderStrategy implements IContextBuilderStrategy {
  private readonly logger = new Logger(KiroBuilderStrategy.name);
  readonly platform = AIPlatform.KIRO;

  constructor(private readonly fileSystem: FileSystemUtility) {}

  /**
   * Detect if the current directory is a Kiro project
   */
  async detect(path?: string): Promise<boolean> {
    const basePath = path || process.cwd();
    const kiroPath = join(basePath, '.kiro');

    try {
      const exists = await this.fileSystem.exists(kiroPath);
      if (!exists) {
        return false;
      }

      // Check for essential Kiro directories
      const specsPath = join(kiroPath, 'specs');
      const steeringPath = join(kiroPath, 'steering');

      const [specsExists, steeringExists] = await Promise.all([
        this.fileSystem.exists(specsPath),
        this.fileSystem.exists(steeringPath),
      ]);

      return specsExists || steeringExists;
    } catch (error) {
      this.logger.error(`Failed to detect Kiro project: ${error.message}`);
      return false;
    }
  }

  /**
   * Extract Kiro configuration from the project
   */
  async extract(path?: string): Promise<any> {
    const basePath = path || process.cwd();
    const kiroPath = join(basePath, '.kiro');

    if (!(await this.detect(basePath))) {
      throw new Error('Not a Kiro project');
    }

    const [specs, steeringRules, hooks, mcpSettings, taskTemplates] =
      await Promise.all([
        this.extractSpecs(kiroPath),
        this.extractSteeringRules(kiroPath),
        this.extractHooks(kiroPath),
        this.extractMcpSettings(kiroPath),
        this.extractTaskTemplates(kiroPath),
      ]);

    return {
      specs,
      steeringRules,
      hooks,
      mcpSettings,
      taskTemplates,
      projectSettings: await this.extractProjectSettings(kiroPath),
    };
  }

  /**
   * Normalize Kiro data to universal TaptikContext format
   */
  async normalize(data: any): Promise<TaptikContext> {
    const now = new Date().toISOString();

    const kiroConfig: KiroConfig = {
      specs_path: '.kiro/specs',
      steering_rules: data.steeringRules,
      hooks: data.hooks,
      task_templates: data.taskTemplates,
      project_settings: data.projectSettings,
    };

    const context: TaptikContext = {
      version: '1.0.0',
      metadata: {
        name: 'Kiro Context',
        created_at: now,
        updated_at: now,
        platforms: [AIPlatform.KIRO],
      },
      ide: {
        category: 'ide',
        spec_version: '1.0.0',
        data: {
          kiro: kiroConfig,
        },
      },
    };

    // Add project data if specs exist
    if (data.specs && data.specs.length > 0) {
      context.project = {
        category: 'project',
        spec_version: '1.0.0',
        data: {
          kiro_specs: data.specs,
        },
      };
    }

    // Add tools data if MCP settings exist
    if (data.mcpSettings) {
      context.tools = {
        category: 'tools',
        spec_version: '1.0.0',
        data: {
          mcp_servers: data.mcpSettings.servers || [],
        },
      };
    }

    return context;
  }

  /**
   * Validate extracted Kiro data
   */
  async validate(data: any): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];

    // Check for required directories
    if (!data.specs || data.specs.length === 0) {
      warnings.push({
        path: 'specs',
        message: 'No specifications found in .kiro/specs directory',
      });
    }

    if (!data.steeringRules || data.steeringRules.length === 0) {
      warnings.push({
        path: 'steering',
        message: 'No steering rules found in .kiro/steering directory',
      });
    }

    // Validate hook configurations
    if (data.hooks) {
      for (const hook of data.hooks) {
        if (!hook.name) {
          errors.push({
            path: 'hooks',
            message: 'Hook missing required name field',
          });
        }
        if (!hook.version) {
          errors.push({
            path: 'hooks',
            message: `Hook ${hook.name} missing required version field`,
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Build complete context from Kiro project
   */
  async build(path?: string): Promise<TaptikContext> {
    const data = await this.extract(path);
    const validation = await this.validate(data);

    if (!validation.valid) {
      throw new Error(
        `Kiro data validation failed: ${JSON.stringify(validation.errors)}`,
      );
    }

    return this.normalize(data);
  }

  /**
   * Convert universal context back to Kiro format
   */
  async convert(context: TaptikContext): Promise<ConversionResult> {
    try {
      if (!context.ide?.data?.kiro) {
        return {
          success: false,
          error: 'No Kiro configuration found in context',
        };
      }

      // Extract Kiro-specific configuration
      const kiroConfig = context.ide.data.kiro;
      const kiroData: KiroExtractedData = {
        specs: context.project?.data?.kiro_specs || [],
        steeringRules: (kiroConfig.steering_rules || []) as unknown as Record<string, unknown>[],
        hooks: (kiroConfig.hooks || []) as unknown as Record<string, unknown>[],
        taskTemplates: (kiroConfig.task_templates || []) as unknown as Record<string, unknown>[],
        projectSettings: kiroConfig.project_settings as Record<string, unknown> | undefined,
      };

      // Extract MCP settings from tools
      if (context.tools?.data?.mcp_servers) {
        kiroData.mcpSettings = {
          servers: context.tools.data.mcp_servers,
        };
      }

      return {
        success: true,
        data: kiroData,
      };
    } catch (error) {
      return {
        success: false,
        error: `Conversion failed: ${error.message}`,
      };
    }
  }

  /**
   * Extract specifications from .kiro/specs directory
   */
  private async extractSpecs(kiroPath: string): Promise<any[]> {
    const specsPath = join(kiroPath, 'specs');
    const specs: any[] = [];

    try {
      if (!(await this.fileSystem.exists(specsPath))) {
        return specs;
      }

      const specDirectories = await this.fileSystem.readDirectory(specsPath);

      for (const dir of specDirectories) {
        const specPath = join(specsPath, dir);
        if (await this.fileSystem.isDirectory(specPath)) {
          const spec = await this.extractSpecDirectory(specPath, dir);
          if (spec) {
            specs.push(spec);
          }
        }
      }

      return specs;
    } catch (error) {
      this.logger.warn(`Failed to extract specs: ${error.message}`);
      return specs;
    }
  }

  /**
   * Extract a single specification directory with file reference resolution
   */
  private async extractSpecDirectory(
    specPath: string,
    name: string,
  ): Promise<any> {
    try {
      const spec: any = { name };

      // Read standard spec files
      const files = ['design.md', 'requirements.md', 'tasks.md'];
      for (const file of files) {
        const filePath = join(specPath, file);
        if (await this.fileSystem.exists(filePath)) {
          const content = await this.fileSystem.readFile(filePath);
          const key = file.replace('.md', '');
          spec[key] = content;
        }
      }

      // Only process if we have actual content
      if (Object.keys(spec).length > 1) {
        // Enhance spec with resolved file references
        return await this.enhanceSpecWithReferences(spec, specPath);
      }

      return null;
    } catch (error) {
      this.logger.warn(`Failed to extract spec ${name}: ${error.message}`);
      return null;
    }
  }

  /**
   * Extract steering rules from .kiro/steering directory
   */
  private async extractSteeringRules(
    kiroPath: string,
  ): Promise<SteeringRule[]> {
    const steeringPath = join(kiroPath, 'steering');
    const rules: SteeringRule[] = [];

    try {
      if (!(await this.fileSystem.exists(steeringPath))) {
        return rules;
      }

      const files = await this.fileSystem.readDirectory(steeringPath);
      const mdFiles = files.filter((f) => f.endsWith('.md'));

      for (const file of mdFiles) {
        const filePath = join(steeringPath, file);
        const content = await this.fileSystem.readFile(filePath);
        const name = file.replace('.md', '');

        // Parse markdown content into rules
        const rule: SteeringRule = {
          name,
          description: this.extractDescription(content),
          rules: this.extractRulesList(content),
          priority: this.extractPriority(name),
        };

        rules.push(rule);
      }

      return rules;
    } catch (error) {
      this.logger.warn(`Failed to extract steering rules: ${error.message}`);
      return rules;
    }
  }

  /**
   * Extract hooks from .kiro/hooks directory with enhanced validation
   */
  private async extractHooks(kiroPath: string): Promise<Hook[]> {
    const hooksPath = join(kiroPath, 'hooks');
    const hooks: Hook[] = [];

    try {
      if (!(await this.fileSystem.exists(hooksPath))) {
        return hooks;
      }

      const files = await this.fileSystem.readDirectory(hooksPath);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      for (const file of jsonFiles) {
        const filePath = join(hooksPath, file);
        try {
          const hookData = await this.fileSystem.readJson<Hook>(filePath);

          // Validate and enhance hook data
          if (this.isValidHook(hookData)) {
            // Add metadata if missing
            if (!hookData.description) {
              hookData.description = `Hook from ${file}`;
            }

            // Resolve file references in hook actions
            if (
              hookData.then?.command &&
              hookData.then.command.includes('{{')
            ) {
              hookData.then.command = await this.resolveFileReferences(
                hookData.then.command,
                kiroPath,
              );
            }

            hooks.push(hookData);
          } else {
            this.logger.warn(`Invalid hook structure in ${file}`);
          }
        } catch (fileError) {
          this.logger.warn(
            `Failed to parse hook file ${file}: ${fileError.message}`,
          );
        }
      }

      // Sort hooks by priority (enabled first, then by name)
      hooks.sort((a, b) => {
        if (a.enabled !== b.enabled) {
          return a.enabled ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      return hooks;
    } catch (error) {
      this.logger.warn(`Failed to extract hooks: ${error.message}`);
      return hooks;
    }
  }

  /**
   * Extract MCP settings from .kiro/settings/mcp.json with full configuration
   */
  private async extractMcpSettings(kiroPath: string): Promise<any> {
    const settingsPath = join(kiroPath, 'settings');
    const mcpPath = join(settingsPath, 'mcp.json');

    try {
      // Check for MCP configuration file
      if (!(await this.fileSystem.exists(mcpPath))) {
        // Try alternative locations
        const altPath = join(kiroPath, 'mcp.json');
        if (await this.fileSystem.exists(altPath)) {
          return await this.fileSystem.readJson(altPath);
        }
        return null;
      }

      const mcpConfig = await this.fileSystem.readJson(mcpPath);

      // Validate and enhance MCP configuration
      if (mcpConfig) {
        // Ensure servers array exists
        if (!mcpConfig.servers) {
          mcpConfig.servers = [];
        }

        // Validate each server configuration
        mcpConfig.servers = mcpConfig.servers.filter((server: any) => {
          if (!server.name) {
            this.logger.warn('MCP server missing name, skipping');
            return false;
          }

          // Add default version if missing
          if (!server.version) {
            server.version = '1.0.0';
          }

          // Ensure config object exists
          if (!server.config) {
            server.config = {};
          }

          // Add default enabled state if missing
          if (server.enabled === undefined) {
            server.enabled = true;
          }

          return true;
        });

        // Sort servers by priority (enabled first, then by name)
        mcpConfig.servers.sort((a: any, b: any) => {
          if (a.enabled !== b.enabled) {
            return a.enabled ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
      }

      return mcpConfig;
    } catch (error) {
      this.logger.warn(`Failed to extract MCP settings: ${error.message}`);
      return null;
    }
  }

  /**
   * Extract task templates from .kiro/templates directory
   */
  private async extractTaskTemplates(
    kiroPath: string,
  ): Promise<TaskTemplate[]> {
    const templatesPath = join(kiroPath, 'templates');
    const templates: TaskTemplate[] = [];

    try {
      if (!(await this.fileSystem.exists(templatesPath))) {
        return templates;
      }

      const files = await this.fileSystem.readDirectory(templatesPath);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      for (const file of jsonFiles) {
        const filePath = join(templatesPath, file);
        const templateData =
          await this.fileSystem.readJson<TaskTemplate>(filePath);
        if (this.isValidTaskTemplate(templateData)) {
          templates.push(templateData);
        }
      }

      return templates;
    } catch (error) {
      this.logger.warn(`Failed to extract task templates: ${error.message}`);
      return templates;
    }
  }

  /**
   * Extract project settings from .kiro/settings/project.json
   */
  private async extractProjectSettings(kiroPath: string): Promise<any> {
    const projectPath = join(kiroPath, 'settings', 'project.json');

    try {
      if (!(await this.fileSystem.exists(projectPath))) {
        // Return default settings if file doesn't exist
        return {
          specification_driven: true,
          auto_test: true,
          incremental_progress: true,
          task_confirmation: true,
        };
      }

      return await this.fileSystem.readJson(projectPath);
    } catch (error) {
      this.logger.warn(`Failed to extract project settings: ${error.message}`);
      return null;
    }
  }

  /**
   * Helper: Extract description from markdown content
   */
  private extractDescription(content: string): string {
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.trim() && !line.startsWith('#')) {
        return line.trim();
      }
    }
    return '';
  }

  /**
   * Helper: Extract rules list from markdown content
   */
  private extractRulesList(content: string): string[] {
    const rules: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        rules.push(line.trim().slice(2));
      }
    }

    return rules;
  }

  /**
   * Helper: Determine priority based on file name
   */
  private extractPriority(name: string): number {
    const priorityMap: Record<string, number> = {
      principle: 100,
      persona: 90,
      architecture: 80,
      'nestjs-standards': 70,
      TDD: 60,
      TEST: 60,
      git: 50,
      PRD: 40,
      'project-context': 30,
      flags: 20,
      mcp: 10,
    };

    return priorityMap[name] || 50;
  }

  /**
   * Helper: Validate hook structure
   */
  private isValidHook(hook: any): hook is Hook {
    return (
      hook &&
      typeof hook.name === 'string' &&
      typeof hook.version === 'string' &&
      typeof hook.enabled === 'boolean' &&
      hook.when &&
      hook.then
    );
  }

  /**
   * Helper: Validate task template structure
   */
  private isValidTaskTemplate(template: any): template is TaskTemplate {
    return (
      template &&
      typeof template.name === 'string' &&
      Array.isArray(template.tasks)
    );
  }

  /**
   * Helper: Resolve file references in content
   * Replaces {{file:path}} with actual file content
   */
  private async resolveFileReferences(
    content: string,
    basePath: string,
  ): Promise<string> {
    const fileReferencePattern = /{{file:([^}]+)}}/g;
    let resolved = content;
    let match;

    while ((match = fileReferencePattern.exec(content)) !== null) {
      const filePath = match[1].trim();
      const fullPath = join(basePath, filePath);

      try {
        if (await this.fileSystem.exists(fullPath)) {
          const fileContent = await this.fileSystem.readFile(fullPath);
          resolved = resolved.replace(match[0], fileContent);
        } else {
          this.logger.warn(`Referenced file not found: ${filePath}`);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to read referenced file ${filePath}: ${error.message}`,
        );
      }
    }

    return resolved;
  }

  /**
   * Helper: Enhance spec with file references
   */
  private async enhanceSpecWithReferences(
    spec: any,
    specPath: string,
  ): Promise<any> {
    const enhancedSpec = { ...spec };

    // Resolve file references in each markdown file
    if (enhancedSpec.design) {
      enhancedSpec.design = await this.resolveFileReferences(
        enhancedSpec.design,
        specPath,
      );
    }

    if (enhancedSpec.requirements) {
      enhancedSpec.requirements = await this.resolveFileReferences(
        enhancedSpec.requirements,
        specPath,
      );
    }

    if (enhancedSpec.tasks) {
      enhancedSpec.tasks = await this.resolveFileReferences(
        enhancedSpec.tasks,
        specPath,
      );
    }

    // Check for additional resource files
    try {
      const resourcesPath = join(specPath, 'resources');
      if (await this.fileSystem.exists(resourcesPath)) {
        const resources = await this.fileSystem.readDirectory(resourcesPath);
        enhancedSpec.resources = resources;
      }
    } catch {
      // Resources directory is optional
    }

    return enhancedSpec;
  }
}
