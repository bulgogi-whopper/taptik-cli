/**
 * Complete collection of settings data from both local and global sources
 */
export interface SettingsData {
  /** Settings from the current project's .kiro directory */
  localSettings: LocalSettings;
  /** Settings from the user's global ~/.kiro directory */
  globalSettings: GlobalSettings;
  /** Metadata about the collection process */
  collectionMetadata: CollectionMetadata;
}

/**
 * Settings collected from the project's local .kiro directory
 */
export interface LocalSettings {
  /** Content of .kiro/settings/context.md file */
  contextMd?: string;
  /** Content of .kiro/settings/user-preferences.md file */
  userPreferencesMd?: string;
  /** Content of .kiro/settings/project-spec.md file */
  projectSpecMd?: string;
  /** All .md files from .kiro/steering/ directory */
  steeringFiles: SteeringFile[];
  /** All .kiro.hook files from .kiro/hooks/ directory */
  hooks: HookFile[];
}

/**
 * Settings collected from the user's global ~/.kiro directory
 */
export interface GlobalSettings {
  /** User's global configuration file content */
  userConfig?: string;
  /** Global prompt templates available to all projects */
  globalPrompts: PromptTemplate[];
  /** User's global preferences */
  preferences?: string;
}

/**
 * Represents a steering file from the .kiro/steering directory
 */
export interface SteeringFile {
  /** Name of the file without path */
  filename: string;
  /** Raw content of the file */
  content: string;
  /** Full path to the file */
  path: string;
}

/**
 * Represents a hook file from the .kiro/hooks directory
 */
export interface HookFile {
  /** Name of the file without path */
  filename: string;
  /** Raw content of the hook file */
  content: string;
  /** Full path to the file */
  path: string;
  /** Type of hook (e.g., 'commit', 'save', etc.) */
  type: string;
}

/**
 * Represents a prompt template
 */
export interface PromptTemplate {
  /** Display name of the template */
  name: string;
  /** Template content with possible variables */
  content: string;
  /** Additional metadata about the template */
  metadata?: Record<string, any>;
}

/**
 * Metadata about the settings collection process
 */
export interface CollectionMetadata {
  /** Platform that generated this data (e.g., 'kiro') */
  sourcePlatform: string;
  /** ISO timestamp when collection occurred */
  collectionTimestamp: string;
  /** Path to the project directory that was scanned */
  projectPath: string;
  /** Path to the global directory that was scanned */
  globalPath: string;
  /** Non-critical issues encountered during collection */
  warnings: string[];
  /** Critical errors encountered during collection */
  errors: string[];
}