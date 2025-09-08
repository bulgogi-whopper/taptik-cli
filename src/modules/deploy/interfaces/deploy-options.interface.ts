import { ComponentType, SupportedPlatform } from './component-types.interface';

// Re-export types for backward compatibility
export { ComponentType, SupportedPlatform };

export type ConflictStrategy =
  | 'skip'
  | 'overwrite'
  | 'merge'
  | 'backup'
  | 'prompt';

export interface DeployCommandOptions {
  platform?: SupportedPlatform;
  dryRun?: boolean;
  validate?: boolean;
  diff?: boolean;
  force?: boolean;
  only?: ComponentType[];
  skip?: ComponentType[];
  conflict?: ConflictStrategy;
  backupDir?: string;
}

export interface DeploymentOptions {
  platform: SupportedPlatform;
  components: ComponentType[];
  conflictStrategy: ConflictStrategy;
  backupDir: string;
  dryRun: boolean;
  force?: boolean;
}

export interface DeployOptions {
  platform: SupportedPlatform;
  conflictStrategy: ConflictStrategy;
  dryRun: boolean;
  validateOnly: boolean;
  components?: ComponentType[];
  skipComponents?: ComponentType[];
  enableLargeFileStreaming?: boolean; // Default: true
  onProgress?: (progress: {
    current: number;
    total: number;
    percentage: number;
  }) => void;
}

export interface ImportOptions {
  configId: string;
  retryAttempts?: number;
  timeout?: number;
  cacheEnabled?: boolean;
}

// Cursor IDE specific deployment options
export interface CursorDeployOptions {
  platform: 'cursor-ide';
  conflictStrategy: ConflictStrategy;
  dryRun: boolean;
  validateOnly: boolean;
  components?: string[]; // Use string array to allow Cursor-specific component names
  skipComponents?: string[];
  enableLargeFileStreaming?: boolean;
  onProgress?: (progress: {
    current: number;
    total: number;
    percentage: number;
  }) => void;
  cursorSpecific?: {
    globalSettingsPath?: string; // Custom path for global settings (~/.cursor/settings.json)
    projectSettingsPath?: string; // Custom path for project settings (.cursor/settings.json)
    aiPromptsPath?: string; // Custom path for AI prompts (.cursor/ai/)
    extensionsPath?: string; // Custom path for extensions (.cursor/extensions.json)
    snippetsPath?: string; // Custom path for snippets (~/.cursor/snippets/)
    tasksPath?: string; // Custom path for tasks (.cursor/tasks.json)
    launchPath?: string; // Custom path for launch config (.cursor/launch.json)
    preserveExistingSettings?: boolean; // Whether to preserve existing settings during merge
    aiContextMergeStrategy?: 'replace' | 'merge' | 'append'; // How to handle AI context conflicts
    maxFileSize?: number; // Maximum file size for AI context (default: 100MB)
    maxContextFiles?: number; // Maximum number of files in AI context (default: 1000)
  };
}

// Platform-specific deploy options union type
export type PlatformDeployOptions = 
  | DeployOptions 
  | CursorDeployOptions;
