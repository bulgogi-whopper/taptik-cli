export interface TaptikContext {
  version: string;
  sourceIde: string;
  targetIdes: string[];
  data: {
    claudeCode?: ClaudeCodeData;
    kiroIde?: unknown;
    cursorIde?: unknown;
  };
  metadata: {
    timestamp: string;
    exportedBy?: string;
  };
}

export interface ClaudeCodeData {
  local?: ClaudeCodeLocalSettings;
  global?: ClaudeCodeGlobalSettings;
}

export interface ClaudeCodeLocalSettings {
  settings?: ClaudeCodeSettings;
  agents?: ClaudeAgent[];
  commands?: ClaudeCommand[];
  mcpServers?: McpConfig;
  steeringRules?: SteeringRule[];
  instructions?: {
    global?: string;
    local?: string;
  };
}

export interface ClaudeCodeGlobalSettings {
  settings?: ClaudeCodeSettings;
  agents?: ClaudeAgent[];
  commands?: ClaudeCommand[];
  mcpServers?: McpConfig;
  steeringRules?: SteeringRule[];
  instructions?: {
    global?: string;
    local?: string;
  };
}

export interface ClaudeCodeSettings {
  theme?: string;
  autoSave?: boolean;
  features?: {
    gitIntegration?: boolean;
    dockerSupport?: boolean;
    kubernetesIntegration?: boolean;
    autocomplete?: boolean;
    [key: string]: boolean | undefined;
  };
  [key: string]: unknown;
}

export interface ClaudeAgent {
  id: string;
  name: string;
  prompt: string;
  [key: string]: unknown;
}

export interface ClaudeCommand {
  name: string;
  command: string;
  [key: string]: unknown;
}

export interface McpConfig {
  servers: McpServerConfig[];
}

export interface McpServerConfig {
  name: string;
  protocol: string;
  command?: string;
  url?: string;
  [key: string]: unknown;
}

export interface SteeringRule {
  pattern: string;
  rule: string;
  [key: string]: unknown;
}

export interface CloudMetadata {
  title: string;
  description?: string;
  tags: string[];
  author?: string;
  version: string;
  createdAt: string;
  updatedAt?: string;
  sourceIde: string;
  targetIdes: string[];
  complexityLevel: 'minimal' | 'basic' | 'intermediate' | 'advanced' | 'expert';
  componentCount: {
    agents: number;
    commands: number;
    mcpServers: number;
    steeringRules: number;
    instructions: number;
  };
  features: string[];
  compatibility: string[];
  searchKeywords: string[];
  fileSize: number;
  checksum: string;
  isPublic?: boolean;
}

export interface SanitizationResult {
  sanitizedData: unknown;
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
  sanitizedConfig: TaptikContext;
  checksum: string;
  format: 'taptik-v1' | 'taptik-v2';
  compression: 'gzip' | 'brotli' | 'none';
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
  validationScore?: number; // 0-100 quality score
}