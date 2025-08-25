/**
 * Advanced error scenarios for comprehensive file system mocking
 * Tests various edge cases, performance issues, and system failures
 */

import { setTimeout } from 'node:timers';

import { MockFileSystem, MockFileSystemConfig } from './mock-file-system';

/**
 * Extended error types for more realistic testing scenarios
 */
export interface AdvancedError extends Error {
  code?: string;
  errno?: number;
  syscall?: string;
  path?: string;
  address?: string;
  port?: number;
  retry?: boolean;
  timeout?: number;
}

/**
 * Performance simulation configuration
 */
export interface PerformanceConfig {
  readDelay?: number;
  writeDelay?: number;
  networkLatency?: number;
  diskIoDelay?: number;
  memoryPressure?: boolean;
  concurrentOperationLimit?: number;
}

/**
 * Advanced Mock File System with comprehensive error simulation
 */
export class AdvancedMockFileSystem extends MockFileSystem {
  private performanceConfig: PerformanceConfig;
  private operationCount = 0;
  private networkFailureSimulation = false;
  private diskSpaceUsed = 0;
  private maxDiskSpace = 1024 * 1024 * 1024; // 1GB default
  private corruptedFiles: Set<string> = new Set();
  private tempFiles: Set<string> = new Set();

  constructor(
    config: MockFileSystemConfig,
    performanceConfig: PerformanceConfig = {},
  ) {
    super(config);
    this.performanceConfig = {
      readDelay: 10,
      writeDelay: 20,
      networkLatency: 100,
      diskIoDelay: 50,
      memoryPressure: false,
      concurrentOperationLimit: 10,
      ...performanceConfig,
    };
  }

  /**
   * Enable network failure simulation
   */
  enableNetworkFailures(): void {
    this.networkFailureSimulation = true;
  }

  /**
   * Disable network failure simulation
   */
  disableNetworkFailures(): void {
    this.networkFailureSimulation = false;
  }

  /**
   * Set disk space limits
   */
  setDiskSpaceLimit(bytes: number): void {
    this.maxDiskSpace = bytes;
  }

  /**
   * Mark a file as corrupted
   */
  corruptFile(filePath: string): void {
    this.corruptedFiles.add(filePath);
  }

  /**
   * Simulate delay based on operation type
   */
  private async simulateDelay(
    operation: 'read' | 'write' | 'network' | 'disk',
  ): Promise<void> {
    const delays = {
      read: this.performanceConfig.readDelay,
      write: this.performanceConfig.writeDelay,
      network: this.performanceConfig.networkLatency,
      disk: this.performanceConfig.diskIoDelay,
    };

    const delay = delays[operation] || 0;
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  /**
   * Check for concurrent operation limits
   */
  private checkConcurrencyLimit(): void {
    this.operationCount++;
    if (
      this.operationCount >
      (this.performanceConfig.concurrentOperationLimit || 10)
    ) {
      const error: AdvancedError = new Error('EMFILE: too many open files');
      error.code = 'EMFILE';
      error.errno = -24;
      throw error;
    }

    // Auto-decrement after operation
    setTimeout(() => {
      this.operationCount = Math.max(0, this.operationCount - 1);
    }, 100);
  }

  /**
   * Enhanced readFile with advanced error scenarios
   */
  async readFile(filePath: string): Promise<string> {
    await this.simulateDelay('read');
    this.checkConcurrencyLimit();

    // Network path simulation
    if (filePath.startsWith('//') || filePath.startsWith('\\\\')) {
      await this.simulateDelay('network');
      if (this.networkFailureSimulation) {
        const error: AdvancedError = new Error(
          'ENETUNREACH: network is unreachable',
        );
        error.code = 'ENETUNREACH';
        error.errno = -51;
        error.syscall = 'connect';
        throw error;
      }
    }

    // File corruption simulation
    if (this.corruptedFiles.has(filePath)) {
      const error: AdvancedError = new Error('EIO: i/o error, read');
      error.code = 'EIO';
      error.errno = -5;
      error.syscall = 'read';
      error.path = filePath;
      throw error;
    }

    // Memory pressure simulation
    if (this.performanceConfig.memoryPressure) {
      const error: AdvancedError = new Error('ENOMEM: not enough memory');
      error.code = 'ENOMEM';
      error.errno = -12;
      throw error;
    }

    // Random timeout simulation (1% chance)
    if (Math.random() < 0.01) {
      const error: AdvancedError = new Error('ETIMEDOUT: operation timed out');
      error.code = 'ETIMEDOUT';
      error.errno = -110;
      error.timeout = 30_000;
      error.retry = true;
      throw error;
    }

    return super.readFile(filePath);
  }

  /**
   * Enhanced writeFile with disk space and permission checks
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    await this.simulateDelay('write');
    this.checkConcurrencyLimit();

    const contentSize = Buffer.byteLength(content, 'utf8');

    // Disk space check
    if (this.diskSpaceUsed + contentSize > this.maxDiskSpace) {
      const error: AdvancedError = new Error('ENOSPC: no space left on device');
      error.code = 'ENOSPC';
      error.errno = -28;
      error.syscall = 'write';
      error.path = filePath;
      throw error;
    }

    // Disk full simulation for large files
    if (contentSize > 1024 * 1024) {
      // 1MB
      const error: AdvancedError = new Error('EFBIG: file too big');
      error.code = 'EFBIG';
      error.errno = -27;
      error.syscall = 'write';
      error.path = filePath;
      throw error;
    }

    // Read-only file system simulation
    if (filePath.includes('/readonly/')) {
      const error: AdvancedError = new Error('EROFS: read-only file system');
      error.code = 'EROFS';
      error.errno = -30;
      error.syscall = 'open';
      error.path = filePath;
      throw error;
    }

    // Simulate partial write failure
    if (Math.random() < 0.005) {
      // 0.5% chance
      const error: AdvancedError = new Error('ENOSPC: no space left on device');
      error.code = 'ENOSPC';
      error.errno = -28;
      error.syscall = 'write';
      error.path = filePath;
      throw error;
    }

    await super.writeFile(filePath, content);
    this.diskSpaceUsed += contentSize;

    // Track temporary files
    if (filePath.includes('tmp') || filePath.includes('temp')) {
      this.tempFiles.add(filePath);
    }
  }

  /**
   * Enhanced mkdir with advanced error scenarios
   */
  async mkdir(
    directoryPath: string,
    options?: { recursive?: boolean },
  ): Promise<void> {
    await this.simulateDelay('disk');
    this.checkConcurrencyLimit();

    // Path too long simulation
    if (directoryPath.length > 260) {
      // Windows MAX_PATH limit
      const error: AdvancedError = new Error('ENAMETOOLONG: name too long');
      error.code = 'ENAMETOOLONG';
      error.errno = -36;
      error.syscall = 'mkdir';
      error.path = directoryPath;
      throw error;
    }

    // Invalid characters simulation
    if (
      directoryPath.includes('<') ||
      directoryPath.includes('>') ||
      directoryPath.includes('|')
    ) {
      const error: AdvancedError = new Error('EINVAL: invalid argument');
      error.code = 'EINVAL';
      error.errno = -22;
      error.syscall = 'mkdir';
      error.path = directoryPath;
      throw error;
    }

    // Directory already exists with different case (Windows simulation)
    const existingDirectories = [...(this.directories || new Set())];
    const conflictingDirectory = existingDirectories.find(
      (directory) =>
        directory.toLowerCase() === directoryPath.toLowerCase() &&
        directory !== directoryPath,
    );

    if (conflictingDirectory) {
      const error: AdvancedError = new Error('EEXIST: file already exists');
      error.code = 'EEXIST';
      error.errno = -17;
      error.syscall = 'mkdir';
      error.path = directoryPath;
      throw error;
    }

    await super.mkdir(directoryPath, options);
  }

  /**
   * Enhanced readdir with large directory simulation
   */
  async readdir(directoryPath: string): Promise<string[]> {
    await this.simulateDelay('read');
    this.checkConcurrencyLimit();

    const files = await super.readdir(directoryPath);

    // Large directory simulation (delay proportional to file count)
    if (files.length > 1000) {
      await this.simulateDelay('disk');
    }

    // Directory corruption simulation
    if (this.corruptedFiles.has(directoryPath)) {
      const error: AdvancedError = new Error('EIO: i/o error, scandir');
      error.code = 'EIO';
      error.errno = -5;
      error.syscall = 'scandir';
      error.path = directoryPath;
      throw error;
    }

    return files;
  }

  /**
   * Enhanced stat with various file system edge cases
   */
  async stat(filePath: string): Promise<{
    isDirectory(): boolean;
    isFile(): boolean;
    size: number;
    mtime: Date;
    mode: number;
  }> {
    await this.simulateDelay('disk');
    this.checkConcurrencyLimit();

    // Broken symlink simulation
    if (filePath.includes('.broken-link')) {
      const error: AdvancedError = new Error(
        'ENOENT: no such file or directory',
      );
      error.code = 'ENOENT';
      error.errno = -2;
      error.syscall = 'stat';
      error.path = filePath;
      throw error;
    }

    // Permission denied on stat
    if (filePath.includes('/no-stat-permission/')) {
      const error: AdvancedError = new Error('EACCES: permission denied');
      error.code = 'EACCES';
      error.errno = -13;
      error.syscall = 'stat';
      error.path = filePath;
      throw error;
    }

    const baseStat = await super.stat(filePath);

    // Extended stat information
    return {
      ...baseStat,
      mtime: new Date(),
      mode: 0o644, // Default file permissions
    };
  }

  /**
   * Simulate file system cleanup
   */
  async cleanup(): Promise<void> {
    // Clean up temporary files
    for (const temporaryFile of this.tempFiles) {
      try {
        this.files?.delete(temporaryFile);
      } catch {
        // Ignore cleanup errors
      }
    }
    this.tempFiles.clear();

    // Reset counters
    this.operationCount = 0;
    this.diskSpaceUsed = 0;
    this.corruptedFiles.clear();
  }

  /**
   * Get current system state for debugging
   */
  getSystemState(): {
    operationCount: number;
    diskSpaceUsed: number;
    maxDiskSpace: number;
    tempFiles: number;
    corruptedFiles: number;
    networkFailuresEnabled: boolean;
  } {
    return {
      operationCount: this.operationCount,
      diskSpaceUsed: this.diskSpaceUsed,
      maxDiskSpace: this.maxDiskSpace,
      tempFiles: this.tempFiles.size,
      corruptedFiles: this.corruptedFiles.size,
      networkFailuresEnabled: this.networkFailureSimulation,
    };
  }
}

/**
 * Error scenario factory functions
 */
export class ErrorScenarioFactory {
  /**
   * Create disk full scenario
   */
  static createDiskFullScenario(): AdvancedMockFileSystem {
    const fs = new AdvancedMockFileSystem(
      { files: {}, directories: [] },
      { writeDelay: 100 },
    );
    fs.setDiskSpaceLimit(1024); // Very small disk
    return fs;
  }

  /**
   * Create network failure scenario
   */
  static createNetworkFailureScenario(): AdvancedMockFileSystem {
    const fs = new AdvancedMockFileSystem(
      {
        files: {
          '//network-drive/settings.json': 'network file content',
        },
        directories: ['//network-drive'],
      },
      { networkLatency: 5000 },
    );
    fs.enableNetworkFailures();
    return fs;
  }

  /**
   * Create memory pressure scenario
   */
  static createMemoryPressureScenario(): AdvancedMockFileSystem {
    return new AdvancedMockFileSystem(
      { files: {}, directories: [] },
      { memoryPressure: true, readDelay: 1000 },
    );
  }

  /**
   * Create file corruption scenario
   */
  static createFileCorruptionScenario(): AdvancedMockFileSystem {
    const fs = new AdvancedMockFileSystem({
      files: {
        '/corrupted/config.json': 'corrupted content',
        '/normal/config.json': 'normal content',
      },
      directories: ['/corrupted', '/normal'],
    });
    fs.corruptFile('/corrupted/config.json');
    return fs;
  }

  /**
   * Create high concurrency scenario
   */
  static createHighConcurrencyScenario(): AdvancedMockFileSystem {
    return new AdvancedMockFileSystem(
      {
        files: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [
            `/file${i}.txt`,
            `content ${i}`,
          ]).map(([path, content]) => [path, content]),
        ),
        directories: ['/'],
      },
      { concurrentOperationLimit: 3 },
    );
  }

  /**
   * Create large project scenario (performance testing)
   */
  static createLargeProjectScenario(): AdvancedMockFileSystem {
    const files: Record<string, string> = {};
    const directories = ['/large-project'];

    // Generate 1000 files
    for (let i = 0; i < 1000; i++) {
      files[`/large-project/file-${i}.ts`] =
        `// File ${i}\nexport const value${i} = ${i};`;
    }

    // Generate 50 directories
    for (let i = 0; i < 50; i++) {
      directories.push(`/large-project/dir-${i}`);
      for (let j = 0; j < 20; j++) {
        files[`/large-project/dir-${i}/file-${j}.ts`] =
          `// Dir ${i} File ${j}\nexport const value = ${i * 20 + j};`;
      }
    }

    return new AdvancedMockFileSystem(
      { files, directories },
      { readDelay: 5, writeDelay: 10, diskIoDelay: 100 },
    );
  }

  /**
   * Create intermittent failure scenario
   */
  static createIntermittentFailureScenario(): AdvancedMockFileSystem {
    const fs = new AdvancedMockFileSystem({
      files: {
        '/flaky/config.json': '{"key": "value"}',
      },
      directories: ['/flaky'],
    });

    // Override readFile to simulate intermittent failures
    const originalReadFile = fs.readFile.bind(fs);
    fs.readFile = async function (filePath: string): Promise<string> {
      // 20% chance of failure
      if (Math.random() < 0.2) {
        const error: AdvancedError = new Error(
          'EAGAIN: resource temporarily unavailable',
        );
        error.code = 'EAGAIN';
        error.errno = -11;
        error.retry = true;
        throw error;
      }
      return originalReadFile(filePath);
    };

    return fs;
  }

  /**
   * Create permission escalation scenario
   */
  static createPermissionEscalationScenario(): AdvancedMockFileSystem {
    return new AdvancedMockFileSystem({
      files: {
        '/restricted/admin-config.json': 'sensitive data',
        '/public/user-config.json': 'public data',
      },
      directories: ['/restricted', '/public'],
      permissions: {
        '/restricted/admin-config.json': { readable: false, writable: false },
        '/restricted': { readable: false, writable: false },
      },
    });
  }

  /**
   * Create race condition scenario
   */
  static createRaceConditionScenario(): AdvancedMockFileSystem {
    const fs = new AdvancedMockFileSystem({
      files: {
        '/shared/counter.txt': '0',
      },
      directories: ['/shared'],
    });

    // Simulate race conditions in concurrent writes
    let writeInProgress = false;
    const originalWriteFile = fs.writeFile.bind(fs);

    fs.writeFile = async function (
      filePath: string,
      content: string,
    ): Promise<void> {
      if (writeInProgress && filePath === '/shared/counter.txt') {
        const error: AdvancedError = new Error(
          'EBUSY: resource busy or locked',
        );
        error.code = 'EBUSY';
        error.errno = -16;
        error.syscall = 'open';
        error.path = filePath;
        throw error;
      }

      writeInProgress = true;
      try {
        await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate write delay
        await originalWriteFile(filePath, content);
      } finally {
        writeInProgress = false;
      }
    };

    return fs;
  }
}

/**
 * Test utilities for error scenario validation
 */
export class ErrorScenarioTestUtilities {
  /**
   * Test that a function properly handles and retries on EAGAIN errors
   */
  static async testRetryOnEAGAIN(
    operation: () => Promise<unknown>,
    maxRetries = 3,
  ): Promise<{ success: boolean; attempts: number; error?: Error }> {
    let attempts = 0;

    for (let i = 0; i <= maxRetries; i++) {
      attempts++;
      try {
        // eslint-disable-next-line no-await-in-loop
        await operation();
        return { success: true, attempts };
      } catch (error: unknown) {
        const err = error as { code?: string };
        if (err.code === 'EAGAIN' && i < maxRetries) {
          // Wait before retry
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, i) * 100),
          );
          continue;
        }
        return { success: false, attempts, error: error as Error };
      }
    }

    return { success: false, attempts };
  }

  /**
   * Test that a function properly handles disk space errors
   */
  static async testDiskSpaceHandling(
    writeOperation: () => Promise<unknown>,
  ): Promise<{ handledCorrectly: boolean; errorType?: string }> {
    try {
      await writeOperation();
      return { handledCorrectly: false }; // Should have failed
    } catch (error: unknown) {
      const err = error as { code?: string };
      const isDiskSpaceError = err.code === 'ENOSPC' || err.code === 'EFBIG';
      return {
        handledCorrectly: isDiskSpaceError,
        errorType: err.code,
      };
    }
  }

  /**
   * Test concurrent operation limits
   */
  static async testConcurrencyLimits(
    operations: (() => Promise<unknown>)[],
    _expectedFailures = 0,
  ): Promise<{ successes: number; failures: number; errors: Error[] }> {
    const results = await Promise.allSettled(operations.map((op) => op()));

    const successes = results.filter((r) => r.status === 'fulfilled').length;
    const failures = results.filter((r) => r.status === 'rejected').length;
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => r.reason as Error);

    return { successes, failures, errors };
  }

  /**
   * Performance benchmark for file operations
   */
  static async benchmarkOperation(
    operation: () => Promise<unknown>,
    iterations = 10,
  ): Promise<{
    averageTime: number;
    minTime: number;
    maxTime: number;
    successRate: number;
  }> {
    const times: number[] = [];
    let successes = 0;

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      try {
        // eslint-disable-next-line no-await-in-loop
        await operation();
        successes++;
      } catch {
        // Count failed operations in timing
      }
      times.push(Date.now() - start);
    }

    return {
      averageTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      successRate: successes / iterations,
    };
  }
}
