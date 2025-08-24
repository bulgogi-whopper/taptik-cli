import { promises as fs } from 'fs';
import * as path from 'path';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { ConfigLoaderService } from './config-loader.service';


vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
  },
}));

vi.mock('os', () => ({
  default: {
    homedir: vi.fn(() => '/home/user'),
  },
  homedir: vi.fn(() => '/home/user'),
}));

describe('ConfigLoaderService', () => {
  let service: ConfigLoaderService;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConfigLoaderService],
    }).compile();

    service = module.get<ConfigLoaderService>(ConfigLoaderService);
    ({ logger } = service as any);
    vi.spyOn(logger, 'log').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    vi.spyOn(logger, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Auto-upload Configuration', () => {
    it('should load configuration from ~/.taptik/config.yaml', async () => {
      const mockConfig = `
autoUpload:
  enabled: true
  visibility: private
  tags:
    - claude-code
    - development
  exclude:
    - "*.secret"
    - ".env*"
auth:
  supabaseToken: "test-token"
preferences:
  defaultIde: claude-code
  compressionLevel: high
`;
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(mockConfig));
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const config = await service.loadConfiguration();

      expect(config).toBeDefined();
      expect(config.autoUpload.enabled).toBe(true);
      expect(config.autoUpload.visibility).toBe('private');
      expect(config.autoUpload.tags).toContain('claude-code');
      expect(config.autoUpload.exclude).toContain('*.secret');
      expect(config.auth.supabaseToken).toBe('test-token');
      expect(config.preferences.defaultIde).toBe('claude-code');
    });

    it('should handle missing configuration file gracefully', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      const config = await service.loadConfiguration();

      expect(config).toBeDefined();
      expect(config.autoUpload.enabled).toBe(false); // Default value
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Configuration file not found'));
    });

    it('should validate authentication tokens', async () => {
      const mockConfig = `
autoUpload:
  enabled: true
auth:
  supabaseToken: ""
`;
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(mockConfig));
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const config = await service.loadConfiguration();
      const isValid = service.validateAuthentication(config);

      expect(isValid).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Authentication token not configured'));
    });

    it('should merge user configuration with defaults', async () => {
      const mockConfig = `
autoUpload:
  enabled: true
  tags:
    - custom-tag
`;
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(mockConfig));
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const config = await service.loadConfiguration();

      expect(config.autoUpload.enabled).toBe(true);
      expect(config.autoUpload.tags).toContain('custom-tag');
      expect(config.autoUpload.visibility).toBe('private'); // Default value
      expect(config.autoUpload.exclude).toContain('.env*'); // Default exclusion
      expect(config.preferences.compressionLevel).toBe('medium'); // Default value
    });

    it('should handle upload exclusion patterns', async () => {
      const mockConfig = `
autoUpload:
  enabled: true
  exclude:
    - "*.secret"
    - ".env*"
    - "node_modules/"
    - "**/*.key"
`;
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(mockConfig));
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const config = await service.loadConfiguration();
      const testFiles = [
        'config.secret',
        '.env.local',
        'node_modules/package.json',
        'private.key',
        'normal.json',
      ];

      const shouldExclude = testFiles.map(file => 
        service.shouldExclude(file, config.autoUpload.exclude)
      );

      expect(shouldExclude[0]).toBe(true); // config.secret
      expect(shouldExclude[1]).toBe(true); // .env.local
      expect(shouldExclude[2]).toBe(true); // node_modules/package.json
      expect(shouldExclude[3]).toBe(true); // private.key
      expect(shouldExclude[4]).toBe(false); // normal.json
    });

    it('should generate default configuration for first-time users', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      const defaultConfig = await service.generateDefaultConfiguration();

      expect(defaultConfig).toBeDefined();
      expect(defaultConfig.autoUpload.enabled).toBe(false);
      expect(defaultConfig.autoUpload.visibility).toBe('private');
      expect(defaultConfig.autoUpload.tags).toEqual([]);
      expect(defaultConfig.autoUpload.exclude).toContain('.env*');
      expect(defaultConfig.autoUpload.exclude).toContain('*.secret');
      expect(defaultConfig.auth.supabaseToken).toBe('');
      expect(defaultConfig.preferences.defaultIde).toBe('claude-code');
      expect(defaultConfig.preferences.compressionLevel).toBe('medium');
    });

    it('should save configuration to file', async () => {
      const config = {
        autoUpload: {
          enabled: true,
          visibility: 'public' as const,
          tags: ['test'],
          exclude: ['.env*'],
        },
        auth: {
          supabaseToken: 'test-token',
        },
        preferences: {
          defaultIde: 'claude-code' as const,
          compressionLevel: 'high' as const,
        },
      };

      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await service.saveConfiguration(config);

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join('/home/user', '.taptik'),
        { recursive: true }
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('/home/user', '.taptik', 'config.yaml'),
        expect.stringContaining('autoUpload:'),
        'utf-8'
      );
    });

    it('should validate configuration schema', async () => {
      const invalidConfig = {
        autoUpload: {
          enabled: 'yes', // Should be boolean
          visibility: 'hidden', // Should be 'public' | 'private'
          tags: 'single-tag', // Should be array
          exclude: null, // Should be array
        },
        auth: {
          supabaseToken: 123, // Should be string
        },
        preferences: {
          defaultIde: 'unknown-ide', // Should be valid IDE
          compressionLevel: 'ultra', // Should be 'low' | 'medium' | 'high'
        },
      };

      const validationResult = service.validateConfiguration(invalidConfig as any);

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toContain('autoUpload.enabled must be a boolean');
      expect(validationResult.errors).toContain('autoUpload.visibility must be "public" or "private"');
      expect(validationResult.errors).toContain('autoUpload.tags must be an array');
      expect(validationResult.errors).toContain('auth.supabaseToken must be a string');
      expect(validationResult.errors).toContain('preferences.compressionLevel must be "low", "medium", or "high"');
    });

    it('should support environment variable overrides', async () => {
      process.env.TAPTIK_AUTO_UPLOAD = 'true';
      process.env.TAPTIK_SUPABASE_TOKEN = 'env-token';
      process.env.TAPTIK_VISIBILITY = 'public';

      const mockConfig = `
autoUpload:
  enabled: false
  visibility: private
auth:
  supabaseToken: "file-token"
`;
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(mockConfig));
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const config = await service.loadConfiguration();

      expect(config.autoUpload.enabled).toBe(true); // Overridden by env
      expect(config.autoUpload.visibility).toBe('public'); // Overridden by env
      expect(config.auth.supabaseToken).toBe('env-token'); // Overridden by env

      // Cleanup
      delete process.env.TAPTIK_AUTO_UPLOAD;
      delete process.env.TAPTIK_SUPABASE_TOKEN;
      delete process.env.TAPTIK_VISIBILITY;
    });

    it('should handle privacy settings correctly', async () => {
      const mockConfig = `
autoUpload:
  enabled: true
  visibility: private
  privateFields:
    - apiKeys
    - credentials
    - personalInfo
`;
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(mockConfig));
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const config = await service.loadConfiguration();

      expect(config.autoUpload.visibility).toBe('private');
      expect(config.autoUpload.privateFields).toContain('apiKeys');
      expect(config.autoUpload.privateFields).toContain('credentials');
      expect(config.autoUpload.privateFields).toContain('personalInfo');
    });
  });
});