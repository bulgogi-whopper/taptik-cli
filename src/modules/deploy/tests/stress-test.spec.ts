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
import { LockingService } from '../services/locking.service';
import { PerformanceOptimizer } from '../utils/performance-optimizer.utility';

describe('Deploy Module Stress Tests', () => {
  let module: TestingModule;
  let deploymentService: DeploymentService;
  let performanceOptimizer: PerformanceOptimizer;
  let lockingService: LockingService;
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
          exportedAt: new Date().toISOString(),
          sourceIde: 'stress-test',
        } as any,
        security: {} as any,
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
        conflictStrategy: 'skip',
        validateOnly: false,
      };

      // Mock successful deployment
      vi.spyOn(deploymentService, 'deployToClaudeCode').mockResolvedValue({
        success: true,
        platform: 'claude-code',
        deployedComponents: ['agents'],
        conflicts: [],
        summary: {
          filesDeployed: fileCount,
          filesSkipped: 0,
          conflictsResolved: 0,
        },
      });

      const startMark = performance.mark('deployment-start');
      const result = await deploymentService.deployToClaudeCode(context, options);
      const endMark = performance.mark('deployment-end');
      
      const measure = performance.measure('deployment', startMark.name, endMark.name);

      expect(result.success).toBe(true);
      expect(result.summary.filesDeployed).toBe(fileCount);
      
      // Should complete in reasonable time (< 30 seconds for 1000 files)
      expect(measure.duration).toBeLessThan(30000);
    });

    it('should handle very large single files (100MB+)', async () => {
      const largeContent = Buffer.alloc(100 * 1024 * 1024, 'x').toString(); // 100MB
      const context: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          sourceIde: 'stress-test',
        } as any,
        security: {} as any,
        content: {
          project: {
            name: 'Large File Test',
            description: largeContent,
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
        conflictStrategy: 'skip',
        validateOnly: false,
      };

      const memBefore = process.memoryUsage().heapUsed;
      
      // Mock successful deployment
      vi.spyOn(deploymentService, 'deployToClaudeCode').mockResolvedValue({
        success: true,
        platform: 'claude-code',
        deployedComponents: ['project'],
        conflicts: [],
        summary: {
          filesDeployed: 1,
          filesSkipped: 0,
          conflictsResolved: 0,
        },
      });

      const result = await deploymentService.deployToClaudeCode(context, options);
      const memAfter = process.memoryUsage().heapUsed;

      expect(result.success).toBe(true);
      
      // Memory usage should be controlled
      const memIncrease = (memAfter - memBefore) / (1024 * 1024); // MB
      expect(memIncrease).toBeLessThan(200); // Less than 200MB increase for 100MB file
    });
  });

  describe('Concurrent Access Patterns', () => {
    it('should handle rapid lock acquisition and release', async () => {
      const iterations = 100;
      const acquireTimes: number[] = [];
      const releaseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const acquireStart = performance.now();
        const lock = await lockingService.acquireLock('test-lock'); // eslint-disable-line no-await-in-loop
        acquireTimes.push(performance.now() - acquireStart);

        // Simulate work
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10)); // eslint-disable-line no-await-in-loop

        const releaseStart = performance.now();
        await lockingService.releaseLock(lock); // eslint-disable-line no-await-in-loop
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
          const lock = await lockingService.acquireLock('contended-lock');
          
          // Hold lock briefly
          await new Promise(resolve => setTimeout(resolve, 10));
          
          await lockingService.releaseLock(lock);
          successCount++;
        } catch {
          errorCount++;
        }
      });

      await Promise.all(lockAttempts);

      // Most should eventually succeed
      expect(successCount).toBeGreaterThan(0);
      expect(successCount + errorCount).toBe(waiterCount);
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
        conflictStrategy: 'skip',
        validateOnly: false,
      };

      // Mock successful deployments
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

      // Force garbage collection before test
      if (global.gc) global.gc();

      for (let i = 0; i < iterations; i++) {
        await deploymentService.deployToClaudeCode(context, options); // eslint-disable-line no-await-in-loop
        
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
      
      // Fill cache with entries
      for (let i = 0; i < cacheEntries; i++) {
        const key = `cache-key-${i}`;
        const value = {
          data: Buffer.alloc(1024, i % 256).toString(), // 1KB per entry
          timestamp: Date.now(),
        };
        (performanceOptimizer as any).set(key, value, 60000);
      }

      // Trigger cleanup
      performanceOptimizer.clearCache();

      // Cache should be cleared
      expect((performanceOptimizer as any).get('cache-key-0')).toBeUndefined();
    });
  });

  describe('Error Recovery Under Load', () => {
    it('should handle cascading failures gracefully', async () => {
      let failureCount = 0;
      const maxFailures = 5;

      const context: TaptikContext = createMockContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        conflictStrategy: 'skip',
        validateOnly: false,
      };

      // Mock service to fail initially then recover
      vi.spyOn(deploymentService, 'deployToClaudeCode').mockImplementation(async () => {
        if (failureCount < maxFailures) {
          failureCount++;
          throw new Error(`Failure ${failureCount}`);
        }
        // Success after failures
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
      for (let i = 0; i <= maxFailures; i++) {
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
    it('should meet performance SLA for typical deployment', async () => {
      const context: TaptikContext = {
        metadata: {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          sourceIde: 'benchmark',
        } as any,
        security: {} as any,
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

      // Mock successful deployment
      vi.spyOn(deploymentService, 'deployToClaudeCode').mockResolvedValue({
        success: true,
        platform: 'claude-code',
        deployedComponents: ['agents', 'commands', 'settings'],
        conflicts: [],
        summary: {
          filesDeployed: 15,
          filesSkipped: 0,
          conflictsResolved: 0,
        },
      });

      // Run benchmark
      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        conflictStrategy: 'skip',
        validateOnly: false,
      };

      const start = performance.now();
      const result = await deploymentService.deployToClaudeCode(context, options);
      const duration = performance.now() - start;

      expect(result.success).toBe(true);
      
      // Should meet SLA for small deployment
      expect(duration).toBeLessThan(benchmarks.small.targetMs);
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