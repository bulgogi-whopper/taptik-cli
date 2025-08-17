import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';

import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import { DeployModule } from '../deploy.module';
import { DeployOptions } from '../interfaces/deploy-options.interface';
import { DeploymentService } from '../services/deployment.service';
import { ErrorHandlerService } from '../services/error-handler.service';
import { LockingService } from '../services/locking.service';
import { PerformanceOptimizer } from '../utils/performance-optimizer.utility';

describe('Deploy Module Stress Tests', () => {
  let module: TestingModule;
  let deploymentService: DeploymentService;
  let performanceOptimizer: PerformanceOptimizer;
  let lockingService: LockingService;
  let _errorHandler: ErrorHandlerService;
  let testDirectory: string;

  beforeEach(async () => {
    // Create test directory
    testDirectory = path.join(os.tmpdir(), `taptik-stress-test-${Date.now()}`);
    await fs.mkdir(testDirectory, { recursive: true });

    module = await Test.createTestingModule({
      imports: [DeployModule],
    }).compile();

    deploymentService = module.get<DeploymentService>(DeploymentService);
    performanceOptimizer = module.get<PerformanceOptimizer>(PerformanceOptimizer);
    lockingService = module.get<LockingService>(LockingService);
    _errorHandler = module.get<ErrorHandlerService>(ErrorHandlerService);

    // Mock home directory
    vi.spyOn(os, 'homedir').mockReturnValue(testDirectory);
  });

  afterEach(async () => {
    // Cleanup
    await fs.rm(testDirectory, { recursive: true, force: true });
    vi.restoreAllMocks();
    await module.close();
  });

  describe('High Volume Deployments', () => {
    it('should handle 1000+ small files efficiently', async () => {
      const fileCount = 1000;
      const context: TaptikContext = {
        metadata: {
          version: '1.0.0',
          created: new Date().toISOString(),
          source: 'stress-test',
        },
        content: {
          tools: {
            agents: Array.from({ length: fileCount }, (_, i) => ({
              name: `agent-${i}`,
              content: `Agent ${i} minimal content`,
            })),
          },
          ide: {
            'claude-code': {
              settings: {},
            },
          },
        },
      };

      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        parallel: true,
        maxWorkers: 10,
      };

      const startMark = performance.mark('deployment-start');
      const result = await deploymentService.deploy(context, options);
      const endMark = performance.mark('deployment-end');
      
      const measure = performance.measure('deployment', startMark.name, endMark.name);

      expect(result.success).toBe(true);
      expect(result.summary.filesDeployed).toBe(fileCount);
      
      // Should complete in reasonable time (< 30 seconds for 1000 files)
      expect(measure.duration).toBeLessThan(30000);
      
      // Verify files were created
      const agentsDirectory = path.join(testDirectory, '.claude', 'agents');
      const files = await fs.readdir(agentsDirectory);
      expect(files).toHaveLength(fileCount);
    });

    it('should handle very large single files (100MB+)', async () => {
      const largeContent = Buffer.alloc(100 * 1024 * 1024, 'x').toString(); // 100MB
      const context: TaptikContext = {
        metadata: {
          version: '1.0.0',
          created: new Date().toISOString(),
          source: 'stress-test',
        },
        content: {
          project: {
            largeData: largeContent,
          },
          ide: {
            'claude-code': {
              settings: {},
            },
          },
        },
      };

      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        streaming: true,
        chunkSize: 10 * 1024 * 1024, // 10MB chunks
      };

      const memBefore = process.memoryUsage().heapUsed;
      const result = await deploymentService.deploy(context, options);
      const memAfter = process.memoryUsage().heapUsed;

      expect(result.success).toBe(true);
      
      // Memory usage should be controlled with streaming
      const memIncrease = (memAfter - memBefore) / (1024 * 1024); // MB
      expect(memIncrease).toBeLessThan(50); // Less than 50MB increase for 100MB file
    });

    it('should handle mixed file sizes efficiently', async () => {
      const context: TaptikContext = {
        metadata: {
          version: '1.0.0',
          created: new Date().toISOString(),
          source: 'stress-test',
        },
        content: {
          tools: {
            // Small files
            agents: Array.from({ length: 500 }, (_, i) => ({
              name: `small-${i}`,
              content: `Small content ${i}`,
            })),
            // Medium files
            commands: Array.from({ length: 50 }, (_, i) => ({
              name: `medium-${i}.sh`,
              content: Buffer.alloc(1024 * 100, `m${i}`).toString(), // 100KB each
            })),
          },
          project: {
            // Large file
            largeConfig: Buffer.alloc(10 * 1024 * 1024, 'L').toString(), // 10MB
          },
          ide: {
            'claude-code': {
              settings: {},
            },
          },
        },
      };

      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        parallel: true,
        streaming: true,
        adaptiveStrategy: true, // Use adaptive strategy based on file size
      };

      const result = await deploymentService.deploy(context, options);

      expect(result.success).toBe(true);
      expect(result.summary.filesDeployed).toBeGreaterThan(550);
    });
  });

  describe('Concurrent Access Patterns', () => {
    it('should handle rapid lock acquisition and release', async () => {
      const iterations = 100;
      const acquireTimes: number[] = [];
      const releaseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const acquireStart = performance.now();
        await lockingService.acquireLock('test-lock', { // eslint-disable-line no-await-in-loop
          timeout: 1000,
          retryInterval: 10,
        });
        acquireTimes.push(performance.now() - acquireStart);

        // Simulate work
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10)); // eslint-disable-line no-await-in-loop

        const releaseStart = performance.now();
        await lockingService.releaseLock('test-lock'); // eslint-disable-line no-await-in-loop
        releaseTimes.push(performance.now() - releaseStart);
      }

      // Average times should be fast
      const avgAcquire = acquireTimes.reduce((a, b) => a + b, 0) / iterations;
      const avgRelease = releaseTimes.reduce((a, b) => a + b, 0) / iterations;

      expect(avgAcquire).toBeLessThan(50); // Less than 50ms average
      expect(avgRelease).toBeLessThan(10); // Less than 10ms average
    });

    it('should handle lock contention with many waiters', async () => {
      const waiterCount = 50;
      let successCount = 0;
      let errorCount = 0;

      // Create many concurrent lock attempts
      const lockAttempts = Array.from({ length: waiterCount }, async () => {
        try {
          await lockingService.acquireLock('contended-lock', {
            timeout: 5000,
            retryInterval: 10,
            waitForLock: true,
          });
          
          // Hold lock briefly
          await new Promise(resolve => setTimeout(resolve, 10));
          
          await lockingService.releaseLock('contended-lock');
          successCount++;
        } catch {
          errorCount++;
        }
      });

      await Promise.all(lockAttempts);

      // All should eventually succeed
      expect(successCount).toBe(waiterCount);
      expect(errorCount).toBe(0);
    });

    it('should detect and clean up deadlocks', async () => {
      // Create circular lock dependency scenario
      const lockA = 'lock-a';
      const lockB = 'lock-b';

      // Process 1: Acquires A, waits for B
      const process1 = async () => {
        await lockingService.acquireLock(lockA);
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
          await lockingService.acquireLock(lockB, { timeout: 1000 });
        } catch {
          // Expected to timeout
        }
        await lockingService.releaseLock(lockA);
      };

      // Process 2: Acquires B, waits for A
      const process2 = async () => {
        await lockingService.acquireLock(lockB);
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
          await lockingService.acquireLock(lockA, { timeout: 1000 });
        } catch {
          // Expected to timeout
        }
        await lockingService.releaseLock(lockB);
      };

      // Run both "processes"
      await Promise.all([process1(), process2()]);

      // Both locks should be released
      const lockAStatus = await lockingService.isLocked(lockA);
      const lockBStatus = await lockingService.isLocked(lockB);

      expect(lockAStatus).toBe(false);
      expect(lockBStatus).toBe(false);
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory during repeated deployments', async () => {
      const iterations = 10;
      const memorySnapshots: number[] = [];

      const context: TaptikContext = createMockContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
      };

      // Force garbage collection before test
      if (global.gc) global.gc();

      for (let i = 0; i < iterations; i++) {
        await deploymentService.deploy(context, options); // eslint-disable-line no-await-in-loop
        
        // Force garbage collection
        if (global.gc) global.gc();
        
        // Record memory usage
        memorySnapshots.push(process.memoryUsage().heapUsed);
      }

      // Check for memory growth
      const firstHalf = memorySnapshots.slice(0, 5);
      const secondHalf = memorySnapshots.slice(5);
      
      const avgFirstHalf = firstHalf.reduce((a, b) => a + b, 0) / 5;
      const avgSecondHalf = secondHalf.reduce((a, b) => a + b, 0) / 5;

      // Memory should not grow significantly
      const growthPercent = ((avgSecondHalf - avgFirstHalf) / avgFirstHalf) * 100;
      expect(growthPercent).toBeLessThan(20); // Less than 20% growth
    });

    it('should properly clean up cache under memory pressure', async () => {
      const cacheEntries = 10000;
      
      // Fill cache with large entries
      for (let i = 0; i < cacheEntries; i++) {
        const key = `cache-key-${i}`;
        const value = {
          data: Buffer.alloc(1024, i % 256).toString(), // 1KB per entry
          timestamp: Date.now(),
        };
        performanceOptimizer.cache.set(key, value);
      }

      // Trigger cleanup
      performanceOptimizer.cleanupCache({
        maxAge: 60000,
        maxSize: 5000, // Keep only 5000 entries
      });

      expect(performanceOptimizer.cache.size).toBeLessThanOrEqual(5000);
    });
  });

  describe('Error Recovery Under Load', () => {
    it('should handle cascading failures gracefully', async () => {
      let failureCount = 0;
      const maxFailures = 5;

      // Mock service to fail initially then recover
      vi.spyOn(deploymentService, 'deploySettings').mockImplementation(async () => {
        if (failureCount < maxFailures) {
          failureCount++;
          throw new Error(`Failure ${failureCount}`);
        }
        // Success after failures
      });

      const context: TaptikContext = createMockContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        retry: true,
        maxRetries: 10,
        retryStrategy: 'exponential',
        initialRetryDelay: 10,
      };

      const result = await deploymentService.deploy(context, options);

      expect(failureCount).toBe(maxFailures);
      expect(result.success).toBe(true);
    });

    it('should maintain consistency during partial failures', async () => {
      const context: TaptikContext = createMockContext();
      const deployedComponents: string[] = [];

      // Track what gets deployed
      vi.spyOn(deploymentService, 'deploySettings').mockImplementation(async () => {
        deployedComponents.push('settings');
      });

      vi.spyOn(deploymentService, 'deployAgents').mockImplementation(async () => {
        deployedComponents.push('agents');
        throw new Error('Agent deployment failed');
      });

      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        rollbackOnFailure: true,
      };

      try {
        await deploymentService.deploy(context, options);
      } catch {
        // Expected to fail
      }

      // Should have rolled back settings
      expect(deployedComponents).toContain('settings');
      expect(deployedComponents).toContain('agents');
      
      // Verify rollback was triggered
      const backupService = module.get('BackupService');
      const rollbackSpy = vi.spyOn(backupService, 'rollback');
      expect(rollbackSpy).toHaveBeenCalled();
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance SLA for typical deployment', async () => {
      const context: TaptikContext = {
        metadata: {
          version: '1.0.0',
          created: new Date().toISOString(),
          source: 'benchmark',
        },
        content: {
          personal: {
            name: 'User',
            email: 'user@example.com',
            preferences: { theme: 'dark' },
          },
          tools: {
            agents: Array.from({ length: 10 }, (_, i) => ({
              name: `agent-${i}`,
              content: `Agent content ${i}`,
            })),
            commands: Array.from({ length: 5 }, (_, i) => ({
              name: `cmd-${i}.sh`,
              content: `#!/bin/bash\necho "Command ${i}"`,
            })),
          },
          ide: {
            'claude-code': {
              settings: Object.fromEntries(
                Array.from({ length: 100 }, (_, i) => [`key${i}`, `value${i}`])
              ),
            },
          },
        },
      };

      const benchmarks = {
        small: { targetMs: 500 },
      };

      // Run benchmark
      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        parallel: true,
      };

      const start = performance.now();
      const result = await deploymentService.deploy(context, options);
      const duration = performance.now() - start;

      expect(result.success).toBe(true);
      
      // Should meet SLA for small deployment
      expect(duration).toBeLessThan(benchmarks.small.targetMs);
    });

    it('should optimize based on workload characteristics', async () => {
      const scenarios = [
        {
          name: 'many-small-files',
          context: createContextWithFiles(1000, 100), // 1000 files, 100 bytes each
          expectedStrategy: 'batch',
        },
        {
          name: 'few-large-files',
          context: createContextWithFiles(5, 10 * 1024 * 1024), // 5 files, 10MB each
          expectedStrategy: 'stream',
        },
        {
          name: 'mixed-workload',
          context: createMixedContext(),
          expectedStrategy: 'adaptive',
        },
      ];

      for (const scenario of scenarios) {
        const spy = vi.spyOn(performanceOptimizer, 'selectStrategy');
        
        await deploymentService.deploy(scenario.context, { // eslint-disable-line no-await-in-loop
          platform: 'claude-code',
          dryRun: false,
          adaptiveStrategy: true,
        });

        expect(spy).toHaveBeenCalledWith(
          expect.objectContaining({
            strategy: scenario.expectedStrategy,
          })
        );
      }
    });
  });
});

function createMockContext(overrides: Partial<TaptikContext['content']> = {}): TaptikContext {
  return {
    metadata: {
      version: '1.0.0',
      created: new Date().toISOString(),
      source: 'test',
    },
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

function createContextWithFiles(count: number, sizePerFile: number): TaptikContext {
  const content = Buffer.alloc(sizePerFile, 'x').toString();
  return createMockContext({
    tools: {
      agents: Array.from({ length: count }, (_, i) => ({
        name: `file-${i}`,
        content,
      })),
    },
  });
}

function createMixedContext(): TaptikContext {
  return createMockContext({
    tools: {
      agents: [
        ...Array.from({ length: 100 }, (_, i) => ({
          name: `small-${i}`,
          content: 'small',
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          name: `medium-${i}`,
          content: Buffer.alloc(100 * 1024, 'm').toString(),
        })),
        {
          name: 'large',
          content: Buffer.alloc(5 * 1024 * 1024, 'L').toString(),
        },
      ],
    },
  });
}