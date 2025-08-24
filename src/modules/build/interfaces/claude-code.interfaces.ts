/**
 * Claude Code interfaces and data structures
 * Defines all types for Claude Code configuration and cloud integration
 */

// ============================================================================
// Core Claude Code Configuration Interfaces
// ============================================================================

export interface ClaudeCodeSettings {
  theme?: string;
  fontSize?: number;
  keyboardShortcuts?: Record<string, string>;
  extensions?: string[];
  preferences?: Record<string, unknown>;
}

export interface ClaudeAgent {
  name: string;
  description: string;
  instructions: string;
  tools?: string[];
  metadata?: Record<string, unknown>;
}

export interface ClaudeCommand {
  name: string;
  description: string;
  command: string;
  args?: string[];
  metadata?: Record<string, unknown>;
}

export interface McpServerConfig {
  mcpServers: Record<string, McpServer>;
}

export interface McpServer {
  command: string;
  args: string[];
  env?: Record<string, string>;
  disabled?: boolean;
  autoApprove?: string[];
}

// ============================================================================
// Collection Data Interfaces
// ============================================================================

export interface ClaudeCodeLocalSettingsData {
  settings?: ClaudeCodeSettings;
  claudeMd?: string;
  claudeLocalMd?: string;
  steeringFiles: Array<{
    filename: string;
    content: string;
    path: string;
  }>;
  agents: Array<{
    filename: string;
    content: string;
    path: string;
    parsed?: ClaudeAgent;
  }>;
  commands: Array<{
    filename: string;
    content: string;
    path: string;
    parsed?: ClaudeCommand;
  }>;
  hooks: Array<{
    filename: string;
    content: string;
    path: string;
  }>;
  mcpConfig?: McpServerConfig;
  sourcePath: string;
  collectedAt: string;
}

export interface ClaudeCodeGlobalSettingsData {
  settings?: ClaudeCodeSettings;
  agents: Array<{
    filename: string;
    content: string;
    path: string;
    parsed?: ClaudeAgent;
  }>;
  commands: Array<{
    filename: string;
    content: string;
    path: string;
    parsed?: ClaudeCommand;
  }>;
  mcpConfig?: McpServerConfig;
  sourcePath: string;
  collectedAt: string;
  securityFiltered: boolean;
}

// ============================================================================
// Cloud-Oriented Interfaces
// ============================================================================

export interface CloudMetadata {
  title: string;
  description: string;
  tags: string[];
  source_ide: 'claude-code' | 'kiro' | 'cursor';
  target_ides: string[];
  component_summary: ComponentSummary;
  schema_version: string;
  version_info: VersionInfo;
  search_keywords: string[];
  auto_generated_tags: string[];
}

export interface ComponentSummary {
  agents: number;
  commands: number;
  steering_rules: number;
  mcp_servers: string[];
  settings_categories: string[];
  estimated_size: number;
}

export interface VersionInfo {
  schema_version: string;
  source_version: string;
  build_version: string;
  compatibility: string[];
}

// ============================================================================
// Sanitization Interfaces
// ============================================================================

export interface SanitizationResult {
  sanitizedData: Record<string, unknown>;
  removedItems: SanitizedItem[];
  securityLevel: 'safe' | 'warning' | 'blocked';
  sanitizationReport: SanitizationReport;
}

export interface SanitizedItem {
  type: 'api_key' | 'token' | 'password' | 'url' | 'email' | 'path';
  location: string;
  originalValue?: string;
  reason: string;
}

export interface SanitizationReport {
  totalItemsProcessed: number;
  itemsRemoved: number;
  securityIssuesFound: SanitizedItem[];
  recommendations: string[];
}

export interface SanitizationRule {
  pattern: RegExp;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  replacement?: string;
  action: 'remove' | 'mask' | 'warn';
}

// ============================================================================
// Package Interfaces
// ============================================================================

export interface TaptikPackage {
  manifest: PackageManifest;
  files: PackageFile[];
  checksums: Record<string, string>;
  metadata: CloudMetadata;
}

export interface PackageManifest {
  package_id: string;
  name: string;
  version: string;
  created_at: string;
  source_platform: string;
  files: PackageFileInfo[];
  dependencies: string[];
  cloud_metadata: CloudMetadata;
  sanitization_info: SanitizationSummary;
}

export interface PackageFile {
  filename: string;
  content: string | Buffer;
  type: 'json' | 'markdown' | 'binary';
  size: number;
  checksum: string;
}

export interface PackageFileInfo {
  path: string;
  size: number;
  checksum: string;
  type: string;
}

export interface SanitizationSummary {
  items_removed: number;
  security_level: string;
  safe_for_sharing: boolean;
  sanitization_timestamp: string;
}

// ============================================================================
// Validation Interfaces
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationWarning[];
  cloudCompatibility: CloudCompatibilityCheck;
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'warning';
}

export interface CloudCompatibilityCheck {
  canUpload: boolean;
  estimatedUploadSize: number;
  supportedFeatures: string[];
  unsupportedFeatures: string[];
  recommendations: string[];
}

// ============================================================================
// Transformation Interfaces
// ============================================================================

export interface TransformationResult {
  personal?: TransformedPersonalContext;
  project?: TransformedProjectContext;
  prompts?: TransformedPromptTemplates;
  merged?: MergedConfiguration;
  errors?: TransformationError[];
}

export interface TransformedPersonalContext {
  settings: ClaudeCodeSettings;
  globalAgents: ClaudeAgent[];
  globalCommands: ClaudeCommand[];
  timestamp: string;
}

export interface TransformedProjectContext {
  projectSettings: ClaudeCodeSettings;
  projectAgents: ClaudeAgent[];
  projectCommands: ClaudeCommand[];
  steeringRules: SteeringRule[];
  hooks: Hook[];
  timestamp: string;
}

export interface TransformedPromptTemplates {
  agents: AgentTemplate[];
  commands: CommandTemplate[];
  instructions: InstructionTemplate[];
  timestamp: string;
}

export interface MergedConfiguration {
  settings: ClaudeCodeSettings;
  agents: ClaudeAgent[];
  commands: ClaudeCommand[];
  mcpServers: McpServerConfig;
  instructions: string;
  timestamp: string;
}

export interface SteeringRule {
  name: string;
  content: string;
  priority: number;
  category: string;
}

export interface Hook {
  name: string;
  type: 'pre' | 'post';
  script: string;
  trigger: string;
}

export interface AgentTemplate {
  id: string;
  name: string;
  template: string;
  variables: Record<string, string>;
}

export interface CommandTemplate {
  id: string;
  name: string;
  template: string;
  parameters: Record<string, unknown>;
}

export interface InstructionTemplate {
  id: string;
  type: 'claude_md' | 'claude_local_md' | 'steering';
  content: string;
  priority: number;
}

export interface TransformationError {
  source: string;
  error: string;
  recoverable: boolean;
  suggestion?: string;
}

// ============================================================================
// Service Error Interfaces
// ============================================================================

export type ClaudeCodeErrorType =
  | 'CLAUDE_NOT_FOUND'
  | 'INVALID_MCP_CONFIG'
  | 'MALFORMED_AGENT'
  | 'MALFORMED_COMMAND'
  | 'PERMISSION_DENIED'
  | 'INVALID_SETTINGS_JSON'
  | 'INVALID_JSON'
  | 'MISSING_REQUIRED_FIELD';

export interface ClaudeCodeError {
  type: ClaudeCodeErrorType;
  message: string;
  filePath?: string;
  lineNumber?: number;
  suggestedResolution?: string;
  severity?: 'critical' | 'error' | 'warning';
  code?: string;
  details?: Record<string, unknown>;
  recoverable?: boolean;
  suggestions?: string[];
}

export type ErrorRecoveryStrategy =
  | 'CONTINUE_WITH_EMPTY'
  | 'SKIP_INVALID_FILES'
  | 'RETRY_WITH_TIMEOUT'
  | 'USE_DEFAULTS'
  | 'PROMPT_USER'
  | 'ABORT';

export interface ErrorAggregationReport {
  totalErrors: number;
  criticalErrors: number;
  warnings: number;
  errorsByType?: Record<string, number>;
  errorsByCategory?: Record<string, number>;
  affectedFiles?: string[];
  recommendedActions?: string[];
  canContinue?: boolean;
}

export interface CollectionError extends ClaudeCodeError {
  path?: string;
  fileType?: string;
}

export interface SanitizationError extends ClaudeCodeError {
  sensitiveDataFound?: boolean;
  blockedItems?: string[];
}

export interface ValidationError extends ClaudeCodeError {
  validationErrors?: Array<{
    field: string;
    message: string;
  }>;
}

export interface PackageError extends ClaudeCodeError {
  packageId?: string;
  operation?: string;
}

// ============================================================================
// Platform Integration Interfaces
// ============================================================================

export enum BuildPlatform {
  KIRO = 'kiro',
  CLAUDE_CODE = 'claude-code',
  CURSOR = 'cursor',
  UNKNOWN = 'unknown',
}

export interface PlatformCapabilities {
  platform: BuildPlatform;
  features: string[];
  limitations: string[];
  version: string;
}

export interface PlatformDetectionResult {
  detected: boolean;
  platform?: BuildPlatform;
  confidence: number;
  indicators: string[];
}

// ============================================================================
// Progress and Status Interfaces
// ============================================================================

export interface BuildProgress {
  phase: BuildPhase;
  step: string;
  progress: number;
  message: string;
  details?: Record<string, unknown>;
}

export enum BuildPhase {
  INITIALIZATION = 'initialization',
  COLLECTION = 'collection',
  TRANSFORMATION = 'transformation',
  SANITIZATION = 'sanitization',
  METADATA_GENERATION = 'metadata_generation',
  PACKAGE_CREATION = 'package_creation',
  VALIDATION = 'validation',
  OUTPUT = 'output',
  COMPLETION = 'completion',
}

export interface BuildResult {
  success: boolean;
  platform: BuildPlatform;
  outputPath?: string;
  packagePath?: string;
  metadata?: CloudMetadata;
  sanitizationReport?: SanitizationReport;
  validationReport?: ValidationResult;
  errors?: ClaudeCodeError[];
  warnings?: string[];
  statistics?: BuildStatistics;
}

export interface BuildStatistics {
  filesProcessed: number;
  agentsFound: number;
  commandsFound: number;
  steeringRulesFound: number;
  mcpServersConfigured: number;
  sensitiveItemsRemoved: number;
  packageSizeBytes: number;
  processingTimeMs: number;
}

// ============================================================================
// CLI Option Interfaces
// ============================================================================

export interface ClaudeCodeBuildOptions {
  platform?: BuildPlatform;
  output?: string;
  dryRun?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  categories?: string[];
  skipSanitization?: boolean;
  skipValidation?: boolean;
  includeGlobal?: boolean;
  excludePatterns?: string[];
  autoUpload?: boolean;
  uploadConfig?: UploadConfiguration;
}

export interface UploadConfiguration {
  endpoint?: string;
  token?: string;
  public?: boolean;
  title?: string;
  description?: string;
  tags?: string[];
}

// ============================================================================
// Type Guards
// ============================================================================

export function isClaudeCodeSettings(obj: unknown): obj is ClaudeCodeSettings {
  if (!obj || typeof obj !== 'object' || obj === null) return false;
  const settings = obj as Record<string, unknown>;
  return (
    (!('theme' in settings) || typeof settings.theme === 'string') &&
    (!('fontSize' in settings) || typeof settings.fontSize === 'number')
  );
}

export function isClaudeAgent(obj: unknown): obj is ClaudeAgent {
  if (!obj || typeof obj !== 'object' || obj === null) return false;
  const agent = obj as Record<string, unknown>;
  return (
    typeof agent.name === 'string' &&
    typeof agent.description === 'string' &&
    typeof agent.instructions === 'string'
  );
}

export function isClaudeCommand(obj: unknown): obj is ClaudeCommand {
  if (!obj || typeof obj !== 'object' || obj === null) return false;
  const command = obj as Record<string, unknown>;
  return (
    typeof command.name === 'string' &&
    typeof command.description === 'string' &&
    typeof command.command === 'string'
  );
}

export function isMcpServerConfig(obj: unknown): obj is McpServerConfig {
  if (!obj || typeof obj !== 'object' || obj === null) return false;
  const config = obj as Record<string, unknown>;
  return (
    'mcpServers' in config &&
    typeof config.mcpServers === 'object' &&
    config.mcpServers !== null
  );
}

export function isSanitizationResult(obj: unknown): obj is SanitizationResult {
  if (!obj || typeof obj !== 'object' || obj === null) return false;
  const result = obj as Record<string, unknown>;
  return (
    'sanitizedData' in result &&
    Array.isArray(result.removedItems) &&
    typeof result.securityLevel === 'string' &&
    ['safe', 'warning', 'blocked'].includes(result.securityLevel)
  );
}

export function isValidationResult(obj: unknown): obj is ValidationResult {
  if (!obj || typeof obj !== 'object' || obj === null) return false;
  const result = obj as Record<string, unknown>;
  return (
    typeof result.isValid === 'boolean' &&
    Array.isArray(result.errors) &&
    Array.isArray(result.warnings)
  );
}
