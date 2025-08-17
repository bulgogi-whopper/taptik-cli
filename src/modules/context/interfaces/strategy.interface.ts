import type {
  AIPlatform,
  ClaudeCodeSettings,
  TaptikContext,
} from './context.interface';

export interface IContextBuilderStrategy {
  platform: AIPlatform;

  /**
   * Detect if this platform is available in the current environment
   */
  detect(path?: string): Promise<boolean>;

  /**
   * Extract platform-specific configuration
   */
  extract(path?: string): Promise<unknown>;

  /**
   * Normalize platform-specific context to universal format
   */
  normalize(data: unknown): Promise<TaptikContext>;

  /**
   * Validate the normalized context
   */
  validate(data: unknown): Promise<ValidationResult>;

  /**
   * Build complete context from platform (extract + normalize + validate)
   */
  build(path?: string): Promise<TaptikContext>;

  /**
   * Convert universal context back to platform format
   */
  convert?(context: TaptikContext): Promise<ConversionResult>;
}

export interface IContextConverterStrategy {
  sourcePlatform: AIPlatform;
  targetPlatform: AIPlatform;

  /**
   * Check if conversion is supported between platforms
   */
  canConvert(): boolean;

  /**
   * Convert context from source to target platform
   */
  convert(context: TaptikContext): Promise<ConversionResult>;

  /**
   * Validate compatibility between platforms
   */
  validateCompatibility(context: TaptikContext): Promise<CompatibilityReport>;

  /**
   * Get feature mapping between platforms
   */
  getFeatureMapping(): FeatureMapping;
}

export interface IContextDeployerStrategy {
  platform: AIPlatform;

  /**
   * Deploy context to target platform
   */
  deploy(
    context: TaptikContext,
    targetPath: string,
    options?: DeployOptions,
  ): Promise<DeploymentResult>;

  /**
   * Create backup before deployment
   */
  createBackup(): Promise<BackupInfo>;

  /**
   * Restore from backup
   */
  restoreBackup(backupId: string): Promise<void>;

  /**
   * Validate deployment
   */
  validateDeployment(context: TaptikContext): Promise<ValidationResult>;
}

// Platform-specific context types
export type PlatformSpecificContext = KiroContext | ClaudeCodeContext;

export interface KiroExtractedData {
  specs?: Record<string, unknown>[];
  steeringRules?: Record<string, unknown>[];
  hooks?: Record<string, unknown>[];
  mcpSettings?: Record<string, unknown>;
  taskTemplates?: Record<string, unknown>[];
  projectSettings?: Record<string, unknown>;
}

export interface KiroContext {
  specs?: KiroSpecs;
  steering?: SteeringRules;
  hooks?: HookConfig[];
  settings?: KiroSettings;
}

export interface KiroSpecs {
  features: FeatureSpec[];
  path: string;
}

export interface FeatureSpec {
  name: string;
  design?: string;
  requirements?: string;
  tasks?: string;
}

export interface SteeringRules {
  rules: Array<{
    file: string;
    content: string;
  }>;
}

export interface HookConfig {
  file: string;
  config: Record<string, unknown>;
}

export interface KiroSettings {
  projectSettings?: Record<string, unknown>;
  globalSettings?: Record<string, unknown>;
}

export interface ClaudeCodeContext {
  settings?: ClaudeCodeSettings;
  mcpServers?: McpServerConfig[];
  commands?: CustomCommandConfig[];
  claudeMd?: string;
  permissions?: PermissionConfig;
}

export interface McpServerConfig {
  name: string;
  version: string;
  config: Record<string, unknown>;
  source: 'global' | 'project';
}

export interface CustomCommandConfig {
  name: string;
  command: string;
  description?: string;
  source: 'global' | 'project';
}

export interface PermissionConfig {
  webSearch?: boolean;
  mdFiles?: boolean;
  jsonFiles?: boolean;
  envFiles?: boolean;
  [key: string]: boolean | undefined;
}

// Operation results
export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  code?: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}

// Unified type for validation issues (errors and warnings)
export type ValidationIssue = ValidationError | ValidationWarning;

export interface ConversionResult {
  success: boolean;
  context?: TaptikContext;
  data?: unknown;
  error?: string;
  errors?: string[];
  warnings?: string[];
  unsupported_features?: string[];
  approximations?: FeatureApproximation[];
}

export interface FeatureApproximation {
  source_feature: string;
  target_approximation: string;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
}

export interface CompatibilityReport {
  compatible: boolean;
  score: number; // 0-100
  supported_features: string[];
  unsupported_features: string[];
  partial_support: Array<{
    feature: string;
    support_level: number; // 0-100
    notes?: string;
  }>;
}

export interface FeatureMapping {
  direct_mappings: Map<string, string>;
  approximations: Map<string, FeatureApproximation>;
  unsupported: string[];
}

export interface DeploymentResult {
  success: boolean;
  deployed_items: DeployedItem[];
  errors?: DeploymentError[];
  warnings?: string[];
  rollback_available: boolean;
  backup_id?: string;
}

export interface DeployedItem {
  type: 'file' | 'setting' | 'command' | 'hook';
  path: string;
  status: 'created' | 'updated' | 'skipped';
  previous_value?: unknown;
  new_value?: unknown;
}

export interface DeploymentError {
  item: string;
  error: string;
  recoverable: boolean;
}

export interface BackupInfo {
  id: string;
  platform: AIPlatform;
  created_at: string;
  items: BackupItem[];
  size: number;
}

export interface BackupItem {
  path: string;
  content: string | unknown;
  type: 'file' | 'setting';
}

// Options
export interface BuildOptions {
  excludeSensitive?: boolean;
  includeOnly?: string[];
  exclude?: string[];
  validate?: boolean;
  output?: string;
}

export interface DeployOptions {
  backup?: boolean;
  force?: boolean;
  dry_run?: boolean;
  merge_strategy?: 'overwrite' | 'merge' | 'prompt';
  target_scope?: 'global' | 'project' | 'both';
}

// Bundle types for storage
export interface ContextBundle {
  version: string;
  created_at: string;
  contexts: TaptikContext[];
  metadata?: BundleMetadata;
}

export interface BundleMetadata {
  id?: string;
  name?: string;
  description?: string;
  author?: string;
  checksum?: string;
  compressed?: boolean;
  encryption?: {
    algorithm?: string;
    key_id?: string;
  };
}
