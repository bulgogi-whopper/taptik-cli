import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { AuthService } from './auth.service';

// Mock the supabase client
const mockAuth = {
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  getUser: vi.fn(),
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
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

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      // Arrange
      const email = 'test@example.com';
      const password = 'password123';
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
      };

      mockAuth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      // Act
      const result = await authService.login(email, password);

      // Assert
      expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
        email,
        password,
      });
      expect(result).toMatchObject({
        user: expect.objectContaining({
          id: '123',
          email: 'test@example.com',
        }),
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should throw error when login fails', async () => {
      // Arrange
      const email = 'test@example.com';
      const password = 'wrongpassword';

      mockAuth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      // Act & Assert
      await expect(authService.login(email, password)).rejects.toThrow(
        'Login failed: Invalid login credentials',
      );
    });

    it('should throw error when no user or session returned', async () => {
      // Arrange
      const email = 'test@example.com';
      const password = 'password123';

      mockAuth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      // Act & Assert
      await expect(authService.login(email, password)).rejects.toThrow(
        'Login failed: No user or session returned',
      );
    });
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

  describe('signUp', () => {
    it('should successfully sign up a new user', async () => {
      // Arrange
      const email = 'new@example.com';
      const password = 'password123';
      const metadata = { username: 'newuser' };

      const mockUser = {
        id: '456',
        email: 'new@example.com',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        user_metadata: metadata,
      };
      const mockSession = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      mockAuth.signUp.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      // Act
      const result = await authService.signUp(email, password, metadata);

      // Assert
      expect(mockAuth.signUp).toHaveBeenCalledWith({
        email,
        password,
        options: { data: metadata },
      });
      expect(result).toMatchObject({
        user: expect.objectContaining({
          id: '456',
          email: 'new@example.com',
        }),
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });
  });
});
