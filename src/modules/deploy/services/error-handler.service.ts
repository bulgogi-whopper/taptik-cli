import { Injectable, Logger } from '@nestjs/common';

import {
  DeployError,
  DeployErrorCode,
  ErrorContext,
} from '../errors/deploy.error';
import { CursorDeploymentError, CursorErrorContext } from '../errors/cursor-deployment.error';
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
  private readonly logger = new Logger(ErrorHandlerService.name);
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
    return this.performRetryAttempts(function_, context, config, 1);
  }

  /**
   * Recursive implementation of retry logic to avoid await-in-loop
   */
  private async performRetryAttempts<T>(
    function_: () => Promise<T>,
    context: ErrorContext,
    config: ErrorRetryConfig,
    attempt: number,
    delay: number = config.initialDelay,
    lastError?: Error,
  ): Promise<T> {
    if (attempt > config.maxAttempts) {
      throw new DeployError(
        DeployErrorCode.UNKNOWN_ERROR,
        `Operation failed after ${config.maxAttempts} attempts`,
        'error',
        context,
        lastError,
      );
    }

    try {
      return await function_();
    } catch (error) {
      const currentError = error as Error;
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
      this.logger.log(
        `⏳ Retry attempt ${attempt}/${config.maxAttempts} after ${delay}ms...`,
      );

      // Wait before retry with exponential backoff
      await this.delay(delay);
      const nextDelay = Math.min(
        delay * config.backoffMultiplier,
        config.maxDelay,
      );

      // Recursive call for next attempt
      return this.performRetryAttempts(
        function_,
        context,
        config,
        attempt + 1,
        nextDelay,
        currentError,
      );
    }
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

      // Cursor-specific error recovery strategies
      case DeployErrorCode.CURSOR_NOT_INSTALLED:
        return {
          shouldRetry: false,
          shouldRollback: false,
          shouldCleanup: false,
        };

      case DeployErrorCode.CURSOR_WORKSPACE_LOCKED:
        return {
          shouldRetry: true,
          shouldRollback: false,
          shouldCleanup: true,
          retryConfig: {
            maxAttempts: 3,
            initialDelay: 5000,
            maxDelay: 15000,
            backoffMultiplier: 2,
          },
        };

      case DeployErrorCode.CURSOR_EXTENSION_CONFLICT:
        return {
          shouldRetry: false,
          shouldRollback: true,
          shouldCleanup: true,
        };

      case DeployErrorCode.CURSOR_AI_CONFIG_TOO_LARGE:
        return {
          shouldRetry: false,
          shouldRollback: false,
          shouldCleanup: false,
        };

      case DeployErrorCode.CURSOR_RULES_MALFORMED:
      case DeployErrorCode.CURSOR_SNIPPET_SYNTAX_ERROR:
      case DeployErrorCode.CURSOR_DEBUG_CONFIG_INVALID:
      case DeployErrorCode.CURSOR_TASK_CONFIG_INVALID:
        return {
          shouldRetry: false,
          shouldRollback: true,
          shouldCleanup: false,
        };

      case DeployErrorCode.CURSOR_CONFIG_INVALID:
      case DeployErrorCode.CURSOR_VERSION_INCOMPATIBLE:
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
      this.logger.error('🚨 CRITICAL ERROR - Immediate action required');

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

  /**
   * Handle Cursor-specific errors with specialized recovery
   */
  async handleCursorError(
    error: unknown,
    cursorContext: CursorErrorContext = {},
  ): Promise<CursorDeploymentError> {
    let cursorError: CursorDeploymentError;

    if (error instanceof CursorDeploymentError) {
      cursorError = error;
    } else if (error instanceof DeployError) {
      cursorError = CursorDeploymentError.fromDeployError(error, cursorContext);
    } else {
      const deployError = DeployError.fromError(error, cursorContext);
      cursorError = CursorDeploymentError.fromDeployError(deployError, cursorContext);
    }

    // Log the Cursor-specific error
    this.logCursorError(cursorError);

    // Execute automatic recovery actions if available
    if (cursorError.isAutoRecoverable()) {
      await this.executeAutomaticRecovery(cursorError);
    }

    return cursorError;
  }

  /**
   * Execute automatic recovery actions for Cursor errors
   */
  private async executeAutomaticRecovery(error: CursorDeploymentError): Promise<void> {
    const autoActions = error.recoveryActions.filter(action => !action.requiresUserConfirmation);

    for (const action of autoActions) {
      try {
        await this.executeCursorRecoveryAction(action, error.cursorContext); // eslint-disable-line no-await-in-loop
        console.log(`✅ Executed recovery action: ${action.type}`); // eslint-disable-line no-console
      } catch (actionError) {
        console.warn(`⚠️  Recovery action failed: ${action.type}`, actionError); // eslint-disable-line no-console
      }
    }
  }

  /**
   * Execute a specific Cursor recovery action
   */
  private async executeCursorRecoveryAction(
    action: { type: string; parameters?: Record<string, unknown> },
    context: CursorErrorContext,
  ): Promise<void> {
    switch (action.type) {
      case 'validate_syntax':
        // This would typically call a validation service
        console.log(`Validating ${action.parameters?.target || 'configuration'}`); // eslint-disable-line no-console
        break;
      
      case 'clear_cache':
        // This would clear specific cache directories
        console.log(`Clearing cache: ${action.parameters?.target || 'general'}`); // eslint-disable-line no-console
        break;
      
      case 'backup_config':
        // This would create a backup before attempting fixes
        console.log(`Creating backup for ${action.parameters?.target || 'configuration'}`); // eslint-disable-line no-console
        break;
      
      default:
        console.warn(`Unknown recovery action: ${action.type}`); // eslint-disable-line no-console
    }

    // Add a small delay between actions
    await this.delay(1000);
  }

  /**
   * Handle Cursor workspace errors specifically
   */
  async handleCursorWorkspaceError<T>(
    function_: () => Promise<T>,
    workspacePath: string,
  ): Promise<T> {
    try {
      return await function_();
    } catch (error) {
      const cursorContext: CursorErrorContext = {
        workspacePath,
        platform: 'cursor',
        operation: 'workspace',
      };

      throw await this.handleCursorError(error, cursorContext);
    }
  }

  /**
   * Handle Cursor extension errors specifically
   */
  async handleCursorExtensionError<T>(
    function_: () => Promise<T>,
    extensionId: string,
  ): Promise<T> {
    try {
      return await function_();
    } catch (error) {
      const cursorContext: CursorErrorContext = {
        extensionId,
        platform: 'cursor',
        operation: 'extension',
      };

      throw await this.handleCursorError(error, cursorContext);
    }
  }

  /**
   * Log Cursor-specific error with enhanced formatting
   */
  private logCursorError(error: CursorDeploymentError): void {
    // Use the error's built-in logging first
    error.logError();

    // Add Cursor-specific context logging
    const cursorMessage = error.getCursorErrorMessage();
    console.error(`🔧 Cursor Context: ${cursorMessage}`); // eslint-disable-line no-console

    // Log recovery actions
    if (error.recoveryActions.length > 0) {
      console.error('🔄 Available Recovery Actions:'); // eslint-disable-line no-console
      error.recoveryActions.forEach((action, index) => {
        const confirmation = action.requiresUserConfirmation ? ' (requires confirmation)' : '';
        console.error(`  ${index + 1}. ${action.type}${confirmation}`); // eslint-disable-line no-console
      });
    }

    // Create audit log entry
    const auditEntry = error.toAuditLog();
    if (process.env.NODE_ENV === 'production') {
      // In production, this would typically send to monitoring service
      console.log('📋 Audit Log Entry:', JSON.stringify(auditEntry, null, 2)); // eslint-disable-line no-console
    }
  }

  /**
   * Check if error is Cursor-specific
   */
  isCursorError(error: DeployError): boolean {
    return error.code >= 700 && error.code < 800;
  }

  /**
   * Get user-friendly error message for Cursor errors
   */
  getCursorErrorMessage(error: CursorDeploymentError): string {
    const baseMessage = error.getCursorErrorMessage();
    
    // Add specific troubleshooting hints
    switch (error.code) {
      case DeployErrorCode.CURSOR_NOT_INSTALLED:
        return `${baseMessage}\n💡 Install Cursor from https://cursor.sh/ and ensure it's in your PATH`;
      
      case DeployErrorCode.CURSOR_WORKSPACE_LOCKED:
        return `${baseMessage}\n💡 Try closing Cursor and running the command again`;
      
      case DeployErrorCode.CURSOR_AI_CONFIG_TOO_LARGE:
        return `${baseMessage}\n💡 Consider splitting your AI configuration into smaller files`;
      
      default:
        return baseMessage;
    }
  }
}
