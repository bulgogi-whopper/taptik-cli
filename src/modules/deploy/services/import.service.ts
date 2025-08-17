import { Injectable } from '@nestjs/common';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import { SupabaseService } from '../../supabase/supabase.service';
import { DEPLOYMENT_DEFAULTS } from '../constants/deployment.constants';

export interface CloudMetadataDto {
  id: string;
  name: string;
  version: string;
  createdAt: string;
  platform: string;
  size: number;
}

@Injectable()
export class ImportService {
  private readonly cache = new Map<
    string,
    { data: TaptikContext; timestamp: number }
  >();
  private readonly CACHE_TTL = DEPLOYMENT_DEFAULTS.CACHE_TTL;
  private readonly RETRY_ATTEMPTS = DEPLOYMENT_DEFAULTS.RETRY_ATTEMPTS;
  private readonly RETRY_DELAY = DEPLOYMENT_DEFAULTS.RETRY_DELAY;

  constructor(private readonly supabaseService: SupabaseService) {}

  async importFromSupabase(configId: string): Promise<TaptikContext> {
    return this.importConfiguration(configId);
  }

  async importConfiguration(configId: string): Promise<TaptikContext> {
    // Check cache first
    const cached = this.getFromCache(configId);
    if (cached) {
      return cached;
    }

    // Fetch from Supabase with retry logic
    const data = await this.fetchFromStorage(configId);
    const context = await this.parseConfiguration(data);

    // Cache the result
    this.setCache(configId, context);

    return context;
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
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.RETRY_ATTEMPTS; attempt++) {
      try {
        const client = this.supabaseService.getClient();
        const { data, error } = await client.storage // eslint-disable-line no-await-in-loop
          .from('taptik-configs')
          .download(`configs/${configId}.json`);

        if (error) {
          throw new Error(`Supabase error: ${error.message}`);
        }

        if (!data) {
          throw new Error('No data received from Supabase');
        }

        return Buffer.from(await data.arrayBuffer()); // eslint-disable-line no-await-in-loop
      } catch (error) {
        lastError = error as Error;

        // Don't retry on the last attempt
        if (attempt < this.RETRY_ATTEMPTS - 1) {
          await this.delay(this.RETRY_DELAY * Math.pow(2, attempt)); // eslint-disable-line no-await-in-loop
        }
      }
    }

    throw new Error(
      `Failed to fetch configuration after ${this.RETRY_ATTEMPTS} attempts: ${lastError?.message}`,
    );
  }

  private async parseConfiguration(data: Buffer): Promise<TaptikContext> {
    try {
      const jsonString = data.toString('utf8');
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
