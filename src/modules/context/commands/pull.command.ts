import { Injectable, Logger } from '@nestjs/common';

import { Command, CommandRunner, Option } from 'nest-commander';

import { ContextStorageService } from '../services/context-storage.service';
import { FileSystemUtility } from '../utils/file-system.utility';

interface PullOptions {
  output?: string;
  decompress?: boolean;
  decrypt?: boolean;
  force?: boolean;
  validate?: boolean;
}

@Injectable()
@Command({
  name: 'context:pull',
  description: 'Pull a context bundle from the cloud storage',
})
export class ContextPullCommand extends CommandRunner {
  private readonly logger = new Logger(ContextPullCommand.name);

  constructor(
    private readonly storageService: ContextStorageService,
    private readonly fileSystemUtility: FileSystemUtility,
  ) {
    super();
  }

  async run(parameters: string[], options?: PullOptions): Promise<void> {
    try {
      // Get context ID from params
      const contextId = parameters[0];

      if (!contextId) {
        throw new Error(
          'Context ID is required. Usage: taptik context:pull <context-id>',
        );
      }

      this.logger.log(`Pulling context ${contextId} from cloud storage...`);

      // Download the context
      const context = await this.storageService.downloadContext(contextId, {
        decompress: options?.decompress ?? true,
        decrypt: options?.decrypt ?? true,
      });

      if (!context) {
        throw new Error(`Failed to download context: ${contextId}`);
      }

      // Validate if requested
      if (options?.validate ?? true) {
        const validationResult =
          await this.storageService.validateContext(context);

        if (!validationResult.valid) {
          this.logger.error(
            'Downloaded context validation failed:',
            validationResult.errors,
          );
          if (!options?.force) {
            throw new Error(
              'Context validation failed. Use --force to save anyway.',
            );
          }
          this.logger.warn('Forcing save despite validation errors...');
        }

        if (validationResult.warnings) {
          this.logger.warn(
            'Context validation warnings:',
            validationResult.warnings,
          );
        }
      }

      // Determine output path
      const outputPath = options?.output || `${contextId}.json`;

      // Check if file exists
      if (await this.fileSystemUtility.fileExists(outputPath)) {
        if (!options?.force) {
          throw new Error(
            `File ${outputPath} already exists. Use --force to overwrite.`,
          );
        }
        this.logger.warn(`Overwriting existing file: ${outputPath}`);
      }

      // Save to file
      await this.fileSystemUtility.writeFile(
        outputPath,
        JSON.stringify(context, null, 2),
      );

      this.logger.log(`✅ Context pulled successfully!`);
      this.logger.log(`Saved to: ${outputPath}`);

      // Display context info
      this.logger.log('Context Information:');
      this.logger.log(`  Name: ${context.metadata?.name || 'Untitled'}`);
      this.logger.log(`  Version: ${context.version}`);
      this.logger.log(
        `  Platforms: ${context.metadata?.platforms?.join(', ') || 'None'}`,
      );
      if (context.metadata?.tags?.length) {
        this.logger.log(`  Tags: ${context.metadata.tags.join(', ')}`);
      }
    } catch (error) {
      this.logger.error(`Failed to pull context: ${error.message}`);
      throw error;
    }
  }

  @Option({
    flags: '-o, --output <path>',
    description: 'Output file path for the pulled context',
  })
  parseOutput(value: string): string {
    return value;
  }

  @Option({
    flags: '--no-decompress',
    description: 'Skip decompression of the context',
  })
  parseNoDecompress(): boolean {
    return false;
  }

  @Option({
    flags: '--no-decrypt',
    description: 'Skip decryption of the context',
  })
  parseNoDecrypt(): boolean {
    return false;
  }

  @Option({
    flags: '--force',
    description: 'Force overwrite existing files',
    defaultValue: false,
  })
  parseForce(): boolean {
    return true;
  }

  @Option({
    flags: '--no-validate',
    description: 'Skip validation of the pulled context',
  })
  parseNoValidate(): boolean {
    return false;
  }
}
