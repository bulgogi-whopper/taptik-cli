import { vi, describe, it, expect, beforeEach } from 'vitest';

import { RateLimiterService } from './rate-limiter.service';

// Helper to create chainable mock query
const createChainableMock = (result: any) => {
  const mock: any = {
    select: vi.fn(() => mock),
    eq: vi.fn(() => mock),
    gte: vi.fn(() => mock),
    lt: vi.fn(() => mock),
    single: vi.fn().mockResolvedValue(result),
  };
  return mock;
};

describe('RateLimiterService', () => {
  let service: RateLimiterService;
  let mockSupabaseService: {
    getClient: ReturnType<typeof vi.fn>;
  };
  let mockErrorHandlerService: {
    handleError: ReturnType<typeof vi.fn>;
  };
  let mockSupabaseClient: {
    from: ReturnType<typeof vi.fn>;
    rpc: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockSupabaseClient = {
      from: vi.fn(),
      rpc: vi.fn(),
    };

    mockSupabaseService = {
      getClient: vi.fn(() => mockSupabaseClient),
    };

    mockErrorHandlerService = {
      handleError: vi.fn(),
    };

    // Create service directly with dependencies
    service = new RateLimiterService(
      mockSupabaseService as any,
      mockErrorHandlerService as any,
    );
  });

  describe('checkUploadLimit', () => {
    it('should allow upload when under limit for free tier', async () => {
      const userId = 'test-user-id';

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_subscriptions') {
          return createChainableMock({
            data: null,
            error: { code: 'PGRST116' },
          });
        }
        return createChainableMock({
          data: { upload_count: 50 },
          error: null,
        });
      });

      const result = await service.checkUploadLimit(userId);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(50);
      expect(result.limit).toBe(100);
      expect(result.used).toBe(50);
      expect(result.userTier).toBe('free');
    });

    it('should deny upload when limit reached for free tier', async () => {
      const userId = 'test-user-id';
      const mockRateLimitQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { upload_count: 100 },
          error: null,
        }),
      };

      const mockSubscriptionQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_subscriptions') {
          return mockSubscriptionQuery as any;
        }
        return mockRateLimitQuery as any;
      });

      const result = await service.checkUploadLimit(userId);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.limit).toBe(100);
      expect(result.used).toBe(100);
      expect(result.userTier).toBe('free');
    });

    it('should allow more uploads for pro tier', async () => {
      const userId = 'test-user-id';
      const mockRateLimitQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { upload_count: 500 },
          error: null,
        }),
      };

      const mockSubscriptionQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { tier: 'pro' },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_subscriptions') {
          return mockSubscriptionQuery as any;
        }
        return mockRateLimitQuery as any;
      });

      const result = await service.checkUploadLimit(userId);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(500);
      expect(result.limit).toBe(1000);
      expect(result.used).toBe(500);
      expect(result.userTier).toBe('pro');
    });

    it('should return permissive state on database error', async () => {
      const userId = 'test-user-id';
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        single: vi.fn().mockRejectedValue(new Error('Database error')),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery as any);

      const result = await service.checkUploadLimit(userId);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(100);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });

    it('should handle no existing rate limit record', async () => {
      const userId = 'test-user-id';
      const mockRateLimitQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      const mockSubscriptionQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_subscriptions') {
          return mockSubscriptionQuery as any;
        }
        return mockRateLimitQuery as any;
      });

      const result = await service.checkUploadLimit(userId);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(100);
      expect(result.used).toBe(0);
      expect(result.userTier).toBe('free');
    });
  });

  describe('checkBandwidthLimit', () => {
    it('should allow upload when bandwidth available', async () => {
      const userId = 'test-user-id';
      const fileSize = 50 * 1024 * 1024; // 50MB

      const mockBandwidthQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        mockResolvedValue: vi.fn().mockResolvedValue({
          data: [
            { bytes_used: 100 * 1024 * 1024 },
            { bytes_used: 200 * 1024 * 1024 },
          ],
          error: null,
        }),
      };

      const mockSubscriptionQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_subscriptions') {
          return mockSubscriptionQuery as any;
        }
        const query = mockBandwidthQuery;
        // Chain the methods and return the resolved value at the end
        return {
          ...query,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lt: vi.fn().mockResolvedValue({
            data: [
              { bytes_used: 100 * 1024 * 1024 },
              { bytes_used: 200 * 1024 * 1024 },
            ],
            error: null,
          }),
        } as any;
      });

      const result = await service.checkBandwidthLimit(userId, fileSize);

      expect(result.allowed).toBe(true);
      expect(result.usedBytes).toBe(300 * 1024 * 1024);
      expect(result.remainingBytes).toBe(724 * 1024 * 1024); // ~724MB remaining
      expect(result.limitBytes).toBe(1024 * 1024 * 1024);
    });

    it('should deny upload when bandwidth exceeded', async () => {
      const userId = 'test-user-id';
      const fileSize = 100 * 1024 * 1024; // 100MB

      const mockBandwidthQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({
          data: [
            { bytes_used: 500 * 1024 * 1024 },
            { bytes_used: 500 * 1024 * 1024 },
          ],
          error: null,
        }),
      };

      const mockSubscriptionQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_subscriptions') {
          return mockSubscriptionQuery as any;
        }
        return mockBandwidthQuery as any;
      });

      const result = await service.checkBandwidthLimit(userId, fileSize);

      expect(result.allowed).toBe(false);
      expect(result.usedBytes).toBe(1000 * 1024 * 1024);
      expect(result.remainingBytes).toBe(24 * 1024 * 1024); // 24MB remaining
    });

    it('should handle pro tier bandwidth limits', async () => {
      const userId = 'test-user-id';
      const fileSize = 1024 * 1024 * 1024; // 1GB

      const mockBandwidthQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({
          data: [{ bytes_used: 2 * 1024 * 1024 * 1024 }],
          error: null,
        }),
      };

      const mockSubscriptionQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { tier: 'pro' },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_subscriptions') {
          return mockSubscriptionQuery as any;
        }
        return mockBandwidthQuery as any;
      });

      const result = await service.checkBandwidthLimit(userId, fileSize);

      expect(result.allowed).toBe(true);
      expect(result.limitBytes).toBe(10 * 1024 * 1024 * 1024); // 10GB for pro
    });

    it('should return permissive state on error', async () => {
      const userId = 'test-user-id';
      const fileSize = 50 * 1024 * 1024;

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockRejectedValue(new Error('Database error')),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery as any);

      const result = await service.checkBandwidthLimit(userId, fileSize);

      expect(result.allowed).toBe(true);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('checkQuota', () => {
    it('should return combined quota information', async () => {
      const userId = 'test-user-id';
      const fileSize = 50 * 1024 * 1024;

      // Mock successful checks
      const mockRateLimitQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { upload_count: 95 },
          error: null,
        }),
      };

      const mockBandwidthQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      const mockSubscriptionQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_subscriptions') {
          return mockSubscriptionQuery as any;
        }
        if (table === 'rate_limits') {
          return mockRateLimitQuery as any;
        }
        return mockBandwidthQuery as any;
      });

      const result = await service.checkQuota(userId, fileSize);

      expect(result.uploads.allowed).toBe(true);
      expect(result.uploads.remaining).toBe(5);
      expect(result.bandwidth.allowed).toBe(true);
      expect(result.message).toBe('Only 5 uploads remaining today');
      expect(result.suggestedAction).toBe('Consider spacing out your uploads');
    });

    it('should provide upload limit reached message', async () => {
      const userId = 'test-user-id';
      const fileSize = 50 * 1024 * 1024;

      const mockRateLimitQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { upload_count: 100 },
          error: null,
        }),
      };

      const mockBandwidthQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      const mockSubscriptionQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_subscriptions') {
          return mockSubscriptionQuery as any;
        }
        if (table === 'rate_limits') {
          return mockRateLimitQuery as any;
        }
        return mockBandwidthQuery as any;
      });

      const result = await service.checkQuota(userId, fileSize);

      expect(result.uploads.allowed).toBe(false);
      expect(result.message).toBe('Daily upload limit reached (100 uploads)');
      expect(result.suggestedAction).toBe(
        'Upgrade to Pro for 1000 daily uploads',
      );
    });

    it('should provide bandwidth exceeded message', async () => {
      const userId = 'test-user-id';
      const fileSize = 200 * 1024 * 1024;

      const mockRateLimitQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { upload_count: 10 },
          error: null,
        }),
      };

      const mockBandwidthQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({
          data: [{ bytes_used: 900 * 1024 * 1024 }],
          error: null,
        }),
      };

      const mockSubscriptionQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_subscriptions') {
          return mockSubscriptionQuery as any;
        }
        if (table === 'rate_limits') {
          return mockRateLimitQuery as any;
        }
        return mockBandwidthQuery as any;
      });

      const result = await service.checkQuota(userId, fileSize);

      expect(result.bandwidth.allowed).toBe(false);
      expect(result.message).toBe(
        'Bandwidth limit exceeded (1 GB daily limit)',
      );
      expect(result.suggestedAction).toBe(
        'Upgrade to Pro for 10GB daily bandwidth',
      );
    });
  });

  describe('recordUpload', () => {
    it('should record upload metrics successfully', async () => {
      const userId = 'test-user-id';
      const fileSize = 50 * 1024 * 1024;

      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: null,
      });

      const mockInsert = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        insert: mockInsert,
      } as any);

      await service.recordUpload(userId, fileSize);

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'increment_upload_count',
        expect.objectContaining({
          p_user_id: userId,
        }),
      );
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          bytes_used: fileSize,
        }),
      );
    });

    it('should not throw on recording errors', async () => {
      const userId = 'test-user-id';
      const fileSize = 50 * 1024 * 1024;

      mockSupabaseClient.rpc.mockRejectedValue(new Error('RPC error'));
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockRejectedValue(new Error('Insert error')),
      } as any);

      await expect(
        service.recordUpload(userId, fileSize),
      ).resolves.not.toThrow();
      // Errors are now handled with errorHandlerService
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('getApproachingLimitWarnings', () => {
    it('should return warnings when approaching limits', async () => {
      const userId = 'test-user-id';

      const mockRateLimitQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { upload_count: 85 },
          error: null,
        }),
      };

      const mockBandwidthQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({
          data: [{ bytes_used: 850 * 1024 * 1024 }],
          error: null,
        }),
      };

      const mockSubscriptionQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_subscriptions') {
          return mockSubscriptionQuery as any;
        }
        if (table === 'rate_limits') {
          return mockRateLimitQuery as any;
        }
        return mockBandwidthQuery as any;
      });

      const warnings = await service.getApproachingLimitWarnings(userId);

      expect(warnings).toHaveLength(2);
      expect(warnings[0]).toContain('85/100 uploads');
      expect(warnings[1]).toContain('bandwidth');
    });

    it('should return warning for low remaining uploads', async () => {
      const userId = 'test-user-id';

      const mockRateLimitQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { upload_count: 95 },
          error: null,
        }),
      };

      const mockBandwidthQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      const mockSubscriptionQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_subscriptions') {
          return mockSubscriptionQuery as any;
        }
        if (table === 'rate_limits') {
          return mockRateLimitQuery as any;
        }
        return mockBandwidthQuery as any;
      });

      const warnings = await service.getApproachingLimitWarnings(userId);

      expect(warnings).toContain("⚠️ You've used 95/100 uploads today (95%)");
      expect(warnings).toContain('📊 5 uploads remaining today');
    });

    it('should handle errors gracefully', async () => {
      const userId = 'test-user-id';

      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Database error');
      });

      const warnings = await service.getApproachingLimitWarnings(userId);

      expect(warnings).toEqual([]);
      // Errors are handled in checkUploadLimit/checkBandwidthLimit with errorHandlerService
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('implementGracefulDegradation', () => {
    it('should throttle heavily when usage is above 90%', async () => {
      const userId = 'test-user-id';
      const fileSize = 50 * 1024 * 1024;

      const mockRateLimitQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { upload_count: 92 },
          error: null,
        }),
      };

      const mockBandwidthQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      const mockSubscriptionQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_subscriptions') {
          return mockSubscriptionQuery as any;
        }
        if (table === 'rate_limits') {
          return mockRateLimitQuery as any;
        }
        return mockBandwidthQuery as any;
      });

      const result = await service.implementGracefulDegradation(
        userId,
        fileSize,
      );

      expect(result.shouldThrottle).toBe(true);
      expect(result.throttleDelayMs).toBe(5000);
      expect(result.message).toBe(
        'Approaching limits - adding delay to preserve quota',
      );
    });

    it('should throttle moderately when usage is above 80%', async () => {
      const userId = 'test-user-id';
      const fileSize = 50 * 1024 * 1024;

      const mockRateLimitQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { upload_count: 82 },
          error: null,
        }),
      };

      const mockBandwidthQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      const mockSubscriptionQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_subscriptions') {
          return mockSubscriptionQuery as any;
        }
        if (table === 'rate_limits') {
          return mockRateLimitQuery as any;
        }
        return mockBandwidthQuery as any;
      });

      const result = await service.implementGracefulDegradation(
        userId,
        fileSize,
      );

      expect(result.shouldThrottle).toBe(true);
      expect(result.throttleDelayMs).toBe(2000);
      expect(result.message).toBe('High usage detected - slight delay added');
    });

    it('should not throttle when usage is low', async () => {
      const userId = 'test-user-id';
      const fileSize = 50 * 1024 * 1024;

      const mockRateLimitQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { upload_count: 30 },
          error: null,
        }),
      };

      const mockBandwidthQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      const mockSubscriptionQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_subscriptions') {
          return mockSubscriptionQuery as any;
        }
        if (table === 'rate_limits') {
          return mockRateLimitQuery as any;
        }
        return mockBandwidthQuery as any;
      });

      const result = await service.implementGracefulDegradation(
        userId,
        fileSize,
      );

      expect(result.shouldThrottle).toBe(false);
      expect(result.throttleDelayMs).toBe(0);
      expect(result.message).toBeUndefined();
    });

    it('should not throttle on error', async () => {
      const userId = 'test-user-id';
      const fileSize = 50 * 1024 * 1024;

      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await service.implementGracefulDegradation(
        userId,
        fileSize,
      );

      expect(result.shouldThrottle).toBe(false);
      expect(result.throttleDelayMs).toBe(0);
    });
  });

  describe('cleanupExpiredLimits', () => {
    it('should cleanup old rate limit and bandwidth records', async () => {
      const mockDelete = vi.fn().mockReturnThis();
      const mockLt = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        delete: mockDelete,
        lt: mockLt,
      } as any);

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await service.cleanupExpiredLimits();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('rate_limits');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('bandwidth_usage');
      expect(mockDelete).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });

    it('should handle cleanup errors gracefully', async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(service.cleanupExpiredLimits()).resolves.not.toThrow();
      // Errors are now handled with errorHandlerService
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });
});
