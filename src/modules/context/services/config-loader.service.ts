import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';

import * as yaml from 'js-yaml';
import { minimatch } from 'minimatch';

export interface AutoUploadConfig {
  enabled: boolean;
  visibility: 'public' | 'private';
  tags: string[];
  exclude: string[];
  privateFields?: string[];
}

export interface AuthConfig {
  supabaseToken: string;
}

export interface PreferencesConfig {
  defaultIde: 'claude-code' | 'kiro-ide' | 'cursor-ide';
  compressionLevel: 'low' | 'medium' | 'high';
}

export interface TaptikConfig {
  autoUpload: AutoUploadConfig;
  auth: AuthConfig;
  preferences: PreferencesConfig;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

@Injectable()
export class ConfigLoaderService {
  private readonly logger = new Logger(ConfigLoaderService.name);
  private readonly CONFIG_DIR = path.join(os.homedir(), '.taptik');
  private readonly CONFIG_FILE = path.join(this.CONFIG_DIR, 'config.yaml');

  private readonly DEFAULT_CONFIG: TaptikConfig = {
    autoUpload: {
      enabled: false,
      visibility: 'private',
      tags: [],
      exclude: [
        '.env*',
        '*.secret',
        '*.key',
        '*.pem',
        '*.p12',
        '*.pfx',
        'node_modules/',
        '.git/',
        'dist/',
        'build/',
        'coverage/',
        '*.log',
      ],
      privateFields: ['apiKeys', 'credentials', 'tokens', 'secrets'],
    },
    auth: {
      supabaseToken: '',
    },
    preferences: {
      defaultIde: 'claude-code',
      compressionLevel: 'medium',
    },
  };

  /**
   * Load configuration from file and environment variables
   */
  async loadConfiguration(): Promise<TaptikConfig> {
    try {
      // Check if config file exists
      await fs.access(this.CONFIG_FILE);

      // Read and parse config file
      const fileContent = await fs.readFile(this.CONFIG_FILE, 'utf-8');
      const fileConfig = yaml.load(fileContent) as Partial<TaptikConfig>;

      // Merge with defaults
      const config = this.mergeConfigurations(this.DEFAULT_CONFIG, fileConfig);

      // Apply environment variable overrides
      this.applyEnvironmentOverrides(config);

      this.logger.log('Configuration loaded successfully');
      return config;
    } catch (_error) {
      this.logger.debug(
        `Configuration file not found at ${this.CONFIG_FILE}, using defaults`,
      );

      // Create config with defaults and env overrides
      const config = JSON.parse(
        JSON.stringify(this.DEFAULT_CONFIG),
      ) as TaptikConfig;
      this.applyEnvironmentOverrides(config);

      return config;
    }
  }

  /**
   * Generate default configuration for first-time users
   */
  async generateDefaultConfiguration(): Promise<TaptikConfig> {
    return JSON.parse(JSON.stringify(this.DEFAULT_CONFIG)) as TaptikConfig;
  }

  /**
   * Save configuration to file
   */
  async saveConfiguration(config: TaptikConfig): Promise<void> {
    try {
      // Ensure config directory exists
      await fs.mkdir(this.CONFIG_DIR, { recursive: true });

      // Convert to YAML
      const yamlContent = yaml.dump(config, {
        indent: 2,
        lineWidth: 120,
        sortKeys: false,
      });

      // Write to file
      await fs.writeFile(this.CONFIG_FILE, yamlContent, 'utf-8');

      this.logger.log(`Configuration saved to ${this.CONFIG_FILE}`);
    } catch (error) {
      this.logger.error('Failed to save configuration', error);
      throw new Error(
        `Failed to save configuration: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Validate authentication configuration
   */
  validateAuthentication(config: TaptikConfig): boolean {
    if (!config.auth.supabaseToken || config.auth.supabaseToken.trim() === '') {
      this.logger.warn(
        'Authentication token not configured. Auto-upload will be disabled.',
      );
      return false;
    }
    return true;
  }

  /**
   * Validate configuration schema
   */
  validateConfiguration(config: unknown): ValidationResult {
    const errors: string[] = [];
    const cfg = config as Record<string, unknown>;

    // Validate autoUpload
    if (cfg.autoUpload) {
      const autoUpload = cfg.autoUpload as Record<string, unknown>;
      if (typeof autoUpload.enabled !== 'boolean') {
        errors.push('autoUpload.enabled must be a boolean');
      }
      if (!['public', 'private'].includes(autoUpload.visibility as string)) {
        errors.push('autoUpload.visibility must be "public" or "private"');
      }
      if (!Array.isArray(autoUpload.tags)) {
        errors.push('autoUpload.tags must be an array');
      }
      if (!Array.isArray(autoUpload.exclude)) {
        errors.push('autoUpload.exclude must be an array');
      }
    }

    // Validate auth
    if (cfg.auth) {
      const auth = cfg.auth as Record<string, unknown>;
      if (typeof auth.supabaseToken !== 'string') {
        errors.push('auth.supabaseToken must be a string');
      }
    }

    // Validate preferences
    if (cfg.preferences) {
      const preferences = cfg.preferences as Record<string, unknown>;
      if (
        !['claude-code', 'kiro-ide', 'cursor-ide'].includes(
          preferences.defaultIde as string,
        )
      ) {
        errors.push('preferences.defaultIde must be a valid IDE');
      }
      if (
        !['low', 'medium', 'high'].includes(
          preferences.compressionLevel as string,
        )
      ) {
        errors.push(
          'preferences.compressionLevel must be "low", "medium", or "high"',
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if a file should be excluded based on patterns
   */
  shouldExclude(filePath: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      // Handle directory patterns
      if (pattern.endsWith('/')) {
        if (filePath.startsWith(pattern) || filePath.includes(`/${pattern}`)) {
          return true;
        }
      }
      // Handle glob patterns
      if (minimatch(filePath, pattern, { matchBase: true, dot: true })) {
        return true;
      }
    }
    return false;
  }

  /**
   * Merge configurations with deep merge
   */
  private mergeConfigurations(
    defaults: TaptikConfig,
    userConfig: Partial<TaptikConfig>,
  ): TaptikConfig {
    const merged: TaptikConfig = JSON.parse(JSON.stringify(defaults));

    if (userConfig.autoUpload) {
      merged.autoUpload = {
        ...merged.autoUpload,
        ...userConfig.autoUpload,
        exclude: userConfig.autoUpload.exclude || merged.autoUpload.exclude,
        tags: userConfig.autoUpload.tags || merged.autoUpload.tags,
        privateFields:
          userConfig.autoUpload.privateFields ||
          merged.autoUpload.privateFields,
      };
    }

    if (userConfig.auth) {
      merged.auth = {
        ...merged.auth,
        ...userConfig.auth,
      };
    }

    if (userConfig.preferences) {
      merged.preferences = {
        ...merged.preferences,
        ...userConfig.preferences,
      };
    }

    return merged;
  }

  /**
   * Apply environment variable overrides
   */
  private applyEnvironmentOverrides(config: TaptikConfig): void {
    // Auto-upload settings
    if (process.env.TAPTIK_AUTO_UPLOAD) {
      config.autoUpload.enabled = process.env.TAPTIK_AUTO_UPLOAD === 'true';
    }

    if (process.env.TAPTIK_VISIBILITY) {
      config.autoUpload.visibility = process.env.TAPTIK_VISIBILITY as
        | 'public'
        | 'private';
    }

    // Authentication
    if (process.env.TAPTIK_SUPABASE_TOKEN) {
      config.auth.supabaseToken = process.env.TAPTIK_SUPABASE_TOKEN;
    }

    // Preferences
    if (process.env.TAPTIK_DEFAULT_IDE) {
      config.preferences.defaultIde = process.env
        .TAPTIK_DEFAULT_IDE as PreferencesConfig['defaultIde'];
    }

    if (process.env.TAPTIK_COMPRESSION_LEVEL) {
      config.preferences.compressionLevel = process.env
        .TAPTIK_COMPRESSION_LEVEL as PreferencesConfig['compressionLevel'];
    }
  }

  /**
   * Create initial configuration file for new users
   */
  async createInitialConfiguration(): Promise<void> {
    try {
      // Check if config already exists
      await fs.access(this.CONFIG_FILE);
      this.logger.debug('Configuration file already exists');
    } catch {
      // Create default config
      const defaultConfig = await this.generateDefaultConfiguration();
      await this.saveConfiguration(defaultConfig);
      this.logger.log('Created initial configuration file');
    }
  }

  /**
   * Update specific configuration values
   */
  async updateConfiguration(
    updates: Partial<TaptikConfig>,
  ): Promise<TaptikConfig> {
    const currentConfig = await this.loadConfiguration();
    const updatedConfig = this.mergeConfigurations(currentConfig, updates);
    await this.saveConfiguration(updatedConfig);
    return updatedConfig;
  }

  /**
   * Get configuration file path
   */
  getConfigPath(): string {
    return this.CONFIG_FILE;
  }

  /**
   * Check if auto-upload is properly configured
   */
  isAutoUploadConfigured(config: TaptikConfig): boolean {
    return config.autoUpload.enabled && this.validateAuthentication(config);
  }
}
