export interface CollectedSettings {
  local: LocalSettings;
  global: GlobalSettings;
  metadata: CollectionMetadata;
}

export interface LocalSettings {
  contextJson?: any;
  userPreferencesJson?: any;
  projectSpecJson?: any;
  prompts?: Record<string, any>;
  hooks?: Record<string, any>;
}

export interface GlobalSettings {
  userConfig?: any;
  globalPrompts?: Record<string, any>;
  preferences?: any;
}

export interface CollectionMetadata {
  platform: string;
  categories: string[];
  collectedAt: Date;
  sourceFiles: {
    local: string[];
    global: string[];
  };
  errors?: CollectionError[];
}

export interface CollectionError {
  file: string;
  error: string;
  severity: 'warning' | 'error';
}

export interface KiroConfigPaths {
  local: {
    contextJson: string;           // .kiro/context.json
    userPreferences: string;       // .kiro/user-preferences.json
    projectSpec: string;          // .kiro/project-spec.json
    promptsDir: string;           // .kiro/prompts/
    hooksDir: string;             // .kiro/hooks/
  };
  global: {
    userConfig: string;           // ~/.kiro/user-config.json
    globalPrompts: string;        // ~/.kiro/prompts/
    preferences: string;          // ~/.kiro/preferences.json
  };
}