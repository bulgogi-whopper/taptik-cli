/**
 * Platform-specific constants and enums
 */

export enum SupportedPlatform {
  CLAUDE_CODE = 'claude-code',
  KIRO_IDE = 'kiro-ide',
  CURSOR_IDE = 'cursor-ide',
}

export enum PlatformDisplayName {
  CLAUDE_CODE = 'Claude Code',
  KIRO_IDE = 'Kiro IDE',
  CURSOR_IDE = 'Cursor IDE',
}

export enum PlatformFileExtension {
  CLAUDE_CODE = '.claude',
  KIRO_IDE = '.kiro',
  CURSOR_IDE = '.cursor',
  UNIVERSAL = '.taptik',
}

/**
 * Platform-specific configuration paths
 */
export const PLATFORM_PATHS = {
  [SupportedPlatform.CLAUDE_CODE]: {
    GLOBAL_SETTINGS: '~/.claude/settings.json',
    PROJECT_SETTINGS: '.claude/settings.json',
    MCP_CONFIG: '.mcp.json',
    CLAUDE_MD: 'CLAUDE.md',
    CLAUDE_LOCAL_MD: 'CLAUDE.local.md',
  },
  [SupportedPlatform.KIRO_IDE]: {
    ROOT_DIR: '.kiro',
    SPECS: '.kiro/specs',
    STEERING: '.kiro/steering',
    HOOKS: '.kiro/hooks',
    SETTINGS: '.kiro/settings',
    CONTEXT: '.kiro/context',
  },
  [SupportedPlatform.CURSOR_IDE]: {
    SETTINGS: '.cursor/settings.json',
    KEYBINDINGS: '.cursor/keybindings.json',
    EXTENSIONS: '.cursor/extensions.json',
    SNIPPETS: '.cursor/snippets',
  },
} as const;

/**
 * Platform capabilities and features
 */
export const PLATFORM_FEATURES = {
  [SupportedPlatform.CLAUDE_CODE]: {
    supportsProjects: true,
    supportsMCP: true,
    supportsMarkdownConfig: true,
    supportsGlobalSettings: true,
    supportsProjectSettings: true,
    supportsKeybindings: true,
    supportsExtensions: true,
  },
  [SupportedPlatform.KIRO_IDE]: {
    supportsSpecs: true,
    supportsSteering: true,
    supportsHooks: true,
    supportsContextManagement: true,
    supportsProjectTemplates: true,
    supportsCustomCommands: true,
  },
  [SupportedPlatform.CURSOR_IDE]: {
    supportsAIConfig: true,
    supportsKeybindings: true,
    supportsExtensions: true,
    supportsSnippets: true,
    supportsThemes: true,
    supportsTerminalProfiles: true,
  },
} as const;

/**
 * Platform-specific file patterns to include/exclude
 */
export const PLATFORM_FILE_PATTERNS = {
  [SupportedPlatform.CLAUDE_CODE]: {
    include: [
      '**/.claude/**',
      '**/CLAUDE.md',
      '**/CLAUDE.local.md',
      '**/.mcp.json',
    ],
    exclude: ['**/node_modules/**', '**/.git/**'],
  },
  [SupportedPlatform.KIRO_IDE]: {
    include: ['**/.kiro/**'],
    exclude: ['**/.kiro/cache/**', '**/.kiro/logs/**', '**/node_modules/**'],
  },
  [SupportedPlatform.CURSOR_IDE]: {
    include: ['**/.cursor/**'],
    exclude: [
      '**/.cursor/cache/**',
      '**/.cursor/workspaceStorage/**',
      '**/node_modules/**',
    ],
  },
} as const;

/**
 * Platform detection patterns
 */
export const PLATFORM_DETECTION = {
  [SupportedPlatform.CLAUDE_CODE]: [
    '.claude/settings.json',
    'CLAUDE.md',
    '.mcp.json',
  ],
  [SupportedPlatform.KIRO_IDE]: [
    '.kiro/specs',
    '.kiro/steering',
    '.kiro/settings',
  ],
  [SupportedPlatform.CURSOR_IDE]: [
    '.cursor/settings.json',
    '.cursor/keybindings.json',
  ],
} as const;

/**
 * Type guards for platform validation
 */
export function isSupportedPlatform(
  platform: string,
): platform is SupportedPlatform {
  return Object.values(SupportedPlatform).includes(
    platform as SupportedPlatform,
  );
}

export function getPlatformDisplayName(platform: SupportedPlatform): string {
  const displayNames: Record<string, string> = {
    [SupportedPlatform.CLAUDE_CODE]: PlatformDisplayName.CLAUDE_CODE,
    [SupportedPlatform.KIRO_IDE]: PlatformDisplayName.KIRO_IDE,
    [SupportedPlatform.CURSOR_IDE]: PlatformDisplayName.CURSOR_IDE,
  };
  return displayNames[platform] || platform;
}

export function getPlatformExtension(platform: SupportedPlatform): string {
  const extensions: Record<string, string> = {
    [SupportedPlatform.CLAUDE_CODE]: PlatformFileExtension.CLAUDE_CODE,
    [SupportedPlatform.KIRO_IDE]: PlatformFileExtension.KIRO_IDE,
    [SupportedPlatform.CURSOR_IDE]: PlatformFileExtension.CURSOR_IDE,
  };
  return extensions[platform] || PlatformFileExtension.UNIVERSAL;
}
