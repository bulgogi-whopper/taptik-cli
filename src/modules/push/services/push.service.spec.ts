import * as fs from 'fs/promises';
import * as path from 'path';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { PushError, PushErrorCode } from '../constants/push.constants';
import { PackageMetadata, PushOptions, AnalyticsEventType, PackageVisibility } from '../interfaces';

import { PushService } from './push.service';

vi.mock('fs/promises');
vi.mock('path');

describe('PushService', () => {
  let service: PushService;
  let mockCloudUploadService: any;
  let mockPackageRegistryService: any;
  let mockSanitizationService: any;
  let mockAnalyticsService: any;
  let mockAuthService: any;
  let mockPackageValidatorService: any;
  let mockLocalQueueService: any;
  let mockRateLimiterService: any;

  const mockUser = { id: 'user-123', email: 'test@example.com' };
  const mockPackageBuffer = Buffer.from('mock package content');
  const mockPackagePath = '/path/to/package.taptik';

  // Create a default mock PushOptions object
  const createMockOptions = (overrides?: Partial<PushOptions>): PushOptions => ({
    file: {
      buffer: mockPackageBuffer,
      name: 'package.taptik',
      size: mockPackageBuffer.length,
      path: mockPackagePath,
    },
    visibility: PackageVisibility.Private,
    title: 'Test Package',
    tags: [],
    version: '1.0.0',
    force: false,
    dryRun: false,
    ...overrides,
  });

  beforeEach(() => {
    // Create mock services
    mockCloudUploadService = {
      uploadPackage: vi.fn(),
      deletePackage: vi.fn(),
      checkDuplicate: vi.fn(),
    };

    mockPackageRegistryService = {
      registerPackage: vi.fn(),
      updatePackage: vi.fn(),
      deletePackage: vi.fn(),
      listUserPackages: vi.fn(),
      getPackageStats: vi.fn(),
    };

    mockSanitizationService = {
      sanitizePackage: vi.fn(),
      generateAutoTags: vi.fn(),
    };

    mockAnalyticsService = {
      trackUpload: vi.fn(),
      trackEvent: vi.fn(),
    };

    mockAuthService = {
      getSession: vi.fn(),
    };

    mockPackageValidatorService = {
      validateStructure: vi.fn(),
      validateSize: vi.fn(),
      validateChecksum: vi.fn(),
      scanForMalware: vi.fn(),
    };

    mockLocalQueueService = {
      addToQueue: vi.fn(),
      getQueueStatus: vi.fn(),
      updateStatus: vi.fn(),
      incrementAttempts: vi.fn(),
      removeFromQueue: vi.fn(),
      processQueue: vi.fn(),
    };

    mockRateLimiterService = {
      checkLimit: vi.fn(),
      checkUploadLimit: vi.fn(),
      checkBandwidthLimit: vi.fn(),
      recordUpload: vi.fn(),
    };

    // Create service instance directly with mocks
    service = new PushService(
      mockCloudUploadService as any,
      mockPackageRegistryService as any,
      mockSanitizationService as any,
      mockAnalyticsService as any,
      mockAuthService as any,
      mockPackageValidatorService as any,
      mockLocalQueueService as any,
      mockRateLimiterService as any,
    );

    // Reset all mocks
    vi.clearAllMocks();
    vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);
    vi.mocked(fs.readFile).mockResolvedValue(mockPackageBuffer);
    vi.mocked(path.resolve).mockImplementation((p) => p);
    vi.mocked(path.basename).mockReturnValue('package');
  });

  describe('upload', () => {
    it('should upload package successfully', async () => {
      // Arrange
      const options = createMockOptions({
        visibility: PackageVisibility.Public,
        title: 'Test Package',
        description: 'Test description',
        tags: ['test', 'sample'],
      });

      const mockMetadata: PackageMetadata = {
        id: 'pkg-123',
        configId: 'config-123',
        name: 'package',
        title: 'Test Package',
        description: 'Test description',
        version: '1.0.0',
        platform: 'claude-code',
        isPublic: true,
        sanitizationLevel: 'safe',
        checksum: 'abc123',
        storageUrl: 'https://storage.example.com/package',
        shareableUrl: 'https://taptik.dev/config/config-123',
        packageSize: mockPackageBuffer.length,
        userId: mockUser.id,
        components: [],
        autoTags: ['claude-code'],
        userTags: ['test', 'sample'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuthService.getSession.mockResolvedValue({ user: mockUser } as any);
      mockPackageValidatorService.validateStructure.mockResolvedValue(true);
      mockPackageValidatorService.validateSize.mockResolvedValue(true);
      mockRateLimiterService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetAt: new Date(),
      });
      mockSanitizationService.sanitizePackage.mockResolvedValue({
        sanitizedBuffer: mockPackageBuffer,
        report: { removedCount: 0, findings: [] },
        level: 'safe',
      });
      mockSanitizationService.generateAutoTags.mockResolvedValue(['claude-code']);
      mockCloudUploadService.uploadPackage.mockResolvedValue('https://storage.example.com/package');
      mockPackageRegistryService.registerPackage.mockResolvedValue(mockMetadata);
      mockAnalyticsService.trackUpload.mockResolvedValue();

      // Act
      const result = await service.upload(mockPackagePath, options);

      // Assert
      expect(result).toEqual(mockMetadata);
      expect(mockAuthService.getSession).toHaveBeenCalled();
      expect(mockPackageValidatorService.validateStructure).toHaveBeenCalledWith(mockPackageBuffer);
      expect(mockPackageValidatorService.validateSize).toHaveBeenCalledWith(
        mockPackageBuffer.length,
        'free',
      );
      expect(mockRateLimiterService.checkLimit).toHaveBeenCalledWith(
        mockUser.id,
        mockPackageBuffer.length,
      );
      expect(mockSanitizationService.sanitizePackage).toHaveBeenCalledWith(mockPackageBuffer);
      expect(mockCloudUploadService.uploadPackage).toHaveBeenCalled();
      expect(mockPackageRegistryService.registerPackage).toHaveBeenCalled();
      expect(mockAnalyticsService.trackUpload).toHaveBeenCalled();
    });

    it('should handle authentication errors', async () => {
      // Arrange
      mockAuthService.getSession.mockResolvedValue(null);

      // Act & Assert
      await expect(service.upload(mockPackagePath, createMockOptions())).rejects.toThrow(
        new PushError(
          PushErrorCode.AUTH_REQUIRED,
          'Authentication required. Please run "taptik auth login" first',
        ),
      );
    });

    it('should handle invalid package structure', async () => {
      // Arrange
      mockAuthService.getSession.mockResolvedValue({ user: mockUser } as any);
      mockPackageValidatorService.validateStructure.mockResolvedValue(false);

      // Act & Assert
      await expect(service.upload(mockPackagePath, createMockOptions())).rejects.toThrow(
        new PushError(
          PushErrorCode.INVALID_PACKAGE,
          'Invalid package structure',
          { packagePath: mockPackagePath },
        ),
      );
    });

    it('should handle package size limit exceeded', async () => {
      // Arrange
      mockAuthService.getSession.mockResolvedValue({ user: mockUser } as any);
      mockPackageValidatorService.validateStructure.mockResolvedValue(true);
      mockPackageValidatorService.validateSize.mockResolvedValue(false);

      // Act & Assert
      await expect(service.upload(mockPackagePath, createMockOptions())).rejects.toThrow(
        new PushError(
          PushErrorCode.PACKAGE_TOO_LARGE,
          'Package size exceeds free tier limit',
          expect.any(Object),
        ),
      );
    });

    it('should handle rate limit exceeded', async () => {
      // Arrange
      mockAuthService.getSession.mockResolvedValue({ user: mockUser } as any);
      mockPackageValidatorService.validateStructure.mockResolvedValue(true);
      mockPackageValidatorService.validateSize.mockResolvedValue(true);
      mockRateLimiterService.checkLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt: new Date(),
      });

      // Act & Assert
      await expect(service.upload(mockPackagePath, createMockOptions())).rejects.toThrow(
        new PushError(
          PushErrorCode.RATE_LIMIT_EXCEEDED,
          'Upload rate limit exceeded',
          expect.any(Object),
        ),
      );
    });

    it('should handle sensitive data detection without force flag', async () => {
      // Arrange
      mockAuthService.getSession.mockResolvedValue({ user: mockUser } as any);
      mockPackageValidatorService.validateStructure.mockResolvedValue(true);
      mockPackageValidatorService.validateSize.mockResolvedValue(true);
      mockRateLimiterService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetAt: new Date(),
      });
      mockSanitizationService.sanitizePackage.mockResolvedValue({
        sanitizedBuffer: mockPackageBuffer,
        report: { removedCount: 5, findings: ['API_KEY', 'SECRET'] },
        level: 'blocked',
      });

      // Act & Assert
      await expect(service.upload(mockPackagePath, createMockOptions())).rejects.toThrow(
        new PushError(
          PushErrorCode.SENSITIVE_DATA_DETECTED,
          'Critical sensitive data detected. Use --force to override',
          expect.any(Object),
        ),
      );
    });

    it('should allow upload with sensitive data when force flag is set', async () => {
      // Arrange
      const options = createMockOptions({ force: true });
      const mockMetadata: PackageMetadata = {
        id: 'pkg-123',
        configId: 'config-123',
        name: 'package',
        title: 'Package',
        version: '1.0.0',
        platform: 'claude-code',
        isPublic: false,
        sanitizationLevel: 'blocked',
        checksum: 'abc123',
        storageUrl: 'https://storage.example.com/package',
        shareableUrl: 'https://taptik.dev/config/config-123',
        packageSize: mockPackageBuffer.length,
        userId: mockUser.id,
        components: [],
        autoTags: [],
        userTags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuthService.getSession.mockResolvedValue({ user: mockUser } as any);
      mockPackageValidatorService.validateStructure.mockResolvedValue(true);
      mockPackageValidatorService.validateSize.mockResolvedValue(true);
      mockRateLimiterService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetAt: new Date(),
      });
      mockSanitizationService.sanitizePackage.mockResolvedValue({
        sanitizedBuffer: mockPackageBuffer,
        report: { removedCount: 5, findings: ['API_KEY'] },
        level: 'blocked',
      });
      mockSanitizationService.generateAutoTags.mockResolvedValue([]);
      mockCloudUploadService.uploadPackage.mockResolvedValue('https://storage.example.com/package');
      mockPackageRegistryService.registerPackage.mockResolvedValue(mockMetadata);
      mockAnalyticsService.trackUpload.mockResolvedValue();

      // Act
      const result = await service.upload(mockPackagePath, options);

      // Assert
      expect(result).toEqual(mockMetadata);
      expect(mockCloudUploadService.uploadPackage).toHaveBeenCalled();
    });

    it('should track progress during upload', async () => {
      // Arrange
      const onProgress = vi.fn();
      const options = createMockOptions();
      const mockMetadata: PackageMetadata = {
        id: 'pkg-123',
        configId: 'config-123',
        name: 'package',
        title: 'Package',
        version: '1.0.0',
        platform: 'claude-code',
        isPublic: false,
        sanitizationLevel: 'safe',
        checksum: 'abc123',
        storageUrl: 'https://storage.example.com/package',
        shareableUrl: 'https://taptik.dev/config/config-123',
        packageSize: mockPackageBuffer.length,
        userId: mockUser.id,
        components: [],
        autoTags: [],
        userTags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuthService.getSession.mockResolvedValue({ user: mockUser } as any);
      mockPackageValidatorService.validateStructure.mockResolvedValue(true);
      mockPackageValidatorService.validateSize.mockResolvedValue(true);
      mockRateLimiterService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetAt: new Date(),
      });
      mockSanitizationService.sanitizePackage.mockResolvedValue({
        sanitizedBuffer: mockPackageBuffer,
        report: { removedCount: 0, findings: [] },
        level: 'safe',
      });
      mockSanitizationService.generateAutoTags.mockResolvedValue([]);
      mockCloudUploadService.uploadPackage.mockResolvedValue('https://storage.example.com/package');
      mockPackageRegistryService.registerPackage.mockResolvedValue(mockMetadata);
      mockAnalyticsService.trackUpload.mockResolvedValue();

      // Act
      await service.upload(mockPackagePath, options, onProgress);

      // Assert
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'validating',
          percentage: 0,
        }),
      );
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'sanitizing',
        }),
      );
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'uploading',
        }),
      );
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'registering',
        }),
      );
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'complete',
          percentage: 100,
        }),
      );
    });

    it('should handle file not found error', async () => {
      // Arrange
      mockAuthService.getSession.mockResolvedValue({ user: mockUser } as any);
      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });

      // Act & Assert
      await expect(service.upload(mockPackagePath, createMockOptions())).rejects.toThrow(
        new PushError(
          PushErrorCode.INVALID_PACKAGE,
          'Package file not found',
          { packagePath: mockPackagePath },
        ),
      );
    });
  });

  describe('queueUpload', () => {
    it('should queue upload successfully', async () => {
      // Arrange
      const options = createMockOptions({ visibility: PackageVisibility.Public });
      mockLocalQueueService.addToQueue.mockResolvedValue('queue-123');

      // Act
      const result = await service.queueUpload(mockPackagePath, options);

      // Assert
      expect(result).toBe('queue-123');
      expect(mockLocalQueueService.addToQueue).toHaveBeenCalledWith(
        mockPackagePath,
        options,
      );
    });

    it('should validate file exists before queuing', async () => {
      // Arrange
      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });

      // Act & Assert
      await expect(service.queueUpload(mockPackagePath, createMockOptions())).rejects.toThrow(
        new PushError(
          PushErrorCode.INVALID_PACKAGE,
          'Package file not found',
          { packagePath: mockPackagePath },
        ),
      );
      expect(mockLocalQueueService.addToQueue).not.toHaveBeenCalled();
    });
  });

  describe('processQueue', () => {
    it('should process pending uploads in queue', async () => {
      // Arrange
      const queuedUploads = [
        {
          id: 'queue-1',
          packagePath: '/path/to/package1.taptik',
          options: { visibility: PackageVisibility.Public },
          attempts: 0,
          status: 'pending' as const,
        },
        {
          id: 'queue-2',
          packagePath: '/path/to/package2.taptik',
          options: { visibility: PackageVisibility.Private },
          attempts: 1,
          status: 'failed' as const,
        },
      ];

      const mockMetadata: PackageMetadata = {
        id: 'pkg-123',
        configId: 'config-123',
        name: 'package',
        title: 'Package',
        version: '1.0.0',
        platform: 'claude-code',
        isPublic: false,
        sanitizationLevel: 'safe',
        checksum: 'abc123',
        storageUrl: 'https://storage.example.com/package',
        shareableUrl: 'https://taptik.dev/config/config-123',
        packageSize: mockPackageBuffer.length,
        userId: mockUser.id,
        components: [],
        autoTags: [],
        userTags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockLocalQueueService.getQueueStatus.mockResolvedValue(queuedUploads);
      mockLocalQueueService.updateStatus.mockResolvedValue();
      mockAuthService.getSession.mockResolvedValue({ user: mockUser } as any);
      mockPackageValidatorService.validateStructure.mockResolvedValue(true);
      mockPackageValidatorService.validateSize.mockResolvedValue(true);
      mockRateLimiterService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetAt: new Date(),
      });
      mockSanitizationService.sanitizePackage.mockResolvedValue({
        sanitizedBuffer: mockPackageBuffer,
        report: { removedCount: 0, findings: [] },
        level: 'safe',
      });
      mockSanitizationService.generateAutoTags.mockResolvedValue([]);
      mockCloudUploadService.uploadPackage.mockResolvedValue('https://storage.example.com/package');
      mockPackageRegistryService.registerPackage.mockResolvedValue(mockMetadata);
      mockAnalyticsService.trackUpload.mockResolvedValue();

      // Act
      await service.processQueue();

      // Assert
      expect(mockLocalQueueService.getQueueStatus).toHaveBeenCalled();
      expect(mockLocalQueueService.updateStatus).toHaveBeenCalledWith('queue-1', 'uploading');
      expect(mockLocalQueueService.updateStatus).toHaveBeenCalledWith('queue-1', 'completed');
      expect(mockLocalQueueService.updateStatus).toHaveBeenCalledWith('queue-2', 'uploading');
      expect(mockLocalQueueService.updateStatus).toHaveBeenCalledWith('queue-2', 'completed');
    });

    it('should handle empty queue', async () => {
      // Arrange
      mockLocalQueueService.getQueueStatus.mockResolvedValue([]);

      // Act
      await service.processQueue();

      // Assert
      expect(mockLocalQueueService.getQueueStatus).toHaveBeenCalled();
      expect(mockLocalQueueService.updateStatus).not.toHaveBeenCalled();
    });

    it('should retry failed uploads with exponential backoff', async () => {
      // Arrange
      const queuedUpload = {
        id: 'queue-1',
        packagePath: '/path/to/package.taptik',
        options: {},
        attempts: 2,
        status: 'failed' as const,
      };

      mockLocalQueueService.getQueueStatus.mockResolvedValue([queuedUpload]);
      mockLocalQueueService.updateStatus.mockResolvedValue();
      mockLocalQueueService.incrementAttempts.mockResolvedValue();
      mockAuthService.getSession.mockRejectedValue(new Error('Auth failed'));

      // Act
      await service.processQueue();

      // Assert
      expect(mockLocalQueueService.incrementAttempts).toHaveBeenCalledWith('queue-1');
    });

    it('should mark upload as permanently failed after max attempts', async () => {
      // Arrange
      const queuedUpload = {
        id: 'queue-1',
        packagePath: '/path/to/package.taptik',
        options: {},
        attempts: 5,
        status: 'failed' as const,
      };

      mockLocalQueueService.getQueueStatus.mockResolvedValue([queuedUpload]);
      mockLocalQueueService.updateStatus.mockResolvedValue();
      mockAuthService.getSession.mockRejectedValue(new Error('Auth failed'));

      // Act
      await service.processQueue();

      // Assert
      expect(mockLocalQueueService.updateStatus).toHaveBeenCalledWith('queue-1', 'failed');
      expect(mockLocalQueueService.incrementAttempts).not.toHaveBeenCalled();
    });
  });

  describe('updatePackage', () => {
    it('should update package metadata successfully', async () => {
      // Arrange
      const configId = 'config-123';
      const updates = { title: 'Updated Title', description: 'Updated description' };
      const updatedMetadata: PackageMetadata = {
        id: 'pkg-123',
        configId,
        name: 'package',
        title: 'Updated Title',
        description: 'Updated description',
        version: '1.0.0',
        platform: 'claude-code',
        isPublic: false,
        sanitizationLevel: 'safe',
        checksum: 'abc123',
        storageUrl: 'https://storage.example.com/package',
        packageSize: 1000,
        userId: mockUser.id,
        components: [],
        autoTags: [],
        userTags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuthService.getSession.mockResolvedValue({ user: mockUser } as any);
      mockPackageRegistryService.updatePackage.mockResolvedValue(updatedMetadata);
      mockAnalyticsService.trackEvent.mockResolvedValue();

      // Act
      const result = await service.updatePackage(configId, updates);

      // Assert
      expect(result).toEqual(updatedMetadata);
      expect(mockPackageRegistryService.updatePackage).toHaveBeenCalledWith(configId, updates);
      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith({
        eventType: AnalyticsEventType.UPDATE,
        packageId: updatedMetadata.id,
        userId: mockUser.id,
        metadata: { updates },
      });
    });

    it('should require authentication for update', async () => {
      // Arrange
      mockAuthService.getSession.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updatePackage('config-123', {})).rejects.toThrow(
        new PushError(
          PushErrorCode.AUTH_REQUIRED,
          'Authentication required. Please run "taptik auth login" first',
        ),
      );
    });
  });

  describe('deletePackage', () => {
    it('should delete package successfully', async () => {
      // Arrange
      const configId = 'config-123';
      const packageMetadata: PackageMetadata = {
        id: 'pkg-123',
        configId,
        name: 'package',
        title: 'Package',
        version: '1.0.0',
        platform: 'claude-code',
        isPublic: false,
        sanitizationLevel: 'safe',
        checksum: 'abc123',
        storageUrl: 'https://storage.example.com/package',
        packageSize: 1000,
        userId: mockUser.id,
        components: [],
        autoTags: [],
        userTags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuthService.getSession.mockResolvedValue({ user: mockUser } as any);
      mockPackageRegistryService.listUserPackages.mockResolvedValue([packageMetadata]);
      mockCloudUploadService.deletePackage.mockResolvedValue();
      mockPackageRegistryService.deletePackage.mockResolvedValue();
      mockAnalyticsService.trackEvent.mockResolvedValue();

      // Act
      await service.deletePackage(configId);

      // Assert
      expect(mockPackageRegistryService.listUserPackages).toHaveBeenCalledWith(
        mockUser.id,
        { configId },
      );
      expect(mockCloudUploadService.deletePackage).toHaveBeenCalledWith(
        packageMetadata.storageUrl,
      );
      expect(mockPackageRegistryService.deletePackage).toHaveBeenCalledWith(configId);
      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith({
        eventType: AnalyticsEventType.DELETE,
        packageId: packageMetadata.id,
        userId: mockUser.id,
      });
    });

    it('should throw error if package not found or no permission', async () => {
      // Arrange
      const configId = 'config-123';
      mockAuthService.getSession.mockResolvedValue({ user: mockUser } as any);
      mockPackageRegistryService.listUserPackages.mockResolvedValue([]);

      // Act & Assert
      await expect(service.deletePackage(configId)).rejects.toThrow(
        new PushError(
          PushErrorCode.INSUFFICIENT_PERMISSIONS,
          'Package not found or you do not have permission to delete it',
          { configId },
        ),
      );
    });

    it('should require authentication for deletion', async () => {
      // Arrange
      mockAuthService.getSession.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deletePackage('config-123')).rejects.toThrow(
        new PushError(
          PushErrorCode.AUTH_REQUIRED,
          'Authentication required. Please run "taptik auth login" first',
        ),
      );
    });
  });

  describe('validateTeamPermissions', () => {
    it('should validate team permissions', async () => {
      // Arrange & Act
      const result = await service.validateTeamPermissions('user-123', 'team-456');

      // Assert
      expect(result).toBe(true); // Currently returns true by default
    });
  });
});