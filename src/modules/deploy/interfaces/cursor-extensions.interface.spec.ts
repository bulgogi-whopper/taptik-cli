import { describe, it, expect } from 'vitest';

import {
  validateCursorExtensionsConfig,
  isValidExtensionId,
  isValidVersionString,
  getExtensionCategory,
  sortExtensions,
  getExtensionSizeEstimate,
  CursorExtensionsConfig,
  CursorInstalledExtension,
} from './cursor-extensions.interface';

describe('CursorExtensionsInterface', () => {
  describe('validateCursorExtensionsConfig', () => {
    it('should validate valid extensions configuration', () => {
      const validConfig: CursorExtensionsConfig = {
        recommendations: [
          'ms-python.python',
          'ms-vscode.typescript-language-features',
          'esbenp.prettier-vscode',
        ],
        unwantedRecommendations: [
          'ms-vscode.vscode-json',
        ],
        installed: [
          {
            id: 'ms-python.python',
            version: '2021.12.1559732655',
            enabled: true,
            installed: true,
            source: 'marketplace',
          },
        ],
      };

      const result = validateCursorExtensionsConfig(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
    });

    it('should detect invalid extension IDs in recommendations', () => {
      const invalidConfig: CursorExtensionsConfig = {
        recommendations: [
          'invalid-extension-id', // Missing publisher.name format
          'publisher', // Missing extension name
          '', // Empty string
        ],
      };

      const result = validateCursorExtensionsConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0].type).toBe('invalid_id');
      expect(result.errors[0].extensionId).toBe('invalid-extension-id');
    });

    it('should detect invalid extension IDs in unwanted recommendations', () => {
      const invalidConfig: CursorExtensionsConfig = {
        unwantedRecommendations: [
          'bad.extension.id.format',
          '123.invalid',
        ],
      };

      const result = validateCursorExtensionsConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.includes('unwantedRecommendations'))).toBe(true);
    });

    it('should detect invalid extension IDs in installed extensions', () => {
      const invalidConfig: CursorExtensionsConfig = {
        installed: [
          {
            id: 'invalid-format',
            version: '1.0.0',
            enabled: true,
          },
          {
            id: 'valid.extension',
            version: 'invalid-version-format',
            enabled: true,
          },
        ],
      };

      const result = validateCursorExtensionsConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.extensionId === 'invalid-format')).toBe(true);
      expect(result.warnings.some(w => w.extensionId === 'valid.extension')).toBe(true);
    });

    it('should detect conflicts between recommendations and unwanted', () => {
      const conflictConfig: CursorExtensionsConfig = {
        recommendations: ['ms-python.python', 'esbenp.prettier-vscode'],
        unwantedRecommendations: ['ms-python.python', 'ms-vscode.typescript'],
      };

      const result = validateCursorExtensionsConfig(conflictConfig);

      expect(result.valid).toBe(true); // Warnings don't make it invalid
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].extensionId).toBe('ms-python.python');
      expect(result.warnings[0].type).toBe('compatibility_issue');
    });

    it('should handle empty configuration', () => {
      const emptyConfig: CursorExtensionsConfig = {};

      const result = validateCursorExtensionsConfig(emptyConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should validate complex installed extension metadata', () => {
      const complexConfig: CursorExtensionsConfig = {
        installed: [
          {
            id: 'ms-python.python',
            version: '2021.12.1559732655',
            enabled: true,
            installed: true,
            installDate: '2024-01-01T00:00:00.000Z',
            updateDate: '2024-01-15T00:00:00.000Z',
            source: 'marketplace',
            dependencies: ['ms-python.pylint'],
            extensionDependencies: ['ms-python.python-base'],
            extensionPack: false,
            settings: {
              'python.defaultInterpreterPath': '/usr/bin/python3',
              'python.linting.enabled': true,
            },
            metadata: {
              displayName: 'Python',
              description: 'IntelliSense, linting, debugging, code navigation',
              version: '2021.12.1559732655',
              publisher: 'ms-python',
              categories: ['Programming Languages', 'Debuggers'],
              keywords: ['python', 'intellisense', 'debugging'],
              license: 'MIT',
              repository: 'https://github.com/Microsoft/vscode-python',
              engines: {
                'vscode': '^1.60.0',
              },
              contributes: {
                commands: [
                  {
                    command: 'python.execInTerminal',
                    title: 'Run Python File in Terminal',
                    category: 'Python',
                  },
                ],
                languages: [
                  {
                    id: 'python',
                    aliases: ['Python', 'py'],
                    extensions: ['.py', '.pyw'],
                    configuration: './language-configuration.json',
                  },
                ],
              },
            },
          },
        ],
      };

      const result = validateCursorExtensionsConfig(complexConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('isValidExtensionId', () => {
    it('should validate correct extension ID formats', () => {
      const validIds = [
        'ms-python.python',
        'esbenp.prettier-vscode',
        'bradlc.vscode-tailwindcss',
        'ms-vscode.typescript-language-features',
        'redhat.vscode-yaml',
        'a.b', // Minimal valid format
        'publisher123.extension-name',
        'pub-lisher.ext123',
      ];

      validIds.forEach(id => {
        expect(isValidExtensionId(id)).toBe(true);
      });
    });

    it('should reject invalid extension ID formats', () => {
      const invalidIds = [
        'publisher', // Missing extension name
        '.extension', // Missing publisher
        'publisher.', // Missing extension name
        '', // Empty string
        'publisher.extension.extra', // Too many parts
        'publisher extension', // Space instead of dot
        'Publisher.Extension', // Should work with capitals
        'pub..ext', // Double dots
        '-publisher.extension', // Publisher starting with dash
        'publisher.-extension', // Extension starting with dash
      ];

      const invalidResults = invalidIds.filter(id => id !== 'Publisher.Extension');
      
      invalidResults.forEach(id => {
        expect(isValidExtensionId(id)).toBe(false);
      });
      
      // Capital letters should be allowed
      expect(isValidExtensionId('Publisher.Extension')).toBe(true);
    });
  });

  describe('isValidVersionString', () => {
    it('should validate correct semantic version formats', () => {
      const validVersions = [
        '1.0.0',
        '2.1.3',
        '10.20.30',
        '1.0.0-alpha',
        '1.0.0-alpha.1',
        '1.0.0-alpha.beta',
        '1.0.0+build.1',
        '1.0.0-alpha+build.1',
        '0.0.1',
      ];

      validVersions.forEach(version => {
        expect(isValidVersionString(version)).toBe(true);
      });
    });

    it('should reject invalid version formats', () => {
      const invalidVersions = [
        '1.0', // Missing patch version
        '1', // Missing minor and patch
        'v1.0.0', // Leading 'v'
        '1.0.0.0', // Too many parts
        '1.0.0-', // Trailing dash
        '1.0.0+', // Trailing plus
        'latest', // String instead of version
        '1.0.0-alpha..beta', // Double dots
        '', // Empty string
      ];

      invalidVersions.forEach(version => {
        expect(isValidVersionString(version)).toBe(false);
      });
    });
  });

  describe('getExtensionCategory', () => {
    it('should categorize known extensions correctly', () => {
      const categoryTests = [
        { id: 'ms-python.python', expected: 'Programming Languages' },
        { id: 'ms-vscode.typescript', expected: 'Programming Languages' },
        { id: 'esbenp.prettier-vscode', expected: 'Formatters' },
        { id: 'ms-vscode.vscode-eslint', expected: 'Linters' },
        { id: 'bradlc.vscode-tailwindcss', expected: 'Themes' },
        { id: 'unknown.extension', expected: 'Other' },
      ];

      categoryTests.forEach(({ id, expected }) => {
        expect(getExtensionCategory(id)).toBe(expected);
      });
    });

    it('should handle pattern matching for theme extensions', () => {
      const themeExtensions = [
        'ms-vscode.theme-monokai',
        'ms-vscode.theme-solarized',
        'ms-vscode.icons-carbon',
      ];

      themeExtensions.forEach(id => {
        expect(getExtensionCategory(id)).toBe('Themes');
      });
    });
  });

  describe('sortExtensions', () => {
    it('should sort extensions by enabled status then by ID', () => {
      const extensions: CursorInstalledExtension[] = [
        { id: 'z.disabled-extension', enabled: false },
        { id: 'a.enabled-extension', enabled: true },
        { id: 'm.disabled-extension', enabled: false },
        { id: 'b.enabled-extension', enabled: true },
      ];

      const sorted = sortExtensions(extensions);

      expect(sorted[0].id).toBe('a.enabled-extension');
      expect(sorted[0].enabled).toBe(true);
      expect(sorted[1].id).toBe('b.enabled-extension');
      expect(sorted[1].enabled).toBe(true);
      expect(sorted[2].id).toBe('m.disabled-extension');
      expect(sorted[2].enabled).toBe(false);
      expect(sorted[3].id).toBe('z.disabled-extension');
      expect(sorted[3].enabled).toBe(false);
    });

    it('should not mutate original array', () => {
      const original: CursorInstalledExtension[] = [
        { id: 'z.extension', enabled: false },
        { id: 'a.extension', enabled: true },
      ];
      const originalCopy = [...original];

      const sorted = sortExtensions(original);

      expect(original).toEqual(originalCopy);
      expect(sorted).not.toBe(original);
    });

    it('should handle extensions with undefined enabled status', () => {
      const extensions: CursorInstalledExtension[] = [
        { id: 'b.extension' }, // undefined enabled
        { id: 'a.extension', enabled: true },
        { id: 'c.extension', enabled: false },
      ];

      const sorted = sortExtensions(extensions);

      // undefined should be treated as falsy, so enabled extensions come first
      expect(sorted[0].enabled).toBe(true);
      expect(sorted[0].id).toBe('a.extension');
      expect(sorted[1].enabled).toBeUndefined();
      expect(sorted[1].id).toBe('b.extension');
      expect(sorted[2].enabled).toBe(false);
      expect(sorted[2].id).toBe('c.extension');
    });
  });

  describe('getExtensionSizeEstimate', () => {
    it('should estimate size based on extension category', () => {
      const programmingExtension: CursorInstalledExtension = {
        id: 'ms-python.python',
        metadata: {
          categories: ['Programming Languages'],
        },
      };

      const themeExtension: CursorInstalledExtension = {
        id: 'theme.extension',
        metadata: {
          categories: ['Themes'],
        },
      };

      const debuggerExtension: CursorInstalledExtension = {
        id: 'debugger.extension',
        metadata: {
          categories: ['Debuggers'],
        },
      };

      const basicExtension: CursorInstalledExtension = {
        id: 'basic.extension',
      };

      expect(getExtensionSizeEstimate(programmingExtension)).toBe(500); // 100 * 5
      expect(getExtensionSizeEstimate(themeExtension)).toBe(200); // 100 * 2
      expect(getExtensionSizeEstimate(debuggerExtension)).toBe(300); // 100 * 3
      expect(getExtensionSizeEstimate(basicExtension)).toBe(100); // 100 * 1
    });

    it('should handle extensions without metadata', () => {
      const extensionWithoutMetadata: CursorInstalledExtension = {
        id: 'no.metadata',
      };

      expect(getExtensionSizeEstimate(extensionWithoutMetadata)).toBe(100);
    });

    it('should handle extensions with empty categories', () => {
      const extensionWithEmptyCategories: CursorInstalledExtension = {
        id: 'empty.categories',
        metadata: {
          categories: [],
        },
      };

      expect(getExtensionSizeEstimate(extensionWithEmptyCategories)).toBe(100);
    });
  });

  describe('Complex Extension Configurations', () => {
    it('should handle marketplace settings validation', () => {
      const configWithMarketplace: CursorExtensionsConfig = {
        marketplace: {
          enabled: true,
          allowPreReleaseVersions: false,
          showUpdatesNotification: true,
          checkUpdatesInterval: 3600000, // 1 hour in ms
          trustedExtensionAuthenticationProviders: [
            'microsoft',
            'github',
          ],
        },
        installation: {
          autoUpdate: false,
          autoCheckUpdates: true,
          installVSIXPackages: true,
          closeExtensionDetailsOnViewChange: false,
          confirmUninstall: true,
          ignoreRecommendations: false,
          showRecommendationsOnlyOnDemand: true,
          experimentalUseUtilityProcess: false,
        },
        synchronization: {
          enabled: true,
          ignoredExtensions: ['local.extension'],
          syncInstalledExtensions: true,
          syncExtensionSettings: true,
          syncDisabledExtensions: false,
        },
      };

      const result = validateCursorExtensionsConfig(configWithMarketplace);
      expect(result.valid).toBe(true);
    });

    it('should handle extension with full contributes metadata', () => {
      const fullContributesExtension: CursorInstalledExtension = {
        id: 'full.extension',
        version: '1.0.0',
        enabled: true,
        metadata: {
          contributes: {
            commands: [
              {
                command: 'extension.helloWorld',
                title: 'Hello World',
                category: 'Extension',
                icon: {
                  light: 'resources/light/hello.svg',
                  dark: 'resources/dark/hello.svg',
                },
              },
            ],
            keybindings: [
              {
                command: 'extension.helloWorld',
                key: 'ctrl+f1',
                mac: 'cmd+f1',
                when: 'editorTextFocus',
              },
            ],
            languages: [
              {
                id: 'myLanguage',
                aliases: ['My Language', 'mylang'],
                extensions: ['.mylang'],
                configuration: './language-configuration.json',
              },
            ],
            grammars: [
              {
                language: 'myLanguage',
                scopeName: 'source.mylang',
                path: './syntaxes/mylang.tmGrammar.json',
              },
            ],
            themes: [
              {
                label: 'My Theme',
                uiTheme: 'vs-dark',
                path: './themes/my-theme.json',
              },
            ],
            configuration: {
              type: 'object',
              title: 'My Extension Configuration',
              properties: {
                'myExtension.enable': {
                  type: 'boolean',
                  default: true,
                  description: 'Enable My Extension',
                },
                'myExtension.mode': {
                  type: 'string',
                  enum: ['mode1', 'mode2'],
                  default: 'mode1',
                  description: 'Extension mode',
                },
              },
            },
            debuggers: [
              {
                type: 'myDebugger',
                label: 'My Debugger',
                program: './out/debugAdapter.js',
                runtime: 'node',
                configurationAttributes: {
                  launch: {
                    required: ['program'],
                    properties: {
                      program: {
                        type: 'string',
                        description: 'Absolute path to the program',
                        default: '${workspaceFolder}/${command:AskForProgramName}',
                      },
                    },
                  },
                },
                initialConfigurations: [
                  {
                    name: 'Launch Program',
                    type: 'myDebugger',
                    request: 'launch',
                    program: '${workspaceFolder}/${command:AskForProgramName}',
                  },
                ],
              },
            ],
            taskDefinitions: [
              {
                type: 'myTask',
                required: ['taskName'],
                properties: {
                  taskName: {
                    type: 'string',
                    description: 'The task name',
                  },
                },
              },
            ],
          },
        },
      };

      const config: CursorExtensionsConfig = {
        installed: [fullContributesExtension],
      };

      const result = validateCursorExtensionsConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should handle extensions metadata with all fields', () => {
      const extensionWithAllMetadata: CursorInstalledExtension = {
        id: 'complete.extension',
        version: '2.1.0',
        enabled: true,
        installed: true,
        installDate: '2024-01-01T10:00:00.000Z',
        updateDate: '2024-01-15T15:30:00.000Z',
        source: 'marketplace',
        dependencies: ['base.extension'],
        extensionDependencies: ['required.extension'],
        extensionPack: false,
        settings: {
          'extension.setting1': 'value1',
          'extension.setting2': true,
          'extension.setting3': 42,
        },
        metadata: {
          displayName: 'Complete Extension',
          description: 'A complete extension with all metadata',
          version: '2.1.0',
          publisher: 'complete-publisher',
          categories: ['Programming Languages', 'Other'],
          keywords: ['complete', 'metadata', 'example'],
          license: 'MIT',
          repository: 'https://github.com/publisher/complete-extension',
          homepage: 'https://complete-extension.com',
          bugs: 'https://github.com/publisher/complete-extension/issues',
          icon: 'images/icon.png',
          galleryBanner: {
            color: '#1e1e1e',
            theme: 'dark',
          },
          preview: false,
          engines: {
            vscode: '^1.60.0',
            node: '>=16.0.0',
          },
          activationEvents: [
            'onLanguage:typescript',
            'onCommand:extension.activate',
          ],
          main: './out/extension.js',
        },
      };

      const config: CursorExtensionsConfig = {
        installed: [extensionWithAllMetadata],
        metadata: {
          version: '1.0.0',
          lastUpdated: '2024-01-20T12:00:00.000Z',
          totalExtensions: 1,
          enabledExtensions: 1,
          disabledExtensions: 0,
          categories: {
            'Programming Languages': 1,
            'Other': 1,
          },
          publishers: {
            'complete-publisher': 1,
          },
          syncHash: 'abc123def456',
          compatibilityVersion: '1.74.0',
        },
      };

      const result = validateCursorExtensionsConfig(config);
      expect(result.valid).toBe(true);
    });
  });
});