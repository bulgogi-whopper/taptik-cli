import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { AuthModule } from '../../auth/auth.module';
import { DeployCoreModule } from '../../deploy/core/deploy-core.module';
import { SupabaseModule } from '../../supabase/supabase.module';
import { PackageVisibility } from '../interfaces';
import { PushModule } from '../push.module';
import { AnalyticsService } from '../services/analytics.service';
import { CloudUploadService } from '../services/cloud-upload.service';
import { LocalQueueService } from '../services/local-queue.service';
import { PackageRegistryService } from '../services/package-registry.service';
import { PushService } from '../services/push.service';
import { RateLimiterService } from '../services/rate-limiter.service';

describe('Push Module Integration Tests', () => {
  let module: TestingModule;
  let pushService: PushService;
  let packageRegistry: PackageRegistryService;
  let localQueue: LocalQueueService;
  let analytics: AnalyticsService;
  let rateLimiter: RateLimiterService;
  let tempDir: string;

  beforeEach(async () => {
    // Create temp directory for test files
    tempDir = path.join(os.tmpdir(), 'taptik-integration-test', Date.now().toString());
    await fs.mkdir(tempDir, { recursive: true });

    module = await Test.createTestingModule({
      imports: [PushModule, SupabaseModule, AuthModule, DeployCoreModule],
    }).compile();

    pushService = module.get<PushService>(PushService);
    packageRegistry = module.get<PackageRegistryService>(PackageRegistryService);
    localQueue = module.get<LocalQueueService>(LocalQueueService);
    analytics = module.get<AnalyticsService>(AnalyticsService);
    rateLimiter = module.get<RateLimiterService>(RateLimiterService);

    // Mock auth service
    const authService = module.get('AuthService');
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      user: {
        id: 'test-user',
        email: 'test@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      accessToken: 'test-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 3600000),
    });

    // Mock Supabase client
    const supabaseService = module.get('SupabaseService');
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'test-user',
              email: 'test@example.com',
              user_metadata: { tier: 'free' },
            },
          },
          error: null,
        }),
      },
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({
            data: { path: 'test-path' },
            error: null,
          }),
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: 'https://signed-url.com' },
            error: null,
          }),
        }),
      },
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: [], error: null }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
        update: vi.fn().mockResolvedValue({ data: [], error: null }),
        delete: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    };
    vi.spyOn(supabaseService, 'getClient').mockReturnValue(mockClient as any);
  });

  afterEach(async () => {
    await module?.close();
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  });

  describe('Upload Flow', () => {
    it('should complete full upload flow with validation and sanitization', async () => {
      const packagePath = path.join(tempDir, 'test.taptik');
      const packageContent = JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
        platform: 'claude-code',
        content: {
          settings: { theme: 'dark' },
        },
      });
      await fs.writeFile(packagePath, packageContent);

      const result = await pushService.pushPackage({
        file: {
          buffer: Buffer.from(packageContent),
          name: 'test.taptik',
          size: Buffer.byteLength(packageContent),
          path: packagePath,
        },
        visibility: PackageVisibility.Private,
        title: 'Test Package',
        tags: ['test'],
        version: '1.0.0',
        force: false,
        dryRun: false,
      });

      expect(result.success).toBe(true);
      expect(result.packageId).toBeDefined();
      expect(result.message).toContain('successfully');
    });

    it('should handle rate limiting correctly', async () => {
      // Check initial limits
      const limits = await rateLimiter.checkUploadLimit('test-user');
      expect(limits.allowed).toBe(true);
      expect(limits.remaining).toBeGreaterThan(0);
      expect(limits.limit).toBe(100); // Free tier limit

      // Track an upload
      await rateLimiter.recordUpload('test-user', 1024 * 1024);

      // Check updated limits
      const updatedLimits = await rateLimiter.checkUploadLimit('test-user');
      expect(updatedLimits.used).toBe(1);
    });

    it('should queue uploads when offline', async () => {
      const packagePath = path.join(tempDir, 'test.taptik');
      await fs.writeFile(packagePath, 'package content');

      // Add to queue
      await localQueue.addToQueue(packagePath, {
        visibility: PackageVisibility.Public,
        title: 'Offline Package',
        tags: ['offline'],
      });

      // Check queue status
      const status = await localQueue.getQueueStatus();
      expect(status.pending).toBeGreaterThan(0);
      expect(status.total).toBeGreaterThan(0);
    });
  });

  describe('Package Management', () => {
    it('should list user packages with filtering', async () => {
      const packages = await packageRegistry.listUserPackages('test-user', {
        platform: 'claude-code',
        visibility: 'public',
        limit: 10,
      });

      expect(Array.isArray(packages)).toBe(true);
    });

    it('should update package metadata', async () => {
      const mockPackage = {
        id: 'pkg-123',
        configId: 'config-123',
        userId: 'test-user',
        name: 'test-package',
        title: 'Original Title',
        description: 'Original description',
        userTags: ['original'],
      };

      // Mock the get and update operations
      const supabaseService = module.get('SupabaseService');
      const mockClient = supabaseService.getClient();
      
      vi.spyOn(mockClient.from('taptik_packages'), 'select').mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockPackage,
            error: null,
          }),
        }),
      } as any);

      vi.spyOn(mockClient.from('taptik_packages'), 'update').mockResolvedValue({
        data: { ...mockPackage, title: 'Updated Title' },
        error: null,
      } as any);

      await packageRegistry.updatePackage('config-123', {
        title: 'Updated Title',
        description: 'Updated description',
        userTags: ['updated'],
      });

      expect(mockClient.from('taptik_packages').update).toHaveBeenCalled();
    });

    it('should track analytics events', async () => {
      const trackSpy = vi.spyOn(analytics, 'trackEvent');
      
      await analytics.trackEvent('test-user', {
        type: 'package_upload',
        packageId: 'pkg-123',
        metadata: {
          size: 1024,
          platform: 'claude-code',
        },
      });

      expect(trackSpy).toHaveBeenCalledWith('test-user', expect.objectContaining({
        type: 'package_upload',
        packageId: 'pkg-123',
      }));

      // Get analytics summary
      const summary = await analytics.getAnalyticsSummary('pkg-123');
      expect(summary).toBeDefined();
      expect(summary.totalDownloads).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle network failures gracefully', async () => {
      const cloudUpload = module.get<CloudUploadService>(CloudUploadService);
      
      // Mock network failure
      vi.spyOn(cloudUpload, 'uploadPackage').mockRejectedValue(
        new Error('Network timeout')
      );

      const packagePath = path.join(tempDir, 'test.taptik');
      await fs.writeFile(packagePath, 'package content');

      const result = await pushService.pushPackage({
        file: {
          buffer: Buffer.from('package content'),
          name: 'test.taptik',
          size: 15,
          path: packagePath,
        },
        visibility: PackageVisibility.Private,
        title: 'Test Package',
        tags: [],
        version: '1.0.0',
        force: false,
        dryRun: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Network timeout');
    });

    it('should validate package size limits', async () => {
      const largeBuffer = Buffer.alloc(101 * 1024 * 1024); // 101MB for free tier
      
      const result = await pushService.pushPackage({
        file: {
          buffer: largeBuffer,
          name: 'large.taptik',
          size: largeBuffer.length,
          path: '/path/to/large.taptik',
        },
        visibility: PackageVisibility.Private,
        title: 'Large Package',
        tags: [],
        version: '1.0.0',
        force: false,
        dryRun: false,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toContain('TOO_LARGE');
    });
  });

  describe('Security', () => {
    it('should sanitize sensitive data from packages', async () => {
      const packageWithSecrets = JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
        platform: 'claude-code',
        content: {
          settings: {
            apiKey: 'sk-secret-key-12345',
            password: 'my-password',
            token: 'ghp_github_token',
            email: 'user@example.com',
          },
        },
      });

      const packagePath = path.join(tempDir, 'secrets.taptik');
      await fs.writeFile(packagePath, packageWithSecrets);

      const result = await pushService.pushPackage({
        file: {
          buffer: Buffer.from(packageWithSecrets),
          name: 'secrets.taptik',
          size: Buffer.byteLength(packageWithSecrets),
          path: packagePath,
        },
        visibility: PackageVisibility.Private,
        title: 'Package with Secrets',
        tags: [],
        version: '1.0.0',
        force: false,
        dryRun: false,
      });

      expect(result.sanitizationReport).toBeDefined();
      expect(result.sanitizationReport?.removedCount).toBeGreaterThan(0);
    });

    it('should enforce authentication', async () => {
      // Mock no session
      const authService = module.get('AuthService');
      vi.spyOn(authService, 'getSession').mockResolvedValue(null);

      const result = await pushService.pushPackage({
        file: {
          buffer: Buffer.from('test'),
          name: 'test.taptik',
          size: 4,
          path: '/path/to/test.taptik',
        },
        visibility: PackageVisibility.Private,
        title: 'Test',
        tags: [],
        version: '1.0.0',
        force: false,
        dryRun: false,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toContain('AUTH');
    });
  });
});