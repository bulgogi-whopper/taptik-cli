/**
 * Taptik-compliant personal context format
 * Contains user preferences, work style, and communication settings
 */
export interface TaptikPersonalContext {
  /** Unique identifier for the user */
  user_id: string;
  /** User's development preferences and settings */
  preferences: UserPreferences;
  /** User's preferred work style and approaches */
  work_style: WorkStyle;
  /** Communication preferences and styles */
  communication: Communication;
  /** Metadata about this personal context */
  metadata: PersonalMetadata;
}

/**
 * User's development preferences and technical choices
 */
export interface UserPreferences {
  /** Programming languages the user prefers to work with */
  preferred_languages: string[];
  /** Code formatting and style preferences */
  coding_style: CodingStyle;
  /** Preferred development tools and frameworks */
  tools_and_frameworks: string[];
  /** Development environment setup preferences */
  development_environment: string[];
}

/**
 * Code style and formatting preferences
 */
export interface CodingStyle {
  /** Preferred indentation style (e.g., '2 spaces', '4 spaces', 'tabs') */
  indentation: string;
  /** Naming convention preference (e.g., 'camelCase', 'snake_case') */
  naming_convention: string;
  /** Comment style preference (e.g., 'minimal', 'detailed', 'JSDoc') */
  comment_style: string;
  /** Code organization approach (e.g., 'feature-based', 'layer-based') */
  code_organization: string;
}

/**
 * Work style and problem-solving approaches
 */
export interface WorkStyle {
  /** Preferred development workflow (e.g., 'TDD', 'agile', 'waterfall') */
  preferred_workflow: string;
  /** Problem-solving methodology (e.g., 'incremental', 'holistic') */
  problem_solving_approach: string;
  /** Preferred level of documentation (e.g., 'minimal', 'comprehensive') */
  documentation_level: string;
  /** Testing approach preference (e.g., 'unit-first', 'integration-heavy') */
  testing_approach: string;
}

/**
 * Communication preferences and feedback styles
 */
export interface Communication {
  /** How the user prefers explanations (e.g., 'concise', 'detailed', 'visual') */
  preferred_explanation_style: string;
  /** Preferred level of technical detail (e.g., 'beginner', 'intermediate', 'expert') */
  technical_depth: string;
  /** How the user prefers to receive feedback (e.g., 'direct', 'collaborative') */
  feedback_style: string;
}

/**
 * Metadata for personal context
 */
export interface PersonalMetadata {
  /** Platform that generated this context (e.g., 'kiro') */
  source_platform: string;
  /** ISO timestamp when this context was created */
  created_at: string;
  /** Version of the taptik format */
  version: string;
}

/**
 * Taptik-compliant project context format
 * Contains project information, technical stack, and development guidelines
 */
export interface TaptikProjectContext {
  /** Unique identifier for the project */
  project_id: string;
  /** Basic project information */
  project_info: ProjectInfo;
  /** Technical stack and architecture details */
  technical_stack: TechnicalStack;
  /** Development guidelines and standards */
  development_guidelines: DevelopmentGuidelines;
  /** Metadata about this project context */
  metadata: ProjectMetadata;
}

/**
 * Basic project information and details
 */
export interface ProjectInfo {
  /** Project name */
  name: string;
  /** Project description */
  description: string;
  /** Current project version */
  version: string;
  /** Repository URL or identifier */
  repository: string;
}

/**
 * Technical stack information for the project
 */
export interface TechnicalStack {
  /** Primary programming language */
  primary_language: string;
  /** Frameworks and libraries used */
  frameworks: string[];
  /** Database systems used */
  databases: string[];
  /** Development and build tools */
  tools: string[];
  /** Deployment platforms and tools */
  deployment: string[];
}

/**
 * Development guidelines and standards for the project
 */
export interface DevelopmentGuidelines {
  /** Coding standards and conventions */
  coding_standards: string[];
  /** Testing requirements and approaches */
  testing_requirements: string[];
  /** Documentation standards */
  documentation_standards: string[];
  /** Code review process guidelines */
  review_process: string[];
}

/**
 * Metadata for project context
 */
export interface ProjectMetadata {
  /** Platform that generated this context (e.g., 'kiro') */
  source_platform: string;
  /** Path to the source project */
  source_path: string;
  /** ISO timestamp when this context was created */
  created_at: string;
  /** Version of the taptik format */
  version: string;
}

/**
 * Taptik-compliant prompt templates format
 * Contains a collection of reusable prompt templates
 */
export interface TaptikPromptTemplates {
  /** Array of prompt template entries */
  templates: PromptTemplateEntry[];
  /** Metadata about the template collection */
  metadata: PromptMetadata;
}

/**
 * Individual prompt template entry
 */
export interface PromptTemplateEntry {
  /** Unique identifier for the template */
  id: string;
  /** Display name of the template */
  name: string;
  /** Description of what the template does */
  description: string;
  /** Category or type of the template */
  category: string;
  /** Template content with possible variables */
  content: string;
  /** Variables that can be substituted in the template */
  variables: string[];
  /** Tags for organizing and searching templates */
  tags: string[];
}

/**
 * Metadata for prompt templates collection
 */
export interface PromptMetadata {
  /** Platform that generated these templates (e.g., 'kiro') */
  source_platform: string;
  /** ISO timestamp when templates were collected */
  created_at: string;
  /** Version of the taptik format */
  version: string;
  /** Total number of templates in the collection */
  total_templates: number;
}

/**
 * Taptik build manifest file
 * Contains metadata about a completed build
 */
export interface TaptikManifest {
  /** Unique identifier for this build */
  build_id: string;
  /** Platform that performed the build (e.g., 'kiro') */
  source_platform: string;
  /** Categories included in this build */
  categories: string[];
  /** ISO timestamp when build was created */
  created_at: string;
  /** Version of taptik format used */
  taptik_version: string;
  /** Source files that were processed */
  source_files: SourceFile[];
  /** Output files that were generated */
  output_files: OutputFile[];
}

/**
 * Information about a source file that was processed
 */
export interface SourceFile {
  /** Path to the source file */
  path: string;
  /** Type of file (e.g., 'markdown', 'hook', 'config') */
  type: string;
  /** File size in bytes */
  size: number;
  /** ISO timestamp of last modification */
  last_modified: string;
}

/**
 * Information about a generated output file
 */
export interface OutputFile {
  /** Name of the generated file */
  filename: string;
  /** Category this file represents */
  category: string;
  /** File size in bytes */
  size: number;
}
