import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SupabaseService } from '../../supabase/supabase.service';
import {
  AnalyticsEvent,
  AnalyticsEventType,
  PackageAnalyticsReport,
  TimeRange,
  TrendingPackage,
  TrendingOptions,
  PerformanceMetrics,
  AggregatedPerformanceMetrics,
  GeographicDistribution,
  DemographicInsights,
  UserAnalyticsData,
  AnalyticsOptions,
  DailyAnalytics,
  WeeklyAnalytics,
  MonthlyAnalytics,
  TrendingPackageData,
  DailyAnalyticsData,
  WeeklyAnalyticsData,
  MonthlyAnalyticsData,
  DemographicData,
  GeographicRecord,
  AggregatedMetricsData,
  AnalyticsEventData,
} from '../interfaces';

@Injectable()
export class AnalyticsService {
  private readonly anonymizationFields = [
    'ipAddress',
    'email',
    'phone',
    'userId',
    'username',
  ];

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Track an upload event
   */
  async trackUpload(uploadData: {
    packageId: string;
    userId: string;
    packageSize: number;
    platform: string;
    isPublic: boolean;
  }): Promise<void> {
    return this.trackEvent({
      eventType: AnalyticsEventType.UPLOAD,
      packageId: uploadData.packageId,
      userId: uploadData.userId,
      metadata: {
        packageSize: uploadData.packageSize,
        platform: uploadData.platform,
        isPublic: uploadData.isPublic,
      },
    });
  }

  async trackEvent(event: AnalyticsEvent): Promise<void> {
    // Check if analytics is enabled
    const analyticsEnabled = this.configService.get<boolean>(
      'analytics.enabled',
      true,
    );
    if (!analyticsEnabled) {
      return;
    }

    // Check user opt-out preference if userId is provided
    if (event.userId) {
      const hasOptedOut = await this.checkUserOptOut(event.userId);
      if (hasOptedOut) {
        return;
      }
    }

    // Anonymize data if required
    const metadata = event.respectPrivacy
      ? this.anonymizeMetadata(event.metadata || {})
      : event.metadata;

    // Track the event
    const { error } = await this.supabaseService
      .getClient()
      .from('package_analytics')
      .insert({
        package_id: event.packageId,
        event_type: event.eventType,
        user_id: event.userId || null,
        metadata,
        created_at: new Date().toISOString(),
      });

    if (error) {
      throw new Error(`Failed to track analytics event: ${error.message}`);
    }

    // Also track in downloads table for download events
    if (event.eventType === AnalyticsEventType.DOWNLOAD) {
      await this.trackDownload(event.packageId, event.userId, metadata);
    }
  }

  async getPackageAnalytics(
    packageId: string,
    timeRange?: TimeRange,
    options?: AnalyticsOptions,
  ): Promise<PackageAnalyticsReport> {
    const query = this.supabaseService
      .getClient()
      .from('package_analytics')
      .select('event_type, created_at')
      .eq('package_id', packageId);

    if (timeRange) {
      query
        .gte('created_at', timeRange.start.toISOString())
        .lte('created_at', timeRange.end.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to retrieve package analytics: ${error.message}`);
    }

    // Process aggregations if requested
    let dailyBreakdown: DailyAnalytics[] | undefined;
    let weeklyBreakdown: WeeklyAnalytics[] | undefined;
    let monthlyBreakdown: MonthlyAnalytics[] | undefined;

    if (options?.aggregation) {
      switch (options.aggregation) {
        case 'daily':
          dailyBreakdown = await this.getDailyBreakdown(packageId, timeRange);
          break;
        case 'weekly':
          weeklyBreakdown = await this.getWeeklyBreakdown(packageId, timeRange);
          break;
        case 'monthly':
          monthlyBreakdown = await this.getMonthlyBreakdown(
            packageId,
            timeRange,
          );
          break;
      }
    }

    // Count events by type
    const eventCounts = this.countEventsByType(data || []);

    const totalViews = eventCounts[AnalyticsEventType.VIEW] || 0;
    const totalDownloads = eventCounts[AnalyticsEventType.DOWNLOAD] || 0;
    const totalLikes = eventCounts[AnalyticsEventType.LIKE] || 0;
    const totalShares = eventCounts[AnalyticsEventType.SHARE] || 0;

    // Calculate engagement rate
    const engagementRate = this.calculateEngagementRate(
      totalViews,
      totalDownloads,
      totalLikes,
      totalShares,
    );

    return {
      packageId,
      timeRange: timeRange || { start: new Date(0), end: new Date() },
      totalDownloads,
      totalViews,
      totalLikes,
      totalShares,
      engagementRate,
      dailyBreakdown,
      weeklyBreakdown,
      monthlyBreakdown,
    };
  }

  async getTrendingPackages(
    options: TrendingOptions,
  ): Promise<TrendingPackage[]> {
    // Call Supabase RPC function to get trending packages
    const { data, error } = await this.supabaseService
      .getClient()
      .rpc('get_trending_packages', {
        time_period: options.period,
        limit_count: options.limit || 10,
        platform_filter: options.platform || null,
        tags_filter: options.tags || null,
      });

    if (error) {
      throw new Error(`Failed to get trending packages: ${error.message}`);
    }

    // Transform and calculate momentum
    return (data || []).map((pkg: TrendingPackageData, index: number) => ({
      packageId: pkg.package_id,
      title: pkg.title,
      description: pkg.description,
      score: pkg.score,
      downloadCount: pkg.download_count,
      likeCount: pkg.like_count,
      viewCount: pkg.view_count,
      shareCount: pkg.share_count || 0,
      momentum: this.calculateMomentum(pkg),
      rank: index + 1,
    }));
  }

  async getGeographicDistribution(
    packageId: string,
  ): Promise<GeographicDistribution> {
    const privacyLevel = this.configService.get<string>(
      'analytics.geoPrivacyLevel',
      'country',
    );

    // Select fields based on privacy level
    let selectFields = 'country';
    if (privacyLevel === 'region' || privacyLevel === 'city') {
      selectFields = 'country, region';
    }
    if (privacyLevel === 'city') {
      selectFields = 'country, region, city';
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('package_downloads')
      .select(selectFields)
      .eq('package_id', packageId);

    if (error) {
      throw new Error(
        `Failed to get geographic distribution: ${error.message}`,
      );
    }

    // Process and aggregate geographic data
    const geoData = this.processGeographicData(
      (data || []) as GeographicRecord[],
      privacyLevel,
    );

    return geoData;
  }

  async getDemographicInsights(
    packageId: string,
  ): Promise<DemographicInsights> {
    const { data, error } = await this.supabaseService
      .getClient()
      .rpc('get_demographic_insights', {
        package_id: packageId,
      });

    if (error) {
      throw new Error(`Failed to get demographic insights: ${error.message}`);
    }

    if (!data) {
      return {
        platforms: [],
        ideVersions: [],
        userTiers: [],
      };
    }

    // Calculate percentages
    const totalCount = this.calculateTotalFromDemographics(data);

    const demographicData = data as DemographicData;

    return {
      platforms: (demographicData.platforms || []).map((item) => ({
        name: item.name,
        count: item.count,
        percentage: Math.round((item.count / totalCount) * 100),
      })),
      ideVersions: (demographicData.ide_versions || []).map((item) => ({
        version: item.version,
        count: item.count,
        percentage: Math.round((item.count / totalCount) * 100),
      })),
      userTiers: (demographicData.user_tiers || []).map((item) => ({
        tier: item.tier,
        count: item.count,
        percentage: Math.round((item.count / totalCount) * 100),
      })),
      languages: demographicData.languages
        ? demographicData.languages.map((item) => ({
            language: item.language,
            count: item.count,
            percentage: Math.round((item.count / totalCount) * 100),
          }))
        : undefined,
    };
  }

  async trackPerformanceMetrics(
    packageId: string,
    metrics: PerformanceMetrics,
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('performance_metrics')
      .insert({
        package_id: packageId,
        upload_speed: metrics.uploadSpeed,
        download_speed: metrics.downloadSpeed,
        package_size: metrics.packageSize,
        duration: metrics.duration,
        operation: metrics.operation,
        created_at: metrics.timestamp || new Date(),
      });

    if (error) {
      throw new Error(`Failed to track performance metrics: ${error.message}`);
    }
  }

  async getAggregatedPerformanceMetrics(
    packageId: string,
  ): Promise<AggregatedPerformanceMetrics> {
    const { data, error } = await this.supabaseService
      .getClient()
      .rpc('get_performance_metrics', {
        package_id: packageId,
      });

    if (error) {
      throw new Error(`Failed to get performance metrics: ${error.message}`);
    }

    if (!data) {
      return {
        averageUploadSpeed: 0,
        averageDownloadSpeed: 0,
        totalUploads: 0,
        totalDownloads: 0,
        p95UploadDuration: 0,
        p95DownloadDuration: 0,
      };
    }

    const metricsData = data as AggregatedMetricsData & {
      peak_hours?: Array<{ hour: number; count: number }>;
    };

    return {
      averageUploadSpeed: metricsData.avg_upload_speed || 0,
      averageDownloadSpeed: metricsData.avg_download_speed || 0,
      totalUploads: metricsData.total_uploads || 0,
      totalDownloads: metricsData.total_downloads || 0,
      p95UploadDuration: metricsData.p95_upload_duration || 0,
      p95DownloadDuration: metricsData.p95_download_duration || 0,
      peakHours: metricsData.peak_hours || undefined,
    };
  }

  async exportUserAnalyticsData(userId: string): Promise<UserAnalyticsData> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('package_analytics')
      .select('event_type, package_id, created_at, metadata')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to export user analytics data: ${error.message}`);
    }

    return {
      userId,
      events: (data || []).map((event) => ({
        eventType: event.event_type,
        packageId: event.package_id,
        createdAt: event.created_at,
        metadata: event.metadata,
      })),
      exportedAt: new Date(),
    };
  }

  async deleteUserAnalyticsData(userId: string): Promise<void> {
    // Delete from package_analytics
    const { error: analyticsError } = await this.supabaseService
      .getClient()
      .from('package_analytics')
      .delete()
      .eq('user_id', userId);

    if (analyticsError) {
      throw new Error(
        `Failed to delete user analytics data: ${analyticsError.message}`,
      );
    }

    // Delete from package_downloads
    const { error: downloadsError } = await this.supabaseService
      .getClient()
      .from('package_downloads')
      .delete()
      .eq('downloaded_by', userId);

    if (downloadsError) {
      throw new Error(
        `Failed to delete user download data: ${downloadsError.message}`,
      );
    }
  }

  async cleanupOldAnalyticsData(): Promise<void> {
    const retentionDays = this.configService.get<number>(
      'analytics.retentionDays',
      90,
    );
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Clean up package_analytics
    const { error: analyticsError } = await this.supabaseService
      .getClient()
      .from('package_analytics')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (analyticsError) {
      throw new Error(
        `Failed to cleanup old analytics data: ${analyticsError.message}`,
      );
    }

    // Clean up package_downloads
    const { error: downloadsError } = await this.supabaseService
      .getClient()
      .from('package_downloads')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (downloadsError) {
      throw new Error(
        `Failed to cleanup old download data: ${downloadsError.message}`,
      );
    }
  }

  // Private helper methods

  private async checkUserOptOut(userId: string): Promise<boolean> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('user_preferences')
      .select('analytics_opt_out')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return false; // Default to not opted out if no preference found
    }

    return data.analytics_opt_out === true;
  }

  private anonymizeMetadata(
    metadata: Record<string, unknown>,
  ): Record<string, unknown> {
    const anonymized = { ...metadata };

    // Remove sensitive fields
    this.anonymizationFields.forEach((field) => {
      delete anonymized[field];
    });

    // Hash IP address if present
    if (metadata.ipAddress && typeof metadata.ipAddress === 'string') {
      // Remove last octet for IPv4 or last segments for IPv6
      const ip = metadata.ipAddress as string;
      if (ip.includes('.')) {
        // IPv4: Keep first 3 octets
        const parts = ip.split('.');
        parts[3] = '0';
        anonymized.ipCountry = this.getCountryFromIP(parts.join('.'));
      } else if (ip.includes(':')) {
        // IPv6: Keep network prefix
        anonymized.ipCountry = this.getCountryFromIP(ip);
      }
    }

    return anonymized;
  }

  private async trackDownload(
    packageId: string,
    userId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('package_downloads')
      .insert({
        package_id: packageId,
        downloaded_by: userId || null,
        ip_address: metadata?.ipAddress || null,
        user_agent: metadata?.userAgent || null,
        download_source: metadata?.source || 'cli',
        created_at: new Date().toISOString(),
      });

    if (error) {
      // Silently fail - download tracking shouldn't fail the main operation
      // Error is already captured in the response
    }
  }

  private countEventsByType(
    events: AnalyticsEventData[],
  ): Record<string, number> {
    const counts: Record<string, number> = {};

    events.forEach((event) => {
      const type = event.event_type;
      counts[type] = (counts[type] || 0) + 1;
    });

    return counts;
  }

  private calculateEngagementRate(
    views: number,
    downloads: number,
    likes: number,
    shares: number,
  ): number {
    if (views === 0) return 0;

    const engagements = downloads + likes + shares;
    return Math.round((engagements / views) * 100) / 100;
  }

  private calculateMomentum(
    packageData: TrendingPackageData & {
      recent_downloads?: number;
      historical_avg?: number;
    },
  ): number {
    // Calculate momentum based on recent activity vs historical average
    const recentActivity = packageData.recent_downloads || 0;
    const historicalAvg = packageData.historical_avg || 1;

    return Math.round((recentActivity / historicalAvg) * 100) / 100;
  }

  private async getDailyBreakdown(
    packageId: string,
    timeRange?: TimeRange,
  ): Promise<DailyAnalytics[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .rpc('get_daily_analytics', {
        package_id: packageId,
        start_date: timeRange?.start.toISOString(),
        end_date: timeRange?.end.toISOString(),
      });

    if (error) {
      throw new Error(`Failed to get daily breakdown: ${error.message}`);
    }

    return (data || []).map((day: DailyAnalyticsData) => ({
      date: day.date,
      downloads: day.downloads || 0,
      views: day.views || 0,
      likes: day.likes || 0,
      shares: day.shares || 0,
    }));
  }

  private async getWeeklyBreakdown(
    packageId: string,
    timeRange?: TimeRange,
  ): Promise<WeeklyAnalytics[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .rpc('get_weekly_analytics', {
        package_id: packageId,
        start_date: timeRange?.start.toISOString(),
        end_date: timeRange?.end.toISOString(),
      });

    if (error) {
      throw new Error(`Failed to get weekly breakdown: ${error.message}`);
    }

    return (data || []).map((week: WeeklyAnalyticsData) => ({
      week: String(week.week),
      startDate: week.start_date,
      endDate: week.end_date,
      downloads: week.downloads || 0,
      views: week.views || 0,
      likes: week.likes || 0,
      shares: week.shares || 0,
    }));
  }

  private async getMonthlyBreakdown(
    packageId: string,
    timeRange?: TimeRange,
  ): Promise<MonthlyAnalytics[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .rpc('get_monthly_analytics', {
        package_id: packageId,
        start_date: timeRange?.start.toISOString(),
        end_date: timeRange?.end.toISOString(),
      });

    if (error) {
      throw new Error(`Failed to get monthly breakdown: ${error.message}`);
    }

    return (data || []).map((month: MonthlyAnalyticsData) => ({
      month: String(month.month),
      year: month.year,
      downloads: month.downloads || 0,
      views: month.views || 0,
      likes: month.likes || 0,
      shares: month.shares || 0,
    }));
  }

  private processGeographicData(
    data: GeographicRecord[],
    privacyLevel: string,
  ): GeographicDistribution {
    const countryMap = new Map<string, number>();
    const regionMap = new Map<string, { country: string; count: number }>();
    const cityMap = new Map<
      string,
      { region: string; country: string; count: number }
    >();

    data.forEach((record) => {
      // Country level
      if (record.country) {
        countryMap.set(
          record.country,
          (countryMap.get(record.country) || 0) + 1,
        );
      }

      // Region level
      if (privacyLevel !== 'country' && record.region) {
        const key = `${record.country}-${record.region}`;
        if (!regionMap.has(key)) {
          regionMap.set(key, { country: record.country, count: 0 });
        }
        regionMap.get(key)!.count++;
      }

      // City level
      if (privacyLevel === 'city' && record.city) {
        const key = `${record.country}-${record.region}-${record.city}`;
        if (!cityMap.has(key)) {
          cityMap.set(key, {
            region: record.region,
            country: record.country,
            count: 0,
          });
        }
        cityMap.get(key)!.count++;
      }
    });

    const totalCount = data.length;

    // Convert maps to arrays and calculate percentages
    const countries = Array.from(countryMap.entries())
      .map(([code, count]) => ({
        code,
        count,
        percentage: Math.round((count / totalCount) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    const regions =
      privacyLevel !== 'country'
        ? Array.from(regionMap.entries())
            .map(([key, data]) => ({
              region: key.split('-')[1],
              country: data.country,
              count: data.count,
              percentage: Math.round((data.count / totalCount) * 100),
            }))
            .sort((a, b) => b.count - a.count)
        : undefined;

    const cities =
      privacyLevel === 'city'
        ? Array.from(cityMap.entries())
            .map(([key, data]) => ({
              city: key.split('-')[2],
              region: data.region,
              country: data.country,
              count: data.count,
              percentage: Math.round((data.count / totalCount) * 100),
            }))
            .sort((a, b) => b.count - a.count)
        : undefined;

    return {
      countries,
      regions,
      cities,
      totalCount,
    };
  }

  private calculateTotalFromDemographics(data: DemographicData): number {
    let total = 0;

    if (data.platforms) {
      total = data.platforms.reduce(
        (sum: number, p) => sum + (p.count || 0),
        0,
      );
    } else if (data.ide_versions) {
      total = data.ide_versions.reduce(
        (sum: number, v) => sum + (v.count || 0),
        0,
      );
    } else if (data.user_tiers) {
      total = data.user_tiers.reduce(
        (sum: number, t) => sum + (t.count || 0),
        0,
      );
    }

    return total || 1; // Avoid division by zero
  }

  private getCountryFromIP(_ipAddress: string): string | undefined {
    // This would typically use a GeoIP service
    // For now, return undefined to indicate unknown country
    return undefined;
  }
}
