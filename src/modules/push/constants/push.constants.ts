export enum PushErrorCode {
  // Authentication errors (3xx)
  AUTH_REQUIRED = 'AUTH_001',
  AUTH_EXPIRED = 'AUTH_002',
  INSUFFICIENT_PERMISSIONS = 'AUTH_003',
  AUTH_NOT_AUTHENTICATED = 'AUTH_004',
  AUTH_INSUFFICIENT_PERMISSIONS = 'AUTH_005',
  AUTH_SESSION_EXPIRED = 'AUTH_006',

  // Validation errors (4xx)
  INVALID_PACKAGE = 'VAL_001',
  INVALID_VERSION = 'VAL_002',
  PACKAGE_TOO_LARGE = 'VAL_003',
  UNSUPPORTED_PLATFORM = 'VAL_004',
  VAL_INVALID_FILE = 'VAL_005',
  VAL_FILE_TOO_LARGE = 'VAL_006',

  // Security errors (5xx)
  SENSITIVE_DATA_DETECTED = 'SEC_001',
  SANITIZATION_FAILED = 'SEC_002',
  MALICIOUS_CONTENT = 'SEC_003',

  // Network/Storage errors (6xx)
  UPLOAD_FAILED = 'NET_001',
  STORAGE_QUOTA_EXCEEDED = 'NET_002',
  NETWORK_TIMEOUT = 'NET_003',
  NET_CONNECTION_FAILED = 'NET_004',
  NET_TIMEOUT = 'NET_005',
  NET_RATE_LIMITED = 'NET_006',
  NET_SERVICE_UNAVAILABLE = 'NET_007',

  // Rate limiting errors (7xx)
  RATE_LIMIT_EXCEEDED = 'RATE_001',
  DAILY_QUOTA_EXCEEDED = 'RATE_002',

  // System errors (8xx)
  DATABASE_ERROR = 'SYS_001',
  INTERNAL_ERROR = 'SYS_002',
  SYSTEM_ERROR = 'SYS_003',
  SYS_UNKNOWN_ERROR = 'SYS_004',
  SYS_INTERNAL_ERROR = 'SYS_005',

  // Queue errors (9xx)
  QUEUE_FULL = 'QUEUE_001',
  QUEUE_ITEM_NOT_FOUND = 'QUEUE_002',
  FILE_NOT_FOUND = 'QUEUE_003',

  // Storage errors (10xx)
  STOR_QUOTA_EXCEEDED = 'STOR_001',
  STOR_UPLOAD_FAILED = 'STOR_002',
}

export const UPLOAD_CONFIG = {
  BUCKET_NAME: 'taptik-packages',
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  CHUNK_SIZE: 5 * 1024 * 1024, // 5MB chunks for resumable uploads
  CHUNKED_UPLOAD_THRESHOLD: 10 * 1024 * 1024, // Use chunked upload for files > 10MB
  ALLOWED_MIME_TYPES: ['application/octet-stream', 'application/gzip'],
  PUBLIC_BUCKET: false, // Use signed URLs for access
  STORAGE_PATH_PATTERN: 'packages/{userId}/{configId}/{version}/',
  SIGNED_URL_EXPIRATION: 3600, // 1 hour in seconds
};

export const RATE_LIMITS = {
  FREE_TIER: {
    UPLOADS_PER_DAY: 100,
    BANDWIDTH_PER_DAY: 1024 * 1024 * 1024, // 1GB
    MAX_PACKAGE_SIZE: 50 * 1024 * 1024, // 50MB
  },
  PRO_TIER: {
    UPLOADS_PER_DAY: 1000,
    BANDWIDTH_PER_DAY: 10 * 1024 * 1024 * 1024, // 10GB
    MAX_PACKAGE_SIZE: 500 * 1024 * 1024, // 500MB
  },
};

export const QUEUE_CONFIG = {
  DB_PATH: '~/.taptik/upload-queue.db',
  SYNC_INTERVAL: 30000, // 30 seconds
  MAX_QUEUE_SIZE: 100,
  MAX_RETRY_ATTEMPTS: 5,
  BASE_RETRY_DELAY: 1000, // 1 second
  MAX_RETRY_DELAY: 30000, // 30 seconds
};

export const SANITIZATION_CONFIG = {
  SENSITIVE_PATTERNS: [
    /api[_-]?key/gi,
    /secret/gi,
    /token/gi,
    /password/gi,
    /\b[\w%+.-]+@[\d.A-Za-z-]+\.[A-Za-z|]{2,}\b/g, // emails
    /\b(?:\d{4}[\s-]?){3}\d{4}\b/g, // credit card patterns
    /\b[\dA-Z]{20,}\b/g, // potential API keys
  ],
  REPLACEMENT_TEXT: '[REDACTED]',
  MAX_SCAN_SIZE: 10 * 1024 * 1024, // 10MB max scan size
};

export const PLATFORM_CONFIGS = {
  'claude-code': {
    supported: true,
    requiresSanitization: true,
    maxSize: 50 * 1024 * 1024,
  },
  'kiro-ide': {
    supported: true,
    requiresSanitization: false,
    maxSize: 100 * 1024 * 1024,
  },
  'cursor-ide': {
    supported: true,
    requiresSanitization: false,
    maxSize: 50 * 1024 * 1024,
  },
};

export interface PushErrorContext {
  operation?: string;
  packageId?: string;
  fileName?: string;
  userId?: string;
  attemptNumber?: number;
  details?: Record<string, unknown> | any;
  packagePath?: string;
  size?: number;
  remaining?: number;
  report?: unknown;
  originalError?: unknown;
  configId?: string;
  path?: string;
  currentSize?: number;
  id?: string;
  tier?: string;
  resetAt?: Date;
  error?: unknown;
  [key: string]: unknown; // Allow additional properties
}

export class PushError extends Error {
  public readonly userMessage: string;
  public readonly remediation?: string;
  public readonly originalError?: Error;
  public readonly context: PushErrorContext;

  constructor(
    public code: PushErrorCode,
    message: string,
    context: PushErrorContext = {},
    originalError?: Error,
  ) {
    super(message);
    this.name = 'PushError';
    this.context = context;
    this.originalError = originalError;
    this.userMessage = this.generateUserMessage();
    this.remediation = this.generateRemediation();
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PushError);
    }
  }

  get retryable(): boolean {
    return this.isRetryable();
  }

  get details(): unknown {
    return this.context.details;
  }

  private isRetryable(): boolean {
    const retryableCodes = [
      PushErrorCode.NETWORK_TIMEOUT,
      PushErrorCode.NET_TIMEOUT,
      PushErrorCode.NET_CONNECTION_FAILED,
      PushErrorCode.NET_SERVICE_UNAVAILABLE,
      PushErrorCode.UPLOAD_FAILED,
      PushErrorCode.STOR_UPLOAD_FAILED,
      PushErrorCode.AUTH_EXPIRED,
      PushErrorCode.AUTH_SESSION_EXPIRED,
      PushErrorCode.STORAGE_QUOTA_EXCEEDED,
      PushErrorCode.STOR_QUOTA_EXCEEDED,
    ];
    
    return retryableCodes.includes(this.code);
  }

  private generateUserMessage(): string {
    const messages: Record<PushErrorCode, string> = {
      [PushErrorCode.AUTH_REQUIRED]: 'You need to be logged in to perform this action',
      [PushErrorCode.AUTH_EXPIRED]: 'Your session has expired. Please log in again',
      [PushErrorCode.INSUFFICIENT_PERMISSIONS]: 'You do not have permission to perform this action',
      [PushErrorCode.AUTH_NOT_AUTHENTICATED]: 'You are not authenticated',
      [PushErrorCode.AUTH_INSUFFICIENT_PERMISSIONS]: 'You do not have sufficient permissions',
      [PushErrorCode.AUTH_SESSION_EXPIRED]: 'Your session has expired',
      
      [PushErrorCode.INVALID_PACKAGE]: 'The selected package is invalid or corrupted',
      [PushErrorCode.INVALID_VERSION]: 'The package version is invalid',
      [PushErrorCode.PACKAGE_TOO_LARGE]: 'The package size exceeds the maximum allowed limit',
      [PushErrorCode.UNSUPPORTED_PLATFORM]: 'The platform is not supported',
      [PushErrorCode.VAL_INVALID_FILE]: 'The file is invalid or corrupted',
      [PushErrorCode.VAL_FILE_TOO_LARGE]: 'The file size exceeds the maximum allowed limit',
      
      [PushErrorCode.SENSITIVE_DATA_DETECTED]: 'Sensitive data was detected in the package',
      [PushErrorCode.SANITIZATION_FAILED]: 'Failed to sanitize the package',
      [PushErrorCode.MALICIOUS_CONTENT]: 'Potentially malicious content was detected',
      
      [PushErrorCode.UPLOAD_FAILED]: 'Failed to upload the package to the cloud',
      [PushErrorCode.STORAGE_QUOTA_EXCEEDED]: 'Your storage quota has been exceeded',
      [PushErrorCode.NETWORK_TIMEOUT]: 'The request timed out',
      [PushErrorCode.NET_CONNECTION_FAILED]: 'Network connection failed',
      [PushErrorCode.NET_TIMEOUT]: 'Network request timed out',
      [PushErrorCode.NET_RATE_LIMITED]: 'Too many requests, please slow down',
      [PushErrorCode.NET_SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable',
      
      [PushErrorCode.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded. Please wait and try again',
      [PushErrorCode.DAILY_QUOTA_EXCEEDED]: 'Daily upload quota exceeded',
      
      [PushErrorCode.DATABASE_ERROR]: 'Database operation failed',
      [PushErrorCode.INTERNAL_ERROR]: 'An internal error occurred',
      [PushErrorCode.SYSTEM_ERROR]: 'A system error occurred',
      [PushErrorCode.SYS_UNKNOWN_ERROR]: 'An unknown system error occurred',
      [PushErrorCode.SYS_INTERNAL_ERROR]: 'An internal system error occurred',
      
      [PushErrorCode.QUEUE_FULL]: 'The upload queue is full',
      [PushErrorCode.QUEUE_ITEM_NOT_FOUND]: 'Queue item not found',
      [PushErrorCode.FILE_NOT_FOUND]: 'File not found',

      [PushErrorCode.STOR_QUOTA_EXCEEDED]: 'Storage quota has been exceeded',
      [PushErrorCode.STOR_UPLOAD_FAILED]: 'Failed to upload to storage',
    };
    
    return messages[this.code] || this.message;
  }

  private generateRemediation(): string | undefined {
    const remediations: Partial<Record<PushErrorCode, string>> = {
      [PushErrorCode.AUTH_REQUIRED]: 'Run "taptik auth login" to authenticate',
      [PushErrorCode.AUTH_EXPIRED]: 'Run "taptik auth login" to renew your session',
      [PushErrorCode.INSUFFICIENT_PERMISSIONS]: 'Contact your administrator for access',
      [PushErrorCode.AUTH_NOT_AUTHENTICATED]: 'Run "taptik auth login" to authenticate',
      [PushErrorCode.AUTH_INSUFFICIENT_PERMISSIONS]: 'Contact your administrator for access',
      [PushErrorCode.AUTH_SESSION_EXPIRED]: 'Run "taptik auth login" to renew your session',
      
      [PushErrorCode.PACKAGE_TOO_LARGE]: 'Try reducing the package size or contact support',
      [PushErrorCode.INVALID_PACKAGE]: 'Ensure the file is a valid .taptik package',
      [PushErrorCode.VAL_INVALID_FILE]: 'Ensure the file is valid and not corrupted',
      [PushErrorCode.VAL_FILE_TOO_LARGE]: 'Try reducing the file size or contact support',
      
      [PushErrorCode.NETWORK_TIMEOUT]: 'Check your internet connection and try again',
      [PushErrorCode.NET_TIMEOUT]: 'Check your internet connection and try again',
      [PushErrorCode.NET_CONNECTION_FAILED]: 'Check your internet connection and try again',
      [PushErrorCode.NET_RATE_LIMITED]: 'Wait a few minutes before trying again',
      [PushErrorCode.NET_SERVICE_UNAVAILABLE]: 'Service is temporarily down, try again later',
      [PushErrorCode.RATE_LIMIT_EXCEEDED]: 'Wait a few minutes before trying again',
      
      [PushErrorCode.STORAGE_QUOTA_EXCEEDED]: 'Delete unused packages or upgrade your plan',
      [PushErrorCode.STOR_QUOTA_EXCEEDED]: 'Delete unused packages or upgrade your plan',
      [PushErrorCode.UPLOAD_FAILED]: 'Try uploading again or contact support',
      [PushErrorCode.STOR_UPLOAD_FAILED]: 'Try uploading again or contact support',
      
      [PushErrorCode.SENSITIVE_DATA_DETECTED]: 'Review and remove sensitive information',
    };
    
    return remediations[this.code];
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      remediation: this.remediation,
      retryable: this.retryable,
      context: this.context,
      stack: this.stack,
    };
  }
}
