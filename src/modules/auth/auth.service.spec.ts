import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { AuthService } from './auth.service';

// Mock the supabase client
const mockAuth = {
  signOut: vi.fn(),
  getUser: vi.fn(),
  getSession: vi.fn(),
  refreshSession: vi.fn(),
};

vi.mock('../../supabase/supabase-client', () => ({
  getSupabaseClient: vi.fn(() => ({
    auth: mockAuth,
  })),
}));

// Mock the SessionService
const mockSessionService = {
  loadSession: vi.fn(),
  saveSession: vi.fn(),
  clearSession: vi.fn(),
  hasSession: vi.fn(),
  isSessionValid: vi.fn(),
  getSessionPath: vi.fn(),
  getConfiguration: vi.fn(),
  extendSession: vi.fn(),
  getSessionStats: vi.fn(),
};

vi.mock('./services/session.service', () => ({
  SessionService: vi.fn(() => mockSessionService),
}));

// Mock the OAuthProviderService
const mockOAuthProviderService = {
  startOAuthFlow: vi.fn(),
  handleOAuthCallback: vi.fn(),
  getProviderConfig: vi.fn(),
  validateProviderConfig: vi.fn(),
  startCallbackServer: vi.fn(),
  stopCallbackServer: vi.fn(),
  getSupportedProviders: vi.fn(),
  isProviderSupported: vi.fn(),
  getOAuthConfig: vi.fn(),
  updateProviderConfig: vi.fn(),
};

vi.mock('./services/oauth-provider.service', () => ({
  OAuthProviderService: vi.fn(() => mockOAuthProviderService),
}));

// Mock ConfigService
const mockConfigService = {
  get: vi.fn(),
};

vi.mock('@nestjs/config', () => ({
  ConfigService: vi.fn(() => mockConfigService),
}));

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    authService = new AuthService(mockConfigService as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('logout', () => {
    it('should successfully logout', async () => {
      // Arrange
      mockAuth.signOut.mockResolvedValue({
        error: null,
      });
      mockSessionService.clearSession.mockResolvedValue(undefined);

      // Act
      await authService.logout();

      // Assert
      expect(mockAuth.signOut).toHaveBeenCalled();
      expect(mockSessionService.clearSession).toHaveBeenCalled();
    });

    it('should throw error when logout fails', async () => {
      // Arrange
      mockAuth.signOut.mockResolvedValue({
        error: { message: 'Logout failed' },
      });

      // Act & Assert
      await expect(authService.logout()).rejects.toThrow(
        'Logout failed: Logout failed',
      );
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user when authenticated', async () => {
      // Arrange
      const _mockUser = {
        id: '123',
        email: 'test@example.com',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        user_metadata: { username: 'testuser' },
      };

      // Mock stored session
      mockSessionService.loadSession.mockResolvedValue({
        userSession: {
          user: {
            id: '123',
            email: 'test@example.com',
            createdAt: new Date('2023-01-01T00:00:00Z'),
            updatedAt: new Date('2023-01-01T00:00:00Z'),
          },
          accessToken: 'token',
          refreshToken: 'refresh',
          expiresAt: new Date(),
        },
        storedAt: '2023-01-01T00:00:00Z',
      });

      // Act
      const result = await authService.getCurrentUser();

      // Assert
      expect(result).toMatchObject({
        id: '123',
        email: 'test@example.com',
      });
      expect(mockSessionService.loadSession).toHaveBeenCalled();
    });

    it('should return null when not authenticated', async () => {
      // Arrange
      mockSessionService.loadSession.mockResolvedValue(null);
      mockAuth.getSession.mockResolvedValue({
        data: { session: null },
        error: null, // No error, just no session - this is the normal "not authenticated" case
      });

      // Act
      const result = await authService.getCurrentUser();

      // Assert
      expect(result).toBeNull();
      expect(mockSessionService.loadSession).toHaveBeenCalled();
    });

    it('should return null when no user found', async () => {
      // Arrange
      mockSessionService.loadSession.mockResolvedValue(null);
      mockAuth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      // Act
      const result = await authService.getCurrentUser();

      // Assert
      expect(result).toBeNull();
      expect(mockSessionService.loadSession).toHaveBeenCalled();
    });
  });

  describe('getSession', () => {
    it('should return current session when authenticated', async () => {
      // Arrange
      const _mockUser = {
        id: '123',
        email: 'test@example.com',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        user_metadata: { username: 'testuser' },
      };
      const mockSession = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: _mockUser,
      };

      mockAuth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Act
      const result = await authService.getSession();

      // Assert
      expect(result).toMatchObject({
        user: expect.objectContaining({
          id: '123',
          email: 'test@example.com',
        }),
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should return null when no session exists', async () => {
      // Arrange
      mockAuth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      // Act
      const result = await authService.getSession();

      // Assert
      expect(result).toBeNull();
    });
  });
});
