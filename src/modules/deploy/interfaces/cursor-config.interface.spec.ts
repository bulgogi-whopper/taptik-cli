import { describe, it, expect } from 'vitest';

import {
  validateCursorSettings,
  isCursorGlobalSettings,
  isCursorProjectSettings,
  isCursorAIConfig,
  CursorGlobalSettings,
  CursorProjectSettings,
  CursorAIConfig,
} from './cursor-config.interface';

describe('CursorConfigInterface', () => {
  describe('validateCursorSettings', () => {
    it('should validate valid global settings', () => {
      const validSettings: CursorGlobalSettings = {
        editor: {
          fontSize: 14,
          tabSize: 2,
          fontFamily: 'Consolas',
          wordWrap: 'on',
        },
        ai: {
          enabled: true,
          maxTokens: 4000,
          temperature: 0.7,
          apiKey: 'valid-api-key-123',
        },
        workbench: {
          colorTheme: 'Dark+ (default dark)',
        },
      };

      const result = validateCursorSettings(validSettings);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should reject invalid settings object', () => {
      const result = validateCursorSettings(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Settings must be an object');
    });

    it('should validate editor fontSize constraints', () => {
      const invalidSettings = {
        editor: {
          fontSize: 150, // Too large
        },
      };

      const result = validateCursorSettings(invalidSettings);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('editor.fontSize must be a number between 8 and 100');
    });

    it('should validate editor tabSize constraints', () => {
      const invalidSettings = {
        editor: {
          tabSize: 25, // Too large
        },
      };

      const result = validateCursorSettings(invalidSettings);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('editor.tabSize must be a number between 1 and 20');
    });

    it('should validate AI maxTokens constraints', () => {
      const invalidSettings = {
        ai: {
          maxTokens: 200000, // Too large
        },
      };

      const result = validateCursorSettings(invalidSettings);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('ai.maxTokens must be a number between 1 and 100000');
    });

    it('should validate AI temperature constraints', () => {
      const invalidSettings = {
        ai: {
          temperature: 5, // Too high
        },
      };

      const result = validateCursorSettings(invalidSettings);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('ai.temperature must be a number between 0 and 2');
    });

    it('should warn about short API keys', () => {
      const settingsWithShortKey = {
        ai: {
          apiKey: 'short', // Too short
        },
      };

      const result = validateCursorSettings(settingsWithShortKey);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('ai.apiKey appears to be too short');
    });

    it('should handle missing optional properties gracefully', () => {
      const minimalSettings = {};

      const result = validateCursorSettings(minimalSettings);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate nested object structure', () => {
      const invalidNestedSettings = {
        editor: 'not-an-object', // Should be object
      };

      const result = validateCursorSettings(invalidNestedSettings);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('editor settings must be an object');
    });

    it('should handle multiple validation errors', () => {
      const multiErrorSettings = {
        editor: {
          fontSize: 5, // Too small
          tabSize: 0, // Too small
        },
        ai: {
          maxTokens: -100, // Negative
          temperature: -1, // Negative
          apiKey: 123, // Wrong type
        },
      };

      const result = validateCursorSettings(multiErrorSettings);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
    });
  });

  describe('Type Guards', () => {
    describe('isCursorGlobalSettings', () => {
      it('should return true for valid global settings object', () => {
        const settings: CursorGlobalSettings = {
          editor: { fontSize: 14 },
          workbench: { colorTheme: 'Dark+' },
        };

        expect(isCursorGlobalSettings(settings)).toBe(true);
      });

      it('should return true for empty object', () => {
        expect(isCursorGlobalSettings({})).toBe(true);
      });

      it('should return false for null', () => {
        expect(isCursorGlobalSettings(null)).toBe(false);
      });

      it('should return false for undefined', () => {
        expect(isCursorGlobalSettings(undefined)).toBe(false);
      });

      it('should return false for non-object types', () => {
        expect(isCursorGlobalSettings('string')).toBe(false);
        expect(isCursorGlobalSettings(123)).toBe(false);
        expect(isCursorGlobalSettings([])).toBe(false);
      });
    });

    describe('isCursorProjectSettings', () => {
      it('should return true for valid project settings object', () => {
        const settings: CursorProjectSettings = {
          editor: { fontSize: 16 },
          files: { exclude: { '**/*.log': true } },
        };

        expect(isCursorProjectSettings(settings)).toBe(true);
      });

      it('should return true for empty object', () => {
        expect(isCursorProjectSettings({})).toBe(true);
      });

      it('should return false for null/undefined', () => {
        expect(isCursorProjectSettings(null)).toBe(false);
        expect(isCursorProjectSettings(undefined)).toBe(false);
      });
    });

    describe('isCursorAIConfig', () => {
      it('should return true for valid AI config object', () => {
        const config: CursorAIConfig = {
          enabled: true,
          model: 'gpt-4',
          rules: [
            {
              id: 'rule1',
              name: 'Test Rule',
              content: 'Always use TypeScript',
              enabled: true,
              priority: 1,
              category: 'coding',
              tags: ['typescript'],
              scope: 'global',
            },
          ],
        };

        expect(isCursorAIConfig(config)).toBe(true);
      });

      it('should return true for empty object', () => {
        expect(isCursorAIConfig({})).toBe(true);
      });

      it('should return false for null/undefined', () => {
        expect(isCursorAIConfig(null)).toBe(false);
        expect(isCursorAIConfig(undefined)).toBe(false);
      });
    });
  });

  describe('Complex Configuration Objects', () => {
    it('should handle complex global settings with all properties', () => {
      const complexSettings: CursorGlobalSettings = {
        editor: {
          fontSize: 14,
          fontFamily: 'Fira Code',
          fontWeight: '400',
          lineHeight: 1.5,
          tabSize: 2,
          insertSpaces: true,
          detectIndentation: true,
          trimAutoWhitespace: true,
          wordWrap: 'wordWrapColumn',
          wordWrapColumn: 80,
          rulers: [80, 120],
          renderWhitespace: 'boundary',
          renderControlCharacters: true,
          renderIndentGuides: true,
          minimap: {
            enabled: true,
            side: 'right',
            showSlider: 'mouseover',
            scale: 1,
            maxColumn: 120,
          },
          cursorStyle: 'line',
          cursorBlinking: 'blink',
          autoClosingBrackets: 'languageDefinedT',
          autoClosingQuotes: 'languageDefinedT',
          autoSurround: 'languageDefinedT',
          formatOnSave: true,
          formatOnPaste: false,
          formatOnType: true,
        },
        workbench: {
          colorTheme: 'Monokai',
          iconTheme: 'vs-seti',
          productIconTheme: 'Default',
          startupEditor: 'welcomePage',
          editor: {
            enablePreview: true,
            enablePreviewFromQuickOpen: false,
            closeOnFileDelete: true,
            openPositioning: 'right',
            revealIfOpen: true,
            showTabs: true,
            tabCloseButton: 'right',
            tabSizing: 'fit',
            wrapTabs: false,
          },
          sideBar: {
            location: 'left',
            visible: true,
          },
          panel: {
            defaultLocation: 'bottom',
            opens: 'preserveFocus',
          },
          statusBar: {
            visible: true,
          },
        },
        ai: {
          enabled: true,
          model: 'gpt-4',
          apiKey: 'sk-1234567890abcdef',
          maxTokens: 4000,
          temperature: 0.7,
          topP: 0.95,
          presencePenalty: 0,
          frequencyPenalty: 0,
          systemPrompt: 'You are a helpful coding assistant.',
          codegenEnabled: true,
          chatEnabled: true,
          completionsEnabled: true,
          inlineCompletionsEnabled: true,
          codeActionsEnabled: true,
          diagnosticsEnabled: true,
          refactoringEnabled: true,
          documentationEnabled: true,
          testGenerationEnabled: true,
          explainCodeEnabled: true,
          reviewCodeEnabled: true,
          optimizeCodeEnabled: true,
          contextLength: 8192,
          responseFormat: 'markdown',
          languages: ['typescript', 'javascript', 'python', 'rust'],
          excludePatterns: ['**/*.min.js', '**/node_modules/**'],
          includePatterns: ['**/*.ts', '**/*.js', '**/*.py', '**/*.rs'],
          privacy: {
            collectTelemetry: false,
            shareCodeWithProvider: false,
            logConversations: true,
            anonymizeData: true,
          },
        },
        extensions: {
          autoCheckUpdates: true,
          autoUpdate: false,
          closeExtensionDetailsOnViewChange: true,
          ignoreRecommendations: false,
          showRecommendationsOnlyOnDemand: false,
          allowedNonSecureExtensions: [],
          supportVirtualWorkspaces: {},
          supportUntrustedWorkspaces: {},
        },
        security: {
          workspace: {
            trust: {
              enabled: true,
              banner: 'untilDismissed',
              untrustedFiles: 'prompt',
              emptyWindow: false,
              startupPrompt: 'once',
            },
          },
          allowedUnsafeExtensions: [],
          restrictedMode: false,
        },
      };

      const result = validateCursorSettings(complexSettings);
      expect(result.valid).toBe(true);
    });

    it('should handle complex project settings', () => {
      const projectSettings: CursorProjectSettings = {
        editor: {
          tabSize: 4,
          insertSpaces: false,
        },
        files: {
          exclude: {
            '**/.git': true,
            '**/.svn': true,
            '**/.hg': true,
            '**/CVS': true,
            '**/.DS_Store': true,
            '**/node_modules': true,
            '**/dist': true,
            '**/build': true,
          },
          associations: {
            '*.tsx': 'typescriptreact',
            '*.jsx': 'javascriptreact',
            '*.json': 'jsonc',
          },
          watcherExclude: {
            '**/.git/objects/**': true,
            '**/.git/subtree-cache/**': true,
            '**/node_modules/**': true,
            '**/.hg/store/**': true,
          },
        },
        search: {
          exclude: {
            '**/node_modules': true,
            '**/bower_components': true,
            '**/*.code-search': true,
            '**/dist': true,
            '**/build': true,
          },
          useGlobalSearchExclusions: true,
        },
        typescript: {
          preferences: {
            includePackageJsonAutoImports: 'on',
            importModuleSpecifier: 'relative',
            importModuleSpecifierEnding: 'minimal',
            quoteStyle: 'single',
            useAliases: true,
          },
          suggest: {
            enabled: true,
            paths: true,
            autoImports: true,
            completeFunctionCalls: true,
            includeAutomaticOptionalChainCompletions: true,
            includeCompletionsForImportStatements: true,
            includeCompletionsWithSnippetText: true,
            jsdoc: {
              generateReturns: true,
              generateParams: true,
            },
          },
          format: {
            enable: true,
            insertSpaceAfterCommaDelimiter: true,
            insertSpaceAfterConstructor: false,
            insertSpaceAfterSemicolonInForStatements: true,
            insertSpaceBeforeAndAfterBinaryOperators: true,
            insertSpaceAfterKeywordsInControlFlowStatements: true,
            insertSpaceAfterFunctionKeywordForAnonymousFunctions: false,
            insertSpaceBeforeFunctionParenthesis: false,
            insertSpaceAfterOpeningAndBeforeClosingNonemptyParentheses: false,
            insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: false,
            insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
            insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: false,
            insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces: false,
            insertSpaceAfterTypeAssertion: false,
            placeOpenBraceOnNewLineForFunctions: false,
            placeOpenBraceOnNewLineForControlBlocks: false,
            semicolons: 'insert',
          },
          inlayHints: {
            enabled: 'onUnlessPressed',
            parameterNames: {
              enabled: 'literals',
              suppressWhenArgumentMatchesName: true,
            },
            parameterTypes: {
              enabled: 'literals',
              suppressWhenArgumentMatchesName: false,
            },
            variableTypes: {
              enabled: true,
              suppressWhenTypeMatchesName: true,
            },
            propertyDeclarationTypes: {
              enabled: true,
            },
            functionLikeReturnTypes: {
              enabled: true,
            },
            enumMemberValues: {
              enabled: 'all',
              suppressWhenArgumentMatchesName: false,
            },
          },
        },
        eslint: {
          enable: true,
          packageManager: 'npm',
          alwaysShowStatus: true,
          quiet: false,
          onIgnoredFiles: 'off',
          run: 'onType',
          autoFixOnSave: true,
          codeActionsOnSave: {
            mode: 'problems',
            disableRuleComment: {
              enable: true,
              location: 'separateLine',
            },
            showDocumentation: {
              enable: true,
            },
          },
          format: {
            enable: false,
          },
          validate: [
            'javascript',
            'javascriptreact',
            'typescript',
            'typescriptreact',
          ],
        },
        prettier: {
          enable: true,
          requireConfig: false,
          useEditorConfig: true,
          resolveGlobalModules: false,
          withNodeModules: false,
          packageManager: 'npm',
          enableDebugLogs: false,
        },
      };

      const result = validateCursorSettings(projectSettings);
      expect(result.valid).toBe(true);
    });

    it('should handle complex AI configuration', () => {
      const aiConfig: CursorAIConfig = {
        rules: [
          {
            id: 'typescript-strict',
            name: 'TypeScript Strict Mode',
            description: 'Enforce strict TypeScript practices',
            content: 'Always use strict TypeScript with proper typing. Avoid any types.',
            enabled: true,
            priority: 1,
            category: 'typing',
            tags: ['typescript', 'strict', 'types'],
            scope: 'global',
            languages: ['typescript', 'typescriptreact'],
            filePatterns: ['**/*.ts', '**/*.tsx'],
            excludePatterns: ['**/*.d.ts', '**/node_modules/**'],
            metadata: {
              author: 'team',
              version: '1.0.0',
              lastUpdated: '2024-01-01',
            },
          },
          {
            id: 'react-hooks',
            name: 'React Hooks Best Practices',
            description: 'Follow React hooks best practices',
            content: 'Use React hooks correctly with proper dependencies and cleanup.',
            enabled: true,
            priority: 2,
            category: 'react',
            tags: ['react', 'hooks', 'best-practices'],
            scope: 'workspace',
            languages: ['typescriptreact', 'javascriptreact'],
            filePatterns: ['**/*.tsx', '**/*.jsx'],
            metadata: {
              author: 'react-team',
              version: '1.1.0',
            },
          },
        ],
        context: [
          {
            id: 'project-architecture',
            name: 'Project Architecture',
            description: 'Information about project structure and patterns',
            content: 'This project uses clean architecture with domain-driven design patterns.',
            type: 'documentation',
            enabled: true,
            priority: 1,
            scope: 'workspace',
            maxLength: 2000,
            metadata: {
              category: 'architecture',
              importance: 'high',
            },
          },
          {
            id: 'coding-standards',
            name: 'Coding Standards',
            description: 'Team coding standards and conventions',
            content: 'Follow the established coding standards for consistency.',
            type: 'guidelines',
            enabled: true,
            priority: 2,
            scope: 'global',
            languages: ['typescript', 'javascript'],
            filePatterns: ['**/*.ts', '**/*.js'],
          },
        ],
        prompts: [
          {
            id: 'code-review',
            name: 'Code Review',
            description: 'Generate code review comments',
            content: 'Review the following code and provide constructive feedback: ${selection}',
            category: 'review',
            tags: ['review', 'feedback', 'quality'],
            variables: [
              {
                name: 'selection',
                description: 'Selected code to review',
                type: 'string',
                required: true,
              },
            ],
            enabled: true,
            hotkey: 'Ctrl+Shift+R',
            scope: 'selection',
            languages: ['typescript', 'javascript', 'python'],
          },
          {
            id: 'generate-tests',
            name: 'Generate Tests',
            description: 'Generate unit tests for the current function',
            content: 'Generate comprehensive unit tests for: ${selection}',
            category: 'testing',
            tags: ['testing', 'unit-tests', 'automation'],
            variables: [
              {
                name: 'selection',
                type: 'string',
                required: true,
              },
              {
                name: 'framework',
                description: 'Testing framework to use',
                type: 'select',
                required: false,
                defaultValue: 'vitest',
                options: [
                  { label: 'Vitest', value: 'vitest' },
                  { label: 'Jest', value: 'jest' },
                  { label: 'Mocha', value: 'mocha' },
                ],
              },
            ],
            enabled: true,
            scope: 'selection',
          },
        ],
        systemPrompt: 'You are an expert software developer with deep knowledge of modern development practices.',
        codegenEnabled: true,
        chatEnabled: true,
        completionsEnabled: true,
        inlineCompletionsEnabled: true,
        model: {
          provider: 'openai',
          name: 'gpt-4',
          version: 'latest',
          maxTokens: 4000,
          temperature: 0.7,
          topP: 0.95,
          contextLength: 8192,
          responseFormat: 'markdown',
          streaming: true,
        },
        privacy: {
          collectTelemetry: false,
          shareCodeWithProvider: false,
          logConversations: true,
          anonymizeData: true,
          dataRetentionDays: 30,
          excludeSensitiveData: true,
          sensitiveDataPatterns: [
            'api[_-]?key',
            'password',
            'secret',
            'token',
            'auth[_-]?token',
          ],
        },
        performance: {
          maxConcurrentRequests: 3,
          requestTimeout: 30000,
          cacheEnabled: true,
          cacheTtl: 300,
          rateLimitRequests: 100,
          rateLimitWindow: 3600,
          backgroundProcessing: true,
        },
        customization: {
          customCommands: [
            {
              id: 'explain-code',
              name: 'Explain Code',
              description: 'Explain the selected code',
              command: 'cursor.ai.explainCode',
              hotkey: 'Ctrl+Shift+E',
              icon: 'info',
              enabled: true,
            },
          ],
          keyboardShortcuts: [
            {
              command: 'cursor.ai.chat.toggle',
              key: 'Ctrl+Shift+C',
              when: 'editorTextFocus',
            },
          ],
          uiCustomization: {
            chatPanelLocation: 'sidebar',
            showInlineCompletions: true,
            completionDelay: 500,
            showAIStatus: true,
            aiStatusLocation: 'statusbar',
          },
        },
      };

      expect(isCursorAIConfig(aiConfig)).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle deeply nested invalid properties', () => {
      const deeplyInvalidSettings = {
        editor: {
          minimap: {
            scale: 'invalid-scale', // Should be number
          },
        },
        workbench: {
          editor: {
            tabSizing: 'invalid-sizing', // Should be 'fit' | 'shrink'
          },
        },
      };

      const result = validateCursorSettings(deeplyInvalidSettings);
      expect(result.valid).toBe(true); // Basic validation doesn't check deep nested types
    });

    it('should handle arrays and complex nested objects', () => {
      const complexSettings = {
        editor: {
          rulers: [80, 120, 160],
        },
        search: {
          exclude: {
            '**/node_modules': true,
            '**/dist': false,
            '**/*.log': true,
          },
        },
        extensions: {
          allowedNonSecureExtensions: ['extension1', 'extension2'],
          supportVirtualWorkspaces: {
            'ms-python.python': true,
            'ms-vscode.typescript-language-features': false,
          },
        },
      };

      const result = validateCursorSettings(complexSettings);
      expect(result.valid).toBe(true);
    });

    it('should handle circular references gracefully', () => {
      const circularSettings: any = {
        editor: {
          fontSize: 14,
        },
      };
      circularSettings.self = circularSettings; // Circular reference

      // The function should not crash with circular references
      expect(() => validateCursorSettings(circularSettings)).not.toThrow();
    });

    it('should handle very large configuration objects', () => {
      const largeSettings = {
        extensions: {
          supportVirtualWorkspaces: Object.fromEntries(
            Array.from({ length: 1000 }, (_, i) => [`extension${i}`, true])
          ),
        },
      };

      const result = validateCursorSettings(largeSettings);
      expect(result.valid).toBe(true);
    });
  });
});