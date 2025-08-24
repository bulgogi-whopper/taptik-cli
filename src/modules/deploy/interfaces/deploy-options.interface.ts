export type ComponentType = 'settings' | 'agents' | 'commands' | 'project';
export type ConflictStrategy =
  | 'skip'
  | 'overwrite'
  | 'merge'
  | 'backup'
  | 'prompt';
export type SupportedPlatform = 'claude-code' | 'kiro-ide' | 'cursor-ide';

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
