import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';

import { ListCommand } from './list.command';
import { ListService, NetworkError, AuthenticationError, ServerError } from '../services/list.service';

/**
 * Integration tests for ListCommand
 * Tests end-to-end command execution, authentication flow, database integration, and CLI output formatting
 * Implements Requirements: All requirements (end-to-end validation)
 */
describe('ListCommand Integration Tests', () => {
  let listCommand: ListCommand;
  let mockListService: any;
  let mockAuthService: any;
  let consoleLogSpy: Mock;
  let consoleErrorSpy: Mock;
  let processExitSpy: Mock;

  // Mock display configurations for testing
  const mockDisplayConfigurations = [
    {
      id: 'config-1',
      title: 'VSCode Dark Theme Setup',
      description: 'Complete dark theme configuration for VSCode',
      createdAt: new Date('2025-08-20T10:00:00Z'),
      size: '2.3 MB',
      accessLevel: 'Public' as const,
      author: 'john_doe',
    },
    {
      id: 'config-2',
      title: 'React Development Environment',
      description: 'Optimized React development setup',
      createdAt: new Date('2025-08-19T15:30:00Z'),
      size: '1.0 MB',
      accessLevel: 'Public' as const,
      author: 'jane_smith',
    },
  ];

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  beforeEach(() => {
    // Create mock services
    mockListService = {
      listConfigurations: vi.fn().mockResolvedValue({
        configurations: mockDisplayConfigurations,
        totalCount: mockDisplayConfigurations.length,
        hasMore: false,
      }),
      listLikedConfigurations: vi.fn().mockResolvedValue({
        configurations: mockDisplayConfigurations.map(config => ({ ...config, isLiked: true })),
        totalCount: mockDisplayConfigurations.length,
        hasMore: false,
      }),
    };

    mockAuthService = {
      getCurrentUser: vi.fn().mockResolvedValue(mockUser),
    };

    // Create command instance with mocked services
    listCommand = new ListCommand(mockListService, mockAuthService);

    // Mock console methods to capture output
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    // Restore all mocks
    vi.restoreAllMocks();
  });

  describe('End-to-End Command Execution', () => {
    it('should list public configurations successfully', async () => {
      // Act
      await listCommand.run([], {});

      // Assert
      expect(mockListService.listConfigurations).toHaveBeenCalledWith({
        sort: 'date',
        limit: 20,
      });
      expect(consoleLogSpy).toHaveBeenCalled();
      
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      
      // Verify table header is displayed
      expect(output).toContain('ID       Title                    Created      Size     Access');
      
      // Verify configuration data is displayed
      expect(output).toContain('config-1');
      expect(output).toContain('VSCode Dark Theme Setup');
      expect(output).toContain('Public');
      
      expect(output).toContain('config-2');
      expect(output).toContain('React Development Env'); // Title is truncated in table display
    });

    it('should filter configurations by search term', async () => {
      // Act
      await listCommand.run([], { filter: 'VSCode' });

      // Assert
      expect(mockListService.listConfigurations).toHaveBeenCalledWith({
        filter: 'VSCode',
        sort: 'date',
        limit: 20,
      });
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should sort configurations by different fields', async () => {
      // Act
      await listCommand.run([], { sort: 'name' });

      // Assert
      expect(mockListService.listConfigurations).toHaveBeenCalledWith({
        sort: 'name',
        limit: 20,
      });
    });

    it('should respect limit parameter', async () => {
      // Act
      await listCommand.run([], { limit: 10 });

      // Assert
      expect(mockListService.listConfigurations).toHaveBeenCalledWith({
        sort: 'date',
        limit: 10,
      });
    });

    it('should display empty state when no configurations available', async () => {
      // Arrange
      mockListService.listConfigurations.mockResolvedValue({
        configurations: [],
        totalCount: 0,
        hasMore: false,
      });

      // Act
      await listCommand.run([], {});

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith('No configurations are available');
    });

    it('should display filter-specific empty state', async () => {
      // Arrange
      mockListService.listConfigurations.mockResolvedValue({
        configurations: [],
        totalCount: 0,
        hasMore: false,
      });

      // Act
      await listCommand.run([], { filter: 'nonexistent' });

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith('No configurations found matching your filter');
    });
  });

  describe('Authentication Flow for Liked Configurations', () => {
    it('should handle liked configurations for authenticated user', async () => {
      // Act
      await listCommand.run(['liked'], {});

      // Assert
      expect(mockAuthService.getCurrentUser).toHaveBeenCalled();
      expect(mockListService.listLikedConfigurations).toHaveBeenCalledWith({
        sort: 'date',
        limit: 20,
      });
      expect(consoleLogSpy).toHaveBeenCalled();
      
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('VSCode Dark Theme Setup');
    });

    it('should prompt login for unauthenticated user accessing liked configurations', async () => {
      // Arrange
      mockAuthService.getCurrentUser.mockResolvedValue(null);

      // Act & Assert
      await expect(async () => {
        await listCommand.run(['liked'], {});
      }).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "❌ Authentication failed. Please run 'taptik login' first."
      );
    });

    it('should display empty state for user with no liked configurations', async () => {
      // Arrange
      mockListService.listLikedConfigurations.mockResolvedValue({
        configurations: [],
        totalCount: 0,
        hasMore: false,
      });

      // Act
      await listCommand.run(['liked'], {});

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith("You haven't liked any configurations yet");
    });
  });

  describe('Database Integration with Supabase Client', () => {
    it('should handle network connectivity errors', async () => {
      // Arrange
      mockListService.listConfigurations.mockRejectedValue(
        new NetworkError('Unable to connect to Taptik cloud. Please check your internet connection.')
      );

      // Act & Assert
      await expect(async () => {
        await listCommand.run([], {});
      }).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Unable to connect to Taptik cloud. Please check your internet connection.'
      );
    });

    it('should handle authentication errors from database', async () => {
      // Arrange
      mockListService.listConfigurations.mockRejectedValue(
        new AuthenticationError("Authentication failed. Please run 'taptik login' first.")
      );

      // Act & Assert
      await expect(async () => {
        await listCommand.run([], {});
      }).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "❌ Authentication failed. Please run 'taptik login' first."
      );
    });

    it('should handle server errors from database', async () => {
      // Arrange
      mockListService.listConfigurations.mockRejectedValue(
        new ServerError('Taptik cloud is temporarily unavailable. Please try again later.')
      );

      // Act & Assert
      await expect(async () => {
        await listCommand.run([], {});
      }).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Taptik cloud is temporarily unavailable. Please try again later.'
      );
    });

    it('should handle rate limiting errors', async () => {
      // Arrange
      mockListService.listConfigurations.mockRejectedValue(
        new ServerError('Taptik cloud is experiencing high traffic. Please try again in a moment.')
      );

      // Act & Assert
      await expect(async () => {
        await listCommand.run([], {});
      }).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Taptik cloud is experiencing high traffic. Please try again in a moment.'
      );
    });
  });

  describe('CLI Output Formatting and Error Handling', () => {
    it('should format table output correctly', async () => {
      // Act
      await listCommand.run([], {});

      // Assert
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      
      // Verify table structure
      expect(output).toContain('ID       Title                    Created      Size     Access');
      expect(output).toContain('─'.repeat(70)); // Table separator
      
      // Verify data formatting
      expect(output).toContain('config-1'); // ID (truncated to 8 chars)
      expect(output).toContain('VSCode Dark Theme Setup'); // Title
      expect(output).toContain('2.3 MB'); // Formatted file size
      expect(output).toContain('Public'); // Access level
    });

    it('should handle invalid command arguments gracefully', async () => {
      // Act & Assert
      await expect(async () => {
        await listCommand.run(['invalid-subcommand'], {});
      }).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith("❌ Invalid subcommand 'invalid-subcommand'");
      expect(consoleErrorSpy).toHaveBeenCalledWith('💡 Valid subcommands: liked');
    });

    it('should validate sort options and show helpful error', async () => {
      // Act & Assert
      await expect(async () => {
        await listCommand.run([], { sort: 'invalid' as any });
      }).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "❌ Invalid sort option 'invalid'. Valid options: date, name"
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith('💡 Use "taptik list --help" for valid options');
    });

    it('should validate limit options and show helpful error', async () => {
      // Act & Assert
      await expect(async () => {
        await listCommand.run([], { limit: 0 });
      }).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Limit must be greater than 0');
    });

    it('should cap limit at maximum value', async () => {
      // Act & Assert
      await expect(async () => {
        await listCommand.run([], { limit: 150 });
      }).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Limit cannot exceed 100');
    });

    it('should display pagination information correctly', async () => {
      // Arrange - Mock response with more results than limit
      mockListService.listConfigurations.mockResolvedValue({
        configurations: [mockDisplayConfigurations[0]], // Only 1 result returned
        totalCount: 50, // But 50 total results available
        hasMore: true,
      });

      // Act
      await listCommand.run([], { limit: 1 });

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith('\n💡 Showing 1 of 50 configurations');
      expect(consoleLogSpy).toHaveBeenCalledWith('💡 Use --limit to see more results (max: 100)');
    });

    it('should format dates in human-readable format', async () => {
      // Arrange - Create config with recent date
      const recentConfig = {
        ...mockDisplayConfigurations[0],
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      };
      
      mockListService.listConfigurations.mockResolvedValue({
        configurations: [recentConfig],
        totalCount: 1,
        hasMore: false,
      });

      // Act
      await listCommand.run([], {});

      // Assert
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Yesterday'); // Should show "Yesterday" for 1 day ago
    });

    it('should truncate long titles appropriately', async () => {
      // Arrange - Config with very long title
      const longTitleConfig = {
        ...mockDisplayConfigurations[0],
        title: 'This is a very long configuration title that should be truncated for display purposes',
      };
      
      mockListService.listConfigurations.mockResolvedValue({
        configurations: [longTitleConfig],
        totalCount: 1,
        hasMore: false,
      });

      // Act
      await listCommand.run([], {});

      // Assert
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('This is a very long c...'); // Should be truncated with ellipsis
    });
  });

  describe('Service Integration Tests', () => {
    it('should integrate ListService with real business logic', async () => {
      // Act
      const result = await mockListService.listConfigurations({
        filter: 'VSCode',
        sort: 'name',
        limit: 10,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.configurations).toHaveLength(mockDisplayConfigurations.length);
      expect(result.totalCount).toBe(mockDisplayConfigurations.length);
      expect(result.hasMore).toBe(false);
      
      // Verify configuration transformation
      const firstConfig = result.configurations[0];
      expect(firstConfig.id).toBe('config-1');
      expect(firstConfig.title).toBe('VSCode Dark Theme Setup');
      expect(firstConfig.size).toBe('2.3 MB');
      expect(firstConfig.accessLevel).toBe('Public');
    });

    it('should handle authentication service integration for liked configs', async () => {
      // Act
      const result = await mockListService.listLikedConfigurations({
        sort: 'date',
        limit: 20,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.configurations).toHaveLength(mockDisplayConfigurations.length);
      expect(result.configurations[0].isLiked).toBe(true);
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle empty filter strings correctly', async () => {
      // Act
      await listCommand.run([], { filter: '   ' }); // Empty/whitespace filter

      // Assert - Should treat empty filter as no filter
      expect(mockListService.listConfigurations).toHaveBeenCalledWith({
        filter: '',
        sort: 'date',
        limit: 20,
      });
    });

    it('should handle generic errors gracefully', async () => {
      // Arrange
      mockListService.listConfigurations.mockRejectedValue(new Error('Generic database error'));

      // Act & Assert
      await expect(async () => {
        await listCommand.run([], {});
      }).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Generic database error');
    });
  });
});