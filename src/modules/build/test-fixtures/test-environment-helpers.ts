/**
 * Test environment helpers and utilities
 * Provides comprehensive testing support for different environments and scenarios
 */

import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { promises as fs } from 'fs';
import { MockFileSystem, AdvancedMockFileSystem } from './advanced-error-scenarios';
import { 
  webAppProjectScenario, 
  apiServiceProjectScenario, 
  cliToolProjectScenario,
  edgeCaseScenarios 
} from './realistic-project-scenarios';
import {
  webAppPersonalContextOutput,
  apiServicePersonalContextOutput,
  webAppProjectContextOutput,
  apiServiceProjectContextOutput,
  comprehensivePromptTemplatesOutput,
  sampleManifestOutput
} from './taptik-output-fixtures';

/**
 * Test environment configuration
 */
export interface TestEnvironmentConfig {
  name: string;
  isolated: boolean;
  cleanup: boolean;
  performance: {
    enableMetrics: boolean;
    timeout: number;
    memoryLimit?: number;
  };
  filesystem: {
    useRealFS: boolean;
    tempDirectory?: string;
    permissions?: Record<string, { readable: boolean; writable: boolean }>;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error' | 'silent';
    logFile?: string;
  };
}

/**
 * Default test environment configurations
 */
export const TEST_ENVIRONMENTS: Record<string, TestEnvironmentConfig> = {
  unit: {
    name: 'unit',
    isolated: true,
    cleanup: true,
    performance: {
      enableMetrics: false,
      timeout: 5000,
    },
    filesystem: {
      useRealFS: false,
    },
    logging: {
      level: 'silent',
    },
  },
  integration: {
    name: 'integration',
    isolated: true,
    cleanup: true,
    performance: {
      enableMetrics: true,
      timeout: 30000,
    },
    filesystem: {
      useRealFS: true,
      tempDirectory: join(tmpdir(), 'taptik-integration-tests'),
    },
    logging: {
      level: 'warn',
    },
  },
  e2e: {
    name: 'e2e',
    isolated: true,
    cleanup: true,
    performance: {
      enableMetrics: true,
      timeout: 60000,
      memoryLimit: 512 * 1024 * 1024, // 512MB
    },
    filesystem: {
      useRealFS: true,
      tempDirectory: join(tmpdir(), 'taptik-e2e-tests'),
    },
    logging: {
      level: 'info',
      logFile: join(tmpdir(), 'taptik-e2e.log'),
    },
  },
  ci: {
    name: 'ci',
    isolated: true,
    cleanup: true,
    performance: {
      enableMetrics: true,
      timeout: 120000,
    },
    filesystem: {
      useRealFS: true,
      tempDirectory: '/tmp/taptik-ci-tests',
    },
    logging: {
      level: 'info',
    },
  },
  performance: {
    name: 'performance',
    isolated: false,
    cleanup: false,
    performance: {
      enableMetrics: true,
      timeout: 300000, // 5 minutes
    },
    filesystem: {
      useRealFS: true,
      tempDirectory: join(tmpdir(), 'taptik-performance-tests'),
    },
    logging: {
      level: 'debug',
      logFile: join(tmpdir(), 'taptik-performance.log'),
    },
  },
};

/**
 * Performance metrics collection
 */
export interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryUsage: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  operationCounts: Record<string, number>;
  errors: Error[];
}

/**
 * Test data generator utilities
 */
export class TestDataGenerator {
  private static idCounter = 0;

  /**
   * Generate unique test ID
   */
  static generateTestId(): string {
    return `test-${Date.now()}-${++this.idCounter}`;
  }

  /**
   * Generate timestamp for testing
   */
  static generateTimestamp(offsetMs = 0): string {
    return new Date(Date.now() + offsetMs).toISOString();
  }

  /**
   * Generate build ID for testing
   */
  static generateBuildId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `build-${timestamp}-${random}`;
  }

  /**
   * Generate mock Kiro project structure
   */
  static generateKiroProjectStructure(scenario: 'web-app' | 'api' | 'cli' | 'minimal'): {
    files: Record<string, string>;
    directories: string[];
  } {
    const scenarios = {
      'web-app': webAppProjectScenario,
      'api': apiServiceProjectScenario,
      'cli': cliToolProjectScenario,
      'minimal': edgeCaseScenarios.emptyProject,
    };

    const selectedScenario = scenarios[scenario];
    const files: Record<string, string> = {};
    const directories: string[] = ['.kiro', '.kiro/settings', '.kiro/steering', '.kiro/hooks'];

    // Add settings files
    files['.kiro/settings/context.md'] = selectedScenario.localSettings.context || '';
    files['.kiro/settings/user-preferences.md'] = selectedScenario.localSettings.userPreferences || '';
    files['.kiro/settings/project-spec.md'] = selectedScenario.localSettings.projectSpec || '';

    // Add steering files
    selectedScenario.steeringFiles?.forEach(file => {
      files[file.path] = file.content;
    });

    // Add hook files
    selectedScenario.hookFiles?.forEach(file => {
      files[file.path] = file.content;
    });

    return { files, directories };
  }

  /**
   * Generate expected taptik outputs for validation
   */
  static generateExpectedTaptikOutputs(scenario: 'web-app' | 'api' | 'comprehensive') {
    const outputs = {
      'web-app': {
        personalContext: webAppPersonalContextOutput,
        projectContext: webAppProjectContextOutput,
        promptTemplates: comprehensivePromptTemplatesOutput,
        manifest: sampleManifestOutput,
      },
      'api': {
        personalContext: apiServicePersonalContextOutput,
        projectContext: apiServiceProjectContextOutput,
        promptTemplates: comprehensivePromptTemplatesOutput,
        manifest: sampleManifestOutput,
      },
      'comprehensive': {
        personalContext: webAppPersonalContextOutput,
        projectContext: webAppProjectContextOutput,
        promptTemplates: comprehensivePromptTemplatesOutput,
        manifest: sampleManifestOutput,
      },
    };

    return outputs[scenario];
  }

  /**
   * Generate large dataset for performance testing
   */
  static generateLargeDataset(options: {
    fileCount: number;
    avgFileSize: number;
    directoryDepth: number;
  }): { files: Record<string, string>; directories: string[] } {
    const { fileCount, avgFileSize, directoryDepth } = options;
    const files: Record<string, string> = {};
    const directories: string[] = [];

    // Generate directory structure
    const generateDirectories = (prefix: string, depth: number) => {
      if (depth === 0) return;
      
      const dirCount = Math.floor(fileCount / Math.pow(10, depth));
      for (let i = 0; i < dirCount; i++) {
        const dirPath = `${prefix}/dir-${depth}-${i}`;
        directories.push(dirPath);
        generateDirectories(dirPath, depth - 1);
      }
    };

    generateDirectories('/large-dataset', directoryDepth);

    // Generate files
    for (let i = 0; i < fileCount; i++) {
      const dirIndex = i % directories.length;
      const directory = directories[dirIndex] || '/large-dataset';
      const fileName = `file-${i}.txt`;
      const filePath = `${directory}/${fileName}`;
      
      // Generate content of approximately avgFileSize
      const content = 'x'.repeat(avgFileSize - 50) + `\n// File ${i}\n// Generated content`;
      files[filePath] = content;
    }

    return { files, directories };
  }
}

/**
 * Test environment manager
 */
export class TestEnvironmentManager {
  private config: TestEnvironmentConfig;
  private metrics?: PerformanceMetrics;
  private tempDirectories: string[] = [];
  private cleanupHandlers: (() => Promise<void>)[] = [];

  constructor(environment: keyof typeof TEST_ENVIRONMENTS | TestEnvironmentConfig) {
    if (typeof environment === 'string') {
      this.config = TEST_ENVIRONMENTS[environment];
      if (!this.config) {
        throw new Error(`Unknown test environment: ${environment}`);
      }
    } else {
      this.config = environment;
    }
  }

  /**
   * Setup test environment
   */
  async setup(): Promise<void> {
    if (this.config.performance.enableMetrics) {
      this.startMetrics();
    }

    if (this.config.filesystem.useRealFS && this.config.filesystem.tempDirectory) {
      await this.setupTempDirectory();
    }

    if (this.config.logging.logFile) {
      await this.setupLogging();
    }
  }

  /**
   * Cleanup test environment
   */
  async cleanup(): Promise<void> {
    if (this.config.cleanup) {
      // Run custom cleanup handlers
      for (const handler of this.cleanupHandlers) {
        try {
          await handler();
        } catch (error) {
          console.warn('Cleanup handler failed:', error);
        }
      }

      // Clean up temp directories
      for (const tempDir of this.tempDirectories) {
        try {
          await fs.rmdir(tempDir, { recursive: true });
        } catch (error) {
          console.warn(`Failed to clean up temp directory ${tempDir}:`, error);
        }
      }
    }

    if (this.metrics) {
      this.stopMetrics();
    }
  }

  /**
   * Create isolated test filesystem
   */
  async createTestFileSystem(scenario: string): Promise<MockFileSystem | AdvancedMockFileSystem> {
    if (scenario === 'advanced-errors') {
      return new AdvancedMockFileSystem({
        files: {},
        directories: [],
      });
    }

    const projectData = TestDataGenerator.generateKiroProjectStructure(
      scenario as 'web-app' | 'api' | 'cli' | 'minimal'
    );

    if (scenario.includes('error') || scenario.includes('performance')) {
      return new AdvancedMockFileSystem(projectData);
    }

    return new MockFileSystem(projectData);
  }

  /**
   * Create real filesystem test directory
   */
  async createRealTestDirectory(): Promise<string> {
    if (!this.config.filesystem.useRealFS) {
      throw new Error('Real filesystem not enabled for this environment');
    }

    const baseDir = this.config.filesystem.tempDirectory || tmpdir();
    const testDir = join(baseDir, TestDataGenerator.generateTestId());
    
    await fs.mkdir(testDir, { recursive: true });
    this.tempDirectories.push(testDir);
    
    return testDir;
  }

  /**
   * Register cleanup handler
   */
  addCleanupHandler(handler: () => Promise<void>): void {
    this.cleanupHandlers.push(handler);
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics | undefined {
    return this.metrics;
  }

  /**
   * Record operation for metrics
   */
  recordOperation(operation: string): void {
    if (this.metrics) {
      this.metrics.operationCounts[operation] = (this.metrics.operationCounts[operation] || 0) + 1;
    }
  }

  /**
   * Record error for metrics
   */
  recordError(error: Error): void {
    if (this.metrics) {
      this.metrics.errors.push(error);
    }
  }

  private startMetrics(): void {
    this.metrics = {
      startTime: Date.now(),
      memoryUsage: process.memoryUsage(),
      operationCounts: {},
      errors: [],
    };
  }

  private stopMetrics(): void {
    if (this.metrics) {
      this.metrics.endTime = Date.now();
      this.metrics.duration = this.metrics.endTime - this.metrics.startTime;
    }
  }

  private async setupTempDirectory(): Promise<void> {
    const tempDir = this.config.filesystem.tempDirectory!;
    await fs.mkdir(tempDir, { recursive: true });
    this.tempDirectories.push(tempDir);
  }

  private async setupLogging(): Promise<void> {
    const logFile = this.config.logging.logFile!;
    const logDir = resolve(logFile, '..');
    await fs.mkdir(logDir, { recursive: true });
  }
}

/**
 * Test assertion utilities
 */
export class TestAssertions {
  /**
   * Assert that a file system operation completes within expected time
   */
  static async assertPerformance(
    operation: () => Promise<any>,
    maxTimeMs: number
  ): Promise<{ success: boolean; actualTime: number; result?: any }> {
    const start = Date.now();
    try {
      const result = await operation();
      const actualTime = Date.now() - start;
      return {
        success: actualTime <= maxTimeMs,
        actualTime,
        result,
      };
    } catch (error) {
      const actualTime = Date.now() - start;
      throw { error, actualTime };
    }
  }

  /**
   * Assert that an error is properly structured
   */
  static assertErrorStructure(
    error: any,
    expectedCode?: string,
    expectedMessage?: string
  ): boolean {
    if (!(error instanceof Error)) return false;
    if (expectedCode && error.code !== expectedCode) return false;
    if (expectedMessage && !error.message.includes(expectedMessage)) return false;
    return true;
  }

  /**
   * Assert that taptik output matches schema
   */
  static assertTaptikOutput(output: any, type: 'personal' | 'project' | 'prompts' | 'manifest'): boolean {
    if (!output || typeof output !== 'object') return false;

    const commonFields = ['taptik_version', 'context_type', 'created_at', 'source_platform'];
    for (const field of commonFields) {
      if (type !== 'manifest' && !output[field]) return false;
    }

    switch (type) {
      case 'personal':
        return !!(output.user_info && output.development_environment && output.workflow_preferences);
      case 'project':
        return !!(output.project_info && output.technical_stack && output.development_guidelines);
      case 'prompts':
        return !!(Array.isArray(output.templates) && output.metadata);
      case 'manifest':
        return !!(output.build_id && Array.isArray(output.categories) && Array.isArray(output.source_files));
      default:
        return false;
    }
  }

  /**
   * Assert memory usage is within limits
   */
  static assertMemoryUsage(limitMB: number): boolean {
    const usage = process.memoryUsage();
    const usageMB = usage.heapUsed / 1024 / 1024;
    return usageMB <= limitMB;
  }
}

/**
 * Test suite utilities
 */
export class TestSuiteUtils {
  /**
   * Run test with timeout and cleanup
   */
  static async runWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    cleanup?: () => Promise<void>
  ): Promise<T> {
    let timeoutHandle: NodeJS.Timeout;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([operation(), timeoutPromise]);
      clearTimeout(timeoutHandle);
      return result;
    } catch (error) {
      clearTimeout(timeoutHandle);
      if (cleanup) {
        try {
          await cleanup();
        } catch (cleanupError) {
          console.warn('Cleanup failed:', cleanupError);
        }
      }
      throw error;
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  static async retry<T>(
    operation: () => Promise<T>,
    maxAttempts = 3,
    baseDelayMs = 100
  ): Promise<{ result: T; attempts: number }> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation();
        return { result, attempts: attempt };
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxAttempts) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  }

  /**
   * Parallel test execution with concurrency limit
   */
  static async runParallel<T>(
    operations: (() => Promise<T>)[],
    concurrency = 5
  ): Promise<{ successes: T[]; failures: Error[]; totalTime: number }> {
    const startTime = Date.now();
    const successes: T[] = [];
    const failures: Error[] = [];
    
    const semaphore = new Array(concurrency).fill(null);
    const pending = [...operations];
    
    const runNext = async (): Promise<void> => {
      const operation = pending.shift();
      if (!operation) return;
      
      try {
        const result = await operation();
        successes.push(result);
      } catch (error) {
        failures.push(error as Error);
      }
      
      if (pending.length > 0) {
        await runNext();
      }
    };
    
    await Promise.all(semaphore.map(() => runNext()));
    
    return {
      successes,
      failures,
      totalTime: Date.now() - startTime,
    };
  }

  /**
   * Generate test report
   */
  static generateTestReport(metrics: PerformanceMetrics, assertions: Record<string, boolean>): {
    summary: string;
    performance: string;
    assertions: string;
    recommendations: string[];
  } {
    const totalAssertions = Object.keys(assertions).length;
    const passedAssertions = Object.values(assertions).filter(Boolean).length;
    const assertionRate = totalAssertions > 0 ? (passedAssertions / totalAssertions) * 100 : 0;
    
    const summary = `Test completed in ${metrics.duration}ms with ${passedAssertions}/${totalAssertions} assertions passed (${assertionRate.toFixed(1)}%)`;
    
    const performance = `Memory: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB, Operations: ${Object.values(metrics.operationCounts).reduce((a, b) => a + b, 0)}, Errors: ${metrics.errors.length}`;
    
    const failedAssertions = Object.entries(assertions)
      .filter(([, passed]) => !passed)
      .map(([name]) => name);
    const assertionDetails = failedAssertions.length > 0 
      ? `Failed: ${failedAssertions.join(', ')}`
      : 'All assertions passed';
    
    const recommendations: string[] = [];
    if (metrics.duration && metrics.duration > 5000) {
      recommendations.push('Consider optimizing performance - test took longer than 5 seconds');
    }
    if (metrics.memoryUsage.heapUsed > 100 * 1024 * 1024) {
      recommendations.push('High memory usage detected - check for memory leaks');
    }
    if (metrics.errors.length > 0) {
      recommendations.push(`${metrics.errors.length} errors occurred - review error handling`);
    }
    if (assertionRate < 90) {
      recommendations.push('Low assertion pass rate - review test expectations');
    }
    
    return {
      summary,
      performance,
      assertions: assertionDetails,
      recommendations,
    };
  }
}