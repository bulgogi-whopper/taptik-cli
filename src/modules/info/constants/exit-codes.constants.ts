/**
 * Exit codes for list command operations
 * Based on POSIX standard exit codes and CLI best practices
 */

/**
 * Standard exit codes for list command
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  INVALID_ARGUMENT: 2,
  NETWORK_ERROR: 3,
  AUTH_ERROR: 4,
  SERVER_ERROR: 5,
  PERMISSION_ERROR: 6,
  TIMEOUT_ERROR: 7,
} as const;

/**
 * Exit code type definition
 */
export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

/**
 * Get exit code description
 */
export function getExitCodeDescription(code: ExitCode): string {
  switch (code) {
    case EXIT_CODES.SUCCESS:
      return 'Operation completed successfully';
    case EXIT_CODES.GENERAL_ERROR:
      return 'General error occurred';
    case EXIT_CODES.INVALID_ARGUMENT:
      return 'Invalid argument provided';
    case EXIT_CODES.NETWORK_ERROR:
      return 'Network connection failed';
    case EXIT_CODES.AUTH_ERROR:
      return 'Authentication failed';
    case EXIT_CODES.SERVER_ERROR:
      return 'Server error occurred';
    case EXIT_CODES.PERMISSION_ERROR:
      return 'Permission denied';
    case EXIT_CODES.TIMEOUT_ERROR:
      return 'Operation timed out';
    default:
      return 'Unknown error';
  }
}

/**
 * Custom CLI error with exit code
 */
export class CLIError extends Error {
  constructor(
    message: string,
    public readonly exitCode: ExitCode = EXIT_CODES.GENERAL_ERROR,
  ) {
    super(message);
    this.name = 'CLIError';
  }
}
