import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { LRUCache } from 'lru-cache';

export interface CacheOptions {
  ttl?: number; // Time to live in ms
  maxSize?: number; // Max cache size in bytes
  maxItems?: number; // Max number of items
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  size: number;
  hits: number;
}

@Injectable()
export class CacheManagerService {
  private readonly logger = new Logger(CacheManagerService.name);
  private readonly caches = new Map<string, LRUCache<string, any>>();
  private readonly DEFAULT_TTL = 15 * 60 * 1000; // 15 minutes
  private readonly DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly DEFAULT_MAX_ITEMS = 1000;

  /**
   * Get or create a cache namespace
   */
  getCache<T>(
    namespace: string,
    options?: CacheOptions,
  ): LRUCache<string, CacheEntry<T>> {
    if (!this.caches.has(namespace)) {
      const cache = new LRUCache<string, CacheEntry<T>>({
        max: options?.maxItems || this.DEFAULT_MAX_ITEMS,
        ttl: options?.ttl || this.DEFAULT_TTL,
        sizeCalculation: (entry) => entry.size,
        maxSize: options?.maxSize || this.DEFAULT_MAX_SIZE,
        dispose: (value, key) => {
          this.logger.debug(`Cache entry expired: ${namespace}:${key}`);
        },
      });

      this.caches.set(namespace, cache);
    }

    return this.caches.get(namespace) as LRUCache<string, CacheEntry<T>>;
  }

  /**
   * Get cached value
   */
  async get<T>(
    namespace: string,
    key: string,
    factory?: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T | undefined> {
    const cache = this.getCache<T>(namespace, options);
    const cacheKey = this.generateKey(key);

    const entry = cache.get(cacheKey);

    if (entry) {
      entry.hits++;
      this.logger.debug(`Cache hit: ${namespace}:${key} (hits: ${entry.hits})`);
      return entry.data;
    }

    if (factory) {
      this.logger.debug(`Cache miss: ${namespace}:${key}, generating...`);
      const data = await factory();
      await this.set(namespace, key, data, options);
      return data;
    }

    return undefined;
  }

  /**
   * Set cached value
   */
  async set<T>(
    namespace: string,
    key: string,
    value: T,
    options?: CacheOptions,
  ): Promise<void> {
    const cache = this.getCache<T>(namespace, options);
    const cacheKey = this.generateKey(key);

    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      size: this.calculateSize(value),
      hits: 0,
    };

    cache.set(cacheKey, entry);
    this.logger.debug(`Cache set: ${namespace}:${key} (size: ${entry.size})`);
  }

  /**
   * Delete cached value
   */
  delete(namespace: string, key: string): boolean {
    const cache = this.caches.get(namespace);
    if (!cache) return false;

    const cacheKey = this.generateKey(key);
    return cache.delete(cacheKey);
  }

  /**
   * Clear a namespace or all caches
   */
  clear(namespace?: string): void {
    if (namespace) {
      const cache = this.caches.get(namespace);
      if (cache) {
        cache.clear();
        this.logger.debug(`Cache cleared: ${namespace}`);
      }
    } else {
      this.caches.forEach((cache, ns) => {
        cache.clear();
        this.logger.debug(`Cache cleared: ${ns}`);
      });
      this.caches.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getStats(namespace?: string): any {
    if (namespace) {
      const cache = this.caches.get(namespace);
      if (!cache) return null;

      return {
        namespace,
        size: cache.size,
        calculatedSize: cache.calculatedSize,
        itemCount: cache.size,
      };
    }

    const stats: any = {};
    this.caches.forEach((cache, ns) => {
      stats[ns] = {
        size: cache.size,
        calculatedSize: cache.calculatedSize,
        itemCount: cache.size,
      };
    });

    return stats;
  }

  /**
   * Warm up cache with preloaded data
   */
  async warmUp<T>(
    namespace: string,
    items: Array<{ key: string; factory: () => Promise<T> }>,
    options?: CacheOptions,
  ): Promise<void> {
    this.logger.log(
      `Warming up cache: ${namespace} with ${items.length} items`,
    );

    const promises = items.map(async ({ key, factory }) => {
      try {
        const value = await factory();
        await this.set(namespace, key, value, options);
      } catch (error) {
        this.logger.warn(
          `Failed to warm up cache for ${key}: ${error.message}`,
        );
      }
    });

    await Promise.all(promises);
    this.logger.log(`Cache warm-up completed: ${namespace}`);
  }

  /**
   * Create a memoized version of a function
   */
  memoize<T extends (...arguments_: any[]) => Promise<any>>(
    function_: T,
    options?: {
      namespace?: string;
      keyGenerator?: (...arguments_: Parameters<T>) => string;
      ttl?: number;
    },
  ): T {
    const namespace = options?.namespace || function_.name || 'memoized';
    const keyGenerator =
      options?.keyGenerator || ((...arguments_) => JSON.stringify(arguments_));

    return (async (...arguments_: Parameters<T>) => {
      const key = keyGenerator(...arguments_);

      return this.get(namespace, key, () => function_(...arguments_), {
        ttl: options?.ttl,
      });
    }) as T;
  }

  // Private helper methods

  private generateKey(input: string): string {
    // Use hash for long keys to avoid memory issues
    if (input.length > 250) {
      const hash = createHash('sha256');
      hash.update(input);
      return hash.digest('hex');
    }
    return input;
  }

  private calculateSize(value: any): number {
    try {
      const string_ = JSON.stringify(value);
      return Buffer.byteLength(string_, 'utf8');
    } catch {
      // If JSON.stringify fails, estimate size
      return 1024; // Default 1KB
    }
  }
}
