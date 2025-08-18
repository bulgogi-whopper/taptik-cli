import { Injectable } from '@nestjs/common';

import {
  DeployError,
  DeployErrorCode,
  ErrorContext,
} from '../errors/deploy.error';
import { DeploymentError } from '../interfaces/deployment-result.interface';

interface ErrorRetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

interface ErrorRecoveryStrategy {
  shouldRetry: boolean;
  shouldRollback: boolean;
  shouldCleanup: boolean;
  retryConfig?: ErrorRetryConfig;
}

@Injectable()
export class ErrorHandlerService {
  private readonly defaultRetryConfig: ErrorRetryConfig = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  };

  /**
   * Handle deployment errors with appropriate recovery strategies
   */
  async handleError(
    error: unknown,
    context: ErrorContext = {},
  ): Promise<DeployError> {
    const deployError = DeployError.fromError(error, context);

    // Log the error with full context
    this.logError(deployError);

    // Determine recovery strategy
    const strategy = this.getRecoveryStrategy(deployError);

    // Apply recovery strategy
    if (strategy.shouldRetry) {
      // Retry logic is handled by the calling service
      deployError.context.retryConfig = strategy.retryConfig;
    }

    if (strategy.shouldRollback) {
      deployError.context.shouldRollback = true;
    }

    if (strategy.shouldCleanup) {
      deployError.context.shouldCleanup = true;
    }

    return deployError;
  }

  /**
   * Execute a function with retry logic
   */
  async executeWithRetry<T>(
    function_: () => Promise<T>,
    context: ErrorContext = {},
    customConfig?: Partial<ErrorRetryConfig>,
  ): Promise<T> {
    const config = { ...this.defaultRetryConfig, ...customConfig };
    let lastError: Error | undefined;
    let delay = config.initialDelay;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await function_(); // eslint-disable-line no-await-in-loop
      } catch (error) {
        lastError = error as Error;

        const deployError = DeployError.fromError(error, {
          ...context,
          attempt,
          maxAttempts: config.maxAttempts,
        });

        // Check if error is retryable
        const strategy = this.getRecoveryStrategy(deployError);
        if (!strategy.shouldRetry || attempt === config.maxAttempts) {
          throw deployError;
        }

        // Log retry attempt
        console.log( // eslint-disable-line no-console
          `⏳ Retry attempt ${attempt}/${config.maxAttempts} after ${delay}ms...`,
        );  

        // Wait before retry with exponential backoff
        await this.delay(delay); // eslint-disable-line no-await-in-loop
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
      }
    }

    throw new DeployError(
      DeployErrorCode.UNKNOWN_ERROR,
      `Operation failed after ${config.maxAttempts} attempts`,
      'error',
      context,
      lastError,
    );
  }

  /**
   * Handle network errors with specific retry logic
   */
  async handleNetworkError<T>(
    function_: () => Promise<T>,
    context: ErrorContext = {},
  ): Promise<T> {
    return this.executeWithRetry(
      function_,
      { ...context, operation: 'network' },
      {
        maxAttempts: 5,
        initialDelay: 2000,
        maxDelay: 60000,
        backoffMultiplier: 2,
      },
    );
  }

  /**
   * Handle file system errors with appropriate recovery
   */
  async handleFileSystemError<T>(
    function_: () => Promise<T>,
    context: ErrorContext = {},
  ): Promise<T> {
    try {
      return await function_();
    } catch (error) {
      const deployError = DeployError.fromError(error, {
        ...context,
        operation: 'filesystem',
      });

      // Special handling for permission errors
      if (
        deployError.code === DeployErrorCode.PERMISSION_DENIED && // Try alternative paths or methods
        context.filePath?.includes('.claude')
      ) {
        // Try user-specific path
        const alternativePath = context.filePath.replace(
          '~/.claude',
          `${process.env.HOME}/.claude`,
        );
        context.filePath = alternativePath;

        try {
          return await function_();
        } catch {
          throw deployError;
        }
      }

      throw deployError;
    }
  }

  /**
   * Determine recovery strategy based on error type
   */
  private getRecoveryStrategy(error: DeployError): ErrorRecoveryStrategy {
    switch (error.code) {
      // Network errors - retry with backoff
      case DeployErrorCode.NETWORK_ERROR:
      case DeployErrorCode.SUPABASE_AUTH_ERROR:
        return {
          shouldRetry: true,
          shouldRollback: false,
          shouldCleanup: false,
          retryConfig: {
            maxAttempts: 5,
            initialDelay: 2000,
            maxDelay: 60000,
            backoffMultiplier: 2,
          },
        };

      // Validation errors - no retry, no rollback
      case DeployErrorCode.VALIDATION_FAILED:
      case DeployErrorCode.INVALID_PLATFORM:
      case DeployErrorCode.INVALID_COMPONENT:
      case DeployErrorCode.SCHEMA_MISMATCH:
        return {
          shouldRetry: false,
          shouldRollback: false,
          shouldCleanup: false,
        };

      // Security errors - no retry, immediate rollback
      case DeployErrorCode.MALICIOUS_CONTENT:
      case DeployErrorCode.PATH_TRAVERSAL:
      case DeployErrorCode.SENSITIVE_DATA_EXPOSED:
        return {
          shouldRetry: false,
          shouldRollback: true,
          shouldCleanup: true,
        };

      // File system errors - limited retry
      case DeployErrorCode.FILE_NOT_FOUND:
      case DeployErrorCode.DIRECTORY_NOT_FOUND:
        return {
          shouldRetry: true,
          shouldRollback: false,
          shouldCleanup: false,
          retryConfig: {
            maxAttempts: 2,
            initialDelay: 500,
            maxDelay: 2000,
            backoffMultiplier: 2,
          },
        };

      // Permission errors - no retry, suggest elevation
      case DeployErrorCode.PERMISSION_DENIED:
      case DeployErrorCode.FILE_ACCESS_DENIED:
        return {
          shouldRetry: false,
          shouldRollback: false,
          shouldCleanup: false,
        };

      // Deployment errors - rollback required
      case DeployErrorCode.DEPLOYMENT_FAILED:
      case DeployErrorCode.COMPONENT_DEPLOY_FAILED:
        return {
          shouldRetry: false,
          shouldRollback: true,
          shouldCleanup: true,
        };

      // Lock errors - retry with delay
      case DeployErrorCode.LOCK_ACQUISITION_FAILED:
        return {
          shouldRetry: true,
          shouldRollback: false,
          shouldCleanup: false,
          retryConfig: {
            maxAttempts: 10,
            initialDelay: 5000,
            maxDelay: 30000,
            backoffMultiplier: 1.5,
          },
        };

      // Recovery errors - critical, no retry
      case DeployErrorCode.RECOVERY_FAILED:
      case DeployErrorCode.ROLLBACK_FAILED:
        return {
          shouldRetry: false,
          shouldRollback: false,
          shouldCleanup: false,
        };

      default:
        return {
          shouldRetry: false,
          shouldRollback: false,
          shouldCleanup: false,
        };
    }
  }

  /**
   * Convert DeployError to DeploymentError for result interface
   */
  toDeploymentError(error: DeployError): DeploymentError {
    return error.toDeploymentError();
  }

  /**
   * Create a standardized error response
   */
  createErrorResponse(errors: DeployError[]): {
    success: false;
    errors: DeploymentError[];
    exitCode: number;
  } {
    const deploymentErrors = errors.map((error) =>
      this.toDeploymentError(error),
    );
    const maxExitCode = Math.max(...errors.map((error) => error.getExitCode()));

    return {
      success: false,
      errors: deploymentErrors,
      exitCode: maxExitCode,
    };
  }

  /**
   * Log error with appropriate formatting
   */
  private logError(error: DeployError): void {
    // Use the error's built-in logging
    error.logError();

    // Additional logging for critical errors
    if (error.severity === 'critical') {
      console.error('🚨 CRITICAL ERROR - Immediate action required'); // eslint-disable-line no-console

      // In production, this could send alerts to monitoring services
      if (process.env.NODE_ENV === 'production') {
        // this.sendAlert(error);
      }
    }
  }

  /**
   * Helper function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if an error is retryable
   */
  isRetryableError(error: DeployError): boolean {
    const strategy = this.getRecoveryStrategy(error);
    return strategy.shouldRetry;
  }

  /**
   * Check if rollback is required
   */
  requiresRollback(error: DeployError): boolean {
    const strategy = this.getRecoveryStrategy(error);
    return strategy.shouldRollback;
  }
}
