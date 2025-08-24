export interface CloudConfig {
  enabled: boolean;
  auto_upload: boolean;
  default_visibility: 'public' | 'private' | 'ask';
  auto_tags: string[];
}

export interface UploadFilters {
  exclude_patterns: string[];
  include_patterns?: string[];
  max_file_size_mb: number;
}

export interface NotificationConfig {
  upload_success: boolean;
  upload_failed: boolean;
  download_available: boolean;
}

export interface AuthenticationConfig {
  provider: 'github' | 'google' | 'email' | null;
  remember_me: boolean;
  token_cache: boolean;
}

export interface PerformanceConfig {
  parallel_uploads: boolean;
  compression_level: 'none' | 'fast' | 'balanced' | 'maximum';
  chunk_size_kb: number;
}

export interface TaptikConfig {
  cloud: CloudConfig;
  upload_filters: UploadFilters;
  notifications: NotificationConfig;
  authentication: AuthenticationConfig;
  performance: PerformanceConfig;
  [key: string]: unknown; // For custom fields
}

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SaveConfigOptions {
  backup?: boolean;
}
