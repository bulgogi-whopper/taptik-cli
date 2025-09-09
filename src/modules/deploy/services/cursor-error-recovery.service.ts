import { promises as fs } from 'fs';
import { dirname } from 'path';

import { Injectable, Logger } from '@nestjs/common';

import { 
  CursorDeploymentError, 
  CursorDeploymentErrorCode
} from '../errors/cursor-deploy.error';

import { BackupService } from './backup.service';

/**
 * 복구 결과 인터페이스
 */
export interface RecoveryResult {
  success: boolean;
  message: string;
  suggestions: string[];
  retryable: boolean;
  rollbackPerformed?: boolean;
  backupRestored?: boolean;
  partialRecovery?: boolean;
  nextSteps?: string[];
}

/**
 * 복구 컨텍스트 인터페이스
 */
export interface RecoveryContext {
  deploymentId?: string;
  targetPath: string;
  backupId?: string;
  failedComponent?: string;
  deploymentOptions: any;
  attemptCount: number;
  maxRetries: number;
  userInteractive: boolean;
}

/**
 * 복구 전략 인터페이스
 */
export interface RecoveryStrategy {
  canHandle(error: CursorDeploymentError): boolean;
  recover(error: CursorDeploymentError, context: RecoveryContext): Promise<RecoveryResult>;
  priority: number; // 낮을수록 높은 우선순위
}

/**
 * Cursor IDE 배포 오류 복구 서비스
 * 
 * 이 서비스는 Cursor IDE 배포 과정에서 발생하는 다양한 오류에 대해
 * 자동 복구를 시도하고, 복구가 불가능한 경우 사용자에게 적절한 가이드를 제공합니다.
 */
@Injectable()
export class CursorErrorRecoveryService {
  private readonly logger = new Logger(CursorErrorRecoveryService.name);
  private readonly recoveryStrategies: RecoveryStrategy[] = [];

  constructor(private readonly backupService: BackupService) {
    this.initializeRecoveryStrategies();
  }

  /**
   * 오류 복구 전략들을 초기화
   */
  private initializeRecoveryStrategies(): void {
    this.recoveryStrategies.push(
      new FileSystemRecoveryStrategy(this.backupService),
      new PermissionRecoveryStrategy(),
      new NetworkRecoveryStrategy(),
      new TransformationRecoveryStrategy(),
      new SecurityRecoveryStrategy(),
      new PerformanceRecoveryStrategy(),
      new ConflictRecoveryStrategy(this.backupService),
      new GeneralRecoveryStrategy(),
    );

    // 우선순위 순으로 정렬
    this.recoveryStrategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 오류에 대한 복구를 시도
   */
  async handleError(
    error: CursorDeploymentError,
    context: RecoveryContext,
  ): Promise<RecoveryResult> {
    this.logger.error(`Handling Cursor deployment error: ${error.code}`, {
      error: error.toJSON(),
      context,
    });

    // 적절한 복구 전략 찾기
    const strategy = this.findRecoveryStrategy(error);
    if (!strategy) {
      return this.createFailureResult(
        'No recovery strategy available for this error',
        error.suggestions,
        false,
      );
    }

    try {
      // 복구 시도
      const result = await strategy.recover(error, context);
      
      this.logger.log(`Recovery attempt completed`, {
        errorCode: error.code,
        success: result.success,
        strategy: strategy.constructor.name,
      });

      return result;
    } catch (recoveryError) {
      this.logger.error(`Recovery strategy failed`, {
        originalError: error.code,
        recoveryError: recoveryError.message,
        strategy: strategy.constructor.name,
      });

      return this.createFailureResult(
        `Recovery failed: ${recoveryError.message}`,
        error.suggestions,
        false,
      );
    }
  }

  /**
   * 오류에 적합한 복구 전략 찾기
   */
  private findRecoveryStrategy(error: CursorDeploymentError): RecoveryStrategy | null {
    return this.recoveryStrategies.find(strategy => strategy.canHandle(error)) || null;
  }

  /**
   * 실패 결과 생성
   */
  private createFailureResult(
    message: string,
    suggestions: string[],
    retryable: boolean,
  ): RecoveryResult {
    return {
      success: false,
      message,
      suggestions,
      retryable,
    };
  }

  /**
   * 자동 재시도 로직
   */
  async attemptAutoRetry(
    error: CursorDeploymentError,
    context: RecoveryContext,
    retryFunction: () => Promise<any>,
  ): Promise<any> {
    if (!error.isRetryable || context.attemptCount >= context.maxRetries) {
      throw error;
    }

    const delay = this.calculateRetryDelay(context.attemptCount);
    this.logger.log(`Retrying operation after ${delay}ms (attempt ${context.attemptCount + 1}/${context.maxRetries})`);

    await this.sleep(delay);
    context.attemptCount++;

    try {
      return await retryFunction();
    } catch (retryError) {
      if (retryError instanceof CursorDeploymentError) {
        return this.attemptAutoRetry(retryError, context, retryFunction);
      }
      throw retryError;
    }
  }

  /**
   * 재시도 지연 시간 계산 (지수 백오프)
   */
  private calculateRetryDelay(attemptCount: number): number {
    const baseDelay = 1000; // 1초
    const maxDelay = 30000; // 30초
    const delay = baseDelay * Math.pow(2, attemptCount);
    return Math.min(delay, maxDelay);
  }

  /**
   * 지연 함수
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 파일 시스템 관련 오류 복구 전략
 */
class FileSystemRecoveryStrategy implements RecoveryStrategy {
  priority = 1;

  constructor(private readonly backupService: BackupService) {}

  canHandle(error: CursorDeploymentError): boolean {
    return error.category === 'filesystem';
  }

  async recover(error: CursorDeploymentError, context: RecoveryContext): Promise<RecoveryResult> {
    switch (error.code) {
      case CursorDeploymentErrorCode.PATH_NOT_FOUND:
        return this.handlePathNotFound(error, context);
      
      case CursorDeploymentErrorCode.DIRECTORY_NOT_WRITABLE:
        return this.handleDirectoryNotWritable(error, context);
      
      case CursorDeploymentErrorCode.FILE_LOCKED:
        return this.handleFileLocked(error, context);
      
      case CursorDeploymentErrorCode.FILE_CORRUPTION:
        return this.handleFileCorruption(error, context);
      
      default:
        return {
          success: false,
          message: 'Unsupported filesystem error',
          suggestions: error.suggestions,
          retryable: false,
        };
    }
  }

  private async handlePathNotFound(error: CursorDeploymentError, context: RecoveryContext): Promise<RecoveryResult> {
    const targetPath = error.details.path || context.targetPath;
    
    try {
      // 디렉토리 자동 생성 시도
      await fs.mkdir(dirname(targetPath), { recursive: true });
      
      return {
        success: true,
        message: `Created missing directory: ${dirname(targetPath)}`,
        suggestions: ['Directory created successfully', 'Retry the deployment'],
        retryable: true,
      };
    } catch (createError) {
      return {
        success: false,
        message: `Failed to create directory: ${createError.message}`,
        suggestions: [
          'Check parent directory permissions',
          'Create directory manually',
          'Use a different target path',
        ],
        retryable: false,
      };
    }
  }

  private async handleDirectoryNotWritable(error: CursorDeploymentError, context: RecoveryContext): Promise<RecoveryResult> {
    const targetPath = error.details.path || context.targetPath;
    
    try {
      // 권한 확인
      await fs.access(targetPath, fs.constants.W_OK);
      
      return {
        success: true,
        message: 'Directory is now writable',
        suggestions: ['Retry the deployment'],
        retryable: true,
      };
    } catch (_accessError) {
      return {
        success: false,
        message: 'Directory is still not writable',
        suggestions: [
          `Change permissions: chmod 755 ${targetPath}`,
          `Change ownership: chown $USER ${targetPath}`,
          'Run with elevated privileges',
        ],
        retryable: true,
      };
    }
  }

  private async handleFileLocked(error: CursorDeploymentError, _context: RecoveryContext): Promise<RecoveryResult> {
    // 파일 잠금 해제 대기 (최대 30초)
    const maxWaitTime = 30000;
    const checkInterval = 1000;
    const filePath = error.details.path;
    
     
    for (let waited = 0; waited < maxWaitTime; waited += checkInterval) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await fs.access(filePath, fs.constants.W_OK);
        return {
          success: true,
          message: 'File is no longer locked',
          suggestions: ['Retry the deployment'],
          retryable: true,
        };
      } catch {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
    }

    return {
      success: false,
      message: 'File remains locked after waiting',
      suggestions: [
        'Close Cursor IDE and retry',
        'Restart your system if necessary',
        'Check for processes using the file',
      ],
      retryable: true,
    };
  }

  private async handleFileCorruption(error: CursorDeploymentError, context: RecoveryContext): Promise<RecoveryResult> {
    if (context.backupId) {
      try {
        await this.backupService.restore(context.backupId, 'cursor-ide');
        return {
          success: true,
          message: 'Restored from backup due to file corruption',
          suggestions: ['Backup restored successfully', 'Try deployment again'],
          retryable: true,
          backupRestored: true,
        };
      } catch (restoreError) {
        return {
          success: false,
          message: `Failed to restore backup: ${restoreError.message}`,
          suggestions: [
            'Manually restore configuration files',
            'Reinstall Cursor IDE',
            'Contact support for assistance',
          ],
          retryable: false,
        };
      }
    }

    return {
      success: false,
      message: 'File corruption detected, no backup available',
      suggestions: [
        'Manually backup current configuration',
        'Reinstall Cursor IDE',
        'Use --force flag to overwrite corrupted files',
      ],
      retryable: false,
    };
  }
}

/**
 * 권한 관련 오류 복구 전략
 */
class PermissionRecoveryStrategy implements RecoveryStrategy {
  priority = 2;

  canHandle(error: CursorDeploymentError): boolean {
    return error.code === CursorDeploymentErrorCode.PERMISSION_DENIED;
  }

  async recover(error: CursorDeploymentError, context: RecoveryContext): Promise<RecoveryResult> {
    const targetPath = error.details.path || context.targetPath;
    
    // 권한 확인 및 가이드 제공
    try {
      const stats = await fs.stat(targetPath);
      const isDirectory = stats.isDirectory();
      
      return {
        success: false,
        message: 'Permission denied - manual intervention required',
        suggestions: [
          `Target ${isDirectory ? 'directory' : 'file'}: ${targetPath}`,
          `Current permissions: ${stats.mode.toString(8)}`,
          `Change permissions: chmod 755 ${targetPath}`,
          `Change ownership: chown $USER ${targetPath}`,
          'Run with elevated privileges: sudo taptik deploy --platform cursor-ide',
        ],
        retryable: true,
        nextSteps: [
          'Fix permissions using suggested commands',
          'Retry the deployment',
          'Contact system administrator if needed',
        ],
      };
    } catch (_statError) {
      return {
        success: false,
        message: 'Permission denied - path may not exist',
        suggestions: [
          'Check if the target path exists',
          'Create the directory if missing',
          'Verify parent directory permissions',
        ],
        retryable: true,
      };
    }
  }
}

/**
 * 네트워크 관련 오류 복구 전략
 */
class NetworkRecoveryStrategy implements RecoveryStrategy {
  priority = 3;

  canHandle(error: CursorDeploymentError): boolean {
    return error.category === 'network';
  }

  async recover(_error: CursorDeploymentError, _context: RecoveryContext): Promise<RecoveryResult> {
    // 네트워크 연결 테스트
    const isOnline = await this.checkNetworkConnectivity();
    
    if (!isOnline) {
      return {
        success: false,
        message: 'Network connectivity issue detected',
        suggestions: [
          'Check your internet connection',
          'Try again when network is stable',
          'Use offline mode if available',
        ],
        retryable: true,
      };
    }

    // 네트워크는 정상이지만 특정 서비스 문제
    return {
      success: false,
      message: 'Network service temporarily unavailable',
      suggestions: [
        'Service may be temporarily down',
        'Try again in a few minutes',
        'Check service status page',
      ],
      retryable: true,
    };
  }

  private async checkNetworkConnectivity(): Promise<boolean> {
    try {
      // 간단한 DNS 조회로 네트워크 연결 확인
      const { lookup } = await import('dns');
      return new Promise((resolve) => {
        lookup('google.com', (err) => {
          resolve(!err);
        });
      });
    } catch {
      return false;
    }
  }
}

/**
 * 변환 관련 오류 복구 전략
 */
class TransformationRecoveryStrategy implements RecoveryStrategy {
  priority = 4;

  canHandle(error: CursorDeploymentError): boolean {
    return error.category === 'transformation';
  }

  async recover(error: CursorDeploymentError, context: RecoveryContext): Promise<RecoveryResult> {
    switch (error.code) {
      case CursorDeploymentErrorCode.UNSUPPORTED_FEATURE:
        return this.handleUnsupportedFeature(error, context);
      
      case CursorDeploymentErrorCode.MAPPING_ERROR:
        return this.handleMappingError(error, context);
      
      default:
        return {
          success: false,
          message: 'Transformation error requires manual review',
          suggestions: error.suggestions,
          retryable: false,
          partialRecovery: true,
        };
    }
  }

  private async handleUnsupportedFeature(_error: CursorDeploymentError, _context: RecoveryContext): Promise<RecoveryResult> {
    return {
      success: true,
      message: 'Skipped unsupported feature',
      suggestions: [
        'Unsupported features were skipped',
        'Deployment can continue with supported features',
        'Check documentation for feature compatibility',
      ],
      retryable: true,
      partialRecovery: true,
    };
  }

  private async handleMappingError(_error: CursorDeploymentError, _context: RecoveryContext): Promise<RecoveryResult> {
    return {
      success: true,
      message: 'Applied default mapping for failed component',
      suggestions: [
        'Default values used for unmappable settings',
        'Review deployed configuration for accuracy',
        'Manual adjustment may be needed',
      ],
      retryable: true,
      partialRecovery: true,
    };
  }
}

/**
 * 보안 관련 오류 복구 전략
 */
class SecurityRecoveryStrategy implements RecoveryStrategy {
  priority = 5;

  canHandle(error: CursorDeploymentError): boolean {
    return error.category === 'security';
  }

  async recover(_error: CursorDeploymentError, _context: RecoveryContext): Promise<RecoveryResult> {
    // 보안 오류는 일반적으로 자동 복구하지 않음
    return {
      success: false,
      message: 'Security issue requires manual review',
      suggestions: [
        'Review the flagged content carefully',
        'Remove or sanitize suspicious entries',
        'Use --force flag only if you trust the source',
        'Contact support if this appears to be a false positive',
      ],
      retryable: false,
      nextSteps: [
        'Examine the security scan results',
        'Make necessary corrections',
        'Re-run deployment after fixes',
      ],
    };
  }
}

/**
 * 성능 관련 오류 복구 전략
 */
class PerformanceRecoveryStrategy implements RecoveryStrategy {
  priority = 6;

  canHandle(error: CursorDeploymentError): boolean {
    return error.category === 'performance';
  }

  async recover(error: CursorDeploymentError, context: RecoveryContext): Promise<RecoveryResult> {
    switch (error.code) {
      case CursorDeploymentErrorCode.TIMEOUT:
        return this.handleTimeout(error, context);
      
      case CursorDeploymentErrorCode.MEMORY_LIMIT_EXCEEDED:
        return this.handleMemoryLimit(error, context);
      
      case CursorDeploymentErrorCode.RATE_LIMIT_EXCEEDED:
        return this.handleRateLimit(error, context);
      
      default:
        return {
          success: false,
          message: 'Performance issue requires optimization',
          suggestions: error.suggestions,
          retryable: true,
        };
    }
  }

  private async handleTimeout(_error: CursorDeploymentError, _context: RecoveryContext): Promise<RecoveryResult> {
    return {
      success: false,
      message: 'Operation timed out',
      suggestions: [
        'Try with a more stable network connection',
        'Deploy smaller components separately',
        'Increase timeout settings if available',
      ],
      retryable: true,
    };
  }

  private async handleMemoryLimit(_error: CursorDeploymentError, _context: RecoveryContext): Promise<RecoveryResult> {
    return {
      success: false,
      message: 'Memory limit exceeded',
      suggestions: [
        'Close unnecessary applications',
        'Deploy components individually',
        'Use streaming mode for large files',
      ],
      retryable: true,
    };
  }

  private async handleRateLimit(_error: CursorDeploymentError, _context: RecoveryContext): Promise<RecoveryResult> {
    const waitTime = 60000; // 1분 대기
    
    return {
      success: false,
      message: `Rate limit exceeded, wait ${waitTime / 1000} seconds`,
      suggestions: [
        'API rate limit reached',
        'Wait before retrying',
        'Consider upgrading service plan',
      ],
      retryable: true,
    };
  }
}

/**
 * 충돌 관련 오류 복구 전략
 */
class ConflictRecoveryStrategy implements RecoveryStrategy {
  priority = 7;

  constructor(private readonly backupService: BackupService) {}

  canHandle(error: CursorDeploymentError): boolean {
    return error.category === 'conflict';
  }

  async recover(error: CursorDeploymentError, context: RecoveryContext): Promise<RecoveryResult> {
    switch (error.code) {
      case CursorDeploymentErrorCode.BACKUP_FAILED:
        return this.handleBackupFailed(error, context);
      
      case CursorDeploymentErrorCode.ROLLBACK_FAILED:
        return this.handleRollbackFailed(error, context);
      
      default:
        return {
          success: false,
          message: 'Conflict resolution requires manual intervention',
          suggestions: error.suggestions,
          retryable: false,
        };
    }
  }

  private async handleBackupFailed(_error: CursorDeploymentError, _context: RecoveryContext): Promise<RecoveryResult> {
    return {
      success: false,
      message: 'Backup creation failed',
      suggestions: [
        'Manually backup important configuration files',
        'Use --no-backup flag to skip backup creation',
        'Ensure sufficient disk space',
        'Check write permissions for backup location',
      ],
      retryable: true,
      nextSteps: [
        'Create manual backup if needed',
        'Retry deployment with --no-backup flag',
      ],
    };
  }

  private async handleRollbackFailed(_error: CursorDeploymentError, _context: RecoveryContext): Promise<RecoveryResult> {
    return {
      success: false,
      message: 'Automatic rollback failed - manual recovery required',
      suggestions: [
        'Manually restore configuration files from backup',
        'Reinstall Cursor IDE if configuration is corrupted',
        'Check backup file integrity',
        'Contact support for recovery assistance',
      ],
      retryable: false,
      nextSteps: [
        'Locate backup files',
        'Manually restore configuration',
        'Verify Cursor IDE functionality',
      ],
    };
  }
}

/**
 * 일반 오류 복구 전략 (fallback)
 */
class GeneralRecoveryStrategy implements RecoveryStrategy {
  priority = 999; // 가장 낮은 우선순위

  canHandle(_error: CursorDeploymentError): boolean {
    return true; // 모든 오류를 처리 (fallback)
  }

  async recover(error: CursorDeploymentError, _context: RecoveryContext): Promise<RecoveryResult> {
    return {
      success: false,
      message: 'General error - manual intervention required',
      suggestions: error.suggestions,
      retryable: error.isRetryable,
      nextSteps: [
        'Review error details carefully',
        'Follow suggested solutions',
        'Contact support if issue persists',
      ],
    };
  }
}