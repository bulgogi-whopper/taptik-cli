import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DataProcessingErrorHandler,
  DataProcessingErrorType,
  ErrorContext,
} from './data-processing-error-handler';

describe('DataProcessingErrorHandler', () => {
  const mockContext: ErrorContext = {
    filePath: '/test/path/file.json',
    category: 'personal-context',
    operation: 'testing data processing',
    rawData: '{"test": "data"}',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('JSON parsing errors', () => {
    it('should handle JSON parsing error with line and column info', () => {
      const error = new Error(
        'Unexpected token } in JSON at position 15 line 3 column 5',
      );

      const result = DataProcessingErrorHandler.handleError(
        error,
        DataProcessingErrorType.JSON_PARSING,
        mockContext,
      );

      expect(result.shouldContinue).toBe(true);
      expect(result.isCritical).toBe(false);
      expect(result.userMessage).toContain('JSON parsing failed');
      expect(result.userMessage).toContain(mockContext.filePath);
      expect(result.userMessage).toContain('line 3, column 5');
      expect(result.filePath).toBe(mockContext.filePath);
      expect(result.suggestions).toHaveLength(5);
      expect(result.suggestions[0]).toContain('JSON syntax');
      expect(result.suggestions[4]).toContain('Focus on at line 3, column 5');
    });

    it('should handle JSON parsing error without line info', () => {
      const error = new Error('Invalid JSON structure');

      const result = DataProcessingErrorHandler.handleError(
        error,
        DataProcessingErrorType.JSON_PARSING,
        { ...mockContext, filePath: undefined },
      );

      expect(result.userMessage).toContain('unknown file');
      expect(result.suggestions[4]).toContain(
        'Check the entire file structure',
      );
    });
  });

  describe('Markdown parsing errors', () => {
    it('should handle markdown parsing error with partial data extraction', () => {
      const error = new Error('Invalid markdown structure');
      const contextWithMarkdown = {
        ...mockContext,
        rawData: '# Title\n\nSome content here\n\n## Section\n\nMore content',
      };

      const result = DataProcessingErrorHandler.handleError(
        error,
        DataProcessingErrorType.MARKDOWN_PARSING,
        contextWithMarkdown,
      );

      expect(result.shouldContinue).toBe(true);
      expect(result.isCritical).toBe(false);
      expect(result.userMessage).toContain('Markdown parsing failed');
      expect(result.userMessage).toContain(mockContext.category);
      expect(result.suggestions).toHaveLength(5);
      expect(result.suggestions[0]).toContain('markdown syntax');
      expect(result.partialData).toBeDefined();
      expect(result.partialData.partialContent).toContain('Some content');
    });

    it('should handle markdown parsing error without raw data', () => {
      const error = new Error('Invalid markdown structure');

      const result = DataProcessingErrorHandler.handleError(
        error,
        DataProcessingErrorType.MARKDOWN_PARSING,
        { ...mockContext, rawData: undefined },
      );

      expect(result.partialData).toBeUndefined();
    });
  });

  describe('Data validation errors', () => {
    it('should handle data validation error', () => {
      const error = new Error('Required field "name" is missing');

      const result = DataProcessingErrorHandler.handleError(
        error,
        DataProcessingErrorType.DATA_VALIDATION,
        mockContext,
      );

      expect(result.shouldContinue).toBe(true);
      expect(result.isCritical).toBe(false);
      expect(result.userMessage).toContain('Data validation failed');
      expect(result.suggestions).toHaveLength(5);
      expect(result.suggestions[0]).toContain('required fields');
      expect(result.errorDetails).toBe(error.message);
    });
  });

  describe('Transformation errors', () => {
    it('should handle transformation error', () => {
      const error = new Error('Cannot transform invalid data structure');

      const result = DataProcessingErrorHandler.handleError(
        error,
        DataProcessingErrorType.TRANSFORMATION,
        mockContext,
      );

      expect(result.shouldContinue).toBe(true);
      expect(result.isCritical).toBe(false);
      expect(result.userMessage).toContain('Transformation failed');
      expect(result.userMessage).toContain(mockContext.category);
      expect(result.suggestions).toHaveLength(5);
      expect(result.suggestions[0]).toContain('source data format');
    });
  });

  describe('Missing required field errors', () => {
    it('should handle missing required field error', () => {
      const error = new Error('Field "email" is required but not found');

      const result = DataProcessingErrorHandler.handleError(
        error,
        DataProcessingErrorType.MISSING_REQUIRED_FIELD,
        mockContext,
      );

      expect(result.shouldContinue).toBe(true);
      expect(result.isCritical).toBe(false);
      expect(result.userMessage).toContain('Required field missing');
      expect(result.suggestions).toHaveLength(5);
      expect(result.suggestions[0]).toContain('Add the missing required field');
    });
  });

  describe('Invalid data format errors', () => {
    it('should handle invalid data format error', () => {
      const error = new Error('Invalid date format');

      const result = DataProcessingErrorHandler.handleError(
        error,
        DataProcessingErrorType.INVALID_DATA_FORMAT,
        mockContext,
      );

      expect(result.shouldContinue).toBe(true);
      expect(result.isCritical).toBe(false);
      expect(result.userMessage).toContain('Invalid data format');
      expect(result.userMessage).toContain(mockContext.filePath);
      expect(result.suggestions).toHaveLength(5);
      expect(result.suggestions[0]).toContain(
        'data format against expected specification',
      );
    });
  });

  describe('Generic errors', () => {
    it('should handle unknown error types', () => {
      const error = new Error('Unknown processing error');

      const result = DataProcessingErrorHandler.handleError(
        error,
        'unknown_error' as DataProcessingErrorType,
        mockContext,
      );

      expect(result.shouldContinue).toBe(true);
      expect(result.isCritical).toBe(false);
      expect(result.userMessage).toContain('Data processing error');
      expect(result.suggestions).toHaveLength(5);
      expect(result.suggestions[0]).toContain(
        'error message for specific details',
      );
    });
  });

  describe('Partial success summary', () => {
    it('should create partial success summary with failed results', () => {
      const failedResults = [
        {
          shouldContinue: true,
          userMessage: 'Error 1',
          filePath: '/file1.json',
          errorDetails: 'Details 1',
          suggestions: ['Fix file 1', 'Check syntax'],
          isCritical: false,
        },
        {
          shouldContinue: true,
          userMessage: 'Error 2',
          filePath: '/file2.json',
          errorDetails: 'Details 2',
          suggestions: ['Fix file 2', 'Check syntax'],
          isCritical: false,
        },
      ];

      const summary = DataProcessingErrorHandler.createPartialSuccessSummary(
        10, // total
        8, // successful
        failedResults,
      );

      expect(summary.successRate).toBe(80);
      expect(summary.summary).toContain('8/10 items successfully');
      expect(summary.summary).toContain('80% success rate');
      expect(summary.summary).toContain('2 items failed');
      expect(summary.failedFiles).toEqual(['/file1.json', '/file2.json']);
      expect(summary.suggestions).toEqual([
        'Fix file 1',
        'Check syntax',
        'Fix file 2',
      ]);
    });

    it('should handle results with no file paths', () => {
      const failedResults = [
        {
          shouldContinue: true,
          userMessage: 'Error without file',
          errorDetails: 'Details',
          suggestions: ['Generic fix'],
          isCritical: false,
        },
      ];

      const summary = DataProcessingErrorHandler.createPartialSuccessSummary(
        5, // total
        4, // successful
        failedResults,
      );

      expect(summary.successRate).toBe(80);
      expect(summary.failedFiles).toEqual([]);
      expect(summary.suggestions).toEqual(['Generic fix']);
    });

    it('should handle 100% success rate', () => {
      const summary = DataProcessingErrorHandler.createPartialSuccessSummary(
        5, // total
        5, // successful
        [], // no failures
      );

      expect(summary.successRate).toBe(100);
      expect(summary.summary).toContain('5/5 items successfully');
      expect(summary.summary).toContain('0 items failed');
      expect(summary.failedFiles).toEqual([]);
      expect(summary.suggestions).toEqual([]);
    });
  });

  describe('Logging functionality', () => {
    let mockLogger: {
      error: ReturnType<typeof vi.fn>;
      warn: ReturnType<typeof vi.fn>;
      log: ReturnType<typeof vi.fn>;
      debug: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockLogger = {
        error: vi.fn(),
        warn: vi.fn(),
        log: vi.fn(),
        debug: vi.fn(),
      };
      // Use type assertion to set private static property
      (
        DataProcessingErrorHandler as unknown as { logger: typeof mockLogger }
      ).logger = mockLogger;
    });

    it('should log critical errors with full details', () => {
      const result = {
        shouldContinue: false,
        userMessage: 'Critical processing error',
        filePath: '/test/file.json',
        errorDetails: 'Detailed error information',
        suggestions: ['Fix this', 'Try that'],
        isCritical: true,
        partialData: { some: 'data' },
      };

      DataProcessingErrorHandler.logErrorResult(result);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Critical data error: Critical processing error',
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Details: Detailed error information',
      );
      expect(mockLogger.debug).toHaveBeenCalledWith('File: /test/file.json');
      expect(mockLogger.log).toHaveBeenCalledWith('Suggested solutions:');
      expect(mockLogger.log).toHaveBeenCalledWith('  1. Fix this');
      expect(mockLogger.log).toHaveBeenCalledWith('  2. Try that');
      expect(mockLogger.debug).toHaveBeenCalledWith('Partial data available:', {
        some: 'data',
      });
    });

    it('should log non-critical errors as warnings', () => {
      const result = {
        shouldContinue: true,
        userMessage: 'Minor processing warning',
        errorDetails: 'Warning details',
        suggestions: [],
        isCritical: false,
      };

      DataProcessingErrorHandler.logErrorResult(result);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Data processing warning: Minor processing warning',
      );
      expect(mockLogger.debug).toHaveBeenCalledWith('Details: Warning details');
      expect(mockLogger.log).not.toHaveBeenCalledWith('Suggested solutions:');
    });
  });

  describe('Partial markdown data extraction', () => {
    it('should extract partial content from markdown', () => {
      const { extractPartialMarkdownData } = DataProcessingErrorHandler as any;
      const markdownContent = `# Main Title
      
Some introduction text here.

## Section 1

Content for section 1 with more details.

## Section 2

More content here.`;

      const result = extractPartialMarkdownData(markdownContent);

      expect(result).toBeDefined();
      expect(result.partialContent).toContain('Some introduction text');
      expect(result.partialContent).toContain('Content for section 1');
      expect(result.partialContent.length).toBeLessThanOrEqual(200);
    });

    it('should handle empty or invalid markdown content', () => {
      const { extractPartialMarkdownData } = DataProcessingErrorHandler as any;

      expect(extractPartialMarkdownData(undefined)).toBeUndefined();
      expect(extractPartialMarkdownData('')).toBeUndefined();
      expect(extractPartialMarkdownData('###')).toBeDefined();
    });
  });
});
