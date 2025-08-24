import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

import {
  ConfigBundle,
  DisplayConfiguration,
  ListConfigurationsOptions,
  ListOptions,
} from '../../../models/config-bundle.model';
import { User } from '../../../models/user.model';
import { AuthService } from '../../auth/auth.service';

import { ListService } from './list.service';

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(),
};

vi.mock('../../../supabase/supabase-client', () => ({
  getSupabaseClient: () => mockSupabaseClient,
}));

describe('ListService', () => {
  let service: ListService;
  let authService: AuthService;
  let mockQuery: {
    select: Mock;
    eq: Mock;
    or: Mock;
    ilike: Mock;
    order: Mock;
    range: Mock;
  };

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: null,
    provider: 'google',
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListService,
        {
          provide: AuthService,
          useValue: {
            getCurrentUser: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ListService>(ListService);
    authService = module.get<AuthService>(AuthService);
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

    it('should handle database errors', async () => {
      // Arrange
      mockQuery.range.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
        count: null,
      });

      // Act & Assert
      await expect(service.listConfigurations()).rejects.toThrow(
        'Database query failed: Database connection failed',
      );
    });

    it('should validate invalid sort option', async () => {
      // Arrange
      const options: ListConfigurationsOptions = {
        sort: 'invalid' as any,
      };

      // Act & Assert
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
        'Invalid options: Limit must be a positive integer',
      );
    });

    it('should validate limit exceeding maximum', async () => {
      // Arrange
      const options: ListConfigurationsOptions = {
        limit: 150,
      };

      // Act & Assert
      await expect(service.listConfigurations(options)).rejects.toThrow(
        'Invalid options: Limit cannot exceed 100',
      );
    });
  });

  describe('listLikedConfigurations', () => {
    it('should list liked configurations successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const mockData = [{ ...mockConfigBundle, isLiked: true }];
      mockQuery.range.mockResolvedValue({
        data: mockData,
        error: null,
        count: 1,
      });

      // Act
      const result = await service.listLikedConfigurations(userId);

      // Assert
      expect(result.configurations).toHaveLength(1);
      expect(result.configurations[0].title).toBe('Test Configuration');
      expect(result.configurations[0].isLiked).toBe(true);
      expect(result.totalCount).toBe(1);
      expect(result.hasMore).toBe(false);

      // Verify query chain
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('config_bundles');
      expect(mockQuery.select).toHaveBeenCalledWith(
        expect.stringContaining('user_likes!inner'),
        { count: 'exact' },
      );
      expect(mockQuery.eq).toHaveBeenCalledWith('user_likes.user_id', userId);
    });

    it('should apply filter to liked configurations', async () => {
      // Arrange
      const userId = 'user-123';
      const options: ListOptions = {
        filter: 'config',
      };
      mockQuery.range.mockResolvedValue({
        data: [mockConfigBundle],
        error: null,
        count: 1,
      });

      // Act
      await service.listLikedConfigurations(userId, options);

      // Assert
      expect(mockQuery.ilike).toHaveBeenCalledWith('title', '%config%');
    });

    it('should sort liked configurations by like date', async () => {
      // Arrange
      const userId = 'user-123';
      const options: ListOptions = {
        sort: 'date',
      };
      mockQuery.range.mockResolvedValue({
        data: [mockConfigBundle],
        error: null,
        count: 1,
      });

      // Act
      await service.listLikedConfigurations(userId, options);

      // Assert
      expect(mockQuery.order).toHaveBeenCalledWith('user_likes.created_at', {
        ascending: false,
      });
    });

    it('should sort liked configurations by name', async () => {
      // Arrange
      const userId = 'user-123';
      const options: ListOptions = {
        sort: 'name',
      };
      mockQuery.range.mockResolvedValue({
        data: [mockConfigBundle],
        error: null,
        count: 1,
      });

      // Act
      await service.listLikedConfigurations(userId, options);

      // Assert
      expect(mockQuery.order).toHaveBeenCalledWith('title', {
        ascending: true,
      });
    });

    it('should handle empty liked configurations', async () => {
      // Arrange
      const userId = 'user-123';
      mockQuery.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      // Act
      const result = await service.listLikedConfigurations(userId);

      // Assert
      expect(result.configurations).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should handle database errors for liked configurations', async () => {
      // Arrange
      const userId = 'user-123';
      mockQuery.range.mockResolvedValue({
        data: null,
        error: { message: 'User not found' },
        count: null,
      });

      // Act & Assert
      await expect(service.listLikedConfigurations(userId)).rejects.toThrow(
        'Database query failed: User not found',
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

    it('should validate filter length', async () => {
      // Arrange
      const options: ListOptions = {
        filter: 'a'.repeat(101), // Exceeds 100 character limit
      };

      // Act & Assert
      await expect(service.listConfigurations(options)).rejects.toThrow(
        'Invalid options: Filter cannot exceed 100 characters',
      );
    });

    it('should validate non-string filter', async () => {
      // Arrange
      const options: ListOptions = {
        filter: 123 as any,
      };

      // Act & Assert
      await expect(service.listConfigurations(options)).rejects.toThrow(
        'Invalid options: Filter must be a string',
      );
    });

    it('should validate non-integer limit', async () => {
      // Arrange
      const options: ListOptions = {
        limit: 10.5,
      };

      // Act & Assert
      await expect(service.listConfigurations(options)).rejects.toThrow(
        'Invalid options: Limit must be a positive integer',
      );
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
