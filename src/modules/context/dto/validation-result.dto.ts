export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings?: ValidationWarning[];
  metadata?: ValidationMetadata;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ValidationWarning {
  field: string;
  message: string;
  code?: string;
  suggestion?: string;
}

export interface ValidationMetadata {
  timestamp: Date;
  version: string;
  platform?: string;
}
