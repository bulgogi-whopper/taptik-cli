import { describe, it, expect, beforeEach } from 'vitest';

import {
  CursorDeploymentError,
  CursorErrorContext,
  CursorRecoveryAction,
} from './cursor-deployment.error';
import { DeployError, DeployErrorCode } from './deploy.error';

describe('CursorDeploymentError', () => {
  let mockContext: CursorErrorContext;

  beforeEach(() => {
    mockContext = {
      cursorVersion: '0.42.3',
      workspacePath: '/path/to/workspace',
      extensionId: 'cursor.ai-assistant',
      platform: 'cursor',
      userId: 'test-user',
      configId: 'test-config-123',
    };
  });

  describe('constructor', () => {
    it('should create CursorDeploymentError with correct properties', () => {
      const error = new CursorDeploymentError(
        DeployErrorCode.CURSOR_NOT_INSTALLED,
        'Cursor is not installed',
        'critical',
        mockContext,
      );

      expect(error.name).toBe('CursorDeploymentError');
      expect(error.code).toBe(DeployErrorCode.CURSOR_NOT_INSTALLED);
      expect(error.message).toBe('Cursor is not installed');
      expect(error.severity).toBe('critical');
      expect(error.cursorContext).toEqual(mockContext);
      expect(error.recoveryActions).toHaveLength(1);
      expect(error.recoveryActions[0].type).toBe('validate_syntax');
    });

    it('should generate appropriate recovery actions for different error types', () => {
      const workspaceLockedError = new CursorDeploymentError(
        DeployErrorCode.CURSOR_WORKSPACE_LOCKED,
        'Workspace is locked',
        'error',
        mockContext,
      );

      expect(workspaceLockedError.recoveryActions).toEqual([
        {
          type: 'restart_cursor',
          requiresUserConfirmation: true,
        },
        {
          type: 'clear_cache',
          parameters: { target: 'workspace_locks' },
        },
      ]);
    });
  });

  describe('getCursorErrorMessage', () => {
    it('should format error message with Cursor context', () => {
      const error = new CursorDeploymentError(
        DeployErrorCode.CURSOR_CONFIG_INVALID,
        'Invalid configuration',
        'error',
        mockContext,
      );

      const message = error.getCursorErrorMessage();
      expect(message).toContain('[Cursor] Invalid configuration');
      expect(message).toContain('(Cursor v0.42.3)');
      expect(message).toContain('in workspace: /path/to/workspace');
      expect(message).toContain('(extension: cursor.ai-assistant)');
    });

    it('should handle missing context gracefully', () => {
      const error = new CursorDeploymentError(
        DeployErrorCode.CURSOR_CONFIG_INVALID,
        'Invalid configuration',
        'error',
        {},
      );

      const message = error.getCursorErrorMessage();
      expect(message).toBe('[Cursor] Invalid configuration');
    });
  });

  describe('recovery action generation', () => {
    it('should generate correct recovery actions for extension conflicts', () => {
      const error = new CursorDeploymentError(
        DeployErrorCode.CURSOR_EXTENSION_CONFLICT,
        'Extension conflict detected',
        'error',
        mockContext,
      );

      expect(error.recoveryActions).toEqual([
        {
          type: 'update_extension',
          parameters: { extensionId: 'cursor.ai-assistant' },
          requiresUserConfirmation: true,
        },
      ]);
    });

    it('should generate correct recovery actions for AI config size issues', () => {
      const error = new CursorDeploymentError(
        DeployErrorCode.CURSOR_AI_CONFIG_TOO_LARGE,
        'AI config too large',
        'warning',
        { ...mockContext, aiContentSize: 2000000 },
      );

      expect(error.recoveryActions).toEqual([
        {
          type: 'validate_syntax',
          parameters: {
            target: 'ai_content_size',
            maxSize: 1024 * 1024,
          },
        },
      ]);
    });

    it('should generate correct recovery actions for malformed rules', () => {
      const error = new CursorDeploymentError(
        DeployErrorCode.CURSOR_RULES_MALFORMED,
        'Cursor rules malformed',
        'error',
        mockContext,
      );

      expect(error.recoveryActions).toEqual([
        {
          type: 'backup_config',
          parameters: { target: '.cursorrules' },
        },
        {
          type: 'validate_syntax',
          parameters: { target: 'cursor_rules' },
        },
      ]);
    });
  });

  describe('toAuditLog', () => {
    it('should create proper audit log entry', () => {
      const error = new CursorDeploymentError(
        DeployErrorCode.CURSOR_WORKSPACE_LOCKED,
        'Workspace locked',
        'error',
        mockContext,
      );

      const auditLog = error.toAuditLog();

      expect(auditLog.errorCode).toBe(DeployErrorCode.CURSOR_WORKSPACE_LOCKED.toString());
      expect(auditLog.errorType).toBe('CURSOR_WORKSPACE_LOCKED');
      expect(auditLog.severity).toBe('error');
      expect(auditLog.platform).toBe('cursor');
      expect(auditLog.cursorContext).toEqual(mockContext);
      expect(auditLog.recoveryActions).toHaveLength(2);
      expect(auditLog.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should include stack trace in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new CursorDeploymentError(
        DeployErrorCode.CURSOR_CONFIG_INVALID,
        'Invalid config',
        'error',
        mockContext,
      );

      const auditLog = error.toAuditLog();
      expect(auditLog.stack).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('should not include stack trace in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new CursorDeploymentError(
        DeployErrorCode.CURSOR_CONFIG_INVALID,
        'Invalid config',
        'error',
        mockContext,
      );

      const auditLog = error.toAuditLog();
      expect(auditLog.stack).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('error classification methods', () => {
    it('should identify installation errors correctly', () => {
      const notInstalledError = new CursorDeploymentError(
        DeployErrorCode.CURSOR_NOT_INSTALLED,
        'Not installed',
        'critical',
        mockContext,
      );

      const versionError = new CursorDeploymentError(
        DeployErrorCode.CURSOR_VERSION_INCOMPATIBLE,
        'Version incompatible',
        'critical',
        mockContext,
      );

      const configError = new CursorDeploymentError(
        DeployErrorCode.CURSOR_CONFIG_INVALID,
        'Config invalid',
        'error',
        mockContext,
      );

      expect(notInstalledError.isInstallationError()).toBe(true);
      expect(versionError.isInstallationError()).toBe(true);
      expect(configError.isInstallationError()).toBe(false);
    });

    it('should identify errors requiring Cursor restart', () => {
      const workspaceLockedError = new CursorDeploymentError(
        DeployErrorCode.CURSOR_WORKSPACE_LOCKED,
        'Workspace locked',
        'error',
        mockContext,
      );

      const extensionConflictError = new CursorDeploymentError(
        DeployErrorCode.CURSOR_EXTENSION_CONFLICT,
        'Extension conflict',
        'error',
        mockContext,
      );

      const configError = new CursorDeploymentError(
        DeployErrorCode.CURSOR_CONFIG_INVALID,
        'Config invalid',
        'error',
        mockContext,
      );

      expect(workspaceLockedError.requiresCursorRestart()).toBe(true);
      expect(extensionConflictError.requiresCursorRestart()).toBe(true);
      expect(configError.requiresCursorRestart()).toBe(false);
    });

    it('should identify auto-recoverable errors', () => {
      const notInstalledError = new CursorDeploymentError(
        DeployErrorCode.CURSOR_NOT_INSTALLED,
        'Not installed',
        'critical',
        mockContext,
      );

      const configError = new CursorDeploymentError(
        DeployErrorCode.CURSOR_CONFIG_INVALID,
        'Config invalid',
        'error',
        mockContext,
      );

      // CURSOR_NOT_INSTALLED has validate_syntax without requiresUserConfirmation
      expect(notInstalledError.isAutoRecoverable()).toBe(true);

      // CURSOR_CONFIG_INVALID has backup_config without requiresUserConfirmation
      expect(configError.isAutoRecoverable()).toBe(true);
    });
  });

  describe('factory methods', () => {
    it('should create Cursor error with appropriate severity', () => {
      const criticalError = CursorDeploymentError.createCursorError(
        DeployErrorCode.CURSOR_NOT_INSTALLED,
        'Not installed',
        mockContext,
      );

      const warningError = CursorDeploymentError.createCursorError(
        DeployErrorCode.CURSOR_AI_CONFIG_TOO_LARGE,
        'Config too large',
        mockContext,
      );

      const normalError = CursorDeploymentError.createCursorError(
        DeployErrorCode.CURSOR_CONFIG_INVALID,
        'Config invalid',
        mockContext,
      );

      expect(criticalError.severity).toBe('critical');
      expect(warningError.severity).toBe('warning');
      expect(normalError.severity).toBe('error');
    });

    it('should convert DeployError to CursorDeploymentError', () => {
      const originalError = new DeployError(
        DeployErrorCode.CURSOR_CONFIG_INVALID,
        'Original message',
        'error',
        { platform: 'cursor' },
      );

      const cursorError = CursorDeploymentError.fromDeployError(originalError, mockContext);

      expect(cursorError).toBeInstanceOf(CursorDeploymentError);
      expect(cursorError.code).toBe(DeployErrorCode.CURSOR_CONFIG_INVALID);
      expect(cursorError.message).toBe('Original message');
      expect(cursorError.cursorContext.cursorVersion).toBe('0.42.3');
      expect(cursorError.cursorContext.platform).toBe('cursor');
    });
  });

  describe('integration with base DeployError', () => {
    it('should inherit all DeployError functionality', () => {
      const error = new CursorDeploymentError(
        DeployErrorCode.CURSOR_CONFIG_INVALID,
        'Config invalid',
        'error',
        mockContext,
      );

      // Should have DeployError methods
      expect(typeof error.getExitCode).toBe('function');
      expect(typeof error.logError).toBe('function');
      expect(typeof error.toDeploymentError).toBe('function');

      // Should work with DeployError static methods
      const fromError = DeployError.fromError(new Error('test'), mockContext);
      expect(fromError).toBeInstanceOf(DeployError);
    });

    it('should maintain proper error chain', () => {
      const originalError = new Error('Original error');
      const cursorError = new CursorDeploymentError(
        DeployErrorCode.CURSOR_CONFIG_INVALID,
        'Cursor error',
        'error',
        mockContext,
        originalError,
      );

      expect(cursorError.originalError).toBe(originalError);
      expect(cursorError.cause).toBeUndefined(); // We use originalError instead of cause
    });
  });
});