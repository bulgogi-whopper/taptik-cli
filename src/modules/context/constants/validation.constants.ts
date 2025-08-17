/**
 * Validation-related constants and rules
 */

export enum ValidationErrorCode {
  // Format errors
  INVALID_FORMAT = 'INVALID_FORMAT',
  INVALID_VERSION = 'INVALID_VERSION',
  INVALID_JSON = 'INVALID_JSON',
  INVALID_ENCODING = 'INVALID_ENCODING',

  // Platform errors
  UNSUPPORTED_IDE = 'UNSUPPORTED_IDE',
  PLATFORM_MISMATCH = 'PLATFORM_MISMATCH',
  INCOMPATIBLE_VERSION = 'INCOMPATIBLE_VERSION',

  // Security errors
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  SENSITIVE_DATA_DETECTED = 'SENSITIVE_DATA_DETECTED',
  ENCRYPTION_REQUIRED = 'ENCRYPTION_REQUIRED',

  // Size errors
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  CONTENT_TOO_LARGE = 'CONTENT_TOO_LARGE',

  // Required field errors
  MISSING_METADATA = 'MISSING_METADATA',
  MISSING_CONTENT = 'MISSING_CONTENT',
  MISSING_SECURITY = 'MISSING_SECURITY',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Cloud errors
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
  SYNC_FAILED = 'SYNC_FAILED',

  // Auth errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  // General errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  OPERATION_FAILED = 'OPERATION_FAILED',
}

export enum ValidationWarningCode {
  DEPRECATED_FORMAT = 'DEPRECATED_FORMAT',
  MISSING_OPTIONAL_FIELD = 'MISSING_OPTIONAL_FIELD',
  LARGE_FILE_SIZE = 'LARGE_FILE_SIZE',
  POTENTIAL_SECURITY_ISSUE = 'POTENTIAL_SECURITY_ISSUE',
  COMPATIBILITY_WARNING = 'COMPATIBILITY_WARNING',
  PERFORMANCE_WARNING = 'PERFORMANCE_WARNING',
}

/**
 * Content categories for validation
 */
export enum ContentCategory {
  PERSONAL = 'personal',
  PROJECT = 'project',
  PROMPTS = 'prompts',
  TOOLS = 'tools',
  IDE = 'ide',
}

/**
 * Validation rules and constraints
 */
export const VALIDATION_RULES = {
  // Version constraints
  VERSION: {
    PATTERN: /^\d+\.\d+\.\d+$/,
    CURRENT: '1.0.0',
    MINIMUM: '1.0.0',
    MAXIMUM: '2.0.0',
  },

  // Size constraints
  SIZE: {
    MAX_TITLE_LENGTH: 100,
    MAX_DESCRIPTION_LENGTH: 500,
    MAX_TAG_LENGTH: 30,
    MAX_TAGS: 10,
    MAX_USERNAME_LENGTH: 50,
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
    MAX_CONTENT_SIZE: 10 * 1024 * 1024, // 10MB for content field
    MIN_TITLE_LENGTH: 3,
    MIN_DESCRIPTION_LENGTH: 10,
  },

  // Format constraints
  FORMAT: {
    DATE_ISO_8601: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
    UUID_V4:
      /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i,
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    URL: /^https?:\/\/(www\.)?[\w#%+.:=@~-]{1,256}\.[\d()A-Za-z]{1,6}\b([\w#%&()+./:=?@~-]*)$/,
    SEMVER: /^\d+\.\d+\.\d+(-[\d.A-Za-z-]+)?(\+[\d.A-Za-z-]+)?$/,
  },

  // Field constraints
  FIELDS: {
    REQUIRED_METADATA: ['version', 'exportedAt', 'sourceIde', 'targetIdes'],
    REQUIRED_SECURITY: ['hasApiKeys', 'filteredFields', 'scanResults'],
    REQUIRED_SCAN_RESULTS: ['passed', 'warnings'],
    OPTIONAL_METADATA: [
      'title',
      'description',
      'tags',
      'fileSize',
      'generatedBy',
    ],
    VALID_CATEGORIES: Object.values(ContentCategory),
  },

  // Tag constraints
  TAGS: {
    PATTERN: /^[\da-z-]+$/,
    MIN_LENGTH: 2,
    MAX_LENGTH: 30,
    RESERVED: ['admin', 'official', 'verified', 'featured', 'trending'],
    BLACKLIST: ['hack', 'crack', 'exploit', 'malware', 'virus'],
  },
} as const;

/**
 * Success message templates
 */
export const SUCCESS_MESSAGES = {
  EXPORT_COMPLETE: 'Context exported successfully to {file}',
  UPLOAD_COMPLETE: 'Context uploaded to cloud (ID: {id})',
  DOWNLOAD_COMPLETE: 'Context downloaded successfully',
  DEPLOY_COMPLETE: 'Context deployed to {platform}',
  VALIDATION_PASSED: 'All validation checks passed',
  SYNC_COMPLETE: 'Synchronization completed successfully',
  CONVERSION_COMPLETE: 'Conversion from {source} to {target} completed',
  AUTH_SUCCESS: 'Authentication successful',
  SESSION_CREATED: 'Session created successfully',
  SESSION_RESTORED: 'Session restored successfully',
} as const;

/**
 * Error message templates
 */
export const ERROR_MESSAGES = {
  [ValidationErrorCode.INVALID_FORMAT]: 'Invalid format: {details}',
  [ValidationErrorCode.INVALID_VERSION]: 'Version {version} is not supported',
  [ValidationErrorCode.UNSUPPORTED_IDE]: 'IDE "{ide}" is not supported',
  [ValidationErrorCode.FILE_TOO_LARGE]:
    'File size ({size}) exceeds maximum allowed ({max})',
  [ValidationErrorCode.MISSING_METADATA]:
    'Required metadata field "{field}" is missing',
  [ValidationErrorCode.SECURITY_VIOLATION]:
    'Security violation detected: {type}',
  [ValidationErrorCode.UNAUTHORIZED]: 'Authentication required',
  [ValidationErrorCode.NOT_FOUND]: 'Resource not found: {resource}',
} as const;

/**
 * Warning message templates
 */
export const WARNING_MESSAGES = {
  [ValidationWarningCode.DEPRECATED_FORMAT]:
    'Using deprecated format version {version}',
  [ValidationWarningCode.LARGE_FILE_SIZE]:
    'File size ({size}) is large and may impact performance',
  [ValidationWarningCode.POTENTIAL_SECURITY_ISSUE]:
    'Potential security issue: {issue}',
  [ValidationWarningCode.COMPATIBILITY_WARNING]:
    'May not be fully compatible with {platform}',
} as const;

/**
 * Validation helper functions
 */
export function validateVersion(version: string): boolean {
  return VALIDATION_RULES.VERSION.PATTERN.test(version);
}

export function validateEmail(email: string): boolean {
  return VALIDATION_RULES.FORMAT.EMAIL.test(email);
}

export function validateUrl(url: string): boolean {
  return VALIDATION_RULES.FORMAT.URL.test(url);
}

export function validateUuid(uuid: string): boolean {
  return VALIDATION_RULES.FORMAT.UUID_V4.test(uuid);
}

export function validateTag(tag: string): boolean {
  if (
    tag.length < VALIDATION_RULES.TAGS.MIN_LENGTH ||
    tag.length > VALIDATION_RULES.TAGS.MAX_LENGTH
  ) {
    return false;
  }

  if (!VALIDATION_RULES.TAGS.PATTERN.test(tag)) {
    return false;
  }

  const lowerTag = tag.toLowerCase();
  if (
    VALIDATION_RULES.TAGS.BLACKLIST.includes(
      lowerTag as typeof VALIDATION_RULES.TAGS.BLACKLIST[number],
    )
  ) {
    return false;
  }

  return true;
}

export function validateDateString(dateString: string): boolean {
  if (!VALIDATION_RULES.FORMAT.DATE_ISO_8601.test(dateString)) {
    return false;
  }

  const date = new Date(dateString);
  return !Number.isNaN(date.getTime());
}

export function formatErrorMessage(
  code: ValidationErrorCode,
  parameters?: Record<string, string | number>,
): string {
  let message = ERROR_MESSAGES[code] || 'Unknown error';

  if (parameters) {
    Object.entries(parameters).forEach(([key, value]) => {
      message = message.replace(`{${key}}`, String(value));
    });
  }

  return message;
}

export function formatSuccessMessage(
  key: keyof typeof SUCCESS_MESSAGES,
  parameters?: Record<string, string | number>,
): string {
  let message: string = SUCCESS_MESSAGES[key];

  if (parameters) {
    Object.entries(parameters).forEach(([key, value]) => {
      message = message.replace(`{${key}}`, String(value));
    });
  }

  return message;
}
