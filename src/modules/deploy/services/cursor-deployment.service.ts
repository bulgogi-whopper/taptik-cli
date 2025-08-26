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
import { CursorBackupService } from './cursor-backup.service';
import { CursorConflictResolverService } from './cursor-conflict-resolver.service';
import { CursorDeploymentStateService } from './cursor-deployment-state.service';
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
    private readonly backupService: CursorBackupService,
    private readonly conflictResolver: CursorConflictResolverService,
    private readonly stateManager: CursorDeploymentStateService,
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

      // Step 3: Initialize deployment state tracking
      this.logger.log('Step 3: Initializing deployment state...');
      const componentTypes = this.getComponentTypesToDeploy(options);
      
      await this.stateManager.saveDeploymentState(this.generateDeploymentId(), deploymentOptionsWithPath, {
        status: 'initializing',
        startedAt: new Date().toISOString(),
        completedComponents: [],
        failedComponents: [],
        inProgressComponents: [],
        componentErrors: {},
      });

      // Step 4: Create backup before deployment
      this.logger.log('Step 4: Creating backup...');
      const backupResult = await this.backupService.createBackup(
        this.generateDeploymentId(),
        deploymentOptionsWithPath,
        componentTypes
      );
      
      if (!backupResult.success) {
        warnings.push(...backupResult.warnings);
        // Continue with deployment even if backup fails, but warn user
        warnings.push({
          component: 'backup-system',
          type: 'backup',
          message: 'Failed to create complete backup before deployment',
          suggestion: 'Deployment will continue, but rollback may be limited',
        });
      }

      // Step 5: Process each component type with conflict resolution
      this.logger.log('Step 5: Processing components with conflict resolution...');
      
      for (const componentType of componentTypes) {
        try {
          this.logger.log(`Processing component: ${componentType}`);
          
          if (this.shouldSkipComponent(componentType, options)) {
            skippedComponents.push(componentType);
            this.logger.log(`Skipping component: ${componentType}`);
            continue;
          }

          // Update state: component started
          await this.stateManager.updateDeploymentProgress(
            this.generateDeploymentId(),
            componentType,
            'started'
          );

          const componentResult = await this.deployComponentWithConflictResolution(
            componentType, 
            deploymentOptionsWithPath
          );
          
          if (componentResult.success) {
            deployedComponents.push(componentType);
            this.updateConfigurationFiles(configurationFiles, componentType, componentResult);
            this.logger.log(`Successfully deployed component: ${componentType}`);
            
            // Update state: component completed
            await this.stateManager.updateDeploymentProgress(
              this.generateDeploymentId(),
              componentType,
              'completed'
            );
          } else {
            errors.push(...componentResult.errors);
            this.logger.warn(`Failed to deploy component: ${componentType}`);
            
            // Update state: component failed
            await this.stateManager.updateDeploymentProgress(
              this.generateDeploymentId(),
              componentType,
              'failed',
              componentResult.errors[0]
            );
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
   * Rollback deployment using backup
   */
  async rollback(deploymentId: string): Promise<CursorRollbackResult> {
    this.logger.log(`Starting rollback for deployment: ${deploymentId}`);

    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];
    const rolledBackComponents: CursorComponentType[] = [];

    try {
      // Get backup list and find backup for this deployment
      const backups = await this.backupService.listBackups();
      const deploymentBackup = backups.find(backup => backup.deploymentId === deploymentId);

      if (!deploymentBackup) {
        errors.push({
          component: 'rollback-system',
          type: 'rollback',
          severity: 'high',
          message: `No backup found for deployment: ${deploymentId}`,
          suggestion: 'Cannot rollback without backup. Check if backup was created during deployment.',
        });
        
        return {
          success: false,
          deploymentId,
          rolledBackComponents: [],
          errors,
          warnings,
          rollbackId: this.generateRollbackId(deploymentId),
          timestamp: new Date().toISOString(),
        };
      }

      this.logger.log(`Found backup for rollback: ${deploymentBackup.backupId}`);

      // Restore from backup
      const restoreResult = await this.backupService.restoreFromBackup(deploymentBackup.backupId);
      
      if (restoreResult.success) {
        // Determine which components were rolled back based on restored files
        const restoredComponents = this.determineRolledBackComponents(restoreResult.restoredFiles);
        rolledBackComponents.push(...restoredComponents);
        
        this.logger.log(`Rollback completed successfully: ${rolledBackComponents.length} components restored`);
        
        return {
          success: true,
          deploymentId,
          rolledBackComponents,
          errors: restoreResult.errors,
          warnings: [...warnings, ...restoreResult.warnings],
          rollbackId: this.generateRollbackId(deploymentId),
          timestamp: new Date().toISOString(),
          backupId: deploymentBackup.backupId,
          restoredFiles: restoreResult.restoredFiles,
        };
      } else {
        errors.push(...restoreResult.errors);
        warnings.push(...restoreResult.warnings);
        
        return {
          success: false,
          deploymentId,
          rolledBackComponents,
          errors,
          warnings,
          rollbackId: this.generateRollbackId(deploymentId),
          timestamp: new Date().toISOString(),
          backupId: deploymentBackup.backupId,
        };
      }

    } catch (error) {
      this.logger.error('Rollback failed with critical error:', error);
      errors.push({
        component: 'rollback-system',
        type: 'system',
        severity: 'critical',
        message: `Rollback failed: ${(error as Error).message}`,
        suggestion: 'Check system state and try manual recovery',
      });

      return {
        success: false,
        deploymentId,
        rolledBackComponents,
        errors,
        warnings,
        rollbackId: this.generateRollbackId(deploymentId),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Deploy individual component with conflict resolution
   */
  private async deployComponentWithConflictResolution(
    componentType: CursorComponentType, 
    options: CursorDeploymentOptions
  ): Promise<{ success: boolean; errors: DeploymentError[]; warnings: DeploymentWarning[]; filePath?: string; bytesWritten?: number }> {
    
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];

    try {
      // Step 1: Transform component configuration
      const transformedConfig = await this.transformComponentConfiguration(componentType, options);
      
      // Step 2: Resolve conflicts with existing configuration
      const conflictResolution = await this.conflictResolver.resolveConfigurationConflicts(
        componentType,
        transformedConfig,
        options
      );
      
      // Add conflict warnings
      warnings.push(...conflictResolution.warnings);
      errors.push(...conflictResolution.errors);
      
      if (conflictResolution.errors.length > 0) {
        return { success: false, errors, warnings };
      }

      // Step 3: Deploy resolved configuration
      return await this.deployComponent(componentType, options, conflictResolution.resolvedConfig);

    } catch (error) {
      errors.push({
        component: componentType,
        type: 'deployment',
        severity: 'high',
        message: `Failed to deploy component with conflict resolution: ${(error as Error).message}`,
        suggestion: `Check ${componentType} configuration and system permissions`,
      });
      
      return { success: false, errors, warnings };
    }
  }

  /**
   * Deploy individual component
   */
  private async deployComponent(
    componentType: CursorComponentType, 
    options: CursorDeploymentOptions,
    resolvedConfig?: any
  ): Promise<{ success: boolean; errors: DeploymentError[]; warnings: DeploymentWarning[]; filePath?: string; bytesWritten?: number }> {
    
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];

    try {
      // Use resolved config if provided, otherwise transform from context
      const configToWrite = resolvedConfig || await this.transformComponentConfiguration(componentType, options);
      
      switch (componentType) {
        case 'global-settings':
        case 'project-settings':
          return await this.fileWriterService.writeSettings(configToWrite, options);

        case 'ai-config':
          return await this.fileWriterService.writeAIConfig(configToWrite, options);

        case 'extensions-config':
          return await this.fileWriterService.writeExtensions(configToWrite, options);

        case 'debug-config':
          return await this.fileWriterService.writeDebugConfig(configToWrite, options);

        case 'tasks-config':
          return await this.fileWriterService.writeTasks(configToWrite, options);

        case 'snippets-config':
          return await this.fileWriterService.writeSnippets(configToWrite, options);

        case 'workspace-config':
          return await this.fileWriterService.writeWorkspace(configToWrite, options);

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
   * Transform component configuration from context
   */
  private async transformComponentConfiguration(componentType: CursorComponentType, options: CursorDeploymentOptions): Promise<any> {
    const mockContext = this.createMockContext();
    
    switch (componentType) {
      case 'global-settings':
        return this.transformerService.transformPersonalContext(mockContext.personalContext);
      case 'project-settings':
        return this.transformerService.transformProjectContext(mockContext.projectContext);
      case 'ai-config':
        return this.transformerService.transformAIRules(['Use TypeScript best practices', 'Follow clean code principles']);
      case 'extensions-config':
        return { recommendations: ['ms-vscode.vscode-typescript-next'] };
      case 'debug-config':
        return this.transformerService.transformDebugConfigurations([
          { name: 'Launch Program', type: 'node', request: 'launch', program: '${workspaceFolder}/dist/main.js' }
        ]);
      case 'tasks-config':
        return this.transformerService.transformBuildTasks([
          { name: 'build', command: 'npm run build', group: 'build' }
        ]);
      case 'snippets-config':
        return this.transformerService.transformCodeSnippets([
          { language: 'typescript', name: 'console.log', prefix: 'log', body: 'console.log($1);' }
        ]);
      case 'workspace-config':
        return this.transformerService.transformWorkspaceSettings({
          folders: [{ path: '.', name: 'Root' }],
          settings: { 'editor.tabSize': 2 }
        });
      default:
        throw new Error(`Unknown component type: ${componentType}`);
    }
  }

  /**
   * Determine rolled back components from restored file paths
   */
  private determineRolledBackComponents(restoredFiles: string[]): CursorComponentType[] {
    const components: CursorComponentType[] = [];
    
    for (const filePath of restoredFiles) {
      if (filePath.includes('settings.json')) {
        if (filePath.includes('User')) {
          components.push('global-settings');
        } else {
          components.push('project-settings');
        }
      } else if (filePath.includes('.cursorrules')) {
        components.push('ai-config');
      } else if (filePath.includes('extensions.json')) {
        components.push('extensions-config');
      } else if (filePath.includes('launch.json')) {
        components.push('debug-config');
      } else if (filePath.includes('tasks.json')) {
        components.push('tasks-config');
      } else if (filePath.includes('snippets')) {
        components.push('snippets-config');
      } else if (filePath.includes('.code-workspace')) {
        components.push('workspace-config');
      }
    }
    
    return [...new Set(components)]; // Remove duplicates
  }

  /**
   * Generate rollback ID
   */
  private generateRollbackId(deploymentId: string): string {
    const timestamp = Date.now().toString(36);
    const deploymentSuffix = deploymentId.split('-').pop() || 'unknown';
    return `rollback-${timestamp}-${deploymentSuffix}`;
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

/**
 * Cursor rollback result
 */
export interface CursorRollbackResult {
  success: boolean;
  deploymentId: string;
  rolledBackComponents: CursorComponentType[];
  errors: DeploymentError[];
  warnings: DeploymentWarning[];
  rollbackId: string;
  timestamp: string;
  backupId?: string;
  restoredFiles?: string[];
}