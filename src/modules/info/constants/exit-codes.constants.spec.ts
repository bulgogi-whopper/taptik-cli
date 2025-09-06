import { describe, it, expect } from 'vitest';

import {
  EXIT_CODES,
  getExitCodeDescription,
  CLIError,
} from './exit-codes.constants';

describe('ExitCodes', () => {
  describe('EXIT_CODES', () => {
    it('EXIT_CODES 상수들이 올바른 값을 가져야 함', () => {
      // Assert
      expect(EXIT_CODES.SUCCESS).toBe(0);
      expect(EXIT_CODES.GENERAL_ERROR).toBe(1);
      expect(EXIT_CODES.INVALID_ARGUMENT).toBe(2);
      expect(EXIT_CODES.NETWORK_ERROR).toBe(3);
      expect(EXIT_CODES.AUTH_ERROR).toBe(4);
      expect(EXIT_CODES.SERVER_ERROR).toBe(5);
      expect(EXIT_CODES.PERMISSION_ERROR).toBe(6);
      expect(EXIT_CODES.TIMEOUT_ERROR).toBe(7);
    });

    it('모든 exit code가 고유한 값을 가져야 함', () => {
      // Arrange
      const codes = Object.values(EXIT_CODES);
      const uniqueCodes = new Set(codes);

      // Assert
      expect(uniqueCodes.size).toBe(codes.length);
    });
  });

  describe('getExitCodeDescription', () => {
    it('SUCCESS 코드에 대한 올바른 설명을 반환해야 함', () => {
      // Act
      const description = getExitCodeDescription(EXIT_CODES.SUCCESS);

      // Assert
      expect(description).toBe('Operation completed successfully');
    });

    it('NETWORK_ERROR 코드에 대한 올바른 설명을 반환해야 함', () => {
      // Act
      const description = getExitCodeDescription(EXIT_CODES.NETWORK_ERROR);

      // Assert
      expect(description).toBe('Network connection failed');
    });

    it('AUTH_ERROR 코드에 대한 올바른 설명을 반환해야 함', () => {
      // Act
      const description = getExitCodeDescription(EXIT_CODES.AUTH_ERROR);

      // Assert
      expect(description).toBe('Authentication failed');
    });

    it('SERVER_ERROR 코드에 대한 올바른 설명을 반환해야 함', () => {
      // Act
      const description = getExitCodeDescription(EXIT_CODES.SERVER_ERROR);

      // Assert
      expect(description).toBe('Server error occurred');
    });

    it('INVALID_ARGUMENT 코드에 대한 올바른 설명을 반환해야 함', () => {
      // Act
      const description = getExitCodeDescription(EXIT_CODES.INVALID_ARGUMENT);

      // Assert
      expect(description).toBe('Invalid argument provided');
    });

    it('알 수 없는 코드에 대해 기본 설명을 반환해야 함', () => {
      // Act
      const description = getExitCodeDescription(999 as any);

      // Assert
      expect(description).toBe('Unknown error');
    });
  });

  describe('CLIError', () => {
    it('기본 exit code와 함께 CLIError를 생성할 수 있어야 함', () => {
      // Arrange
      const message = 'Test error message';

      // Act
      const error = new CLIError(message);

      // Assert
      expect(error.message).toBe(message);
      expect(error.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
      expect(error.name).toBe('CLIError');
      expect(error).toBeInstanceOf(Error);
    });

    it('사용자 정의 exit code와 함께 CLIError를 생성할 수 있어야 함', () => {
      // Arrange
      const message = 'Network error occurred';
      const exitCode = EXIT_CODES.NETWORK_ERROR;

      // Act
      const error = new CLIError(message, exitCode);

      // Assert
      expect(error.message).toBe(message);
      expect(error.exitCode).toBe(exitCode);
      expect(error.name).toBe('CLIError');
    });

    it('Error의 인스턴스여야 함', () => {
      // Arrange & Act
      const error = new CLIError('Test error');

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CLIError);
    });

    it('스택 트레이스를 가져야 함', () => {
      // Arrange & Act
      const error = new CLIError('Test error');

      // Assert
      expect(error.stack).toBeDefined();
    });
  });
});
