import * as fs from 'fs-extra';
import inquirer from 'inquirer';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ErrorCodes } from '../constants/error-codes.constant';
import { PackageVisibility } from '../interfaces/push-options.interface';
import { UploadProgress } from '../interfaces/upload-progress.interface';

import { PushCommand } from './push.command';

// Mock fs-extra
vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
    readFile: vi.fn(),
    stat: vi.fn(),
  },
  pathExists: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
}));

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    red: vi.fn((text: string) => text),
    green: vi.fn((text: string) => text),
    yellow: vi.fn((text: string) => text),
    cyan: vi.fn((text: string) => text),
    blue: vi.fn((text: string) => text),
    gray: vi.fn((text: string) => text),
    white: vi.fn((text: string) => text),
  },
  red: vi.fn((text: string) => text),
  green: vi.fn((text: string) => text),
  yellow: vi.fn((text: string) => text),
  cyan: vi.fn((text: string) => text),
  blue: vi.fn((text: string) => text),
  gray: vi.fn((text: string) => text),
  white: vi.fn((text: string) => text),
}));

// Mock ora
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
  })),
}));

describe('PushCommand', () => {
  let command: PushCommand;
  let pushService: any;
  let errorHandler: any;

  const mockBuffer = Buffer.from('test package content');
  const mockFilePath = '/path/to/test.taptik';

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    // Create mock services with properly typed methods
    pushService = {
      push: vi.fn().mockImplementation(async (options: any, callback: any) => {
        // Default successful implementation
        if (callback) {
          callback({
            stage: 'Completed',
            percentage: 100,
            configId: 'test-id',
          });
        }
        return Promise.resolve();
      }),
    };

    errorHandler = {
      handleError: vi.fn(),
    };

    // Directly instantiate the command with mocked services
    command = new PushCommand(pushService as any, errorHandler as any);

    // Setup default fs mocks
    (fs.pathExists as any).mockResolvedValue(true);
    (fs.readFile as any).mockResolvedValue(mockBuffer);
    (fs.stat as any).mockResolvedValue({ size: 1024 });
  });

  describe('run', () => {
    it('should fail if no file path is provided', async () => {
      await expect(command.run([], {})).rejects.toThrow('process.exit');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('File path is required'),
      );
    });

    it('should fail if file does not exist', async () => {
      (fs.pathExists as any).mockResolvedValue(false);

      await expect(command.run([mockFilePath], {})).rejects.toThrow(
        'process.exit',
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('File not found'),
      );
    });

    it('should fail if file is not a .taptik file', async () => {
      await expect(command.run(['/path/to/test.txt'], {})).rejects.toThrow(
        'process.exit',
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('must have .taptik extension'),
      );
    });

    it('should fail if both --public and --private are specified', async () => {
      await expect(
        command.run([mockFilePath], { public: true, private: true }),
      ).rejects.toThrow('process.exit');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Cannot specify both --public and --private'),
      );
    });

    it('should upload with public visibility when --public is specified', async () => {
      (inquirer.prompt as any).mockResolvedValue({ confirmed: true });

      await command.run([mockFilePath], { public: true, force: true });

      expect(pushService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: PackageVisibility.Public,
        }),
        expect.any(Function),
      );
    });

    it('should upload with private visibility by default', async () => {
      (inquirer.prompt as any).mockResolvedValue({ confirmed: true });

      await command.run([mockFilePath], { force: true });

      expect(pushService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: PackageVisibility.Private,
        }),
        expect.any(Function),
      );
    });

    it('should parse tags correctly from comma-separated string', async () => {
      (inquirer.prompt as any).mockResolvedValue({ confirmed: true });

      await command.run([mockFilePath], {
        tags: 'frontend,react,typescript',
        force: true,
      });

      expect(pushService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['frontend', 'react', 'typescript'],
        }),
        expect.any(Function),
      );
    });

    it('should show confirmation prompt when not forced', async () => {
      (inquirer.prompt as any).mockResolvedValue({ confirmed: true });

      await command.run([mockFilePath], {});

      expect(inquirer.prompt).toHaveBeenCalled();
    });

    it('should skip confirmation when --force is used', async () => {
      await command.run([mockFilePath], { force: true });

      expect(inquirer.prompt).not.toHaveBeenCalled();
    });

    it('should skip confirmation when --yes is used', async () => {
      await command.run([mockFilePath], { yes: true });

      expect(inquirer.prompt).not.toHaveBeenCalled();
    });

    it('should cancel upload when user declines confirmation', async () => {
      (inquirer.prompt as any).mockResolvedValue({ confirmed: false });

      await command.run([mockFilePath], {});

      expect(pushService.push).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Upload cancelled'),
      );
    });

    it('should perform dry run when --dry-run is specified', async () => {
      await command.run([mockFilePath], { dryRun: true });

      expect(pushService.push).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Dry Run Mode'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Dry run completed successfully'),
      );
    });

    it('should pass all options to push service', async () => {
      (inquirer.prompt as any).mockResolvedValue({ confirmed: true });

      const options = {
        public: true,
        title: 'Test Package',
        description: 'Test description',
        tags: 'test,package',
        team: 'team-123',
        version: '2.0.0',
        force: true,
      };

      await command.run([mockFilePath], options);

      expect(pushService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: PackageVisibility.Public,
          title: 'Test Package',
          description: 'Test description',
          tags: ['test', 'package'],
          teamId: 'team-123',
          version: '2.0.0',
          force: true,
          dryRun: false,
        }),
        expect.any(Function),
      );
    });

    it('should display progress updates during upload', async () => {
      const progressUpdates: UploadProgress[] = [
        {
          stage: 'Authenticating',
          percentage: 10,
          message: 'Checking credentials',
        },
        { stage: 'Validating', percentage: 30, message: 'Validating package' },
        {
          stage: 'Uploading',
          percentage: 70,
          message: 'Uploading to cloud',
          eta: 5,
        },
        {
          stage: 'Completed',
          percentage: 100,
          configId: 'test-id',
          shareUrl: 'https://example.com/test',
        },
      ];

      (inquirer.prompt as any).mockResolvedValue({ confirmed: true });
      pushService.push.mockImplementation(
        async (options: any, callback: any) => {
          for (const progress of progressUpdates) {
            if (callback) {
              callback(progress);
            }
          }
          return Promise.resolve();
        },
      );

      await command.run([mockFilePath], { force: true });

      // Check that progress was displayed
      progressUpdates.forEach((progress) => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining(progress.stage),
        );
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining(`${progress.percentage}%`),
        );
      });

      // Check success message
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Upload completed successfully'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('test-id'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('https://example.com/test'),
      );
    });

    it('should handle upload errors with suggestions', async () => {
      const error = {
        code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
        message: 'Not authenticated',
      };

      (inquirer.prompt as any).mockResolvedValue({ confirmed: true });
      pushService.push.mockRejectedValue(error);

      await expect(
        command.run([mockFilePath], { force: true }),
      ).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Upload failed'),
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Not authenticated'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Suggestions'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('taptik auth login'),
      );
    });

    it('should generate default title from filename', async () => {
      (inquirer.prompt as any).mockResolvedValue({ confirmed: true });

      await command.run(['/path/to/my-awesome-config.taptik'], { force: true });

      expect(pushService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'My Awesome Config',
        }),
        expect.any(Function),
      );
    });

    it('should use custom title when provided', async () => {
      (inquirer.prompt as any).mockResolvedValue({ confirmed: true });

      await command.run([mockFilePath], { title: 'Custom Title', force: true });

      expect(pushService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Custom Title',
        }),
        expect.any(Function),
      );
    });

    it('should display different messages for public vs private uploads', async () => {
      (inquirer.prompt as any).mockResolvedValue({ confirmed: true });

      // Test public upload
      await command.run([mockFilePath], { public: true, force: true });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('publicly available'),
      );

      // Clear mocks and reset pushService for next test
      vi.clearAllMocks();
      vi.spyOn(console, 'log').mockImplementation(() => {});
      pushService.push.mockImplementation(
        async (options: any, callback: any) => {
          if (callback) {
            callback({
              stage: 'Completed',
              percentage: 100,
              configId: 'test-id',
            });
          }
          return Promise.resolve();
        },
      );

      // Test private upload
      await command.run([mockFilePath], { private: true, force: true });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('private'),
      );
    });
  });

  describe('option parsers', () => {
    it('should parse public flag', () => {
      expect(command.parsePublic()).toBe(true);
    });

    it('should parse private flag', () => {
      expect(command.parsePrivate()).toBe(true);
    });

    it('should parse title', () => {
      expect(command.parseTitle('My Title')).toBe('My Title');
    });

    it('should parse description', () => {
      expect(command.parseDescription('My description')).toBe('My description');
    });

    it('should parse tags', () => {
      expect(command.parseTags('tag1,tag2')).toBe('tag1,tag2');
    });

    it('should parse team', () => {
      expect(command.parseTeam('team-123')).toBe('team-123');
    });

    it('should parse version', () => {
      expect(command.parseVersion('2.0.0')).toBe('2.0.0');
    });

    it('should parse force flag', () => {
      expect(command.parseForce()).toBe(true);
    });

    it('should parse dry-run flag', () => {
      expect(command.parseDryRun()).toBe(true);
    });

    it('should parse yes flag', () => {
      expect(command.parseYes()).toBe(true);
    });
  });
});
