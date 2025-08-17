import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';


import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import { DeployModule } from '../deploy.module';
import { DeployOptions } from '../interfaces/deploy-options.interface';
import { DeploymentService } from '../services/deployment.service';
import { ErrorHandlerService } from '../services/error-handler.service';
import { ImportService } from '../services/import.service';
import { LockingService } from '../services/locking.service';

describe('Concurrent Deployment Integration Tests', () => {
  let module: TestingModule;
  let deploymentService: DeploymentService;
  let lockingService: LockingService;
  let importService: ImportService;
  let _errorHandler: ErrorHandlerService;
  let testDirectory: string;

  beforeEach(async () => {
    // Create test directory
    testDirectory = path.join(os.tmpdir(), `taptik-concurrent-test-${Date.now()}`);
    await fs.mkdir(testDirectory, { recursive: true });

    module = await Test.createTestingModule({
      imports: [DeployModule],
    }).compile();

    deploymentService = module.get<DeploymentService>(DeploymentService);
    lockingService = module.get<LockingService>(LockingService);
    importService = module.get<ImportService>(ImportService);
    _errorHandler = module.get<ErrorHandlerService>(ErrorHandlerService);

    // Mock Claude directory to test directory
    vi.spyOn(os, 'homedir').mockReturnValue(testDirectory);
  });

  afterEach(async () => {
    // Cleanup test directory
    await fs.rm(testDirectory, { recursive: true, force: true });
    vi.restoreAllMocks();
    await module.close();
  });

  describe('Concurrent Deployment Prevention', () => {
    it('should prevent multiple simultaneous deployments', async () => {
      const context: TaptikContext = createMockContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
      };

      // Start first deployment
      const deployment1 = deploymentService.deploy(context, options);

      // Attempt second deployment immediately
      const deployment2 = deploymentService.deploy(context, options);

      // Second deployment should fail with lock error
      await expect(deployment2).rejects.toThrow('Deployment already in progress');

      // Wait for first deployment to complete
      await deployment1;
    });

    it('should handle lock timeout scenarios gracefully', async () => {
      const lockPath = path.join(testDirectory, '.claude', '.locks', 'deploy.lock');
      
      // Create stale lock
      await fs.mkdir(path.dirname(lockPath), { recursive: true });
      await fs.writeFile(lockPath, JSON.stringify({
        pid: 99999, // Non-existent process
        timestamp: Date.now() - 3600000, // 1 hour old
        deployment: 'test-deployment',
      }));

      const context: TaptikContext = createMockContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        lockTimeout: 1000, // 1 second timeout
      };

      // Should clean up stale lock and proceed
      const result = await deploymentService.deploy(context, options);
      expect(result.success).toBe(true);
    });

    it('should release lock even if deployment fails', async () => {
      const context: TaptikContext = createMockContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
      };

      // Mock deployment to fail
      vi.spyOn(deploymentService, 'deployToClaudeCode').mockRejectedValue(
        new Error('Deployment failed')
      );

      // Attempt deployment
      await expect(deploymentService.deploy(context, options)).rejects.toThrow(
        'Deployment failed'
      );

      // Verify lock was released
      const isLocked = await lockingService.isLocked('deploy');
      expect(isLocked).toBe(false);
    });
  });

  describe('Parallel Component Deployment', () => {
    it('should deploy independent components in parallel', async () => {
      const context: TaptikContext = createMockContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        parallel: true,
        maxWorkers: 4,
      };

      const startTime = Date.now();
      
      // Mock component deployments with delays
      const deploymentTimes: Record<string, number> = {};
      
      vi.spyOn(deploymentService, 'deploySettings').mockImplementation(async () => {
        const start = Date.now();
        await new Promise(resolve => setTimeout(resolve, 100));
        deploymentTimes.settings = Date.now() - start;
      });

      vi.spyOn(deploymentService, 'deployAgents').mockImplementation(async () => {
        const start = Date.now();
        await new Promise(resolve => setTimeout(resolve, 100));
        deploymentTimes.agents = Date.now() - start;
      });

      vi.spyOn(deploymentService, 'deployCommands').mockImplementation(async () => {
        const start = Date.now();
        await new Promise(resolve => setTimeout(resolve, 100));
        deploymentTimes.commands = Date.now() - start;
      });

      vi.spyOn(deploymentService, 'deployProject').mockImplementation(async () => {
        const start = Date.now();
        await new Promise(resolve => setTimeout(resolve, 100));
        deploymentTimes.project = Date.now() - start;
      });

      await deploymentService.deploy(context, options);
      
      const totalTime = Date.now() - startTime;
      
      // Parallel deployment should take ~100ms (not 400ms sequential)
      expect(totalTime).toBeLessThan(200);
      
      // All components should have been deployed
      expect(Object.keys(deploymentTimes)).toHaveLength(4);
    });

    it('should handle partial failures in parallel deployment', async () => {
      const context: TaptikContext = createMockContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        parallel: true,
        continueOnError: true,
      };

      // Mock some components to fail
      vi.spyOn(deploymentService, 'deploySettings').mockResolvedValue(undefined);
      vi.spyOn(deploymentService, 'deployAgents').mockRejectedValue(
        new Error('Agent deployment failed')
      );
      vi.spyOn(deploymentService, 'deployCommands').mockResolvedValue(undefined);
      vi.spyOn(deploymentService, 'deployProject').mockRejectedValue(
        new Error('Project deployment failed')
      );

      const result = await deploymentService.deploy(context, options);

      // Should partially succeed
      expect(result.success).toBe(false);
      expect(result.deployedComponents).toContain('settings');
      expect(result.deployedComponents).toContain('commands');
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('Stress Testing', () => {
    it('should handle rapid sequential deployments', async () => {
      const context: TaptikContext = createMockContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
      };

      const deploymentCount = 10;
      const results = [];

      for (let i = 0; i < deploymentCount; i++) {
        // Wait for lock release between deployments
        while (await lockingService.isLocked('deploy')) { // eslint-disable-line no-await-in-loop
          await new Promise(resolve => setTimeout(resolve, 10)); // eslint-disable-line no-await-in-loop
        }

        const result = await deploymentService.deploy(context, options); // eslint-disable-line no-await-in-loop
        results.push(result);
      }

      // All deployments should succeed
      expect(results).toHaveLength(deploymentCount);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle large configuration deployments', async () => {
      // Create large context with many components
      const largeContext: TaptikContext = {
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
          project: {
            name: 'Large Project',
            description: 'Test project with many files',
            repository: 'test/repo',
          },
          tools: {
            agents: Array.from({ length: 100 }, (_, i) => ({
              name: `agent-${i}`,
              content: `Agent ${i} content`.repeat(1000), // ~14KB per agent
            })),
            commands: Array.from({ length: 50 }, (_, i) => ({
              name: `command-${i}.sh`,
              content: `#!/bin/bash\necho "Command ${i}"`.repeat(100),
            })),
          },
          ide: {
            'claude-code': {
              settings: Object.fromEntries(
                Array.from({ length: 1000 }, (_, i) => [`key${i}`, `value${i}`])
              ),
            },
          },
        },
      };

      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        streaming: true, // Enable streaming for large files
      };

      const startTime = Date.now();
      const result = await deploymentService.deploy(largeContext, options);
      const deploymentTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.deployedComponents).toContain('agents');
      expect(result.deployedComponents).toContain('commands');
      
      // Should complete within reasonable time (30 seconds)
      expect(deploymentTime).toBeLessThan(30000);
    });

    it('should handle memory efficiently with streaming', async () => {
      const hugeContent = 'x'.repeat(50 * 1024 * 1024); // 50MB string
      const context: TaptikContext = createMockContext({
        project: {
          largeFile: hugeContent,
        },
      });

      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        streaming: true,
        chunkSize: 1024 * 1024, // 1MB chunks
      };

      // Monitor memory usage
      const memBefore = process.memoryUsage().heapUsed;
      
      await deploymentService.deploy(context, options);
      
      const memAfter = process.memoryUsage().heapUsed;
      const memIncrease = memAfter - memBefore;

      // Memory increase should be much less than 50MB
      expect(memIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
    });
  });

  describe('Lock Contention Scenarios', () => {
    it('should handle multiple processes competing for lock', async () => {
      const context: TaptikContext = createMockContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
      };

      // Simulate multiple "processes" (concurrent promises)
      const deployments = Array.from({ length: 5 }, () =>
        deploymentService.deploy(context, options).catch(error => error)
      );

      const results = await Promise.all(deployments);

      // Only one should succeed, others should get lock errors
      const successes = results.filter(r => r.success === true);
      const lockErrors = results.filter(r => r.message?.includes('lock'));

      expect(successes).toHaveLength(1);
      expect(lockErrors).toHaveLength(4);
    });

    it('should wait for lock with timeout', async () => {
      const context: TaptikContext = createMockContext();
      
      // First deployment holds lock
      const deployment1 = deploymentService.deploy(context, {
        platform: 'claude-code',
        dryRun: false,
      });

      // Second deployment waits for lock
      const deployment2Promise = deploymentService.deploy(context, {
        platform: 'claude-code',
        dryRun: false,
        waitForLock: true,
        lockTimeout: 5000,
      });

      // Should eventually succeed after first completes
      await deployment1;
      const result2 = await deployment2Promise;
      
      expect(result2.success).toBe(true);
    });

    it('should handle lock cleanup after process termination', async () => {
      const lockPath = path.join(testDirectory, '.claude', '.locks', 'deploy.lock');
      
      // Create lock from "terminated" process
      await fs.mkdir(path.dirname(lockPath), { recursive: true });
      await fs.writeFile(lockPath, JSON.stringify({
        pid: process.pid, // Current process (simulating terminated)
        timestamp: Date.now() - 120000, // 2 minutes old
        deployment: 'terminated-deployment',
      }));

      // Mock process check to say it's not running
      vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
        if (signal === 0) throw new Error('Process not found');
        return true;
      });

      const context: TaptikContext = createMockContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        cleanupStaleLocks: true,
      };

      // Should detect stale lock and clean it up
      const result = await deploymentService.deploy(context, options);
      expect(result.success).toBe(true);

      // Lock should be cleaned up
      const lockExists = await fs.access(lockPath).then(() => true).catch(() => false);
      expect(lockExists).toBe(false);
    });
  });

  describe('Network Failure Recovery', () => {
    it('should handle network failures during import', async () => {
      const context: TaptikContext = createMockContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        retry: true,
        maxRetries: 3,
      };

      let attemptCount = 0;
      vi.spyOn(importService, 'importConfiguration').mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network error');
        }
        return context;
      });

      const result = await deploymentService.deploy(context, options);

      expect(attemptCount).toBe(3);
      expect(result.success).toBe(true);
    });

    it('should use exponential backoff for retries', async () => {
      const context: TaptikContext = createMockContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        retryStrategy: 'exponential',
        maxRetries: 3,
        initialRetryDelay: 100,
      };

      const attemptTimes: number[] = [];
      vi.spyOn(importService, 'importConfiguration').mockImplementation(async () => {
        attemptTimes.push(Date.now());
        if (attemptTimes.length < 3) {
          throw new Error('Network error');
        }
        return context;
      });

      await deploymentService.deploy(context, options);

      // Check exponential backoff timing
      const delay1 = attemptTimes[1] - attemptTimes[0];
      const delay2 = attemptTimes[2] - attemptTimes[1];

      expect(delay1).toBeGreaterThanOrEqual(100);
      expect(delay2).toBeGreaterThanOrEqual(200); // Exponential increase
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance with many concurrent reads', async () => {
      const context: TaptikContext = createMockContext();
      
      // Create many files to deploy
      const files = Array.from({ length: 100 }, (_, i) => ({
        path: path.join(testDirectory, `.claude/test-${i}.json`),
        content: JSON.stringify({ index: i }),
      }));

      // Pre-create files
      await fs.mkdir(path.join(testDirectory, '.claude'), { recursive: true });
      await Promise.all(files.map(f => fs.writeFile(f.path, f.content)));

      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        parallel: true,
        maxWorkers: 10,
      };

      const startTime = Date.now();
      await deploymentService.deploy(context, options);
      const duration = Date.now() - startTime;

      // Should complete 100 files in reasonable time
      expect(duration).toBeLessThan(5000); // Less than 5 seconds
    });

    it('should handle cache effectively under load', async () => {
      const context: TaptikContext = createMockContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        cache: true,
        cacheTTL: 60000,
      };

      // Track cache hits
      let cacheHits = 0;
      vi.spyOn(deploymentService['cache'], 'get').mockImplementation((key) => {
        if (deploymentService['cache'].has(key)) {
          cacheHits++;
        }
        return deploymentService['cache'].get(key);
      });

      // Deploy multiple times
      for (let i = 0; i < 5; i++) {
        await deploymentService.deploy(context, options); // eslint-disable-line no-await-in-loop
      }

      // Should have cache hits after first deployment
      expect(cacheHits).toBeGreaterThan(0);
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
      project: {
        name: 'Test Project',
        description: 'Test project description',
        repository: 'test/repo',
      },
      tools: {
        agents: [
          {
            name: 'test-agent',
            content: 'Test agent content',
          },
        ],
        commands: [
          {
            name: 'test-command.sh',
            content: '#!/bin/bash\necho "test"',
          },
        ],
      },
      ide: {
        'claude-code': {
          settings: {
            theme: 'dark',
            fontSize: 14,
          },
        },
      },
      ...overrides,
    },
  };
}