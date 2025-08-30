import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CursorValidatorService } from './cursor-validator.service';
import { CursorContentValidatorService } from './cursor-content-validator.service';
import { CursorSchemaValidatorService } from './cursor-schema-validator.service';
import { CursorExtensionValidatorService } from './cursor-extension-validator.service';
import { CursorTransformationResult } from './cursor-transformer.service';
import {
  CursorGlobalSettings,
  CursorProjectSettings,
  CursorAIConfig,
  CursorExtensionsConfig,
  CursorDebugConfig,
  CursorTasksConfig,
  CursorSnippetsConfig,
  CursorWorkspaceConfig,
} from '../interfaces/cursor-config.interface';

describe('CursorValidatorService', () => {
  let service: CursorValidatorService;
  let contentValidator: CursorContentValidatorService;
  let schemaValidator: CursorSchemaValidatorService;
  let extensionValidator: CursorExtensionValidatorService;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CursorValidatorService,
        {
          provide: Logger,
          useValue: {
            debug: vi.fn(),
            log: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            verbose: vi.fn(),
          },
        },
        {
          provide: CursorContentValidatorService,
          useValue: {
            validateAIContent: vi.fn().mockResolvedValue({
              valid: true,
              errors: [],
              warnings: [],
            }),
          },
        },
        {
          provide: CursorSchemaValidatorService,
          useValue: {
            validateGlobalSettings: vi.fn().mockResolvedValue({
              valid: true,
              errors: [],
              warnings: [],
            }),
            validateProjectSettings: vi.fn().mockResolvedValue({
              valid: true,
              errors: [],
              warnings: [],
            }),
          },
        },
        {
          provide: CursorExtensionValidatorService,
          useValue: {
            validateExtensionCompatibility: vi.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<CursorValidatorService>(CursorValidatorService);
    contentValidator = module.get<CursorContentValidatorService>(CursorContentValidatorService);
    schemaValidator = module.get<CursorSchemaValidatorService>(CursorSchemaValidatorService);
    extensionValidator = module.get<CursorExtensionValidatorService>(CursorExtensionValidatorService);
    logger = module.get<Logger>(Logger);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateConfiguration', () => {
    it('should validate complete configuration successfully', async () => {
      const mockConfig: CursorTransformationResult = {
        globalSettings: {
          editor: {
            fontSize: 14,
            theme: 'dark',
            fontFamily: 'Consolas',
            tabSize: 2,
            insertSpaces: true,
            autoSave: 'afterDelay',
            formatOnSave: true,
          },
          workbench: {
            colorTheme: 'dark',
            iconTheme: 'vscode-icons',
            startupEditor: 'welcomePage',
          },
          files: {
            autoSave: 'afterDelay',
            autoSaveDelay: 1000,
            exclude: {},
          },
          terminal: {
            integrated: {
              shell: {
                osx: '/bin/zsh',
              },
            },
          },
        },
        projectSettings: {
          folders: [],
          search: {
            exclude: {},
          },
          files: {
            associations: {},
            exclude: {},
          },
          typescript: {
            preferences: {
              quoteStyle: 'single',
            },
          },
        },
        aiConfig: {
          rules: [
            {
              id: 'test-rule',
              name: 'Test Rule',
              content: 'Test content',
              enabled: true,
              priority: 5,
              scope: 'workspace',
            },
          ],
          contextFiles: [
            {
              id: 'test-context',
              name: 'Test Context',
              content: 'Test context content',
              description: 'Test context description',
              type: 'custom',
              enabled: true,
              priority: 5,
              scope: 'workspace',
            },
          ],
          prompts: [
            {
              id: 'test-prompt',
              name: 'Test Prompt',
              content: 'Test prompt content',
              description: 'Test prompt description',
              enabled: true,
              priority: 5,
              scope: 'workspace',
            },
          ],
        },
        extensionsConfig: {
          recommendations: ['esbenp.prettier-vscode'],
          unwantedRecommendations: [],
        },
        debugConfig: {
          version: '0.2.0',
          configurations: [
            {
              name: 'Launch Node',
              type: 'node',
              request: 'launch',
              program: '${workspaceFolder}/app.js',
            },
          ],
        },
        tasksConfig: {
          version: '2.0.0',
          tasks: [
            {
              label: 'Build',
              type: 'npm',
              script: 'build',
              group: 'build',
            },
          ],
        },
        snippetsConfig: {
          typescript: {
            'test-snippet': {
              prefix: 'test',
              body: ['console.log("test");'],
              description: 'Test snippet',
            },
          },
        },
        workspaceConfig: {
          name: 'Test Workspace',
          folders: [
            {
              name: 'Source',
              path: './src',
            },
          ],
          settings: {
            'editor.fontSize': 14,
          },
        },
        warnings: [],
        statistics: {
          transformedComponents: 8,
          mappingsApplied: 10,
          warningsCount: 0,
          errors: 0,
          transformationTime: 1000,
          contentSize: {
            original: 1000,
            transformed: 1200,
            compressionRatio: 0.8,
          },
        },
        transformationLog: [],
      };

      const result = await service.validateConfiguration(mockConfig);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.statistics.totalComponents).toBe(8);
      expect(result.statistics.validatedComponents).toBe(8);
    });

    it('should handle validation errors properly', async () => {
      const mockConfig: CursorTransformationResult = {
        globalSettings: {
          editor: {
            fontSize: -1, // Invalid font size
            theme: 'dark',
            fontFamily: 'Consolas',
            tabSize: 2,
            insertSpaces: true,
            autoSave: 'afterDelay',
            formatOnSave: true,
          },
          workbench: {},
          files: {},
          terminal: {},
        },
        warnings: [],
        statistics: {
          transformedComponents: 1,
          mappingsApplied: 0,
          warningsCount: 0,
          errors: 0,
          transformationTime: 100,
          contentSize: {
            original: 100,
            transformed: 120,
            compressionRatio: 0.8,
          },
        },
        transformationLog: [],
      };

      const result = await service.validateConfiguration(mockConfig);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].code).toBe('INVALID_FONT_SIZE');
      expect(result.errors[0].severity).toBe('low');
    });

    it('should validate AI configuration with security scanning', async () => {
      const mockConfig: CursorTransformationResult = {
        aiConfig: {
          rules: [
            {
              id: '', // This should trigger validation error
              name: 'Test Rule', 
              content: 'Test content',
              enabled: true,
              priority: 5,
              scope: 'workspace',
            },
          ],
          contextFiles: [],
          prompts: [],
        },
        warnings: [],
        statistics: {
          transformedComponents: 1,
          mappingsApplied: 0,
          warningsCount: 0,
          errors: 0,
          transformationTime: 100,
          contentSize: {
            original: 100,
            transformed: 120,
            compressionRatio: 0.8,
          },
        },
        transformationLog: [],
      };

      contentValidator.validateAIContent = vi.fn().mockResolvedValue({
        valid: false,
        errors: ['Security violation detected'],
        warnings: ['Suspicious pattern found'],
      });

      const result = await service.validateConfiguration(mockConfig);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.statistics.securityIssues).toBeGreaterThanOrEqual(0);
    });

    it('should validate extension compatibility', async () => {
      const mockConfig: CursorTransformationResult = {
        extensionsConfig: {
          recommendations: ['invalid-extension-id', 'valid.extension'],
          unwantedRecommendations: [],
        },
        warnings: [],
        statistics: {
          transformedComponents: 1,
          mappingsApplied: 0,
          warningsCount: 0,
          errors: 0,
          transformationTime: 100,
          contentSize: {
            original: 100,
            transformed: 120,
            compressionRatio: 0.8,
          },
        },
        transformationLog: [],
      };

      extensionValidator.validateExtensionCompatibility = vi.fn()
        .mockResolvedValue(false); // Extension incompatible

      const result = await service.validateConfiguration(mockConfig);

      expect(result).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0); // Invalid extension ID error
      expect(result.warnings.length).toBeGreaterThan(0); // Compatibility warning
      expect(result.statistics.compatibilityIssues).toBeGreaterThanOrEqual(0);
    });
  });

  describe('validateComponent', () => {
    it('should validate global settings component', async () => {
      const mockGlobalSettings: CursorGlobalSettings = {
        editor: {
          fontSize: 14,
          theme: 'dark',
          fontFamily: 'Consolas',
          tabSize: 2,
          insertSpaces: true,
          autoSave: 'afterDelay',
          formatOnSave: true,
        },
        workbench: {
          colorTheme: 'dark',
          iconTheme: 'vscode-icons',
          startupEditor: 'welcomePage',
        },
        files: {
          autoSave: 'afterDelay',
          autoSaveDelay: 1000,
          exclude: {},
        },
        terminal: {
          integrated: {
            shell: {
              osx: '/bin/zsh',
            },
          },
        },
      };

      const result = await service.validateComponent('globalSettings', mockGlobalSettings);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
      expect(result.statistics.totalComponents).toBe(1);
      expect(result.statistics.validatedComponents).toBe(1);
    });

    it('should validate AI config component with missing fields', async () => {
      const mockAIConfig: CursorAIConfig = {
        rules: [
          {
            id: '', // Missing ID
            name: 'Test Rule',
            content: '', // Missing content
            enabled: true,
            priority: 5,
            scope: 'workspace',
          },
        ],
        contextFiles: [],
        prompts: [],
      };

      const result = await service.validateComponent('aiConfig', mockAIConfig);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'MISSING_AI_RULE_ID')).toBe(true);
      expect(result.errors.some(e => e.code === 'MISSING_AI_RULE_CONTENT')).toBe(true);
    });

    it('should validate debug configuration component', async () => {
      const mockDebugConfig: CursorDebugConfig = {
        version: '0.2.0',
        configurations: [
          {
            name: 'Launch Node',
            type: 'node',
            request: 'launch',
            program: '${workspaceFolder}/app.js',
          },
          {
            name: 'Invalid Config',
            type: '', // Missing type
            request: 'invalid', // Invalid request
          },
        ],
      };

      const result = await service.validateComponent('debugConfig', mockDebugConfig);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'MISSING_DEBUG_CONFIG_TYPE')).toBe(true);
      expect(result.errors.some(e => e.code === 'INVALID_DEBUG_CONFIG_REQUEST')).toBe(true);
    });

    it('should validate tasks configuration component', async () => {
      const mockTasksConfig: CursorTasksConfig = {
        version: '2.0.0',
        tasks: [
          {
            label: 'Valid Task',
            type: 'npm',
            script: 'build',
            group: 'build',
          },
          {
            label: '', // Missing label
            type: 'unknown-type', // Unknown type
          },
        ],
      };

      const result = await service.validateComponent('tasksConfig', mockTasksConfig);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_TASK_LABEL')).toBe(true);
      expect(result.warnings.some(w => w.code === 'UNKNOWN_TASK_TYPE')).toBe(true);
    });

    it('should validate snippets configuration component', async () => {
      const mockSnippetsConfig: CursorSnippetsConfig = {
        typescript: {
          'valid-snippet': {
            prefix: 'valid',
            body: ['console.log("valid");'],
            description: 'Valid snippet',
          },
          'invalid-snippet': {
            prefix: '', // Missing prefix
            body: 'invalid body', // Invalid body format
          },
        },
      };

      const result = await service.validateComponent('snippetsConfig', mockSnippetsConfig);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_SNIPPET_PREFIX')).toBe(true);
      expect(result.errors.some(e => e.code === 'MISSING_SNIPPET_BODY')).toBe(true);
    });

    it('should validate workspace configuration component', async () => {
      const mockWorkspaceConfig: CursorWorkspaceConfig = {
        name: 'Test Workspace',
        folders: [
          {
            name: 'Source',
            path: './src',
          },
          {
            name: 123, // Invalid name type
            path: '', // Missing path
          },
        ],
        settings: {
          'editor.fontSize': 14,
          '../suspicious': 'value', // Suspicious setting key
        },
      };

      const result = await service.validateComponent('workspaceConfig', mockWorkspaceConfig);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_FOLDER_NAME')).toBe(true);
      expect(result.errors.some(e => e.code === 'MISSING_FOLDER_PATH')).toBe(true);
      expect(result.warnings.some(w => w.code === 'SUSPICIOUS_SETTING_KEY')).toBe(true);
    });

    it('should handle unknown component type', async () => {
      const result = await service.validateComponent('unknownComponent', {});

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].code).toBe('UNKNOWN_COMPONENT');
    });
  });

  describe('validation options', () => {
    it('should skip security scan when requested', async () => {
      const mockConfig: CursorTransformationResult = {
        aiConfig: {
          rules: [],
          contextFiles: [],
          prompts: [],
        },
        warnings: [],
        statistics: {
          transformedComponents: 1,
          mappingsApplied: 0,
          warningsCount: 0,
          errors: 0,
          transformationTime: 100,
          contentSize: {
            original: 100,
            transformed: 120,
            compressionRatio: 0.8,
          },
        },
        transformationLog: [],
      };

      await service.validateConfiguration(mockConfig, { skipSecurityScan: true });

      expect(contentValidator.validateAIContent).not.toHaveBeenCalled();
    });

    it('should skip compatibility check when requested', async () => {
      const mockConfig: CursorTransformationResult = {
        extensionsConfig: {
          recommendations: ['test.extension'],
          unwantedRecommendations: [],
        },
        warnings: [],
        statistics: {
          transformedComponents: 1,
          mappingsApplied: 0,
          warningsCount: 0,
          errors: 0,
          transformationTime: 100,
          contentSize: {
            original: 100,
            transformed: 120,
            compressionRatio: 0.8,
          },
        },
        transformationLog: [],
      };

      await service.validateConfiguration(mockConfig, { skipCompatibilityCheck: true });

      expect(extensionValidator.validateExtensionCompatibility).not.toHaveBeenCalled();
    });

    it('should validate version compatibility when target version provided', async () => {
      const mockConfig: CursorTransformationResult = {
        debugConfig: {
          version: '0.2.0',
          configurations: [],
        },
        tasksConfig: {
          version: '2.0.0',
          tasks: [],
        },
        warnings: [],
        statistics: {
          transformedComponents: 2,
          mappingsApplied: 0,
          warningsCount: 0,
          errors: 0,
          transformationTime: 100,
          contentSize: {
            original: 100,
            transformed: 120,
            compressionRatio: 0.8,
          },
        },
        transformationLog: [],
      };

      const result = await service.validateConfiguration(mockConfig, { 
        targetCursorVersion: '1.50.0' 
      });

      expect(result).toBeDefined();
      expect(result.validationLog.some(log => log.component === 'compatibility')).toBe(true);
    });
  });

  describe('error and warning handling', () => {
    it('should categorize errors by severity', async () => {
      const mockConfig: CursorTransformationResult = {
        globalSettings: {
          editor: {
            fontSize: -1, // Low severity error
            theme: 'dark',
            fontFamily: 'Consolas',
            tabSize: 2,
            insertSpaces: true,
            autoSave: 'afterDelay',
            formatOnSave: true,
          },
          workbench: {},
          files: {},
          terminal: {},
        },
        debugConfig: {
          version: '', // High severity error
          configurations: [],
        },
        warnings: [],
        statistics: {
          transformedComponents: 2,
          mappingsApplied: 0,
          warningsCount: 0,
          errors: 0,
          transformationTime: 100,
          contentSize: {
            original: 100,
            transformed: 120,
            compressionRatio: 0.8,
          },
        },
        transformationLog: [],
      };

      const result = await service.validateConfiguration(mockConfig);

      expect(result).toBeDefined();
      expect(result.errors.some(e => e.severity === 'low')).toBe(true);
      expect(result.errors.some(e => e.severity === 'high')).toBe(true);
    });

    it('should provide helpful suggestions for errors', async () => {
      const mockConfig: CursorTransformationResult = {
        extensionsConfig: {
          recommendations: ['invalid-format'],
          unwantedRecommendations: [],
        },
        warnings: [],
        statistics: {
          transformedComponents: 1,
          mappingsApplied: 0,
          warningsCount: 0,
          errors: 0,
          transformationTime: 100,
          contentSize: {
            original: 100,
            transformed: 120,
            compressionRatio: 0.8,
          },
        },
        transformationLog: [],
      };

      const result = await service.validateConfiguration(mockConfig);

      expect(result).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].suggestion).toContain('Use proper publisher.name format');
    });

    it('should handle validation service failures gracefully', async () => {
      const mockConfig: CursorTransformationResult = {
        aiConfig: {
          rules: [],
          contextFiles: [],
          prompts: [],
        },
        warnings: [],
        statistics: {
          transformedComponents: 1,
          mappingsApplied: 0,
          warningsCount: 0,
          errors: 0,
          transformationTime: 100,
          contentSize: {
            original: 100,
            transformed: 120,
            compressionRatio: 0.8,
          },
        },
        transformationLog: [],
      };

      contentValidator.validateAIContent = vi.fn().mockRejectedValue(new Error('Validation service failed'));

      const result = await service.validateConfiguration(mockConfig);

      expect(result).toBeDefined();
      expect(result.warnings.some(w => w.message.includes('AI content validation failed'))).toBe(true);
    });
  });

  describe('validation statistics', () => {
    it('should track validation statistics correctly', async () => {
      const mockConfig: CursorTransformationResult = {
        globalSettings: {
          editor: { fontSize: 14, theme: 'dark', fontFamily: 'Consolas', tabSize: 2, insertSpaces: true, autoSave: 'afterDelay', formatOnSave: true },
          workbench: {},
          files: {},
          terminal: {},
        },
        projectSettings: {
          folders: [],
          search: { exclude: {} },
          files: { associations: {}, exclude: {} },
        },
        warnings: [],
        statistics: {
          transformedComponents: 2,
          mappingsApplied: 0,
          warningsCount: 0,
          errors: 0,
          transformationTime: 100,
          contentSize: {
            original: 100,
            transformed: 120,
            compressionRatio: 0.8,
          },
        },
        transformationLog: [],
      };

      const result = await service.validateConfiguration(mockConfig);

      expect(result).toBeDefined();
      expect(result.statistics.totalComponents).toBe(2);
      expect(result.statistics.validatedComponents).toBe(2);
      expect(result.statistics.errorCount).toBe(result.errors.length);
      expect(result.statistics.warningCount).toBe(result.warnings.length);
      expect(result.statistics.validationTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('validation logging', () => {
    it('should create validation log entries', async () => {
      const mockConfig: CursorTransformationResult = {
        globalSettings: {
          editor: { fontSize: 14, theme: 'dark', fontFamily: 'Consolas', tabSize: 2, insertSpaces: true, autoSave: 'afterDelay', formatOnSave: true },
          workbench: {},
          files: {},
          terminal: {},
        },
        warnings: [],
        statistics: {
          transformedComponents: 1,
          mappingsApplied: 0,
          warningsCount: 0,
          errors: 0,
          transformationTime: 100,
          contentSize: {
            original: 100,
            transformed: 120,
            compressionRatio: 0.8,
          },
        },
        transformationLog: [],
      };

      const result = await service.validateConfiguration(mockConfig);

      expect(result).toBeDefined();
      expect(result.validationLog).toBeDefined();
      expect(result.validationLog.length).toBeGreaterThan(0);
      expect(result.validationLog[0].message).toContain('Starting configuration validation');
      expect(result.validationLog[result.validationLog.length - 1].message).toContain('Configuration validation completed');
    });
  });
});