import { NotFoundException, ConflictException } from '@nestjs/common';

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { ErrorHandlerService } from '../../deploy/services/error-handler.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { PushError } from '../constants/push.constants';
import { PackageMetadata } from '../interfaces';

import {
  PackageRegistryService,
  PackageFilters,
} from './package-registry.service';

describe('PackageRegistryService', () => {
  let service: PackageRegistryService;
  let mockSupabaseService: any;
  let mockErrorHandler: any;
  let mockSupabaseClient: any;

  const mockMetadata: PackageMetadata = {
    id: 'test-id',
    configId: 'test-config-id',
    name: 'test-package',
    title: 'Test Package',
    description: 'Test description',
    version: '1.0.0',
    platform: 'claude-code',
    isPublic: false,
    sanitizationLevel: 'safe',
    checksum: 'test-checksum',
    storageUrl: 'https://storage.example.com/test',
    packageSize: 1024,
    userId: 'test-user-id',
    teamId: undefined,
    components: [{ name: 'test-component', type: 'command', count: 1 }],
    autoTags: ['claude-code', 'test'],
    userTags: ['development'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockDatabasePackage = {
    id: 'test-id',
    config_id: 'test-config-id',
    name: 'test-package',
    title: 'Test Package',
    description: 'Test description',
    version: '1.0.0',
    platform: 'claude-code',
    is_public: false,
    sanitization_level: 'safe',
    checksum: 'test-checksum',
    storage_url: 'https://storage.example.com/test',
    package_size: 1024,
    user_id: 'test-user-id',
    team_id: null,
    components: [{ name: 'test-component', type: 'command', count: 1 }],
    auto_tags: ['claude-code', 'test'],
    user_tags: ['development'],
    download_count: 0,
    like_count: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    archived_at: null,
  };

  beforeEach(async () => {
    // Create a chainable mock with proper method chaining
    mockSupabaseClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
        }),
      },
    };

    // Make methods return mockSupabaseClient for chaining
    ['from', 'select', 'insert', 'update', 'eq', 'is', 'or', 'order', 'limit'].forEach(method => {
      mockSupabaseClient[method].mockReturnValue(mockSupabaseClient);
    });

    mockSupabaseService = {
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
    };

    mockErrorHandler = {
      handleError: vi.fn().mockResolvedValue({
        message: 'Test error',
        code: 'TEST_ERROR',
      }),
    };

    service = new PackageRegistryService(
      mockSupabaseService as SupabaseService,
      mockErrorHandler as ErrorHandlerService,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('registerPackage', () => {
    it('should successfully register a new package', async () => {
      // First call checks for duplicates (returns null - no duplicate)
      mockSupabaseClient.single
        .mockResolvedValueOnce({
          data: null,
          error: null,
        })
        // Second call returns the inserted package
        .mockResolvedValueOnce({
          data: mockDatabasePackage,
          error: null,
        });

      // Create version history mock 
      const versionHistoryMock = {
        from: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
      
      // Setup getClient to return version history mock on second call
      mockSupabaseService.getClient
        .mockReturnValueOnce(mockSupabaseClient)
        .mockReturnValueOnce(versionHistoryMock);

      const result = await service.registerPackage(mockMetadata);

      expect(result).toMatchObject({
        configId: 'test-config-id',
        name: 'test-package',
        title: 'Test Package',
        version: '1.0.0',
      });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('taptik_packages');
      expect(mockSupabaseClient.insert).toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate package', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 'existing-id' },
        error: null,
      });

      await expect(service.registerPackage(mockMetadata)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw PushError on database error', async () => {
      mockSupabaseClient.single
        .mockResolvedValueOnce({
          data: null,
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Database error' },
        });

      await expect(service.registerPackage(mockMetadata)).rejects.toThrow(
        PushError,
      );
    });
  });

  describe('updatePackage', () => {
    it('should successfully update package metadata', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockDatabasePackage,
        error: null,
      });

      const updates = {
        title: 'Updated Title',
        description: 'Updated description',
        userTags: ['production', 'stable'],
      };

      const result = await service.updatePackage('test-config-id', updates);

      expect(result.configId).toBe('test-config-id');
      expect(mockSupabaseClient.update).toHaveBeenCalled();
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        'config_id',
        'test-config-id',
      );
    });

    it('should throw NotFoundException when package not found', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      await expect(
        service.updatePackage('non-existent', { title: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw PushError when user not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
      });

      await expect(
        service.updatePackage('test-config-id', { title: 'Test' }),
      ).rejects.toThrow(PushError);
    });
  });

  describe('deletePackage', () => {
    it('should soft delete package by setting archived_at', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 'test-id' },
        error: null,
      });

      await service.deletePackage('test-config-id');

      expect(mockSupabaseClient.update).toHaveBeenCalled();
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        'config_id',
        'test-config-id',
      );
    });

    it('should throw NotFoundException when package not found', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      await expect(service.deletePackage('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should require authentication', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
      });

      await expect(service.deletePackage('test-config-id')).rejects.toThrow(
        PushError,
      );
    });
  });

  describe('listUserPackages', () => {
    it('should list user packages without filters', async () => {
      // Override order to return a promise (terminal operation)
      mockSupabaseClient.order = vi.fn().mockResolvedValue({
        data: [mockDatabasePackage],
        error: null,
      });

      const result = await service.listUserPackages('test-user-id');

      expect(result).toHaveLength(1);
      expect(result[0].configId).toBe('test-config-id');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        'user_id',
        'test-user-id',
      );
    });

    it('should apply platform filter', async () => {
      const filters: PackageFilters = { platform: 'claude-code' };

      // Create a query mock that implements promise interface
      const queryMock = {
        from: vi.fn(),
        select: vi.fn(),
        eq: vi.fn(),
        is: vi.fn(),
        order: vi.fn(),
        then: vi.fn((resolve) => {
          resolve({
            data: [mockDatabasePackage],
            error: null,
          });
        }),
      };

      // Make all methods return queryMock for chaining
      Object.keys(queryMock).forEach((key) => {
        if (key !== 'then') {
          queryMock[key as keyof typeof queryMock].mockReturnValue(queryMock);
        }
      });

      mockSupabaseService.getClient.mockReturnValue(queryMock);

      const result = await service.listUserPackages('test-user-id', filters);

      expect(result).toHaveLength(1);
      expect(queryMock.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(queryMock.eq).toHaveBeenCalledWith('platform', 'claude-code');
    });

    it('should handle empty result set', async () => {
      // Override order to return a promise
      mockSupabaseClient.order = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await service.listUserPackages('test-user-id');

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      // Override order to return a promise with error
      mockSupabaseClient.order = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(service.listUserPackages('test-user-id')).rejects.toThrow(
        PushError,
      );
    });
  });

  describe('getPackageStats', () => {
    it.skip('should retrieve package statistics', async () => {
      // All three queries use the same client instance in the service
      // First call - package stats
      mockSupabaseClient.single
        .mockResolvedValueOnce({
          data: { download_count: 100, like_count: 25 },
          error: null,
        })
        // Third call - last download (second single() call)
        .mockResolvedValueOnce({
          data: { created_at: '2024-01-15T12:00:00Z' },
          error: null,
        });

      // Second call - view count (uses select with special options)
      // Override eq to return the count on second call
      const originalEq = mockSupabaseClient.eq;
      let eqCallCount = 0;
      mockSupabaseClient.eq = vi.fn(() => {
        eqCallCount++;
        // After the second eq() call (package_id and event_type), return the count
        if (eqCallCount === 2) {
          // Return a thenable object that resolves to the count
          return Promise.resolve({
            count: 500,
            error: null,
          });
        }
        return mockSupabaseClient;
      });

      const result = await service.getPackageStats('test-config-id');

      // Restore original eq
      mockSupabaseClient.eq = originalEq;

      expect(result).toEqual({
        downloadCount: 100,
        likeCount: 25,
        viewCount: 500,
        lastDownloaded: new Date('2024-01-15T12:00:00Z'),
      });
    });

    it('should handle missing package', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      await expect(service.getPackageStats('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getPackageByConfigId', () => {
    it('should retrieve package by config ID', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockDatabasePackage,
        error: null,
      });

      const result = await service.getPackageByConfigId('test-config-id');

      expect(result).not.toBeNull();
      expect(result?.configId).toBe('test-config-id');
    });

    it('should return null when package not found', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      const result = await service.getPackageByConfigId('non-existent');

      expect(result).toBeNull();
    });

    it('should throw PushError on database error', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(
        service.getPackageByConfigId('test-config-id'),
      ).rejects.toThrow(PushError);
    });
  });

  describe('updatePackageVisibility', () => {
    it('should update package visibility to public', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { ...mockDatabasePackage, is_public: true },
        error: null,
      });

      const result = await service.updatePackageVisibility(
        'test-config-id',
        true,
      );

      expect(result.isPublic).toBe(true);
    });

    it('should update package visibility to private', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { ...mockDatabasePackage, is_public: false },
        error: null,
      });

      const result = await service.updatePackageVisibility(
        'test-config-id',
        false,
      );

      expect(result.isPublic).toBe(false);
    });
  });
});