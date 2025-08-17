import { promises as fs } from 'node:fs';

import { Injectable, Logger } from '@nestjs/common';

import { Command, CommandRunner, Option } from 'nest-commander';

import { AIPlatform } from '../interfaces';
import { ContextBuilderService } from '../services/context-builder.service';
import { FileSystemUtility } from '../utils/file-system.utility';

interface BuildOptions {
  platform?: string;
  output?: string;
  compress?: boolean;
  encrypt?: boolean;
  verbose?: boolean;
  excludeSensitive?: boolean;
  includeOnly?: string;
  exclude?: string;
}

@Injectable()
@Command({
  name: 'context:build',
  description: 'Build a context bundle from the current IDE configuration',
})
export class ContextBuildCommand extends CommandRunner {
  private readonly logger = new Logger(ContextBuildCommand.name);

  constructor(
    private readonly contextBuilder: ContextBuilderService,
    private readonly fileSystem: FileSystemUtility,
  ) {
    super();
  }

  async run(parameters: string[], options?: BuildOptions): Promise<void> {
    try {
      this.logger.log('Building context from current IDE configuration...');

      // Parse build options
      const buildOptions = {
        excludeSensitive: options?.excludeSensitive,
        includeOnly: options?.includeOnly?.split(',').filter(Boolean),
        exclude: options?.exclude?.split(',').filter(Boolean),
      };

      // Build the context using the service
      const result = await this.contextBuilder.build(
        process.cwd(),
        options?.platform as AIPlatform | undefined,
        buildOptions,
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to build context');
      }

      this.logger.log(
        `Successfully built context for platform: ${result.platform}`,
      );

      // Write context to output file
      const outputPath = options?.output || 'context.json';
      let dataToWrite = JSON.stringify(result.context, null, 2);

      // Compress if requested
      if (options?.compress) {
        const { gzipSync } = await import('node:zlib');
        dataToWrite = gzipSync(Buffer.from(dataToWrite)).toString('base64');
        this.logger.log('Context compressed');
      }

      // Write to file
      await fs.writeFile(outputPath, dataToWrite);
      this.logger.log(`Context written to: ${outputPath}`);

      if (options?.verbose) {
        this.logger.log('Context metadata:', result.context?.metadata);
      }
    } catch (error) {
      this.logger.error(`Failed to build context: ${error.message}`);
      throw error;
    }
  }

  @Option({
    flags: '-p, --platform <platform>',
    description: 'Target platform (kiro, claude-code, cursor)',
  })
  parsePlatform(value: string): string {
    const validPlatforms = Object.values(AIPlatform);
    if (!validPlatforms.includes(value as AIPlatform)) {
      throw new Error(
        `Invalid platform: ${value}. Valid options: ${validPlatforms.join(', ')}`,
      );
    }
    return value;
  }

  @Option({
    flags: '-o, --output <path>',
    description: 'Output file path for the context bundle',
  })
  parseOutput(value: string): string {
    return value;
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
    flags: '-v, --verbose',
    description: 'Enable verbose logging',
    defaultValue: false,
  })
  parseVerbose(): boolean {
    return true;
  }

  @Option({
    flags: '--exclude-sensitive',
    description: 'Exclude sensitive data like API keys and tokens',
    defaultValue: false,
  })
  parseExcludeSensitive(): boolean {
    return true;
  }

  @Option({
    flags: '--include-only <sections>',
    description: 'Include only specified sections (comma-separated)',
  })
  parseIncludeOnly(value: string): string {
    return value;
  }

  @Option({
    flags: '--exclude <sections>',
    description: 'Exclude specified sections (comma-separated)',
  })
  parseExclude(value: string): string {
    return value;
  }
}
