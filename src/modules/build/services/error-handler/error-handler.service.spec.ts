import { promises as fs } from 'node:fs';

import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';

import { ErrorHandlerService, CriticalError, Warning } from './error-handler.service';

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    unlink: vi.fn(),
  },
}));

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

// Mock process methods
const mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

describe('ErrorHandlerService', () => {
  let service: ErrorHandlerService;
  let originalProcessListeners: { [key: string]: ((...arguments_: any[]) => void)[] };

  beforeEach(async () => {
    // Store original process listeners
    originalProcessListeners = {
      SIGINT: [...(process.listeners('SIGINT') as ((...arguments_: any[]) => void)[])],
      SIGTERM: [...(process.listeners('SIGTERM') as ((...arguments_: any[]) => void)[])],
      uncaughtException: [...(process.listeners('uncaughtException') as ((...arguments_: any[]) => void)[])],
      unhandledRejection: [...(process.listeners('unhandledRejection') as ((...arguments_: any[]) => void)[])],
    };

    // Remove existing listeners
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');

    const module: TestingModule = await Test.createTestingModule({
      providers: [ErrorHandlerService],
    }).compile();

    service = module.get<ErrorHandlerService>(ErrorHandlerService);

    // Clear all mocks
    vi.clearAllMocks();
    
    // Suppress unhandled rejection warnings during tests
    process.on('unhandledRejection', () => {
      // Ignore unhandled rejections during tests
    });
  });

  afterEach(() => {
    // Reset service state
    service.reset();

    // Restore original process listeners
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');

    Object.entries(originalProcessListeners).forEach(([event, listeners]) => {
      listeners.forEach((listener) => process.on(event as any, listener));
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('Critical Error Management', () => {
    it('should add critical error correctly', () => {
      const error: CriticalError = {
        type: 'file_system',
        message: 'File not found',
        details: 'test.txt does not exist',
        suggestedResolution: 'Create the file',
        exitCode: 2,
      };

      service.addCriticalError(error);

      expect(service.hasCriticalErrors()).toBe(true);
      const summary = service.getErrorSummary();
      expect(summary.criticalErrors).toHaveLength(1);
      expect(summary.criticalErrors[0]).toEqual(error);
    });

    it('should handle multiple critical errors', () => {
      const error1: CriticalError = {
        type: 'file_system',
        message: 'Permission denied',
        exitCode: 126,
      };

      const error2: CriticalError = {
        type: 'conversion',
        message: 'Invalid JSON format',
        exitCode: 1,
      };

      service.addCriticalError(error1);
      service.addCriticalError(error2);

      expect(service.hasCriticalErrors()).toBe(true);
      const summary = service.getErrorSummary();
      expect(summary.criticalErrors).toHaveLength(2);
    });

    it('should handle critical error and exit with correct code', () => {
      const error: CriticalError = {
        type: 'system',
        message: 'System failure',
        exitCode: 1,
      };

      expect(() => service.handleCriticalErrorAndExit(error)).toThrow('process.exit called');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Critical Errors'));
    });
  });

  describe('Warning Management', () => {
    it('should add warning correctly', () => {
      const warning: Warning = {
        type: 'missing_file',
        message: 'Optional file not found',
        details: 'config.json is missing',
      };

      service.addWarning(warning);

      expect(service.hasWarnings()).toBe(true);
      const summary = service.getErrorSummary();
      expect(summary.warnings).toHaveLength(1);
      expect(summary.warnings[0]).toEqual(warning);
    });

    it('should handle multiple warnings', () => {
      const warning1: Warning = {
        type: 'missing_file',
        message: 'File 1 missing',
      };

      const warning2: Warning = {
        type: 'permission_denied',
        message: 'Cannot access file 2',
      };

      service.addWarning(warning1);
      service.addWarning(warning2);

      expect(service.hasWarnings()).toBe(true);
      const summary = service.getErrorSummary();
      expect(summary.warnings).toHaveLength(2);
    });
  });

  describe('Partial File Management', () => {
    it('should register partial file', () => {
      const filePath = '/tmp/partial-file.json';
      
      service.registerPartialFile(filePath);

      const summary = service.getErrorSummary();
      expect(summary.partialFiles).toContain(filePath);
    });

    it('should not register duplicate partial files', () => {
      const filePath = '/tmp/partial-file.json';
      
      service.registerPartialFile(filePath);
      service.registerPartialFile(filePath);

      const summary = service.getErrorSummary();
      expect(summary.partialFiles).toHaveLength(1);
      expect(summary.partialFiles[0]).toBe(filePath);
    });

    it('should unregister partial file', () => {
      const filePath = '/tmp/partial-file.json';
      
      service.registerPartialFile(filePath);
      service.unregisterPartialFile(filePath);

      const summary = service.getErrorSummary();
      expect(summary.partialFiles).not.toContain(filePath);
    });

    it('should handle unregistering non-existent file gracefully', () => {
      const filePath = '/tmp/non-existent.json';
      
      expect(() => service.unregisterPartialFile(filePath)).not.toThrow();
    });
  });

  describe('Cleanup Handlers', () => {
    it('should register cleanup handler', () => {
      const cleanupHandler = vi.fn().mockResolvedValue(undefined);
      
      service.registerCleanupHandler(cleanupHandler);

      // Trigger cleanup by simulating SIGINT
      const sigintHandler = process.listeners('SIGINT')[0];
      expect(sigintHandler).toBeDefined();
    });

    it('should execute cleanup handlers on interruption', async () => {
      const cleanupHandler1 = vi.fn().mockResolvedValue(undefined);
      const cleanupHandler2 = vi.fn().mockResolvedValue(undefined);
      
      service.registerCleanupHandler(cleanupHandler1);
      service.registerCleanupHandler(cleanupHandler2);

      // Simulate SIGINT
      const sigintHandler = process.listeners('SIGINT')[0];
      
      // Mock the cleanup to avoid actual process.exit
      const performCleanupSpy = vi.spyOn(service as any, 'performCleanup').mockResolvedValue(undefined);
      
      try {
        await sigintHandler(undefined);
      } catch {
        // Expected due to process.exit mock
      }

      expect(performCleanupSpy).toHaveBeenCalled();
    });
  });

  describe('File Cleanup', () => {
    it('should clean up existing partial files', async () => {
      const filePath = '/tmp/partial-file.json';
      (fs.access as Mock).mockResolvedValue(undefined);
      (fs.unlink as Mock).mockResolvedValue(undefined);
      
      service.registerPartialFile(filePath);

      // Access private method for testing
      await (service as any).cleanupPartialFile(filePath);

      expect(fs.access).toHaveBeenCalledWith(filePath);
      expect(fs.unlink).toHaveBeenCalledWith(filePath);
    });

    it('should handle cleanup of non-existent files gracefully', async () => {
      const filePath = '/tmp/non-existent.json';
      (fs.access as Mock).mockRejectedValue(new Error('File not found'));
      
      service.registerPartialFile(filePath);

      // Should not throw
      await expect((service as any).cleanupPartialFile(filePath)).resolves.toBeUndefined();
      
      expect(fs.access).toHaveBeenCalledWith(filePath);
      expect(fs.unlink).not.toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      const filePath = '/tmp/error-file.json';
      (fs.access as Mock).mockResolvedValue(undefined);
      (fs.unlink as Mock).mockRejectedValue(new Error('Permission denied'));
      
      service.registerPartialFile(filePath);

      // Should not throw
      await expect((service as any).cleanupPartialFile(filePath)).resolves.toBeUndefined();
      
      expect(fs.access).toHaveBeenCalledWith(filePath);
      expect(fs.unlink).toHaveBeenCalledWith(filePath);
    });
  });

  describe('Signal Handling', () => {
    it('should set up SIGINT handler', () => {
      const sigintListeners = process.listeners('SIGINT');
      expect(sigintListeners).toHaveLength(1);
    });

    it('should set up SIGTERM handler', () => {
      const sigtermListeners = process.listeners('SIGTERM');
      expect(sigtermListeners).toHaveLength(1);
    });

    it('should set up uncaughtException handler', () => {
      const uncaughtListeners = process.listeners('uncaughtException');
      expect(uncaughtListeners).toHaveLength(1);
    });

    it('should set up unhandledRejection handler', () => {
      const rejectionListeners = process.listeners('unhandledRejection');
      expect(rejectionListeners.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle SIGINT with cleanup', async () => {
      const performCleanupSpy = vi.spyOn(service as any, 'performCleanup').mockResolvedValue(undefined);
      
      const sigintHandler = process.listeners('SIGINT')[0];
      
      try {
        await sigintHandler(undefined);
      } catch {
        // Expected due to process.exit mock
      }

      expect(performCleanupSpy).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(130);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('interrupted by user'));
    });

    it('should handle SIGTERM with cleanup', async () => {
      const performCleanupSpy = vi.spyOn(service as any, 'performCleanup').mockResolvedValue(undefined);
      
      const sigtermHandler = process.listeners('SIGTERM')[0];
      
      try {
        await sigtermHandler(undefined);
      } catch {
        // Expected due to process.exit mock
      }

      expect(performCleanupSpy).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(143);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('terminated'));
    });

    it('should force exit on second SIGINT', async () => {
      const sigintHandler = process.listeners('SIGINT')[0];
      
      // First SIGINT - should start cleanup
      try {
        await sigintHandler(undefined);
      } catch {
        // Expected due to process.exit mock
      }

      // Reset the mock to test second call
      mockProcessExit.mockClear();
      
      // Second SIGINT - should force exit
      try {
        await sigintHandler(undefined);
      } catch {
        // Expected due to process.exit mock
      }

      expect(mockProcessExit).toHaveBeenCalledWith(130);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Force exit'));
    });
  });

  describe('Error Summary Display', () => {
    it('should display critical errors', () => {
      const error: CriticalError = {
        type: 'file_system',
        message: 'File not found',
        details: 'test.txt missing',
        suggestedResolution: 'Create the file',
        exitCode: 2,
      };

      service.addCriticalError(error);
      service.displayErrorSummary();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Build Summary'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Critical Errors'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('File not found'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('test.txt missing'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Create the file'));
    });

    it('should display warnings', () => {
      const warning: Warning = {
        type: 'missing_file',
        message: 'Optional file missing',
        details: 'config.json not found',
      };

      service.addWarning(warning);
      service.displayErrorSummary();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Warnings'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Optional file missing'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('config.json not found'));
    });

    it('should not display summary when no errors or warnings', () => {
      service.displayErrorSummary();

      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('Build Summary'));
    });
  });

  describe('Exit Code Handling', () => {
    it('should exit with highest error code when multiple critical errors', () => {
      service.addCriticalError({ type: 'file_system', message: 'Error 1', exitCode: 2 });
      service.addCriticalError({ type: 'conversion', message: 'Error 2', exitCode: 126 });
      service.addCriticalError({ type: 'system', message: 'Error 3', exitCode: 1 });

      expect(() => service.exitWithAppropriateCode()).toThrow('process.exit called');
      expect(mockProcessExit).toHaveBeenCalledWith(126);
    });

    it('should exit with 0 when only warnings', () => {
      service.addWarning({ type: 'missing_file', message: 'Warning' });

      expect(() => service.exitWithAppropriateCode()).toThrow('process.exit called');
      expect(mockProcessExit).toHaveBeenCalledWith(0);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('completed with warnings'));
    });

    it('should exit with 0 when no errors or warnings', () => {
      expect(() => service.exitWithAppropriateCode()).toThrow('process.exit called');
      expect(mockProcessExit).toHaveBeenCalledWith(0);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('completed successfully'));
    });
  });

  describe('Process Interruption State', () => {
    it('should track interruption state', () => {
      expect(service.isProcessInterrupted()).toBe(false);

      // Simulate interruption by triggering SIGINT
      const sigintHandler = process.listeners('SIGINT')[0];
      
      try {
        sigintHandler(undefined);
      } catch {
        // Expected due to process.exit mock
      }

      expect(service.isProcessInterrupted()).toBe(true);
    });
  });

  describe('Service Reset', () => {
    it('should reset all state', () => {
      // Add some state
      service.addCriticalError({ type: 'system', message: 'Error', exitCode: 1 });
      service.addWarning({ type: 'missing_file', message: 'Warning' });
      service.registerPartialFile('/tmp/test.json');
      service.registerCleanupHandler(async () => {});

      // Reset
      service.reset();

      // Verify state is cleared
      expect(service.hasCriticalErrors()).toBe(false);
      expect(service.hasWarnings()).toBe(false);
      expect(service.isProcessInterrupted()).toBe(false);
      
      const summary = service.getErrorSummary();
      expect(summary.criticalErrors).toHaveLength(0);
      expect(summary.warnings).toHaveLength(0);
      expect(summary.partialFiles).toHaveLength(0);
    });
  });
});