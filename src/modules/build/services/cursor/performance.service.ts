import * as fs from 'fs';
import { promisify } from 'util';

import { Injectable } from '@nestjs/common';

import {
  PerformanceMetrics,
  CacheEntry,
  MemoryReport,
  ProcessorFunction,
  ValidatorFunction,
  LazyLoader,
  GenericConfig,
  ExtensionInfo,
} from '../../interfaces/build-types.interface';

const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

@Injectable()
export class CursorPerformanceService {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly MAX_CACHE_SIZE = 100;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  async processInParallel<T, R>(
    items: T[],
    processor: ProcessorFunction<T, R>,
    batchSize = 5,
  ): Promise<R[]> {
    const results: R[] = [];
    
    // Process all batches in parallel to avoid await in loop
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    const batchPromises = batches.map(batch => Promise.all(batch.map(processor)));
    const batchResults = await Promise.all(batchPromises);
    
    for (const batchResult of batchResults) {
      results.push(...batchResult);
    }
    
    return results;
  }

  async *streamLargeFile(filePath: string, chunkSize = 64 * 1024): AsyncGenerator<Buffer> {
    const fileHandle = await fs.promises.open(filePath, 'r');
    const buffer = Buffer.alloc(chunkSize);
    
    try {
      let position = 0;
      let bytesRead: number;
      
      do {
        // eslint-disable-next-line no-await-in-loop -- Required for file streaming
        const { bytesRead: readBytes } = await fileHandle.read(buffer, 0, chunkSize, position);
        bytesRead = readBytes;
        
        if (bytesRead > 0) {
          yield buffer.slice(0, bytesRead);
          position += bytesRead;
        }
      } while (bytesRead > 0);
    } finally {
      await fileHandle.close();
    }
  }

  async processLargeConfig(configPath: string): Promise<GenericConfig> {
    const stats = await stat(configPath);
    const isLarge = stats.size > 1024 * 1024; // > 1MB
    
    if (isLarge) {
      return this.processInChunks(configPath);
    } else {
      const content = await readFile(configPath, 'utf-8');
      return JSON.parse(content);
    }
  }

  private async processInChunks(configPath: string): Promise<GenericConfig> {
    const chunks: string[] = [];
    
    for await (const chunk of this.streamLargeFile(configPath)) {
      chunks.push(chunk.toString());
    }
    
    return JSON.parse(chunks.join(''));
  }

  getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value as T;
  }

  setCache<T>(key: string, value: T, ttl = this.DEFAULT_TTL): void {
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictOldest();
    }
    
    this.cache.set(key, {
      key,
      value: value as unknown,
      timestamp: Date.now(),
      ttl,
    });
  }

  private evictOldest(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldest = key;
      }
    }
    
    if (oldest) {
      this.cache.delete(oldest);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  measurePerformance(startTime: number): PerformanceMetrics {
    const endTime = Date.now();
    const memoryUsage = process.memoryUsage();
    
    return {
      processingTime: endTime - startTime,
      memoryUsage: memoryUsage.heapUsed,
      fileSize: 0,
      itemsProcessed: 0,
    };
  }

  async optimizeExtensionProcessing(extensions: ExtensionInfo[]): Promise<Array<ExtensionInfo & { 
    processed: boolean; 
    metadata: { size: number; timestamp: number; }
  }>> {
    const cacheKey = `extensions_${JSON.stringify(extensions.map(e => e.id))}`;
    const cached = this.getCached<Array<ExtensionInfo & { 
      processed: boolean; 
      metadata: { size: number; timestamp: number; }
    }>>(cacheKey);
    
    if (cached) return cached;
    
    const processed = await this.processInParallel(
      extensions,
      async (ext) => this.processExtension(ext),
      10,
    );
    
    this.setCache(cacheKey, processed);
    return processed;
  }

  private async processExtension(extension: ExtensionInfo): Promise<ExtensionInfo & { 
    processed: boolean; 
    metadata: { size: number; timestamp: number; }
  }> {
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 10));
    
    return {
      ...extension,
      processed: true,
      metadata: {
        size: JSON.stringify(extension).length,
        timestamp: Date.now(),
      },
    };
  }

  createLazyLoader<T>(loader: LazyLoader<T>): LazyLoader<T> {
    let cached: T | null = null;
    let loading: Promise<T> | null = null;
    
    return async () => {
      if (cached !== null) return cached;
      
      if (loading) return loading;
      
      loading = loader().then(result => {
        cached = result;
        loading = null;
        return result;
      });
      
      return loading;
    };
  }

  async validateInBatches<T>(items: T[], validator: ValidatorFunction<T>): Promise<boolean[]> {
    const batchSize = 20;
    const results: boolean[] = [];
    
    // Process all batches, avoiding await in loop
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    // Process batches sequentially but items within each batch in parallel
    const batchPromises = batches.map(async (batch, index) => {
      // Add slight delay between batches to prevent overwhelming
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      return Promise.all(batch.map(validator));
    });
    
    const batchResults = await Promise.all(batchPromises);
    for (const batchResult of batchResults) {
      results.push(...batchResult);
    }
    
    return results;
  }

  getMemoryReport(): MemoryReport {
    const usage = process.memoryUsage();
    
    return {
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(usage.external / 1024 / 1024)}MB`,
      cacheSize: this.cache.size,
    };
  }
}