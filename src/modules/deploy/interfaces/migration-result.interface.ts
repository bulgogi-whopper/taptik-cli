export interface MigrationValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

export interface CompatibilityResult {
  compatible: boolean;
  migrationRequired: boolean;
  warnings: string[];
  suggestedActions?: string[];
}

export interface SchemaInfo {
  version: string;
  features: string[];
  deprecatedFeatures: string[];
  compatibleWith: string[];
  migrationComplexity?: 'low' | 'medium' | 'high';
}
