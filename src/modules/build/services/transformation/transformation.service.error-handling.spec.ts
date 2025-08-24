import { Test, TestingModule } from '@nestjs/testing';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsData } from '../../interfaces/settings-data.interface';
import {
  DataProcessingErrorHandler,
  DataProcessingErrorType,
} from '../../utils/data-processing-error-handler';

import { TransformationService } from './transformation.service';

// Mock the DataProcessingErrorHandler
vi.mock('../../utils/data-processing-error-handler');

describe('TransformationService - Error Handling', () => {
  let service: TransformationService;
  let mockLogger: {
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    log: ReturnType<typeof vi.fn>;
    debug?: ReturnType<typeof vi.fn>;
  };

  const mockSettingsData: SettingsData = {
    localSettings: {
      contextMd: '# Test Context',
      userPreferencesMd: '# User Preferences',
      projectSpecMd: '# Project Spec',
      steeringFiles: [],
      hooks: [],
    },
    globalSettings: {
      userConfig: '# Global Config',
      preferences: '# Global Preferences',
      globalPrompts: [],
    },
    collectionMetadata: {
      sourcePlatform: 'kiro',
      collectionTimestamp: '2025-01-10T10:00:00Z',
      projectPath: '/test/project',
      globalPath: '/test/global',
      warnings: [],
      errors: [],
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransformationService],
    }).compile();

    service = module.get<TransformationService>(TransformationService);

    // Mock the logger
    mockLogger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    (service as any).logger = mockLogger;

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('Personal Context Transformation Error Handling', () => {
    it('should handle transformation errors and return fallback context', async () => {
      // Mock error handling
      const mockErrorResult = {
        shouldContinue: true,
        userMessage: 'Transformation failed for personal context',
        errorDetails: 'Mock error details',
        suggestions: ['Fix the data', 'Check format'],
        isCritical: false,
        partialData: { languages: ['javascript'] },
      };

      vi.mocked(DataProcessingErrorHandler.handleError).mockReturnValue(
        mockErrorResult,
      );
      vi.mocked(DataProcessingErrorHandler.logErrorResult).mockImplementation(
        () => {},
      );

      // Mock the extractUserPreferences method to throw an error
      vi.spyOn(service as any, 'extractUserPreferences').mockRejectedValue(
        new Error('Failed to extract user preferences'),
      );

      const result = await service.transformPersonalContext(mockSettingsData);

      expect(DataProcessingErrorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Error),
        DataProcessingErrorType.TRANSFORMATION,
        {
          category: 'personal-context',
          operation: 'transforming personal context',
          filePath: mockSettingsData.collectionMetadata.projectPath,
        },
      );

      expect(DataProcessingErrorHandler.logErrorResult).toHaveBeenCalledWith(
        mockErrorResult,
      );

      // Should return fallback context
      expect(result).toBeDefined();
      expect(result.user_id).toBeDefined();
      expect(result.preferences.preferred_languages).toEqual(['javascript']); // From partial data
      expect(result.metadata.source_platform).toBe('kiro');
    });

    it('should throw error when transformation error is critical', async () => {
      const mockErrorResult = {
        shouldContinue: false,
        userMessage: 'Critical transformation error',
        errorDetails: 'Critical error details',
        suggestions: ['Contact support'],
        isCritical: true,
      };

      vi.mocked(DataProcessingErrorHandler.handleError).mockReturnValue(
        mockErrorResult,
      );
      vi.mocked(DataProcessingErrorHandler.logErrorResult).mockImplementation(
        () => {},
      );

      vi.spyOn(service as any, 'extractUserPreferences').mockRejectedValue(
        new Error('Critical failure'),
      );

      await expect(
        service.transformPersonalContext(mockSettingsData),
      ).rejects.toThrow('Critical transformation error');
    });
  });

  describe('Project Context Transformation Error Handling', () => {
    it('should handle transformation errors and return fallback context', async () => {
      const mockErrorResult = {
        shouldContinue: true,
        userMessage: 'Transformation failed for project context',
        errorDetails: 'Mock error details',
        suggestions: ['Fix the data'],
        isCritical: false,
        partialData: { name: 'Test Project' },
      };

      vi.mocked(DataProcessingErrorHandler.handleError).mockReturnValue(
        mockErrorResult,
      );
      vi.mocked(DataProcessingErrorHandler.logErrorResult).mockImplementation(
        () => {},
      );

      vi.spyOn(service as any, 'extractProjectInfo').mockRejectedValue(
        new Error('Failed to extract project info'),
      );

      const result = await service.transformProjectContext(mockSettingsData);

      expect(DataProcessingErrorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Error),
        DataProcessingErrorType.TRANSFORMATION,
        {
          category: 'project-context',
          operation: 'transforming project context',
          filePath: mockSettingsData.collectionMetadata.projectPath,
        },
      );

      expect(result).toBeDefined();
      expect(result.project_id).toBeDefined();
      expect(result.project_info.name).toBe('Test Project'); // From partial data
      expect(result.metadata.source_platform).toBe('kiro');
    });

    it('should throw error when project transformation error is critical', async () => {
      const mockErrorResult = {
        shouldContinue: false,
        userMessage: 'Critical project transformation error',
        errorDetails: 'Critical error details',
        suggestions: ['Contact support'],
        isCritical: true,
      };

      vi.mocked(DataProcessingErrorHandler.handleError).mockReturnValue(
        mockErrorResult,
      );
      vi.mocked(DataProcessingErrorHandler.logErrorResult).mockImplementation(
        () => {},
      );

      vi.spyOn(service as any, 'extractProjectInfo').mockRejectedValue(
        new Error('Critical project failure'),
      );

      await expect(
        service.transformProjectContext(mockSettingsData),
      ).rejects.toThrow('Critical project transformation error');
    });
  });

  describe('Prompt Templates Transformation Error Handling', () => {
    it('should handle transformation errors and return fallback templates', async () => {
      const mockErrorResult = {
        shouldContinue: true,
        userMessage: 'Transformation failed for prompt templates',
        errorDetails: 'Mock error details',
        suggestions: ['Fix the templates'],
        isCritical: false,
        partialData: {
          templates: [
            {
              id: 'partial-template',
              name: 'Partial Template',
              content: 'Partial content',
              category: 'general',
              variables: [],
              tags: [],
            },
          ],
        },
      };

      vi.mocked(DataProcessingErrorHandler.handleError).mockReturnValue(
        mockErrorResult,
      );
      vi.mocked(DataProcessingErrorHandler.logErrorResult).mockImplementation(
        () => {},
      );

      vi.spyOn(service as any, 'extractPromptTemplates').mockRejectedValue(
        new Error('Failed to extract prompt templates'),
      );

      const result = await service.transformPromptTemplates(mockSettingsData);

      expect(DataProcessingErrorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Error),
        DataProcessingErrorType.TRANSFORMATION,
        {
          category: 'prompt-templates',
          operation: 'transforming prompt templates',
          filePath: mockSettingsData.collectionMetadata.globalPath,
        },
      );

      expect(result).toBeDefined();
      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].id).toBe('partial-template');
      expect(result.metadata.source_platform).toBe('kiro');
    });

    it('should create default template when no partial data available', async () => {
      const mockErrorResult = {
        shouldContinue: true,
        userMessage: 'Transformation failed for prompt templates',
        errorDetails: 'Mock error details',
        suggestions: ['Fix the templates'],
        isCritical: false,
      };

      vi.mocked(DataProcessingErrorHandler.handleError).mockReturnValue(
        mockErrorResult,
      );
      vi.mocked(DataProcessingErrorHandler.logErrorResult).mockImplementation(
        () => {},
      );

      vi.spyOn(service as any, 'extractPromptTemplates').mockRejectedValue(
        new Error('Failed to extract prompt templates'),
      );

      const result = await service.transformPromptTemplates(mockSettingsData);

      expect(result).toBeDefined();
      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].id).toBe('default-template');
      expect(result.templates[0].name).toBe('Default Template');
      expect(result.templates[0].tags).toContain('fallback');
    });
  });

  describe('JSON Parsing Error Handling', () => {
    it('should handle JSON parsing errors and return empty object', () => {
      const invalidJson = '{"invalid": json}';
      const mockErrorResult = {
        shouldContinue: true,
        userMessage: 'JSON parsing failed',
        errorDetails: 'Unexpected token j in JSON',
        suggestions: ['Check JSON syntax'],
        isCritical: false,
      };

      vi.mocked(DataProcessingErrorHandler.handleError).mockReturnValue(
        mockErrorResult,
      );
      vi.mocked(DataProcessingErrorHandler.logErrorResult).mockImplementation(
        () => {},
      );

      const result = (service as any).parseJsonWithErrorHandling(
        invalidJson,
        '/test/file.json',
      );

      expect(DataProcessingErrorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Error),
        DataProcessingErrorType.JSON_PARSING,
        {
          operation: 'parsing JSON content',
          filePath: '/test/file.json',
          rawData: invalidJson,
        },
      );

      expect(result).toEqual({});
    });

    it('should return partial data when available from JSON parsing error', () => {
      const invalidJson = '{"valid": "data", "invalid": }';
      const mockErrorResult = {
        shouldContinue: true,
        userMessage: 'JSON parsing failed',
        errorDetails: 'Unexpected token }',
        suggestions: ['Check JSON syntax'],
        isCritical: false,
        partialData: { valid: 'data' },
      };

      vi.mocked(DataProcessingErrorHandler.handleError).mockReturnValue(
        mockErrorResult,
      );
      vi.mocked(DataProcessingErrorHandler.logErrorResult).mockImplementation(
        () => {},
      );

      const result = (service as any).parseJsonWithErrorHandling(invalidJson);

      expect(result).toEqual({ valid: 'data' });
    });
  });

  describe('Array Processing Error Handling', () => {
    it('should process array items with individual error handling', () => {
      const items = [
        { valid: true, name: 'Item 1' },
        { invalid: 'data' }, // This will cause an error
        { valid: true, name: 'Item 3' },
      ];

      const mockErrorResult = {
        shouldContinue: true,
        userMessage: 'Processing failed for item 2',
        errorDetails: 'Invalid data structure',
        suggestions: ['Fix item data'],
        isCritical: false,
      };

      vi.mocked(DataProcessingErrorHandler.handleError).mockReturnValue(
        mockErrorResult,
      );
      vi.mocked(DataProcessingErrorHandler.logErrorResult).mockImplementation(
        () => {},
      );

      const processor = (
        item: { valid?: boolean; value?: string; name?: string },
        _index: number,
      ) => {
        if (!item.valid) {
          throw new Error('Invalid item');
        }
        return { processed: true, name: item.name };
      };

      const result = (service as any).processArrayWithErrorHandling(
        items,
        processor,
        { operation: 'processing test items', category: 'test' },
      );

      expect(result.results).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.results[0].name).toBe('Item 1');
      expect(result.results[1].name).toBe('Item 3');

      expect(DataProcessingErrorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Error),
        DataProcessingErrorType.DATA_VALIDATION,
        {
          operation: 'processing test items (item 2)',
          category: 'test',
        },
      );
    });

    it('should handle all items failing gracefully', () => {
      const items = [{ invalid: 'data1' }, { invalid: 'data2' }];

      const mockErrorResult = {
        shouldContinue: true,
        userMessage: 'Processing failed',
        errorDetails: 'Invalid data structure',
        suggestions: ['Fix item data'],
        isCritical: false,
      };

      vi.mocked(DataProcessingErrorHandler.handleError).mockReturnValue(
        mockErrorResult,
      );
      vi.mocked(DataProcessingErrorHandler.logErrorResult).mockImplementation(
        () => {},
      );

      const processor = () => {
        throw new Error('All items fail');
      };

      const result = (service as any).processArrayWithErrorHandling(
        items,
        processor,
        { operation: 'processing failing items' },
      );

      expect(result.results).toHaveLength(0);
      expect(result.errors).toHaveLength(2);
      expect(DataProcessingErrorHandler.handleError).toHaveBeenCalledTimes(2);
    });
  });

  describe('Markdown Parsing Error Handling', () => {
    it('should handle markdown parsing errors in parseKiroPreferences', () => {
      const invalidMarkdown = '# Title\n\nSome content with {{invalid syntax';
      const mockErrorResult = {
        shouldContinue: true,
        userMessage: 'Markdown parsing failed',
        errorDetails: 'Invalid markdown structure',
        suggestions: ['Check markdown syntax'],
        isCritical: false,
        partialData: { partialContent: 'Some content' },
      };

      vi.mocked(DataProcessingErrorHandler.handleError).mockReturnValue(
        mockErrorResult,
      );
      vi.mocked(DataProcessingErrorHandler.logErrorResult).mockImplementation(
        () => {},
      );

      // Mock the parsing to throw an error
      const originalSplit = String.prototype.split;
      String.prototype.split = vi.fn().mockImplementation(() => {
        throw new Error('Parsing error');
      });

      const result = (service as any).parseKiroPreferences(invalidMarkdown);

      expect(DataProcessingErrorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Error),
        DataProcessingErrorType.MARKDOWN_PARSING,
        {
          operation: 'parsing Kiro preferences markdown',
          rawData: invalidMarkdown,
        },
      );

      expect(result).toEqual({ partialContent: 'Some content' });

      // Restore original method
      String.prototype.split = originalSplit;
    });
  });

  describe('Prompt Conversion Error Handling', () => {
    it('should handle invalid prompt data structure', () => {
      const mockErrorResult = {
        shouldContinue: true,
        userMessage: 'Invalid prompt data structure',
        errorDetails: 'Invalid data format',
        suggestions: ['Check data format'],
        isCritical: false,
      };

      vi.mocked(DataProcessingErrorHandler.handleError).mockReturnValue(
        mockErrorResult,
      );
      vi.mocked(DataProcessingErrorHandler.logErrorResult).mockImplementation(
        () => {},
      );

      const result = (service as any).convertKiroPromptToTaptik(null, 0);

      expect(DataProcessingErrorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Error),
        DataProcessingErrorType.INVALID_DATA_FORMAT,
        {
          operation: 'converting prompt 1',
          category: 'prompt-templates',
        },
      );

      expect(result).toBeNull();
    });

    it('should handle missing required content field', () => {
      const promptWithoutContent = {
        id: 'test-prompt',
        name: 'Test Prompt',
        // content is missing
      };

      const mockErrorResult = {
        shouldContinue: true,
        userMessage: 'Template content is empty or missing',
        errorDetails: 'Missing required field',
        suggestions: ['Add content field'],
        isCritical: false,
      };

      vi.mocked(DataProcessingErrorHandler.handleError).mockReturnValue(
        mockErrorResult,
      );
      vi.mocked(DataProcessingErrorHandler.logErrorResult).mockImplementation(
        () => {},
      );

      const result = (service as any).convertKiroPromptToTaptik(
        promptWithoutContent,
        0,
      );

      expect(DataProcessingErrorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Error),
        DataProcessingErrorType.MISSING_REQUIRED_FIELD,
        {
          operation: 'processing template "Test Prompt"',
          category: 'prompt-templates',
        },
      );

      expect(result).toBeNull();
    });
  });

  describe('Partial Success Reporting', () => {
    it('should create partial success summary for prompt processing', async () => {
      const mockPrompts = [
        { id: '1', name: 'Valid Prompt', content: 'Valid content' },
        { id: '2', name: 'Invalid Prompt' }, // Missing content
        { id: '3', name: 'Another Valid', content: 'More content' },
      ];

      const settingsWithPrompts = {
        ...mockSettingsData,
        globalSettings: {
          ...mockSettingsData.globalSettings,
          globalPrompts: mockPrompts,
        },
      };

      // Mock the array processing to simulate partial success
      const mockProcessingResult = {
        results: [
          { id: '1', name: 'Valid Prompt', content: 'Valid content' },
          { id: '3', name: 'Another Valid', content: 'More content' },
        ],
        errors: [
          {
            shouldContinue: true,
            userMessage: 'Template content is empty or missing',
            errorDetails: 'Missing required field',
            suggestions: ['Add content field'],
            isCritical: false,
          },
        ],
      };

      vi.spyOn(service as any, 'processArrayWithErrorHandling').mockReturnValue(
        mockProcessingResult,
      );

      const mockSummary = {
        successRate: 67,
        summary:
          'Processed 2/3 items successfully (67% success rate). 1 items failed.',
        failedFiles: [],
        suggestions: ['Add content field'],
      };

      vi.mocked(
        DataProcessingErrorHandler.createPartialSuccessSummary,
      ).mockReturnValue(mockSummary);

      const result = await (service as any).extractPromptTemplates(
        settingsWithPrompts,
      );

      expect(
        DataProcessingErrorHandler.createPartialSuccessSummary,
      ).toHaveBeenCalledWith(
        3, // total items
        2, // successful items
        mockProcessingResult.errors,
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Prompt conversion summary: Processed 2/3 items successfully (67% success rate). 1 items failed.',
      );

      expect(result).toHaveLength(2);
    });
  });
});
