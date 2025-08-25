export enum AnalyticsEventType {
  DOWNLOAD = 'download',
  VIEW = 'view',
  LIKE = 'like',
  SHARE = 'share',
  UPLOAD = 'upload',
  DELETE = 'delete',
  UPDATE = 'update',
}

export interface AnalyticsEvent {
  packageId: string;
  eventType: AnalyticsEventType;
  userId?: string;
  metadata?: Record<string, unknown>;
  respectPrivacy?: boolean;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface PackageAnalyticsReport {
  packageId: string;
  timeRange: TimeRange;
  totalDownloads: number;
  totalViews: number;
  totalLikes: number;
  totalShares: number;
  engagementRate: number;
  dailyBreakdown?: DailyAnalytics[];
  weeklyBreakdown?: WeeklyAnalytics[];
  monthlyBreakdown?: MonthlyAnalytics[];
}

export interface DailyAnalytics {
  date: string;
  downloads: number;
  views: number;
  likes: number;
  shares: number;
}

export interface WeeklyAnalytics {
  week: string;
  startDate: string;
  endDate: string;
  downloads: number;
  views: number;
  likes: number;
  shares: number;
}

export interface MonthlyAnalytics {
  month: string;
  year: number;
  downloads: number;
  views: number;
  likes: number;
  shares: number;
}

export interface TrendingPackage {
  packageId: string;
  title: string;
  description?: string;
  score: number;
  downloadCount: number;
  likeCount: number;
  viewCount: number;
  shareCount: number;
  momentum: number; // Rate of growth
  rank: number;
}

export interface TrendingOptions {
  period: 'day' | 'week' | 'month';
  limit?: number;
  platform?: string;
  tags?: string[];
}

export interface PerformanceMetrics {
  uploadSpeed: number; // MB/s
  downloadSpeed: number; // MB/s
  packageSize: number; // bytes
  duration: number; // milliseconds
  operation: 'upload' | 'download';
  timestamp?: Date;
}

export interface AggregatedPerformanceMetrics {
  averageUploadSpeed: number;
  averageDownloadSpeed: number;
  totalUploads: number;
  totalDownloads: number;
  p95UploadDuration: number;
  p95DownloadDuration: number;
  peakHours?: Array<{ hour: number; count: number }>;
}

export interface GeographicDistribution {
  countries: Array<{
    code: string;
    name?: string;
    count: number;
    percentage: number;
  }>;
  regions?: Array<{
    region: string;
    country: string;
    count: number;
    percentage: number;
  }>;
  cities?: Array<{
    city: string;
    region: string;
    country: string;
    count: number;
    percentage: number;
  }>;
  totalCount: number;
}

export interface DemographicInsights {
  platforms: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
  ideVersions: Array<{
    version: string;
    count: number;
    percentage: number;
  }>;
  userTiers: Array<{
    tier: string;
    count: number;
    percentage: number;
  }>;
  languages?: Array<{
    language: string;
    count: number;
    percentage: number;
  }>;
}

export interface UserAnalyticsData {
  userId: string;
  events: Array<{
    eventType: string;
    packageId: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
  }>;
  exportedAt: Date;
}

export interface AnalyticsOptions {
  aggregation?: 'hourly' | 'daily' | 'weekly' | 'monthly';
  includeAnonymous?: boolean;
  respectPrivacy?: boolean;
}

export interface AnalyticsConfig {
  enabled: boolean;
  anonymizeData: boolean;
  retentionDays: number;
  geoPrivacyLevel?: 'country' | 'region' | 'city';
  trackingConsent?: boolean;
}

// Database response types for type-safe data handling
export interface TrendingPackageData {
  package_id: string;
  title: string;
  description?: string;
  score: number;
  download_count: number;
  like_count: number;
  view_count: number;
  share_count?: number;
}

export interface DailyAnalyticsData {
  date: string;
  downloads: number;
  views: number;
  likes: number;
  shares: number;
}

export interface WeeklyAnalyticsData {
  week: number;
  start_date: string;
  end_date: string;
  downloads: number;
  views: number;
  likes: number;
  shares: number;
}

export interface MonthlyAnalyticsData {
  month: number;
  year: number;
  downloads: number;
  views: number;
  likes: number;
  shares: number;
}

export interface DemographicData {
  platforms?: Array<{ name: string; count: number }>;
  ide_versions?: Array<{ version: string; count: number }>;
  user_tiers?: Array<{ tier: string; count: number }>;
  languages?: Array<{ language: string; count: number }>;
}

export interface GeographicRecord {
  country?: string;
  region?: string;
  city?: string;
}

export interface AggregatedMetricsData {
  avg_upload_speed: number;
  avg_download_speed: number;
  total_uploads: number;
  total_downloads: number;
  p95_upload_duration: number;
  p95_download_duration: number;
}

export interface AnalyticsEventData {
  event_type: string;
  created_at: string;
  package_id?: string;
}
