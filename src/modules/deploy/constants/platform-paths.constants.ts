import { PlatformPaths } from '../interfaces/platform-config.interface';

export const CLAUDE_CODE_PATHS: PlatformPaths = {
  globalSettings: '~/.claude/settings.json',
  agents: '~/.claude/agents',
  commands: '~/.claude/commands',
  projectSettings: '.claude/settings.json',
  instructions: 'CLAUDE.md',
  mcp: '.mcp.json',
  steering: '.claude/steering',
  hooks: '.claude/hooks',
};

export const KIRO_IDE_PATHS: PlatformPaths = {
  globalSettings: '~/.kiro/settings.json',
  projectSettings: '.kiro/settings.json',
  instructions: '.kiro/README.md',
  steering: '.kiro/steering',
  hooks: '.kiro/hooks',
};

export const CURSOR_IDE_PATHS: PlatformPaths = {
  globalSettings: '~/.cursor/settings.json',
  projectSettings: '.cursor/settings.json',
  instructions: '.cursorrules',
};

export const PLATFORM_PATHS_MAP: Record<string, PlatformPaths> = {
  'claude-code': CLAUDE_CODE_PATHS,
  'kiro-ide': KIRO_IDE_PATHS,
  'cursor-ide': CURSOR_IDE_PATHS,
};

export const PLATFORM_PATHS = {
  CLAUDE_CODE: {
    GLOBAL_SETTINGS: '.claude/settings.json',
    AGENTS_DIR: '.claude/agents',
    COMMANDS_DIR: '.claude/commands',
    PROJECT_SETTINGS: '.claude/settings.json',
    CLAUDE_MD: 'CLAUDE.md',
  },
  KIRO: {
    GLOBAL_SETTINGS: '.kiro/settings.json',
    PROJECT_SETTINGS: '.kiro/settings.json',
    STEERING: '.kiro/steering',
    HOOKS: '.kiro/hooks',
  },
  CURSOR: {
    GLOBAL_SETTINGS: '.cursor/settings.json',
    PROJECT_SETTINGS: '.cursor/settings.json',
    INSTRUCTIONS: '.cursorrules',
  },
};

export const DEPLOY_LOCK_FILE = '.deploy.lock';
export const DEPLOY_AUDIT_LOG = '.deploy-audit.log';
export const BACKUP_MANIFEST_FILE = 'backup-manifest.json';
