export enum PushErrorCode {
  // Authentication errors (3xx)
  AUTH_REQUIRED = 'AUTH_001',
  AUTH_EXPIRED = 'AUTH_002',
  INSUFFICIENT_PERMISSIONS = 'AUTH_003',

  // Validation errors (4xx)
  INVALID_PACKAGE = 'VAL_001',
  INVALID_VERSION = 'VAL_002',
  PACKAGE_TOO_LARGE = 'VAL_003',
  UNSUPPORTED_PLATFORM = 'VAL_004',

  // Security errors (5xx)
  SENSITIVE_DATA_DETECTED = 'SEC_001',
  SANITIZATION_FAILED = 'SEC_002',
  MALICIOUS_CONTENT = 'SEC_003',

  // Network/Storage errors (6xx)
  UPLOAD_FAILED = 'NET_001',
  STORAGE_QUOTA_EXCEEDED = 'NET_002',
  NETWORK_TIMEOUT = 'NET_003',

  // Rate limiting errors (7xx)
  RATE_LIMIT_EXCEEDED = 'RATE_001',
  DAILY_QUOTA_EXCEEDED = 'RATE_002',

  // System errors (8xx)
  DATABASE_ERROR = 'SYS_001',
  INTERNAL_ERROR = 'SYS_002',
  SYSTEM_ERROR = 'SYS_003',
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

export class PushError extends Error {
  constructor(
    public code: PushErrorCode,
    message: string,
    public details?: unknown,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = 'PushError';
  }
}
