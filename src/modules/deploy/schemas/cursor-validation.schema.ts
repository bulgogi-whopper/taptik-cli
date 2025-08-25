/**
 * JSON Schema definitions for Cursor IDE configuration validation
 */

export interface CursorValidationSchema {
  $schema: string;
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
  definitions?: Record<string, any>;
}

// Base schema definitions
export const CURSOR_EDITOR_SCHEMA: CursorValidationSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    fontSize: {
      type: 'number',
      minimum: 6,
      maximum: 100,
      description: 'Font size in pixels'
    },
    fontFamily: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Font family name'
    },
    fontWeight: {
      type: 'string',
      enum: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
      description: 'Font weight'
    },
    lineHeight: {
      type: 'number',
      minimum: 0.5,
      maximum: 5,
      description: 'Line height multiplier'
    },
    tabSize: {
      type: 'number',
      minimum: 1,
      maximum: 20,
      description: 'Tab size in spaces'
    },
    insertSpaces: {
      type: 'boolean',
      description: 'Insert spaces when pressing Tab'
    },
    detectIndentation: {
      type: 'boolean',
      description: 'Automatically detect indentation from file content'
    },
    trimAutoWhitespace: {
      type: 'boolean',
      description: 'Remove trailing whitespace automatically'
    },
    wordWrap: {
      type: 'string',
      enum: ['off', 'on', 'wordWrapColumn', 'bounded'],
      description: 'Word wrapping behavior'
    },
    wordWrapColumn: {
      type: 'number',
      minimum: 1,
      maximum: 1000,
      description: 'Column at which to wrap words'
    },
    rulers: {
      type: 'array',
      items: {
        type: 'number',
        minimum: 0,
        maximum: 1000
      },
      maxItems: 10,
      description: 'Ruler positions'
    },
    renderWhitespace: {
      type: 'string',
      enum: ['none', 'boundary', 'selection', 'trailing', 'all'],
      description: 'Whitespace rendering mode'
    },
    renderControlCharacters: {
      type: 'boolean',
      description: 'Render control characters'
    },
    renderIndentGuides: {
      type: 'boolean',
      description: 'Render indent guides'
    },
    cursorStyle: {
      type: 'string',
      enum: ['line', 'block', 'underline', 'line-thin', 'block-outline', 'underline-thin'],
      description: 'Cursor style'
    },
    cursorBlinking: {
      type: 'string',
      enum: ['blink', 'smooth', 'phase', 'expand', 'solid'],
      description: 'Cursor blinking animation'
    },
    autoClosingBrackets: {
      type: 'string',
      enum: ['always', 'languageDefinedT', 'beforeWhitespace', 'never'],
      description: 'Auto closing brackets behavior'
    },
    autoClosingQuotes: {
      type: 'string',
      enum: ['always', 'languageDefinedT', 'beforeWhitespace', 'never'],
      description: 'Auto closing quotes behavior'
    },
    autoSurround: {
      type: 'string',
      enum: ['languageDefinedT', 'quotes', 'brackets', 'never'],
      description: 'Auto surround selection behavior'
    },
    formatOnSave: {
      type: 'boolean',
      description: 'Format document on save'
    },
    formatOnPaste: {
      type: 'boolean',
      description: 'Format pasted content'
    },
    formatOnType: {
      type: 'boolean',
      description: 'Format while typing'
    },
    minimap: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        side: { type: 'string', enum: ['right', 'left'] },
        showSlider: { type: 'string', enum: ['always', 'mouseover'] },
        scale: { type: 'number', minimum: 1, maximum: 10 },
        maxColumn: { type: 'number', minimum: 50, maximum: 300 }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

export const CURSOR_AI_SCHEMA: CursorValidationSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      description: 'Enable AI features'
    },
    model: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'AI model name'
    },
    apiKey: {
      type: 'string',
      minLength: 10,
      maxLength: 200,
      pattern: '^[a-zA-Z0-9_-]+$',
      description: 'API key for AI service'
    },
    maxTokens: {
      type: 'number',
      minimum: 1,
      maximum: 100000,
      description: 'Maximum tokens per request'
    },
    temperature: {
      type: 'number',
      minimum: 0,
      maximum: 2,
      description: 'Sampling temperature'
    },
    topP: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Top-p sampling parameter'
    },
    presencePenalty: {
      type: 'number',
      minimum: -2,
      maximum: 2,
      description: 'Presence penalty'
    },
    frequencyPenalty: {
      type: 'number',
      minimum: -2,
      maximum: 2,
      description: 'Frequency penalty'
    },
    systemPrompt: {
      type: 'string',
      maxLength: 10000,
      description: 'System prompt'
    },
    codegenEnabled: {
      type: 'boolean',
      description: 'Enable code generation'
    },
    chatEnabled: {
      type: 'boolean',
      description: 'Enable chat feature'
    },
    completionsEnabled: {
      type: 'boolean',
      description: 'Enable completions'
    },
    inlineCompletionsEnabled: {
      type: 'boolean',
      description: 'Enable inline completions'
    },
    codeActionsEnabled: {
      type: 'boolean',
      description: 'Enable code actions'
    },
    diagnosticsEnabled: {
      type: 'boolean',
      description: 'Enable diagnostics'
    },
    refactoringEnabled: {
      type: 'boolean',
      description: 'Enable refactoring'
    },
    documentationEnabled: {
      type: 'boolean',
      description: 'Enable documentation generation'
    },
    testGenerationEnabled: {
      type: 'boolean',
      description: 'Enable test generation'
    },
    explainCodeEnabled: {
      type: 'boolean',
      description: 'Enable code explanation'
    },
    reviewCodeEnabled: {
      type: 'boolean',
      description: 'Enable code review'
    },
    optimizeCodeEnabled: {
      type: 'boolean',
      description: 'Enable code optimization'
    },
    contextLength: {
      type: 'number',
      minimum: 512,
      maximum: 32768,
      description: 'Context length in tokens'
    },
    responseFormat: {
      type: 'string',
      enum: ['text', 'markdown', 'code'],
      description: 'Response format'
    },
    languages: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1,
        maxLength: 50
      },
      maxItems: 100,
      uniqueItems: true,
      description: 'Supported languages'
    },
    excludePatterns: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1,
        maxLength: 200
      },
      maxItems: 100,
      description: 'File patterns to exclude'
    },
    includePatterns: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1,
        maxLength: 200
      },
      maxItems: 100,
      description: 'File patterns to include'
    },
    privacy: {
      type: 'object',
      properties: {
        collectTelemetry: { type: 'boolean' },
        shareCodeWithProvider: { type: 'boolean' },
        logConversations: { type: 'boolean' },
        anonymizeData: { type: 'boolean' },
        dataRetentionDays: { type: 'number', minimum: 1, maximum: 365 },
        excludeSensitiveData: { type: 'boolean' },
        sensitiveDataPatterns: {
          type: 'array',
          items: { type: 'string', minLength: 1, maxLength: 100 },
          maxItems: 50
        }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

export const CURSOR_EXTENSIONS_SCHEMA: CursorValidationSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'string',
        pattern: '^[a-z0-9][a-z0-9-]*\\.[a-z0-9][a-z0-9-]*$',
        description: 'Extension ID in format: publisher.name'
      },
      maxItems: 100,
      uniqueItems: true,
      description: 'Recommended extensions'
    },
    unwantedRecommendations: {
      type: 'array',
      items: {
        type: 'string',
        pattern: '^[a-z0-9][a-z0-9-]*\\.[a-z0-9][a-z0-9-]*$',
        description: 'Extension ID in format: publisher.name'
      },
      maxItems: 100,
      uniqueItems: true,
      description: 'Unwanted recommendations'
    },
    installed: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            pattern: '^[a-z0-9][a-z0-9-]*\\.[a-z0-9][a-z0-9-]*$',
            description: 'Extension ID'
          },
          version: {
            type: 'string',
            pattern: '^(\\d+)\\.(\\d+)\\.(\\d+)(?:-([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?(?:\\+([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?$',
            description: 'Semantic version'
          },
          enabled: {
            type: 'boolean',
            description: 'Extension enabled state'
          },
          installed: {
            type: 'boolean',
            description: 'Extension installed state'
          },
          source: {
            type: 'string',
            enum: ['marketplace', 'vsix', 'builtin', 'manual'],
            description: 'Installation source'
          }
        },
        required: ['id'],
        additionalProperties: true
      },
      maxItems: 1000,
      description: 'Installed extensions'
    },
    marketplace: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        allowPreReleaseVersions: { type: 'boolean' },
        showUpdatesNotification: { type: 'boolean' },
        checkUpdatesInterval: { type: 'number', minimum: 60000, maximum: 86400000 },
        trustedExtensionAuthenticationProviders: {
          type: 'array',
          items: { type: 'string', minLength: 1, maxLength: 100 },
          maxItems: 20
        }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

export const CURSOR_DEBUG_SCHEMA: CursorValidationSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    version: {
      type: 'string',
      enum: ['0.2.0', '2.0.0'],
      description: 'Configuration version'
    },
    configurations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Configuration name'
          },
          type: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            description: 'Debugger type'
          },
          request: {
            type: 'string',
            enum: ['launch', 'attach'],
            description: 'Request type'
          },
          program: {
            type: 'string',
            description: 'Program path'
          },
          args: {
            oneOf: [
              { type: 'string' },
              {
                type: 'array',
                items: { type: 'string' },
                maxItems: 100
              }
            ],
            description: 'Program arguments'
          },
          cwd: {
            type: 'string',
            description: 'Working directory'
          },
          env: {
            type: 'object',
            patternProperties: {
              '^[A-Z_][A-Z0-9_]*$': { type: 'string' }
            },
            maxProperties: 100,
            description: 'Environment variables'
          },
          port: {
            type: 'number',
            minimum: 1,
            maximum: 65535,
            description: 'Port number'
          },
          host: {
            type: 'string',
            format: 'hostname',
            description: 'Host address'
          }
        },
        required: ['name', 'type', 'request'],
        additionalProperties: true
      },
      minItems: 1,
      maxItems: 50,
      description: 'Debug configurations'
    },
    compounds: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 100
          },
          configurations: {
            type: 'array',
            items: {
              oneOf: [
                { type: 'string' },
                {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    folder: { type: 'string' }
                  },
                  required: ['name']
                }
              ]
            },
            minItems: 1,
            maxItems: 20
          }
        },
        required: ['name', 'configurations'],
        additionalProperties: true
      },
      maxItems: 20
    }
  },
  required: ['version', 'configurations'],
  additionalProperties: false
};

export const CURSOR_TASKS_SCHEMA: CursorValidationSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    version: {
      type: 'string',
      enum: ['2.0.0'],
      description: 'Tasks configuration version'
    },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Task label'
          },
          type: {
            type: 'string',
            enum: ['shell', 'process', 'npm', 'typescript'],
            description: 'Task type'
          },
          command: {
            type: 'string',
            minLength: 1,
            maxLength: 500,
            description: 'Command to execute'
          },
          args: {
            oneOf: [
              { type: 'string' },
              {
                type: 'array',
                items: { type: 'string' },
                maxItems: 100
              }
            ],
            description: 'Command arguments'
          },
          options: {
            type: 'object',
            properties: {
              cwd: { type: 'string' },
              env: {
                type: 'object',
                patternProperties: {
                  '^[A-Z_][A-Z0-9_]*$': { type: 'string' }
                },
                maxProperties: 100
              },
              shell: {
                type: 'object',
                properties: {
                  executable: { type: 'string' },
                  args: {
                    type: 'array',
                    items: { type: 'string' },
                    maxItems: 50
                  }
                }
              }
            },
            additionalProperties: false
          },
          group: {
            oneOf: [
              { type: 'string', enum: ['build', 'test', 'clean', 'rebuild'] },
              {
                type: 'object',
                properties: {
                  kind: { type: 'string', enum: ['build', 'test', 'clean', 'rebuild'] },
                  isDefault: { type: 'boolean' }
                },
                required: ['kind'],
                additionalProperties: false
              }
            ]
          },
          presentation: {
            type: 'object',
            properties: {
              echo: { type: 'boolean' },
              reveal: { type: 'string', enum: ['always', 'silent', 'never'] },
              revealProblems: { type: 'string', enum: ['always', 'onProblem', 'never'] },
              focus: { type: 'boolean' },
              panel: { type: 'string', enum: ['shared', 'dedicated', 'new'] },
              showReuseMessage: { type: 'boolean' },
              clear: { type: 'boolean' },
              group: { type: 'string' },
              close: { type: 'boolean' }
            },
            additionalProperties: false
          },
          problemMatcher: {
            oneOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' }, maxItems: 10 },
              {
                type: 'object',
                properties: {
                  owner: { type: 'string' },
                  source: { type: 'string' },
                  severity: { type: 'string', enum: ['error', 'warning', 'info'] },
                  applyTo: { type: 'string', enum: ['allDocuments', 'openDocuments', 'closedDocuments'] },
                  fileLocation: {
                    oneOf: [
                      { type: 'string', enum: ['absolute', 'relative'] },
                      { type: 'array', items: { type: 'string' }, maxItems: 10 }
                    ]
                  }
                },
                additionalProperties: true
              }
            ]
          },
          dependsOn: {
            oneOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' }, maxItems: 20 },
              {
                type: 'object',
                properties: {
                  task: { type: 'string' },
                  folder: { type: 'string' }
                },
                required: ['task']
              }
            ]
          },
          dependsOrder: {
            type: 'string',
            enum: ['parallel', 'sequence']
          }
        },
        required: ['label', 'type'],
        additionalProperties: true
      },
      minItems: 1,
      maxItems: 100,
      description: 'Task definitions'
    }
  },
  required: ['version', 'tasks'],
  additionalProperties: false
};

export const CURSOR_SNIPPETS_SCHEMA: CursorValidationSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  patternProperties: {
    '^[a-zA-Z][a-zA-Z0-9-_]*$': {
      type: 'object',
      properties: {
        scope: {
          oneOf: [
            { type: 'string' },
            { type: 'array', items: { type: 'string' }, maxItems: 20, uniqueItems: true }
          ],
          description: 'Language scope(s)'
        },
        prefix: {
          oneOf: [
            { type: 'string', minLength: 1, maxLength: 50 },
            { type: 'array', items: { type: 'string', minLength: 1, maxLength: 50 }, maxItems: 10 }
          ],
          description: 'Trigger prefix(es)'
        },
        body: {
          oneOf: [
            { type: 'string', maxLength: 10000 },
            { type: 'array', items: { type: 'string', maxLength: 1000 }, maxItems: 100 }
          ],
          description: 'Snippet body'
        },
        description: {
          type: 'string',
          maxLength: 500,
          description: 'Snippet description'
        },
        detail: {
          type: 'string',
          maxLength: 200,
          description: 'Snippet detail'
        },
        documentation: {
          type: 'string',
          maxLength: 2000,
          description: 'Snippet documentation'
        },
        insertFormat: {
          type: 'string',
          enum: ['snippet', 'plainText'],
          description: 'Insert format'
        },
        isFileTemplate: {
          type: 'boolean',
          description: 'Is file template'
        }
      },
      required: ['prefix', 'body'],
      additionalProperties: false
    }
  },
  maxProperties: 1000,
  additionalProperties: false
};

export const CURSOR_WORKSPACE_SCHEMA: CursorValidationSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    folders: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Folder name'
          },
          path: {
            type: 'string',
            minLength: 1,
            maxLength: 500,
            description: 'Folder path'
          },
          uri: {
            type: 'string',
            format: 'uri',
            description: 'Folder URI'
          }
        },
        required: ['path'],
        additionalProperties: false
      },
      minItems: 1,
      maxItems: 50,
      description: 'Workspace folders'
    },
    settings: {
      type: 'object',
      description: 'Workspace settings'
    },
    extensions: {
      type: 'object',
      properties: {
        recommendations: {
          type: 'array',
          items: {
            type: 'string',
            pattern: '^[a-z0-9][a-z0-9-]*\\.[a-z0-9][a-z0-9-]*$'
          },
          maxItems: 100,
          uniqueItems: true
        },
        unwantedRecommendations: {
          type: 'array',
          items: {
            type: 'string',
            pattern: '^[a-z0-9][a-z0-9-]*\\.[a-z0-9][a-z0-9-]*$'
          },
          maxItems: 100,
          uniqueItems: true
        }
      },
      additionalProperties: false
    }
  },
  required: ['folders'],
  additionalProperties: true
};

// Composite schemas
export const CURSOR_GLOBAL_SETTINGS_SCHEMA: CursorValidationSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    editor: CURSOR_EDITOR_SCHEMA,
    ai: CURSOR_AI_SCHEMA,
    workbench: {
      type: 'object',
      properties: {
        colorTheme: { type: 'string', maxLength: 100 },
        iconTheme: { type: 'string', maxLength: 100 },
        productIconTheme: { type: 'string', maxLength: 100 },
        startupEditor: {
          type: 'string',
          enum: ['none', 'welcomePage', 'readme', 'newUntitledFile', 'welcomePageInEmptyWorkbench']
        }
      },
      additionalProperties: true
    },
    extensions: {
      type: 'object',
      properties: {
        autoCheckUpdates: { type: 'boolean' },
        autoUpdate: { type: 'boolean' },
        closeExtensionDetailsOnViewChange: { type: 'boolean' },
        ignoreRecommendations: { type: 'boolean' },
        showRecommendationsOnlyOnDemand: { type: 'boolean' }
      },
      additionalProperties: false
    },
    security: {
      type: 'object',
      properties: {
        workspace: {
          type: 'object',
          properties: {
            trust: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                banner: { type: 'string', enum: ['always', 'untilDismissed', 'never'] },
                untrustedFiles: { type: 'string', enum: ['prompt', 'open', 'newWindow'] },
                emptyWindow: { type: 'boolean' },
                startupPrompt: { type: 'string', enum: ['always', 'once', 'never'] }
              },
              additionalProperties: false
            }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    }
  },
  additionalProperties: true
};

// Schema registry
export const CURSOR_SCHEMA_REGISTRY = {
  'cursor-global-settings': CURSOR_GLOBAL_SETTINGS_SCHEMA,
  'cursor-editor': CURSOR_EDITOR_SCHEMA,
  'cursor-ai': CURSOR_AI_SCHEMA,
  'cursor-extensions': CURSOR_EXTENSIONS_SCHEMA,
  'cursor-debug': CURSOR_DEBUG_SCHEMA,
  'cursor-tasks': CURSOR_TASKS_SCHEMA,
  'cursor-snippets': CURSOR_SNIPPETS_SCHEMA,
  'cursor-workspace': CURSOR_WORKSPACE_SCHEMA,
} as const;

export type CursorSchemaType = keyof typeof CURSOR_SCHEMA_REGISTRY;