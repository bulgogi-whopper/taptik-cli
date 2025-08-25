import { Test, TestingModule } from '@nestjs/testing';

import chalk from 'chalk';
import inquirer from 'inquirer';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AuthService } from '../../auth/auth.service';
import { PackageMetadata } from '../interfaces';
import { PackageRegistryService } from '../services/package-registry.service';

import { DeleteCommand } from './delete.command';

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

describe('DeleteCommand', () => {
  let command: DeleteCommand;
  let authService: AuthService;
  let packageRegistry: PackageRegistryService;

  const mockSession = {
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
    },
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
    authService = {
      getSession: vi.fn(),
    } as any;
    packageRegistry = {
      getPackageByConfigId: vi.fn(),
      deletePackage: vi.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteCommand,
        { provide: AuthService, useValue: authService },
        { provide: PackageRegistryService, useValue: packageRegistry },
      ],
    }).compile();

    command = module.get<DeleteCommand>(DeleteCommand);
    
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
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      packageRegistry.deletePackage.mockResolvedValue(undefined);
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmText: 'DELETE' });

      await command.run(['config-1'], {});

      expect(packageRegistry.deletePackage).toHaveBeenCalledWith('config-1');
      expect(console.log).toHaveBeenCalledWith(
        chalk.green('✅ Package deleted successfully!')
      );
    });

    it('should delete package with --yes flag', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      packageRegistry.deletePackage.mockResolvedValue(undefined);
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirm: true });

      await command.run(['config-1'], { yes: true });

      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to delete this package?',
        }),
      ]);
      expect(packageRegistry.deletePackage).toHaveBeenCalled();
    });

    it('should delete package with --force flag without prompts', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      packageRegistry.deletePackage.mockResolvedValue(undefined);

      await command.run(['config-1'], { force: true });

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(packageRegistry.deletePackage).toHaveBeenCalledWith('config-1');
    });

    it('should show warning for public packages', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue({
        ...mockPackage,
        isPublic: true,
      });
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmText: 'DELETE' });

      await command.run(['config-1'], {});

      expect(console.log).toHaveBeenCalledWith(
        chalk.yellow('\\n⚠️  This is a public package that may be used by others')
      );
    });

    it('should cancel deletion when confirmation text is wrong', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmText: 'wrong' });

      await command.run(['config-1'], {});

      expect(packageRegistry.deletePackage).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        chalk.gray('Deletion cancelled')
      );
    });

    it('should cancel deletion when user declines with --yes flag', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirm: false });

      await command.run(['config-1'], { yes: true });

      expect(packageRegistry.deletePackage).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        chalk.gray('Deletion cancelled')
      );
    });

    it('should fail when package not found', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue(null);

      await command.run(['config-1'], {});

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when user does not own the package', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue({
        ...mockPackage,
        userId: 'other-user-id',
      });

      await command.run(['config-1'], {});

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when not authenticated', async () => {
      authService.getSession.mockResolvedValue(null);

      await command.run(['config-1'], {});

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when no config ID provided', async () => {
      authService.getSession.mockResolvedValue(mockSession);

      await command.run([], {});

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle errors gracefully', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockRejectedValue(
        new Error('Network error')
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