/**
 * Tests for Cursor IDE interfaces and type definitions
 */

import { describe, it, expect } from 'vitest';

import {
  VSCodeSettings,
  CursorSettingsData,
  CursorAiConfiguration,
  CursorExtension,
  CursorSnippet,
  CursorKeybinding,
  CursorError,
  CursorConfigurationError,
  SecurityFilteringError,
  VSCodeCompatibilityError,
  CursorValidationResult,
  CursorPlatform,
} from './cursor-ide.interfaces';

describe('CursorIDE Interfaces', () => {
  describe('VSCodeSettings', () => {
    it('should accept valid VS Code settings', () => {
      const settings: VSCodeSettings = {
        'editor.fontSize': 14,
        'editor.fontFamily': 'JetBrains Mono',
        'editor.tabSize': 2,
        'editor.wordWrap': 'on',
        'workbench.colorTheme': 'One Dark Pro',
        'files.autoSave': 'afterDelay',
        'files.autoSaveDelay': 1000,
        'terminal.integrated.fontSize': 13,
      };

      expect(settings['editor.fontSize']).toBe(14);
      expect(settings['editor.wordWrap']).toBe('on');
    });

    it('should accept Cursor-specific settings', () => {
      const settings: VSCodeSettings = {
        'cursor.aiProvider': 'openai',
        'cursor.aiModel': 'gpt-4',
        'cursor.temperature': 0.7,
        'cursor.maxTokens': 2000,
        'cursor.apiKey': 'secret-key',
      };

      expect(settings['cursor.aiProvider']).toBe('openai');
      expect(settings['cursor.temperature']).toBe(0.7);
    });

    it('should allow additional dynamic properties', () => {
      const settings: VSCodeSettings = {
        'custom.setting': 'value',
        'another.custom': 123,
      };

      expect(settings['custom.setting']).toBe('value');
      expect(settings['another.custom']).toBe(123);
    });
  });

  describe('CursorExtension', () => {
    it('should define extension structure correctly', () => {
      const extension: CursorExtension = {
        id: 'dbaeumer.vscode-eslint',
        name: 'ESLint',
        publisher: 'dbaeumer',
        version: '2.4.0',
        enabled: true,
        configuration: {
          'eslint.enable': true,
        },
      };

      expect(extension.id).toBe('dbaeumer.vscode-eslint');
      expect(extension.enabled).toBe(true);
      expect(extension.configuration).toBeDefined();
    });
  });

  describe('CursorSnippet', () => {
    it('should define snippet structure correctly', () => {
      const snippet: CursorSnippet = {
        prefix: 'cl',
        body: ['console.log($1);'],
        description: 'Log to console',
        scope: 'typescript,javascript',
      };

      expect(snippet.prefix).toBe('cl');
      expect(Array.isArray(snippet.body)).toBe(true);
      expect(snippet.scope).toContain('typescript');
    });

    it('should accept string or array for body', () => {
      const snippet1: CursorSnippet = {
        prefix: 'test1',
        body: 'single line',
      };

      const snippet2: CursorSnippet = {
        prefix: 'test2',
        body: ['line 1', 'line 2'],
      };

      expect(typeof snippet1.body).toBe('string');
      expect(Array.isArray(snippet2.body)).toBe(true);
    });
  });

  describe('CursorKeybinding', () => {
    it('should define keybinding structure correctly', () => {
      const keybinding: CursorKeybinding = {
        key: 'cmd+k cmd+d',
        command: 'cursor.aiChat',
        when: 'editorTextFocus',
        args: { prompt: 'help' },
      };

      expect(keybinding.key).toBe('cmd+k cmd+d');
      expect(keybinding.command).toBe('cursor.aiChat');
      expect(keybinding.when).toBe('editorTextFocus');
      expect(keybinding.args).toEqual({ prompt: 'help' });
    });
  });

  describe('CursorSettingsData', () => {
    it('should define complete settings data structure', () => {
      const settingsData: CursorSettingsData = {
        settings: {
          'editor.fontSize': 14,
          'cursor.aiProvider': 'openai',
        },
        extensions: {
          recommendations: ['dbaeumer.vscode-eslint'],
          unwantedRecommendations: ['ms-vscode.powershell'],
          installed: [
            {
              id: 'cursor.cursor-ai',
              enabled: true,
            },
          ],
        },
        snippets: {
          typescript: {
            'Console Log': {
              prefix: 'cl',
              body: 'console.log($1);',
            },
          },
        },
        keybindings: [
          {
            key: 'cmd+k',
            command: 'cursor.aiChat',
          },
        ],
        workspace: {
          folders: [{ path: '.' }],
          settings: { 'editor.formatOnSave': true },
        },
        sourcePath: '/Users/test/.cursor',
        collectedAt: new Date().toISOString(),
        isGlobal: true,
        compatibility: {
          vsCodeVersion: '1.85.0',
          cursorVersion: '0.20.0',
          compatibleExtensions: ['dbaeumer.vscode-eslint'],
          incompatibleExtensions: ['cursor.cursor-ai'],
          warnings: ['Some extensions are Cursor-specific'],
        },
      };

      expect(settingsData.settings).toBeDefined();
      expect(settingsData.extensions?.recommendations).toHaveLength(1);
      expect(settingsData.isGlobal).toBe(true);
      expect(settingsData.compatibility?.warnings).toHaveLength(1);
    });
  });

  describe('CursorAiConfiguration', () => {
    it('should define AI configuration structure', () => {
      const aiConfig: CursorAiConfiguration = {
        version: '1.0.0',
        modelConfig: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 2000,
        },
        rules: [
          {
            name: 'Documentation',
            pattern: '/**',
            prompt: 'Generate JSDoc',
            enabled: true,
            context: 'file',
          },
        ],
        globalPrompts: {
          codeReview: 'Review this code',
        },
        templates: [
          {
            id: 'template-1',
            name: 'Test Template',
            prompt: 'Generate test for {{function}}',
            variables: [
              {
                name: 'function',
                type: 'string',
              },
            ],
          },
        ],
        security: {
          allowPublicCodeSuggestions: false,
          enableTelemetry: false,
          filterSensitiveData: true,
        },
        copilot: {
          enable: true,
          inlineSuggest: {
            enable: true,
            delay: 100,
          },
          publicCodeSuggestions: 'block',
        },
      };

      expect(aiConfig.version).toBe('1.0.0');
      expect(aiConfig.modelConfig?.provider).toBe('openai');
      expect(aiConfig.rules).toHaveLength(1);
      expect(aiConfig.security?.filterSensitiveData).toBe(true);
      expect(aiConfig.copilot?.enable).toBe(true);
    });
  });

  describe('CursorValidationResult', () => {
    it('should define validation result structure', () => {
      const validationResult: CursorValidationResult = {
        isValid: false,
        errors: [
          {
            code: 'INVALID_SETTING',
            message: 'Invalid setting value',
            field: 'editor.fontSize',
            severity: 'error',
          },
        ],
        warnings: [
          {
            code: 'DEPRECATED',
            message: 'Setting is deprecated',
            field: 'editor.oldSetting',
            suggestion: 'Use editor.newSetting instead',
            severity: 'warning',
          },
        ],
        securityReport: {
          hasApiKeys: true,
          hasTokens: false,
          hasSensitiveData: true,
          filteredFields: ['cursor.apiKey'],
          securityLevel: 'warning',
          recommendations: ['Remove API keys before sharing'],
        },
        compatibilityReport: {
          vsCodeCompatible: false,
          incompatibleSettings: ['cursor.aiProvider'],
          incompatibleExtensions: ['cursor.cursor-ai'],
          alternativeExtensions: {},
          migrationSuggestions: ['Remove Cursor-specific settings'],
        },
      };

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toHaveLength(1);
      expect(validationResult.warnings).toHaveLength(1);
      expect(validationResult.securityReport?.hasApiKeys).toBe(true);
      expect(validationResult.compatibilityReport?.vsCodeCompatible).toBe(false);
    });
  });

  describe('Error Classes', () => {
    it('should create CursorError correctly', () => {
      const error = new CursorError('Test error', 'TEST_CODE', { detail: 'value' });

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ detail: 'value' });
      expect(error.name).toBe('CursorError');
    });

    it('should create CursorConfigurationError correctly', () => {
      const error = new CursorConfigurationError(
        'Invalid configuration',
        'settings.json',
        'editor.fontSize',
        { value: 'not-a-number' },
      );

      expect(error.message).toBe('Invalid configuration');
      expect(error.code).toBe('CURSOR_CONFIG_ERROR');
      expect(error.file).toBe('settings.json');
      expect(error.field).toBe('editor.fontSize');
      expect(error.name).toBe('CursorConfigurationError');
    });

    it('should create SecurityFilteringError correctly', () => {
      const error = new SecurityFilteringError(
        'Sensitive data detected',
        ['apiKey', 'token'],
        'critical',
      );

      expect(error.message).toBe('Sensitive data detected');
      expect(error.code).toBe('SECURITY_FILTERING_ERROR');
      expect(error.filteredData).toEqual(['apiKey', 'token']);
      expect(error.securityLevel).toBe('critical');
      expect(error.name).toBe('SecurityFilteringError');
    });

    it('should create VSCodeCompatibilityError correctly', () => {
      const error = new VSCodeCompatibilityError(
        'Incompatible features detected',
        ['cursor.aiProvider', 'cursor.aiModel'],
        ['Remove Cursor-specific settings'],
      );

      expect(error.message).toBe('Incompatible features detected');
      expect(error.code).toBe('VSCODE_COMPATIBILITY_ERROR');
      expect(error.incompatibleFeatures).toHaveLength(2);
      expect(error.suggestions).toHaveLength(1);
      expect(error.name).toBe('VSCodeCompatibilityError');
    });
  });

  describe('CursorPlatform', () => {
    it('should define platform identifiers', () => {
      expect(CursorPlatform.CURSOR).toBe('cursor');
      expect(CursorPlatform.CURSOR_IDE).toBe('cursor-ide');
    });
  });

  describe('Type Safety', () => {
    it('should enforce type safety for settings', () => {
      const settings: VSCodeSettings = {
        'editor.fontSize': 14,
        'editor.wordWrap': 'on',
        'files.autoSave': 'afterDelay',
      };

      // Type checking ensures these are the correct types
      const fontSize: number | undefined = settings['editor.fontSize'];
      const wordWrap: 'off' | 'on' | 'wordWrapColumn' | 'bounded' | undefined = 
        settings['editor.wordWrap'];
      const autoSave: 'off' | 'afterDelay' | 'onFocusChange' | 'onWindowChange' | undefined =
        settings['files.autoSave'];

      expect(fontSize).toBe(14);
      expect(wordWrap).toBe('on');
      expect(autoSave).toBe('afterDelay');
    });

    it('should enforce type safety for AI configuration', () => {
      const aiConfig: CursorAiConfiguration = {
        version: '1.0.0',
        modelConfig: {
          provider: 'openai',
          model: 'gpt-4',
        },
      };

      // Type checking ensures provider is limited to specific values
      const provider: 'openai' | 'anthropic' | 'azure' | 'custom' | undefined =
        aiConfig.modelConfig?.provider;

      expect(provider).toBe('openai');
    });
  });
});