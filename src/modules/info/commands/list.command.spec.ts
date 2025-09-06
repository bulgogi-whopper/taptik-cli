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
    // Create mock services
    const mockListService = {
      listConfigurations: vi.fn(),
      listLikedConfigurations: vi.fn(),
    };

    const mockAuthService = {
      getCurrentUser: vi.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ListCommand,
        {
          provide: ListService,
          useValue: mockListService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    command = moduleRef.get<ListCommand>(ListCommand);
    listService = moduleRef.get<ListService>(ListService);
    authService = moduleRef.get<AuthService>(AuthService);

    // Manually inject the services to ensure they're available
    (command as any).listService = listService;
    (command as any).authService = authService;

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
        expect.stringContaining('ID       Title                    Created      Size     Access'),
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
      expect(listService.listLikedConfigurations).toHaveBeenCalledWith({
        sort: 'date',
        limit: 20,
      });
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

    it('should handle empty filter option', async () => {
      // Arrange
      const mockResult = {
        configurations: [],
        totalCount: 0,
        hasMore: false,
      };
      vi.mocked(listService.listConfigurations).mockResolvedValue(mockResult);

      // Act
      await command.run([], { filter: '' });

      // Assert
      expect(listService.listConfigurations).toHaveBeenCalledWith({
        filter: '',
        sort: 'date',
        limit: 20,
      });
    });

    it('should handle whitespace-only filter', async () => {
      // Arrange
      const mockResult = {
        configurations: [],
        totalCount: 0,
        hasMore: false,
      };
      vi.mocked(listService.listConfigurations).mockResolvedValue(mockResult);

      // Act
      await command.run([], { filter: '   ' });

      // Assert
      expect(listService.listConfigurations).toHaveBeenCalledWith({
        filter: '',
        sort: 'date',
        limit: 20,
      });
    });

    it('should handle minimum valid limit', async () => {
      // Arrange
      const mockResult = {
        configurations: [],
        totalCount: 0,
        hasMore: false,
      };
      vi.mocked(listService.listConfigurations).mockResolvedValue(mockResult);

      // Act
      await command.run([], { limit: 1 });

      // Assert
      expect(listService.listConfigurations).toHaveBeenCalledWith({
        sort: 'date',
        limit: 1,
      });
    });

    it('should handle maximum valid limit', async () => {
      // Arrange
      const mockResult = {
        configurations: [],
        totalCount: 0,
        hasMore: false,
      };
      vi.mocked(listService.listConfigurations).mockResolvedValue(mockResult);

      // Act
      await command.run([], { limit: 100 });

      // Assert
      expect(listService.listConfigurations).toHaveBeenCalledWith({
        sort: 'date',
        limit: 100,
      });
    });
  });

  describe('additional option parsing edge cases', () => {
    it('should handle negative limit', () => {
      // Act & Assert
      expect(() => command.parseLimit('-5')).toThrow(
        'Limit must be greater than 0',
      );
    });

    it('should handle decimal limit string', () => {
      // Act - decimal strings are parsed as integers
      const result = command.parseLimit('10.5');

      // Assert - should parse as 10 (parseInt truncates decimals)
      expect(result).toBe(10);
    });

    it('should handle empty limit string', () => {
      // Act & Assert
      expect(() => command.parseLimit('')).toThrow(
        'Limit must be greater than 0',
      );
    });
  });

  describe('error handling', () => {
    it('should handle network errors from service', async () => {
      // Arrange
      const networkError = new Error('network connection failed');
      vi.mocked(listService.listConfigurations).mockRejectedValue(networkError);

      // Act & Assert
      await expect(command.run([], {})).rejects.toThrow('process.exit called');
      expect(console.error).toHaveBeenCalledWith(
        '❌ Unable to connect to Taptik cloud. Please check your internet connection.',
      );
    });

    it('should handle authentication errors from service', async () => {
      // Arrange
      const authError = new Error('authentication failed');
      vi.mocked(listService.listConfigurations).mockRejectedValue(authError);

      // Act & Assert
      await expect(command.run([], {})).rejects.toThrow('process.exit called');
      expect(console.error).toHaveBeenCalledWith(
        "❌ Authentication failed. Please run 'taptik login' first.",
      );
    });

    it('should handle server errors from service', async () => {
      // Arrange
      const serverError = new Error('server error 500');
      vi.mocked(listService.listConfigurations).mockRejectedValue(serverError);

      // Act & Assert
      await expect(command.run([], {})).rejects.toThrow('process.exit called');
      expect(console.error).toHaveBeenCalledWith(
        '❌ Taptik cloud is temporarily unavailable. Please try again later.',
      );
    });

    it('should handle validation errors from service', async () => {
      // Arrange
      const validationError = new Error('Invalid sort option');
      vi.mocked(listService.listConfigurations).mockRejectedValue(validationError);

      // Act & Assert
      await expect(command.run([], {})).rejects.toThrow('process.exit called');
      expect(console.error).toHaveBeenCalledWith('❌ Invalid sort option');
      expect(console.error).toHaveBeenCalledWith(
        '💡 Use "taptik list --help" for valid options',
      );
    });

    it('should handle generic errors from service', async () => {
      // Arrange
      const genericError = new Error('Something went wrong');
      vi.mocked(listService.listConfigurations).mockRejectedValue(genericError);

      // Act & Assert
      await expect(command.run([], {})).rejects.toThrow('process.exit called');
      expect(console.error).toHaveBeenCalledWith('❌ Something went wrong');
    });

    it('should handle non-Error exceptions', async () => {
      // Arrange
      vi.mocked(listService.listConfigurations).mockRejectedValue('string error');

      // Act & Assert
      await expect(command.run([], {})).rejects.toThrow('process.exit called');
      expect(console.error).toHaveBeenCalledWith('❌ An unknown error occurred');
    });

    it('should handle option processing errors', async () => {
      // Act & Assert
      await expect(command.run([], { sort: 'invalid' as any })).rejects.toThrow(
        'process.exit called',
      );
      expect(console.error).toHaveBeenCalledWith(
        "❌ Invalid sort option 'invalid'. Valid options: date, name",
      );
    });

    it('should handle limit processing errors', async () => {
      // Act & Assert
      await expect(command.run([], { limit: 0 })).rejects.toThrow(
        'process.exit called',
      );
      expect(console.error).toHaveBeenCalledWith('❌ Limit must be greater than 0');
    });

    it('should handle filter type errors', async () => {
      // Act & Assert
      await expect(command.run([], { filter: 123 as any })).rejects.toThrow(
        'process.exit called',
      );
      expect(console.error).toHaveBeenCalledWith('❌ Filter must be a string');
    });
  });

  describe('table formatting', () => {
    it('should display table header correctly', async () => {
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
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('ID       Title                    Created      Size     Access'),
      );
    });

    it('should format configuration rows correctly', async () => {
      // Arrange
      const mockResult = {
        configurations: [mockConfigurations[0]],
        totalCount: 1,
        hasMore: false,
      };
      vi.mocked(listService.listConfigurations).mockResolvedValue(mockResult);

      // Act
      await command.run([], {});

      // Assert
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('config-1'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('VSCode Dark Theme Setup'));
    });

    it('should handle long titles with truncation', async () => {
      // Arrange
      const longTitleConfig = {
        ...mockConfigurations[0],
        title: 'This is a very long configuration title that should be truncated',
      };
      const mockResult = {
        configurations: [longTitleConfig],
        totalCount: 1,
        hasMore: false,
      };
      vi.mocked(listService.listConfigurations).mockResolvedValue(mockResult);

      // Act
      await command.run([], {});

      // Assert - should truncate long titles
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('This is a very long c...'));
    });

    it('should handle configurations with missing optional fields', async () => {
      // Arrange
      const minimalConfig = {
        id: 'config-minimal',
        title: 'Minimal Config',
        createdAt: new Date('2025-08-20T10:00:00Z'),
        size: '1.0MB',
        accessLevel: 'Public' as const,
      };
      const mockResult = {
        configurations: [minimalConfig],
        totalCount: 1,
        hasMore: false,
      };
      vi.mocked(listService.listConfigurations).mockResolvedValue(mockResult);

      // Act & Assert - should not throw
      await expect(command.run([], {})).resolves.toBeUndefined();
    });
  });

  describe('pagination display', () => {
    it('should show pagination info when hasMore is true', async () => {
      // Arrange
      const mockResult = {
        configurations: mockConfigurations,
        totalCount: 50,
        hasMore: true,
      };
      vi.mocked(listService.listConfigurations).mockResolvedValue(mockResult);

      // Act
      await command.run([], {});

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        '\n💡 Showing 2 of 50 configurations',
      );
      expect(console.log).toHaveBeenCalledWith(
        '💡 Use --limit to see more results (max: 100)',
      );
    });

    it('should show completion message when all results shown', async () => {
      // Arrange
      const mockResult = {
        configurations: mockConfigurations,
        totalCount: 2,
        hasMore: false,
      };
      vi.mocked(listService.listConfigurations).mockResolvedValue(mockResult);

      // Act
      await command.run([], {});

      // Assert - should not show pagination info for complete results
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('💡 Showing'),
      );
    });

    it('should handle pagination for liked configurations', async () => {
      // Arrange
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockResult = {
        configurations: mockConfigurations,
        totalCount: 25,
        hasMore: true,
      };
      vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(listService.listLikedConfigurations).mockResolvedValue(mockResult);

      // Act
      await command.run(['liked'], {});

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        '\n💡 Showing 2 of 25 liked configurations',
      );
    });
  });

  describe('subcommand handling', () => {
    it('should handle multiple invalid subcommands', async () => {
      // Act & Assert
      await expect(command.run(['invalid1', 'invalid2'], {})).rejects.toThrow(
        'process.exit called',
      );
      expect(console.error).toHaveBeenCalledWith(
        "❌ Invalid subcommand 'invalid1'",
      );
    });

    it('should handle case-sensitive subcommands', async () => {
      // Act & Assert
      await expect(command.run(['LIKED'], {})).rejects.toThrow(
        'process.exit called',
      );
      expect(console.error).toHaveBeenCalledWith(
        "❌ Invalid subcommand 'LIKED'",
      );
    });

    it('should handle empty string subcommand', async () => {
      // Arrange - empty string is falsy, so it goes to default case (public list)
      const mockResult = {
        configurations: [],
        totalCount: 0,
        hasMore: false,
      };
      vi.mocked(listService.listConfigurations).mockResolvedValue(mockResult);

      // Act
      await command.run([''], {});

      // Assert - empty string should be treated as default (public list)
      expect(listService.listConfigurations).toHaveBeenCalledWith({
        sort: 'date',
        limit: 20,
      });
    });
  });
});
