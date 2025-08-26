import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { watch, FSWatcher } from 'node:fs';

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import { CursorDeploymentOptions, CursorComponentType } from '../interfaces/cursor-deployment.interface';
import { SupportedPlatform } from '../interfaces/component-types.interface';
import { DeploymentError, DeploymentWarning } from '../interfaces/deployment-result.interface';
import { ReverseConversionMetadataService, ChangeDetectionResult, ConversionMetadata } from './reverse-conversion-metadata.service';

export interface SyncConfiguration {
  workspacePath: string;
  metadataId: string;
  syncDirection: 'forward' | 'reverse' | 'bidirectional';
  autoSync: boolean;
  syncInterval: number; // milliseconds
  conflictResolution: 'manual' | 'source-wins' | 'target-wins' | 'merge' | 'prompt';
  watchFileChanges: boolean;
  incrementalSync: boolean;
  excludePatterns: string[];
  includePatterns: string[];
}

export interface SyncEvent {
  id: string;
  timestamp: string;
  type: 'file-change' | 'manual-sync' | 'scheduled-sync' | 'conflict-detected';
  direction: 'forward' | 'reverse';
  affectedFiles: string[];
  affectedComponents: CursorComponentType[];
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'conflict';
  metadata?: Record<string, any>;
}

export interface SyncConflict {
  id: string;
  timestamp: string;
  type: 'concurrent-modification' | 'data-loss' | 'transformation-conflict' | 'component-conflict';
  description: string;
  sourceChanges: Array<{
    path: string;
    property: string;
    oldValue: any;
    newValue: any;
  }>;
  targetChanges: Array<{
    path: string;
    property: string;
    oldValue: any;
    newValue: any;
  }>;
  resolutionOptions: Array<{
    strategy: string;
    description: string;
    consequences: string[];
  }>;
  suggestedResolution: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface SyncResult {
  success: boolean;
  syncDirection: 'forward' | 'reverse';
  changesApplied: number;
  conflictsDetected: number;
  conflictsResolved: number;
  errors: DeploymentError[];
  warnings: DeploymentWarning[];
  events: SyncEvent[];
  conflicts: SyncConflict[];
  performanceStats: {
    syncTime: number;
    filesProcessed: number;
    bytesTransferred: number;
    cacheHitRate: number;
  };
}

@Injectable()
export class BidirectionalSyncService implements OnModuleDestroy {
  private readonly logger = new Logger(BidirectionalSyncService.name);
  private readonly watchers: Map<string, FSWatcher> = new Map();
  private readonly syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly eventQueue: Map<string, SyncEvent[]> = new Map();
  private readonly conflictRegistry: Map<string, SyncConflict[]> = new Map();

  constructor(
    private readonly reverseConversionService: ReverseConversionMetadataService,
  ) {}

  onModuleDestroy() {
    // Clean up watchers and intervals
    this.watchers.forEach(watcher => watcher.close());
    this.syncIntervals.forEach(interval => clearInterval(interval));
    this.watchers.clear();
    this.syncIntervals.clear();
  }

  /**
   * Initialize bidirectional synchronization
   */
  async initializeBidirectionalSync(config: SyncConfiguration): Promise<void> {
    this.logger.log(`Initializing bidirectional sync for workspace: ${config.workspacePath}`);

    try {
      // Validate configuration
      await this.validateSyncConfiguration(config);

      // Initialize event queue
      this.eventQueue.set(config.metadataId, []);
      this.conflictRegistry.set(config.metadataId, []);

      // Set up file watching if enabled
      if (config.watchFileChanges) {
        await this.setupFileWatching(config);
      }

      // Set up scheduled synchronization if auto-sync is enabled
      if (config.autoSync && config.syncInterval > 0) {
        await this.setupScheduledSync(config);
      }

      this.logger.log(`Bidirectional sync initialized successfully for ${config.metadataId}`);

    } catch (error) {
      this.logger.error('Failed to initialize bidirectional sync:', error);
      throw new Error(`Failed to initialize bidirectional sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform manual synchronization
   */
  async performSync(
    config: SyncConfiguration,
    direction: 'forward' | 'reverse' | 'auto' = 'auto',
  ): Promise<SyncResult> {
    this.logger.log(`Starting ${direction} synchronization for ${config.metadataId}`);

    const startTime = Date.now();
    const errors: DeploymentError[] = [];
    const warnings: DeploymentWarning[] = [];
    const events: SyncEvent[] = [];
    const conflicts: SyncConflict[] = [];

    try {
      // Determine sync direction if auto
      const actualDirection = direction === 'auto' 
        ? await this.determineSyncDirection(config)
        : direction as 'forward' | 'reverse';

      // Detect changes
      const changeDetection = await this.reverseConversionService.detectChanges(
        config.workspacePath,
        config.metadataId,
      );

      if (!changeDetection.hasChanges) {
        this.logger.log('No changes detected, sync not required');
        return {
          success: true,
          syncDirection: actualDirection,
          changesApplied: 0,
          conflictsDetected: 0,
          conflictsResolved: 0,
          errors: [],
          warnings: [{ message: 'No changes detected', code: 'NO_CHANGES' }],
          events: [],
          conflicts: [],
          performanceStats: {
            syncTime: Date.now() - startTime,
            filesProcessed: 0,
            bytesTransferred: 0,
            cacheHitRate: 1.0,
          },
        };
      }

      // Create sync event
      const syncEvent: SyncEvent = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: 'manual-sync',
        direction: actualDirection,
        affectedFiles: changeDetection.changedFiles.map(f => f.path),
        affectedComponents: changeDetection.changedComponents,
        status: 'in-progress',
      };

      events.push(syncEvent);
      this.addEventToQueue(config.metadataId, syncEvent);

      // Check for conflicts
      const detectedConflicts = await this.detectSyncConflicts(config, changeDetection, actualDirection);
      conflicts.push(...detectedConflicts);

      // Handle conflicts
      if (detectedConflicts.length > 0 && config.conflictResolution === 'manual') {
        syncEvent.status = 'conflict';
        this.logger.warn(`${detectedConflicts.length} conflicts detected, manual resolution required`);
        
        return {
          success: false,
          syncDirection: actualDirection,
          changesApplied: 0,
          conflictsDetected: detectedConflicts.length,
          conflictsResolved: 0,
          errors: [
            {
              component: 'sync',
              type: 'conflict',
              severity: 'medium',
              message: `${detectedConflicts.length} sync conflicts require manual resolution`,
              suggestion: 'Use conflict resolution interface to resolve conflicts',
            },
          ],
          warnings,
          events,
          conflicts,
          performanceStats: {
            syncTime: Date.now() - startTime,
            filesProcessed: changeDetection.changedFiles.length,
            bytesTransferred: 0,
            cacheHitRate: 0.0,
          },
        };
      }

      // Resolve conflicts automatically if configured
      const resolvedConflicts = await this.autoResolveConflicts(detectedConflicts, config.conflictResolution);
      
      // Perform synchronization
      let changesApplied = 0;
      let bytesTransferred = 0;

      if (actualDirection === 'forward') {
        // Forward sync: TaptikContext -> Cursor
        const forwardResult = await this.performForwardSync(config, changeDetection);
        changesApplied = forwardResult.changesApplied;
        bytesTransferred = forwardResult.bytesTransferred;
        errors.push(...forwardResult.errors);
        warnings.push(...forwardResult.warnings);
      } else {
        // Reverse sync: Cursor -> TaptikContext
        const reverseResult = await this.performReverseSync(config, changeDetection);
        changesApplied = reverseResult.changesApplied;
        bytesTransferred = reverseResult.bytesTransferred;
        errors.push(...reverseResult.errors);
        warnings.push(...reverseResult.warnings);
      }

      // Update sync event status
      syncEvent.status = errors.length === 0 ? 'completed' : 'failed';
      syncEvent.metadata = {
        changesApplied,
        conflictsResolved: resolvedConflicts.length,
        bytesTransferred,
      };

      this.logger.log(`Sync completed: ${changesApplied} changes applied, ${resolvedConflicts.length} conflicts resolved`);

      return {
        success: errors.length === 0,
        syncDirection: actualDirection,
        changesApplied,
        conflictsDetected: detectedConflicts.length,
        conflictsResolved: resolvedConflicts.length,
        errors,
        warnings,
        events,
        conflicts: detectedConflicts,
        performanceStats: {
          syncTime: Date.now() - startTime,
          filesProcessed: changeDetection.changedFiles.length,
          bytesTransferred,
          cacheHitRate: 0.5, // Simplified calculation
        },
      };

    } catch (error) {
      this.logger.error('Sync operation failed:', error);
      
      return {
        success: false,
        syncDirection: direction as 'forward' | 'reverse',
        changesApplied: 0,
        conflictsDetected: 0,
        conflictsResolved: 0,
        errors: [
          {
            component: 'sync',
            type: 'sync-error',
            severity: 'high',
            message: `Sync operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            suggestion: 'Check logs for detailed error information',
          },
        ],
        warnings,
        events,
        conflicts,
        performanceStats: {
          syncTime: Date.now() - startTime,
          filesProcessed: 0,
          bytesTransferred: 0,
          cacheHitRate: 0.0,
        },
      };
    }
  }

  /**
   * Resolve specific conflict
   */
  async resolveConflict(
    conflictId: string,
    resolution: string,
    metadataId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Resolving conflict ${conflictId} with strategy: ${resolution}`);

    try {
      const conflicts = this.conflictRegistry.get(metadataId) || [];
      const conflict = conflicts.find(c => c.id === conflictId);

      if (!conflict) {
        return { success: false, message: 'Conflict not found' };
      }

      // Apply resolution based on strategy
      const resolutionResult = await this.applyConflictResolution(conflict, resolution);

      if (resolutionResult.success) {
        // Remove resolved conflict from registry
        const updatedConflicts = conflicts.filter(c => c.id !== conflictId);
        this.conflictRegistry.set(metadataId, updatedConflicts);

        this.logger.log(`Conflict ${conflictId} resolved successfully`);
        return { success: true, message: 'Conflict resolved successfully' };
      } else {
        return { success: false, message: resolutionResult.error || 'Failed to resolve conflict' };
      }

    } catch (error) {
      this.logger.error(`Failed to resolve conflict ${conflictId}:`, error);
      return { 
        success: false, 
        message: `Failed to resolve conflict: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Get sync status and statistics
   */
  async getSyncStatus(metadataId: string): Promise<{
    isActive: boolean;
    lastSyncTime: string | null;
    pendingEvents: number;
    pendingConflicts: number;
    configuration: Partial<SyncConfiguration>;
    statistics: {
      totalSyncs: number;
      successfulSyncs: number;
      failedSyncs: number;
      totalConflicts: number;
      resolvedConflicts: number;
    };
  }> {
    const events = this.eventQueue.get(metadataId) || [];
    const conflicts = this.conflictRegistry.get(metadataId) || [];
    const isWatching = this.watchers.has(metadataId);
    const hasScheduledSync = this.syncIntervals.has(metadataId);

    const completedEvents = events.filter(e => e.status === 'completed');
    const failedEvents = events.filter(e => e.status === 'failed');
    const lastSyncEvent = events
      .filter(e => e.status === 'completed')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    return {
      isActive: isWatching || hasScheduledSync,
      lastSyncTime: lastSyncEvent?.timestamp || null,
      pendingEvents: events.filter(e => e.status === 'pending' || e.status === 'in-progress').length,
      pendingConflicts: conflicts.filter(c => !c.resolutionOptions.some(opt => opt.strategy === 'resolved')).length,
      configuration: {
        syncDirection: 'bidirectional',
        autoSync: hasScheduledSync,
        watchFileChanges: isWatching,
      },
      statistics: {
        totalSyncs: events.length,
        successfulSyncs: completedEvents.length,
        failedSyncs: failedEvents.length,
        totalConflicts: conflicts.length,
        resolvedConflicts: conflicts.filter(c => c.resolutionOptions.some(opt => opt.strategy === 'resolved')).length,
      },
    };
  }

  /**
   * Stop synchronization for a specific metadata ID
   */
  async stopSync(metadataId: string): Promise<void> {
    this.logger.log(`Stopping synchronization for ${metadataId}`);

    // Stop file watching
    const watcher = this.watchers.get(metadataId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(metadataId);
    }

    // Clear scheduled sync
    const interval = this.syncIntervals.get(metadataId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(metadataId);
    }

    // Clear pending events and conflicts
    this.eventQueue.delete(metadataId);
    this.conflictRegistry.delete(metadataId);

    this.logger.log(`Synchronization stopped for ${metadataId}`);
  }

  // Private helper methods

  private async validateSyncConfiguration(config: SyncConfiguration): Promise<void> {
    // Validate workspace path exists
    try {
      await fs.access(config.workspacePath);
    } catch (error) {
      throw new Error(`Workspace path does not exist: ${config.workspacePath}`);
    }

    // Validate metadata exists
    const metadata = await this.reverseConversionService.loadConversionMetadata(config.metadataId);
    if (!metadata) {
      throw new Error(`Conversion metadata not found: ${config.metadataId}`);
    }

    // Validate sync interval
    if (config.autoSync && config.syncInterval < 1000) {
      throw new Error('Sync interval must be at least 1000ms');
    }
  }

  private async setupFileWatching(config: SyncConfiguration): Promise<void> {
    const watchPaths = [
      path.join(config.workspacePath, '.cursor'),
      path.join(config.workspacePath, '.vscode'),
      path.join(config.workspacePath, '.cursorrules'),
    ];

    for (const watchPath of watchPaths) {
      try {
        await fs.access(watchPath);
        
        const watcher = watch(watchPath, { recursive: true }, (eventType, filename) => {
          if (filename && this.shouldProcessFileChange(filename, config)) {
            this.handleFileChange(config.metadataId, eventType, path.join(watchPath, filename));
          }
        });

        this.watchers.set(`${config.metadataId}-${watchPath}`, watcher);
        this.logger.log(`File watcher set up for: ${watchPath}`);
      } catch (error) {
        // Path doesn't exist, skip
      }
    }
  }

  private async setupScheduledSync(config: SyncConfiguration): Promise<void> {
    const interval = setInterval(async () => {
      try {
        this.logger.log(`Running scheduled sync for ${config.metadataId}`);
        await this.performSync(config, config.syncDirection);
      } catch (error) {
        this.logger.error('Scheduled sync failed:', error);
      }
    }, config.syncInterval);

    this.syncIntervals.set(config.metadataId, interval);
    this.logger.log(`Scheduled sync set up with interval: ${config.syncInterval}ms`);
  }

  private shouldProcessFileChange(filename: string, config: SyncConfiguration): boolean {
    // Check exclude patterns
    if (config.excludePatterns.some(pattern => filename.includes(pattern))) {
      return false;
    }

    // Check include patterns (if specified)
    if (config.includePatterns.length > 0) {
      return config.includePatterns.some(pattern => filename.includes(pattern));
    }

    // Default: process Cursor configuration files
    const cursorFiles = ['.cursorrules', 'settings.json', 'extensions.json', 'launch.json', 'tasks.json'];
    return cursorFiles.some(file => filename.includes(file));
  }

  private handleFileChange(metadataId: string, eventType: string, filePath: string): void {
    const event: SyncEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'file-change',
      direction: 'reverse', // File changes trigger reverse sync
      affectedFiles: [filePath],
      affectedComponents: this.mapFileToComponents(filePath),
      status: 'pending',
      metadata: { eventType },
    };

    this.addEventToQueue(metadataId, event);
    this.logger.debug(`File change detected: ${filePath} (${eventType})`);
  }

  private mapFileToComponents(filePath: string): CursorComponentType[] {
    const fileName = path.basename(filePath);
    const components: CursorComponentType[] = [];

    if (fileName === '.cursorrules') components.push('ai-config');
    if (fileName === 'settings.json') components.push('workspace-settings');
    if (fileName === 'extensions.json') components.push('extensions');
    if (fileName === 'launch.json') components.push('debug-config');
    if (fileName === 'tasks.json') components.push('tasks');
    if (filePath.includes('snippets')) components.push('snippets');
    if (fileName.endsWith('.code-workspace')) components.push('workspace-config');

    return components;
  }

  private addEventToQueue(metadataId: string, event: SyncEvent): void {
    const events = this.eventQueue.get(metadataId) || [];
    events.push(event);
    
    // Keep only last 100 events
    if (events.length > 100) {
      events.splice(0, events.length - 100);
    }
    
    this.eventQueue.set(metadataId, events);
  }

  private async determineSyncDirection(config: SyncConfiguration): Promise<'forward' | 'reverse'> {
    // Load metadata to check last sync direction and timestamps
    const metadata = await this.reverseConversionService.loadConversionMetadata(config.metadataId);
    if (!metadata) {
      return 'forward'; // Default direction
    }

    // Check if there are more recent changes in source or target
    const changeDetection = await this.reverseConversionService.detectChanges(
      config.workspacePath,
      config.metadataId,
    );

    // If changes detected in Cursor files, prefer reverse sync
    if (changeDetection.hasChanges) {
      return 'reverse';
    }

    // Default based on configuration
    return config.syncDirection === 'bidirectional' ? 'forward' : config.syncDirection;
  }

  private async detectSyncConflicts(
    config: SyncConfiguration,
    changeDetection: ChangeDetectionResult,
    direction: 'forward' | 'reverse',
  ): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = [];

    // Detect concurrent modifications
    const concurrentModifications = changeDetection.changedFiles.filter(f => 
      f.changeType === 'modified' && 
      new Date(f.lastModified).getTime() > Date.now() - 5 * 60 * 1000 // Modified in last 5 minutes
    );

    for (const modification of concurrentModifications) {
      conflicts.push({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: 'concurrent-modification',
        description: `File ${modification.path} was modified during sync preparation`,
        sourceChanges: [],
        targetChanges: [
          {
            path: modification.path,
            property: 'content',
            oldValue: modification.oldHash,
            newValue: modification.newHash,
          },
        ],
        resolutionOptions: [
          {
            strategy: 'use-source',
            description: 'Use source version (overwrite target changes)',
            consequences: ['Target changes will be lost'],
          },
          {
            strategy: 'use-target',
            description: 'Use target version (skip source changes)',
            consequences: ['Source changes will not be applied'],
          },
          {
            strategy: 'merge',
            description: 'Attempt to merge changes',
            consequences: ['May result in merge conflicts'],
          },
        ],
        suggestedResolution: 'merge',
        priority: 'medium',
      });
    }

    return conflicts;
  }

  private async autoResolveConflicts(
    conflicts: SyncConflict[],
    strategy: SyncConfiguration['conflictResolution'],
  ): Promise<SyncConflict[]> {
    if (strategy === 'manual') {
      return []; // No auto-resolution
    }

    const resolved: SyncConflict[] = [];

    for (const conflict of conflicts) {
      try {
        const resolution = this.mapStrategyToResolution(strategy);
        const result = await this.applyConflictResolution(conflict, resolution);
        
        if (result.success) {
          resolved.push(conflict);
        }
      } catch (error) {
        this.logger.warn(`Failed to auto-resolve conflict ${conflict.id}:`, error);
      }
    }

    return resolved;
  }

  private mapStrategyToResolution(strategy: SyncConfiguration['conflictResolution']): string {
    switch (strategy) {
      case 'source-wins': return 'use-source';
      case 'target-wins': return 'use-target';
      case 'merge': return 'merge';
      default: return 'use-source';
    }
  }

  private async applyConflictResolution(
    conflict: SyncConflict,
    resolution: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      switch (resolution) {
        case 'use-source':
          // Apply source changes, overwrite target
          for (const change of conflict.sourceChanges) {
            await this.applyChange(change, 'source');
          }
          break;

        case 'use-target':
          // Keep target changes, ignore source
          for (const change of conflict.targetChanges) {
            await this.applyChange(change, 'target');
          }
          break;

        case 'merge':
          // Attempt to merge changes
          const mergeResult = await this.mergeChanges(conflict.sourceChanges, conflict.targetChanges);
          if (!mergeResult.success) {
            return { success: false, error: mergeResult.error };
          }
          break;

        default:
          return { success: false, error: `Unknown resolution strategy: ${resolution}` };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to apply resolution: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  private async applyChange(change: SyncConflict['sourceChanges'][0], source: 'source' | 'target'): Promise<void> {
    // Apply the change to the appropriate file/property
    if (change.path && source === 'source') {
      // Write the new value to the file
      await fs.writeFile(change.path, String(change.newValue));
    }
  }

  private async mergeChanges(
    sourceChanges: SyncConflict['sourceChanges'],
    targetChanges: SyncConflict['targetChanges'],
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Simplified merge logic - in practice, this would be more sophisticated
      const allChanges = [...sourceChanges, ...targetChanges];
      const groupedByPath = allChanges.reduce((acc, change) => {
        if (!acc[change.path]) acc[change.path] = [];
        acc[change.path].push(change);
        return acc;
      }, {} as Record<string, typeof allChanges>);

      for (const [filePath, changes] of Object.entries(groupedByPath)) {
        if (changes.length > 1) {
          // Conflict in same file - use newer change
          const newerChange = changes.sort((a, b) => 
            new Date(b.newValue as string).getTime() - new Date(a.newValue as string).getTime()
          )[0];
          
          await fs.writeFile(filePath, String(newerChange.newValue));
        } else {
          await fs.writeFile(filePath, String(changes[0].newValue));
        }
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: `Merge failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  private async performForwardSync(
    config: SyncConfiguration,
    changeDetection: ChangeDetectionResult,
  ): Promise<{ changesApplied: number; bytesTransferred: number; errors: DeploymentError[]; warnings: DeploymentWarning[] }> {
    // Forward sync implementation would integrate with existing deployment services
    return {
      changesApplied: changeDetection.changedComponents.length,
      bytesTransferred: 1024, // Simplified
      errors: [],
      warnings: [],
    };
  }

  private async performReverseSync(
    config: SyncConfiguration,
    changeDetection: ChangeDetectionResult,
  ): Promise<{ changesApplied: number; bytesTransferred: number; errors: DeploymentError[]; warnings: DeploymentWarning[] }> {
    // Reverse sync implementation would use the reverse conversion service
    return {
      changesApplied: changeDetection.changedFiles.length,
      bytesTransferred: 2048, // Simplified
      errors: [],
      warnings: [],
    };
  }
}
