import {
  VALIDATION_RULES,
  ValidationErrorCode,
  SECURITY_PATTERNS,
  SecuritySeverity,
  SecurityAction,
  SupportedPlatform,
  ContentCategory,
  SensitiveDataType,
  SEVERITY_MAPPING,
} from '../constants';
import {
  TaptikContext,
  DeployableContext,
} from '../interfaces/taptik-context.interface';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  securityIssues: SecurityIssue[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

export interface SecurityIssue {
  type: string;
  field: string;
  severity: SecuritySeverity;
  action: SecurityAction;
}

/**
 * Comprehensive format validator for export/deploy compatibility
 * Ensures contexts meet all requirements before export or cloud upload
 */
export class FormatValidator {
  /**
   * Validates a TaptikContext for export compatibility
   */
  static validateExportFormat(context: TaptikContext): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      securityIssues: [],
    };

    // Validate metadata
    this.validateMetadata(context.metadata, result);

    // Validate content structure
    this.validateContent(context.content, result);

    // Validate security information
    this.validateSecurity(context.security, result);

    // Perform security scan - this may add errors and set isValid to false
    this.performSecurityScan(context.content, result);

    // Set isValid based on errors (security scan may have added errors)
    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Validates a DeployableContext for cloud deployment
   */
  static validateDeployFormat(context: DeployableContext): ValidationResult {
    const result = this.validateExportFormat(context);

    // Additional cloud-specific validations
    this.validateCloudMetadata(context.cloudMetadata, result);

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Validates metadata section
   */
  private static validateMetadata(
    metadata: unknown,
    result: ValidationResult,
  ): void {
    if (!metadata || typeof metadata !== 'object') {
      result.errors.push({
        code: ValidationErrorCode.MISSING_METADATA,
        message: 'Metadata section is required',
        field: 'metadata',
      });
      return;
    }

    const meta = metadata as Record<string, unknown>;

    // Version validation
    if (
      !meta.version ||
      typeof meta.version !== 'string' ||
      !VALIDATION_RULES.VERSION.PATTERN.test(meta.version)
    ) {
      result.errors.push({
        code: ValidationErrorCode.INVALID_VERSION,
        message: 'Version must follow semantic versioning (e.g., 1.0.0)',
        field: 'metadata.version',
      });
    }

    // Source IDE validation
    const supportedPlatforms = Object.values(SupportedPlatform);
    if (
      !meta.sourceIde ||
      typeof meta.sourceIde !== 'string' ||
      !supportedPlatforms.includes(meta.sourceIde as SupportedPlatform)
    ) {
      result.errors.push({
        code: ValidationErrorCode.UNSUPPORTED_IDE,
        message: `Source IDE '${meta.sourceIde}' is not supported`,
        field: 'metadata.sourceIde',
      });
    }

    // Target IDEs validation
    if (!Array.isArray(meta.targetIdes) || meta.targetIdes.length === 0) {
      result.errors.push({
        code: ValidationErrorCode.INVALID_FORMAT,
        message: 'At least one target IDE must be specified',
        field: 'metadata.targetIdes',
      });
    } else {
      const invalidIdes = meta.targetIdes.filter(
        (ide: string) => !supportedPlatforms.includes(ide as SupportedPlatform),
      );
      if (invalidIdes.length > 0) {
        result.errors.push({
          code: ValidationErrorCode.UNSUPPORTED_IDE,
          message: `Unsupported target IDEs: ${invalidIdes.join(', ')}`,
          field: 'metadata.targetIdes',
        });
      }
    }

    // Title validation
    if (
      meta.title &&
      typeof meta.title === 'string' &&
      meta.title.length > VALIDATION_RULES.SIZE.MAX_TITLE_LENGTH
    ) {
      result.errors.push({
        code: ValidationErrorCode.INVALID_FORMAT,
        message: `Title exceeds maximum length of ${VALIDATION_RULES.SIZE.MAX_TITLE_LENGTH} characters`,
        field: 'metadata.title',
      });
    }

    // Description validation
    if (
      meta.description &&
      typeof meta.description === 'string' &&
      meta.description.length > VALIDATION_RULES.SIZE.MAX_DESCRIPTION_LENGTH
    ) {
      result.errors.push({
        code: ValidationErrorCode.INVALID_FORMAT,
        message: `Description exceeds maximum length of ${VALIDATION_RULES.SIZE.MAX_DESCRIPTION_LENGTH} characters`,
        field: 'metadata.description',
      });
    }

    // Tags validation
    if (
      meta.tags &&
      Array.isArray(meta.tags) &&
      meta.tags.length > VALIDATION_RULES.SIZE.MAX_TAGS
    ) {
      result.errors.push({
        code: ValidationErrorCode.INVALID_FORMAT,
        message: `Too many tags. Maximum allowed: ${VALIDATION_RULES.SIZE.MAX_TAGS}`,
        field: 'metadata.tags',
      });
    }

    // Export timestamp validation
    if (!meta.exportedAt) {
      result.warnings.push('Missing export timestamp');
    } else if (typeof meta.exportedAt === 'string') {
      try {
        new Date(meta.exportedAt);
      } catch {
        result.errors.push({
          code: ValidationErrorCode.INVALID_FORMAT,
          message: 'Invalid exportedAt timestamp format',
          field: 'metadata.exportedAt',
        });
      }
    } else {
      result.errors.push({
        code: ValidationErrorCode.INVALID_FORMAT,
        message: 'exportedAt must be a string',
        field: 'metadata.exportedAt',
      });
    }
  }

  /**
   * Validates content structure
   */
  private static validateContent(
    content: unknown,
    result: ValidationResult,
  ): void {
    if (!content || typeof content !== 'object') {
      result.errors.push({
        code: ValidationErrorCode.INVALID_FORMAT,
        message: 'Content section must be an object',
        field: 'content',
      });
      return;
    }

    const contentObject = content as Record<string, unknown>;

    // Check for at least one content category
    const validCategories = Object.keys(contentObject).filter((key) =>
      VALIDATION_RULES.FIELDS.VALID_CATEGORIES.includes(key as ContentCategory),
    );

    if (validCategories.length === 0) {
      result.warnings.push(
        'No valid content categories found. Consider adding personal, project, tools, or ide configurations.',
      );
    }

    // Validate IDE-specific content
    if (contentObject.ide && typeof contentObject.ide === 'object') {
      const supportedPlatforms = Object.values(SupportedPlatform);
      const ideKeys = Object.keys(contentObject.ide);
      const invalidIdeKeys = ideKeys.filter(
        (ide: string) => !supportedPlatforms.includes(ide as SupportedPlatform),
      );

      if (invalidIdeKeys.length > 0) {
        result.warnings.push(
          `Unknown IDE configurations found: ${invalidIdeKeys.join(', ')}`,
        );
      }
    }
  }

  /**
   * Validates security information
   */
  private static validateSecurity(
    security: unknown,
    result: ValidationResult,
  ): void {
    if (!security) {
      result.errors.push({
        code: ValidationErrorCode.MISSING_METADATA,
        message: 'Security section is required',
        field: 'security',
      });
      return;
    }

    const securityObject = security as Record<string, unknown>;

    if (typeof securityObject.hasApiKeys !== 'boolean') {
      result.errors.push({
        code: ValidationErrorCode.INVALID_FORMAT,
        message: 'hasApiKeys must be a boolean value',
        field: 'security.hasApiKeys',
      });
    }

    if (!Array.isArray(securityObject.filteredFields)) {
      result.errors.push({
        code: ValidationErrorCode.INVALID_FORMAT,
        message: 'filteredFields must be an array',
        field: 'security.filteredFields',
      });
    }

    if (
      !securityObject.scanResults ||
      typeof securityObject.scanResults !== 'object'
    ) {
      result.errors.push({
        code: ValidationErrorCode.INVALID_FORMAT,
        message: 'scanResults object is required',
        field: 'security.scanResults',
      });
    }
  }

  /**
   * Validates cloud metadata for deployment
   */
  private static validateCloudMetadata(
    cloudMetadata: unknown,
    result: ValidationResult,
  ): void {
    if (!cloudMetadata) {
      result.errors.push({
        code: ValidationErrorCode.MISSING_METADATA,
        message: 'Cloud metadata is required for deployment',
        field: 'cloudMetadata',
      });
      return;
    }

    const cloudObject = cloudMetadata as Record<string, unknown>;

    // Required fields
    const requiredFields = [
      'configId',
      'storagePath',
      'isPublic',
      'uploadedBy',
      'uploadedAt',
    ];

    requiredFields.forEach((field) => {
      if (!cloudObject[field]) {
        result.errors.push({
          code: ValidationErrorCode.MISSING_METADATA,
          message: `Cloud metadata field '${field}' is required`,
          field: `cloudMetadata.${field}`,
        });
      }
    });

    // Validate boolean fields
    if (typeof cloudObject.isPublic !== 'boolean') {
      result.errors.push({
        code: ValidationErrorCode.INVALID_FORMAT,
        message: 'isPublic must be a boolean value',
        field: 'cloudMetadata.isPublic',
      });
    }

    // Validate timestamps
    if (cloudObject.uploadedAt && typeof cloudObject.uploadedAt === 'string') {
      try {
        new Date(cloudObject.uploadedAt);
      } catch {
        result.errors.push({
          code: ValidationErrorCode.INVALID_FORMAT,
          message: 'Invalid uploadedAt timestamp format',
          field: 'cloudMetadata.uploadedAt',
        });
      }
    }
  }

  /**
   * Performs security scan for sensitive data
   */
  private static performSecurityScan(
    content: unknown,
    result: ValidationResult,
  ): void {
    const contentString = JSON.stringify(content);

    Object.entries(SECURITY_PATTERNS).forEach(([dataType, pattern]) => {
      const regex = new RegExp(pattern.source, pattern.flags || 'gi');
      let matchIndex = 0;

      while (regex.exec(contentString) !== null) {
        const severity = SEVERITY_MAPPING[dataType as SensitiveDataType];
        result.securityIssues.push({
          type: dataType.toLowerCase(),
          field: `content.${dataType.toLowerCase()}_${matchIndex}`,
          severity,
          action: SecurityAction.FLAGGED,
        });
        matchIndex++;
      }
    });

    // Update security flags for detected issues
    if (result.securityIssues.length > 0) {
      result.warnings.push(
        `Found ${result.securityIssues.length} potential security issues`,
      );

      const highSeverityIssues = result.securityIssues.filter(
        (issue) => issue.severity === SecuritySeverity.HIGH,
      );
      if (highSeverityIssues.length > 0) {
        result.errors.push({
          code: ValidationErrorCode.SECURITY_VIOLATION,
          message: `High severity security issues detected: ${highSeverityIssues.map((i) => i.type).join(', ')}`,
          field: 'content',
        });
      }
    }
  }

  /**
   * Quick validation check for basic format compliance
   */
  static isValidFormat(context: unknown): boolean {
    if (!context || typeof context !== 'object') return false;

    const ctx = context as Record<string, unknown>;
    const metadata = ctx.metadata as Record<string, unknown>;
    return !!(
      ctx.metadata &&
      ctx.content &&
      ctx.security &&
      metadata &&
      metadata.version &&
      metadata.sourceIde &&
      Array.isArray(metadata.targetIdes)
    );
  }

  /**
   * Sanitizes context by removing sensitive data
   */
  static sanitizeContext(context: TaptikContext): TaptikContext {
    const sanitized = JSON.parse(JSON.stringify(context));
    const filteredFields: string[] = [];

    // Recursively sanitize content
    const sanitizeValue = (object: unknown, path: string = ''): unknown => {
      if (typeof object === 'string') {
        let cleaned = object;
        Object.entries(SECURITY_PATTERNS).forEach(([dataType, pattern]) => {
          const regex = new RegExp(pattern.source, pattern.flags || 'gi');
          if (regex.test(cleaned)) {
            // Store only the data type and path, not the actual sensitive value
            filteredFields.push(`${path || dataType}: [FILTERED]`);
            // Replace sensitive patterns with [REDACTED]
            cleaned = cleaned.replace(regex, '[REDACTED]');
          }
        });
        return cleaned;
      } else if (Array.isArray(object)) {
        return object.map((item, index) =>
          sanitizeValue(item, `${path}[${index}]`),
        );
      } else if (object && typeof object === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(object)) {
          const newPath = path ? `${path}.${key}` : key;
          result[key] = sanitizeValue(value, newPath);
        }
        return result;
      }
      return object;
    };

    sanitized.content = sanitizeValue(
      sanitized.content,
      'content',
    ) as typeof sanitized.content;
    sanitized.security.hasApiKeys = filteredFields.length > 0;
    sanitized.security.filteredFields = filteredFields;

    return sanitized;
  }
}
