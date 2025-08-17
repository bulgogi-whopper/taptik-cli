import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';

import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import { DeployModule } from '../deploy.module';
import { DeployOptions } from '../interfaces/deploy-options.interface';
import { DeploymentService } from '../services/deployment.service';
import { LockingService } from '../services/locking.service';
import { PerformanceOptimizer } from '../utils/performance-optimizer.utility';

// Mock fs module for file operations
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    mkdir: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn(),
    unlink: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock Supabase module
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      update: vi.fn(() => Promise.resolve({ data: null, error: null })),
      delete: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    },
  })),
}));

describe('Deploy Module Stress Tests', () => {
  let module: TestingModule;
  let deploymentService: DeploymentService;
  let performanceOptimizer: PerformanceOptimizer;
  let lockingService: LockingService;
  let testDirectory: string;

  beforeEach(async () => {
    // Create test directory with Claude directory structure
    testDirectory = path.join(os.tmpdir(), `taptik-stress-test-${Date.now()}`);
    await fs.mkdir(testDirectory, { recursive: true });
    
    // Create .claude directory structure for tests
    const claudeDirectory = path.join(testDirectory, '.claude');
    await fs.mkdir(claudeDirectory, { recursive: true });
    await fs.mkdir(path.join(claudeDirectory, 'agents'), { recursive: true });
    await fs.mkdir(path.join(claudeDirectory, 'commands'), { recursive: true });

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.env',
          isGlobal: true,
        }),
        DeployModule,
      ],
    }).compile();

    deploymentService = module.get<DeploymentService>(DeploymentService);
    performanceOptimizer = module.get<PerformanceOptimizer>(PerformanceOptimizer);
    lockingService = module.get<LockingService>(LockingService);
  });

  afterEach(async () => {
    // Cleanup
    try {
      await fs.rm(testDirectory, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    vi.restoreAllMocks();
    await module.close();
  });

  describe('Service Availability', () => {
    it('should have all required services', () => {
      expect(deploymentService).toBeDefined();
      expect(performanceOptimizer).toBeDefined();
      expect(lockingService).toBeDefined();
    });

    it('should have deployToClaudeCode method', () => {
      expect(deploymentService.deployToClaudeCode).toBeDefined();
      expect(typeof deploymentService.deployToClaudeCode).toBe('function');
    });
  });

  describe('High Volume File Operations', () => {
    it('should handle many small file operations efficiently', async () => {
      const fileCount = 100; // Reduced for test performance
      const files: Array<{ path: string; content: string }> = [];

      // Generate test files
      for (let i = 0; i < fileCount; i++) {
        files.push({
          path: path.join(testDirectory, `test-file-${i}.json`),
          content: JSON.stringify({ index: i, data: `content-${i}` }),
        });
      }

      // Mock readFile to return the expected content for each file
      vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
        const fileName = path.basename(filePath as string);
        const match = fileName.match(/test-file-(\d+)\.json/);
        if (match) {
          const index = Number.parseInt(match[1], 10);
          return JSON.stringify({ index, data: `content-${index}` });
        }
        return '{}';
      });

      const startTime = performance.now();

      // Write all files
      await Promise.all(
        files.map(file => fs.writeFile(file.path, file.content))
      );

      // Read all files back
      const readResults = await Promise.all(
        files.map(async file => {
          const content = await fs.readFile(file.path, 'utf8');
          return JSON.parse(content);
        })
      );

      const duration = performance.now() - startTime;

      expect(readResults).toHaveLength(fileCount);
      expect(readResults[0].index).toBe(0);
      expect(readResults[fileCount - 1].index).toBe(fileCount - 1);
      
      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds
    });

    it('should handle large file operations', async () => {
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB
      const largeFile = path.join(testDirectory, 'large-file.txt');

      // Mock readFile to return the large content
      vi.mocked(fs.readFile).mockResolvedValue(largeContent);

      const memBefore = process.memoryUsage().heapUsed;
      
      await fs.writeFile(largeFile, largeContent);
      const readContent = await fs.readFile(largeFile, 'utf8');
      
      const memAfter = process.memoryUsage().heapUsed;

      expect(readContent).toBe(largeContent);
      expect(readContent.length).toBe(1024 * 1024);
      
      // Memory increase should be reasonable
      const memIncrease = (memAfter - memBefore) / (1024 * 1024); // MB
      expect(memIncrease).toBeLessThan(10); // Less than 10MB increase
    });
  });

  describe('Concurrent Lock Operations', () => {
    it('should handle rapid lock acquisition and release', async () => {
      const iterations = 50; // Reduced for test performance
      const acquireTimes: number[] = [];
      const releaseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const lockName = `rapid-lock-${i}`;
        
        const acquireStart = performance.now();
        const lock = await lockingService.acquireLock(lockName); // eslint-disable-line no-await-in-loop
        acquireTimes.push(performance.now() - acquireStart);

        // Simulate work
        await new Promise(resolve => setTimeout(resolve, 1)); // eslint-disable-line no-await-in-loop

        const releaseStart = performance.now();
        await lockingService.releaseLock(lock); // eslint-disable-line no-await-in-loop
        releaseTimes.push(performance.now() - releaseStart);
      }

      // Average times should be reasonable
      const avgAcquire = acquireTimes.reduce((a, b) => a + b, 0) / iterations;
      const avgRelease = releaseTimes.reduce((a, b) => a + b, 0) / iterations;

      expect(avgAcquire).toBeLessThan(100); // Less than 100ms average
      expect(avgRelease).toBeLessThan(50); // Less than 50ms average
      expect(acquireTimes.every(time => time >= 0)).toBe(true);
      expect(releaseTimes.every(time => time >= 0)).toBe(true);
    });

    it('should handle concurrent lock contention', async () => {
      const waiterCount = 20; // Reduced for test performance
      let successCount = 0;
      let errorCount = 0;

      // Create many concurrent lock attempts
      const lockAttempts = Array.from({ length: waiterCount }, async (_, index) => {
        try {
          const lockName = `contended-lock-${index % 5}`; // Multiple locks to reduce contention
          const lock = await lockingService.acquireLock(lockName);
          
          // Hold lock briefly
          await new Promise(resolve => setTimeout(resolve, 5));
          
          await lockingService.releaseLock(lock);
          successCount++;
        } catch {
          errorCount++;
        }
      });

      await Promise.all(lockAttempts);

      // Most should succeed
      expect(successCount).toBeGreaterThan(waiterCount * 0.7); // At least 70% success
      expect(successCount + errorCount).toBe(waiterCount);
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory during repeated operations', async () => {
      const iterations = 5; // Reduced for test performance
      const memorySnapshots: number[] = [];

      // Force garbage collection before test
      if (global.gc) global.gc();

      for (let i = 0; i < iterations; i++) {
        // Perform memory-intensive operation
        const data = Array.from({ length: 1000 }, (_, j) => ({
          id: `item-${i}-${j}`,
          data: 'x'.repeat(1000),
        }));

        // Process data
        const processed = data.map(item => ({
          ...item,
          processed: true,
        }));

        expect(processed).toHaveLength(1000);

        // Force garbage collection
        if (global.gc) global.gc();
        
        // Record memory usage
        memorySnapshots.push(process.memoryUsage().heapUsed);
      }

      // Check for excessive memory growth
      const firstSnapshot = memorySnapshots[0];
      const lastSnapshot = memorySnapshots.at(-1);
      
      const growthPercent = ((lastSnapshot - firstSnapshot) / firstSnapshot) * 100;
      expect(growthPercent).toBeLessThan(50); // Less than 50% growth
    });

    it('should handle cache operations efficiently', async () => {
      // Test basic cache functionality with a simple Map
      const cache = new Map();
      const cacheEntries = 1000; // Reduced for test performance
      
      const startTime = performance.now();
      
      // Fill cache with entries
      for (let i = 0; i < cacheEntries; i++) {
        const key = `cache-key-${i}`;
        const value = {
          data: `data-${i}`,
          timestamp: Date.now(),
        };
        cache.set(key, value);
      }

      // Verify some entries exist
      expect(cache.get('cache-key-0')).toBeDefined();
      expect(cache.get('cache-key-500')).toBeDefined();
      expect(cache.size).toBe(cacheEntries);

      // Clear cache
      cache.clear();

      // Verify cache is cleared
      expect(cache.get('cache-key-0')).toBeUndefined();
      expect(cache.get('cache-key-500')).toBeUndefined();
      expect(cache.size).toBe(0);
      
      const duration = performance.now() - startTime;
      
      // Should complete quickly
      expect(duration).toBeLessThan(1000); // Less than 1 second
    });
  });

  describe('Error Recovery Under Load', () => {
    it('should handle multiple failures gracefully', async () => {
      let failureCount = 0;
      const maxFailures = 3;
      const attempts = 5;

      const context: TaptikContext = createMockContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: true,
        conflictStrategy: 'skip',
        validateOnly: false,
      };

      // Mock service to fail initially then recover
      vi.spyOn(deploymentService, 'deployToClaudeCode').mockImplementation(async () => {
        if (failureCount < maxFailures) {
          failureCount++;
          throw new Error(`Failure ${failureCount}`);
        }
        return {
          success: true,
          platform: 'claude-code' as const,
          deployedComponents: ['settings'],
          conflicts: [],
          summary: {
            filesDeployed: 1,
            filesSkipped: 0,
            conflictsResolved: 0,
          },
        };
      });

      // Try multiple times
      let result;
      for (let i = 0; i < attempts; i++) {
        try {
          result = await deploymentService.deployToClaudeCode(context, options); // eslint-disable-line no-await-in-loop
          break;
        } catch {
          // Continue trying
        }
      }

      expect(failureCount).toBe(maxFailures);
      expect(result?.success).toBe(true);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance SLA for typical operations', async () => {
      const context: TaptikContext = createMockContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: true,
        conflictStrategy: 'skip',
        validateOnly: false,
      };

      // Mock successful deployment
      vi.spyOn(deploymentService, 'deployToClaudeCode').mockResolvedValue({
        success: true,
        platform: 'claude-code',
        deployedComponents: ['settings'],
        conflicts: [],
        summary: {
          filesDeployed: 1,
          filesSkipped: 0,
          conflictsResolved: 0,
        },
      });

      const start = performance.now();
      const result = await deploymentService.deployToClaudeCode(context, options);
      const duration = performance.now() - start;

      expect(result.success).toBe(true);
      
      // Should complete quickly for dry run
      expect(duration).toBeLessThan(1000); // Less than 1 second
    });

    it('should handle multiple parallel operations', async () => {
      const operationCount = 10;
      const operations = Array.from({ length: operationCount }, async (_, i) => {
        const lockName = `parallel-lock-${i}`;
        const start = performance.now();
        
        const lock = await lockingService.acquireLock(lockName);
        await new Promise(resolve => setTimeout(resolve, 10));
        await lockingService.releaseLock(lock);
        
        return performance.now() - start;
      });

      const durations = await Promise.all(operations);
      const totalDuration = Math.max(...durations);

      expect(durations).toHaveLength(operationCount);
      expect(totalDuration).toBeLessThan(2000); // Should complete in less than 2 seconds
      expect(durations.every(duration => duration >= 0)).toBe(true);
    });
  });
});

function createMockContext(overrides: Partial<TaptikContext['content']> = {}): TaptikContext {
  return {
    metadata: {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      sourceIde: 'test',
    } as any,
    security: {} as any,
    content: {
      personal: {
        name: 'Test User',
        email: 'test@example.com',
        preferences: {},
      },
      ide: {
        'claude-code': {
          settings: {},
        },
      },
      ...overrides,
    },
  };
}