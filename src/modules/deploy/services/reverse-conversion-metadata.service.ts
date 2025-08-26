import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import { CursorDeploymentOptions, CursorComponentType } from '../interfaces/cursor-deployment.interface';
import { SupportedPlatform } from '../interfaces/component-types.interface';
import { DeploymentError, DeploymentWarning } from '../interfaces/deployment-result.interface';

export interface ConversionMetadata {
  id: string;
  timestamp: string;
  sourceFormat: 'taptik' | 'cursor' | 'claude-code' | 'kiro-ide';
  targetFormat: 'taptik' | 'cursor' | 'claude-code' | 'kiro-ide';
  version: string;
  
  // Original source information
  originalContext?: Partial<TaptikContext>;
  originalFiles: Array<{
    path: string;
    hash: string;
    size: number;
    mtime: string;
    component: string;
    type: string;
  }>;
  
  // Transformation mapping
  transformationMap: Record<string, {
    sourceProperty: string;
    targetProperty: string;
    transformationType: 'direct' | 'computed' | 'merged' | 'split';
    transformationRules?: string[];
    reversible: boolean;
    lossyConversion?: boolean;
    customLogic?: string;
  }>;
  
  // Component mapping
  componentMapping: Record<CursorComponentType, {
    originalComponents: string[];
    targetComponents: string[];
    dependencies: string[];
    conversionNotes: string[];
  }>;
  
  // Platform-specific data
  platformSpecificData: Record<string, any>;
  
  // Bidirectional sync information
  syncMetadata: {
    lastSyncTimestamp: string;
    syncDirection: 'forward' | 'reverse' | 'bidirectional';
    changeDetectionEnabled: boolean;
    conflictResolutionStrategy: string;
    incrementalUpdateSupported: boolean;
  };
  
  // Validation and integrity
  integrity: {
    checksums: Record<string, string>;
    validationRules: string[];
    dataLossAssessment: {
      hasDataLoss: boolean;
      lostProperties: string[];
      approximatedValues: string[];
      irreversibleTransformations: string[];
    };
  };
}

export interface ChangeDetectionResult {
  hasChanges: boolean;
  changedFiles: Array<{
    path: string;
    changeType: 'added' | 'modified' | 'deleted' | 'moved';
    oldHash?: string;
    newHash?: string;
    component: string;
    lastModified: string;
  }>;
  changedComponents: CursorComponentType[];
  changesSummary: {
    totalChanges: number;
    addedFiles: number;
    modifiedFiles: number;
    deletedFiles: number;
    movedFiles: number;
  };
  incrementalUpdatePossible: boolean;
  fullSyncRequired: boolean;
}

export interface ReverseConversionOptions {
  targetPlatform: SupportedPlatform;
  preserveMetadata: boolean;
  enableChangeDetection: boolean;
  incrementalUpdate: boolean;
  strictValidation: boolean;
  handleDataLoss: 'error' | 'warn' | 'ignore';
  conflictResolution: 'manual' | 'auto-source' | 'auto-target' | 'merge';
}

export interface ReverseConversionResult {
  success: boolean;
  convertedContext?: TaptikContext;
  metadata: ConversionMetadata;
  warnings: DeploymentWarning[];
  errors: DeploymentError[];
  dataLossReport: {
    hasDataLoss: boolean;
    lostProperties: string[];
    approximatedValues: string[];
    recommendations: string[];
  };
  performanceStats: {
    conversionTime: number;
    filesProcessed: number;
    metadataSize: number;
    cacheHitRate?: number;
  };
}

@Injectable()
export class ReverseConversionMetadataService {
  private readonly logger = new Logger(ReverseConversionMetadataService.name);
  private readonly metadataBasePath: string;
  private readonly changeDetectionCache: Map<string, ChangeDetectionResult> = new Map();

  constructor() {
    this.metadataBasePath = path.join(os.homedir(), '.taptik', 'reverse-conversion');
  }

  /**
   * Create and store conversion metadata during deployment
   */
  async createConversionMetadata(
    originalContext: TaptikContext,
    deploymentOptions: CursorDeploymentOptions,
    deployedFiles: Array<{ path: string; component: CursorComponentType; type: string }>,
  ): Promise<ConversionMetadata> {
    this.logger.log('Creating conversion metadata for reverse conversion support');

    const metadataId = this.generateMetadataId(originalContext, deploymentOptions);
    
    try {
      // Ensure metadata directory exists
      await fs.mkdir(this.metadataBasePath, { recursive: true });

      // Calculate file hashes and metadata
      const originalFiles = await Promise.all(
        deployedFiles.map(async (file) => {
          const stats = await fs.stat(file.path).catch(() => null);
          const content = await fs.readFile(file.path, 'utf8').catch(() => '');
          const hash = crypto.createHash('sha256').update(content).digest('hex');
          
          return {
            path: file.path,
            hash,
            size: stats?.size || content.length,
            mtime: stats?.mtime?.toISOString() || new Date().toISOString(),
            component: file.component,
            type: file.type,
          };
        }),
      );

      // Create transformation mapping
      const transformationMap = this.createTransformationMap(originalContext, deploymentOptions);

      // Create component mapping
      const componentMapping = this.createComponentMapping(deploymentOptions.components || []);

      // Extract platform-specific data
      const platformSpecificData = this.extractPlatformSpecificData(originalContext);

      // Calculate integrity data
      const integrity = await this.calculateIntegrityData(originalContext, deployedFiles);

      const metadata: ConversionMetadata = {
        id: metadataId,
        timestamp: new Date().toISOString(),
        sourceFormat: 'taptik',
        targetFormat: 'cursor',
        version: '1.0.0',
        originalContext: this.createContextSnapshot(originalContext),
        originalFiles,
        transformationMap,
        componentMapping,
        platformSpecificData,
        syncMetadata: {
          lastSyncTimestamp: new Date().toISOString(),
          syncDirection: 'forward',
          changeDetectionEnabled: true,
          conflictResolutionStrategy: deploymentOptions.conflictStrategy || 'merge',
          incrementalUpdateSupported: true,
        },
        integrity,
      };

      // Save metadata to file
      const metadataPath = path.join(this.metadataBasePath, `${metadataId}.json`);
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      this.logger.log(`Conversion metadata saved: ${metadataPath}`);
      return metadata;

    } catch (error) {
      this.logger.error('Failed to create conversion metadata:', error);
      throw new Error(`Failed to create conversion metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect changes in Cursor configuration files
   */
  async detectChanges(
    workspacePath: string,
    metadataId: string,
  ): Promise<ChangeDetectionResult> {
    this.logger.log(`Detecting changes for metadata: ${metadataId}`);

    const cacheKey = `${metadataId}-${workspacePath}`;
    if (this.changeDetectionCache.has(cacheKey)) {
      const cached = this.changeDetectionCache.get(cacheKey)!;
      // Check if cache is still valid (5 minutes)
      const cacheAge = Date.now() - new Date(cached.changesSummary as any).getTime();
      if (cacheAge < 5 * 60 * 1000) {
        this.logger.debug('Returning cached change detection result');
        return cached;
      }
    }

    try {
      // Load original metadata
      const metadata = await this.loadConversionMetadata(metadataId);
      if (!metadata) {
        throw new Error(`Conversion metadata not found: ${metadataId}`);
      }

      const changedFiles: ChangeDetectionResult['changedFiles'] = [];
      const changedComponents = new Set<CursorComponentType>();

      // Check each original file for changes
      for (const originalFile of metadata.originalFiles) {
        try {
          const currentStats = await fs.stat(originalFile.path);
          const currentContent = await fs.readFile(originalFile.path, 'utf8');
          const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');

          let changeType: 'added' | 'modified' | 'deleted' | 'moved' = 'modified';

          if (currentHash !== originalFile.hash) {
            if (currentStats.mtime.toISOString() !== originalFile.mtime) {
              changeType = 'modified';
            }

            changedFiles.push({
              path: originalFile.path,
              changeType,
              oldHash: originalFile.hash,
              newHash: currentHash,
              component: originalFile.component as CursorComponentType,
              lastModified: currentStats.mtime.toISOString(),
            });

            changedComponents.add(originalFile.component as CursorComponentType);
          }
        } catch (error) {
          // File doesn't exist anymore
          changedFiles.push({
            path: originalFile.path,
            changeType: 'deleted',
            oldHash: originalFile.hash,
            component: originalFile.component as CursorComponentType,
            lastModified: new Date().toISOString(),
          });

          changedComponents.add(originalFile.component as CursorComponentType);
        }
      }

      // Check for new files in Cursor directories
      const cursorDirs = [
        path.join(workspacePath, '.cursor'),
        path.join(workspacePath, '.vscode'),
        workspacePath,
      ];

      for (const dir of cursorDirs) {
        try {
          const files = await this.findCursorConfigFiles(dir);
          for (const file of files) {
            const isOriginalFile = metadata.originalFiles.some(of => of.path === file.path);
            if (!isOriginalFile) {
              changedFiles.push({
                path: file.path,
                changeType: 'added',
                newHash: file.hash,
                component: file.component,
                lastModified: file.lastModified,
              });

              changedComponents.add(file.component);
            }
          }
        } catch (error) {
          // Directory doesn't exist, skip
        }
      }

      const result: ChangeDetectionResult = {
        hasChanges: changedFiles.length > 0,
        changedFiles,
        changedComponents: Array.from(changedComponents),
        changesSummary: {
          totalChanges: changedFiles.length,
          addedFiles: changedFiles.filter(f => f.changeType === 'added').length,
          modifiedFiles: changedFiles.filter(f => f.changeType === 'modified').length,
          deletedFiles: changedFiles.filter(f => f.changeType === 'deleted').length,
          movedFiles: changedFiles.filter(f => f.changeType === 'moved').length,
        },
        incrementalUpdatePossible: this.isIncrementalUpdatePossible(changedFiles),
        fullSyncRequired: this.isFullSyncRequired(changedFiles, metadata),
      };

      // Cache the result
      this.changeDetectionCache.set(cacheKey, result);

      this.logger.log(`Change detection completed: ${result.changesSummary.totalChanges} changes found`);
      return result;

    } catch (error) {
      this.logger.error('Failed to detect changes:', error);
      throw new Error(`Failed to detect changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform reverse conversion from Cursor to TaptikContext
   */
  async performReverseConversion(
    workspacePath: string,
    metadataId: string,
    options: ReverseConversionOptions,
  ): Promise<ReverseConversionResult> {
    this.logger.log(`Starting reverse conversion from Cursor to ${options.targetPlatform}`);

    const startTime = Date.now();
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];

    try {
      // Load conversion metadata
      const metadata = await this.loadConversionMetadata(metadataId);
      if (!metadata) {
        throw new Error(`Conversion metadata not found: ${metadataId}`);
      }

      // Detect changes if enabled
      let changeDetection: ChangeDetectionResult | undefined;
      if (options.enableChangeDetection) {
        changeDetection = await this.detectChanges(workspacePath, metadataId);
        
        if (!changeDetection.hasChanges && options.incrementalUpdate) {
          this.logger.log('No changes detected, skipping reverse conversion');
          return {
            success: true,
            convertedContext: metadata.originalContext as TaptikContext,
            metadata,
            warnings: [
              {
                message: 'No changes detected, returned original context',
                code: 'NO_CHANGES',
              },
            ],
            errors: [],
            dataLossReport: {
              hasDataLoss: false,
              lostProperties: [],
              approximatedValues: [],
              recommendations: [],
            },
            performanceStats: {
              conversionTime: Date.now() - startTime,
              filesProcessed: 0,
              metadataSize: JSON.stringify(metadata).length,
              cacheHitRate: 1.0,
            },
          };
        }
      }

      // Read current Cursor configuration files
      const currentCursorConfig = await this.readCursorConfiguration(workspacePath);

      // Perform reverse transformation
      const convertedContext = await this.transformCursorToTaptik(
        currentCursorConfig,
        metadata,
        options,
      );

      // Validate conversion
      const validationResult = await this.validateReverseConversion(
        convertedContext,
        metadata,
        options,
      );

      errors.push(...validationResult.errors);
      warnings.push(...validationResult.warnings);

      // Assess data loss
      const dataLossReport = this.assessDataLoss(metadata, convertedContext);

      // Handle data loss based on options
      if (dataLossReport.hasDataLoss && options.handleDataLoss === 'error') {
        errors.push({
          component: 'reverse-conversion',
          type: 'data-loss',
          severity: 'high',
          message: 'Data loss detected during reverse conversion',
          suggestion: 'Review lost properties and consider manual intervention',
        });
      } else if (dataLossReport.hasDataLoss && options.handleDataLoss === 'warn') {
        warnings.push({
          message: `Data loss detected: ${dataLossReport.lostProperties.length} properties lost`,
          code: 'DATA_LOSS_WARNING',
        });
      }

      // Update metadata for bidirectional sync
      if (options.enableChangeDetection) {
        await this.updateSyncMetadata(metadataId, changeDetection);
      }

      const conversionTime = Date.now() - startTime;

      this.logger.log(`Reverse conversion completed in ${conversionTime}ms`);

      return {
        success: errors.length === 0,
        convertedContext: errors.length === 0 ? convertedContext : undefined,
        metadata,
        warnings,
        errors,
        dataLossReport,
        performanceStats: {
          conversionTime,
          filesProcessed: changeDetection?.changesSummary.totalChanges || 0,
          metadataSize: JSON.stringify(metadata).length,
          cacheHitRate: this.changeDetectionCache.has(`${metadataId}-${workspacePath}`) ? 1.0 : 0.0,
        },
      };

    } catch (error) {
      this.logger.error('Reverse conversion failed:', error);
      return {
        success: false,
        metadata: {} as ConversionMetadata,
        warnings,
        errors: [
          {
            component: 'reverse-conversion',
            type: 'conversion-error',
            severity: 'high',
            message: `Reverse conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            suggestion: 'Check logs for detailed error information',
          },
        ],
        dataLossReport: {
          hasDataLoss: true,
          lostProperties: [],
          approximatedValues: [],
          recommendations: ['Conversion failed - all data may be lost'],
        },
        performanceStats: {
          conversionTime: Date.now() - startTime,
          filesProcessed: 0,
          metadataSize: 0,
        },
      };
    }
  }

  /**
   * Load conversion metadata from file
   */
  async loadConversionMetadata(metadataId: string): Promise<ConversionMetadata | null> {
    try {
      const metadataPath = path.join(this.metadataBasePath, `${metadataId}.json`);
      const content = await fs.readFile(metadataPath, 'utf8');
      return JSON.parse(content) as ConversionMetadata;
    } catch (error) {
      this.logger.warn(`Failed to load conversion metadata ${metadataId}:`, error);
      return null;
    }
  }

  /**
   * List available conversion metadata
   */
  async listConversionMetadata(): Promise<Array<{ id: string; timestamp: string; sourceFormat: string; targetFormat: string }>> {
    try {
      await fs.mkdir(this.metadataBasePath, { recursive: true });
      const files = await fs.readdir(this.metadataBasePath);
      const metadataFiles = files.filter(f => f.endsWith('.json'));

      const results = await Promise.all(
        metadataFiles.map(async (file) => {
          try {
            const content = await fs.readFile(path.join(this.metadataBasePath, file), 'utf8');
            const metadata = JSON.parse(content) as ConversionMetadata;
            return {
              id: metadata.id,
              timestamp: metadata.timestamp,
              sourceFormat: metadata.sourceFormat,
              targetFormat: metadata.targetFormat,
            };
          } catch (error) {
            this.logger.warn(`Failed to parse metadata file ${file}:`, error);
            return null;
          }
        }),
      );

      return results.filter(Boolean) as Array<{ id: string; timestamp: string; sourceFormat: string; targetFormat: string }>;
    } catch (error) {
      this.logger.error('Failed to list conversion metadata:', error);
      return [];
    }
  }

  /**
   * Clean up old metadata files
   */
  async cleanupOldMetadata(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    try {
      const files = await fs.readdir(this.metadataBasePath);
      const metadataFiles = files.filter(f => f.endsWith('.json'));
      let cleanedCount = 0;

      for (const file of metadataFiles) {
        try {
          const filePath = path.join(this.metadataBasePath, file);
          const stats = await fs.stat(filePath);
          const age = Date.now() - stats.mtime.getTime();

          if (age > maxAge) {
            await fs.unlink(filePath);
            cleanedCount++;
            this.logger.log(`Cleaned up old metadata file: ${file}`);
          }
        } catch (error) {
          this.logger.warn(`Failed to clean up metadata file ${file}:`, error);
        }
      }

      this.logger.log(`Cleanup completed: ${cleanedCount} old metadata files removed`);
      return cleanedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup old metadata:', error);
      return 0;
    }
  }

  // Private helper methods

  private generateMetadataId(context: TaptikContext, options: CursorDeploymentOptions): string {
    const source = JSON.stringify({
      projectName: context.metadata.projectName,
      version: context.metadata.version,
      workspacePath: options.workspacePath,
      components: options.components,
      timestamp: Date.now(),
    });
    
    return crypto.createHash('md5').update(source).digest('hex');
  }

  private createTransformationMap(
    context: TaptikContext,
    options: CursorDeploymentOptions,
  ): ConversionMetadata['transformationMap'] {
    // Create mapping based on known transformations
    return {
      'personalContext.userPreferences.theme': {
        sourceProperty: 'personalContext.userPreferences.theme',
        targetProperty: '.cursor/settings.json:workbench.colorTheme',
        transformationType: 'computed',
        transformationRules: ['Map dark/light theme to Cursor theme names'],
        reversible: true,
      },
      'personalContext.userPreferences.editorSettings.fontSize': {
        sourceProperty: 'personalContext.userPreferences.editorSettings.fontSize',
        targetProperty: '.cursor/settings.json:editor.fontSize',
        transformationType: 'direct',
        reversible: true,
      },
      'promptContext.rules': {
        sourceProperty: 'promptContext.rules',
        targetProperty: '.cursorrules',
        transformationType: 'computed',
        transformationRules: ['Convert array to formatted text file'],
        reversible: true,
        lossyConversion: false,
      },
      'promptContext.context': {
        sourceProperty: 'promptContext.context',
        targetProperty: '.cursor/ai-context.md',
        transformationType: 'direct',
        reversible: true,
      },
      'projectContext.dependencies': {
        sourceProperty: 'projectContext.dependencies',
        targetProperty: '.cursor/extensions.json:recommendations',
        transformationType: 'computed',
        transformationRules: ['Map dependencies to VS Code extension recommendations'],
        reversible: false,
        lossyConversion: true,
      },
    };
  }

  private createComponentMapping(components: CursorComponentType[]): ConversionMetadata['componentMapping'] {
    const mapping: ConversionMetadata['componentMapping'] = {};

    for (const component of components) {
      switch (component) {
        case 'ai-config':
          mapping[component] = {
            originalComponents: ['promptContext'],
            targetComponents: ['.cursorrules', '.cursor/ai-context.md'],
            dependencies: [],
            conversionNotes: ['AI rules converted to .cursorrules format', 'Context preserved as markdown'],
          };
          break;
        case 'workspace-settings':
          mapping[component] = {
            originalComponents: ['personalContext.userPreferences', 'personalContext.workspacePreferences'],
            targetComponents: ['.cursor/settings.json'],
            dependencies: [],
            conversionNotes: ['User preferences mapped to Cursor settings', 'Some settings may not have direct equivalents'],
          };
          break;
        case 'extensions':
          mapping[component] = {
            originalComponents: ['projectContext.dependencies', 'projectContext.devDependencies'],
            targetComponents: ['.cursor/extensions.json'],
            dependencies: ['workspace-settings'],
            conversionNotes: ['Dependencies mapped to extension recommendations', 'Manual verification recommended'],
          };
          break;
        default:
          mapping[component] = {
            originalComponents: [component],
            targetComponents: [component],
            dependencies: [],
            conversionNotes: ['Direct mapping'],
          };
      }
    }

    return mapping;
  }

  private extractPlatformSpecificData(context: TaptikContext): Record<string, any> {
    return {
      cursor: {
        supportedFeatures: ['ai-integration', 'extensions', 'debug-config'],
        limitations: ['No direct agent support', 'Limited steering document support'],
      },
      original: {
        metadata: context.metadata,
        timestamp: new Date().toISOString(),
      },
    };
  }

  private async calculateIntegrityData(
    context: TaptikContext,
    deployedFiles: Array<{ path: string; component: CursorComponentType; type: string }>,
  ): Promise<ConversionMetadata['integrity']> {
    const checksums: Record<string, string> = {};
    
    // Calculate checksum for original context
    const contextString = JSON.stringify(context, null, 2);
    checksums['original-context'] = crypto.createHash('sha256').update(contextString).digest('hex');

    // Calculate checksums for deployed files
    for (const file of deployedFiles) {
      try {
        const content = await fs.readFile(file.path, 'utf8');
        checksums[file.path] = crypto.createHash('sha256').update(content).digest('hex');
      } catch (error) {
        // File might not exist yet
      }
    }

    return {
      checksums,
      validationRules: [
        'Verify all file checksums match',
        'Ensure no data loss in critical properties',
        'Validate transformation reversibility',
      ],
      dataLossAssessment: {
        hasDataLoss: false,
        lostProperties: [],
        approximatedValues: [],
        irreversibleTransformations: [],
      },
    };
  }

  private createContextSnapshot(context: TaptikContext): Partial<TaptikContext> {
    // Create a deep copy but exclude large or sensitive data
    return {
      metadata: { ...context.metadata },
      personalContext: {
        userPreferences: { ...context.personalContext.userPreferences },
        aiSettings: { ...context.personalContext.aiSettings },
        workspacePreferences: { ...context.personalContext.workspacePreferences },
      },
      projectContext: { ...context.projectContext },
      promptContext: {
        rules: [...context.promptContext.rules],
        context: context.promptContext.context,
        examples: context.promptContext.examples?.map(ex => ({
          title: ex.title,
          code: ex.code.length > 1000 ? ex.code.substring(0, 1000) + '...' : ex.code,
        })),
        workflows: [...(context.promptContext.workflows || [])],
      },
    };
  }

  private async findCursorConfigFiles(directory: string): Promise<Array<{
    path: string;
    hash: string;
    component: CursorComponentType;
    lastModified: string;
  }>> {
    const files: Array<{ path: string; hash: string; component: CursorComponentType; lastModified: string }> = [];
    
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(directory, entry.name);
          const component = this.mapFileToComponent(filePath);
          
          if (component) {
            const content = await fs.readFile(filePath, 'utf8');
            const hash = crypto.createHash('sha256').update(content).digest('hex');
            const stats = await fs.stat(filePath);
            
            files.push({
              path: filePath,
              hash,
              component,
              lastModified: stats.mtime.toISOString(),
            });
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist or not accessible
    }
    
    return files;
  }

  private mapFileToComponent(filePath: string): CursorComponentType | null {
    const fileName = path.basename(filePath);
    const dirName = path.basename(path.dirname(filePath));
    
    if (fileName === '.cursorrules') return 'ai-config';
    if (fileName === 'settings.json' && dirName === '.cursor') return 'workspace-settings';
    if (fileName === 'extensions.json') return 'extensions';
    if (fileName === 'launch.json') return 'debug-config';
    if (fileName === 'tasks.json') return 'tasks';
    if (filePath.includes('snippets')) return 'snippets';
    if (fileName.endsWith('.code-workspace')) return 'workspace-config';
    
    return null;
  }

  private isIncrementalUpdatePossible(changedFiles: ChangeDetectionResult['changedFiles']): boolean {
    // Incremental update is possible if changes are limited to specific components
    const criticalFiles = changedFiles.filter(f => 
      f.component === 'ai-config' || f.changeType === 'deleted'
    );
    
    return criticalFiles.length < changedFiles.length * 0.5;
  }

  private isFullSyncRequired(
    changedFiles: ChangeDetectionResult['changedFiles'],
    metadata: ConversionMetadata,
  ): boolean {
    // Full sync required if critical components changed or too many changes
    const criticalComponents = ['ai-config', 'workspace-settings'];
    const hasCriticalChanges = changedFiles.some(f => 
      criticalComponents.includes(f.component)
    );
    
    const changePercentage = changedFiles.length / metadata.originalFiles.length;
    
    return hasCriticalChanges || changePercentage > 0.5;
  }

  private async readCursorConfiguration(workspacePath: string): Promise<Record<string, any>> {
    const config: Record<string, any> = {};
    
    // Read various Cursor configuration files
    const configFiles = [
      { path: path.join(workspacePath, '.cursorrules'), key: 'aiRules' },
      { path: path.join(workspacePath, '.cursor', 'settings.json'), key: 'settings' },
      { path: path.join(workspacePath, '.cursor', 'extensions.json'), key: 'extensions' },
      { path: path.join(workspacePath, '.vscode', 'launch.json'), key: 'debugConfig' },
      { path: path.join(workspacePath, '.vscode', 'tasks.json'), key: 'tasks' },
    ];
    
    for (const configFile of configFiles) {
      try {
        const content = await fs.readFile(configFile.path, 'utf8');
        if (configFile.key === 'aiRules') {
          config[configFile.key] = content;
        } else {
          config[configFile.key] = JSON.parse(content);
        }
      } catch (error) {
        // File doesn't exist or invalid JSON
        config[configFile.key] = null;
      }
    }
    
    return config;
  }

  private async transformCursorToTaptik(
    cursorConfig: Record<string, any>,
    metadata: ConversionMetadata,
    options: ReverseConversionOptions,
  ): Promise<TaptikContext> {
    // Start with the original context as base
    const convertedContext = JSON.parse(JSON.stringify(metadata.originalContext)) as TaptikContext;
    
    // Apply reverse transformations based on transformation map
    for (const [targetProperty, mapping] of Object.entries(metadata.transformationMap)) {
      if (mapping.reversible) {
        try {
          const reversedValue = await this.reverseTransformProperty(
            cursorConfig,
            targetProperty,
            mapping,
          );
          
          if (reversedValue !== undefined) {
            this.setNestedProperty(convertedContext, mapping.sourceProperty, reversedValue);
          }
        } catch (error) {
          this.logger.warn(`Failed to reverse transform ${targetProperty}:`, error);
        }
      }
    }
    
    return convertedContext;
  }

  private async reverseTransformProperty(
    cursorConfig: Record<string, any>,
    targetProperty: string,
    mapping: ConversionMetadata['transformationMap'][string],
  ): Promise<any> {
    // Implementation depends on the transformation type
    switch (mapping.transformationType) {
      case 'direct':
        return this.getNestedProperty(cursorConfig, mapping.targetProperty);
      
      case 'computed':
        return this.reverseComputedTransformation(cursorConfig, mapping);
      
      default:
        return undefined;
    }
  }

  private reverseComputedTransformation(
    cursorConfig: Record<string, any>,
    mapping: ConversionMetadata['transformationMap'][string],
  ): any {
    // Handle specific computed transformations
    if (mapping.targetProperty === '.cursorrules') {
      // Convert .cursorrules file back to rules array
      const rulesContent = cursorConfig.aiRules;
      if (typeof rulesContent === 'string') {
        return rulesContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      }
    }
    
    if (mapping.targetProperty.includes('workbench.colorTheme')) {
      // Convert theme name back to simple theme preference
      const theme = this.getNestedProperty(cursorConfig, 'settings.workbench.colorTheme');
      if (typeof theme === 'string') {
        return theme.toLowerCase().includes('dark') ? 'dark' : 'light';
      }
    }
    
    return undefined;
  }

  private getNestedProperty(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  private setNestedProperty(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
  }

  private async validateReverseConversion(
    convertedContext: TaptikContext,
    metadata: ConversionMetadata,
    options: ReverseConversionOptions,
  ): Promise<{ errors: DeploymentError[]; warnings: DeploymentWarning[] }> {
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];

    if (options.strictValidation) {
      // Validate that required properties exist
      if (!convertedContext.metadata?.projectName) {
        errors.push({
          component: 'validation',
          type: 'missing-property',
          severity: 'medium',
          message: 'Project name is missing from converted context',
          suggestion: 'Check if metadata was properly preserved',
        });
      }

      // Validate transformation integrity
      for (const [property, mapping] of Object.entries(metadata.transformationMap)) {
        if (mapping.reversible && !this.getNestedProperty(convertedContext, mapping.sourceProperty)) {
          warnings.push({
            message: `Property ${mapping.sourceProperty} could not be restored from reverse conversion`,
            code: 'PROPERTY_NOT_RESTORED',
          });
        }
      }
    }

    return { errors, warnings };
  }

  private assessDataLoss(
    metadata: ConversionMetadata,
    convertedContext: TaptikContext,
  ): ReverseConversionResult['dataLossReport'] {
    const lostProperties: string[] = [];
    const approximatedValues: string[] = [];
    const recommendations: string[] = [];

    // Check for properties that couldn't be reversed
    for (const [property, mapping] of Object.entries(metadata.transformationMap)) {
      if (!mapping.reversible) {
        lostProperties.push(mapping.sourceProperty);
      } else if (mapping.lossyConversion) {
        approximatedValues.push(mapping.sourceProperty);
      }
    }

    if (lostProperties.length > 0) {
      recommendations.push('Some properties cannot be restored from Cursor configuration');
      recommendations.push('Consider maintaining original TaptikContext for complete fidelity');
    }

    if (approximatedValues.length > 0) {
      recommendations.push('Some values were approximated during reverse conversion');
      recommendations.push('Manual review of approximated values is recommended');
    }

    return {
      hasDataLoss: lostProperties.length > 0,
      lostProperties,
      approximatedValues,
      recommendations,
    };
  }

  private async updateSyncMetadata(
    metadataId: string,
    changeDetection?: ChangeDetectionResult,
  ): Promise<void> {
    try {
      const metadata = await this.loadConversionMetadata(metadataId);
      if (!metadata) return;

      metadata.syncMetadata.lastSyncTimestamp = new Date().toISOString();
      metadata.syncMetadata.syncDirection = 'reverse';

      const metadataPath = path.join(this.metadataBasePath, `${metadataId}.json`);
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      this.logger.log(`Updated sync metadata for ${metadataId}`);
    } catch (error) {
      this.logger.error('Failed to update sync metadata:', error);
    }
  }
}
