/**
 * Cursor IDE debug and tasks configuration interfaces
 * Defines structure for launch.json and tasks.json files
 */

export interface CursorDebugConfig {
  version: string;
  configurations: CursorDebugConfiguration[];
  compounds?: CursorDebugCompound[];
  inputs?: CursorDebugInput[];
}

export interface CursorDebugConfiguration {
  name: string;
  type: string;
  request: 'launch' | 'attach';
  program?: string;
  args?: string[] | string;
  cwd?: string;
  env?: Record<string, string>;
  envFile?: string;
  console?: 'internalConsole' | 'integratedTerminal' | 'externalTerminal';
  port?: number;
  host?: string;
  address?: string;
  processId?: string | number;
  restart?: boolean;
  stopOnEntry?: boolean;
  justMyCode?: boolean;
  redirectOutput?: boolean;
  showReturnValue?: boolean;
  subProcess?: boolean;
  python?: string;
  module?: string;
  django?: boolean;
  jinja?: boolean;
  autoReload?: CursorDebugAutoReload;
  gevent?: boolean;
  pyramid?: boolean;
  serverReadyAction?: CursorDebugServerReadyAction;
  preLaunchTask?: string;
  postDebugTask?: string;
  internalConsoleOptions?: 'neverOpen' | 'openOnSessionStart' | 'openOnFirstSessionStart';
  debugOptions?: string[];
  presentation?: CursorDebugPresentation;
  windows?: Partial<CursorDebugConfiguration>;
  linux?: Partial<CursorDebugConfiguration>;
  osx?: Partial<CursorDebugConfiguration>;
  [key: string]: any; // Allow additional debugger-specific properties
}

export interface CursorDebugAutoReload {
  enable?: boolean;
  include?: string[];
  exclude?: string[];
}

export interface CursorDebugServerReadyAction {
  pattern?: string;
  action?: 'openExternally' | 'debugWithChrome';
  uriFormat?: string;
  webRoot?: string;
  killOnServerStop?: boolean;
}

export interface CursorDebugPresentation {
  hidden?: boolean;
  group?: string;
  order?: number;
}

export interface CursorDebugCompound {
  name: string;
  configurations: (string | CursorDebugCompoundConfiguration)[];
  preLaunchTask?: string;
  postDebugTask?: string;
  stopAll?: boolean;
  presentation?: CursorDebugPresentation;
}

export interface CursorDebugCompoundConfiguration {
  name: string;
  folder?: string;
}

export interface CursorDebugInput {
  id: string;
  type: 'promptString' | 'pickString' | 'command';
  description?: string;
  default?: string;
  options?: string[];
  command?: string;
  args?: any;
}

export interface CursorTasksConfig {
  version: string;
  tasks: CursorTask[];
  inputs?: CursorTaskInput[];
}

export interface CursorTask {
  label: string;
  type: string;
  command?: string;
  args?: string[] | string;
  options?: CursorTaskOptions;
  group?: string | CursorTaskGroup;
  presentation?: CursorTaskPresentation;
  problemMatcher?: string | string[] | CursorTaskProblemMatcher[];
  runOptions?: CursorTaskRunOptions;
  dependsOn?: string | string[] | CursorTaskDependency[];
  dependsOrder?: 'parallel' | 'sequence';
  icon?: CursorTaskIcon;
  hide?: boolean;
  detail?: string;
  windows?: Partial<CursorTask>;
  linux?: Partial<CursorTask>;
  osx?: Partial<CursorTask>;
  [key: string]: any; // Allow additional task type-specific properties
}

export interface CursorTaskOptions {
  cwd?: string;
  env?: Record<string, string>;
  shell?: CursorTaskShell;
}

export interface CursorTaskShell {
  executable?: string;
  args?: string[];
  quoting?: CursorTaskShellQuoting;
}

export interface CursorTaskShellQuoting {
  escape?: string | CursorTaskShellQuotingOptions;
  strong?: string | CursorTaskShellQuotingOptions;
  weak?: string | CursorTaskShellQuotingOptions;
}

export interface CursorTaskShellQuotingOptions {
  charsToEscape?: string;
  escapeChar?: string;
}

export interface CursorTaskGroup {
  kind: 'build' | 'test' | 'clean' | 'rebuild';
  isDefault?: boolean;
}

export interface CursorTaskPresentation {
  echo?: boolean;
  reveal?: 'always' | 'silent' | 'never';
  revealProblems?: 'always' | 'onProblem' | 'never';
  focus?: boolean;
  panel?: 'shared' | 'dedicated' | 'new';
  showReuseMessage?: boolean;
  clear?: boolean;
  group?: string;
  close?: boolean;
}

export interface CursorTaskProblemMatcher {
  owner?: string;
  source?: string;
  severity?: 'error' | 'warning' | 'info';
  applyTo?: 'allDocuments' | 'openDocuments' | 'closedDocuments';
  fileLocation?: 'absolute' | 'relative' | string[];
  pattern?: CursorTaskProblemPattern | CursorTaskProblemPattern[];
  background?: CursorTaskBackgroundMatcher;
  watching?: CursorTaskWatchingMatcher;
}

export interface CursorTaskProblemPattern {
  regexp: string;
  file?: number;
  location?: number;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  severity?: number;
  code?: number;
  message?: number;
  loop?: boolean;
}

export interface CursorTaskBackgroundMatcher {
  activeOnStart?: boolean;
  beginsPattern?: string | CursorTaskWatchingPattern;
  endsPattern?: string | CursorTaskWatchingPattern;
}

export interface CursorTaskWatchingMatcher {
  activeOnStart?: boolean;
  beginsPattern?: string | CursorTaskWatchingPattern;
  endsPattern?: string | CursorTaskWatchingPattern;
}

export interface CursorTaskWatchingPattern {
  regexp: string;
  file?: number;
}

export interface CursorTaskRunOptions {
  instanceLimit?: number;
  reevaluateOnRerun?: boolean;
  runOn?: 'default' | 'folderOpen';
}

export interface CursorTaskDependency {
  task: string;
  folder?: string;
}

export interface CursorTaskIcon {
  id: string;
  color?: string;
}

export interface CursorTaskInput {
  id: string;
  type: 'promptString' | 'pickString' | 'command';
  description?: string;
  default?: string;
  options?: string[];
  command?: string;
  args?: any;
}

// Specialized task types
export interface CursorShellTask extends Omit<CursorTask, 'type'> {
  type: 'shell';
  command: string;
  args?: string[];
}

export interface CursorProcessTask extends Omit<CursorTask, 'type'> {
  type: 'process';
  command: string;
  args?: string[];
}

export interface CursorNpmTask extends Omit<CursorTask, 'type' | 'command'> {
  type: 'npm';
  script: string;
  path?: string;
}

export interface CursorTypescriptTask extends Omit<CursorTask, 'type'> {
  type: 'typescript';
  tsconfig: string;
  option?: string;
}

// Debug configuration templates for common scenarios
export interface CursorDebugTemplates {
  nodejs: CursorDebugConfiguration;
  python: CursorDebugConfiguration;
  chrome: CursorDebugConfiguration;
  firefox: CursorDebugConfiguration;
  edge: CursorDebugConfiguration;
  cpp: CursorDebugConfiguration;
  java: CursorDebugConfiguration;
  dotnet: CursorDebugConfiguration;
  go: CursorDebugConfiguration;
  rust: CursorDebugConfiguration;
}

export const CURSOR_DEBUG_TEMPLATES: CursorDebugTemplates = {
  nodejs: {
    name: 'Launch Program',
    type: 'node',
    request: 'launch',
    program: '${workspaceFolder}/app.js',
    skipFiles: ['<node_internals>/**'],
    console: 'integratedTerminal',
  },
  python: {
    name: 'Python: Current File',
    type: 'python',
    request: 'launch',
    program: '${file}',
    console: 'integratedTerminal',
    justMyCode: true,
  },
  chrome: {
    name: 'Launch Chrome',
    type: 'chrome',
    request: 'launch',
    url: 'http://localhost:3000',
    webRoot: '${workspaceFolder}',
  },
  firefox: {
    name: 'Launch Firefox',
    type: 'firefox',
    request: 'launch',
    url: 'http://localhost:3000',
    webRoot: '${workspaceFolder}',
  },
  edge: {
    name: 'Launch Edge',
    type: 'edge',
    request: 'launch',
    url: 'http://localhost:3000',
    webRoot: '${workspaceFolder}',
  },
  cpp: {
    name: '(gdb) Launch',
    type: 'cppdbg',
    request: 'launch',
    program: '${workspaceFolder}/main',
    args: [],
    stopOnEntry: false,
    cwd: '${workspaceFolder}',
    environment: [],
    externalConsole: false,
  },
  java: {
    name: 'Launch Java',
    type: 'java',
    request: 'launch',
    mainClass: 'Main',
    classPaths: ['${workspaceFolder}'],
  },
  dotnet: {
    name: 'Launch .NET',
    type: 'coreclr',
    request: 'launch',
    program: '${workspaceFolder}/bin/Debug/net6.0/app.dll',
    args: [],
    cwd: '${workspaceFolder}',
    stopOnEntry: false,
  },
  go: {
    name: 'Launch Go',
    type: 'go',
    request: 'launch',
    mode: 'auto',
    program: '${workspaceFolder}',
    env: {},
    args: [],
  },
  rust: {
    name: 'Launch Rust',
    type: 'lldb',
    request: 'launch',
    program: '${workspaceFolder}/target/debug/app',
    args: [],
    cwd: '${workspaceFolder}',
  },
};

// Task templates for common build systems
export interface CursorTaskTemplates {
  npm: CursorNpmTask[];
  maven: CursorShellTask[];
  gradle: CursorShellTask[];
  make: CursorShellTask[];
  cmake: CursorShellTask[];
  cargo: CursorShellTask[];
  dotnet: CursorShellTask[];
  python: CursorShellTask[];
}

export const CURSOR_TASK_TEMPLATES: CursorTaskTemplates = {
  npm: [
    {
      type: 'npm',
      script: 'build',
      label: 'npm: build',
      group: { kind: 'build', isDefault: true },
      presentation: { echo: true, reveal: 'always', focus: false, panel: 'shared' },
      problemMatcher: '$tsc',
    },
    {
      type: 'npm',
      script: 'test',
      label: 'npm: test',
      group: { kind: 'test', isDefault: true },
      presentation: { echo: true, reveal: 'always', focus: false, panel: 'shared' },
    },
    {
      type: 'npm',
      script: 'start',
      label: 'npm: start',
      presentation: { echo: true, reveal: 'always', focus: false, panel: 'shared' },
    },
  ],
  maven: [
    {
      type: 'shell',
      label: 'Maven: compile',
      command: 'mvn',
      args: ['compile'],
      group: { kind: 'build', isDefault: true },
      presentation: { echo: true, reveal: 'always', focus: false, panel: 'shared' },
      problemMatcher: '$maven',
    },
    {
      type: 'shell',
      label: 'Maven: test',
      command: 'mvn',
      args: ['test'],
      group: { kind: 'test', isDefault: true },
      presentation: { echo: true, reveal: 'always', focus: false, panel: 'shared' },
    },
  ],
  gradle: [
    {
      type: 'shell',
      label: 'Gradle: build',
      command: './gradlew',
      args: ['build'],
      group: { kind: 'build', isDefault: true },
      presentation: { echo: true, reveal: 'always', focus: false, panel: 'shared' },
      problemMatcher: '$gradle',
    },
  ],
  make: [
    {
      type: 'shell',
      label: 'Make: build',
      command: 'make',
      args: [],
      group: { kind: 'build', isDefault: true },
      presentation: { echo: true, reveal: 'always', focus: false, panel: 'shared' },
      problemMatcher: '$gcc',
    },
  ],
  cmake: [
    {
      type: 'shell',
      label: 'CMake: configure',
      command: 'cmake',
      args: ['-B', 'build'],
      group: 'build',
      presentation: { echo: true, reveal: 'always', focus: false, panel: 'shared' },
    },
    {
      type: 'shell',
      label: 'CMake: build',
      command: 'cmake',
      args: ['--build', 'build'],
      group: { kind: 'build', isDefault: true },
      presentation: { echo: true, reveal: 'always', focus: false, panel: 'shared' },
      dependsOn: 'CMake: configure',
    },
  ],
  cargo: [
    {
      type: 'shell',
      label: 'Cargo: build',
      command: 'cargo',
      args: ['build'],
      group: { kind: 'build', isDefault: true },
      presentation: { echo: true, reveal: 'always', focus: false, panel: 'shared' },
      problemMatcher: '$rustc',
    },
    {
      type: 'shell',
      label: 'Cargo: test',
      command: 'cargo',
      args: ['test'],
      group: { kind: 'test', isDefault: true },
      presentation: { echo: true, reveal: 'always', focus: false, panel: 'shared' },
    },
  ],
  dotnet: [
    {
      type: 'shell',
      label: '.NET: build',
      command: 'dotnet',
      args: ['build'],
      group: { kind: 'build', isDefault: true },
      presentation: { echo: true, reveal: 'always', focus: false, panel: 'shared' },
      problemMatcher: '$msCompile',
    },
    {
      type: 'shell',
      label: '.NET: test',
      command: 'dotnet',
      args: ['test'],
      group: { kind: 'test', isDefault: true },
      presentation: { echo: true, reveal: 'always', focus: false, panel: 'shared' },
    },
  ],
  python: [
    {
      type: 'shell',
      label: 'Python: run',
      command: 'python',
      args: ['${file}'],
      group: 'build',
      presentation: { echo: true, reveal: 'always', focus: false, panel: 'shared' },
    },
    {
      type: 'shell',
      label: 'Python: test',
      command: 'python',
      args: ['-m', 'pytest'],
      group: { kind: 'test', isDefault: true },
      presentation: { echo: true, reveal: 'always', focus: false, panel: 'shared' },
    },
  ],
};

// Validation functions
export function validateCursorDebugConfig(config: CursorDebugConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.version) {
    errors.push('Missing version field in debug configuration');
  } else if (!['0.2.0', '2.0.0'].includes(config.version)) {
    warnings.push(`Unsupported debug configuration version: ${config.version}`);
  }

  if (!config.configurations || !Array.isArray(config.configurations)) {
    errors.push('Configurations field must be an array');
  } else {
    config.configurations.forEach((conf, index) => {
      if (!conf.name) {
        errors.push(`Configuration at index ${index} is missing name`);
      }
      if (!conf.type) {
        errors.push(`Configuration "${conf.name || index}" is missing type`);
      }
      if (!['launch', 'attach'].includes(conf.request)) {
        errors.push(`Configuration "${conf.name || index}" has invalid request type`);
      }
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateCursorTasksConfig(config: CursorTasksConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.version) {
    errors.push('Missing version field in tasks configuration');
  } else if (!['2.0.0'].includes(config.version)) {
    warnings.push(`Unsupported tasks configuration version: ${config.version}`);
  }

  if (!config.tasks || !Array.isArray(config.tasks)) {
    errors.push('Tasks field must be an array');
  } else {
    config.tasks.forEach((task, index) => {
      if (!task.label) {
        errors.push(`Task at index ${index} is missing label`);
      }
      if (!task.type) {
        errors.push(`Task "${task.label || index}" is missing type`);
      }
      if (task.type === 'shell' && !task.command) {
        errors.push(`Shell task "${task.label || index}" is missing command`);
      }
      if (task.type === 'process' && !task.command) {
        errors.push(`Process task "${task.label || index}" is missing command`);
      }
      if (task.type === 'npm' && !(task as any).script) {
        errors.push(`NPM task "${task.label || index}" is missing script`);
      }
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}