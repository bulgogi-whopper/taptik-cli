export const CURSOR_CONSTANTS = {
  PLATFORM_NAME: 'cursor',
  CONFIG_DIRECTORY: '.cursor',
  SETTINGS_DIRECTORY: 'settings',
  EXTENSIONS_DIRECTORY: 'extensions',
  DEBUG_DIRECTORY: '.vscode',
  WORKSPACE_SETTINGS_FILE: 'settings.json',
  CURSORRULES_FILE: '.cursorrules',
  LAUNCH_CONFIG_FILE: 'launch.json',
  TASKS_CONFIG_FILE: 'tasks.json',
  SNIPPETS_DIRECTORY: 'snippets',
  AI_CONTEXT_DIRECTORY: 'ai-context',
  DEFAULT_TIMEOUT: 15000,
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_AI_CONTENT_SIZE: 1024 * 1024, // 1MB
} as const;

export const CURSOR_COMPONENT_TYPES = {
  GLOBAL_SETTINGS: 'global_settings',
  PROJECT_SETTINGS: 'project_settings',
  AI_CONFIG: 'ai_config',
  EXTENSIONS_CONFIG: 'extensions_config',
  DEBUG_CONFIG: 'debug_config',
  TASKS_CONFIG: 'tasks_config',
  SNIPPETS_CONFIG: 'snippets_config',
  WORKSPACE_CONFIG: 'workspace_config',
} as const;

export type CursorComponentType = typeof CURSOR_COMPONENT_TYPES[keyof typeof CURSOR_COMPONENT_TYPES];