/**
 * Cursor IDE Configuration Interfaces
 * 
 * This file defines TypeScript interfaces for Cursor IDE configuration structures
 * including global settings, project settings, AI prompts, and other components.
 */

// Import CursorComponentType from component-types
import { CursorComponentType } from './component-types.interface';

// Main Cursor configuration interface
export interface CursorConfiguration {
  globalSettings?: CursorGlobalSettings;
  projectSettings?: CursorProjectSettings;
  extensions?: CursorExtensions;
  snippets?: CursorSnippets;
  aiPrompts?: CursorAIPrompts;
  tasks?: CursorTasks;
  launch?: CursorLaunch;
}

// Global Cursor settings (~/.cursor/settings.json)
export interface CursorGlobalSettings {
  // Editor settings
  'editor.fontSize': number;
  'editor.fontFamily': string;
  'editor.tabSize': number;
  'editor.insertSpaces': boolean;
  'editor.wordWrap': 'on' | 'off' | 'wordWrapColumn' | 'bounded';
  'editor.lineNumbers': 'on' | 'off' | 'relative' | 'interval';
  'editor.minimap.enabled': boolean;
  'editor.formatOnSave': boolean;
  'editor.codeActionsOnSave': Record<string, boolean>;
  
  // Workbench settings
  'workbench.colorTheme': string;
  'workbench.iconTheme': string;
  'workbench.startupEditor': 'none' | 'welcomePage' | 'readme' | 'newUntitledFile';
  'workbench.sideBar.location': 'left' | 'right';
  'workbench.panel.defaultLocation': 'bottom' | 'right';
  
  // File settings
  'files.autoSave': 'off' | 'afterDelay' | 'onFocusChange' | 'onWindowChange';
  'files.autoSaveDelay': number;
  'files.exclude': Record<string, boolean>;
  'files.watcherExclude': Record<string, boolean>;
  
  // Terminal settings
  'terminal.integrated.shell.osx': string;
  'terminal.integrated.shell.linux': string;
  'terminal.integrated.shell.windows': string;
  'terminal.integrated.fontSize': number;
  'terminal.integrated.fontFamily': string;
  
  // AI settings
  'cursor.ai.enabled': boolean;
  'cursor.ai.model': string;
  'cursor.ai.temperature': number;
  'cursor.ai.maxTokens': number;
  'cursor.ai.contextWindow': number;
  'cursor.ai.autoComplete': boolean;
  'cursor.ai.codeActions': boolean;
  'cursor.ai.chat': boolean;
  
  // Extension settings
  'extensions.autoUpdate': boolean;
  'extensions.autoCheckUpdates': boolean;
  'extensions.ignoreRecommendations': boolean;
  
  // Security settings
  'security.workspace.trust.enabled': boolean;
  'security.workspace.trust.startupPrompt': 'always' | 'once' | 'never';
  'security.workspace.trust.banner': 'always' | 'untilDismissed' | 'never';
  
  // Additional settings (extensible)
  [key: string]: any;
}

// Project-specific Cursor settings (.cursor/settings.json)
export interface CursorProjectSettings {
  // Project-specific editor settings
  'editor.rulers': number[];
  'editor.detectIndentation': boolean;
  'editor.trimAutoWhitespace': boolean;
  
  // Language-specific settings
  '[typescript]'?: {
    'editor.defaultFormatter': string;
    'editor.formatOnSave': boolean;
    'editor.codeActionsOnSave': Record<string, boolean>;
  };
  '[javascript]'?: {
    'editor.defaultFormatter': string;
    'editor.formatOnSave': boolean;
  };
  '[python]'?: {
    'editor.defaultFormatter': string;
    'python.defaultInterpreterPath': string;
  };
  
  // Search settings
  'search.exclude': Record<string, boolean>;
  'search.useIgnoreFiles': boolean;
  'search.useGlobalIgnoreFiles': boolean;
  
  // AI project settings
  'cursor.ai.projectContext': {
    includeFiles: string[];
    excludeFiles: string[];
    maxFileSize: number;
    followSymlinks: boolean;
  };
  'cursor.ai.rules': string[]; // Rule file paths
  'cursor.ai.prompts': string[]; // Prompt file paths
  
  // Additional language-specific settings (extensible)
  [key: string]: any;
}

// AI context configuration (.cursor/ai/context.json)
export interface CursorAIContext {
  version: string;
  project: {
    name: string;
    description: string;
    type: string;
    languages: string[];
    frameworks: string[];
  };
  context: {
    files: {
      include: string[];
      exclude: string[];
      maxSize: number;
    };
    directories: {
      include: string[];
      exclude: string[];
    };
    patterns: {
      important: string[]; // Important file patterns
      ignore: string[]; // Ignore file patterns
    };
  };
  rules: {
    coding: string[]; // Coding rule files
    architecture: string[]; // Architecture rule files
    testing: string[]; // Testing rule files
    security: string[]; // Security rule files
  };
  prompts: {
    system: string; // System prompt
    templates: Record<string, string>; // Template prompts
  };
}

// AI prompts and rules structure
export interface CursorAIPrompts {
  systemPrompts: Record<string, {
    content: string;
    description: string;
    tags: string[];
  }>;
  projectPrompts: Record<string, {
    content: string;
    description: string;
    context: string;
    tags: string[];
  }>;
  rules: Record<string, string>;
}

// Extensions configuration (.cursor/extensions.json)
export interface CursorExtensions {
  recommendations: string[]; // Recommended extensions
  unwantedRecommendations: string[]; // Unwanted extensions
}

// Code snippets configuration (~/.cursor/snippets/)
export interface CursorSnippets {
  [language: string]: Record<string, {
    prefix: string;
    body: string[];
    description: string;
  }>;
}

// Tasks configuration (.cursor/tasks.json)
export interface CursorTasks {
  version: string;
  tasks: Array<{
    label: string;
    type: string;
    command: string;
    args?: string[];
    group?: 'build' | 'test' | 'clean';
    presentation?: {
      echo?: boolean;
      reveal?: 'always' | 'silent' | 'never';
      focus?: boolean;
      panel?: 'shared' | 'dedicated' | 'new';
    };
    problemMatcher?: string | string[];
    runOptions?: {
      runOn?: 'default' | 'folderOpen';
    };
  }>;
}

// Launch/Debug configuration (.cursor/launch.json)
export interface CursorLaunch {
  version: string;
  configurations: Array<{
    name: string;
    type: string;
    request: 'launch' | 'attach';
    program?: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    console?: 'internalConsole' | 'integratedTerminal' | 'externalTerminal';
    preLaunchTask?: string;
    postDebugTask?: string;
  }>;
}

// Cursor deployment specific options
export interface CursorDeploymentOptions {
  globalSettingsPath?: string; // Custom path for global settings
  projectSettingsPath?: string; // Custom path for project settings
  aiPromptsPath?: string; // Custom path for AI prompts
  extensionsPath?: string; // Custom path for extensions
  snippetsPath?: string; // Custom path for snippets
  tasksPath?: string; // Custom path for tasks
  launchPath?: string; // Custom path for launch config
  preserveExistingSettings?: boolean; // Whether to preserve existing settings
  mergeStrategy?: 'overwrite' | 'merge' | 'skip'; // How to handle conflicts
}

// Cursor validation result
export interface CursorValidationResult {
  isValid: boolean;
  errors: CursorValidationError[];
  warnings: CursorValidationWarning[];
  supportedComponents: CursorComponentType[];
}

export interface CursorValidationError {
  code: string;
  message: string;
  component?: CursorComponentType;
  field?: string;
  severity: 'error';
}

export interface CursorValidationWarning {
  code: string;
  message: string;
  component?: CursorComponentType;
  field?: string;
  severity: 'warning';
}

// Cursor deployment result
export interface CursorDeploymentResult {
  success: boolean;
  deployedComponents: CursorComponentType[];
  skippedComponents: CursorComponentType[];
  errors: CursorValidationError[];
  warnings: CursorValidationWarning[];
  filesCreated: string[];
  filesModified: string[];
  backupCreated?: string;
}