import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach } from 'vitest';

import {
  SanitizationService,
  SanitizationReport,
} from './sanitization.service';

describe('SanitizationService', () => {
  let service: SanitizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SanitizationService],
    }).compile();

    service = module.get<SanitizationService>(SanitizationService);
  });

  describe('sanitizePackage', () => {
    it('should detect and remove API keys', async () => {
      const testContent = {
        config: {
          api_key: 'test_key_XXXXXXXXXXXXXXXXXXXXX',
          apiKey: 'abc123def456ghi789jkl012mno345',
        },
      };
      const buffer = Buffer.from(JSON.stringify(testContent));

      const result = await service.sanitizePackage(buffer);

      expect(result.level).toBe('warning');
      expect(result.report.highSeverityCount).toBeGreaterThan(0);
      expect(result.report.matches).toContainEqual(
        expect.objectContaining({
          pattern: 'API Key',
          severity: 'high',
        }),
      );

      const sanitizedContent = JSON.parse(result.sanitizedBuffer.toString());
      expect(sanitizedContent.config.api_key).toBe('API_KEY_REMOVED');
      expect(sanitizedContent.config.apiKey).toBe('API_KEY_REMOVED');
    });

    it('should detect and remove passwords', async () => {
      const testContent = {
        database: {
          password: 'SuperSecretPassword123!',
          passwd: 'AnotherPassword456',
        },
      };
      const buffer = Buffer.from(JSON.stringify(testContent));

      const result = await service.sanitizePackage(buffer);

      expect(result.level).toBe('warning');
      expect(result.report.matches).toContainEqual(
        expect.objectContaining({
          pattern: 'Password',
          severity: 'high',
        }),
      );

      const sanitizedContent = JSON.parse(result.sanitizedBuffer.toString());
      expect(sanitizedContent.database.password).toBe('PASSWORD_REMOVED');
      expect(sanitizedContent.database.passwd).toBe('PASSWORD_REMOVED');
    });

    it('should detect and remove database URLs', async () => {
      const testContent = {
        connections: {
          database_url: 'postgres://user:pass@localhost:5432/dbname',
          mongodb_uri: 'mongodb+srv://user:pass@cluster.mongodb.net/db',
          mysql_url: 'mysql://root:password@localhost:3306/database',
        },
      };
      const buffer = Buffer.from(JSON.stringify(testContent));

      const result = await service.sanitizePackage(buffer);

      expect(result.level).toBe('warning');
      expect(result.report.highSeverityCount).toBeGreaterThan(0);

      const sanitizedContent = JSON.parse(result.sanitizedBuffer.toString());
      expect(sanitizedContent.connections.database_url).toBe(
        'DATABASE_URL_REMOVED',
      );
      expect(sanitizedContent.connections.mongodb_uri).toBe(
        'MONGODB_URI_REMOVED',
      );
      expect(sanitizedContent.connections.mysql_url).toBe('MYSQL_URI_REMOVED');
    });

    it('should detect and remove AWS credentials', async () => {
      const testContent = {
        aws: {
          access_key: 'AKIAIOSFODNN7EXAMPLE',
          aws_secret_access_key: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        },
      };
      const buffer = Buffer.from(JSON.stringify(testContent));

      const result = await service.sanitizePackage(buffer);

      expect(result.level).toBe('warning');
      expect(result.report.matches).toContainEqual(
        expect.objectContaining({
          pattern: 'AWS Access Key',
          severity: 'high',
        }),
      );

      const sanitizedContent = JSON.parse(result.sanitizedBuffer.toString());
      expect(sanitizedContent.aws.access_key).toBe('AWS_ACCESS_KEY_REMOVED');
      expect(sanitizedContent.aws.aws_secret_access_key).toBe(
        'AWS_SECRET_KEY_REMOVED',
      );
    });

    it('should detect and remove Supabase credentials', async () => {
      const testContent = {
        supabase: {
          url: 'https://xyzproject.supabase.co',
          anon_key:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvenNxbGVueHZ5aXl4Y2VwaHNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDU3MjM5NzUsImV4cCI6MTk2MTI5OTk3NX0.1234567890abcdef',
        },
      };
      const buffer = Buffer.from(JSON.stringify(testContent));

      const result = await service.sanitizePackage(buffer);

      const sanitizedContent = JSON.parse(result.sanitizedBuffer.toString());
      expect(sanitizedContent.supabase.url).toBe('SUPABASE_URL_REMOVED');
      expect(sanitizedContent.supabase.anon_key).toBe('SUPABASE_KEY_REMOVED');
    });

    it('should detect and mask email addresses when maskEmails is true', async () => {
      const testContent = {
        contact: {
          email: 'user@example.com',
          support: 'support@company.org',
        },
      };
      const buffer = Buffer.from(JSON.stringify(testContent));

      const result = await service.sanitizePackage(buffer, {
        maskEmails: true,
      });

      expect(result.report.lowSeverityCount).toBeGreaterThan(0);
      const sanitizedContent = JSON.parse(result.sanitizedBuffer.toString());
      expect(sanitizedContent.contact.email).toBe('EMAIL_REMOVED');
      expect(sanitizedContent.contact.support).toBe('EMAIL_REMOVED');
    });

    it('should not remove emails when maskEmails is false', async () => {
      const testContent = {
        contact: {
          email: 'user@example.com',
        },
      };
      const buffer = Buffer.from(JSON.stringify(testContent));

      const result = await service.sanitizePackage(buffer, {
        maskEmails: false,
      });

      const sanitizedContent = JSON.parse(result.sanitizedBuffer.toString());
      expect(sanitizedContent.contact.email).toBe('user@example.com');
    });

    it('should detect GitHub tokens', async () => {
      const testContent = {
        github: {
          token: 'ghp_1234567890abcdef1234567890abcdef1234',
        },
      };
      const buffer = Buffer.from(JSON.stringify(testContent));

      const result = await service.sanitizePackage(buffer);

      expect(result.report.matches).toContainEqual(
        expect.objectContaining({
          pattern: 'GitHub Token',
          severity: 'high',
        }),
      );

      const sanitizedContent = JSON.parse(result.sanitizedBuffer.toString());
      expect(sanitizedContent.github.token).toBe('GITHUB_TOKEN_REMOVED');
    });

    it('should handle nested objects and arrays', async () => {
      const testContent = {
        environments: [
          {
            name: 'dev',
            config: {
              api_key: 'dev_key_1234567890abcdef',
              database: {
                password: 'devPassword123',
              },
            },
          },
          {
            name: 'prod',
            config: {
              api_key: 'prod_key_0987654321fedcba',
              database: {
                password: 'prodPassword456',
              },
            },
          },
        ],
      };
      const buffer = Buffer.from(JSON.stringify(testContent));

      const result = await service.sanitizePackage(buffer);

      expect(result.level).toBe('warning');
      expect(result.report.highSeverityCount).toBeGreaterThan(0);

      const sanitizedContent = JSON.parse(result.sanitizedBuffer.toString());
      expect(sanitizedContent.environments[0].config.api_key).toBe(
        'API_KEY_REMOVED',
      );
      expect(sanitizedContent.environments[0].config.database.password).toBe(
        'PASSWORD_REMOVED',
      );
      expect(sanitizedContent.environments[1].config.api_key).toBe(
        'API_KEY_REMOVED',
      );
      expect(sanitizedContent.environments[1].config.database.password).toBe(
        'PASSWORD_REMOVED',
      );
    });

    it('should return "safe" level when no sensitive data is found', async () => {
      const testContent = {
        app: {
          name: 'My Application',
          version: '1.0.0',
          description: 'A safe configuration',
        },
      };
      const buffer = Buffer.from(JSON.stringify(testContent));

      const result = await service.sanitizePackage(buffer);

      expect(result.level).toBe('safe');
      expect(result.report.totalIssues).toBe(0);
      expect(result.report.highSeverityCount).toBe(0);
      expect(result.report.mediumSeverityCount).toBe(0);
      expect(result.report.lowSeverityCount).toBe(0);
    });

    it('should return "blocked" level in strict mode with high severity issues', async () => {
      const testContent = {
        secret: 'SuperSecret123456',
      };
      const buffer = Buffer.from(JSON.stringify(testContent));

      const result = await service.sanitizePackage(buffer, {
        strictMode: true,
      });

      expect(result.level).toBe('blocked');
      expect(result.report.highSeverityCount).toBeGreaterThan(0);
    });

    it('should handle plain text content', async () => {
      const textContent =
        'This text contains an api_key: sk_test_1234567890abcdef and a password: MySecret123';
      const buffer = Buffer.from(textContent);

      const result = await service.sanitizePackage(buffer);

      expect(result.level).toBe('warning');
      expect(result.report.highSeverityCount).toBeGreaterThan(0);

      const sanitizedText = result.sanitizedBuffer.toString();
      expect(sanitizedText).toContain('API_KEY_REMOVED');
      expect(sanitizedText).toContain('PASSWORD_REMOVED');
    });

    it('should generate checksum for sanitized content', async () => {
      const testContent = {
        config: 'test',
      };
      const buffer = Buffer.from(JSON.stringify(testContent));

      const result = await service.sanitizePackage(buffer);

      expect(result.report.checksum).toBeDefined();
      expect(result.report.checksum).toMatch(/^[\da-f]{64}$/); // SHA256 hash format
    });

    it('should track sanitized locations', async () => {
      const testContent = {
        level1: {
          api_key: 'test_key_123456789',
          level2: {
            password: 'secret123',
          },
        },
      };
      const buffer = Buffer.from(JSON.stringify(testContent));

      const result = await service.sanitizePackage(buffer);

      expect(result.report.sanitizedLocations).toContain('level1.api_key');
      expect(result.report.sanitizedLocations).toContain(
        'level1.level2.password',
      );
    });

    it('should handle sensitive data in object keys', async () => {
      const testContent = {
        api_key_field: 'value',
        password_field: 'another_value',
      };
      const buffer = Buffer.from(JSON.stringify(testContent));

      const result = await service.sanitizePackage(buffer);

      // Keys themselves might be flagged as containing sensitive patterns
      expect(result.report.matches.length).toBeGreaterThan(0);
    });
  });

  describe('generateAutoTags', () => {
    it('should detect platform tags', async () => {
      const content = {
        platform: 'claude-code',
        config: {
          kiro_ide: true,
          cursor_settings: {},
        },
      };

      const tags = await service.generateAutoTags(content);

      expect(tags).toContain('claude-code');
      expect(tags).toContain('kiro');
      expect(tags).toContain('cursor');
    });

    it('should detect technology tags', async () => {
      const content = {
        dependencies: {
          react: '18.0.0',
          typescript: '5.0.0',
          '@angular/core': '15.0.0',
        },
        scripts: {
          docker: 'docker build',
          'test:jest': 'jest',
        },
      };

      const tags = await service.generateAutoTags(content);

      expect(tags).toContain('react');
      expect(tags).toContain('typescript');
      expect(tags).toContain('angular');
      expect(tags).toContain('docker');
      expect(tags).toContain('testing');
    });

    it('should detect component tags', async () => {
      const content = {
        modules: {
          auth: {
            jwt: true,
            oauth: true,
          },
          api: {
            rest: true,
            graphql: true,
          },
          database: {
            postgres: true,
            mongodb: true,
          },
        },
      };

      const tags = await service.generateAutoTags(content);

      expect(tags).toContain('authentication');
      expect(tags).toContain('api');
      expect(tags).toContain('database');
    });

    it('should add size-based tags', async () => {
      const smallContent = { small: 'data' };
      const mediumContent = { data: 'x'.repeat(50000) };
      const largeContent = { data: 'x'.repeat(150000) };

      const smallTags = await service.generateAutoTags(smallContent);
      const mediumTags = await service.generateAutoTags(mediumContent);
      const largeTags = await service.generateAutoTags(largeContent);

      expect(smallTags).toContain('small');
      expect(mediumTags).toContain('medium');
      expect(largeTags).toContain('large');
    });

    it('should add complexity tags based on depth', async () => {
      const simpleContent = { level1: 'value' };
      const moderateContent = {
        level1: {
          level2: {
            level3: {
              level4: 'value',
            },
          },
        },
      };
      const complexContent = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  level6: 'value',
                },
              },
            },
          },
        },
      };

      const simpleTags = await service.generateAutoTags(simpleContent);
      const moderateTags = await service.generateAutoTags(moderateContent);
      const complexTags = await service.generateAutoTags(complexContent);

      expect(simpleTags).toContain('simple');
      expect(moderateTags).toContain('moderate');
      expect(complexTags).toContain('complex');
    });

    it('should add version tags', async () => {
      const content = {
        version: '2.5.3',
      };

      const tags = await service.generateAutoTags(content);

      expect(tags).toContain('v2');
    });

    it('should limit tags to 20', async () => {
      const content = {
        // Content that would generate many tags
        platform: 'claude-code',
        kiro: true,
        cursor: true,
        vscode: true,
        react: true,
        vue: true,
        angular: true,
        typescript: true,
        javascript: true,
        python: true,
        java: true,
        golang: true,
        rust: true,
        docker: true,
        kubernetes: true,
        aws: true,
        gcp: true,
        azure: true,
        auth: true,
        api: true,
        database: true,
        testing: true,
        cicd: true,
        monitoring: true,
        security: true,
      };

      const tags = await service.generateAutoTags(content);

      expect(tags.length).toBeLessThanOrEqual(20);
    });

    it('should handle empty content', async () => {
      const tags = await service.generateAutoTags({});

      expect(tags).toBeDefined();
      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThanOrEqual(1); // At least size tag
    });
  });

  describe('validateSanitizationReport', () => {
    it('should validate a correct report', () => {
      const report: SanitizationReport = {
        level: 'warning',
        totalIssues: 5,
        highSeverityCount: 2,
        mediumSeverityCount: 2,
        lowSeverityCount: 1,
        matches: [],
        sanitizedLocations: [],
        checksum: 'abc123',
        processedAt: new Date(),
      };

      const isValid = service.validateSanitizationReport(report);

      expect(isValid).toBe(true);
    });

    it('should reject report with incorrect counts', () => {
      const report: SanitizationReport = {
        level: 'warning',
        totalIssues: 10, // Incorrect total
        highSeverityCount: 2,
        mediumSeverityCount: 2,
        lowSeverityCount: 1,
        matches: [],
        sanitizedLocations: [],
        checksum: 'abc123',
        processedAt: new Date(),
      };

      const isValid = service.validateSanitizationReport(report);

      expect(isValid).toBe(false);
    });

    it('should reject report with inconsistent level', () => {
      const report: SanitizationReport = {
        level: 'safe', // Should not be safe with high severity issues
        totalIssues: 2,
        highSeverityCount: 2,
        mediumSeverityCount: 0,
        lowSeverityCount: 0,
        matches: [],
        sanitizedLocations: [],
        checksum: 'abc123',
        processedAt: new Date(),
      };

      const isValid = service.validateSanitizationReport(report);

      expect(isValid).toBe(false);
    });

    it('should reject report with missing fields', () => {
      const report = {
        level: 'safe',
        totalIssues: 0,
        // Missing other required fields
      } as any;

      const isValid = service.validateSanitizationReport(report);

      expect(isValid).toBe(false);
    });
  });

  describe('getMaskedValue', () => {
    it('should mask email addresses keeping domain', () => {
      const pattern = {
        name: 'Email Address',
        pattern: /test/,
        severity: 'low' as const,
        replacement: 'EMAIL_REMOVED',
      };

      const masked = service.getMaskedValue('user@example.com', pattern);

      expect(masked).toBe('***@example.com');
    });

    it('should use replacement for non-email patterns', () => {
      const pattern = {
        name: 'API Key',
        pattern: /test/,
        severity: 'high' as const,
        replacement: 'API_KEY_REMOVED',
      };

      const masked = service.getMaskedValue('sk_test_123456', pattern);

      expect(masked).toBe('API_KEY_REMOVED');
    });

    it('should return original value if no replacement', () => {
      const pattern = {
        name: 'Test Pattern',
        pattern: /test/,
        severity: 'low' as const,
      };

      const masked = service.getMaskedValue('test_value', pattern);

      expect(masked).toBe('test_value');
    });
  });

  describe('edge cases and security', () => {
    it('should handle malformed JSON gracefully', async () => {
      const buffer = Buffer.from('not a valid json { broken: }');

      const result = await service.sanitizePackage(buffer);

      expect(result).toBeDefined();
      expect(result.sanitizedBuffer).toBeDefined();
      expect(result.report).toBeDefined();
    });

    it('should handle buffer with null bytes', async () => {
      const content = 'test\0content\0with\0nulls';
      const buffer = Buffer.from(content);

      const result = await service.sanitizePackage(buffer);

      expect(result).toBeDefined();
      expect(result.sanitizedBuffer).toBeDefined();
    });

    it('should handle very large nested objects without stack overflow', async () => {
      let deepObject: any = { value: 'bottom' };
      for (let i = 0; i < 100; i++) {
        deepObject = { nested: deepObject };
      }
      const buffer = Buffer.from(JSON.stringify(deepObject));

      const result = await service.sanitizePackage(buffer);

      expect(result).toBeDefined();
      expect(result.report).toBeDefined();
    });

    it('should handle circular references in auto-tag generation', async () => {
      const content: any = { a: {} };
      content.a.b = content; // Create circular reference

      // This should not throw an error
      const tags = await service.generateAutoTags(content);

      expect(tags).toBeDefined();
      expect(Array.isArray(tags)).toBe(true);
    });

    it('should truncate sensitive values in matches for security', async () => {
      const longSecret = 'x'.repeat(100);
      const testContent = {
        secret_key: longSecret,
      };
      const buffer = Buffer.from(JSON.stringify(testContent));

      const result = await service.sanitizePackage(buffer);

      const secretMatch = result.report.matches.find(
        (m) => m.pattern === 'Secret Key',
      );
      expect(secretMatch).toBeDefined();
      expect(secretMatch!.value).toHaveLength(23); // 20 chars + '...'
      expect(secretMatch!.value.endsWith('...')).toBe(true);
    });

    it('should handle special characters in patterns', async () => {
      const testContent = {
        config: {
          special$key: 'value',
          'another.key': 'test',
          'key[with]brackets': 'data',
        },
      };
      const buffer = Buffer.from(JSON.stringify(testContent));

      const result = await service.sanitizePackage(buffer);

      expect(result).toBeDefined();
      expect(result.report).toBeDefined();
    });

    it('should not modify original buffer', async () => {
      const testContent = {
        api_key: 'sk_test_1234567890abcdef',
      };
      const originalBuffer = Buffer.from(JSON.stringify(testContent));
      const bufferCopy = Buffer.from(originalBuffer);

      await service.sanitizePackage(originalBuffer);

      expect(originalBuffer.equals(bufferCopy)).toBe(true);
    });
  });

  describe('options handling', () => {
    it('should respect removeSecrets option', async () => {
      const testContent = {
        secret: 'MySecret123456',
      };
      const buffer = Buffer.from(JSON.stringify(testContent));

      const resultWithRemoval = await service.sanitizePackage(buffer, {
        removeSecrets: true,
      });
      const resultWithoutRemoval = await service.sanitizePackage(buffer, {
        removeSecrets: false,
      });

      const sanitizedWithRemoval = JSON.parse(
        resultWithRemoval.sanitizedBuffer.toString(),
      );
      const sanitizedWithoutRemoval = JSON.parse(
        resultWithoutRemoval.sanitizedBuffer.toString(),
      );

      expect(sanitizedWithRemoval.secret).toBe('SECRET_REMOVED');
      expect(sanitizedWithoutRemoval.secret).toBe('MySecret123456');
    });

    it('should merge options with defaults correctly', async () => {
      const testContent = {
        email: 'test@example.com',
        secret: 'secret123456',
      };
      const buffer = Buffer.from(JSON.stringify(testContent));

      // Test with partial options
      const result = await service.sanitizePackage(buffer, {
        strictMode: true,
        // Other options should use defaults
      });

      expect(result.level).toBeDefined();
      expect(result.report).toBeDefined();
    });
  });
});
