import { ComponentType } from './deploy-options.interface';

export interface DeploymentResult {
  success: boolean;
  platform: string;
  deployedComponents: ComponentResult[] | string[];
  conflicts: ConflictResult[];
  backupManifest?: BackupManifest;
  backupPath?: string;
  summary: DeploymentSummary;
  errors?: DeploymentError[];
  warnings?: DeploymentWarning[];
  metadata?: {
    backupCreated?: string;
    timestamp?: Date;
    deploymentId?: string;
    performanceReport?: string;
    cursorPerformanceReport?: Record<string, unknown>; // CursorPerformanceReport from cursor-performance-monitor.service
    isLargeConfiguration?: boolean;
    streamingMetrics?: {
      chunksProcessed: number;
      totalSize: number;
      processingTime: number;
      memoryUsagePeak: number;
    };
  };
}

export interface ComponentResult {
  type: ComponentType;
  success: boolean;
  filesDeployed: string[];
  filesSkipped?: string[];
  errors?: string[];
  warnings?: string[];
}

export interface ConflictResult {
  path?: string;
  filePath?: string;
  message?: string;
  resolution: 'skipped' | 'overwritten' | 'merged' | 'backed-up';
  originalContent?: string;
  newContent?: string;
  backupPath?: string;
}

export interface BackupManifest {
  id: string;
  timestamp: Date;
  platform: string;
  files?: BackupFileEntry[];
  components?: Record<string, unknown>;
  deploymentOptions: unknown;
}

export interface BackupFileEntry {
  originalPath: string;
  backupPath: string;
  component: ComponentType;
  checksum: string;
}

export interface DeploymentSummary {
  totalFiles?: number;
  filesDeployed: number;
  filesSkipped: number;
  conflictsResolved: number;
  warnings?: string[];
  duration?: number;
  platform?: string;
  backupCreated?: boolean;
  totalComponents?: number;
  performanceMetrics?: {
    totalDuration: number; // milliseconds
    peakMemoryUsage: number; // MB
    averageMemoryUsage: number; // MB
    componentCount: number;
    streamingUsed?: boolean;
    chunksProcessed?: number;
  };
}

export interface DeploymentError {
  code: string;
  message: string;
  severity?: string;
  details?: unknown;
  filePath?: string;
  component?: ComponentType;
}

export interface DeploymentWarning {
  code?: string;
  message: string;
}

export interface RollbackResult {
  success: boolean;
  filesRestored: number;
  errors?: string[];
  backupId: string;
}
