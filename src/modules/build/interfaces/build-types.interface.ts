/**
 * Build module specific types and interfaces
 * Defines types for services, components, and data structures
 */

// ============================================================================
// Performance and Caching Types
// ============================================================================

/**
 * Performance metrics for build operations
 */
export interface PerformanceMetrics {
  processingTime: number;
  memoryUsage: number;
  fileSize: number;
  itemsProcessed: number;
}

/**
 * Cache entry with TTL support
 */
export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
}

/**
 * Schema definition for VS Code settings validation
 */
export interface VSCodeSchemaDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  min?: number;
  max?: number;
  enum?: string[];
  items?: VSCodeSchemaDefinition;
  properties?: Record<string, VSCodeSchemaDefinition>;
}

/**
 * Schema validation result
 */
export interface SchemaValidationResult {
  isValid: boolean;
  errors: Array<{
    code: string;
    message: string;
    field: string;
    severity: 'error' | 'warning';
  }>;
  warnings: Array<{
    code: string;
    message: string;
    field: string;
    suggestion?: string;
    severity: 'warning' | 'info';
  }>;
}

// ============================================================================
// Extension and Platform Types
// ============================================================================

/**
 * Extension information structure
 */
export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  publisher: string;
  description?: string;
  categories?: string[];
  configuration?: Record<string, unknown>;
}

/**
 * Extension compatibility info
 */
export interface ExtensionCompatibilityInfo {
  compatible: boolean;
  alternative?: string;
  reason?: string;
  category?: string;
}

/**
 * Memory usage report
 */
export interface MemoryReport {
  rss: string;
  heapTotal: string;
  heapUsed: string;
  external: string;
  cacheSize: number;
}

// ============================================================================
// Search and Cloud Integration Types
// ============================================================================

/**
 * Search metadata for cloud features
 */
export interface SearchMetadata {
  title: string;
  description: string;
  tags: string[];
  categories: string[];
  keywords: string[];
  technologies: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  primaryLanguage: string | null;
  popularity?: number;
}

/**
 * Deployment metadata
 */
export interface DeploymentMetadata {
  targetPlatforms?: string[];
  platforms?: string[];
  compatibility: {
    vscode: boolean;
    cursor: boolean;
    claudeCode: boolean;
  } | Array<{ platform: string; version: string; supported: boolean; }>;
  requirements: {
    minVersion?: string;
    extensions?: string[];
    settings?: string[];
    features?: string[];
  };
  installation?: {
    difficulty: 'easy' | 'medium' | 'hard';
    estimatedTime: number; // minutes
    requirements: string[];
  };
}

/**
 * Cloud metadata for cursor configurations
 */
export interface CursorCloudMetadata {
  platform: 'cursor-ide';
  version: string;
  compatibility: {
    vsCode: boolean;
    vscodeVersion?: string;
    cursorFeatures: string[];
  };
  features: {
    ai: boolean;
    extensions: number;
    snippets: number;
    themes: string[];
    languages: string[];
  };
  tags: string[];
  categories: string[];
  searchTerms: string[];
}

/**
 * Anonymized metadata for privacy
 */
export interface AnonymizedMetadata {
  hash: string;
  features: string[];
  usagePatterns: {
    extensionCount: number;
    settingsCount: number;
    keyboardShortcuts: number;
    hasCustomTheme: boolean;
  };
  preferences: {
    editorStyle: string;
    workflowType: string;
    collaborationLevel: string;
  };
  compatibility: {
    platforms: string[];
    versions: string[];
  };
}

// ============================================================================
// Security and Filtering Types
// ============================================================================

/**
 * Security pattern definition
 */
export interface SecurityPattern {
  pattern: RegExp;
  type: string; // Allow any string type for flexibility
  severity: 'critical' | 'warning' | 'info' | 'high' | 'medium' | 'low';
  category?: string;
  description?: string;
  replacement?: string;
}

/**
 * Filtering statistics
 */
export interface FilteringStats {
  totalFields: number;
  filteredFields: number;
  securityIssues: {
    critical: number;
    warning: number;
    info: number;
  };
  categories: {
    apiKeys: number;
    tokens: number;
    passwords: number;
    other: number;
  };
}

/**
 * Security analysis details
 */
export interface SecurityAnalysisDetails {
  patterns: Array<{
    type: string;
    matches: number;
    fields: string[];
    severity: string;
  }>;
  recommendations: string[];
  complianceStatus: {
    gdpr: boolean;
    sox: boolean;
    pci: boolean;
  };
}

// ============================================================================
// Validation and Error Types
// ============================================================================

/**
 * Validation context for different scenarios
 */
export interface ValidationContext {
  strict: boolean;
  platform: 'cursor' | 'vscode' | 'claude-code';
  includeWarnings: boolean;
  securityLevel: 'permissive' | 'standard' | 'strict';
}

/**
 * Configuration analysis result
 */
export interface ConfigurationAnalysis {
  complexity: 'simple' | 'moderate' | 'complex';
  categories: string[];
  estimatedSetupTime: number; // minutes
  requiredKnowledge: string[];
  potentialIssues: Array<{
    type: 'compatibility' | 'security' | 'performance';
    description: string;
    severity: 'low' | 'medium' | 'high';
    resolution?: string;
  }>;
}

// ============================================================================
// Generic Utility Types
// ============================================================================

/**
 * Generic configuration object
 */
export interface GenericConfig extends Record<string, unknown> {
  version?: string;
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Processing result with metadata
 */
export interface ProcessingResult<T = unknown> {
  success: boolean;
  data?: T;
  errors: string[];
  warnings: string[];
  metadata: {
    processingTime: number;
    itemsProcessed: number;
    memoryUsed: number;
  };
}

/**
 * Batch processing options
 */
export interface BatchProcessingOptions {
  batchSize: number;
  maxConcurrency: number;
  progressCallback?: (processed: number, total: number) => void;
  errorHandling: 'fail-fast' | 'continue' | 'retry';
}

/**
 * File processing info
 */
export interface FileProcessingInfo {
  path: string;
  size: number;
  type: string;
  processed: boolean;
  errors?: string[];
  warnings?: string[];
}

// ============================================================================
// Service Method Types
// ============================================================================

/**
 * Processor function type for batch operations
 */
export type ProcessorFunction<T, R> = (item: T) => Promise<R>;

/**
 * Validator function type
 */
export type ValidatorFunction<T> = (item: T) => Promise<boolean>;

/**
 * Transformer function type
 */
export type TransformerFunction<T, R> = (input: T) => Promise<R>;

/**
 * Filter predicate type
 */
export type FilterPredicate<T> = (item: T) => boolean;

/**
 * Lazy loader function type
 */
export type LazyLoader<T> = () => Promise<T>;

// ============================================================================
// Privacy and Metadata Types
// ============================================================================

/**
 * Usage patterns extracted from configuration data
 */
export interface UsagePatterns {
  extensionCount: number;
  snippetLanguages: number;
  aiRulesCount: number;
  settingsCategories: string[];
}

/**
 * User preferences extracted from configuration
 */
export interface UserPreferences {
  themeType?: 'dark' | 'light';
  fontSizeRange?: 'small' | 'medium' | 'large';
  aiModelType?: 'configured' | 'unconfigured';
  [key: string]: unknown;
}

/**
 * Privacy opt-out mechanism structure
 */
export interface PrivacyOptOut {
  analytics: {
    enabled: boolean;
    level: 'none' | 'minimal' | 'standard' | 'full';
  };
  tracking: {
    enabled: boolean;
    categories: string[];
  };
  sharing: {
    metadata: boolean;
    usage: boolean;
    errors: boolean;
  };
}

/**
 * Settings data structure for various IDE platforms
 */
export interface SettingsData extends GenericConfig {
  settings?: Record<string, unknown>;
  aiConfiguration?: {
    enabled?: boolean;
    defaultModel?: string;
    rules?: Array<{
      name: string;
      pattern: string;
      prompt: string;
      enabled?: boolean;
    }>;
  };
  extensions?: Array<{
    id: string;
    name?: string;
    version?: string;
    enabled?: boolean;
  }>;
  snippets?: Record<string, Record<string, {
    prefix: string;
    body: string | string[];
    description?: string;
  }>>;
  platform?: string;
  version?: string;
}

/**
 * Cloud readiness validation result
 */
export interface CloudReadinessResult {
  ready: boolean;
  issues: string[];
  warnings: string[];
}

// ============================================================================
// Test Utility Types
// ============================================================================

/**
 * Mock service structure
 */
export interface MockService<T = unknown> {
  [key: string]: T | (() => unknown);
}

/**
 * Test data factory options
 */
export interface TestDataOptions {
  includeOptional?: boolean;
  randomize?: boolean;
  seed?: number;
}

/**
 * Test execution context
 */
export interface TestExecutionContext {
  mockFileSystem: boolean;
  mockServices: string[];
  timeout?: number;
  retries?: number;
}