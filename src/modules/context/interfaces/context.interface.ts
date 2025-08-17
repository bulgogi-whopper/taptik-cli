export interface TaptikContext {
  version: string;
  metadata: ContextMetadata;
  inheritance?: InheritanceConfig;
  personal?: PersonalContext;
  project?: ProjectContext;
  prompts?: PromptContext;
  tools?: ToolContext;
  ide?: IdeContext;
}

export interface ContextMetadata {
  id?: string;
  name: string;
  description?: string;
  author?: string;
  created?: string;
  created_at?: string;
  modified?: string;
  updated_at?: string;
  tags?: string[];
  platforms?: AIPlatform[];
  platform?: AIPlatform;
  checksum?: string;
  is_private?: boolean;
  team_id?: string;
  conversion?: {
    source: AIPlatform;
    target: AIPlatform;
    timestamp: string;
  };
}

export interface InheritanceConfig {
  extends?: string[];
  priority?: string;
  merge_strategy?: MergeStrategy;
  override_rules?: {
    arrays?: ArrayMergeStrategy;
    objects?: 'merge' | 'replace';
  };
}

export interface PersonalContext {
  category?: 'personal';
  spec_version?: string;
  data?: PersonalData;
}

export interface PersonalData {
  developer_profile?: DeveloperProfile;
  coding_preferences?: CodingPreferences;
  domain_knowledge?: string[];
  communication_style?: CommunicationStyle;
}

export interface DeveloperProfile {
  experience_years?: number;
  primary_role?: DeveloperRole;
  secondary_roles?: DeveloperRole[];
  tech_stack?: TechStack;
}

export interface TechStack {
  languages?: string[];
  frameworks?: string[];
  databases?: string[];
  cloud?: string[];
  tools?: string[];
}

export interface CodingPreferences {
  style?: string;
  naming_convention?: NamingConvention;
  comment_style?: string;
  error_handling?: string;
  testing_approach?: TestingApproach;
}

export interface CommunicationStyle {
  explanation_level?: ExplanationLevel;
  code_review_tone?: string;
  preferred_language?: string;
}

export interface ProjectContext {
  category?: 'project';
  spec_version?: string;
  data?: ProjectData;
}

export interface ProjectData {
  project_name?: string;
  project_info?: ProjectInfo;
  architecture?: Architecture;
  tech_stack?: ProjectTechStack;
  conventions?: Conventions;
  constraints?: Constraints;
  // Platform-specific fields
  kiro_specs?: Record<string, unknown>[];
  claude_instructions?: string;
}

export interface ProjectInfo {
  name: string;
  type?: string;
  domain?: string;
  team_size?: number;
  repository?: string;
  documentation?: string;
}

export interface Architecture {
  pattern?: string;
  cli_framework?: string;
  database_pattern?: string;
  api_style?: 'rest' | 'graphql' | 'grpc';
  auth_method?: string;
}

export interface ProjectTechStack {
  runtime?: string;
  language?: string;
  framework?: string;
  database?: string;
  orm?: string;
  testing?: string[];
  package_manager?: PackageManager;
  deployment?: string;
}

export interface Conventions {
  file_naming?: string;
  folder_structure?: string;
  commit_convention?: string;
  branch_strategy?: string;
  code_style?: string;
}

export interface Constraints {
  node_version?: string;
  typescript_version?: string;
  performance_requirements?: string;
  security_level?: SecurityLevel;
  compliance?: string[];
  test_coverage?: TestCoverage;
}

export interface TestCoverage {
  lines?: number;
  statements?: number;
  branches?: number;
  functions?: number;
}

export interface PromptContext {
  category?: 'prompts';
  spec_version?: string;
  data?: PromptData;
}

export interface PromptData {
  system_prompts?: string[];
  custom_instructions?: string[];
  templates?: Record<string, PromptTemplate>;
  snippets?: Record<string, string>;
  libraries?: PromptLibrary[];
}

export interface PromptTemplate {
  name: string;
  prompt: string;
  variables: string[];
  use_cases?: string[];
  tags?: string[];
  examples?: PromptExample[];
  platform_mappings?: Record<AIPlatform, unknown>;
}

export interface PromptExample {
  input: Record<string, unknown>;
  expected_output?: string;
}

export interface PromptLibrary {
  id: string;
  name: string;
  prompts: PromptTemplate[];
  version: string;
  platform_mappings?: Map<AIPlatform, unknown>;
}

export interface ToolContext {
  category?: 'tools';
  spec_version?: string;
  data?: ToolData;
}

export interface ToolData {
  mcp_servers?: McpServer[];
  custom_commands?: CustomCommand[];
  aliases?: Record<string, string>;
  scripts?: Record<string, string>;
}

export interface McpServer {
  name: string;
  version: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
}

export interface CustomCommand {
  name: string;
  command: string;
  description?: string;
  category?: string;
  platforms?: Platform[];
}

export interface IdeContext {
  category?: 'ide';
  spec_version?: string;
  data?: IdeData;
}

export interface IdeData {
  kiro?: KiroConfig;
  claude_code?: ClaudeCodeConfig;
  // Future platforms
  cursor?: Record<string, unknown>;
  windsurf?: Record<string, unknown>;
  cody?: Record<string, unknown>;
}

export interface KiroConfig {
  specs_path?: string;
  steering_rules?: SteeringRule[] | Record<string, unknown>[];
  hooks?: Hook[];
  task_templates?: TaskTemplate[];
  project_settings?: KiroProjectSettings;
  mcp_settings?: Record<string, unknown>;
}

export interface SteeringRule {
  name: string;
  description?: string;
  rules: string[];
  priority?: number;
}

export interface Hook {
  name: string;
  enabled: boolean;
  description?: string;
  version: string;
  when: HookTrigger;
  then: HookAction;
}

export interface HookTrigger {
  type: string;
  patterns?: string[];
}

export interface HookAction {
  type: string;
  prompt?: string;
  command?: string;
}

export interface TaskTemplate {
  name: string;
  description?: string;
  tasks: string[];
}

export interface KiroProjectSettings {
  specification_driven?: boolean;
  auto_test?: boolean;
  incremental_progress?: boolean;
  task_confirmation?: boolean;
}

export interface ClaudeCodeConfig {
  settings?: ClaudeCodeSettings;
  mcp?: {
    servers?: string[];
    config?: Record<string, unknown>;
  };
  mcp_servers?: Record<string, unknown>[];
  commands?: Record<string, string> | Record<string, unknown>[];
  claude_md?: string;
  claude_local_md?: string;
}

export interface ClaudeCodeSettings {
  apiKeyHelper?: string;
  permissions?: {
    webSearch?: boolean;
    mdFiles?: boolean;
    jsonFiles?: boolean;
    envFiles?: boolean;
    [key: string]: boolean | undefined;
  };
  env?: Record<string, string>;
  [key: string]: unknown;
}

// Enums
export enum AIPlatform {
  KIRO = 'kiro',
  CLAUDE_CODE = 'claude-code',
  CURSOR = 'cursor',
  WINDSURF = 'windsurf',
  CODY = 'cody',
}

export enum DeveloperRole {
  FRONTEND = 'frontend',
  BACKEND = 'backend',
  FULLSTACK = 'fullstack',
  DEVOPS = 'devops',
  MOBILE = 'mobile',
  DATA = 'data',
  ARCHITECTURE = 'architecture',
  SECURITY = 'security',
}

export enum NamingConvention {
  CAMEL_CASE = 'camelCase',
  SNAKE_CASE = 'snake_case',
  PASCAL_CASE = 'PascalCase',
  KEBAB_CASE = 'kebab-case',
}

export enum TestingApproach {
  TDD = 'tdd',
  BDD = 'bdd',
  UNIT_FIRST = 'unit_first',
  INTEGRATION_FIRST = 'integration_first',
}

export enum ExplanationLevel {
  JUNIOR = 'junior',
  MID = 'mid',
  SENIOR = 'senior',
  EXPERT = 'expert',
}

export enum PackageManager {
  NPM = 'npm',
  YARN = 'yarn',
  PNPM = 'pnpm',
  BUN = 'bun',
}

export enum SecurityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum MergeStrategy {
  DEEP = 'deep',
  SHALLOW = 'shallow',
  REPLACE = 'replace',
}

export enum ArrayMergeStrategy {
  MERGE = 'merge',
  REPLACE = 'replace',
  APPEND = 'append',
}

export enum Platform {
  DARWIN = 'darwin',
  LINUX = 'linux',
  WIN32 = 'win32',
}

// Type Guards
export function isPersonalContext(object: unknown): object is PersonalContext {
  const object_ = object as Record<string, unknown> | null | undefined;
  return (
    object_?.category === 'personal' && typeof object_?.spec_version === 'string'
  );
}

export function isProjectContext(object: unknown): object is ProjectContext {
  const object_ = object as Record<string, unknown> | null | undefined;
  return (
    object_?.category === 'project' && typeof object_?.spec_version === 'string'
  );
}

export function isPromptContext(object: unknown): object is PromptContext {
  const object_ = object as Record<string, unknown> | null | undefined;
  return (
    object_?.category === 'prompts' && typeof object_?.spec_version === 'string'
  );
}

export function isToolContext(object: unknown): object is ToolContext {
  const object_ = object as Record<string, unknown> | null | undefined;
  return (
    object_?.category === 'tools' && typeof object_?.spec_version === 'string'
  );
}

export function isIdeContext(object: unknown): object is IdeContext {
  const object_ = object as Record<string, unknown> | null | undefined;
  return object_?.category === 'ide' && typeof object_?.spec_version === 'string';
}

export function isTaptikContext(object: unknown): object is TaptikContext {
  const object_ = object as Record<string, unknown> | null | undefined;
  if (!object_ || typeof object_ !== 'object') return false;
  
  const metadata = object_.metadata as Record<string, unknown> | null | undefined;
  return (
    typeof object_.version === 'string' &&
    typeof metadata === 'object' &&
    metadata !== null &&
    typeof metadata.name === 'string'
  );
}
