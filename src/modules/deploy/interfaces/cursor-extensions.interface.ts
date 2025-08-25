/**
 * Cursor IDE extensions configuration interfaces
 * Defines structure for extensions.json and extension recommendations
 */

export interface CursorExtensionsConfig {
  recommendations?: string[];
  unwantedRecommendations?: string[];
  installed?: CursorInstalledExtension[];
  marketplace?: CursorMarketplaceSettings;
  installation?: CursorExtensionInstallationSettings;
  synchronization?: CursorExtensionSyncSettings;
  metadata?: CursorExtensionsMetadata;
}

export interface CursorInstalledExtension {
  id: string;
  version?: string;
  enabled?: boolean;
  installed?: boolean;
  installDate?: string;
  updateDate?: string;
  source?: 'marketplace' | 'vsix' | 'builtin' | 'manual';
  settings?: Record<string, any>;
  dependencies?: string[];
  extensionDependencies?: string[];
  extensionPack?: boolean;
  metadata?: CursorExtensionMetadata;
}

export interface CursorExtensionMetadata {
  displayName?: string;
  description?: string;
  version?: string;
  publisher?: string;
  categories?: string[];
  keywords?: string[];
  license?: string;
  repository?: string;
  homepage?: string;
  bugs?: string;
  icon?: string;
  galleryBanner?: CursorExtensionGalleryBanner;
  preview?: boolean;
  engines?: Record<string, string>;
  activationEvents?: string[];
  main?: string;
  contributes?: CursorExtensionContributes;
}

export interface CursorExtensionGalleryBanner {
  color?: string;
  theme?: 'dark' | 'light';
}

export interface CursorExtensionContributes {
  commands?: CursorExtensionCommand[];
  keybindings?: CursorExtensionKeybinding[];
  languages?: CursorExtensionLanguage[];
  grammars?: CursorExtensionGrammar[];
  themes?: CursorExtensionTheme[];
  iconThemes?: CursorExtensionIconTheme[];
  snippets?: CursorExtensionSnippet[];
  jsonValidation?: CursorExtensionJsonValidation[];
  views?: CursorExtensionViews;
  viewsContainers?: CursorExtensionViewsContainers;
  menus?: CursorExtensionMenus;
  configuration?: CursorExtensionConfiguration;
  configurationDefaults?: Record<string, any>;
  taskDefinitions?: CursorExtensionTaskDefinition[];
  debuggers?: CursorExtensionDebugger[];
  breakpoints?: CursorExtensionBreakpoint[];
  colors?: CursorExtensionColor[];
  semanticTokenTypes?: CursorExtensionSemanticTokenType[];
  semanticTokenModifiers?: CursorExtensionSemanticTokenModifier[];
  semanticTokenScopes?: CursorExtensionSemanticTokenScope[];
  customEditors?: CursorExtensionCustomEditor[];
  notebooks?: CursorExtensionNotebook[];
}

export interface CursorExtensionCommand {
  command: string;
  title: string;
  category?: string;
  icon?: string | CursorExtensionIcon;
  enablement?: string;
}

export interface CursorExtensionIcon {
  light?: string;
  dark?: string;
}

export interface CursorExtensionKeybinding {
  command: string;
  key: string;
  mac?: string;
  linux?: string;
  win?: string;
  when?: string;
  args?: any;
}

export interface CursorExtensionLanguage {
  id: string;
  aliases?: string[];
  extensions?: string[];
  filenames?: string[];
  filenamePatterns?: string[];
  firstLine?: string;
  configuration?: string;
  icon?: CursorExtensionIcon;
}

export interface CursorExtensionGrammar {
  language?: string;
  scopeName: string;
  path: string;
  embeddedLanguages?: Record<string, string>;
  tokenTypes?: Record<string, string>;
  injectTo?: string[];
  balancedBracketScopes?: string[];
  unbalancedBracketScopes?: string[];
}

export interface CursorExtensionTheme {
  label: string;
  uiTheme: 'vs' | 'vs-dark' | 'hc-black' | 'hc-light';
  path: string;
}

export interface CursorExtensionIconTheme {
  id: string;
  label: string;
  path: string;
}

export interface CursorExtensionSnippet {
  language: string;
  path: string;
}

export interface CursorExtensionJsonValidation {
  fileMatch: string | string[];
  url: string;
}

export interface CursorExtensionViews {
  [containerId: string]: CursorExtensionView[];
}

export interface CursorExtensionView {
  id: string;
  name: string;
  type?: string;
  when?: string;
  icon?: string;
  contextualTitle?: string;
  visibility?: 'visible' | 'hidden' | 'collapsed';
}

export interface CursorExtensionViewsContainers {
  activitybar?: CursorExtensionViewContainer[];
  panel?: CursorExtensionViewContainer[];
}

export interface CursorExtensionViewContainer {
  id: string;
  title: string;
  icon: string;
}

export interface CursorExtensionMenus {
  [menuId: string]: CursorExtensionMenuItem[];
}

export interface CursorExtensionMenuItem {
  command?: string;
  submenu?: string;
  when?: string;
  group?: string;
  alt?: string;
}

export interface CursorExtensionConfiguration {
  type?: 'object';
  title?: string;
  properties?: Record<string, CursorExtensionConfigurationProperty>;
}

export interface CursorExtensionConfigurationProperty {
  type?: string | string[];
  description?: string;
  default?: any;
  enum?: any[];
  enumDescriptions?: string[];
  markdownDescription?: string;
  deprecationMessage?: string;
  markdownDeprecationMessage?: string;
  editPresentation?: 'multilineText' | 'singlelineText';
  order?: number;
  scope?: 'application' | 'machine' | 'window' | 'resource' | 'language-overridable' | 'machine-overridable';
}

export interface CursorExtensionTaskDefinition {
  type: string;
  required?: string[];
  properties?: Record<string, CursorExtensionConfigurationProperty>;
}

export interface CursorExtensionDebugger {
  type: string;
  label?: string;
  program?: string;
  runtime?: string;
  configurationAttributes?: CursorExtensionDebuggerConfigurationAttributes;
  initialConfigurations?: any[];
  configurationSnippets?: CursorExtensionDebuggerConfigurationSnippet[];
  variables?: Record<string, string>;
}

export interface CursorExtensionDebuggerConfigurationAttributes {
  launch?: Record<string, CursorExtensionConfigurationProperty>;
  attach?: Record<string, CursorExtensionConfigurationProperty>;
}

export interface CursorExtensionDebuggerConfigurationSnippet {
  label: string;
  description?: string;
  body: any;
}

export interface CursorExtensionBreakpoint {
  language: string;
}

export interface CursorExtensionColor {
  id: string;
  description: string;
  defaults: {
    light?: string;
    dark?: string;
    highContrast?: string;
    highContrastLight?: string;
  };
}

export interface CursorExtensionSemanticTokenType {
  id: string;
  superType?: string;
  description: string;
}

export interface CursorExtensionSemanticTokenModifier {
  id: string;
  description: string;
}

export interface CursorExtensionSemanticTokenScope {
  language?: string;
  scopes: Record<string, string[]>;
}

export interface CursorExtensionCustomEditor {
  viewType: string;
  displayName: string;
  selector: CursorExtensionCustomEditorSelector[];
  priority?: 'default' | 'builtin' | 'option';
}

export interface CursorExtensionCustomEditorSelector {
  filenamePattern?: string;
}

export interface CursorExtensionNotebook {
  type: string;
  displayName: string;
  selector?: CursorExtensionNotebookSelector[];
}

export interface CursorExtensionNotebookSelector {
  filenamePattern?: string;
}

export interface CursorMarketplaceSettings {
  enabled?: boolean;
  allowPreReleaseVersions?: boolean;
  showUpdatesNotification?: boolean;
  checkUpdatesInterval?: number;
  trustedExtensionAuthenticationProviders?: string[];
}

export interface CursorExtensionInstallationSettings {
  autoUpdate?: boolean;
  autoCheckUpdates?: boolean;
  installVSIXPackages?: boolean;
  closeExtensionDetailsOnViewChange?: boolean;
  confirmUninstall?: boolean;
  ignoreRecommendations?: boolean;
  showRecommendationsOnlyOnDemand?: boolean;
  experimentalUseUtilityProcess?: boolean;
}

export interface CursorExtensionSyncSettings {
  enabled?: boolean;
  ignoredExtensions?: string[];
  syncInstalledExtensions?: boolean;
  syncExtensionSettings?: boolean;
  syncDisabledExtensions?: boolean;
}

export interface CursorExtensionsMetadata {
  version?: string;
  lastUpdated?: string;
  totalExtensions?: number;
  enabledExtensions?: number;
  disabledExtensions?: number;
  categories?: Record<string, number>;
  publishers?: Record<string, number>;
  syncHash?: string;
  compatibilityVersion?: string;
}

// Extension validation and utilities
export interface CursorExtensionValidationResult {
  valid: boolean;
  errors: CursorExtensionValidationError[];
  warnings: CursorExtensionValidationWarning[];
  suggestions: string[];
}

export interface CursorExtensionValidationError {
  extensionId?: string;
  type: 'invalid_id' | 'missing_version' | 'incompatible_version' | 'security_risk' | 'dependency_missing' | 'circular_dependency';
  message: string;
  details?: any;
  severity: 'error' | 'warning';
}

export interface CursorExtensionValidationWarning {
  extensionId?: string;
  type: 'deprecated' | 'outdated' | 'performance_impact' | 'compatibility_issue' | 'license_concern';
  message: string;
  details?: any;
}

export function validateCursorExtensionsConfig(config: CursorExtensionsConfig): CursorExtensionValidationResult {
  const result: CursorExtensionValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    suggestions: [],
  };

  // Validate recommendations
  if (config.recommendations) {
    for (const rec of config.recommendations) {
      if (!isValidExtensionId(rec)) {
        result.errors.push({
          extensionId: rec,
          type: 'invalid_id',
          message: `Invalid extension ID format: ${rec}`,
          severity: 'error',
        });
      }
    }
  }

  // Validate unwanted recommendations
  if (config.unwantedRecommendations) {
    for (const unwanted of config.unwantedRecommendations) {
      if (!isValidExtensionId(unwanted)) {
        result.errors.push({
          extensionId: unwanted,
          type: 'invalid_id',
          message: `Invalid extension ID format in unwantedRecommendations: ${unwanted}`,
          severity: 'error',
        });
      }
    }
  }

  // Validate installed extensions
  if (config.installed) {
    for (const ext of config.installed) {
      if (!isValidExtensionId(ext.id)) {
        result.errors.push({
          extensionId: ext.id,
          type: 'invalid_id',
          message: `Invalid extension ID format: ${ext.id}`,
          severity: 'error',
        });
      }

      if (ext.version && !isValidVersionString(ext.version)) {
        result.warnings.push({
          extensionId: ext.id,
          type: 'compatibility_issue',
          message: `Invalid version format: ${ext.version}`,
        });
      }
    }
  }

  // Check for conflicts between recommendations and unwanted
  if (config.recommendations && config.unwantedRecommendations) {
    const conflicts = config.recommendations.filter(rec => 
      config.unwantedRecommendations!.includes(rec)
    );
    
    for (const conflict of conflicts) {
      result.warnings.push({
        extensionId: conflict,
        type: 'compatibility_issue',
        message: `Extension ${conflict} is both recommended and unwanted`,
      });
    }
  }

  result.valid = result.errors.length === 0;
  return result;
}

export function isValidExtensionId(id: string): boolean {
  // Extension ID format: publisher.name
  const extensionIdPattern = /^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/i;
  return extensionIdPattern.test(id);
}

export function isValidVersionString(version: string): boolean {
  // Semantic version pattern
  const versionPattern = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
  return versionPattern.test(version);
}

export function getExtensionCategory(extensionId: string): string {
  const categoryMappings: Record<string, string> = {
    'ms-python.python': 'Programming Languages',
    'ms-vscode.typescript': 'Programming Languages',
    'ms-vscode.javascript': 'Programming Languages',
    'bradlc.vscode-tailwindcss': 'Themes',
    'esbenp.prettier-vscode': 'Formatters',
    'ms-vscode.vscode-eslint': 'Linters',
    'ms-vscode.vscode-json': 'Programming Languages',
    'redhat.vscode-yaml': 'Programming Languages',
    'ms-vscode.theme-*': 'Themes',
    'ms-vscode.icons-*': 'Themes',
  };

  for (const [pattern, category] of Object.entries(categoryMappings)) {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      if (regex.test(extensionId)) {
        return category;
      }
    } else if (extensionId === pattern) {
      return category;
    }
  }

  return 'Other';
}

export function sortExtensions(extensions: CursorInstalledExtension[]): CursorInstalledExtension[] {
  return [...extensions].sort((a, b) => {
    // Treat undefined enabled as false for sorting
    const aEnabled = a.enabled ?? false;
    const bEnabled = b.enabled ?? false;
    
    // Sort by enabled status first (enabled first)
    if (aEnabled !== bEnabled) {
      return aEnabled ? -1 : 1;
    }
    
    // Then by extension ID
    return a.id.localeCompare(b.id);
  });
}

export function getExtensionSizeEstimate(extension: CursorInstalledExtension): number {
  // Estimate extension size based on type and complexity
  const baseSize = 100; // KB
  let multiplier = 1;

  if (extension.metadata?.categories?.includes('Programming Languages')) {
    multiplier = 5;
  } else if (extension.metadata?.categories?.includes('Themes')) {
    multiplier = 2;
  } else if (extension.metadata?.categories?.includes('Debuggers')) {
    multiplier = 3;
  }

  return baseSize * multiplier;
}