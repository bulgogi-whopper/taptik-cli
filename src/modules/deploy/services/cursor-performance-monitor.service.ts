import { Injectable, Logger } from '@nestjs/common';

import { CursorComponentType, ComponentType } from '../interfaces/component-types.interface';
import { CursorConfiguration } from '../interfaces/cursor-config.interface';

import { PerformanceMonitorService } from './performance-monitor.service';

export interface CursorPerformanceMetrics {
  deploymentId: string;
  startTime: Date;
  endTime?: Date;
  totalDuration?: number;
  
  // Configuration analysis
  configurationSize: number; // bytes
  componentCount: number;
  estimatedComplexity: number; // 0-1 scale
  
  // Processing metrics
  streamingUsed: boolean;
  parallelProcessingUsed: boolean;
  chunksProcessed?: number;
  batchesProcessed?: number;
  
  // Performance breakdown
  componentMetrics: Record<CursorComponentType, CursorComponentMetrics>;
  
  // Resource usage
  memorySnapshots: CursorMemorySnapshot[];
  peakMemoryUsage: number;
  averageMemoryUsage: number;
  
  // Optimization metrics
  optimizationTriggers: OptimizationTrigger[];
  performanceIssues: CursorPerformanceIssue[];
  
  // Recommendations
  recommendations: PerformanceRecommendation[];
}

export interface CursorComponentMetrics {
  component: CursorComponentType;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  
  // Component-specific metrics
  filesProcessed: number;
  filesDeployed: number;
  averageFileSize: number;
  largestFileSize: number;
  
  // Processing method used
  processingMethod: 'sequential' | 'parallel' | 'streaming';
  
  // Performance characteristics
  throughput: number; // files per second
  memoryEfficiency: number; // bytes per file
  
  // Issues and optimizations
  issues: string[];
  optimizations: string[];
}

export interface CursorMemorySnapshot {
  timestamp: Date;
  stage: string;
  component?: CursorComponentType;
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  
  // Cursor-specific memory tracking
  configurationMemory?: number;
  streamingBuffers?: number;
  parallelProcessingOverhead?: number;
}

export interface OptimizationTrigger {
  timestamp: Date;
  trigger: 'memory_threshold' | 'processing_time' | 'file_size' | 'component_count';
  value: number;
  threshold: number;
  action: string;
  result: 'success' | 'failure' | 'partial';
}

export interface CursorPerformanceIssue {
  type: 'memory' | 'processing_time' | 'throughput' | 'resource_usage';
  severity: 'low' | 'medium' | 'high' | 'critical';
  component?: CursorComponentType;
  description: string;
  impact: string;
  recommendation: string;
  metrics: Record<string, number>;
}

export interface PerformanceRecommendation {
  category: 'configuration' | 'processing' | 'memory' | 'optimization';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  expectedImprovement: string;
  implementationEffort: 'low' | 'medium' | 'high';
  applicableScenarios: string[];
}

export interface CursorPerformanceReport {
  deploymentId: string;
  summary: CursorPerformanceSummary;
  detailedMetrics: CursorPerformanceMetrics;
  recommendations: PerformanceRecommendation[];
  comparisonWithBaseline?: PerformanceComparison;
}

export interface CursorPerformanceSummary {
  overallRating: 'excellent' | 'good' | 'fair' | 'poor';
  totalDuration: number;
  throughput: number; // files per second
  memoryEfficiency: number; // MB per component
  optimizationScore: number; // 0-100
  
  // Key metrics
  componentsDeployed: number;
  filesProcessed: number;
  peakMemoryUsage: number;
  
  // Performance highlights
  fastestComponent: string;
  slowestComponent: string;
  mostMemoryEfficientComponent: string;
  
  // Issues summary
  criticalIssues: number;
  warnings: number;
  optimizationsApplied: number;
}

export interface PerformanceComparison {
  baselineDeploymentId?: string;
  improvements: {
    durationImprovement: number; // percentage
    memoryImprovement: number; // percentage
    throughputImprovement: number; // percentage
  };
  regressions: {
    durationRegression: number;
    memoryRegression: number;
    throughputRegression: number;
  };
}

@Injectable()
export class CursorPerformanceMonitorService {
  private readonly logger = new Logger(CursorPerformanceMonitorService.name);
  
  // Performance tracking
  private readonly cursorMetrics = new Map<string, CursorPerformanceMetrics>();
  private readonly baselineMetrics = new Map<string, CursorPerformanceMetrics>();
  
  // Performance thresholds for Cursor deployments
  private readonly CURSOR_THRESHOLDS = {
    maxDeploymentDuration: 45000, // 45 seconds (higher than general due to AI processing)
    maxComponentDuration: 15000, // 15 seconds
    maxMemoryUsage: 300 * 1024 * 1024, // 300MB (higher for AI content)
    minThroughput: 2, // files per second
    maxConfigurationSize: 50 * 1024 * 1024, // 50MB
    optimalBatchSize: 5,
    optimalConcurrency: 3,
  };

  constructor(
    private readonly basePerformanceMonitor: PerformanceMonitorService,
  ) {}

  /**
   * Start Cursor-specific performance monitoring
   */
  startCursorMonitoring(
    deploymentId: string,
    config: CursorConfiguration,
    components: CursorComponentType[],
  ): void {
    const startTime = new Date();
    
    const metrics: CursorPerformanceMetrics = {
      deploymentId,
      startTime,
      configurationSize: this.calculateConfigurationSize(config),
      componentCount: components.length,
      estimatedComplexity: this.calculateComplexity(config, components),
      streamingUsed: false,
      parallelProcessingUsed: false,
      componentMetrics: {} as Record<CursorComponentType, CursorComponentMetrics>,
      memorySnapshots: [],
      peakMemoryUsage: 0,
      averageMemoryUsage: 0,
      optimizationTriggers: [],
      performanceIssues: [],
      recommendations: [],
    };

    this.cursorMetrics.set(deploymentId, metrics);
    
    // Also start base monitoring
    this.basePerformanceMonitor.startDeploymentTiming(deploymentId);
    this.recordCursorMemorySnapshot(deploymentId, 'deployment-start');

    this.logger.debug(`Started Cursor performance monitoring for deployment: ${deploymentId}`);
  }

  /**
   * End Cursor-specific performance monitoring
   */
  endCursorMonitoring(deploymentId: string): void {
    const metrics = this.cursorMetrics.get(deploymentId);
    if (!metrics) {
      this.logger.warn(`No Cursor metrics found for deployment: ${deploymentId}`);
      return;
    }

    const endTime = new Date();
    metrics.endTime = endTime;
    metrics.totalDuration = endTime.getTime() - metrics.startTime.getTime();

    // Calculate final metrics
    this.calculateFinalMetrics(metrics);
    
    // Generate performance issues and recommendations
    this.analyzePerformanceIssues(metrics);
    this.generateRecommendations(metrics);

    // End base monitoring
    this.basePerformanceMonitor.endDeploymentTiming(deploymentId);
    this.recordCursorMemorySnapshot(deploymentId, 'deployment-end');

    this.logger.debug(`Ended Cursor performance monitoring for deployment: ${deploymentId}`);
  }

  /**
   * Record that streaming processing was used
   */
  recordStreamingUsage(
    deploymentId: string,
    chunksProcessed: number,
    totalSize: number,
    _processingTime: number,
  ): void {
    const metrics = this.cursorMetrics.get(deploymentId);
    if (!metrics) return;

    metrics.streamingUsed = true;
    metrics.chunksProcessed = chunksProcessed;

    this.recordOptimizationTrigger(deploymentId, {
      timestamp: new Date(),
      trigger: 'file_size',
      value: totalSize,
      threshold: this.CURSOR_THRESHOLDS.maxConfigurationSize,
      action: 'streaming_processing_enabled',
      result: 'success',
    });

    this.logger.debug(`Recorded streaming usage for deployment: ${deploymentId}`);
  }

  /**
   * Record that parallel processing was used
   */
  recordParallelProcessingUsage(
    deploymentId: string,
    batchesProcessed: number,
    concurrency: number,
    _totalProcessingTime: number,
  ): void {
    const metrics = this.cursorMetrics.get(deploymentId);
    if (!metrics) return;

    metrics.parallelProcessingUsed = true;
    metrics.batchesProcessed = batchesProcessed;

    this.recordOptimizationTrigger(deploymentId, {
      timestamp: new Date(),
      trigger: 'component_count',
      value: metrics.componentCount,
      threshold: 3,
      action: `parallel_processing_enabled_concurrency_${concurrency}`,
      result: 'success',
    });

    this.logger.debug(`Recorded parallel processing usage for deployment: ${deploymentId}`);
  }

  /**
   * Start monitoring a specific component
   */
  startComponentMonitoring(deploymentId: string, component: CursorComponentType): void {
    const metrics = this.cursorMetrics.get(deploymentId);
    if (!metrics) return;

    const componentMetrics: CursorComponentMetrics = {
      component,
      startTime: new Date(),
      filesProcessed: 0,
      filesDeployed: 0,
      averageFileSize: 0,
      largestFileSize: 0,
      processingMethod: 'sequential',
      throughput: 0,
      memoryEfficiency: 0,
      issues: [],
      optimizations: [],
    };

    metrics.componentMetrics[component] = componentMetrics;
    
    // Also start base component monitoring (map to base ComponentType)
    const baseComponent = this.mapToBaseComponentType(component);
    if (baseComponent) {
      this.basePerformanceMonitor.startComponentTiming(deploymentId, baseComponent);
    }
    this.recordCursorMemorySnapshot(deploymentId, `component-${component}-start`, component);

    this.logger.debug(`Started component monitoring: ${component} for deployment: ${deploymentId}`);
  }

  /**
   * End monitoring a specific component
   */
  endComponentMonitoring(
    deploymentId: string,
    component: CursorComponentType,
    filesProcessed: number,
    filesDeployed: number,
    processingMethod: 'sequential' | 'parallel' | 'streaming' = 'sequential',
  ): void {
    const metrics = this.cursorMetrics.get(deploymentId);
    if (!metrics) return;

    const componentMetrics = metrics.componentMetrics[component];
    if (!componentMetrics) return;

    const endTime = new Date();
    componentMetrics.endTime = endTime;
    componentMetrics.duration = endTime.getTime() - componentMetrics.startTime.getTime();
    componentMetrics.filesProcessed = filesProcessed;
    componentMetrics.filesDeployed = filesDeployed;
    componentMetrics.processingMethod = processingMethod;

    // Calculate throughput
    if (componentMetrics.duration > 0) {
      componentMetrics.throughput = filesProcessed / (componentMetrics.duration / 1000);
    }

    // End base component monitoring
    const baseComponent = this.mapToBaseComponentType(component);
    if (baseComponent) {
      this.basePerformanceMonitor.endComponentTiming(deploymentId, baseComponent);
    }
    this.recordCursorMemorySnapshot(deploymentId, `component-${component}-end`, component);

    // Check for component-specific performance issues
    this.checkComponentPerformance(deploymentId, component);

    this.logger.debug(`Ended component monitoring: ${component} for deployment: ${deploymentId}`);
  }

  /**
   * Record a Cursor-specific memory snapshot
   */
  recordCursorMemorySnapshot(
    deploymentId: string,
    stage: string,
    component?: CursorComponentType,
  ): void {
    const metrics = this.cursorMetrics.get(deploymentId);
    if (!metrics) return;

    const memoryUsage = process.memoryUsage();
    const snapshot: CursorMemorySnapshot = {
      timestamp: new Date(),
      stage,
      component,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      rss: memoryUsage.rss,
      external: memoryUsage.external,
    };

    metrics.memorySnapshots.push(snapshot);
    metrics.peakMemoryUsage = Math.max(metrics.peakMemoryUsage, memoryUsage.heapUsed);

    // Also record in base monitor
    this.basePerformanceMonitor.recordMemoryUsage(deploymentId, stage);

    // Check for memory threshold violations
    if (memoryUsage.heapUsed > this.CURSOR_THRESHOLDS.maxMemoryUsage) {
      this.recordOptimizationTrigger(deploymentId, {
        timestamp: new Date(),
        trigger: 'memory_threshold',
        value: memoryUsage.heapUsed,
        threshold: this.CURSOR_THRESHOLDS.maxMemoryUsage,
        action: 'memory_optimization_triggered',
        result: 'partial', // Will be updated based on actual optimization result
      });
    }
  }

  /**
   * Record an optimization trigger
   */
  recordOptimizationTrigger(deploymentId: string, trigger: OptimizationTrigger): void {
    const metrics = this.cursorMetrics.get(deploymentId);
    if (!metrics) return;

    metrics.optimizationTriggers.push(trigger);
    this.logger.debug(`Recorded optimization trigger: ${trigger.action} for deployment: ${deploymentId}`);
  }

  /**
   * Generate comprehensive Cursor performance report
   */
  generateCursorPerformanceReport(deploymentId: string): CursorPerformanceReport | null {
    const metrics = this.cursorMetrics.get(deploymentId);
    if (!metrics) {
      this.logger.warn(`No Cursor metrics found for deployment: ${deploymentId}`);
      return null;
    }

    const summary = this.generatePerformanceSummary(metrics);
    const recommendations = this.generateRecommendations(metrics);

    const report: CursorPerformanceReport = {
      deploymentId,
      summary,
      detailedMetrics: metrics,
      recommendations,
    };

    // Add baseline comparison if available
    const baselineComparison = this.generateBaselineComparison(deploymentId);
    if (baselineComparison) {
      report.comparisonWithBaseline = baselineComparison;
    }

    return report;
  }

  /**
   * Get optimization suggestions based on performance data
   */
  getOptimizationSuggestions(deploymentId: string): PerformanceRecommendation[] {
    const metrics = this.cursorMetrics.get(deploymentId);
    if (!metrics) return [];

    const suggestions: PerformanceRecommendation[] = [];

    // Analyze configuration size
    if (metrics.configurationSize > this.CURSOR_THRESHOLDS.maxConfigurationSize && !metrics.streamingUsed) {
      suggestions.push({
        category: 'processing',
        priority: 'high',
        title: 'Enable Streaming Processing',
        description: 'Large configuration detected. Streaming processing can reduce memory usage and improve performance.',
        expectedImprovement: '30-50% memory reduction, 20-30% faster processing',
        implementationEffort: 'low',
        applicableScenarios: ['Large AI prompt collections', 'Extensive snippet libraries', 'Complex project settings'],
      });
    }

    // Analyze component count
    if (metrics.componentCount >= 4 && !metrics.parallelProcessingUsed) {
      suggestions.push({
        category: 'processing',
        priority: 'medium',
        title: 'Enable Parallel Processing',
        description: 'Multiple components detected. Parallel processing can significantly reduce deployment time.',
        expectedImprovement: '40-60% faster deployment',
        implementationEffort: 'low',
        applicableScenarios: ['Multiple component deployments', 'Independent file operations', 'Batch processing scenarios'],
      });
    }

    // Analyze memory usage patterns
    const memoryEfficiency = this.calculateMemoryEfficiency(metrics);
    if (memoryEfficiency < 0.7) { // Less than 70% efficient
      suggestions.push({
        category: 'memory',
        priority: 'medium',
        title: 'Optimize Memory Usage',
        description: 'Memory usage patterns suggest optimization opportunities.',
        expectedImprovement: '20-40% memory reduction',
        implementationEffort: 'medium',
        applicableScenarios: ['Large configuration deployments', 'Memory-constrained environments', 'Concurrent deployments'],
      });
    }

    // Analyze processing time patterns
    const slowComponents = Object.entries(metrics.componentMetrics)
      .filter(([, componentMetrics]) => 
        componentMetrics.duration && componentMetrics.duration > this.CURSOR_THRESHOLDS.maxComponentDuration
      );

    if (slowComponents.length > 0) {
      suggestions.push({
        category: 'optimization',
        priority: 'high',
        title: 'Optimize Slow Components',
        description: `Components taking longer than expected: ${slowComponents.map(([name]) => name).join(', ')}`,
        expectedImprovement: '25-50% faster component processing',
        implementationEffort: 'medium',
        applicableScenarios: ['Complex AI prompt processing', 'Large snippet collections', 'Extensive configuration files'],
      });
    }

    return suggestions;
  }

  /**
   * Calculate configuration size in bytes
   */
  private calculateConfigurationSize(config: CursorConfiguration): number {
    try {
      const serialized = JSON.stringify(config);
      return Buffer.byteLength(serialized, 'utf8');
    } catch (error) {
      this.logger.warn(`Failed to calculate configuration size: ${(error as Error).message}`);
      return 0;
    }
  }

  /**
   * Calculate configuration complexity (0-1 scale)
   */
  private calculateComplexity(config: CursorConfiguration, components: CursorComponentType[]): number {
    let complexity = 0;

    // Base complexity from component count
    complexity += Math.min(components.length / 6, 0.3); // Max 0.3 from component count

    // AI prompts complexity
    if (config.aiPrompts) {
      const promptCount = Object.keys(config.aiPrompts.projectPrompts || {}).length;
      const ruleCount = Object.keys(config.aiPrompts.rules || {}).length;
      complexity += Math.min((promptCount + ruleCount) / 20, 0.3); // Max 0.3 from AI content
    }

    // Settings complexity
    if (config.globalSettings || config.projectSettings) {
      const settingsSize = JSON.stringify({
        global: config.globalSettings,
        project: config.projectSettings,
      }).length;
      complexity += Math.min(settingsSize / 10000, 0.2); // Max 0.2 from settings
    }

    // Snippets complexity
    if (config.snippets) {
      const languageCount = Object.keys(config.snippets).length;
      complexity += Math.min(languageCount / 10, 0.2); // Max 0.2 from snippets
    }

    return Math.min(complexity, 1.0);
  }

  /**
   * Calculate final performance metrics
   */
  private calculateFinalMetrics(metrics: CursorPerformanceMetrics): void {
    // Calculate average memory usage
    if (metrics.memorySnapshots.length > 0) {
      const totalMemory = metrics.memorySnapshots.reduce((sum, snapshot) => sum + snapshot.heapUsed, 0);
      metrics.averageMemoryUsage = totalMemory / metrics.memorySnapshots.length;
    }

    // Calculate component-specific metrics
    for (const componentMetrics of Object.values(metrics.componentMetrics)) {
      if (componentMetrics.filesProcessed > 0) {
        // Calculate memory efficiency (lower is better)
        const memoryUsed = metrics.peakMemoryUsage - metrics.memorySnapshots[0]?.heapUsed || 0;
        componentMetrics.memoryEfficiency = memoryUsed / componentMetrics.filesProcessed;
      }
    }
  }

  /**
   * Analyze performance issues
   */
  private analyzePerformanceIssues(metrics: CursorPerformanceMetrics): void {
    const issues: CursorPerformanceIssue[] = [];

    // Check overall deployment time
    if (metrics.totalDuration && metrics.totalDuration > this.CURSOR_THRESHOLDS.maxDeploymentDuration) {
      issues.push({
        type: 'processing_time',
        severity: 'high',
        description: `Deployment took ${Math.round(metrics.totalDuration / 1000)}s, exceeding threshold of ${Math.round(this.CURSOR_THRESHOLDS.maxDeploymentDuration / 1000)}s`,
        impact: 'Slower user experience, potential timeout issues',
        recommendation: 'Consider enabling parallel processing or streaming for large configurations',
        metrics: {
          actualDuration: metrics.totalDuration,
          thresholdDuration: this.CURSOR_THRESHOLDS.maxDeploymentDuration,
          excessTime: metrics.totalDuration - this.CURSOR_THRESHOLDS.maxDeploymentDuration,
        },
      });
    }

    // Check memory usage
    if (metrics.peakMemoryUsage > this.CURSOR_THRESHOLDS.maxMemoryUsage) {
      issues.push({
        type: 'memory',
        severity: 'medium',
        description: `Peak memory usage of ${Math.round(metrics.peakMemoryUsage / 1024 / 1024)}MB exceeded threshold of ${Math.round(this.CURSOR_THRESHOLDS.maxMemoryUsage / 1024 / 1024)}MB`,
        impact: 'Potential memory pressure, slower performance on constrained systems',
        recommendation: 'Enable streaming processing for large configurations or increase memory limits',
        metrics: {
          peakMemoryUsage: metrics.peakMemoryUsage,
          thresholdMemoryUsage: this.CURSOR_THRESHOLDS.maxMemoryUsage,
          excessMemory: metrics.peakMemoryUsage - this.CURSOR_THRESHOLDS.maxMemoryUsage,
        },
      });
    }

    // Check component-specific issues
    for (const [componentName, componentMetrics] of Object.entries(metrics.componentMetrics)) {
      if (componentMetrics.duration && componentMetrics.duration > this.CURSOR_THRESHOLDS.maxComponentDuration) {
        issues.push({
          type: 'processing_time',
          severity: 'medium',
          component: componentName as CursorComponentType,
          description: `Component ${componentName} took ${Math.round(componentMetrics.duration / 1000)}s, exceeding threshold`,
          impact: 'Slower deployment, potential bottleneck',
          recommendation: `Optimize ${componentName} processing or enable parallel processing`,
          metrics: {
            componentDuration: componentMetrics.duration,
            thresholdDuration: this.CURSOR_THRESHOLDS.maxComponentDuration,
          },
        });
      }

      if (componentMetrics.throughput < this.CURSOR_THRESHOLDS.minThroughput) {
        issues.push({
          type: 'throughput',
          severity: 'low',
          component: componentName as CursorComponentType,
          description: `Component ${componentName} throughput of ${componentMetrics.throughput.toFixed(2)} files/s is below optimal`,
          impact: 'Suboptimal processing efficiency',
          recommendation: 'Consider batch processing or parallel file operations',
          metrics: {
            actualThroughput: componentMetrics.throughput,
            thresholdThroughput: this.CURSOR_THRESHOLDS.minThroughput,
          },
        });
      }
    }

    metrics.performanceIssues = issues;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(metrics: CursorPerformanceMetrics): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];

    // Configuration-based recommendations
    if (metrics.configurationSize > 20 * 1024 * 1024 && !metrics.streamingUsed) { // 20MB
      recommendations.push({
        category: 'configuration',
        priority: 'high',
        title: 'Use Streaming for Large Configurations',
        description: 'Your configuration is large enough to benefit from streaming processing',
        expectedImprovement: '30-50% memory reduction',
        implementationEffort: 'low',
        applicableScenarios: ['Large AI prompt collections', 'Extensive configuration files'],
      });
    }

    if (metrics.componentCount >= 4 && !metrics.parallelProcessingUsed) {
      recommendations.push({
        category: 'processing',
        priority: 'medium',
        title: 'Enable Parallel Processing',
        description: 'Multiple components can be processed in parallel for better performance',
        expectedImprovement: '40-60% faster deployment',
        implementationEffort: 'low',
        applicableScenarios: ['Multiple independent components', 'Batch file operations'],
      });
    }

    // Memory optimization recommendations
    const memoryEfficiency = this.calculateMemoryEfficiency(metrics);
    if (memoryEfficiency < 0.8) {
      recommendations.push({
        category: 'memory',
        priority: 'medium',
        title: 'Optimize Memory Usage',
        description: 'Memory usage patterns suggest room for optimization',
        expectedImprovement: '20-30% memory reduction',
        implementationEffort: 'medium',
        applicableScenarios: ['Memory-constrained environments', 'Large deployments'],
      });
    }

    return recommendations;
  }

  /**
   * Generate performance summary
   */
  private generatePerformanceSummary(metrics: CursorPerformanceMetrics): CursorPerformanceSummary {
    const totalFiles = Object.values(metrics.componentMetrics)
      .reduce((sum, component) => sum + component.filesProcessed, 0);
    
    const overallThroughput = metrics.totalDuration 
      ? totalFiles / (metrics.totalDuration / 1000)
      : 0;

    const memoryEfficiencyMB = metrics.peakMemoryUsage / (1024 * 1024) / metrics.componentCount;

    // Calculate optimization score (0-100)
    let optimizationScore = 100;
    
    // Deduct points for performance issues
    const criticalIssues = metrics.performanceIssues.filter(issue => issue.severity === 'critical').length;
    const highIssues = metrics.performanceIssues.filter(issue => issue.severity === 'high').length;
    const mediumIssues = metrics.performanceIssues.filter(issue => issue.severity === 'medium').length;
    
    optimizationScore -= criticalIssues * 30;
    optimizationScore -= highIssues * 20;
    optimizationScore -= mediumIssues * 10;
    
    // Add points for optimizations used
    if (metrics.streamingUsed) optimizationScore += 10;
    if (metrics.parallelProcessingUsed) optimizationScore += 10;
    
    optimizationScore = Math.max(0, Math.min(100, optimizationScore));

    // Determine overall rating
    let overallRating: 'excellent' | 'good' | 'fair' | 'poor';
    if (optimizationScore >= 90) overallRating = 'excellent';
    else if (optimizationScore >= 75) overallRating = 'good';
    else if (optimizationScore >= 60) overallRating = 'fair';
    else overallRating = 'poor';

    // Find fastest and slowest components
    const componentEntries = Object.entries(metrics.componentMetrics);
    const fastestComponent = componentEntries
      .filter(([, metrics]) => metrics.duration)
      .sort((a, b) => (a[1].duration || 0) - (b[1].duration || 0))[0]?.[0] || 'none';
    
    const slowestComponent = componentEntries
      .filter(([, metrics]) => metrics.duration)
      .sort((a, b) => (b[1].duration || 0) - (a[1].duration || 0))[0]?.[0] || 'none';

    const mostMemoryEfficientComponent = componentEntries
      .filter(([, metrics]) => metrics.memoryEfficiency > 0)
      .sort((a, b) => a[1].memoryEfficiency - b[1].memoryEfficiency)[0]?.[0] || 'none';

    return {
      overallRating,
      totalDuration: metrics.totalDuration || 0,
      throughput: overallThroughput,
      memoryEfficiency: memoryEfficiencyMB,
      optimizationScore,
      componentsDeployed: metrics.componentCount,
      filesProcessed: totalFiles,
      peakMemoryUsage: Math.round(metrics.peakMemoryUsage / 1024 / 1024),
      fastestComponent,
      slowestComponent,
      mostMemoryEfficientComponent,
      criticalIssues,
      warnings: metrics.performanceIssues.filter(issue => issue.severity === 'medium').length,
      optimizationsApplied: metrics.optimizationTriggers.length,
    };
  }

  /**
   * Calculate memory efficiency score (0-1, higher is better)
   */
  private calculateMemoryEfficiency(metrics: CursorPerformanceMetrics): number {
    if (metrics.memorySnapshots.length < 2) return 1.0;

    const startMemory = metrics.memorySnapshots[0].heapUsed;
    const peakMemory = metrics.peakMemoryUsage;
    const memoryGrowth = peakMemory - startMemory;
    
    // Efficiency is inversely related to memory growth relative to configuration size
    const expectedMemoryUsage = metrics.configurationSize * 2; // Expect 2x configuration size in memory
    
    if (expectedMemoryUsage === 0) return 1.0;
    
    const efficiency = Math.max(0, 1 - (memoryGrowth / expectedMemoryUsage));
    return Math.min(1.0, efficiency);
  }

  /**
   * Check component-specific performance
   */
  private checkComponentPerformance(deploymentId: string, component: CursorComponentType): void {
    const metrics = this.cursorMetrics.get(deploymentId);
    if (!metrics) return;

    const componentMetrics = metrics.componentMetrics[component];
    if (!componentMetrics || !componentMetrics.duration) return;

    // Check for slow component processing
    if (componentMetrics.duration > this.CURSOR_THRESHOLDS.maxComponentDuration) {
      componentMetrics.issues.push(`Slow processing: ${Math.round(componentMetrics.duration / 1000)}s`);
    }

    // Check for low throughput
    if (componentMetrics.throughput < this.CURSOR_THRESHOLDS.minThroughput) {
      componentMetrics.issues.push(`Low throughput: ${componentMetrics.throughput.toFixed(2)} files/s`);
    }

    // Suggest optimizations based on component type
    switch (component) {
      case 'ai-prompts':
        if (componentMetrics.filesProcessed > 10) {
          componentMetrics.optimizations.push('Consider parallel processing for multiple prompt files');
        }
        break;
      case 'snippets':
        if (componentMetrics.filesProcessed > 5) {
          componentMetrics.optimizations.push('Batch processing recommended for multiple snippet languages');
        }
        break;
      case 'settings':
        if (componentMetrics.averageFileSize > 100 * 1024) { // 100KB
          componentMetrics.optimizations.push('Large settings files detected, consider streaming');
        }
        break;
    }
  }

  /**
   * Generate baseline comparison
   */
  private generateBaselineComparison(deploymentId: string): PerformanceComparison | null {
    const currentMetrics = this.cursorMetrics.get(deploymentId);
    if (!currentMetrics) return null;

    // For now, return null as we don't have baseline storage implemented
    // In a full implementation, this would compare against stored baseline metrics
    return null;
  }

  /**
   * Clear metrics for a deployment
   */
  clearCursorMetrics(deploymentId: string): void {
    this.cursorMetrics.delete(deploymentId);
    this.logger.debug(`Cleared Cursor metrics for deployment: ${deploymentId}`);
  }

  /**
   * Get all current metrics (for debugging)
   */
  getAllMetrics(): Map<string, CursorPerformanceMetrics> {
    return new Map(this.cursorMetrics);
  }

  /**
   * Map CursorComponentType to base ComponentType for compatibility
   */
  private mapToBaseComponentType(component: CursorComponentType): ComponentType | null {
    switch (component) {
      case 'settings':
        return 'settings';
      case 'ai-prompts':
        return 'agents'; // AI prompts are similar to agents
      case 'tasks':
        return 'commands'; // Tasks are similar to commands
      case 'extensions':
      case 'snippets':
      case 'launch':
        return 'project'; // These are project-specific components
      default:
        return null;
    }
  }
}