import { Injectable, Logger } from '@nestjs/common';

import prompts from 'prompts';

import { ConfigLoaderService, TaptikConfig } from './config-loader.service';

export interface UploadConfirmationOptions {
  fileName: string;
  fileSize: number;
  visibility: 'public' | 'private';
  skipIfAutoEnabled?: boolean;
}

export interface PrivacySettings {
  visibility: 'public' | 'private';
  exclude: string[];
  shareAnonymously: boolean;
}

export interface UploadMetadata {
  title: string;
  description: string;
  tags: string[];
  componentCount: {
    agents: number;
    commands: number;
    mcpServers: number;
    steeringRules: number;
    instructions: number;
  };
}

@Injectable()
export class ConfigPromptService {
  private readonly logger = new Logger(ConfigPromptService.name);

  constructor(private readonly configLoader: ConfigLoaderService) {}

  /**
   * Prompt user for upload confirmation
   */
  async promptUploadConfirmation(options: UploadConfirmationOptions): Promise<boolean> {
    // Check if auto-upload is enabled and should skip
    if (options.skipIfAutoEnabled) {
      const config = await this.configLoader.loadConfiguration();
      if (this.configLoader.isAutoUploadConfigured(config)) {
        this.logger.log('Auto-upload enabled, skipping confirmation');
        return true;
      }
    }

    const formattedSize = this.formatFileSize(options.fileSize);
    const visibilityWarning = options.visibility === 'public' 
      ? '\n⚠️  This will be publicly visible to all users' 
      : '';

    const response = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `Upload ${options.fileName} (${formattedSize}) to Supabase?${visibilityWarning}`,
      initial: true,
    });

    return response.confirm;
  }

  /**
   * Prompt for initial configuration setup
   */
  async promptConfigurationSetup(): Promise<TaptikConfig> {
    const setupResponse = await prompts({
      type: 'confirm',
      name: 'setupNow',
      message: 'Would you like to configure auto-upload settings now?',
      initial: true,
    });

    if (!setupResponse.setupNow) {
      return await this.configLoader.generateDefaultConfiguration();
    }

    const configResponses = await prompts([
      {
        type: 'confirm',
        name: 'enabled',
        message: 'Enable auto-upload for future builds?',
        initial: false,
      },
      {
        type: 'select',
        name: 'visibility',
        message: 'Default visibility for uploaded configurations:',
        choices: [
          { title: 'Private (only you can see)', value: 'private' },
          { title: 'Public (share with community)', value: 'public' },
        ],
        initial: 0,
      },
      {
        type: 'text',
        name: 'tags',
        message: 'Default tags (comma-separated):',
        initial: '',
        hint: 'e.g., claude-code, typescript, react',
      },
      {
        type: 'password',
        name: 'supabaseToken',
        message: 'Supabase authentication token:',
        hint: 'Get from your Supabase dashboard',
      },
    ]);

    const config = await this.configLoader.generateDefaultConfiguration();
    
    // Update with user responses
    config.autoUpload.enabled = configResponses.enabled && !!configResponses.supabaseToken;
    config.autoUpload.visibility = configResponses.visibility;
    config.autoUpload.tags = this.parseTags(configResponses.tags);
    config.auth.supabaseToken = configResponses.supabaseToken;

    // Validate and warn if token is missing
    if (configResponses.enabled && !configResponses.supabaseToken) {
      this.logger.warn('Auto-upload disabled: Authentication token required');
      config.autoUpload.enabled = false;
    }

    return config;
  }

  /**
   * Prompt for privacy settings
   */
  async promptPrivacySettings(): Promise<PrivacySettings> {
    const responses = await prompts([
      {
        type: 'select',
        name: 'visibility',
        message: 'Configuration visibility:',
        choices: [
          { title: 'Private', value: 'private' },
          { title: 'Public', value: 'public' },
        ],
        initial: 0,
      },
      {
        type: 'text',
        name: 'excludePatterns',
        message: 'Files to exclude (comma-separated patterns):',
        initial: '.env*, *.secret',
        hint: 'Use glob patterns like *.secret, .env*, private/',
      },
      {
        type: 'confirm',
        name: 'shareAnonymously',
        message: 'Share usage statistics anonymously?',
        initial: false,
      },
    ]);

    return {
      visibility: responses.visibility,
      exclude: this.parseExcludePatterns(responses.excludePatterns),
      shareAnonymously: responses.shareAnonymously,
    };
  }

  /**
   * Prompt to update existing configuration
   */
  async promptConfigurationUpdate(): Promise<void> {
    const updateResponse = await prompts({
      type: 'select',
      name: 'updateChoice',
      message: 'What would you like to update?',
      choices: [
        { title: 'Toggle auto-upload', value: 'toggle' },
        { title: 'Change visibility', value: 'visibility' },
        { title: 'Update tags', value: 'tags' },
        { title: 'Update token', value: 'token' },
        { title: 'Update exclusions', value: 'exclusions' },
        { title: 'Cancel', value: 'cancel' },
      ],
    });

    if (updateResponse.updateChoice === 'cancel') {
      return;
    }

    let updates: Partial<TaptikConfig> = {};

    switch (updateResponse.updateChoice) {
      case 'toggle': {
        const { enabled } = await prompts({
          type: 'confirm',
          name: 'enabled',
          message: 'Enable auto-upload?',
          initial: false,
        });
        updates = { autoUpload: { enabled } } as Partial<TaptikConfig>;
        break;
      }
      
      case 'visibility': {
        const { newValue } = await prompts({
          type: 'select',
          name: 'newValue',
          message: 'New visibility setting:',
          choices: [
            { title: 'Private', value: 'private' },
            { title: 'Public', value: 'public' },
          ],
        });
        updates = { autoUpload: { visibility: newValue } } as Partial<TaptikConfig>;
        break;
      }
      
      case 'tags': {
        const { newValue } = await prompts({
          type: 'text',
          name: 'newValue',
          message: 'New tags (comma-separated):',
        });
        updates = { autoUpload: { tags: this.parseTags(newValue) } } as Partial<TaptikConfig>;
        break;
      }
      
      case 'token': {
        const { newValue } = await prompts({
          type: 'password',
          name: 'newValue',
          message: 'New Supabase token:',
        });
        updates = { auth: { supabaseToken: newValue } };
        this.logger.log('Authentication token updated successfully');
        break;
      }
      
      case 'exclusions': {
        const { newValue } = await prompts({
          type: 'text',
          name: 'newValue',
          message: 'Exclusion patterns (comma-separated):',
          initial: '.env*, *.secret',
        });
        updates = { autoUpload: { exclude: this.parseExcludePatterns(newValue) } } as Partial<TaptikConfig>;
        break;
      }
    }

    await this.configLoader.updateConfiguration(updates);
    this.logger.log('Configuration updated successfully');
  }

  /**
   * Show upload summary and confirm
   */
  async promptUploadWithSummary(metadata: UploadMetadata): Promise<boolean> {
    const componentSummary = this.formatComponentSummary(metadata.componentCount);
    
    const response = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `
📦 Upload Summary:
  Title: ${metadata.title}
  Description: ${metadata.description}
  Tags: ${metadata.tags.join(', ')}
  
  Components:
${componentSummary}

Proceed with upload?`,
      initial: true,
    });

    return response.confirm;
  }

  /**
   * Format file size to human-readable format
   */
  private formatFileSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Parse comma-separated tags
   */
  private parseTags(input: string): string[] {
    if (!input) return [];
    return input.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
  }

  /**
   * Parse exclude patterns
   */
  private parseExcludePatterns(input: string): string[] {
    if (!input) return [];
    return input.split(',').map(pattern => pattern.trim()).filter(pattern => pattern.length > 0);
  }

  /**
   * Format component summary for display
   */
  private formatComponentSummary(componentCount: UploadMetadata['componentCount']): string {
    const components: string[] = [];
    
    if (componentCount.agents > 0) {
      components.push(`    • ${componentCount.agents} agents`);
    }
    if (componentCount.commands > 0) {
      components.push(`    • ${componentCount.commands} commands`);
    }
    if (componentCount.mcpServers > 0) {
      components.push(`    • ${componentCount.mcpServers} MCP servers`);
    }
    if (componentCount.steeringRules > 0) {
      components.push(`    • ${componentCount.steeringRules} steering rules`);
    }
    if (componentCount.instructions > 0) {
      components.push(`    • ${componentCount.instructions} instructions`);
    }
    
    return components.join('\n');
  }
}