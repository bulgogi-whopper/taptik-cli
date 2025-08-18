export const DEPLOYMENT_DEFAULTS = {
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
  RETRY_MAX_DELAY: 30000, // 30 seconds
  REQUEST_TIMEOUT: 60000, // 60 seconds
  CACHE_TTL: 300000, // 5 minutes
  MAX_CONCURRENT_OPERATIONS: 5,
  BACKUP_RETENTION_DAYS: 30,
  PROGRESS_UPDATE_INTERVAL: 500, // 500ms
};

export const FILE_OPERATION_DEFAULTS = {
  LARGE_FILE_THRESHOLD: 10 * 1024 * 1024, // 10MB
  CHUNK_SIZE: 64 * 1024, // 64KB
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  ENCODING: 'utf8' as const,
};

export const PERFORMANCE_CONFIG = {
  PARALLEL_DEPLOYMENT: {
    ENABLED: true,
    MAX_CONCURRENCY: 5,
    COMPONENTS: ['agents', 'commands', 'settings'] as const,
  },
  CACHING: {
    ENABLED: true,
    TTL: 300000, // 5 minutes
    MAX_SIZE: 100, // Maximum cache entries
  },
  STREAMING: {
    ENABLED: true,
    THRESHOLD: 10 * 1024 * 1024, // 10MB
  },
};

export const DEPLOYMENT_STAGES = [
  'import',
  'validation',
  'security-scan',
  'backup',
  'deployment',
  'verification',
] as const;

export type DeploymentStage = (typeof DEPLOYMENT_STAGES)[number];

export const CONFLICT_STRATEGIES = {
  SKIP: 'skip',
  OVERWRITE: 'overwrite',
  MERGE: 'merge',
  BACKUP: 'backup',
} as const;

export const COMPONENT_PRIORITIES = {
  settings: 1,
  project: 2,
  agents: 3,
  commands: 4,
} as const;

export const DEFAULT_BACKUP_DIR = '~/.claude/.backups';
export const DEFAULT_CONFLICT_STRATEGY = CONFLICT_STRATEGIES.BACKUP;
