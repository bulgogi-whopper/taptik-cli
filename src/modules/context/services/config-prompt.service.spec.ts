import { Logger } from '@nestjs/common';

import prompts from 'prompts';
import { vi, describe, it, expect, beforeEach, afterEach, Mock } from 'vitest';

import { TaptikConfig } from './config-loader.service';
import { ConfigPromptService } from './config-prompt.service';

vi.mock('prompts', () => ({
  default: vi.fn(),
}));

describe('ConfigPromptService', () => {
  let service: ConfigPromptService;
  let configLoaderService: any;
  let logger: Logger;

  const mockConfig: TaptikConfig = {
    autoUpload: {
      enabled: false,
      visibility: 'private',
      tags: [],
      exclude: ['.env*'],
    },
    auth: {
      supabaseToken: '',
    },
    preferences: {
      defaultIde: 'claude-code',
      compressionLevel: 'medium',
    },
  };

  beforeEach(async () => {
    // Create mock config loader
    configLoaderService = {
      loadConfiguration: vi.fn().mockResolvedValue(mockConfig),
      saveConfiguration: vi.fn(),
      updateConfiguration: vi.fn(),
      validateAuthentication: vi.fn(),
      isAutoUploadConfigured: vi.fn(),
      generateDefaultConfiguration: vi.fn().mockResolvedValue(mockConfig),
    };

    // Create service directly with the mock
    service = new ConfigPromptService(configLoaderService as any);
    ({ logger } = service as any);

    vi.spyOn(logger, 'log').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Upload Confirmation', () => {
    it('should prompt user for upload confirmation', async () => {
      (prompts as unknown as Mock).mockResolvedValue({ confirm: true });

      const result = await service.promptUploadConfirmation({
        fileName: 'config.json',
        fileSize: 1024,
        visibility: 'private',
      });

      expect(result).toBe(true);
      expect(prompts).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'confirm',
          name: 'confirm',
          message: expect.stringContaining('config.json'),
        }),
      );
    });

    it('should skip prompt if auto-upload is enabled', async () => {
      vi.mocked(configLoaderService.loadConfiguration).mockResolvedValue({
        ...mockConfig,
        autoUpload: { ...mockConfig.autoUpload, enabled: true },
      });
      vi.mocked(configLoaderService.isAutoUploadConfigured).mockReturnValue(
        true,
      );

      const result = await service.promptUploadConfirmation({
        fileName: 'config.json',
        fileSize: 1024,
        visibility: 'private',
        skipIfAutoEnabled: true,
      });

      expect(result).toBe(true);
      expect(prompts).not.toHaveBeenCalled();
    });

    it('should format file size in human-readable format', async () => {
      (prompts as unknown as Mock).mockResolvedValue({ confirm: true });

      await service.promptUploadConfirmation({
        fileName: 'config.json',
        fileSize: 1024 * 1024 * 2.5, // 2.5 MB
        visibility: 'public',
      });

      expect(prompts).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('2.50 MB'),
        }),
      );
    });
  });

  describe('Configuration Setup', () => {
    it('should prompt for initial configuration setup', async () => {
      (prompts as unknown as Mock)
        .mockResolvedValueOnce({ setupNow: true })
        .mockResolvedValueOnce({
          enabled: true,
          visibility: 'public',
          tags: 'claude-code, development',
          supabaseToken: 'test-token',
        });

      const result = await service.promptConfigurationSetup();

      expect(result).toEqual({
        autoUpload: {
          enabled: true,
          visibility: 'public',
          tags: ['claude-code', 'development'],
          exclude: expect.any(Array),
        },
        auth: {
          supabaseToken: 'test-token',
        },
        preferences: expect.any(Object),
      });
    });

    it('should validate Supabase token during setup', async () => {
      (prompts as unknown as Mock)
        .mockResolvedValueOnce({ setupNow: true })
        .mockResolvedValueOnce({
          enabled: true,
          visibility: 'private',
          tags: '',
          supabaseToken: '', // Empty token
        });

      const result = await service.promptConfigurationSetup();

      expect(result.autoUpload.enabled).toBe(false); // Disabled due to missing token
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('token required'),
      );
    });

    it('should parse tags correctly', async () => {
      (prompts as unknown as Mock)
        .mockResolvedValueOnce({ setupNow: true })
        .mockResolvedValueOnce({
          enabled: true,
          visibility: 'private',
          tags: ' react , typescript, frontend ', // With spaces
          supabaseToken: 'token',
        });

      const result = await service.promptConfigurationSetup();

      expect(result.autoUpload.tags).toEqual([
        'react',
        'typescript',
        'frontend',
      ]);
    });
  });

  describe('Privacy Settings', () => {
    it('should prompt for privacy preferences', async () => {
      (prompts as unknown as Mock).mockResolvedValue({
        visibility: 'private',
        excludePatterns: '.env*, *.secret, private/',
        shareAnonymously: false,
      });

      const result = await service.promptPrivacySettings();

      expect(result).toEqual({
        visibility: 'private',
        exclude: ['.env*', '*.secret', 'private/'],
        shareAnonymously: false,
      });
    });

    it('should suggest common exclusion patterns', async () => {
      (prompts as unknown as Mock).mockImplementation(
        async (questions: any) => {
          // Check that hint includes common patterns in one of the questions
          const excludeQuestion = Array.isArray(questions)
            ? questions.find((q: any) => q.name === 'excludePatterns')
            : questions.name === 'excludePatterns'
              ? questions
              : null;

          if (excludeQuestion && excludeQuestion.hint) {
            expect(excludeQuestion.hint).toContain('.env');
            expect(excludeQuestion.hint).toContain('*.secret');
          }

          return {
            visibility: 'private',
            excludePatterns: '',
            shareAnonymously: false,
          };
        },
      );

      await service.promptPrivacySettings();
    });
  });

  describe('Update Configuration', () => {
    it('should prompt to update existing configuration', async () => {
      (prompts as unknown as Mock).mockResolvedValue({
        updateChoice: 'visibility',
        newValue: 'public',
      });

      await service.promptConfigurationUpdate();

      expect(configLoaderService.updateConfiguration).toHaveBeenCalledWith({
        autoUpload: {
          visibility: 'public',
        },
      });
    });

    it('should handle token update securely', async () => {
      (prompts as unknown as Mock).mockResolvedValue({
        updateChoice: 'token',
        newValue: 'new-secret-token',
      });

      await service.promptConfigurationUpdate();

      expect(configLoaderService.updateConfiguration).toHaveBeenCalledWith({
        auth: {
          supabaseToken: 'new-secret-token',
        },
      });
      expect(logger.log).toHaveBeenCalledWith(
        'Authentication token updated successfully',
      );
    });

    it('should allow enabling/disabling auto-upload', async () => {
      (prompts as unknown as Mock).mockResolvedValue({
        updateChoice: 'toggle',
        enabled: true,
      });

      await service.promptConfigurationUpdate();

      expect(configLoaderService.updateConfiguration).toHaveBeenCalledWith({
        autoUpload: {
          enabled: true,
        },
      });
    });
  });

  describe('Confirmation Messages', () => {
    it('should show upload summary before confirmation', async () => {
      const metadata = {
        title: 'Claude Code Configuration',
        description: 'Development setup',
        tags: ['claude-code', 'typescript'],
        componentCount: {
          agents: 2,
          commands: 5,
          mcpServers: 1,
          steeringRules: 3,
          instructions: 2,
        },
      };

      (prompts as unknown as Mock).mockResolvedValue({ confirm: true });

      await service.promptUploadWithSummary(metadata);

      expect(prompts).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('2 agents'),
        }),
      );
      expect(prompts).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('5 commands'),
        }),
      );
    });

    it('should warn about public uploads', async () => {
      (prompts as unknown as Mock).mockResolvedValue({ confirm: true });

      await service.promptUploadConfirmation({
        fileName: 'config.json',
        fileSize: 1024,
        visibility: 'public',
      });

      expect(prompts).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('publicly visible'),
        }),
      );
    });
  });
});
