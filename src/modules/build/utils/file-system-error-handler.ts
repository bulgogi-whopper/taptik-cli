import { Logger } from '@nestjs/common';

/**
 * File system error codes and their meanings
 */
export enum FileSystemErrorCode {
  PERMISSION_DENIED = 'EACCES',
  FILE_NOT_FOUND = 'ENOENT',
  DIRECTORY_NOT_FOUND = 'ENOTDIR',
  NO_SPACE_LEFT = 'ENOSPC',
  READ_ONLY_FILE_SYSTEM = 'EROFS',
  TOO_MANY_OPEN_FILES = 'EMFILE',
  INVALID_PATH = 'EINVAL',
}

/**
 * Result of file system error handling
 */
export interface FileSystemErrorResult {
  /** Whether the operation should continue */
  shouldContinue: boolean;
  /** User-friendly error message */
  userMessage: string;
  /** Suggested resolution steps */
  suggestions: string[];
  /** Whether this is a critical error */
  isCritical: boolean;
}

/**
 * Utility class for handling file system errors with user-friendly messages
 */
export class FileSystemErrorHandler {
  private static readonly logger = new Logger(FileSystemErrorHandler.name);

  /**
   * Handle file system errors with appropriate logging and user feedback
   * @param error The error that occurred
   * @param operation Description of the operation that failed
   * @param filePath The file/directory path involved
   * @returns Error handling result with user-friendly information
   */
  static handleError(error: any, operation: string, filePath: string): FileSystemErrorResult {
    const errorCode = error.code as FileSystemErrorCode;
    
    switch (errorCode) {
      case FileSystemErrorCode.PERMISSION_DENIED:
        return this.handlePermissionDenied(operation, filePath);
        
      case FileSystemErrorCode.FILE_NOT_FOUND:
      case FileSystemErrorCode.DIRECTORY_NOT_FOUND:
        return this.handleFileNotFound(operation, filePath);
        
      case FileSystemErrorCode.NO_SPACE_LEFT:
        return this.handleNoSpaceLeft(operation, filePath);
        
      case FileSystemErrorCode.READ_ONLY_FILE_SYSTEM:
        return this.handleReadOnlyFileSystem(operation, filePath);
        
      case FileSystemErrorCode.TOO_MANY_OPEN_FILES:
        return this.handleTooManyOpenFiles(operation, filePath);
        
      case FileSystemErrorCode.INVALID_PATH:
        return this.handleInvalidPath(operation, filePath);
        
      default:
        return this.handleGenericError(error, operation, filePath);
    }
  }

  /**
   * Handle permission denied errors
   */
  private static handlePermissionDenied(operation: string, filePath: string): FileSystemErrorResult {
    const userMessage = `Permission denied when ${operation}: ${filePath}`;
    
    this.logger.error(userMessage);
    
    return {
      shouldContinue: false,
      userMessage,
      suggestions: [
        'Check file/directory permissions with: ls -la',
        'Run with appropriate permissions or as administrator',
        'Ensure the user has read/write access to the directory',
        'Consider changing file ownership with: chown',
      ],
      isCritical: true,
    };
  }

  /**
   * Handle file/directory not found errors
   */
  private static handleFileNotFound(operation: string, filePath: string): FileSystemErrorResult {
    const userMessage = `File or directory not found when ${operation}: ${filePath}`;
    
    this.logger.warn(userMessage);
    
    return {
      shouldContinue: true, // Often non-critical, can continue with other files
      userMessage,
      suggestions: [
        'Verify the file path is correct',
        'Check if the file was moved or deleted',
        'Ensure the parent directory exists',
        'Consider creating the file/directory if needed',
      ],
      isCritical: false,
    };
  }

  /**
   * Handle no space left on device errors
   */
  private static handleNoSpaceLeft(operation: string, filePath: string): FileSystemErrorResult {
    const userMessage = `No space left on device when ${operation}: ${filePath}`;
    
    this.logger.error(userMessage);
    
    return {
      shouldContinue: false,
      userMessage,
      suggestions: [
        'Free up disk space by deleting unnecessary files',
        'Check disk usage with: df -h',
        'Clean temporary files and caches',
        'Consider moving to a different location with more space',
      ],
      isCritical: true,
    };
  }

  /**
   * Handle read-only file system errors
   */
  private static handleReadOnlyFileSystem(operation: string, filePath: string): FileSystemErrorResult {
    const userMessage = `Cannot write to read-only file system when ${operation}: ${filePath}`;
    
    this.logger.error(userMessage);
    
    return {
      shouldContinue: false,
      userMessage,
      suggestions: [
        'Check if the file system is mounted read-only',
        'Remount the file system with write permissions',
        'Choose a different writable location',
        'Check file system status with: mount | grep ro',
      ],
      isCritical: true,
    };
  }

  /**
   * Handle too many open files errors
   */
  private static handleTooManyOpenFiles(operation: string, filePath: string): FileSystemErrorResult {
    const userMessage = `Too many open files when ${operation}: ${filePath}`;
    
    this.logger.error(userMessage);
    
    return {
      shouldContinue: false,
      userMessage,
      suggestions: [
        'Close unnecessary file handles in the application',
        'Increase system file descriptor limit: ulimit -n',
        'Check currently open files with: lsof',
        'Restart the application to reset file handles',
      ],
      isCritical: true,
    };
  }

  /**
   * Handle invalid path errors
   */
  private static handleInvalidPath(operation: string, filePath: string): FileSystemErrorResult {
    const userMessage = `Invalid path when ${operation}: ${filePath}`;
    
    this.logger.error(userMessage);
    
    return {
      shouldContinue: false,
      userMessage,
      suggestions: [
        'Check for invalid characters in the path',
        'Ensure path length is within system limits',
        'Verify path format is correct for the operating system',
        'Use absolute paths to avoid confusion',
      ],
      isCritical: true,
    };
  }

  /**
   * Handle generic/unknown file system errors
   */
  private static handleGenericError(error: any, operation: string, filePath: string): FileSystemErrorResult {
    const userMessage = `File system error when ${operation}: ${filePath} - ${error.message}`;
    
    this.logger.error(userMessage, error.stack);
    
    return {
      shouldContinue: false,
      userMessage,
      suggestions: [
        'Check the error message for specific details',
        'Verify file/directory exists and is accessible',
        'Try the operation again after a brief wait',
        'Contact system administrator if the error persists',
      ],
      isCritical: true,
    };
  }

  /**
   * Log error handling results with suggestions
   */
  static logErrorResult(result: FileSystemErrorResult): void {
    if (result.isCritical) {
      this.logger.error(`Critical error: ${result.userMessage}`);
    } else {
      this.logger.warn(`Warning: ${result.userMessage}`);
    }
    
    if (result.suggestions.length > 0) {
      this.logger.log('Suggested resolutions:');
      result.suggestions.forEach((suggestion, index) => {
        this.logger.log(`  ${index + 1}. ${suggestion}`);
      });
    }
  }
}