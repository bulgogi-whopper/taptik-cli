import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { CONTEXT_VERSION, MAX_CONTEXT_SIZE } from '../constants';
import { CompressionUtility } from '../utils/compression.utility';
import { EncryptionUtility } from '../utils/encryption.utility';

import type {
  TaptikContext,
  ContextBundle,
  BundleMetadata,
  ValidationResult,
} from '../interfaces';

export interface UploadOptions {
  compress?: boolean;
  encrypt?: boolean;
  metadata?: Partial<BundleMetadata>;
}

export interface DownloadOptions {
  decrypt?: boolean;
  decompress?: boolean;
}

export interface ListOptions {
  limit?: number;
  offset?: number;
  tags?: string[];
  author?: string;
  isPrivate?: boolean;
}

export interface ContextSummary {
  id: string;
  name: string;
  description?: string;
  author: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  size: number;
  download_count: number;
  is_private: boolean;
}

export interface StorageResult {
  success: boolean;
  id?: string;
  error?: string;
  url?: string;
}

@Injectable()
export class ContextStorageService {
  private readonly logger = new Logger(ContextStorageService.name);
  private supabase: SupabaseClient;
  private readonly bucketName = 'context-bundles';
  private readonly tableName = 'context_metadata';

  constructor(
    private readonly configService: ConfigService,
    private readonly compressionUtility: CompressionUtility,
    private readonly encryptionUtility: EncryptionUtility,
  ) {
    this.initializeSupabase();
  }

  private initializeSupabase(): void {
    const supabaseUrl = this.configService?.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService?.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn(
        'Supabase credentials not found. Storage features will be disabled.',
      );
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.logger.log('Supabase client initialized');
  }

  /**
   * Upload a context bundle to Supabase storage
   */
  async uploadContext(
    context: TaptikContext,
    metadata: BundleMetadata,
    options: UploadOptions = {},
  ): Promise<StorageResult> {
    try {
      if (!this.supabase) {
        throw new Error(
          'Supabase client not initialized. Please check your credentials.',
        );
      }

      // Create bundle
      const bundle: ContextBundle = {
        version: CONTEXT_VERSION,
        created_at: new Date().toISOString(),
        contexts: [context],
        metadata,
      };

      // Serialize context
      let data: Buffer = Buffer.from(JSON.stringify(bundle, null, 2));

      // Check size before compression
      if (data.length > MAX_CONTEXT_SIZE) {
        throw new Error(
          `Context size (${data.length} bytes) exceeds maximum allowed size (${MAX_CONTEXT_SIZE} bytes)`,
        );
      }

      // Compress if requested
      if (options.compress !== false) {
        this.logger.debug('Compressing context bundle...');
        data = await this.compressionUtility.compress(data);
        if (metadata) {
          metadata.compressed = true;
        }
      }

      // Encrypt if requested
      if (options.encrypt && metadata?.encryption) {
        this.logger.debug('Encrypting context bundle...');
        data = await this.encryptionUtility.encrypt(data);
      }

      // Generate unique ID
      const contextId = this.generateContextId();
      const filePath = `${contextId}.json${options.compress !== false ? '.gz' : ''}`;

      // Upload to storage bucket
      const { error: uploadError } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, data, {
          contentType:
            options.compress !== false
              ? 'application/gzip'
              : 'application/json',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Save metadata to database
      const { error: dbError } = await this.supabase
        .from(this.tableName)
        .insert({
          id: contextId,
          name: metadata.name,
          description: metadata.description,
          author: metadata.author,
          tags: context.metadata?.tags || [],
          file_path: filePath,
          file_size: data.length,
          is_compressed: options.compress !== false,
          is_encrypted: !!options.encrypt,
          checksum: metadata.checksum,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_private: context.metadata?.is_private || false,
          team_id: context.metadata?.team_id,
        });

      if (dbError) {
        // Rollback storage upload if database insert fails
        await this.supabase.storage.from(this.bucketName).remove([filePath]);
        throw dbError;
      }

      this.logger.log(`Context uploaded successfully: ${contextId}`);
      return { success: true, id: contextId };
    } catch (error) {
      this.logger.error(
        `Failed to upload context: ${error.message}`,
        error.stack,
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Download a context bundle from Supabase storage
   */
  async downloadContext(
    contextId: string,
    options: DownloadOptions = {},
  ): Promise<TaptikContext | null> {
    try {
      if (!this.supabase) {
        throw new Error(
          'Supabase client not initialized. Please check your credentials.',
        );
      }

      // Get metadata from database
      const { data: metadata, error: dbError } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('id', contextId)
        .single();

      if (dbError || !metadata) {
        throw new Error(`Context not found: ${contextId}`);
      }

      // Download from storage
      const { data: fileData, error: downloadError } =
        await this.supabase.storage
          .from(this.bucketName)
          .download(metadata.file_path);

      if (downloadError || !fileData) {
        throw downloadError || new Error('Failed to download context file');
      }

      // Convert Blob to Buffer
      let data = Buffer.from(await fileData.arrayBuffer());

      // Decrypt if needed
      if (metadata.is_encrypted && options.decrypt !== false) {
        this.logger.debug('Decrypting context bundle...');
        data = await this.encryptionUtility.decrypt(data);
      }

      // Decompress if needed
      if (metadata.is_compressed && options.decompress !== false) {
        this.logger.debug('Decompressing context bundle...');
        data = await this.compressionUtility.decompress(data);
      }

      // Parse bundle
      const bundle: ContextBundle = JSON.parse(data.toString());

      // Update download count
      await this.supabase
        .from(this.tableName)
        .update({
          download_count: metadata.download_count + 1,
          last_accessed: new Date().toISOString(),
        })
        .eq('id', contextId);

      this.logger.log(`Context downloaded successfully: ${contextId}`);
      return bundle.contexts[0]; // Return first context
    } catch (error) {
      this.logger.error(
        `Failed to download context: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * List available context bundles
   */
  async listContexts(options: ListOptions = {}): Promise<ContextSummary[]> {
    try {
      if (!this.supabase) {
        throw new Error(
          'Supabase client not initialized. Please check your credentials.',
        );
      }

      let query = this.supabase
        .from(this.tableName)
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (options.author) {
        query = query.eq('author', options.author);
      }

      if (options.isPrivate !== undefined) {
        query = query.eq('is_private', options.isPrivate);
      }

      if (options.tags && options.tags.length > 0) {
        query = query.contains('tags', options.tags);
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(
          options.offset,
          options.offset + (options.limit || 10) - 1,
        );
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return (data || []).map(this.mapToContextSummary);
    } catch (error) {
      this.logger.error(
        `Failed to list contexts: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Delete a context bundle
   */
  async deleteContext(contextId: string): Promise<StorageResult> {
    try {
      if (!this.supabase) {
        throw new Error(
          'Supabase client not initialized. Please check your credentials.',
        );
      }

      // Get metadata to find file path
      const { data: metadata, error: dbError } = await this.supabase
        .from(this.tableName)
        .select('file_path')
        .eq('id', contextId)
        .single();

      if (dbError || !metadata) {
        throw new Error(`Context not found: ${contextId}`);
      }

      // Delete from storage
      const { error: storageError } = await this.supabase.storage
        .from(this.bucketName)
        .remove([metadata.file_path]);

      if (storageError) {
        throw storageError;
      }

      // Delete from database
      const { error: deleteError } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('id', contextId);

      if (deleteError) {
        throw deleteError;
      }

      this.logger.log(`Context deleted successfully: ${contextId}`);
      return { success: true, id: contextId };
    } catch (error) {
      this.logger.error(
        `Failed to delete context: ${error.message}`,
        error.stack,
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate a context before upload
   */
  async validateContext(context: TaptikContext): Promise<ValidationResult> {
    const errors = [];
    const warnings = [];

    // Check required fields
    if (!context.version) {
      errors.push({
        path: 'version',
        message: 'Version is required',
      });
    }

    if (!context.metadata?.name) {
      errors.push({
        path: 'metadata.name',
        message: 'Context name is required',
      });
    }

    // Check context size
    const size = Buffer.from(JSON.stringify(context)).length;
    if (size > MAX_CONTEXT_SIZE) {
      errors.push({
        path: 'context',
        message: `Context size (${size} bytes) exceeds maximum allowed size (${MAX_CONTEXT_SIZE} bytes)`,
      });
    }

    // Check for sensitive data
    const contextString = JSON.stringify(context);
    const sensitivePatterns = [
      /api[_-]?key/gi,
      /password/gi,
      /token/gi,
      /secret/gi,
      /credential/gi,
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(contextString)) {
        warnings.push({
          path: 'context',
          message:
            'Context may contain sensitive data. Consider using encryption.',
          suggestion: 'Use --encrypt flag when uploading',
        });
        break;
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Generate a unique context ID
   */
  private generateContextId(): string {
    const timestamp = Date.now().toString(36);
    const randomString = Math.random().toString(36).slice(2, 9);
    return `ctx_${timestamp}_${randomString}`;
  }

  /**
   * Map database record to ContextSummary
   */
  private mapToContextSummary(record: any): ContextSummary {
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      author: record.author,
      tags: record.tags || [],
      created_at: record.created_at,
      updated_at: record.updated_at,
      size: record.file_size,
      download_count: record.download_count || 0,
      is_private: record.is_private || false,
    };
  }

  /**
   * Load context from a local file
   */
  async loadFromFile(filePath: string): Promise<TaptikContext> {
    try {
      const fs = await import('node:fs/promises');
      const content = await fs.readFile(filePath, 'utf8');

      // Try to parse as JSON
      try {
        return JSON.parse(content);
      } catch (parseError) {
        // If it's compressed, try to decompress
        try {
          const buffer = Buffer.isBuffer(content)
            ? content
            : Buffer.from(content, 'base64');
          const decompressed = await this.compressionUtility.decompress(buffer);
          return JSON.parse(decompressed.toString());
        } catch {
          throw new Error(
            `Failed to parse context file: ${parseError.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Failed to load context from file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save context to a local file
   */
  async saveToFile(
    context: TaptikContext,
    filePath: string,
    options?: { compress?: boolean },
  ): Promise<void> {
    try {
      const fs = await import('node:fs/promises');

      let content: string | Buffer = JSON.stringify(context, null, 2);

      if (options?.compress) {
        content = await this.compressionUtility.compress(content);
      }

      await fs.writeFile(filePath, content, 'utf8');
      this.logger.log(`Context saved to file: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to save context to file: ${error.message}`);
      throw error;
    }
  }
}
