import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach } from 'vitest';

import {
  TaptikPackage,
  ValidationResult,
  CloudMetadata,
} from '../interfaces/cloud.interface';

import { ValidationService } from './validation.service';

describe('ValidationService', () => {
  let service: ValidationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidationService],
    }).compile();

    service = module.get<ValidationService>(ValidationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateForCloudUpload', () => {
    describe('Valid Package Scenarios', () => {
      it('should validate a minimal valid package successfully', async () => {
        const minimalPackage: TaptikPackage = {
          metadata: {
            title: 'Minimal Config',
            tags: ['test'],
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            complexityLevel: 'minimal',
            componentCount: {
              agents: 0,
              commands: 0,
              mcpServers: 0,
              steeringRules: 0,
              instructions: 0,
            },
            features: [],
            compatibility: ['claude-code'],
            searchKeywords: ['test'],
            fileSize: 1024,
            checksum: 'abc123',
          },
          sanitizedConfig: {
            version: '1.0.0',
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            data: {},
            metadata: {
              timestamp: new Date().toISOString(),
            },
          },
          checksum: 'abc123',
          format: 'taptik-v1',
          compression: 'gzip',
          size: 1024,
          manifest: {
            files: [],
            directories: [],
            totalSize: 1024,
          },
        };

        const result = await service.validateForCloudUpload(minimalPackage);

        expect(result.isValid).toBe(true);
        expect(result.cloudCompatible).toBe(true);
        expect(result.schemaCompliant).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.sizeLimit.withinLimit).toBe(true);
      });

      it('should validate a complex package with all components', async () => {
        const complexPackage: TaptikPackage = {
          metadata: {
            title: 'Complex Development Setup',
            description: 'Full-featured development environment',
            tags: ['frontend', 'backend', 'testing'],
            author: 'Test User',
            version: '2.0.0',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sourceIde: 'claude-code',
            targetIdes: ['claude-code', 'kiro-ide', 'cursor-ide'],
            complexityLevel: 'expert',
            componentCount: {
              agents: 10,
              commands: 25,
              mcpServers: 5,
              steeringRules: 15,
              instructions: 2,
            },
            features: [
              'gitIntegration',
              'dockerSupport',
              'kubernetesIntegration',
            ],
            compatibility: ['claude-code', 'kiro-ide', 'cursor-ide'],
            searchKeywords: [
              'frontend',
              'backend',
              'testing',
              'docker',
              'kubernetes',
            ],
            fileSize: 5242880, // 5MB
            checksum: 'def456',
            isPublic: true,
          },
          sanitizedConfig: {
            version: '1.0.0',
            sourceIde: 'claude-code',
            targetIdes: ['claude-code', 'kiro-ide', 'cursor-ide'],
            data: {
              claudeCode: {
                local: {
                  settings: {
                    theme: 'dark',
                    autoSave: true,
                    features: {
                      gitIntegration: true,
                      dockerSupport: true,
                      kubernetesIntegration: true,
                    },
                  },
                  agents: Array(10).fill({
                    id: 'agent',
                    name: 'Agent',
                    prompt: 'Test',
                  }),
                  commands: Array(25).fill({
                    name: 'cmd',
                    command: 'echo test',
                  }),
                  mcpServers: {
                    servers: Array(5).fill({
                      name: 'server',
                      protocol: 'http',
                    }),
                  },
                  steeringRules: Array(15).fill({
                    pattern: '*.ts',
                    rule: 'typescript',
                  }),
                  instructions: {
                    global: 'Global instructions',
                    local: 'Local instructions',
                  },
                },
              },
            },
            metadata: {
              timestamp: new Date().toISOString(),
              exportedBy: 'Test User',
            },
          },
          checksum: 'def456',
          format: 'taptik-v1',
          compression: 'gzip',
          size: 5242880,
          manifest: {
            files: ['settings.json', 'agents/*.json', 'commands/*.json'],
            directories: ['.claude', '.claude/agents', '.claude/commands'],
            totalSize: 5242880,
          },
        };

        const result = await service.validateForCloudUpload(complexPackage);

        expect(result.isValid).toBe(true);
        expect(result.cloudCompatible).toBe(true);
        expect(result.schemaCompliant).toBe(true);
        expect(result.warnings.length).toBeGreaterThanOrEqual(0);
        expect(result.featureSupport.supported).toContain('gitIntegration');
      });
    });

    describe('Invalid Package Scenarios', () => {
      it('should fail validation for missing required metadata fields', async () => {
        const invalidPackage: TaptikPackage = {
          metadata: {
            // Missing required fields: title, tags, version, etc.
          } as any,
          sanitizedConfig: {
            version: '1.0.0',
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            data: {},
            metadata: {
              timestamp: new Date().toISOString(),
            },
          },
          checksum: 'invalid',
          format: 'taptik-v1',
          compression: 'gzip',
          size: 1024,
          manifest: {
            files: [],
            directories: [],
            totalSize: 1024,
          },
        };

        const result = await service.validateForCloudUpload(invalidPackage);

        expect(result.isValid).toBe(false);
        expect(result.schemaCompliant).toBe(false);
        expect(result.errors).toContain(
          'Missing required field: metadata.title',
        );
        expect(result.errors).toContain(
          'Missing required field: metadata.tags',
        );
        expect(result.errors).toContain(
          'Missing required field: metadata.version',
        );
      });

      it('should fail validation for invalid format version', async () => {
        const invalidFormatPackage: TaptikPackage = {
          metadata: {
            title: 'Test',
            tags: ['test'],
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            complexityLevel: 'minimal',
            componentCount: {
              agents: 0,
              commands: 0,
              mcpServers: 0,
              steeringRules: 0,
              instructions: 0,
            },
            features: [],
            compatibility: ['claude-code'],
            searchKeywords: ['test'],
            fileSize: 1024,
            checksum: 'abc123',
          },
          sanitizedConfig: {
            version: '1.0.0',
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            data: {},
            metadata: {
              timestamp: new Date().toISOString(),
            },
          },
          checksum: 'abc123',
          format: 'taptik-v3' as any, // Invalid format
          compression: 'gzip',
          size: 1024,
          manifest: {
            files: [],
            directories: [],
            totalSize: 1024,
          },
        };

        const result =
          await service.validateForCloudUpload(invalidFormatPackage);

        expect(result.isValid).toBe(false);
        expect(
          result.errors.some((e) => e.includes('Unsupported package format')),
        ).toBe(true);
      });

      it('should fail validation for checksum mismatch', async () => {
        const checksumMismatchPackage: TaptikPackage = {
          metadata: {
            title: 'Test',
            tags: ['test'],
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            complexityLevel: 'minimal',
            componentCount: {
              agents: 0,
              commands: 0,
              mcpServers: 0,
              steeringRules: 0,
              instructions: 0,
            },
            features: [],
            compatibility: ['claude-code'],
            searchKeywords: ['test'],
            fileSize: 1024,
            checksum: 'abc123',
          },
          sanitizedConfig: {
            version: '1.0.0',
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            data: {},
            metadata: {
              timestamp: new Date().toISOString(),
            },
          },
          checksum: 'def456', // Different from metadata.checksum
          format: 'taptik-v1',
          compression: 'gzip',
          size: 1024,
          manifest: {
            files: [],
            directories: [],
            totalSize: 1024,
          },
        };

        const result = await service.validateForCloudUpload(
          checksumMismatchPackage,
        );

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Checksum mismatch: package integrity compromised',
        );
      });
    });

    describe('Size Limit Validation', () => {
      it('should fail validation for packages exceeding size limit', async () => {
        const oversizedPackage: TaptikPackage = {
          metadata: {
            title: 'Oversized Package',
            tags: ['test'],
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            complexityLevel: 'expert',
            componentCount: {
              agents: 100,
              commands: 100,
              mcpServers: 50,
              steeringRules: 100,
              instructions: 10,
            },
            features: [],
            compatibility: ['claude-code'],
            searchKeywords: ['test'],
            fileSize: 52428800, // 50MB
            checksum: 'huge123',
          },
          sanitizedConfig: {
            version: '1.0.0',
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            data: {},
            metadata: {
              timestamp: new Date().toISOString(),
            },
          },
          checksum: 'huge123',
          format: 'taptik-v1',
          compression: 'gzip',
          size: 52428800, // 50MB - exceeds limit
          manifest: {
            files: [],
            directories: [],
            totalSize: 52428800,
          },
        };

        const result = await service.validateForCloudUpload(oversizedPackage);

        expect(result.isValid).toBe(false);
        expect(result.cloudCompatible).toBe(false);
        expect(result.sizeLimit.withinLimit).toBe(false);
        expect(result.sizeLimit.current).toBe(52428800);
        expect(result.sizeLimit.maximum).toBe(10485760); // 10MB limit
        expect(result.errors).toContain(
          'Package size exceeds maximum limit of 10MB',
        );
      });

      it('should add warning for packages approaching size limit', async () => {
        const nearLimitPackage: TaptikPackage = {
          metadata: {
            title: 'Near Limit Package',
            tags: ['test'],
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            complexityLevel: 'advanced',
            componentCount: {
              agents: 50,
              commands: 50,
              mcpServers: 20,
              steeringRules: 50,
              instructions: 5,
            },
            features: [],
            compatibility: ['claude-code'],
            searchKeywords: ['test'],
            fileSize: 9437184, // 9MB - 90% of limit
            checksum: 'near123',
          },
          sanitizedConfig: {
            version: '1.0.0',
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            data: {},
            metadata: {
              timestamp: new Date().toISOString(),
            },
          },
          checksum: 'near123',
          format: 'taptik-v1',
          compression: 'gzip',
          size: 9437184,
          manifest: {
            files: [],
            directories: [],
            totalSize: 9437184,
          },
        };

        const result = await service.validateForCloudUpload(nearLimitPackage);

        expect(result.isValid).toBe(true);
        expect(result.sizeLimit.withinLimit).toBe(true);
        expect(result.warnings).toContain(
          'Package size is approaching the maximum limit (90% used)',
        );
      });
    });

    describe('Schema Compliance Validation', () => {
      it('should validate correct schema structure', async () => {
        const validSchemaPackage: TaptikPackage = {
          metadata: {
            title: 'Valid Schema',
            tags: ['test'],
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            complexityLevel: 'basic',
            componentCount: {
              agents: 1,
              commands: 2,
              mcpServers: 1,
              steeringRules: 0,
              instructions: 0,
            },
            features: [],
            compatibility: ['claude-code'],
            searchKeywords: ['test'],
            fileSize: 2048,
            checksum: 'schema123',
          },
          sanitizedConfig: {
            version: '1.0.0',
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            data: {
              claudeCode: {
                local: {
                  agents: [
                    { id: 'agent1', name: 'Test Agent', prompt: 'Test prompt' },
                  ],
                  commands: [
                    { name: 'test', command: 'echo test' },
                    { name: 'build', command: 'npm run build' },
                  ],
                  mcpServers: {
                    servers: [
                      {
                        name: 'test-server',
                        protocol: 'http',
                        url: 'http://localhost:3000',
                      },
                    ],
                  },
                },
              },
            },
            metadata: {
              timestamp: new Date().toISOString(),
            },
          },
          checksum: 'schema123',
          format: 'taptik-v1',
          compression: 'gzip',
          size: 2048,
          manifest: {
            files: ['settings.json'],
            directories: ['.claude'],
            totalSize: 2048,
          },
        };

        const result = await service.validateForCloudUpload(validSchemaPackage);

        expect(result.isValid).toBe(true);
        expect(result.schemaCompliant).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect invalid schema structures', async () => {
        const invalidSchemaPackage: TaptikPackage = {
          metadata: {
            title: 'Invalid Schema',
            tags: ['test'],
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            complexityLevel: 'basic',
            componentCount: {
              agents: 1,
              commands: 1,
              mcpServers: 0,
              steeringRules: 0,
              instructions: 0,
            },
            features: [],
            compatibility: ['claude-code'],
            searchKeywords: ['test'],
            fileSize: 1024,
            checksum: 'invalid123',
          },
          sanitizedConfig: {
            version: '1.0.0',
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            data: {
              claudeCode: {
                local: {
                  agents: [
                    { name: 'Missing ID' } as any, // Missing required 'id' field
                  ],
                  commands: [
                    { command: 'Missing name' } as any, // Missing required 'name' field
                  ],
                },
              },
            },
            metadata: {
              timestamp: new Date().toISOString(),
            },
          },
          checksum: 'invalid123',
          format: 'taptik-v1',
          compression: 'gzip',
          size: 1024,
          manifest: {
            files: [],
            directories: [],
            totalSize: 1024,
          },
        };

        const result =
          await service.validateForCloudUpload(invalidSchemaPackage);

        expect(result.isValid).toBe(false);
        expect(result.schemaCompliant).toBe(false);
        expect(result.errors).toContain(
          'Invalid agent schema: missing required field "id"',
        );
        expect(result.errors).toContain(
          'Invalid command schema: missing required field "name"',
        );
      });
    });

    describe('Cloud Compatibility Assessment', () => {
      it('should assess compatibility for supported IDEs', async () => {
        const compatiblePackage: TaptikPackage = {
          metadata: {
            title: 'Compatible Package',
            tags: ['test'],
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            sourceIde: 'claude-code',
            targetIdes: ['claude-code', 'kiro-ide'],
            complexityLevel: 'intermediate',
            componentCount: {
              agents: 2,
              commands: 3,
              mcpServers: 1,
              steeringRules: 2,
              instructions: 1,
            },
            features: ['gitIntegration', 'dockerSupport'],
            compatibility: ['claude-code', 'kiro-ide'],
            searchKeywords: ['test'],
            fileSize: 3072,
            checksum: 'compat123',
          },
          sanitizedConfig: {
            version: '1.0.0',
            sourceIde: 'claude-code',
            targetIdes: ['claude-code', 'kiro-ide'],
            data: {
              claudeCode: {
                local: {
                  settings: {
                    features: {
                      gitIntegration: true,
                      dockerSupport: true,
                    },
                  },
                },
              },
            },
            metadata: {
              timestamp: new Date().toISOString(),
            },
          },
          checksum: 'compat123',
          format: 'taptik-v1',
          compression: 'gzip',
          size: 3072,
          manifest: {
            files: [],
            directories: [],
            totalSize: 3072,
          },
        };

        const result = await service.validateForCloudUpload(compatiblePackage);

        expect(result.isValid).toBe(true);
        expect(result.cloudCompatible).toBe(true);
        expect(result.featureSupport.ide).toBe('claude-code');
        expect(result.featureSupport.supported).toContain('gitIntegration');
        expect(result.featureSupport.supported).toContain('dockerSupport');
      });

      it('should detect unsupported features for target IDEs', async () => {
        const unsupportedFeaturesPackage: TaptikPackage = {
          metadata: {
            title: 'Unsupported Features',
            tags: ['test'],
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            sourceIde: 'claude-code',
            targetIdes: ['kiro-ide'],
            complexityLevel: 'advanced',
            componentCount: {
              agents: 5,
              commands: 10,
              mcpServers: 3,
              steeringRules: 5,
              instructions: 2,
            },
            features: ['advancedAI', 'quantumComputing', 'neuralInterface'],
            compatibility: ['claude-code'],
            searchKeywords: ['test'],
            fileSize: 4096,
            checksum: 'unsupported123',
          },
          sanitizedConfig: {
            version: '1.0.0',
            sourceIde: 'claude-code',
            targetIdes: ['kiro-ide'],
            data: {
              claudeCode: {
                local: {
                  settings: {
                    features: {
                      advancedAI: true,
                      quantumComputing: true,
                      neuralInterface: true,
                    },
                  },
                },
              },
            },
            metadata: {
              timestamp: new Date().toISOString(),
            },
          },
          checksum: 'unsupported123',
          format: 'taptik-v1',
          compression: 'gzip',
          size: 4096,
          manifest: {
            files: [],
            directories: [],
            totalSize: 4096,
          },
        };

        const result = await service.validateForCloudUpload(
          unsupportedFeaturesPackage,
        );

        expect(result.isValid).toBe(true); // Still valid but with warnings
        expect(result.warnings).toContain(
          'Feature "advancedAI" may not be supported in kiro-ide',
        );
        expect(result.warnings).toContain(
          'Feature "quantumComputing" may not be supported in kiro-ide',
        );
        expect(result.warnings).toContain(
          'Feature "neuralInterface" may not be supported in kiro-ide',
        );
        expect(result.featureSupport.unsupported).toContain('advancedAI');
        expect(result.featureSupport.unsupported).toContain('quantumComputing');
        expect(result.featureSupport.unsupported).toContain('neuralInterface');
      });
    });

    describe('Validation Report Generation', () => {
      it('should generate comprehensive validation report for valid package', async () => {
        const validPackage: TaptikPackage = {
          metadata: {
            title: 'Report Test',
            tags: ['test', 'validation'],
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            complexityLevel: 'basic',
            componentCount: {
              agents: 1,
              commands: 1,
              mcpServers: 0,
              steeringRules: 0,
              instructions: 0,
            },
            features: ['gitIntegration'],
            compatibility: ['claude-code'],
            searchKeywords: ['test', 'validation'],
            fileSize: 1536,
            checksum: 'report123',
          },
          sanitizedConfig: {
            version: '1.0.0',
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            data: {},
            metadata: {
              timestamp: new Date().toISOString(),
            },
          },
          checksum: 'report123',
          format: 'taptik-v1',
          compression: 'gzip',
          size: 1536,
          manifest: {
            files: ['settings.json'],
            directories: ['.claude'],
            totalSize: 1536,
          },
        };

        const result = await service.validateForCloudUpload(validPackage);

        expect(result).toBeDefined();
        expect(result.recommendations).toBeDefined();
        expect(result.recommendations.length).toBeGreaterThan(0);
        expect(result.recommendations).toContain(
          'Package is ready for cloud upload',
        );
      });

      it('should generate actionable recommendations for invalid package', async () => {
        const problematicPackage: TaptikPackage = {
          metadata: {
            title: 'P', // Too short
            tags: [], // Empty tags
            version: '0.0.0', // Invalid version
            createdAt: 'invalid-date', // Invalid date
            sourceIde: 'unknown-ide', // Unknown IDE
            targetIdes: [], // Empty target IDEs
            complexityLevel: 'super-expert' as any, // Invalid complexity
            componentCount: {
              agents: -1, // Invalid count
              commands: -1,
              mcpServers: -1,
              steeringRules: -1,
              instructions: -1,
            },
            features: [],
            compatibility: [],
            searchKeywords: [],
            fileSize: -1, // Invalid size
            checksum: '', // Empty checksum
          },
          sanitizedConfig: {
            version: '1.0.0',
            sourceIde: 'unknown-ide',
            targetIdes: [],
            data: {},
            metadata: {
              timestamp: new Date().toISOString(),
            },
          },
          checksum: '',
          format: 'taptik-v1',
          compression: 'none',
          size: -1,
          manifest: {
            files: [],
            directories: [],
            totalSize: -1,
          },
        };

        const result = await service.validateForCloudUpload(problematicPackage);

        expect(result.isValid).toBe(false);
        expect(result.recommendations).toBeDefined();
        expect(result.recommendations.length).toBeGreaterThan(0);
        expect(result.recommendations).toContain(
          'Provide a descriptive title (minimum 3 characters)',
        );
        expect(result.recommendations).toContain(
          'Add at least one tag for discoverability',
        );
        expect(result.recommendations).toContain(
          'Use semantic versioning (e.g., 1.0.0)',
        );
        expect(result.recommendations).toContain(
          'Specify at least one target IDE',
        );
        expect(result.recommendations).toContain(
          'Generate a valid checksum for package integrity',
        );
      });
    });

    describe('Edge Cases and Error Handling', () => {
      it('should handle null package gracefully', async () => {
        const result = await service.validateForCloudUpload(null as any);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Invalid package: package is null or undefined',
        );
      });

      it('should handle undefined package gracefully', async () => {
        const result = await service.validateForCloudUpload(undefined as any);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Invalid package: package is null or undefined',
        );
      });

      it('should handle package with circular references', async () => {
        const circularPackage: any = {
          metadata: {
            title: 'Circular',
            tags: ['test'],
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            complexityLevel: 'minimal',
            componentCount: {
              agents: 0,
              commands: 0,
              mcpServers: 0,
              steeringRules: 0,
              instructions: 0,
            },
            features: [],
            compatibility: ['claude-code'],
            searchKeywords: ['test'],
            fileSize: 1024,
            checksum: 'circular123',
          },
          sanitizedConfig: {
            version: '1.0.0',
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            data: {},
            metadata: {
              timestamp: new Date().toISOString(),
            },
          },
          checksum: 'circular123',
          format: 'taptik-v1',
          compression: 'gzip',
          size: 1024,
          manifest: {
            files: [],
            directories: [],
            totalSize: 1024,
          },
        };

        // Create circular reference
        circularPackage.sanitizedConfig.data.self = circularPackage;

        const result = await service.validateForCloudUpload(circularPackage);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Invalid package structure: circular reference detected',
        );
      });

      it('should validate package with special characters in metadata', async () => {
        const specialCharsPackage: TaptikPackage = {
          metadata: {
            title: 'Test <script>alert("XSS")</script>', // XSS attempt
            description: 'Test & Description with "quotes" and \'apostrophes\'',
            tags: ['<tag>', '../../etc/passwd', 'normal-tag'],
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            complexityLevel: 'minimal',
            componentCount: {
              agents: 0,
              commands: 0,
              mcpServers: 0,
              steeringRules: 0,
              instructions: 0,
            },
            features: [],
            compatibility: ['claude-code'],
            searchKeywords: ['test'],
            fileSize: 1024,
            checksum: 'special123',
          },
          sanitizedConfig: {
            version: '1.0.0',
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            data: {},
            metadata: {
              timestamp: new Date().toISOString(),
            },
          },
          checksum: 'special123',
          format: 'taptik-v1',
          compression: 'gzip',
          size: 1024,
          manifest: {
            files: [],
            directories: [],
            totalSize: 1024,
          },
        };

        const result =
          await service.validateForCloudUpload(specialCharsPackage);

        expect(result.warnings).toContain(
          'Title contains potentially unsafe characters',
        );
        expect(result.warnings).toContain(
          'Tag "<tag>" contains potentially unsafe characters',
        );
        expect(result.warnings).toContain(
          'Tag "../../etc/passwd" contains potentially unsafe characters',
        );
      });

      it('should handle extremely large component counts', async () => {
        const largeComponentPackage: TaptikPackage = {
          metadata: {
            title: 'Large Component Package',
            tags: ['test'],
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            complexityLevel: 'expert',
            componentCount: {
              agents: 10000,
              commands: 50000,
              mcpServers: 1000,
              steeringRules: 25000,
              instructions: 500,
            },
            features: [],
            compatibility: ['claude-code'],
            searchKeywords: ['test'],
            fileSize: 10485760, // 10MB
            checksum: 'large123',
          },
          sanitizedConfig: {
            version: '1.0.0',
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            data: {},
            metadata: {
              timestamp: new Date().toISOString(),
            },
          },
          checksum: 'large123',
          format: 'taptik-v1',
          compression: 'gzip',
          size: 10485760,
          manifest: {
            files: [],
            directories: [],
            totalSize: 10485760,
          },
        };

        const result = await service.validateForCloudUpload(
          largeComponentPackage,
        );

        expect(result.warnings).toContain(
          'Unusually high number of agents (10000)',
        );
        expect(result.warnings).toContain(
          'Unusually high number of commands (50000)',
        );
        expect(result.recommendations).toContain(
          'Consider splitting into multiple smaller packages for better manageability',
        );
      });
    });

    describe('Performance and Optimization', () => {
      it('should validate large packages within reasonable time', async () => {
        const largePackage: TaptikPackage = {
          metadata: {
            title: 'Performance Test',
            tags: Array(100).fill('tag'),
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            complexityLevel: 'expert',
            componentCount: {
              agents: 100,
              commands: 200,
              mcpServers: 50,
              steeringRules: 150,
              instructions: 10,
            },
            features: Array(50).fill('feature'),
            compatibility: ['claude-code'],
            searchKeywords: Array(200).fill('keyword'),
            fileSize: 8388608, // 8MB
            checksum: 'perf123',
          },
          sanitizedConfig: {
            version: '1.0.0',
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            data: {
              claudeCode: {
                local: {
                  agents: Array(100).fill({
                    id: 'agent',
                    name: 'Agent',
                    prompt: 'Test',
                  }),
                  commands: Array(200).fill({
                    name: 'cmd',
                    command: 'echo test',
                  }),
                  mcpServers: {
                    servers: Array(50).fill({
                      name: 'server',
                      protocol: 'http',
                    }),
                  },
                  steeringRules: Array(150).fill({
                    pattern: '*.ts',
                    rule: 'typescript',
                  }),
                },
              },
            },
            metadata: {
              timestamp: new Date().toISOString(),
            },
          },
          checksum: 'perf123',
          format: 'taptik-v1',
          compression: 'gzip',
          size: 8388608,
          manifest: {
            files: Array(500).fill('file.json'),
            directories: Array(100).fill('directory'),
            totalSize: 8388608,
          },
        };

        const startTime = Date.now();
        const result = await service.validateForCloudUpload(largePackage);
        const endTime = Date.now();
        const validationTime = endTime - startTime;

        expect(result).toBeDefined();
        expect(validationTime).toBeLessThan(1000); // Should complete within 1 second
      });

      it('should cache validation results for identical packages', async () => {
        const package1: TaptikPackage = {
          metadata: {
            title: 'Cache Test',
            tags: ['test'],
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            complexityLevel: 'minimal',
            componentCount: {
              agents: 0,
              commands: 0,
              mcpServers: 0,
              steeringRules: 0,
              instructions: 0,
            },
            features: [],
            compatibility: ['claude-code'],
            searchKeywords: ['test'],
            fileSize: 1024,
            checksum: 'cache123',
          },
          sanitizedConfig: {
            version: '1.0.0',
            sourceIde: 'claude-code',
            targetIdes: ['claude-code'],
            data: {},
            metadata: {
              timestamp: new Date().toISOString(),
            },
          },
          checksum: 'cache123',
          format: 'taptik-v1',
          compression: 'gzip',
          size: 1024,
          manifest: {
            files: [],
            directories: [],
            totalSize: 1024,
          },
        };

        // First validation
        const result1 = await service.validateForCloudUpload(package1);

        // Second validation with same package
        const startTime = Date.now();
        const result2 = await service.validateForCloudUpload(package1);
        const endTime = Date.now();
        const cachedValidationTime = endTime - startTime;

        expect(result1).toEqual(result2);
        expect(cachedValidationTime).toBeLessThan(10); // Cached result should be very fast
      });
    });
  });

  describe('Helper Methods', () => {
    describe('validateSchemaCompliance', () => {
      it('should validate correct TaptikContext schema', () => {
        const validContext = {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          data: {},
          metadata: {
            timestamp: new Date().toISOString(),
          },
        };

        const result = service['validateSchemaCompliance'](validContext);

        expect(result.isCompliant).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect missing required fields in TaptikContext', () => {
        const invalidContext = {
          sourceIde: 'claude-code',
          // Missing version and targetIdes
          data: {},
          metadata: {
            timestamp: new Date().toISOString(),
          },
        };

        const result = service['validateSchemaCompliance'](invalidContext);

        expect(result.isCompliant).toBe(false);
        expect(result.errors).toContain('Missing required field: version');
        expect(result.errors).toContain('Missing required field: targetIdes');
      });
    });

    describe('checkCloudCompatibility', () => {
      it('should assess cloud storage compatibility', () => {
        const metadata: CloudMetadata = {
          title: 'Test Config',
          tags: ['test'],
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          sourceIde: 'claude-code',
          targetIdes: ['claude-code', 'kiro-ide'],
          complexityLevel: 'basic',
          componentCount: {
            agents: 0,
            commands: 0,
            mcpServers: 0,
            steeringRules: 0,
            instructions: 0,
          },
          features: ['gitIntegration', 'dockerSupport'],
          compatibility: ['claude-code'],
          searchKeywords: ['test'],
          fileSize: 1024,
          checksum: 'abc123',
        };

        const result = service['checkCloudCompatibility'](metadata);

        expect(result.compatible).toBe(true);
        expect(result.supportedFeatures).toContain('gitIntegration');
        expect(result.supportedFeatures).toContain('dockerSupport');
      });

      it('should identify unsupported features', () => {
        const metadata: CloudMetadata = {
          title: 'Test Config',
          tags: ['test'],
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          sourceIde: 'claude-code',
          targetIdes: ['unknown-ide'],
          complexityLevel: 'basic',
          componentCount: {
            agents: 0,
            commands: 0,
            mcpServers: 0,
            steeringRules: 0,
            instructions: 0,
          },
          features: ['unknownFeature', 'experimentalFeature'],
          compatibility: ['unknown-ide'],
          searchKeywords: ['test'],
          fileSize: 1024,
          checksum: 'abc123',
        };

        const result = service['checkCloudCompatibility'](metadata);

        expect(result.compatible).toBe(true); // Still compatible but with warnings
        expect(result.unsupportedFeatures).toContain('unknownFeature');
        expect(result.unsupportedFeatures).toContain('experimentalFeature');
        expect(result.warnings.length).toBeGreaterThan(0);
      });
    });

    describe('validateSizeLimit', () => {
      it('should validate package within size limit', () => {
        const result = service['validateSizeLimit'](5242880); // 5MB

        expect(result.withinLimit).toBe(true);
        expect(result.current).toBe(5242880);
        expect(result.maximum).toBe(10485760); // 10MB
        expect(result.percentage).toBe(50);
      });

      it('should reject package exceeding size limit', () => {
        const result = service['validateSizeLimit'](20971520); // 20MB

        expect(result.withinLimit).toBe(false);
        expect(result.current).toBe(20971520);
        expect(result.maximum).toBe(10485760); // 10MB
        expect(result.percentage).toBe(200);
      });

      it('should handle premium user size limits', () => {
        const result = service['validateSizeLimit'](52428800, true); // 50MB, premium user

        expect(result.withinLimit).toBe(true);
        expect(result.current).toBe(52428800);
        expect(result.maximum).toBe(104857600); // 100MB for premium
        expect(result.percentage).toBe(50);
      });
    });

    describe('generateRecommendations', () => {
      it('should generate recommendations based on validation errors', () => {
        const validationResult: ValidationResult = {
          isValid: false,
          errors: [
            'Missing required field: title',
            'Package size exceeds maximum limit',
            'Checksum mismatch',
          ],
          warnings: [],
          cloudCompatible: false,
          schemaCompliant: false,
          sizeLimit: {
            current: 20971520,
            maximum: 10485760,
            withinLimit: false,
          },
          featureSupport: {
            ide: 'claude-code',
            supported: [],
            unsupported: [],
          },
          recommendations: [],
        };

        const recommendations =
          service['generateRecommendations'](validationResult);

        expect(recommendations).toContain(
          'Add a descriptive title to your package',
        );
        expect(recommendations).toContain(
          'Reduce package size or consider splitting into multiple packages',
        );
        expect(recommendations).toContain(
          'Regenerate package checksum to ensure integrity',
        );
      });

      it('should generate positive recommendations for valid package', () => {
        const validationResult: ValidationResult = {
          isValid: true,
          errors: [],
          warnings: [],
          cloudCompatible: true,
          schemaCompliant: true,
          sizeLimit: {
            current: 1024,
            maximum: 10485760,
            withinLimit: true,
          },
          featureSupport: {
            ide: 'claude-code',
            supported: ['gitIntegration'],
            unsupported: [],
          },
          recommendations: [],
        };

        const recommendations =
          service['generateRecommendations'](validationResult);

        expect(recommendations).toContain('Package is ready for cloud upload');
        expect(recommendations).toContain(
          'All validation checks passed successfully',
        );
      });
    });
  });
});
