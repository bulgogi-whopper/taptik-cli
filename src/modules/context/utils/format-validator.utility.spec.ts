import { describe, it, expect } from 'vitest';

import {
  ValidationErrorCode,
  SecuritySeverity,
  SecurityAction,
} from '../constants';
import {
  TaptikContext,
  DeployableContext,
} from '../interfaces/taptik-context.interface';

import { FormatValidator } from './format-validator.utility';

describe('FormatValidator', () => {
  describe('validateExportFormat', () => {
    it('should validate a valid TaptikContext', () => {
      const validContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          sourceIde: 'claude-code',
          targetIdes: ['kiro-ide', 'cursor-ide'],
          title: 'Test Configuration',
          description: 'A test configuration for validation',
          tags: ['test', 'validation'],
        },
        content: {
          personal: {
            profile: {
              name: 'Test User',
              email: 'test@example.com',
            },
          },
          project: {
            info: {
              name: 'Test Project',
              type: 'backend',
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

      const result = FormatValidator.validateExportFormat(validContext);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid version format', () => {
      const invalidContext: TaptikContext = {
        metadata: {
          version: 'invalid-version',
          exportedAt: new Date().toISOString(),
          sourceIde: 'claude-code',
          targetIdes: ['kiro-ide'],
        },
        content: {},
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: {
            passed: true,
            warnings: [],
          },
        },
      };

      const result = FormatValidator.validateExportFormat(invalidContext);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: ValidationErrorCode.INVALID_VERSION,
        }),
      );
    });

    it('should detect unsupported IDE', () => {
      const invalidContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          sourceIde: 'unsupported-ide' as any,
          targetIdes: ['kiro-ide'],
        },
        content: {},
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: {
            passed: true,
            warnings: [],
          },
        },
      };

      const result = FormatValidator.validateExportFormat(invalidContext);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: ValidationErrorCode.UNSUPPORTED_IDE,
        }),
      );
    });

    it('should detect title length violation', () => {
      const longTitle = 'a'.repeat(101); // Exceeds 100 character limit
      const invalidContext: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          sourceIde: 'claude-code',
          targetIdes: ['kiro-ide'],
          title: longTitle,
        },
        content: {},
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: {
            passed: true,
            warnings: [],
          },
        },
      };

      const result = FormatValidator.validateExportFormat(invalidContext);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: ValidationErrorCode.INVALID_FORMAT,
          field: 'metadata.title',
        }),
      );
    });

    it('should detect sensitive data patterns', () => {
      const contextWithSecrets: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          sourceIde: 'claude-code',
          targetIdes: ['kiro-ide'],
        },
        content: {
          tools: {
            custom_tools: [
              {
                name: 'test',
                command: 'echo',
                description: 'API_KEY=secret123',
              },
            ],
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

      const result = FormatValidator.validateExportFormat(contextWithSecrets);

      expect(result.isValid).toBe(false);
      expect(result.securityIssues.length).toBeGreaterThan(0);
      expect(result.securityIssues[0]).toMatchObject({
        severity: SecuritySeverity.HIGH,
        action: SecurityAction.FLAGGED,
      });
    });
  });

  describe('validateDeployFormat', () => {
    it('should validate a valid DeployableContext', () => {
      const validContext: DeployableContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          sourceIde: 'claude-code',
          targetIdes: ['kiro-ide'],
        },
        content: {},
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: {
            passed: true,
            warnings: [],
          },
        },
        cloudMetadata: {
          configId: 'test-config-id',
          storagePath: 'public/claude-code/test.taptik',
          isPublic: true,
          uploadedBy: 'user-123',
          uploadedAt: new Date().toISOString(),
        },
      };

      const result = FormatValidator.validateDeployFormat(validContext);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing cloud metadata', () => {
      const invalidContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          sourceIde: 'claude-code',
          targetIdes: ['kiro-ide'],
        },
        content: {},
        security: {
          hasApiKeys: false,
          filteredFields: [],
          scanResults: {
            passed: true,
            warnings: [],
          },
        },
      } as DeployableContext;

      const result = FormatValidator.validateDeployFormat(invalidContext);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: ValidationErrorCode.MISSING_METADATA,
          field: 'cloudMetadata',
        }),
      );
    });
  });

  describe('isValidFormat', () => {
    it('should quickly validate basic structure', () => {
      const validContext = {
        metadata: {
          version: '1.0.0',
          sourceIde: 'claude-code',
          targetIdes: ['kiro-ide'],
        },
        content: {},
        security: {},
      };

      expect(FormatValidator.isValidFormat(validContext)).toBe(true);
    });

    it('should reject invalid structure', () => {
      expect(FormatValidator.isValidFormat(null)).toBe(false);
      expect(FormatValidator.isValidFormat({})).toBe(false);
      expect(FormatValidator.isValidFormat({ metadata: {} })).toBe(false);
    });
  });

  describe('sanitizeContext', () => {
    it('should remove sensitive data', () => {
      const contextWithSecrets: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          sourceIde: 'claude-code',
          targetIdes: ['kiro-ide'],
        },
        content: {
          tools: {
            custom_tools: [
              {
                name: 'test',
                command: 'echo',
                description: 'api_key=secret123',
              },
            ],
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

      const sanitized = FormatValidator.sanitizeContext(contextWithSecrets);

      expect(sanitized.security.hasApiKeys).toBe(true);
      expect(sanitized.security.filteredFields.length).toBeGreaterThan(0);
      expect(JSON.stringify(sanitized)).toContain('[REDACTED]');
      expect(JSON.stringify(sanitized)).not.toContain('secret123');
    });
  });
});
