import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ValidationResult } from '../../context/dto/validation-result.dto';
import { createMockTaptikContext } from '../services/test-helpers';

import { PerformanceOptimizer } from './performance-optimizer.utility';

describe('PerformanceOptimizer', () => {
  let optimizer: PerformanceOptimizer;

  beforeEach(() => {
    optimizer = new PerformanceOptimizer();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getCachedImport', () => {
    it('should return null for non-cached config', async () => {
      const result = await optimizer.getCachedImport('test-id');
      expect(result).toBeNull();
    });

    it('should return cached config if not expired', async () => {
      const mockContext = createMockTaptikContext();
      await optimizer.setCachedImport('test-id', mockContext);

      const result = await optimizer.getCachedImport('test-id');
      expect(result).toEqual(mockContext);
    });

    it('should return null for expired cache', async () => {
      const mockContext = createMockTaptikContext();
      await optimizer.setCachedImport('test-id', mockContext);

      // Fast forward time past TTL (5 minutes)
      vi.advanceTimersByTime(6 * 60 * 1000);

      const result = await optimizer.getCachedImport('test-id');
      expect(result).toBeNull();
    });
  });

  describe('setCachedImport', () => {
    it('should store context in cache', async () => {
      const mockContext = createMockTaptikContext();
      await optimizer.setCachedImport('test-id', mockContext);

      const result = await optimizer.getCachedImport('test-id');
      expect(result).toEqual(mockContext);
    });

    it('should update existing cache entry', async () => {
      const context1 = createMockTaptikContext();
      const context2 = createMockTaptikContext({
        metadata: {
          version: '2.0.0',
          exportedAt: new Date().toISOString(),
          sourceIde: 'kiro-ide',
          targetIdes: ['kiro-ide'],
        },
      });

      await optimizer.setCachedImport('test-id', context1);
      await optimizer.setCachedImport('test-id', context2);

      const result = await optimizer.getCachedImport('test-id');
      expect(result?.metadata?.version).toBe('2.0.0');
    });
  });

  describe('getCachedValidation', () => {
    it('should return null for non-cached validation', async () => {
      const result = await optimizer.getCachedValidation('test-key');
      expect(result).toBeNull();
    });

    it('should return cached validation if not expired', async () => {
      const mockValidation: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
      };

      await optimizer.setCachedValidation('test-key', mockValidation);

      const result = await optimizer.getCachedValidation('test-key');
      expect(result).toEqual(mockValidation);
    });

    it('should return null for expired validation cache', async () => {
      const mockValidation: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
      };

      await optimizer.setCachedValidation('test-key', mockValidation);

      // Fast forward time past TTL
      vi.advanceTimersByTime(6 * 60 * 1000);

      const result = await optimizer.getCachedValidation('test-key');
      expect(result).toBeNull();
    });
  });

  describe('parallelDeploy', () => {
    it('should deploy multiple components in parallel', async () => {
      const mockDeployments = [
        {
          type: 'settings',
          deploy: vi.fn().mockResolvedValue({ success: true }),
        },
        {
          type: 'agents',
          deploy: vi.fn().mockResolvedValue({ success: true }),
        },
        {
          type: 'commands',
          deploy: vi.fn().mockResolvedValue({ success: true }),
        },
      ];

      const results = await optimizer.parallelDeploy(mockDeployments as any);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      mockDeployments.forEach((d) => expect(d.deploy).toHaveBeenCalled());
    });

    it('should handle deployment failures', async () => {
      const mockDeployments = [
        {
          type: 'settings',
          deploy: vi.fn().mockResolvedValue({ success: true }),
        },
        {
          type: 'agents',
          deploy: vi.fn().mockRejectedValue(new Error('Deploy failed')),
        },
        {
          type: 'commands',
          deploy: vi.fn().mockResolvedValue({ success: true }),
        },
      ];

      const results = await optimizer.parallelDeploy(mockDeployments as any);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect((results[1] as any).error).toBe('Deploy failed');
      expect(results[2].success).toBe(true);
    });

    it('should respect max concurrency limit', async () => {
      vi.useFakeTimers();

      const resolvers: ((value: any) => void)[] = [];
      const deployFunction = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvers.push(resolve);
          }),
      );

      const mockDeployments = new Array(10).fill(null).map((_, i) => ({
        type: `component-${i}`,
        deploy: deployFunction,
      }));

      const promise = optimizer.parallelDeploy(mockDeployments as any);

      // Let the promise start executing
      await vi.runOnlyPendingTimersAsync();

      // With max concurrency of 5, first 5 should have been called
      expect(deployFunction).toHaveBeenCalledTimes(5);

      // Resolve first batch
      resolvers.slice(0, 5).forEach((resolve) => resolve({ success: true }));
      await vi.runOnlyPendingTimersAsync();

      // Now the next 5 should have been called
      expect(deployFunction).toHaveBeenCalledTimes(10);

      // Resolve remaining
      resolvers.slice(5).forEach((resolve) => resolve({ success: true }));

      await promise;
      expect(deployFunction).toHaveBeenCalledTimes(10);

      vi.useRealTimers();
    });
  });

  describe('streamLargeFile', () => {
    it('should return stream for files above threshold', async () => {
      const filePath = '/path/to/large/file.json';
      const threshold = 1024; // 1KB for testing

      const stream = await optimizer.streamLargeFile(filePath, threshold);

      expect(stream).toBeDefined();
      expect(stream).toBeInstanceOf(ReadableStream);
    });

    it('should handle stream creation errors', async () => {
      const filePath = '/invalid/path/file.json';
      const threshold = 1024;

      // The implementation should handle this gracefully
      const stream = await optimizer.streamLargeFile(filePath, threshold);
      expect(stream).toBeDefined();
    });
  });

  describe('clearCache', () => {
    it('should clear all cached imports', async () => {
      const context1 = createMockTaptikContext();
      const context2 = createMockTaptikContext();

      await optimizer.setCachedImport('test-1', context1);
      await optimizer.setCachedImport('test-2', context2);

      optimizer.clearCache();

      const result1 = await optimizer.getCachedImport('test-1');
      const result2 = await optimizer.getCachedImport('test-2');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it('should clear all cached validations', async () => {
      const validation: ValidationResult = {
        isValid: true,
        errors: [],
      };

      await optimizer.setCachedValidation('test-1', validation);
      await optimizer.setCachedValidation('test-2', validation);

      optimizer.clearCache();

      const result1 = await optimizer.getCachedValidation('test-1');
      const result2 = await optimizer.getCachedValidation('test-2');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });
});
