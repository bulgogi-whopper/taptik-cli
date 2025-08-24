import { ComponentTypes } from './component-types.interface';
import { DeploymentOptions } from './deploy-options.interface';
import { DeploymentResult } from './deployment-result.interface';
import { CursorComponentType } from '../constants/cursor.constants';

export interface CursorDeploymentOptions extends DeploymentOptions {
  platform: 'cursor';
  cursorPath?: string;
  workspacePath?: string;
  globalSettings?: boolean;
  projectSettings?: boolean;
  aiConfig?: boolean;
  skipExtensions?: boolean;
  skipDebugConfig?: boolean;
  skipTasks?: boolean;
  skipSnippets?: boolean;
  components?: CursorComponentType[];
  skipComponents?: CursorComponentType[];
}

export interface CursorDeploymentResult extends DeploymentResult {
  platform: 'cursor';
  cursorPath: string;
  workspacePath?: string;
  deployedComponents: CursorComponentType[];
  skippedComponents: CursorComponentType[];
  configurationFiles: {
    globalSettings?: string;
    projectSettings?: string;
    aiConfig?: string[];
    extensionsConfig?: string;
    debugConfig?: string;
    tasksConfig?: string;
    snippetsConfig?: string[];
    workspaceConfig?: string;
  };
  aiContentSize?: number;
  extensionsInstalled?: number;
}

export interface CursorGlobalSettings {
  editor?: {
    fontSize?: number;
    fontFamily?: string;
    tabSize?: number;
    insertSpaces?: boolean;
    wordWrap?: 'off' | 'on' | 'wordWrapColumn' | 'bounded';
    theme?: string;
  };
  ai?: {
    enabled?: boolean;
    model?: string;
    apiKey?: string;
    maxTokens?: number;
    temperature?: number;
  };
  extensions?: {
    autoUpdate?: boolean;
    recommendations?: string[];
    disabled?: string[];
  };
  security?: {
    workspace?: {
      trust?: {
        enabled?: boolean;
        parentFolder?: boolean;
        emptyWindow?: boolean;
      };
    };
  };
}

export interface CursorProjectSettings {
  editor?: CursorGlobalSettings['editor'];
  ai?: CursorGlobalSettings['ai'];
  files?: {
    exclude?: Record<string, boolean>;
    associations?: Record<string, string>;
    watcherExclude?: Record<string, boolean>;
  };
  search?: {
    exclude?: Record<string, boolean>;
    useGlobalSearchExclusions?: boolean;
  };
}

export interface CursorAIConfig {
  rules?: string[];
  context?: string[];
  prompts?: {
    name: string;
    content: string;
    category?: string;
  }[];
  systemPrompt?: string;
  codegenEnabled?: boolean;
  chatEnabled?: boolean;
  completionsEnabled?: boolean;
}

export interface CursorExtensionsConfig {
  recommendations?: string[];
  unwantedRecommendations?: string[];
  installed?: {
    id: string;
    version?: string;
    enabled?: boolean;
  }[];
}

export interface CursorDebugConfig {
  version: string;
  configurations: {
    name: string;
    type: string;
    request: 'launch' | 'attach';
    program?: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
    port?: number;
    host?: string;
    [key: string]: any;
  }[];
}

export interface CursorTasksConfig {
  version: string;
  tasks: {
    label: string;
    type: string;
    command: string;
    args?: string[];
    group?: 'build' | 'test' | { kind: string; isDefault?: boolean };
    presentation?: {
      echo?: boolean;
      reveal?: 'always' | 'silent' | 'never';
      focus?: boolean;
      panel?: 'shared' | 'dedicated' | 'new';
    };
    problemMatcher?: string | string[];
    dependsOn?: string | string[];
    [key: string]: any;
  }[];
}

export interface CursorSnippetsConfig {
  [snippetName: string]: {
    scope?: string;
    prefix: string | string[];
    body: string | string[];
    description?: string;
  };
}

export interface CursorWorkspaceConfig {
  folders: {
    path: string;
    name?: string;
  }[];
  settings?: CursorProjectSettings;
  extensions?: CursorExtensionsConfig;
  launch?: CursorDebugConfig;
  tasks?: CursorTasksConfig;
}

export interface ICursorDeploymentService {
  deploy(options: CursorDeploymentOptions): Promise<CursorDeploymentResult>;
  validateDeployment(options: CursorDeploymentOptions): Promise<boolean>;
  previewDeployment(options: CursorDeploymentOptions): Promise<CursorDeploymentResult>;
  rollback(deploymentId: string): Promise<void>;
}