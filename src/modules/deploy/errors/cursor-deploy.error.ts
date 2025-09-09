/**
 * Cursor IDE 배포 전용 오류 코드 및 예외 클래스
 * 
 * 이 파일은 Cursor IDE 배포 과정에서 발생할 수 있는 모든 오류 유형을 정의하고,
 * 각 오류에 대한 구체적인 처리 방법과 복구 전략을 제공합니다.
 */

/**
 * Cursor IDE 배포 오류 코드 열거형
 * 각 오류 코드는 특정 오류 상황을 나타내며, 복구 전략과 연결됩니다.
 */
export enum CursorDeploymentErrorCode {
  // 검증 오류 (VALIDATION)
  INVALID_CONTEXT = 'CURSOR_INVALID_CONTEXT',
  MISSING_REQUIRED_FIELD = 'CURSOR_MISSING_REQUIRED_FIELD',
  INCOMPATIBLE_VERSION = 'CURSOR_INCOMPATIBLE_VERSION',
  INVALID_CONFIGURATION = 'CURSOR_INVALID_CONFIGURATION',
  SCHEMA_VALIDATION_FAILED = 'CURSOR_SCHEMA_VALIDATION_FAILED',
  
  // 파일 시스템 오류 (FILE_SYSTEM)
  PERMISSION_DENIED = 'CURSOR_PERMISSION_DENIED',
  DISK_FULL = 'CURSOR_DISK_FULL',
  PATH_NOT_FOUND = 'CURSOR_PATH_NOT_FOUND',
  FILE_LOCKED = 'CURSOR_FILE_LOCKED',
  DIRECTORY_NOT_WRITABLE = 'CURSOR_DIRECTORY_NOT_WRITABLE',
  FILE_CORRUPTION = 'CURSOR_FILE_CORRUPTION',
  
  // 변환 오류 (TRANSFORMATION)
  TRANSFORMATION_FAILED = 'CURSOR_TRANSFORMATION_FAILED',
  DATA_LOSS_DETECTED = 'CURSOR_DATA_LOSS_DETECTED',
  UNSUPPORTED_FEATURE = 'CURSOR_UNSUPPORTED_FEATURE',
  MAPPING_ERROR = 'CURSOR_MAPPING_ERROR',
  
  // 보안 오류 (SECURITY)
  SECURITY_THREAT_DETECTED = 'CURSOR_SECURITY_THREAT_DETECTED',
  MALICIOUS_CONTENT = 'CURSOR_MALICIOUS_CONTENT',
  UNAUTHORIZED_ACCESS = 'CURSOR_UNAUTHORIZED_ACCESS',
  SENSITIVE_DATA_DETECTED = 'CURSOR_SENSITIVE_DATA_DETECTED',
  
  // 성능 오류 (PERFORMANCE)
  TIMEOUT = 'CURSOR_TIMEOUT',
  MEMORY_LIMIT_EXCEEDED = 'CURSOR_MEMORY_LIMIT_EXCEEDED',
  FILE_TOO_LARGE = 'CURSOR_FILE_TOO_LARGE',
  RATE_LIMIT_EXCEEDED = 'CURSOR_RATE_LIMIT_EXCEEDED',
  
  // 네트워크 오류 (NETWORK)
  NETWORK_ERROR = 'CURSOR_NETWORK_ERROR',
  SUPABASE_CONNECTION_FAILED = 'CURSOR_SUPABASE_CONNECTION_FAILED',
  DOWNLOAD_FAILED = 'CURSOR_DOWNLOAD_FAILED',
  
  // 충돌 해결 오류 (CONFLICT)
  CONFLICT_RESOLUTION_FAILED = 'CURSOR_CONFLICT_RESOLUTION_FAILED',
  MERGE_CONFLICT = 'CURSOR_MERGE_CONFLICT',
  BACKUP_FAILED = 'CURSOR_BACKUP_FAILED',
  ROLLBACK_FAILED = 'CURSOR_ROLLBACK_FAILED',
  
  // 일반 오류 (GENERAL)
  UNKNOWN_ERROR = 'CURSOR_UNKNOWN_ERROR',
  INTERNAL_ERROR = 'CURSOR_INTERNAL_ERROR',
  CONFIGURATION_ERROR = 'CURSOR_CONFIGURATION_ERROR',
}

/**
 * 오류 심각도 수준
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * 복구 가능성 수준
 */
export enum RecoverabilityLevel {
  AUTOMATIC = 'automatic',      // 자동 복구 가능
  MANUAL = 'manual',           // 수동 개입 필요
  PARTIAL = 'partial',         // 부분적 복구 가능
  NONE = 'none',              // 복구 불가능
}

/**
 * 오류 카테고리별 메타데이터
 */
export interface ErrorMetadata {
  category: string;
  severity: ErrorSeverity;
  recoverability: RecoverabilityLevel;
  userActionRequired: boolean;
  retryable: boolean;
  rollbackRequired: boolean;
}

/**
 * 오류 코드별 메타데이터 매핑
 */
export const ERROR_METADATA: Record<CursorDeploymentErrorCode, ErrorMetadata> = {
  // 검증 오류
  [CursorDeploymentErrorCode.INVALID_CONTEXT]: {
    category: 'validation',
    severity: ErrorSeverity.HIGH,
    recoverability: RecoverabilityLevel.MANUAL,
    userActionRequired: true,
    retryable: false,
    rollbackRequired: false,
  },
  [CursorDeploymentErrorCode.MISSING_REQUIRED_FIELD]: {
    category: 'validation',
    severity: ErrorSeverity.MEDIUM,
    recoverability: RecoverabilityLevel.MANUAL,
    userActionRequired: true,
    retryable: false,
    rollbackRequired: false,
  },
  [CursorDeploymentErrorCode.INCOMPATIBLE_VERSION]: {
    category: 'validation',
    severity: ErrorSeverity.HIGH,
    recoverability: RecoverabilityLevel.MANUAL,
    userActionRequired: true,
    retryable: false,
    rollbackRequired: false,
  },
  [CursorDeploymentErrorCode.INVALID_CONFIGURATION]: {
    category: 'validation',
    severity: ErrorSeverity.MEDIUM,
    recoverability: RecoverabilityLevel.MANUAL,
    userActionRequired: true,
    retryable: false,
    rollbackRequired: false,
  },
  [CursorDeploymentErrorCode.SCHEMA_VALIDATION_FAILED]: {
    category: 'validation',
    severity: ErrorSeverity.HIGH,
    recoverability: RecoverabilityLevel.MANUAL,
    userActionRequired: true,
    retryable: false,
    rollbackRequired: false,
  },
  
  // 파일 시스템 오류
  [CursorDeploymentErrorCode.PERMISSION_DENIED]: {
    category: 'filesystem',
    severity: ErrorSeverity.HIGH,
    recoverability: RecoverabilityLevel.MANUAL,
    userActionRequired: true,
    retryable: true,
    rollbackRequired: false,
  },
  [CursorDeploymentErrorCode.DISK_FULL]: {
    category: 'filesystem',
    severity: ErrorSeverity.CRITICAL,
    recoverability: RecoverabilityLevel.MANUAL,
    userActionRequired: true,
    retryable: true,
    rollbackRequired: true,
  },
  [CursorDeploymentErrorCode.PATH_NOT_FOUND]: {
    category: 'filesystem',
    severity: ErrorSeverity.MEDIUM,
    recoverability: RecoverabilityLevel.AUTOMATIC,
    userActionRequired: false,
    retryable: true,
    rollbackRequired: false,
  },
  [CursorDeploymentErrorCode.FILE_LOCKED]: {
    category: 'filesystem',
    severity: ErrorSeverity.MEDIUM,
    recoverability: RecoverabilityLevel.AUTOMATIC,
    userActionRequired: false,
    retryable: true,
    rollbackRequired: false,
  },
  [CursorDeploymentErrorCode.DIRECTORY_NOT_WRITABLE]: {
    category: 'filesystem',
    severity: ErrorSeverity.HIGH,
    recoverability: RecoverabilityLevel.MANUAL,
    userActionRequired: true,
    retryable: true,
    rollbackRequired: false,
  },
  [CursorDeploymentErrorCode.FILE_CORRUPTION]: {
    category: 'filesystem',
    severity: ErrorSeverity.HIGH,
    recoverability: RecoverabilityLevel.PARTIAL,
    userActionRequired: true,
    retryable: false,
    rollbackRequired: true,
  },
  
  // 변환 오류
  [CursorDeploymentErrorCode.TRANSFORMATION_FAILED]: {
    category: 'transformation',
    severity: ErrorSeverity.HIGH,
    recoverability: RecoverabilityLevel.PARTIAL,
    userActionRequired: true,
    retryable: false,
    rollbackRequired: true,
  },
  [CursorDeploymentErrorCode.DATA_LOSS_DETECTED]: {
    category: 'transformation',
    severity: ErrorSeverity.CRITICAL,
    recoverability: RecoverabilityLevel.MANUAL,
    userActionRequired: true,
    retryable: false,
    rollbackRequired: true,
  },
  [CursorDeploymentErrorCode.UNSUPPORTED_FEATURE]: {
    category: 'transformation',
    severity: ErrorSeverity.MEDIUM,
    recoverability: RecoverabilityLevel.PARTIAL,
    userActionRequired: true,
    retryable: false,
    rollbackRequired: false,
  },
  [CursorDeploymentErrorCode.MAPPING_ERROR]: {
    category: 'transformation',
    severity: ErrorSeverity.MEDIUM,
    recoverability: RecoverabilityLevel.AUTOMATIC,
    userActionRequired: false,
    retryable: true,
    rollbackRequired: false,
  },
  
  // 보안 오류
  [CursorDeploymentErrorCode.SECURITY_THREAT_DETECTED]: {
    category: 'security',
    severity: ErrorSeverity.CRITICAL,
    recoverability: RecoverabilityLevel.MANUAL,
    userActionRequired: true,
    retryable: false,
    rollbackRequired: true,
  },
  [CursorDeploymentErrorCode.MALICIOUS_CONTENT]: {
    category: 'security',
    severity: ErrorSeverity.CRITICAL,
    recoverability: RecoverabilityLevel.NONE,
    userActionRequired: true,
    retryable: false,
    rollbackRequired: true,
  },
  [CursorDeploymentErrorCode.UNAUTHORIZED_ACCESS]: {
    category: 'security',
    severity: ErrorSeverity.HIGH,
    recoverability: RecoverabilityLevel.MANUAL,
    userActionRequired: true,
    retryable: false,
    rollbackRequired: false,
  },
  [CursorDeploymentErrorCode.SENSITIVE_DATA_DETECTED]: {
    category: 'security',
    severity: ErrorSeverity.HIGH,
    recoverability: RecoverabilityLevel.MANUAL,
    userActionRequired: true,
    retryable: false,
    rollbackRequired: false,
  },
  
  // 성능 오류
  [CursorDeploymentErrorCode.TIMEOUT]: {
    category: 'performance',
    severity: ErrorSeverity.MEDIUM,
    recoverability: RecoverabilityLevel.AUTOMATIC,
    userActionRequired: false,
    retryable: true,
    rollbackRequired: false,
  },
  [CursorDeploymentErrorCode.MEMORY_LIMIT_EXCEEDED]: {
    category: 'performance',
    severity: ErrorSeverity.HIGH,
    recoverability: RecoverabilityLevel.AUTOMATIC,
    userActionRequired: false,
    retryable: true,
    rollbackRequired: false,
  },
  [CursorDeploymentErrorCode.FILE_TOO_LARGE]: {
    category: 'performance',
    severity: ErrorSeverity.MEDIUM,
    recoverability: RecoverabilityLevel.MANUAL,
    userActionRequired: true,
    retryable: false,
    rollbackRequired: false,
  },
  [CursorDeploymentErrorCode.RATE_LIMIT_EXCEEDED]: {
    category: 'performance',
    severity: ErrorSeverity.LOW,
    recoverability: RecoverabilityLevel.AUTOMATIC,
    userActionRequired: false,
    retryable: true,
    rollbackRequired: false,
  },
  
  // 네트워크 오류
  [CursorDeploymentErrorCode.NETWORK_ERROR]: {
    category: 'network',
    severity: ErrorSeverity.MEDIUM,
    recoverability: RecoverabilityLevel.AUTOMATIC,
    userActionRequired: false,
    retryable: true,
    rollbackRequired: false,
  },
  [CursorDeploymentErrorCode.SUPABASE_CONNECTION_FAILED]: {
    category: 'network',
    severity: ErrorSeverity.HIGH,
    recoverability: RecoverabilityLevel.AUTOMATIC,
    userActionRequired: false,
    retryable: true,
    rollbackRequired: false,
  },
  [CursorDeploymentErrorCode.DOWNLOAD_FAILED]: {
    category: 'network',
    severity: ErrorSeverity.MEDIUM,
    recoverability: RecoverabilityLevel.AUTOMATIC,
    userActionRequired: false,
    retryable: true,
    rollbackRequired: false,
  },
  
  // 충돌 해결 오류
  [CursorDeploymentErrorCode.CONFLICT_RESOLUTION_FAILED]: {
    category: 'conflict',
    severity: ErrorSeverity.HIGH,
    recoverability: RecoverabilityLevel.MANUAL,
    userActionRequired: true,
    retryable: false,
    rollbackRequired: true,
  },
  [CursorDeploymentErrorCode.MERGE_CONFLICT]: {
    category: 'conflict',
    severity: ErrorSeverity.MEDIUM,
    recoverability: RecoverabilityLevel.MANUAL,
    userActionRequired: true,
    retryable: false,
    rollbackRequired: false,
  },
  [CursorDeploymentErrorCode.BACKUP_FAILED]: {
    category: 'conflict',
    severity: ErrorSeverity.CRITICAL,
    recoverability: RecoverabilityLevel.MANUAL,
    userActionRequired: true,
    retryable: true,
    rollbackRequired: false,
  },
  [CursorDeploymentErrorCode.ROLLBACK_FAILED]: {
    category: 'conflict',
    severity: ErrorSeverity.CRITICAL,
    recoverability: RecoverabilityLevel.MANUAL,
    userActionRequired: true,
    retryable: false,
    rollbackRequired: false,
  },
  
  // 일반 오류
  [CursorDeploymentErrorCode.UNKNOWN_ERROR]: {
    category: 'general',
    severity: ErrorSeverity.HIGH,
    recoverability: RecoverabilityLevel.MANUAL,
    userActionRequired: true,
    retryable: false,
    rollbackRequired: true,
  },
  [CursorDeploymentErrorCode.INTERNAL_ERROR]: {
    category: 'general',
    severity: ErrorSeverity.HIGH,
    recoverability: RecoverabilityLevel.MANUAL,
    userActionRequired: true,
    retryable: false,
    rollbackRequired: true,
  },
  [CursorDeploymentErrorCode.CONFIGURATION_ERROR]: {
    category: 'general',
    severity: ErrorSeverity.MEDIUM,
    recoverability: RecoverabilityLevel.MANUAL,
    userActionRequired: true,
    retryable: false,
    rollbackRequired: false,
  },
};

/**
 * Cursor IDE 배포 전용 예외 클래스
 * 
 * 이 클래스는 Cursor IDE 배포 과정에서 발생하는 모든 오류를 표준화된 형태로 처리하며,
 * 오류 복구 및 사용자 안내에 필요한 모든 정보를 포함합니다.
 */
export class CursorDeploymentError extends Error {
  public readonly code: CursorDeploymentErrorCode;
  public readonly metadata: ErrorMetadata;
  public readonly details: Record<string, unknown>;
  public readonly timestamp: Date;
  public readonly context: Record<string, unknown>;
  public readonly suggestions: string[];
  public readonly recoveryActions: string[];

  constructor(
    code: CursorDeploymentErrorCode,
    message: string,
    details?: Record<string, unknown>,
    context?: Record<string, unknown>,
    suggestions?: string[],
    recoveryActions?: string[],
  ) {
    super(message);
    
    this.name = 'CursorDeploymentError';
    this.code = code;
    this.metadata = ERROR_METADATA[code];
    this.details = details || {};
    this.timestamp = new Date();
    this.context = context || {};
    this.suggestions = suggestions || this.getDefaultSuggestions();
    this.recoveryActions = recoveryActions || this.getDefaultRecoveryActions();

    // Error 스택 트레이스 설정
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CursorDeploymentError);
    }
  }

  /**
   * 오류가 복구 가능한지 확인
   */
  get isRecoverable(): boolean {
    return this.metadata.recoverability !== RecoverabilityLevel.NONE;
  }

  /**
   * 오류가 재시도 가능한지 확인
   */
  get isRetryable(): boolean {
    return this.metadata.retryable;
  }

  /**
   * 롤백이 필요한지 확인
   */
  get requiresRollback(): boolean {
    return this.metadata.rollbackRequired;
  }

  /**
   * 사용자 개입이 필요한지 확인
   */
  get requiresUserAction(): boolean {
    return this.metadata.userActionRequired;
  }

  /**
   * 오류의 심각도 수준
   */
  get severity(): ErrorSeverity {
    return this.metadata.severity;
  }

  /**
   * 오류 카테고리
   */
  get category(): string {
    return this.metadata.category;
  }

  /**
   * 오류 코드별 기본 제안사항 생성
   */
  private getDefaultSuggestions(): string[] {
    switch (this.code) {
      case CursorDeploymentErrorCode.PERMISSION_DENIED:
        return [
          'Run the command with elevated privileges (sudo on Unix systems)',
          'Check file and directory permissions',
          'Ensure Cursor IDE is not running and locking files',
          'Verify you have write access to the target directory',
        ];

      case CursorDeploymentErrorCode.DISK_FULL:
        return [
          'Free up disk space by removing unnecessary files',
          'Move large files to external storage',
          'Clean up temporary files and caches',
          'Consider deploying to a different location with more space',
        ];

      case CursorDeploymentErrorCode.TRANSFORMATION_FAILED:
        return [
          'Check if the source configuration is valid',
          'Try deploying individual components with --components flag',
          'Use --validate-only to check for specific issues',
          'Verify the configuration format matches expected schema',
        ];

      case CursorDeploymentErrorCode.SECURITY_THREAT_DETECTED:
        return [
          'Review the configuration for potentially malicious content',
          'Remove or sanitize suspicious entries',
          'Use --force flag only if you trust the source',
          'Contact support if you believe this is a false positive',
        ];

      case CursorDeploymentErrorCode.TIMEOUT:
        return [
          'Try again with a stable network connection',
          'Increase timeout settings if available',
          'Deploy smaller components separately',
          'Check system resources and close unnecessary applications',
        ];

      default:
        return [
          'Check the error details for specific guidance',
          'Try running the command again',
          'Use --verbose flag for more detailed output',
          'Contact support if the issue persists',
        ];
    }
  }

  /**
   * 오류 코드별 기본 복구 액션 생성
   */
  private getDefaultRecoveryActions(): string[] {
    switch (this.code) {
      case CursorDeploymentErrorCode.PERMISSION_DENIED:
        return [
          'Change file permissions: chmod 755 <directory>',
          'Change ownership: chown $USER <directory>',
          'Run with sudo: sudo taptik deploy --platform cursor-ide',
        ];

      case CursorDeploymentErrorCode.PATH_NOT_FOUND:
        return [
          'Create missing directories automatically',
          'Verify Cursor IDE installation path',
          'Use --target-path to specify custom location',
        ];

      case CursorDeploymentErrorCode.BACKUP_FAILED:
        return [
          'Manually backup existing configuration',
          'Use --no-backup flag to skip backup creation',
          'Ensure sufficient disk space for backup',
        ];

      case CursorDeploymentErrorCode.ROLLBACK_FAILED:
        return [
          'Manually restore from backup files',
          'Reinstall Cursor IDE if configuration is corrupted',
          'Contact support for manual recovery assistance',
        ];

      default:
        return [
          'Review error details and context',
          'Follow suggested solutions',
          'Retry the operation if applicable',
        ];
    }
  }

  /**
   * 오류 정보를 JSON 형태로 직렬화
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      metadata: this.metadata,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      suggestions: this.suggestions,
      recoveryActions: this.recoveryActions,
      stack: this.stack,
    };
  }

  /**
   * 사용자 친화적인 오류 메시지 생성
   */
  toUserFriendlyMessage(): string {
    const severityEmoji = {
      [ErrorSeverity.LOW]: '⚠️',
      [ErrorSeverity.MEDIUM]: '❌',
      [ErrorSeverity.HIGH]: '🚨',
      [ErrorSeverity.CRITICAL]: '💥',
    };

    let message = `${severityEmoji[this.severity]} Cursor IDE Deployment Error\n\n`;
    message += `Error: ${this.message}\n`;
    message += `Code: ${this.code}\n`;
    message += `Category: ${this.category}\n`;
    message += `Severity: ${this.severity}\n\n`;

    if (this.suggestions.length > 0) {
      message += `💡 Suggestions:\n`;
      this.suggestions.forEach((suggestion, index) => {
        message += `  ${index + 1}. ${suggestion}\n`;
      });
      message += '\n';
    }

    if (this.recoveryActions.length > 0) {
      message += `🔧 Recovery Actions:\n`;
      this.recoveryActions.forEach((action, index) => {
        message += `  ${index + 1}. ${action}\n`;
      });
      message += '\n';
    }

    if (this.isRetryable) {
      message += `🔄 This error is retryable. You can try running the command again.\n`;
    }

    if (this.requiresRollback) {
      message += `↩️  Rollback may be required to restore previous state.\n`;
    }

    return message;
  }
}

/**
 * 특정 오류 코드로 CursorDeploymentError 인스턴스를 생성하는 팩토리 함수들
 */
export class CursorDeploymentErrorFactory {
  static permissionDenied(path: string, operation: string): CursorDeploymentError {
    return new CursorDeploymentError(
      CursorDeploymentErrorCode.PERMISSION_DENIED,
      `Permission denied while ${operation}`,
      { path, operation },
      { targetPath: path, attemptedOperation: operation },
    );
  }

  static diskFull(path: string, requiredSpace: number, availableSpace: number): CursorDeploymentError {
    return new CursorDeploymentError(
      CursorDeploymentErrorCode.DISK_FULL,
      `Insufficient disk space. Required: ${requiredSpace}MB, Available: ${availableSpace}MB`,
      { path, requiredSpace, availableSpace },
      { targetPath: path, spaceDeficit: requiredSpace - availableSpace },
    );
  }

  static transformationFailed(component: string, reason: string): CursorDeploymentError {
    return new CursorDeploymentError(
      CursorDeploymentErrorCode.TRANSFORMATION_FAILED,
      `Failed to transform ${component}: ${reason}`,
      { component, reason },
      { failedComponent: component, transformationStage: 'conversion' },
    );
  }

  static securityThreatDetected(threatType: string, details: Record<string, unknown>): CursorDeploymentError {
    return new CursorDeploymentError(
      CursorDeploymentErrorCode.SECURITY_THREAT_DETECTED,
      `Security threat detected: ${threatType}`,
      details,
      { threatType, scanResult: details },
    );
  }

  static timeout(operation: string, timeoutMs: number): CursorDeploymentError {
    return new CursorDeploymentError(
      CursorDeploymentErrorCode.TIMEOUT,
      `Operation timed out after ${timeoutMs}ms: ${operation}`,
      { operation, timeoutMs },
      { timedOutOperation: operation, duration: timeoutMs },
    );
  }

  static rollbackFailed(reason: string, backupPath?: string): CursorDeploymentError {
    return new CursorDeploymentError(
      CursorDeploymentErrorCode.ROLLBACK_FAILED,
      `Rollback failed: ${reason}`,
      { reason, backupPath },
      { rollbackAttempted: true, backupAvailable: !!backupPath },
    );
  }
}