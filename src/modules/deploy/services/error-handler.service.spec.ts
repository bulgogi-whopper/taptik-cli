import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { DeployError, DeployErrorCode } from '../errors/deploy.error';

import { ErrorHandlerService } from './error-handler.service';

describe('ErrorHandlerService', () => {
  let service: ErrorHandlerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ErrorHandlerService],
    }).compile();

    service = module.get<ErrorHandlerService>(ErrorHandlerService);

    // Mock console methods
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('handleError', () => {
    it('should convert generic errors to DeployError', async () => {
      const genericError = new Error('Something went wrong');
      const result = await service.handleError(genericError, {
        operation: 'test',
      });

      expect(result).toBeInstanceOf(DeployError);
      expect(result.code).toBe(DeployErrorCode.UNKNOWN_ERROR);
      expect(result.message).toBe('Something went wrong');
      expect(result.context.operation).toBe('test');
    });

    it('should detect file not found errors', async () => {
      const error = new Error('ENOENT: no such file or directory');
      const result = await service.handleError(error);

      expect(result.code).toBe(DeployErrorCode.FILE_NOT_FOUND);
    });

    it('should detect permission errors', async () => {
      const error = new Error('EACCES: permission denied');
      const result = await service.handleError(error);

      expect(result.code).toBe(DeployErrorCode.PERMISSION_DENIED);
      expect(result.severity).toBe('critical');
    });

    it('should detect network errors', async () => {
      const error = new Error('network timeout');
      const result = await service.handleError(error);

      expect(result.code).toBe(DeployErrorCode.NETWORK_ERROR);
    });

    it('should preserve DeployError instances', async () => {
      const deployError = new DeployError(
        DeployErrorCode.MALICIOUS_CONTENT,
        'Malicious content detected',
        'critical',
      );

      const result = await service.handleError(deployError);

      expect(result).toBe(deployError);
    });

    it('should add recovery strategy for network errors', async () => {
      const error = new Error('network error');
      const result = await service.handleError(error);

      expect(result.context.retryConfig).toBeDefined();
      expect((result.context.retryConfig as any).maxAttempts).toBe(5);
    });

    it('should mark security errors for rollback', async () => {
      const error = new DeployError(
        DeployErrorCode.MALICIOUS_CONTENT,
        'Malicious content',
        'critical',
      );

      const result = await service.handleError(error);

      expect(result.context.shouldRollback).toBe(true);
      expect(result.context.shouldCleanup).toBe(true);
    });
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const function_ = vi.fn().mockResolvedValue('success');
      const result = await service.executeWithRetry(function_);

      expect(result).toBe('success');
      expect(function_).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const function_ = vi
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce('success');

      const result = await service.executeWithRetry(
        function_,
        {},
        { initialDelay: 10 },
      );

      expect(result).toBe('success');
      expect(function_).toHaveBeenCalledTimes(2);
    });

    it('should throw after max attempts', async () => {
      const function_ = vi.fn().mockRejectedValue(new Error('network error'));

      await expect(
        service.executeWithRetry(
          function_,
          {},
          { maxAttempts: 2, initialDelay: 10 },
        ),
      ).rejects.toThrow(DeployError);

      expect(function_).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const function_ = vi
        .fn()
        .mockRejectedValue(
          new DeployError(
            DeployErrorCode.MALICIOUS_CONTENT,
            'Malicious',
            'critical',
          ),
        );

      await expect(service.executeWithRetry(function_)).rejects.toThrow(
        DeployError,
      );
      expect(function_).toHaveBeenCalledTimes(1);
    });

    it('should apply exponential backoff', async () => {
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;

      // Mock setTimeout to capture delays
      vi.spyOn(global, 'setTimeout').mockImplementation(
        (function_: any, delay?: number) => {
          if (delay) delays.push(delay);
          function_();
          return 0 as any;
        },
      );

      const function_ = vi
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce('success');

      await service.executeWithRetry(
        function_,
        {},
        {
          initialDelay: 100,
          backoffMultiplier: 2,
          maxAttempts: 3,
        },
      );

      expect(delays[0]).toBe(100);
      expect(delays[1]).toBe(200);

      global.setTimeout = originalSetTimeout;
    });
  });

  describe('handleNetworkError', () => {
    it('should use network-specific retry configuration', async () => {
      // Mock delays to speed up test
      vi.spyOn(global, 'setTimeout').mockImplementation((function__: any) => {
        function__();
        return 0 as any;
      });

      const function_ = vi
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce('success');

      const result = await service.handleNetworkError(function_);

      expect(result).toBe('success');
      expect(function_).toHaveBeenCalledTimes(2);
    });

    it('should have higher retry attempts for network errors', async () => {
      const function_ = vi
        .fn()
        .mockRejectedValue(new Error('network unreachable'));

      // Mock delays to speed up test
      vi.spyOn(global, 'setTimeout').mockImplementation((function__: any) => {
        function__();
        return 0 as any;
      });

      await expect(service.handleNetworkError(function_)).rejects.toThrow();

      // Should try 5 times for network errors
      expect(function_).toHaveBeenCalledTimes(5);
    });
  });

  describe('handleFileSystemError', () => {
    it('should handle permission errors with alternative paths', async () => {
      let attemptCount = 0;
      const function_ = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('EACCES: permission denied');
        }
        return Promise.resolve('success');
      });

      const result = await service.handleFileSystemError(function_, {
        filePath: '~/.claude/settings.json',
      });

      expect(result).toBe('success');
      expect(function_).toHaveBeenCalledTimes(2);
    });

    it('should throw DeployError for unrecoverable file system errors', async () => {
      const function_ = vi
        .fn()
        .mockRejectedValue(new Error('ENOSPC: no space left'));

      await expect(service.handleFileSystemError(function_)).rejects.toThrow(
        DeployError,
      );
      expect(function_).toHaveBeenCalledTimes(1);
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable errors', () => {
      const networkError = new DeployError(
        DeployErrorCode.NETWORK_ERROR,
        'Network error',
      );
      const lockError = new DeployError(
        DeployErrorCode.LOCK_ACQUISITION_FAILED,
        'Lock failed',
      );

      expect(service.isRetryableError(networkError)).toBe(true);
      expect(service.isRetryableError(lockError)).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      const validationError = new DeployError(
        DeployErrorCode.VALIDATION_FAILED,
        'Invalid',
      );
      const securityError = new DeployError(
        DeployErrorCode.MALICIOUS_CONTENT,
        'Malicious',
      );

      expect(service.isRetryableError(validationError)).toBe(false);
      expect(service.isRetryableError(securityError)).toBe(false);
    });
  });

  describe('requiresRollback', () => {
    it('should require rollback for deployment failures', () => {
      const deployError = new DeployError(
        DeployErrorCode.DEPLOYMENT_FAILED,
        'Deploy failed',
      );
      const componentError = new DeployError(
        DeployErrorCode.COMPONENT_DEPLOY_FAILED,
        'Component failed',
      );

      expect(service.requiresRollback(deployError)).toBe(true);
      expect(service.requiresRollback(componentError)).toBe(true);
    });

    it('should require rollback for security violations', () => {
      const maliciousError = new DeployError(
        DeployErrorCode.MALICIOUS_CONTENT,
        'Malicious',
      );
      const traversalError = new DeployError(
        DeployErrorCode.PATH_TRAVERSAL,
        'Path traversal',
      );

      expect(service.requiresRollback(maliciousError)).toBe(true);
      expect(service.requiresRollback(traversalError)).toBe(true);
    });

    it('should not require rollback for validation errors', () => {
      const validationError = new DeployError(
        DeployErrorCode.VALIDATION_FAILED,
        'Invalid',
      );
      const schemaError = new DeployError(
        DeployErrorCode.SCHEMA_MISMATCH,
        'Schema mismatch',
      );

      expect(service.requiresRollback(validationError)).toBe(false);
      expect(service.requiresRollback(schemaError)).toBe(false);
    });
  });

  describe('createErrorResponse', () => {
    it('should create standardized error response', () => {
      const errors = [
        new DeployError(
          DeployErrorCode.VALIDATION_FAILED,
          'Invalid config',
          'error',
        ),
        new DeployError(
          DeployErrorCode.NETWORK_ERROR,
          'Network timeout',
          'warning',
        ),
      ];

      const response = service.createErrorResponse(errors);

      expect(response.success).toBe(false);
      expect(response.errors).toHaveLength(2);
      expect(response.errors[0].code).toBe('200');
      expect(response.errors[1].code).toBe('103');
      expect(response.exitCode).toBeGreaterThan(0);
    });

    it('should use highest exit code from multiple errors', () => {
      const errors = [
        new DeployError(DeployErrorCode.IMPORT_FAILED, 'Import failed'), // 100 -> exit 2
        new DeployError(DeployErrorCode.DEPLOYMENT_FAILED, 'Deploy failed'), // 500 -> exit 6
      ];

      const response = service.createErrorResponse(errors);

      expect(response.exitCode).toBe(6); // Higher of the two
    });
  });
});
