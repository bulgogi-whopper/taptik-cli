import * as path from 'path';

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { TaptikPackage } from '../../context/interfaces/cloud.interface';
import { ErrorHandlerService } from '../../deploy/services/error-handler.service';
import { PushOptions, PackageVisibility, UploadProgress } from '../../push/interfaces';
import { PushService } from '../../push/services/push.service';
import { CollectionService } from '../services/collection/collection.service';
import { InteractiveService } from '../services/interactive/interactive.service';
import { OutputService } from '../services/output/output.service';
import { ProgressService } from '../services/progress/progress.service';
import { TransformationService } from '../services/transformation/transformation.service';

import { BuildCommand } from './build.command';

// Create fs-extra mock
const mockFsExtra = {
  ensureDir: vi.fn(),
  pathExists: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
};

vi.mock('fs-extra', () => mockFsExtra);
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    text: '',
  })),
}));

describe('BuildCommand - Push Integration', () => {
  let buildCommand: BuildCommand;
  let mockInteractiveService: any;
  let mockCollectionService: any;
  let mockTransformationService: any;
  let mockOutputService: any;
  let mockProgressService: any;
  let mockErrorHandler: any;
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
    // Create mocks
    mockInteractiveService = {
      promptForPlatform: vi.fn().mockResolvedValue({ platform: 'claude-code' }),
      promptForOutputDirectory: vi.fn().mockResolvedValue({ outputDir: '/tmp/test' }),
      confirmOverwrite: vi.fn().mockResolvedValue(true),
      promptForBuildOptions: vi.fn().mockResolvedValue({
        sanitize: true,
        compress: true,
        validate: true,
      }),
    };

    mockCollectionService = {
      collectSettings: vi.fn().mockResolvedValue({
        settings: { test: 'data' },
        metadata: { count: 1 },
      }),
    };

    mockTransformationService = {
      transformToCloudFormat: vi.fn().mockResolvedValue(mockCloudPackage),
    };

    mockOutputService = {
      writePackage: vi.fn().mockResolvedValue('/tmp/test/test.taptik'),
    };

    mockProgressService = {
      startProgress: vi.fn(),
      updateProgress: vi.fn(),
      completeProgress: vi.fn(),
      failProgress: vi.fn(),
    };

    mockErrorHandler = {
      reset: vi.fn(),
      addWarning: vi.fn(),
      addError: vi.fn(),
      hasErrors: vi.fn().mockReturnValue(false),
      hasWarnings: vi.fn().mockReturnValue(false),
      displaySummary: vi.fn(),
      handleCriticalErrorAndExit: vi.fn(),
      isProcessInterrupted: vi.fn().mockReturnValue(false),
    };

    mockPushService = {
      push: vi.fn(),
    };

    // Create BuildCommand instance with mocks
    buildCommand = new BuildCommand(
      mockInteractiveService,
      mockCollectionService,
      mockTransformationService,
      {} as any, // sanitizationService
      {} as any, // metadataGeneratorService
      {} as any, // packageService
      {} as any, // validationService
      mockOutputService,
      mockProgressService,
      mockErrorHandler,
      mockPushService,
    );

    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Reset and setup fs methods
    mockFsExtra.ensureDir.mockReset();
    mockFsExtra.pathExists.mockReset();
    mockFsExtra.readFile.mockReset();
    mockFsExtra.stat.mockReset();
    
    mockFsExtra.ensureDir.mockResolvedValue(undefined);
    mockFsExtra.pathExists.mockResolvedValue(false);
    mockFsExtra.readFile.mockResolvedValue(Buffer.from('test-content'));
    mockFsExtra.stat.mockResolvedValue({
      size: 1024,
      isFile: () => true,
      isDirectory: () => false,
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Push Options Handling', () => {
    it('should push package when --push flag is set', async () => {
      const mockProgress: UploadProgress = {
        stage: 'upload',
        percentage: 100,
        message: 'Upload complete',
        configId: 'test-config-id',
        shareUrl: 'https://example.com/share/test-config-id',
      };

      mockPushService.push.mockImplementation(
        async (options: PushOptions, onProgress: (progress: UploadProgress) => void) => {
          onProgress(mockProgress);
          return { configId: 'test-config-id' };
        },
      );

      await buildCommand.run([], {
        platform: 'claude-code',
        output: '/tmp/test',
        push: true,
      });

      expect(mockPushService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          file: expect.objectContaining({
            buffer: expect.any(Buffer),
            name: 'test.taptik',
            size: 1024,
            path: '/tmp/test/test.taptik',
          }),
          visibility: PackageVisibility.Private,
          title: 'test-config',
          description: 'Test configuration',
          tags: ['claude-code', 'auto-generated'],
          version: '1.0.0',
          force: true,
          dryRun: false,
        }),
        expect.any(Function),
      );

      expect(consoleLogSpy).toHaveBeenCalledWith('✅ Package pushed successfully!');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration ID: test-config-id'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Share URL:'));
    });

    it('should make package public with --push-public flag', async () => {
      mockPushService.push.mockResolvedValue({ configId: 'test-config-id' });

      await buildCommand.run([], {
        platform: 'claude-code',
        output: '/tmp/test',
        push: true,
        pushPublic: true,
      });

      expect(mockPushService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: PackageVisibility.Public,
        }),
        expect.any(Function),
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Your configuration is now publicly available'));
    });

    it('should use custom title with --push-title', async () => {
      mockPushService.push.mockResolvedValue({ configId: 'test-config-id' });

      await buildCommand.run([], {
        platform: 'claude-code',
        output: '/tmp/test',
        push: true,
        pushTitle: 'My Custom Title',
      });

      expect(mockPushService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'My Custom Title',
        }),
        expect.any(Function),
      );
    });

    it('should parse and use custom tags with --push-tags', async () => {
      mockPushService.push.mockResolvedValue({ configId: 'test-config-id' });

      await buildCommand.run([], {
        platform: 'claude-code',
        output: '/tmp/test',
        push: true,
        pushTags: 'development, testing, v2',
      });

      expect(mockPushService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['development', 'testing', 'v2'],
        }),
        expect.any(Function),
      );
    });

    it('should set team ID with --push-team', async () => {
      mockPushService.push.mockResolvedValue({ configId: 'test-config-id' });

      await buildCommand.run([], {
        platform: 'claude-code',
        output: '/tmp/test',
        push: true,
        pushTeam: 'team-123',
      });

      expect(mockPushService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId: 'team-123',
        }),
        expect.any(Function),
      );
    });

    it('should not push when --dry-run is set', async () => {
      await buildCommand.run([], {
        platform: 'claude-code',
        output: '/tmp/test',
        push: true,
        dryRun: true,
      });

      expect(mockPushService.push).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('DRY RUN'));
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors gracefully', async () => {
      const authError: any = new Error('Not authenticated');
      authError.code = 'AUTH_001';
      mockPushService.push.mockRejectedValue(authError);

      await buildCommand.run([], {
        platform: 'claude-code',
        output: '/tmp/test',
        push: true,
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Push failed: Not authenticated');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('taptik auth login'));
      expect(mockErrorHandler.addWarning).toHaveBeenCalledWith({
        type: 'push',
        message: 'Authentication required for push',
        details: 'Please run "taptik auth login" before using --push',
      });
      
      // Build should still succeed
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Build completed but push failed'));
    });

    it('should handle file read errors', async () => {
      mockFsExtra.readFile.mockRejectedValue(new Error('File not found'));

      await buildCommand.run([], {
        platform: 'claude-code',
        output: '/tmp/test',
        push: true,
      });

      expect(mockPushService.push).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to read package file: File not found');
      expect(mockErrorHandler.addWarning).toHaveBeenCalledWith({
        type: 'push',
        message: 'Failed to push package to cloud',
        details: expect.stringContaining('Could not read package file'),
      });
    });

    it('should handle push service errors', async () => {
      mockPushService.push.mockRejectedValue(new Error('Network error'));

      await buildCommand.run([], {
        platform: 'claude-code',
        output: '/tmp/test',
        push: true,
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Push failed: Network error');
      expect(mockErrorHandler.addWarning).toHaveBeenCalledWith({
        type: 'push',
        message: 'Failed to push package to cloud',
        details: 'Network error',
      });
      
      // Build should still succeed
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Build completed but push failed'));
    });

    it('should not fail build when push fails', async () => {
      mockPushService.push.mockRejectedValue(new Error('Push error'));
      
      // Run build with push
      await buildCommand.run([], {
        platform: 'claude-code',
        output: '/tmp/test',
        push: true,
      });

      // Verify build completed successfully
      expect(mockOutputService.writePackage).toHaveBeenCalled();
      expect(mockProgressService.completeProgress).toHaveBeenCalled();
      
      // Verify push was attempted but failure was handled
      expect(mockPushService.push).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Build completed but push failed'));
    });
  });

  describe('Progress Tracking', () => {
    it('should display progress in verbose mode', async () => {
      const progressUpdates: UploadProgress[] = [
        { stage: 'validation', percentage: 25, message: 'Validating package' },
        { stage: 'upload', percentage: 50, message: 'Uploading to cloud' },
        { stage: 'registration', percentage: 75, message: 'Registering package' },
        { stage: 'upload', percentage: 100, message: 'Complete', configId: 'test-id' },
      ];

      mockPushService.push.mockImplementation(
        async (options: PushOptions, onProgress: (progress: UploadProgress) => void) => {
          progressUpdates.forEach(onProgress);
          return { configId: 'test-id' };
        },
      );

      await buildCommand.run([], {
        platform: 'claude-code',
        output: '/tmp/test',
        push: true,
        verbose: true,
      });

      expect(consoleLogSpy).toHaveBeenCalledWith('  validation: 25% - Validating package');
      expect(consoleLogSpy).toHaveBeenCalledWith('  upload: 50% - Uploading to cloud');
      expect(consoleLogSpy).toHaveBeenCalledWith('  registration: 75% - Registering package');
      expect(consoleLogSpy).toHaveBeenCalledWith('  upload: 100% - Complete');
    });

    it('should not display progress in non-verbose mode', async () => {
      const progressUpdates: UploadProgress[] = [
        { stage: 'validation', percentage: 25, message: 'Validating package' },
        { stage: 'upload', percentage: 100, message: 'Complete', configId: 'test-id' },
      ];

      mockPushService.push.mockImplementation(
        async (options: PushOptions, onProgress: (progress: UploadProgress) => void) => {
          progressUpdates.forEach(onProgress);
          return { configId: 'test-id' };
        },
      );

      await buildCommand.run([], {
        platform: 'claude-code',
        output: '/tmp/test',
        push: true,
        verbose: false,
      });

      // Should not log progress updates
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('validation: 25%'));
      
      // Should still log success message
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ Package pushed successfully!');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete build-push workflow', async () => {
      const mockProgress: UploadProgress = {
        stage: 'upload',
        percentage: 100,
        message: 'Upload complete',
        configId: 'test-config-id',
        shareUrl: 'https://example.com/share/test-config-id',
      };

      mockPushService.push.mockImplementation(
        async (options: PushOptions, onProgress: (progress: UploadProgress) => void) => {
          onProgress(mockProgress);
          return { configId: 'test-config-id' };
        },
      );

      await buildCommand.run([], {
        platform: 'claude-code',
        output: '/tmp/test',
        push: true,
        pushPublic: true,
        pushTitle: 'My Config',
        pushTags: 'prod, v1',
        pushTeam: 'team-456',
      });

      // Verify build completed
      expect(mockCollectionService.collectSettings).toHaveBeenCalled();
      expect(mockTransformationService.transformToCloudFormat).toHaveBeenCalled();
      expect(mockOutputService.writePackage).toHaveBeenCalled();

      // Verify push with all options
      expect(mockPushService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: PackageVisibility.Public,
          title: 'My Config',
          tags: ['prod', 'v1'],
          teamId: 'team-456',
        }),
        expect.any(Function),
      );

      // Verify success messages
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ Package pushed successfully!');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Your configuration is now publicly available'));
    });

    it('should use default values when options are not provided', async () => {
      // Create a cloud package without metadata
      const minimalCloudPackage: TaptikPackage = {
        metadata: {
          title: 'Minimal Package',
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          tags: [],
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          complexityLevel: 'minimal',
          componentCount: {
            agents: 0,
            commands: 0,
            mcpServers: 0,
            steeringRules: 0,
            instructions: 0,
          },
          features: [],
          compatibility: [],
          searchKeywords: [],
          fileSize: 0,
          checksum: '',
        },
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
      
      mockTransformationService.transformToCloudFormat.mockResolvedValue(minimalCloudPackage);
      mockPushService.push.mockResolvedValue({ configId: 'test-id' });

      await buildCommand.run([], {
        platform: 'claude-code',
        output: '/tmp/test',
        push: true,
      });

      expect(mockPushService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: PackageVisibility.Private,
          title: 'Claude Code Configuration', // Default title
          description: 'Configuration package built with taptik build command', // Default description
          tags: ['claude-code', 'auto-generated'], // Default tags
          version: '1.0.0',
          teamId: undefined,
        }),
        expect.any(Function),
      );
    });

    it('should handle build failure before push attempt', async () => {
      mockOutputService.writePackage.mockRejectedValue(new Error('Write failed'));
      mockErrorHandler.hasErrors.mockReturnValue(true);

      await expect(
        buildCommand.run([], {
          platform: 'claude-code',
          output: '/tmp/test',
          push: true,
        }),
      ).rejects.toThrow('Build failed');

      // Push should not be attempted if build fails
      expect(mockPushService.push).not.toHaveBeenCalled();
    });
  });
});