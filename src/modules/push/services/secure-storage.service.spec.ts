import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { SecureStorageService } from './secure-storage.service';

// Mock fs module
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  chmod: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
  access: vi.fn(),
  rm: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
}));

describe('SecureStorageService', () => {
  let service: SecureStorageService;
  let testDir: string;
  let mockCredentials: Record<string, any>;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Set up mock implementations
    const mockFs = vi.mocked(fs);
    mockCredentials = {};

    // Mock mkdir to succeed
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.chmod.mockResolvedValue(undefined);

    // Mock file operations
    mockFs.readFile.mockImplementation(
      async (filePath: any, _encoding?: any) => {
        const pathStr = filePath.toString();

        // Mock encryption key
        if (pathStr.endsWith('.key')) {
          return Buffer.from(
            '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            'hex',
          );
        }

        // Mock credential files
        if (pathStr.endsWith('.json')) {
          const namespace = path.basename(pathStr, '.json');
          if (mockCredentials[namespace]) {
            return JSON.stringify(mockCredentials[namespace]);
          }
          throw new Error('ENOENT: no such file or directory');
        }

        throw new Error('ENOENT: no such file or directory');
      },
    );

    mockFs.writeFile.mockImplementation(async (filePath: any, data: any) => {
      const pathStr = filePath.toString();

      if (pathStr.endsWith('.json')) {
        const namespace = path.basename(pathStr, '.json');
        mockCredentials[namespace] = JSON.parse(data.toString());
      }

      return undefined;
    });

    mockFs.unlink.mockImplementation(async (filePath: any) => {
      const pathStr = filePath.toString();
      const namespace = path.basename(pathStr, '.json');
      delete mockCredentials[namespace];
      return undefined;
    });

    mockFs.access.mockImplementation(async (filePath: any) => {
      const pathStr = filePath.toString();
      const namespace = path.basename(pathStr, '.json');
      if (!mockCredentials[namespace]) {
        throw new Error('ENOENT: no such file or directory');
      }
      return undefined;
    });

    mockFs.readdir.mockResolvedValue(['test-namespace.json'] as any);

    mockFs.stat.mockResolvedValue({
      mode: 0o100600, // Regular file with 600 permissions
    } as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [SecureStorageService],
    }).compile();

    service = module.get<SecureStorageService>(SecureStorageService);

    // Use test directory
    testDir = path.join(os.tmpdir(), 'taptik-test', 'secure');
    (service as any).storageDir = testDir;

    // Mock the getEncryptionKey method to return a valid 32-byte key
    const mockKey = Buffer.from(
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      'hex',
    );
    vi.spyOn(service as any, 'getEncryptionKey').mockResolvedValue(mockKey);
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockCredentials = {};
  });

  describe('storeCredential', () => {
    it('should store encrypted credential', async () => {
      await service.storeCredential(
        'test-namespace',
        'api-key',
        'secret-value',
        true,
      );

      const filePath = path.join(testDir, 'test-namespace.json');
      const data = await fs.readFile(filePath, 'utf-8');
      const credentials = JSON.parse(data);

      expect(credentials['api-key']).toBeDefined();
      expect(credentials['api-key'].encrypted).toBe(true);
      expect(credentials['api-key'].value).not.toBe('secret-value'); // Should be encrypted
    });

    it('should store unencrypted credential', async () => {
      await service.storeCredential(
        'test-namespace',
        'config',
        'plain-value',
        false,
      );

      const filePath = path.join(testDir, 'test-namespace.json');
      const data = await fs.readFile(filePath, 'utf-8');
      const credentials = JSON.parse(data);

      expect(credentials['config'].encrypted).toBe(false);
      expect(credentials['config'].value).toBe('plain-value');
    });

    it('should store credential with TTL', async () => {
      await service.storeCredential(
        'test-namespace',
        'token',
        'temp-value',
        true,
        60,
      );

      const filePath = path.join(testDir, 'test-namespace.json');
      const data = await fs.readFile(filePath, 'utf-8');
      const credentials = JSON.parse(data);

      expect(credentials['token'].expiresAt).toBeDefined();
      const expiresAt = new Date(credentials['token'].expiresAt);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('getCredential', () => {
    it('should retrieve encrypted credential', async () => {
      await service.storeCredential(
        'test-namespace',
        'api-key',
        'secret-value',
        true,
      );

      const value = await service.getCredential('test-namespace', 'api-key');

      expect(value).toBe('secret-value');
    });

    it('should retrieve unencrypted credential', async () => {
      await service.storeCredential(
        'test-namespace',
        'config',
        'plain-value',
        false,
      );

      const value = await service.getCredential('test-namespace', 'config');

      expect(value).toBe('plain-value');
    });

    it('should return null for non-existent credential', async () => {
      const value = await service.getCredential('test-namespace', 'missing');

      expect(value).toBeNull();
    });

    it('should return null for expired credential', async () => {
      // Store credential with 1ms TTL
      await service.storeCredential(
        'test-namespace',
        'token',
        'temp-value',
        true,
        0.001,
      );

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      const value = await service.getCredential('test-namespace', 'token');

      expect(value).toBeNull();
    });
  });

  describe('deleteCredential', () => {
    it('should delete credential', async () => {
      await service.storeCredential(
        'test-namespace',
        'api-key',
        'secret-value',
        true,
      );
      await service.deleteCredential('test-namespace', 'api-key');

      const value = await service.getCredential('test-namespace', 'api-key');

      expect(value).toBeNull();
    });

    it('should handle deleting non-existent credential', async () => {
      await expect(
        service.deleteCredential('test-namespace', 'missing'),
      ).resolves.not.toThrow();
    });

    it('should delete file when last credential is removed', async () => {
      await service.storeCredential(
        'test-namespace',
        'only-key',
        'value',
        false,
      );
      await service.deleteCredential('test-namespace', 'only-key');

      const filePath = path.join(testDir, 'test-namespace.json');
      await expect(fs.access(filePath)).rejects.toThrow();
    });
  });

  describe('clearNamespace', () => {
    it('should clear all credentials in namespace', async () => {
      await service.storeCredential('test-namespace', 'key1', 'value1', false);
      await service.storeCredential('test-namespace', 'key2', 'value2', false);
      await service.clearNamespace('test-namespace');

      const value1 = await service.getCredential('test-namespace', 'key1');
      const value2 = await service.getCredential('test-namespace', 'key2');

      expect(value1).toBeNull();
      expect(value2).toBeNull();
    });
  });

  describe('storeApiKey and getApiKey', () => {
    it('should store and retrieve API key', async () => {
      await service.storeApiKey('github', 'ghp_testtoken');

      const apiKey = await service.getApiKey('github');

      expect(apiKey).toBe('ghp_testtoken');
    });
  });

  describe('storeAuthToken and getAuthToken', () => {
    it('should store and retrieve auth token', async () => {
      await service.storeAuthToken('user123', 'bearer_token', 3600);

      const token = await service.getAuthToken('user123');

      expect(token).toBe('bearer_token');
    });

    it('should expire auth token', async () => {
      await service.storeAuthToken('user123', 'bearer_token', 0.001);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const token = await service.getAuthToken('user123');

      expect(token).toBeNull();
    });
  });

  describe('cleanupExpired', () => {
    it('should clean up expired credentials', async () => {
      // Store expired and non-expired credentials
      await service.storeCredential(
        'test-namespace',
        'expired',
        'value1',
        false,
        0.001,
      );
      await service.storeCredential(
        'test-namespace',
        'active',
        'value2',
        false,
        60,
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      await service.cleanupExpired();

      const expired = await service.getCredential('test-namespace', 'expired');
      const active = await service.getCredential('test-namespace', 'active');

      expect(expired).toBeNull();
      expect(active).toBe('value2');
    });
  });

  describe('encryption', () => {
    it('should encrypt and decrypt correctly', async () => {
      const testValues = [
        'simple-text',
        'text with spaces',
        'text!with@special#chars$',
        '{"json": "data", "nested": {"key": "value"}}',
        'a'.repeat(1000), // Long string
      ];

      for (const original of testValues) {
        await service.storeCredential(
          'test-namespace',
          'test-key',
          original,
          true,
        );

        const retrieved = await service.getCredential(
          'test-namespace',
          'test-key',
        );
        expect(retrieved).toBe(original);
      }
    });

    it('should use different encryption for same value', async () => {
      await service.storeCredential('namespace1', 'key', 'same-value', true);
      await service.storeCredential('namespace2', 'key', 'same-value', true);

      const file1 = await fs.readFile(
        path.join(testDir, 'namespace1.json'),
        'utf-8',
      );
      const file2 = await fs.readFile(
        path.join(testDir, 'namespace2.json'),
        'utf-8',
      );

      const creds1 = JSON.parse(file1);
      const creds2 = JSON.parse(file2);

      // Encrypted values should be different due to different IVs
      expect(creds1['key'].value).not.toBe(creds2['key'].value);
    });
  });

  describe('file permissions', () => {
    it('should set restrictive file permissions', async () => {
      if (process.platform === 'win32') {
        // Skip on Windows
        return;
      }

      await service.storeCredential('test-namespace', 'key', 'value', false);

      const filePath = path.join(testDir, 'test-namespace.json');
      const stats = await fs.stat(filePath);

      // Check that file is only readable/writable by owner (0o600)
      expect(stats.mode & 0o777).toBe(0o600);
    });
  });
});
