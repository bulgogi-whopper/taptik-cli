import { describe, it, expect, vi, beforeEach } from 'vitest';

import { User, UserSession } from '../../../models/user.model';
import { AuthService } from '../../auth/auth.service';

import { InfoService } from './info.service';

// Mock AuthService
const mockAuthService = {
  getCurrentUser: vi.fn(),
  getSession: vi.fn(),
  logout: vi.fn(),
  loginWithProvider: vi.fn(),
  refreshSession: vi.fn(),
  processOAuthCallbackUrl: vi.fn(),
};

vi.mock('../../auth/auth.service', () => ({
  AuthService: vi.fn(() => mockAuthService),
}));

describe('InfoService', () => {
  let infoService: InfoService;
  let authService: AuthService;

  // Fixture: 현재 날짜를 기준으로 더미 데이터 생성
  const now = new Date();
  const mockUser: User = {
    id: 'user-123',
    email: 'test@taptik.ai',
    username: 'testuser',
    fullName: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
    createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30일 전
    updatedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1일 전
    lastSignInAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2시간 전
    emailConfirmedAt: new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000), // 29일 전
    phone: '+1234567890',
    phoneConfirmedAt: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000), // 28일 전
    role: 'authenticated',
    metadata: {
      provider: 'google',
      customField: 'value',
    },
  };

  const mockUserSession: UserSession = {
    user: mockUser,
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresAt: new Date(now.getTime() + 60 * 60 * 1000), // 1시간 후
  };

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new AuthService(null as any);
    infoService = new InfoService(authService);
  });

  describe('getAccountInfo', () => {
    it('인증된 사용자의 계정 정보를 반환해야 한다', async () => {
      // Given
      mockAuthService.getCurrentUser.mockResolvedValue(mockUser);
      mockAuthService.getSession.mockResolvedValue(mockUserSession);

      // When
      const result = await infoService.getAccountInfo();

      // Then
      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockUserSession);
      expect(mockAuthService.getCurrentUser).toHaveBeenCalledOnce();
      expect(mockAuthService.getSession).toHaveBeenCalledOnce();
    });

    it('인증되지 않은 사용자일 때 에러를 던져야 한다', async () => {
      // Given
      mockAuthService.getCurrentUser.mockResolvedValue(null);

      // When & Then
      await expect(infoService.getAccountInfo()).rejects.toThrow(
        'User not authenticated. Please run "taptik login" first.',
      );
      expect(mockAuthService.getCurrentUser).toHaveBeenCalledOnce();
    });
  });

  describe('getToolInfo', () => {
    it('도구 정보를 올바르게 반환해야 한다', async () => {
      // Given
      const originalEnv = process.env.npm_package_version;
      const originalVersion = process.version;
      const originalPlatform = process.platform;

      process.env.npm_package_version = '1.2.3';

      // When
      const result = await infoService.getToolInfo();

      // Then
      expect(result.cliVersion).toBe('1.2.3');
      expect(result.nodeVersion).toBe(originalVersion);
      expect(result.platform).toBe(originalPlatform);

      // Cleanup
      process.env.npm_package_version = originalEnv;
    });

    it('npm_package_version이 없을 때 기본값을 사용해야 한다', async () => {
      // Given
      const originalEnv = process.env.npm_package_version;
      delete process.env.npm_package_version;

      // When
      const result = await infoService.getToolInfo();

      // Then
      expect(result.cliVersion).toBe('0.0.1');

      // Cleanup
      process.env.npm_package_version = originalEnv;
    });
  });

  describe('getSessionInfo', () => {
    it('유효한 세션 정보를 반환해야 한다', async () => {
      // Given
      const futureDate = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2시간 후
      const sessionWithFutureExpiry = {
        ...mockUserSession,
        expiresAt: futureDate,
      };
      mockAuthService.getSession.mockResolvedValue(sessionWithFutureExpiry);

      // When
      const result = await infoService.getSessionInfo();

      // Then
      expect(result).toBeDefined();
      expect(result?.isExpired).toBe(false);
      expect(result?.expiresAt).toEqual(futureDate);
      expect(result?.timeUntilExpiry).toBeGreaterThan(0);
    });

    it('만료된 세션 정보를 반환해야 한다', async () => {
      // Given
      const pastDate = new Date(now.getTime() - 60 * 60 * 1000); // 1시간 전
      const expiredSession = {
        ...mockUserSession,
        expiresAt: pastDate,
      };
      mockAuthService.getSession.mockResolvedValue(expiredSession);

      // When
      const result = await infoService.getSessionInfo();

      // Then
      expect(result).toBeDefined();
      expect(result?.isExpired).toBe(true);
      expect(result?.expiresAt).toEqual(pastDate);
      expect(result?.timeUntilExpiry).toBe(0);
    });

    it('세션이 없을 때 null을 반환해야 한다', async () => {
      // Given
      mockAuthService.getSession.mockResolvedValue(null);

      // When
      const result = await infoService.getSessionInfo();

      // Then
      expect(result).toBeNull();
      expect(mockAuthService.getSession).toHaveBeenCalledOnce();
    });
  });

  describe('getSyncInfo', () => {
    it('동기화 정보의 기본값을 반환해야 한다', async () => {
      // When
      const result = await infoService.getSyncInfo();

      // Then
      expect(result.lastSyncTime).toBeNull();
      expect(result.configCount).toBe(0);
    });
  });
});
