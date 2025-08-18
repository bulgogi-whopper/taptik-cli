import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { PerformanceMonitorService } from './performance-monitor.service';

describe('PerformanceMonitorService', () => {
  let service: PerformanceMonitorService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new PerformanceMonitorService();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('startDeploymentTiming', () => {
    it('should start timing for a deployment', () => {
      const deploymentId = 'test-deployment-123';
      
      service.startDeploymentTiming(deploymentId);
      
      const metrics = service.getDeploymentMetrics(deploymentId);
      expect(metrics).toBeDefined();
      expect(metrics.deploymentId).toBe(deploymentId);
      expect(metrics.startTime).toBeInstanceOf(Date);
      expect(metrics.endTime).toBeUndefined();
      expect(metrics.duration).toBeUndefined();
    });

    it('should track component timing', () => {
      const deploymentId = 'test-deployment-123';
      const component = 'settings';
      
      service.startDeploymentTiming(deploymentId);
      service.startComponentTiming(deploymentId, component);
      
      const metrics = service.getDeploymentMetrics(deploymentId);
      expect(metrics.componentMetrics).toHaveProperty(component);
      expect(metrics.componentMetrics[component].startTime).toBeInstanceOf(Date);
    });
  });

  describe('endDeploymentTiming', () => {
    it('should end timing and calculate duration', () => {
      const deploymentId = 'test-deployment-123';
      
      service.startDeploymentTiming(deploymentId);
      // Simulate some time passing
      vi.advanceTimersByTime(1000);
      service.endDeploymentTiming(deploymentId);
      
      const metrics = service.getDeploymentMetrics(deploymentId);
      expect(metrics.endTime).toBeInstanceOf(Date);
      expect(metrics.duration).toBeGreaterThan(0);
    });

    it('should handle ending timing for non-existent deployment', () => {
      expect(() => {
        service.endDeploymentTiming('non-existent');
      }).not.toThrow();
    });
  });

  describe('startComponentTiming', () => {
    it('should start component timing within deployment', () => {
      const deploymentId = 'test-deployment-123';
      const component = 'agents';
      
      service.startDeploymentTiming(deploymentId);
      service.startComponentTiming(deploymentId, component);
      
      const metrics = service.getDeploymentMetrics(deploymentId);
      expect(metrics.componentMetrics[component]).toBeDefined();
      expect(metrics.componentMetrics[component].startTime).toBeInstanceOf(Date);
    });

    it('should handle starting component timing for non-existent deployment', () => {
      expect(() => {
        service.startComponentTiming('non-existent', 'settings');
      }).not.toThrow();
    });
  });

  describe('endComponentTiming', () => {
    it('should end component timing and calculate duration', () => {
      const deploymentId = 'test-deployment-123';
      const component = 'commands';
      
      service.startDeploymentTiming(deploymentId);
      service.startComponentTiming(deploymentId, component);
      vi.advanceTimersByTime(500);
      service.endComponentTiming(deploymentId, component);
      
      const metrics = service.getDeploymentMetrics(deploymentId);
      expect(metrics.componentMetrics[component].endTime).toBeInstanceOf(Date);
      expect(metrics.componentMetrics[component].duration).toBeGreaterThan(0);
    });

    it('should handle ending component timing for non-existent deployment', () => {
      expect(() => {
        service.endComponentTiming('non-existent', 'settings');
      }).not.toThrow();
    });
  });

  describe('recordMemoryUsage', () => {
    it('should record memory usage snapshot', () => {
      const deploymentId = 'test-deployment-123';
      const stage = 'import';
      
      service.startDeploymentTiming(deploymentId);
      service.recordMemoryUsage(deploymentId, stage);
      
      const metrics = service.getDeploymentMetrics(deploymentId);
      expect(metrics.memorySnapshots).toHaveLength(1);
      expect(metrics.memorySnapshots[0].stage).toBe(stage);
      expect(metrics.memorySnapshots[0].heapUsed).toBeGreaterThan(0);
      expect(metrics.memorySnapshots[0].heapTotal).toBeGreaterThan(0);
    });

    it('should handle recording memory for non-existent deployment', () => {
      expect(() => {
        service.recordMemoryUsage('non-existent', 'validation');
      }).not.toThrow();
    });
  });

  describe('getPerformanceSummary', () => {
    it('should generate performance summary', () => {
      const deploymentId = 'test-deployment-123';
      
      service.startDeploymentTiming(deploymentId);
      service.startComponentTiming(deploymentId, 'settings');
      service.recordMemoryUsage(deploymentId, 'import');
      vi.advanceTimersByTime(1000);
      service.endComponentTiming(deploymentId, 'settings');
      service.endDeploymentTiming(deploymentId);
      
      const summary = service.getPerformanceSummary(deploymentId);
      expect(summary).toBeDefined();
      expect(summary.deploymentId).toBe(deploymentId);
      expect(summary.totalDuration).toBeGreaterThan(0);
      expect(summary.componentCount).toBe(1);
      expect(summary.memorySnapshots).toBeGreaterThan(0);
    });

    it('should return null for non-existent deployment', () => {
      const summary = service.getPerformanceSummary('non-existent');
      expect(summary).toBeNull();
    });
  });

  describe('checkPerformanceThresholds', () => {
    it('should identify slow deployments', () => {
      const deploymentId = 'test-deployment-123';
      
      service.startDeploymentTiming(deploymentId);
      // Simulate long deployment
      vi.advanceTimersByTime(35000); // 35 seconds
      service.endDeploymentTiming(deploymentId);
      
      const violations = service.checkPerformanceThresholds(deploymentId);
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('slow_deployment');
    });

    it('should identify high memory usage', () => {
      const deploymentId = 'test-deployment-123';
      const mockMemoryUsage = vi.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 1024 * 1024 * 1024, // 1GB
        heapTotal: 512 * 1024 * 1024, // 512MB  
        heapUsed: 256 * 1024 * 1024, // 256MB
        external: 0,
        arrayBuffers: 0,
      });
      
      service.startDeploymentTiming(deploymentId);
      service.recordMemoryUsage(deploymentId, 'import');
      
      const violations = service.checkPerformanceThresholds(deploymentId);
      expect(violations.some(v => v.type === 'high_memory_usage')).toBe(true);
      
      mockMemoryUsage.mockRestore();
    });

    it('should return empty array for good performance', () => {
      const deploymentId = 'test-deployment-123';
      
      service.startDeploymentTiming(deploymentId);
      vi.advanceTimersByTime(5000); // 5 seconds
      service.endDeploymentTiming(deploymentId);
      
      const violations = service.checkPerformanceThresholds(deploymentId);
      expect(violations).toHaveLength(0);
    });
  });

  describe('generatePerformanceReport', () => {
    it('should generate comprehensive performance report', () => {
      const deploymentId = 'test-deployment-123';
      
      service.startDeploymentTiming(deploymentId);
      service.startComponentTiming(deploymentId, 'settings');
      service.startComponentTiming(deploymentId, 'agents');
      service.recordMemoryUsage(deploymentId, 'import');
      service.recordMemoryUsage(deploymentId, 'validation');
      
      vi.advanceTimersByTime(2000);
      service.endComponentTiming(deploymentId, 'settings');
      vi.advanceTimersByTime(1000);
      service.endComponentTiming(deploymentId, 'agents');
      service.endDeploymentTiming(deploymentId);
      
      const report = service.generatePerformanceReport(deploymentId);
      expect(report).toContain('Performance Report');
      expect(report).toContain(deploymentId);
      expect(report).toContain('Total Duration:');
      expect(report).toContain('Component Breakdown:');
      expect(report).toContain('Memory Usage:');
    });

    it('should return error message for non-existent deployment', () => {
      const report = service.generatePerformanceReport('non-existent');
      expect(report).toContain('No performance data found');
    });
  });

  describe('clearMetrics', () => {
    it('should clear metrics for specific deployment', () => {
      const deploymentId = 'test-deployment-123';
      
      service.startDeploymentTiming(deploymentId);
      service.clearMetrics(deploymentId);
      
      const metrics = service.getDeploymentMetrics(deploymentId);
      expect(metrics).toBeUndefined();
    });

    it('should clear all metrics when no deploymentId provided', () => {
      service.startDeploymentTiming('deployment-1');
      service.startDeploymentTiming('deployment-2');
      
      service.clearMetrics();
      
      expect(service.getDeploymentMetrics('deployment-1')).toBeUndefined();
      expect(service.getDeploymentMetrics('deployment-2')).toBeUndefined();
    });
  });

  describe('getBaselineMetrics', () => {
    it('should return baseline performance thresholds', () => {
      const baselines = service.getBaselineMetrics();
      expect(baselines).toBeDefined();
      expect(baselines.maxDeploymentDuration).toBeGreaterThan(0);
      expect(baselines.maxMemoryUsage).toBeGreaterThan(0);
      expect(baselines.maxComponentDuration).toBeGreaterThan(0);
    });
  });
});