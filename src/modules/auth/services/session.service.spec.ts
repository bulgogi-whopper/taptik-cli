import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Logger } from '@nestjs/common';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { UserSession } from '../../../models/user.model';
import { AuthErrorCode } from '../types';

import { SessionService } from './session.service';

// Mock fs module
vi.mock('node:fs', () => ({
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    unlink: vi.fn(),
    access: vi.fn(),
  },
}));

// Mock Logger to suppress error logs during tests
vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

const mockFs = fs as any;

describe('SessionService', () => {
  let sessionService: SessionService;
  let mockSession: UserSession;
  let testDirectory: string;

  beforeEach(() => {
    vi.clearAllMocks();

    testDirectory = join(tmpdir(), '.taptik-test');
    sessionService = new SessionService({
      directory: testDirectory,
      filename: 'test-session.json',
      encryption: false,
    });

    mockSession = {
      user: {
        id: '123',
        email: 'test@example.com',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 3_600_000), // 1 hour from now
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('saveSession', () => {
    it('should save session successfully without encryption', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await sessionService.saveSession(mockSession);

      expect(mockFs.mkdir).toHaveBeenCalledWith(testDirectory, {
        recursive: true,
        mode: 0o700,
      });
      expect(mockFs.writeFile).toHaveBeenCalled();

      const writeCall = mockFs.writeFile.mock.calls[0];
      expect(writeCall[0]).toBe(join(testDirectory, 'test-session.json'));
      expect(typeof writeCall[1]).toBe('string');
      expect(writeCall[2]).toEqual({
        encoding: 'utf8',
        mode: 0o600,
      });
    });

    it('should save session with metadata', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const metadata = {
        provider: 'google' as const,
        creationMethod: 'oauth' as const,
        client: { version: '1.0.0', platform: 'test' },
      };

      await sessionService.saveSession(mockSession, metadata);

      expect(mockFs.writeFile).toHaveBeenCalled();

      const writeCall = mockFs.writeFile.mock.calls[0];
      const savedData = JSON.parse(writeCall[1]);
      expect(savedData.metadata.provider).toBe('google');
      expect(savedData.metadata.client.version).toBe('1.0.0');
    });

    it('should throw AuthError when save fails', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(
        sessionService.saveSession(mockSession),
      ).rejects.toMatchObject({
        code: AuthErrorCode.SESSION_STORAGE_ERROR,
        message: expect.stringContaining('Failed to save session'),
        recoverable: true,
        suggestions: expect.arrayContaining(['Check file system permissions']),
      });
    });
  });

  describe('loadSession', () => {
    it('should load valid session successfully', async () => {
      const storedSession = {
        userSession: mockSession,
        storedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        metadata: {
          provider: 'google',
          creationMethod: 'oauth',
          client: { version: '1.0.0', platform: 'test' },
          lastAccessedAt: new Date(),
          accessCount: 1,
        },
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(storedSession));
      mockFs.writeFile.mockResolvedValue(undefined); // For metadata update
      mockFs.mkdir.mockResolvedValue(undefined); // For metadata update

      const result = await sessionService.loadSession();

      expect(result).toBeDefined();
      expect(result?.userSession.user.id).toBe('123');
      expect(result?.userSession.user.email).toBe('test@example.com');
      expect(mockFs.readFile).toHaveBeenCalledWith(
        join(testDirectory, 'test-session.json'),
        'utf8',
      );
    });

    it('should return null when session file does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      const result = await sessionService.loadSession();

      expect(result).toBeNull();
      expect(mockFs.access).toHaveBeenCalled();
    });

    it('should return null and clear session when expired', async () => {
      const expiredSession = {
        userSession: {
          ...mockSession,
          expiresAt: new Date(Date.now() - 3_600_000), // 1 hour ago
        },
        storedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() - 3_600_000).toISOString(),
        metadata: {},
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(expiredSession));
      mockFs.unlink.mockResolvedValue(undefined);

      const result = await sessionService.loadSession();

      expect(result).toBeNull();
      expect(mockFs.unlink).toHaveBeenCalledWith(
        join(testDirectory, 'test-session.json'),
      );
    });

    it('should return null when session structure is invalid', async () => {
      const invalidSession = {
        invalidStructure: true,
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidSession));
      mockFs.unlink.mockResolvedValue(undefined);

      const result = await sessionService.loadSession();

      expect(result).toBeNull();
      expect(mockFs.unlink).toHaveBeenCalled();
    });
  });

  describe('clearSession', () => {
    it('should clear session successfully', async () => {
      mockFs.unlink.mockResolvedValue(undefined);

      await sessionService.clearSession();

      expect(mockFs.unlink).toHaveBeenCalledWith(
        join(testDirectory, 'test-session.json'),
      );
    });

    it('should not throw error when session file does not exist', async () => {
      const error = new Error('ENOENT') as any;
      error.code = 'ENOENT';
      mockFs.unlink.mockRejectedValue(error);

      await expect(sessionService.clearSession()).resolves.toBeUndefined();
    });

    it('should throw AuthError when clear fails', async () => {
      mockFs.unlink.mockRejectedValue(new Error('Permission denied'));

      await expect(sessionService.clearSession()).rejects.toMatchObject({
        code: AuthErrorCode.SESSION_CLEANUP_FAILED,
        message: expect.stringContaining('Failed to clear session'),
        recoverable: true,
      });
    });
  });

  describe('hasSession', () => {
    it('should return true when session file exists', async () => {
      mockFs.access.mockResolvedValue(undefined);

      const result = await sessionService.hasSession();

      expect(result).toBe(true);
      expect(mockFs.access).toHaveBeenCalledWith(
        join(testDirectory, 'test-session.json'),
      );
    });

    it('should return false when session file does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      const result = await sessionService.hasSession();

      expect(result).toBe(false);
    });
  });

  describe('isSessionValid', () => {
    it('should return true for valid session', async () => {
      const validSession = {
        userSession: mockSession,
        storedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      };

      const result = await sessionService.isSessionValid(validSession);

      expect(result).toBe(true);
    });

    it('should return false for expired session', async () => {
      const expiredSession = {
        userSession: {
          ...mockSession,
          expiresAt: new Date(Date.now() - 3_600_000), // 1 hour ago
        },
        storedAt: new Date().toISOString(),
      };

      const result = await sessionService.isSessionValid(expiredSession);

      expect(result).toBe(false);
    });

    it('should return false for session without user', async () => {
      const invalidSession = {
        userSession: {
          ...mockSession,
          user: undefined as any,
        },
        storedAt: new Date().toISOString(),
      };

      const result = await sessionService.isSessionValid(invalidSession);

      expect(result).toBe(false);
    });

    it('should return false for session without access token', async () => {
      const invalidSession = {
        userSession: {
          ...mockSession,
          accessToken: '',
        },
        storedAt: new Date().toISOString(),
      };

      const result = await sessionService.isSessionValid(invalidSession);

      expect(result).toBe(false);
    });
  });

  describe('extendSession', () => {
    it('should extend session expiry time', async () => {
      const storedSession = {
        userSession: mockSession,
        storedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        metadata: {
          provider: 'google' as const,
          creationMethod: 'oauth' as const,
        },
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(storedSession));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await sessionService.extendSession(3_600_000); // Extend by 1 hour

      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should throw error when no session exists to extend', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      await expect(sessionService.extendSession(3_600_000)).rejects.toThrow(
        'No session to extend',
      );
    });
  });

  describe('getSessionStats', () => {
    it('should return stats for existing valid session', async () => {
      const storedSession = {
        userSession: mockSession,
        storedAt: new Date('2023-01-01').toISOString(),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        metadata: {
          provider: 'google' as const,
          creationMethod: 'oauth' as const,
          lastAccessedAt: new Date('2023-01-02'),
          accessCount: 5,
        },
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(storedSession));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const stats = await sessionService.getSessionStats();

      expect(stats.exists).toBe(true);
      expect(stats.isValid).toBe(true);
      // AccessCount increases by 2 due to updateAccessMetadata being called during both loadSession calls
      expect(stats.accessCount).toBe(7); // 5 + 2 from getSessionStats -> loadSession calls
      expect(stats.createdAt).toEqual(new Date('2023-01-01'));
    });

    it('should return stats for non-existing session', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      const stats = await sessionService.getSessionStats();

      expect(stats.exists).toBe(false);
      expect(stats.isValid).toBe(false);
      expect(stats.accessCount).toBeUndefined();
    });
  });

  describe('encryption', () => {
    it('should handle encryption configuration', () => {
      const encryptedService = new SessionService({
        directory: testDirectory,
        filename: 'encrypted-session.json',
        encryption: true,
        encryptionKey: 'test-key-32-chars-long-for-aes256',
      });

      const config = encryptedService.getConfiguration();
      expect(config.encryption).toBe(true);
      expect(config.encryptionKey).toBe('test-key-32-chars-long-for-aes256');
    });
  });

  describe('configuration', () => {
    it('should return current configuration', () => {
      const config = sessionService.getConfiguration();

      expect(config.directory).toBe(testDirectory);
      expect(config.filename).toBe('test-session.json');
      expect(config.encryption).toBe(false);
    });

    it('should return session file path', () => {
      const path = sessionService.getSessionPath();

      expect(path).toBe(join(testDirectory, 'test-session.json'));
    });
  });
});
