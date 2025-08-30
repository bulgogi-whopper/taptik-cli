import { Injectable } from '@nestjs/common';

import { SupportedPlatform } from '../interfaces/deploy-options.interface';
import { ComponentType } from '../interfaces/component-types.interface';
import { CursorComponentType } from '../interfaces/cursor-deployment.interface';

export interface HelpContent {
  title: string;
  description: string;
  usage: string;
  examples: Array<{
    title: string;
    command: string;
    description: string;
  }>;
  options: Array<{
    flag: string;
    description: string;
    required: boolean;
    defaultValue?: string;
    platforms?: SupportedPlatform[];
  }>;
  notes?: string[];
  seeAlso?: string[];
}

export interface ComponentHelp {
  name: string;
  displayName: string;
  description: string;
  platform: SupportedPlatform;
  dependencies?: string[];
  configFiles: string[];
  examples: Array<{
    title: string;
    description: string;
    files: Array<{
      path: string;
      content: string;
    }>;
  }>;
  troubleshooting: Array<{
    issue: string;
    solution: string;
    relatedErrors?: string[];
  }>;
}

export interface ErrorDocumentation {
  code: string;
  title: string;
  description: string;
  commonCauses: string[];
  solutions: Array<{
    title: string;
    steps: string[];
    requirements?: string[];
  }>;
  relatedErrors?: string[];
  prevention?: string[];
  examples?: Array<{
    scenario: string;
    error: string;
    solution: string;
  }>;
}

export interface ComponentSuggestion {
  input: string;
  suggestions: Array<{
    component: string;
    platform: SupportedPlatform;
    confidence: number;
    reason: string;
  }>;
  didYouMean?: string;
  examples?: string[];
}

@Injectable()
export class HelpDocumentationService {
  private readonly componentHelp: Map<string, ComponentHelp> = new Map();
  private readonly errorDocs: Map<string, ErrorDocumentation> = new Map();

  constructor() {
    this.initializeComponentHelp();
    this.initializeErrorDocumentation();
  }

  /**
   * Get comprehensive help for the deploy command
   */
  getDeployCommandHelp(): HelpContent {
    return {
      title: 'Deploy Command',
      description: 'Deploy Taptik context to target platforms (Claude Code, Kiro IDE, Cursor IDE)',
      usage: 'taptik deploy [options]',
      examples: [
        {
          title: 'Deploy to Cursor IDE with AI configuration',
          command: 'taptik deploy --platform cursor-ide --workspace-path ./my-project',
          description: 'Deploy complete configuration to Cursor IDE workspace',
        },
        {
          title: 'Deploy specific components to Claude Code',
          command: 'taptik deploy --platform claude-code --components settings agents',
          description: 'Deploy only settings and agents to Claude Code',
        },
        {
          title: 'Dry run deployment to Kiro IDE',
          command: 'taptik deploy --platform kiro-ide --dry-run',
          description: 'Simulate deployment without making changes',
        },
        {
          title: 'Deploy with conflict resolution',
          command: 'taptik deploy --platform cursor-ide --conflict-strategy merge',
          description: 'Deploy with automatic merge conflict resolution',
        },
        {
          title: 'Skip specific components',
          command: 'taptik deploy --platform cursor-ide --skip-components extensions debug-config',
          description: 'Deploy all components except extensions and debug configuration',
        },
      ],
      options: [
        {
          flag: '-p, --platform <platform>',
          description: 'Target platform: "claude-code", "kiro-ide", or "cursor-ide"',
          required: false,
          defaultValue: 'claude-code',
        },
        {
          flag: '-c, --context-id <id>',
          description: 'Context ID to deploy',
          required: false,
          defaultValue: 'latest',
        },
        {
          flag: '-d, --dry-run',
          description: 'Simulate deployment without making changes',
          required: false,
        },
        {
          flag: '-v, --validate-only',
          description: 'Only validate configuration without deploying',
          required: false,
        },
        {
          flag: '-s, --conflict-strategy <strategy>',
          description: 'Conflict handling: "prompt", "overwrite", "merge", "skip"',
          required: false,
          defaultValue: 'prompt',
        },
        {
          flag: '--components <components...>',
          description: 'Specific components to deploy',
          required: false,
        },
        {
          flag: '--skip-components <components...>',
          description: 'Components to skip during deployment',
          required: false,
        },
        {
          flag: '-f, --force',
          description: 'Force deployment without confirmation prompts',
          required: false,
        },
        {
          flag: '--cursor-path <path>',
          description: 'Path to Cursor IDE executable',
          required: false,
          platforms: ['cursor-ide'],
        },
        {
          flag: '--workspace-path <path>',
          description: 'Target workspace path for Cursor deployment',
          required: false,
          platforms: ['cursor-ide'],
        },
        {
          flag: '--skip-ai-config',
          description: 'Skip AI configuration deployment',
          required: false,
          platforms: ['cursor-ide'],
        },
        {
          flag: '--skip-extensions',
          description: 'Skip extensions configuration',
          required: false,
          platforms: ['cursor-ide'],
        },
        {
          flag: '--skip-debug-config',
          description: 'Skip debug configuration deployment',
          required: false,
          platforms: ['cursor-ide'],
        },
        {
          flag: '--skip-tasks',
          description: 'Skip tasks configuration deployment',
          required: false,
          platforms: ['cursor-ide'],
        },
        {
          flag: '--skip-snippets',
          description: 'Skip snippets deployment',
          required: false,
          platforms: ['cursor-ide'],
        },
      ],
      notes: [
        'The deploy command requires a valid TaptikContext in Supabase',
        'Different platforms support different component types',
        'Use --dry-run to preview changes before deployment',
        'Cursor IDE deployment includes AI-specific configurations',
        'Backup is automatically created before deployment',
      ],
      seeAlso: [
        'taptik info - View deployment information',
        'taptik health - Check system health',
        'Component-specific help: taptik deploy --help-component <name>',
      ],
    };
  }

  /**
   * Get platform-specific help
   */
  getPlatformHelp(platform: SupportedPlatform): HelpContent {
    switch (platform) {
      case 'cursor-ide':
        return this.getCursorIDEHelp();
      case 'claude-code':
        return this.getClaudeCodeHelp();
      case 'kiro-ide':
        return this.getKiroIDEHelp();
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
  }

  /**
   * Get component-specific help
   */
  getComponentHelp(componentName: string, platform?: SupportedPlatform): ComponentHelp | null {
    const key = platform ? `${platform}:${componentName}` : componentName;
    return this.componentHelp.get(key) || this.componentHelp.get(componentName) || null;
  }

  /**
   * Get error documentation
   */
  getErrorDocumentation(errorCode: string): ErrorDocumentation | null {
    return this.errorDocs.get(errorCode) || null;
  }

  /**
   * Validate component names and provide suggestions
   */
  validateComponentName(
    componentName: string,
    platform: SupportedPlatform,
  ): ComponentSuggestion {
    const validComponents = this.getValidComponentsForPlatform(platform);
    
    // Exact match
    if (validComponents.includes(componentName)) {
      return {
        input: componentName,
        suggestions: [
          {
            component: componentName,
            platform,
            confidence: 1.0,
            reason: 'Exact match',
          },
        ],
      };
    }

    // Find similar components
    const suggestions = this.findSimilarComponents(componentName, validComponents, platform);
    
    return {
      input: componentName,
      suggestions,
      didYouMean: suggestions.length > 0 ? suggestions[0].component : undefined,
      examples: this.getComponentExamples(platform),
    };
  }

  /**
   * Get all component suggestions for a platform
   */
  getComponentSuggestions(platform: SupportedPlatform): string[] {
    return this.getValidComponentsForPlatform(platform);
  }

  /**
   * Search help content
   */
  searchHelp(query: string): Array<{
    type: 'command' | 'component' | 'error' | 'option';
    title: string;
    description: string;
    relevance: number;
  }> {
    const results: Array<{
      type: 'command' | 'component' | 'error' | 'option';
      title: string;
      description: string;
      relevance: number;
    }> = [];

    const lowerQuery = query.toLowerCase();

    // Search component help
    for (const [key, help] of this.componentHelp.entries()) {
      const relevance = this.calculateRelevance(lowerQuery, help.name + ' ' + help.description);
      if (relevance > 0.1) {
        results.push({
          type: 'component',
          title: help.displayName,
          description: help.description,
          relevance,
        });
      }
    }

    // Search error documentation
    for (const [code, error] of this.errorDocs.entries()) {
      const relevance = this.calculateRelevance(lowerQuery, error.title + ' ' + error.description);
      if (relevance > 0.1) {
        results.push({
          type: 'error',
          title: error.title,
          description: error.description,
          relevance,
        });
      }
    }

    // Sort by relevance
    return results.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Format help content for console display
   */
  formatHelpForConsole(help: HelpContent): string {
    const lines: string[] = [];

    lines.push(`\n📖 ${help.title}`);
    lines.push('='.repeat(help.title.length + 4));
    lines.push(`\n${help.description}\n`);

    lines.push('📋 USAGE:');
    lines.push(`  ${help.usage}\n`);

    if (help.examples.length > 0) {
      lines.push('💡 EXAMPLES:');
      help.examples.forEach((example, index) => {
        lines.push(`  ${index + 1}. ${example.title}`);
        lines.push(`     ${example.command}`);
        lines.push(`     ${example.description}\n`);
      });
    }

    lines.push('⚙️  OPTIONS:');
    help.options.forEach((option) => {
      const platformInfo = option.platforms ? ` (${option.platforms.join(', ')})` : '';
      const defaultInfo = option.defaultValue ? ` [default: ${option.defaultValue}]` : '';
      const requiredInfo = option.required ? ' (required)' : '';
      
      lines.push(`  ${option.flag}${requiredInfo}${defaultInfo}${platformInfo}`);
      lines.push(`     ${option.description}\n`);
    });

    if (help.notes && help.notes.length > 0) {
      lines.push('📝 NOTES:');
      help.notes.forEach((note) => {
        lines.push(`  • ${note}`);
      });
      lines.push('');
    }

    if (help.seeAlso && help.seeAlso.length > 0) {
      lines.push('🔗 SEE ALSO:');
      help.seeAlso.forEach((ref) => {
        lines.push(`  • ${ref}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format component help for console display
   */
  formatComponentHelpForConsole(help: ComponentHelp): string {
    const lines: string[] = [];

    lines.push(`\n🧩 ${help.displayName} (${help.platform})`);
    lines.push('='.repeat(help.displayName.length + help.platform.length + 5));
    lines.push(`\n${help.description}\n`);

    lines.push('📁 CONFIGURATION FILES:');
    help.configFiles.forEach((file) => {
      lines.push(`  • ${file}`);
    });
    lines.push('');

    if (help.dependencies && help.dependencies.length > 0) {
      lines.push('🔗 DEPENDENCIES:');
      help.dependencies.forEach((dep) => {
        lines.push(`  • ${dep}`);
      });
      lines.push('');
    }

    if (help.examples.length > 0) {
      lines.push('💡 EXAMPLES:');
      help.examples.forEach((example, index) => {
        lines.push(`  ${index + 1}. ${example.title}`);
        lines.push(`     ${example.description}\n`);
        
        example.files.forEach((file) => {
          lines.push(`     📄 ${file.path}:`);
          lines.push(`     ${file.content.split('\n').map(line => `     ${line}`).join('\n')}\n`);
        });
      });
    }

    if (help.troubleshooting.length > 0) {
      lines.push('🔧 TROUBLESHOOTING:');
      help.troubleshooting.forEach((item, index) => {
        lines.push(`  ${index + 1}. Issue: ${item.issue}`);
        lines.push(`     Solution: ${item.solution}`);
        if (item.relatedErrors && item.relatedErrors.length > 0) {
          lines.push(`     Related errors: ${item.relatedErrors.join(', ')}`);
        }
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  /**
   * Format error documentation for console display
   */
  formatErrorDocumentationForConsole(error: ErrorDocumentation): string {
    const lines: string[] = [];

    lines.push(`\n🚨 ${error.title} (${error.code})`);
    lines.push('='.repeat(error.title.length + error.code.length + 5));
    lines.push(`\n${error.description}\n`);

    lines.push('🔍 COMMON CAUSES:');
    error.commonCauses.forEach((cause) => {
      lines.push(`  • ${cause}`);
    });
    lines.push('');

    lines.push('🛠️  SOLUTIONS:');
    error.solutions.forEach((solution, index) => {
      lines.push(`  ${index + 1}. ${solution.title}`);
      solution.steps.forEach((step, stepIndex) => {
        lines.push(`     ${stepIndex + 1}. ${step}`);
      });
      if (solution.requirements && solution.requirements.length > 0) {
        lines.push(`     Requirements: ${solution.requirements.join(', ')}`);
      }
      lines.push('');
    });

    if (error.prevention && error.prevention.length > 0) {
      lines.push('🛡️  PREVENTION:');
      error.prevention.forEach((tip) => {
        lines.push(`  • ${tip}`);
      });
      lines.push('');
    }

    if (error.examples && error.examples.length > 0) {
      lines.push('💡 EXAMPLES:');
      error.examples.forEach((example, index) => {
        lines.push(`  ${index + 1}. Scenario: ${example.scenario}`);
        lines.push(`     Error: ${example.error}`);
        lines.push(`     Solution: ${example.solution}\n`);
      });
    }

    if (error.relatedErrors && error.relatedErrors.length > 0) {
      lines.push('🔗 RELATED ERRORS:');
      error.relatedErrors.forEach((relatedCode) => {
        lines.push(`  • ${relatedCode}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  // Private helper methods

  private initializeComponentHelp(): void {
    // Cursor IDE components
    this.componentHelp.set('cursor-ide:ai-config', {
      name: 'ai-config',
      displayName: 'AI Configuration',
      description: 'AI rules, context, and prompt templates for Cursor IDE',
      platform: 'cursor-ide',
      configFiles: ['.cursorrules', '.cursor/ai-context.md', '.cursor/prompts/'],
      examples: [
        {
          title: 'Basic AI rules configuration',
          description: 'Simple AI rules for TypeScript development',
          files: [
            {
              path: '.cursorrules',
              content: `# AI Rules for TypeScript Project
- Use TypeScript for all code
- Follow strict type checking
- Write comprehensive unit tests
- Use meaningful variable names`,
            },
          ],
        },
      ],
      troubleshooting: [
        {
          issue: 'AI rules not applying in Cursor',
          solution: 'Ensure .cursorrules file is in the workspace root and reload Cursor',
          relatedErrors: ['CURSOR_RULES_NOT_FOUND', 'AI_CONFIG_INVALID'],
        },
      ],
    });

    this.componentHelp.set('cursor-ide:workspace-settings', {
      name: 'workspace-settings',
      displayName: 'Workspace Settings',
      description: 'Cursor workspace and editor configuration',
      platform: 'cursor-ide',
      configFiles: ['.cursor/settings.json', '.vscode/settings.json'],
      examples: [
        {
          title: 'Basic workspace settings',
          description: 'Common editor and workspace preferences',
          files: [
            {
              path: '.cursor/settings.json',
              content: `{
  "editor.fontSize": 14,
  "editor.fontFamily": "JetBrains Mono",
  "workbench.colorTheme": "Dark+",
  "files.autoSave": "afterDelay"
}`,
            },
          ],
        },
      ],
      troubleshooting: [
        {
          issue: 'Settings not taking effect',
          solution: 'Check for syntax errors in settings.json and restart Cursor',
          relatedErrors: ['SETTINGS_PARSE_ERROR', 'WORKSPACE_CONFIG_INVALID'],
        },
      ],
    });

    // Add more component help entries...
    this.addClaudeCodeComponentHelp();
    this.addKiroIDEComponentHelp();
  }

  private initializeErrorDocumentation(): void {
    // Cursor-specific errors
    this.errorDocs.set('CURSOR_NOT_FOUND', {
      code: 'CURSOR_NOT_FOUND',
      title: 'Cursor IDE Not Found',
      description: 'The Cursor IDE installation could not be detected on this system',
      commonCauses: [
        'Cursor IDE is not installed',
        'Cursor is installed in a non-standard location',
        'PATH environment variable does not include Cursor',
        'Insufficient permissions to access Cursor installation',
      ],
      solutions: [
        {
          title: 'Install Cursor IDE',
          steps: [
            'Download Cursor IDE from https://cursor.sh/',
            'Install using the provided installer',
            'Verify installation by running "cursor --version" in terminal',
          ],
        },
        {
          title: 'Specify Custom Path',
          steps: [
            'Find your Cursor installation path',
            'Use --cursor-path option: taptik deploy --platform cursor-ide --cursor-path /path/to/cursor',
          ],
        },
        {
          title: 'Add Cursor to PATH',
          steps: [
            'Find Cursor installation directory',
            'Add directory to PATH environment variable',
            'Restart terminal and try again',
          ],
        },
      ],
      prevention: [
        'Use standard installation methods',
        'Verify installation after setup',
        'Keep installation path in system PATH',
      ],
      examples: [
        {
          scenario: 'macOS with non-standard installation',
          error: 'Cursor executable not found in standard locations',
          solution: 'Use --cursor-path /Applications/Cursor.app/Contents/MacOS/Cursor',
        },
      ],
    });

    this.errorDocs.set('AI_CONFIG_INVALID', {
      code: 'AI_CONFIG_INVALID',
      title: 'Invalid AI Configuration',
      description: 'The AI configuration contains invalid or unsupported content',
      commonCauses: [
        'Malformed .cursorrules syntax',
        'Invalid AI context format',
        'Unsupported AI model configuration',
        'Security policy violations in AI content',
      ],
      solutions: [
        {
          title: 'Validate AI Rules Syntax',
          steps: [
            'Check .cursorrules file for proper formatting',
            'Ensure each rule is on a separate line',
            'Remove any special characters that might cause issues',
            'Test with a minimal configuration first',
          ],
        },
        {
          title: 'Review Security Policies',
          steps: [
            'Remove any potentially harmful content',
            'Avoid including sensitive information',
            'Follow Cursor AI content guidelines',
          ],
        },
      ],
      prevention: [
        'Use AI configuration templates',
        'Validate configuration before deployment',
        'Keep AI rules simple and clear',
      ],
    });

    // Add more error documentation...
    this.addCommonErrorDocumentation();
  }

  private getCursorIDEHelp(): HelpContent {
    return {
      title: 'Cursor IDE Platform',
      description: 'Deploy Taptik context to Cursor IDE with AI-powered development features',
      usage: 'taptik deploy --platform cursor-ide [cursor-specific-options]',
      examples: [
        {
          title: 'Full deployment with AI configuration',
          command: 'taptik deploy --platform cursor-ide --workspace-path ./my-project',
          description: 'Deploy all components including AI rules and workspace settings',
        },
        {
          title: 'Deploy without AI configuration',
          command: 'taptik deploy --platform cursor-ide --skip-ai-config',
          description: 'Deploy workspace settings and extensions without AI rules',
        },
      ],
      options: [
        {
          flag: '--cursor-path <path>',
          description: 'Path to Cursor IDE executable',
          required: false,
        },
        {
          flag: '--workspace-path <path>',
          description: 'Target workspace directory',
          required: false,
          defaultValue: 'current directory',
        },
        {
          flag: '--skip-ai-config',
          description: 'Skip AI configuration deployment',
          required: false,
        },
      ],
      notes: [
        'Cursor IDE supports AI-powered code completion and generation',
        'AI configuration includes rules, context, and prompt templates',
        'Workspace settings are compatible with VS Code',
      ],
    };
  }

  private getClaudeCodeHelp(): HelpContent {
    return {
      title: 'Claude Code Platform',
      description: 'Deploy Taptik context to Claude Code editor',
      usage: 'taptik deploy --platform claude-code [options]',
      examples: [
        {
          title: 'Deploy settings and agents',
          command: 'taptik deploy --platform claude-code --components settings agents',
          description: 'Deploy only settings and agent configurations',
        },
      ],
      options: [],
      notes: [
        'Claude Code is the default deployment platform',
        'Supports settings, agents, commands, and project configurations',
      ],
    };
  }

  private getKiroIDEHelp(): HelpContent {
    return {
      title: 'Kiro IDE Platform',
      description: 'Deploy Taptik context to Kiro IDE development environment',
      usage: 'taptik deploy --platform kiro-ide [options]',
      examples: [
        {
          title: 'Deploy steering documents',
          command: 'taptik deploy --platform kiro-ide --components steering specs',
          description: 'Deploy steering documents and specifications',
        },
      ],
      options: [],
      notes: [
        'Kiro IDE supports advanced development workflows',
        'Components include steering, specs, hooks, agents, and templates',
      ],
    };
  }

  private addClaudeCodeComponentHelp(): void {
    this.componentHelp.set('claude-code:settings', {
      name: 'settings',
      displayName: 'Claude Code Settings',
      description: 'Editor and environment settings for Claude Code',
      platform: 'claude-code',
      configFiles: ['settings.json'],
      examples: [],
      troubleshooting: [],
    });
  }

  private addKiroIDEComponentHelp(): void {
    this.componentHelp.set('kiro-ide:steering', {
      name: 'steering',
      displayName: 'Kiro Steering Documents',
      description: 'Development steering and guidance documents',
      platform: 'kiro-ide',
      configFiles: ['.kiro/steering/'],
      examples: [],
      troubleshooting: [],
    });
  }

  private addCommonErrorDocumentation(): void {
    this.errorDocs.set('DEPLOYMENT_FAILED', {
      code: 'DEPLOYMENT_FAILED',
      title: 'Deployment Failed',
      description: 'The deployment process encountered an error and could not complete',
      commonCauses: [
        'Target platform not accessible',
        'Invalid configuration data',
        'Insufficient permissions',
        'Network connectivity issues',
      ],
      solutions: [
        {
          title: 'Check System Requirements',
          steps: [
            'Verify target platform is installed and accessible',
            'Check file system permissions',
            'Ensure network connectivity if required',
          ],
        },
        {
          title: 'Validate Configuration',
          steps: [
            'Run deployment with --validate-only flag',
            'Check configuration syntax and format',
            'Verify all required fields are present',
          ],
        },
      ],
      prevention: [
        'Always validate configuration before deployment',
        'Use dry-run mode to test deployments',
        'Keep backups of working configurations',
      ],
    });
  }

  private getValidComponentsForPlatform(platform: SupportedPlatform): string[] {
    switch (platform) {
      case 'cursor-ide':
        return [
          'global-settings',
          'project-settings', 
          'ai-config',
          'workspace-settings',
          'extensions',
          'debug-config',
          'tasks',
          'snippets',
          'workspace-config',
        ];
      case 'claude-code':
        return ['settings', 'agents', 'commands', 'project'];
      case 'kiro-ide':
        return ['settings', 'steering', 'specs', 'hooks', 'agents', 'templates'];
      default:
        return [];
    }
  }

  private findSimilarComponents(
    input: string,
    validComponents: string[],
    platform: SupportedPlatform,
  ): Array<{ component: string; platform: SupportedPlatform; confidence: number; reason: string }> {
    const suggestions: Array<{ component: string; platform: SupportedPlatform; confidence: number; reason: string }> = [];
    
    for (const component of validComponents) {
      const confidence = this.calculateSimilarity(input.toLowerCase(), component.toLowerCase());
      
      if (confidence > 0.3) {
        let reason = 'Similar name';
        if (component.includes(input) || input.includes(component)) {
          reason = 'Partial match';
          confidence *= 1.2;
        }
        
        suggestions.push({
          component,
          platform,
          confidence: Math.min(confidence, 1.0),
          reason,
        });
      }
    }
    
    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator, // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private getComponentExamples(platform: SupportedPlatform): string[] {
    const components = this.getValidComponentsForPlatform(platform);
    return components.slice(0, 3);
  }

  private calculateRelevance(query: string, content: string): number {
    const contentLower = content.toLowerCase();
    const queryWords = query.split(' ').filter(word => word.length > 2);
    
    let relevance = 0;
    for (const word of queryWords) {
      if (contentLower.includes(word)) {
        relevance += 1 / queryWords.length;
      }
    }
    
    return relevance;
  }
}
