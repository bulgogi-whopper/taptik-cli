import { Injectable, Logger } from '@nestjs/common';

import { ComponentType } from '../interfaces/component-types.interface';

export interface ComponentMetrics {
  startTime: Date;
  endTime?: Date;
  duration?: number; // in milliseconds
}

export interface MemorySnapshot {
  stage: string;
  timestamp: Date;
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
}

export interface DeploymentMetrics {
  deploymentId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // in milliseconds
  componentMetrics: Record<ComponentType, ComponentMetrics>;
  memorySnapshots: MemorySnapshot[];
}

export interface PerformanceSummary {
  deploymentId: string;
  totalDuration: number;
  componentCount: number;
  memorySnapshots: number;
  averageMemoryUsage: number;
  peakMemoryUsage: number;
  slowestComponent?: {
    name: ComponentType;
    duration: number;
  };
}

export interface PerformanceViolation {
  type: 'slow_deployment' | 'slow_component' | 'high_memory_usage';
  severity: 'warning' | 'error';
  message: string;
  value: number;
  threshold: number;
}

export interface BaselineMetrics {
  maxDeploymentDuration: number; // 30 seconds
  maxComponentDuration: number; // 10 seconds
  maxMemoryUsage: number; // 200MB
}

@Injectable()
export class PerformanceMonitorService {
  private readonly logger = new Logger(PerformanceMonitorService.name);
  private readonly deploymentMetrics = new Map<string, DeploymentMetrics>();

  // Performance thresholds
  private readonly baselines: BaselineMetrics = {
    maxDeploymentDuration: 30000, // 30 seconds
    maxComponentDuration: 10000, // 10 seconds
    maxMemoryUsage: 200 * 1024 * 1024, // 200MB
  };

  /**
   * Start timing for a deployment
   */
  startDeploymentTiming(deploymentId: string): void {
    const startTime = new Date();

    this.deploymentMetrics.set(deploymentId, {
      deploymentId,
      startTime,
      componentMetrics: {} as Record<ComponentType, ComponentMetrics>,
      memorySnapshots: [],
    });

    this.logger.debug(`Started timing for deployment: ${deploymentId}`);
  }

  /**
   * End timing for a deployment
   */
  endDeploymentTiming(deploymentId: string): void {
    const metrics = this.deploymentMetrics.get(deploymentId);
    if (!metrics) {
      this.logger.warn(`No metrics found for deployment: ${deploymentId}`);
      return;
    }

    const endTime = new Date();
    const duration = endTime.getTime() - metrics.startTime.getTime();

    metrics.endTime = endTime;
    metrics.duration = duration;

    this.logger.debug(
      `Ended timing for deployment: ${deploymentId} (${duration}ms)`,
    );
  }

  /**
   * Start timing for a component within a deployment
   */
  startComponentTiming(deploymentId: string, component: ComponentType): void {
    const metrics = this.deploymentMetrics.get(deploymentId);
    if (!metrics) {
      this.logger.warn(`No deployment metrics found for: ${deploymentId}`);
      return;
    }

    const startTime = new Date();
    metrics.componentMetrics[component] = {
      startTime,
    };

    this.logger.debug(
      `Started timing for component: ${component} in deployment: ${deploymentId}`,
    );
  }

  /**
   * End timing for a component within a deployment
   */
  endComponentTiming(deploymentId: string, component: ComponentType): void {
    const metrics = this.deploymentMetrics.get(deploymentId);
    if (!metrics) {
      this.logger.warn(`No deployment metrics found for: ${deploymentId}`);
      return;
    }

    const componentMetrics = metrics.componentMetrics[component];
    if (!componentMetrics) {
      this.logger.warn(
        `No component metrics found for: ${component} in deployment: ${deploymentId}`,
      );
      return;
    }

    const endTime = new Date();
    const duration = endTime.getTime() - componentMetrics.startTime.getTime();

    componentMetrics.endTime = endTime;
    componentMetrics.duration = duration;

    this.logger.debug(
      `Ended timing for component: ${component} in deployment: ${deploymentId} (${duration}ms)`,
    );
  }

  /**
   * Record memory usage at a specific stage
   */
  recordMemoryUsage(deploymentId: string, stage: string): void {
    const metrics = this.deploymentMetrics.get(deploymentId);
    if (!metrics) {
      this.logger.warn(`No deployment metrics found for: ${deploymentId}`);
      return;
    }

    const memoryUsage = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      stage,
      timestamp: new Date(),
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      rss: memoryUsage.rss,
      external: memoryUsage.external,
    };

    metrics.memorySnapshots.push(snapshot);

    this.logger.debug(
      `Recorded memory usage for ${stage}: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
    );
  }

  /**
   * Get metrics for a specific deployment
   */
  getDeploymentMetrics(deploymentId: string): DeploymentMetrics | undefined {
    return this.deploymentMetrics.get(deploymentId);
  }

  /**
   * Generate performance summary for a deployment
   */
  getPerformanceSummary(deploymentId: string): PerformanceSummary | null {
    const metrics = this.deploymentMetrics.get(deploymentId);
    if (!metrics) {
      return null;
    }

    const componentCount = Object.keys(metrics.componentMetrics).length;
    const memorySnapshots = metrics.memorySnapshots.length;

    // Calculate memory statistics
    const memoryUsages = metrics.memorySnapshots.map((s) => s.heapUsed);
    const averageMemoryUsage =
      memoryUsages.length > 0
        ? memoryUsages.reduce((sum, usage) => sum + usage, 0) /
          memoryUsages.length
        : 0;
    const peakMemoryUsage =
      memoryUsages.length > 0 ? Math.max(...memoryUsages) : 0;

    // Find slowest component
    let slowestComponent: PerformanceSummary['slowestComponent'];
    let maxDuration = 0;

    for (const [name, componentMetrics] of Object.entries(
      metrics.componentMetrics,
    )) {
      if (
        componentMetrics.duration &&
        componentMetrics.duration > maxDuration
      ) {
        maxDuration = componentMetrics.duration;
        slowestComponent = {
          name: name as ComponentType,
          duration: componentMetrics.duration,
        };
      }
    }

    return {
      deploymentId,
      totalDuration: metrics.duration || 0,
      componentCount,
      memorySnapshots,
      averageMemoryUsage,
      peakMemoryUsage,
      slowestComponent,
    };
  }

  /**
   * Check performance against baseline thresholds
   */
  checkPerformanceThresholds(deploymentId: string): PerformanceViolation[] {
    const metrics = this.deploymentMetrics.get(deploymentId);
    if (!metrics) {
      return [];
    }

    const violations: PerformanceViolation[] = [];

    // Check total deployment duration
    if (
      metrics.duration &&
      metrics.duration > this.baselines.maxDeploymentDuration
    ) {
      violations.push({
        type: 'slow_deployment',
        severity: 'warning',
        message: `Deployment took ${Math.round(metrics.duration / 1000)}s (threshold: ${Math.round(this.baselines.maxDeploymentDuration / 1000)}s)`,
        value: metrics.duration,
        threshold: this.baselines.maxDeploymentDuration,
      });
    }

    // Check component durations
    for (const [component, componentMetrics] of Object.entries(
      metrics.componentMetrics,
    )) {
      if (
        componentMetrics.duration &&
        componentMetrics.duration > this.baselines.maxComponentDuration
      ) {
        violations.push({
          type: 'slow_component',
          severity: 'warning',
          message: `Component ${component} took ${Math.round(componentMetrics.duration / 1000)}s (threshold: ${Math.round(this.baselines.maxComponentDuration / 1000)}s)`,
          value: componentMetrics.duration,
          threshold: this.baselines.maxComponentDuration,
        });
      }
    }

    // Check peak memory usage
    const memoryUsages = metrics.memorySnapshots.map((s) => s.heapUsed);
    const peakMemory = memoryUsages.length > 0 ? Math.max(...memoryUsages) : 0;

    if (peakMemory > this.baselines.maxMemoryUsage) {
      violations.push({
        type: 'high_memory_usage',
        severity: 'warning',
        message: `Peak memory usage: ${Math.round(peakMemory / 1024 / 1024)}MB (threshold: ${Math.round(this.baselines.maxMemoryUsage / 1024 / 1024)}MB)`,
        value: peakMemory,
        threshold: this.baselines.maxMemoryUsage,
      });
    }

    return violations;
  }

  /**
   * Generate a human-readable performance report
   */
  generatePerformanceReport(deploymentId: string): string {
    const metrics = this.deploymentMetrics.get(deploymentId);
    if (!metrics) {
      return `No performance data found for deployment: ${deploymentId}`;
    }

    const summary = this.getPerformanceSummary(deploymentId);
    const violations = this.checkPerformanceThresholds(deploymentId);

    let report = `\n=== Performance Report for ${deploymentId} ===\n\n`;

    // Basic metrics
    if (summary) {
      report += `Total Duration: ${Math.round(summary.totalDuration / 1000)}s\n`;
      report += `Components Deployed: ${summary.componentCount}\n`;
      report += `Memory Snapshots: ${summary.memorySnapshots}\n`;
      report += `Average Memory: ${Math.round(summary.averageMemoryUsage / 1024 / 1024)}MB\n`;
      report += `Peak Memory: ${Math.round(summary.peakMemoryUsage / 1024 / 1024)}MB\n`;

      if (summary.slowestComponent) {
        report += `Slowest Component: ${summary.slowestComponent.name} (${Math.round(summary.slowestComponent.duration / 1000)}s)\n`;
      }
    }

    // Component breakdown
    report += `\nComponent Breakdown:\n`;
    for (const [component, componentMetrics] of Object.entries(
      metrics.componentMetrics,
    )) {
      const duration = componentMetrics.duration
        ? `${Math.round(componentMetrics.duration / 1000)}s`
        : 'incomplete';
      report += `  - ${component}: ${duration}\n`;
    }

    // Memory usage over time
    if (metrics.memorySnapshots.length > 0) {
      report += `\nMemory Usage:\n`;
      for (const snapshot of metrics.memorySnapshots) {
        const memoryMB = Math.round(snapshot.heapUsed / 1024 / 1024);
        report += `  - ${snapshot.stage}: ${memoryMB}MB\n`;
      }
    }

    // Performance violations
    if (violations.length > 0) {
      report += `\nPerformance Issues:\n`;
      for (const violation of violations) {
        report += `  - ${violation.severity.toUpperCase()}: ${violation.message}\n`;
      }
    } else {
      report += `\nPerformance: All metrics within acceptable thresholds\n`;
    }

    report += `\n=== End Report ===\n`;

    return report;
  }

  /**
   * Clear metrics for a specific deployment or all deployments
   */
  clearMetrics(deploymentId?: string): void {
    if (deploymentId) {
      this.deploymentMetrics.delete(deploymentId);
      this.logger.debug(`Cleared metrics for deployment: ${deploymentId}`);
    } else {
      this.deploymentMetrics.clear();
      this.logger.debug('Cleared all deployment metrics');
    }
  }

  /**
   * Get baseline performance thresholds
   */
  getBaselineMetrics(): BaselineMetrics {
    return { ...this.baselines };
  }

  /**
   * Update baseline thresholds (for testing or configuration)
   */
  updateBaselines(baselines: Partial<BaselineMetrics>): void {
    Object.assign(this.baselines, baselines);
    this.logger.debug('Updated performance baselines', baselines);
  }
}
