export interface SecurityConfig {
  dangerousPatterns: RegExp[];
  whitelistedCommands: string[];
  sensitiveDataPatterns: RegExp[];
  pathValidation: {
    allowedPaths: string[];
    blockedPaths: string[];
  };
}

export interface SecurityScanResult {
  passed: boolean;
  isSafe?: boolean;
  hasApiKeys?: boolean;
  hasMaliciousCommands?: boolean;
  warnings: SecurityWarning[];
  errors: SecurityError[];
  blockers?: SecurityBlocker[] | string[];
  summary: SecuritySummary;
}

export interface SecurityWarning {
  type: 'command' | 'path' | 'data' | 'permission';
  message: string;
  location?: string;
  severity: SecuritySeverity;
}

export interface SecurityError {
  type: 'command' | 'path' | 'data' | 'permission';
  message: string;
  location?: string;
  severity: SecuritySeverity;
  recoverable: boolean;
}

export interface SecurityBlocker {
  type: 'malicious' | 'traversal' | 'injection' | 'unauthorized';
  message: string;
  location?: string;
  details?: unknown;
}

export interface SecuritySummary {
  totalIssues: number;
  warnings: number;
  errors: number;
  blockers: number;
  highSeverity: number;
  mediumSeverity: number;
  lowSeverity: number;
}

export enum SecuritySeverity {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INFO = 'INFO',
}

export interface SecurityValidationResult {
  passed: boolean;
  stages: SecurityStageResult[];
  warnings: string[];
  errors: string[];
  blockers: string[];
}

export interface SecurityStageResult {
  stage: SecurityStage;
  passed: boolean;
  severity: SecuritySeverity;
  blocking: boolean;
  message?: string;
  issues?: string[];
}

export type SecurityStage =
  | 'commandValidation'
  | 'pathValidation'
  | 'sensitiveDataScan'
  | 'permissionCheck'
  | 'integrityCheck';

export interface CommandValidationResult {
  safe: boolean;
  command: string;
  issues?: string[];
}

export interface PathValidationResult {
  safe: boolean;
  paths: string[];
  issues?: string[];
}

export interface SensitiveDataResult {
  found: boolean;
  locations: string[];
  types: string[];
  sanitized?: boolean;
}
