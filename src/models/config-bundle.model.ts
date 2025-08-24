/**
 * Configuration Bundle Models
 * Data models and interfaces for configuration listing functionality
 */

/**
 * Core configuration bundle interface representing data from Supabase
 * Based on config_packages table structure from PRD
 */
export interface ConfigBundle {
  id: string;
  title: string; // Changed from 'name' to 'title' to match requirements
  description?: string;
  source_ide: string; // 'claude-code', 'kiro-ide', 'cursor-ide'
  target_ides: string[];
  tags: string[];
  is_public: boolean;
  file_path: string; // Storage file path
  file_size: number; // File size in bytes
  download_count: number;
  like_count: number;
  version: string;
  created_at: Date;
  updated_at: Date;
  user_id: string;
  // Additional fields for display
  author?: string;
  isLiked?: boolean;
}

/**
 * Display configuration interface for formatted CLI display
 * Optimized for table output with human-readable formats
 */
export interface DisplayConfiguration {
  id: string;
  title: string; // Changed from 'name' to 'title' to match requirements
  description?: string;
  createdAt: Date;
  size: string; // Human-readable format (e.g., "2.3MB")
  accessLevel: 'Public' | 'Private';
  author?: string;
  isLiked?: boolean;
}

/**
 * List command options interface
 * Defines available CLI options for the list command
 */
export interface ListOptions {
  filter?: string; // Filter by title
  sort?: 'date' | 'name'; // Sort criteria
  limit?: number; // Result limit (default: 20, max: 100)
}

/**
 * Extended list options for service layer
 * Includes additional options for internal service operations
 */
export interface ListConfigurationsOptions extends ListOptions {
  includePrivate?: boolean;
  userId?: string;
}

/**
 * Configuration list result interface
 * Service response format with metadata
 */
export interface ConfigurationListResult {
  configurations: DisplayConfiguration[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * Sort field type definition
 * Valid sorting options for configurations
 */
export type SortField = 'date' | 'name';

/**
 * Access level type definition
 * Configuration visibility levels
 */
export type AccessLevel = 'Public' | 'Private';

/**
 * Validation result interface
 * Used for input validation responses
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Database query filter interface
 * Used for building Supabase queries
 */
export interface QueryFilter {
  field: string;
  operator: 'eq' | 'ilike' | 'in' | 'gte' | 'lte';
  value: unknown;
}

/**
 * Database order by clause interface
 * Used for building Supabase queries
 */
export interface OrderByClause {
  field: string;
  ascending: boolean;
}

/**
 * Configuration query interface
 * Complete query structure for database operations
 */
export interface ConfigurationQuery {
  select: string;
  filters: QueryFilter[];
  orderBy: OrderByClause[];
  limit: number;
  offset?: number;
}

/**
 * Transform ConfigBundle to DisplayConfiguration
 * Converts raw database data to display-friendly format
 */
export function toDisplayConfiguration(bundle: ConfigBundle): DisplayConfiguration {
  return {
    id: bundle.id,
    title: bundle.title,
    description: bundle.description,
    createdAt: bundle.created_at,
    size: formatFileSize(bundle.file_size),
    accessLevel: bundle.is_public ? 'Public' : 'Private',
    author: bundle.author,
    isLiked: bundle.isLiked,
  };
}

/**
 * Format file size to human-readable string
 * Converts bytes to appropriate unit (B, KB, MB, GB, TB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Validate list options
 * Ensures CLI options are within acceptable ranges and formats
 */
export function validateListOptions(options: ListOptions): ValidationResult {
  const errors: string[] = [];

  // Validate sort option
  if (options.sort && !['date', 'name'].includes(options.sort)) {
    errors.push(`Invalid sort option '${options.sort}'. Valid options: date, name`);
  }

  // Validate limit option
  if (options.limit !== undefined) {
    if (options.limit <= 0) {
      errors.push('Limit must be greater than 0');
    }
    if (options.limit > 100) {
      errors.push('Limit cannot exceed 100');
    }
  }

  // Validate filter (basic sanitization)
  if (options.filter !== undefined && typeof options.filter !== 'string') {
    errors.push('Filter must be a string');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Default list options
 * Provides sensible defaults for list command
 */
export const DEFAULT_LIST_OPTIONS: Required<ListOptions> = {
  filter: '',
  sort: 'date',
  limit: 20,
};

/**
 * Maximum allowed limit for list results
 * Prevents excessive API usage and response sizes
 */
export const MAX_LIST_LIMIT = 100;

/**
 * Default limit for list results
 * Balances usability with performance
 */
export const DEFAULT_LIST_LIMIT = 20;