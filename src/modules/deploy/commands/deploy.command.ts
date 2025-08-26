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
import { HelpDocumentationService } from '../services/help-documentation.service';
import { ErrorMessageHelperService } from '../services/error-message-helper.service';

interface DeployCommandOptions {
  platform?: SupportedPlatform;
  contextId?: string;
  dryRun?: boolean;
  validateOnly?: boolean;
  conflictStrategy?: ConflictStrategy;
  components?: string[];
  skipComponents?: string[];
  force?: boolean;
  // Task 7.2: Cursor-specific options
  cursorPath?: string;
  workspacePath?: string;
  skipAiConfig?: boolean;
  skipExtensions?: boolean;
  skipDebugConfig?: boolean;
  skipTasks?: boolean;
  skipSnippets?: boolean;
  // Task 12.1: Help and documentation options
  help?: boolean;
  helpPlatform?: string;
  helpComponent?: string;
  listComponents?: boolean;
}

@Command({
  name: 'deploy',
  description: 'Deploy Taptik context to target platform (Claude Code, Kiro IDE, Cursor IDE)',
})
@Injectable()
export class DeployCommand extends CommandRunner {
  constructor(
    private readonly importService: ImportService,
    private readonly deploymentService: DeploymentService,
    private readonly helpService: HelpDocumentationService,
    private readonly errorHelper: ErrorMessageHelperService,
  ) {
    super();
  }

  async run(
    passedParameters: string[],
    options: DeployCommandOptions,
  ): Promise<void> {
    try {
      // Task 12.1: Handle help and documentation requests
      if (options.help) {
        const helpContent = this.helpService.getDeployCommandHelp();
        console.log(this.helpService.formatHelpForConsole(helpContent));
        return;
      }

      if (options.helpPlatform) {
        try {
          const platformHelp = this.helpService.getPlatformHelp(options.helpPlatform as SupportedPlatform);
          console.log(this.helpService.formatHelpForConsole(platformHelp));
          return;
        } catch (error) {
          console.error(`❌ Unknown platform: ${options.helpPlatform}`);
          console.log('📋 Available platforms: claude-code, kiro-ide, cursor-ide');
          return;
        }
      }

      if (options.helpComponent) {
        const platform = options.platform || 'claude-code';
        const componentHelp = this.helpService.getComponentHelp(options.helpComponent, platform);
        if (componentHelp) {
          console.log(this.helpService.formatComponentHelpForConsole(componentHelp));
          return;
        } else {
          console.error(`❌ Component "${options.helpComponent}" not found for platform ${platform}`);
          const suggestions = this.helpService.getComponentSuggestions(platform);
          console.log(`📋 Available components for ${platform}: ${suggestions.join(', ')}`);
          return;
        }
      }

      if (options.listComponents) {
        const platform = options.platform || 'claude-code';
        const components = this.helpService.getComponentSuggestions(platform);
        console.log(`📋 Available components for ${platform}:`);
        components.forEach(component => {
          const help = this.helpService.getComponentHelp(component, platform);
          const description = help ? help.description : 'No description available';
          console.log(`   • ${component}: ${description}`);
        });
        return;
      }

      // Set default platform
      const platform = options.platform || 'claude-code';

      if (platform !== 'claude-code' && platform !== 'kiro-ide' && platform !== 'cursor-ide') {
        console.error(
          `❌ Platform '${platform}' is not supported. Supported platforms: 'claude-code', 'kiro-ide', 'cursor-ide'`,
        );
        process.exit(1);
      }

      // Task 7.2: Platform-specific deployment notes
      if (platform === 'kiro-ide') {
        // Note: Kiro deployment will show feature development status in results
      } else if (platform === 'cursor-ide') {
        console.log('💡 Cursor IDE deployment includes AI configuration, extensions, snippets, and workspace settings');
        if (options.cursorPath) {
          console.log(`📍 Using Cursor executable: ${options.cursorPath}`);
        }
        if (options.workspacePath) {
          console.log(`📁 Target workspace: ${options.workspacePath}`);
        }
      }

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

      // Task 12.1: Validate component names and provide suggestions
      if (options.components) {
        for (const componentName of options.components) {
          const suggestion = this.helpService.validateComponentName(componentName, platform);
          if (suggestion.suggestions.length === 0 || suggestion.suggestions[0].confidence < 1.0) {
            console.error(`❌ Invalid component: "${componentName}" for platform ${platform}`);
            if (suggestion.didYouMean) {
              console.log(`💡 Did you mean: "${suggestion.didYouMean}"?`);
            }
            if (suggestion.examples && suggestion.examples.length > 0) {
              console.log(`📋 Valid components: ${suggestion.examples.join(', ')}`);
            }
            process.exit(1);
          }
        }
      }

      if (options.skipComponents) {
        for (const componentName of options.skipComponents) {
          const suggestion = this.helpService.validateComponentName(componentName, platform);
          if (suggestion.suggestions.length === 0 || suggestion.suggestions[0].confidence < 1.0) {
            console.warn(`⚠️  Warning: Invalid skip component: "${componentName}" for platform ${platform}`);
            if (suggestion.didYouMean) {
              console.log(`💡 Did you mean: "${suggestion.didYouMean}"?`);
            }
          }
        }
      }

      // Step 2: Prepare deployment options
      const deployOptions = {
        platform: platform as SupportedPlatform,
        dryRun: options.dryRun || false,
        validateOnly: options.validateOnly || false,
        conflictStrategy: options.conflictStrategy || 'prompt',
        components: options.components?.map((c) => c as ComponentType),
        skipComponents: options.skipComponents?.map((c) => c as ComponentType),
        // Task 7.2: Add Cursor-specific options to deployOptions
        cursorPath: options.cursorPath,
        workspacePath: options.workspacePath,
        skipAiConfig: options.skipAiConfig,
        skipExtensions: options.skipExtensions,
        skipDebugConfig: options.skipDebugConfig,
        skipTasks: options.skipTasks,
        skipSnippets: options.skipSnippets,
      };

      // Step 3: Deploy to target platform
      if (options.validateOnly) {
        console.log('🔍 Running validation only...');
      } else if (options.dryRun) {
        console.log('🧪 Running in dry-run mode...');
      } else {
        const platformNames = {
          'claude-code': 'Claude Code',
          'kiro-ide': 'Kiro IDE',
          'cursor-ide': 'Cursor IDE',
        };
        console.log(`🚀 Deploying to ${platformNames[platform as keyof typeof platformNames] || platform}...`);
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
        // Task 7.2: Add Cursor IDE deployment routing
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

        // Task 7.2: Platform-specific result display
        if (platform === 'cursor-ide') {
          console.log('\n🎯 Cursor IDE specific information:');
          console.log(`   - AI configuration applied: ${!options.skipAiConfig ? '✅' : '❌'}`);
          console.log(`   - Extensions processed: ${!options.skipExtensions ? '✅' : '❌'}`);
          console.log(`   - Debug config applied: ${!options.skipDebugConfig ? '✅' : '❌'}`);
          console.log(`   - Tasks configured: ${!options.skipTasks ? '✅' : '❌'}`);
          console.log(`   - Snippets deployed: ${!options.skipSnippets ? '✅' : '❌'}`);
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
            // Task 12.1: Enhanced error reporting with solutions
            const enhancedError = this.errorHelper.enhanceError(error, platform);
            console.error(`   - [${error.severity}] ${error.message}`);
            
            if (enhancedError.quickFix) {
              console.error(`     💡 Quick fix: ${enhancedError.quickFix}`);
            }
            
            if (enhancedError.solutions && enhancedError.solutions.length > 0) {
              console.error(`     🔧 Solutions available: ${enhancedError.solutions.length}`);
              console.error(`     💬 Run with --help-error ${enhancedError.errorCode || 'UNKNOWN'} for detailed solutions`);
            }
          });
        }

        process.exit(1);
      }
    } catch (error) {
      // Task 12.1: Enhanced error handling for unexpected errors
      const deploymentError = {
        component: 'deploy-command',
        type: 'unexpected-error',
        severity: 'high' as const,
        message: (error as Error).message,
        suggestion: 'Check logs and try again, or contact support if issue persists',
      };

      const enhanced = this.errorHelper.enhanceError(deploymentError, platform);
      console.error('\n❌ Unexpected error during deployment:');
      console.error(this.errorHelper.generateUserFriendlyMessage(deploymentError, platform, false));
      
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
      'Specific components to deploy. Claude Code: (settings, agents, commands, project). Kiro IDE: (settings, steering, specs, hooks, agents, templates). Cursor IDE: (global-settings, project-settings, ai-config, extensions-config, debug-config, tasks-config, snippets-config, workspace-config)',
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

  // Task 7.2: Cursor-specific options
  @Option({
    flags: '--cursor-path <path>',
    description: 'Path to Cursor IDE executable (for cursor-ide platform)',
  })
  parseCursorPath(value: string): string {
    return value;
  }

  @Option({
    flags: '--workspace-path <path>',
    description: 'Workspace path for Cursor deployment (default: current directory)',
  })
  parseWorkspacePath(value: string): string {
    return value;
  }

  @Option({
    flags: '--skip-ai-config',
    description: 'Skip AI configuration deployment (cursor-ide only)',
  })
  parseSkipAiConfig(): boolean {
    return true;
  }

  @Option({
    flags: '--skip-extensions',
    description: 'Skip extensions configuration (cursor-ide only)',
  })
  parseSkipExtensions(): boolean {
    return true;
  }

  @Option({
    flags: '--skip-debug-config',
    description: 'Skip debug configuration deployment (cursor-ide only)',
  })
  parseSkipDebugConfig(): boolean {
    return true;
  }

  @Option({
    flags: '--skip-tasks',
    description: 'Skip tasks configuration deployment (cursor-ide only)',
  })
  parseSkipTasks(): boolean {
    return true;
  }

  @Option({
    flags: '--skip-snippets',
    description: 'Skip snippets deployment (cursor-ide only)',
  })
  parseSkipSnippets(): boolean {
    return true;
  }

  // Task 12.1: Help and documentation options
  @Option({
    flags: '-h, --help',
    description: 'Show comprehensive help for deploy command',
  })
  parseHelp(): boolean {
    return true;
  }

  @Option({
    flags: '--help-platform <platform>',
    description: 'Show help for specific platform (claude-code, kiro-ide, cursor-ide)',
  })
  parseHelpPlatform(value: string): string {
    return value;
  }

  @Option({
    flags: '--help-component <component>',
    description: 'Show help for specific component',
  })
  parseHelpComponent(value: string): string {
    return value;
  }

  @Option({
    flags: '--list-components',
    description: 'List all available components for the specified platform',
  })
  parseListComponents(): boolean {
    return true;
  }
}
