import chalk from 'chalk';
import inquirer from 'inquirer';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { PackageMetadata } from '../interfaces';

import { DeleteCommand } from './delete.command';

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

vi.mock('chalk', () => ({
  default: {
    red: vi.fn((text: string) => text),
    green: vi.fn((text: string) => text),
    yellow: vi.fn((text: string) => text),
    cyan: vi.fn((text: string) => text),
    blue: vi.fn((text: string) => text),
    gray: vi.fn((text: string) => text),
    white: vi.fn((text: string) => text),
    bold: vi.fn((text: string) => text),
  },
  red: vi.fn((text: string) => text),
  green: vi.fn((text: string) => text),
  yellow: vi.fn((text: string) => text),
  cyan: vi.fn((text: string) => text),
  blue: vi.fn((text: string) => text),
  gray: vi.fn((text: string) => text),
  white: vi.fn((text: string) => text),
  bold: vi.fn((text: string) => text),
}));

describe('DeleteCommand', () => {
  let command: DeleteCommand;
  let mockAuthService: { getSession: any };
  let mockPackageRegistry: { getPackageByConfigId: any; deletePackage: any };

  const mockSession = {
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    accessToken: 'test-token',
    refreshToken: 'test-refresh-token',
    expiresAt: new Date(Date.now() + 3600000),
  };

  const mockPackage: PackageMetadata = {
    id: 'pkg-1',
    configId: 'config-1',
    name: 'Test Package',
    title: 'Test Package',
    platform: 'claude-code',
    version: '1.0.0',
    isPublic: false,
    userId: 'test-user-id',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    description: 'Test package description',
    userTags: ['test'],
    sanitizationLevel: 'safe',
    checksum: 'abc123',
    storageUrl: 'https://storage.example.com/pkg-1',
    packageSize: 1024,
    components: [],
    autoTags: [],
  };

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    mockAuthService = {
      getSession: vi.fn(),
    };
    mockPackageRegistry = {
      getPackageByConfigId: vi.fn(),
      deletePackage: vi.fn(),
    };

    // Directly instantiate the command with mocked services
    command = new DeleteCommand(
      mockAuthService as any,
      mockPackageRegistry as any,
    );

    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Reset inquirer mock
    vi.mocked(inquirer.prompt).mockReset();
  });

  describe('run', () => {
    it('should delete package with confirmation', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      mockPackageRegistry.deletePackage.mockResolvedValue(undefined);
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmText: 'DELETE' });

      await command.run(['config-1'], {});

      expect(mockPackageRegistry.deletePackage).toHaveBeenCalledWith(
        'config-1',
      );
      expect(console.log).toHaveBeenCalledWith(
        chalk.green('✅ Package deleted successfully!'),
      );
    });

    it('should delete package with --yes flag', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      mockPackageRegistry.deletePackage.mockResolvedValue(undefined);
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirm: true });

      await command.run(['config-1'], { yes: true });

      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to delete this package?',
        }),
      ]);
      expect(mockPackageRegistry.deletePackage).toHaveBeenCalled();
    });

    it('should delete package with --force flag without prompts', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      mockPackageRegistry.deletePackage.mockResolvedValue(undefined);

      await command.run(['config-1'], { force: true });

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(mockPackageRegistry.deletePackage).toHaveBeenCalledWith(
        'config-1',
      );
    });

    it('should show warning for public packages', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue({
        ...mockPackage,
        isPublic: true,
      });
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmText: 'DELETE' });

      await command.run(['config-1'], {});

      expect(console.log).toHaveBeenCalledWith(
        chalk.yellow(
          '\n⚠️  This is a public package that may be used by others',
        ),
      );
    });

    it('should cancel deletion when confirmation text is wrong', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmText: 'wrong' });

      await command.run(['config-1'], {});

      expect(mockPackageRegistry.deletePackage).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        chalk.gray('Deletion cancelled'),
      );
    });

    it('should cancel deletion when user declines with --yes flag', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirm: false });

      await command.run(['config-1'], { yes: true });

      expect(mockPackageRegistry.deletePackage).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        chalk.gray('Deletion cancelled'),
      );
    });

    it('should fail when package not found', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(null);

      await command.run(['config-1'], {});

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when user does not own the package', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue({
        ...mockPackage,
        userId: 'other-user-id',
      });

      await command.run(['config-1'], {});

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when not authenticated', async () => {
      mockAuthService.getSession.mockResolvedValue(null);

      await command.run(['config-1'], {});

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when no config ID provided', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);

      await command.run([], {});

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle errors gracefully', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockRejectedValue(
        new Error('Network error'),
      );

      await command.run(['config-1'], {});

      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('option parsers', () => {
    it('should parse yes option', () => {
      expect(command.parseYes()).toBe(true);
    });

    it('should parse force option', () => {
      expect(command.parseForce()).toBe(true);
    });
  });
});
