import * as fs from 'node:fs/promises';
import { Readable } from 'node:stream';

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export interface StreamProcessingOptions {
  chunkSize?: number; // Default: 2MB
  onProgress?: (progress: ProgressInfo) => void;
  enableGarbageCollection?: boolean;
  memoryThreshold?: number; // Bytes, default: 100MB
  maxConcurrentChunks?: number; // Default: 3
  enableCompression?: boolean;
}

export interface ProgressInfo {
  current: number;
  total: number;
  percentage: number;
  estimatedTimeRemaining: number; // milliseconds
  currentChunk?: number;
  totalChunks?: number;
}

export interface StreamProcessingResult {
  success: boolean;
  chunksProcessed: number;
  totalSize: number;
  processingTime: number;
  averageChunkTime: number;
  memoryUsagePeak: number;
  error?: string;
}

export interface MemoryOptimizationOptions {
  memoryThreshold: number;
  enableGarbageCollection?: boolean;
  clearCaches?: boolean;
}

export interface MemoryOptimizationResult {
  memoryOptimized: boolean;
  gcTriggered: boolean;
  memoryBefore: number;
  memoryAfter: number;
}

export interface ProgressTracker {
  update(current: number): void;
  complete(): void;
  reset(): void;
}

type ChunkProcessor<T = unknown> = (chunk: unknown, chunkIndex: number) => Promise<T>;

@Injectable()
export class LargeFileStreamerService implements OnModuleDestroy {
  private readonly logger = new Logger(LargeFileStreamerService.name);
  
  // Configuration constants
  private readonly DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024; // 2MB
  private readonly LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB
  private readonly DEFAULT_MEMORY_THRESHOLD = 100 * 1024 * 1024; // 100MB
  private readonly PROCESSING_SPEED_ESTIMATE = 5 * 1024 * 1024; // 5MB/second

  // Internal state for cleanup
  private activeStreams = new Set<Readable>();
  private processingCache = new Map<string, unknown>();

  /**
   * Check if a file should be processed with streaming based on size
   */
  async isLargeFile(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile() && stats.size > this.LARGE_FILE_THRESHOLD;
    } catch (error) {
      this.logger.warn(`Could not check file size for ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Process large configuration with streaming and chunking
   */
  async streamProcessConfiguration<T>(
    configuration: unknown,
    chunkProcessor: ChunkProcessor<T>,
    options: StreamProcessingOptions = {},
  ): Promise<StreamProcessingResult> {
    const startTime = Date.now();
    const chunkSize = options.chunkSize || this.DEFAULT_CHUNK_SIZE;
    const memoryThreshold = options.memoryThreshold || this.DEFAULT_MEMORY_THRESHOLD;

    let chunksProcessed = 0;
    let totalSize = 0;
    let memoryUsagePeak = 0;

    try {
      // Serialize configuration to measure size
      const serialized = JSON.stringify(configuration);
      totalSize = Buffer.byteLength(serialized, 'utf8');

      this.logger.debug(`Processing configuration of size: ${Math.round(totalSize / 1024 / 1024)}MB`);

      // Create chunks
      const chunks = this.createChunks(serialized, chunkSize);
      const totalChunks = chunks.length;

      // Setup progress tracking
      const progressTracker = options.onProgress ? 
        this.createProgressTracker(totalChunks, options.onProgress) : null;

      // Process chunks
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        try {
          // Parse chunk back to object
          const chunkData = JSON.parse(chunk);
          
          // Process chunk
          await chunkProcessor(chunkData, i); // eslint-disable-line no-await-in-loop
          chunksProcessed++;

          // Update progress
          if (progressTracker) {
            progressTracker.update(i + 1);
          }

          // Monitor memory usage
          const currentMemory = process.memoryUsage().heapUsed;
          memoryUsagePeak = Math.max(memoryUsagePeak, currentMemory);

          // Optimize memory if threshold exceeded
          if (options.enableGarbageCollection && currentMemory > memoryThreshold) {
            await this.optimizeMemoryUsage({ // eslint-disable-line no-await-in-loop
              memoryThreshold,
              enableGarbageCollection: true,
              clearCaches: true,
            });
          }

          this.logger.debug(`Processed chunk ${i + 1}/${totalChunks}`);

        } catch (chunkError) {
          this.logger.error(`Failed to process chunk ${i}: ${chunkError instanceof Error ? chunkError.message : 'Unknown error'}`);
          throw chunkError;
        }
      }

      if (progressTracker) {
        progressTracker.complete();
      }

      const processingTime = Date.now() - startTime;
      const averageChunkTime = processingTime / chunksProcessed;

      this.logger.debug(`Streaming processing completed: ${chunksProcessed} chunks in ${processingTime}ms`);

      return {
        success: true,
        chunksProcessed,
        totalSize,
        processingTime,
        averageChunkTime,
        memoryUsagePeak,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error(`Streaming processing failed: ${errorMessage}`);

      return {
        success: false,
        chunksProcessed,
        totalSize,
        processingTime,
        averageChunkTime: chunksProcessed > 0 ? (Date.now() - startTime) / chunksProcessed : 0,
        memoryUsagePeak,
        error: errorMessage,
      };
    }
  }

  /**
   * Create a readable stream for large data
   */
  createChunkedStream(data: string, chunkSize: number = this.DEFAULT_CHUNK_SIZE): Readable {
    let currentIndex = 0;

    const readable = new Readable({
      read() {
        if (currentIndex >= data.length) {
          this.push(null); // End of stream
          return;
        }

        const chunk = data.slice(currentIndex, currentIndex + chunkSize);
        currentIndex += chunkSize;
        
        this.push(Buffer.from(chunk, 'utf8'));
      },
    });

    // Track active streams for cleanup
    this.activeStreams.add(readable);
    readable.on('close', () => {
      this.activeStreams.delete(readable);
    });

    return readable;
  }

  /**
   * Estimate processing time based on file size
   */
  getEstimatedProcessingTime(sizeInBytes: number): number {
    // Base estimate: 5MB/second processing speed
    const baseTimeMs = (sizeInBytes / this.PROCESSING_SPEED_ESTIMATE) * 1000;
    
    // Add overhead for large files (chunking, memory management)
    const overheadMultiplier = sizeInBytes > 50 * 1024 * 1024 ? 1.5 : 1.2;
    
    return Math.round(baseTimeMs * overheadMultiplier);
  }

  /**
   * Optimize memory usage during processing
   */
  async optimizeMemoryUsage(options: MemoryOptimizationOptions): Promise<MemoryOptimizationResult> {
    const memoryBefore = process.memoryUsage().heapUsed;
    let gcTriggered = false;

    try {
      // Clear internal caches
      if (options.clearCaches) {
        this.processingCache.clear();
      }

      // Trigger garbage collection if available and enabled
      if (options.enableGarbageCollection && global.gc) {
        global.gc();
        gcTriggered = true;
        this.logger.debug('Garbage collection triggered');
      }

      // Add a small delay to allow GC to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryFreed = memoryBefore - memoryAfter;

      if (memoryFreed > 0) {
        this.logger.debug(`Memory optimized: freed ${Math.round(memoryFreed / 1024 / 1024)}MB`);
      }

      return {
        memoryOptimized: true,
        gcTriggered,
        memoryBefore,
        memoryAfter,
      };

    } catch (error) {
      this.logger.warn(`Memory optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        memoryOptimized: false,
        gcTriggered,
        memoryBefore,
        memoryAfter: process.memoryUsage().heapUsed,
      };
    }
  }

  /**
   * Create a progress tracker with time estimation
   */
  createProgressTracker(total: number, onProgress: (progress: ProgressInfo) => void): ProgressTracker {
    const startTime = Date.now();
    const _lastUpdateTime = startTime;

    return {
      update: (current: number) => {
        const now = Date.now();
        const elapsed = now - startTime;
        const percentage = Math.round((current / total) * 100);
        
        // Estimate time remaining based on current progress
        let estimatedTimeRemaining = 0;
        if (current > 0) {
          const averageTimePerItem = elapsed / current;
          const remainingItems = total - current;
          estimatedTimeRemaining = Math.round(remainingItems * averageTimePerItem);
        }

        onProgress({
          current,
          total,
          percentage,
          estimatedTimeRemaining,
          currentChunk: current,
          totalChunks: total,
        });
      },

      complete: () => {
        onProgress({
          current: total,
          total,
          percentage: 100,
          estimatedTimeRemaining: 0,
          currentChunk: total,
          totalChunks: total,
        });
      },

      reset: () => {
        // Reset could reinitialize timing if needed
      },
    };
  }

  /**
   * Validate chunk integrity against original data
   */
  validateChunkIntegrity(chunks: string[], originalData: unknown): boolean {
    try {
      // Reconstruct data from chunks
      const reconstructed = chunks.join('');
      const reconstructedData = JSON.parse(reconstructed);
      
      // Deep comparison (simple JSON string comparison)
      const originalSerialized = JSON.stringify(originalData);
      const reconstructedSerialized = JSON.stringify(reconstructedData);
      
      return originalSerialized === reconstructedSerialized;
    } catch (error) {
      this.logger.warn(`Chunk integrity validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Cleanup resources and clear caches
   */
  async cleanup(): Promise<void> {
    this.logger.debug('Cleaning up large file streamer resources');

    // Close all active streams
    for (const stream of this.activeStreams) {
      if (!stream.destroyed) {
        stream.destroy();
      }
    }
    this.activeStreams.clear();

    // Clear processing cache
    this.processingCache.clear();

    // Trigger garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * OnModuleDestroy lifecycle hook
   */
  async onModuleDestroy(): Promise<void> {
    await this.cleanup();
  }

  /**
   * Private helper to create chunks from serialized data
   */
  private createChunks(data: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }
    
    return chunks;
  }
}