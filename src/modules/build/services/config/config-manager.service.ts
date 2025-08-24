import { promises as fs, FSWatcher, watch } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import type {
  TaptikConfig,
  ConfigValidationResult,
  SaveConfigOptions,
} from '../../interfaces/config.interface';

/**
 * Service responsible for managing auto-upload configuration
 * Handles loading, saving, and validating configuration from ~/.taptik/config.yaml
 */
@Injectable()
export class ConfigManagerService {
  private readonly logger = new Logger(ConfigManagerService.name);
  private fileWatcher: FSWatcher | null = null;

  // GREEN phase implementation
  async loadConfiguration(customPath?: string): Promise<TaptikConfig> {
    const configPath = customPath || this.getConfigPath();

    // Check for environment variable override
    if (!customPath && process.env.TAPTIK_CONFIG) {
      this.logger.debug(
        `Loading configuration from environment variable: ${process.env.TAPTIK_CONFIG}`,
      );
      return this.loadConfiguration(process.env.TAPTIK_CONFIG);
    }

    try {
      await fs.access(configPath);
      const content = await fs.readFile(configPath, 'utf-8');
      const config = this.parseYaml(content);

      // Check for environment-specific config
      if (!customPath && process.env.NODE_ENV) {
        const envConfigPath = configPath.replace(
          '.yaml',
          `.${process.env.NODE_ENV}.yaml`,
        );
        try {
          await fs.access(envConfigPath);
          const envContent = await fs.readFile(envConfigPath, 'utf-8');
          const envConfig = this.parseYaml(envContent);
          this.logger.debug(
            `Loading environment-specific configuration: config.${process.env.NODE_ENV}.yaml`,
          );
          return this.mergeWithDefaults({ ...config, ...envConfig });
        } catch {
          this.logger.verbose(
            `No environment-specific configuration found for: ${process.env.NODE_ENV}`,
          );
        }
      }

      return this.mergeWithDefaults(config);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (customPath || err.code !== 'ENOENT') {
        this.logger.error('Failed to parse configuration file:', error);
        this.logger.warn('Using default configuration due to parse error');
      } else {
        this.logger.verbose(
          'No configuration file found at ~/.taptik/config.yaml, using defaults',
        );
      }
      return this.generateDefaultConfig();
    }
  }

  validateConfiguration(config: TaptikConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate cloud settings
    if (config.cloud) {
      if (
        config.cloud.enabled !== undefined &&
        typeof config.cloud.enabled !== 'boolean'
      ) {
        errors.push('cloud.enabled must be a boolean');
      }
      if (
        config.cloud.auto_upload !== undefined &&
        typeof config.cloud.auto_upload !== 'boolean'
      ) {
        errors.push('cloud.auto_upload must be a boolean');
      }
      if (
        config.cloud.default_visibility &&
        !['public', 'private', 'ask'].includes(config.cloud.default_visibility)
      ) {
        errors.push(
          'cloud.default_visibility must be "public", "private", or "ask"',
        );
      }
      if (config.cloud.auto_tags && !Array.isArray(config.cloud.auto_tags)) {
        errors.push('cloud.auto_tags must be an array of strings');
      }
    }

    // Validate upload filters
    if (config.upload_filters) {
      if (
        config.upload_filters.exclude_patterns &&
        (!Array.isArray(config.upload_filters.exclude_patterns) ||
          config.upload_filters.exclude_patterns.length === 0)
      ) {
        warnings.push(
          'No exclude patterns defined - sensitive data might be uploaded',
        );
      }
      if (
        config.upload_filters.max_file_size_mb &&
        config.upload_filters.max_file_size_mb > 200
      ) {
        warnings.push(
          `max_file_size_mb is set to ${config.upload_filters.max_file_size_mb} MB, which may result in slow uploads`,
        );
      }
    }

    // Validate authentication settings
    if (config.authentication) {
      if (
        config.authentication.provider &&
        !['github', 'google', 'email', null].includes(
          config.authentication.provider,
        )
      ) {
        errors.push(
          'authentication.provider must be "github", "google", "email", or null',
        );
      }
      if (
        config.authentication.remember_me !== undefined &&
        typeof config.authentication.remember_me !== 'boolean'
      ) {
        errors.push('authentication.remember_me must be a boolean');
      }
    }

    // Validate performance settings
    if (config.performance) {
      if (
        config.performance.compression_level &&
        !['none', 'fast', 'balanced', 'maximum'].includes(
          config.performance.compression_level,
        )
      ) {
        errors.push(
          'performance.compression_level must be "none", "fast", "balanced", or "maximum"',
        );
      }
      if (config.performance.chunk_size_kb !== undefined) {
        const size = config.performance.chunk_size_kb;
        if (size < 64 || size > 10240) {
          errors.push('performance.chunk_size_kb must be between 64 and 10240');
        }
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  async saveConfiguration(
    config: TaptikConfig,
    options?: SaveConfigOptions,
  ): Promise<void> {
    // Validate before saving
    const validation = this.validateConfiguration(config);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors[0]}`);
    }

    const configPath = this.getConfigPath();
    const configDir = path.dirname(configPath);

    // Create backup if requested
    if (options?.backup) {
      try {
        await fs.access(configPath);
        const backupPath = `${configPath}.${Date.now()}.backup`;
        await fs.copyFile(configPath, backupPath);
        this.logger.verbose(`Backup created: ${backupPath}`);
      } catch {
        // No existing file to backup
      }
    }

    await fs.mkdir(configDir, { recursive: true });
    const yamlContent = this.dumpYaml(config);
    await fs.writeFile(configPath, yamlContent, 'utf-8');
    this.logger.log('✅ Configuration saved to ~/.taptik/config.yaml');
  }

  mergeWithDefaults(userConfig: Partial<TaptikConfig>): TaptikConfig {
    const defaults = this.generateDefaultConfig();

    return {
      cloud: {
        ...defaults.cloud,
        ...(userConfig.cloud || {}),
      },
      upload_filters: {
        ...defaults.upload_filters,
        ...(userConfig.upload_filters || {}),
      },
      notifications: {
        ...defaults.notifications,
        ...(userConfig.notifications || {}),
      },
      authentication: {
        ...defaults.authentication,
        ...(userConfig.authentication || {}),
      },
      performance: {
        ...defaults.performance,
        ...(userConfig.performance || {}),
      },
      // Preserve any custom fields
      ...Object.keys(userConfig).reduce(
        (acc, key) => {
          if (
            ![
              'cloud',
              'upload_filters',
              'notifications',
              'authentication',
              'performance',
            ].includes(key)
          ) {
            acc[key] = userConfig[key];
          }
          return acc;
        },
        {} as Record<string, unknown>,
      ),
    };
  }

  migrateConfiguration(oldConfig: Record<string, unknown>): TaptikConfig {
    // Check if already migrated
    if (oldConfig.cloud) {
      return oldConfig as TaptikConfig;
    }

    // Migrate old format to new format
    const migrated = this.generateDefaultConfig();

    if (oldConfig.autoUpload !== undefined) {
      migrated.cloud.auto_upload = oldConfig.autoUpload as boolean;
    }
    if (oldConfig.visibility !== undefined) {
      migrated.cloud.default_visibility = oldConfig.visibility as
        | 'public'
        | 'private'
        | 'ask';
    }
    if (oldConfig.excludePatterns !== undefined) {
      migrated.upload_filters.exclude_patterns =
        oldConfig.excludePatterns as string[];
    }

    this.logger.log('🔄 Migrated configuration from old format');
    return migrated;
  }

  async watchConfiguration(
    onChange: (config: TaptikConfig) => void,
  ): Promise<FSWatcher> {
    const configPath = this.getConfigPath();

    // Implement file watching using fs.watch
    this.fileWatcher = watch(configPath, { persistent: false });

    this.fileWatcher.on(
      'change',
      async (eventType: string, _filename: string) => {
        if (eventType === 'change') {
          this.logger.debug('Configuration file changed, reloading...');
          try {
            const config = await this.loadConfiguration();
            onChange(config);
          } catch (error) {
            this.logger.error('Error reloading configuration:', error);
          }
        }
      },
    );

    this.fileWatcher.on('error', (error: Error) => {
      this.logger.error('Error watching configuration file:', error);
    });

    return this.fileWatcher;
  }

  exportConfiguration(config: TaptikConfig, format: 'json' | 'yaml'): string {
    if (format === 'json') {
      return JSON.stringify(config, null, 2);
    }
    return this.dumpYaml(config);
  }

  importConfiguration(data: string, format: 'json' | 'yaml'): TaptikConfig {
    let config: TaptikConfig;

    if (format === 'json') {
      config = JSON.parse(data);
    } else {
      config = this.parseYaml(data);
    }

    // Validate imported configuration
    const validation = this.validateConfiguration(config);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors[0]}`);
    }

    return config;
  }

  generateDefaultConfig(): TaptikConfig {
    return {
      cloud: {
        enabled: false,
        auto_upload: false,
        default_visibility: 'private',
        auto_tags: [],
      },
      upload_filters: {
        exclude_patterns: ['*.key', '*token*', '*secret*', '*password*'],
        include_patterns: [],
        max_file_size_mb: 50,
      },
      notifications: {
        upload_success: true,
        upload_failed: true,
        download_available: false,
      },
      authentication: {
        provider: null,
        remember_me: false,
        token_cache: true,
      },
      performance: {
        parallel_uploads: false,
        compression_level: 'balanced',
        chunk_size_kb: 1024,
      },
    };
  }

  // Helper methods
  private getConfigPath(): string {
    return path.join(os.homedir(), '.taptik', 'config.yaml');
  }

  private parseYaml(content: string): TaptikConfig {
    // Enhanced YAML parsing with better array and nested structure support
    const lines = content.split('\n');
    const result: Record<string, unknown> = {};
    const stack: Record<string, unknown>[] = [result];
    const keyStack: string[] = [];
    let _inArray = false;

    for (const line of lines) {
      const indent = line.search(/\S/);
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Handle list items
      if (trimmed.startsWith('- ')) {
        const value = trimmed.substring(2).replace(/["']/g, '');
        const current = stack[stack.length - 1];
        const lastKey = keyStack[keyStack.length - 1];

        if (!Array.isArray(current[lastKey])) {
          current[lastKey] = [];
        }

        // Parse value as boolean or number if applicable
        const parsedValue = this.parseValue(value);
        (current[lastKey] as unknown[]).push(parsedValue);
        _inArray = true;
        continue;
      }

      // Handle key-value pairs
      if (trimmed.includes(':')) {
        const colonIndex = trimmed.indexOf(':');
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();

        // Adjust stack based on indentation
        const level = Math.floor(indent / 2);

        // Reset array flag when moving to different indentation
        if (level < stack.length - 1) {
          _inArray = false;
        }

        while (stack.length > level + 1) {
          stack.pop();
          keyStack.pop();
        }

        const current = stack[stack.length - 1];

        if (value) {
          // Parse and assign value
          current[key] = this.parseValue(value);
        } else {
          // New nested object or array placeholder
          current[key] = {};
          stack.push(current[key] as Record<string, unknown>);
          keyStack.push(key);
        }
      }
    }

    return result as TaptikConfig;
  }

  private parseValue(value: string): string | number | boolean | null {
    // Remove quotes
    const cleanValue = value.replace(/^["']|["']$/g, '');

    // Boolean values
    if (cleanValue === 'true') return true;
    if (cleanValue === 'false') return false;
    if (cleanValue === 'null' || cleanValue === '~') return null;

    // Number values
    const numValue = Number(cleanValue);
    if (!isNaN(numValue) && cleanValue === numValue.toString()) {
      return numValue;
    }

    // String value
    return cleanValue;
  }

  private dumpYaml(obj: TaptikConfig): string {
    // Simple YAML generation
    let yaml = '';

    const writeObject = (o: Record<string, unknown>, indent = '') => {
      for (const [key, value] of Object.entries(o)) {
        if (value === null || value === undefined) {
          yaml += `${indent}${key}: null\n`;
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          yaml += `${indent}${key}:\n`;
          writeObject(value as Record<string, unknown>, `${indent}  `);
        } else if (Array.isArray(value)) {
          yaml += `${indent}${key}:\n`;
          value.forEach((item) => {
            yaml += `${indent}  - ${item}\n`;
          });
        } else {
          yaml += `${indent}${key}: ${value}\n`;
        }
      }
    };

    writeObject(obj as unknown as Record<string, unknown>);
    return yaml;
  }
}
