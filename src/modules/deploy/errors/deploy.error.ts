import { ComponentType } from '../interfaces/deploy-options.interface';
import { DeploymentError } from '../interfaces/deployment-result.interface';

export enum DeployErrorCode {
  // Import errors (1xx)
  IMPORT_FAILED = 100,
  INVALID_CONFIG_ID = 101,
  CONFIG_NOT_FOUND = 102,
  NETWORK_ERROR = 103,
  SUPABASE_AUTH_ERROR = 104,

  // Validation errors (2xx)
  VALIDATION_FAILED = 200,
  INVALID_PLATFORM = 201,
  INVALID_COMPONENT = 202,
  SCHEMA_MISMATCH = 203,
  MISSING_REQUIRED_FIELD = 204,

  // Security errors (3xx)
  SECURITY_VIOLATION = 300,
  MALICIOUS_CONTENT = 301,
  PATH_TRAVERSAL = 302,
  SENSITIVE_DATA_EXPOSED = 303,
  PERMISSION_DENIED = 304,

  // File system errors (4xx)
  FILE_NOT_FOUND = 400,
  FILE_ACCESS_DENIED = 401,
  DIRECTORY_NOT_FOUND = 402,
  INSUFFICIENT_SPACE = 403,
  FILE_ALREADY_EXISTS = 404,

  // Deployment errors (5xx)
  DEPLOYMENT_FAILED = 500,
  COMPONENT_DEPLOY_FAILED = 501,
  BACKUP_FAILED = 502,
  ROLLBACK_FAILED = 503,
  LOCK_ACQUISITION_FAILED = 504,

  // Recovery errors (6xx)
  RECOVERY_FAILED = 600,
  PARTIAL_RECOVERY = 601,
  BACKUP_NOT_FOUND = 602,
  CORRUPT_BACKUP = 603,

  // Unknown errors (9xx)
  UNKNOWN_ERROR = 999,
}

export interface ErrorContext {
  platform?: string;
  component?: string;
  filePath?: string;
  operation?: string;
  timestamp?: Date;
  userId?: string;
  configId?: string;
  [key: string]: unknown;
}

export interface ErrorRecoverySuggestion {
  action: string;
  command?: string;
  documentation?: string;
}

export class DeployError extends Error {
  public readonly code: DeployErrorCode;
  public readonly severity: 'error' | 'critical' | 'warning';
  public readonly context: ErrorContext;
  public readonly suggestions: ErrorRecoverySuggestion[];
  public readonly originalError?: Error;

  constructor(
    code: DeployErrorCode,
    message: string,
    severity: 'error' | 'critical' | 'warning' = 'error',
    context: ErrorContext = {},
    originalError?: Error,
  ) {
    super(message);
    this.name = 'DeployError';
    this.code = code;
    this.severity = severity;
    this.context = context;
    this.originalError = originalError;
    this.suggestions = this.generateSuggestions();

    // Maintain proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DeployError);
    }
  }

  private generateSuggestions(): ErrorRecoverySuggestion[] {
    const suggestions: ErrorRecoverySuggestion[] = [];

    switch (this.code) {
      case DeployErrorCode.IMPORT_FAILED:
        suggestions.push({
          action: 'Check your internet connection and try again',
          command: 'taptik deploy --context-id <config-id>',
        });
        suggestions.push({
          action: 'Verify the configuration ID exists',
          command: 'taptik list',
        });
        break;

      case DeployErrorCode.NETWORK_ERROR:
        suggestions.push({
          action: 'Check your internet connection',
        });
        suggestions.push({
          action: 'Retry with exponential backoff',
          command: 'taptik deploy --retry 3',
        });
        break;

      case DeployErrorCode.SUPABASE_AUTH_ERROR:
        suggestions.push({
          action: 'Re-authenticate with Supabase',
          command: 'taptik login',
        });
        suggestions.push({
          action: 'Check your Supabase credentials',
          documentation: 'https://docs.taptik.dev/auth',
        });
        break;

      case DeployErrorCode.VALIDATION_FAILED:
        suggestions.push({
          action: 'Run validation to see specific issues',
          command: 'taptik deploy --validate-only',
        });
        suggestions.push({
          action: 'Check the configuration format',
          documentation: 'https://docs.taptik.dev/config-format',
        });
        break;

      case DeployErrorCode.MALICIOUS_CONTENT:
        suggestions.push({
          action: 'Review the configuration for malicious patterns',
        });
        suggestions.push({
          action: 'Report this configuration if it was shared publicly',
          documentation: 'https://docs.taptik.dev/security',
        });
        break;

      case DeployErrorCode.PERMISSION_DENIED:
        suggestions.push({
          action: 'Check file permissions',
          command: 'ls -la ~/.claude',
        });
        suggestions.push({
          action: 'Run with elevated permissions if needed',
          command: 'sudo taptik deploy',
        });
        break;

      case DeployErrorCode.FILE_ACCESS_DENIED:
        suggestions.push({
          action: 'Check if the file is locked by another process',
        });
        suggestions.push({
          action: 'Try closing Claude Code and retrying',
        });
        break;

      case DeployErrorCode.BACKUP_FAILED:
        suggestions.push({
          action: 'Check available disk space',
          command: 'df -h',
        });
        suggestions.push({
          action: 'Clear old backups',
          command: 'taptik backup cleanup --days 30',
        });
        break;

      case DeployErrorCode.LOCK_ACQUISITION_FAILED:
        suggestions.push({
          action: 'Check for stale locks',
          command: 'taptik deploy --force-unlock',
        });
        suggestions.push({
          action: 'Wait for current deployment to complete',
        });
        break;

      case DeployErrorCode.ROLLBACK_FAILED:
        suggestions.push({
          action: 'Manually restore from backup',
          command: 'taptik backup restore --latest',
        });
        suggestions.push({
          action: 'Check backup integrity',
          command: 'taptik backup verify',
        });
        break;

      default:
        suggestions.push({
          action: 'Check the logs for more details',
          command: 'taptik logs --verbose',
        });
        suggestions.push({
          action: 'Report this issue',
          documentation: 'https://github.com/taptik/cli/issues',
        });
    }

    return suggestions;
  }

  public toDeploymentError(): DeploymentError {
    return {
      code: this.code.toString(),
      message: this.message,
      severity: this.severity,
      details: this.context,
      filePath: this.context.filePath,
      component: this.context.component as ComponentType,
    };
  }

  public static fromError(
    error: unknown,
    context: ErrorContext = {},
  ): DeployError {
    if (error instanceof DeployError) {
      return error;
    }

    if (error instanceof Error) {
      // Try to determine error code from error message or type
      let code = DeployErrorCode.UNKNOWN_ERROR;
      let severity: 'error' | 'critical' | 'warning' = 'error';

      if (error.message.includes('ENOENT')) {
        code = DeployErrorCode.FILE_NOT_FOUND;
      } else if (
        error.message.includes('EACCES') ||
        error.message.includes('EPERM')
      ) {
        code = DeployErrorCode.PERMISSION_DENIED;
        severity = 'critical';
      } else if (error.message.includes('ENOSPC')) {
        code = DeployErrorCode.INSUFFICIENT_SPACE;
        severity = 'critical';
      } else if (
        error.message.includes('network') ||
        error.message.includes('fetch')
      ) {
        code = DeployErrorCode.NETWORK_ERROR;
      } else if (error.message.includes('validation')) {
        code = DeployErrorCode.VALIDATION_FAILED;
      } else if (
        error.message.includes('malicious') ||
        error.message.includes('security')
      ) {
        code = DeployErrorCode.MALICIOUS_CONTENT;
        severity = 'critical';
      }

      return new DeployError(code, error.message, severity, context, error);
    }

    return new DeployError(
      DeployErrorCode.UNKNOWN_ERROR,
      String(error),
      'error',
      context,
    );
  }

  public getExitCode(): number {
    // Map error codes to process exit codes
    const baseCode = Math.floor(this.code / 100);
    return Math.min(baseCode + 1, 255); // Exit codes should be 1-255
  }

  public logError(logger?: Console): void {
    const log = logger || console;

    // Color codes for terminal output
    const red = '\x1B[31m';
    const yellow = '\x1B[33m';
    const blue = '\x1B[34m';
    const reset = '\x1B[0m';

    const severityColor =
      this.severity === 'critical'
        ? red
        : this.severity === 'warning'
          ? yellow
          : red;

    log.error(
      `${severityColor}[${this.severity.toUpperCase()}]${reset} ${this.message}`,
    );
    log.error(
      `${blue}Error Code:${reset} ${this.code} (${DeployErrorCode[this.code]})`,
    );

    if (Object.keys(this.context).length > 0) {
      log.error(`${blue}Context:${reset}`, this.context);
    }

    if (this.suggestions.length > 0) {
      log.error(`${blue}Suggestions:${reset}`);
      this.suggestions.forEach((suggestion, index) => {
        log.error(`  ${index + 1}. ${suggestion.action}`);
        if (suggestion.command) {
          log.error(`     Command: ${suggestion.command}`);
        }
        if (suggestion.documentation) {
          log.error(`     Documentation: ${suggestion.documentation}`);
        }
      });
    }

    if (this.originalError && process.env.NODE_ENV === 'development') {
      log.error(`${blue}Original Error:${reset}`, this.originalError);
    }
  }
}
