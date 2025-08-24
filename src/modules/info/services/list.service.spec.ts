import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

import {
  ConfigBundle,
  ListConfigurationsOptions,
  ListOptions,
} from '../../../models/config-bundle.model';
import { AuthService } from '../../auth/auth.service';

import {
  ListService,
  NetworkError,
  AuthenticationError,
  ServerError,
  ValidationError,
} from './list.service';

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(),
};

vi.mock('../../../supabase/supabase-client', () => ({
  getSupabaseClient: () => mockSupabaseClient,
}));

describe('ListService', () => {
  let service: ListService;
  let mockAuthService: any;
  let mockQuery: {
    select: Mock;
    eq: Mock;
    or: Mock;
    ilike: Mock;
    order: Mock;
    range: Mock;
  };

  const mockConfigBundle: ConfigBundle = {
    id: 'config-123',
    title: 'Test Configuration',
    description: 'A test configuration',
    source_ide: 'cursor-ide',
    target_ides: ['kiro-ide'],
    tags: ['test'],
    is_public: true,
    file_path: '/configs/test.json',
    file_size: 1024,
    download_count: 5,
    like_count: 2,
    version: '1.0.0',
    created_at: new Date('2025-08-20T10:00:00Z'),
    updated_at: new Date('2025-08-20T10:00:00Z'),
    user_id: 'user-456',
    author: 'Test Author',
  };

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup query chain mock
    mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
    };

    mockSupabaseClient.from.mockReturnValue(mockQuery);

    // Setup mock auth service
    mockAuthService = {
      getCurrentUser: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListService,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    service = module.get<ListService>(ListService);

    // 서비스 인스턴스의 authService를 직접 설정
    (service as any).authService = mockAuthService;
  });

  describe('listConfigurations', () => {
    it('should list public configurations successfully', async () => {
      // Arrange
      const mockData = [mockConfigBundle];
      mockQuery.range.mockResolvedValue({
        data: mockData,
        error: null,
        count: 1,
      });

      // Act
      const result = await service.listConfigurations();

      // Assert
      expect(result.configurations).toHaveLength(1);
      expect(result.configurations[0].title).toBe('Test Configuration');
      expect(result.configurations[0].accessLevel).toBe('Public');
      expect(result.totalCount).toBe(1);
      expect(result.hasMore).toBe(false);

      // Verify query chain
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('config_bundles');
      expect(mockQuery.select).toHaveBeenCalledWith('*', { count: 'exact' });
      expect(mockQuery.eq).toHaveBeenCalledWith('is_public', true);
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
      expect(mockQuery.range).toHaveBeenCalledWith(0, 19); // Default limit 20
    });

    it('should apply title filter correctly', async () => {
      // Arrange
      const options: ListConfigurationsOptions = {
        filter: 'test',
      };
      mockQuery.range.mockResolvedValue({
        data: [mockConfigBundle],
        error: null,
        count: 1,
      });

      // Act
      await service.listConfigurations(options);

      // Assert
      expect(mockQuery.ilike).toHaveBeenCalledWith('title', '%test%');
    });

    it('should apply name sorting correctly', async () => {
      // Arrange
      const options: ListConfigurationsOptions = {
        sort: 'name',
      };
      mockQuery.range.mockResolvedValue({
        data: [mockConfigBundle],
        error: null,
        count: 1,
      });

      // Act
      await service.listConfigurations(options);

      // Assert
      expect(mockQuery.order).toHaveBeenCalledWith('title', {
        ascending: true,
      });
    });

    it('should apply custom limit correctly', async () => {
      // Arrange
      const options: ListConfigurationsOptions = {
        limit: 10,
      };
      mockQuery.range.mockResolvedValue({
        data: [mockConfigBundle],
        error: null,
        count: 1,
      });

      // Act
      await service.listConfigurations(options);

      // Assert
      expect(mockQuery.range).toHaveBeenCalledWith(0, 9); // limit 10 -> range 0-9
    });

    it('should include private configurations when includePrivate is true', async () => {
      // Arrange
      const options: ListConfigurationsOptions = {
        includePrivate: true,
        userId: 'user-123',
      };
      mockQuery.range.mockResolvedValue({
        data: [mockConfigBundle],
        error: null,
        count: 1,
      });

      // Act
      await service.listConfigurations(options);

      // Assert
      expect(mockQuery.or).toHaveBeenCalledWith(
        'is_public.eq.true,user_id.eq.user-123',
      );
    });

    it('should handle empty results', async () => {
      // Arrange
      mockQuery.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      // Act
      const result = await service.listConfigurations();

      // Assert
      expect(result.configurations).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should handle network errors correctly', async () => {
      // Arrange
      mockQuery.range.mockResolvedValue({
        data: null,
        error: { code: 'PGRST301', message: 'Network connection failed' },
        count: null,
      });

      // Act & Assert
      await expect(service.listConfigurations()).rejects.toThrow(NetworkError);
      await expect(service.listConfigurations()).rejects.toThrow(
        'Unable to connect to Taptik cloud. Please check your internet connection.',
      );
    });

    it('should handle authentication errors correctly', async () => {
      // Arrange
      mockQuery.range.mockResolvedValue({
        data: null,
        error: { code: '401', message: 'Unauthorized access' },
        count: null,
      });

      // Act & Assert
      await expect(service.listConfigurations()).rejects.toThrow(
        AuthenticationError,
      );
      await expect(service.listConfigurations()).rejects.toThrow(
        "Authentication failed. Please run 'taptik login' first.",
      );
    });

    it('should handle server errors correctly', async () => {
      // Arrange
      mockQuery.range.mockResolvedValue({
        data: null,
        error: { code: 500, message: 'Internal server error' },
        count: null,
      });

      // Act & Assert
      await expect(service.listConfigurations()).rejects.toThrow(ServerError);
      await expect(service.listConfigurations()).rejects.toThrow(
        'Taptik cloud is temporarily unavailable. Please try again later.',
      );
    });

    it('should handle rate limiting errors correctly', async () => {
      // Arrange
      mockQuery.range.mockResolvedValue({
        data: null,
        error: { code: '429', message: 'Too many requests' },
        count: null,
      });

      // Act & Assert
      await expect(service.listConfigurations()).rejects.toThrow(ServerError);
      await expect(service.listConfigurations()).rejects.toThrow(
        'Taptik cloud is experiencing high traffic. Please try again in a moment.',
      );
    });

    it('should sanitize filter input to prevent injection', async () => {
      // Arrange
      const options: ListConfigurationsOptions = {
        filter: "test'; DROP TABLE config_bundles; --",
      };
      mockQuery.range.mockResolvedValue({
        data: [mockConfigBundle],
        error: null,
        count: 1,
      });

      // Act
      await service.listConfigurations(options);

      // Assert - sanitized filter should remove dangerous characters
      expect(mockQuery.ilike).toHaveBeenCalledWith(
        'title',
        '%test DROP TABLE config_bundles --%',
      );
    });

    it('should validate invalid sort option', async () => {
      // Arrange
      const options: ListConfigurationsOptions = {
        sort: 'invalid' as any,
      };

      // Act & Assert
      await expect(service.listConfigurations(options)).rejects.toThrow(
        ValidationError,
      );
      await expect(service.listConfigurations(options)).rejects.toThrow(
        "Invalid options: Invalid sort option 'invalid'. Valid options: date, name",
      );
    });

    it('should validate invalid limit option', async () => {
      // Arrange
      const options: ListConfigurationsOptions = {
        limit: 0,
      };

      // Act & Assert
      await expect(service.listConfigurations(options)).rejects.toThrow(
        ValidationError,
      );
      await expect(service.listConfigurations(options)).rejects.toThrow(
        'Invalid options: Limit must be greater than 0',
      );
    });

    it('should validate limit exceeding maximum', async () => {
      // Arrange
      const options: ListConfigurationsOptions = {
        limit: 150,
      };

      // Act & Assert
      await expect(service.listConfigurations(options)).rejects.toThrow(
        ValidationError,
      );
      await expect(service.listConfigurations(options)).rejects.toThrow(
        'Invalid options: Limit cannot exceed 100',
      );
    });

    it('should validate non-integer limit', async () => {
      // Arrange
      const options: ListConfigurationsOptions = {
        limit: 10.5,
      };

      // Act & Assert
      await expect(service.listConfigurations(options)).rejects.toThrow(
        ValidationError,
      );
      await expect(service.listConfigurations(options)).rejects.toThrow(
        'Invalid options: Limit must be a positive integer',
      );
    });
  });

  describe('listLikedConfigurations', () => {
    it('should list liked configurations successfully when authenticated', async () => {
      // Arrange
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockAuthService.getCurrentUser.mockResolvedValue(mockUser);

      const mockData = [{ ...mockConfigBundle, isLiked: true }];
      mockQuery.range.mockResolvedValue({
        data: mockData,
        error: null,
        count: 1,
      });

      // Act
      const result = await service.listLikedConfigurations();

      // Assert
      expect(result.configurations).toHaveLength(1);
      expect(result.configurations[0].title).toBe('Test Configuration');
      expect(result.configurations[0].isLiked).toBe(true);
      expect(result.totalCount).toBe(1);
      expect(result.hasMore).toBe(false);

      // Verify authentication check
      expect(mockAuthService.getCurrentUser).toHaveBeenCalled();

      // Verify query chain
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('config_bundles');
      expect(mockQuery.select).toHaveBeenCalledWith(
        expect.stringContaining('user_likes!inner'),
        { count: 'exact' },
      );
      expect(mockQuery.eq).toHaveBeenCalledWith(
        'user_likes.user_id',
        mockUser.id,
      );
    });

    it('should throw authentication error when user is not authenticated', async () => {
      // Arrange
      mockAuthService.getCurrentUser.mockResolvedValue(null);

      // Act & Assert
      await expect(service.listLikedConfigurations()).rejects.toThrow(
        AuthenticationError,
      );
      await expect(service.listLikedConfigurations()).rejects.toThrow(
        "Authentication failed. Please run 'taptik login' first.",
      );
    });

    it('should apply filter to liked configurations', async () => {
      // Arrange
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockAuthService.getCurrentUser.mockResolvedValue(mockUser);

      const options: ListOptions = {
        filter: 'config',
      };
      mockQuery.range.mockResolvedValue({
        data: [mockConfigBundle],
        error: null,
        count: 1,
      });

      // Act
      await service.listLikedConfigurations(options);

      // Assert
      expect(mockQuery.ilike).toHaveBeenCalledWith('title', '%config%');
    });

    it('should sort liked configurations by like date', async () => {
      // Arrange
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockAuthService.getCurrentUser.mockResolvedValue(mockUser);

      const options: ListOptions = {
        sort: 'date',
      };
      mockQuery.range.mockResolvedValue({
        data: [mockConfigBundle],
        error: null,
        count: 1,
      });

      // Act
      await service.listLikedConfigurations(options);

      // Assert
      expect(mockQuery.order).toHaveBeenCalledWith('user_likes.created_at', {
        ascending: false,
      });
    });

    it('should sort liked configurations by name', async () => {
      // Arrange
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockAuthService.getCurrentUser.mockResolvedValue(mockUser);

      const options: ListOptions = {
        sort: 'name',
      };
      mockQuery.range.mockResolvedValue({
        data: [mockConfigBundle],
        error: null,
        count: 1,
      });

      // Act
      await service.listLikedConfigurations(options);

      // Assert
      expect(mockQuery.order).toHaveBeenCalledWith('title', {
        ascending: true,
      });
    });

    it('should handle empty liked configurations', async () => {
      // Arrange
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockAuthService.getCurrentUser.mockResolvedValue(mockUser);

      mockQuery.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      // Act
      const result = await service.listLikedConfigurations();

      // Assert
      expect(result.configurations).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should handle database errors for liked configurations', async () => {
      // Arrange
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockAuthService.getCurrentUser.mockResolvedValue(mockUser);

      mockQuery.range.mockResolvedValue({
        data: null,
        error: { code: 500, message: 'Server error' },
        count: null,
      });

      // Act & Assert
      await expect(service.listLikedConfigurations()).rejects.toThrow(
        ServerError,
      );
    });
  });

  describe('requireAuthentication', () => {
    it('should return user ID when authenticated', async () => {
      // Arrange
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockAuthService.getCurrentUser.mockResolvedValue(mockUser);

      // Act
      const userId = await service.requireAuthentication();

      // Assert
      expect(userId).toBe('user-123');
      expect(mockAuthService.getCurrentUser).toHaveBeenCalled();
    });

    it('should throw AuthenticationError when not authenticated', async () => {
      // Arrange
      mockAuthService.getCurrentUser.mockResolvedValue(null);

      // Act & Assert
      await expect(service.requireAuthentication()).rejects.toThrow(
        AuthenticationError,
      );
      await expect(service.requireAuthentication()).rejects.toThrow(
        "Authentication failed. Please run 'taptik login' first.",
      );
    });
  });

  describe('validation methods', () => {
    it('should validate correct options', async () => {
      // Arrange
      const options: ListOptions = {
        filter: 'test',
        sort: 'name',
        limit: 10,
      };
      mockQuery.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      // Act & Assert - should not throw
      await expect(service.listConfigurations(options)).resolves.toBeDefined();
    });

    it('should validate non-string filter', async () => {
      // Arrange
      const options: ListOptions = {
        filter: 123 as any,
      };

      // Act & Assert
      await expect(service.listConfigurations(options)).rejects.toThrow(
        ValidationError,
      );
      await expect(service.listConfigurations(options)).rejects.toThrow(
        'Invalid options: Filter must be a string',
      );
    });
  });

  describe('exit codes', () => {
    it('should have correct exit code for network errors', async () => {
      // Arrange
      mockQuery.range.mockResolvedValue({
        data: null,
        error: { code: 'PGRST301', message: 'Network connection failed' },
        count: null,
      });

      // Act & Assert
      try {
        await service.listConfigurations();
      } catch (error: any) {
        expect(error).toBeInstanceOf(NetworkError);
        expect(error.exitCode).toBe(3); // EXIT_CODES.NETWORK_ERROR
      }
    });

    it('should have correct exit code for authentication errors', async () => {
      // Arrange
      mockQuery.range.mockResolvedValue({
        data: null,
        error: { code: '401', message: 'Unauthorized access' },
        count: null,
      });

      // Act & Assert
      try {
        await service.listConfigurations();
      } catch (error: any) {
        expect(error).toBeInstanceOf(AuthenticationError);
        expect(error.exitCode).toBe(4); // EXIT_CODES.AUTH_ERROR
      }
    });

    it('should have correct exit code for server errors', async () => {
      // Arrange
      mockQuery.range.mockResolvedValue({
        data: null,
        error: { code: 500, message: 'Internal server error' },
        count: null,
      });

      // Act & Assert
      try {
        await service.listConfigurations();
      } catch (error: any) {
        expect(error).toBeInstanceOf(ServerError);
        expect(error.exitCode).toBe(5); // EXIT_CODES.SERVER_ERROR
      }
    });

    it('should have correct exit code for validation errors', async () => {
      // Arrange
      const options: ListConfigurationsOptions = {
        sort: 'invalid' as any,
      };

      // Act & Assert
      try {
        await service.listConfigurations(options);
      } catch (error: any) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.exitCode).toBe(2); // EXIT_CODES.INVALID_ARGUMENT
      }
    });
  });

  describe('error handling', () => {
    it('should handle unknown errors gracefully', async () => {
      // Arrange
      mockQuery.range.mockRejectedValue('Unknown error');

      // Act & Assert
      await expect(service.listConfigurations()).rejects.toThrow(
        'Failed to list configurations: Unknown error occurred',
      );
    });

    it('should handle null data response', async () => {
      // Arrange
      mockQuery.range.mockResolvedValue({
        data: null,
        error: null,
        count: null,
      });

      // Act
      const result = await service.listConfigurations();

      // Assert
      expect(result.configurations).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });
});
