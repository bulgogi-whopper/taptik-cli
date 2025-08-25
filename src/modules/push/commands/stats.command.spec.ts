import chalk from 'chalk';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { PackageMetadata } from '../interfaces';

import { StatsCommand } from './stats.command';

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

describe('StatsCommand', () => {
  let command: StatsCommand;
  let mockAuthService: { getSession: any };
  let mockPackageRegistry: { getPackageByConfigId: any; getPackageStats: any };
  let mockAnalyticsService: { getAnalyticsSummary: any };

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
    isPublic: true,
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

  const mockStats = {
    downloadCount: 150,
    likeCount: 25,
    viewCount: 500,
    lastDownloaded: new Date('2024-01-10'),
  };

  const mockAnalytics = {
    downloads: {
      total: 150,
      dailyAverage: 5,
      trend: 15.5,
    },
    views: {
      total: 500,
      dailyAverage: 16.7,
      trend: -5.2,
    },
    geographic: [
      { country: 'United States', count: 75, percentage: 50 },
      { country: 'Germany', count: 30, percentage: 20 },
      { country: 'Japan', count: 22, percentage: 14.7 },
      { country: 'United Kingdom', count: 15, percentage: 10 },
      { country: 'France', count: 8, percentage: 5.3 },
    ],
  };

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    mockAuthService = {
      getSession: vi.fn(),
    };
    mockPackageRegistry = {
      getPackageByConfigId: vi.fn(),
      getPackageStats: vi.fn(),
    };
    mockAnalyticsService = {
      getPackageAnalytics: vi.fn(),
    };

    // Directly instantiate the command with mocked services
    command = new StatsCommand(mockAuthService as any, mockPackageRegistry as any, mockAnalyticsService as any);
    
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('run', () => {
    it('should display package statistics in table format', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      mockPackageRegistry.getPackageStats.mockResolvedValue(mockStats);

      await command.run(['config-1'], {});

      expect(mockPackageRegistry.getPackageStats).toHaveBeenCalledWith('config-1');
      expect(console.log).toHaveBeenCalledWith(
        chalk.cyan('\n📦 Package Information')
      );
      expect(console.log).toHaveBeenCalledWith(
        chalk.cyan('\n📊 Statistics')
      );
    });

    it('should display detailed analytics when --detailed flag is used', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      mockPackageRegistry.getPackageStats.mockResolvedValue(mockStats);
      mockAnalyticsService.getPackageAnalytics.mockResolvedValue(mockAnalytics);

      await command.run(['config-1'], { detailed: true });

      expect(mockAnalyticsService.getPackageAnalytics).toHaveBeenCalledWith('config-1');
      expect(console.log).toHaveBeenCalledWith(
        chalk.cyan('\n📈 Analytics (Last 30 Days)')
      );
      expect(console.log).toHaveBeenCalledWith(
        chalk.cyan('\n🌍 Geographic Distribution')
      );
    });

    it('should output JSON format when specified', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      mockPackageRegistry.getPackageStats.mockResolvedValue(mockStats);

      await command.run(['config-1'], { format: 'json' });

      const output = (console.log as any).mock.calls
        .find((call: any[]) => call[0].includes('{'));
      expect(output).toBeDefined();
    });

    it('should output simple format when specified', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      mockPackageRegistry.getPackageStats.mockResolvedValue(mockStats);

      await command.run(['config-1'], { format: 'simple' });

      expect(console.log).toHaveBeenCalled();
    });

    it('should display insights based on statistics', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      mockPackageRegistry.getPackageStats.mockResolvedValue(mockStats);

      await command.run(['config-1'], {});

      expect(console.log).toHaveBeenCalledWith(
        chalk.cyan('\n💡 Insights')
      );
    });

    it('should allow viewing stats for public packages by other users', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue({
        ...mockPackage,
        userId: 'other-user-id',
        isPublic: true,
      });
      mockPackageRegistry.getPackageStats.mockResolvedValue(mockStats);

      await command.run(['config-1'], {});

      expect(mockPackageRegistry.getPackageStats).toHaveBeenCalled();
    });

    it('should deny viewing stats for private packages by other users', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue({
        ...mockPackage,
        userId: 'other-user-id',
        isPublic: false,
      });

      await command.run(['config-1'], {});

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when package not found', async () => {
      mockAuthService.getSession.mockResolvedValue(mockSession);
      mockPackageRegistry.getPackageByConfigId.mockResolvedValue(null);

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
        new Error('Network error')
      );

      await command.run(['config-1'], {});

      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('option parsers', () => {
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

    it('should parse detailed option', () => {
      expect(command.parseDetailed()).toBe(true);
    });
  });
});