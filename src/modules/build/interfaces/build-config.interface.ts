/**
 * Configuration for a taptik build process
 */
export interface BuildConfig {
  /** Target platform for the build (currently only 'kiro' is supported) */
  platform: 'kiro' | 'cursor' | 'claude-code';
  /** Categories of data to include in the build */
  categories: BuildCategory[];
  /** Directory where build output will be generated */
  outputDirectory: string;
  /** ISO timestamp when the build was initiated */
  timestamp: string;
  /** Unique identifier for this build */
  buildId: string;
}

/**
 * Represents a category of data that can be included in a build
 */
export interface BuildCategory {
  /** Type of context data */
  name: 'personal-context' | 'project-context' | 'prompt-templates';
  /** Whether this category should be included in the build */
  enabled: boolean;
}

/**
 * Options that control build behavior
 */
export interface BuildOptions {
  /** Timeout in milliseconds for interactive prompts (default: 30000) */
  interactiveTimeout: number;
  /** How to handle conflicts when output directory exists */
  conflictResolution: 'increment' | 'overwrite' | 'skip';
}