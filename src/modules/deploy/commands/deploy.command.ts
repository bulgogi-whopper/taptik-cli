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
    'Deploy Taptik context to target IDE platform. Supports Claude Code (default), Kiro IDE, and Cursor IDE with platform-specific components and configurations.',
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

      const platformDisplayName = this.getPlatformDisplayName(platform);

      // Validate components if specified
      if (options.components && options.components.length > 0) {
        const { valid, invalid } = this.validateComponents(options.components, platform);
        
        if (invalid.length > 0) {
          console.error(`❌ Invalid components for ${platformDisplayName}: ${invalid.join(', ')}`);
          console.error(`✅ Valid components for ${platformDisplayName}: ${this.getValidComponentsForPlatform(platform).join(', ')}`);
          console.error('\n💡 Example usage:');
          console.error(`   taptik deploy --platform ${platform} --components ${this.getValidComponentsForPlatform(platform).slice(0, 2).join(',')}`);
          this.displayPlatformHelp();
          process.exit(1);
        }
        
        console.log(`📦 Deploying specific components: ${valid.join(', ')}`);
      }

      // Validate skip components if specified
      if (options.skipComponents && options.skipComponents.length > 0) {
        const { invalid } = this.validateComponents(options.skipComponents, platform);
        
        if (invalid.length > 0) {
          console.error(`❌ Invalid skip components for ${platformDisplayName}: ${invalid.join(', ')}`);
          console.error(`✅ Valid components for ${platformDisplayName}: ${this.getValidComponentsForPlatform(platform).join(', ')}`);
          console.error('\n💡 Example usage:');
          console.error(`   taptik deploy --platform ${platform} --skip-components ${this.getValidComponentsForPlatform(platform).slice(-1).join(',')}`);
          this.displayPlatformHelp();
          process.exit(1);
        }
      }

      console.log(`🚀 Starting deployment to ${platformDisplayName}...`);

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
        console.log(`🔍 Running validation only for ${platformDisplayName}...`);
      } else if (options.dryRun) {
        console.log(`🧪 Running in dry-run mode for ${platformDisplayName}...`);
      } else {
        console.log(`🚀 Deploying to ${platformDisplayName}...`);
      }

      // Step 3: Route to appropriate deployment method based on platform
      let result: DeploymentResult;
      try {
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
      } catch (error) {
        console.error(`❌ Deployment to ${platformDisplayName} failed:`, (error as Error).message);
        
        // Provide platform-specific troubleshooting suggestions
        this.provideTroubleshootingSuggestions(platform, error as Error);
        process.exit(1);
      }

      // Step 4: Display results
      if (result.success) {
        console.log(`\n✅ Deployment to ${platformDisplayName} successful!`);
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

        // Platform-specific success messages
        this.displayPlatformSpecificSuccessInfo(platform);

        if (result.warnings.length > 0) {
          console.log('\n⚠️  Warnings:');
          result.warnings.forEach((warning) => {
            console.log(`   - ${warning.message}`);
          });
        }
      } else {
        console.error(`\n❌ Deployment to ${platformDisplayName} failed!`);

        if (result.errors.length > 0) {
          console.error('🚨 Errors:');
          result.errors.forEach((error) => {
            console.error(`   - [${error.severity}] ${error.message}`);
          });
        }

        // Provide platform-specific troubleshooting
        this.provideTroubleshootingSuggestions(platform, new Error('Deployment failed'));
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
    description: 'Target platform: "claude-code" (default), "kiro-ide", or "cursor-ide"',
    defaultValue: 'claude-code',
  })
  parsePlatform(value: string): SupportedPlatform {
    const supportedPlatforms: SupportedPlatform[] = ['claude-code', 'kiro-ide', 'cursor-ide'];
    if (!supportedPlatforms.includes(value as SupportedPlatform)) {
      const platformDescriptions = {
        'claude-code': 'Claude Code IDE (default)',
        'kiro-ide': 'Kiro IDE',
        'cursor-ide': 'Cursor IDE with AI features'
      };
      
      console.error(`❌ Unsupported platform: "${value}"`);
      console.error('\n📋 Supported platforms:');
      supportedPlatforms.forEach(platform => {
        console.error(`   • ${platform}: ${platformDescriptions[platform]}`);
      });
      console.error('\n💡 Example usage:');
      console.error('   taptik deploy --platform cursor-ide');
      console.error('   taptik deploy --platform kiro-ide --components settings,agents');
      
      throw new Error(`Unsupported platform: ${value}`);
    }
    return value as SupportedPlatform;
  }

  @Option({
    flags: '-c, --context-id <id>',
    description: 'Specific context ID to deploy from Supabase (default: latest available)',
  })
  parseContextId(value: string): string {
    if (!value || value.trim() === '') {
      throw new Error('Context ID cannot be empty');
    }
    return value.trim();
  }

  @Option({
    flags: '-d, --dry-run',
    description: 'Preview deployment changes without applying them (safe mode)',
  })
  parseDryRun(): boolean {
    return true;
  }

  @Option({
    flags: '-v, --validate-only',
    description: 'Check configuration compatibility without deploying (validation mode)',
  })
  parseValidateOnly(): boolean {
    return true;
  }

  @Option({
    flags: '-s, --conflict-strategy <strategy>',
    description:
      'Strategy for handling file conflicts: prompt (ask user), overwrite (replace), merge (combine), skip (keep existing)',
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
      console.error(`❌ Invalid conflict strategy: "${value}"`);
      console.error('\n📋 Valid conflict strategies:');
      console.error('   • prompt: Ask user for each conflict (default)');
      console.error('   • overwrite: Replace existing files with new ones');
      console.error('   • merge: Intelligently combine existing and new configurations');
      console.error('   • skip: Keep existing files, skip conflicting deployments');
      console.error('\n💡 Example usage:');
      console.error('   taptik deploy --platform cursor-ide --conflict-strategy merge');
      
      throw new Error(`Invalid conflict strategy: ${value}`);
    }
    return value as ConflictStrategy;
  }

  @Option({
    flags: '--components <components...>',
    description:
      'Specific components to deploy (platform-dependent). Use --help for platform-specific component lists.',
  })
  parseComponents(value: string, previous: string[] = []): string[] {
    // Basic validation - detailed validation happens in run() method with platform context
    if (!value || value.trim() === '') {
      throw new Error('Component name cannot be empty');
    }
    return [...previous, value.trim()];
  }

  @Option({
    flags: '--skip-components <components...>',
    description: 'Components to skip during deployment (platform-dependent). Use --help for platform-specific component lists.',
  })
  parseSkipComponents(value: string, previous: string[] = []): string[] {
    // Basic validation - detailed validation happens in run() method with platform context
    if (!value || value.trim() === '') {
      throw new Error('Skip component name cannot be empty');
    }
    return [...previous, value.trim()];
  }

  @Option({
    flags: '-f, --force',
    description: 'Skip confirmation prompts and force deployment (use with caution)',
  })
  parseForce(): boolean {
    return true;
  }

  /**
   * Validate components for the specified platform
   */
  private validateComponents(
    components: string[],
    platform: SupportedPlatform,
  ): { valid: string[]; invalid: string[] } {
    const validComponents: Record<SupportedPlatform, string[]> = {
      'claude-code': ['settings', 'agents', 'commands', 'project'],
      'kiro-ide': ['settings', 'steering', 'specs', 'hooks', 'agents', 'templates'],
      'cursor-ide': ['settings', 'extensions', 'snippets', 'ai-prompts', 'tasks', 'launch'],
    };

    const platformComponents = validComponents[platform];
    const valid = components.filter(c => platformComponents.includes(c));
    const invalid = components.filter(c => !platformComponents.includes(c));

    return { valid, invalid };
  }

  /**
   * Get platform display name
   */
  private getPlatformDisplayName(platform: SupportedPlatform): string {
    const displayNames: Record<SupportedPlatform, string> = {
      'claude-code': 'Claude Code',
      'kiro-ide': 'Kiro IDE',
      'cursor-ide': 'Cursor IDE',
    };
    return displayNames[platform];
  }

  /**
   * Get valid components for a platform
   */
  private getValidComponentsForPlatform(platform: SupportedPlatform): string[] {
    const validComponents: Record<SupportedPlatform, string[]> = {
      'claude-code': ['settings', 'agents', 'commands', 'project'],
      'kiro-ide': ['settings', 'steering', 'specs', 'hooks', 'agents', 'templates'],
      'cursor-ide': ['settings', 'extensions', 'snippets', 'ai-prompts', 'tasks', 'launch'],
    };
    return validComponents[platform];
  }

  /**
   * Display comprehensive help information for all platforms
   */
  private displayPlatformHelp(): void {
    console.log('\n📋 Platform-specific component information:\n');
    
    console.log('🔵 Claude Code (claude-code):');
    console.log('   Components: settings, agents, commands, project');
    console.log('   Example: taptik deploy --platform claude-code --components settings,agents\n');
    
    console.log('🟢 Kiro IDE (kiro-ide):');
    console.log('   Components: settings, steering, specs, hooks, agents, templates');
    console.log('   Example: taptik deploy --platform kiro-ide --components settings,steering\n');
    
    console.log('🟡 Cursor IDE (cursor-ide):');
    console.log('   Components: settings, extensions, snippets, ai-prompts, tasks, launch');
    console.log('   Example: taptik deploy --platform cursor-ide --components settings,ai-prompts\n');
    
    console.log('💡 Common usage patterns:');
    console.log('   • Deploy all components: taptik deploy --platform cursor-ide');
    console.log('   • Deploy specific components: taptik deploy --platform cursor-ide --components settings,ai-prompts');
    console.log('   • Skip components: taptik deploy --platform cursor-ide --skip-components extensions');
    console.log('   • Dry run: taptik deploy --platform cursor-ide --dry-run');
    console.log('   • Validate only: taptik deploy --platform cursor-ide --validate-only');
    console.log('   • Handle conflicts: taptik deploy --platform cursor-ide --conflict-strategy merge');
  }

  /**
   * Display platform-specific success information
   */
  private displayPlatformSpecificSuccessInfo(platform: SupportedPlatform): void {
    switch (platform) {
      case 'cursor-ide':
        console.log('\n🎯 Cursor IDE specific info:');
        console.log('   • Global settings: ~/.cursor/settings.json');
        console.log('   • Project settings: .cursor/settings.json');
        console.log('   • AI prompts: .cursor/ai/prompts/');
        console.log('   • AI rules: .cursor/ai/rules/');
        console.log('   • Extensions: .cursor/extensions.json');
        console.log('   • Snippets: ~/.cursor/snippets/');
        console.log('   • Tasks: .cursor/tasks.json');
        console.log('   • Launch config: .cursor/launch.json');
        console.log('   • Restart Cursor IDE to apply all changes');
        break;
        
      case 'kiro-ide':
        console.log('\n🎯 Kiro IDE specific info:');
        console.log('   • Settings: ~/.kiro/settings/');
        console.log('   • Steering: .kiro/steering/');
        console.log('   • Specs: .kiro/specs/');
        console.log('   • Hooks: .kiro/hooks/');
        console.log('   • Restart Kiro IDE to apply all changes');
        break;
        
      case 'claude-code':
        console.log('\n🎯 Claude Code specific info:');
        console.log('   • Configuration deployed to Claude Code directory');
        console.log('   • Restart Claude Code to apply all changes');
        break;
    }
  }

  /**
   * Provide platform-specific troubleshooting suggestions
   */
  private provideTroubleshootingSuggestions(platform: SupportedPlatform, error: Error): void {
    console.log('\n💡 Troubleshooting suggestions:');
    
    switch (platform) {
      case 'cursor-ide':
        console.log('   • Ensure Cursor IDE is installed and accessible');
        console.log('   • Check that ~/.cursor directory exists and is writable');
        console.log('   • Verify that .cursor directory in your project is writable');
        console.log('   • Try running with --dry-run to see what would be deployed');
        console.log('   • Use --validate-only to check configuration compatibility');
        console.log('   • Consider using --conflict-strategy=skip to avoid overwriting existing settings');
        if (error.message.includes('permission')) {
          console.log('   • Permission issue detected: Try running with elevated privileges');
        }
        if (error.message.includes('ENOENT')) {
          console.log('   • File not found: Ensure Cursor IDE is properly installed');
        }
        break;
        
      case 'kiro-ide':
        console.log('   • Ensure Kiro IDE is installed and accessible');
        console.log('   • Check that ~/.kiro directory exists and is writable');
        console.log('   • Verify that .kiro directory in your project is writable');
        break;
        
      case 'claude-code':
        console.log('   • Ensure Claude Code is installed and accessible');
        console.log('   • Check that Claude Code configuration directory is writable');
        break;
    }
    
    console.log('   • Run with --validate-only to check for configuration issues');
    console.log('   • Use --dry-run to preview changes without applying them');
    console.log('   • Check the context ID exists in Supabase');
  }
}
