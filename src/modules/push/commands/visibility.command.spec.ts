import { Test, TestingModule } from '@nestjs/testing';

import chalk from 'chalk';
import inquirer from 'inquirer';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AuthService } from '../../auth/auth.service';
import { PackageMetadata } from '../interfaces';
import { PackageRegistryService } from '../services/package-registry.service';

import { VisibilityCommand } from './visibility.command';

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

describe('VisibilityCommand', () => {
  let command: VisibilityCommand;
  let authService: AuthService;
  let packageRegistry: PackageRegistryService;

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
    authService = {
      getSession: vi.fn(),
    } as any;
    packageRegistry = {
      getPackageByConfigId: vi.fn(),
      updatePackageVisibility: vi.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisibilityCommand,
        { provide: AuthService, useValue: authService },
        { provide: PackageRegistryService, useValue: packageRegistry },
      ],
    }).compile();

    command = module.get<VisibilityCommand>(VisibilityCommand);
    
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
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue(mockPrivatePackage);
      packageRegistry.updatePackageVisibility.mockResolvedValue(mockPublicPackage);
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirm: true });

      await command.run(['config-1'], { public: true });

      expect(packageRegistry.updatePackageVisibility).toHaveBeenCalledWith(
        'config-1',
        true
      );
      expect(console.log).toHaveBeenCalledWith(
        chalk.green('✅ Visibility updated successfully!')
      );
    });

    it('should make package private when --private flag is used', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue(mockPublicPackage);
      packageRegistry.updatePackageVisibility.mockResolvedValue(mockPrivatePackage);
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirm: true });

      await command.run(['config-1'], { private: true });

      expect(packageRegistry.updatePackageVisibility).toHaveBeenCalledWith(
        'config-1',
        false
      );
      expect(console.log).toHaveBeenCalledWith(
        chalk.green('✅ Visibility updated successfully!')
      );
    });

    it('should show warning when making package public', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue(mockPrivatePackage);
      packageRegistry.updatePackageVisibility.mockResolvedValue(mockPublicPackage);
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirm: true });

      await command.run(['config-1'], { public: true });

      expect(console.log).toHaveBeenCalledWith(
        chalk.yellow('\\n⚠️  Making this package public will:')
      );
    });

    it('should show warning when making package private', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue(mockPublicPackage);
      packageRegistry.updatePackageVisibility.mockResolvedValue(mockPrivatePackage);
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirm: true });

      await command.run(['config-1'], { private: true });

      expect(console.log).toHaveBeenCalledWith(
        chalk.yellow('\\n⚠️  Making this package private will:')
      );
    });

    it('should skip confirmation with --yes flag', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue(mockPrivatePackage);
      packageRegistry.updatePackageVisibility.mockResolvedValue(mockPublicPackage);

      await command.run(['config-1'], { public: true, yes: true });

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(packageRegistry.updatePackageVisibility).toHaveBeenCalled();
    });

    it('should cancel when user declines confirmation', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue(mockPrivatePackage);
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirm: false });

      await command.run(['config-1'], { public: true });

      expect(packageRegistry.updatePackageVisibility).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        chalk.gray('Visibility change cancelled')
      );
    });

    it('should show message when package already has desired visibility', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue(mockPublicPackage);

      await command.run(['config-1'], { public: true });

      expect(console.log).toHaveBeenCalledWith(
        chalk.yellow('Package is already public')
      );
      expect(packageRegistry.updatePackageVisibility).not.toHaveBeenCalled();
    });

    it('should fail when both --public and --private are specified', async () => {
      authService.getSession.mockResolvedValue(mockSession);

      await command.run(['config-1'], { public: true, private: true });

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when neither --public nor --private are specified', async () => {
      authService.getSession.mockResolvedValue(mockSession);

      await command.run(['config-1'], {});

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when package not found', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue(null);

      await command.run(['config-1'], { public: true });

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when user does not own the package', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue({
        ...mockPrivatePackage,
        userId: 'other-user-id',
      });

      await command.run(['config-1'], { public: true });

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when not authenticated', async () => {
      authService.getSession.mockResolvedValue(null);

      await command.run(['config-1'], { public: true });

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when no config ID provided', async () => {
      authService.getSession.mockResolvedValue(mockSession);

      await command.run([], { public: true });

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle errors gracefully', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockRejectedValue(
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