import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { ListCommand } from './list.command';
import { ListService } from '../services/list.service';
import { AuthService } from '../../auth/auth.service';
import { SupabaseService } from '../../supabase/supabase.service';

/**
 * Integration tests for ListCommand
 * Tests end-to-end command execution, authentication flow, database integration, and CLI output formatting
 * Implements Requirements: All requirements (end-to-end validation)
 */
describe('ListCommand Integration Tests', () => {
  let listCommand: ListCommand;
  let mockListService: any;
  let mockAuthService: any;
  let supabaseClient: SupabaseClient;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  // Test data for integration tests
  const testUser = {
    id: 'test-user-auth',
    email: 'test@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Set up test environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.NODE_ENV = 'test';

    // Create test Supabase client
    supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
    );

    // Create mock services
    mockListService = {
      listConfigurations: vi.fn(),
      listLikedConfigurations: vi.fn(),
    };

    mockAuthService = {
      getCurrentUser: vi.fn(),
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
    vi.restoreAllMocks();
  });

  describe('End-to-End Command Execution', () => {
    it('should list public configurations successfully with service integration', async () => {
      // Arrange - Mock successful service response
      const mockResult = {
        configurations: [
          {
            id: 'test-config-1',
            title: 'VSCode Dark Theme Setup',
            description: 'Complete dark theme configuration for VSCode',
            createdAt: new Date('2025-08-20T10:00:00Z'),
            size: '2.4 MB',
            accessLevel: 'Public' as const,
          },
        ],
        totalCount: 1,
        hasMore: false,
      };
      
      mockListService.listConfigurations.mockResolvedValue(mockResult);

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
      expect(output).toContain('test-con'); // ID truncated to 8 chars
      expect(output).toContain('VSCode Dark Theme Setup');
      expect(output).toContain('Public');
    });

    it('should filter configurations by search term with service integration', async () => {
      // Arrange - Mock filtered service response
      const mockResult = {
        configurations: [
          {
            id: 'test-config-1',
            title: 'VSCode Dark Theme Setup',
            description: 'Complete dark theme configuration for VSCode',
            createdAt: new Date('2025-08-20T10:00:00Z'),
            size: '2.4 MB',
            accessLevel: 'Public' as const,
          },
        ],
        totalCount: 1,
        hasMore: false,
      };
      
      mockListService.listConfigurations.mockResolvedValue(mockResult);

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

    it('should display empty state when no configurations available', async () => {
      // Arrange - Mock empty service response
      const mockResult = {
        configurations: [],
        totalCount: 0,
        hasMore: false,
      };
      
      mockListService.listConfigurations.mockResolvedValue(mockResult);

      // Act
      await listCommand.run([], {});

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith('No configurations are available');
    });
  });

  describe('Authentication Flow for Liked Configurations', () => {
    it('should handle liked configurations for authenticated user with service integration', async () => {
      // Arrange - Mock authenticated user and liked configs
      mockAuthService.getCurrentUser.mockResolvedValue(testUser);
      
      const mockResult = {
        configurations: [
          {
            id: 'test-config-1',
            title: 'VSCode Dark Theme Setup',
            description: 'Complete dark theme configuration for VSCode',
            createdAt: new Date('2025-08-20T10:00:00Z'),
            size: '2.4 MB',
            accessLevel: 'Public' as const,
            isLiked: true,
          },
        ],
        totalCount: 1,
        hasMore: false,
      };
      
      mockListService.listLikedConfigurations.mockResolvedValue(mockResult);

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
      // Arrange - Mock unauthenticated user
      mockAuthService.getCurrentUser.mockResolvedValue(null);

      // Act & Assert
      await expect(async () => {
        await listCommand.run(['liked'], {});
      }).rejects.toThrow('process.exit called');

      expect(mockAuthService.getCurrentUser).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "❌ Authentication failed. Please run 'taptik login' first."
      );
    });

    it('should display empty state for user with no liked configurations', async () => {
      // Arrange - Mock authenticated user with no liked configs
      mockAuthService.getCurrentUser.mockResolvedValue(testUser);
      
      const mockResult = {
        configurations: [],
        totalCount: 0,
        hasMore: false,
      };
      
      mockListService.listLikedConfigurations.mockResolvedValue(mockResult);

      // Act
      await listCommand.run(['liked'], {});

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith("You haven't liked any configurations yet");
    });
  });

  describe('Service Error Handling Integration', () => {
    it('should handle network errors from service', async () => {
      // Arrange - Mock service throwing network error
      const networkError = new Error('network connection failed');
      mockListService.listConfigurations.mockRejectedValue(networkError);

      // Act & Assert
      await expect(async () => {
        await listCommand.run([], {});
      }).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Unable to connect to Taptik cloud. Please check your internet connection.'
      );
    });

    it('should handle authentication errors from service', async () => {
      // Arrange - Mock service throwing authentication error
      const authError = new Error('authentication failed');
      mockListService.listConfigurations.mockRejectedValue(authError);

      // Act & Assert
      await expect(async () => {
        await listCommand.run([], {});
      }).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "❌ Authentication failed. Please run 'taptik login' first."
      );
    });

    it('should handle server errors from service', async () => {
      // Arrange - Mock service throwing server error
      const serverError = new Error('server error 500');
      mockListService.listConfigurations.mockRejectedValue(serverError);

      // Act & Assert
      await expect(async () => {
        await listCommand.run([], {});
      }).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Taptik cloud is temporarily unavailable. Please try again later.'
      );
    });
  });

  describe('CLI Output Formatting Integration', () => {
    it('should format table output correctly with real data transformation', async () => {
      // Arrange - Mock service response with multiple configurations
      const mockResult = {
        configurations: [
          {
            id: 'test-config-1',
            title: 'VSCode Dark Theme Setup',
            description: 'Complete dark theme configuration for VSCode',
            createdAt: new Date('2025-08-20T10:00:00Z'),
            size: '2.4 MB',
            accessLevel: 'Public' as const,
          },
          {
            id: 'test-config-2',
            title: 'React Development Environment',
            description: 'Optimized React development setup',
            createdAt: new Date('2025-08-19T15:30:00Z'),
            size: '1.8 MB',
            accessLevel: 'Public' as const,
          },
        ],
        totalCount: 2,
        hasMore: false,
      };
      
      mockListService.listConfigurations.mockResolvedValue(mockResult);

      // Act
      await listCommand.run([], {});

      // Assert
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      
      // Verify table structure
      expect(output).toContain('ID       Title                    Created      Size     Access');
      expect(output).toContain('─'.repeat(70)); // Table separator
      
      // Verify data formatting
      expect(output).toContain('test-con'); // ID (truncated to 8 chars)
      expect(output).toContain('VSCode Dark Theme Setup'); // Title
      expect(output).toContain('2.4 MB'); // Formatted file size
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

    it('should display pagination information correctly', async () => {
      // Arrange - Mock response with more results than returned
      const mockResult = {
        configurations: [
          {
            id: 'test-config-1',
            title: 'VSCode Dark Theme Setup',
            description: 'Complete dark theme configuration for VSCode',
            createdAt: new Date('2025-08-20T10:00:00Z'),
            size: '2.4 MB',
            accessLevel: 'Public' as const,
          },
        ],
        totalCount: 50, // More results available
        hasMore: true,
      };
      
      mockListService.listConfigurations.mockResolvedValue(mockResult);

      // Act
      await listCommand.run([], { limit: 1 });

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith('\n💡 Showing 1 of 50 configurations');
      expect(consoleLogSpy).toHaveBeenCalledWith('💡 Use --limit to see more results (max: 100)');
    });
  });

  describe('Real Database Integration Simulation', () => {
    it('should simulate database query patterns correctly', async () => {
      // Arrange - Mock Supabase client behavior
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
      };
      
      vi.spyOn(supabaseClient, 'from').mockReturnValue(mockQuery as any);
      mockQuery.range.mockResolvedValue({
        data: [
          {
            id: 'test-config-1',
            title: 'VSCode Dark Theme Setup',
            description: 'Complete dark theme configuration for VSCode',
            source_ide: 'vscode',
            target_ides: ['cursor', 'kiro'],
            tags: ['theme', 'dark', 'vscode'],
            is_public: true,
            file_path: 'test/path/config1.json',
            file_size: 2400000, // 2.4MB
            download_count: 10,
            like_count: 5,
            version: '1.0.0',
            user_id: 'test-user-1',
            created_at: new Date('2025-08-20T10:00:00Z'),
            updated_at: new Date('2025-08-20T10:00:00Z'),
          },
        ],
        error: null,
        count: 1,
      });

      // Create a real ListService instance for this test
      const realListService = new ListService(mockAuthService, { getClient: () => supabaseClient } as any);
      
      // Act - Test the real service with mocked database
      const result = await realListService.listConfigurations({
        filter: 'VSCode',
        sort: 'name',
        limit: 10,
      });

      // Assert - Verify database integration patterns
      expect(supabaseClient.from).toHaveBeenCalledWith('config_bundles');
      expect(mockQuery.select).toHaveBeenCalledWith('*', { count: 'exact' });
      expect(mockQuery.eq).toHaveBeenCalledWith('is_public', true);
      expect(mockQuery.ilike).toHaveBeenCalledWith('title', '%VSCode%');
      expect(mockQuery.order).toHaveBeenCalledWith('title', { ascending: true });
      expect(mockQuery.range).toHaveBeenCalledWith(0, 9);
      
      // Verify result transformation
      expect(result.configurations).toHaveLength(1);
      expect(result.configurations[0].size).toBe('2.3 MB'); // Bytes converted to human readable (2400000 bytes = 2.3 MB)
      expect(result.configurations[0].accessLevel).toBe('Public'); // Boolean converted to string
    });

    it('should handle database errors correctly in real service', async () => {
      // Arrange - Mock database error
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockRejectedValue({
          error: { code: 'PGRST301', message: 'connection failed' },
          data: null,
          count: null,
        }),
      };
      
      vi.spyOn(supabaseClient, 'from').mockReturnValue(mockQuery as any);

      // Create a real ListService instance for this test
      const realListService = new ListService(mockAuthService, { getClient: () => supabaseClient } as any);

      // Act & Assert - Test real service error handling
      await expect(async () => {
        await realListService.listConfigurations({});
      }).rejects.toThrow('Failed to list configurations');
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large result sets efficiently', async () => {
      // Arrange - Mock large dataset
      const largeConfigSet = Array.from({ length: 20 }, (_, i) => ({
        id: `large-config-${i}`,
        title: `Configuration ${i}`,
        description: `Description for configuration ${i}`,
        createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        size: `${(i + 1) * 0.5} MB`,
        accessLevel: 'Public' as const,
      }));
      
      const mockResult = {
        configurations: largeConfigSet,
        totalCount: 100,
        hasMore: true,
      };
      
      mockListService.listConfigurations.mockResolvedValue(mockResult);

      // Act
      const startTime = Date.now();
      await listCommand.run([], { limit: 20 });
      const endTime = Date.now();

      // Assert - Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second
      expect(mockListService.listConfigurations).toHaveBeenCalledWith({
        sort: 'date',
        limit: 20,
      });
      
      // Verify pagination info is shown
      expect(consoleLogSpy).toHaveBeenCalledWith('\n💡 Showing 20 of 100 configurations');
    });

    it('should handle concurrent authentication and service operations', async () => {
      // Arrange - Mock both auth and service operations
      mockAuthService.getCurrentUser.mockResolvedValue(testUser);
      
      const mockResult = {
        configurations: [
          {
            id: 'test-config-1',
            title: 'VSCode Dark Theme Setup',
            description: 'Complete dark theme configuration for VSCode',
            createdAt: new Date('2025-08-20T10:00:00Z'),
            size: '2.4 MB',
            accessLevel: 'Public' as const,
            isLiked: true,
          },
        ],
        totalCount: 1,
        hasMore: false,
      };
      
      mockListService.listLikedConfigurations.mockResolvedValue(mockResult);

      // Act - Run liked configurations command
      await listCommand.run(['liked'], {});

      // Assert - Should handle auth + service operations correctly
      expect(mockAuthService.getCurrentUser).toHaveBeenCalled();
      expect(mockListService.listLikedConfigurations).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });
});