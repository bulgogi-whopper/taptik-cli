/**
 * Shared constants for export/deploy format compatibility
 * These constants ensure consistent behavior across export and deploy operations
 */

export const EXPORT_FORMAT = {
  /** Current context format version */
  CURRENT_VERSION: '1.0.0',

  /** File extension for exported contexts */
  FILE_EXTENSION: '.taptik',

  /** MIME type for context files */
  MIME_TYPE: 'application/json',

  /** Default encoding for context files */
  ENCODING: 'utf8',
} as const;

export const SUPPORTED_PLATFORMS = {
  CLAUDE_CODE: 'claude-code',
  KIRO_IDE: 'kiro-ide',
  CURSOR_IDE: 'cursor-ide',
} as const;

export const CONTEXT_CATEGORIES = {
  PERSONAL: 'personal',
  PROJECT: 'project',
  PROMPTS: 'prompts',
  TOOLS: 'tools',
  IDE: 'ide',
} as const;

export const SECURITY_PATTERNS = {
  API_KEY: /(?:api[_-]?key|apikey)[\s:=]["']?([\w-]+)["']?/gi,
  SECRET: /(?:secret|password|pwd)[\s:=]["']?([\w#$%&()-+=@^]+)["']?/gi,
  TOKEN: /(?:token|auth[_-]?token)[\s:=]["']?([\w.-]+)["']?/gi,
  PRIVATE_KEY:
    /-{5}begin\s+(?:rsa\s+)?private\s+key-{5}[\S\s]*?-{5}end\s+(?:rsa\s+)?private\s+key-{5}/gi,
  ACCESS_KEY: /(?:access[_-]?key|accesskey)[\s:=]["']?([\w-]+)["']?/gi,
  DATABASE_URL:
    /(?:database[_-]?url|db[_-]?url)[\s:=]["']?((?:mongodb|mysql|postgres|postgresql):\/\/[^\s"']+)["']?/gi,
} as const;

export const CLOUD_STORAGE = {
  /** Supabase bucket name for storing contexts */
  BUCKET_NAME: 'taptik-configs',

  /** Storage paths by visibility */
  PATHS: {
    PUBLIC: 'public',
    PRIVATE: 'private',
  },

  /** File size limits */
  LIMITS: {
    FREE_USER: 50 * 1024 * 1024, // 50MB
    PREMIUM_USER: 500 * 1024 * 1024, // 500MB
  },

  /** Allowed file types for upload */
  ALLOWED_EXTENSIONS: ['.taptik', '.json'],
} as const;

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    PROFILE: '/api/auth/profile',
  },
  CONFIGS: {
    LIST: '/api/configs',
    CREATE: '/api/configs',
    GET: '/api/configs/:id',
    UPDATE: '/api/configs/:id',
    DELETE: '/api/configs/:id',
    LIKE: '/api/configs/:id/like',
    DOWNLOAD: '/api/configs/:id/download',
  },
  SEARCH: {
    CONFIGS: '/api/search',
    TRENDING: '/api/trending',
    USERS: '/api/users/:username',
  },
} as const;

export const VALIDATION_RULES = {
  /** Maximum number of tags per context */
  MAX_TAGS: 10,

  /** Maximum length for title */
  MAX_TITLE_LENGTH: 100,

  /** Maximum length for description */
  MAX_DESCRIPTION_LENGTH: 500,

  /** Required version format (semver) */
  VERSION_PATTERN: /^\d+\.\d+\.\d+$/,

  /** Valid IDE identifiers */
  VALID_IDE_IDS: Object.values(SUPPORTED_PLATFORMS),

  /** Valid context categories */
  VALID_CATEGORIES: Object.values(CONTEXT_CATEGORIES),
} as const;

export const ERROR_CODES = {
  INVALID_FORMAT: 'INVALID_FORMAT',
  UNSUPPORTED_IDE: 'UNSUPPORTED_IDE',
  SECURITY_VIOLATION: 'SECURITY_VIOLATION',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_VERSION: 'INVALID_VERSION',
  MISSING_METADATA: 'MISSING_METADATA',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
} as const;

export const SUCCESS_MESSAGES = {
  EXPORT_COMPLETE: 'Context exported successfully',
  UPLOAD_COMPLETE: 'Context uploaded to cloud',
  DOWNLOAD_COMPLETE: 'Context downloaded successfully',
  DEPLOY_COMPLETE: 'Context deployed successfully',
  VALIDATION_PASSED: 'Context validation passed',
} as const;

/**
 * Default context structure template for export operations
 */
export const DEFAULT_CONTEXT_TEMPLATE = {
  metadata: {
    version: EXPORT_FORMAT.CURRENT_VERSION,
    exportedAt: '', // Will be set at export time
    sourceIde: '',
    targetIdes: [],
    generatedBy: 'taptik-cli',
  },
  content: {
    personal: null,
    project: null,
    prompts: null,
    tools: null,
    ide: {},
  },
  security: {
    hasApiKeys: false,
    filteredFields: [],
    scanResults: {
      passed: true,
      warnings: [],
    },
  },
} as const;

/**
 * Cloud metadata template for deploy operations
 */
export const DEFAULT_CLOUD_METADATA = {
  configId: '', // Will be generated
  storagePath: '', // Will be determined by visibility
  isPublic: false,
  uploadedBy: '', // Will be set from auth
  uploadedAt: '', // Will be set at upload time
  stats: {
    downloadCount: 0,
    likeCount: 0,
  },
} as const;
