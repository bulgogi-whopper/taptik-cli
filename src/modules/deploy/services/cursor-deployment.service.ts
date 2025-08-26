import { Injectable, Logger } from '@nestjs/common';
import { 
  CursorDeploymentOptions, 
  CursorDeploymentResult, 
  ICursorDeploymentService,
  CursorComponentType,
} from '../interfaces/cursor-deployment.interface';
import { DeploymentError, DeploymentWarning } from '../interfaces/deployment-result.interface';
import { TaptikContext } from '../interfaces/taptik-context.interface';
import { CursorTransformerService } from './cursor-transformer.service';
import { CursorValidatorService } from './cursor-validator.service';
import { CursorFileWriterService } from './cursor-file-writer.service';
import { CursorInstallationDetectorService } from './cursor-installation-detector.service';
import { ALL_CURSOR_COMPONENT_TYPES } from '../constants/cursor.constants';

/**
 * Task 6.1: Main Cursor deployment service orchestration
 */
@Injectable()
export class CursorDeploymentService implements ICursorDeploymentService {
  private readonly logger = new Logger(CursorDeploymentService.name);

  constructor(
    private readonly transformerService: CursorTransformerService,
    private readonly validatorService: CursorValidatorService,
    private readonly fileWriterService: CursorFileWriterService,
    private readonly installationDetectorService: CursorInstallationDetectorService,
  ) {}

  /**
   * Main deployment orchestration method
   */
  async deploy(options: CursorDeploymentOptions): Promise<CursorDeploymentResult> {
    this.logger.log(`Starting Cursor deployment with options: ${JSON.stringify(options, null, 2)}`);

    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];
    const deployedComponents: CursorComponentType[] = [];
    const skippedComponents: CursorComponentType[] = [];
    const configurationFiles: CursorDeploymentResult['configurationFiles'] = {};
    
    try {
      // Step 1: Pre-deployment validation
      this.logger.log('Step 1: Running pre-deployment validation...');
      const isValidDeployment = await this.validateDeployment(options);
      if (!isValidDeployment) {
        errors.push({
          component: 'deployment',
          type: 'configuration',
          severity: 'high',
          message: 'Pre-deployment validation failed',
          suggestion: 'Check deployment options and system requirements',
        });
        
        return this.buildFailureResult(options, errors, warnings, deployedComponents, skippedComponents, configurationFiles);
      }

      // Step 2: Detect Cursor installation
      this.logger.log('Step 2: Detecting Cursor installation...');
      const cursorPath = options.cursorPath || await this.detectCursorInstallation();
      if (!cursorPath) {
        errors.push({
          component: 'cursor-installation',
          type: 'system',
          severity: 'high',
          message: 'Cursor IDE installation not found',
          suggestion: 'Install Cursor IDE or provide cursorPath in options',
        });
        
        return this.buildFailureResult(options, errors, warnings, deployedComponents, skippedComponents, configurationFiles);
      }

      const deploymentOptionsWithPath = { ...options, cursorPath };

      // Step 3: Process each component type
      this.logger.log('Step 3: Processing components...');
      const componentTypes = this.getComponentTypesToDeploy(options);
      
      for (const componentType of componentTypes) {
        try {
          this.logger.log(`Processing component: ${componentType}`);
          
          if (this.shouldSkipComponent(componentType, options)) {
            skippedComponents.push(componentType);
            this.logger.log(`Skipping component: ${componentType}`);
            continue;
          }

          const componentResult = await this.deployComponent(componentType, deploymentOptionsWithPath);
          
          if (componentResult.success) {
            deployedComponents.push(componentType);
            this.updateConfigurationFiles(configurationFiles, componentType, componentResult);
            this.logger.log(`Successfully deployed component: ${componentType}`);
          } else {
            errors.push(...componentResult.errors);
            this.logger.warn(`Failed to deploy component: ${componentType}`);
          }
          
          warnings.push(...componentResult.warnings);

        } catch (componentError) {
          this.logger.error(`Error deploying component ${componentType}:`, componentError);
          errors.push({
            component: componentType,
            type: 'deployment',
            severity: 'high',
            message: `Failed to deploy ${componentType}: ${(componentError as Error).message}`,
            suggestion: `Check ${componentType} configuration and retry`,
          });
        }
      }

      // Step 4: Build and return result
      this.logger.log('Step 4: Building deployment result...');
      const hasErrors = errors.length > 0;
      const success = !hasErrors && deployedComponents.length > 0;

      const result: CursorDeploymentResult = {
        success,
        platform: 'cursor',
        cursorPath,
        workspacePath: options.workspacePath,
        deployedComponents,
        skippedComponents,
        configurationFiles,
        errors,
        warnings,
        deploymentId: this.generateDeploymentId(),
        timestamp: new Date().toISOString(),
      };

      this.logger.log(`Deployment ${success ? 'completed successfully' : 'completed with errors'}. Deployed: ${deployedComponents.length}, Skipped: ${skippedComponents.length}, Errors: ${errors.length}`);
      
      return result;

    } catch (error) {
      this.logger.error('Deployment failed with critical error:', error);
      errors.push({
        component: 'deployment',
        type: 'system',
        severity: 'critical',
        message: `Critical deployment failure: ${(error as Error).message}`,
        suggestion: 'Check system configuration and retry deployment',
      });

      return this.buildFailureResult(options, errors, warnings, deployedComponents, skippedComponents, configurationFiles);
    }
  }

  /**
   * Validate deployment before execution
   */
  async validateDeployment(options: CursorDeploymentOptions): Promise<boolean> {
    this.logger.log('Validating deployment configuration...');

    try {
      // Basic options validation
      if (!options.platform || options.platform !== 'cursor') {
        this.logger.error('Invalid platform specified');
        return false;
      }

      // Component validation
      const componentTypes = this.getComponentTypesToDeploy(options);
      if (componentTypes.length === 0) {
        this.logger.error('No components specified for deployment');
        return false;
      }

      // Workspace path validation (if required by any component)
      const requiresWorkspace = componentTypes.some(type => 
        ['debug-config', 'tasks-config', 'workspace-config'].includes(type)
      );
      
      if (requiresWorkspace && !options.workspacePath) {
        this.logger.error('Workspace path is required for the specified components');
        return false;
      }

      // System requirements validation
      const systemValidation = await this.validateSystemRequirements();
      if (!systemValidation) {
        this.logger.error('System requirements validation failed');
        return false;
      }

      this.logger.log('Deployment validation passed');
      return true;

    } catch (error) {
      this.logger.error('Deployment validation failed:', error);
      return false;
    }
  }

  /**
   * Preview deployment without executing (dry-run)
   */
  async previewDeployment(options: CursorDeploymentOptions): Promise<CursorDeploymentResult> {
    this.logger.log('Starting deployment preview (dry-run)...');

    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];
    const deployedComponents: CursorComponentType[] = [];
    const skippedComponents: CursorComponentType[] = [];
    const configurationFiles: CursorDeploymentResult['configurationFiles'] = {};

    try {
      // Validate deployment options
      const isValid = await this.validateDeployment(options);
      if (!isValid) {
        errors.push({
          component: 'deployment',
          type: 'configuration',
          severity: 'high',
          message: 'Deployment validation failed in preview',
          suggestion: 'Fix configuration issues before deployment',
        });
      }

      // Detect Cursor installation
      const cursorPath = options.cursorPath || await this.detectCursorInstallation();
      const componentTypes = this.getComponentTypesToDeploy(options);

      // Simulate component processing
      for (const componentType of componentTypes) {
        if (this.shouldSkipComponent(componentType, options)) {
          skippedComponents.push(componentType);
        } else {
          // Preview component deployment
          const previewResult = await this.previewComponentDeployment(componentType, options);
          
          if (previewResult.wouldSucceed) {
            deployedComponents.push(componentType);
            this.simulateConfigurationFiles(configurationFiles, componentType);
          } else {
            errors.push(...previewResult.errors);
          }
          
          warnings.push(...previewResult.warnings);
        }
      }

      const result: CursorDeploymentResult = {
        success: errors.length === 0 && deployedComponents.length > 0,
        platform: 'cursor',
        cursorPath: cursorPath || 'not-detected',
        workspacePath: options.workspacePath,
        deployedComponents,
        skippedComponents,
        configurationFiles,
        errors,
        warnings,
        deploymentId: 'preview-' + this.generateDeploymentId(),
        timestamp: new Date().toISOString(),
        preview: true,
      };

      this.logger.log(`Preview completed. Would deploy: ${deployedComponents.length}, Would skip: ${skippedComponents.length}, Potential errors: ${errors.length}`);
      
      return result;

    } catch (error) {
      this.logger.error('Preview failed:', error);
      errors.push({
        component: 'deployment',
        type: 'system',
        severity: 'high',
        message: `Preview failed: ${(error as Error).message}`,
        suggestion: 'Check system configuration',
      });

      return this.buildFailureResult(options, errors, warnings, deployedComponents, skippedComponents, configurationFiles, true);
    }
  }

  /**
   * Rollback deployment (placeholder for Task 6.2)
   */
  async rollback(deploymentId: string): Promise<void> {
    this.logger.log(`Rollback requested for deployment: ${deploymentId}`);
    throw new Error('Rollback functionality will be implemented in Task 6.2');
  }

  /**
   * Deploy individual component
   */
  private async deployComponent(
    componentType: CursorComponentType, 
    options: CursorDeploymentOptions
  ): Promise<{ success: boolean; errors: DeploymentError[]; warnings: DeploymentWarning[]; filePath?: string; bytesWritten?: number }> {
    
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];

    try {
      // Transform mock context for the component (in real implementation, this would come from TaptikContext)
      const mockContext = this.createMockContext();
      
      switch (componentType) {
        case 'global-settings':
          const globalSettings = this.transformerService.transformPersonalContext(mockContext.personalContext);
          return await this.fileWriterService.writeSettings(globalSettings, options);

        case 'project-settings':
          const projectSettings = this.transformerService.transformProjectContext(mockContext.projectContext);
          return await this.fileWriterService.writeSettings(projectSettings, options);

        case 'ai-config':
          const aiConfig = this.transformerService.transformAIRules(['Use TypeScript best practices', 'Follow clean code principles']);
          return await this.fileWriterService.writeAIConfig(aiConfig, options);

        case 'extensions-config':
          const extensionsConfig = { recommendations: ['ms-vscode.vscode-typescript-next'] };
          return await this.fileWriterService.writeExtensions(extensionsConfig, options);

        case 'debug-config':
          const debugConfig = this.transformerService.transformDebugConfigurations([
            { name: 'Launch Program', type: 'node', request: 'launch', program: '${workspaceFolder}/dist/main.js' }
          ]);
          return await this.fileWriterService.writeDebugConfig(debugConfig, options);

        case 'tasks-config':
          const tasksConfig = this.transformerService.transformBuildTasks([
            { name: 'build', command: 'npm run build', group: 'build' }
          ]);
          return await this.fileWriterService.writeTasks(tasksConfig, options);

        case 'snippets-config':
          const snippetsConfig = this.transformerService.transformCodeSnippets([
            { language: 'typescript', name: 'console.log', prefix: 'log', body: 'console.log($1);' }
          ]);
          return await this.fileWriterService.writeSnippets(snippetsConfig, options);

        case 'workspace-config':
          const workspaceConfig = this.transformerService.transformWorkspaceSettings({
            folders: [{ path: '.', name: 'Root' }],
            settings: { 'editor.tabSize': 2 }
          });
          return await this.fileWriterService.writeWorkspace(workspaceConfig, options);

        default:
          errors.push({
            component: componentType,
            type: 'configuration',
            severity: 'high',
            message: `Unsupported component type: ${componentType}`,
            suggestion: 'Check component type spelling and supported components',
          });
          return { success: false, errors, warnings };
      }

    } catch (error) {
      errors.push({
        component: componentType,
        type: 'deployment',
        severity: 'high',
        message: `Failed to deploy component: ${(error as Error).message}`,
        suggestion: `Check ${componentType} configuration and system permissions`,
      });
      
      return { success: false, errors, warnings };
    }
  }

  /**
   * Preview individual component deployment
   */
  private async previewComponentDeployment(
    componentType: CursorComponentType,
    options: CursorDeploymentOptions
  ): Promise<{ wouldSucceed: boolean; errors: DeploymentError[]; warnings: DeploymentWarning[] }> {
    
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];

    try {
      // Basic validation without actual file operations
      switch (componentType) {
        case 'global-settings':
        case 'project-settings':
          // These should generally succeed
          break;

        case 'ai-config':
          warnings.push({
            component: componentType,
            type: 'preview',
            message: 'AI configuration will be created',
            suggestion: 'Review AI rules and context before deployment',
          });
          break;

        case 'debug-config':
        case 'tasks-config':
        case 'workspace-config':
          if (!options.workspacePath) {
            errors.push({
              component: componentType,
              type: 'configuration',
              severity: 'high',
              message: `${componentType} requires workspace path`,
              suggestion: 'Provide workspacePath in deployment options',
            });
          }
          break;

        case 'extensions-config':
        case 'snippets-config':
          // These should generally succeed
          break;

        default:
          errors.push({
            component: componentType,
            type: 'configuration',
            severity: 'high',
            message: `Unsupported component type in preview: ${componentType}`,
            suggestion: 'Check component type spelling',
          });
      }

      return { wouldSucceed: errors.length === 0, errors, warnings };

    } catch (error) {
      errors.push({
        component: componentType,
        type: 'system',
        severity: 'high',
        message: `Preview failed for ${componentType}: ${(error as Error).message}`,
        suggestion: 'Check system configuration',
      });
      
      return { wouldSucceed: false, errors, warnings };
    }
  }

  /**
   * Get component types to deploy
   */
  private getComponentTypesToDeploy(options: CursorDeploymentOptions): CursorComponentType[] {
    if (options.components && options.components.length > 0) {
      return options.components;
    }
    
    // Default components if none specified
    return ALL_CURSOR_COMPONENT_TYPES.filter(type => 
      !options.skipComponents?.includes(type)
    );
  }

  /**
   * Check if component should be skipped
   */
  private shouldSkipComponent(componentType: CursorComponentType, options: CursorDeploymentOptions): boolean {
    // Check explicit skip list
    if (options.skipComponents?.includes(componentType)) {
      return true;
    }

    // Check option-based skips
    if (componentType === 'extensions-config' && options.skipExtensions) {
      return true;
    }
    if (componentType === 'debug-config' && options.skipDebugConfig) {
      return true;
    }
    if (componentType === 'tasks-config' && options.skipTasks) {
      return true;
    }
    if (componentType === 'snippets-config' && options.skipSnippets) {
      return true;
    }
    if (componentType === 'ai-config' && !options.aiConfig) {
      return true;
    }
    if (componentType === 'global-settings' && !options.globalSettings) {
      return true;
    }
    if (componentType === 'project-settings' && !options.projectSettings) {
      return true;
    }

    return false;
  }

  /**
   * Detect Cursor installation
   */
  private async detectCursorInstallation(): Promise<string | null> {
    try {
      if (!this.installationDetectorService) {
        this.logger.error('Installation detector service not available');
        return null;
      }
      return await this.installationDetectorService.detectCursorInstallation();
    } catch (error) {
      this.logger.error('Failed to detect Cursor installation:', error);
      return null;
    }
  }

  /**
   * Validate system requirements
   */
  private async validateSystemRequirements(): Promise<boolean> {
    try {
      // Check if we can access file system
      const fs = await import('fs/promises');
      await fs.access(process.cwd());
      
      return true;
    } catch (error) {
      this.logger.error('System requirements validation failed:', error);
      return false;
    }
  }

  /**
   * Update configuration files tracking
   */
  private updateConfigurationFiles(
    configurationFiles: CursorDeploymentResult['configurationFiles'],
    componentType: CursorComponentType,
    result: { filePath?: string }
  ): void {
    if (!result.filePath) return;

    switch (componentType) {
      case 'global-settings':
        configurationFiles.globalSettings = result.filePath;
        break;
      case 'project-settings':
        configurationFiles.projectSettings = result.filePath;
        break;
      case 'ai-config':
        configurationFiles.aiConfig = configurationFiles.aiConfig || [];
        configurationFiles.aiConfig.push(result.filePath);
        break;
      case 'extensions-config':
        configurationFiles.extensionsConfig = result.filePath;
        break;
      case 'debug-config':
        configurationFiles.debugConfig = result.filePath;
        break;
      case 'tasks-config':
        configurationFiles.tasksConfig = result.filePath;
        break;
      case 'snippets-config':
        configurationFiles.snippetsConfig = configurationFiles.snippetsConfig || [];
        configurationFiles.snippetsConfig.push(result.filePath);
        break;
      case 'workspace-config':
        configurationFiles.workspaceConfig = result.filePath;
        break;
    }
  }

  /**
   * Simulate configuration files for preview
   */
  private simulateConfigurationFiles(
    configurationFiles: CursorDeploymentResult['configurationFiles'],
    componentType: CursorComponentType
  ): void {
    const basePath = '/simulated/cursor/config';
    
    switch (componentType) {
      case 'global-settings':
        configurationFiles.globalSettings = `${basePath}/User/settings.json`;
        break;
      case 'project-settings':
        configurationFiles.projectSettings = `${basePath}/workspace/.vscode/settings.json`;
        break;
      case 'ai-config':
        configurationFiles.aiConfig = [`${basePath}/.cursorrules`];
        break;
      case 'extensions-config':
        configurationFiles.extensionsConfig = `${basePath}/User/extensions.json`;
        break;
      case 'debug-config':
        configurationFiles.debugConfig = `${basePath}/workspace/.vscode/launch.json`;
        break;
      case 'tasks-config':
        configurationFiles.tasksConfig = `${basePath}/workspace/.vscode/tasks.json`;
        break;
      case 'snippets-config':
        configurationFiles.snippetsConfig = [`${basePath}/User/snippets/typescript.json`];
        break;
      case 'workspace-config':
        configurationFiles.workspaceConfig = `${basePath}/workspace/project.code-workspace`;
        break;
    }
  }

  /**
   * Build failure result
   */
  private buildFailureResult(
    options: CursorDeploymentOptions,
    errors: DeploymentError[],
    warnings: DeploymentWarning[],
    deployedComponents: CursorComponentType[],
    skippedComponents: CursorComponentType[],
    configurationFiles: CursorDeploymentResult['configurationFiles'],
    isPreview = false
  ): CursorDeploymentResult {
    return {
      success: false,
      platform: 'cursor',
      cursorPath: options.cursorPath || 'unknown',
      workspacePath: options.workspacePath,
      deployedComponents,
      skippedComponents,
      configurationFiles,
      errors,
      warnings,
      deploymentId: (isPreview ? 'preview-' : '') + this.generateDeploymentId(),
      timestamp: new Date().toISOString(),
      preview: isPreview,
    };
  }

  /**
   * Generate unique deployment ID
   */
  private generateDeploymentId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `cursor-${timestamp}-${random}`;
  }

  /**
   * Create mock context for testing (will be replaced with real TaptikContext)
   */
  private createMockContext(): TaptikContext {
    return {
      personalContext: {
        userPreferences: {
          theme: 'dark',
          fontSize: 14,
          tabSize: 2,
        },
        shortcuts: [],
        customizations: {},
      },
      projectContext: {
        projectSettings: {
          name: 'Test Project',
          type: 'typescript',
        },
        buildConfiguration: {},
        debugConfiguration: {},
        taskConfiguration: {},
      },
      promptTemplates: [],
    };
  }
}