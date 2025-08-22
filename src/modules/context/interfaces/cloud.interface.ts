export interface CloudMetadata {
  title: string;
  description?: string;
  tags: string[];
  author?: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  sourceIde: string;
  targetIdes: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  components: {
    settings: boolean;
    agents: boolean;
    commands: boolean;
    mcp: boolean;
    steering: boolean;
  };
  searchKeywords: string[];
  isPublic: boolean;
}

export interface SanitizationResult {
  sanitizedData: any;
  securityLevel: 'safe' | 'warning' | 'blocked';
  findings: string[];
  report: {
    totalFields: number;
    sanitizedFields: number;
    safeFields: number;
    timestamp: Date;
    summary: string;
    processingTimeMs?: number;
    detailedFindings?: Array<{
      category: string;
      severity: string;
      count: number;
      path?: string;
    }>;
  };
  severityBreakdown?: {
    safe: number;
    low: number;
    medium: number;
    critical: number;
  };
  recommendations?: string[];
}

export interface TaptikPackage {
  metadata: CloudMetadata;
  sanitizedConfig: any;
  checksum: string;
  format: 'taptik-v1';
  compression: 'gzip' | 'none';
  size: number;
  manifest: {
    files: string[];
    directories: string[];
    totalSize: number;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  cloudCompatible: boolean;
  schemaCompliant: boolean;
  sizeLimit: {
    current: number;
    maximum: number;
    withinLimit: boolean;
  };
  featureSupport: {
    ide: string;
    supported: string[];
    unsupported: string[];
  };
  recommendations: string[];
}