/* global Blob */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AIPlatform } from '../interfaces';

import { ContextStorageService } from './context-storage.service';

import type { TaptikContext, BundleMetadata } from '../interfaces';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        download: vi.fn().mockResolvedValue({ data: null, error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      contains: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  })),
}));

describe('ContextStorageService', () => {
  let service: ContextStorageService;

  const mockContext: TaptikContext = {
    version: '1.0.0',
    metadata: {
      name: 'test-context',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      tags: ['test'],
      platforms: [AIPlatform.KIRO, AIPlatform.CLAUDE_CODE],
    },
    personal: {
      category: 'personal',
      spec_version: '1.0.0',
      data: {
        developer_profile: {
          experience_years: 5,
          primary_role: 'BACKEND' as any,
        },
      },
    },
  };

  const mockMetadata: BundleMetadata = {
    name: 'test-bundle',
    description: 'Test bundle',
    author: 'test-user',
    checksum: 'abc123',
  };

  beforeEach(async () => {
    const mockCompressionUtility = {
      compress: vi.fn((_data: Buffer) =>
        Promise.resolve(Buffer.from('compressed')),
      ),
      decompress: vi.fn((_data: Buffer) =>
        Promise.resolve(Buffer.from('decompressed')),
      ),
      isCompressed: vi.fn(() => true),
    };

    const mockEncryptionUtility = {
      encrypt: vi.fn((_data: Buffer) =>
        Promise.resolve(Buffer.from('encrypted')),
      ),
      decrypt: vi.fn((_data: Buffer) =>
        Promise.resolve(Buffer.from('decrypted')),
      ),
      isEncrypted: vi.fn(() => false),
      hash: vi.fn(() => 'hash123'),
    };

    const mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
        if (key === 'SUPABASE_ANON_KEY') return 'test-key';
        return undefined;
      }),
    };

    // Create the service instance directly with mocked dependencies
    service = new ContextStorageService(
      mockConfigService as any,
      mockCompressionUtility as any,
      mockEncryptionUtility as any,
    );
  });

  describe('uploadContext', () => {
    it('should upload a context successfully', async () => {
      // Mock Supabase responses
      const mockSupabase = {
        storage: {
          from: vi.fn(() => ({
            upload: vi.fn().mockResolvedValue({ error: null }),
          })),
        },
        from: vi.fn(() => ({
          insert: vi.fn().mockResolvedValue({ error: null }),
        })),
      };

      // @ts-expect-error - accessing private property for testing
      service.supabase = mockSupabase;

      const result = await service.uploadContext(mockContext, mockMetadata);

      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^ctx_/);
    });

    it('should compress context by default', async () => {
      const mockSupabase = {
        storage: {
          from: vi.fn(() => ({
            upload: vi.fn().mockResolvedValue({ error: null }),
          })),
        },
        from: vi.fn(() => ({
          insert: vi.fn().mockResolvedValue({ error: null }),
        })),
      };

      // @ts-expect-error - accessing private property for testing
      service.supabase = mockSupabase;

      await service.uploadContext(mockContext, mockMetadata);

      expect(service['compressionUtility'].compress).toHaveBeenCalled();
    });

    it('should encrypt context when requested', async () => {
      const mockSupabase = {
        storage: {
          from: vi.fn(() => ({
            upload: vi.fn().mockResolvedValue({ error: null }),
          })),
        },
        from: vi.fn(() => ({
          insert: vi.fn().mockResolvedValue({ error: null }),
        })),
      };

      // @ts-expect-error - accessing private property for testing
      service.supabase = mockSupabase;

      await service.uploadContext(
        mockContext,
        { ...mockMetadata, encryption: { algorithm: 'aes-256-gcm' } },
        { encrypt: true },
      );

      expect(service['encryptionUtility'].encrypt).toHaveBeenCalled();
    });

    it('should handle upload errors gracefully', async () => {
      const mockSupabase = {
        storage: {
          from: vi.fn(() => ({
            upload: vi
              .fn()
              .mockResolvedValue({ error: new Error('Upload failed') }),
          })),
        },
        from: vi.fn(() => ({
          insert: vi.fn().mockResolvedValue({ error: null }),
        })),
      };

      // @ts-expect-error - accessing private property for testing
      service.supabase = mockSupabase;

      const result = await service.uploadContext(mockContext, mockMetadata);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toBe('Upload failed');
    });

    it('should handle database insert errors gracefully', async () => {
      const mockSupabase = {
        storage: {
          from: vi.fn(() => ({
            upload: vi.fn().mockResolvedValue({ error: null }),
            remove: vi.fn().mockResolvedValue({ error: null }),
          })),
        },
        from: vi.fn(() => ({
          insert: vi
            .fn()
            .mockResolvedValue({ error: new Error('Database error') }),
        })),
      };

      // @ts-expect-error - accessing private property for testing
      service.supabase = mockSupabase;

      const result = await service.uploadContext(mockContext, mockMetadata);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toBe('Database error');
    });
  });

  describe('downloadContext', () => {
    it('should download a context successfully', async () => {
      const mockBundle = {
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
        contexts: [mockContext],
        metadata: mockMetadata,
      };

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              file_path: 'ctx_test.json.gz',
              is_compressed: true,
              is_encrypted: false,
              download_count: 0,
            },
            error: null,
          }),
          update: vi.fn().mockReturnThis(),
        })),
        storage: {
          from: vi.fn(() => ({
            download: vi.fn().mockResolvedValue({
              data: new Blob([JSON.stringify(mockBundle)]),
              error: null,
            }),
          })),
        },
      };

      // @ts-expect-error - accessing private property for testing
      service.supabase = mockSupabase;
      vi.mocked(service['compressionUtility'].decompress).mockResolvedValue(
        Buffer.from(JSON.stringify(mockBundle)),
      );

      const result = await service.downloadContext('ctx_test');

      expect(result).toBeDefined();
      expect(result?.version).toBe('1.0.0');
      expect(result?.metadata.name).toBe('test-context');
    });

    it('should handle missing context', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Not found'),
          }),
        })),
        storage: {
          from: vi.fn(() => ({
            download: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        },
      };

      // @ts-expect-error - accessing private property for testing
      service.supabase = mockSupabase;

      const result = await service.downloadContext('ctx_nonexistent');

      expect(result).toBeNull();
    });

    it('should handle download errors gracefully', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              file_path: 'ctx_test.json.gz',
              is_compressed: true,
              is_encrypted: false,
              download_count: 0,
            },
            error: null,
          }),
          update: vi.fn().mockReturnThis(),
        })),
        storage: {
          from: vi.fn(() => ({
            download: vi.fn().mockResolvedValue({
              data: null,
              error: new Error('File not found'),
            }),
          })),
        },
      };

      // @ts-expect-error - accessing private property for testing
      service.supabase = mockSupabase;

      const result = await service.downloadContext('ctx_test');

      expect(result).toBeNull();
    });
  });

  describe('listContexts', () => {
    it('should list contexts with filters', async () => {
      const mockContexts = [
        {
          id: 'ctx_1',
          name: 'Context 1',
          author: 'user1',
          tags: ['test'],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          file_size: 1000,
          download_count: 5,
          is_private: false,
        },
        {
          id: 'ctx_2',
          name: 'Context 2',
          author: 'user2',
          tags: ['production'],
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          file_size: 2000,
          download_count: 10,
          is_private: true,
        },
      ];

      // Create a new mock for this specific test that doesn't use range
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          contains: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: mockContexts, error: null }),
          range: vi.fn().mockResolvedValue({ data: mockContexts, error: null }),
        })),
        storage: {
          from: vi.fn(() => ({
            upload: vi.fn().mockResolvedValue({ error: null }),
            download: vi.fn().mockResolvedValue({ data: null, error: null }),
            remove: vi.fn().mockResolvedValue({ error: null }),
          })),
        },
      };

      // @ts-expect-error - accessing private property for testing
      service.supabase = mockSupabase;

      const result = await service.listContexts({
        author: 'user1',
        tags: ['test'],
        limit: 10,
      });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('ctx_1');
      expect(result[0].name).toBe('Context 1');
      expect(result[0].size).toBe(1000);
      expect(result[1].id).toBe('ctx_2');
      expect(result[1].name).toBe('Context 2');
    });

    it('should handle list errors gracefully', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          order: vi
            .fn()
            .mockResolvedValue({
              data: null,
              error: new Error('Database error'),
            }),
          eq: vi.fn().mockReturnThis(),
          contains: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          range: vi
            .fn()
            .mockResolvedValue({
              data: null,
              error: new Error('Database error'),
            }),
        })),
        storage: {
          from: vi.fn(() => ({
            upload: vi.fn().mockResolvedValue({ error: null }),
            download: vi.fn().mockResolvedValue({ data: null, error: null }),
            remove: vi.fn().mockResolvedValue({ error: null }),
          })),
        },
      };

      // @ts-expect-error - accessing private property for testing
      service.supabase = mockSupabase;

      const result = await service.listContexts();

      expect(result).toEqual([]);
    });
  });

  describe('deleteContext', () => {
    it('should delete a context successfully', async () => {
      const mockSelectQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { file_path: 'ctx_test.json.gz' },
          error: null,
        }),
      };

      const mockDeleteQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      const mockSupabase = {
        from: vi
          .fn()
          .mockReturnValueOnce(mockSelectQuery) // First call for metadata lookup
          .mockReturnValueOnce(mockDeleteQuery), // Second call for deletion
        storage: {
          from: vi.fn(() => ({
            remove: vi.fn().mockResolvedValue({ error: null }),
          })),
        },
      };

      // @ts-expect-error - accessing private property for testing
      service.supabase = mockSupabase;

      const result = await service.deleteContext('ctx_test');

      expect(result.success).toBe(true);
      expect(result.id).toBe('ctx_test');
    });

    it('should handle delete errors gracefully', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Context not found'),
          }),
        })),
        storage: {
          from: vi.fn(() => ({
            remove: vi.fn().mockResolvedValue({ error: null }),
          })),
        },
      };

      // @ts-expect-error - accessing private property for testing
      service.supabase = mockSupabase;

      const result = await service.deleteContext('ctx_nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toBe('Context not found: ctx_nonexistent');
    });
  });

  describe('validateContext', () => {
    it('should validate a valid context', async () => {
      const result = await service.validateContext(mockContext);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should detect missing required fields', async () => {
      const invalidContext = {
        ...mockContext,
        version: undefined,
      } as any;

      const result = await service.validateContext(invalidContext);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].path).toBe('version');
    });

    it('should warn about sensitive data', async () => {
      const sensitiveContext = {
        ...mockContext,
        personal: {
          ...mockContext.personal,
          data: {
            developer_profile: {
              api_key: 'secret-key-123',
            },
          },
        },
      } as any;

      const result = await service.validateContext(sensitiveContext);

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.[0].message).toContain('sensitive data');
    });
  });
});
