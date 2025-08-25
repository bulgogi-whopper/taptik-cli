import { Test, TestingModule } from '@nestjs/testing';

import chalk from 'chalk';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AuthService } from '../../auth/auth.service';
import { PackageMetadata } from '../interfaces';
import { AnalyticsService } from '../services/analytics.service';
import { PackageRegistryService } from '../services/package-registry.service';

import { StatsCommand } from './stats.command';

describe('StatsCommand', () => {
  let command: StatsCommand;
  let authService: AuthService;
  let packageRegistry: PackageRegistryService;
  let analyticsService: AnalyticsService;

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
    authService = {
      getSession: vi.fn(),
    } as any;
    packageRegistry = {
      getPackageByConfigId: vi.fn(),
      getPackageStats: vi.fn(),
    } as any;
    analyticsService = {
      getPackageAnalytics: vi.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsCommand,
        { provide: AuthService, useValue: authService },
        { provide: PackageRegistryService, useValue: packageRegistry },
        { provide: AnalyticsService, useValue: analyticsService },
      ],
    }).compile();

    command = module.get<StatsCommand>(StatsCommand);
    
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('run', () => {
    it('should display package statistics in table format', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      packageRegistry.getPackageStats.mockResolvedValue(mockStats);

      await command.run(['config-1'], {});

      expect(packageRegistry.getPackageStats).toHaveBeenCalledWith('config-1');
      expect(console.log).toHaveBeenCalledWith(
        chalk.cyan('\\n📦 Package Information')
      );
      expect(console.log).toHaveBeenCalledWith(
        chalk.cyan('\\n📊 Statistics')
      );
    });

    it('should display detailed analytics when --detailed flag is used', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      packageRegistry.getPackageStats.mockResolvedValue(mockStats);
      analyticsService.getPackageAnalytics.mockResolvedValue(mockAnalytics);

      await command.run(['config-1'], { detailed: true });

      expect(analyticsService.getPackageAnalytics).toHaveBeenCalledWith('config-1');
      expect(console.log).toHaveBeenCalledWith(
        chalk.cyan('\\n📈 Analytics (Last 30 Days)')
      );
      expect(console.log).toHaveBeenCalledWith(
        chalk.cyan('\\n🌍 Geographic Distribution')
      );
    });

    it('should output JSON format when specified', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      packageRegistry.getPackageStats.mockResolvedValue(mockStats);

      await command.run(['config-1'], { format: 'json' });

      const output = (console.log as any).mock.calls
        .find((call: any[]) => call[0].includes('{'));
      expect(output).toBeDefined();
    });

    it('should output simple format when specified', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      packageRegistry.getPackageStats.mockResolvedValue(mockStats);

      await command.run(['config-1'], { format: 'simple' });

      expect(console.log).toHaveBeenCalled();
    });

    it('should display insights based on statistics', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue(mockPackage);
      packageRegistry.getPackageStats.mockResolvedValue(mockStats);

      await command.run(['config-1'], {});

      expect(console.log).toHaveBeenCalledWith(
        chalk.cyan('\\n💡 Insights')
      );
    });

    it('should allow viewing stats for public packages by other users', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue({
        ...mockPackage,
        userId: 'other-user-id',
        isPublic: true,
      });
      packageRegistry.getPackageStats.mockResolvedValue(mockStats);

      await command.run(['config-1'], {});

      expect(packageRegistry.getPackageStats).toHaveBeenCalled();
    });

    it('should deny viewing stats for private packages by other users', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue({
        ...mockPackage,
        userId: 'other-user-id',
        isPublic: false,
      });

      await command.run(['config-1'], {});

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when package not found', async () => {
      authService.getSession.mockResolvedValue(mockSession);
      packageRegistry.getPackageByConfigId.mockResolvedValue(null);

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