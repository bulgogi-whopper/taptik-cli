import { SupabaseClient } from '@supabase/supabase-js';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { ImportService } from './import.service';
import { createMockTaptikContext } from './test-helpers';

describe('ImportService', () => {
  let service: ImportService;
  let mockSupabaseClient: Partial<SupabaseClient>;
  let mockSupabaseService: any;

  beforeEach(() => {
    mockSupabaseClient = {
      storage: {
        from: vi.fn().mockReturnValue({
          download: vi.fn(),
          list: vi.fn(),
        }),
      } as any,
      auth: {
        getUser: vi.fn(),
        getSession: vi.fn(),
      } as any,
    };

    mockSupabaseService = {
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
    } as any;

    // Create service instance directly with mock dependencies
    const mockLargeFileStreamer = { stream: vi.fn() } as any;
    service = new ImportService(mockSupabaseService, mockLargeFileStreamer);

    // Reset mock delay to speed up tests
    vi.spyOn(service as any, 'delay').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('importConfiguration', () => {
    it('should fetch and parse valid configuration', async () => {
      const mockConfigId = 'test-config-123';
      const mockContext = createMockTaptikContext();
      const mockData = Buffer.from(JSON.stringify(mockContext));

      const downloadMock = vi.fn().mockResolvedValue({
        data: {
          arrayBuffer: vi
            .fn()
            .mockResolvedValue(
              mockData.buffer.slice(
                mockData.byteOffset,
                mockData.byteOffset + mockData.byteLength,
              ),
            ),
        },
        error: null,
      });

      mockSupabaseClient.storage!.from = vi.fn().mockReturnValue({
        download: downloadMock,
      });

      const result = await service.importConfiguration(mockConfigId);

      expect(result).toEqual(mockContext);
      expect(mockSupabaseClient.storage!.from).toHaveBeenCalledWith(
        'taptik-configs',
      );
      expect(downloadMock).toHaveBeenCalledWith(`configs/${mockConfigId}.json`);
    });

    it('should throw error for invalid config ID', async () => {
      const downloadMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      mockSupabaseClient.storage!.from = vi.fn().mockReturnValue({
        download: downloadMock,
      });

      await expect(service.importConfiguration('invalid-id')).rejects.toThrow(
        /Failed to fetch configuration/,
      );
    });

    it('should throw error for invalid JSON', async () => {
      const mockData = Buffer.from('invalid json');

      const downloadMock = vi.fn().mockResolvedValue({
        data: {
          arrayBuffer: vi
            .fn()
            .mockResolvedValue(
              mockData.buffer.slice(
                mockData.byteOffset,
                mockData.byteOffset + mockData.byteLength,
              ),
            ),
        },
        error: null,
      });

      mockSupabaseClient.storage!.from = vi.fn().mockReturnValue({
        download: downloadMock,
      });

      await expect(service.importConfiguration('test-id')).rejects.toThrow(
        /Failed to parse configuration/,
      );
    });

    it('should retry on network failure', async () => {
      const mockContext = createMockTaptikContext();
      const mockData = Buffer.from(JSON.stringify(mockContext));

      const downloadMock = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          data: {
            arrayBuffer: vi
              .fn()
              .mockResolvedValue(
                mockData.buffer.slice(
                  mockData.byteOffset,
                  mockData.byteOffset + mockData.byteLength,
                ),
              ),
          },
          error: null,
        });

      mockSupabaseClient.storage!.from = vi.fn().mockReturnValue({
        download: downloadMock,
      });

      const result = await service.importConfiguration('test-id');

      expect(result).toEqual(mockContext);
      expect(downloadMock).toHaveBeenCalledTimes(3);
    });

    it('should cache imported configurations', async () => {
      const mockConfigId = 'test-config-123';
      const mockContext = createMockTaptikContext();
      const mockData = Buffer.from(JSON.stringify(mockContext));
      const mockMetadata = { 
        id: mockConfigId, 
        name: 'Test Config', 
        version: '1.0.0',
        createdAt: '2023-01-01',
        platform: 'claude-code',
        size: 1024 // Small file, no streaming
      };
      const mockMetadataData = Buffer.from(JSON.stringify(mockMetadata));

      const downloadMock = vi.fn()
        .mockImplementationOnce(() => Promise.resolve({
          data: {
            arrayBuffer: vi.fn().mockResolvedValue(
              mockMetadataData.buffer.slice(
                mockMetadataData.byteOffset,
                mockMetadataData.byteOffset + mockMetadataData.byteLength,
              ),
            ),
          },
          error: null,
        }))
        .mockImplementationOnce(() => Promise.resolve({
          data: {
            arrayBuffer: vi.fn().mockResolvedValue(
              mockData.buffer.slice(
                mockData.byteOffset,
                mockData.byteOffset + mockData.byteLength,
              ),
            ),
          },
          error: null,
        }));

      mockSupabaseClient.storage!.from = vi.fn().mockReturnValue({
        download: downloadMock,
      });

      // First call - should fetch metadata + config from Supabase
      const result1 = await service.importConfiguration(mockConfigId);
      expect(downloadMock).toHaveBeenCalledTimes(2); // metadata + config

      // Second call - should use cache, no additional downloads
      const result2 = await service.importConfiguration(mockConfigId);
      expect(downloadMock).toHaveBeenCalledTimes(2); // Still 2, not more
      expect(result2).toEqual(result1);
    });
  });

  describe('validateConfigExists', () => {
    it('should return true for existing config', async () => {
      const listMock = vi.fn().mockResolvedValue({
        data: [{ name: 'test-config-123.json' }],
        error: null,
      });

      mockSupabaseClient.storage!.from = vi.fn().mockReturnValue({
        list: listMock,
      });

      const result = await service.validateConfigExists('test-config-123');
      expect(result).toBe(true);
    });

    it('should return false for non-existing config', async () => {
      const listMock = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      mockSupabaseClient.storage!.from = vi.fn().mockReturnValue({
        list: listMock,
      });

      const result = await service.validateConfigExists('non-existing');
      expect(result).toBe(false);
    });

    it('should handle list errors gracefully', async () => {
      const listMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Access denied' },
      });

      mockSupabaseClient.storage!.from = vi.fn().mockReturnValue({
        list: listMock,
      });

      const result = await service.validateConfigExists('test-id');
      expect(result).toBe(false);
    });
  });

  describe('getConfigMetadata', () => {
    it('should fetch and parse metadata successfully', async () => {
      const mockMetadata = {
        id: 'test-config-123',
        name: 'Test Config',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        platform: 'claude-code',
        size: 1024,
      };

      const mockData = Buffer.from(JSON.stringify(mockMetadata));
      const downloadMock = vi.fn().mockResolvedValue({
        data: {
          arrayBuffer: vi
            .fn()
            .mockResolvedValue(
              mockData.buffer.slice(
                mockData.byteOffset,
                mockData.byteOffset + mockData.byteLength,
              ),
            ),
        },
        error: null,
      });

      mockSupabaseClient.storage!.from = vi.fn().mockReturnValue({
        download: downloadMock,
      });

      const result = await service.getConfigMetadata('test-config-123');
      expect(result).toEqual(mockMetadata);
    });

    it('should return null for non-existing metadata', async () => {
      const downloadMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      mockSupabaseClient.storage!.from = vi.fn().mockReturnValue({
        download: downloadMock,
      });

      const result = await service.getConfigMetadata('non-existing');
      expect(result).toBeNull();
    });
  });
});
