import { Injectable, Logger } from '@nestjs/common';

import { Command, CommandRunner, Option } from 'nest-commander';

import { ContextStorageService } from '../services/context-storage.service';
import { FileSystemUtility } from '../utils/file-system.utility';

import type { TaptikContext, BundleMetadata } from '../interfaces';

interface PushOptions {
  file?: string;
  name?: string;
  description?: string;
  tags?: string;
  private?: boolean;
  compress?: boolean;
  encrypt?: boolean;
  force?: boolean;
}

@Injectable()
@Command({
  name: 'context:push',
  description: 'Push a context bundle to the cloud storage',
})
export class ContextPushCommand extends CommandRunner {
  private readonly logger = new Logger(ContextPushCommand.name);

  constructor(
    private readonly storageService: ContextStorageService,
    private readonly fileSystemUtility: FileSystemUtility,
  ) {
    super();
  }

  async run(parameters: string[], options?: PushOptions): Promise<void> {
    try {
      this.logger.log('Pushing context to cloud storage...');

      // Get the context file path
      const filePath = options?.file || parameters[0] || 'context.json';

      // Check if file exists
      if (!(await this.fileSystemUtility.fileExists(filePath))) {
        throw new Error(`Context file not found: ${filePath}`);
      }

      // Read the context file
      const contextData = await this.fileSystemUtility.readFile(filePath);
      const context: TaptikContext = JSON.parse(contextData);

      // Validate the context
      const validationResult =
        await this.storageService.validateContext(context);

      if (!validationResult.valid) {
        this.logger.error(
          'Context validation failed:',
          validationResult.errors,
        );
        if (!options?.force) {
          throw new Error(
            'Context validation failed. Use --force to override.',
          );
        }
        this.logger.warn('Forcing upload despite validation errors...');
      }

      if (validationResult.warnings) {
        this.logger.warn(
          'Context validation warnings:',
          validationResult.warnings,
        );
      }

      // Prepare metadata
      const metadata: BundleMetadata = {
        name: options?.name || context.metadata?.name || 'Untitled Context',
        description: options?.description || context.metadata?.description,
        author: context.metadata?.author || 'Unknown',
        checksum: await this.generateChecksum(contextData),
      };

      // Parse tags
      if (options?.tags) {
        context.metadata = {
          ...context.metadata,
          tags: options.tags.split(',').map((tag) => tag.trim()),
        };
      }

      // Set privacy
      if (options?.private !== undefined) {
        context.metadata = {
          ...context.metadata,
          is_private: options.private,
        };
      }

      // Upload the context
      const result = await this.storageService.uploadContext(
        context,
        metadata,
        {
          compress: options?.compress ?? true,
          encrypt: options?.encrypt ?? false,
        },
      );

      if (result.success) {
        this.logger.log(`✅ Context pushed successfully!`);
        this.logger.log(`Context ID: ${result.id}`);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      this.logger.error(`Failed to push context: ${error.message}`);
      throw error;
    }
  }

  @Option({
    flags: '-f, --file <path>',
    description: 'Path to the context file to push',
  })
  parseFile(value: string): string {
    return value;
  }

  @Option({
    flags: '-n, --name <name>',
    description: 'Name for the context bundle',
  })
  parseName(value: string): string {
    return value;
  }

  @Option({
    flags: '-d, --description <description>',
    description: 'Description for the context bundle',
  })
  parseDescription(value: string): string {
    return value;
  }

  @Option({
    flags: '-t, --tags <tags>',
    description: 'Comma-separated tags for the context',
  })
  parseTags(value: string): string {
    return value;
  }

  @Option({
    flags: '--private',
    description: 'Mark the context as private',
    defaultValue: false,
  })
  parsePrivate(): boolean {
    return true;
  }

  @Option({
    flags: '-c, --compress',
    description: 'Compress the context bundle (default: true)',
    defaultValue: true,
  })
  parseCompress(): boolean {
    return true;
  }

  @Option({
    flags: '-e, --encrypt',
    description: 'Encrypt sensitive data in the context',
    defaultValue: false,
  })
  parseEncrypt(): boolean {
    return true;
  }

  @Option({
    flags: '--force',
    description: 'Force push even if validation fails',
    defaultValue: false,
  })
  parseForce(): boolean {
    return true;
  }

  private async generateChecksum(data: string): Promise<string> {
    const crypto = await import('node:crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
