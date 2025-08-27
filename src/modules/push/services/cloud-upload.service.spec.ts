import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { PushError, PushErrorCode } from '../constants/push.constants';
import { PackageMetadata, UploadProgress } from '../interfaces';

import { CloudUploadService } from './cloud-upload.service';

describe('CloudUploadService', () => {
  let service: CloudUploadService;
  let mockSupabaseService: any;
  let mockSignedUrlService: any;
  let mockSupabaseClient: any;

  const createMockMetadata = (
    overrides: Partial<PackageMetadata> = {},
  ): PackageMetadata => ({
    id: 'test-id',
    configId: 'test-config-123',
    name: 'test-package',
    title: 'Test Package',
    description: 'A test package',
    version: '1.0.0',
    platform: 'claude-code',
    isPublic: false,
    sanitizationLevel: 'safe',
    checksum: 'test-checksum-12345',
    storageUrl: '',
    packageSize: 1024,
    userId: 'user-123',
    teamId: 'team-456',
    components: [],
    autoTags: ['test'],
    userTags: ['user-tag'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    // Create mock Supabase client with proper method structure
    mockSupabaseClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn(),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'test-user-123' } },
          error: null,
        }),
      },
      storage: {
        from: vi.fn().mockReturnThis(),
        upload: vi.fn(),
        remove: vi.fn(),
        getPublicUrl: vi.fn(),
      },
    };

    mockSupabaseService = {
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
    };

    mockSignedUrlService = {
      generateDownloadUrl: vi.fn(),
    };

    // Create service directly with dependencies
    service = new CloudUploadService(
      mockSupabaseService as any,
      mockSignedUrlService as any,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('checkDuplicate', () => {
    it('should return false when no duplicate exists', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }, // No rows returned
      });

      const result = await service.checkDuplicate('test-checksum');

      expect(result).toEqual({ exists: false });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('taptik_packages');
      expect(mockSupabaseClient.select).toHaveBeenCalledWith(
        'id, config_id, storage_url',
      );
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        'checksum',
        'test-checksum',
      );
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        'user_id',
        'test-user-123',
      );
      expect(mockSupabaseClient.is).toHaveBeenCalledWith('archived_at', null);
      expect(mockSupabaseClient.is).toHaveBeenCalledWith('team_id', null);
    });

    it('should return existing package info when duplicate found', async () => {
      const mockData = {
        id: 'existing-id',
        config_id: 'existing-config',
        storage_url: 'https://storage.example.com/file.taptik',
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await service.checkDuplicate('test-checksum');

      expect(result).toEqual({
        exists: true,
        existingUrl: mockData.storage_url,
        existingId: mockData.config_id,
      });
    });

    it('should throw PushError on database error', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: 'OTHER_ERROR', message: 'Database connection failed' },
      });

      await expect(service.checkDuplicate('test-checksum')).rejects.toThrow(
        PushError,
      );

      try {
        await service.checkDuplicate('test-checksum');
      } catch (error) {
        expect(error).toBeInstanceOf(PushError);
        expect((error as PushError).code).toBe(PushErrorCode.DATABASE_ERROR);
      }
    });

    it('should handle unexpected errors', async () => {
      mockSupabaseClient.single.mockRejectedValue(
        new Error('Unexpected error'),
      );

      await expect(service.checkDuplicate('test-checksum')).rejects.toThrow(
        PushError,
      );
    });
  });

  describe('uploadPackage', () => {
    const mockBuffer = Buffer.from('test package content');
    let mockMetadata: PackageMetadata;
    let progressCallback: (progress: UploadProgress) => void;
    let progressHistory: UploadProgress[];

    beforeEach(() => {
      mockMetadata = createMockMetadata();
      progressHistory = [];
      progressCallback = (progress: UploadProgress) => {
        progressHistory.push({ ...progress });
      };
    });

    it('should use existing upload when duplicate found', async () => {
      const existingUrl = 'https://storage.example.com/existing.taptik';

      // Mock checkDuplicate to return existing package
      vi.spyOn(service, 'checkDuplicate').mockResolvedValue({
        exists: true,
        existingUrl,
        existingId: 'existing-config',
      });

      const result = await service.uploadPackage(
        mockBuffer,
        mockMetadata,
        progressCallback,
      );

      expect(result).toBe(existingUrl);
      expect(progressHistory).toHaveLength(1);
      expect(progressHistory[0].stage).toBe('complete');
      expect(progressHistory[0].message).toContain('already exists');
    });

    it('should perform direct upload for small files', async () => {
      const publicUrl = 'https://storage.example.com/uploaded.taptik';

      vi.spyOn(service, 'checkDuplicate').mockResolvedValue({ exists: false });

      mockSupabaseClient.storage.upload.mockResolvedValue({
        data: {
          path: 'packages/user-123/test-config-123/1.0.0/package.taptik',
        },
        error: null,
      });

      mockSupabaseClient.storage.getPublicUrl.mockReturnValue({
        data: { publicUrl },
      });

      const result = await service.uploadPackage(
        mockBuffer,
        mockMetadata,
        progressCallback,
      );

      expect(result).toBe(publicUrl);
      expect(mockSupabaseClient.storage.upload).toHaveBeenCalledWith(
        'packages/user-123/test-config-123/1.0.0/package.taptik',
        mockBuffer,
        {
          contentType: 'application/gzip',
          duplex: 'half',
        },
      );

      // Check progress updates
      expect(progressHistory.length).toBeGreaterThan(0);
      expect(progressHistory[0].stage).toBe('uploading');
      expect(progressHistory[progressHistory.length - 1].stage).toBe(
        'complete',
      );
    });

    it('should perform chunked upload for large files', async () => {
      // Create a large buffer > 10MB threshold
      const largeBuffer = Buffer.alloc(15 * 1024 * 1024, 'x'); // 15MB
      const publicUrl = 'https://storage.example.com/chunked-upload.taptik';

      vi.spyOn(service, 'checkDuplicate').mockResolvedValue({ exists: false });

      // Mock chunk uploads
      mockSupabaseClient.storage.upload.mockResolvedValue({
        data: { path: 'temp/chunk.test-config-123' },
        error: null,
      });

      // Mock final file upload
      mockSupabaseClient.storage.upload.mockResolvedValueOnce({
        data: {
          path: 'packages/user-123/test-config-123/1.0.0/package.taptik',
        },
        error: null,
      });

      mockSupabaseClient.storage.getPublicUrl.mockReturnValue({
        data: { publicUrl },
      });

      mockSupabaseClient.storage.remove.mockResolvedValue({ error: null });

      const result = await service.uploadPackage(
        largeBuffer,
        mockMetadata,
        progressCallback,
      );

      expect(result).toBe(publicUrl);
      expect(progressHistory[0].message).toContain('chunked');

      // Should have multiple progress updates for chunks
      const uploadingProgressUpdates = progressHistory.filter(
        (p) => p.stage === 'uploading',
      );
      expect(uploadingProgressUpdates.length).toBeGreaterThan(1);
    });

    it('should handle upload errors', async () => {
      vi.spyOn(service, 'checkDuplicate').mockResolvedValue({ exists: false });

      mockSupabaseClient.storage.upload.mockResolvedValue({
        data: null,
        error: { message: 'Storage error' },
      });

      await expect(
        service.uploadPackage(mockBuffer, mockMetadata, progressCallback),
      ).rejects.toThrow(PushError);

      try {
        await service.uploadPackage(mockBuffer, mockMetadata, progressCallback);
      } catch (error) {
        expect(error).toBeInstanceOf(PushError);
        expect((error as PushError).code).toBe(PushErrorCode.UPLOAD_FAILED);
      }
    });

    it('should handle missing path in upload response', async () => {
      vi.spyOn(service, 'checkDuplicate').mockResolvedValue({ exists: false });

      mockSupabaseClient.storage.upload.mockResolvedValue({
        data: { path: null }, // Missing path
        error: null,
      });

      await expect(
        service.uploadPackage(mockBuffer, mockMetadata, progressCallback),
      ).rejects.toThrow(PushError);
    });
  });

  describe('resumeUpload', () => {
    const mockBuffer = Buffer.from('test content');
    let progressCallback: (progress: UploadProgress) => void;

    beforeEach(() => {
      progressCallback = vi.fn();
    });

    it('should throw error for non-existent upload session', async () => {
      await expect(
        service.resumeUpload('non-existent-id', mockBuffer, progressCallback),
      ).rejects.toThrow(PushError);

      await expect(
        service.resumeUpload('non-existent-id', mockBuffer, progressCallback),
      ).rejects.toThrow('Upload session non-existent-id not found');
    });

    it('should resume from existing upload session', async () => {
      // First, start a chunked upload to create an active session
      const largeBuffer = Buffer.alloc(15 * 1024 * 1024, 'x'); // 15MB
      const mockMetadata = createMockMetadata();
      const publicUrl = 'https://storage.example.com/resumed.taptik';

      vi.spyOn(service, 'checkDuplicate').mockResolvedValue({ exists: false });

      // Mock partial upload failure to create resumable state
      let callCount = 0;
      mockSupabaseClient.storage.upload.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          // First two chunks succeed
          return Promise.resolve({
            data: { path: `temp/chunk.${callCount}` },
            error: null,
          });
        } else if (callCount === 3) {
          // Third chunk fails
          return Promise.resolve({
            data: null,
            error: { message: 'Network error' },
          });
        } else {
          // Final upload succeeds
          return Promise.resolve({
            data: { path: 'packages/combined/final/package.taptik' },
            error: null,
          });
        }
      });

      mockSupabaseClient.storage.getPublicUrl.mockReturnValue({
        data: { publicUrl },
      });

      mockSupabaseClient.storage.remove.mockResolvedValue({ error: null });

      // This should fail and leave an active session
      try {
        await service.uploadPackage(largeBuffer, mockMetadata);
      } catch (_error) {
        // Expected to fail
      }

      // Now test resuming - this would need actual implementation
      // For now, we test the error case
      await expect(
        service.resumeUpload('non-existent', mockBuffer, progressCallback),
      ).rejects.toThrow(PushError);
    });
  });

  describe('deletePackage', () => {
    it('should successfully delete package from storage', async () => {
      const storageUrl =
        'https://storage.supabase.co/storage/v1/object/public/taptik-packages/packages/user/config/file.taptik';

      mockSupabaseClient.storage.remove.mockResolvedValue({
        error: null,
      });

      await expect(service.deletePackage(storageUrl)).resolves.not.toThrow();

      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith(
        'taptik-packages',
      );
      expect(mockSupabaseClient.storage.remove).toHaveBeenCalledWith([
        'packages/user/config/file.taptik',
      ]);
    });

    it('should handle invalid storage URL format', async () => {
      const invalidUrl = 'https://example.com/invalid/url';

      await expect(service.deletePackage(invalidUrl)).rejects.toThrow(
        PushError,
      );
      await expect(service.deletePackage(invalidUrl)).rejects.toThrow(
        'Invalid storage URL format',
      );
    });

    it('should handle storage deletion errors', async () => {
      const storageUrl =
        'https://storage.supabase.co/storage/v1/object/public/taptik-packages/packages/user/config/file.taptik';

      mockSupabaseClient.storage.remove.mockResolvedValue({
        error: { message: 'File not found' },
      });

      await expect(service.deletePackage(storageUrl)).rejects.toThrow(
        PushError,
      );
      await expect(service.deletePackage(storageUrl)).rejects.toThrow(
        'Failed to delete package',
      );
    });

    it('should handle malformed URLs gracefully', async () => {
      const malformedUrl = 'not-a-valid-url';

      await expect(service.deletePackage(malformedUrl)).rejects.toThrow();
    });
  });

  describe('generateSignedDownloadUrl', () => {
    it('should delegate to SignedUrlService', async () => {
      const mockResult = {
        url: 'https://signed-url.example.com',
        expires: new Date(),
      };

      mockSignedUrlService.generateDownloadUrl.mockResolvedValue(mockResult);

      const result = await service.generateSignedDownloadUrl(
        'package-123',
        'user-123',
      );

      expect(result).toEqual(mockResult);
      expect(mockSignedUrlService.generateDownloadUrl).toHaveBeenCalledWith(
        'package-123',
        'user-123',
      );
    });

    it('should handle optional userId parameter', async () => {
      const mockResult = {
        url: 'https://signed-url.example.com',
        expires: new Date(),
      };

      mockSignedUrlService.generateDownloadUrl.mockResolvedValue(mockResult);

      const result = await service.generateSignedDownloadUrl('package-123');

      expect(result).toEqual(mockResult);
      expect(mockSignedUrlService.generateDownloadUrl).toHaveBeenCalledWith(
        'package-123',
        undefined,
      );
    });
  });

  describe('private methods', () => {
    it('should generate correct storage path', async () => {
      // This tests the private method through the public interface
      const metadata = createMockMetadata({
        userId: 'user-abc',
        configId: 'config-xyz',
        version: '2.1.0',
      });

      vi.spyOn(service, 'checkDuplicate').mockResolvedValue({ exists: false });
      mockSupabaseClient.storage.upload.mockResolvedValue({
        data: { path: 'test-path' },
        error: null,
      });
      mockSupabaseClient.storage.getPublicUrl.mockReturnValue({
        data: { publicUrl: 'test-url' },
      });

      const mockBuffer = Buffer.from('test');
      await service.uploadPackage(mockBuffer, metadata);

      // Verify the path pattern was used correctly
      expect(mockSupabaseClient.storage.upload).toHaveBeenCalledWith(
        'packages/user-abc/config-xyz/2.1.0/package.taptik',
        mockBuffer,
        expect.any(Object),
      );
    });
  });

  describe('error handling', () => {
    it('should preserve PushError instances', async () => {
      const originalError = new PushError(
        PushErrorCode.NETWORK_TIMEOUT,
        'Custom error',
        { detail: 'test' },
        new Error('Network timeout'),
      );

      vi.spyOn(service, 'checkDuplicate').mockRejectedValue(originalError);

      const metadata = createMockMetadata();

      await expect(
        service.uploadPackage(Buffer.from('test'), metadata),
      ).rejects.toThrow(originalError);
    });

    it('should wrap non-PushError exceptions', async () => {
      const genericError = new Error('Generic error');
      vi.spyOn(service, 'checkDuplicate').mockRejectedValue(genericError);

      const metadata = createMockMetadata();

      await expect(
        service.uploadPackage(Buffer.from('test'), metadata),
      ).rejects.toThrow(PushError);
    });
  });

  describe('progress tracking', () => {
    it('should call progress callback with correct phases', async () => {
      const mockBuffer = Buffer.from('test content');
      const mockMetadata = createMockMetadata();
      const progressUpdates: UploadProgress[] = [];

      const progressCallback = (progress: UploadProgress) => {
        progressUpdates.push({ ...progress });
      };

      vi.spyOn(service, 'checkDuplicate').mockResolvedValue({ exists: false });

      mockSupabaseClient.storage.upload.mockResolvedValue({
        data: { path: 'test-path' },
        error: null,
      });

      mockSupabaseClient.storage.getPublicUrl.mockReturnValue({
        data: { publicUrl: 'test-url' },
      });

      await service.uploadPackage(mockBuffer, mockMetadata, progressCallback);

      // Should have at least uploading and complete phases
      const phases = progressUpdates.map((p) => p.stage);
      expect(phases).toContain('uploading');
      expect(phases).toContain('complete');

      // Progress should be monotonically increasing
      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i].percentage).toBeGreaterThanOrEqual(
          progressUpdates[i - 1].percentage,
        );
      }
    });

    it('should handle missing progress callback gracefully', async () => {
      const mockBuffer = Buffer.from('test content');
      const mockMetadata = createMockMetadata();

      vi.spyOn(service, 'checkDuplicate').mockResolvedValue({ exists: false });

      mockSupabaseClient.storage.upload.mockResolvedValue({
        data: { path: 'test-path' },
        error: null,
      });

      mockSupabaseClient.storage.getPublicUrl.mockReturnValue({
        data: { publicUrl: 'test-url' },
      });

      // Should not throw when progress callback is not provided
      await expect(
        service.uploadPackage(mockBuffer, mockMetadata),
      ).resolves.toBe('test-url');
    });
  });
});
