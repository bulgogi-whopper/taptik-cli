import { Injectable } from '@nestjs/common';

import { ErrorHandlerService } from '../../deploy/services/error-handler.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { PushError, PushErrorCode } from '../constants/push.constants';

export type UserTier = 'free' | 'pro';

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
  used: number;
  userTier: UserTier;
}

export interface BandwidthStatus {
  allowed: boolean;
  remainingBytes: number;
  usedBytes: number;
  limitBytes: number;
  resetAt: Date;
}

export interface QuotaInfo {
  uploads: RateLimitStatus;
  bandwidth: BandwidthStatus;
  message?: string;
  suggestedAction?: string;
}

@Injectable()
export class RateLimiterService {
  private readonly limits = {
    free: {
      uploads: 100, // per day
      bandwidth: 1024 * 1024 * 1024, // 1GB per day
    },
    pro: {
      uploads: 1000, // per day
      bandwidth: 10 * 1024 * 1024 * 1024, // 10GB per day
    },
  };

  private readonly RATE_LIMIT_TABLE = 'rate_limits';
  private readonly BANDWIDTH_TABLE = 'bandwidth_usage';

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly errorHandlerService: ErrorHandlerService,
  ) {}

  /**
   * Check if a user can perform an upload (combined upload and bandwidth limits)
   */
  async checkLimit(
    userId: string,
    packageSize: number,
  ): Promise<RateLimitStatus> {
    // Check upload limit
    const uploadLimit = await this.checkUploadLimit(userId);
    if (!uploadLimit.allowed) {
      return uploadLimit;
    }

    // Check bandwidth limit
    const bandwidthLimit = await this.checkBandwidthLimit(userId, packageSize);
    if (!bandwidthLimit.allowed) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: bandwidthLimit.resetAt,
        limit: uploadLimit.limit,
        used: uploadLimit.used,
        userTier: uploadLimit.userTier,
      };
    }

    return uploadLimit;
  }

  /**
   * Check if a user can perform an upload based on rate limits
   */
  async checkUploadLimit(userId: string): Promise<RateLimitStatus> {
    try {
      const userTier = await this.getUserTier(userId);
      const limit = this.limits[userTier].uploads;

      // Get today's upload count
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await this.supabaseService
        .getClient()
        .from(this.RATE_LIMIT_TABLE)
        .select('upload_count')
        .eq('user_id', userId)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found
        throw error;
      }

      const used = data?.upload_count || 0;
      const remaining = Math.max(0, limit - used);
      const allowed = remaining > 0;

      return {
        allowed,
        remaining,
        resetAt: tomorrow,
        limit,
        used,
        userTier,
      };
    } catch (_error) {
      this.errorHandlerService.handleError(
        new PushError(
          PushErrorCode.SYSTEM_ERROR,
          'Failed to check upload limit',
          _error,
          false,
        ),
      );
      // Return permissive state on error to avoid blocking users
      return {
        allowed: true,
        remaining: 100,
        resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        limit: 100,
        used: 0,
        userTier: 'free',
      };
    }
  }

  /**
   * Check bandwidth usage and limits
   */
  async checkBandwidthLimit(
    userId: string,
    fileSize: number,
  ): Promise<BandwidthStatus> {
    try {
      const userTier = await this.getUserTier(userId);
      const limitBytes = this.limits[userTier].bandwidth;

      // Get today's bandwidth usage
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await this.supabaseService
        .getClient()
        .from(this.BANDWIDTH_TABLE)
        .select('bytes_used')
        .eq('user_id', userId)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());

      if (error) {
        throw error;
      }

      const usedBytes =
        data?.reduce((sum, row) => sum + (row.bytes_used || 0), 0) || 0;
      const remainingBytes = Math.max(0, limitBytes - usedBytes);
      const allowed = remainingBytes >= fileSize;

      return {
        allowed,
        remainingBytes,
        usedBytes,
        limitBytes,
        resetAt: tomorrow,
      };
    } catch (_error) {
      this.errorHandlerService.handleError(
        new PushError(
          PushErrorCode.SYSTEM_ERROR,
          'Failed to check bandwidth limit',
          _error,
          false,
        ),
      );
      // Return permissive state on error
      return {
        allowed: true,
        remainingBytes: 1024 * 1024 * 1024,
        usedBytes: 0,
        limitBytes: 1024 * 1024 * 1024,
        resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
    }
  }

  /**
   * Check overall quota status
   */
  async checkQuota(userId: string, fileSize: number): Promise<QuotaInfo> {
    const [uploads, bandwidth] = await Promise.all([
      this.checkUploadLimit(userId),
      this.checkBandwidthLimit(userId, fileSize),
    ]);

    let message: string | undefined;
    let suggestedAction: string | undefined;

    if (!uploads.allowed) {
      message = `Daily upload limit reached (${uploads.limit} uploads)`;
      suggestedAction =
        uploads.userTier === 'free'
          ? 'Upgrade to Pro for 1000 daily uploads'
          : `Limit resets at ${uploads.resetAt.toLocaleTimeString()}`;
    } else if (!bandwidth.allowed) {
      message = `Bandwidth limit exceeded (${this.formatBytes(bandwidth.limitBytes)} daily limit)`;
      suggestedAction =
        uploads.userTier === 'free'
          ? 'Upgrade to Pro for 10GB daily bandwidth'
          : `Limit resets at ${bandwidth.resetAt.toLocaleTimeString()}`;
    } else if (uploads.remaining <= 10) {
      message = `Only ${uploads.remaining} uploads remaining today`;
      suggestedAction = 'Consider spacing out your uploads';
    } else if (bandwidth.remainingBytes < fileSize * 2) {
      message = `Low bandwidth remaining (${this.formatBytes(bandwidth.remainingBytes)})`;
      suggestedAction = 'Consider uploading smaller packages';
    }

    return {
      uploads,
      bandwidth,
      message,
      suggestedAction,
    };
  }

  /**
   * Record an upload for rate limiting
   */
  async recordUpload(userId: string, fileSize: number): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Update or insert upload count
      const { error: uploadError } = await this.supabaseService
        .getClient()
        .rpc('increment_upload_count', {
          p_user_id: userId,
          p_date_start: today.toISOString(),
          p_date_end: tomorrow.toISOString(),
        });

      if (uploadError) {
        // Log error but don't throw - we don't want to block uploads
        this.errorHandlerService.handleError(
          new PushError(
            PushErrorCode.SYSTEM_ERROR,
            'Failed to record upload count',
            uploadError,
            false,
          ),
        );
      }

      // Record bandwidth usage
      const { error: bandwidthError } = await this.supabaseService
        .getClient()
        .from(this.BANDWIDTH_TABLE)
        .insert({
          user_id: userId,
          bytes_used: fileSize,
          created_at: new Date().toISOString(),
        });

      if (bandwidthError) {
        // Log error but don't throw - we don't want to block uploads
        this.errorHandlerService.handleError(
          new PushError(
            PushErrorCode.SYSTEM_ERROR,
            'Failed to record bandwidth usage',
            bandwidthError,
            false,
          ),
        );
      }
    } catch (_error) {
      // Don't throw here - we don't want to block uploads due to tracking failures
      this.errorHandlerService.handleError(
        new PushError(
          PushErrorCode.SYSTEM_ERROR,
          'Failed to record upload metrics',
          _error,
          false,
        ),
      );
    }
  }

  /**
   * Get approaching limit warnings
   */
  async getApproachingLimitWarnings(userId: string): Promise<string[]> {
    const warnings: string[] = [];

    try {
      const uploadStatus = await this.checkUploadLimit(userId);
      const bandwidthStatus = await this.checkBandwidthLimit(userId, 0);

      // Warn when 80% of limit is reached
      if (uploadStatus.used >= uploadStatus.limit * 0.8) {
        warnings.push(
          `⚠️ You've used ${uploadStatus.used}/${uploadStatus.limit} uploads today (${Math.round((uploadStatus.used / uploadStatus.limit) * 100)}%)`,
        );
      }

      if (bandwidthStatus.usedBytes >= bandwidthStatus.limitBytes * 0.8) {
        warnings.push(
          `⚠️ You've used ${this.formatBytes(bandwidthStatus.usedBytes)}/${this.formatBytes(bandwidthStatus.limitBytes)} bandwidth today (${Math.round((bandwidthStatus.usedBytes / bandwidthStatus.limitBytes) * 100)}%)`,
        );
      }

      // Warn when less than 10 uploads remaining
      if (uploadStatus.remaining > 0 && uploadStatus.remaining <= 10) {
        warnings.push(`📊 ${uploadStatus.remaining} uploads remaining today`);
      }

      // Warn when less than 100MB bandwidth remaining
      if (
        bandwidthStatus.remainingBytes > 0 &&
        bandwidthStatus.remainingBytes <= 100 * 1024 * 1024
      ) {
        warnings.push(
          `📊 ${this.formatBytes(bandwidthStatus.remainingBytes)} bandwidth remaining today`,
        );
      }
    } catch (_error) {
      // Silently fail for warnings - don't block the operation
      // Error is already handled in checkUploadLimit/checkBandwidthLimit
    }

    return warnings;
  }

  /**
   * Implement graceful degradation when approaching limits
   */
  async implementGracefulDegradation(
    userId: string,
    fileSize: number,
  ): Promise<{
    shouldThrottle: boolean;
    throttleDelayMs: number;
    message?: string;
  }> {
    try {
      const quota = await this.checkQuota(userId, fileSize);

      // Calculate usage percentages
      const uploadUsagePercent =
        (quota.uploads.used / quota.uploads.limit) * 100;
      const bandwidthUsagePercent =
        (quota.bandwidth.usedBytes / quota.bandwidth.limitBytes) * 100;

      let shouldThrottle = false;
      let throttleDelayMs = 0;
      let message: string | undefined;

      // Progressive throttling based on usage
      if (uploadUsagePercent >= 90 || bandwidthUsagePercent >= 90) {
        shouldThrottle = true;
        throttleDelayMs = 5000; // 5 second delay
        message = 'Approaching limits - adding delay to preserve quota';
      } else if (uploadUsagePercent >= 80 || bandwidthUsagePercent >= 80) {
        shouldThrottle = true;
        throttleDelayMs = 2000; // 2 second delay
        message = 'High usage detected - slight delay added';
      } else if (uploadUsagePercent >= 70 || bandwidthUsagePercent >= 70) {
        shouldThrottle = true;
        throttleDelayMs = 1000; // 1 second delay
      }

      return {
        shouldThrottle,
        throttleDelayMs,
        message,
      };
    } catch (_error) {
      // Don't throttle on error
      return {
        shouldThrottle: false,
        throttleDelayMs: 0,
      };
    }
  }

  /**
   * Reset expired limits (for cleanup job)
   */
  async cleanupExpiredLimits(): Promise<void> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // Clean up old rate limit records
      const { error: rateLimitError } = await this.supabaseService
        .getClient()
        .from(this.RATE_LIMIT_TABLE)
        .delete()
        .lt('created_at', yesterday.toISOString());

      if (rateLimitError) {
        // Log but don't throw - cleanup is non-critical
        this.errorHandlerService.handleError(
          new PushError(
            PushErrorCode.SYSTEM_ERROR,
            'Failed to clean up rate limits',
            rateLimitError,
            false,
          ),
        );
      }

      // Clean up old bandwidth records (keep 7 days for analytics)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { error: bandwidthError } = await this.supabaseService
        .getClient()
        .from(this.BANDWIDTH_TABLE)
        .delete()
        .lt('created_at', weekAgo.toISOString());

      if (bandwidthError) {
        // Log but don't throw - cleanup is non-critical
        this.errorHandlerService.handleError(
          new PushError(
            PushErrorCode.SYSTEM_ERROR,
            'Failed to clean up bandwidth records',
            bandwidthError,
            false,
          ),
        );
      }
    } catch (_error) {
      // Log but don't throw - cleanup is non-critical
      this.errorHandlerService.handleError(
        new PushError(
          PushErrorCode.SYSTEM_ERROR,
          'Failed to cleanup expired limits',
          _error,
          false,
        ),
      );
    }
  }

  /**
   * Get user tier from profile or subscription
   */
  private async getUserTier(userId: string): Promise<UserTier> {
    try {
      // Check user subscription status
      const { data, error } = await this.supabaseService
        .getClient()
        .from('user_subscriptions')
        .select('tier')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (error || !data) {
        return 'free';
      }

      return data.tier === 'pro' ? 'pro' : 'free';
    } catch (_error) {
      // Default to free tier on error
      return 'free';
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}
