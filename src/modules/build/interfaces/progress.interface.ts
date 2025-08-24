export interface ConfigSize {
  totalFileSize: number;
  agents: number;
  commands: number;
  mcpServers: number;
  steeringRules: number;
}

export interface ProcessingPhase {
  name: string;
  estimatedSeconds: number;
  description: string;
}

export interface ProcessingTimeEstimate {
  totalSeconds: number;
  phases: ProcessingPhase[];
  complexity: 'simple' | 'moderate' | 'complex' | 'very complex';
}

export interface ProgressState {
  currentStep: number;
  totalSteps: number;
  completedSteps: string[];
  timestamp: string;
}

export interface DetailedProgress {
  percentage: number;
  currentStep: number;
  totalSteps: number;
  elapsedSeconds: number;
  estimatedRemainingSeconds: number;
  estimatedTotalSeconds: number;
  velocity: string;
  status: string;
  formattedElapsed: string;
  formattedRemaining: string;
  formattedTotal: string;
}

export interface PackageInfo {
  size: number;
  checksum: string;
  cloudReady: boolean;
  securityLevel: string;
}

export interface UploadPrompt {
  message: string;
  details: string;
  choices: string[];
}

export interface ConfigField {
  field: string;
  message: string;
  type: string;
  required: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface UploadResult {
  success: boolean;
  configId: string;
  url: string;
  visibility: 'public' | 'private';
}

export interface ValidationResults {
  schema: boolean;
  size: boolean;
  compatibility: boolean;
  schemaErrors?: string[];
  actualSize?: number;
  maxSize?: number;
  compatibilityIssues?: string[];
  features?: Record<string, boolean>;
}

export interface ActionableError {
  code?: string;
  message: string;
  type?: string;
  context?: string;
  suggestions?: string[];
  recoverable?: boolean;
  helpUrl?: string;
}

export interface PackageDetails {
  size: number;
  title: string;
  isPublic: boolean;
  tags: string[];
  securityLevel: string;
}

export type ProgressUpdateCallback = (update: DetailedProgress) => void;
