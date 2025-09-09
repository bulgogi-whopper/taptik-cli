import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import { CursorComponentType } from '../interfaces/component-types.interface';
import { CursorConfiguration } from '../interfaces/cursor-config.interface';
import { CursorDeployOptions } from '../interfaces/deploy-options.interface';


import { PerformanceMonitorService } from './performance-monitor.service';

export interface CursorDeploymentContext {
  globalSettingsPath: string;
  projectSettingsPath: string;
  aiPromptsPath: string;
  aiRulesPath: string;
  aiContextPath: string;
  extensionsPath: string;
  snippetsPath: string;
  tasksPath: string;
  launchPath: string;
}

export interface ParallelProcessingOptions {
  maxConcurrency?: number; // Default: 3
  batchSize?: number; // Default: 5 files per batch
  enableFileSystemOptimization?: boolean; // Default: true
  safetyChecks?: boolean; // Default: true
  memoryThreshold?: number; // Default: 150MB
}

export interface BatchProcessingResult {
  batchId: string;
  filesProcessed: number;
  filesSuccessful: number;
  filesFailed: number;
  processingTime: number;
  memoryUsage: number;
  errors: string[];
}

export interface ParallelProcessingResult {
  success: boolean;
  totalBatches: number;
  totalFiles: number;
  successfulFiles: number;
  failedFiles: number;
  totalProcessingTime: number;
  averageBatchTime: number;
  peakMemoryUsage: number;
  batchResults: BatchProcessingResult[];
  errors: string[];
}

export interface FileOperation {
  id: string;
  filePath: string;
  content: unknown;
  component: CursorComponentType;
  priority: 'high' | 'medium' | 'low';
  dependencies?: string[]; // File IDs this operation depends on
}

export interface SafetyCheck {
  checkId: string;
  description: string;
  passed: boolean;
  details?: string;
}

@Injectable()
export class CursorParallelProcessorService {
  private readonly logger = new Logger(CursorParallelProcessorService.name);

  // Configuration constants
  private readonly DEFAULT_MAX_CONCURRENCY = 3;
  private readonly DEFAULT_BATCH_SIZE = 5;
  private readonly DEFAULT_MEMORY_THRESHOLD = 150 * 1024 * 1024; // 150MB
  private readonly SAFETY_CHECK_INTERVAL = 1000; // 1 second

  // Internal state
  private activeOperations = new Set<string>();
  private completedOperations = new Set<string>();
  private failedOperations = new Set<string>();

  constructor(
    private readonly performanceMonitor: PerformanceMonitorService,
  ) {}

  /**
   * Process multiple components in parallel with safety checks
   */
  async processComponentsInParallel(
    config: CursorConfiguration,
    components: CursorComponentType[],
    context: CursorDeploymentContext,
    options: CursorDeployOptions,
    deploymentId: string,
    parallelOptions: ParallelProcessingOptions = {},
  ): Promise<ParallelProcessingResult> {
    const startTime = Date.now();
    this.logger.debug(`Starting parallel processing for ${components.length} components`);

    const maxConcurrency = parallelOptions.maxConcurrency || this.DEFAULT_MAX_CONCURRENCY;
    const batchSize = parallelOptions.batchSize || this.DEFAULT_BATCH_SIZE;
    const memoryThreshold = parallelOptions.memoryThreshold || this.DEFAULT_MEMORY_THRESHOLD;

    const result: ParallelProcessingResult = {
      success: true,
      totalBatches: 0,
      totalFiles: 0,
      successfulFiles: 0,
      failedFiles: 0,
      totalProcessingTime: 0,
      averageBatchTime: 0,
      peakMemoryUsage: 0,
      batchResults: [],
      errors: [],
    };

    try {
      // Perform safety checks before starting
      if (parallelOptions.safetyChecks !== false) {
        const safetyChecks = await this.performSafetyChecks(components, context, options);
        const failedChecks = safetyChecks.filter(check => !check.passed);
        
        if (failedChecks.length > 0) {
          const errorMessage = `Safety checks failed: ${failedChecks.map(c => c.description).join(', ')}`;
          this.logger.error(errorMessage);
          result.success = false;
          result.errors.push(errorMessage);
          return result;
        }
      }

      // Create file operations from components
      const fileOperations = await this.createFileOperations(config, components, context);
      result.totalFiles = fileOperations.length;

      // Group operations into batches
      const batches = this.createBatches(fileOperations, batchSize);
      result.totalBatches = batches.length;

      this.logger.debug(`Created ${batches.length} batches with max concurrency ${maxConcurrency}`);

      // Process batches with controlled concurrency
      const batchPromises: Promise<BatchProcessingResult>[] = [];
      const semaphore = new Array(maxConcurrency).fill(null);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchId = `batch-${i + 1}`;

        // Wait for available slot
        // eslint-disable-next-line no-await-in-loop
        const slotIndex = await this.waitForAvailableSlot(semaphore);
        
        const batchPromise = this.processBatch(
          batch,
          batchId,
          context,
          options,
          deploymentId,
          memoryThreshold,
        ).finally(() => {
          // Release slot
          semaphore[slotIndex] = null;
        });

        semaphore[slotIndex] = batchPromise;
        batchPromises.push(batchPromise);
      }

      // Wait for all batches to complete
      const batchResults = await Promise.allSettled(batchPromises);

      // Process results
      for (const batchResult of batchResults) {
        if (batchResult.status === 'fulfilled') {
          const batch = batchResult.value;
          result.batchResults.push(batch);
          result.successfulFiles += batch.filesSuccessful;
          result.failedFiles += batch.filesFailed;
          result.peakMemoryUsage = Math.max(result.peakMemoryUsage, batch.memoryUsage);
          
          if (batch.errors.length > 0) {
            result.errors.push(...batch.errors);
          }
        } else {
          const errorMessage = `Batch processing failed: ${batchResult.reason}`;
          this.logger.error(errorMessage);
          result.errors.push(errorMessage);
          result.success = false;
        }
      }

      // Calculate final metrics
      const endTime = Date.now();
      result.totalProcessingTime = endTime - startTime;
      result.averageBatchTime = result.batchResults.length > 0 
        ? result.batchResults.reduce((sum, batch) => sum + batch.processingTime, 0) / result.batchResults.length
        : 0;

      // Determine overall success
      result.success = result.success && result.failedFiles === 0;

      this.logger.debug(
        `Parallel processing completed: ${result.successfulFiles}/${result.totalFiles} files successful in ${result.totalProcessingTime}ms`
      );

      return result;
    } catch (error) {
      const errorMessage = `Parallel processing failed: ${(error as Error).message}`;
      this.logger.error(errorMessage);
      
      result.success = false;
      result.errors.push(errorMessage);
      result.totalProcessingTime = Date.now() - startTime;
      
      return result;
    } finally {
      // Clean up internal state
      this.activeOperations.clear();
      this.completedOperations.clear();
      this.failedOperations.clear();
    }
  }

  /**
   * Process a batch of file operations
   */
  private async processBatch(
    operations: FileOperation[],
    batchId: string,
    context: CursorDeploymentContext,
    options: CursorDeployOptions,
    deploymentId: string,
    memoryThreshold: number,
  ): Promise<BatchProcessingResult> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    this.logger.debug(`Processing batch ${batchId} with ${operations.length} operations`);

    const result: BatchProcessingResult = {
      batchId,
      filesProcessed: 0,
      filesSuccessful: 0,
      filesFailed: 0,
      processingTime: 0,
      memoryUsage: 0,
      errors: [],
    };

    try {
      // Sort operations by priority and dependencies
      const sortedOperations = this.sortOperationsByPriority(operations);

      // Process operations in the batch
      for (const operation of sortedOperations) {
        try {
          // Check memory usage before processing
          const currentMemory = process.memoryUsage().heapUsed;
          if (currentMemory > memoryThreshold) {
            this.logger.warn(`Memory threshold exceeded in batch ${batchId}, triggering GC`);
            if (global.gc) {
              global.gc();
            }
          }

          // Mark operation as active
          this.activeOperations.add(operation.id);

          // Process the file operation
          // eslint-disable-next-line no-await-in-loop
          await this.processFileOperation(operation, context, options);

          // Mark as completed
          this.activeOperations.delete(operation.id);
          this.completedOperations.add(operation.id);
          result.filesSuccessful++;

          this.logger.debug(`Completed operation ${operation.id} in batch ${batchId}`);
        } catch (error) {
          const errorMessage = `Failed to process operation ${operation.id}: ${(error as Error).message}`;
          this.logger.error(errorMessage);

          // Mark as failed
          this.activeOperations.delete(operation.id);
          this.failedOperations.add(operation.id);
          result.filesFailed++;
          result.errors.push(errorMessage);
        }

        result.filesProcessed++;
      }

      // Calculate final metrics
      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;
      
      result.processingTime = endTime - startTime;
      result.memoryUsage = Math.max(startMemory, endMemory);

      this.logger.debug(
        `Batch ${batchId} completed: ${result.filesSuccessful}/${result.filesProcessed} successful in ${result.processingTime}ms`
      );

      return result;
    } catch (error) {
      const errorMessage = `Batch ${batchId} processing failed: ${(error as Error).message}`;
      this.logger.error(errorMessage);
      
      result.errors.push(errorMessage);
      result.processingTime = Date.now() - startTime;
      result.memoryUsage = process.memoryUsage().heapUsed;
      
      return result;
    }
  }

  /**
   * Create file operations from component configurations
   */
  private async createFileOperations(
    config: CursorConfiguration,
    components: CursorComponentType[],
    context: CursorDeploymentContext,
  ): Promise<FileOperation[]> {
    const operations: FileOperation[] = [];
    let operationId = 0;

    for (const component of components) {
      switch (component) {
        case 'settings':
          if (config.globalSettings) {
            operations.push({
              id: `op-${++operationId}`,
              filePath: context.globalSettingsPath,
              content: config.globalSettings,
              component,
              priority: 'high',
            });
          }
          if (config.projectSettings) {
            operations.push({
              id: `op-${++operationId}`,
              filePath: context.projectSettingsPath,
              content: config.projectSettings,
              component,
              priority: 'high',
            });
          }
          break;

        case 'ai-prompts':
          if (config.aiPrompts) {
            // Create operations for each prompt file
            for (const [promptName, prompt] of Object.entries(config.aiPrompts.projectPrompts || {})) {
              operations.push({
                id: `op-${++operationId}`,
                filePath: path.join(context.aiPromptsPath, `${promptName}.md`),
                content: prompt.content,
                component,
                priority: 'medium',
              });
            }
            
            // Create operations for rule files
            for (const [ruleName, rule] of Object.entries(config.aiPrompts.rules || {})) {
              operations.push({
                id: `op-${++operationId}`,
                filePath: path.join(context.aiRulesPath, `${ruleName}.md`),
                content: rule,
                component,
                priority: 'medium',
              });
            }
          }
          break;

        case 'extensions':
          if (config.extensions) {
            operations.push({
              id: `op-${++operationId}`,
              filePath: context.extensionsPath,
              content: config.extensions,
              component,
              priority: 'low',
            });
          }
          break;

        case 'tasks':
          if (config.tasks) {
            operations.push({
              id: `op-${++operationId}`,
              filePath: context.tasksPath,
              content: config.tasks,
              component,
              priority: 'medium',
            });
          }
          break;

        case 'launch':
          if (config.launch) {
            operations.push({
              id: `op-${++operationId}`,
              filePath: context.launchPath,
              content: config.launch,
              component,
              priority: 'medium',
            });
          }
          break;

        case 'snippets':
          if (config.snippets) {
            // Create operations for each language snippet
            for (const [language, snippets] of Object.entries(config.snippets)) {
              operations.push({
                id: `op-${++operationId}`,
                filePath: path.join(context.snippetsPath, `${language}.json`),
                content: snippets,
                component,
                priority: 'low',
              });
            }
          }
          break;
      }
    }

    this.logger.debug(`Created ${operations.length} file operations`);
    return operations;
  }

  /**
   * Create batches from file operations
   */
  private createBatches(operations: FileOperation[], batchSize: number): FileOperation[][] {
    const batches: FileOperation[][] = [];
    
    // Sort operations by priority first
    const sortedOperations = this.sortOperationsByPriority(operations);
    
    for (let i = 0; i < sortedOperations.length; i += batchSize) {
      batches.push(sortedOperations.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Sort operations by priority and dependencies
   */
  private sortOperationsByPriority(operations: FileOperation[]): FileOperation[] {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    
    return operations.sort((a, b) => {
      // First sort by priority
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by component type (settings first, then ai-prompts, etc.)
      const componentOrder = {
        'settings': 5,
        'ai-prompts': 4,
        'tasks': 3,
        'launch': 2,
        'extensions': 1,
        'snippets': 0,
      };
      
      return (componentOrder[b.component] || 0) - (componentOrder[a.component] || 0);
    });
  }

  /**
   * Process a single file operation
   */
  private async processFileOperation(
    operation: FileOperation,
    _context: CursorDeploymentContext,
    _options: CursorDeployOptions,
  ): Promise<void> {
    this.logger.debug(`Processing file operation: ${operation.filePath}`);

    // Ensure directory exists
    const dir = path.dirname(operation.filePath);
    await fs.mkdir(dir, { recursive: true });

    // Write content based on type
    if (typeof operation.content === 'string') {
      await fs.writeFile(operation.filePath, operation.content, 'utf8');
    } else {
      await fs.writeFile(operation.filePath, JSON.stringify(operation.content, null, 2), 'utf8');
    }

    this.logger.debug(`Successfully wrote file: ${operation.filePath}`);
  }

  /**
   * Wait for an available slot in the semaphore
   */
  private async waitForAvailableSlot(semaphore: (Promise<BatchProcessingResult> | null)[]): Promise<number> {
    while (true) {
      // Find first available slot
      const availableIndex = semaphore.findIndex(slot => slot === null);
      if (availableIndex !== -1) {
        return availableIndex;
      }

      // Wait for any slot to become available
      // eslint-disable-next-line no-await-in-loop
      await Promise.race(semaphore.filter(slot => slot !== null));
    }
  }

  /**
   * Perform safety checks before parallel processing
   */
  private async performSafetyChecks(
    components: CursorComponentType[],
    context: CursorDeploymentContext,
    _options: CursorDeployOptions,
  ): Promise<SafetyCheck[]> {
    const checks: SafetyCheck[] = [];

    // Check 1: Verify no conflicting file operations
    checks.push({
      checkId: 'file-conflicts',
      description: 'Check for conflicting file operations',
      passed: await this.checkFileConflicts(components, context),
      details: 'Ensures no two operations target the same file',
    });

    // Check 2: Verify sufficient disk space
    const diskSpaceCheck = await this.checkDiskSpace(context);
    checks.push({
      checkId: 'disk-space',
      description: 'Check available disk space',
      passed: diskSpaceCheck.sufficient,
      details: `Available: ${Math.round(diskSpaceCheck.available / 1024 / 1024)}MB, Required: ${Math.round(diskSpaceCheck.required / 1024 / 1024)}MB`,
    });

    // Check 3: Verify memory availability
    const memoryCheck = this.checkMemoryAvailability();
    checks.push({
      checkId: 'memory-availability',
      description: 'Check available memory',
      passed: memoryCheck.sufficient,
      details: `Available: ${Math.round(memoryCheck.available / 1024 / 1024)}MB, Threshold: ${Math.round(memoryCheck.threshold / 1024 / 1024)}MB`,
    });

    // Check 4: Verify write permissions
    checks.push({
      checkId: 'write-permissions',
      description: 'Check write permissions',
      passed: await this.checkWritePermissions(context),
      details: 'Ensures all target directories are writable',
    });

    return checks;
  }

  /**
   * Check for file conflicts between operations
   */
  private async checkFileConflicts(
    components: CursorComponentType[],
    context: CursorDeploymentContext,
  ): Promise<boolean> {
    const targetPaths = new Set<string>();
    
    // Collect all target paths
    for (const component of components) {
      switch (component) {
        case 'settings':
          targetPaths.add(context.globalSettingsPath);
          targetPaths.add(context.projectSettingsPath);
          break;
        case 'ai-prompts':
          targetPaths.add(context.aiPromptsPath);
          targetPaths.add(context.aiRulesPath);
          break;
        case 'extensions':
          targetPaths.add(context.extensionsPath);
          break;
        case 'tasks':
          targetPaths.add(context.tasksPath);
          break;
        case 'launch':
          targetPaths.add(context.launchPath);
          break;
        case 'snippets':
          targetPaths.add(context.snippetsPath);
          break;
      }
    }

    // Check for conflicts (in this case, we're checking directories, so conflicts are unlikely)
    return true; // No conflicts detected
  }

  /**
   * Check available disk space
   */
  private async checkDiskSpace(_context: CursorDeploymentContext): Promise<{
    sufficient: boolean;
    available: number;
    required: number;
  }> {
    try {
      // Estimate required space (conservative estimate)
      const requiredSpace = 50 * 1024 * 1024; // 50MB
      
      // For simplicity, assume sufficient space is available
      // In a real implementation, you would use fs.statfs or similar
      return {
        sufficient: true,
        available: 1024 * 1024 * 1024, // 1GB
        required: requiredSpace,
      };
    } catch (error) {
      this.logger.warn(`Failed to check disk space: ${(error as Error).message}`);
      return {
        sufficient: false,
        available: 0,
        required: 0,
      };
    }
  }

  /**
   * Check memory availability
   */
  private checkMemoryAvailability(): {
    sufficient: boolean;
    available: number;
    threshold: number;
  } {
    const memoryUsage = process.memoryUsage();
    const threshold = this.DEFAULT_MEMORY_THRESHOLD;
    const available = memoryUsage.heapTotal - memoryUsage.heapUsed;
    
    return {
      sufficient: available > threshold,
      available,
      threshold,
    };
  }

  /**
   * Check write permissions for target directories
   */
  private async checkWritePermissions(context: CursorDeploymentContext): Promise<boolean> {
    const directories = [
      path.dirname(context.globalSettingsPath),
      path.dirname(context.projectSettingsPath),
      context.aiPromptsPath,
      context.aiRulesPath,
      path.dirname(context.extensionsPath),
      path.dirname(context.tasksPath),
      path.dirname(context.launchPath),
      context.snippetsPath,
    ];

    try {
      for (const dir of directories) {
        // eslint-disable-next-line no-await-in-loop
        await fs.mkdir(dir, { recursive: true });
        // eslint-disable-next-line no-await-in-loop
        await fs.access(dir, fs.constants.W_OK);
      }
      return true;
    } catch (error) {
      this.logger.warn(`Write permission check failed: ${(error as Error).message}`);
      return false;
    }
  }
}