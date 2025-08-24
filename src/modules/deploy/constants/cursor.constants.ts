import { CursorComponentType } from '../interfaces/cursor-deployment.interface';

// Cursor IDE File Paths
export const CURSOR_PATHS = {
  // Global Cursor configuration
  GLOBAL_SETTINGS: '~/.cursor/User/settings.json',
  GLOBAL_KEYBINDINGS: '~/.cursor/User/keybindings.json',
  GLOBAL_SNIPPETS: '~/.cursor/User/snippets',
  GLOBAL_EXTENSIONS: '~/.cursor/User/extensions',
  
  // Project-level configuration
  PROJECT_SETTINGS: '.cursor/settings.json',
  PROJECT_EXTENSIONS: '.cursor/extensions.json',
  PROJECT_LAUNCH: '.cursor/launch.json',
  PROJECT_TASKS: '.cursor/tasks.json',
  PROJECT_C_CPP_PROPERTIES: '.cursor/c_cpp_properties.json',
  
  // AI-specific configurations
  AI_DIRECTORY: '.cursor/ai',
  AI_RULES: '.cursor/ai/rules.md',
  AI_CONTEXT: '.cursor/ai/context.md',
  AI_PROMPTS: '.cursor/ai/prompts',
  AI_MODELS: '.cursor/ai/models',
  
  // Workspace-specific files
  WORKSPACE_DIRECTORY: '.cursor/workspace',
  WORKSPACE_FILE: '.cursor/workspace/workspace.code-workspace',
  CURSOR_RULES: '.cursorrules',
} as const;

// Cursor Component Mapping
export const CURSOR_COMPONENT_MAPPING: Record<CursorComponentType, string[]> = {
  settings: [
    CURSOR_PATHS.GLOBAL_SETTINGS,
    CURSOR_PATHS.PROJECT_SETTINGS,
  ],
  extensions: [
    CURSOR_PATHS.PROJECT_EXTENSIONS,
    CURSOR_PATHS.GLOBAL_EXTENSIONS,
  ],
  snippets: [
    CURSOR_PATHS.GLOBAL_SNIPPETS,
  ],
  'ai-config': [
    CURSOR_PATHS.AI_RULES,
    CURSOR_PATHS.AI_CONTEXT,
    CURSOR_PATHS.AI_PROMPTS,
    CURSOR_PATHS.CURSOR_RULES,
  ],
  'debug-config': [
    CURSOR_PATHS.PROJECT_LAUNCH,
  ],
  tasks: [
    CURSOR_PATHS.PROJECT_TASKS,
  ],
  workspace: [
    CURSOR_PATHS.WORKSPACE_FILE,
  ],
};

// Cursor-specific Validation Rules
export const CURSOR_VALIDATION_RULES = {
  MAX_AI_CONTEXT_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_INDIVIDUAL_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_EXTENSIONS_COUNT: 200,
  MAX_WORKSPACE_FOLDERS: 50,
  MAX_AI_PROMPTS_COUNT: 100,
  
  REQUIRED_AI_FILES: [
    'rules.md',
  ],
  
  SUPPORTED_AI_MODELS: [
    'gpt-4',
    'gpt-4-turbo',
    'claude-3-sonnet',
    'claude-3-opus',
    'claude-3-haiku',
  ],
  
  DANGEROUS_AI_PATTERNS: [
    /eval\s*\(/gi,
    /exec\s*\(/gi,
    /system\s*\(/gi,
    /shell\s*\(/gi,
    /rm\s+-rf/gi,
    /sudo\s+/gi,
  ],
} as const;

// Cursor Security Configuration
export const CURSOR_SECURITY_CONFIG = {
  AI_CONTENT_SCAN_PATTERNS: [
    // Potential command injection
    /[;&|`$(){}]/g,
    // File system operations
    /\.\.\//g,
    /\/etc\/passwd/gi,
    /\/proc\//gi,
    // Network operations
    /curl\s+/gi,
    /wget\s+/gi,
    /nc\s+/gi,
    // Process operations
    /kill\s+-/gi,
    /pkill\s+/gi,
  ],
  
  EXTENSION_SECURITY_RULES: {
    TRUSTED_PUBLISHERS: [
      'ms-vscode',
      'microsoft',
      'redhat',
      'github',
    ],
    BLOCKED_EXTENSIONS: [
      // Known problematic extensions can be added here
    ],
    REQUIRE_MARKETPLACE_VALIDATION: true,
  },
  
  WORKSPACE_SECURITY_RULES: {
    MAX_FOLDER_COUNT: 50,
    ALLOWED_WORKSPACE_PATHS: [
      /^\/home\//,
      /^\/Users\//,
      /^C:\\Users\\/,
      /^\/opt\//,
      /^\/var\/www\//,
    ],
    BLOCKED_WORKSPACE_PATHS: [
      /^\/etc\//,
      /^\/proc\//,
      /^\/sys\//,
      /^\/dev\//,
      /^C:\\Windows\\/,
      /^C:\\System32\\/,
    ],
  },
} as const;

// Cursor Performance Configuration
export const CURSOR_PERFORMANCE_CONFIG = {
  STREAMING_THRESHOLD: 10 * 1024 * 1024, // 10MB
  PARALLEL_PROCESSING: {
    MAX_CONCURRENT_COMPONENTS: 3,
    SAFE_PARALLEL_COMPONENTS: ['settings', 'extensions', 'snippets'],
    SEQUENTIAL_COMPONENTS: ['ai-config', 'workspace'],
  },
  CACHE_CONFIG: {
    VALIDATION_CACHE_TTL: 5 * 60 * 1000, // 5 minutes
    TRANSFORMATION_CACHE_TTL: 10 * 60 * 1000, // 10 minutes
  },
} as const;

// Cursor Error Codes
export const CURSOR_ERROR_CODES = {
  VALIDATION_FAILED: 'CURSOR_VALIDATION_FAILED',
  AI_SECURITY_VIOLATION: 'CURSOR_AI_SECURITY_VIOLATION',
  EXTENSION_INCOMPATIBLE: 'CURSOR_EXTENSION_INCOMPATIBLE',
  WORKSPACE_INVALID: 'CURSOR_WORKSPACE_INVALID',
  FILE_SIZE_EXCEEDED: 'CURSOR_FILE_SIZE_EXCEEDED',
  AI_MODEL_UNSUPPORTED: 'CURSOR_AI_MODEL_UNSUPPORTED',
  DIRECTORY_CREATION_FAILED: 'CURSOR_DIRECTORY_CREATION_FAILED',
  CONFIGURATION_CORRUPT: 'CURSOR_CONFIGURATION_CORRUPT',
} as const;
