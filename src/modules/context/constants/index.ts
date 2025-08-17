/**
 * Central export point for all context module constants
 */

// Platform-specific constants
export * from './platforms.constants';

// Security-related constants
export * from './security.constants';

// Cloud and API constants
export * from './cloud.constants';

// Validation constants
export * from './validation.constants';

// Note: export-format.constants.ts is deprecated
// Use the new modular constants instead


/**
 * Composite constants that combine multiple domains
 */
export const CONTEXT_DEFAULTS = {
  VERSION: '1.0.0',
  ENCODING: 'utf8',
  FILE_EXTENSION: '.taptik',
  MIME_TYPE: 'application/json',
  DEFAULT_PLATFORM: 'claude-code' as const,
  DEFAULT_VISIBILITY: 'private' as const,
  DEFAULT_TIER: 'free' as const,
} as const;

/**
 * Feature flags for conditional functionality
 */
export const FEATURE_FLAGS = {
  ENABLE_ENCRYPTION: true,
  ENABLE_COMPRESSION: true,
  ENABLE_CLOUD_SYNC: true,
  ENABLE_AUTO_BACKUP: false,
  ENABLE_TEAM_SHARING: false,
  ENABLE_ANALYTICS: true,
  ENABLE_WEBSOCKET: false,
  ENABLE_OFFLINE_MODE: true,
  ENABLE_BETA_FEATURES: false,
} as const;

/**
 * System limits and thresholds
 */
export const SYSTEM_LIMITS = {
  MAX_CONCURRENT_UPLOADS: 3,
  MAX_RETRY_ATTEMPTS: 3,
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
  REFRESH_TOKEN_EXPIRY: 30 * 24 * 60 * 60 * 1000, // 30 days
  CACHE_CLEANUP_INTERVAL: 60 * 60 * 1000, // 1 hour
  HEALTH_CHECK_INTERVAL: 5 * 60 * 1000, // 5 minutes
} as const;