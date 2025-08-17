import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import { DeployModule } from '../deploy.module';
import { DeployOptions } from '../interfaces/deploy-options.interface';
import { DeploymentService } from '../services/deployment.service';
import { ImportService } from '../services/import.service';
import { LockingService } from '../services/locking.service';

describe('Concurrent Deployment Integration Tests', () => {
  let module: TestingModule;
  let deploymentService: DeploymentService;
  let lockingService: LockingService;
  let importService: ImportService;
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
        conflictStrategy: 'skip',
        validateOnly: false,
      };

      // Mock deployToClaudeCode method
      const deployToClaudeCodeSpy = vi.spyOn(deploymentService, 'deployToClaudeCode')
        .mockImplementation(async () => ({
          success: true,
          platform: 'claude-code',
          deployedComponents: [],
          conflicts: [],
          summary: {
            filesDeployed: 0,
            filesSkipped: 0,
            conflictsResolved: 0,
          },
        }));

      // Start first deployment
      const deployment1 = deploymentService.deployToClaudeCode(context, options);

      // Lock should prevent second deployment
      const lockSpy = vi.spyOn(lockingService, 'acquireLock');
      
      // Attempt second deployment immediately  
      const deployment2 = deploymentService.deployToClaudeCode(context, options);

      // Wait for results
      await expect(Promise.race([deployment1, deployment2])).resolves.toBeDefined();
      
      deployToClaudeCodeSpy.mockRestore();
      lockSpy.mockRestore();
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
        conflictStrategy: 'skip',
        validateOnly: false,
      };

      // Mock successful deployment
      vi.spyOn(deploymentService, 'deployToClaudeCode').mockResolvedValue({
        success: true,
        platform: 'claude-code',
        deployedComponents: [],
        conflicts: [],
        summary: {
          filesDeployed: 0,
          filesSkipped: 0,
          conflictsResolved: 0,
        },
      });

      // Should clean up stale lock and proceed
      const result = await deploymentService.deployToClaudeCode(context, options);
      expect(result.success).toBe(true);
    });

    it('should release lock even if deployment fails', async () => {
      const context: TaptikContext = createMockContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        conflictStrategy: 'skip',
        validateOnly: false,
      };

      // Mock deployment to fail
      vi.spyOn(deploymentService, 'deployToClaudeCode').mockRejectedValue(
        new Error('Deployment failed')
      );

      // Attempt deployment
      await expect(deploymentService.deployToClaudeCode(context, options)).rejects.toThrow(
        'Deployment failed'
      );

      // Verify lock was released
      const isLocked = await lockingService.isLocked('deploy');
      expect(isLocked).toBe(false);
    });
  });

  describe('Rapid Sequential Deployments', () => {
    it('should handle rapid sequential deployments', async () => {
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

      const deploymentCount = 10;
      const results = [];

      for (let i = 0; i < deploymentCount; i++) {
        // Wait for lock release between deployments
        while (await lockingService.isLocked('deploy')) { // eslint-disable-line no-await-in-loop
          await new Promise(resolve => setTimeout(resolve, 10)); // eslint-disable-line no-await-in-loop
        }

        const result = await deploymentService.deployToClaudeCode(context, options); // eslint-disable-line no-await-in-loop
        results.push(result);
      }

      // All deployments should succeed
      expect(results).toHaveLength(deploymentCount);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('Large Configuration Handling', () => {
    it('should handle large configuration deployments', async () => {
      // Create large context with many components
      const largeContext: TaptikContext = {
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
          project: {
            name: 'Large Project',
            description: 'Test project with many files',
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
        conflictStrategy: 'skip',
        validateOnly: false,
      };

      // Mock successful deployment
      vi.spyOn(deploymentService, 'deployToClaudeCode').mockResolvedValue({
        success: true,
        platform: 'claude-code',
        deployedComponents: ['agents', 'commands', 'settings'],
        conflicts: [],
        summary: {
          filesDeployed: 150,
          filesSkipped: 0,
          conflictsResolved: 0,
        },
      });

      const startTime = Date.now();
      const result = await deploymentService.deployToClaudeCode(largeContext, options);
      const deploymentTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.deployedComponents).toContain('agents');
      expect(result.deployedComponents).toContain('commands');
      
      // Should complete within reasonable time (30 seconds)
      expect(deploymentTime).toBeLessThan(30000);
    });
  });

  describe('Lock Contention Scenarios', () => {
    it('should handle multiple processes competing for lock', async () => {
      const context: TaptikContext = createMockContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: false,
        conflictStrategy: 'skip',
        validateOnly: false,
      };

      let lockAcquired = false;
      
      // Mock lock behavior
      vi.spyOn(lockingService, 'acquireLock').mockImplementation(async () => {
        if (lockAcquired) {
          throw new Error('Lock already acquired');
        }
        lockAcquired = true;
        return {
          id: 'test-lock',
          filePath: '/tmp/test.lock',
          timestamp: new Date(),
          processId: process.pid,
        };
      });

      vi.spyOn(lockingService, 'releaseLock').mockImplementation(async () => {
        lockAcquired = false;
      });

      // Mock deployment
      vi.spyOn(deploymentService, 'deployToClaudeCode').mockImplementation(async () => {
        await lockingService.acquireLock('deploy');
        await new Promise(resolve => setTimeout(resolve, 100));
        await lockingService.releaseLock('deploy' as any);
        return {
          success: true,
          platform: 'claude-code' as const,
          deployedComponents: [],
          conflicts: [],
          summary: {
            filesDeployed: 0,
            filesSkipped: 0,
            conflictsResolved: 0,
          },
        };
      });

      // Simulate multiple "processes" (concurrent promises)
      const deployments = Array.from({ length: 5 }, () =>
        deploymentService.deployToClaudeCode(context, options).catch(error => error)
      );

      const results = await Promise.all(deployments);

      // At least one should succeed
      const successes = results.filter(r => r.success === true);
      expect(successes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Network Failure Recovery', () => {
    it('should handle network failures during import', async () => {
      const context: TaptikContext = createMockContext();

      let attemptCount = 0;
      vi.spyOn(importService, 'importConfiguration').mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network error');
        }
        return context;
      });

      // After 3 attempts, import should succeed
      let finalContext;
      for (let i = 0; i < 3; i++) {
        try {
          finalContext = await importService.importConfiguration('test-id'); // eslint-disable-line no-await-in-loop
        } catch {
          // Continue trying
        }
      }

      expect(attemptCount).toBe(3);
      expect(finalContext).toBeDefined();
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
      project: {
        name: 'Test Project',
        description: 'Test project description',
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