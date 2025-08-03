export interface BuildCommandOptions {
  source?: string;
  output?: string;
  include?: string;
  exclude?: string;
  force?: boolean;
  verbose?: boolean;
}

export enum SupportedPlatform {
  KIRO = 'kiro',
  CURSOR = 'cursor',
  CLAUDE_CODE = 'claude_code'
}

export enum BuildCategory {
  PERSONAL_CONTEXT = 'personal',
  PROJECT_CONTEXT = 'project',
  PROMPT_TEMPLATES = 'prompts'
}