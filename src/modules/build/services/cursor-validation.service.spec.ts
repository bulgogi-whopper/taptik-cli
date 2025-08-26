/**
 * Tests for CursorValidationService
 */

import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { describe, it, expect, beforeEach } from 'vitest';

import {
  VSCodeSettings,
  CursorAiConfiguration,
  CursorSettingsData,
} from '../interfaces/cursor-ide.interfaces';

import { CursorValidationService } from './cursor-validation.service';

describe('CursorValidationService', () => {
  let service: CursorValidationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CursorValidationService,
        {
          provide: Logger,
          useValue: {
            log: () => {},
            warn: () => {},
            error: () => {},
            debug: () => {},
          },
        },
      ],
    }).compile();

    service = module.get<CursorValidationService>(CursorValidationService);
  });

  describe('validateVSCodeSchema', () => {
    it('should validate valid VS Code settings', async () => {
      const settings: VSCodeSettings = {
        'editor.fontSize': 14,
        'editor.fontFamily': 'JetBrains Mono',
        'editor.tabSize': 2,
        'editor.wordWrap': 'on',
        'files.autoSave': 'afterDelay',
        'files.autoSaveDelay': 1000,
      };

      const result = await service.validateVSCodeSchema(settings);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect Cursor-specific settings', async () => {
      const settings: VSCodeSettings = {
        'editor.fontSize': 14,
        'cursor.aiProvider': 'openai',
        'cursor.aiModel': 'gpt-4',
        'cursor.temperature': 0.7,
      };

      const result = await service.validateVSCodeSchema(settings);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(3); // 3 Cursor-specific settings
      expect(result.warnings[0].code).toBe('CURSOR_SPECIFIC');
    });

    it('should detect type mismatches', async () => {
      const settings: VSCodeSettings = {
        'editor.fontSize': 'not-a-number' as any,
        'editor.insertSpaces': 'not-a-boolean' as any,
      };

      const result = await service.validateVSCodeSchema(settings);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].code).toBe('TYPE_MISMATCH');
    });

    it('should detect invalid enum values', async () => {
      const settings: VSCodeSettings = {
        'editor.wordWrap': 'invalid-value' as any,
        'files.autoSave': 'invalid-option' as any,
      };

      const result = await service.validateVSCodeSchema(settings);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].code).toBe('INVALID_ENUM_VALUE');
    });

    it('should detect out-of-range values', async () => {
      const settings: VSCodeSettings = {
        'editor.fontSize': 200, // Too large
        'editor.tabSize': 0, // Too small
      };

      const result = await service.validateVSCodeSchema(settings);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].code).toBe('VALUE_TOO_LARGE');
      expect(result.errors[1].code).toBe('VALUE_TOO_SMALL');
    });
  });

  describe('sanitizeAiConfiguration', () => {
    it('should remove API keys from AI configuration', async () => {
      const config: CursorAiConfiguration = {
        version: '1.0.0',
        modelConfig: {
          provider: 'openai',
          model: 'gpt-4',
          // @ts-expect-error - Testing sanitization
          apiKey: 'sk-secret-key-123',
        },
        rules: [
          {
            name: 'Test Rule',
            pattern: '*.ts',
            prompt: 'Test prompt',
            apiKey: 'another-secret',
          },
        ],
        apiKeys: {
          openai: 'sk-openai-key',
          anthropic: 'sk-anthropic-key',
        },
        tokens: {
          github: 'ghp_token',
        },
      };

      const result = await service.sanitizeAiConfiguration(config);

      expect(result.sanitized.modelConfig).toBeDefined();
      expect((result.sanitized.modelConfig as any).apiKey).toBeUndefined();
      expect(result.sanitized.rules?.[0].apiKey).toBeUndefined();
      expect(result.sanitized.apiKeys).toBeUndefined();
      expect(result.sanitized.tokens).toBeUndefined();

      expect(result.report.hasApiKeys).toBe(true);
      expect(result.report.hasTokens).toBe(true);
      expect(result.report.securityLevel).toBe('unsafe');
      expect(result.report.filteredFields).toContain('modelConfig.apiKey');
    });

    it('should filter sensitive data from prompts', async () => {
      const config: CursorAiConfiguration = {
        version: '1.0.0',
        globalPrompts: {
          apiPrompt: 'Use this API key: sk-1234567890abcdef',
          normalPrompt: 'This is a normal prompt',
          tokenPrompt: 'Bearer eyJhbGciOiJIUzI1NiIs',
        },
      };

      const result = await service.sanitizeAiConfiguration(config);

      expect(result.sanitized.globalPrompts?.apiPrompt).toBe('[FILTERED: Contains sensitive data]');
      expect(result.sanitized.globalPrompts?.normalPrompt).toBe('This is a normal prompt');
      expect(result.sanitized.globalPrompts?.tokenPrompt).toBe('[FILTERED: Contains sensitive data]');
      expect(result.report.hasSensitiveData).toBe(true);
    });

    it('should report safe configuration when no sensitive data', async () => {
      const config: CursorAiConfiguration = {
        version: '1.0.0',
        modelConfig: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.7,
        },
        rules: [
          {
            name: 'Test Rule',
            pattern: '*.ts',
            prompt: 'Generate documentation',
          },
        ],
      };

      const result = await service.sanitizeAiConfiguration(config);

      expect(result.report.hasApiKeys).toBe(false);
      expect(result.report.hasTokens).toBe(false);
      expect(result.report.securityLevel).toBe('safe');
      expect(result.report.filteredFields).toHaveLength(0);
    });

    it('should handle complex nested AI configurations', async () => {
      const config: CursorAiConfiguration = {
        version: '1.0.0',
        modelConfig: {
          provider: 'azure',
          model: 'gpt-4-turbo',
          temperature: 0.5,
          // @ts-expect-error - Testing nested structure
          nested: {
            apiKey: 'nested-secret-key',
            endpoint: 'https://azure.openai.com',
          },
        },
        credentials: {
          azure: {
            key: 'azure-key-123',
            endpoint: 'https://api.azure.com',
          },
        },
        security: {
          allowPublicCodeSuggestions: false,
          filterSensitiveData: true,
        },
      };

      const result = await service.sanitizeAiConfiguration(config);

      expect(result.sanitized.credentials).toBeUndefined();
      expect(result.sanitized.security).toBeDefined();
      expect(result.report.hasApiKeys).toBe(true);
      expect(result.report.securityLevel).toBe('unsafe');
      expect(result.report.filteredFields).toContain('credentials');
    });

    it('should filter environment variables containing secrets', async () => {
      const config: CursorAiConfiguration = {
        version: '1.0.0',
        // @ts-expect-error - Testing environment variables
        environment: {
          OPENAI_API_KEY: 'sk-1234567890abcdef', // Matches the sk- pattern  
          NODE_ENV: 'production',
          GITHUB_TOKEN: 'ghp_12345678901234567890', // Matches ghp_ pattern
        },
      };

      const result = await service.sanitizeAiConfiguration(config);

      // The environment property should be filtered out
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.sanitized as any).environment).toBeUndefined();
      // Security level should be unsafe due to API key
      expect(result.report.securityLevel).toBe('unsafe');
      // Should have security recommendations  
      expect(result.report.hasApiKeys).toBe(true);
      expect(result.report.filteredFields).toContain('environment');
    });
  });

  describe('checkExtensionCompatibility', () => {
    it('should identify compatible extensions', async () => {
      const extensions = [
        'dbaeumer.vscode-eslint',
        'esbenp.prettier-vscode',
        'ms-vscode.typescript-language-features',
      ];

      const result = await service.checkExtensionCompatibility(extensions);

      expect(result.vsCodeCompatible).toBe(true);
      expect(result.incompatibleExtensions).toHaveLength(0);
      expect(result.migrationSuggestions).toHaveLength(0);
    });

    it('should identify incompatible Cursor-specific extensions', async () => {
      const extensions = [
        'cursor.cursor-ai',
        'dbaeumer.vscode-eslint',
      ];

      const result = await service.checkExtensionCompatibility(extensions);

      expect(result.vsCodeCompatible).toBe(false);
      expect(result.incompatibleExtensions).toContain('cursor.cursor-ai');
      expect(result.migrationSuggestions.length).toBeGreaterThan(0);
    });

    it('should handle unknown extensions', async () => {
      const extensions = [
        'unknown.extension',
        'another.unknown',
      ];

      const result = await service.checkExtensionCompatibility(extensions);

      // Unknown extensions are considered compatible by default
      expect(result.vsCodeCompatible).toBe(true);
      expect(result.incompatibleExtensions).toHaveLength(0);
    });
  });

  describe('generateSecurityReport', () => {
    it('should detect API keys in settings', async () => {
      const data: CursorSettingsData = {
        settings: {
          'cursor.apiKey': 'sk-1234567890abcdef',
          'editor.fontSize': 14,
        },
        sourcePath: '/test',
        collectedAt: new Date().toISOString(),
        isGlobal: false,
      };

      const report = await service.generateSecurityReport(data);

      expect(report.hasApiKeys).toBe(true);
      expect(report.securityLevel).toBe('unsafe');
      expect(report.recommendations).toContain('CRITICAL: Remove all API keys and tokens before sharing');
    });

    it('should detect tokens in launch configuration', async () => {
      const data: CursorSettingsData = {
        workspace: {
          launch: {
            version: '0.2.0',
            configurations: [
              {
                type: 'node',
                request: 'launch',
                name: 'Test',
                env: {
                  API_TOKEN: 'Bearer eyJhbGciOiJIUzI1NiIs',
                },
              },
            ],
          },
        },
        sourcePath: '/test',
        collectedAt: new Date().toISOString(),
        isGlobal: false,
      };

      const report = await service.generateSecurityReport(data);

      expect(report.hasSensitiveData).toBe(true);
      expect(report.filteredFields).toContain('workspace.launch');
    });

    it('should report safe configuration', async () => {
      const data: CursorSettingsData = {
        settings: {
          'editor.fontSize': 14,
          'editor.fontFamily': 'JetBrains Mono',
        },
        extensions: {
          recommendations: ['dbaeumer.vscode-eslint'],
        },
        sourcePath: '/test',
        collectedAt: new Date().toISOString(),
        isGlobal: false,
      };

      const report = await service.generateSecurityReport(data);

      expect(report.hasApiKeys).toBe(false);
      expect(report.hasTokens).toBe(false);
      expect(report.securityLevel).toBe('safe');
      expect(report.recommendations).toContain('Configuration appears safe for sharing');
    });
  });

  describe('filterSensitiveData', () => {
    it('should filter fields with sensitive key names', async () => {
      const data = {
        apiKey: 'secret-key',
        api_key: 'another-secret',
        password: 'my-password',
        token: 'auth-token',
        normalField: 'normal-value',
      };

      const filtered = await service.filterSensitiveData(data);

      expect(filtered.apiKey).toBeUndefined();
      expect(filtered.api_key).toBeUndefined();
      expect(filtered.password).toBeUndefined();
      expect(filtered.token).toBeUndefined();
      expect(filtered.normalField).toBe('normal-value');
    });

    it('should filter sensitive values', async () => {
      const data = {
        config: {
          openaiKey: 'sk-1234567890abcdef1234567890abcdef',
          githubToken: 'ghp_1234567890123456789012345678901234567890',
          normalValue: 'This is normal text',
        },
      };

      const filtered = await service.filterSensitiveData(data);

      // Values containing sensitive patterns are replaced with [FILTERED]
      expect((filtered.config as any).openaiKey).toBe('[FILTERED]');
      expect((filtered.config as any).githubToken).toBeUndefined(); // Deleted because key contains "Token"
      expect((filtered.config as any).normalValue).toBe('This is normal text');
    });

    it('should handle nested objects', async () => {
      const data = {
        level1: {
          level2: {
            level3: {
              apiKey: 'secret',
              normalField: 'value',
            },
          },
        },
      };

      const filtered = await service.filterSensitiveData(data);

      expect((filtered.level1 as any).level2.level3.apiKey).toBeUndefined();
      expect((filtered.level1 as any).level2.level3.normalField).toBe('value');
    });
  });

  describe('validateCursorConfiguration', () => {
    it('should validate complete configuration', async () => {
      const data: CursorSettingsData = {
        settings: {
          'editor.fontSize': 14,
          'editor.wordWrap': 'on',
          'cursor.aiProvider': 'openai', // Cursor-specific
        },
        extensions: {
          recommendations: [
            'dbaeumer.vscode-eslint',
            'cursor.cursor-ai', // Incompatible
          ],
        },
        sourcePath: '/test',
        collectedAt: new Date().toISOString(),
        isGlobal: false,
      };

      const result = await service.validateCursorConfiguration(data);

      expect(result.isValid).toBe(true); // No critical errors
      expect(result.warnings.length).toBeGreaterThan(0); // Has warnings
      expect(result.securityReport).toBeDefined();
      expect(result.compatibilityReport).toBeDefined();
      expect(result.compatibilityReport?.incompatibleExtensions).toContain('cursor.cursor-ai');
    });

    it('should detect security warnings with sensitive data', async () => {
      const data: CursorSettingsData = {
        settings: {
          'cursor.apiKey': 'sk-secret-key-123',
        },
        sourcePath: '/test',
        collectedAt: new Date().toISOString(),
        isGlobal: false,
      };

      const result = await service.validateCursorConfiguration(data);

      // Security issues generate warnings, not errors (to allow user choice)
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'CURSOR_SPECIFIC' || w.code === 'SECURITY_WARNING')).toBe(true);
      expect(result.securityReport?.securityLevel).toBe('unsafe');
    });

    it('should pass validation with clean configuration', async () => {
      const data: CursorSettingsData = {
        settings: {
          'editor.fontSize': 14,
          'editor.fontFamily': 'JetBrains Mono',
        },
        extensions: {
          recommendations: ['dbaeumer.vscode-eslint'],
        },
        sourcePath: '/test',
        collectedAt: new Date().toISOString(),
        isGlobal: false,
      };

      const result = await service.validateCursorConfiguration(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.securityReport?.securityLevel).toBe('safe');
      expect(result.compatibilityReport?.vsCodeCompatible).toBe(true);
    });
  });
});