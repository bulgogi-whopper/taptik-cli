import { promises as fs, watch } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { Test, TestingModule } from '@nestjs/testing';

import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

import { ConfigManagerService } from './config-manager.service';

import type { TaptikConfig } from '../../interfaces/config.interface';

vi.mock('node:fs', () => ({
  promises: {
    access: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    copyFile: vi.fn(),
  },
  watch: vi.fn(),
}));
vi.mock('node:os');

describe('ConfigManagerService - Auto-upload Configuration', () => {
  let service: ConfigManagerService;
  let mockLogger: {
    log: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    verbose: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };

  const defaultConfig = {
    cloud: {
      enabled: false,
      auto_upload: false,
      default_visibility: 'private' as const,
      auto_tags: [] as string[],
    },
    upload_filters: {
      exclude_patterns: ['*.key', '*token*', '*secret*', '*password*'],
      include_patterns: [] as string[],
      max_file_size_mb: 50,
    },
    notifications: {
      upload_success: true,
      upload_failed: true,
      download_available: false,
    },
    authentication: {
      provider: null as string | null,
      remember_me: false,
      token_cache: true,
    },
    performance: {
      parallel_uploads: false,
      compression_level: 'balanced' as const,
      chunk_size_kb: 1024,
    },
  };

  beforeEach(async () => {
    mockLogger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      verbose: vi.fn(),
      debug: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ConfigManagerService],
    }).compile();

    service = module.get<ConfigManagerService>(ConfigManagerService);

    // Replace the logger with our mock
    (service as any).logger = mockLogger;

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuration file loading', () => {
    it('should load configuration from ~/.taptik/config.yaml', async () => {
      const mockConfigYaml = `
cloud:
  enabled: true
  auto_upload: true
  default_visibility: public
  auto_tags:
    - auto-backup
    - personal
    - claude-code
upload_filters:
  exclude_patterns:
    - "*.key"
    - "*token*"
    - "*secret*"
    - ".env*"
  max_file_size_mb: 100
notifications:
  upload_success: true
  upload_failed: true
  download_available: true
`;

      vi.mocked(os.homedir).mockReturnValue('/home/user');
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(mockConfigYaml);
      // Mock YAML parsing inline
      const mockParsedConfig = {
        cloud: {
          enabled: true,
          auto_upload: true,
          default_visibility: 'public',
          auto_tags: ['auto-backup', 'personal', 'claude-code'],
        },
        upload_filters: {
          exclude_patterns: ['*.key', '*token*', '*secret*', '.env*'],
          max_file_size_mb: 100,
        },
        notifications: {
          upload_success: true,
          upload_failed: true,
          download_available: true,
        },
      };

      // Simulate parsing YAML to config object
      (service as any).parseYaml = vi.fn().mockReturnValue(mockParsedConfig);

      const config = await service.loadConfiguration();

      expect(config).toBeDefined();
      expect(config.cloud.enabled).toBe(true);
      expect(config.cloud.auto_upload).toBe(true);
      expect(config.cloud.default_visibility).toBe('public');
      expect(config.cloud.auto_tags).toEqual([
        'auto-backup',
        'personal',
        'claude-code',
      ]);
      expect(config.upload_filters.max_file_size_mb).toBe(100);
      expect(fs.readFile).toHaveBeenCalledWith(
        '/home/user/.taptik/config.yaml',
        'utf-8',
      );
    });

    it('should return default config when file does not exist', async () => {
      vi.mocked(os.homedir).mockReturnValue('/home/user');
      const enoentError = new Error('ENOENT: no such file or directory');
      (enoentError as any).code = 'ENOENT';
      vi.mocked(fs.access).mockRejectedValue(enoentError);

      const config = await service.loadConfiguration();

      expect(config).toEqual(defaultConfig);
      expect(mockLogger.verbose).toHaveBeenCalledWith(
        'No configuration file found at ~/.taptik/config.yaml, using defaults',
      );
    });

    it('should handle malformed YAML gracefully', async () => {
      vi.mocked(os.homedir).mockReturnValue('/home/user');
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue('invalid: yaml: content:');
      // Mock YAML parsing error
      (service as any).parseYaml = vi.fn().mockImplementation(() => {
        throw new Error('Invalid YAML');
      });

      const config = await service.loadConfiguration();

      expect(config).toEqual(defaultConfig);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to parse configuration file:',
        expect.any(Error),
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Using default configuration due to parse error',
      );
    });

    it('should load from custom path if provided', async () => {
      const customPath = '/custom/path/config.yaml';
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue('cloud:\n  enabled: true');
      // Mock YAML parsing
      (service as any).parseYaml = vi
        .fn()
        .mockReturnValue({ cloud: { enabled: true } });

      const config = await service.loadConfiguration(customPath);

      expect(fs.readFile).toHaveBeenCalledWith(customPath, 'utf-8');
      expect(config.cloud.enabled).toBe(true);
    });

    it('should handle environment variable override', async () => {
      process.env.TAPTIK_CONFIG = '/env/config.yaml';
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue('cloud:\n  enabled: true');
      // Mock YAML parsing
      (service as any).parseYaml = vi
        .fn()
        .mockReturnValue({ cloud: { enabled: true } });

      const config = await service.loadConfiguration();

      expect(config.cloud.enabled).toBe(true);
      expect(fs.readFile).toHaveBeenCalledWith('/env/config.yaml', 'utf-8');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Loading configuration from environment variable: /env/config.yaml',
      );

      delete process.env.TAPTIK_CONFIG;
    });
  });

  describe('Configuration validation', () => {
    it('should validate a correct configuration', () => {
      const config = {
        cloud: {
          enabled: true,
          auto_upload: true,
          default_visibility: 'public' as const,
          auto_tags: ['test', 'claude'],
        },
        upload_filters: {
          exclude_patterns: ['*.key'],
          max_file_size_mb: 75,
        },
      };

      const fullConfig = service.mergeWithDefaults(config);
      const validation = service.validateConfiguration(fullConfig);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings).toHaveLength(0);
    });

    it('should detect invalid visibility value', () => {
      const fullConfig = service.generateDefaultConfig();
      fullConfig.cloud.default_visibility = 'hidden' as any; // Invalid value

      const validation = service.validateConfiguration(fullConfig);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'cloud.default_visibility must be "public", "private", or "ask"',
      );
    });

    it('should detect invalid data types', () => {
      const fullConfig = service.generateDefaultConfig();
      fullConfig.cloud.enabled = 'yes' as any; // Should be boolean
      fullConfig.cloud.auto_upload = 1 as any; // Should be boolean
      fullConfig.cloud.auto_tags = 'tag1,tag2' as any; // Should be array

      const validation = service.validateConfiguration(fullConfig);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('cloud.enabled must be a boolean');
      expect(validation.errors).toContain(
        'cloud.auto_upload must be a boolean',
      );
      expect(validation.errors).toContain(
        'cloud.auto_tags must be an array of strings',
      );
    });

    it('should warn about large file size limits', () => {
      const config: Partial<TaptikConfig> = {
        upload_filters: {
          exclude_patterns: [],
          include_patterns: [],
          max_file_size_mb: 500, // Large size
        },
      };

      const fullConfig = service.mergeWithDefaults(config);
      const validation = service.validateConfiguration(fullConfig);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toContain(
        'max_file_size_mb is set to 500 MB, which may result in slow uploads',
      );
    });

    it('should warn about missing security patterns', () => {
      const config: Partial<TaptikConfig> = {
        upload_filters: {
          exclude_patterns: [], // Empty patterns
          include_patterns: [],
          max_file_size_mb: 50,
        },
      };

      const fullConfig = service.mergeWithDefaults(config);
      const validation = service.validateConfiguration(fullConfig);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toContain(
        'No exclude patterns defined - sensitive data might be uploaded',
      );
    });

    it('should validate authentication settings', () => {
      const fullConfig = service.generateDefaultConfig();
      fullConfig.authentication.provider = 'invalid_provider' as any;
      fullConfig.authentication.remember_me = 'yes' as any; // Should be boolean

      const validation = service.validateConfiguration(fullConfig);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'authentication.provider must be "github", "google", "email", or null',
      );
      expect(validation.errors).toContain(
        'authentication.remember_me must be a boolean',
      );
    });

    it('should validate performance settings', () => {
      const fullConfig = service.generateDefaultConfig();
      fullConfig.performance.compression_level = 'ultra' as any; // Invalid level
      fullConfig.performance.chunk_size_kb = -100; // Invalid size

      const validation = service.validateConfiguration(fullConfig);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'performance.compression_level must be "none", "fast", "balanced", or "maximum"',
      );
      expect(validation.errors).toContain(
        'performance.chunk_size_kb must be between 64 and 10240',
      );
    });
  });

  describe('Configuration saving', () => {
    it('should save configuration to default location', async () => {
      const config = service.generateDefaultConfig();
      config.cloud.enabled = true;
      config.cloud.auto_upload = true;
      config.cloud.auto_tags = ['auto-backup'];

      vi.mocked(os.homedir).mockReturnValue('/home/user');
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      // Mock YAML dumping
      (service as any).dumpYaml = vi
        .fn()
        .mockReturnValue('cloud:\n  enabled: true\n');
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await service.saveConfiguration(config);

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join('/home/user', '.taptik'),
        { recursive: true },
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('/home/user', '.taptik', 'config.yaml'),
        expect.stringContaining('cloud:'),
        'utf-8',
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        '✅ Configuration saved to ~/.taptik/config.yaml',
      );
    });

    it('should create backup before overwriting', async () => {
      vi.mocked(os.homedir).mockReturnValue('/home/user');
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.copyFile).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      // Mock YAML dumping
      (service as any).dumpYaml = vi
        .fn()
        .mockReturnValue('cloud:\n  enabled: true\n');
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const config = service.generateDefaultConfig();
      config.cloud.enabled = true;
      await service.saveConfiguration(config, { backup: true });

      expect(fs.copyFile).toHaveBeenCalledWith(
        path.join('/home/user', '.taptik', 'config.yaml'),
        expect.stringMatching(/config\.yaml\.\d+\.backup$/),
      );
      expect(mockLogger.verbose).toHaveBeenCalledWith(
        expect.stringContaining('Backup created:'),
      );
    });

    it('should handle save errors gracefully', async () => {
      vi.mocked(os.homedir).mockReturnValue('/home/user');
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      // Mock YAML dumping
      (service as any).dumpYaml = vi
        .fn()
        .mockReturnValue('cloud:\n  enabled: true\n');
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Permission denied'));

      const config = service.generateDefaultConfig();
      config.cloud.enabled = true;

      await expect(service.saveConfiguration(config)).rejects.toThrow(
        'Permission denied',
      );
      // The service doesn't log errors, it just throws them
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should validate before saving', async () => {
      const invalidConfig = service.generateDefaultConfig();
      (invalidConfig.cloud as any).enabled = 'yes'; // Invalid type

      await expect(service.saveConfiguration(invalidConfig)).rejects.toThrow(
        'Invalid configuration: cloud.enabled must be a boolean',
      );
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('Configuration merging', () => {
    it('should merge user config with defaults', () => {
      const userConfig: Partial<TaptikConfig> = {
        cloud: {
          enabled: true,
          auto_upload: true,
          default_visibility: 'private',
          auto_tags: [],
        },
      };

      const merged = service.mergeWithDefaults(userConfig);

      expect(merged.cloud.enabled).toBe(true);
      expect(merged.cloud.auto_upload).toBe(true);
      expect(merged.cloud.default_visibility).toBe('private'); // From default
      expect(merged.cloud.auto_tags).toEqual([]); // From default
      expect(merged.upload_filters.exclude_patterns).toEqual([
        '*.key',
        '*token*',
        '*secret*',
        '*password*',
      ]); // From default
    });

    it('should deep merge nested objects', () => {
      const userConfig: Partial<TaptikConfig> = {
        notifications: {
          upload_success: false,
          upload_failed: true,
          download_available: false,
        },
      };

      const merged = service.mergeWithDefaults(userConfig);

      expect(merged.notifications.upload_success).toBe(false); // User override
      expect(merged.notifications.upload_failed).toBe(true); // From default
      expect(merged.notifications.download_available).toBe(false); // From default
    });

    it('should handle array merging correctly', () => {
      const userConfig: Partial<TaptikConfig> = {
        cloud: {
          enabled: false,
          auto_upload: false,
          default_visibility: 'private',
          auto_tags: ['custom-tag'],
        },
        upload_filters: {
          exclude_patterns: ['*.env', '*.secret'],
          include_patterns: [],
          max_file_size_mb: 50,
        },
      };

      const merged = service.mergeWithDefaults(userConfig);

      expect(merged.cloud.auto_tags).toEqual(['custom-tag']); // User array replaces default
      expect(merged.upload_filters.exclude_patterns).toEqual([
        '*.env',
        '*.secret',
      ]); // User array replaces default
    });

    it('should preserve unknown fields from user config', () => {
      const userConfig: Partial<TaptikConfig> = {
        cloud: {
          enabled: true,
          auto_upload: false,
          default_visibility: 'private',
          auto_tags: [],
        },
      };
      // Add custom fields outside of type system
      (userConfig as any).cloud.custom_field = 'custom_value';
      (userConfig as any).experimental = { feature_x: true };

      const merged = service.mergeWithDefaults(userConfig);

      expect((merged as any).cloud.custom_field).toBe('custom_value');
      expect((merged as any).experimental).toEqual({ feature_x: true });
    });
  });

  describe('Configuration migration', () => {
    it('should migrate old configuration format', () => {
      const oldConfig = {
        autoUpload: true, // Old field name
        visibility: 'public', // Old field name
        excludePatterns: ['*.key'], // Old field name
      };

      const migrated = service.migrateConfiguration(oldConfig);

      expect(migrated.cloud.auto_upload).toBe(true);
      expect(migrated.cloud.default_visibility).toBe('public');
      expect(migrated.upload_filters.exclude_patterns).toEqual(['*.key']);
      expect(mockLogger.log).toHaveBeenCalledWith(
        '🔄 Migrated configuration from old format',
      );
    });

    it('should not migrate already migrated config', () => {
      const newConfig = {
        cloud: {
          enabled: true,
        },
      };

      const result = service.migrateConfiguration(newConfig);

      expect(result).toEqual(newConfig);
      expect(mockLogger.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Migrated'),
      );
    });

    it('should handle partial migration', () => {
      const mixedConfig = {
        cloud: {
          enabled: true,
        },
        autoUpload: true, // Old field alongside new structure
      };

      const migrated = service.migrateConfiguration(mixedConfig);

      // When cloud property exists, migration is skipped (already migrated)
      expect(migrated).toEqual(mixedConfig);
      expect(migrated.cloud.enabled).toBe(true);
      // auto_upload is not migrated because cloud property already exists
      expect(migrated.autoUpload).toBe(true);
    });
  });

  describe('Configuration watching', () => {
    it('should watch for configuration changes', async () => {
      const onChange = vi.fn();
      vi.mocked(os.homedir).mockReturnValue('/home/user');

      const mockWatcher = {
        on: vi.fn(),
        close: vi.fn(),
      };
      vi.mocked(watch).mockReturnValue(mockWatcher as any);

      await service.watchConfiguration(onChange);

      expect(watch).toHaveBeenCalledWith(
        path.join('/home/user', '.taptik', 'config.yaml'),
        expect.any(Object),
      );
      expect(mockWatcher.on).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
    });

    it('should reload and notify on file change', async () => {
      const onChange = vi.fn();
      vi.mocked(os.homedir).mockReturnValue('/home/user');

      let changeHandler:
        | ((event: string, filename: string) => void)
        | undefined;
      const mockWatcher = {
        on: vi.fn((event, handler) => {
          if (event === 'change') changeHandler = handler;
        }),
        close: vi.fn(),
      };
      vi.mocked(watch).mockReturnValue(mockWatcher as any);
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue('cloud:\n  enabled: true');
      // Mock YAML parsing
      (service as any).parseYaml = vi
        .fn()
        .mockReturnValue({ cloud: { enabled: true } });

      await service.watchConfiguration(onChange);

      // Simulate file change
      await changeHandler!('change', 'config.yaml');

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          cloud: expect.objectContaining({ enabled: true }),
        }),
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Configuration file changed, reloading...',
      );
    });

    it('should handle watch errors', async () => {
      const onChange = vi.fn();
      vi.mocked(os.homedir).mockReturnValue('/home/user');

      const mockWatcher = {
        on: vi.fn((event, handler) => {
          if (event === 'error') handler(new Error('Watch failed'));
        }),
        close: vi.fn(),
      };
      vi.mocked(watch).mockReturnValue(mockWatcher as any);

      await service.watchConfiguration(onChange);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error watching configuration file:',
        expect.any(Error),
      );
    });
  });

  describe('Configuration export/import', () => {
    it('should export configuration to JSON', () => {
      const config = service.generateDefaultConfig();
      config.cloud.enabled = true;

      const exported = service.exportConfiguration(config, 'json');

      expect(exported).toBe(JSON.stringify(config, null, 2));
    });

    it('should export configuration to YAML', () => {
      const config = service.generateDefaultConfig();
      config.cloud.enabled = true;

      // Mock YAML dumping
      (service as any).dumpYaml = vi
        .fn()
        .mockReturnValue('cloud:\n  enabled: true\n');

      const exported = service.exportConfiguration(config, 'yaml');

      expect(exported).toBe('cloud:\n  enabled: true\n');
      expect((service as any).dumpYaml).toHaveBeenCalledWith(config);
    });

    it('should import configuration from JSON', () => {
      const jsonConfig = '{"cloud":{"enabled":true}}';

      const imported = service.importConfiguration(jsonConfig, 'json');

      expect(imported).toEqual({ cloud: { enabled: true } });
    });

    it('should import configuration from YAML', () => {
      const yamlConfig = 'cloud:\n  enabled: true';
      // Mock YAML parsing
      (service as any).parseYaml = vi
        .fn()
        .mockReturnValue({ cloud: { enabled: true } });

      const imported = service.importConfiguration(yamlConfig, 'yaml');

      expect(imported).toEqual({ cloud: { enabled: true } });
    });

    it('should validate imported configuration', () => {
      const invalidJson = '{"cloud":{"enabled":"yes"}}';

      expect(() => service.importConfiguration(invalidJson, 'json')).toThrow(
        'Invalid configuration: cloud.enabled must be a boolean',
      );
    });
  });

  describe('Environment-specific configuration', () => {
    it('should load environment-specific config', async () => {
      process.env.NODE_ENV = 'production';
      vi.mocked(os.homedir).mockReturnValue('/home/user');
      vi.mocked(fs.access)
        .mockResolvedValueOnce(undefined) // config.yaml exists
        .mockResolvedValueOnce(undefined); // config.production.yaml exists

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('cloud:\n  enabled: false')
        .mockResolvedValueOnce('cloud:\n  enabled: true\n  auto_upload: true');

      // Mock YAML parsing
      (service as any).parseYaml = vi
        .fn()
        .mockReturnValueOnce({ cloud: { enabled: false } })
        .mockReturnValueOnce({ cloud: { enabled: true, auto_upload: true } });

      const config = await service.loadConfiguration();

      expect(config.cloud.enabled).toBe(true); // From production config
      expect(config.cloud.auto_upload).toBe(true); // From production config
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Loading environment-specific configuration: config.production.yaml',
      );

      process.env.NODE_ENV = 'test';
    });

    it('should fall back to base config if env-specific not found', async () => {
      process.env.NODE_ENV = 'staging';
      vi.mocked(os.homedir).mockReturnValue('/home/user');
      vi.mocked(fs.access)
        .mockResolvedValueOnce(undefined) // config.yaml exists
        .mockRejectedValueOnce(new Error('File not found')); // config.staging.yaml doesn't exist

      vi.mocked(fs.readFile).mockResolvedValueOnce('cloud:\n  enabled: true');
      // Mock YAML parsing
      (service as any).parseYaml = vi
        .fn()
        .mockReturnValueOnce({ cloud: { enabled: true } });

      const config = await service.loadConfiguration();

      expect(config.cloud.enabled).toBe(true);
      expect(mockLogger.verbose).toHaveBeenCalledWith(
        'No environment-specific configuration found for: staging',
      );

      process.env.NODE_ENV = 'test';
    });
  });
});
