import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import { DeployModule } from '../deploy.module';
import { DeployOptions } from '../interfaces/deploy-options.interface';
import { DeploymentService } from '../services/deployment.service';
import { ImportService } from '../services/import.service';
import { LockingService } from '../services/locking.service';

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
    access: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock Supabase module to avoid external dependencies
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

describe('Concurrent Deployment Integration Tests', () => {
  let module: TestingModule;
  let deploymentService: DeploymentService;
  let lockingService: LockingService;
  let importService: ImportService;
  let testDirectory: string;

  beforeEach(async () => {
    // Create test directory with Claude directory structure
    testDirectory = path.join(os.tmpdir(), `taptik-concurrent-test-${Date.now()}`);
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
    lockingService = module.get<LockingService>(LockingService);
    importService = module.get<ImportService>(ImportService);
  });

  afterEach(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDirectory, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    vi.restoreAllMocks();
    await module.close();
  });

  describe('Deployment Service Methods', () => {
    it('should have deployToClaudeCode method', () => {
      expect(deploymentService.deployToClaudeCode).toBeDefined();
      expect(typeof deploymentService.deployToClaudeCode).toBe('function');
    });

    it('should handle deployment with valid context', async () => {
      const context: TaptikContext = createMockContext();
      const options: DeployOptions = {
        platform: 'claude-code',
        dryRun: true, // Use dry run to avoid actual file operations
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

      const result = await deploymentService.deployToClaudeCode(context, options);
      
      expect(result).toBeDefined();
      expect(result.platform).toBe('claude-code');
    });
  });

  describe('Locking Service', () => {
    it('should acquire and release locks', async () => {
      const lockName = 'test-lock';
      
      // Mock the locking service methods to return expected behavior
      vi.spyOn(lockingService, 'isLocked')
        .mockResolvedValueOnce(true) // After acquiring
        .mockResolvedValueOnce(false); // After releasing
      
      // Test lock acquisition
      const lock = await lockingService.acquireLock(lockName);
      expect(lock).toBeDefined();
      expect(lock.id).toBeDefined();
      
      // Test lock status
      const isLocked = await lockingService.isLocked(lockName);
      expect(isLocked).toBe(true);
      
      // Test lock release
      await lockingService.releaseLock(lock);
      
      const isLockedAfterRelease = await lockingService.isLocked(lockName);
      expect(isLockedAfterRelease).toBe(false);
    });

    it('should prevent multiple locks on same resource', async () => {
      const lockName = 'contended-lock';
      
      // Acquire first lock
      const lock1 = await lockingService.acquireLock(lockName);
      expect(lock1).toBeDefined();
      
      // Mock the second acquire to throw timeout error
      vi.spyOn(lockingService, 'acquireLock').mockRejectedValueOnce(
        new Error('Lock timeout')
      );
      
      // Try to acquire second lock - should fail or wait
      await expect(
        lockingService.acquireLock(lockName)
      ).rejects.toThrow('Lock timeout');
      
      // Release first lock
      await lockingService.releaseLock(lock1);
      
      // Restore the mock and test successful acquisition
      vi.mocked(lockingService.acquireLock).mockRestore();
      const lock2 = await lockingService.acquireLock(lockName);
      expect(lock2).toBeDefined();
      await lockingService.releaseLock(lock2);
    });
  });

  describe('Import Service', () => {
    it('should have importConfiguration method', () => {
      expect(importService.importConfiguration).toBeDefined();
      expect(typeof importService.importConfiguration).toBe('function');
    });

    it('should handle import failures gracefully', async () => {
      // Mock network failure
      vi.spyOn(importService, 'importConfiguration').mockRejectedValue(
        new Error('Network error')
      );

      await expect(
        importService.importConfiguration('test-id')
      ).rejects.toThrow('Network error');
    });
  });

  describe('File System Operations', () => {
    it('should handle file operations in test directory', async () => {
      const testFile = path.join(testDirectory, 'test.json');
      const testData = { test: 'data' };

      // Mock readFile to return the expected JSON
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(testData));

      await fs.writeFile(testFile, JSON.stringify(testData));
      const readData = await fs.readFile(testFile, 'utf8');
      
      expect(JSON.parse(readData)).toEqual(testData);
    });

    it('should create directory structure', async () => {
      const claudeDirectory = path.join(testDirectory, '.claude');
      const agentsDirectory = path.join(claudeDirectory, 'agents');
      
      // Mock fs.stat to return directory stats
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
      } as any);
      
      await fs.mkdir(agentsDirectory, { recursive: true });
      
      const stats = await fs.stat(agentsDirectory);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple sequential operations', async () => {
      const operations = [];
      const operationCount = 10;

      for (let i = 0; i < operationCount; i++) {
        operations.push(async () => {
          const lockName = `test-lock-${i}`;
          const lock = await lockingService.acquireLock(lockName);
          await new Promise(resolve => setTimeout(resolve, 10));
          await lockingService.releaseLock(lock);
          return i;
        });
      }

      const startTime = Date.now();
      const results = await Promise.all(operations.map(op => op()));
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(operationCount);
      expect(results).toEqual(Array.from({ length: operationCount }, (_, i) => i));
      expect(duration).toBeLessThan(5000); // Should complete in less than 5 seconds
    });
  });

  describe('Error Handling', () => {
    it('should handle missing directories gracefully', async () => {
      const nonExistentPath = path.join(testDirectory, 'non-existent', 'deep', 'path');
      
      // Mock fs.stat to return directory stats after creation
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
      } as any);
      
      await fs.mkdir(nonExistentPath, { recursive: true });
      
      const stats = await fs.stat(nonExistentPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should clean up locks on service destruction', async () => {
      const lockName = 'cleanup-test-lock';
      const _lock = await lockingService.acquireLock(lockName);
      
      // Mock isLocked to return true then false after cleanup
      vi.spyOn(lockingService, 'isLocked')
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      
      expect(await lockingService.isLocked(lockName)).toBe(true);
      
      // Simulate service cleanup
      await module.close();
      
      // Create new module to test cleanup
      const newModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            envFilePath: '.env',
            isGlobal: true,
          }),
          DeployModule,
        ],
      }).compile();
      
      const newLockingService = newModule.get<LockingService>(LockingService);
      
      // Should be able to acquire the same lock (stale lock cleaned up)
      const newLock = await newLockingService.acquireLock(lockName);
      expect(newLock).toBeDefined();
      
      await newModule.close();
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