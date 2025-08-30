import { DeployError, DeployErrorCode, ErrorContext, ErrorRecoverySuggestion } from './deploy.error';

export interface CursorErrorContext extends ErrorContext {
  cursorVersion?: string;
  workspacePath?: string;
  extensionId?: string;
  configSection?: string;
  aiContentSize?: number;
  ruleType?: 'global' | 'workspace' | 'project';
  cursorPid?: number;
}

export interface CursorRecoveryAction {
  type: 'restart_cursor' | 'clear_cache' | 'backup_config' | 'validate_syntax' | 'update_extension';
  parameters?: Record<string, unknown>;
  requiresUserConfirmation?: boolean;
}

export class CursorDeploymentError extends DeployError {
  public readonly cursorContext: CursorErrorContext;
  public readonly recoveryActions: CursorRecoveryAction[];

  constructor(
    code: DeployErrorCode,
    message: string,
    severity: 'error' | 'critical' | 'warning' = 'error',
    cursorContext: CursorErrorContext = {},
    originalError?: Error,
  ) {
    super(code, message, severity, cursorContext, originalError);
    this.name = 'CursorDeploymentError';
    this.cursorContext = cursorContext;
    this.recoveryActions = this.generateCursorRecoveryActions();
  }

  private generateCursorRecoveryActions(): CursorRecoveryAction[] {
    const actions: CursorRecoveryAction[] = [];

    switch (this.code) {
      case DeployErrorCode.CURSOR_NOT_INSTALLED:
        actions.push({
          type: 'validate_syntax',
          parameters: { target: 'cursor_installation' },
          requiresUserConfirmation: false,
        });
        break;

      case DeployErrorCode.CURSOR_WORKSPACE_LOCKED:
        actions.push({
          type: 'restart_cursor',
          requiresUserConfirmation: true,
        });
        actions.push({
          type: 'clear_cache',
          parameters: { target: 'workspace_locks' },
        });
        break;

      case DeployErrorCode.CURSOR_CONFIG_INVALID:
        actions.push({
          type: 'backup_config',
          parameters: { configSection: this.cursorContext.configSection },
        });
        actions.push({
          type: 'validate_syntax',
          parameters: { target: 'cursor_config' },
        });
        break;

      case DeployErrorCode.CURSOR_EXTENSION_CONFLICT:
        actions.push({
          type: 'update_extension',
          parameters: { extensionId: this.cursorContext.extensionId },
          requiresUserConfirmation: true,
        });
        break;

      case DeployErrorCode.CURSOR_AI_CONFIG_TOO_LARGE:
        actions.push({
          type: 'validate_syntax',
          parameters: { 
            target: 'ai_content_size',
            maxSize: 1024 * 1024, // 1MB
          },
        });
        break;

      case DeployErrorCode.CURSOR_RULES_MALFORMED:
        actions.push({
          type: 'backup_config',
          parameters: { target: '.cursorrules' },
        });
        actions.push({
          type: 'validate_syntax',
          parameters: { target: 'cursor_rules' },
        });
        break;

      default:
        actions.push({
          type: 'restart_cursor',
          requiresUserConfirmation: true,
        });
        break;
    }

    return actions;
  }

  /**
   * Get Cursor-specific error messages with enhanced context
   */
  getCursorErrorMessage(): string {
    const baseMessage = this.message;
    const context = this.cursorContext;

    let enhancedMessage = `[Cursor] ${baseMessage}`;

    if (context.cursorVersion) {
      enhancedMessage += ` (Cursor v${context.cursorVersion})`;
    }

    if (context.workspacePath) {
      enhancedMessage += ` in workspace: ${context.workspacePath}`;
    }

    if (context.extensionId) {
      enhancedMessage += ` (extension: ${context.extensionId})`;
    }

    if (context.configSection) {
      enhancedMessage += ` (config section: ${context.configSection})`;
    }

    return enhancedMessage;
  }

  /**
   * Generate Cursor-specific recovery suggestions
   */
  protected generateCursorSuggestions(): ErrorRecoverySuggestion[] {
    const suggestions: ErrorRecoverySuggestion[] = [];

    // Add recovery actions as suggestions
    this.recoveryActions.forEach((action) => {
      switch (action.type) {
        case 'restart_cursor':
          suggestions.push({
            action: 'Restart Cursor IDE',
            command: 'killall cursor && cursor',
          });
          break;
        case 'clear_cache':
          suggestions.push({
            action: 'Clear Cursor cache and workspace locks',
            command: 'rm -rf ~/.cursor/workspace-locks/*',
          });
          break;
        case 'backup_config':
          suggestions.push({
            action: 'Backup current Cursor configuration',
            command: 'taptik backup create --platform cursor',
          });
          break;
        case 'validate_syntax':
          suggestions.push({
            action: 'Validate configuration syntax',
            command: 'taptik validate --platform cursor',
          });
          break;
        case 'update_extension':
          suggestions.push({
            action: 'Update conflicting extension',
            command: `cursor --install-extension ${action.parameters?.extensionId || 'EXTENSION_ID'}`,
          });
          break;
      }
    });

    return suggestions;
  }

  /**
   * Create a detailed audit log entry
   */
  toAuditLog(): {
    timestamp: string;
    errorCode: string;
    errorType: string;
    severity: string;
    platform: string;
    cursorContext: CursorErrorContext;
    recoveryActions: CursorRecoveryAction[];
    stack?: string;
  } {
    return {
      timestamp: new Date().toISOString(),
      errorCode: this.code.toString(),
      errorType: DeployErrorCode[this.code],
      severity: this.severity,
      platform: 'cursor',
      cursorContext: this.cursorContext,
      recoveryActions: this.recoveryActions,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined,
    };
  }

  /**
   * Check if error is related to Cursor installation
   */
  isInstallationError(): boolean {
    return [
      DeployErrorCode.CURSOR_NOT_INSTALLED,
      DeployErrorCode.CURSOR_VERSION_INCOMPATIBLE,
    ].includes(this.code);
  }

  /**
   * Check if error requires Cursor restart
   */
  requiresCursorRestart(): boolean {
    return [
      DeployErrorCode.CURSOR_WORKSPACE_LOCKED,
      DeployErrorCode.CURSOR_EXTENSION_CONFLICT,
    ].includes(this.code);
  }

  /**
   * Check if error is recoverable automatically
   */
  isAutoRecoverable(): boolean {
    return this.recoveryActions.some(action => !action.requiresUserConfirmation);
  }

  /**
   * Factory method to create Cursor-specific errors
   */
  static createCursorError(
    code: DeployErrorCode,
    message: string,
    context: CursorErrorContext = {},
    originalError?: Error,
  ): CursorDeploymentError {
    // Determine severity based on error code
    let severity: 'error' | 'critical' | 'warning' = 'error';

    if ([
      DeployErrorCode.CURSOR_NOT_INSTALLED,
      DeployErrorCode.CURSOR_VERSION_INCOMPATIBLE,
      DeployErrorCode.MALICIOUS_CONTENT,
    ].includes(code)) {
      severity = 'critical';
    } else if ([
      DeployErrorCode.CURSOR_AI_CONFIG_TOO_LARGE,
      DeployErrorCode.CURSOR_SNIPPET_SYNTAX_ERROR,
    ].includes(code)) {
      severity = 'warning';
    }

    return new CursorDeploymentError(code, message, severity, context, originalError);
  }

  /**
   * Convert general error to Cursor-specific error
   */
  static fromDeployError(error: DeployError, cursorContext: CursorErrorContext = {}): CursorDeploymentError {
    return new CursorDeploymentError(
      error.code,
      error.message,
      error.severity,
      { ...error.context, ...cursorContext },
      error.originalError,
    );
  }
}