export const TAPTIK_VERSION = '1.0.0';

export const DEFAULT_OUTPUT_DIR = 'taptik-build';

export const SUPPORTED_PLATFORMS = {
  KIRO: 'kiro',
  CURSOR: 'cursor',
  CLAUDE_CODE: 'claude_code'
} as const;

export const BUILD_CATEGORIES = {
  PERSONAL_CONTEXT: 'personal',
  PROJECT_CONTEXT: 'project',
  PROMPT_TEMPLATES: 'prompts'
} as const;

export const KIRO_CONFIG_FILES = {
  LOCAL: {
    CONTEXT: '.kiro/context.json',
    USER_PREFERENCES: '.kiro/user-preferences.json',
    PROJECT_SPEC: '.kiro/project-spec.json',
    PROMPTS_DIR: '.kiro/prompts/',
    HOOKS_DIR: '.kiro/hooks/'
  },
  GLOBAL: {
    USER_CONFIG: '~/.kiro/user-config.json',
    GLOBAL_PROMPTS: '~/.kiro/prompts/',
    PREFERENCES: '~/.kiro/preferences.json'
  }
} as const;

export const TAPTIK_SPEC_VERSION = '1.0.0';

export const FILE_EXTENSIONS = {
  JSON: '.json',
  MANIFEST: 'manifest.json'
} as const;