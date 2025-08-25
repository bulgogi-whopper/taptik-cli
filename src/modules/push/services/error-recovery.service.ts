import { Injectable, Logger } from '@nestjs/common';

import { PushError, PushErrorCode } from '../constants/push.constants';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
}

export interface RecoveryState {
  attemptNumber: number;
  lastError?: PushError;
  startTime: Date;
  successfulSteps: string[];
  failedStep?: string;
}

@Injectable()
export class ErrorRecoveryService {
  private readonly logger = new Logger(ErrorRecoveryService.name);
  private readonly defaultRetryOptions: Required<RetryOptions> = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
  };

  /**
   * Execute an operation with automatic retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    options?: RetryOptions,
  ): Promise<T> {
    const retryOptions = { ...this.defaultRetryOptions, ...options };
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retryOptions.maxAttempts; attempt++) {
      try {
        this.logger.debug(`Attempting ${operationName} (attempt ${attempt}/${retryOptions.maxAttempts})`);
        return await operation();
      } catch (error) {
        lastError = error;
        
        const pushError = this.wrapError(error, operationName, attempt);
        
        if (!pushError.isRetryable || attempt === retryOptions.maxAttempts) {
          this.logger.error(`Operation ${operationName} failed after ${attempt} attempts`, pushError);
          throw pushError;
        }

        const delay = this.calculateDelay(attempt, retryOptions);
        this.logger.warn(
          `Operation ${operationName} failed (attempt ${attempt}), retrying in ${delay}ms...`,
          { error: pushError.message, code: pushError.code }
        );
        
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Wrap an error into a PushError with appropriate context
   */
  private wrapError(error: unknown, operation: string, attemptNumber: number): PushError {
    if (error instanceof PushError) {
      error.context.attemptNumber = attemptNumber;
      return error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const code = this.determineErrorCode(error);
    
    return new PushError(
      code,
      errorMessage,
      { operation, attemptNumber },
      error instanceof Error ? error : undefined,
    );
  }

  /**
   * Determine the appropriate error code based on the error
   */
  private determineErrorCode(error: unknown): PushErrorCode {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // Network-related errors
      if (message.includes('network') || message.includes('fetch') || message.includes('econnrefused')) {
        return PushErrorCode.NET_CONNECTION_FAILED;
      }
      if (message.includes('timeout') || message.includes('timedout')) {
        return PushErrorCode.NET_TIMEOUT;
      }
      if (message.includes('rate limit') || message.includes('too many requests')) {
        return PushErrorCode.NET_RATE_LIMITED;
      }
      if (message.includes('503') || message.includes('service unavailable')) {
        return PushErrorCode.NET_SERVICE_UNAVAILABLE;
      }
      
      // Auth-related errors
      if (message.includes('unauthorized') || message.includes('401')) {
        return PushErrorCode.AUTH_NOT_AUTHENTICATED;
      }
      if (message.includes('forbidden') || message.includes('403')) {
        return PushErrorCode.AUTH_INSUFFICIENT_PERMISSIONS;
      }
      if (message.includes('session') && message.includes('expired')) {
        return PushErrorCode.AUTH_SESSION_EXPIRED;
      }
      
      // Validation errors
      if (message.includes('invalid') && message.includes('file')) {
        return PushErrorCode.VAL_INVALID_FILE;
      }
      if (message.includes('too large') || message.includes('size limit')) {
        return PushErrorCode.VAL_FILE_TOO_LARGE;
      }
      
      // Storage errors
      if (message.includes('quota') || message.includes('storage limit')) {
        return PushErrorCode.STOR_QUOTA_EXCEEDED;
      }
      if (message.includes('upload') && message.includes('failed')) {
        return PushErrorCode.STOR_UPLOAD_FAILED;
      }
    }
    
    return PushErrorCode.SYS_UNKNOWN_ERROR;
  }

  /**
   * Calculate delay with exponential backoff and optional jitter
   */
  private calculateDelay(attempt: number, options: Required<RetryOptions>): number {
    const exponentialDelay = Math.min(
      options.baseDelay * Math.pow(options.backoffMultiplier, attempt - 1),
      options.maxDelay
    );
    
    if (options.jitter) {
      // Add random jitter (±25% of the delay)
      const jitterRange = exponentialDelay * 0.25;
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      return Math.round(exponentialDelay + jitter);
    }
    
    return exponentialDelay;
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a recovery state for tracking multi-step operations
   */
  createRecoveryState(): RecoveryState {
    return {
      attemptNumber: 0,
      startTime: new Date(),
      successfulSteps: [],
    };
  }

  /**
   * Record a successful step in the recovery state
   */
  recordSuccess(state: RecoveryState, stepName: string): void {
    state.successfulSteps.push(stepName);
    this.logger.debug(`Recovery state: Step "${stepName}" completed successfully`);
  }

  /**
   * Record a failed step in the recovery state
   */
  recordFailure(state: RecoveryState, stepName: string, error: PushError): void {
    state.failedStep = stepName;
    state.lastError = error;
    state.attemptNumber++;
    this.logger.warn(`Recovery state: Step "${stepName}" failed`, { error: error.message });
  }

  /**
   * Determine if we should retry based on the recovery state
   */
  shouldRetry(state: RecoveryState, maxAttempts: number = 3): boolean {
    if (!state.lastError) {
      return false;
    }
    
    if (!state.lastError.isRetryable) {
      return false;
    }
    
    if (state.attemptNumber >= maxAttempts) {
      return false;
    }
    
    // Don't retry if we've been trying for too long (5 minutes)
    const elapsedTime = Date.now() - state.startTime.getTime();
    if (elapsedTime > 5 * 60 * 1000) {
      return false;
    }
    
    return true;
  }

  /**
   * Generate a recovery suggestion based on the error
   */
  generateRecoverySuggestion(error: PushError): string {
    if (error.remediation) {
      return error.remediation;
    }
    
    const suggestions: Partial<Record<PushErrorCode, string>> = {
      [PushErrorCode.NET_CONNECTION_FAILED]: 
        'Please check your internet connection and firewall settings',
      [PushErrorCode.NET_TIMEOUT]: 
        'The operation is taking longer than expected. Try again with a smaller package',
      [PushErrorCode.AUTH_SESSION_EXPIRED]: 
        'Your session has expired. Please log in again using "taptik auth login"',
      [PushErrorCode.VAL_FILE_TOO_LARGE]: 
        'Consider splitting your package or removing unnecessary files',
      [PushErrorCode.STOR_QUOTA_EXCEEDED]: 
        'You have reached your storage limit. Delete old packages or upgrade your plan',
    };
    
    return suggestions[error.code] || 'Please try again later or contact support if the issue persists';
  }

  /**
   * Log error details for debugging (with sensitive info filtering)
   */
  logErrorDetails(error: PushError, includeStack: boolean = false): void {
    const sanitizedContext = this.sanitizeContext(error.context);
    
    this.logger.error('Push operation failed', {
      code: error.code,
      message: error.userMessage,
      context: sanitizedContext,
      isRetryable: error.isRetryable,
      remediation: error.remediation,
      ...(includeStack && { stack: error.stack }),
    });
  }

  /**
   * Sanitize context to remove sensitive information
   */
  private sanitizeContext(context: PushError['context']): PushError['context'] {
    const sanitized = { ...context };
    
    // Remove or mask sensitive fields
    if (sanitized.userId) {
      sanitized.userId = sanitized.userId.substring(0, 8) + '...';
    }
    
    if (sanitized.details) {
      const details = { ...sanitized.details };
      // Remove any fields that might contain sensitive data
      delete details['password'];
      delete details['token'];
      delete details['apiKey'];
      delete details['secret'];
      sanitized.details = details;
    }
    
    return sanitized;
  }
}