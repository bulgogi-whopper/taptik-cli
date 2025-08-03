import { Test } from '@nestjs/testing';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { BuildCommand } from './build.command';
import {
  PlatformSelectorService,
  CategorySelectorService,
  SettingsCollectorService,
  FormatConverterService,
  OutputGeneratorService,
  LoggerService,
  SupportedPlatform,
  BuildCategory,
  BuildCommandOptions
} from './interfaces';

describe('BuildCommand', () => {
  let command: BuildCommand;
  let _platformSelector: PlatformSelectorService;
  let _categorySelector: CategorySelectorService;
  let settingsCollector: SettingsCollectorService;
  let formatConverter: FormatConverterService;
  let outputGenerator: OutputGeneratorService;
  let logger: LoggerService;

  beforeEach(async () => {
    const moduleReference = await Test.createTestingModule({
      providers: [
        BuildCommand,
        {
          provide: 'PlatformSelectorService',
          useValue: {
            selectPlatform: vi.fn(),
          },
        },
        {
          provide: 'CategorySelectorService',
          useValue: {
            selectCategories: vi.fn(),
          },
        },
        {
          provide: 'SettingsCollectorService',
          useValue: {
            collectSettings: vi.fn(),
          },
        },
        {
          provide: 'FormatConverterService',
          useValue: {
            convertToTaptikFormat: vi.fn(),
          },
        },
        {
          provide: 'OutputGeneratorService',
          useValue: {
            generateOutput: vi.fn(),
          },
        },
        {
          provide: 'LoggerService',
          useValue: {
            log: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
            info: vi.fn(),
          },
        },
      ],
    }).compile();

    command = moduleReference.get<BuildCommand>(BuildCommand);
    _platformSelector = moduleReference.get<PlatformSelectorService>('PlatformSelectorService');
    _categorySelector = moduleReference.get<CategorySelectorService>('CategorySelectorService');
    settingsCollector = moduleReference.get<SettingsCollectorService>('SettingsCollectorService');
    formatConverter = moduleReference.get<FormatConverterService>('FormatConverterService');
    outputGenerator = moduleReference.get<OutputGeneratorService>('OutputGeneratorService');
    logger = moduleReference.get<LoggerService>('LoggerService');
  });

  describe('validatePlatform', () => {
    it('should validate supported platforms', () => {
      expect(() => command['validatePlatform']('kiro')).not.toThrow();
      expect(() => command['validatePlatform']('cursor')).not.toThrow();
      expect(() => command['validatePlatform']('claude_code')).not.toThrow();
    });

    it('should throw error for unsupported platform', () => {
      expect(() => command['validatePlatform']('invalid')).toThrow('Invalid platform: invalid');
    });

    it('should handle case insensitive platform names', () => {
      expect(command['validatePlatform']('KIRO')).toBe(SupportedPlatform.KIRO);
      expect(command['validatePlatform']('Cursor')).toBe(SupportedPlatform.CURSOR);
    });
  });

  describe('parseCategories', () => {
    it('should parse valid categories', () => {
      const result = command['parseCategories']('personal,project,prompts');
      expect(result).toEqual([
        BuildCategory.PERSONAL_CONTEXT,
        BuildCategory.PROJECT_CONTEXT,
        BuildCategory.PROMPT_TEMPLATES
      ]);
    });

    it('should handle whitespace in category list', () => {
      const result = command['parseCategories']('personal, project , prompts');
      expect(result).toEqual([
        BuildCategory.PERSONAL_CONTEXT,
        BuildCategory.PROJECT_CONTEXT,
        BuildCategory.PROMPT_TEMPLATES
      ]);
    });

    it('should throw error for invalid category', () => {
      expect(() => command['parseCategories']('invalid,personal')).toThrow('Invalid category: invalid');
    });
  });

  describe('generateBuildId', () => {
    it('should generate unique build IDs', () => {
      const id1 = command['generateBuildId']();
      const id2 = command['generateBuildId']();
      
      expect(id1).toMatch(/^build-\d{4}(?:-\d{2}){2}T(?:\d{2}-){3}\d{3}Z-[\da-z]{6}$/);
      expect(id2).toMatch(/^build-\d{4}(?:-\d{2}){2}T(?:\d{2}-){3}\d{3}Z-[\da-z]{6}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('run', () => {
    it('should handle options-based execution', async () => {
      const options: BuildCommandOptions = {
        source: 'kiro',
        include: 'personal,project',
        verbose: true
      };

      const mockCollectedSettings = {
        local: {},
        global: {},
        metadata: {
          platform: 'kiro',
          categories: ['personal', 'project'],
          collectedAt: new Date(),
          sourceFiles: { local: [], global: [] }
        }
      };

      const mockConvertedOutput = {
        personalContext: {
          category: 'personal' as const,
          spec_version: '1.0.0',
          data: {
            developer_profile: {
              experience_level: 'senior' as const,
              primary_languages: ['typescript'],
              specializations: [],
              preferred_tools: []
            },
            coding_preferences: {
              code_style: {
                indentation: 'spaces' as const,
                indent_size: 2,
                line_length: 100,
                naming_convention: 'camelCase'
              },
              testing_approach: 'TDD',
              documentation_style: 'JSDoc',
              error_handling_strategy: 'explicit'
            },
            domain_knowledge: [],
            communication_style: {
              verbosity: 'detailed' as const,
              explanation_depth: 'advanced' as const,
              code_comments: 'moderate' as const,
              preferred_examples: true
            }
          }
        }
      };

      const mockBuildResult = {
        outputDirectory: '/tmp/build-output',
        files: [],
        manifest: {
          build_id: 'test-build-id',
          source_platform: 'kiro',
          categories: ['personal', 'project'],
          created_at: new Date().toISOString(),
          taptik_version: '1.0.0',
          source_files: { local: [], global: [] },
          conversion_metadata: {
            total_files_processed: 0,
            successful_conversions: 0,
            warnings: 0,
            errors: 0,
            processing_time_ms: 0
          }
        },
        summary: {
          success: true,
          totalFiles: 0,
          totalSize: 0,
          categories: ['personal', 'project'],
          warnings: [],
          errors: [],
          outputPath: '/tmp/build-output'
        }
      };

      vi.mocked(settingsCollector.collectSettings).mockResolvedValue(mockCollectedSettings);
      vi.mocked(formatConverter.convertToTaptikFormat).mockResolvedValue(mockConvertedOutput);
      vi.mocked(outputGenerator.generateOutput).mockResolvedValue(mockBuildResult);

      await expect(command.run([], options)).resolves.not.toThrow();

      expect(logger.info).toHaveBeenCalledWith('Verbose logging enabled');
      expect(logger.info).toHaveBeenCalledWith('Using specified platform: kiro');
      expect(logger.info).toHaveBeenCalledWith('Using specified categories: personal, project');
    });

    it('should handle errors gracefully', async () => {
      const options: BuildCommandOptions = {
        source: 'kiro',
        include: 'personal'
      };

      vi.mocked(settingsCollector.collectSettings).mockRejectedValue(new Error('Collection failed'));

      await expect(command.run([], options)).rejects.toThrow('Collection failed');
      expect(logger.error).toHaveBeenCalledWith('Build failed: Collection failed');
    });

    it('should validate empty categories', async () => {
      const options: BuildCommandOptions = {
        source: 'kiro',
        include: 'personal',
        exclude: 'personal'
      };

      await expect(command.run([], options)).rejects.toThrow('No categories selected for processing');
    });
  });
});