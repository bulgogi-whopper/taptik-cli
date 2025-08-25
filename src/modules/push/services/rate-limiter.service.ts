import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { RATE_LIMITS } from '../constants/push.constants';

export type UserTier = 'free' | 'pro';

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  tier: UserTier;
}

@Injectable()
export class RateLimiterService {
  private readonly limits = RATE_LIMITS;

  constructor(private readonly supabaseService: SupabaseService) {}

  async checkLimit(
    userId: string,
    _size: number,
  ): Promise<RateLimitStatus> {
    // TODO: Implementation using Supabase or Redis
    // Check upload count and bandwidth usage
    const tier = await this.getUserTier(userId);
    const limits = this.limits[tier === 'pro' ? 'PRO_TIER' : 'FREE_TIER'];

    return {
      allowed: true,
      remaining: limits.UPLOADS_PER_DAY,
      resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      tier,
    };
  }

  async incrementUsage(
    _userId: string,
    _size: number,
  ): Promise<void> {
    // TODO: Increment upload count and bandwidth usage
    throw new Error('Method not implemented.');
  }

  async getUserTier(_userId: string): Promise<UserTier> {
    // TODO: Get user tier from database
    return 'free';
  }
}