/**
 * Test Logger Utility Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { TestLogger, TestLogLevel } from './test-logger.utility';

describe('TestLogger', () => {
  let logger: TestLogger;

  beforeEach(() => {
    TestLogger.resetInstance();
    logger = TestLogger.getInstance();
  });

  describe('logging methods', () => {
    it('should log debug messages', () => {
      logger.debug('Test debug message', { key: 'value' });

      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe(TestLogLevel.DEBUG);
      expect(entries[0].message).toBe('Test debug message');
      expect(entries[0].context).toEqual({ key: 'value' });
    });

    it('should log info messages', () => {
      logger.info('Test info message');

      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe(TestLogLevel.INFO);
      expect(entries[0].message).toBe('Test info message');
    });

    it('should log warning messages', () => {
      logger.warn('Test warning message');

      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe(TestLogLevel.WARN);
      expect(entries[0].message).toBe('Test warning message');
    });

    it('should log error messages', () => {
      logger.error('Test error message');

      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe(TestLogLevel.ERROR);
      expect(entries[0].message).toBe('Test error message');
    });

    it('should log performance messages with duration', () => {
      logger.performance('Test performance', 1500, { operation: 'test' });

      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe(TestLogLevel.PERFORMANCE);
      expect(entries[0].message).toBe('Test performance');
      expect(entries[0].context).toEqual({ operation: 'test', duration: 1500 });
    });

    it('should log TDD phase messages', () => {
      logger.tddPhase('RED', 'Starting test', { testName: 'example' });

      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe(TestLogLevel.TDD);
      expect(entries[0].message).toBe('🔴 RED PHASE: Starting test');
      expect(entries[0].context).toEqual({ testName: 'example', phase: 'RED' });
    });
  });

  describe('filtering and querying', () => {
    beforeEach(() => {
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');
      logger.performance('Performance message', 100);
    });

    it('should get entries by level', () => {
      const debugEntries = logger.getEntriesByLevel(TestLogLevel.DEBUG);
      const errorEntries = logger.getEntriesByLevel(TestLogLevel.ERROR);

      expect(debugEntries).toHaveLength(1);
      expect(debugEntries[0].message).toBe('Debug message');
      expect(errorEntries).toHaveLength(1);
      expect(errorEntries[0].message).toBe('Error message');
    });

    it('should provide summary statistics', () => {
      const summary = logger.getSummary();

      expect(summary.totalEntries).toBe(5);
      expect(summary.errors).toBe(1);
      expect(summary.warnings).toBe(1);
      expect(summary.byLevel[TestLogLevel.DEBUG]).toBe(1);
      expect(summary.byLevel[TestLogLevel.INFO]).toBe(1);
      expect(summary.byLevel[TestLogLevel.WARN]).toBe(1);
      expect(summary.byLevel[TestLogLevel.ERROR]).toBe(1);
      expect(summary.byLevel[TestLogLevel.PERFORMANCE]).toBe(1);
    });

    it('should clear all entries', () => {
      expect(logger.getEntries()).toHaveLength(5);

      logger.clear();

      expect(logger.getEntries()).toHaveLength(0);
      expect(logger.getSummary().totalEntries).toBe(0);
    });
  });

  describe('singleton behavior', () => {
    it('should return the same instance', () => {
      const instance1 = TestLogger.getInstance();
      const instance2 = TestLogger.getInstance();

      expect(instance1).toBe(instance2);

      instance1.info('Test message');
      expect(instance2.getEntries()).toHaveLength(1);
    });

    it('should reset instance correctly', () => {
      const instance1 = TestLogger.getInstance();
      instance1.info('Test message');

      TestLogger.resetInstance();
      const instance2 = TestLogger.getInstance();

      expect(instance1).not.toBe(instance2);
      expect(instance2.getEntries()).toHaveLength(0);
    });
  });

  describe('console output control', () => {
    it('should not output to console by default', () => {
      // This test verifies that console output is disabled by default
      // The actual console output would need to be mocked to test fully
      expect(logger['enableConsoleOutput']).toBe(false);
    });

    it('should enable console output when requested', () => {
      logger.enableConsole();
      expect(logger['enableConsoleOutput']).toBe(true);

      logger.disableConsole();
      expect(logger['enableConsoleOutput']).toBe(false);
    });
  });

  describe('timestamp handling', () => {
    it('should include timestamps in log entries', () => {
      const beforeTime = Date.now();
      logger.info('Test message');
      const afterTime = Date.now();

      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);

      const entryTime = entries[0].timestamp.getTime();
      expect(entryTime).toBeGreaterThanOrEqual(beforeTime);
      expect(entryTime).toBeLessThanOrEqual(afterTime);
    });
  });
});
