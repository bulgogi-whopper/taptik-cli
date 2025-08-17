/**
 * Context Module - Export/Deploy Format Compatibility Layer
 *
 * This module provides shared interfaces, validation, and utilities
 * to ensure compatibility between export and deploy operations.
 */

// Core interfaces
export * from './interfaces/taptik-context.interface';

// Validation DTOs
export * from './dto/context-validation.dto';

// Constants and configuration
export * from './constants/export-format.constants';

// Utilities
export * from './utils/format-validator.utility';

// Re-export key types for convenience
export type {
  TaptikContext,
  DeployableContext,
  ContextMetadata,
  ContextContent,
  SecurityInfo,
  CloudMetadata,
  CloudConfigSearchResponse,
  CloudConfigItem,
} from './interfaces/taptik-context.interface';

export type {
  ValidationResult,
  ValidationError,
  SecurityIssue,
} from './utils/format-validator.utility';
