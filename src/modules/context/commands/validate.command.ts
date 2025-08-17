import { Injectable, Logger } from '@nestjs/common';

import { Command, CommandRunner, Option } from 'nest-commander';

import { AIPlatform } from '../interfaces';
import { ContextValidatorService } from '../services/context-validator.service';
import { FileSystemUtility } from '../utils/file-system.utility';

import type { TaptikContext } from '../interfaces';

interface ValidateOptions {
  file?: string;
  platform?: string;
  strict?: boolean;
  json?: boolean;
}

@Injectable()
@Command({
  name: 'context:validate',
  description: 'Validate a context bundle for correctness and compatibility',
})
export class ContextValidateCommand extends CommandRunner {
  private readonly logger = new Logger(ContextValidateCommand.name);

  constructor(
    private readonly validatorService: ContextValidatorService,
    private readonly fileSystemUtility: FileSystemUtility,
  ) {
    super();
  }

  async run(parameters: string[], options?: ValidateOptions): Promise<void> {
    try {
      // Get the context file path
      const filePath = options?.file || parameters[0] || 'context.json';

      // Check if file exists
      if (!(await this.fileSystemUtility.fileExists(filePath))) {
        throw new Error(`Context file not found: ${filePath}`);
      }

      this.logger.log(`Validating context file: ${filePath}`);

      // Read the context file
      const contextData = await this.fileSystemUtility.readFile(filePath);
      let context: TaptikContext;

      try {
        context = JSON.parse(contextData);
      } catch (error) {
        throw new Error(`Invalid JSON in context file: ${error.message}`);
      }

      // Validate the context
      const result = await this.validatorService.validateContext(context);

      // Check platform compatibility if specified
      if (options?.platform) {
        const platform = this.parsePlatformValue(options.platform);
        const isCompatible = this.validatorService.isPlatformCompatible(
          context,
          platform,
        );

        if (!isCompatible) {
          if (!result.warnings) {
            result.warnings = [];
          }
          result.warnings.push({
            path: 'metadata.platforms',
            message: `Context is not compatible with ${platform} platform`,
            suggestion: `Add ${platform} to metadata.platforms array`,
          });
        }
      }

      // Output as JSON if requested
      if (options?.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // Display validation results
      if (result.valid) {
        this.logger.log('✅ Context validation passed!');
      } else {
        this.logger.error('❌ Context validation failed!');
      }

      // Display errors
      if (result.errors && result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error.path}: ${error.message}`);
        });
      }

      // Display warnings
      if (result.warnings && result.warnings.length > 0) {
        console.log('\nWarnings:');
        result.warnings.forEach((warning, index) => {
          console.log(`  ${index + 1}. ${warning.path}: ${warning.message}`);
          if (warning.suggestion) {
            console.log(`     Suggestion: ${warning.suggestion}`);
          }
        });
      }

      // Display context information
      console.log('\nContext Information:');
      console.log(`  Version: ${context.version}`);
      console.log(`  Name: ${context.metadata?.name || 'Not specified'}`);
      console.log(
        `  Created: ${context.metadata?.created_at || 'Not specified'}`,
      );

      if (
        context.metadata?.platforms &&
        context.metadata.platforms.length > 0
      ) {
        console.log(`  Platforms: ${context.metadata.platforms.join(', ')}`);
      } else {
        console.log('  Platforms: None specified');
      }

      // Display categories
      const categories = [];
      if (context.personal) categories.push('personal');
      if (context.project) categories.push('project');
      if (context.prompts) categories.push('prompts');
      if (context.tools) categories.push('tools');
      if (context.ide) categories.push('ide');

      if (categories.length > 0) {
        console.log(`  Categories: ${categories.join(', ')}`);
      } else {
        console.log('  Categories: None');
      }

      // In strict mode, fail if there are any warnings
      if (options?.strict && result.warnings && result.warnings.length > 0) {
        throw new Error('Validation failed in strict mode due to warnings');
      }

      // Exit with error code if validation failed
      if (!result.valid) {
        process.exit(1);
      }
    } catch (error) {
      this.logger.error(`Validation error: ${error.message}`);
      throw error;
    }
  }

  @Option({
    flags: '-f, --file <path>',
    description: 'Path to the context file to validate',
  })
  parseFile(value: string): string {
    return value;
  }

  @Option({
    flags: '-p, --platform <platform>',
    description: 'Check compatibility with specific platform',
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
    flags: '--strict',
    description: 'Fail validation if there are any warnings',
    defaultValue: false,
  })
  parseStrict(): boolean {
    return true;
  }

  @Option({
    flags: '--json',
    description: 'Output validation results as JSON',
    defaultValue: false,
  })
  parseJson(): boolean {
    return true;
  }

  private parsePlatformValue(value: string): AIPlatform {
    return value as AIPlatform;
  }
}
