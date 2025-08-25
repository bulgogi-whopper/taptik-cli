import chalk from 'chalk';
import inquirer from 'inquirer';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { PackageMetadata } from '../interfaces';

import { VisibilityCommand } from './visibility.command';

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

describe('VisibilityCommand', () => {
  let command: VisibilityCommand;
  let mockAuthService: { getSession: any };
  let mockPackageRegistry: { getPackageByConfigId: any; updatePackageVisibility: any };

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

  const mockPrivatePackage: PackageMetadata = {
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

  const mockPublicPackage: PackageMetadata = {
    ...mockPrivatePackage,
    isPublic: true,
  };

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    mockAuthService = {
      getSession: vi.fn(),
    };
    mockPackageRegistry = {
      getPackageByConfigId: vi.fn(),
      updatePackageVisibility: vi.fn(),
    };

    // Directly instantiate the command with mocked services
    command = new VisibilityCommand(mockAuthService as any, mockPackageRegistry as any);
    
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Reset inquirer mock
    vi.mocked(inquirer.prompt).mockReset();
  });

  describe('run', () => {
    it('should make package public when --public flag is used', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPrivatePackage);
      mockPackageRegistry.updatePackageVisibility.mockResolvedValue(mockPublicPackage);
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirm: true });

      await command.run(['config-1'], { public: true });

      expect(mockPackageRegistry.updatePackageVisibility).toHaveBeenCalledWith(
        'config-1',
        true
      );
      expect(console.log).toHaveBeenCalledWith(
        chalk.green('✅ Visibility updated successfully!')
      );
    });

    it('should make package private when --private flag is used', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPublicPackage);
      mockPackageRegistry.updatePackageVisibility.mockResolvedValue(mockPrivatePackage);
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirm: true });

      await command.run(['config-1'], { private: true });

      expect(mockPackageRegistry.updatePackageVisibility).toHaveBeenCalledWith(
        'config-1',
        false
      );
      expect(console.log).toHaveBeenCalledWith(
        chalk.green('✅ Visibility updated successfully!')
      );
    });

    it('should show warning when making package public', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPrivatePackage);
      mockPackageRegistry.updatePackageVisibility.mockResolvedValue(mockPublicPackage);
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirm: true });

      await command.run(['config-1'], { public: true });

      expect(console.log).toHaveBeenCalledWith(
        '\n⚠️  Making this package public will:'
      );
    });

    it('should show warning when making package private', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPublicPackage);
      mockPackageRegistry.updatePackageVisibility.mockResolvedValue(mockPrivatePackage);
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirm: true });

      await command.run(['config-1'], { private: true });

      expect(console.log).toHaveBeenCalledWith(
        '\n⚠️  Making this package private will:'
      );
    });

    it('should skip confirmation with --yes flag', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPrivatePackage);
      mockPackageRegistry.updatePackageVisibility.mockResolvedValue(mockPublicPackage);

      await command.run(['config-1'], { public: true, yes: true });

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(mockPackageRegistry.updatePackageVisibility).toHaveBeenCalled();
    });

    it('should cancel when user declines confirmation', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPrivatePackage);
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirm: false });

      await command.run(['config-1'], { public: true });

      expect(mockPackageRegistry.updatePackageVisibility).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        chalk.gray('Visibility change cancelled')
      );
    });

    it('should show message when package already has desired visibility', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPublicPackage);

      await command.run(['config-1'], { public: true });

      expect(console.log).toHaveBeenCalledWith(
        chalk.yellow('Package is already public')
      );
      expect(mockPackageRegistry.updatePackageVisibility).not.toHaveBeenCalled();
    });

    it('should fail when both --public and --private are specified', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);

      await command.run(['config-1'], { public: true, private: true });

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when neither --public nor --private are specified', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);

      await command.run(['config-1'], {});

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when package not found', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(null);

      await command.run(['config-1'], { public: true });

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when user does not own the package', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue({
        ...mockPrivatePackage,
        userId: 'other-user-id',
      });

      await command.run(['config-1'], { public: true });

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when not authenticated', async () => {
      mockAuthService.getSession.mockResolvedValue(null);

      await command.run(['config-1'], { public: true });

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when no config ID provided', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);

      await command.run([], { public: true });

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle errors gracefully', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockRejectedValue(
        new Error('Network error')
      );

      await command.run(['config-1'], { public: true });

      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('option parsers', () => {
    it('should parse public option', () => {
      expect(command.parsePublic()).toBe(true);
    });

    it('should parse private option', () => {
      expect(command.parsePrivate()).toBe(true);
    });

    it('should parse yes option', () => {
      expect(command.parseYes()).toBe(true);
    });
  });
});