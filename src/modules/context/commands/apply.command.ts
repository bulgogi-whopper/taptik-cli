import { Injectable, Logger } from '@nestjs/common';

import { Command, CommandRunner, Option } from 'nest-commander';

import { AIPlatform } from '../interfaces';
import { ConflictStrategy } from '../services/conflict-resolver.service';
import { ContextDeployerService } from '../services/context-deployer.service';
import { ContextStorageService } from '../services/context-storage.service';

interface ApplyCommandOptions {
  platform?: string;
  path?: string;
  backup?: boolean;
  overwrite?: boolean;
  strategy?: string;
  dryRun?: boolean;
  validate?: boolean;
  force?: boolean;
  verbose?: boolean;
}

@Injectable()
@Command({
  name: 'context:apply',
  description: 'Apply a context to the current environment',
})
export class ContextApplyCommand extends CommandRunner {
  private readonly logger = new Logger(ContextApplyCommand.name);

  constructor(
    private readonly deployerService: ContextDeployerService,
    private readonly storageService: ContextStorageService,
  ) {
    super();
  }

  async run(
    passedParameters: string[],
    options?: ApplyCommandOptions,
  ): Promise<void> {
    const [contextFile] = passedParameters;

    if (!contextFile) {
      console.error('❌ Context file is required');
      process.exit(1);
    }

    const targetPath = options?.path || process.cwd();

    try {
      this.logger.log('Loading context from file...');

      // Load context from file
      const context = await this.storageService.loadFromFile(contextFile);

      // Determine platform
      const platform = options?.platform || context.metadata?.platform;
      if (!platform) {
        console.error(
          '❌ Platform must be specified or included in context metadata',
        );
        process.exit(1);
      }

      // Build deployment options
      const deployOptions = {
        backup: options?.backup ?? true,
        overwrite: options?.overwrite ?? false,
        validate: options?.validate ?? true,
        conflictStrategy: this.parseConflictStrategy(options?.strategy),
        dryRun: options?.dryRun ?? false,
      };

      // Pre-deployment checks
      this.logger.log('Running pre-deployment checks...');

      const preCheckErrors: string[] = [];

      // Check if target directory exists
      const fs = await import('node:fs/promises');
      try {
        await fs.access(targetPath);
      } catch {
        preCheckErrors.push(`Target path does not exist: ${targetPath}`);
      }

      // Platform-specific validation
      if (platform === AIPlatform.KIRO) {
        // Check for existing .kiro directory
        try {
          await fs.access(`${targetPath}/.kiro`);
        } catch {
          console.log(
            'ℹ️ No existing .kiro directory found. Will create new one.',
          );
        }
      }

      if (preCheckErrors.length > 0) {
        console.error('\n❌ Issues:');
        for (const issue of preCheckErrors) {
          console.error(`  ✗ ${issue}`);
        }

        if (!options?.force) {
          console.log('\n❌ Use --force flag to override pre-check errors');
          process.exit(1);
        }
      }

      if (options?.dryRun) {
        console.log('\n🔍 Dry Run Mode - No changes will be made');
        console.log(`  Platform: ${platform}`);
        console.log(`  Target: ${targetPath}`);
        console.log(`  Backup: ${deployOptions.backup ? 'Yes' : 'No'}`);
        console.log(`  Validate: ${deployOptions.validate ? 'Yes' : 'No'}`);
        console.log(`  Conflict Strategy: ${deployOptions.conflictStrategy}`);
        console.log('\nNo changes will be made in dry run mode.');
        return;
      }

      this.logger.log('Starting deployment...');

      // Perform the actual deployment
      const result = await this.deployerService.deploy(
        context,
        targetPath,
        deployOptions,
      );

      if (result.success) {
        console.log('\n✅ Deployment completed successfully');
        console.log('\n📊 Deployment Summary:');
        console.log(`  Platform: ${platform}`);
        console.log(`  Target: ${targetPath}`);

        if (result.backup) {
          console.log(`  Backup: ${result.backup.location}`);
        }

        console.log(`  Files processed: ${result.filesProcessed || 0}`);
        console.log(`  Duration: ${result.duration}ms`);

        if (result.deployed_items && result.deployed_items.length > 0) {
          console.log('\n  Deployed files:');
          for (const file of result.deployed_items) {
            console.log(`    - ${file}`);
          }
        }

        // Show warnings if any
        if (result.warnings && result.warnings.length > 0) {
          console.log('\n⚠️ Warnings:');
          for (const warning of result.warnings) {
            console.log(`  - ${warning}`);
          }
        }
      } else {
        console.error('\n❌ Deployment failed');
        if (result.errors) {
          console.error('\n✗ Errors:');
          for (const error of result.errors) {
            console.error(`  - ${error}`);
          }
        }

        if (result.rollback) {
          console.log('\n↩️ Rollback performed successfully');
        }

        process.exit(1);
      }
    } catch (error) {
      this.logger.error(`Deployment failed: ${error.message}`);
      if (options?.verbose) {
        console.error('\n❌ Error details:');
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  private parseConflictStrategy(strategy?: string): ConflictStrategy {
    switch (strategy?.toLowerCase()) {
      case 'overwrite':
        return ConflictStrategy.OVERWRITE;
      case 'merge':
        return ConflictStrategy.MERGE;
      case 'skip':
        return ConflictStrategy.SKIP;
      case 'interactive':
        return ConflictStrategy.INTERACTIVE;
      default:
        return ConflictStrategy.OVERWRITE;
    }
  }

  @Option({
    flags: '-p, --platform <platform>',
    description: 'Target platform (kiro, claude-code, cursor)',
  })
  parsePlatform(value: string): string {
    const validPlatforms = ['kiro', 'claude-code', 'cursor'];
    if (!validPlatforms.includes(value)) {
      throw new Error(
        `Invalid platform: ${value}. Must be one of: ${validPlatforms.join(', ')}`,
      );
    }
    return value;
  }

  @Option({
    flags: '--path <path>',
    description: 'Target path for deployment (default: current directory)',
  })
  parsePath(value: string): string {
    return value;
  }

  @Option({
    flags: '--backup',
    description: 'Create backup before deployment (default: true)',
  })
  parseBackup(): boolean {
    return true;
  }

  @Option({
    flags: '--overwrite',
    description: 'Overwrite existing files without confirmation',
  })
  parseOverwrite(): boolean {
    return true;
  }

  @Option({
    flags: '-s, --strategy <strategy>',
    description:
      'Conflict resolution strategy (overwrite, merge, skip, interactive)',
  })
  parseStrategy(value: string): string {
    return value;
  }

  @Option({
    flags: '--dry-run',
    description: 'Show what would be deployed without making changes',
  })
  parseDryRun(): boolean {
    return true;
  }

  @Option({
    flags: '--validate',
    description: 'Validate context before deployment (default: true)',
  })
  parseValidate(): boolean {
    return true;
  }

  @Option({
    flags: '-f, --force',
    description: 'Force deployment even if pre-checks fail',
  })
  parseForce(): boolean {
    return true;
  }

  @Option({
    flags: '-v, --verbose',
    description: 'Show detailed output and error information',
  })
  parseVerbose(): boolean {
    return true;
  }
}
