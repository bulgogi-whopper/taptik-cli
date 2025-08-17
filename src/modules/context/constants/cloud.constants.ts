/**
 * Cloud storage and API-related constants
 */

export enum CloudProvider {
  SUPABASE = 'supabase',
  AWS_S3 = 'aws-s3',
  GOOGLE_CLOUD = 'google-cloud',
  AZURE = 'azure',
}

export enum StorageVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  TEAM = 'team',
  ORGANIZATION = 'organization',
}

export enum UploadStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum ConfigSortBy {
  POPULARITY = 'popularity',
  RECENT = 'recent',
  DOWNLOADS = 'downloads',
  LIKES = 'likes',
  ALPHABETICAL = 'alphabetical',
}

export enum UserTier {
  FREE = 'free',
  PREMIUM = 'premium',
  TEAM = 'team',
  ENTERPRISE = 'enterprise',
}

/**
 * Supabase-specific configuration
 */
export const SUPABASE_CONFIG = {
  BUCKET: {
    NAME: 'taptik-configs',
    MAX_FILE_SIZE: {
      [UserTier.FREE]: 50 * 1024 * 1024, // 50MB
      [UserTier.PREMIUM]: 500 * 1024 * 1024, // 500MB
      [UserTier.TEAM]: 1024 * 1024 * 1024, // 1GB
      [UserTier.ENTERPRISE]: 5 * 1024 * 1024 * 1024, // 5GB
    },
  },
  STORAGE_PATHS: {
    [StorageVisibility.PUBLIC]: 'public',
    [StorageVisibility.PRIVATE]: 'private',
    [StorageVisibility.TEAM]: 'team',
    [StorageVisibility.ORGANIZATION]: 'organization',
  },
  TABLES: {
    PROFILES: 'profiles',
    CONFIG_PACKAGES: 'config_packages',
    CONFIG_LIKES: 'config_likes',
    CONFIG_DOWNLOADS: 'config_downloads',
    CONFIG_COMMENTS: 'config_comments',
    USER_FOLLOWERS: 'user_followers',
    TEAM_MEMBERS: 'team_members',
  },
  RLS_POLICIES: {
    PUBLIC_READ: 'public_read',
    OWNER_WRITE: 'owner_write',
    TEAM_ACCESS: 'team_access',
    AUTHENTICATED_READ: 'authenticated_read',
  },
} as const;

/**
 * API endpoints configuration
 */
export const API_ENDPOINTS = {
  BASE_URL: process.env.API_BASE_URL || 'https://api.taptik.dev',
  VERSION: 'v1',
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    PROFILE: '/auth/profile',
    VERIFY_EMAIL: '/auth/verify-email',
    RESET_PASSWORD: '/auth/reset-password',
  },
  CONFIGS: {
    LIST: '/configs',
    CREATE: '/configs',
    GET: '/configs/:id',
    UPDATE: '/configs/:id',
    DELETE: '/configs/:id',
    LIKE: '/configs/:id/like',
    UNLIKE: '/configs/:id/unlike',
    DOWNLOAD: '/configs/:id/download',
    FORK: '/configs/:id/fork',
    REPORT: '/configs/:id/report',
  },
  SEARCH: {
    CONFIGS: '/search/configs',
    USERS: '/search/users',
    TAGS: '/search/tags',
    TRENDING: '/search/trending',
    FEATURED: '/search/featured',
    RECOMMENDATIONS: '/search/recommendations',
  },
  USERS: {
    PROFILE: '/users/:username',
    CONFIGS: '/users/:username/configs',
    FOLLOWERS: '/users/:username/followers',
    FOLLOWING: '/users/:username/following',
    FOLLOW: '/users/:username/follow',
    UNFOLLOW: '/users/:username/unfollow',
  },
  TEAMS: {
    LIST: '/teams',
    CREATE: '/teams',
    GET: '/teams/:id',
    UPDATE: '/teams/:id',
    DELETE: '/teams/:id',
    MEMBERS: '/teams/:id/members',
    INVITE: '/teams/:id/invite',
    CONFIGS: '/teams/:id/configs',
  },
  ADMIN: {
    DASHBOARD: '/admin/dashboard',
    USERS: '/admin/users',
    CONFIGS: '/admin/configs',
    REPORTS: '/admin/reports',
    ANALYTICS: '/admin/analytics',
  },
} as const;

/**
 * API rate limiting configuration
 */
export const API_RATE_LIMITS = {
  [UserTier.FREE]: {
    requests_per_hour: 100,
    uploads_per_day: 5,
    downloads_per_day: 20,
    storage_quota: 100 * 1024 * 1024, // 100MB total
  },
  [UserTier.PREMIUM]: {
    requests_per_hour: 1000,
    uploads_per_day: 50,
    downloads_per_day: 200,
    storage_quota: 10 * 1024 * 1024 * 1024, // 10GB total
  },
  [UserTier.TEAM]: {
    requests_per_hour: 5000,
    uploads_per_day: 200,
    downloads_per_day: 1000,
    storage_quota: 100 * 1024 * 1024 * 1024, // 100GB total
  },
  [UserTier.ENTERPRISE]: {
    requests_per_hour: -1, // Unlimited
    uploads_per_day: -1,
    downloads_per_day: -1,
    storage_quota: -1,
  },
} as const;

/**
 * File upload configuration
 */
export const UPLOAD_CONFIG = {
  ALLOWED_EXTENSIONS: ['.taptik', '.json', '.yaml', '.yml'],
  ALLOWED_MIME_TYPES: [
    'application/json',
    'application/x-yaml',
    'text/yaml',
    'text/x-yaml',
    'application/yaml',
  ],
  CHUNK_SIZE: 1024 * 1024, // 1MB chunks for large files
  CONCURRENT_CHUNKS: 3,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
  COMPRESSION: {
    enabled: true,
    algorithm: 'gzip',
    level: 6,
  },
} as const;

/**
 * Cache configuration
 */
export const CACHE_CONFIG = {
  TTL: {
    CONFIG_LIST: 5 * 60, // 5 minutes
    CONFIG_DETAIL: 10 * 60, // 10 minutes
    USER_PROFILE: 15 * 60, // 15 minutes
    TRENDING: 30 * 60, // 30 minutes
    SEARCH_RESULTS: 2 * 60, // 2 minutes
  },
  MAX_SIZE: {
    MEMORY: 50 * 1024 * 1024, // 50MB in memory
    DISK: 500 * 1024 * 1024, // 500MB on disk
  },
  KEYS: {
    CONFIG: 'config:',
    USER: 'user:',
    SEARCH: 'search:',
    TRENDING: 'trending:',
    FEATURED: 'featured:',
  },
} as const;

/**
 * WebSocket events for real-time features
 */
export enum WebSocketEvent {
  // Config events
  CONFIG_CREATED = 'config:created',
  CONFIG_UPDATED = 'config:updated',
  CONFIG_DELETED = 'config:deleted',
  CONFIG_LIKED = 'config:liked',
  CONFIG_DOWNLOADED = 'config:downloaded',
  
  // User events
  USER_ONLINE = 'user:online',
  USER_OFFLINE = 'user:offline',
  USER_FOLLOWED = 'user:followed',
  USER_UNFOLLOWED = 'user:unfollowed',
  
  // Notification events
  NOTIFICATION_NEW = 'notification:new',
  NOTIFICATION_READ = 'notification:read',
  
  // System events
  SYSTEM_MAINTENANCE = 'system:maintenance',
  SYSTEM_UPDATE = 'system:update',
}

/**
 * Helper functions for cloud operations
 */
export function getStoragePath(
  visibility: StorageVisibility,
  platform: string,
  configId: string
): string {
  return `${SUPABASE_CONFIG.STORAGE_PATHS[visibility]}/${platform}/${configId}.taptik`;
}

export function getMaxFileSize(tier: UserTier): number {
  return SUPABASE_CONFIG.BUCKET.MAX_FILE_SIZE[tier];
}

export function buildApiUrl(endpoint: string, parameters?: Record<string, string>): string {
  let url = `${API_ENDPOINTS.BASE_URL}/${API_ENDPOINTS.VERSION}${endpoint}`;
  
  if (parameters) {
    Object.entries(parameters).forEach(([key, value]) => {
      url = url.replace(`:${key}`, value);
    });
  }
  
  return url;
}

export function isAllowedFileType(filename: string): boolean {
  return UPLOAD_CONFIG.ALLOWED_EXTENSIONS.some(extension => 
    filename.toLowerCase().endsWith(extension)
  );
}

export function getCacheTTL(cacheType: keyof typeof CACHE_CONFIG.TTL): number {
  return CACHE_CONFIG.TTL[cacheType] || 60; // Default 1 minute
}
