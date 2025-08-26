/**
 * Cursor IDE interfaces and type definitions
 * Defines the data structures for Cursor IDE configuration collection and transformation
 */

// ============================================================================
// Core Settings Interfaces
// ============================================================================

/**
 * VS Code compatible settings structure
 * Represents the settings.json file format
 */
export interface VSCodeSettings {
  // Editor settings
  'editor.fontSize'?: number;
  'editor.fontFamily'?: string;
  'editor.tabSize'?: number;
  'editor.insertSpaces'?: boolean;
  'editor.wordWrap'?: 'off' | 'on' | 'wordWrapColumn' | 'bounded';
  'editor.lineNumbers'?: 'off' | 'on' | 'relative' | 'interval';
  'editor.renderWhitespace'?: 'none' | 'boundary' | 'selection' | 'trailing' | 'all';
  'editor.minimap.enabled'?: boolean;
  'editor.formatOnSave'?: boolean;
  'editor.formatOnPaste'?: boolean;
  'editor.suggestSelection'?: 'first' | 'recentlyUsed' | 'recentlyUsedByPrefix';

  // Workbench settings
  'workbench.colorTheme'?: string;
  'workbench.iconTheme'?: string;
  'workbench.startupEditor'?: 'none' | 'welcomePage' | 'readme' | 'newUntitledFile' | 'welcomePageInEmptyWorkbench';
  'workbench.activityBar.visible'?: boolean;
  'workbench.sideBar.location'?: 'left' | 'right';

  // Files settings
  'files.autoSave'?: 'off' | 'afterDelay' | 'onFocusChange' | 'onWindowChange';
  'files.autoSaveDelay'?: number;
  'files.exclude'?: Record<string, boolean>;
  'files.watcherExclude'?: Record<string, boolean>;
  'files.encoding'?: string;
  'files.trimTrailingWhitespace'?: boolean;
  'files.insertFinalNewline'?: boolean;

  // Terminal settings
  'terminal.integrated.fontSize'?: number;
  'terminal.integrated.fontFamily'?: string;
  'terminal.integrated.shell.windows'?: string;
  'terminal.integrated.shell.osx'?: string;
  'terminal.integrated.shell.linux'?: string;

  // Cursor-specific settings
  'cursor.aiProvider'?: 'openai' | 'anthropic' | 'azure' | 'custom';
  'cursor.aiModel'?: string;
  'cursor.temperature'?: number;
  'cursor.maxTokens'?: number;
  'cursor.apiEndpoint'?: string;
  'cursor.apiKey'?: string; // Will be filtered during sanitization

  // Additional settings can be added dynamically
  [key: string]: unknown;
}

/**
 * Cursor-specific extension format
 */
export interface CursorExtension {
  id: string;
  name?: string;
  publisher?: string;
  version?: string;
  enabled?: boolean;
  configuration?: Record<string, unknown>;
}

/**
 * Code snippet structure
 */
export interface CursorSnippet {
  prefix: string;
  body: string | string[];
  description?: string;
  scope?: string;
}

/**
 * Keybinding configuration
 */
export interface CursorKeybinding {
  key: string;
  command: string;
  when?: string;
  args?: unknown;
}

/**
 * Main Cursor settings data structure
 * Represents all collected settings from a Cursor IDE installation
 */
export interface CursorSettingsData {
  // Core settings
  settings?: VSCodeSettings;
  
  // Extensions and snippets
  extensions?: {
    recommendations?: string[];
    unwantedRecommendations?: string[];
    installed?: CursorExtension[];
  };
  
  snippets?: Record<string, Record<string, CursorSnippet>>;
  keybindings?: CursorKeybinding[];
  
  // Workspace configuration
  workspace?: {
    folders?: Array<{
      path: string;
      name?: string;
    }>;
    settings?: VSCodeSettings;
    launch?: LaunchConfiguration;
    tasks?: TaskConfiguration;
  };
  
  // Metadata
  sourcePath: string;
  collectedAt: string;
  isGlobal: boolean;
  
  // Compatibility info
  compatibility?: CompatibilityInfo;
}

/**
 * Compatibility information for VS Code features
 */
export interface CompatibilityInfo {
  vsCodeVersion?: string;
  cursorVersion?: string;
  compatibleExtensions: string[];
  incompatibleExtensions: string[];
  warnings: string[];
}

// ============================================================================
// AI Configuration Interfaces
// ============================================================================

/**
 * AI model configuration
 */
export interface AiModelConfig {
  provider: 'openai' | 'anthropic' | 'azure' | 'custom';
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
}

/**
 * Cursor AI rule definition
 */
export interface CursorAiRule {
  name: string;
  pattern: string;
  prompt: string;
  enabled?: boolean;
  context?: 'file' | 'selection' | 'workspace';
  variables?: Record<string, string>;
  apiKey?: string; // Will be filtered during sanitization
}

/**
 * Cursor prompt template
 */
export interface CursorPromptTemplate {
  id: string;
  name: string;
  description?: string;
  prompt: string;
  variables?: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'selection';
    defaultValue?: unknown;
  }>;
  tags?: string[];
}

/**
 * Complete Cursor AI configuration
 */
export interface CursorAiConfiguration {
  version: string;
  
  // AI model settings
  modelConfig?: AiModelConfig;
  
  // AI rules
  rules?: CursorAiRule[];
  
  // Global prompts
  globalPrompts?: Record<string, string>;
  
  // Prompt templates
  templates?: CursorPromptTemplate[];
  
  // Security settings
  security?: {
    allowPublicCodeSuggestions?: boolean;
    enableTelemetry?: boolean;
    filterSensitiveData?: boolean;
  };
  
  // Copilot integration
  copilot?: {
    enable?: boolean;
    inlineSuggest?: {
      enable?: boolean;
      delay?: number;
    };
    publicCodeSuggestions?: 'allow' | 'block';
    editor?: {
      enableAutoCompletions?: boolean;
    };
  };
  
  // Sensitive data that will be filtered
  apiKeys?: Record<string, string>;
  tokens?: Record<string, string>;
  credentials?: Record<string, unknown>;
}

// ============================================================================
// Workspace and Project Interfaces
// ============================================================================

/**
 * Multi-root workspace configuration
 * Represents the structure of .code-workspace or .cursor-workspace files
 */
export interface CursorWorkspaceConfig {
  folders: Array<{
    path: string;
    name?: string;
  }>;
  settings?: VSCodeSettings;
  launch?: LaunchConfiguration;
  tasks?: TaskConfiguration;
  extensions?: {
    recommendations?: string[];
    unwantedRecommendations?: string[];
  };
  remoteAuthority?: string;
}

/**
 * Launch configuration for debugging
 */
export interface LaunchConfiguration {
  version: string;
  configurations: Array<{
    type: string;
    request: string;
    name: string;
    program?: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
    [key: string]: unknown;
  }>;
  compounds?: Array<{
    name: string;
    configurations: string[];
  }>;
}

/**
 * Task configuration
 */
export interface TaskConfiguration {
  version: string;
  tasks: Array<{
    label: string;
    type: string;
    command?: string;
    args?: string[];
    group?: string | {
      kind: string;
      isDefault?: boolean;
    };
    problemMatcher?: string | string[] | Record<string, unknown>;
    [key: string]: unknown;
  }>;
}

// ============================================================================
// Collection Result Interfaces
// ============================================================================

/**
 * Result of collecting Cursor local settings
 */
export interface CursorLocalSettingsData extends CursorSettingsData {
  projectPath: string;
  workspaceType: 'single' | 'multi-root' | 'none';
  projectAiRules?: CursorAiConfiguration;
  workspaceConfig?: CursorWorkspaceConfig;
}

/**
 * Result of collecting Cursor global settings
 */
export interface CursorGlobalSettingsData extends CursorSettingsData {
  userHome: string;
  globalAiRules?: CursorAiConfiguration;
  globalExtensions?: CursorExtension[];
}

// ============================================================================
// Validation and Security Interfaces
// ============================================================================

/**
 * Validation result for Cursor configurations
 */
export interface CursorValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  securityReport?: SecurityReport;
  compatibilityReport?: CompatibilityReport;
}

/**
 * Validation error details
 */
export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  file?: string;
  line?: number;
  severity: 'error' | 'critical';
}

/**
 * Validation warning details
 */
export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
  suggestion?: string;
  severity: 'warning' | 'info';
}

/**
 * Security report for AI configurations
 */
export interface SecurityReport {
  hasApiKeys: boolean;
  hasTokens: boolean;
  hasSensitiveData: boolean;
  filteredFields: string[];
  securityLevel: 'safe' | 'warning' | 'unsafe';
  recommendations: string[];
}

/**
 * Compatibility report for VS Code features
 */
export interface CompatibilityReport {
  vsCodeCompatible: boolean;
  incompatibleSettings: string[];
  incompatibleExtensions: string[];
  alternativeExtensions: Record<string, string>;
  migrationSuggestions: string[];
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base error class for Cursor-related errors
 */
export class CursorError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'CursorError';
    Object.setPrototypeOf(this, CursorError.prototype);
  }
}

/**
 * Error for Cursor configuration issues
 */
export class CursorConfigurationError extends CursorError {
  constructor(
    message: string,
    public file?: string,
    public field?: string,
    details?: unknown,
  ) {
    super(message, 'CURSOR_CONFIG_ERROR', details);
    this.name = 'CursorConfigurationError';
    Object.setPrototypeOf(this, CursorConfigurationError.prototype);
  }
}

/**
 * Error for security filtering issues
 */
export class SecurityFilteringError extends CursorError {
  constructor(
    message: string,
    public filteredData: string[],
    public securityLevel: 'warning' | 'critical',
  ) {
    super(message, 'SECURITY_FILTERING_ERROR', { filteredData, securityLevel });
    this.name = 'SecurityFilteringError';
    Object.setPrototypeOf(this, SecurityFilteringError.prototype);
  }
}

/**
 * Error for VS Code compatibility issues
 */
export class VSCodeCompatibilityError extends CursorError {
  constructor(
    message: string,
    public incompatibleFeatures: string[],
    public suggestions?: string[],
  ) {
    super(message, 'VSCODE_COMPATIBILITY_ERROR', { incompatibleFeatures, suggestions });
    this.name = 'VSCodeCompatibilityError';
    Object.setPrototypeOf(this, VSCodeCompatibilityError.prototype);
  }
}

// ============================================================================
// Transformation Result Interfaces
// ============================================================================

/**
 * Result of transforming Cursor settings to Taptik format
 */
export interface CursorTransformationResult {
  personalContext?: unknown; // Will be TaptikPersonalContext
  projectContext?: unknown; // Will be TaptikProjectContext
  promptTemplates?: unknown; // Will be TaptikPromptTemplates
  metadata: {
    source: 'cursor';
    transformedAt: string;
    warnings: string[];
    securityFiltered: boolean;
  };
}

// ============================================================================
// Platform Integration
// ============================================================================

/**
 * Cursor platform identifier for build system
 */
export enum CursorPlatform {
  CURSOR = 'cursor',
  CURSOR_IDE = 'cursor-ide',
}

/**
 * Cursor build options
 */
export interface CursorBuildOptions {
  platform: CursorPlatform;
  includeAiConfig: boolean;
  filterSensitiveData: boolean;
  validateVSCodeCompat: boolean;
  categories?: ('personal' | 'project' | 'prompts')[];
}