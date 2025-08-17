import { beforeEach, describe, expect, it, vi  } from 'vitest';

import { FileSystemErrorHandler, FileSystemErrorCode } from './file-system-error-handler';

describe('FileSystemErrorHandler', () => {
  const mockOperation = 'testing file operation';
  const mockFilePath = '/test/path/file.txt';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle permission denied errors', () => {
    const error = { code: FileSystemErrorCode.PERMISSION_DENIED };
    
    const result = FileSystemErrorHandler.handleError(error, mockOperation, mockFilePath);
    
    expect(result.shouldContinue).toBe(false);
    expect(result.isCritical).toBe(true);
    expect(result.userMessage).toContain('Permission denied');
    expect(result.userMessage).toContain(mockOperation);
    expect(result.userMessage).toContain(mockFilePath);
    expect(result.suggestions).toHaveLength(4);
    expect(result.suggestions[0]).toContain('ls -la');
    expect(result.suggestions[1]).toContain('administrator');
    expect(result.suggestions[2]).toContain('read/write access');
    expect(result.suggestions[3]).toContain('chown');
  });

  it('should handle file not found errors', () => {
    const error = { code: FileSystemErrorCode.FILE_NOT_FOUND };
    
    const result = FileSystemErrorHandler.handleError(error, mockOperation, mockFilePath);
    
    expect(result.shouldContinue).toBe(true);
    expect(result.isCritical).toBe(false);
    expect(result.userMessage).toContain('File or directory not found');
    expect(result.userMessage).toContain(mockOperation);
    expect(result.userMessage).toContain(mockFilePath);
    expect(result.suggestions).toHaveLength(4);
    expect(result.suggestions[0]).toContain('file path is correct');
    expect(result.suggestions[1]).toContain('moved or deleted');
    expect(result.suggestions[2]).toContain('parent directory exists');
    expect(result.suggestions[3]).toContain('creating the file');
  });

  it('should handle directory not found errors', () => {
    const error = { code: FileSystemErrorCode.DIRECTORY_NOT_FOUND };
    
    const result = FileSystemErrorHandler.handleError(error, mockOperation, mockFilePath);
    
    expect(result.shouldContinue).toBe(true);
    expect(result.isCritical).toBe(false);
    expect(result.userMessage).toContain('File or directory not found');
    expect(result.suggestions).toHaveLength(4);
  });

  it('should handle no space left on device errors', () => {
    const error = { code: FileSystemErrorCode.NO_SPACE_LEFT };
    
    const result = FileSystemErrorHandler.handleError(error, mockOperation, mockFilePath);
    
    expect(result.shouldContinue).toBe(false);
    expect(result.isCritical).toBe(true);
    expect(result.userMessage).toContain('No space left on device');
    expect(result.suggestions).toHaveLength(4);
    expect(result.suggestions[0]).toContain('Free up disk space');
    expect(result.suggestions[1]).toContain('df -h');
    expect(result.suggestions[2]).toContain('temporary files');
    expect(result.suggestions[3]).toContain('different location');
  });

  it('should handle read-only file system errors', () => {
    const error = { code: FileSystemErrorCode.READ_ONLY_FILE_SYSTEM };
    
    const result = FileSystemErrorHandler.handleError(error, mockOperation, mockFilePath);
    
    expect(result.shouldContinue).toBe(false);
    expect(result.isCritical).toBe(true);
    expect(result.userMessage).toContain('read-only file system');
    expect(result.suggestions).toHaveLength(4);
    expect(result.suggestions[0]).toContain('mounted read-only');
    expect(result.suggestions[1]).toContain('Remount');
    expect(result.suggestions[2]).toContain('writable location');
    expect(result.suggestions[3]).toContain('mount | grep ro');
  });

  it('should handle too many open files errors', () => {
    const error = { code: FileSystemErrorCode.TOO_MANY_OPEN_FILES };
    
    const result = FileSystemErrorHandler.handleError(error, mockOperation, mockFilePath);
    
    expect(result.shouldContinue).toBe(false);
    expect(result.isCritical).toBe(true);
    expect(result.userMessage).toContain('Too many open files');
    expect(result.suggestions).toHaveLength(4);
    expect(result.suggestions[0]).toContain('file handles');
    expect(result.suggestions[1]).toContain('ulimit -n');
    expect(result.suggestions[2]).toContain('lsof');
    expect(result.suggestions[3]).toContain('Restart');
  });

  it('should handle invalid path errors', () => {
    const error = { code: FileSystemErrorCode.INVALID_PATH };
    
    const result = FileSystemErrorHandler.handleError(error, mockOperation, mockFilePath);
    
    expect(result.shouldContinue).toBe(false);
    expect(result.isCritical).toBe(true);
    expect(result.userMessage).toContain('Invalid path');
    expect(result.suggestions).toHaveLength(4);
    expect(result.suggestions[0]).toContain('invalid characters');
    expect(result.suggestions[1]).toContain('path length');
    expect(result.suggestions[2]).toContain('path format');
    expect(result.suggestions[3]).toContain('absolute paths');
  });

  it('should handle generic/unknown errors', () => {
    const error = { 
      code: 'UNKNOWN_ERROR', 
      message: 'Something went wrong',
      stack: 'Error stack trace'
    };
    
    const result = FileSystemErrorHandler.handleError(error, mockOperation, mockFilePath);
    
    expect(result.shouldContinue).toBe(false);
    expect(result.isCritical).toBe(true);
    expect(result.userMessage).toContain('File system error');
    expect(result.userMessage).toContain('Something went wrong');
    expect(result.suggestions).toHaveLength(4);
    expect(result.suggestions[0]).toContain('error message');
    expect(result.suggestions[1]).toContain('exists and is accessible');
    expect(result.suggestions[2]).toContain('Try the operation again');
    expect(result.suggestions[3]).toContain('system administrator');
  });

  it('should handle errors without code property', () => {
    const error = { message: 'Generic error without code' };
    
    const result = FileSystemErrorHandler.handleError(error, mockOperation, mockFilePath);
    
    expect(result.shouldContinue).toBe(false);
    expect(result.isCritical).toBe(true);
    expect(result.userMessage).toContain('File system error');
    expect(result.suggestions).toHaveLength(4);
  });

  describe('logErrorResult', () => {
    let mockLogger: any;

    beforeEach(() => {
      mockLogger = {
        error: vi.fn(),
        warn: vi.fn(),
        log: vi.fn(),
      };
      (FileSystemErrorHandler as any).logger = mockLogger;
    });

    it('should log critical errors with suggestions', () => {
      const result = {
        shouldContinue: false,
        userMessage: 'Critical error occurred',
        suggestions: ['Suggestion 1', 'Suggestion 2'],
        isCritical: true,
      };

      FileSystemErrorHandler.logErrorResult(result);

      expect(mockLogger.error).toHaveBeenCalledWith('Critical error: Critical error occurred');
      expect(mockLogger.log).toHaveBeenCalledWith('Suggested resolutions:');
      expect(mockLogger.log).toHaveBeenCalledWith('  1. Suggestion 1');
      expect(mockLogger.log).toHaveBeenCalledWith('  2. Suggestion 2');
    });

    it('should log warnings for non-critical errors', () => {
      const result = {
        shouldContinue: true,
        userMessage: 'Warning message',
        suggestions: ['Fix this'],
        isCritical: false,
      };

      FileSystemErrorHandler.logErrorResult(result);

      expect(mockLogger.warn).toHaveBeenCalledWith('Warning: Warning message');
      expect(mockLogger.log).toHaveBeenCalledWith('Suggested resolutions:');
      expect(mockLogger.log).toHaveBeenCalledWith('  1. Fix this');
    });

    it('should handle results with no suggestions', () => {
      const result = {
        shouldContinue: false,
        userMessage: 'Error with no suggestions',
        suggestions: [],
        isCritical: true,
      };

      FileSystemErrorHandler.logErrorResult(result);

      expect(mockLogger.error).toHaveBeenCalledWith('Critical error: Error with no suggestions');
      expect(mockLogger.log).not.toHaveBeenCalledWith('Suggested resolutions:');
    });
  });

  describe('error codes enum', () => {
    it('should have all expected error codes', () => {
      expect(FileSystemErrorCode.PERMISSION_DENIED).toBe('EACCES');
      expect(FileSystemErrorCode.FILE_NOT_FOUND).toBe('ENOENT');
      expect(FileSystemErrorCode.DIRECTORY_NOT_FOUND).toBe('ENOTDIR');
      expect(FileSystemErrorCode.NO_SPACE_LEFT).toBe('ENOSPC');
      expect(FileSystemErrorCode.READ_ONLY_FILE_SYSTEM).toBe('EROFS');
      expect(FileSystemErrorCode.TOO_MANY_OPEN_FILES).toBe('EMFILE');
      expect(FileSystemErrorCode.INVALID_PATH).toBe('EINVAL');
    });
  });
});