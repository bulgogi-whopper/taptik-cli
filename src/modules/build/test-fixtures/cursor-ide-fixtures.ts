/**
 * Test fixtures for Cursor IDE build feature
 * Contains mock data structures for testing Cursor IDE configuration collection and transformation
 */

export const CURSOR_SETTINGS_FIXTURE = {
  valid: {
    'editor.fontSize': 14,
    'editor.fontFamily': 'JetBrains Mono',
    'editor.tabSize': 2,
    'editor.wordWrap': 'on',
    'workbench.colorTheme': 'One Dark Pro',
    'cursor.aiProvider': 'openai',
    'cursor.aiModel': 'gpt-4',
    'cursor.temperature': 0.7,
    'cursor.maxTokens': 2000,
    'files.autoSave': 'afterDelay',
    'files.autoSaveDelay': 1000,
    'terminal.integrated.fontSize': 13,
    'terminal.integrated.fontFamily': 'MesloLGS NF',
  },
  invalid: '{ invalid json content',
  malformed: {
    'editor.fontSize': 'not-a-number',
    'editor.tabSize': -1,
    'cursor.temperature': 2.5, // Out of valid range
  },
  withSensitiveData: {
    'editor.fontSize': 14,
    'cursor.apiKey': 'sk-1234567890abcdef',
    'cursor.openaiApiKey': 'sk-openai-secret-key',
    'github.token': 'ghp_1234567890abcdef',
    'azure.apiKey': 'azure-secret-key-123',
  },
};

export const CURSOR_AI_RULES_FIXTURE = {
  valid: {
    version: '1.0.0',
    rules: [
      {
        name: 'Documentation',
        pattern: '/**',
        prompt: 'Generate JSDoc documentation for this code',
        enabled: true,
      },
      {
        name: 'Refactoring',
        pattern: '*.ts',
        prompt: 'Suggest refactoring improvements',
        enabled: true,
      },
      {
        name: 'Security',
        pattern: '*.js',
        prompt: 'Check for security vulnerabilities',
        enabled: false,
      },
    ],
    globalPrompts: {
      codeReview: 'Review this code for best practices',
      testing: 'Generate unit tests for this function',
    },
  },
  withApiKeys: {
    version: '1.0.0',
    rules: [
      {
        name: 'API Integration',
        pattern: '*.api.ts',
        prompt: 'Use API key: sk-secret-123 for integration',
        apiKey: 'sk-1234567890',
      },
    ],
    globalConfig: {
      openaiKey: 'sk-openai-secret',
      anthropicKey: 'sk-anthropic-secret',
    },
  },
  malformed: {
    rules: 'should be an array',
  },
};

export const CURSOR_COPILOT_SETTINGS_FIXTURE = {
  valid: {
    enable: true,
    inlineSuggest: {
      enable: true,
      delay: 100,
    },
    publicCodeSuggestions: 'allow',
    editor: {
      enableAutoCompletions: true,
    },
    advanced: {
      temperature: 0.8,
      maxTokens: 150,
      stopSequences: ['\n\n', '```'],
    },
  },
  withCredentials: {
    enable: true,
    githubToken: 'ghu_secrettoken123',
    apiEndpoint: 'https://api.github.com/copilot',
    proxyUrl: 'http://user:pass@proxy.com:8080',
  },
};

export const CURSOR_EXTENSIONS_FIXTURE = {
  valid: {
    recommendations: [
      'dbaeumer.vscode-eslint',
      'esbenp.prettier-vscode',
      'cursor.cursor-ai',
      'github.copilot',
      'ms-vscode.typescript-language-features',
    ],
    unwantedRecommendations: [
      'ms-vscode.powershell',
    ],
  },
  withIncompatible: {
    recommendations: [
      'some.incompatible-extension',
      'another.cursor-only-extension',
      'dbaeumer.vscode-eslint',
    ],
  },
};

export const CURSOR_SNIPPETS_FIXTURE = {
  typescript: {
    'Console Log': {
      prefix: 'cl',
      body: ['console.log($1);'],
      description: 'Log to console',
    },
    'React Component': {
      prefix: 'rfc',
      body: [
        'import React from "react";',
        '',
        'const ${1:ComponentName} = () => {',
        '  return (',
        '    <div>',
        '      $0',
        '    </div>',
        '  );',
        '};',
        '',
        'export default ${1:ComponentName};',
      ],
      description: 'Create React functional component',
    },
  },
  javascript: {
    'Arrow Function': {
      prefix: 'af',
      body: ['const ${1:name} = ($2) => {', '  $0', '};'],
      description: 'ES6 arrow function',
    },
  },
};

export const CURSOR_KEYBINDINGS_FIXTURE = {
  valid: [
    {
      key: 'cmd+k cmd+d',
      command: 'cursor.aiChat',
      when: 'editorTextFocus',
    },
    {
      key: 'cmd+shift+p',
      command: 'workbench.action.showCommands',
    },
    {
      key: 'alt+enter',
      command: 'cursor.acceptSuggestion',
      when: 'suggestWidgetVisible',
    },
  ],
  withInvalidKeys: [
    {
      key: 'invalid-key-combo',
      command: 'some.command',
    },
  ],
};

export const CURSOR_WORKSPACE_FIXTURE = {
  singleRoot: {
    folders: [
      {
        path: '.',
      },
    ],
    settings: {
      'editor.formatOnSave': true,
      'files.exclude': {
        '**/.git': true,
        '**/.DS_Store': true,
        '**/node_modules': true,
      },
    },
  },
  multiRoot: {
    folders: [
      {
        path: './frontend',
        name: 'Frontend',
      },
      {
        path: './backend',
        name: 'Backend',
      },
      {
        path: './shared',
        name: 'Shared Libraries',
      },
    ],
    settings: {
      'editor.formatOnSave': true,
      'typescript.tsdk': './node_modules/typescript/lib',
    },
    launch: {
      version: '0.2.0',
      configurations: [
        {
          type: 'node',
          request: 'launch',
          name: 'Debug Backend',
          program: '${workspaceFolder:Backend}/src/index.js',
        },
      ],
    },
    tasks: {
      version: '2.0.0',
      tasks: [
        {
          label: 'Build All',
          type: 'shell',
          command: 'npm run build',
          group: 'build',
        },
      ],
    },
  },
};

export const CURSOR_LAUNCH_CONFIG_FIXTURE = {
  version: '0.2.0',
  configurations: [
    {
      type: 'node',
      request: 'launch',
      name: 'Launch Program',
      skipFiles: ['<node_internals>/**'],
      program: '${workspaceFolder}/src/index.js',
      env: {
        NODE_ENV: 'development',
        API_KEY: 'secret-api-key', // Should be filtered
      },
    },
    {
      type: 'chrome',
      request: 'launch',
      name: 'Launch Chrome',
      url: 'http://localhost:3000',
      webRoot: '${workspaceFolder}',
    },
  ],
};

export const CURSOR_TASKS_CONFIG_FIXTURE = {
  version: '2.0.0',
  tasks: [
    {
      label: 'Build TypeScript',
      type: 'typescript',
      tsconfig: 'tsconfig.json',
      problemMatcher: ['$tsc'],
      group: {
        kind: 'build',
        isDefault: true,
      },
    },
    {
      label: 'Run Tests',
      type: 'shell',
      command: 'npm test',
      group: 'test',
    },
  ],
};

// Mock directory structures for testing
export const MOCK_CURSOR_DIRECTORY_STRUCTURE = {
  global: {
    '.cursor': {
      'settings.json': JSON.stringify(CURSOR_SETTINGS_FIXTURE.valid),
      'ai-rules.json': JSON.stringify(CURSOR_AI_RULES_FIXTURE.valid),
      'copilot-settings.json': JSON.stringify(CURSOR_COPILOT_SETTINGS_FIXTURE.valid),
      'keybindings.json': JSON.stringify(CURSOR_KEYBINDINGS_FIXTURE.valid),
      extensions: {
        'extensions.json': JSON.stringify(CURSOR_EXTENSIONS_FIXTURE.valid),
      },
      snippets: {
        'typescript.json': JSON.stringify(CURSOR_SNIPPETS_FIXTURE.typescript),
        'javascript.json': JSON.stringify(CURSOR_SNIPPETS_FIXTURE.javascript),
      },
    },
  },
  project: {
    '.cursor': {
      'settings.json': JSON.stringify({
        'editor.formatOnSave': true,
        'cursor.projectSpecific': true,
      }),
      'workspace.json': JSON.stringify(CURSOR_WORKSPACE_FIXTURE.singleRoot),
      '.vscode': {
        'launch.json': JSON.stringify(CURSOR_LAUNCH_CONFIG_FIXTURE),
        'tasks.json': JSON.stringify(CURSOR_TASKS_CONFIG_FIXTURE),
      },
    },
  },
  empty: {
    '.cursor': {},
  },
  malformed: {
    '.cursor': {
      'settings.json': '{ invalid json',
      'ai-rules.json': 'not even json',
    },
  },
};

// Helper function to create mock file system
export function createMockCursorFileSystem(
  type: keyof typeof MOCK_CURSOR_DIRECTORY_STRUCTURE,
): Record<string, string | Record<string, unknown>> {
  return MOCK_CURSOR_DIRECTORY_STRUCTURE[type];
}

// Security patterns for testing
export const SECURITY_PATTERNS_TEST_CASES = [
  {
    input: 'sk-1234567890abcdef',
    shouldBeFiltered: true,
    category: 'api_key',
  },
  {
    input: 'ghp_1234567890abcdef',
    shouldBeFiltered: true,
    category: 'github_token',
  },
  {
    input: 'normal-string-value',
    shouldBeFiltered: false,
    category: null,
  },
  {
    input: 'AZURE_API_KEY=secret123',
    shouldBeFiltered: true,
    category: 'environment_variable',
  },
  {
    input: 'Bearer eyJhbGciOiJIUzI1NiIs',
    shouldBeFiltered: true,
    category: 'jwt_token',
  },
];

// VS Code compatibility test cases
export const VSCODE_COMPATIBILITY_TEST_CASES = [
  {
    setting: 'editor.fontSize',
    value: 14,
    isCompatible: true,
  },
  {
    setting: 'cursor.aiModel',
    value: 'gpt-4',
    isCompatible: false, // Cursor-specific
  },
  {
    setting: 'workbench.colorTheme',
    value: 'One Dark Pro',
    isCompatible: true,
  },
  {
    setting: 'invalid.setting.name',
    value: 'anything',
    isCompatible: false,
  },
];

// Extension compatibility mapping
export const EXTENSION_COMPATIBILITY_MAP = {
  'cursor.cursor-ai': {
    vsCodeAlternative: null, // No VS Code equivalent
    isCompatible: false,
  },
  'github.copilot': {
    vsCodeAlternative: 'github.copilot',
    isCompatible: true,
  },
  'dbaeumer.vscode-eslint': {
    vsCodeAlternative: 'dbaeumer.vscode-eslint',
    isCompatible: true,
  },
  'esbenp.prettier-vscode': {
    vsCodeAlternative: 'esbenp.prettier-vscode',
    isCompatible: true,
  },
};

// Export all fixtures as a collection
export const CURSOR_TEST_FIXTURES = {
  settings: CURSOR_SETTINGS_FIXTURE,
  aiRules: CURSOR_AI_RULES_FIXTURE,
  copilotSettings: CURSOR_COPILOT_SETTINGS_FIXTURE,
  extensions: CURSOR_EXTENSIONS_FIXTURE,
  snippets: CURSOR_SNIPPETS_FIXTURE,
  keybindings: CURSOR_KEYBINDINGS_FIXTURE,
  workspace: CURSOR_WORKSPACE_FIXTURE,
  launch: CURSOR_LAUNCH_CONFIG_FIXTURE,
  tasks: CURSOR_TASKS_CONFIG_FIXTURE,
  mockFileSystem: MOCK_CURSOR_DIRECTORY_STRUCTURE,
  securityPatterns: SECURITY_PATTERNS_TEST_CASES,
  vsCodeCompatibility: VSCODE_COMPATIBILITY_TEST_CASES,
  extensionCompatibility: EXTENSION_COMPATIBILITY_MAP,
};