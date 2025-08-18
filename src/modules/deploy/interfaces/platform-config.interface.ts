import { ValidationResult } from '../../context/dto/validation-result.dto';
import { TaptikContext } from '../../context/interfaces/taptik-context.interface';

import { DeploymentOptions } from './deploy-options.interface';
import { DeploymentResult } from './deployment-result.interface';

export interface PlatformConfig {
  name: string;
  supported: boolean;
  paths: PlatformPaths;
  validator: (context: TaptikContext) => Promise<ValidationResult>;
  deployer: (
    context: TaptikContext,
    options: DeploymentOptions,
  ) => Promise<DeploymentResult>;
}

export interface PlatformPaths {
  globalSettings: string;
  agents?: string;
  commands?: string;
  projectSettings: string;
  instructions: string;
  mcp?: string;
  hooks?: string;
  steering?: string;
}

export interface ClaudeCodeSettings {
  permissions?: ClaudePermissions;
  environmentVariables?: Record<string, string>;
  env?: Record<string, string>;
  statusLine?: StatusLineConfig;
  theme?: string;
  fontSize?: number;
  autoSave?: boolean;
  cleanupPeriodDays?: number;
  includeCoAuthoredBy?: boolean;
  enableAllProjectMcpServers?: boolean;
}

export interface ClaudePermissions {
  allow?: string[];
  deny?: string[];
  defaultMode?: 'acceptEdits' | 'askFirst' | 'deny';
}

export interface StatusLineConfig {
  enabled?: boolean;
  type?: 'command' | 'text';
  command?: string;
  text?: string;
  position?: 'top' | 'bottom';
  components?: string[];
  padding?: number;
}

export interface AgentConfig {
  name: string;
  description: string;
  content: string;
  metadata: {
    version: string;
    author: string;
    tags: string[];
    created?: Date;
    updated?: Date;
  };
}

export interface CommandConfig {
  name: string;
  description: string;
  content: string;
  permissions: string[];
  metadata: {
    version: string;
    author: string;
    created?: Date;
    updated?: Date;
  };
}

export interface ProjectSettings {
  mcp?: McpConfig;
  instructions?: string;
  localInstructions?: string;
  settings?: Partial<ClaudeCodeSettings>;
}

export interface McpConfig {
  servers?: Record<string, McpServerConfig>;
  version?: string;
}

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}
