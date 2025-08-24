import { Test } from '@nestjs/testing';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DisplayConfiguration } from '../../../models/config-bundle.model';
import { AuthService } from '../../auth/auth.service';
import { ListService } from '../services/list.service';

import { ListCommand } from './list.command';

describe('ListCommand', () => {
  let command: ListCommand;
  let listService: ListService;
  let authService: AuthService;

  const mockConfigurations: DisplayConfiguration[] = [
    {
      id: 'config-1',
      title: 'VSCode Dark Theme Setup',
      description: 'Complete dark theme configuration for VSCode',
      createdAt: new Date('2025-08-20T10:00:00Z'),
      size: '2.3MB',
      accessLevel: 'Public',
    },
    {
      id: 'config-2',
      title: 'React Development Environment',
      description: 'Optimized React development setup',
      createdAt: new Date('2025-08-19T15:30:00Z'),
      size: '1.8MB',
      accessLevel: 'Public',
    },
  ];

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ListCommand,
        {
          provide: ListService,
          useValue: {
            listConfigurations: vi.fn(),
            listLikedConfigurations: vi.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: {
            getCurrentUser: vi.fn(),
          },
        },
      ],
    }).compile();

    command = moduleRef.get<ListCommand>(ListCommand);
    listService = moduleRef.get<ListService>(ListService);
    authService = moduleRef.get<AuthService>(AuthService);

    // Mock console methods to avoid output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  describe('run', () => {
    it('should list public configurations successfully', async () => {
      // Arrange
      const mockResult = {
        configurations: mockConfigurations,
        totalCount: 2,
        hasMore: false,
      };
      vi.mocked(listService.listConfigurations).mockResolvedValue(mockResult);

      // Act
      await command.run([], {});

      // Assert
      expect(listService.listConfigurations).toHaveBeenCalledWith({
        sort: 'date',
        limit: 20,
      });
      expect(console.log).toHaveBeenCalledWith(
        'ID       Title                    Created      Size     Access',
      );
    });

    it('should handle liked subcommand', async () => {
      // Arrange
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockResult = {
        configurations: mockConfigurations,
        totalCount: 2,
        hasMore: false,
      };
      vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(listService.listLikedConfigurations).mockResolvedValue(
        mockResult,
      );

      // Act
      await command.run(['liked'], {});

      // Assert
      expect(authService.getCurrentUser).toHaveBeenCalled();
      expect(listService.listLikedConfigurations).toHaveBeenCalledWith(
        'user-123',
        {
          sort: 'date',
          limit: 20,
        },
      );
    });

    it('should handle authentication error for liked subcommand', async () => {
      // Arrange
      vi.mocked(authService.getCurrentUser).mockResolvedValue(null);

      // Act & Assert
      await expect(command.run(['liked'], {})).rejects.toThrow(
        'process.exit called',
      );
      expect(console.error).toHaveBeenCalledWith(
        "❌ Authentication failed. Please run 'taptik login' first.",
      );
    });

    it('should handle invalid subcommand', async () => {
      // Act & Assert
      await expect(command.run(['invalid'], {})).rejects.toThrow(
        'process.exit called',
      );
      expect(console.error).toHaveBeenCalledWith(
        "❌ Invalid subcommand 'invalid'",
      );
    });

    it('should handle empty results with appropriate message', async () => {
      // Arrange
      const mockResult = {
        configurations: [],
        totalCount: 0,
        hasMore: false,
      };
      vi.mocked(listService.listConfigurations).mockResolvedValue(mockResult);

      // Act
      await command.run([], {});

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        'No configurations are available',
      );
    });

    it('should handle empty results with filter', async () => {
      // Arrange
      const mockResult = {
        configurations: [],
        totalCount: 0,
        hasMore: false,
      };
      vi.mocked(listService.listConfigurations).mockResolvedValue(mockResult);

      // Act
      await command.run([], { filter: 'nonexistent' });

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        'No configurations found matching your filter',
      );
    });
  });

  describe('option parsing', () => {
    it('should parse filter option correctly', () => {
      // Act
      const result = command.parseFilter('test query');

      // Assert
      expect(result).toBe('test query');
    });

    it('should parse sort option correctly', () => {
      // Act
      const result = command.parseSort('name');

      // Assert
      expect(result).toBe('name');
    });

    it('should throw error for invalid sort option', () => {
      // Act & Assert
      expect(() => command.parseSort('invalid')).toThrow(
        "Invalid sort option 'invalid'. Valid options: date, name",
      );
    });

    it('should parse limit option correctly', () => {
      // Act
      const result = command.parseLimit('50');

      // Assert
      expect(result).toBe(50);
    });

    it('should throw error for invalid limit', () => {
      // Act & Assert
      expect(() => command.parseLimit('0')).toThrow(
        'Limit must be greater than 0',
      );
      expect(() => command.parseLimit('101')).toThrow(
        'Limit cannot exceed 100',
      );
      expect(() => command.parseLimit('invalid')).toThrow(
        'Limit must be greater than 0',
      );
    });
  });

  describe('processOptions', () => {
    it('should apply default values', async () => {
      // Arrange
      const mockResult = {
        configurations: [],
        totalCount: 0,
        hasMore: false,
      };
      vi.mocked(listService.listConfigurations).mockResolvedValue(mockResult);

      // Act
      await command.run([], {});

      // Assert
      expect(listService.listConfigurations).toHaveBeenCalledWith({
        sort: 'date',
        limit: 20,
      });
    });

    it('should process custom options', async () => {
      // Arrange
      const mockResult = {
        configurations: [],
        totalCount: 0,
        hasMore: false,
      };
      vi.mocked(listService.listConfigurations).mockResolvedValue(mockResult);

      // Act
      await command.run([], { filter: 'test', sort: 'name', limit: 10 });

      // Assert
      expect(listService.listConfigurations).toHaveBeenCalledWith({
        filter: 'test',
        sort: 'name',
        limit: 10,
      });
    });
  });
});
