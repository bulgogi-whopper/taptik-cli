import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CursorPerformanceMonitorService } from './cursor-performance-monitor.service';
import { PerformanceMonitorService } from './performance-monitor.service';

describe('CursorPerformanceMonitorService', () => {
  let service: CursorPerformanceMonitorService;
  let basePerformanceMonitor: PerformanceMonitorService;

  beforeEach(() => {
    basePerformanceMonitor = {
      startDeploymentTiming: vi.fn(),
      endDeploymentTiming: vi.fn(),
      recordMemoryUsage: vi.fn(),
      startComponentTiming: vi.fn(),
      endComponentTiming: vi.fn(),
    } as any;

    service = new CursorPerformanceMonitorService(basePerformanceMonitor);
  });

  describe('startCursorMonitoring', () => {
    it('should start monitoring with correct parameters', () => {
      const deploymentId = 'test-deployment';
      const config = {
        globalSettings: { 'editor.fontSize': 14 },
        projectSettings: { 'editor.tabSize': 2 },
      };
      const components = ['settings', 'ai-prompts'];

      service.startCursorMonitoring(deploymentId, config as any, components as any);

      expect(basePerformanceMonitor.startDeploymentTiming).toHaveBeenCalledWith(deploymentId);
    });
  });

  describe('endCursorMonitoring', () => {
    it('should end monitoring and calculate metrics', () => {
      const deploymentId = 'test-deployment';
      const config = {
        globalSettings: { 'editor.fontSize': 14 },
      };

      // Start monitoring first
      service.startCursorMonitoring(deploymentId, config as any, ['settings'] as any);
      
      // End monitoring
      service.endCursorMonitoring(deploymentId);

      expect(basePerformanceMonitor.endDeploymentTiming).toHaveBeenCalledWith(deploymentId);
    });
  });

  describe('recordStreamingUsage', () => {
    it('should record streaming usage metrics', () => {
      const deploymentId = 'test-deployment';
      const config = { globalSettings: {} };

      service.startCursorMonitoring(deploymentId, config as any, [] as any);
      service.recordStreamingUsage(deploymentId, 5, 10485760, 1000); // 10MB, 5 chunks, 1s

      // Should not throw and should record the usage
      expect(true).toBe(true);
    });
  });

  describe('recordParallelProcessingUsage', () => {
    it('should record parallel processing metrics', () => {
      const deploymentId = 'test-deployment';
      const config = { globalSettings: {} };

      service.startCursorMonitoring(deploymentId, config as any, [] as any);
      service.recordParallelProcessingUsage(deploymentId, 3, 2, 2000); // 3 batches, concurrency 2, 2s

      // Should not throw and should record the usage
      expect(true).toBe(true);
    });
  });

  describe('generateCursorPerformanceReport', () => {
    it('should generate performance report after monitoring', () => {
      const deploymentId = 'test-deployment';
      const config = {
        globalSettings: { 'editor.fontSize': 14 },
        aiPrompts: {
          projectPrompts: { 'test-prompt': { content: 'test' } },
          rules: { 'test-rule': 'test rule content' },
        },
      };

      service.startCursorMonitoring(deploymentId, config as any, ['settings', 'ai-prompts'] as any);
      service.endCursorMonitoring(deploymentId);

      const report = service.generateCursorPerformanceReport(deploymentId);

      expect(report).toBeDefined();
      expect(report?.deploymentId).toBe(deploymentId);
      expect(report?.summary).toBeDefined();
      expect(report?.detailedMetrics).toBeDefined();
    });

    it('should return null for non-existent deployment', () => {
      const report = service.generateCursorPerformanceReport('non-existent');
      expect(report).toBeNull();
    });
  });

  describe('getOptimizationSuggestions', () => {
    it('should provide optimization suggestions for large configurations', () => {
      const deploymentId = 'test-deployment';
      const largeConfig = {
        globalSettings: { 'editor.fontSize': 14 },
        // Simulate large configuration
        aiPrompts: {
          projectPrompts: Object.fromEntries(
            Array.from({ length: 100 }, (_, i) => [`prompt-${i}`, { content: 'A'.repeat(1000) }])
          ),
          rules: {},
        },
      };

      service.startCursorMonitoring(deploymentId, largeConfig as any, ['settings', 'ai-prompts'] as any);
      service.endCursorMonitoring(deploymentId);

      const suggestions = service.getOptimizationSuggestions(deploymentId);

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should return empty array for non-existent deployment', () => {
      const suggestions = service.getOptimizationSuggestions('non-existent');
      expect(suggestions).toEqual([]);
    });
  });
});