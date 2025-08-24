import { ConflictStrategy, SupportedPlatform } from './deploy-options.interface';
import { DeploymentResult, DeploymentError, DeploymentWarning } from './deployment-result.interface';

/**
 * Kiro-specific deployment options
 */
export interface KiroDeploymentOptions {
  platform: Extract<SupportedPlatform, 'kiro-ide'>;
  conflictStrategy: KiroConflictStrategy;
  dryRun: boolean;
  validateOnly: boolean;
  components?: KiroComponentType[];
  skipComponents?: KiroComponentType[];
  enableLargeFileStreaming?: boolean;
  onProgress?: (progress: { current: number; total: number; percentage: number }) => void;
  
  /** Kiro-specific options */
  globalSettings?: boolean; // Deploy to ~/.kiro/settings.json
  projectSettings?: boolean; // Deploy to .kiro/settings.json
  preserveTaskStatus?: boolean; // Preserve completed task status in specs
  mergeStrategy?: KiroMergeStrategy; // How to merge configuration files
}

/**
 * Kiro component types that can be deployed
 */
export type KiroComponentType = 
  | 'settings' 
  | 'steering' 
  | 'specs' 
  | 'hooks' 
  | 'agents'
  | 'templates';

/**
 * Kiro-specific conflict resolution strategies
 */
export type KiroConflictStrategy = 
  | ConflictStrategy
  | 'merge-intelligent' // Intelligent merging based on content type
  | 'preserve-tasks'; // Preserve task completion status

/**
 * Kiro-specific merge strategies for different file types
 */
export type KiroMergeStrategy =
  | 'deep-merge' // Deep merge JSON objects
  | 'array-append' // Append arrays instead of replacing
  | 'markdown-section-merge' // Merge markdown by sections
  | 'task-status-preserve'; // Preserve task completion status

/**
 * Kiro deployment result with platform-specific information
 */
export interface KiroDeploymentResult extends DeploymentResult {
  platform: 'kiro-ide';
  kiroSpecific: {
    globalSettingsDeployed: boolean;
    projectSettingsDeployed: boolean;
    steeringDocumentsDeployed: string[];
    specsDeployed: string[];
    hooksDeployed: string[];
    agentsDeployed: string[];
    templatesDeployed: string[];
    taskStatusPreserved: number; // Number of tasks with preserved status
    configurationsMerged: KiroMergedConfiguration[];
  };
}

/**
 * Information about merged Kiro configurations
 */
export interface KiroMergedConfiguration {
  filePath: string;
  componentType: KiroComponentType;
  mergeStrategy: KiroMergeStrategy;
  conflictsResolved: number;
  originalSize: number;
  finalSize: number;
  backupPath?: string;
}

/**
 * Kiro global settings structure (deployed to ~/.kiro/settings.json)
 */
export interface KiroGlobalSettings {
  version: string;
  user: {
    profile: {
      name?: string;
      email?: string;
      experience_years?: number;
      primary_role?: string;
      secondary_roles?: string[];
      domain_knowledge?: string[];
    };
    preferences: {
      theme?: string;
      fontSize?: number;
      style?: string;
      naming_convention?: string;
      comment_style?: string;
      error_handling?: string;
      testing_approach?: string;
    };
    communication: {
      explanation_level?: string;
      code_review_tone?: string;
      preferred_language?: string;
    };
    tech_stack: {
      languages?: string[];
      frameworks?: string[];
      databases?: string[];
      cloud?: string[];
    };
  };
  ide: {
    default_project_template?: string;
    auto_save?: boolean;
    backup_frequency?: string;
    extensions?: string[];
  };
  agents?: KiroAgentConfiguration[];
  templates?: KiroTemplateConfiguration[];
}

/**
 * Kiro project settings structure (deployed to .kiro/settings.json)
 */
export interface KiroProjectSettings {
  version: string;
  project: {
    info: {
      name?: string;
      type?: string;
      domain?: string;
      team_size?: number;
    };
    architecture: {
      pattern?: string;
      database_pattern?: string;
      api_style?: string;
      auth_method?: string;
    };
    tech_stack: {
      runtime?: string;
      language?: string;
      framework?: string;
      database?: string;
      orm?: string;
      testing?: string[];
      deployment?: string;
    };
    conventions: {
      file_naming?: string;
      folder_structure?: string;
      commit_convention?: string;
      branch_strategy?: string;
    };
    constraints: {
      performance_requirements?: string;
      security_level?: string;
      compliance?: string[];
    };
  };
  steering_documents?: string[];
  specs?: string[];
  hooks?: KiroHookConfiguration[];
}

/**
 * Kiro steering document structure
 */
export interface KiroSteeringDocument {
  name: string;
  category: string;
  content: string;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  applies_to?: string[]; // File patterns or project areas
  created_at: string;
  updated_at?: string;
}

/**
 * Kiro specification document structure
 */
export interface KiroSpecDocument {
  name: string;
  type: 'feature' | 'bug' | 'enhancement' | 'refactor' | 'docs';
  status: 'draft' | 'active' | 'completed' | 'archived';
  content: string;
  tasks?: KiroTask[];
  dependencies?: string[];
  created_at: string;
  updated_at?: string;
}

/**
 * Kiro task structure within specifications
 */
export interface KiroTask {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority?: 'low' | 'medium' | 'high';
  assignee?: string;
  estimated_time?: string;
  dependencies?: string[];
  requirements?: string[];
  created_at: string;
  completed_at?: string;
}

/**
 * Kiro hook configuration
 */
export interface KiroHookConfiguration {
  name: string;
  type: 'pre-commit' | 'post-commit' | 'file-save' | 'session-start' | 'custom';
  trigger: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  description?: string;
  conditions?: KiroHookCondition[];
}

/**
 * Kiro hook execution conditions
 */
export interface KiroHookCondition {
  type: 'file_pattern' | 'branch' | 'time' | 'custom';
  value: string;
  operator?: 'equals' | 'contains' | 'matches' | 'not_equals';
}

/**
 * Kiro agent configuration
 */
export interface KiroAgentConfiguration {
  name: string;
  description: string;
  category: string;
  prompt: string;
  capabilities?: string[];
  constraints?: string[];
  examples?: KiroAgentExample[];
  metadata?: {
    author?: string;
    version?: string;
    created_at?: string;
    updated_at?: string;
  };
}

/**
 * Kiro agent usage examples
 */
export interface KiroAgentExample {
  name: string;
  input: string;
  expected_output?: string;
  use_case: string;
}

/**
 * Kiro template configuration
 */
export interface KiroTemplateConfiguration {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  variables: KiroTemplateVariable[];
  tags?: string[];
  metadata?: {
    author?: string;
    version?: string;
    created_at?: string;
    updated_at?: string;
  };
}

/**
 * Kiro template variable definition
 */
export interface KiroTemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  default?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  required?: boolean;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    enum?: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
}

/**
 * Kiro validation result
 */
export interface KiroValidationResult {
  isValid: boolean;
  component: KiroComponentType;
  errors: DeploymentError[];
  warnings: DeploymentWarning[];
  suggestions?: string[];
}

/**
 * Kiro configuration paths
 */
export interface KiroConfigurationPaths {
  globalSettings: string; // ~/.kiro/settings.json
  projectSettings: string; // .kiro/settings.json
  steeringDirectory: string; // .kiro/steering/
  specsDirectory: string; // .kiro/specs/
  hooksDirectory: string; // .kiro/hooks/
  agentsDirectory: string; // ~/.kiro/agents/
  templatesDirectory: string; // ~/.kiro/templates/
}

/**
 * Kiro deployment context
 */
export interface KiroDeploymentContext {
  homeDirectory: string;
  projectDirectory: string;
  paths: KiroConfigurationPaths;
  existingConfiguration?: {
    globalSettings?: KiroGlobalSettings;
    projectSettings?: KiroProjectSettings;
    steeringDocuments?: KiroSteeringDocument[];
    specs?: KiroSpecDocument[];
    hooks?: KiroHookConfiguration[];
    agents?: KiroAgentConfiguration[];
    templates?: KiroTemplateConfiguration[];
  };
}