import { DeploymentResult, DeploymentOptions } from './deployment-result.interface';
import { ValidationError, ValidationWarning, ComponentValidationResult } from './deploy-options.interface';

// Cursor-specific deployment interfaces
export interface CursorDeploymentOptions extends DeploymentOptions {
  platform: 'cursor-ide';
  cursorComponents?: CursorComponentType[];
  skipCursorComponents?: CursorComponentType[];
  cursorConflictStrategy?: CursorConflictStrategy;
  aiSecurityLevel?: AISecurityLevel;
  extensionValidation?: boolean;
  workspaceMode?: WorkspaceMode;
}

export type CursorComponentType = 
  | 'settings' 
  | 'extensions' 
  | 'snippets' 
  | 'ai-config' 
  | 'debug-config' 
  | 'tasks' 
  | 'workspace';

export enum CursorConflictStrategy {
  PROMPT = 'prompt',
  MERGE = 'merge',
  BACKUP = 'backup',
  SKIP = 'skip',
  OVERWRITE = 'overwrite'
}

export enum AISecurityLevel {
  STRICT = 'strict',
  STANDARD = 'standard',
  PERMISSIVE = 'permissive'
}

export enum WorkspaceMode {
  SINGLE_ROOT = 'single-root',
  MULTI_ROOT = 'multi-root',
  AUTO_DETECT = 'auto-detect'
}

export interface CursorDeploymentResult extends DeploymentResult {
  cursorComponents: {
    [key in CursorComponentType]: {
      deployed: boolean;
      files: string[];
      conflicts: string[];
      errors: string[];
      warnings: string[];
    };
  };
  cursorDirectories: {
    global: string;
    project: string;
    ai: string;
    workspace?: string;
  };
  aiValidationResults: AIValidationResult[];
  extensionCompatibility: ExtensionCompatibilityResult[];
}

export interface CursorValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  componentResults: {
    [key in CursorComponentType]: ComponentValidationResult;
  };
  aiSecurityResults: AISecurityValidationResult[];
  extensionValidationResults: ExtensionValidationResult[];
}

export interface AIValidationResult {
  component: CursorComponentType;
  isValid: boolean;
  securityLevel: AISecurityLevel;
  blockedContent: string[];
  warnings: string[];
}

export interface ExtensionCompatibilityResult {
  extensionId: string;
  compatible: boolean;
  version: string;
  warnings: string[];
}

export interface AISecurityValidationResult {
  ruleType: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  blocked: boolean;
}

export interface ExtensionValidationResult {
  extensionId: string;
  isValid: boolean;
  securityWarnings: string[];
  compatibilityIssues: string[];
}

// Cursor Configuration Models
export interface CursorGlobalSettings {
  // Editor settings
  "editor.fontSize": number;
  "editor.fontFamily": string;
  "editor.tabSize": number;
  "editor.insertSpaces": boolean;
  "editor.wordWrap": "off" | "on" | "wordWrapColumn" | "bounded";
  "editor.lineNumbers": "off" | "on" | "relative" | "interval";
  "editor.minimap.enabled": boolean;
  "editor.formatOnSave": boolean;
  "editor.codeActionsOnSave": Record<string, boolean>;
  
  // Workbench settings
  "workbench.colorTheme": string;
  "workbench.iconTheme": string;
  "workbench.startupEditor": "none" | "welcomePage" | "readme" | "newUntitledFile" | "welcomePageInEmptyWorkbench";
  "workbench.sideBar.location": "left" | "right";
  "workbench.panel.defaultLocation": "bottom" | "right";
  
  // AI settings (Cursor-specific)
  "cursor.ai.enabled": boolean;
  "cursor.ai.model": string;
  "cursor.ai.temperature": number;
  "cursor.ai.maxTokens": number;
  "cursor.ai.contextWindow": number;
  "cursor.ai.codeActions": boolean;
  "cursor.ai.autoComplete": boolean;
  "cursor.ai.chat": boolean;
  "cursor.ai.composer": boolean;
  
  // Security settings
  "security.workspace.trust.enabled": boolean;
  "security.workspace.trust.startupPrompt": "always" | "once" | "never";
  "security.workspace.trust.banner": "always" | "untilDismissed" | "never";
  
  // Language-specific settings
  "[typescript]": LanguageSpecificSettings;
  "[javascript]": LanguageSpecificSettings;
  "[python]": LanguageSpecificSettings;
  "[markdown]": LanguageSpecificSettings;
  
  // Files and terminal settings
  "files.autoSave": "off" | "afterDelay" | "onFocusChange" | "onWindowChange";
  "files.autoSaveDelay": number;
  "files.exclude": Record<string, boolean>;
  "terminal.integrated.fontSize": number;
  "terminal.integrated.fontFamily": string;
  
  // Extensions settings
  "extensions.autoUpdate": boolean;
  "extensions.autoCheckUpdates": boolean;
  "extensions.ignoreRecommendations": boolean;
}

export interface LanguageSpecificSettings {
  "editor.defaultFormatter"?: string;
  "editor.formatOnSave"?: boolean;
  "editor.tabSize"?: number;
  "editor.insertSpaces"?: boolean;
  "editor.codeActionsOnSave"?: Record<string, boolean>;
}

export interface CursorAIConfig {
  rules: {
    content: string;
    path: '.cursor/ai/rules.md';
  };
  context: {
    content: string;
    path: '.cursor/ai/context.md';
  };
  prompts: {
    [promptName: string]: {
      content: string;
      path: string;
      metadata?: {
        description: string;
        category: string;
        tags: string[];
      };
    };
  };
  cursorRules: {
    content: string;
    path: '.cursorrules';
  };
  modelSettings: {
    defaultModel: string;
    temperature: number;
    maxTokens: number;
    contextWindow: number;
  };
}

export interface CursorExtensionsConfig {
  recommendations: string[];
  unwantedRecommendations: string[];
}

export interface CursorDebugConfig {
  version: string;
  configurations: DebugConfiguration[];
}

export interface DebugConfiguration {
  name: string;
  type: string;
  request: "launch" | "attach";
  program?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  console?: "internalConsole" | "integratedTerminal" | "externalTerminal";
  [key: string]: any;
}

export interface CursorTasksConfig {
  version: string;
  tasks: TaskConfiguration[];
}

export interface TaskConfiguration {
  label: string;
  type: "shell" | "process";
  command: string;
  args?: string[];
  options?: {
    cwd?: string;
    env?: Record<string, string>;
    shell?: {
      executable: string;
      args: string[];
    };
  };
  group?: "build" | "test" | { kind: "build" | "test"; isDefault: boolean };
  presentation?: {
    echo?: boolean;
    reveal?: "always" | "silent" | "never";
    focus?: boolean;
    panel?: "shared" | "dedicated" | "new";
    showReuseMessage?: boolean;
    clear?: boolean;
  };
  problemMatcher?: string | string[];
  runOptions?: {
    runOn?: "default" | "folderOpen";
  };
}

export interface CursorSnippetsConfig {
  [language: string]: {
    [snippetName: string]: {
      prefix: string;
      body: string[];
      description: string;
    };
  };
}

export interface CursorWorkspaceConfig {
  folders: Array<{
    name?: string;
    path: string;
  }>;
  settings?: Record<string, any>;
  extensions?: {
    recommendations?: string[];
    unwantedRecommendations?: string[];
  };
}
