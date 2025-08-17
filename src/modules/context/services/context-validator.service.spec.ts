import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach } from 'vitest';

import { AIPlatform, TaptikContext } from '../interfaces';

import { ContextValidatorService } from './context-validator.service';

describe('ContextValidatorService', () => {
  let service: ContextValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContextValidatorService],
    }).compile();

    service = module.get<ContextValidatorService>(ContextValidatorService);
  });

  describe('validateContext', () => {
    it('should validate a valid context successfully', async () => {
      const validContext: TaptikContext = {
        version: '1.0.0',
        metadata: {
          name: 'Test Context',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          platforms: [AIPlatform.KIRO],
        },
        personal: {
          category: 'personal',
          spec_version: '1.0.0',
          data: {
            developer_profile: {
              experience_years: 5,
              primary_role: 'BACKEND' as any,
            },
          },
        },
      };

      const result = await service.validateContext(validContext);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should detect missing version', async () => {
      const invalidContext = {
        metadata: {
          name: 'Test Context',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      } as any;

      const result = await service.validateContext(invalidContext);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].path).toBe('version');
    });

    it('should detect invalid semver version', async () => {
      const invalidContext: any = {
        version: '1.0',
        metadata: {
          name: 'Test Context',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      const result = await service.validateContext(invalidContext);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0].message).toContain('semantic versioning');
    });

    it('should detect missing metadata', async () => {
      const invalidContext = {
        version: '1.0.0',
      } as any;

      const result = await service.validateContext(invalidContext);
      expect(result.valid).toBe(false);
      expect(result.errors?.some((error) => error.path === 'metadata')).toBe(
        true,
      );
    });

    it('should detect missing context name', async () => {
      const invalidContext: any = {
        version: '1.0.0',
        metadata: {
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      const result = await service.validateContext(invalidContext);
      expect(result.valid).toBe(false);
      expect(
        result.errors?.some((error) => error.path === 'metadata.name'),
      ).toBe(true);
    });

    it('should detect short context name', async () => {
      const invalidContext: any = {
        version: '1.0.0',
        metadata: {
          name: 'ab',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      const result = await service.validateContext(invalidContext);
      expect(result.valid).toBe(false);
      expect(
        result.errors?.some((error) =>
          error.message.includes('at least 3 characters'),
        ),
      ).toBe(true);
    });

    it('should detect invalid ISO date', async () => {
      const invalidContext: any = {
        version: '1.0.0',
        metadata: {
          name: 'Test Context',
          created_at: 'not-a-date',
          updated_at: new Date().toISOString(),
        },
      };

      const result = await service.validateContext(invalidContext);
      expect(result.valid).toBe(false);
      expect(
        result.errors?.some((error) => error.message.includes('ISO 8601')),
      ).toBe(true);
    });

    it('should warn when no categories are present', async () => {
      const contextWithoutCategories: TaptikContext = {
        version: '1.0.0',
        metadata: {
          name: 'Test Context',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      const result = await service.validateContext(contextWithoutCategories);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.[0].message).toContain(
        'No context categories found',
      );
    });

    it('should validate personal context', async () => {
      const contextWithPersonal: TaptikContext = {
        version: '1.0.0',
        metadata: {
          name: 'Test Context',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        personal: {
          category: 'personal',
          spec_version: '1.0.0',
          data: {},
        },
      };

      const result = await service.validateContext(contextWithPersonal);
      expect(result.valid).toBe(true);
      expect(
        result.warnings?.some(
          (w) => w.path === 'personal.data.developer_profile',
        ),
      ).toBe(true);
    });

    it('should validate project context', async () => {
      const contextWithProject: TaptikContext = {
        version: '1.0.0',
        metadata: {
          name: 'Test Context',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        project: {
          category: 'project',
          spec_version: '1.0.0',
          data: {},
        },
      };

      const result = await service.validateContext(contextWithProject);
      expect(result.valid).toBe(true);
      expect(
        result.warnings?.some((w) => w.path === 'project.data.project_name'),
      ).toBe(true);
      expect(
        result.warnings?.some((w) => w.path === 'project.data.tech_stack'),
      ).toBe(true);
    });

    it('should validate prompts context', async () => {
      const contextWithPrompts: TaptikContext = {
        version: '1.0.0',
        metadata: {
          name: 'Test Context',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        prompts: {
          category: 'prompts',
          spec_version: '1.0.0',
          data: {
            system_prompts: ['prompt1'],
            custom_instructions: ['instruction1'],
          },
        },
      };

      const result = await service.validateContext(contextWithPrompts);
      expect(result.valid).toBe(true);
    });

    it('should detect invalid prompt arrays', async () => {
      const contextWithInvalidPrompts: any = {
        version: '1.0.0',
        metadata: {
          name: 'Test Context',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        prompts: {
          category: 'prompts',
          spec_version: '1.0.0',
          data: {
            system_prompts: 'not-an-array',
          },
        },
      };

      const result = await service.validateContext(contextWithInvalidPrompts);
      expect(result.valid).toBe(false);
      expect(
        result.errors?.some((error) =>
          error.message.includes('must be an array'),
        ),
      ).toBe(true);
    });

    it('should validate MCP servers in tools context', async () => {
      const contextWithTools: TaptikContext = {
        version: '1.0.0',
        metadata: {
          name: 'Test Context',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        tools: {
          category: 'tools',
          spec_version: '1.0.0',
          data: {
            mcp_servers: [
              {
                name: 'test-server',
                version: '1.0.0',
                config: {},
              },
            ],
          },
        },
      };

      const result = await service.validateContext(contextWithTools);
      expect(result.valid).toBe(true);
    });

    it('should detect missing MCP server name', async () => {
      const contextWithInvalidTools: any = {
        version: '1.0.0',
        metadata: {
          name: 'Test Context',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        tools: {
          category: 'tools',
          spec_version: '1.0.0',
          data: {
            mcp_servers: [
              {
                config: {},
              },
            ],
          },
        },
      };

      const result = await service.validateContext(contextWithInvalidTools);
      expect(result.valid).toBe(false);
      expect(
        result.errors?.some((error) =>
          error.message.includes('MCP server name is required'),
        ),
      ).toBe(true);
    });

    it('should check platform compatibility', async () => {
      const multiPlatformContext: TaptikContext = {
        version: '1.0.0',
        metadata: {
          name: 'Test Context',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          platforms: [AIPlatform.KIRO, AIPlatform.CLAUDE_CODE],
        },
        project: {
          category: 'project',
          spec_version: '1.0.0',
          data: {
            kiro_specs: [],
            claude_instructions: 'instructions',
          } as any,
        },
      };

      const result = await service.validateContext(multiPlatformContext);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(
        result.warnings?.some((w) =>
          w.message.includes('may not be fully compatible'),
        ),
      ).toBe(true);
    });

    it('should warn when no platforms specified', async () => {
      const contextWithoutPlatforms: TaptikContext = {
        version: '1.0.0',
        metadata: {
          name: 'Test Context',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      const result = await service.validateContext(contextWithoutPlatforms);
      expect(result.valid).toBe(true);
      expect(
        result.warnings?.some((w) =>
          w.message.includes('No target platforms specified'),
        ),
      ).toBe(true);
    });
  });

  describe('isPlatformCompatible', () => {
    it('should return true for compatible platform', () => {
      const context: TaptikContext = {
        version: '1.0.0',
        metadata: {
          name: 'Test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          platforms: [AIPlatform.KIRO, AIPlatform.CLAUDE_CODE],
        },
      };

      expect(service.isPlatformCompatible(context, AIPlatform.KIRO)).toBe(true);
      expect(
        service.isPlatformCompatible(context, AIPlatform.CLAUDE_CODE),
      ).toBe(true);
    });

    it('should return false for incompatible platform', () => {
      const context: TaptikContext = {
        version: '1.0.0',
        metadata: {
          name: 'Test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          platforms: [AIPlatform.KIRO],
        },
      };

      expect(
        service.isPlatformCompatible(context, AIPlatform.CLAUDE_CODE),
      ).toBe(false);
    });

    it('should return false when no platforms specified', () => {
      const context: TaptikContext = {
        version: '1.0.0',
        metadata: {
          name: 'Test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      expect(service.isPlatformCompatible(context, AIPlatform.KIRO)).toBe(
        false,
      );
    });
  });

  describe('getPlatformSchema', () => {
    it('should return schema for platform', () => {
      const schema = service.getPlatformSchema(AIPlatform.KIRO);
      expect(schema.platform).toBe(AIPlatform.KIRO);
      expect(schema.requiredFields).toContain('version');
      expect(schema.requiredFields).toContain('metadata');
      expect(schema.platformSpecific).toContain('kiro-specs');
    });

    it('should return empty platform specific for unknown platform', () => {
      const schema = service.getPlatformSchema(AIPlatform.CURSOR);
      expect(schema.platformSpecific).toEqual([]);
    });
  });
});
