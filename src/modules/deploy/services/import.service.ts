import { Injectable, Logger } from '@nestjs/common';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import { SupabaseService } from '../../supabase/supabase.service';
import { DEPLOYMENT_DEFAULTS } from '../constants/deployment.constants';

import {
  LargeFileStreamerService,
  ProgressInfo,
} from './large-file-streamer.service';

export interface CloudMetadataDto {
  id: string;
  name: string;
  version: string;
  createdAt: string;
  platform: string;
  size: number;
}

export interface ImportOptions {
  enableLargeFileStreaming?: boolean;
  onProgress?: (progress: ProgressInfo) => void;
  maxFileSize?: number; // bytes
  enableMemoryOptimization?: boolean;
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);
  private readonly cache = new Map<
    string,
    { data: TaptikContext; timestamp: number }
  >();
  private readonly CACHE_TTL = DEPLOYMENT_DEFAULTS.CACHE_TTL;
  private readonly RETRY_ATTEMPTS = DEPLOYMENT_DEFAULTS.RETRY_ATTEMPTS;
  private readonly RETRY_DELAY = DEPLOYMENT_DEFAULTS.RETRY_DELAY;
  private readonly LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly largeFileStreamer: LargeFileStreamerService,
  ) {}

  async importFromSupabase(configId: string): Promise<TaptikContext> {
    return this.importConfiguration(configId);
  }

  async importConfiguration(
    configId: string,
    options: ImportOptions = {},
  ): Promise<TaptikContext> {
    // Check cache first
    const cached = this.getFromCache(configId);
    if (cached) {
      return cached;
    }

    // Get metadata to check file size
    const metadata = await this.getConfigMetadata(configId);
    const isLargeFile = metadata
      ? metadata.size > this.LARGE_FILE_THRESHOLD
      : false;

    if (isLargeFile && options.enableLargeFileStreaming !== false) {
      this.logger.debug(
        `Processing large configuration (${Math.round((metadata?.size || 0) / 1024 / 1024)}MB) with streaming`,
      );
      return this.importLargeConfiguration(configId, options);
    }

    // Standard import for smaller files
    const data = await this.fetchFromStorage(configId);
    const context = await this.parseConfiguration(data);

    // Cache the result
    this.setCache(configId, context);

    return context;
  }

  /**
   * Import large configuration with streaming optimization
   */
  async importLargeConfiguration(
    configId: string,
    options: ImportOptions = {},
  ): Promise<TaptikContext> {
    let context: TaptikContext;

    try {
      // Get estimated processing time
      const metadata = await this.getConfigMetadata(configId);
      const estimatedTime = this.largeFileStreamer.getEstimatedProcessingTime(
        metadata?.size || 0,
      );

      this.logger.debug(
        `Estimated processing time: ${Math.round(estimatedTime / 1000)}s`,
      );

      // Progress callback
      const onProgress =
        options.onProgress ||
        ((progress) => {
          this.logger.debug(
            `Import progress: ${progress.percentage}% (${progress.current}/${progress.total})`,
          );
        });

      // Fetch raw data
      const rawData = await this.fetchFromStorage(configId);

      // Process with streaming if data is large enough
      if (rawData.length > this.LARGE_FILE_THRESHOLD) {
        let parsedContext: TaptikContext | null = null;

        const result = await this.largeFileStreamer.streamProcessConfiguration(
          rawData,
          async (_chunk: unknown) => {
            // For import, we mainly need to parse the complete data
            // This is more of a memory optimization than actual streaming processing
            if (!parsedContext) {
              parsedContext = await this.parseConfiguration(rawData);
            }
            return { chunk: 'processed' };
          },
          {
            chunkSize: 1024 * 1024, // 1MB chunks for import
            onProgress,
            enableGarbageCollection: options.enableMemoryOptimization ?? true,
            memoryThreshold: 50 * 1024 * 1024, // 50MB
          },
        );

        if (!result.success) {
          throw new Error(`Large file streaming failed: ${result.error}`);
        }

        if (!parsedContext) {
          throw new Error('Failed to parse configuration during streaming');
        }

        context = parsedContext;
      } else {
        // Fallback to standard parsing
        context = await this.parseConfiguration(rawData);
      }

      // Cache the result (be mindful of memory usage for large configs)
      if ((metadata?.size || 0) < 50 * 1024 * 1024) {
        // Only cache configs smaller than 50MB
        this.setCache(configId, context);
      }

      this.logger.debug(`Large configuration import completed successfully`);
      return context;
    } catch (error) {
      this.logger.error(
        `Large configuration import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async validateConfigExists(configId: string): Promise<boolean> {
    try {
      const client = this.supabaseService.getClient();
      const { data, error } = await client.storage
        .from('taptik-configs')
        .list('configs', {
          search: `${configId}.json`,
        });

      if (error || !data) {
        return false;
      }

      return data.some((file) => file.name === `${configId}.json`);
    } catch {
      return false;
    }
  }

  async getConfigMetadata(configId: string): Promise<CloudMetadataDto | null> {
    try {
      // FIXME: metadata -> bucket이 아니라 table에서 가져오도록 수정
      const client = this.supabaseService.getClient();
      const { data, error } = await client.storage
        .from('taptik-configs')
        .download(`metadata/${configId}.json`);

      if (error || !data) {
        return null;
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      return JSON.parse(buffer.toString('utf8')) as CloudMetadataDto;
    } catch {
      return null;
    }
  }

  private async fetchFromStorage(configId: string): Promise<Buffer> {
    return this.retryFetchOperation(configId, 0);
  }

  private async retryFetchOperation(
    configId: string,
    attempt: number,
  ): Promise<Buffer> {
    try {
      // FIXME: bucket name 확인(push와 싱크)
      const client = this.supabaseService.getClient();
      const { data, error } = await client.storage
        .from('taptik-configs')
        .download(`configs/${configId}.json`);

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data received from Supabase');
      }

      return Buffer.from(await data.arrayBuffer());
    } catch (error) {
      if (attempt >= this.RETRY_ATTEMPTS - 1) {
        throw new Error(
          `Failed to fetch configuration after ${this.RETRY_ATTEMPTS} attempts: ${(error as Error).message}`,
        );
      }

      // Wait before retry with exponential backoff
      await this.delay(this.RETRY_DELAY * Math.pow(2, attempt));
      return this.retryFetchOperation(configId, attempt + 1);
    }
  }

  private async parseConfiguration(data: Buffer): Promise<TaptikContext> {
    try {
      const jsonString = data.toString('utf8');
      // FIXME: table 설계 확인
      return JSON.parse(jsonString) as TaptikContext;
    } catch (error) {
      throw new Error(
        `Failed to parse configuration: ${(error as Error).message}`,
      );
    }
  }

  private getFromCache(configId: string): TaptikContext | null {
    const cached = this.cache.get(configId);

    if (!cached) {
      return null;
    }

    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(configId);
      return null;
    }

    return cached.data;
  }

  private setCache(configId: string, data: TaptikContext): void {
    this.cache.set(configId, {
      data,
      timestamp: Date.now(),
    });

    // Clean up old cache entries
    this.cleanupCache();
  }

  private cleanupCache(): void {
    const now = Date.now();

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
