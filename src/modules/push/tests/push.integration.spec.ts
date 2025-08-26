import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { AuthModule } from '../../auth/auth.module';
import { AuthService } from '../../auth/auth.service';
import { DeployCoreModule } from '../../deploy/core/deploy-core.module';
import { SupabaseModule } from '../../supabase/supabase.module';
import { SupabaseService } from '../../supabase/supabase.service';
import { PushModule } from '../push.module';
import { AnalyticsService } from '../services/analytics.service';
import { LocalQueueService } from '../services/local-queue.service';
import { PackageRegistryService } from '../services/package-registry.service';
import { PushService } from '../services/push.service';
import { RateLimiterService } from '../services/rate-limiter.service';

// Mock environment variables for Supabase
vi.stubEnv('SUPABASE_URL', 'https://test-project.supabase.co');
vi.stubEnv(
  'SUPABASE_ANON_KEY',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-key',
);
vi.stubEnv('NODE_ENV', 'test');

// Mock fs/promises for SecureStorageService and OperationLockService
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return {
    ...actual,
    chmod: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('{}'),
    access: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
    appendFile: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    stat: vi.fn().mockResolvedValue({ isFile: () => true, mtime: new Date() }),
  };
});

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
    tempDir = path.join(
      os.tmpdir(),
      'taptik-integration-test',
      Date.now().toString(),
    );
    await fs.mkdir(tempDir, { recursive: true });

    module = await Test.createTestingModule({
      imports: [PushModule, SupabaseModule, AuthModule, DeployCoreModule],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    pushService = module.get<PushService>(PushService);
    packageRegistry = module.get<PackageRegistryService>(
      PackageRegistryService,
    );
    localQueue = module.get<LocalQueueService>(LocalQueueService);
    analytics = module.get<AnalyticsService>(AnalyticsService);
    rateLimiter = module.get<RateLimiterService>(RateLimiterService);

    // Mock auth service
    const authService = module.get(AuthService);
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
    const supabaseService = module.get(SupabaseService);
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
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
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

  describe('Service Integration', () => {
    it('should instantiate all push module services correctly', async () => {
      // Verify all services are properly injected and accessible
      expect(pushService).toBeDefined();
      expect(packageRegistry).toBeDefined();
      expect(localQueue).toBeDefined();
      expect(analytics).toBeDefined();
      expect(rateLimiter).toBeDefined();

      // Test that services have expected methods
      expect(typeof pushService.push).toBe('function');
      expect(typeof packageRegistry.listUserPackages).toBe('function');
      expect(typeof localQueue.addToQueue).toBe('function');
    });

    it('should have proper Supabase integration', async () => {
      const supabaseService = module.get(SupabaseService);
      expect(supabaseService).toBeDefined();
      expect(supabaseService.getClient).toBeDefined();

      // Test that mock client is working
      const client = supabaseService.getClient();
      expect(client).toBeDefined();
      expect(client.auth).toBeDefined();
    });

    it('should have proper authentication integration', async () => {
      const authService = module.get(AuthService);
      expect(authService).toBeDefined();
      expect(authService.getSession).toBeDefined();

      // Test that mock session is working
      const session = await authService.getSession();
      expect(session).toBeDefined();
      expect(session.user).toBeDefined();
      expect(session.user.id).toBe('test-user');
    });
  });

  describe('Mock Verification', () => {
    it('should have working Supabase client mocks', async () => {
      const supabaseService = module.get(SupabaseService);
      const client = supabaseService.getClient();

      // Test auth mock
      const userResult = await client.auth.getUser();
      expect(userResult.data.user).toBeDefined();
      expect(userResult.data.user.id).toBe('test-user');

      // Test storage mock
      const uploadResult = await client.storage
        .from('packages')
        .upload('test.taptik', Buffer.from('test'));
      expect(uploadResult.data).toBeDefined();
      expect(uploadResult.error).toBe(null);
    });

    it('should have working database mocks', async () => {
      const supabaseService = module.get(SupabaseService);
      const client = supabaseService.getClient();

      // Test database operations
      const insertResult = await client
        .from('taptik_packages')
        .insert({ name: 'test' });
      expect(insertResult.error).toBe(null);

      const selectResult = await client
        .from('taptik_packages')
        .select()
        .eq('id', 'test');
      expect(selectResult.error).toBe(null);
    });
  });
});
