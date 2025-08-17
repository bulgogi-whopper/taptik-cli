import { Injectable, Logger } from '@nestjs/common';

import { Command, CommandRunner, Option } from 'nest-commander';

import { ContextStorageService } from '../services/context-storage.service';

interface ListOptions {
  author?: string;
  tags?: string;
  private?: boolean;
  limit?: string;
  offset?: string;
  json?: boolean;
}

@Injectable()
@Command({
  name: 'context:list',
  description: 'List available context bundles from cloud storage',
})
export class ContextListCommand extends CommandRunner {
  private readonly logger = new Logger(ContextListCommand.name);

  constructor(private readonly storageService: ContextStorageService) {
    super();
  }

  async run(_parameters: string[], options?: ListOptions): Promise<void> {
    try {
      this.logger.log('Fetching available contexts...');

      // Parse tags if provided
      const tags = options?.tags
        ? options.tags.split(',').map((tag) => tag.trim())
        : undefined;

      // List contexts with filters
      const contexts = await this.storageService.listContexts({
        author: options?.author,
        tags,
        isPrivate: options?.private,
        limit: options?.limit ? Number.parseInt(options.limit, 10) : 20,
        offset: options?.offset ? Number.parseInt(options.offset, 10) : 0,
      });

      if (contexts.length === 0) {
        this.logger.log('No contexts found matching the criteria.');
        return;
      }

      // Output as JSON if requested
      if (options?.json) {
        console.log(JSON.stringify(contexts, null, 2));
        return;
      }

      // Display contexts in a formatted way
      this.logger.log(`Found ${contexts.length} context(s):\n`);

      contexts.forEach((context, index) => {
        console.log(`${index + 1}. ${context.name}`);
        console.log(`   ID: ${context.id}`);
        console.log(`   Author: ${context.author}`);
        if (context.description) {
          console.log(`   Description: ${context.description}`);
        }
        console.log(
          `   Created: ${new Date(context.created_at).toLocaleString()}`,
        );
        console.log(`   Size: ${this.formatBytes(context.size)}`);
        console.log(`   Downloads: ${context.download_count}`);
        if (context.tags.length > 0) {
          console.log(`   Tags: ${context.tags.join(', ')}`);
        }
        if (context.is_private) {
          console.log(`   Visibility: Private`);
        }
        console.log('');
      });

      // Show pagination info
      if (options?.limit || options?.offset) {
        const offset = options?.offset
          ? Number.parseInt(options.offset, 10)
          : 0;
        this.logger.log(
          `Showing results ${offset + 1} to ${offset + contexts.length}`,
        );
        if (
          contexts.length ===
          (options?.limit ? Number.parseInt(options.limit, 10) : 20)
        ) {
          this.logger.log('Use --offset to see more results');
        }
      }
    } catch (error) {
      this.logger.error(`Failed to list contexts: ${error.message}`);
      throw error;
    }
  }

  @Option({
    flags: '-a, --author <author>',
    description: 'Filter by author',
  })
  parseAuthor(value: string): string {
    return value;
  }

  @Option({
    flags: '-t, --tags <tags>',
    description: 'Filter by comma-separated tags',
  })
  parseTags(value: string): string {
    return value;
  }

  @Option({
    flags: '--private',
    description: 'Show only private contexts',
  })
  parsePrivate(): boolean {
    return true;
  }

  @Option({
    flags: '-l, --limit <number>',
    description: 'Maximum number of results to show (default: 20)',
    defaultValue: '20',
  })
  parseLimit(value: string): string {
    const limit = Number.parseInt(value, 10);
    if (Number.isNaN(limit) || limit < 1) {
      throw new Error('Limit must be a positive number');
    }
    return value;
  }

  @Option({
    flags: '-o, --offset <number>',
    description: 'Number of results to skip (for pagination)',
    defaultValue: '0',
  })
  parseOffset(value: string): string {
    const offset = Number.parseInt(value, 10);
    if (Number.isNaN(offset) || offset < 0) {
      throw new Error('Offset must be a non-negative number');
    }
    return value;
  }

  @Option({
    flags: '--json',
    description: 'Output results as JSON',
  })
  parseJson(): boolean {
    return true;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}
