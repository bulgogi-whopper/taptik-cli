import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  AnalyticsEventType,
  TimeRange,
  TrendingOptions,
  PerformanceMetrics,
  AnalyticsOptions,
} from '../interfaces';

import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockSupabaseClient: any;
  let mockSupabaseService: any;
  let mockConfigService: any;

  beforeEach(() => {
    // Create mock Supabase client
    mockSupabaseClient = {
      from: vi.fn(),
      rpc: vi.fn(),
    };

    // Create mock services
    mockSupabaseService = {
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
    };

    mockConfigService = {
      get: vi.fn().mockImplementation((key: string) => {
        switch (key) {
          case 'analytics.enabled':
            return true;
          case 'analytics.anonymizeData':
            return true;
          case 'analytics.retentionDays':
            return 90;
          case 'analytics.geoPrivacyLevel':
            return 'country';
          default:
            return undefined;
        }
      }),
    };

    // Directly instantiate the service with mocked dependencies
    service = new AnalyticsService(mockSupabaseService, mockConfigService);

    // Reset mock function calls before each test
    vi.clearAllMocks();
  });

  describe('trackEvent', () => {
    it('should track a download event successfully', async () => {
      const packageId = 'test-package-id';
      const userId = 'test-user-id';
      const metadata = {
        source: 'cli',
        version: '1.0.0',
        ipAddress: '192.168.1.1',
        userAgent: 'taptik-cli/1.0.0',
      };

      const mockInsert = vi.fn().mockResolvedValue({
        data: {
          id: 'event-id',
          package_id: packageId,
          event_type: 'download',
          user_id: userId,
          metadata,
          created_at: new Date().toISOString(),
        },
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' }, // Not found error
          }),
        }),
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_preferences') {
          return { select: mockSelect };
        }
        return { insert: mockInsert };
      });

      await service.trackEvent({
        packageId,
        eventType: AnalyticsEventType.DOWNLOAD,
        userId,
        metadata,
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('package_analytics');
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should handle tracking when analytics is disabled', async () => {
      // Override config to disable analytics
      mockConfigService.get.mockReturnValue(false); // analytics.enabled = false

      const result = await service.trackEvent({
        packageId: 'test-package',
        eventType: AnalyticsEventType.DOWNLOAD,
      });

      expect(result).toBeUndefined();
      expect(mockSupabaseService.getClient).not.toHaveBeenCalled();
    });

    it('should anonymize user data when privacy mode is enabled', async () => {
      const packageId = 'test-package-id';
      const userId = 'test-user-id';
      const metadata = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        email: 'user@example.com',
      };

      const mockInsert = vi.fn().mockImplementation((data) => {
        // Verify anonymization
        expect(data.metadata.ipAddress).toBeUndefined();
        expect(data.metadata.email).toBeUndefined();
        expect(data.metadata.userAgent).toBeDefined();
        return Promise.resolve({ data, error: null });
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_preferences') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116' },
                }),
              }),
            }),
          };
        }
        return { insert: mockInsert };
      });

      await service.trackEvent({
        packageId,
        eventType: AnalyticsEventType.VIEW,
        userId,
        metadata,
        respectPrivacy: true,
      });

      expect(mockInsert).toHaveBeenCalled();
    });

    it('should handle user opt-out preferences', async () => {
      const packageId = 'test-package-id';
      const userId = 'opted-out-user';

      // Mock user opt-out check
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_preferences') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { analytics_opt_out: true },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const result = await service.trackEvent({
        packageId,
        eventType: AnalyticsEventType.LIKE,
        userId,
      });

      expect(result).toBeUndefined(); // Event should not be tracked
    });

    it('should handle tracking errors gracefully', async () => {
      const packageId = 'test-package-id';

      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });

      await expect(
        service.trackEvent({
          packageId,
          eventType: AnalyticsEventType.SHARE,
        }),
      ).rejects.toThrow('Failed to track analytics event');
    });
  });

  describe('getPackageAnalytics', () => {
    it('should retrieve analytics for a package', async () => {
      const packageId = 'test-package-id';
      const timeRange: TimeRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      const mockAnalyticsData = [
        { event_type: 'download', created_at: '2024-01-15' },
        { event_type: 'download', created_at: '2024-01-16' },
        { event_type: 'view', created_at: '2024-01-15' },
        { event_type: 'view', created_at: '2024-01-16' },
        { event_type: 'view', created_at: '2024-01-17' },
        { event_type: 'like', created_at: '2024-01-15' },
        { event_type: 'share', created_at: '2024-01-15' },
      ];

      // Create a chainable mock query object
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
      };

      // Make the entire chain resolve to the data when awaited
      // The query object itself should be the thenable
      Object.assign(mockQuery, {
        then: (resolve: any) => {
          resolve({
            data: mockAnalyticsData,
            error: null,
          });
        },
      });

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const report = await service.getPackageAnalytics(packageId, timeRange);

      expect(report).toMatchObject({
        packageId,
        timeRange,
        totalDownloads: 2,
        totalViews: 3,
        totalLikes: 1,
        totalShares: 1,
        engagementRate: expect.any(Number),
      });
    });

    it('should calculate daily aggregations', async () => {
      const packageId = 'test-package-id';
      const timeRange: TimeRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-07'),
      };

      const mockDailyData = [
        { date: '2024-01-01', downloads: 10, views: 20, likes: 2, shares: 1 },
        { date: '2024-01-02', downloads: 15, views: 25, likes: 3, shares: 2 },
        { date: '2024-01-03', downloads: 20, views: 30, likes: 4, shares: 3 },
      ];

      // Create a chainable mock query object
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
      };

      // Make the entire chain resolve to empty data when awaited
      Object.assign(mockQuery, {
        then: (resolve: any) => {
          resolve({
            data: [],
            error: null,
          });
        },
      });

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockDailyData,
        error: null,
      });

      const options: AnalyticsOptions = { aggregation: 'daily' };
      const report = await service.getPackageAnalytics(
        packageId,
        timeRange,
        options,
      );

      expect(report.dailyBreakdown).toBeDefined();
      expect(report.dailyBreakdown).toHaveLength(3);
    });
  });

  describe('getTrendingPackages', () => {
    it('should calculate trending packages based on recent activity', async () => {
      const mockTrendingData = [
        {
          package_id: 'pkg-1',
          title: 'Popular Config',
          score: 1500,
          download_count: 500,
          like_count: 50,
          view_count: 1000,
        },
        {
          package_id: 'pkg-2',
          title: 'Rising Config',
          score: 1200,
          download_count: 300,
          like_count: 40,
          view_count: 800,
        },
      ];

      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockTrendingData,
        error: null,
      });

      const options: TrendingOptions = {
        period: 'week',
        limit: 10,
      };

      const trending = await service.getTrendingPackages(options);

      expect(trending).toHaveLength(2);
      expect(trending[0].score).toBeGreaterThan(trending[1].score);
      expect(trending[0].packageId).toBe('pkg-1');
    });

    it('should support different time periods for trending calculation', async () => {
      const periods: Array<'day' | 'week' | 'month'> = ['day', 'week', 'month'];

      // Run each period test sequentially to avoid mock conflicts
      for (const period of periods) {
        const mockRpc = vi.fn().mockResolvedValue({
          data: [],
          error: null,
        });

        mockSupabaseClient.rpc = mockRpc;

        await service.getTrendingPackages({ period });

        expect(mockRpc).toHaveBeenCalledWith(
          'get_trending_packages',
          expect.objectContaining({ time_period: period }),
        );
      }
    });
  });

  describe('getGeographicDistribution', () => {
    it('should return anonymized geographic distribution', async () => {
      const packageId = 'test-package-id';

      const mockGeoData = [
        { country: 'US' },
        { country: 'US' },
        { country: 'US' },
        { country: 'GB' },
        { country: 'GB' },
        { country: 'DE' },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockGeoData,
            error: null,
          }),
        }),
      });

      const distribution = await service.getGeographicDistribution(packageId);

      expect(distribution).toHaveProperty('countries');
      expect(distribution.countries).toHaveLength(3);
      expect(distribution.countries[0]).toMatchObject({
        code: 'US',
        count: 3,
        percentage: 50,
      });
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should track upload performance metrics', async () => {
      const metrics: PerformanceMetrics = {
        uploadSpeed: 5.2, // MB/s
        downloadSpeed: 0,
        packageSize: 15360, // 15KB
        duration: 3000, // 3 seconds
        operation: 'upload',
      };

      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          data: { id: 'metric-id', ...metrics },
          error: null,
        }),
      });

      await service.trackPerformanceMetrics('test-package-id', metrics);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        'performance_metrics',
      );
    });

    it('should aggregate performance metrics over time', async () => {
      const packageId = 'test-package-id';

      const mockMetricsData = {
        avg_upload_speed: 4.5,
        avg_download_speed: 8.2,
        total_uploads: 150,
        total_downloads: 500,
        p95_upload_duration: 5000,
        p95_download_duration: 2000,
      };

      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockMetricsData,
        error: null,
      });

      const metrics = await service.getAggregatedPerformanceMetrics(packageId);

      expect(metrics).toMatchObject({
        averageUploadSpeed: 4.5,
        averageDownloadSpeed: 8.2,
        totalUploads: 150,
        totalDownloads: 500,
        p95UploadDuration: 5000,
        p95DownloadDuration: 2000,
      });
    });
  });

  describe('getDemographicInsights', () => {
    it('should provide anonymized demographic insights', async () => {
      const packageId = 'test-package-id';

      const mockDemographicData = {
        platforms: [
          { name: 'Windows', count: 300 },
          { name: 'macOS', count: 200 },
          { name: 'Linux', count: 100 },
        ],
        ide_versions: [
          { version: 'claude-code', count: 400 },
          { version: 'kiro', count: 150 },
          { version: 'cursor', count: 50 },
        ],
        user_tiers: [
          { tier: 'free', count: 450 },
          { tier: 'pro', count: 150 },
        ],
      };

      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockDemographicData,
        error: null,
      });

      const insights = await service.getDemographicInsights(packageId);

      expect(insights).toHaveProperty('platforms');
      expect(insights).toHaveProperty('ideVersions');
      expect(insights).toHaveProperty('userTiers');
      expect(insights.platforms[0].percentage).toBe(50); // 300/600
    });
  });

  describe('privacy compliance', () => {
    it('should provide data export for GDPR compliance', async () => {
      const userId = 'test-user-id';

      const mockUserData = [
        {
          event_type: 'download',
          package_id: 'pkg-1',
          created_at: '2024-01-01',
        },
        { event_type: 'like', package_id: 'pkg-2', created_at: '2024-01-02' },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockUserData,
            error: null,
          }),
        }),
      });

      const exportData = await service.exportUserAnalyticsData(userId);

      expect(exportData).toHaveProperty('userId', userId);
      expect(exportData).toHaveProperty('events');
      expect(exportData.events).toHaveLength(2);
    });

    it('should delete user analytics data on request', async () => {
      const userId = 'test-user-id';

      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      });

      mockSupabaseClient.from.mockReturnValue({
        delete: mockDelete,
      });

      await service.deleteUserAnalyticsData(userId);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('package_analytics');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should respect data retention policies', async () => {
      // Override config for retention days
      mockConfigService.get.mockReturnValue(90); // 90 days retention

      const mockDelete = vi.fn().mockReturnValue({
        lt: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      });

      mockSupabaseClient.from.mockReturnValue({
        delete: mockDelete,
      });

      await service.cleanupOldAnalyticsData();

      expect(mockSupabaseClient.from).toHaveBeenCalled();
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      const packageId = 'test-package-id';

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database connection failed' },
          }),
        }),
      });

      await expect(service.getPackageAnalytics(packageId)).rejects.toThrow(
        'Failed to retrieve package analytics',
      );
    });
  });
});
