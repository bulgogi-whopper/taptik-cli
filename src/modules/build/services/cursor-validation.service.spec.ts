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
  CursorPromptTemplate,
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

  describe('validateAiModelConfig', () => {
    it('should validate valid OpenAI model configuration', async () => {
      const modelConfig = {
        provider: 'openai' as const,
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 4096,
      };

      const result = await service.validateAiModelConfig(modelConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.capabilities).toContain('code-completion');
      expect(result.capabilities).toContain('chat');
      expect(result.capabilities).toContain('function-calling');
    });

    it('should validate Anthropic model configuration', async () => {
      const modelConfig = {
        provider: 'anthropic' as const,
        model: 'claude-3-opus',
        temperature: 0.5,
        maxTokens: 100000,
      };

      const result = await service.validateAiModelConfig(modelConfig);

      expect(result.isValid).toBe(true);
      expect(result.capabilities).toContain('long-context');
      expect(result.capabilities).toContain('constitutional-ai');
    });

    it('should detect invalid provider', async () => {
      const modelConfig = {
        provider: 'invalid-provider' as any,
        model: 'some-model',
      };

      const result = await service.validateAiModelConfig(modelConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2); // Invalid provider and model
      expect(result.errors[0].code).toBe('INVALID_AI_PROVIDER');
    });

    it('should detect invalid model for provider', async () => {
      const modelConfig = {
        provider: 'openai' as const,
        model: 'claude-3', // Wrong model for OpenAI
      };

      const result = await service.validateAiModelConfig(modelConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_MODEL');
      expect(result.errors[0].message).toContain('not available for provider');
    });

    it('should validate temperature range', async () => {
      const modelConfig = {
        provider: 'openai' as const,
        model: 'gpt-4',
        temperature: 3, // Invalid: too high
      };

      const result = await service.validateAiModelConfig(modelConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TEMPERATURE');
    });

    it('should warn about exceeding token limits', async () => {
      const modelConfig = {
        provider: 'openai' as const,
        model: 'gpt-4',
        maxTokens: 10000, // Exceeds gpt-4 limit
      };

      const result = await service.validateAiModelConfig(modelConfig);

      expect(result.isValid).toBe(true); // Warning, not error
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('HIGH_TOKEN_LIMIT');
    });

    it('should warn about API key in config', async () => {
      const modelConfig = {
        provider: 'openai' as const,
        model: 'gpt-4',
        apiKey: 'sk-test-key' as any,
      };

      const result = await service.validateAiModelConfig(modelConfig);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('API_KEY_IN_CONFIG');
      expect(result.warnings[0].suggestion).toContain('environment variables');
    });

    it('should allow custom provider with any model', async () => {
      const modelConfig = {
        provider: 'custom' as const,
        model: 'custom-model-xyz',
      };

      const result = await service.validateAiModelConfig(modelConfig);

      expect(result.isValid).toBe(true);
      expect(result.capabilities).toContain('custom-endpoint');
    });
  });

  describe('validateCustomPrompts', () => {
    it('should validate clean prompts', async () => {
      const prompts = {
        codeReview: 'Review this code for best practices: {code}',
        refactor: 'Suggest refactoring for ${selectedCode}',
      };

      const result = await service.validateCustomPrompts(prompts);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.securityIssues).toHaveLength(0);
    });

    it('should detect sensitive data in prompts', async () => {
      const prompts = {
        withApiKey: 'Use API key: sk-1234567890abcdef',
        withToken: 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs',
      };

      const result = await service.validateCustomPrompts(prompts);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].code).toBe('SENSITIVE_DATA_IN_PROMPT');
      expect(result.securityIssues).toHaveLength(2);
    });

    it('should detect injection patterns', async () => {
      const prompts = {
        evalPrompt: 'Run this: eval("dangerous code")',
        scriptPrompt: '<script>alert("xss")</script>',
        templateInjection: 'Process: ${process.env.SECRET}',
      };

      const result = await service.validateCustomPrompts(prompts);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'POTENTIAL_INJECTION')).toBe(true);
    });

    it('should warn about very long prompts', async () => {
      const longPrompt = 'a'.repeat(10001);
      const prompts = {
        longPrompt,
      };

      const result = await service.validateCustomPrompts(prompts);

      expect(result.warnings).toHaveLength(2); // Long prompt + no variables
      expect(result.warnings[0].code).toBe('PROMPT_TOO_LONG');
    });

    it('should suggest using variables', async () => {
      const prompts = {
        staticPrompt: 'This is a static prompt with no variables',
      };

      const result = await service.validateCustomPrompts(prompts);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('NO_VARIABLES');
      expect(result.warnings[0].suggestion).toContain('variables');
    });

    it('should validate prompt templates array', async () => {
      const templates: CursorPromptTemplate[] = [
        {
          id: '1',
          name: 'Code Review',
          prompt: 'Review: {code}',
          variables: [{ name: 'code', type: 'selection', defaultValue: '' }],
        },
        {
          id: '2',
          name: 'With Secret',
          prompt: 'Use key: sk-secret12345', // At least 10 chars after sk-
        },
      ];

      const result = await service.validateCustomPrompts(templates);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('With Secret');
    });
  });

  describe('detectAiCapabilities', () => {
    it('should detect model capabilities', async () => {
      const config: CursorAiConfiguration = {
        version: '1.0.0',
        modelConfig: {
          provider: 'openai',
          model: 'gpt-4-turbo',
        },
      };

      const result = await service.detectAiCapabilities(config);

      expect(result.capabilities).toContain('code-completion');
      expect(result.capabilities).toContain('function-calling');
      expect(result.metadata.provider).toBe('openai');
      expect(result.metadata.model).toBe('gpt-4-turbo');
    });

    it('should detect Copilot integration', async () => {
      const config: CursorAiConfiguration = {
        version: '1.0.0',
        copilot: {
          enable: true,
          inlineSuggest: { enable: true, delay: 100 },
          editor: { enableAutoCompletions: true },
        },
      };

      const result = await service.detectAiCapabilities(config);

      expect(result.capabilities).toContain('copilot-integration');
      expect(result.capabilities).toContain('inline-suggestions');
      expect(result.capabilities).toContain('auto-completions');
      expect(result.metadata.copilotEnabled).toBe(true);
    });

    it('should detect security features', async () => {
      const config: CursorAiConfiguration = {
        version: '1.0.0',
        security: {
          filterSensitiveData: true,
          allowPublicCodeSuggestions: false,
          enableTelemetry: false,
        },
      };

      const result = await service.detectAiCapabilities(config);

      expect(result.capabilities).toContain('sensitive-data-filtering');
      expect(result.capabilities).toContain('private-code-only');
    });

    it('should detect rule-based automation', async () => {
      const config: CursorAiConfiguration = {
        version: '1.0.0',
        rules: [
          { name: 'Rule1', pattern: '*.ts', prompt: 'TypeScript', enabled: true, context: 'workspace' },
          { name: 'Rule2', pattern: '*.js', prompt: 'JavaScript', enabled: false, context: 'selection' },
        ],
      };

      const result = await service.detectAiCapabilities(config);

      expect(result.capabilities).toContain('rule-based-automation');
      expect(result.capabilities).toContain('workspace-context');
      expect(result.capabilities).toContain('selection-context');
      expect(result.metadata.ruleCount).toBe(2);
      expect(result.metadata.enabledRuleCount).toBe(1);
    });

    it('should detect advanced templates', async () => {
      const config: CursorAiConfiguration = {
        version: '1.0.0',
        templates: [
          {
            id: '1',
            name: 'Complex',
            prompt: 'Template',
            variables: [
              { name: 'var1', type: 'string' },
              { name: 'var2', type: 'number' },
              { name: 'var3', type: 'boolean' },
            ],
          },
        ],
      };

      const result = await service.detectAiCapabilities(config);

      expect(result.capabilities).toContain('prompt-templates');
      expect(result.capabilities).toContain('advanced-templates');
      expect(result.metadata.templateCount).toBe(1);
    });
  });

  describe('validateAiConfiguration', () => {
    it('should perform comprehensive validation', async () => {
      const config: CursorAiConfiguration = {
        version: '1.0.0',
        modelConfig: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.7,
        },
        globalPrompts: {
          review: 'Review code: {code}',
        },
        templates: [
          {
            id: '1',
            name: 'Test',
            prompt: 'Test prompt',
          },
        ],
        rules: [
          {
            name: 'Complete Rule',
            pattern: '*.ts',
            prompt: 'TypeScript analysis',
          },
        ],
        security: {
          filterSensitiveData: true,
          allowPublicCodeSuggestions: false,
        },
      };

      const result = await service.validateAiConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.capabilities).toContain('code-completion');
      expect(result.capabilities).toContain('global-prompts');
      expect(result.capabilities).toContain('prompt-templates');
      expect(result.capabilities).toContain('rule-based-automation');
      expect(result.securityReport.securityLevel).toBe('safe');
    });

    it('should detect incomplete rules', async () => {
      const config: CursorAiConfiguration = {
        version: '1.0.0',
        rules: [
          {
            name: 'Incomplete Rule',
            pattern: '', // Missing pattern
            prompt: 'Some prompt',
          },
        ],
      };

      const result = await service.validateAiConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INCOMPLETE_RULE');
    });

    it('should generate security report with warnings', async () => {
      const config: CursorAiConfiguration = {
        version: '1.0.0',
        modelConfig: {
          provider: 'openai',
          model: 'gpt-4',
          // @ts-expect-error - Testing security
          apiKey: 'sk-test',
        },
        security: {
          filterSensitiveData: false,
          allowPublicCodeSuggestions: true,
        },
      };

      const result = await service.validateAiConfiguration(config);

      expect(result.securityReport.hasApiKeys).toBe(true);
      expect(result.securityReport.securityLevel).toBe('unsafe');
      expect(result.securityReport.recommendations).toContain('Store API keys in environment variables');
      expect(result.securityReport.recommendations).toContain('Enable sensitive data filtering in security settings');
    });

    it('should validate complex nested configuration', async () => {
      const config: CursorAiConfiguration = {
        version: '1.0.0',
        modelConfig: {
          provider: 'azure',
          model: 'gpt-4-turbo',
          temperature: 0.5,
          maxTokens: 2000,
        },
        globalPrompts: {
          prompt1: 'Clean prompt',
          prompt2: 'Another clean prompt',
        },
        rules: [
          { name: 'Rule1', pattern: '*.ts', prompt: 'TS' },
          { name: 'Rule2', pattern: '*.js', prompt: 'JS' },
        ],
        templates: [
          { id: '1', name: 'Template1', prompt: 'Template {var}' },
        ],
        copilot: {
          enable: true,
          publicCodeSuggestions: 'block',
        },
      };

      const result = await service.validateAiConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.capabilities.length).toBeGreaterThan(5);
      expect(result.metadata.ruleCount).toBe(2);
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
      expect(result.migrationSuggestions).toHaveLength(1); // Success message added
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

    it('should suggest alternatives for incompatible extensions', async () => {
      const extensions = [
        'cursor.cursor-copilot',
        'cursor.cursor-chat',
        'github.copilot',
      ];

      const result = await service.checkExtensionCompatibility(extensions);

      expect(result.vsCodeCompatible).toBe(false);
      expect(result.incompatibleExtensions).toContain('cursor.cursor-copilot');
      expect(result.incompatibleExtensions).toContain('cursor.cursor-chat');
      expect(result.alternativeExtensions['cursor.cursor-copilot']).toBe('github.copilot');
      expect(result.migrationSuggestions.length).toBeGreaterThan(0);
    });

    it('should handle mixed compatible and incompatible extensions', async () => {
      const extensions = [
        'ms-python.python',
        'cursor.cursor-ai',
        'golang.go',
        'esbenp.prettier-vscode',
      ];

      const result = await service.checkExtensionCompatibility(extensions);

      expect(result.vsCodeCompatible).toBe(false);
      expect(result.incompatibleExtensions).toHaveLength(1);
      expect(result.incompatibleExtensions).toContain('cursor.cursor-ai');
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

  describe('generateComprehensiveCompatibilityReport', () => {
    it('should generate comprehensive report for compatible configuration', async () => {
      const data: CursorSettingsData = {
        settings: {
          'editor.fontSize': 14,
          'editor.fontFamily': 'JetBrains Mono',
        },
        extensions: {
          recommendations: ['dbaeumer.vscode-eslint', 'esbenp.prettier-vscode'],
        },
        sourcePath: '/test',
        collectedAt: new Date().toISOString(),
        isGlobal: false,
      };

      const result = await service.generateComprehensiveCompatibilityReport(data);

      expect(result.report).toBeDefined();
      expect(result.report.vsCodeCompatible).toBe(true);
      expect(result.report.incompatibleExtensions).toHaveLength(0);
      expect(result.report.incompatibleSettings).toHaveLength(0);
      
      expect(result.deploymentGuide).toBeDefined();
      expect(result.deploymentGuide.vscode.compatible).toBe(true);
      expect(result.deploymentGuide.cursorIde.compatible).toBe(true);
      expect(result.deploymentGuide.claudeCode.compatible).toBe(true);
      
      expect(result.migrationPlan).toBeDefined();
      expect(result.migrationPlan.riskLevel).toBe('low');
      expect(result.migrationPlan.steps.length).toBeGreaterThan(0); // At least testing step
    });

    it('should detect incompatible extensions and settings', async () => {
      const data: CursorSettingsData = {
        settings: {
          'cursor.aiProvider': 'openai',
          'cursor.apiKey': 'sk-test',
          'editor.fontSize': 14,
        },
        extensions: {
          recommendations: [
            'cursor.cursor-ai',
            'cursor.cursor-copilot',
            'dbaeumer.vscode-eslint',
          ],
        },
        sourcePath: '/test',
        collectedAt: new Date().toISOString(),
        isGlobal: false,
      };

      const result = await service.generateComprehensiveCompatibilityReport(data);

      expect(result.report.vsCodeCompatible).toBe(false);
      expect(result.report.incompatibleExtensions).toContain('cursor.cursor-ai');
      expect(result.report.incompatibleExtensions).toContain('cursor.cursor-copilot');
      expect(result.report.incompatibleSettings).toContain('cursor.aiProvider');
      expect(result.report.incompatibleSettings).toContain('cursor.apiKey');
      
      expect(result.deploymentGuide.vscode.compatible).toBe(false);
      expect(result.deploymentGuide.vscode.warnings.length).toBeGreaterThan(0);
      expect(result.deploymentGuide.vscode.steps.length).toBeGreaterThan(0);
      
      expect(result.migrationPlan.riskLevel).toBe('medium'); // 2 extensions + 2 settings
      expect(result.migrationPlan.steps.length).toBeGreaterThan(4); // 2 ext + 2 settings + test
    });

    it('should handle AI configuration compatibility', async () => {
      const data: CursorSettingsData = {
        settings: {},
        extensions: {
          recommendations: [],
        },
        sourcePath: '/test',
        collectedAt: new Date().toISOString(),
        isGlobal: false,
      };

      const aiConfig: CursorAiConfiguration = {
        version: '1.0.0',
        modelConfig: {
          provider: 'custom',
          model: 'custom-model',
        },
        rules: [
          {
            name: 'Rule1',
            pattern: '*.ts',
            prompt: 'TypeScript rule',
          },
        ],
        copilot: {
          enable: false,
        },
      };

      const result = await service.generateComprehensiveCompatibilityReport(data, aiConfig);

      // 3 AI issues + 1 success message for extensions
      expect(result.report.migrationSuggestions).toHaveLength(4);
      expect(result.report.migrationSuggestions.some(s => s.includes('Custom AI providers'))).toBe(true);
      expect(result.report.migrationSuggestions.some(s => s.includes('AI rules'))).toBe(true);
      expect(result.report.migrationSuggestions.some(s => s.includes('GitHub Copilot'))).toBe(true);
      
      expect(result.deploymentGuide.vscode.recommendations.length).toBeGreaterThan(0);
    });

    it('should create detailed migration plan', async () => {
      const data: CursorSettingsData = {
        settings: {
          'cursor.apiKey': 'sk-critical-key',
          'cursor.temperature': 0.7,
        },
        extensions: {
          recommendations: [
            'cursor.cursor-copilot', // Has alternative
            'cursor.cursor-ai', // No alternative
          ],
        },
        sourcePath: '/test',
        collectedAt: new Date().toISOString(),
        isGlobal: false,
      };

      const result = await service.generateComprehensiveCompatibilityReport(data);

      const plan = result.migrationPlan;
      expect(plan.steps.length).toBeGreaterThan(0);
      
      // Check for extension migration steps
      const extensionSteps = plan.steps.filter(s => s.type === 'extension');
      expect(extensionSteps.length).toBe(2);
      
      const replaceStep = extensionSteps.find(s => s.action === 'replace');
      expect(replaceStep).toBeDefined();
      expect(replaceStep?.alternative).toBe('github.copilot');
      
      const removeStep = extensionSteps.find(s => s.action === 'remove' && s.target === 'cursor.cursor-ai');
      expect(removeStep).toBeDefined();
      
      // Check for settings migration steps
      const settingSteps = plan.steps.filter(s => s.type === 'setting');
      expect(settingSteps.length).toBe(2);
      
      const criticalStep = settingSteps.find(s => s.target === 'cursor.apiKey');
      expect(criticalStep?.priority).toBe('critical');
      
      // Check for validation step
      const validationStep = plan.steps.find(s => s.type === 'validation');
      expect(validationStep).toBeDefined();
      expect(validationStep?.action).toBe('test');
      
      // Check estimated time
      expect(plan.estimatedMinutes).toBeGreaterThan(10);
      
      // Check automation level
      expect(plan.automationLevel).toBeDefined();
    });

    it('should generate platform-specific deployment guidance', async () => {
      const data: CursorSettingsData = {
        settings: {
          'cursor.aiProvider': 'openai',
        },
        extensions: {
          recommendations: ['cursor.cursor-ai'],
        },
        sourcePath: '/test',
        collectedAt: new Date().toISOString(),
        isGlobal: false,
      };

      const result = await service.generateComprehensiveCompatibilityReport(data);

      const guidance = result.deploymentGuide;
      
      // VS Code guidance
      expect(guidance.vscode.compatible).toBe(false);
      expect(guidance.vscode.steps.length).toBeGreaterThan(0);
      expect(guidance.vscode.warnings.length).toBeGreaterThan(0);
      expect(guidance.vscode.warnings[0]).toContain('1 extensions');
      expect(guidance.vscode.warnings[1]).toContain('1 settings');
      
      // Cursor IDE guidance (always compatible with itself)
      expect(guidance.cursorIde.compatible).toBe(true);
      expect(guidance.cursorIde.steps).toContain('Configuration can be directly imported into Cursor IDE');
      
      // Claude Code guidance
      expect(guidance.claudeCode.compatible).toBe(true);
      expect(guidance.claudeCode.steps.length).toBe(3);
      expect(guidance.claudeCode.recommendations.length).toBeGreaterThan(0);
    });

    it('should calculate risk levels correctly', async () => {
      // Low risk - no issues
      const lowRiskData: CursorSettingsData = {
        settings: {},
        extensions: { recommendations: [] },
        sourcePath: '/test',
        collectedAt: new Date().toISOString(),
        isGlobal: false,
      };
      
      const lowRiskResult = await service.generateComprehensiveCompatibilityReport(lowRiskData);
      expect(lowRiskResult.migrationPlan.riskLevel).toBe('low');
      
      // Medium risk - few issues
      const mediumRiskData: CursorSettingsData = {
        settings: {
          'cursor.setting1': 'val1',
          'cursor.setting2': 'val2',
        },
        extensions: {
          recommendations: ['cursor.cursor-ai'],
        },
        sourcePath: '/test',
        collectedAt: new Date().toISOString(),
        isGlobal: false,
      };
      
      const mediumRiskResult = await service.generateComprehensiveCompatibilityReport(mediumRiskData);
      expect(mediumRiskResult.migrationPlan.riskLevel).toBe('medium');
      
      // High risk - many issues
      const highRiskData: CursorSettingsData = {
        settings: {
          'cursor.setting1': 'val1',
          'cursor.setting2': 'val2',
          'cursor.setting3': 'val3',
          'cursor.setting4': 'val4',
        },
        extensions: {
          recommendations: [
            'cursor.cursor-ai',
            'cursor.cursor-copilot',
            'cursor.cursor-chat',
            'cursor.cursor-terminal',
          ],
        },
        sourcePath: '/test',
        collectedAt: new Date().toISOString(),
        isGlobal: false,
      };
      
      const highRiskResult = await service.generateComprehensiveCompatibilityReport(highRiskData);
      expect(highRiskResult.migrationPlan.riskLevel).toBe('high');
    });

    it('should calculate automation level correctly', async () => {
      const data: CursorSettingsData = {
        settings: {
          'cursor.setting1': 'val1',
        },
        extensions: {
          recommendations: [
            'cursor.cursor-copilot', // Has alternative (replace)
            'cursor.cursor-ai', // No alternative (remove)
          ],
        },
        sourcePath: '/test',
        collectedAt: new Date().toISOString(),
        isGlobal: false,
      };

      const result = await service.generateComprehensiveCompatibilityReport(data);
      
      // 3 automatable (1 replace, 1 remove, 1 setting remove) + 1 test = 0.75 ratio
      expect(result.migrationPlan.automationLevel).toBe('partial');
    });

    it('should include emojis in migration suggestions', async () => {
      const data: CursorSettingsData = {
        settings: {},
        extensions: {
          recommendations: [
            'cursor.cursor-copilot',
            'cursor.cursor-ai',
            'dbaeumer.vscode-eslint',
          ],
        },
        sourcePath: '/test',
        collectedAt: new Date().toISOString(),
        isGlobal: false,
      };

      const result = await service.generateComprehensiveCompatibilityReport(data);
      
      const suggestions = result.report.migrationSuggestions;
      expect(suggestions.some(s => s.includes('✓'))).toBe(true); // Check mark for replacements
      expect(suggestions.some(s => s.includes('✗'))).toBe(true); // X mark for removals
      expect(suggestions.some(s => s.includes('📋'))).toBe(true); // Clipboard for report header
    });
  });
});