import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach } from 'vitest';

import { PlatformValidatorService } from './platform-validator.service';
import { createMockTaptikContext, createMockCommand } from './test-helpers';

describe('PlatformValidatorService', () => {
  let service: PlatformValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlatformValidatorService],
    }).compile();

    service = module.get<PlatformValidatorService>(PlatformValidatorService);
  });

  describe('validateForPlatform', () => {
    it('should validate Claude Code configuration successfully', async () => {
      const context = createMockTaptikContext({
        metadata: {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
        },
      });

      const result = await service.validateForPlatform(context, 'claude-code');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject unsupported platform', async () => {
      const context = createMockTaptikContext();

      const result = await service.validateForPlatform(
        context,
        'unsupported-ide',
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'PLATFORM_UNSUPPORTED',
          message: expect.stringContaining('unsupported-ide'),
        }),
      );
    });

    it('should validate platform compatibility from targetIdes', async () => {
      const context = createMockTaptikContext({
        metadata: {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          sourceIde: 'kiro-ide',
          targetIdes: ['kiro-ide', 'cursor-ide'], // Not claude-code
        },
      });

      const result = await service.validateForPlatform(context, 'claude-code');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'PLATFORM_INCOMPATIBLE',
        }),
      );
    });

    it('should warn about future platforms', async () => {
      const context = createMockTaptikContext();

      const result = await service.validateForPlatform(context, 'kiro-ide');

      expect(result.isValid).toBe(false);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('not yet supported'),
        }),
      );
    });
  });

  describe('validateClaudeCode', () => {
    it('should validate valid Claude Code configuration', async () => {
      const context = createMockTaptikContext({
        content: {
          ide: {
            settings: {
              permissions: {
                allow: ['Bash(npm *)'],
                deny: ['Bash(rm *)'],
              },
            } as any,
          },
        },
      });

      const result = await service.validateClaudeCode(context);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate agent configurations', async () => {
      const context = createMockTaptikContext({
        content: {
          ide: {
            agents: [
              {
                name: 'test-agent',
                description: 'Test agent',
                content: 'Agent content',
                metadata: {
                  version: '1.0.0',
                  author: 'test',
                  tags: ['test'],
                },
              },
            ] as any,
          },
        },
      });

      const result = await service.validateClaudeCode(context);

      expect(result.isValid).toBe(true);
    });

    it('should reject agents without required fields', async () => {
      const context = createMockTaptikContext({
        content: {
          ide: {
            agents: [
              {
                // Missing name
                description: 'Test agent',
                content: 'Agent content',
              },
            ] as any,
          },
        },
      });

      const result = await service.validateClaudeCode(context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'agents[0].name',
          code: 'REQUIRED_FIELD',
        }),
      );
    });

    it('should validate command configurations', async () => {
      const context = createMockTaptikContext({
        content: {
          ide: {
            commands: [
              createMockCommand({
                permissions: ['Bash(echo *)'],
              }),
            ] as any,
          },
        },
      });

      const result = await service.validateClaudeCode(context);

      expect(result.isValid).toBe(true);
    });

    it('should reject invalid permission format', async () => {
      const context = createMockTaptikContext({
        content: {
          ide: {
            commands: [
              createMockCommand({
                permissions: ['invalid-format'],
              }),
            ] as any,
          },
        },
      });

      const result = await service.validateClaudeCode(context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_PERMISSION_FORMAT',
        }),
      );
    });

    it('should validate settings structure', async () => {
      const context = createMockTaptikContext({
        content: {
          ide: {
            settings: {
              permissions: {
                allow: ['Bash(npm *)'],
                defaultMode: 'acceptEdits' as any,
              },
              statusLine: {
                type: 'command',
                command: 'npx ccusage statusline',
              },
            } as any,
          },
        },
      });

      const result = await service.validateClaudeCode(context);

      expect(result.isValid).toBe(true);
    });
  });

  describe('checkPlatformSupport', () => {
    it('should return true for claude-code', async () => {
      const result = await service.checkPlatformSupport('claude-code');
      expect(result).toBe(true);
    });

    it('should return false for kiro-ide', async () => {
      const result = await service.checkPlatformSupport('kiro-ide');
      expect(result).toBe(false);
    });

    it('should return false for cursor-ide', async () => {
      const result = await service.checkPlatformSupport('cursor-ide');
      expect(result).toBe(false);
    });

    it('should return false for unknown platform', async () => {
      const result = await service.checkPlatformSupport('unknown-ide');
      expect(result).toBe(false);
    });
  });
});
