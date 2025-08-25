import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { PushError, PushErrorCode } from '../constants/push.constants';

import { ErrorRecoveryService } from './error-recovery.service';

describe('ErrorRecoveryService', () => {
  let service: ErrorRecoveryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ErrorRecoveryService],
    }).compile();

    service = module.get<ErrorRecoveryService>(ErrorRecoveryService);
    
    // Mock sleep to speed up tests
    vi.spyOn(service as any, 'sleep').mockResolvedValue(undefined);
  });

  describe('executeWithRetry', () => {
    it('should execute operation successfully on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await service.executeWithRetry(operation, 'test-operation');
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new PushError(PushErrorCode.NET_CONNECTION_FAILED, 'Connection failed'))
        .mockResolvedValue('success');
      
      const result = await service.executeWithRetry(operation, 'test-operation', { maxAttempts: 3 });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      const operation = vi.fn()
        .mockRejectedValue(new PushError(PushErrorCode.VAL_INVALID_FILE, 'Invalid file'));
      
      await expect(service.executeWithRetry(operation, 'test-operation')).rejects.toThrow('Invalid file');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should throw error after max attempts', async () => {
      const error = new PushError(PushErrorCode.NET_TIMEOUT, 'Timeout');
      const operation = vi.fn().mockRejectedValue(error);
      
      await expect(service.executeWithRetry(operation, 'test-operation', { maxAttempts: 2 }))
        .rejects.toThrow('Timeout');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should calculate exponential backoff correctly', async () => {
      const sleepSpy = vi.spyOn(service as any, 'sleep');
      const operation = vi.fn()
        .mockRejectedValueOnce(new PushError(PushErrorCode.NET_TIMEOUT, 'Timeout'))
        .mockRejectedValueOnce(new PushError(PushErrorCode.NET_TIMEOUT, 'Timeout'))
        .mockResolvedValue('success');
      
      await service.executeWithRetry(operation, 'test-operation', {
        baseDelay: 100,
        backoffMultiplier: 2,
        jitter: false,
      });
      
      expect(sleepSpy).toHaveBeenNthCalledWith(1, 100);
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 200);
    });

    it('should wrap non-PushError errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Generic error'));
      
      try {
        await service.executeWithRetry(operation, 'test-operation');
      } catch (error) {
        expect(error).toBeInstanceOf(PushError);
        expect((error as PushError).code).toBe(PushErrorCode.SYS_UNKNOWN_ERROR);
      }
    });
  });

  describe('createRecoveryState', () => {
    it('should create initial recovery state', () => {
      const state = service.createRecoveryState();
      
      expect(state.attemptNumber).toBe(0);
      expect(state.successfulSteps).toEqual([]);
      expect(state.startTime).toBeInstanceOf(Date);
      expect(state.lastError).toBeUndefined();
      expect(state.failedStep).toBeUndefined();
    });
  });

  describe('recordSuccess', () => {
    it('should record successful step', () => {
      const state = service.createRecoveryState();
      
      service.recordSuccess(state, 'step1');
      service.recordSuccess(state, 'step2');
      
      expect(state.successfulSteps).toEqual(['step1', 'step2']);
    });
  });

  describe('recordFailure', () => {
    it('should record failed step', () => {
      const state = service.createRecoveryState();
      const error = new PushError(PushErrorCode.NET_TIMEOUT, 'Timeout');
      
      service.recordFailure(state, 'failing-step', error);
      
      expect(state.failedStep).toBe('failing-step');
      expect(state.lastError).toBe(error);
      expect(state.attemptNumber).toBe(1);
    });
  });

  describe('shouldRetry', () => {
    it('should return true for retryable errors within limits', () => {
      const state = service.createRecoveryState();
      state.lastError = new PushError(PushErrorCode.NET_CONNECTION_FAILED, 'Connection failed');
      state.attemptNumber = 1;
      
      expect(service.shouldRetry(state, 3)).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const state = service.createRecoveryState();
      state.lastError = new PushError(PushErrorCode.VAL_INVALID_FILE, 'Invalid file');
      state.attemptNumber = 1;
      
      expect(service.shouldRetry(state, 3)).toBe(false);
    });

    it('should return false when max attempts reached', () => {
      const state = service.createRecoveryState();
      state.lastError = new PushError(PushErrorCode.NET_TIMEOUT, 'Timeout');
      state.attemptNumber = 3;
      
      expect(service.shouldRetry(state, 3)).toBe(false);
    });

    it('should return false when time limit exceeded', () => {
      const state = service.createRecoveryState();
      state.startTime = new Date(Date.now() - 6 * 60 * 1000); // 6 minutes ago
      state.lastError = new PushError(PushErrorCode.NET_TIMEOUT, 'Timeout');
      state.attemptNumber = 1;
      
      expect(service.shouldRetry(state, 3)).toBe(false);
    });

    it('should return false when no error', () => {
      const state = service.createRecoveryState();
      
      expect(service.shouldRetry(state, 3)).toBe(false);
    });
  });

  describe('generateRecoverySuggestion', () => {
    it('should return remediation if available', () => {
      const error = new PushError(
        PushErrorCode.AUTH_NOT_AUTHENTICATED,
        'Not authenticated'
      );
      
      const suggestion = service.generateRecoverySuggestion(error);
      
      expect(suggestion).toBe('Run "taptik auth login" to authenticate');
    });

    it('should return custom suggestion for specific errors', () => {
      const error = new PushError(PushErrorCode.NET_CONNECTION_FAILED, 'Connection failed');
      error.remediation = undefined; // Clear default remediation
      
      const suggestion = service.generateRecoverySuggestion(error);
      
      expect(suggestion).toContain('internet connection');
    });

    it('should return default suggestion for unknown errors', () => {
      const error = new PushError(PushErrorCode.SYS_UNKNOWN_ERROR, 'Unknown error');
      error.remediation = undefined;
      
      const suggestion = service.generateRecoverySuggestion(error);
      
      expect(suggestion).toContain('try again later');
    });
  });

  describe('logErrorDetails', () => {
    it('should sanitize sensitive context', () => {
      const logSpy = vi.spyOn(service['logger'], 'error').mockImplementation(() => {});
      
      const error = new PushError(
        PushErrorCode.AUTH_NOT_AUTHENTICATED,
        'Not authenticated',
        {
          userId: 'user-12345678-90ab-cdef-ghij-klmnopqrstuv',
          details: {
            password: 'secret',
            token: 'bearer-token',
            apiKey: 'api-key-123',
            secret: 'secret-value',
            normalField: 'normal-value',
          },
        }
      );
      
      service.logErrorDetails(error);
      
      const logCall = logSpy.mock.calls[0];
      const loggedContext = logCall[1] as any;
      
      expect(loggedContext.context.userId).toBe('user-123...');
      expect(loggedContext.context.details.password).toBeUndefined();
      expect(loggedContext.context.details.token).toBeUndefined();
      expect(loggedContext.context.details.apiKey).toBeUndefined();
      expect(loggedContext.context.details.secret).toBeUndefined();
      expect(loggedContext.context.details.normalField).toBe('normal-value');
    });

    it('should include stack trace when requested', () => {
      const logSpy = vi.spyOn(service['logger'], 'error').mockImplementation(() => {});
      const error = new PushError(PushErrorCode.SYS_INTERNAL_ERROR, 'Internal error');
      
      service.logErrorDetails(error, true);
      
      const logCall = logSpy.mock.calls[0];
      const loggedData = logCall[1] as any;
      
      expect(loggedData.stack).toBeDefined();
    });
  });
});