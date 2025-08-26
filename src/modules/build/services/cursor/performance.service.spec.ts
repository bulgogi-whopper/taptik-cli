import { describe, it, expect, beforeEach } from 'vitest';

import { CursorPerformanceService } from './performance.service';

describe('CursorPerformanceService', () => {
  let service: CursorPerformanceService;

  beforeEach(() => {
    service = new CursorPerformanceService();
  });

  describe('processInParallel', () => {
    it('should process items in parallel batches', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = async (n: number) => n * 2;

      const results = await service.processInParallel(items, processor, 2);

      expect(results).toEqual([2, 4, 6, 8, 10]);
    });
  });

  describe('cache management', () => {
    it('should cache and retrieve values', () => {
      service.setCache('test', { value: 123 });
      
      const cached = service.getCached<any>('test');
      
      expect(cached).toEqual({ value: 123 });
    });

    it('should expire old cache entries', async () => {
      service.setCache('test', { value: 123 }, 100); // 100ms TTL
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const cached = service.getCached<any>('test');
      
      expect(cached).toBeNull();
    });

    it('should evict oldest when cache is full', () => {
      // Fill cache to max
      for (let i = 0; i < 100; i++) {
        service.setCache(`key${i}`, i);
      }
      
      // Add one more
      service.setCache('newkey', 'new');
      
      // First key should be evicted
      expect(service.getCached('key0')).toBeNull();
      expect(service.getCached('newkey')).toBe('new');
    });
  });

  describe('optimizeExtensionProcessing', () => {
    it('should cache extension processing results', async () => {
      const extensions = [
        { id: 'ext1', name: 'Extension 1' },
        { id: 'ext2', name: 'Extension 2' },
      ];

      const result1 = await service.optimizeExtensionProcessing(extensions);
      const result2 = await service.optimizeExtensionProcessing(extensions);

      expect(result1).toEqual(result2);
      expect(result1[0].processed).toBe(true);
      expect(result1[0].metadata).toBeDefined();
    });
  });

  describe('createLazyLoader', () => {
    it('should lazy load and cache result', async () => {
      let loadCount = 0;
      const loader = service.createLazyLoader(async () => {
        loadCount++;
        return { data: 'loaded' };
      });

      const result1 = await loader();
      const result2 = await loader();

      expect(result1).toEqual({ data: 'loaded' });
      expect(result2).toEqual({ data: 'loaded' });
      expect(loadCount).toBe(1); // Should only load once
    });
  });

  describe('validateInBatches', () => {
    it('should validate items in batches', async () => {
      const items = new Array(50).fill(null).map((_, i) => i);
      const validator = async (n: number) => n % 2 === 0;

      const results = await service.validateInBatches(items, validator);

      expect(results.length).toBe(50);
      expect(results[0]).toBe(true);  // 0 is even
      expect(results[1]).toBe(false); // 1 is odd
    });
  });

  describe('measurePerformance', () => {
    it('should measure performance metrics', () => {
      const startTime = Date.now() - 1000;
      
      const metrics = service.measurePerformance(startTime);
      
      expect(metrics.processingTime).toBeGreaterThanOrEqual(1000);
      expect(metrics.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('getMemoryReport', () => {
    it('should return memory usage report', () => {
      const report = service.getMemoryReport();
      
      expect(report.rss).toMatch(/\d+MB/);
      expect(report.heapUsed).toMatch(/\d+MB/);
      expect(report.cacheSize).toBeGreaterThanOrEqual(0);
    });
  });
});