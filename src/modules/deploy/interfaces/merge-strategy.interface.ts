export interface MergeStrategy {
  jsonMerge: JsonMergeStrategy;
  permissionMerge: PermissionMergeStrategy;
  contentMerge: ContentMergeStrategy;
}

export interface JsonMergeStrategy {
  arrays: 'union' | 'concat' | 'replace';
  objects: 'deep' | 'shallow' | 'replace';
  conflicts: 'prefer-local' | 'prefer-remote' | 'interactive';
}

export interface PermissionMergeStrategy {
  strategy: 'union' | 'intersection' | 'replace';
  validation: boolean;
  sorting: boolean;
  deduplication: boolean;
}

export interface ContentMergeStrategy {
  strategy: 'version-based' | 'timestamp-based' | 'manual' | 'auto';
  preserveComments?: boolean;
  preserveFormatting?: boolean;
}

export interface DiffResult {
  hasChanges: boolean;
  components: ComponentDiff[];
  summary: DiffSummary;
}

export interface ComponentDiff {
  component: string;
  type: 'added' | 'modified' | 'deleted' | 'unchanged';
  changes: Change[];
}

export interface Change {
  path: string;
  type: 'added' | 'modified' | 'deleted';
  oldValue?: unknown;
  newValue?: unknown;
  description?: string;
}

export interface DiffSummary {
  totalChanges: number;
  added: number;
  modified: number;
  deleted: number;
  components: string[];
}

export interface FileConflict {
  filePath: string;
  localContent: string;
  remoteContent: string;
  conflictType: 'content' | 'permission' | 'metadata';
  suggestedResolution?: string;
}
