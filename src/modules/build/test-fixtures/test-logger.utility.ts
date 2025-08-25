/**
 * Test Logger Utility
 * Provides controlled logging for test environments while avoiding direct console usage
 */

export enum TestLogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  PERFORMANCE = 'PERFORMANCE',
  TDD = 'TDD',
}

export interface TestLogEntry {
  timestamp: Date;
  level: TestLogLevel;
  message: string;
  context?: Record<string, unknown>;
  duration?: number;
  phase?: 'RED' | 'GREEN' | 'REFACTOR';
}

/**
 * Test Logger Service
 * Encapsulates all test-related logging to avoid direct console usage
 */
export class TestLogger {
  private static instance: TestLogger | null = null;
  private entries: TestLogEntry[] = [];
  private enableConsoleOutput: boolean = false;

  constructor(enableConsoleOutput = false) {
    this.enableConsoleOutput = enableConsoleOutput;
  }

  static getInstance(enableConsoleOutput = false): TestLogger {
    if (!TestLogger.instance) {
      TestLogger.instance = new TestLogger(enableConsoleOutput);
    }
    return TestLogger.instance;
  }

  static resetInstance(): void {
    TestLogger.instance = null;
  }

  /**
   * Log debug information
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(TestLogLevel.DEBUG, message, context);
  }

  /**
   * Log general information
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(TestLogLevel.INFO, message, context);
  }

  /**
   * Log warning messages
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log(TestLogLevel.WARN, message, context);
  }

  /**
   * Log error messages
   */
  error(message: string, context?: Record<string, unknown>): void {
    this.log(TestLogLevel.ERROR, message, context);
  }

  /**
   * Log performance metrics
   */
  performance(
    message: string,
    duration?: number,
    context?: Record<string, unknown>,
  ): void {
    this.log(TestLogLevel.PERFORMANCE, message, { ...context, duration });
  }

  /**
   * Log TDD phase transitions
   */
  tddPhase(
    phase: 'RED' | 'GREEN' | 'REFACTOR',
    message: string,
    context?: Record<string, unknown>,
  ): void {
    const phaseEmojis = { RED: '🔴', GREEN: '🟢', REFACTOR: '🔵' };
    const formattedMessage = `${phaseEmojis[phase]} ${phase} PHASE: ${message}`;

    this.log(TestLogLevel.TDD, formattedMessage, { ...context, phase });
  }

  /**
   * Core logging method
   */
  private log(
    level: TestLogLevel,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    const entry: TestLogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
    };

    this.entries.push(entry);

    // Only output to console if explicitly enabled (for debugging tests)
    if (this.enableConsoleOutput) {
      this.outputToConsole(entry);
    }
  }

  /**
   * Controlled console output for debugging
   */
  private outputToConsole(entry: TestLogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelColors = {
      DEBUG: '\x1B[36m', // Cyan
      INFO: '\x1B[32m', // Green
      WARN: '\x1B[33m', // Yellow
      ERROR: '\x1B[31m', // Red
      PERFORMANCE: '\x1B[35m', // Magenta
      TDD: '\x1B[34m', // Blue
    };
    const reset = '\x1B[0m';

    const color = levelColors[entry.level];
    const prefix = `${color}[TEST-${entry.level}]${reset}`;
    const formattedMessage = `${timestamp} ${prefix} ${entry.message}`;

    // This is a logger utility - console usage is intentional and required
    // We're encapsulating console to provide controlled output in test environments
    const globalConsole = global.console;
    if (entry.level === TestLogLevel.ERROR) {
      globalConsole.error(formattedMessage, entry.context || '');
    } else if (entry.level === TestLogLevel.WARN) {
      globalConsole.warn(formattedMessage, entry.context || '');
    } else {
      globalConsole.log(formattedMessage, entry.context || '');
    }
  }

  /**
   * Get all log entries
   */
  getEntries(): TestLogEntry[] {
    return [...this.entries];
  }

  /**
   * Get entries by level
   */
  getEntriesByLevel(level: TestLogLevel): TestLogEntry[] {
    return this.entries.filter((entry) => entry.level === level);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalEntries: number;
    byLevel: Record<TestLogLevel, number>;
    errors: number;
    warnings: number;
  } {
    const byLevel = Object.values(TestLogLevel).reduce(
      (acc, level) => ({ ...acc, [level]: 0 }),
      {} as Record<TestLogLevel, number>,
    );

    this.entries.forEach((entry) => {
      byLevel[entry.level]++;
    });

    return {
      totalEntries: this.entries.length,
      byLevel,
      errors: byLevel[TestLogLevel.ERROR],
      warnings: byLevel[TestLogLevel.WARN],
    };
  }

  /**
   * Enable console output for debugging
   */
  enableConsole(): void {
    this.enableConsoleOutput = true;
  }

  /**
   * Disable console output
   */
  disableConsole(): void {
    this.enableConsoleOutput = false;
  }
}

/**
 * Singleton instance for easy access
 */
export const testLogger = TestLogger.getInstance();
