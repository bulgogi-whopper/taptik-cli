import * as path from 'path';

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { TaptikPackage } from '../../context/interfaces/cloud.interface';
import { PushOptions, PackageVisibility, UploadProgress } from '../../push/interfaces';
import { PushService } from '../../push/services/push.service';

import { BuildCommand } from './build.command';

// Mock fs/promises 
const mockFsPromises = {
  readFile: vi.fn(),
  stat: vi.fn(),
};

vi.mock('fs/promises', () => mockFsPromises);

// Also mock fs-extra for other parts that might use it
const mockFsExtra = {
  readFile: vi.fn(),
  stat: vi.fn(),
};

vi.mock('fs-extra', () => mockFsExtra);

describe('BuildCommand - Push Feature', () => {
  let buildCommand: any;
  let mockPushService: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  const mockCloudPackage: TaptikPackage = {
    metadata: {
      title: 'test-config',
      description: 'Test configuration',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      tags: ['test'],
      sourceIde: 'claude-code',
      targetIdes: ['claude-code'],
      complexityLevel: 'basic',
      componentCount: {
        agents: 0,
        commands: 1,
        mcpServers: 0,
        steeringRules: 0,
        instructions: 1,
      },
      features: [],
      compatibility: [],
      searchKeywords: [],
      fileSize: 1024,
      checksum: 'test-checksum',
    },
    sanitizedConfig: {} as any,
    checksum: 'test-checksum',
    format: 'taptik-v1',
    compression: 'none',
    size: 1024,
    manifest: {
      files: [],
      directories: [],
      totalSize: 1024,
    },
  };

  beforeEach(() => {
    // Create mock push service
    mockPushService = {
      push: vi.fn(),
    };

    // Create partial BuildCommand with only what we need for testing
    buildCommand = new BuildCommand(
      {} as any,  // interactiveService
      {} as any,  // collectionService
      {} as any,  // transformationService
      {} as any,  // sanitizationService
      {} as any,  // metadataGeneratorService
      {} as any,  // packageService
      {} as any,  // validationService
      {} as any,  // outputService
      {} as any,  // progressService
      {           // errorHandler
        addWarning: vi.fn(),
      } as any,
      mockPushService,
    );

    // Add logger
    buildCommand.logger = {
      log: vi.fn(),
      error: vi.fn(),
    };

    buildCommand.errorHandler = {
      addWarning: vi.fn(),
    };
    
    // Ensure pushService is accessible
    buildCommand.pushService = mockPushService;

    // Mock console
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Reset fs mocks
    mockFsPromises.readFile.mockReset();
    mockFsPromises.stat.mockReset();
    mockFsExtra.readFile.mockReset();
    mockFsExtra.stat.mockReset();
    
    // Mock readFile for the specific path the command expects (fs/promises)
    mockFsPromises.readFile.mockImplementation((filePath) => {
      if (filePath === '/tmp/taptik.package' || filePath.endsWith('taptik.package')) {
        return Promise.resolve(Buffer.from('test-content'));
      }
      return Promise.reject(new Error('File not found'));
    });
    
    mockFsPromises.stat.mockImplementation((filePath) => {
      if (filePath === '/tmp/taptik.package' || filePath.endsWith('taptik.package')) {
        return Promise.resolve({
          size: 1024,
          isFile: () => true,
          isDirectory: () => false,
        });
      }
      return Promise.reject(new Error('File not found'));
    });
    
    // Also set up mockFsExtra in case it's used elsewhere
    mockFsExtra.readFile.mockImplementation((filePath) => {
      if (filePath === '/tmp/taptik.package' || filePath.endsWith('taptik.package')) {
        return Promise.resolve(Buffer.from('test-content'));
      }
      return Promise.reject(new Error('File not found'));
    });
    
    mockFsExtra.stat.mockImplementation((filePath) => {
      if (filePath === '/tmp/taptik.package' || filePath.endsWith('taptik.package')) {
        return Promise.resolve({
          size: 1024,
          isFile: () => true,
          isDirectory: () => false,
        });
      }
      return Promise.reject(new Error('File not found'));
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('pushPackageToCloud', () => {
    it('should push package with correct options', async () => {
      const mockProgress: UploadProgress = {
        stage: 'upload',
        percentage: 100,
        message: 'Complete',
        configId: 'test-config-id',
        shareUrl: 'https://example.com/share',
      };

      mockPushService.push.mockImplementation(
        async (options: PushOptions, onProgress: (progress: UploadProgress) => void) => {
          onProgress(mockProgress);
          return { configId: 'test-config-id' };
        },
      );

      await buildCommand.pushPackageToCloud(
        '/tmp',
        mockCloudPackage,
        {
          pushPublic: true,
          pushTitle: 'My Title',
          pushTags: 'tag1, tag2',
          pushTeam: 'team-123',
        },
        false, // verbose
      );

      expect(mockPushService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          file: expect.objectContaining({
            buffer: expect.any(Buffer),
            name: 'taptik.package',
            size: 1024,
            path: '/tmp/taptik.package',
          }),
          visibility: PackageVisibility.Public,
          title: 'My Title',
          description: 'Test configuration',
          tags: ['tag1', 'tag2'],
          teamId: 'team-123',
          version: '1.0.0',
          force: true,
          dryRun: false,
        }),
        expect.any(Function),
      );

      expect(buildCommand.logger.log).toHaveBeenCalledWith('✅ Package pushed successfully!');
    });

    it('should use private visibility by default', async () => {
      mockPushService.push.mockResolvedValue({ configId: 'test-id' });

      await buildCommand.pushPackageToCloud(
        '/tmp',
        mockCloudPackage,
        {},
        false,
      );

      expect(mockPushService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: PackageVisibility.Private,
        }),
        expect.any(Function),
      );
    });

    it('should handle authentication errors', async () => {
      const authError: any = new Error('Not authenticated');
      authError.code = 'AUTH_001';
      mockPushService.push.mockRejectedValue(authError);

      await buildCommand.pushPackageToCloud(
        '/tmp',
        mockCloudPackage,
        {},
        false,
      );

      expect(buildCommand.logger.error).toHaveBeenCalledWith('Push failed: Not authenticated');
      expect(buildCommand.logger.log).toHaveBeenCalledWith(
        expect.stringContaining('taptik auth login'),
      );
      expect(buildCommand.errorHandler.addWarning).toHaveBeenCalledWith({
        type: 'push',
        message: 'Authentication required for push',
        details: 'Please run "taptik auth login" before using --push',
      });
    });

    it('should handle file read errors', async () => {
      mockFsPromises.readFile.mockRejectedValue(new Error('File not found'));

      await buildCommand.pushPackageToCloud(
        '/tmp',
        mockCloudPackage,
        {},
        false,
      );

      expect(mockPushService.push).not.toHaveBeenCalled();
      expect(buildCommand.logger.error).toHaveBeenCalledWith(
        'Failed to read package file: File not found',
      );
      expect(buildCommand.errorHandler.addWarning).toHaveBeenCalledWith({
        type: 'push',
        message: 'Failed to push package to cloud',
        details: expect.stringContaining('Could not read package file'),
      });
    });

    it('should handle network errors gracefully', async () => {
      mockPushService.push.mockRejectedValue(new Error('Network timeout'));

      await buildCommand.pushPackageToCloud(
        '/tmp',
        mockCloudPackage,
        {},
        false,
      );

      expect(buildCommand.logger.error).toHaveBeenCalledWith('Push failed: Network timeout');
      expect(buildCommand.errorHandler.addWarning).toHaveBeenCalledWith({
        type: 'push',
        message: 'Failed to push package to cloud',
        details: 'Network timeout',
      });
      expect(buildCommand.logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Build completed but push failed'),
      );
    });

    it('should display progress in verbose mode', async () => {
      const progressUpdates: UploadProgress[] = [
        { stage: 'validation', percentage: 25, message: 'Validating' },
        { stage: 'upload', percentage: 100, message: 'Complete', configId: 'test-id' },
      ];

      mockPushService.push.mockImplementation(
        async (options: PushOptions, onProgress: (progress: UploadProgress) => void) => {
          progressUpdates.forEach(onProgress);
          return { configId: 'test-id' };
        },
      );

      await buildCommand.pushPackageToCloud(
        '/tmp',
        mockCloudPackage,
        {},
        true, // verbose
      );

      expect(buildCommand.logger.log).toHaveBeenCalledWith(
        expect.stringContaining('validation: 25%'),
      );
      expect(buildCommand.logger.log).toHaveBeenCalledWith(
        expect.stringContaining('upload: 100%'),
      );
    });

    it('should parse tags correctly', async () => {
      mockPushService.push.mockResolvedValue({ configId: 'test-id' });

      await buildCommand.pushPackageToCloud(
        '/tmp',
        mockCloudPackage,
        { pushTags: 'development, testing,  v2  ' },
        false,
      );

      expect(mockPushService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['development', 'testing', 'v2'],
        }),
        expect.any(Function),
      );
    });

    it('should use default tags when not provided', async () => {
      mockPushService.push.mockResolvedValue({ configId: 'test-id' });

      await buildCommand.pushPackageToCloud(
        '/tmp',
        mockCloudPackage,
        {},
        false,
      );

      expect(mockPushService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['claude-code', 'auto-generated'],
        }),
        expect.any(Function),
      );
    });

    it('should handle missing metadata gracefully', async () => {
      const minimalPackage: TaptikPackage = {
        metadata: {} as any, // Missing metadata to test defaults
        sanitizedConfig: {} as any,
        checksum: '',
        format: 'taptik-v1',
        compression: 'none',
        size: 0,
        manifest: {
          files: [],
          directories: [],
          totalSize: 0,
        },
      };

      mockPushService.push.mockResolvedValue({ configId: 'test-id' });

      await buildCommand.pushPackageToCloud(
        '/tmp',
        minimalPackage,
        {},
        false,
      );

      expect(mockPushService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Claude Code Configuration',
          description: 'Configuration package built with taptik build command',
          version: '1.0.0',
        }),
        expect.any(Function),
      );
    });

    it('should display share URL when available', async () => {
      const mockProgress: UploadProgress = {
        stage: 'upload',
        percentage: 100,
        message: 'Complete',
        configId: 'test-config-id',
        shareUrl: 'https://example.com/share/test-config-id',
      };

      mockPushService.push.mockImplementation(
        async (options: PushOptions, onProgress: (progress: UploadProgress) => void) => {
          onProgress(mockProgress);
          return { configId: 'test-config-id' };
        },
      );

      await buildCommand.pushPackageToCloud(
        '/tmp',
        mockCloudPackage,
        { pushPublic: true },
        false,
      );

      expect(buildCommand.logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Share URL:'),
      );
      expect(buildCommand.logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Your configuration is now publicly available'),
      );
    });

    it('should display private message for private packages', async () => {
      const mockProgress: UploadProgress = {
        stage: 'upload',
        percentage: 100,
        message: 'Complete',
        configId: 'test-config-id',
      };

      mockPushService.push.mockImplementation(
        async (options: PushOptions, onProgress: (progress: UploadProgress) => void) => {
          onProgress(mockProgress);
          return { configId: 'test-config-id' };
        },
      );

      await buildCommand.pushPackageToCloud(
        '/tmp',
        mockCloudPackage,
        {},
        false,
      );

      expect(buildCommand.logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Your configuration is private'),
      );
    });
  });
});