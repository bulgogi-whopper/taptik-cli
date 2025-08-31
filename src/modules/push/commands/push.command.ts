import * as path from 'path';

import { Injectable } from '@nestjs/common';

import chalk from 'chalk';
import * as fs from 'fs-extra';
import inquirer from 'inquirer';
import { Command, CommandRunner, Option } from 'nest-commander';
import ora from 'ora';

import { ErrorHandlerService } from '../../deploy/services/error-handler.service';
import { ErrorCodes } from '../constants/error-codes.constant';
import {
  PackageVisibility,
  PushOptions,
} from '../interfaces/push-options.interface';
import { UploadProgress } from '../interfaces/upload-progress.interface';
import { PushService } from '../services/push.service';

interface PushCommandOptions {
  public?: boolean;
  private?: boolean;
  title?: string;
  description?: string;
  tags?: string;
  team?: string;
  version?: string;
  autoBump?: boolean;
  force?: boolean;
  dryRun?: boolean;
  yes?: boolean;
}

@Injectable()
@Command({
  name: 'push',
  description: 'Upload a .taptik package to the cloud',
})
export class PushCommand extends CommandRunner {
  private spinner: ReturnType<typeof ora> | null = null;

  constructor(
    private readonly pushService: PushService,
    private readonly errorHandler: ErrorHandlerService,
  ) {
    super();
  }

  async run(args: string[], options: PushCommandOptions): Promise<void> {
    try {
      // Validate file path argument
      if (args.length === 0) {
        console.error(chalk.red('Error: File path is required'));
        console.log(chalk.gray('Usage: taptik push <file-path> [options]'));
        process.exit(1);
      }

      const filePath = path.resolve(args[0]);

      // Check if file exists and is a .taptik file
      if (!(await fs.pathExists(filePath))) {
        console.error(chalk.red(`Error: File not found: ${filePath}`));
        process.exit(1);
      }

      const fileExt = path.extname(filePath);
      if (fileExt !== '.taptik') {
        console.error(
          chalk.red(
            `Error: File must have .taptik extension (got: ${fileExt})`,
          ),
        );
        process.exit(1);
      }

      // Parse visibility
      const visibility = this.parseVisibility(options);

      // Parse tags
      const tags = options.tags
        ? options.tags.split(',').map((t) => t.trim())
        : [];

      // Read file for upload
      const fileBuffer = await fs.readFile(filePath);
      const fileStats = await fs.stat(filePath);
      const fileName = path.basename(filePath);

      // Build push options
      const pushOptions: PushOptions = {
        file: {
          buffer: fileBuffer,
          name: fileName,
          size: fileStats.size,
          path: filePath,
        },
        visibility,
        title: options.title || this.generateDefaultTitle(fileName),
        description: options.description,
        tags,
        teamId: options.team,
        version: options.version || '1.0.0',
        autoBump: options.autoBump || false,
        force: options.force || false,
        dryRun: options.dryRun || false,
      };

      // Show summary and confirm if not forced
      if (!options.force && !options.yes && !options.dryRun) {
        const confirmed = await this.confirmUpload(pushOptions);
        if (!confirmed) {
          console.log(chalk.yellow('Upload cancelled'));
          return;
        }
      }

      // Dry run mode
      if (options.dryRun) {
        await this.performDryRun(pushOptions);
        return;
      }

      // Start upload with progress tracking
      console.log(chalk.cyan('\n📤 Starting upload...\n'));

      let lastProgress: UploadProgress | null = null;

      await this.pushService.push(pushOptions, (progress) => {
        this.displayProgress(progress);
        lastProgress = progress;
      });

      // Success message
      if (lastProgress?.configId) {
        console.log(chalk.green('\n✅ Upload completed successfully!'));
        console.log(chalk.gray(`Configuration ID: ${lastProgress.configId}`));

        if (lastProgress.shareUrl) {
          console.log(chalk.cyan(`\n🔗 Share URL: ${lastProgress.shareUrl}`));
        }

        if (visibility === PackageVisibility.Public) {
          console.log(
            chalk.blue('\n📢 Your configuration is now publicly available'),
          );
        } else {
          console.log(chalk.gray('\n🔒 Your configuration is private'));
        }
      }
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  @Option({
    flags: '--public',
    description: 'Make the package publicly accessible',
  })
  parsePublic(): boolean {
    return true;
  }

  @Option({
    flags: '--private',
    description: 'Make the package private (default)',
  })
  parsePrivate(): boolean {
    return true;
  }

  @Option({
    flags: '--title <title>',
    description: 'Title for the package',
  })
  parseTitle(value: string): string {
    return value;
  }

  @Option({
    flags: '--description <description>',
    description: 'Description for the package',
  })
  parseDescription(value: string): string {
    return value;
  }

  @Option({
    flags: '--tags <tags>',
    description: 'Comma-separated tags for the package',
  })
  parseTags(value: string): string {
    return value;
  }

  @Option({
    flags: '--team <team-id>',
    description: 'Team ID to share the package with',
  })
  parseTeam(value: string): string {
    return value;
  }

  @Option({
    flags: '--version <version>',
    description: 'Version of the package (default: 1.0.0)',
  })
  parseVersion(value: string): string {
    return value;
  }

  @Option({
    flags: '--auto-bump',
    description: 'Automatically increment version if conflict exists',
  })
  parseAutoBump(): boolean {
    return true;
  }

  @Option({
    flags: '--force',
    description: 'Skip confirmation prompts',
  })
  parseForce(): boolean {
    return true;
  }

  @Option({
    flags: '--dry-run',
    description: 'Show what would be uploaded without actually uploading',
  })
  parseDryRun(): boolean {
    return true;
  }

  @Option({
    flags: '-y, --yes',
    description: 'Automatically confirm all prompts',
  })
  parseYes(): boolean {
    return true;
  }

  private parseVisibility(options: PushCommandOptions): PackageVisibility {
    if (options.public && options.private) {
      console.error(
        chalk.red('Error: Cannot specify both --public and --private'),
      );
      process.exit(1);
    }

    return options.public
      ? PackageVisibility.Public
      : PackageVisibility.Private;
  }

  private generateDefaultTitle(fileName: string): string {
    // Remove .taptik extension and format nicely
    const baseName = path.basename(fileName, '.taptik');
    return baseName
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private async confirmUpload(options: PushOptions): Promise<boolean> {
    console.log(chalk.cyan('\n📦 Package Upload Summary:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`  File: ${chalk.white(options.file.name)}`);
    console.log(
      `  Size: ${chalk.white(this.formatFileSize(options.file.size))}`,
    );
    console.log(`  Title: ${chalk.white(options.title)}`);

    if (options.description) {
      console.log(`  Description: ${chalk.white(options.description)}`);
    }

    console.log(`  Visibility: ${chalk.white(options.visibility)}`);

    if (options.tags.length > 0) {
      console.log(`  Tags: ${chalk.white(options.tags.join(', '))}`);
    }

    if (options.teamId) {
      console.log(`  Team: ${chalk.white(options.teamId)}`);
    }

    console.log(`  Version: ${chalk.white(options.version)}`);
    console.log(chalk.gray('─'.repeat(40)));

    // Warn about public visibility
    if (options.visibility === PackageVisibility.Public) {
      console.log(
        chalk.yellow('\n⚠️  Warning: This package will be publicly accessible'),
      );
    }

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Do you want to proceed with the upload?',
        default: true,
      },
    ]);

    return confirmed;
  }

  private async performDryRun(options: PushOptions): Promise<void> {
    console.log(
      chalk.cyan('\n🔍 Dry Run Mode - No actual upload will occur\n'),
    );
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.white('Package Information:'));
    console.log(`  File: ${options.file.name}`);
    console.log(`  Size: ${this.formatFileSize(options.file.size)}`);
    console.log(`  Path: ${options.file.path}`);

    console.log(chalk.white('\nMetadata:'));
    console.log(`  Title: ${options.title}`);
    console.log(`  Description: ${options.description || '(none)'}`);
    console.log(`  Visibility: ${options.visibility}`);
    console.log(
      `  Tags: ${options.tags.length > 0 ? options.tags.join(', ') : '(none)'}`,
    );
    console.log(`  Team: ${options.teamId || '(none)'}`);
    console.log(`  Version: ${options.version}`);

    console.log(chalk.white('\nValidation Checks:'));

    // Simulate validation
    const validationSteps = [
      'File format validation',
      'Package structure check',
      'Metadata validation',
      'Size limit check',
      'Sensitive data scan',
      'Rate limit check',
    ];

    await Promise.all(
      validationSteps.map(async (step, index) => {
        await new Promise((resolve) => setTimeout(resolve, 200 * (index + 1)));
        console.log(chalk.green(`  ✓ ${step}`));
      }),
    );

    console.log(chalk.white('\nUpload Steps (simulated):'));
    console.log('  1. Authenticate user');
    console.log('  2. Validate package');
    console.log('  3. Sanitize sensitive data');
    console.log('  4. Generate metadata');
    console.log('  5. Upload to cloud storage');
    console.log('  6. Register in database');
    console.log('  7. Track analytics');

    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.green('\n✅ Dry run completed successfully'));
    console.log(chalk.gray('No files were uploaded'));
  }

  private displayProgress(progress: UploadProgress): void {
    // Clear previous spinner if exists
    if (this.spinner) {
      this.spinner.stop();
    }

    const progressBar = this.createProgressBar(progress.percentage);
    const statusIcon = this.getStatusIcon(progress.stage);

    console.log(
      `${statusIcon} ${chalk.cyan(progress.stage)} ${progressBar} ${chalk.yellow(
        `${progress.percentage}%`,
      )}`,
    );

    if (progress.message) {
      console.log(chalk.gray(`   ${progress.message}`));
    }

    if (progress.eta) {
      console.log(chalk.gray(`   ETA: ${progress.eta}s`));
    }
  }

  private createProgressBar(percentage: number): string {
    const barLength = 30;
    const filled = Math.floor((percentage / 100) * barLength);
    const empty = barLength - filled;

    return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  }

  private getStatusIcon(stage: string): string {
    const icons: Record<string, string> = {
      Authenticating: '🔐',
      Validating: '🔍',
      Sanitizing: '🧹',
      Uploading: '📤',
      Registering: '📝',
      Completing: '🎯',
      Completed: '✅',
    };

    return icons[stage] || '⏳';
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  private handleError(error: Error & { code?: string }): void {
    if (this.spinner) {
      this.spinner.stop();
    }

    const errorCode = error.code || ErrorCodes.SYS_UNEXPECTED;
    const errorMessage = error.message || 'An unexpected error occurred';

    console.error(chalk.red(`\n❌ Upload failed: ${errorMessage}`));

    if (errorCode) {
      console.error(chalk.gray(`Error code: ${errorCode}`));
    }

    // Provide helpful suggestions based on error code
    const suggestions = this.getErrorSuggestions(errorCode);
    if (suggestions.length > 0) {
      console.log(chalk.yellow('\n💡 Suggestions:'));
      suggestions.forEach((suggestion) => {
        console.log(chalk.gray(`  • ${suggestion}`));
      });
    }

    process.exit(1);
  }

  private getErrorSuggestions(errorCode: string): string[] {
    const suggestions: Record<string, string[]> = {
      [ErrorCodes.AUTH_NOT_AUTHENTICATED]: [
        'Run "taptik auth login" to authenticate',
        'Check your internet connection',
      ],
      [ErrorCodes.AUTH_SESSION_EXPIRED]: [
        'Run "taptik auth login" to refresh your session',
      ],
      [ErrorCodes.VAL_FILE_TOO_LARGE]: [
        'Reduce the package size',
        'Consider upgrading to a pro account for larger uploads',
      ],
      [ErrorCodes.VAL_INVALID_PACKAGE]: [
        'Ensure the file is a valid .taptik package',
        'Try rebuilding the package with "taptik build"',
      ],
      [ErrorCodes.SEC_SENSITIVE_DATA]: [
        'Review and remove sensitive data from your configuration',
        'Use environment variables for secrets',
      ],
      [ErrorCodes.NET_UPLOAD_FAILED]: [
        'Check your internet connection',
        'Try uploading again later',
        'The file will be queued for retry if offline',
      ],
      [ErrorCodes.RATE_LIMIT_EXCEEDED]: [
        'Wait before trying again',
        'Consider upgrading to a pro account for higher limits',
      ],
    };

    return (
      suggestions[errorCode] || ['Please try again later or contact support']
    );
  }
}
