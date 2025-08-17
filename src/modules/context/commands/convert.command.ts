import { Injectable, Logger } from '@nestjs/common';

import { Command, CommandRunner, Option } from 'nest-commander';

import { AIPlatform } from '../interfaces';
import { ContextConverterService } from '../services/context-converter.service';
import { ContextStorageService } from '../services/context-storage.service';
import { ConversionReporterService } from '../services/conversion-reporter.service';

interface ConvertCommandOptions {
  input?: string;
  output?: string;
  platform?: string;
  force?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  preserveMetadata?: boolean;
}

@Injectable()
@Command({
  name: 'context:convert',
  description: 'Convert context between different AI platforms',
})
export class ContextConvertCommand extends CommandRunner {
  private readonly logger = new Logger(ContextConvertCommand.name);

  constructor(
    private readonly converterService: ContextConverterService,
    private readonly storageService: ContextStorageService,
    private readonly reporterService: ConversionReporterService,
  ) {
    super();
  }

  async run(
    passedParameters: string[],
    options?: ConvertCommandOptions,
  ): Promise<void> {
    const [sourcePlatform, targetPlatform] = passedParameters;

    if (!sourcePlatform || !targetPlatform) {
      console.error('❌ Source and target platforms are required');
      console.log(
        'Usage: context:convert <source-platform> <target-platform> [options]',
      );
      console.log('Platforms: kiro, claude-code, cursor');
      process.exit(1);
    }

    try {
      this.logger.log(
        `Converting from ${sourcePlatform} to ${targetPlatform}...`,
      );

      // Validate platforms
      const sourceEnum = this.parsePlatform(sourcePlatform);
      const targetEnum = this.parsePlatform(targetPlatform);

      if (sourceEnum === targetEnum) {
        console.error('❌ Source and target platforms cannot be the same');
        process.exit(1);
      }

      // Load context
      let context;
      if (options?.input) {
        context = await this.storageService.loadFromFile(options.input);
      } else {
        // Try to auto-detect and load from current directory
        const fs = await import('node:fs/promises');
        const _path = await import('node:path');

        let contextPath;
        if (sourceEnum === AIPlatform.KIRO) {
          contextPath = '.kiro';
        } else if (sourceEnum === AIPlatform.CLAUDE_CODE) {
          contextPath = 'CLAUDE.md';
        }

        if (contextPath) {
          try {
            await fs.access(contextPath);
            console.log(
              `📂 Auto-detected ${sourceEnum} context at: ${contextPath}`,
            );
          } catch {
            console.error(
              `❌ No ${sourceEnum} context found. Use --input to specify a context file.`,
            );
            process.exit(1);
          }
        }
      }

      if (options?.dryRun) {
        console.log('\n🔍 Dry Run Mode - No files will be written');
        console.log(`  Source: ${sourcePlatform}`);
        console.log(`  Target: ${targetPlatform}`);
        console.log(`  Input: ${options.input || 'auto-detect'}`);
        console.log(`  Output: ${options.output || 'auto-generate'}`);
        console.log('\nNo changes will be made in dry run mode.');
        return;
      }

      console.log('🔄 Starting conversion...');

      // Perform conversion
      const result = await this.converterService.convert(context, targetEnum, {
        preserveMetadata: true,
        force: options?.force,
      });

      if (!result.success) {
        console.error('\n❌ Conversion failed');
        if (result.error) {
          console.error(`Error: ${result.error}`);
        }
        process.exit(1);
      }

      console.log('\n✅ Conversion completed successfully!');

      // Generate output file
      if (result.context) {
        const outputPath =
          options?.output || this.generateOutputPath(targetPlatform);
        await this.storageService.saveToFile(result.context, outputPath);
        console.log(`💾 Converted context saved to: ${outputPath}`);
      }

      // Display conversion report
      if (result.report && options?.verbose) {
        console.log('\n📊 Conversion Report:');
        console.log(`  Source Platform: ${result.report.source}`);
        console.log(`  Target Platform: ${result.report.target}`);
        console.log(`  Features mapped: ${result.report.mappedFeatures || 0}`);
        console.log(
          `  Supported features: ${result.report.supportedFeatures.length}`,
        );
        console.log(
          `  Unsupported features: ${result.report.unsupportedFeatures.length}`,
        );

        if (result.report.warnings.length > 0) {
          console.log('\n⚠️ Warnings:');
          for (const warning of result.report.warnings) {
            console.log(`  - ${warning}`);
          }
        }

        if (result.report.approximations.length > 0) {
          console.log('\n🔄 Approximations made:');
          for (const approx of result.report.approximations) {
            console.log(`  - ${approx.description || approx}`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Conversion failed: ${error.message}`);
      if (options?.verbose) {
        console.error('\n❌ Error details:');
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  private parsePlatform(platform: string): AIPlatform {
    switch (platform.toLowerCase()) {
      case 'kiro':
        return AIPlatform.KIRO;
      case 'claude-code':
        return AIPlatform.CLAUDE_CODE;
      case 'cursor':
        return AIPlatform.CURSOR;
      default:
        throw new Error(
          `Invalid platform: ${platform}. Must be one of: kiro, claude-code, cursor`,
        );
    }
  }

  private generateOutputPath(targetPlatform: string): string {
    const timestamp = new Date()
      .toISOString()
      // eslint-disable-next-line unicorn/prefer-string-replace-all
      .replace(/[.:]/g, '-')
      .slice(0, 19);
    return `${targetPlatform}-context-${timestamp}.json`;
  }

  @Option({
    flags: '-i, --input <file>',
    description: 'Input context file (auto-detects if not specified)',
  })
  parseInput(value: string): string {
    return value;
  }

  @Option({
    flags: '-o, --output <file>',
    description: 'Output file path (auto-generates if not specified)',
  })
  parseOutput(value: string): string {
    return value;
  }

  @Option({
    flags: '-f, --force',
    description: 'Force conversion even if validation fails',
  })
  parseForce(): boolean {
    return true;
  }

  @Option({
    flags: '--dry-run',
    description: 'Show what would be converted without making changes',
  })
  parseDryRun(): boolean {
    return true;
  }

  @Option({
    flags: '-v, --verbose',
    description: 'Show detailed conversion report',
  })
  parseVerbose(): boolean {
    return true;
  }

  @Option({
    flags: '--preserve-metadata',
    description: 'Preserve original metadata during conversion',
  })
  parsePreserveMetadata(): boolean {
    return true;
  }
}
