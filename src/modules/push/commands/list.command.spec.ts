import { Test, TestingModule } from '@nestjs/testing';

import chalk from 'chalk';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AuthService } from '../../auth/auth.service';
import { PackageMetadata } from '../interfaces';
import { PackageRegistryService } from '../services/package-registry.service';

import { ListCommand } from './list.command';

describe('ListCommand', () => {
  let command: ListCommand;
  let authService: AuthService;
  let packageRegistry: PackageRegistryService;

  const mockSession = {
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
    },
  };

  const mockPackages: PackageMetadata[] = [
    {
      id: 'pkg-1',
      configId: 'config-1',
      name: 'Test Package 1',
      title: 'Test Package 1',
      platform: 'claude-code',
      version: '1.0.0',
      isPublic: true,
      userId: 'test-user-id',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
      description: 'Test package 1 description',
      userTags: ['test', 'package'],
      sanitizationLevel: 'safe',
      checksum: 'abc123',
      storageUrl: 'https://storage.example.com/pkg-1',
      packageSize: 1024,
      components: [],
      autoTags: [],
    },
    {
      id: 'pkg-2',
      configId: 'config-2',
      name: 'Test Package 2',
      title: 'Test Package 2',
      platform: 'kiro',
      version: '2.0.0',
      isPublic: false,
      userId: 'test-user-id',
      createdAt: new Date('2024-01-03'),
      updatedAt: new Date('2024-01-04'),
      description: 'Test package 2 description',
      userTags: ['kiro'],
      sanitizationLevel: 'safe',
      checksum: 'def456',
      storageUrl: 'https://storage.example.com/pkg-2',
      packageSize: 2048,
      components: [],
      autoTags: [],
    },
  ];

  beforeEach(async () => {
    authService = {
      getSession: vi.fn(),
    } as any;
    packageRegistry = {
      listUserPackages: vi.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListCommand,
        { provide: AuthService, useValue: authService },
        { provide: PackageRegistryService, useValue: packageRegistry },
      ],
    }).compile();

    command = module.get<ListCommand>(ListCommand);
    
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('run', () => {
    it('should list packages in table format by default', async () => {
      vi.mocked(authService.getSession).mockResolvedValue(mockSession);
      vi.mocked(packageRegistry.listUserPackages).mockResolvedValue(mockPackages);

      await command.run([], {});

      expect(authService.getSession).toHaveBeenCalled();
      expect(packageRegistry.listUserPackages).toHaveBeenCalledWith(
        'test-user-id',
        {}
      );
      expect(console.log).toHaveBeenCalled();
    });

    it('should filter by platform when specified', async () => {
      vi.mocked(authService.getSession).mockResolvedValue(mockSession);
      vi.mocked(packageRegistry.listUserPackages).mockResolvedValue([mockPackages[0]]);

      await command.run([], { platform: 'claude-code' });

      expect(packageRegistry.listUserPackages).toHaveBeenCalledWith(
        'test-user-id',
        { platform: 'claude-code' }
      );
    });

    it('should filter by visibility when specified', async () => {
      vi.mocked(authService.getSession).mockResolvedValue(mockSession);
      vi.mocked(packageRegistry.listUserPackages).mockResolvedValue([mockPackages[0]]);

      await command.run([], { visibility: 'public' });

      expect(packageRegistry.listUserPackages).toHaveBeenCalledWith(
        'test-user-id',
        { isPublic: true }
      );
    });

    it('should output JSON format when specified', async () => {
      vi.mocked(authService.getSession).mockResolvedValue(mockSession);
      vi.mocked(packageRegistry.listUserPackages).mockResolvedValue(mockPackages);

      await command.run([], { format: 'json' });

      const output = (console.log as any).mock.calls
        .find((call: any[]) => call[0].includes('{'));
      expect(output).toBeDefined();
    });

    it('should output simple format when specified', async () => {
      vi.mocked(authService.getSession).mockResolvedValue(mockSession);
      vi.mocked(packageRegistry.listUserPackages).mockResolvedValue(mockPackages);

      await command.run([], { format: 'simple' });

      expect(console.log).toHaveBeenCalled();
    });

    it('should sort packages by created date by default', async () => {
      vi.mocked(authService.getSession).mockResolvedValue(mockSession);
      vi.mocked(packageRegistry.listUserPackages).mockResolvedValue(mockPackages);

      await command.run([], { sortBy: 'created' });

      expect(console.log).toHaveBeenCalled();
    });

    it('should sort packages by name when specified', async () => {
      vi.mocked(authService.getSession).mockResolvedValue(mockSession);
      vi.mocked(packageRegistry.listUserPackages).mockResolvedValue(mockPackages);

      await command.run([], { sortBy: 'name' });

      expect(console.log).toHaveBeenCalled();
    });

    it('should limit results when specified', async () => {
      vi.mocked(authService.getSession).mockResolvedValue(mockSession);
      vi.mocked(packageRegistry.listUserPackages).mockResolvedValue(mockPackages);

      await command.run([], { limit: 1 });

      expect(console.log).toHaveBeenCalled();
    });

    it('should show message when no packages found', async () => {
      vi.mocked(authService.getSession).mockResolvedValue(mockSession);
      vi.mocked(packageRegistry.listUserPackages).mockResolvedValue([]);

      await command.run([], {});

      expect(console.log).toHaveBeenCalledWith(
        chalk.yellow('No packages found.')
      );
    });

    it('should fail when not authenticated', async () => {
      vi.mocked(authService.getSession).mockResolvedValue(null);

      await command.run([], {});

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(authService.getSession).mockResolvedValue(mockSession);
      vi.mocked(packageRegistry.listUserPackages).mockRejectedValue(
        new Error('Network error')
      );

      await command.run([], {});

      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('option parsers', () => {
    it('should parse platform option', () => {
      expect(command.parsePlatform('claude-code')).toBe('claude-code');
    });

    it('should parse visibility option', () => {
      expect(command.parseVisibility('public')).toBe('public');
      expect(command.parseVisibility('private')).toBe('private');
      expect(command.parseVisibility('all')).toBe('all');
    });

    it('should throw error for invalid visibility', () => {
      expect(() => command.parseVisibility('invalid')).toThrow(
        'Visibility must be public, private, or all'
      );
    });

    it('should parse limit option', () => {
      expect(command.parseLimit('10')).toBe(10);
    });

    it('should throw error for invalid limit', () => {
      expect(() => command.parseLimit('invalid')).toThrow(
        'Limit must be a positive number'
      );
      expect(() => command.parseLimit('0')).toThrow(
        'Limit must be a positive number'
      );
    });

    it('should parse sort-by option', () => {
      expect(command.parseSortBy('created')).toBe('created');
      expect(command.parseSortBy('updated')).toBe('updated');
      expect(command.parseSortBy('downloads')).toBe('downloads');
      expect(command.parseSortBy('name')).toBe('name');
    });

    it('should throw error for invalid sort field', () => {
      expect(() => command.parseSortBy('invalid')).toThrow(
        'Sort field must be created, updated, downloads, or name'
      );
    });

    it('should parse format option', () => {
      expect(command.parseFormat('table')).toBe('table');
      expect(command.parseFormat('json')).toBe('json');
      expect(command.parseFormat('simple')).toBe('simple');
    });

    it('should throw error for invalid format', () => {
      expect(() => command.parseFormat('invalid')).toThrow(
        'Format must be table, json, or simple'
      );
    });
  });
});