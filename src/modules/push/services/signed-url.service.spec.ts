import { vi, describe, it, expect, beforeEach } from 'vitest';

import { SignedUrlService } from './signed-url.service';

describe('SignedUrlService', () => {
  let service: SignedUrlService;
  let mockSupabaseService: {
    getClient: ReturnType<typeof vi.fn>;
  };
  let mockConfigService: {
    get: ReturnType<typeof vi.fn>;
  };
  let mockSupabaseClient: {
    storage: {
      from: ReturnType<typeof vi.fn>;
    };
  };
  let mockBucketClient: {
    createSignedUploadUrl: ReturnType<typeof vi.fn>;
    createSignedUrl: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockBucketClient = {
      createSignedUploadUrl: vi.fn(),
      createSignedUrl: vi.fn(),
    };

    mockSupabaseClient = {
      storage: {
        from: vi.fn().mockReturnValue(mockBucketClient),
      },
    };

    mockSupabaseService = {
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
    };

    mockConfigService = {
      get: vi.fn().mockImplementation((key: string) => {
        const config: Record<string, any> = {
          'push.storage.bucketName': 'taptik-packages',
          'push.signedUrl.uploadExpiry': 3600,
          'push.signedUrl.downloadExpiry': 7200,
        };
        return config[key];
      }),
    };

    // Create service directly with mocked dependencies
    service = new SignedUrlService(
      mockSupabaseService as any,
      mockConfigService as any,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateUploadUrl', () => {
    it('should generate signed upload URL with expiration', async () => {
      const userId = 'user-123';
      const packageId = 'pkg-456';
      const expectedPath = `packages/${userId}/${packageId}/package.taptik`;
      const expectedUrl = 'https://example.com/upload-signed-url';
      const expiresIn = 3600;

      mockBucketClient.createSignedUploadUrl.mockResolvedValue({
        data: {
          signedUrl: expectedUrl,
          path: expectedPath,
          token: 'upload-token',
        },
        error: null,
      });

      const result = await service.generateUploadUrl(userId, packageId);

      expect(result).toEqual({
        url: expectedUrl,
        expires: expect.any(Date),
        fields: {
          path: expectedPath,
          token: 'upload-token',
        },
      });

      expect(mockBucketClient.createSignedUploadUrl).toHaveBeenCalledWith(
        expectedPath,
        { upsert: true },
      );

      // Verify expiration time is approximately correct
      const expectedExpiration = new Date(Date.now() + expiresIn * 1000);
      expect(result.expires.getTime()).toBeCloseTo(
        expectedExpiration.getTime(),
        -3,
      );
    });

    it('should throw error when upload URL generation fails', async () => {
      const userId = 'user-123';
      const packageId = 'pkg-456';

      mockBucketClient.createSignedUploadUrl.mockResolvedValue({
        data: null,
        error: {
          message: 'Storage error',
          name: 'StorageError',
          __isStorageError: true,
        },
      });

      await expect(
        service.generateUploadUrl(userId, packageId),
      ).rejects.toThrow('Failed to generate upload URL: Storage error');
    });

    it('should use custom expiry time if provided', async () => {
      const userId = 'user-123';
      const packageId = 'pkg-456';
      const customExpiry = 7200;
      const expectedUrl = 'https://example.com/upload-signed-url';

      mockBucketClient.createSignedUploadUrl.mockResolvedValue({
        data: { signedUrl: expectedUrl, path: 'test-path', token: 'token' },
        error: null,
      });

      const result = await service.generateUploadUrl(
        userId,
        packageId,
        customExpiry,
      );

      const expectedExpiration = new Date(Date.now() + customExpiry * 1000);
      expect(result.expires.getTime()).toBeCloseTo(
        expectedExpiration.getTime(),
        -3,
      );
    });
  });

  describe('generateDownloadUrl', () => {
    it('should generate signed download URL for public package', async () => {
      const packageId = 'pkg-456';
      const expectedPath = `packages/public/${packageId}/package.taptik`;
      const expectedUrl = 'https://example.com/download-signed-url';
      const expiresIn = 7200;

      mockBucketClient.createSignedUrl.mockResolvedValue({
        data: { signedUrl: expectedUrl },
        error: null,
      });

      const result = await service.generateDownloadUrl(packageId);

      expect(result).toEqual({
        url: expectedUrl,
        expires: expect.any(Date),
      });

      expect(mockBucketClient.createSignedUrl).toHaveBeenCalledWith(
        expectedPath,
        expiresIn,
        { download: true },
      );

      const expectedExpiration = new Date(Date.now() + expiresIn * 1000);
      expect(result.expires.getTime()).toBeCloseTo(
        expectedExpiration.getTime(),
        -3,
      );
    });

    it('should generate signed download URL for user-specific package', async () => {
      const packageId = 'pkg-456';
      const userId = 'user-123';
      const expectedPath = `packages/${userId}/${packageId}/package.taptik`;
      const expectedUrl = 'https://example.com/download-signed-url';

      mockBucketClient.createSignedUrl.mockResolvedValue({
        data: { signedUrl: expectedUrl },
        error: null,
      });

      const result = await service.generateDownloadUrl(packageId, userId);

      expect(result.url).toBe(expectedUrl);
      expect(mockBucketClient.createSignedUrl).toHaveBeenCalledWith(
        expectedPath,
        7200,
        { download: true },
      );
    });

    it('should throw error when download URL generation fails', async () => {
      const packageId = 'pkg-456';

      mockBucketClient.createSignedUrl.mockResolvedValue({
        data: null,
        error: {
          message: 'Storage error',
          name: 'StorageError',
          __isStorageError: true,
        },
      });

      await expect(service.generateDownloadUrl(packageId)).rejects.toThrow(
        'Failed to generate download URL: Storage error',
      );
    });

    it('should use custom expiry time if provided', async () => {
      const packageId = 'pkg-456';
      const customExpiry = 3600;
      const expectedUrl = 'https://example.com/download-signed-url';

      mockBucketClient.createSignedUrl.mockResolvedValue({
        data: { signedUrl: expectedUrl },
        error: null,
      });

      const result = await service.generateDownloadUrl(
        packageId,
        undefined,
        customExpiry,
      );

      expect(mockBucketClient.createSignedUrl).toHaveBeenCalledWith(
        expect.any(String),
        customExpiry,
        { download: true },
      );

      const expectedExpiration = new Date(Date.now() + customExpiry * 1000);
      expect(result.expires.getTime()).toBeCloseTo(
        expectedExpiration.getTime(),
        -3,
      );
    });
  });

  describe('validateUrl', () => {
    it('should validate non-expired URL', async () => {
      const url = 'https://example.com/signed-url';
      const expires = new Date(Date.now() + 3600 * 1000);

      const isValid = await service.validateUrl(url, expires);

      expect(isValid).toBe(true);
    });

    it('should invalidate expired URL', async () => {
      const url = 'https://example.com/signed-url';
      const expires = new Date(Date.now() - 1000);

      const isValid = await service.validateUrl(url, expires);

      expect(isValid).toBe(false);
    });

    it('should invalidate malformed URL', async () => {
      const url = 'not-a-valid-url';
      const expires = new Date(Date.now() + 3600 * 1000);

      const isValid = await service.validateUrl(url, expires);

      expect(isValid).toBe(false);
    });

    it('should invalidate empty URL', async () => {
      const url = '';
      const expires = new Date(Date.now() + 3600 * 1000);

      const isValid = await service.validateUrl(url, expires);

      expect(isValid).toBe(false);
    });
  });

  describe('revokeUrl', () => {
    it('should revoke a signed URL', async () => {
      const url = 'https://example.com/signed-url';
      const packageId = 'pkg-456';

      // For now, this is a placeholder implementation
      await expect(service.revokeUrl(url, packageId)).resolves.not.toThrow();
    });
  });
});
