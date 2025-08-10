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

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    authService = new AuthService();
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

      // Act
      await authService.logout();

      // Assert
      expect(mockAuth.signOut).toHaveBeenCalled();
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
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        user_metadata: { username: 'testuser' },
      };

      mockAuth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Act
      const result = await authService.getCurrentUser();

      // Assert
      expect(result).toMatchObject({
        id: '123',
        email: 'test@example.com',
      });
    });

    it('should return null when not authenticated', async () => {
      // Arrange
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'User not authenticated' },
      });

      // Act
      const result = await authService.getCurrentUser();

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when no user found', async () => {
      // Arrange
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      // Act
      const result = await authService.getCurrentUser();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getSession', () => {
    it('should return current session when authenticated', async () => {
      // Arrange
      const mockUser = {
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
        user: mockUser,
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
