import { Logger } from '@nestjs/common';

/**
 * Types of data processing errors
 */
export enum DataProcessingErrorType {
  JSON_PARSING = 'json_parsing',
  MARKDOWN_PARSING = 'markdown_parsing',
  DATA_VALIDATION = 'data_validation',
  TRANSFORMATION = 'transformation',
  MISSING_REQUIRED_FIELD = 'missing_required_field',
  INVALID_DATA_FORMAT = 'invalid_data_format',
}

/**
 * Result of data processing error handling
 */
export interface DataProcessingErrorResult {
  /** Whether the operation should continue with other items */
  shouldContinue: boolean;
  /** User-friendly error message */
  userMessage: string;
  /** File path where the error occurred */
  filePath?: string;
  /** Specific error details for debugging */
  errorDetails: string;
  /** Suggested resolutions */
  suggestions: string[];
  /** Whether this affects the entire build */
  isCritical: boolean;
  /** Partial data that was successfully processed */
  partialData?: Record<string, unknown>;
}

/**
 * Context information for error handling
 */
export interface ErrorContext {
  /** The file being processed */
  filePath?: string;
  /** The category being transformed */
  category?: string;
  /** The operation being performed */
  operation: string;
  /** Raw data that caused the error */
  rawData?: string;
}

/**
 * Utility class for handling data processing errors with detailed information
 */
export class DataProcessingErrorHandler {
  private static readonly logger = new Logger(DataProcessingErrorHandler.name);

  /**
   * Handle data processing errors with appropriate context and guidance
   * @param error The error that occurred
   * @param errorType Type of data processing error
   * @param context Context information about the operation
   * @returns Error handling result with detailed information
   */
  static handleError(
    error: unknown,
    errorType: DataProcessingErrorType,
    context: ErrorContext
  ): DataProcessingErrorResult {
    const errorInstance = error instanceof Error ? error : new Error(String(error));
    
    switch (errorType) {
      case DataProcessingErrorType.JSON_PARSING:
        return this.handleJsonParsingError(errorInstance, context);
        
      case DataProcessingErrorType.MARKDOWN_PARSING:
        return this.handleMarkdownParsingError(errorInstance, context);
        
      case DataProcessingErrorType.DATA_VALIDATION:
        return this.handleDataValidationError(errorInstance, context);
        
      case DataProcessingErrorType.TRANSFORMATION:
        return this.handleTransformationError(errorInstance, context);
        
      case DataProcessingErrorType.MISSING_REQUIRED_FIELD:
        return this.handleMissingRequiredFieldError(errorInstance, context);
        
      case DataProcessingErrorType.INVALID_DATA_FORMAT:
        return this.handleInvalidDataFormatError(errorInstance, context);
        
      default:
        return this.handleGenericDataError(errorInstance, context);
    }
  }

  /**
   * Handle JSON parsing errors with specific file and line information
   */
  private static handleJsonParsingError(error: Error, context: ErrorContext): DataProcessingErrorResult {
    const lineMatch = error.message.match(/line (\d+)/);
    const columnMatch = error.message.match(/column (\d+)/);
    const lineInfo = lineMatch && columnMatch ? ` at line ${lineMatch[1]}, column ${columnMatch[1]}` : '';
    
    const userMessage = `JSON parsing failed in ${context.filePath || 'unknown file'}${lineInfo}`;
    
    this.logger.error(userMessage, error.message);
    
    return {
      shouldContinue: true, // Can continue with other files
      userMessage,
      filePath: context.filePath,
      errorDetails: error.message,
      suggestions: [
        'Check JSON syntax for missing commas, brackets, or quotes',
        'Validate JSON structure with a JSON validator',
        'Ensure proper escaping of special characters',
        'Check for trailing commas (not allowed in strict JSON)',
        lineInfo ? `Focus on${lineInfo} in the file` : 'Check the entire file structure',
      ],
      isCritical: false,
    };
  }

  /**
   * Handle markdown parsing errors
   */
  private static handleMarkdownParsingError(error: Error, context: ErrorContext): DataProcessingErrorResult {
    const userMessage = `Markdown parsing failed for ${context.category || 'unknown category'} in ${context.filePath || 'unknown file'}`;
    
    this.logger.warn(userMessage, error.message);
    
    return {
      shouldContinue: true,
      userMessage,
      filePath: context.filePath,
      errorDetails: error.message,
      suggestions: [
        'Check markdown syntax and structure',
        'Ensure proper heading hierarchy (##, ###, etc.)',
        'Verify code blocks are properly closed',
        'Check for unmatched brackets or parentheses',
        'Consider using a markdown validator',
      ],
      isCritical: false,
      partialData: this.extractPartialMarkdownData(context.rawData),
    };
  }

  /**
   * Handle data validation errors
   */
  private static handleDataValidationError(error: Error, context: ErrorContext): DataProcessingErrorResult {
    const userMessage = `Data validation failed during ${context.operation}`;
    
    this.logger.warn(userMessage, error.message);
    
    return {
      shouldContinue: true,
      userMessage,
      filePath: context.filePath,
      errorDetails: error.message,
      suggestions: [
        'Check if all required fields are present',
        'Verify data types match expected format',
        'Ensure arrays and objects have proper structure',
        'Check for null or undefined values where not allowed',
        'Review the data format specification',
      ],
      isCritical: false,
    };
  }

  /**
   * Handle transformation errors
   */
  private static handleTransformationError(error: Error, context: ErrorContext): DataProcessingErrorResult {
    const userMessage = `Transformation failed for ${context.category || 'unknown category'}`;
    
    this.logger.error(userMessage, error.message);
    
    return {
      shouldContinue: true, // Continue with other categories
      userMessage,
      filePath: context.filePath,
      errorDetails: error.message,
      suggestions: [
        'Check if source data format matches expected structure',
        'Verify all required fields are available in source data',
        'Review transformation logic for edge cases',
        'Consider providing default values for missing fields',
        'Check for circular references in data structures',
      ],
      isCritical: false,
    };
  }

  /**
   * Handle missing required field errors
   */
  private static handleMissingRequiredFieldError(error: Error, context: ErrorContext): DataProcessingErrorResult {
    const userMessage = `Required field missing during ${context.operation}`;
    
    this.logger.warn(userMessage, error.message);
    
    return {
      shouldContinue: true,
      userMessage,
      filePath: context.filePath,
      errorDetails: error.message,
      suggestions: [
        'Add the missing required field to the source data',
        'Check field name spelling and case sensitivity',
        'Provide default value for the missing field',
        'Update source file to include all required information',
        'Review field requirements documentation',
      ],
      isCritical: false,
    };
  }

  /**
   * Handle invalid data format errors
   */
  private static handleInvalidDataFormatError(error: Error, context: ErrorContext): DataProcessingErrorResult {
    const userMessage = `Invalid data format in ${context.filePath || 'unknown file'}`;
    
    this.logger.warn(userMessage, error.message);
    
    return {
      shouldContinue: true,
      userMessage,
      filePath: context.filePath,
      errorDetails: error.message,
      suggestions: [
        'Check data format against expected specification',
        'Ensure consistent data types throughout',
        'Verify date/time formats are valid',
        'Check for proper encoding (UTF-8)',
        'Review example files for correct format',
      ],
      isCritical: false,
    };
  }

  /**
   * Handle generic data processing errors
   */
  private static handleGenericDataError(error: Error, context: ErrorContext): DataProcessingErrorResult {
    const userMessage = `Data processing error during ${context.operation}`;
    
    this.logger.error(userMessage, error.stack);
    
    return {
      shouldContinue: true,
      userMessage,
      filePath: context.filePath,
      errorDetails: error.message,
      suggestions: [
        'Check the error message for specific details',
        'Verify input data is valid and accessible',
        'Try processing other files to isolate the issue',
        'Check system resources and permissions',
        'Review logs for additional context',
      ],
      isCritical: false,
    };
  }

  /**
   * Extract partial data from markdown content when parsing fails
   */
  private static extractPartialMarkdownData(rawData?: string): Record<string, unknown> | undefined {
    if (!rawData) return undefined;
    
    try {
      // Try to extract basic text content, ignoring complex structures
      const lines = rawData.split('\n');
      const content = lines
        .filter(line => line.trim() && !line.trim().startsWith('#'))
        .join(' ')
        .slice(0, 200); // First 200 characters
      
      return { partialContent: content };
    } catch {
      return undefined;
    }
  }

  /**
   * Create partial success summary for failed operations
   */
  static createPartialSuccessSummary(
    totalItems: number,
    successfulItems: number,
    failedResults: DataProcessingErrorResult[]
  ): {
    successRate: number;
    summary: string;
    failedFiles: string[];
    suggestions: string[];
  } {
    const successRate = Math.round((successfulItems / totalItems) * 100);
    const failedCount = failedResults.length;
    const failedFiles = failedResults
      .map(result => result.filePath)
      .filter(Boolean) as string[];
    
    const summary = `Processed ${successfulItems}/${totalItems} items successfully (${successRate}% success rate). ${failedCount} items failed.`;
    
    // Collect unique suggestions from all failed results
    const allSuggestions = failedResults.flatMap(result => result.suggestions);
    const uniqueSuggestions = Array.from(new Set(allSuggestions));
    
    this.logger.log(summary);
    if (failedFiles.length > 0) {
      this.logger.warn(`Failed files: ${failedFiles.join(', ')}`);
    }
    
    return {
      successRate,
      summary,
      failedFiles,
      suggestions: uniqueSuggestions,
    };
  }

  /**
   * Log error result with context
   */
  static logErrorResult(result: DataProcessingErrorResult): void {
    if (result.isCritical) {
      this.logger.error(`Critical data error: ${result.userMessage}`);
      this.logger.error(`Details: ${result.errorDetails}`);
    } else {
      this.logger.warn(`Data processing warning: ${result.userMessage}`);
      this.logger.debug(`Details: ${result.errorDetails}`);
    }
    
    if (result.filePath) {
      this.logger.debug(`File: ${result.filePath}`);
    }
    
    if (result.suggestions.length > 0) {
      this.logger.log('Suggested solutions:');
      result.suggestions.forEach((suggestion, index) => {
        this.logger.log(`  ${index + 1}. ${suggestion}`);
      });
    }
    
    if (result.partialData) {
      this.logger.debug('Partial data available:', result.partialData);
    }
  }
}