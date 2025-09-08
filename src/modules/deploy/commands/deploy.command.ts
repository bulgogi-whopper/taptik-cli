import { Injectable } from '@nestjs/common';

import { Command, CommandRunner, Option } from 'nest-commander';

import { ComponentType } from '../interfaces/component-types.interface';
import {
  SupportedPlatform,
  ConflictStrategy,
} from '../interfaces/deploy-options.interface';
import { DeploymentResult } from '../interfaces/deployment-result.interface';
import { DeploymentService } from '../services/deployment.service';
import { ImportService } from '../services/import.service';

interface DeployCommandOptions {
  platform?: SupportedPlatform;
  contextId?: string;
  dryRun?: boolean;
  validateOnly?: boolean;
  conflictStrategy?: ConflictStrategy;
  components?: string[];
  skipComponents?: string[];
  force?: boolean;
}

@Command({
  name: 'deploy',
  description:
    'Deploy Taptik context to target platform (Claude Code, Kiro IDE, Cursor IDE)',
})
@Injectable()
export class DeployCommand extends CommandRunner {
  constructor(
    private readonly importService: ImportService,
    private readonly deploymentService: DeploymentService,
  ) {
    super();
  }

  async run(
    passedParameters: string[],
    options: DeployCommandOptions,
  ): Promise<void> {
    try {
      // Set default platform
      const platform = options.platform || 'claude-code';

      if (platform !== 'claude-code' && platform !== 'kiro-ide' && platform !== 'cursor-ide') {
        console.error(
          `❌ Platform '${platform}' is not supported. Supported platforms: 'claude-code', 'kiro-ide', 'cursor-ide'`,
        );
        process.exit(1);
      }

      // Note: Kiro deployment will show feature development status in results

      console.log(`🚀 Starting deployment to ${platform}...`);

      // Step 1: Import context from Supabase
      console.log('📥 Importing context from Supabase...');
      const context = await this.importService.importFromSupabase(
        options.contextId || 'latest',
      );

      if (!context) {
        console.error('❌ Failed to import context from Supabase');
        process.exit(1);
      }

      console.log(
        `✅ Context imported successfully: ${context.metadata?.title || 'Unnamed Context'}`,
      );

      // Step 2: Prepare deployment options
      const deployOptions = {
        platform: platform as SupportedPlatform,
        dryRun: options.dryRun || false,
        validateOnly: options.validateOnly || false,
        conflictStrategy: options.conflictStrategy || 'prompt',
        components: options.components?.map((c) => c as ComponentType),
        skipComponents: options.skipComponents?.map((c) => c as ComponentType),
      };

      // Step 3: Deploy to target platform
      if (options.validateOnly) {
        console.log('🔍 Running validation only...');
      } else if (options.dryRun) {
        console.log('🧪 Running in dry-run mode...');
      } else {
        console.log(
          `🚀 Deploying to ${platform === 'claude-code' ? 'Claude Code' : platform === 'kiro-ide' ? 'Kiro IDE' : 'Cursor IDE'}...`,
        );
      }

      // Step 3: Route to appropriate deployment method based on platform
      let result: DeploymentResult;
      if (platform === 'claude-code') {
        result = await this.deploymentService.deployToClaudeCode(
          context,
          deployOptions,
        );
      } else if (platform === 'kiro-ide') {
        result = await this.deploymentService.deployToKiro(
          context,
          deployOptions,
        );
      } else if (platform === 'cursor-ide') {
        result = await this.deploymentService.deployToCursor(
          context,
          deployOptions,
        );
      } else {
        console.error(
          `❌ Platform '${platform}' deployment is not implemented yet.`,
        );
        process.exit(5); // Platform Error exit code
      }

      // Step 4: Display results
      if (result.success) {
        console.log('\n✅ Deployment successful!');
        console.log(
          `📦 Components deployed: ${result.deployedComponents.join(', ')}`,
        );
        console.log(`📊 Summary:`);
        console.log(`   - Files deployed: ${result.summary.filesDeployed}`);
        console.log(`   - Files skipped: ${result.summary.filesSkipped}`);
        console.log(
          `   - Conflicts resolved: ${result.summary.conflictsResolved}`,
        );

        if (result.summary.backupCreated) {
          console.log(`   - Backup created: ✅`);
        }

        if (result.warnings.length > 0) {
          console.log('\n⚠️  Warnings:');
          result.warnings.forEach((warning) => {
            console.log(`   - ${warning.message}`);
          });
        }
      } else {
        console.error('\n❌ Deployment failed!');

        if (result.errors.length > 0) {
          console.error('🚨 Errors:');
          result.errors.forEach((error) => {
            console.error(`   - [${error.severity}] ${error.message}`);
          });
        }

        process.exit(1);
      }
    } catch (error) {
      console.error(
        '❌ Unexpected error during deployment:',
        (error as Error).message,
      );
      process.exit(1);
    }
  }

  @Option({
    flags: '-p, --platform <platform>',
    description: 'Target platform ("claude-code", "kiro-ide", or "cursor-ide")',
    defaultValue: 'claude-code',
  })
  parsePlatform(value: string): SupportedPlatform {
    const supportedPlatforms: SupportedPlatform[] = ['claude-code', 'kiro-ide', 'cursor-ide'];
    if (!supportedPlatforms.includes(value as SupportedPlatform)) {
      throw new Error(
        `Unsupported platform: ${value}. Supported platforms: ${supportedPlatforms.join(', ')}`,
      );
    }
    return value as SupportedPlatform;
  }

  @Option({
    flags: '-c, --context-id <id>',
    description: 'Context ID to deploy (default: latest)',
  })
  parseContextId(value: string): string {
    return value;
  }

  @Option({
    flags: '-d, --dry-run',
    description: 'Simulate deployment without making changes',
  })
  parseDryRun(): boolean {
    return true;
  }

  @Option({
    flags: '-v, --validate-only',
    description: 'Only validate the configuration without deploying',
  })
  parseValidateOnly(): boolean {
    return true;
  }

  @Option({
    flags: '-s, --conflict-strategy <strategy>',
    description:
      'Strategy for handling conflicts (prompt, overwrite, merge, skip)',
    defaultValue: 'prompt',
  })
  parseConflictStrategy(value: string): ConflictStrategy {
    const validStrategies: ConflictStrategy[] = [
      'prompt',
      'overwrite',
      'merge',
      'skip',
    ];
    if (!validStrategies.includes(value as ConflictStrategy)) {
      throw new Error(`Invalid conflict strategy: ${value}`);
    }
    return value as ConflictStrategy;
  }

  @Option({
    flags: '--components <components...>',
    description:
      'Specific components to deploy (settings, agents, commands, project)',
  })
  parseComponents(value: string, previous: string[] = []): string[] {
    return [...previous, value];
  }

  @Option({
    flags: '--skip-components <components...>',
    description: 'Components to skip during deployment',
  })
  parseSkipComponents(value: string, previous: string[] = []): string[] {
    return [...previous, value];
  }

  @Option({
    flags: '-f, --force',
    description: 'Force deployment without confirmation prompts',
  })
  parseForce(): boolean {
    return true;
  }
}
