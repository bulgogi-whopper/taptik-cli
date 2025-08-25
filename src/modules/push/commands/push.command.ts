import * as fs from 'fs';
import * as path from 'path';

import { Injectable } from '@nestjs/common';

import { Command, CommandRunner, Option } from 'nest-commander';

import { PushOptions } from '../interfaces';
import { PushService } from '../services/push.service';


interface PushCommandOptions extends PushOptions {
  output?: string;
}

@Command({
  name: 'push',
  description: 'Upload a Taptik package to cloud storage',
})
@Injectable()
export class PushCommand extends CommandRunner {
  constructor(private readonly pushService: PushService) {
    super();
  }

  async run(
    passedParams: string[],
    options: PushCommandOptions,
  ): Promise<void> {
    const packagePath = passedParams[0];

    if (!packagePath) {
      console.error('Error: Package file path is required');
      console.log('Usage: taptik push <package-file> [options]');
      process.exit(1);
    }

    // Validate file exists
    const fullPath = path.resolve(packagePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`Error: File not found: ${packagePath}`);
      process.exit(1);
    }

    // Validate file extension
    if (!fullPath.endsWith('.taptik')) {
      console.error('Error: File must be a .taptik package');
      process.exit(1);
    }

    console.log('🚀 Uploading package to cloud...');

    try {
      const metadata = await this.pushService.upload(fullPath, options);
      
      console.log('✅ Upload successful!');
      console.log(`📦 Config ID: ${metadata.configId}`);
      console.log(`🔗 Share URL: https://taptik.dev/config/${metadata.configId}`);
      
      if (metadata.isPublic) {
        console.log('👁️  Visibility: Public');
      } else {
        console.log('🔒 Visibility: Private');
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error('An unexpected error occurred');
      }
      process.exit(1);
    }
  }

  @Option({
    flags: '--public',
    description: 'Make the configuration publicly accessible',
  })
  parsePublic(): boolean {
    return true;
  }

  @Option({
    flags: '--private',
    description: 'Make the configuration private (default)',
  })
  parsePrivate(): boolean {
    return true;
  }

  @Option({
    flags: '--title <title>',
    description: 'Title for the configuration',
  })
  parseTitle(value: string): string {
    return value;
  }

  @Option({
    flags: '--description <description>',
    description: 'Description for the configuration',
  })
  parseDescription(value: string): string {
    return value;
  }

  @Option({
    flags: '--tags <tags>',
    description: 'Comma-separated tags for the configuration',
  })
  parseTags(value: string): string[] {
    return value.split(',').map(tag => tag.trim()).filter(Boolean);
  }

  @Option({
    flags: '--team <team>',
    description: 'Team ID to associate the configuration with',
  })
  parseTeam(value: string): string {
    return value;
  }

  @Option({
    flags: '--version <version>',
    description: 'Semantic version for the configuration',
  })
  parseVersion(value: string): string {
    return value;
  }

  @Option({
    flags: '--force',
    description: 'Force upload even if sensitive data is detected',
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
}