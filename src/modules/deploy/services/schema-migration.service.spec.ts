import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach } from 'vitest';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';

import { SchemaMigrationService } from './schema-migration.service';

describe('SchemaMigrationService', () => {
  let service: SchemaMigrationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SchemaMigrationService],
    }).compile();

    service = module.get<SchemaMigrationService>(SchemaMigrationService);
  });

  describe('detectSchemaVersion', () => {
    it('should detect v1.0.0 schema version', () => {
      const v1Context = createV1Context();
      const version = service.detectSchemaVersion(v1Context);
      expect(version).toBe('1.0.0');
    });

    it('should detect v1.1.0 schema version with enhanced tools', () => {
      const v11Context = createV11Context();
      const version = service.detectSchemaVersion(v11Context);
      expect(version).toBe('1.1.0');
    });

    it('should detect current v1.2.0 schema version', () => {
      const currentContext = createCurrentContext();
      const version = service.detectSchemaVersion(currentContext);
      expect(version).toBe('1.2.0');
    });

    it('should handle context without explicit version', () => {
      const contextWithoutVersion = {
        metadata: { 
          exportedAt: '2024-01-01T00:00:00Z', 
          sourceIde: 'test',
          version: '',
          targetIdes: ['test'],
        },
        content: { personal: { name: 'Test' } },
        security: { hasApiKeys: false, filteredFields: [], scanResults: { passed: true, warnings: [] } },
      };
      const version = service.detectSchemaVersion(contextWithoutVersion);
      expect(version).toBe('1.0.0'); // Default to oldest version
    });

    it('should handle malformed context gracefully', () => {
      const malformedContext = {} as TaptikContext;
      const version = service.detectSchemaVersion(malformedContext);
      expect(version).toBe('1.0.0');
    });
  });

  describe('isCompatible', () => {
    it('should return true for same version', () => {
      const result = service.isCompatible('1.2.0', '1.2.0');
      expect(result.compatible).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should return true for backward compatible versions', () => {
      const result = service.isCompatible('1.0.0', '1.2.0');
      expect(result.compatible).toBe(true);
      expect(result.migrationRequired).toBe(true);
    });

    it('should return false for future versions', () => {
      const result = service.isCompatible('2.0.0', '1.2.0');
      expect(result.compatible).toBe(false);
      expect(result.warnings).toContain('Configuration version 2.0.0 is newer than supported version 1.2.0');
    });

    it('should provide warnings for minor version differences', () => {
      const result = service.isCompatible('1.1.0', '1.2.0');
      expect(result.compatible).toBe(true);
      expect(result.warnings).toContain('Configuration version 1.1.0 may have reduced functionality with current version 1.2.0');
    });

    it('should handle invalid version strings', () => {
      const result = service.isCompatible('invalid', '1.2.0');
      expect(result.compatible).toBe(false);
      expect(result.warnings).toContain('Invalid version format: invalid');
    });
  });

  describe('migrateToLatest', () => {
    it('should migrate v1.0.0 to v1.2.0', async () => {
      const v1Context = createV1Context();
      const migrated = await service.migrateToLatest(v1Context);
      
      expect(migrated.metadata.version).toBe('1.2.0');
      expect(migrated.content.tools?.mcp_servers).toBeDefined();
      expect(migrated.content.ide?.['claude-code']).toBeDefined();
    });

    it('should migrate v1.1.0 to v1.2.0', async () => {
      const v11Context = createV11Context();
      const migrated = await service.migrateToLatest(v11Context);
      
      expect(migrated.metadata.version).toBe('1.2.0');
      expect(migrated.content.prompts?.system_prompts).toBeDefined();
      expect(migrated.security?.detectedPatterns).toBeDefined();
    });

    it('should handle already current version', async () => {
      const currentContext = createCurrentContext();
      const migrated = await service.migrateToLatest(currentContext);
      
      expect(migrated).toEqual(currentContext);
    });

    it('should preserve existing data during migration', async () => {
      const v1Context = createV1Context();
      v1Context.content.personal = { name: 'John Doe', email: 'john@example.com' };
      
      const migrated = await service.migrateToLatest(v1Context);
      
      expect(migrated.content.personal?.name).toBe('John Doe');
      expect(migrated.content.personal?.email).toBe('john@example.com');
    });

    it('should handle migration errors gracefully', async () => {
      const corruptedContext = {
        metadata: null,
        content: 'invalid',
        security: undefined,
      } as any;
      
      await expect(service.migrateToLatest(corruptedContext)).rejects.toThrow('Migration failed:');
    });
  });

  describe('validateMigration', () => {
    it('should validate successful migration', async () => {
      const original = createV1Context();
      const migrated = await service.migrateToLatest(original);
      
      const validation = await service.validateMigration(original, migrated);
      
      expect(validation.passed).toBe(true);
      expect(validation.warnings).toHaveLength(0);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect data loss during migration', async () => {
      const original = createV1Context();
      const incomplete = {
        metadata: original.metadata,
        security: original.security,
        content: {
          // Remove personal content to simulate data loss
          project: original.content.project,
          ide: original.content.ide,
        },
      };
      
      const validation = await service.validateMigration(original, incomplete);
      
      expect(validation.passed).toBe(false);
      expect(validation.errors).toContain('Data loss detected: personal content missing after migration');
    });

    it('should detect schema format violations', async () => {
      const original = createV1Context();
      const invalid = {
        ...original,
        metadata: { ...original.metadata, version: 'invalid' },
      };
      
      const validation = await service.validateMigration(original, invalid);
      
      expect(validation.passed).toBe(false);
      expect(validation.errors).toContain('Invalid target schema version: invalid');
    });
  });

  describe('getMigrationPath', () => {
    it('should return direct migration path for single step', () => {
      const path = service.getMigrationPath('1.1.0', '1.2.0');
      expect(path).toEqual(['1.1.0 → 1.2.0']);
    });

    it('should return multi-step migration path', () => {
      const path = service.getMigrationPath('1.0.0', '1.2.0');
      expect(path).toEqual(['1.0.0 → 1.1.0', '1.1.0 → 1.2.0']);
    });

    it('should return empty path for same version', () => {
      const path = service.getMigrationPath('1.2.0', '1.2.0');
      expect(path).toEqual([]);
    });

    it('should handle downgrade scenarios', () => {
      const path = service.getMigrationPath('1.2.0', '1.0.0');
      expect(path).toEqual(['Downgrade not supported: 1.2.0 → 1.0.0']);
    });
  });

  describe('getSchemaInfo', () => {
    it('should return schema information for version', () => {
      const info = service.getSchemaInfo('1.2.0');
      
      expect(info.version).toBe('1.2.0');
      expect(info.features).toContain('Enhanced security patterns');
      expect(info.features).toContain('Advanced prompt templates');
      expect(info.features).toContain('Multi-platform IDE support');
      expect(info.compatibleWith).toContain('1.0.0');
      expect(info.compatibleWith).toContain('1.1.0');
    });

    it('should return minimal info for v1.0.0', () => {
      const info = service.getSchemaInfo('1.0.0');
      
      expect(info.version).toBe('1.0.0');
      expect(info.features).toContain('Basic context structure');
      expect(info.features).toContain('Personal and project settings');
      expect(info.deprecatedFeatures).toHaveLength(0);
    });

    it('should handle unknown version', () => {
      const info = service.getSchemaInfo('9.9.9');
      
      expect(info.version).toBe('unknown');
      expect(info.features).toHaveLength(0);
      expect(info.compatibleWith).toHaveLength(0);
    });
  });
});

// Helper functions to create test contexts
function createV1Context(): TaptikContext {
  return {
    metadata: {
      version: '1.0.0',
      exportedAt: '2024-01-01T00:00:00Z',
      sourceIde: 'claude-code',
      targetIdes: ['claude-code'],
    },
    content: {
      personal: {
        name: 'Test User',
        email: 'test@example.com',
      },
      project: {
        name: 'Test Project',
        description: 'Test project',
      },
      ide: {
        claudeCode: {
          settings: { theme: 'dark' },
        },
      },
    },
    security: {
      hasApiKeys: false,
      filteredFields: [],
      scanResults: {
        passed: true,
        warnings: [],
      },
    },
  };
}

function createV11Context(): TaptikContext {
  return {
    metadata: {
      version: '1.1.0',
      exportedAt: '2024-03-01T00:00:00Z',
      sourceIde: 'claude-code',
      targetIdes: ['claude-code'],
    },
    content: {
      personal: {
        name: 'Test User',
        profile: {
          experience_years: 5,
          primary_role: 'developer',
        },
      },
      project: {
        name: 'Test Project',
        architecture: {
          pattern: 'microservices',
        },
      },
      tools: {
        custom_tools: [
          {
            name: 'test-tool',
            command: 'echo test',
            description: 'Test tool',
          },
        ],
      },
      ide: {
        claudeCode: {
          settings: { theme: 'dark' },
          mcp_config: {},
        },
      },
    },
    security: {
      hasApiKeys: false,
      filteredFields: [],
      scanResults: {
        passed: true,
        warnings: [],
      },
    },
  };
}

function createCurrentContext(): TaptikContext {
  return {
    metadata: {
      version: '1.2.0',
      exportedAt: '2024-06-01T00:00:00Z',
      sourceIde: 'claude-code',
      targetIdes: ['claude-code', 'kiro-ide'],
    },
    content: {
      personal: {
        name: 'Test User',
        profile: {
          experience_years: 5,
          primary_role: 'developer',
        },
        preferences: {
          theme: 'dark',
        },
        communication: {
          explanation_level: 'detailed',
        },
      },
      project: {
        name: 'Test Project',
        architecture: {
          pattern: 'microservices',
          api_style: 'rest',
        },
        tech_stack: {
          language: 'typescript',
          framework: 'nestjs',
        },
      },
      prompts: {
        system_prompts: [
          {
            name: 'coding-assistant',
            content: 'You are a coding assistant',
            category: 'development',
          },
        ],
        templates: [
          {
            name: 'bug-report',
            template: 'Bug: {{description}}',
            variables: ['description'],
          },
        ],
      },
      tools: {
        mcp_servers: [
          {
            name: 'test-server',
            command: 'node server.js',
            args: ['--port', '3000'],
          },
        ],
        agents: [
          {
            name: 'test-agent',
            content: 'Agent instructions',
          },
        ],
        commands: [
          {
            name: 'test-command',
            content: 'Command content',
            permissions: ['read'],
          },
        ],
      },
      ide: {
        'claude-code': {
          settings: { theme: 'dark' },
          mcp_config: {},
          claude_md: 'Instructions',
        },
        'kiro-ide': {
          settings: {},
          specs: {},
        },
      },
    },
    security: {
      hasApiKeys: false,
      filteredFields: [],
      scanResults: {
        passed: true,
        warnings: [],
      },
      detectedPatterns: [],
    },
  };
}