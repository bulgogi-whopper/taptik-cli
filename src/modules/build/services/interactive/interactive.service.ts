import { Injectable, Logger } from '@nestjs/common';

import { select, checkbox, input, confirm } from '@inquirer/prompts';

import { BuildCategory, BuildPlatform, BuildCategoryName } from '../../interfaces/build-config.interface';

import type {
  SecurityIssue,
  PartialUploadResult,
  UploadError,
  BatchConfig
} from '../../interfaces/interactive.interface';
import type { PackageDetails } from '../../interfaces/progress.interface';

/**
 * Service for handling interactive user input during the build process
 */
@Injectable()
export class InteractiveService {
  private readonly logger = new Logger(InteractiveService.name);
  private readonly TIMEOUT_MS = 30_000; // 30 seconds

  /**
   * Prompts user to select a platform for the build
   * @returns Promise resolving to the selected platform
   * @throws Error if timeout occurs or invalid selection
   */
  async selectPlatform(): Promise<BuildPlatform> {
    const platform = await select<BuildPlatform>({
      message: '🚀 Select a platform for your Taptik build:',
      choices: [
        {
          name: 'Kiro (Ready)',
          value: BuildPlatform.KIRO,
          description: 'Build from Kiro settings - fully supported'
        },
        {
          name: 'Cursor (Coming soon)',
          value: BuildPlatform.CURSOR,
          description: 'Cursor integration is in development',
          disabled: '(Coming soon)'
        },
        {
          name: 'Claude Code (Coming soon)',
          value: BuildPlatform.CLAUDE_CODE, 
          description: 'Claude Code integration is in development',
          disabled: '(Coming soon)'
        }
      ],
      default: BuildPlatform.KIRO
    });

    return platform;
  }

  // Claude Code specific methods - GREEN phase implementation  
  async confirmClaudeCodeUpload(packageDetails: PackageDetails): Promise<boolean> {
    this.logger.log('📦 Package Details:');
    this.logger.log(`  • Size: ${(packageDetails.size / 1024).toFixed(1)} KB`);
    this.logger.log(`  • Title: ${packageDetails.title}`);
    this.logger.log(`  • Visibility: ${packageDetails.isPublic ? 'Public' : 'Private'}`);
    this.logger.log(`  • Tags: ${packageDetails.tags.join(', ')}`);
    this.logger.log(`  • Security: ✅ ${packageDetails.securityLevel.toUpperCase()}`);
    
    return await confirm({
      message: 'Ready to upload your Claude Code configuration to the cloud?',
      default: true
    });
  }

  async selectUploadAction(): Promise<string> {
    return await select({
      message: 'What would you like to do with your Claude Code package?',
      choices: [
        { value: 'upload', name: '☁️  Upload to cloud now' },
        { value: 'save', name: '💾 Save locally only' },
        { value: 'configure', name: '⚙️  Configure upload settings' },
        { value: 'both', name: '📤 Save locally and upload' }
      ],
      default: 'both'
    });
  }

  async selectVisibility(): Promise<string> {
    return await select({
      message: 'Choose visibility for your Claude Code configuration:',
      choices: [
        { 
          value: 'public', 
          name: '🌍 Public - Anyone can discover and use',
          description: 'Share with the community'
        },
        { 
          value: 'private', 
          name: '🔒 Private - Only you can access',
          description: 'Keep for personal use'
        }
      ],
      default: 'private'
    });
  }

  async getPackageMetadata(): Promise<{ title: string; description: string; tags: string[] }> {
    const title = await input({
      message: 'Enter a title for your configuration:',
      default: 'Claude Code Configuration',
      validate: (value) => {
        if (!value) return 'Title is required';
        if (value.length < 3) return 'Title must be at least 3 characters';
        return true;
      }
    });
    
    const description = await input({
      message: 'Enter a description (optional):',
      default: ''
    });
    
    const tags = await this.selectTags();
    
    return { title, description, tags };
  }

  async selectTags(): Promise<string[]> {
    const customTags = await input({
      message: 'Enter custom tags (comma-separated):',
      default: ''
    });
    
    const suggestedTags = await checkbox({
      message: 'Select suggested tags:',
      choices: [
        { value: 'team', name: 'team' },
        { value: 'production', name: 'production' },
        { value: 'development', name: 'development' },
        { value: 'personal', name: 'personal' }
      ]
    });
    
    const allTags = customTags ? customTags.split(',').map(t => t.trim()) : [];
    return [...allTags, ...suggestedTags];
  }

  async promptEnableAutoUpload(): Promise<boolean> {
    return await confirm({
      message: 'Enable automatic cloud upload for future builds?',
      default: false
    });
  }

  async selectDefaultVisibility(): Promise<string> {
    return await select({
      message: 'Choose default visibility for auto-uploads:',
      choices: [
        { value: 'private', name: '🔒 Private (recommended)' },
        { value: 'public', name: '🌍 Public' },
        { value: 'ask', name: '❓ Ask each time' }
      ],
      default: 'private'
    });
  }

  async getDefaultTags(): Promise<string[]> {
    const tags = await input({
      message: 'Enter default tags for auto-uploads (comma-separated):',
      default: 'auto-backup'
    });
    
    return tags.split(',').map(t => t.trim());
  }

  async confirmSaveConfiguration(): Promise<boolean> {
    return await confirm({
      message: 'Save these settings to ~/.taptik/config.yaml?',
      default: true
    });
  }

  async handleExistingConfig(): Promise<string> {
    return await select({
      message: 'A configuration already exists. What would you like to do?',
      choices: [
        { value: 'backup', name: '💾 Backup existing and continue' },
        { value: 'merge', name: '🔀 Merge with existing' },
        { value: 'replace', name: '🔄 Replace existing' },
        { value: 'cancel', name: '❌ Cancel operation' }
      ],
      default: 'backup'
    });
  }

  async resolveSecurityIssue(issue: SecurityIssue): Promise<string> {
    this.logger.warn('⚠️  Security Issue Detected:');
    this.logger.warn(`  Type: ${issue.type}`);
    this.logger.warn(`  Location: ${issue.file}:${issue.line}`);
    this.logger.warn(`  Severity: ${issue.severity.toUpperCase()}`);
    
    return await select({
      message: 'How would you like to handle this security issue?',
      choices: [
        { value: 'remove', name: '🗑️  Remove sensitive data' },
        { value: 'mask', name: '🎭 Mask sensitive data' },
        { value: 'ignore', name: '⚠️  Ignore and continue (not recommended)' },
        { value: 'cancel', name: '❌ Cancel upload' }
      ],
      default: 'remove'
    });
  }

  async promptAuthentication(): Promise<boolean> {
    this.logger.log('☁️  Cloud upload requires authentication');
    
    return await confirm({
      message: 'Would you like to login now?',
      default: true
    });
  }

  async selectAuthMethod(): Promise<string> {
    return await select({
      message: 'Choose authentication method:',
      choices: [
        { value: 'github', name: '🐙 GitHub' },
        { value: 'google', name: '🔍 Google' },
        { value: 'email', name: '📧 Email/Password' }
      ],
      default: 'github'
    });
  }

  async selectNotificationPreferences(): Promise<string[]> {
    return await checkbox({
      message: 'Select notification preferences:',
      choices: [
        { value: 'upload_complete', name: '✅ Upload completion', checked: true },
        { value: 'upload_failed', name: '❌ Upload failures', checked: true },
        { value: 'error', name: '⚠️  Errors and warnings', checked: true },
        { value: 'progress', name: '📊 Progress updates', checked: false }
      ]
    });
  }

  async confirmBatchUpload(configs: BatchConfig[]): Promise<boolean> {
    const totalSize = configs.reduce((sum, c) => sum + c.size, 0);
    
    this.logger.log(`📦 Found ${configs.length} configurations ready for upload:`);
    configs.forEach(c => {
      this.logger.log(`  • ${c.name} (${c.size} KB)`);
    });
    this.logger.log(`  Total size: ${(totalSize / 1024).toFixed(1)} MB`);
    
    return await confirm({
      message: 'Upload all configurations?',
      default: true
    });
  }

  async selectConfigsForUpload(configs: BatchConfig[]): Promise<string[]> {
    return await checkbox({
      message: 'Select configurations to upload:',
      choices: configs.map(c => ({
        value: c.id,
        name: `${c.name} (${c.size} KB)`,
        checked: true
      }))
    });
  }

  async handleUploadError(error: UploadError): Promise<string> {
    this.logger.error(`❌ Upload failed: ${error.message}`);
    
    return await select({
      message: 'What would you like to do?',
      choices: [
        { value: 'retry', name: '🔄 Retry upload' },
        { value: 'save', name: '💾 Save locally only' },
        { value: 'debug', name: '🐛 Show debug information' },
        { value: 'cancel', name: '❌ Cancel' }
      ],
      default: 'retry'
    });
  }

  async handlePartialSuccess(partial: PartialUploadResult): Promise<string> {
    this.logger.warn('⚠️  Partial upload success:');
    this.logger.log(`  ✅ Successful: ${partial.successful.join(', ')}`);
    this.logger.error(`  ❌ Failed: ${partial.failed.join(', ')}`);
    partial.errors.forEach((e: string) => {
      this.logger.error(`  Error: ${e}`);
    });
    
    return await select({
      message: 'How would you like to proceed?',
      choices: [
        { value: 'continue', name: '➡️  Continue with successful parts' },
        { value: 'fix', name: '🔧 Fix issues and retry' },
        { value: 'cancel', name: '❌ Cancel entire upload' }
      ],
      default: 'continue'
    });
  }

  /**
   * Prompts user to select categories to include in the build
   * Uses multi-select interface with spacebar toggle and 'a' key for toggle all
   * @returns Promise resolving to array of selected categories
   * @throws Error if timeout occurs or no categories selected
   */
  async selectCategories(): Promise<BuildCategory[]> {
    const selectedCategoryNames = await checkbox<BuildCategoryName>({
      message: '📁 Select categories to include in your build:',
      instructions: 'Use spacebar to select, arrow keys to navigate, \'a\' to toggle all, enter to confirm',
      choices: [
        {
          name: 'Personal Context',
          value: BuildCategoryName.PERSONAL_CONTEXT,
          description: 'User preferences, work style, and communication settings'
        },
        {
          name: 'Project Context', 
          value: BuildCategoryName.PROJECT_CONTEXT,
          description: 'Project information, technical stack, and development guidelines'
        },
        {
          name: 'Prompt Templates',
          value: BuildCategoryName.PROMPT_TEMPLATES,
          description: 'Reusable prompt templates for AI interactions'
        }
      ],
      required: true,
      validate: (choices) => {
        if (choices.length === 0) {
          return 'At least one category must be selected.';
        }
        return true;
      }
    });

    return selectedCategoryNames.map(name => ({
      name,
      enabled: true
    }));
  }

}