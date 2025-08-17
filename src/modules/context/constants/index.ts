export const CONTEXT_VERSION = '1.0.0';

export const DEFAULT_CONTEXT_PATHS = {
  KIRO: {
    SPECS: '.kiro/specs',
    STEERING: '.kiro/steering',
    HOOKS: '.kiro/hooks',
    SETTINGS: '.kiro/settings',
  },
  CLAUDE_CODE: {
    GLOBAL_SETTINGS: '~/.claude/settings.json',
    PROJECT_SETTINGS: '.claude/settings.json',
    GLOBAL_COMMANDS: '~/.claude/commands',
    PROJECT_COMMANDS: '.claude/commands',
    MCP_CONFIG: '.mcp.json',
    CLAUDE_MD: 'CLAUDE.md',
    CLAUDE_LOCAL_MD: 'CLAUDE.local.md',
  },
};

export const COMPRESSION_TYPES = {
  GZIP: 'gzip',
  BROTLI: 'brotli',
} as const;

export const ENCRYPTION_ALGORITHMS = {
  AES_256_GCM: 'aes-256-gcm',
} as const;

export const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /private[_-]?key/i,
  /access[_-]?key/i,
  /auth/i,
  /credential/i,
];

export const MAX_CONTEXT_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_FILE_SIZE = 1024 * 1024; // 1MB per file

export const PLATFORM_DISPLAY_NAMES = {
  kiro: 'Kiro',
  'claude-code': 'Claude Code',
  cursor: 'Cursor',
  windsurf: 'Windsurf',
  cody: 'Cody',
} as const;
