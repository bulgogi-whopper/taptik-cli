import { Test, TestingModule } from '@nestjs/testing';

import { CloudMetadata, SanitizationResult } from '../interfaces/cloud.interface';

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

      expect(result.sanitizedData.apiKey).toBe('[REDACTED]');
      expect(result.sanitizedData.OPENAI_API_KEY).toBe('[REDACTED]');
      expect(result.sanitizedData.settings.api_key).toBe('[REDACTED]');
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

      expect(result.sanitizedData.github_token).toBe('[REDACTED]');
      expect(result.sanitizedData.accessToken).toBe('[REDACTED]');
      expect(result.sanitizedData.auth.bearer_token).toBe('[REDACTED]');
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

      expect(result.sanitizedData.password).toBe('[REDACTED]');
      expect(result.sanitizedData.db_password).toBe('[REDACTED]');
      expect(result.sanitizedData.credentials.passwd).toBe('[REDACTED]');
      expect(result.sanitizedData.credentials.pass).toBe('[REDACTED]');
      expect(result.findings).toContain('Passwords detected and removed');
    });

    it('should sanitize sensitive file paths', () => {
      const config = {
        homePath: '/Users/johndoe/Documents/private',
        sshKey: '/home/user/.ssh/id_rsa',
        privateFile: 'C:\\Users\\Admin\\Desktop\\secrets.txt',
      };

      const result = service.sanitizeForCloudUpload(config);

      expect(result.sanitizedData.homePath).toMatch(/^~\/[^/]+/);
      expect(result.sanitizedData.sshKey).toBe('~/.ssh/[REDACTED]');
      expect(result.sanitizedData.privateFile).toBe('[REDACTED_PATH]');
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

      expect(result.sanitizedData.email).toBe('[EMAIL_REDACTED]');
      expect(result.sanitizedData.contact.adminEmail).toBe('[EMAIL_REDACTED]');
      expect(result.sanitizedData.contact.support_email).toBe('[EMAIL_REDACTED]');
      expect(result.findings).toContain('Email addresses removed for privacy');
    });

    it('should detect and block configurations with critical security risks', () => {
      const config = {
        privateKey: '-----BEGIN RSA PRIVATE KEY-----',
        certificate: '-----BEGIN CERTIFICATE-----',
        aws_secret_access_key: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      };

      const result = service.sanitizeForCloudUpload(config);

      expect(result.securityLevel).toBe('blocked');
      expect(result.sanitizedData.privateKey).toBe('[BLOCKED]');
      expect(result.sanitizedData.certificate).toBe('[BLOCKED]');
      expect(result.sanitizedData.aws_secret_access_key).toBe('[BLOCKED]');
      expect(result.findings).toContain('Critical security risk: Private keys detected');
    });

    it('should assess security level as safe for clean configurations', () => {
      const config = {
        theme: 'dark',
        fontSize: 14,
        editor: {
          tabSize: 2,
          wordWrap: true,
        },
      };

      const result = service.sanitizeForCloudUpload(config);

      expect(result.securityLevel).toBe('safe');
      expect(result.sanitizedData).toEqual(config);
      expect(result.findings).toEqual([]);
    });

    it('should generate detailed sanitization report', () => {
      const config = {
        apiKey: 'secret',
        password: 'admin123',
        normalSetting: 'value',
      };

      const result = service.sanitizeForCloudUpload(config);

      expect(result.report).toBeDefined();
      expect(result.report.totalFields).toBe(3);
      expect(result.report.sanitizedFields).toBe(2);
      expect(result.report.safeFields).toBe(1);
      expect(result.report.timestamp).toBeDefined();
      expect(result.report.summary).toContain('2 fields sanitized');
    });

    it('should handle nested objects and arrays', () => {
      const config = {
        servers: [
          { url: 'https://api.example.com', apiKey: 'key1' },
          { url: 'https://api2.example.com', apiKey: 'key2' },
        ],
        nested: {
          deep: {
            deeper: {
              password: 'secret',
            },
          },
        },
      };

      const result = service.sanitizeForCloudUpload(config);

      expect(result.sanitizedData.servers[0].apiKey).toBe('[REDACTED]');
      expect(result.sanitizedData.servers[1].apiKey).toBe('[REDACTED]');
      expect(result.sanitizedData.nested.deep.deeper.password).toBe('[REDACTED]');
    });

    it('should handle environment variable references', () => {
      const config = {
        apiKey: '${OPENAI_API_KEY}',
        token: '$GITHUB_TOKEN',
        dbUrl: 'postgres://${DB_USER}:${DB_PASS}@localhost',
      };

      const result = service.sanitizeForCloudUpload(config);

      expect(result.sanitizedData.apiKey).toBe('[ENV_VAR]');
      expect(result.sanitizedData.token).toBe('[ENV_VAR]');
      expect(result.sanitizedData.dbUrl).toBe('[ENV_VAR_URL]');
      expect(result.findings).toContain('Environment variable references sanitized');
    });

    it('should detect base64 encoded secrets', () => {
      const config = {
        encodedSecret: 'cGFzc3dvcmQ6YWRtaW4xMjM=', // password:admin123
        encodedToken: Buffer.from('api_key:secret').toString('base64'),
      };

      const result = service.sanitizeForCloudUpload(config);

      expect(result.sanitizedData.encodedSecret).toBe('[ENCODED_SECRET]');
      expect(result.sanitizedData.encodedToken).toBe('[ENCODED_SECRET]');
      expect(result.findings).toContain('Base64 encoded secrets detected');
    });

    it('should preserve safe configuration while removing sensitive data', () => {
      const config = {
        theme: 'monokai',
        fontSize: 12,
        apiKey: 'sk-secret',
        editor: {
          tabSize: 4,
          password: 'admin',
        },
        plugins: ['vim', 'prettier'],
      };

      const result = service.sanitizeForCloudUpload(config);

      expect(result.sanitizedData.theme).toBe('monokai');
      expect(result.sanitizedData.fontSize).toBe(12);
      expect(result.sanitizedData.apiKey).toBe('[REDACTED]');
      expect(result.sanitizedData.editor.tabSize).toBe(4);
      expect(result.sanitizedData.editor.password).toBe('[REDACTED]');
      expect(result.sanitizedData.plugins).toEqual(['vim', 'prettier']);
    });

    it('should handle empty and null values gracefully', () => {
      const config = {
        emptyString: '',
        nullValue: null,
        undefinedValue: undefined,
        apiKey: null,
        password: '',
      };

      const result = service.sanitizeForCloudUpload(config);

      expect(result.sanitizedData.emptyString).toBe('');
      expect(result.sanitizedData.nullValue).toBeNull();
      expect(result.sanitizedData.undefinedValue).toBeUndefined();
      expect(result.sanitizedData.apiKey).toBeNull();
      expect(result.sanitizedData.password).toBe('');
      expect(result.securityLevel).toBe('safe');
    });

    it('should detect SSH keys and certificates', () => {
      const config = {
        sshPrivateKey: '-----BEGIN OPENSSH PRIVATE KEY-----',
        sshPublicKey: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQAB',
        certificate: '-----BEGIN CERTIFICATE-----',
      };

      const result = service.sanitizeForCloudUpload(config);

      expect(result.sanitizedData.sshPrivateKey).toBe('[BLOCKED]');
      expect(result.sanitizedData.sshPublicKey).toBe('[SSH_KEY_REDACTED]');
      expect(result.sanitizedData.certificate).toBe('[BLOCKED]');
      expect(result.securityLevel).toBe('blocked');
    });

    it('should sanitize database connection strings', () => {
      const config = {
        dbUrl: 'postgresql://user:password@localhost:5432/mydb',
        mongoUri: 'mongodb://admin:secret@cluster.mongodb.net/db',
        redisUrl: 'redis://:authpassword@127.0.0.1:6379',
      };

      const result = service.sanitizeForCloudUpload(config);

      expect(result.sanitizedData.dbUrl).toBe('postgresql://[REDACTED]@localhost:5432/mydb');
      expect(result.sanitizedData.mongoUri).toBe('mongodb://[REDACTED]@cluster.mongodb.net/db');
      expect(result.sanitizedData.redisUrl).toBe('redis://[REDACTED]@127.0.0.1:6379');
      expect(result.findings).toContain('Database connection strings sanitized');
    });

    it('should detect webhook URLs and sanitize tokens', () => {
      const config = {
        slackWebhook: 'https://hooks.slack.com/services/T00000000/B00000000/xxxxxxxxxxxxxxxxxxxx',
        discordWebhook: 'https://discord.com/api/webhooks/123456789/abcdefghijklmnop',
      };

      const result = service.sanitizeForCloudUpload(config);

      expect(result.sanitizedData.slackWebhook).toMatch(/https:\/\/hooks\.slack\.com\/services\/\[REDACTED]/);
      expect(result.sanitizedData.discordWebhook).toMatch(/https:\/\/discord\.com\/api\/webhooks\/\[REDACTED]/);
      expect(result.findings).toContain('Webhook URLs sanitized');
    });

    it('should handle regex pattern detection for custom secrets', () => {
      const config = {
        customSecret: 'secret_key_xyz123',
        internalToken: 'internal_token_abc456',
        apiEndpoint: 'https://api.example.com/v1',
      };

      const result = service.sanitizeForCloudUpload(config);

      expect(result.sanitizedData.customSecret).toBe('[REDACTED]');
      expect(result.sanitizedData.internalToken).toBe('[REDACTED]');
      expect(result.sanitizedData.apiEndpoint).toBe('https://api.example.com/v1');
    });

    it('should provide severity levels for different types of sensitive data', () => {
      const config = {
        theme: 'dark', // safe
        email: 'user@example.com', // low
        apiKey: 'sk-123456', // medium
        privateKey: '-----BEGIN RSA PRIVATE KEY-----', // critical
      };

      const result = service.sanitizeForCloudUpload(config);

      expect(result.severityBreakdown).toBeDefined();
      expect(result.severityBreakdown.safe).toBe(1);
      expect(result.severityBreakdown.low).toBe(1);
      expect(result.severityBreakdown.medium).toBe(1);
      expect(result.severityBreakdown.critical).toBe(1);
    });

    it('should handle special characters in sensitive patterns', () => {
      const config = {
        'api-key': 'secret123',
        'api.key': 'secret456',
        'api[key]': 'secret789',
        'normal-setting': 'value',
      };

      const result = service.sanitizeForCloudUpload(config);

      expect(result.sanitizedData['api-key']).toBe('[REDACTED]');
      expect(result.sanitizedData['api.key']).toBe('[REDACTED]');
      expect(result.sanitizedData['api[key]']).toBe('[REDACTED]');
      expect(result.sanitizedData['normal-setting']).toBe('value');
    });

    it('should generate actionable recommendations', () => {
      const config = {
        apiKey: 'sk-123',
        password: 'admin',
        privateKey: '-----BEGIN RSA PRIVATE KEY-----',
      };

      const result = service.sanitizeForCloudUpload(config);

      expect(result.recommendations).toBeDefined();
      expect(result.recommendations).toContain('Use environment variables for API keys');
      expect(result.recommendations).toContain('Never include private keys in configurations');
      expect(result.recommendations).toContain('Consider using a secrets management service');
    });
  });
});