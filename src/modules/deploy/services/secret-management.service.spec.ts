import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { SecretManagementService } from './secret-management.service';

describe('SecretManagementService', () => {
  let service: SecretManagementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SecretManagementService],
    }).compile();

    service = module.get<SecretManagementService>(SecretManagementService);
  });

  describe('detectSecrets', () => {
    it('should detect API keys in configuration', async () => {
      const configWithSecrets = {
        supabaseUrl: 'https://example.supabase.co',
        apiKey: 'sk-1234567890abcdefghijklmnop',
        token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        password: 'mySecretPassword123456',
        githubToken: 'ghp_1234567890abcdefghijklmnopqrstuvwxyz',
      };

      const secrets = await service.detectSecrets(configWithSecrets);

      expect(secrets.length).toBeGreaterThan(0);
      expect(secrets.some((s) => s.key === 'apiKey')).toBe(true);
      expect(secrets.some((s) => s.key === 'token')).toBe(true);
      expect(secrets.some((s) => s.key === 'password')).toBe(true);
      expect(secrets.some((s) => s.key === 'githubToken')).toBe(true);
      expect(secrets.find((s) => s.key === 'supabaseUrl')).toBeUndefined(); // URLs are not secrets
    });

    it('should detect secrets in nested objects', async () => {
      const nestedConfig = {
        database: {
          connection: {
            password: 'dbPassword123456789',
            connectionString:
              'postgresql://user:verylongsecretpassword@localhost/db',
          },
        },
        auth: {
          jwt: {
            secret: 'jwtSecretKeyLongEnoughToBeDetected',
          },
        },
      };

      const secrets = await service.detectSecrets(nestedConfig);

      expect(secrets.length).toBeGreaterThan(0);
      expect(
        secrets.some((s) => s.path === 'database.connection.password'),
      ).toBe(true);
      expect(secrets.some((s) => s.path === 'auth.jwt.secret')).toBe(true);
    });

    it('should handle arrays and complex structures', async () => {
      const complexConfig = {
        services: [
          { name: 'service1', apiKey: 'key1234567890abcdefghijk' },
          { name: 'service2', token: 'token1234567890abcdefghijk' },
        ],
        credentials: {
          providers: {
            aws: {
              accessKey: 'AKIA1234567890ABCDEF',
              secretKey: 'secret123456789012345678901234567890',
            },
          },
        },
      };

      const secrets = await service.detectSecrets(complexConfig);

      expect(secrets.length).toBeGreaterThan(0);
      expect(secrets.some((s) => s.value === 'key1234567890abcdefghijk')).toBe(
        true,
      );
      expect(
        secrets.some((s) => s.value === 'token1234567890abcdefghijk'),
      ).toBe(true);
    });

    it('should not detect false positives', async () => {
      const nonSecretConfig = {
        version: '1.0.0',
        name: 'test-app',
        description: 'Test application',
        urls: ['https://example.com'],
        numbers: [1, 2, 3],
        boolean: true,
      };

      const secrets = await service.detectSecrets(nonSecretConfig);

      expect(secrets).toHaveLength(0);
    });
  });

  describe('sanitizeConfiguration', () => {
    it('should replace detected secrets with placeholders', async () => {
      const configWithSecrets = {
        database: {
          password: 'secretPassword123456789',
          connectionString:
            'postgresql://user:verylongsecretpasswordstring@localhost/db',
        },
        apiKey: 'sk-1234567890abcdefghijklmnop',
        publicUrl: 'https://example.com', // Should not be sanitized
      };

      const sanitized = await service.sanitizeConfiguration(configWithSecrets);
      const sanitizedResult = sanitized as Record<string, any>;

      expect(
        (sanitizedResult.database as Record<string, unknown>).password,
      ).toBe('${SECRET:database.password}');
      expect(sanitizedResult.apiKey).toBe('${SECRET:apiKey}');
      expect(sanitizedResult.publicUrl).toBe('https://example.com');
    });

    it('should generate secret mapping for restoration', async () => {
      const configWithSecrets = {
        token: 'mySecretToken1234567890',
        nested: {
          key: 'nestedSecret1234567890',
        },
      };

      const { sanitized, secretMapping } =
        await service.sanitizeConfigurationWithMapping(configWithSecrets);
      const sanitizedResult = sanitized as Record<string, any>;

      expect(sanitizedResult.token).toBe('${SECRET:token}');
      expect((sanitizedResult.nested as Record<string, unknown>).key).toBe(
        '${SECRET:nested.key}',
      );
      expect(secretMapping.length).toBeGreaterThan(0);
      expect(
        secretMapping.some(
          (s) => s.path === 'token' && s.value === 'mySecretToken1234567890',
        ),
      ).toBe(true);
      expect(
        secretMapping.some(
          (s) =>
            s.path === 'nested.key' && s.value === 'nestedSecret1234567890',
        ),
      ).toBe(true);
    });
  });

  describe('clearEnvironmentVariables', () => {
    it('should clear environment variables', () => {
      process.env.TEST_SECRET = 'testValue';
      expect(process.env.TEST_SECRET).toBe('testValue');

      service.clearEnvironmentVariables(['TEST_SECRET']);
      expect(process.env.TEST_SECRET).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle corrupted secret data', async () => {
      // Mock the keychain to be unavailable for this test
      vi.spyOn(service as any, 'isKeychainAvailable').mockReturnValue(false);

      const secret = await service.retrieveSecret('corrupted');

      expect(secret).toBeNull();
    });

    it('should handle environment variable injection errors', async () => {
      const secrets = [{ key: 'INVALID_KEY!', secretId: 'test' }];

      await expect(service.injectEnvironmentVariables(secrets)).rejects.toThrow(
        'Invalid environment variable name',
      );
    });
  });

  describe('private helper methods', () => {
    it('should calculate confidence correctly', () => {
      const calculateConfidence = (service as any).calculateConfidence.bind(
        service,
      );

      // Test short value
      expect(calculateConfidence('name', 'short')).toBeLessThan(0.8);

      // Test long value with mixed case and numbers
      expect(
        calculateConfidence('apiKey', 'Abc123456789012345678901234567890'),
      ).toBeCloseTo(1);
    });

    it('should infer secret type correctly', () => {
      const inferSecretType = (service as any).inferSecretType.bind(service);

      expect(inferSecretType('password')).toBe('password');
      expect(inferSecretType('token')).toBe('token');
      expect(inferSecretType('api_key')).toBe('api_key');
      expect(inferSecretType('private_key')).toBe('private_key');
      expect(inferSecretType('connection_string')).toBe('connection_string');
      expect(inferSecretType('webhook_url')).toBe('webhook_secret');
      expect(inferSecretType('certificate')).toBe('certificate');
      expect(inferSecretType('unknown_field')).toBe('unknown');
    });

    it('should detect secret keys correctly', () => {
      const isSecretKey = (service as any).isSecretKey.bind(service);

      expect(isSecretKey('password')).toBe(true);
      expect(isSecretKey('apiKey')).toBe(true);
      expect(isSecretKey('secret')).toBe(true);
      expect(isSecretKey('token')).toBe(true);
      expect(isSecretKey('auth')).toBe(true);
      expect(isSecretKey('credential')).toBe(true);

      expect(isSecretKey('name')).toBe(false);
      expect(isSecretKey('version')).toBe(false);
      expect(isSecretKey('url')).toBe(false);
    });
  });
});
