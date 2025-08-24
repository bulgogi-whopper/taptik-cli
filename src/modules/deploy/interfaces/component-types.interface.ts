export type ComponentType = 'settings' | 'agents' | 'commands' | 'project';

export type SupportedPlatform = 'claude-code' | 'kiro-ide' | 'cursor-ide';

// Extended component types for different platforms
export type ClaudeCodeComponentType = ComponentType;
export type KiroComponentType =
  | 'settings'
  | 'steering'
  | 'specs'
  | 'hooks'
  | 'agents'
  | 'templates';
export type CursorComponentType = ComponentType;

// Platform-specific component mapping
export type PlatformComponentType<T extends SupportedPlatform> =
  T extends 'claude-code'
    ? ClaudeCodeComponentType
    : T extends 'kiro-ide'
      ? KiroComponentType
      : T extends 'cursor-ide'
        ? CursorComponentType
        : never;
