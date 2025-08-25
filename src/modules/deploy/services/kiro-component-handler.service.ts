import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import {
  DeploymentError,
  DeploymentWarning,
} from '../interfaces/deployment-result.interface';
import {
  KiroGlobalSettings,
  KiroProjectSettings,
  KiroSteeringDocument,
  KiroSpecDocument,
  KiroHookConfiguration,
  KiroAgentConfiguration,
  KiroTemplateConfiguration,
  KiroDeploymentContext,
  KiroDeploymentOptions,
  KiroMergeStrategy,
} from '../interfaces/kiro-deployment.interface';

import { KiroConflictResolverService } from './kiro-conflict-resolver.service';

@Injectable()
export class KiroComponentHandlerService {
  private readonly logger = new Logger(KiroComponentHandlerService.name);

  constructor(private readonly conflictResolver: KiroConflictResolverService) {}

  /**
   * Deploy global and project settings
   */
  async deploySettings(
    globalSettings: KiroGlobalSettings,
    projectSettings: KiroProjectSettings,
    context: KiroDeploymentContext,
    options: KiroDeploymentOptions,
  ): Promise<{
    globalDeployed: boolean;
    projectDeployed: boolean;
    errors: DeploymentError[];
    warnings: DeploymentWarning[];
  }> {
    this.logger.debug('Deploying Kiro settings');

    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];
    let globalDeployed = false;
    let projectDeployed = false;

    try {
      // Deploy global settings if enabled
      if (options.globalSettings !== false) {
        await this.ensureDirectoryExists(
          path.dirname(context.paths.globalSettings),
        );

        // 충돌 해결 서비스를 사용한 배포
        if (this.conflictResolver && options.conflictStrategy !== 'overwrite') {
          const globalContent = JSON.stringify(globalSettings, null, 2);
          const globalResult = await this.conflictResolver.resolveConflict(
            context.paths.globalSettings,
            globalContent,
            'settings',
            options.conflictStrategy,
            options.mergeStrategy,
          );

          if (globalResult.resolved) {
            globalDeployed = true;
            this.logger.debug(
              `Global settings deployed to: ${context.paths.globalSettings}`,
            );
          } else {
            errors.push(...globalResult.errors);
          }

          warnings.push(...globalResult.warnings);
        } else {
          // 기존 로직 사용 (백업 호환성)
          const existingGlobal = await this.loadExistingSettings(
            context.paths.globalSettings,
          );
          const mergedGlobal = existingGlobal
            ? this.mergeSettings(
                existingGlobal,
                globalSettings,
                options.mergeStrategy || 'deep-merge',
              )
            : globalSettings;

          await this.writeJsonFile(context.paths.globalSettings, mergedGlobal);
          globalDeployed = true;
          this.logger.debug(
            `Global settings deployed to: ${context.paths.globalSettings}`,
          );
        }
      }

      // Deploy project settings if enabled
      if (options.projectSettings !== false) {
        await this.ensureDirectoryExists(
          path.dirname(context.paths.projectSettings),
        );

        // 충돌 해결 서비스를 사용한 배포
        if (this.conflictResolver && options.conflictStrategy !== 'overwrite') {
          const projectContent = JSON.stringify(projectSettings, null, 2);
          const projectResult = await this.conflictResolver.resolveConflict(
            context.paths.projectSettings,
            projectContent,
            'settings',
            options.conflictStrategy,
            options.mergeStrategy,
          );

          if (projectResult.resolved) {
            projectDeployed = true;
            this.logger.debug(
              `Project settings deployed to: ${context.paths.projectSettings}`,
            );
          } else {
            errors.push(...projectResult.errors);
          }

          warnings.push(...projectResult.warnings);
        } else {
          // 기존 로직 사용 (백업 호환성)
          const existingProject = await this.loadExistingSettings(
            context.paths.projectSettings,
          );
          const mergedProject = existingProject
            ? this.mergeSettings(
                existingProject,
                projectSettings,
                options.mergeStrategy || 'deep-merge',
              )
            : projectSettings;

          await this.writeJsonFile(
            context.paths.projectSettings,
            mergedProject,
          );
          projectDeployed = true;
          this.logger.debug(
            `Project settings deployed to: ${context.paths.projectSettings}`,
          );
        }
      }
    } catch (error) {
      const errorMessage = `Failed to deploy settings: ${(error as Error).message}`;
      this.logger.error(errorMessage);
      errors.push({
        message: errorMessage,
        code: 'KIRO_SETTINGS_DEPLOY_ERROR',
        severity: 'error',
      });
    }

    return {
      globalDeployed,
      projectDeployed,
      errors,
      warnings,
    };
  }

  /**
   * Deploy steering documents to .kiro/steering/
   */
  async deploySteering(
    documents: KiroSteeringDocument[],
    context: KiroDeploymentContext,
    options: KiroDeploymentOptions,
  ): Promise<{
    deployedFiles: string[];
    errors: DeploymentError[];
    warnings: DeploymentWarning[];
  }> {
    this.logger.debug(`Deploying ${documents.length} steering documents`);

    const deployedFiles: string[] = [];
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];

    try {
      await this.ensureDirectoryExists(context.paths.steeringDirectory);

      // Deploy all documents in parallel
      const deploymentPromises = documents.map(async (doc) => {
        try {
          const fileName = this.sanitizeFileName(`${doc.name}.md`);
          const filePath = path.join(context.paths.steeringDirectory, fileName);

          // Check for existing file
          const existingContent = await this.loadExistingMarkdown(filePath);
          let contentToWrite = doc.content;

          if (existingContent && options.conflictStrategy !== 'overwrite') {
            if (options.conflictStrategy === 'merge-intelligent') {
              contentToWrite = this.mergeMarkdownContent(
                existingContent,
                doc.content,
              );
              return {
                fileName,
                success: true,
                warning: {
                  message: `Merged existing steering document: ${fileName}`,
                  code: 'KIRO_STEERING_MERGED',
                },
              };
            } else if (options.conflictStrategy === 'skip') {
              return {
                fileName,
                success: false,
                warning: {
                  message: `Skipped existing steering document: ${fileName}`,
                  code: 'KIRO_STEERING_SKIPPED',
                },
              };
            }
          }

          // Add metadata header
          const fullContent = this.addMarkdownMetadata(contentToWrite, {
            title: doc.name,
            category: doc.category,
            tags: doc.tags,
            priority: doc.priority,
            applies_to: doc.applies_to,
            created_at: doc.created_at,
            updated_at: new Date().toISOString(),
          });

          await this.writeTextFile(filePath, fullContent);
          this.logger.debug(`Steering document deployed: ${fileName}`);
          return { fileName, success: true };
        } catch (error) {
          const errorMessage = `Failed to deploy steering document ${doc.name}: ${(error as Error).message}`;
          return {
            fileName: this.sanitizeFileName(`${doc.name}.md`),
            success: false,
            error: {
              message: errorMessage,
              code: 'KIRO_STEERING_DEPLOY_ERROR',
              severity: 'error' as const,
            },
          };
        }
      });

      const results = await Promise.allSettled(deploymentPromises);

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const { fileName, success, warning, error } = result.value;
          if (success) {
            deployedFiles.push(fileName);
          }
          if (warning) {
            warnings.push(warning);
          }
          if (error) {
            errors.push(error);
          }
        } else {
          errors.push({
            message: `Deployment promise rejected: ${result.reason}`,
            code: 'KIRO_STEERING_DEPLOY_ERROR',
            severity: 'error',
          });
        }
      });
    } catch (error) {
      const errorMessage = `Failed to deploy steering documents: ${(error as Error).message}`;
      this.logger.error(errorMessage);
      errors.push({
        message: errorMessage,
        code: 'KIRO_STEERING_DEPLOY_ERROR',
        severity: 'error',
      });
    }

    return {
      deployedFiles,
      errors,
      warnings,
    };
  }

  /**
   * Deploy specs to .kiro/specs/ with proper structure
   */
  async deploySpecs(
    specs: KiroSpecDocument[],
    context: KiroDeploymentContext,
    options: KiroDeploymentOptions,
  ): Promise<{
    deployedFiles: string[];
    errors: DeploymentError[];
    warnings: DeploymentWarning[];
  }> {
    this.logger.debug(`Deploying ${specs.length} spec documents`);

    const deployedFiles: string[] = [];
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];

    try {
      await this.ensureDirectoryExists(context.paths.specsDirectory);

      // Deploy all specs in parallel
      const deploymentPromises = specs.map(async (spec) => {
        try {
          const fileName = this.sanitizeFileName(`${spec.name}.md`);
          const filePath = path.join(context.paths.specsDirectory, fileName);

          // Check for existing file and preserve task status if enabled
          const existingContent = await this.loadExistingMarkdown(filePath);
          let contentToWrite = spec.content;
          const warningsToAdd: DeploymentWarning[] = [];

          if (existingContent && options.preserveTaskStatus) {
            contentToWrite = this.preserveTaskStatus(
              existingContent,
              spec.content,
            );
            warningsToAdd.push({
              message: `Preserved task status in spec: ${fileName}`,
              code: 'KIRO_SPEC_TASK_STATUS_PRESERVED',
            });
          } else if (
            existingContent &&
            options.conflictStrategy === 'merge-intelligent'
          ) {
            contentToWrite = this.mergeMarkdownContent(
              existingContent,
              spec.content,
            );
            warningsToAdd.push({
              message: `Merged existing spec document: ${fileName}`,
              code: 'KIRO_SPEC_MERGED',
            });
          }

          // Add metadata header
          const fullContent = this.addMarkdownMetadata(contentToWrite, {
            title: spec.name,
            type: spec.type,
            status: spec.status,
            dependencies: spec.dependencies,
            created_at: spec.created_at,
            updated_at: new Date().toISOString(),
          });

          await this.writeTextFile(filePath, fullContent);
          this.logger.debug(`Spec document deployed: ${fileName}`);
          return { fileName, success: true, warnings: warningsToAdd };
        } catch (error) {
          const errorMessage = `Failed to deploy spec document ${spec.name}: ${(error as Error).message}`;
          return {
            fileName: this.sanitizeFileName(`${spec.name}.md`),
            success: false,
            error: {
              message: errorMessage,
              code: 'KIRO_SPEC_DEPLOY_ERROR',
              severity: 'error' as const,
            },
          };
        }
      });

      const results = await Promise.allSettled(deploymentPromises);

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const {
            fileName,
            success,
            warnings: resultWarnings,
            error,
          } = result.value;
          if (success) {
            deployedFiles.push(fileName);
          }
          if (resultWarnings) {
            warnings.push(...resultWarnings);
          }
          if (error) {
            errors.push(error);
          }
        } else {
          errors.push({
            message: `Deployment promise rejected: ${result.reason}`,
            code: 'KIRO_SPEC_DEPLOY_ERROR',
            severity: 'error',
          });
        }
      });
    } catch (error) {
      const errorMessage = `Failed to deploy spec documents: ${(error as Error).message}`;
      this.logger.error(errorMessage);
      errors.push({
        message: errorMessage,
        code: 'KIRO_SPEC_DEPLOY_ERROR',
        severity: 'error',
      });
    }

    return {
      deployedFiles,
      errors,
      warnings,
    };
  }

  /**
   * Deploy hooks to .kiro/hooks/
   */
  async deployHooks(
    hooks: KiroHookConfiguration[],
    context: KiroDeploymentContext,
    options: KiroDeploymentOptions,
  ): Promise<{
    deployedFiles: string[];
    errors: DeploymentError[];
    warnings: DeploymentWarning[];
  }> {
    this.logger.debug(`Deploying ${hooks.length} hooks`);

    const deployedFiles: string[] = [];
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];

    try {
      await this.ensureDirectoryExists(context.paths.hooksDirectory);

      // Deploy all hooks in parallel
      const deploymentPromises = hooks.map(async (hook) => {
        try {
          const fileName = this.sanitizeFileName(`${hook.name}.json`);
          const filePath = path.join(context.paths.hooksDirectory, fileName);

          // Check for existing hook
          const existingHook = await this.loadExistingJsonFile(filePath);
          let hookToWrite = hook;

          if (existingHook && options.conflictStrategy !== 'overwrite') {
            if (options.conflictStrategy === 'merge-intelligent') {
              hookToWrite = {
                ...(existingHook as KiroHookConfiguration),
                ...hook,
              };
              return {
                fileName,
                success: true,
                warning: {
                  message: `Merged existing hook: ${fileName}`,
                  code: 'KIRO_HOOK_MERGED',
                },
              };
            } else if (options.conflictStrategy === 'skip') {
              return {
                fileName,
                success: false,
                warning: {
                  message: `Skipped existing hook: ${fileName}`,
                  code: 'KIRO_HOOK_SKIPPED',
                },
              };
            }
          }

          await this.writeJsonFile(filePath, hookToWrite);
          this.logger.debug(`Hook deployed: ${fileName}`);
          return { fileName, success: true };
        } catch (error) {
          const errorMessage = `Failed to deploy hook ${hook.name}: ${(error as Error).message}`;
          return {
            fileName: this.sanitizeFileName(`${hook.name}.json`),
            success: false,
            error: {
              message: errorMessage,
              code: 'KIRO_HOOK_DEPLOY_ERROR',
              severity: 'error' as const,
            },
          };
        }
      });

      const results = await Promise.allSettled(deploymentPromises);

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const { fileName, success, warning, error } = result.value;
          if (success) {
            deployedFiles.push(fileName);
          }
          if (warning) {
            warnings.push(warning);
          }
          if (error) {
            errors.push(error);
          }
        } else {
          errors.push({
            message: `Deployment promise rejected: ${result.reason}`,
            code: 'KIRO_HOOK_DEPLOY_ERROR',
            severity: 'error',
          });
        }
      });
    } catch (error) {
      const errorMessage = `Failed to deploy hooks: ${(error as Error).message}`;
      this.logger.error(errorMessage);
      errors.push({
        message: errorMessage,
        code: 'KIRO_HOOK_DEPLOY_ERROR',
        severity: 'error',
      });
    }

    return {
      deployedFiles,
      errors,
      warnings,
    };
  }

  /**
   * Deploy agents to ~/.kiro/agents/
   */
  async deployAgents(
    agents: KiroAgentConfiguration[],
    context: KiroDeploymentContext,
    options: KiroDeploymentOptions,
  ): Promise<{
    deployedFiles: string[];
    errors: DeploymentError[];
    warnings: DeploymentWarning[];
  }> {
    this.logger.debug(`Deploying ${agents.length} agents`);

    const deployedFiles: string[] = [];
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];

    try {
      await this.ensureDirectoryExists(context.paths.agentsDirectory);

      // Deploy all agents in parallel
      const deploymentPromises = agents.map(async (agent) => {
        try {
          const fileName = this.sanitizeFileName(`${agent.name}.json`);
          const filePath = path.join(context.paths.agentsDirectory, fileName);

          // Check for existing agent
          const existingAgent = await this.loadExistingJsonFile(filePath);
          let agentToWrite = agent;

          if (existingAgent && options.conflictStrategy !== 'overwrite') {
            if (options.conflictStrategy === 'merge-intelligent') {
              agentToWrite = {
                ...(existingAgent as KiroAgentConfiguration),
                ...agent,
              };
              return {
                fileName,
                success: true,
                warning: {
                  message: `Merged existing agent: ${fileName}`,
                  code: 'KIRO_AGENT_MERGED',
                },
              };
            } else if (options.conflictStrategy === 'skip') {
              return {
                fileName,
                success: false,
                warning: {
                  message: `Skipped existing agent: ${fileName}`,
                  code: 'KIRO_AGENT_SKIPPED',
                },
              };
            }
          }

          await this.writeJsonFile(filePath, agentToWrite);
          this.logger.debug(`Agent deployed: ${fileName}`);
          return { fileName, success: true };
        } catch (error) {
          const errorMessage = `Failed to deploy agent ${agent.name}: ${(error as Error).message}`;
          return {
            fileName: this.sanitizeFileName(`${agent.name}.json`),
            success: false,
            error: {
              message: errorMessage,
              code: 'KIRO_AGENT_DEPLOY_ERROR',
              severity: 'error' as const,
            },
          };
        }
      });

      const results = await Promise.allSettled(deploymentPromises);

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const { fileName, success, warning, error } = result.value;
          if (success) {
            deployedFiles.push(fileName);
          }
          if (warning) {
            warnings.push(warning);
          }
          if (error) {
            errors.push(error);
          }
        } else {
          errors.push({
            message: `Deployment promise rejected: ${result.reason}`,
            code: 'KIRO_AGENT_DEPLOY_ERROR',
            severity: 'error',
          });
        }
      });
    } catch (error) {
      const errorMessage = `Failed to deploy agents: ${(error as Error).message}`;
      this.logger.error(errorMessage);
      errors.push({
        message: errorMessage,
        code: 'KIRO_AGENT_DEPLOY_ERROR',
        severity: 'error',
      });
    }

    return {
      deployedFiles,
      errors,
      warnings,
    };
  }

  /**
   * Deploy templates to ~/.kiro/templates/
   */
  async deployTemplates(
    templates: KiroTemplateConfiguration[],
    context: KiroDeploymentContext,
    options: KiroDeploymentOptions,
  ): Promise<{
    deployedFiles: string[];
    errors: DeploymentError[];
    warnings: DeploymentWarning[];
  }> {
    this.logger.debug(`Deploying ${templates.length} templates`);

    const deployedFiles: string[] = [];
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];

    try {
      await this.ensureDirectoryExists(context.paths.templatesDirectory);

      // Deploy all templates in parallel
      const deploymentPromises = templates.map(async (template) => {
        try {
          const fileName = this.sanitizeFileName(`${template.name}.json`);
          const filePath = path.join(
            context.paths.templatesDirectory,
            fileName,
          );

          // Check for existing template
          const existingTemplate = await this.loadExistingJsonFile(filePath);
          let templateToWrite = template;

          if (existingTemplate && options.conflictStrategy !== 'overwrite') {
            if (options.conflictStrategy === 'merge-intelligent') {
              templateToWrite = {
                ...(existingTemplate as KiroTemplateConfiguration),
                ...template,
              };
              return {
                fileName,
                success: true,
                warning: {
                  message: `Merged existing template: ${fileName}`,
                  code: 'KIRO_TEMPLATE_MERGED',
                },
              };
            } else if (options.conflictStrategy === 'skip') {
              return {
                fileName,
                success: false,
                warning: {
                  message: `Skipped existing template: ${fileName}`,
                  code: 'KIRO_TEMPLATE_SKIPPED',
                },
              };
            }
          }

          await this.writeJsonFile(filePath, templateToWrite);
          this.logger.debug(`Template deployed: ${fileName}`);
          return { fileName, success: true };
        } catch (error) {
          const errorMessage = `Failed to deploy template ${template.name}: ${(error as Error).message}`;
          return {
            fileName: this.sanitizeFileName(`${template.name}.json`),
            success: false,
            error: {
              message: errorMessage,
              code: 'KIRO_TEMPLATE_DEPLOY_ERROR',
              severity: 'error' as const,
            },
          };
        }
      });

      const results = await Promise.allSettled(deploymentPromises);

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const { fileName, success, warning, error } = result.value;
          if (success) {
            deployedFiles.push(fileName);
          }
          if (warning) {
            warnings.push(warning);
          }
          if (error) {
            errors.push(error);
          }
        } else {
          errors.push({
            message: `Deployment promise rejected: ${result.reason}`,
            code: 'KIRO_TEMPLATE_DEPLOY_ERROR',
            severity: 'error',
          });
        }
      });
    } catch (error) {
      const errorMessage = `Failed to deploy templates: ${(error as Error).message}`;
      this.logger.error(errorMessage);
      errors.push({
        message: errorMessage,
        code: 'KIRO_TEMPLATE_DEPLOY_ERROR',
        severity: 'error',
      });
    }

    return {
      deployedFiles,
      errors,
      warnings,
    };
  }

  // Helper methods

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
      this.logger.debug(`Created directory: ${dirPath}`);
    }
  }

  private async writeJsonFile(filePath: string, data: unknown): Promise<void> {
    const jsonContent = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, jsonContent, 'utf8');
  }

  private async writeTextFile(
    filePath: string,
    content: string,
  ): Promise<void> {
    await fs.writeFile(filePath, content, 'utf8');
  }

  private async loadExistingSettings(
    filePath: string,
  ): Promise<unknown | null> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async loadExistingMarkdown(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch {
      return null;
    }
  }

  private async loadExistingJsonFile(
    filePath: string,
  ): Promise<unknown | null> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private mergeSettings(
    existing: unknown,
    incoming: unknown,
    strategy: KiroMergeStrategy,
  ): unknown {
    if (strategy === 'deep-merge') {
      return this.deepMerge(
        existing as Record<string, unknown>,
        incoming as Record<string, unknown>,
      );
    } else if (strategy === 'array-append') {
      return this.arrayAppendMerge(
        existing as Record<string, unknown>,
        incoming as Record<string, unknown>,
      );
    }
    return incoming; // Default to overwrite
  }

  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...target };

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key])
        ) {
          result[key] = this.deepMerge(
            (result[key] as Record<string, unknown>) || {},
            source[key] as Record<string, unknown>,
          );
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  private arrayAppendMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...target };

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (Array.isArray(source[key]) && Array.isArray(target[key])) {
          result[key] = [...target[key], ...source[key]];
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  private mergeMarkdownContent(existing: string, incoming: string): string {
    // Simple merge strategy: append new content after existing
    return `${existing}\n\n---\n\n${incoming}`;
  }

  private preserveTaskStatus(existing: string, incoming: string): string {
    // Extract completed tasks from existing content
    const existingTasks = this.extractCompletedTasks(existing);
    let result = incoming;

    // Replace corresponding tasks in incoming content with completed status
    existingTasks.forEach((task) => {
      const regex = new RegExp(
        `^(\\s*)- \\[ \\] (.*)${task.title.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&')}(.*)$`,
        'gm',
      );
      result = result.replace(regex, `$1- [x] $2${task.title}$3`);
    });

    return result;
  }

  private extractCompletedTasks(content: string): Array<{ title: string }> {
    const completedTaskRegex = /^\s*- \[x] (.+)$/gm;
    const tasks: Array<{ title: string }> = [];
    let match;

    while ((match = completedTaskRegex.exec(content)) !== null) {
      tasks.push({ title: match[1].trim() });
    }

    return tasks;
  }

  private addMarkdownMetadata(
    content: string,
    metadata: Record<string, unknown>,
  ): string {
    const frontMatter = Object.entries(metadata)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}:\n${value.map((v) => `  - ${v}`).join('\n')}`;
        }
        return `${key}: ${value}`;
      })
      .join('\n');

    return `---\n${frontMatter}\n---\n\n${content}`;
  }

  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/["*/:<>?\\|]/g, '-')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }
}
