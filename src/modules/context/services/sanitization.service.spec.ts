import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach } from 'vitest';

import { SanitizationService } from './sanitization.service';

describe('SanitizationService', () => {
  let service: SanitizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SanitizationService],
    }).compile();

    service = module.get<SanitizationService>(SanitizationService);
  });

  describe('sanitizeForCloudUpload', () => {
    it('should remove API keys from configuration', () => {
      const config = {
        apiKey: 'sk-1234567890abcdef',
        OPENAI_API_KEY: 'sk-test-key',
        settings: {
          api_key: 'secret-key-123',
        },
      };

      const result = service.sanitizeForCloudUpload(config);
      const sanitized = result.sanitizedData as typeof config;

      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.OPENAI_API_KEY).toBe('[REDACTED]');
      expect(sanitized.settings.api_key).toBe('[REDACTED]');
      expect(result.securityLevel).toBe('warning');
      expect(result.findings).toContain('API keys detected and removed');
    });

    it('should remove tokens from configuration', () => {
      const config = {
        github_token: 'ghp_1234567890abcdef',
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        auth: {
          bearer_token: 'Bearer abc123',
        },
      };

      const result = service.sanitizeForCloudUpload(config);
      const sanitized = result.sanitizedData as typeof config;

      expect(sanitized.github_token).toBe('[REDACTED]');
      expect(sanitized.accessToken).toBe('[REDACTED]');
      expect(sanitized.auth.bearer_token).toBe('[REDACTED]');
      expect(result.findings).toContain('Tokens detected and removed');
    });

    it('should remove passwords from configuration', () => {
      const config = {
        password: 'mySecretPassword',
        db_password: 'postgres123',
        credentials: {
          passwd: 'admin',
          pass: 'secret',
        },
      };

      const result = service.sanitizeForCloudUpload(config);
      const sanitized = result.sanitizedData as typeof config;

      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.db_password).toBe('[REDACTED]');
      expect(sanitized.credentials.passwd).toBe('[REDACTED]');
      expect(sanitized.credentials.pass).toBe('[REDACTED]');
      expect(result.findings).toContain('Passwords detected and removed');
    });

    it('should sanitize sensitive file paths', () => {
      const config = {
        homePath: '/Users/johndoe/Documents/private',
        sshKey: '/home/user/.ssh/id_rsa',
        privateFile: 'C:\\Users\\Admin\\Desktop\\secrets.txt',
      };

      const result = service.sanitizeForCloudUpload(config);
      const sanitized = result.sanitizedData as typeof config;

      expect(sanitized.homePath).toMatch(/^~\/[^/]+/);
      expect(sanitized.sshKey).toBe('~/.ssh/[REDACTED]');
      expect(sanitized.privateFile).toBe('[REDACTED_PATH]');
      expect(result.findings).toContain('Sensitive file paths sanitized');
    });

    it('should remove email addresses for privacy', () => {
      const config = {
        email: 'john.doe@example.com',
        contact: {
          adminEmail: 'admin@company.com',
          support_email: 'support@test.org',
        },
      };

      const result = service.sanitizeForCloudUpload(config);
      const sanitized = result.sanitizedData as typeof config;

      expect(sanitized.email).toBe('[EMAIL_REDACTED]');
      expect(sanitized.contact.adminEmail).toBe('[EMAIL_REDACTED]');
      expect(sanitized.contact.support_email).toBe('[EMAIL_REDACTED]');
      expect(result.findings).toContain('Email addresses removed for privacy');
    });

    it('should detect and remove private keys', () => {
      const config = {
        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...',
        certificate: '-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJ...',
        aws_secret_access_key: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      };

      const result = service.sanitizeForCloudUpload(config);
      const sanitized = result.sanitizedData as typeof config;

      expect(sanitized.privateKey).toBe('[BLOCKED]');
      expect(sanitized.certificate).toBe('[BLOCKED]');
      expect(sanitized.aws_secret_access_key).toBe('[BLOCKED]');
      expect(result.securityLevel).toBe('blocked');
      expect(result.findings.some(f => f.includes('Private key') || f.includes('Certificate'))).toBe(true);
    });

    it('should return safe status for clean configuration', () => {
      const config = {
        theme: 'dark',
        fontSize: 14,
        editor: {
          tabSize: 2,
          wordWrap: true,
        },
      };

      const result = service.sanitizeForCloudUpload(config);

      expect(result.sanitizedData).toEqual(config);
      expect(result.securityLevel).toBe('safe');
      expect(result.findings).toHaveLength(0);
    });

    it('should handle arrays with sensitive data', () => {
      const config = {
        servers: [
          { url: 'http://api.example.com', apiKey: 'key123' },
          { url: 'http://test.example.com', token: 'token456' },
        ],
      };

      const result = service.sanitizeForCloudUpload(config);
      const sanitized = result.sanitizedData as typeof config;

      expect(sanitized.servers[0].apiKey).toBe('[REDACTED]');
      expect(sanitized.servers[1].token).toBe('[REDACTED]');
    });

    it('should handle nested objects with sensitive data', () => {
      const config = {
        nested: {
          level1: {
            level2: {
              apiKey: 'secret123',
              data: 'safe-value',
            },
          },
        },
      };

      const result = service.sanitizeForCloudUpload(config);
      const sanitized = result.sanitizedData as typeof config;

      expect(sanitized.nested.level1.level2.apiKey).toBe('[REDACTED]');
      expect(sanitized.nested.level1.level2.data).toBe('safe-value');
    });

    it('should detect environment variables', () => {
      const config = {
        apiKey: '${API_KEY}',
        token: '$SECRET_TOKEN',
        dbUrl: 'postgres://${DB_USER}:${DB_PASS}@localhost/db',
      };

      const result = service.sanitizeForCloudUpload(config);
      const sanitized = result.sanitizedData as typeof config;

      expect(sanitized.apiKey).toBe('[ENV_VAR]');
      expect(sanitized.token).toBe('[ENV_VAR]');
      expect(sanitized.dbUrl).toBe('[ENV_VAR_URL]');
      expect(result.findings.some(f => f.includes('Environment variable'))).toBe(true);
    });

    it('should detect base64 encoded secrets', () => {
      const config = {
        encodedSecret: 'U2VjcmV0S2V5VGhhdElzQmFzZTY0RW5jb2RlZEZvclNlY3VyaXR5',
        encodedToken: 'ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5',
      };

      const result = service.sanitizeForCloudUpload(config);
      const sanitized = result.sanitizedData as typeof config;

      expect(sanitized.encodedSecret).toBe('[REDACTED]');
      expect(sanitized.encodedToken).toBe('[REDACTED]');
      expect(result.findings.length).toBeGreaterThan(0);
    });

    it('should provide detailed security report', () => {
      const config = {
        theme: 'dark',
        fontSize: 14,
        apiKey: 'sk-12345',
        editor: {
          tabSize: 2,
          token: 'secret_token',
        },
        plugins: ['vim', 'git'],
      };

      const result = service.sanitizeForCloudUpload(config);
      const sanitized = result.sanitizedData as typeof config;

      expect(sanitized.theme).toBe('dark');
      expect(sanitized.fontSize).toBe(14);
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.editor.tabSize).toBe(2);
      expect(sanitized.editor.token).toBe('[REDACTED]');
      expect(sanitized.plugins).toEqual(['vim', 'git']);

      expect(result.report.totalFields).toBeGreaterThan(0);
      expect(result.report.sanitizedFields).toBe(2);
      expect(result.report.safeFields).toBeGreaterThan(0);
    });

    it('should handle undefined and null values', () => {
      const config = {
        emptyString: '',
        nullValue: null,
        undefinedValue: undefined,
        apiKey: 'sk-test',
        password: null,
      };

      const result = service.sanitizeForCloudUpload(config);
      const sanitized = result.sanitizedData as typeof config;

      expect(sanitized.emptyString).toBe('');
      expect(sanitized.nullValue).toBe(null);
      expect(sanitized.undefinedValue).toBe(undefined);
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.password).toBe(null);
    });

    it('should detect SSH keys and certificates', () => {
      const config = {
        sshPrivateKey: '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjE...',
        sshPublicKey: 'ssh-rsa AAAAB3NzaC1yc2EAAA...',
        certificate: '-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJ...',
      };

      const result = service.sanitizeForCloudUpload(config);
      const sanitized = result.sanitizedData as typeof config;

      expect(sanitized.sshPrivateKey).toBe('[BLOCKED]');
      expect(sanitized.sshPublicKey).toBe('[SSH_KEY_REDACTED]');
      expect(sanitized.certificate).toBe('[BLOCKED]');
    });

    it('should handle database connection strings', () => {
      const config = {
        dbUrl: 'postgres://user:password@localhost:5432/mydb',
        mongoUri: 'mongodb://admin:secret@cluster.mongodb.net/db',
        redisUrl: 'redis://h:p4ssw0rd@redis-server:6379',
      };

      const result = service.sanitizeForCloudUpload(config);
      const sanitized = result.sanitizedData as typeof config;

      expect(sanitized.dbUrl).toBe('postgres://[REDACTED]@localhost:5432/mydb');
      expect(sanitized.mongoUri).toBe('mongodb://[REDACTED]@cluster.mongodb.net/db');
      expect(sanitized.redisUrl).toBe('redis://[REDACTED]@redis-server:6379');
      expect(result.findings.some(f => f.includes('Database') || f.includes('connection'))).toBe(true);
    });

    it('should detect webhook URLs with embedded tokens', () => {
      const config = {
        slackWebhook: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX',
        discordWebhook: 'https://discord.com/api/webhooks/123456789/abcdefghijklmnop',
      };

      const result = service.sanitizeForCloudUpload(config);
      const sanitized = result.sanitizedData as typeof config;

      expect(sanitized.slackWebhook).toBe('https://hooks.slack.com/services/[REDACTED]');
      expect(sanitized.discordWebhook).toBe('https://discord.com/api/webhooks/[REDACTED]');
      expect(result.findings).toContain('Webhook URLs sanitized');
    });

    it('should generate security recommendations', () => {
      const config = {
        customSecret: 'myCustomSecret123',
        internalToken: 'internalAccessToken456',
        apiEndpoint: 'https://internal.api.com/v1',
      };

      const result = service.sanitizeForCloudUpload(config);
      const sanitized = result.sanitizedData as typeof config;

      expect(sanitized.customSecret).toBe('[REDACTED]');
      expect(sanitized.internalToken).toBe('[REDACTED]');
      expect(sanitized.apiEndpoint).toBe('https://internal.api.com/v1');

      expect(result.recommendations).toBeDefined();
      expect(result.recommendations?.length).toBeGreaterThan(0);
      expect(result.severityBreakdown).toBeDefined();
    });
  });
});