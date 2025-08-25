/**
 * Cursor IDE configuration data models and interfaces
 * These interfaces define the structure for various Cursor IDE configuration files
 */

export interface CursorGlobalSettings {
  editor?: CursorEditorSettings;
  workbench?: CursorWorkbenchSettings;
  ai?: CursorAISettings;
  extensions?: CursorExtensionSettings;
  security?: CursorSecuritySettings;
  terminal?: CursorTerminalSettings;
  git?: CursorGitSettings;
  search?: CursorSearchSettings;
  files?: CursorFilesSettings;
  telemetry?: CursorTelemetrySettings;
  update?: CursorUpdateSettings;
  [key: string]: any; // Allow additional properties for extensibility
}

export interface CursorProjectSettings {
  editor?: Partial<CursorEditorSettings>;
  workbench?: Partial<CursorWorkbenchSettings>;
  ai?: Partial<CursorAISettings>;
  files?: Partial<CursorFilesSettings>;
  search?: Partial<CursorSearchSettings>;
  extensions?: Partial<CursorExtensionSettings>;
  typescript?: CursorTypeScriptSettings;
  eslint?: CursorESLintSettings;
  prettier?: CursorPrettierSettings;
  [key: string]: any; // Allow additional properties for project-specific settings
}

export interface CursorEditorSettings {
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  lineHeight?: number;
  tabSize?: number;
  insertSpaces?: boolean;
  detectIndentation?: boolean;
  trimAutoWhitespace?: boolean;
  wordWrap?: 'off' | 'on' | 'wordWrapColumn' | 'bounded';
  wordWrapColumn?: number;
  rulers?: number[];
  renderWhitespace?: 'none' | 'boundary' | 'selection' | 'trailing' | 'all';
  renderControlCharacters?: boolean;
  renderIndentGuides?: boolean;
  minimap?: CursorMinimapSettings;
  cursorStyle?: 'line' | 'block' | 'underline' | 'line-thin' | 'block-outline' | 'underline-thin';
  cursorBlinking?: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid';
  autoClosingBrackets?: 'always' | 'languageDefinedT' | 'beforeWhitespace' | 'never';
  autoClosingQuotes?: 'always' | 'languageDefinedT' | 'beforeWhitespace' | 'never';
  autoSurround?: 'languageDefinedT' | 'quotes' | 'brackets' | 'never';
  formatOnSave?: boolean;
  formatOnPaste?: boolean;
  formatOnType?: boolean;
}

export interface CursorMinimapSettings {
  enabled?: boolean;
  side?: 'right' | 'left';
  showSlider?: 'always' | 'mouseover';
  scale?: number;
  maxColumn?: number;
}

export interface CursorWorkbenchSettings {
  colorTheme?: string;
  iconTheme?: string;
  productIconTheme?: string;
  startupEditor?: 'none' | 'welcomePage' | 'readme' | 'newUntitledFile' | 'welcomePageInEmptyWorkbench';
  editor?: CursorWorkbenchEditorSettings;
  sideBar?: CursorSideBarSettings;
  panel?: CursorPanelSettings;
  statusBar?: CursorStatusBarSettings;
  tree?: CursorTreeSettings;
  list?: CursorListSettings;
}

export interface CursorWorkbenchEditorSettings {
  enablePreview?: boolean;
  enablePreviewFromQuickOpen?: boolean;
  closeOnFileDelete?: boolean;
  openPositioning?: 'left' | 'right' | 'first' | 'last';
  revealIfOpen?: boolean;
  showTabs?: boolean;
  tabCloseButton?: 'left' | 'right' | 'off';
  tabSizing?: 'fit' | 'shrink';
  wrapTabs?: boolean;
}

export interface CursorSideBarSettings {
  location?: 'left' | 'right';
  visible?: boolean;
}

export interface CursorPanelSettings {
  defaultLocation?: 'bottom' | 'right';
  opens?: 'preserveFocus' | 'takeFocus';
}

export interface CursorStatusBarSettings {
  visible?: boolean;
}

export interface CursorTreeSettings {
  indent?: number;
  renderIndentGuides?: 'none' | 'onHover' | 'always';
}

export interface CursorListSettings {
  openMode?: 'singleClick' | 'doubleClick';
  multiSelectModifier?: 'ctrlCmd' | 'alt';
}

export interface CursorAISettings {
  enabled?: boolean;
  model?: string;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  systemPrompt?: string;
  codegenEnabled?: boolean;
  chatEnabled?: boolean;
  completionsEnabled?: boolean;
  inlineCompletionsEnabled?: boolean;
  codeActionsEnabled?: boolean;
  diagnosticsEnabled?: boolean;
  refactoringEnabled?: boolean;
  documentationEnabled?: boolean;
  testGenerationEnabled?: boolean;
  explainCodeEnabled?: boolean;
  reviewCodeEnabled?: boolean;
  optimizeCodeEnabled?: boolean;
  contextLength?: number;
  responseFormat?: 'text' | 'markdown' | 'code';
  languages?: string[];
  excludePatterns?: string[];
  includePatterns?: string[];
  privacy?: CursorAIPrivacySettings;
}

export interface CursorAIPrivacySettings {
  collectTelemetry?: boolean;
  shareCodeWithProvider?: boolean;
  logConversations?: boolean;
  anonymizeData?: boolean;
}

export interface CursorExtensionSettings {
  autoCheckUpdates?: boolean;
  autoUpdate?: boolean;
  closeExtensionDetailsOnViewChange?: boolean;
  ignoreRecommendations?: boolean;
  showRecommendationsOnlyOnDemand?: boolean;
  allowedNonSecureExtensions?: string[];
  supportVirtualWorkspaces?: Record<string, boolean>;
  supportUntrustedWorkspaces?: Record<string, boolean>;
}

export interface CursorSecuritySettings {
  workspace?: CursorWorkspaceSecuritySettings;
  allowedUnsafeExtensions?: string[];
  restrictedMode?: boolean;
}

export interface CursorWorkspaceSecuritySettings {
  trust?: CursorWorkspaceTrustSettings;
}

export interface CursorWorkspaceTrustSettings {
  enabled?: boolean;
  banner?: 'always' | 'untilDismissed' | 'never';
  untrustedFiles?: 'prompt' | 'open' | 'newWindow';
  emptyWindow?: boolean;
  startupPrompt?: 'always' | 'once' | 'never';
}

export interface CursorTerminalSettings {
  shell?: Record<string, string>; // Platform-specific shells
  shellArgs?: Record<string, string[]>; // Platform-specific shell args
  cwd?: string;
  env?: Record<string, string>;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  lineHeight?: number;
  cursorStyle?: 'block' | 'underline' | 'line';
  cursorBlinking?: boolean;
  scrollback?: number;
  rightClickBehavior?: 'default' | 'copyPaste' | 'paste' | 'selectWord' | 'nothing';
}

export interface CursorGitSettings {
  enabled?: boolean;
  path?: string;
  autoRepositoryDetection?: boolean | 'subFolders' | 'openEditors';
  autorefresh?: boolean;
  autofetch?: boolean;
  autofetchPeriod?: number;
  confirmSync?: boolean;
  enableSmartCommit?: boolean;
  smartCommitChanges?: 'all' | 'tracked';
  suggestSmartCommit?: boolean;
  enableCommitSigning?: boolean;
  rebaseWhenSync?: boolean;
  fetchOnPull?: boolean;
  showPushSuccessNotification?: boolean;
  inputValidation?: 'always' | 'warn' | 'off';
  inputValidationLength?: number;
  inputValidationSubjectLength?: number;
  decorations?: CursorGitDecorationsSettings;
}

export interface CursorGitDecorationsSettings {
  enabled?: boolean;
  colors?: boolean;
}

export interface CursorSearchSettings {
  exclude?: Record<string, boolean>;
  useRipgrep?: boolean;
  useIgnoreFiles?: boolean;
  useGlobalGitignore?: boolean;
  useParentIgnoreFiles?: boolean;
  maintainFileSearchCache?: boolean;
  collapseResults?: 'auto' | 'alwaysCollapse' | 'alwaysExpand';
  searchOnType?: boolean;
  seedOnFocus?: boolean;
  seedWithNearestWord?: boolean;
  showLineNumbers?: boolean;
  smartCase?: boolean;
  globalFindClipboard?: boolean;
  location?: 'sidebar' | 'panel';
  mode?: 'view' | 'reuseEditor' | 'newEditor';
}

export interface CursorFilesSettings {
  exclude?: Record<string, boolean>;
  watcherExclude?: Record<string, boolean>;
  associations?: Record<string, string>;
  encoding?: string;
  autoGuessEncoding?: boolean;
  defaultLanguage?: string;
  trimTrailingWhitespace?: boolean;
  trimFinalNewlines?: boolean;
  insertFinalNewline?: boolean;
  autoSave?: 'off' | 'afterDelay' | 'onFocusChange' | 'onWindowChange';
  autoSaveDelay?: number;
  hotExit?: 'off' | 'onExit' | 'onExitAndWindowClose';
  useExperimentalFileWatcher?: boolean;
  participants?: CursorFilesParticipantsSettings;
}

export interface CursorFilesParticipantsSettings {
  timeout?: number;
}

export interface CursorTelemetrySettings {
  telemetryLevel?: 'all' | 'error' | 'crash' | 'off';
  enableCrashReporter?: boolean;
  enableTelemetry?: boolean;
}

export interface CursorUpdateSettings {
  mode?: 'none' | 'manual' | 'default';
  channel?: 'default' | 'insiders';
  showReleaseNotes?: boolean;
  enableWindowsBackgroundUpdates?: boolean;
}

export interface CursorTypeScriptSettings {
  preferences?: CursorTypeScriptPreferences;
  suggest?: CursorTypeScriptSuggestSettings;
  format?: CursorTypeScriptFormatSettings;
  inlayHints?: CursorTypeScriptInlayHintsSettings;
  surveys?: CursorTypeScriptSurveysSettings;
  npm?: string;
  check?: CursorTypeScriptCheckSettings;
  reportStyleChecksAsWarnings?: boolean;
  validate?: CursorTypeScriptValidateSettings;
  experimental?: CursorTypeScriptExperimentalSettings;
}

export interface CursorTypeScriptPreferences {
  includePackageJsonAutoImports?: 'auto' | 'on' | 'off';
  importModuleSpecifier?: 'shortest' | 'relative' | 'non-relative' | 'auto';
  importModuleSpecifierEnding?: 'minimal' | 'index' | 'js';
  quoteStyle?: 'single' | 'double' | 'auto';
  useAliases?: boolean;
}

export interface CursorTypeScriptSuggestSettings {
  enabled?: boolean;
  paths?: boolean;
  autoImports?: boolean;
  completeFunctionCalls?: boolean;
  includeAutomaticOptionalChainCompletions?: boolean;
  includeCompletionsForImportStatements?: boolean;
  includeCompletionsWithSnippetText?: boolean;
  jsdoc?: CursorTypeScriptJSDocSettings;
}

export interface CursorTypeScriptJSDocSettings {
  generateReturns?: boolean;
  generateParams?: boolean;
}

export interface CursorTypeScriptFormatSettings {
  enable?: boolean;
  insertSpaceAfterCommaDelimiter?: boolean;
  insertSpaceAfterConstructor?: boolean;
  insertSpaceAfterSemicolonInForStatements?: boolean;
  insertSpaceBeforeAndAfterBinaryOperators?: boolean;
  insertSpaceAfterKeywordsInControlFlowStatements?: boolean;
  insertSpaceAfterFunctionKeywordForAnonymousFunctions?: boolean;
  insertSpaceBeforeFunctionParenthesis?: boolean;
  insertSpaceAfterOpeningAndBeforeClosingNonemptyParentheses?: boolean;
  insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets?: boolean;
  insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces?: boolean;
  insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces?: boolean;
  insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces?: boolean;
  insertSpaceAfterTypeAssertion?: boolean;
  placeOpenBraceOnNewLineForFunctions?: boolean;
  placeOpenBraceOnNewLineForControlBlocks?: boolean;
  semicolons?: 'ignore' | 'insert' | 'remove';
}

export interface CursorTypeScriptInlayHintsSettings {
  enabled?: 'on' | 'off' | 'offUnlessPressed' | 'onUnlessPressed';
  parameterNames?: CursorTypeScriptParameterHintsSettings;
  parameterTypes?: CursorTypeScriptParameterHintsSettings;
  variableTypes?: CursorTypeScriptVariableHintsSettings;
  propertyDeclarationTypes?: CursorTypeScriptPropertyHintsSettings;
  functionLikeReturnTypes?: CursorTypeScriptReturnHintsSettings;
  enumMemberValues?: CursorTypeScriptParameterHintsSettings;
}

export interface CursorTypeScriptParameterHintsSettings {
  enabled?: 'none' | 'literals' | 'all';
  suppressWhenArgumentMatchesName?: boolean;
}

export interface CursorTypeScriptVariableHintsSettings {
  enabled?: boolean;
  suppressWhenTypeMatchesName?: boolean;
}

export interface CursorTypeScriptPropertyHintsSettings {
  enabled?: boolean;
}

export interface CursorTypeScriptReturnHintsSettings {
  enabled?: boolean;
}

export interface CursorTypeScriptSurveysSettings {
  enabled?: boolean;
}

export interface CursorTypeScriptCheckSettings {
  npmIsInstalled?: boolean;
}

export interface CursorTypeScriptValidateSettings {
  enable?: boolean;
}

export interface CursorTypeScriptExperimentalSettings {
  enableProjectDiagnostics?: boolean;
  maxInlayHintLength?: number;
}

export interface CursorESLintSettings {
  enable?: boolean;
  packageManager?: 'npm' | 'yarn' | 'pnpm';
  alwaysShowStatus?: boolean;
  quiet?: boolean;
  onIgnoredFiles?: 'off' | 'warn';
  options?: Record<string, any>;
  run?: 'onSave' | 'onType';
  autoFixOnSave?: boolean;
  codeActionsOnSave?: CursorESLintCodeActionsSettings;
  format?: CursorESLintFormatSettings;
  lintTask?: CursorESLintLintTaskSettings;
  migration?: CursorESLintMigrationSettings;
  rules?: CursorESLintRulesSettings;
  workingDirectories?: (string | CursorESLintWorkingDirectorySettings)[];
  nodePath?: string;
  validate?: string[] | CursorESLintValidateSettings;
  probe?: string[];
  runtime?: string;
  debug?: boolean;
  execArgv?: string[];
  codeAction?: CursorESLintCodeActionSettings;
  trace?: CursorESLintTraceSettings;
}

export interface CursorESLintCodeActionsSettings {
  mode?: 'all' | 'problems';
  disableRuleComment?: CursorESLintDisableRuleSettings;
  showDocumentation?: CursorESLintShowDocumentationSettings;
}

export interface CursorESLintDisableRuleSettings {
  enable?: boolean;
  location?: 'separateLine' | 'sameLine';
}

export interface CursorESLintShowDocumentationSettings {
  enable?: boolean;
}

export interface CursorESLintFormatSettings {
  enable?: boolean;
}

export interface CursorESLintLintTaskSettings {
  enable?: boolean;
  options?: string;
}

export interface CursorESLintMigrationSettings {
  '2_x'?: 'on' | 'off';
}

export interface CursorESLintRulesSettings {
  customizations?: CursorESLintRuleCustomization[];
}

export interface CursorESLintRuleCustomization {
  rule: string;
  severity?: 'downgrade' | 'error' | 'info' | 'warn' | 'upgrade';
}

export interface CursorESLintWorkingDirectorySettings {
  directory: string;
  changeProcessCwd?: boolean;
}

export interface CursorESLintValidateSettings {
  language: string;
  autoFix?: boolean;
}

export interface CursorESLintCodeActionSettings {
  disableRuleComment?: CursorESLintDisableRuleSettings;
  showDocumentation?: CursorESLintShowDocumentationSettings;
}

export interface CursorESLintTraceSettings {
  server?: 'off' | 'messages' | 'verbose';
}

export interface CursorPrettierSettings {
  enable?: boolean;
  requireConfig?: boolean;
  ignorePath?: string;
  prettierPath?: string;
  configPath?: string;
  useEditorConfig?: boolean;
  resolveGlobalModules?: boolean;
  withNodeModules?: boolean;
  packageManager?: 'npm' | 'yarn' | 'pnpm';
  useConfig?: string;
  documentSelectors?: string[];
  enableDebugLogs?: boolean;
}

export interface CursorAIConfig {
  rules?: CursorAIRule[];
  context?: CursorAIContext[];
  prompts?: CursorAIPrompt[];
  systemPrompt?: string;
  codegenEnabled?: boolean;
  chatEnabled?: boolean;
  completionsEnabled?: boolean;
  inlineCompletionsEnabled?: boolean;
  model?: CursorAIModelConfig;
  privacy?: CursorAIPrivacyConfig;
  performance?: CursorAIPerformanceConfig;
  customization?: CursorAICustomizationConfig;
}

export interface CursorAIRule {
  id: string;
  name: string;
  description?: string;
  content: string;
  enabled?: boolean;
  priority?: number;
  category?: string;
  tags?: string[];
  scope?: 'global' | 'workspace' | 'file';
  languages?: string[];
  filePatterns?: string[];
  excludePatterns?: string[];
  metadata?: Record<string, any>;
}

export interface CursorAIContext {
  id: string;
  name: string;
  description?: string;
  content: string;
  type: 'documentation' | 'examples' | 'guidelines' | 'reference' | 'custom';
  enabled?: boolean;
  priority?: number;
  scope?: 'global' | 'workspace' | 'file';
  languages?: string[];
  filePatterns?: string[];
  excludePatterns?: string[];
  maxLength?: number;
  metadata?: Record<string, any>;
}

export interface CursorAIPrompt {
  id: string;
  name: string;
  description?: string;
  content: string;
  category?: string;
  tags?: string[];
  variables?: CursorAIPromptVariable[];
  enabled?: boolean;
  hotkey?: string;
  scope?: 'global' | 'workspace' | 'selection';
  languages?: string[];
  metadata?: Record<string, any>;
}

export interface CursorAIPromptVariable {
  name: string;
  description?: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  required?: boolean;
  defaultValue?: any;
  options?: CursorAIPromptVariableOption[];
  validation?: CursorAIPromptVariableValidation;
}

export interface CursorAIPromptVariableOption {
  label: string;
  value: any;
  description?: string;
}

export interface CursorAIPromptVariableValidation {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

export interface CursorAIModelConfig {
  provider?: string;
  name?: string;
  version?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  contextLength?: number;
  responseFormat?: 'text' | 'markdown' | 'code';
  streaming?: boolean;
  customEndpoint?: string;
  customHeaders?: Record<string, string>;
}

export interface CursorAIPrivacyConfig {
  collectTelemetry?: boolean;
  shareCodeWithProvider?: boolean;
  logConversations?: boolean;
  anonymizeData?: boolean;
  dataRetentionDays?: number;
  excludeSensitiveData?: boolean;
  sensitiveDataPatterns?: string[];
}

export interface CursorAIPerformanceConfig {
  maxConcurrentRequests?: number;
  requestTimeout?: number;
  cacheEnabled?: boolean;
  cacheTtl?: number;
  rateLimitRequests?: number;
  rateLimitWindow?: number;
  backgroundProcessing?: boolean;
}

export interface CursorAICustomizationConfig {
  customCommands?: CursorAICustomCommand[];
  keyboardShortcuts?: CursorAIKeyboardShortcut[];
  uiCustomization?: CursorAIUICustomization;
}

export interface CursorAICustomCommand {
  id: string;
  name: string;
  description?: string;
  command: string;
  args?: any[];
  hotkey?: string;
  icon?: string;
  enabled?: boolean;
}

export interface CursorAIKeyboardShortcut {
  command: string;
  key: string;
  when?: string;
  args?: any;
}

export interface CursorAIUICustomization {
  chatPanelLocation?: 'sidebar' | 'panel' | 'editor';
  showInlineCompletions?: boolean;
  completionDelay?: number;
  showAIStatus?: boolean;
  aiStatusLocation?: 'statusbar' | 'sidebar' | 'hidden';
}

// Type guards and validation utilities
export function isCursorGlobalSettings(obj: any): obj is CursorGlobalSettings {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

export function isCursorProjectSettings(obj: any): obj is CursorProjectSettings {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

export function isCursorAIConfig(obj: any): obj is CursorAIConfig {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

export function validateCursorSettings(settings: any): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!settings || typeof settings !== 'object') {
    errors.push('Settings must be an object');
    return { valid: false, errors, warnings };
  }

  // Validate editor settings
  if (settings.editor && typeof settings.editor !== 'object') {
    errors.push('editor settings must be an object');
  }

  if (settings.editor?.fontSize && (typeof settings.editor.fontSize !== 'number' || settings.editor.fontSize < 8 || settings.editor.fontSize > 100)) {
    errors.push('editor.fontSize must be a number between 8 and 100');
  }

  if (settings.editor?.tabSize && (typeof settings.editor.tabSize !== 'number' || settings.editor.tabSize < 1 || settings.editor.tabSize > 20)) {
    errors.push('editor.tabSize must be a number between 1 and 20');
  }

  // Validate AI settings
  if (settings.ai) {
    if (settings.ai.maxTokens && (typeof settings.ai.maxTokens !== 'number' || settings.ai.maxTokens < 1 || settings.ai.maxTokens > 100000)) {
      errors.push('ai.maxTokens must be a number between 1 and 100000');
    }

    if (settings.ai.temperature && (typeof settings.ai.temperature !== 'number' || settings.ai.temperature < 0 || settings.ai.temperature > 2)) {
      errors.push('ai.temperature must be a number between 0 and 2');
    }

    if (settings.ai.apiKey && typeof settings.ai.apiKey !== 'string') {
      errors.push('ai.apiKey must be a string');
    } else if (settings.ai.apiKey && settings.ai.apiKey.length < 10) {
      warnings.push('ai.apiKey appears to be too short');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}