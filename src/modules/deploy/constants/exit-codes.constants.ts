export enum ExitCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  VALIDATION_ERROR = 2,
  AUTH_ERROR = 3,
  NETWORK_ERROR = 4,
  PLATFORM_ERROR = 5,
  CONFLICT_ERROR = 6,
  ROLLBACK_ERROR = 7,
}

export const EXIT_CODE_MESSAGES: Record<ExitCode, string> = {
  [ExitCode.SUCCESS]: 'Deployment completed successfully',
  [ExitCode.GENERAL_ERROR]: 'Unexpected error occurred',
  [ExitCode.VALIDATION_ERROR]: 'Configuration failed validation checks',
  [ExitCode.AUTH_ERROR]: 'Authentication/authorization failed',
  [ExitCode.NETWORK_ERROR]: 'Connection to Supabase failed',
  [ExitCode.PLATFORM_ERROR]: 'Unsupported or incompatible platform',
  [ExitCode.CONFLICT_ERROR]: 'Unresolvable file/setting conflicts',
  [ExitCode.ROLLBACK_ERROR]: 'Failed to restore previous state',
};

export const EXIT_CODE_SUGGESTIONS: Record<ExitCode, string[]> = {
  [ExitCode.SUCCESS]: [],
  [ExitCode.GENERAL_ERROR]: [
    'Check the error message for more details',
    'Enable verbose logging with --verbose flag',
    'Check ~/.claude/.deploy-audit.log for details',
  ],
  [ExitCode.VALIDATION_ERROR]: [
    'Review the validation errors above',
    'Ensure configuration matches TaptikContext format',
    'Check for missing required fields',
    'Validate JSON syntax',
  ],
  [ExitCode.AUTH_ERROR]: [
    'Run "taptik login" to authenticate',
    'Check your Supabase credentials',
    'Verify network connectivity',
  ],
  [ExitCode.NETWORK_ERROR]: [
    'Check your internet connection',
    'Verify Supabase URL is correct',
    'Try again with --retry flag',
    'Check firewall settings',
  ],
  [ExitCode.PLATFORM_ERROR]: [
    'Claude Code is the only supported platform currently',
    'Check --platform flag value',
    'Future support for Kiro IDE and Cursor IDE planned',
  ],
  [ExitCode.CONFLICT_ERROR]: [
    'Use --conflict flag to specify resolution strategy',
    'Options: skip, overwrite, merge, backup',
    'Review conflicts with --diff flag',
    'Backup existing files before overwriting',
  ],
  [ExitCode.ROLLBACK_ERROR]: [
    'Check backup manifest location',
    'Manual recovery may be required',
    'Review ~/.claude/.deploy-audit.log',
    'Contact support if data loss occurred',
  ],
};
