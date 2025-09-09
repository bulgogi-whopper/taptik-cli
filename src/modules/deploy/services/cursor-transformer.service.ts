import { Injectable, Logger } from '@nestjs/common';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import {
  CursorConfiguration,
  CursorGlobalSettings,
  CursorProjectSettings,
  CursorAIPrompts,
  CursorExtensions,
  CursorSnippets,
  CursorTasks,
  CursorLaunch,
} from '../interfaces/cursor-config.interface';

/**
 * Service responsible for transforming Taptik common format to Cursor IDE format
 * 
 * This service handles the conversion of TaptikContext data structures to Cursor IDE
 * specific configuration formats, including global settings, project settings,
 * AI prompts, extensions, snippets, tasks, and launch configurations.
 */
@Injectable()
export class CursorTransformerService {
  private readonly logger = new Logger(CursorTransformerService.name);

  /**
   * Main transformation method that converts TaptikContext to CursorConfiguration
   * 
   * @param context - The Taptik context containing all configuration data
   * @returns Promise<CursorConfiguration> - The transformed Cursor IDE configuration
   */
  async transform(context: TaptikContext): Promise<CursorConfiguration> {
    this.logger.log('Starting transformation from Taptik context to Cursor configuration');

    try {
      const cursorConfig: CursorConfiguration = {
        globalSettings: await this.transformGlobalSettings(context),
        projectSettings: await this.transformProjectSettings(context),
        aiPrompts: await this.transformAIPrompts(context),
        extensions: await this.transformExtensions(context),
        snippets: await this.transformSnippets(context),
        tasks: await this.transformTasks(context),
        launch: await this.transformLaunch(context),
      };

      this.logger.log('Successfully completed transformation to Cursor configuration');
      return cursorConfig;
    } catch (error) {
      this.logger.error('Failed to transform context to Cursor configuration', error);
      throw new Error(`Cursor transformation failed: ${error.message}`);
    }
  }

  /**
   * Transform personal context and preferences to Cursor global settings
   * 
   * @param context - The Taptik context
   * @returns Promise<CursorGlobalSettings | undefined>
   */
  private async transformGlobalSettings(context: TaptikContext): Promise<CursorGlobalSettings | undefined> {
    this.logger.debug('Transforming global settings');

    const personalContext = context.content.personal;
    if (!personalContext) {
      this.logger.debug('No personal context found, skipping global settings transformation');
      return undefined;
    }

    const {preferences} = personalContext;
    const ideSettings = context.content.ide?.['cursor-ide']?.settings as Record<string, any> || {};

    // Build global settings with defaults and mappings
    const globalSettings: CursorGlobalSettings = {
      // Editor settings - map from personal preferences
      'editor.fontSize': preferences?.fontSize || 14,
      'editor.fontFamily': this.mapFontFamily(preferences?.style),
      'editor.tabSize': 2, // Default for most projects
      'editor.insertSpaces': true,
      'editor.wordWrap': 'on',
      'editor.lineNumbers': 'on',
      'editor.minimap.enabled': true,
      'editor.formatOnSave': true,
      'editor.codeActionsOnSave': {
        'source.fixAll': true,
        'source.organizeImports': true,
      },

      // Workbench settings - map theme and appearance
      'workbench.colorTheme': this.mapTheme(preferences?.theme),
      'workbench.iconTheme': 'vs-seti',
      'workbench.startupEditor': 'welcomePage',
      'workbench.sideBar.location': 'left',
      'workbench.panel.defaultLocation': 'bottom',

      // File settings
      'files.autoSave': 'afterDelay',
      'files.autoSaveDelay': 1000,
      'files.exclude': {
        '**/node_modules': true,
        '**/dist': true,
        '**/.git': true,
        '**/.DS_Store': true,
        '**/Thumbs.db': true,
      },
      'files.watcherExclude': {
        '**/node_modules/**': true,
        '**/dist/**': true,
        '**/.git/objects/**': true,
      },

      // Terminal settings
      'terminal.integrated.shell.osx': '/bin/zsh',
      'terminal.integrated.shell.linux': '/bin/bash',
      'terminal.integrated.shell.windows': 'powershell.exe',
      'terminal.integrated.fontSize': (preferences?.fontSize || 14) - 2,
      'terminal.integrated.fontFamily': this.mapFontFamily(preferences?.style),

      // AI settings - Cursor specific
      'cursor.ai.enabled': true,
      'cursor.ai.model': 'gpt-4',
      'cursor.ai.temperature': 0.7,
      'cursor.ai.maxTokens': 4000,
      'cursor.ai.contextWindow': 8000,
      'cursor.ai.autoComplete': true,
      'cursor.ai.codeActions': true,
      'cursor.ai.chat': true,

      // Extension settings
      'extensions.autoUpdate': true,
      'extensions.autoCheckUpdates': true,
      'extensions.ignoreRecommendations': false,

      // Security settings
      'security.workspace.trust.enabled': true,
      'security.workspace.trust.startupPrompt': 'once',
      'security.workspace.trust.banner': 'untilDismissed',
    };

    // Merge any existing Cursor IDE settings
    if (ideSettings) {
      Object.assign(globalSettings, ideSettings);
    }

    this.logger.debug('Successfully transformed global settings');
    return globalSettings;
  }

  /**
   * Map theme preference to Cursor theme name
   */
  private mapTheme(theme?: string): string {
    const themeMap: Record<string, string> = {
      'dark': 'Default Dark+',
      'light': 'Default Light+',
      'high-contrast': 'Default High Contrast',
      'claude-dark': 'Default Dark+',
      'claude-light': 'Default Light+',
      'monokai': 'Monokai',
      'solarized-dark': 'Solarized Dark',
      'solarized-light': 'Solarized Light',
    };
    
    return themeMap[theme?.toLowerCase() || 'dark'] || 'Default Dark+';
  }

  /**
   * Map font style preference to font family
   */
  private mapFontFamily(style?: string): string {
    const fontMap: Record<string, string> = {
      'monospace': 'Consolas, "Courier New", monospace',
      'modern': 'Fira Code, Consolas, monospace',
      'classic': 'Monaco, Menlo, "Ubuntu Mono", monospace',
      'system': 'SF Mono, Monaco, Inconsolata, "Roboto Mono", Consolas, "Courier New", monospace',
    };
    
    return fontMap[style?.toLowerCase() || 'modern'] || 'Consolas, "Courier New", monospace';
  }

  /**
   * Transform project context to Cursor project settings
   * 
   * @param context - The Taptik context
   * @returns Promise<CursorProjectSettings | undefined>
   */
  private async transformProjectSettings(context: TaptikContext): Promise<CursorProjectSettings | undefined> {
    this.logger.debug('Transforming project settings');

    const projectContext = context.content.project;
    if (!projectContext) {
      this.logger.debug('No project context found, skipping project settings transformation');
      return undefined;
    }

    const techStack = projectContext.tech_stack;
    const {conventions} = projectContext;
    const ideSettings = context.content.ide?.['cursor-ide']?.settings as Record<string, any> || {};

    // Build project settings
    const projectSettings: CursorProjectSettings = {
      // Project-specific editor settings
      'editor.rulers': [80, 120],
      'editor.detectIndentation': true,
      'editor.trimAutoWhitespace': true,

      // Search settings
      'search.exclude': {
        '**/node_modules': true,
        '**/dist': true,
        '**/build': true,
        '**/.git': true,
        '**/coverage': true,
        '**/.nyc_output': true,
        '**/*.log': true,
      },
      'search.useIgnoreFiles': true,
      'search.useGlobalIgnoreFiles': true,

      // AI project context settings
      'cursor.ai.projectContext': {
        includeFiles: this.generateIncludeFiles(techStack),
        excludeFiles: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.git/**',
          '**/coverage/**',
          '**/*.log',
          '**/*.tmp',
          '**/.DS_Store',
        ],
        maxFileSize: 1048576, // 1MB
        followSymlinks: false,
      },
      'cursor.ai.rules': [], // Will be populated by AI prompts transformation
      'cursor.ai.prompts': [], // Will be populated by AI prompts transformation
    };

    // Add language-specific settings based on tech stack
    this.addLanguageSettings(projectSettings, techStack);

    // Apply project conventions
    this.applyProjectConventions(projectSettings, conventions);

    // Merge any existing Cursor IDE project settings
    if (ideSettings) {
      Object.assign(projectSettings, ideSettings);
    }

    this.logger.debug('Successfully transformed project settings');
    return projectSettings;
  }

  /**
   * Generate include files patterns based on tech stack
   */
  private generateIncludeFiles(techStack?: any): string[] {
    const basePatterns = ['**/*.md', '**/README*', '**/CHANGELOG*'];
    
    if (!techStack) {
      return [...basePatterns, '**/*.js', '**/*.ts', '**/*.json'];
    }

    const patterns = [...basePatterns];
    const language = techStack.language?.toLowerCase();
    const framework = techStack.framework?.toLowerCase();

    // Add language-specific patterns
    switch (language) {
      case 'typescript':
        patterns.push('**/*.ts', '**/*.tsx', '**/*.d.ts', '**/tsconfig*.json');
        break;
      case 'javascript':
        patterns.push('**/*.js', '**/*.jsx', '**/*.mjs', '**/package*.json');
        break;
      case 'python':
        patterns.push('**/*.py', '**/*.pyi', '**/requirements*.txt', '**/pyproject.toml', '**/setup.py');
        break;
      case 'java':
        patterns.push('**/*.java', '**/pom.xml', '**/build.gradle', '**/gradle.properties');
        break;
      case 'csharp':
      case 'c#':
        patterns.push('**/*.cs', '**/*.csproj', '**/*.sln', '**/appsettings*.json');
        break;
      case 'go':
        patterns.push('**/*.go', '**/go.mod', '**/go.sum');
        break;
      case 'rust':
        patterns.push('**/*.rs', '**/Cargo.toml', '**/Cargo.lock');
        break;
      default:
        patterns.push('**/*.js', '**/*.ts', '**/*.json');
    }

    // Add framework-specific patterns
    switch (framework) {
      case 'nestjs':
        patterns.push('**/nest-cli.json', '**/*.module.ts', '**/*.controller.ts', '**/*.service.ts');
        break;
      case 'nextjs':
      case 'next.js':
        patterns.push('**/next.config.*', '**/pages/**', '**/app/**', '**/components/**');
        break;
      case 'react':
        patterns.push('**/src/**', '**/public/**', '**/components/**');
        break;
      case 'vue':
        patterns.push('**/*.vue', '**/vue.config.*', '**/src/**');
        break;
      case 'angular':
        patterns.push('**/angular.json', '**/src/**', '**/*.component.ts', '**/*.service.ts');
        break;
      case 'express':
        patterns.push('**/routes/**', '**/middleware/**', '**/controllers/**');
        break;
    }

    return patterns;
  }

  /**
   * Add language-specific settings to project configuration
   */
  private addLanguageSettings(settings: CursorProjectSettings, techStack?: any): void {
    const language = techStack?.language?.toLowerCase();
    const testing = techStack?.testing;

    // TypeScript settings
    if (language === 'typescript' || language === 'javascript') {
      settings['[typescript]'] = {
        'editor.defaultFormatter': 'esbenp.prettier-vscode',
        'editor.formatOnSave': true,
        'editor.codeActionsOnSave': {
          'source.fixAll': true,
          'source.organizeImports': true,
        },
      };

      settings['[javascript]'] = {
        'editor.defaultFormatter': 'esbenp.prettier-vscode',
        'editor.formatOnSave': true,
      };

      // Add JSON settings for config files
      settings['[json]'] = {
        'editor.defaultFormatter': 'vscode.json-language-features',
        'editor.formatOnSave': true,
      };

      settings['[jsonc]'] = {
        'editor.defaultFormatter': 'vscode.json-language-features',
        'editor.formatOnSave': true,
      };
    }

    // Python settings
    if (language === 'python') {
      settings['[python]'] = {
        'editor.defaultFormatter': 'ms-python.black-formatter',
        'python.defaultInterpreterPath': 'python',
      };
    }

    // Add test-specific settings
    if (testing?.includes('jest') || testing?.includes('vitest')) {
      // Note: JavaScript interface doesn't support codeActionsOnSave, so we skip this
      // settings['[javascript]'] = {
      //   ...settings['[javascript]'],
      //   'editor.codeActionsOnSave': {
      //     'source.fixAll.eslint': true,
      //   },
      // };
    }
  }

  /**
   * Apply project conventions to settings
   */
  private applyProjectConventions(settings: CursorProjectSettings, conventions?: any): void {
    if (!conventions) return;

    // Apply file naming conventions
    if (conventions.file_naming === 'kebab-case') {
      settings['files.associations'] = {
        '*.component.ts': 'typescript',
        '*.service.ts': 'typescript',
        '*.module.ts': 'typescript',
      };
    }

    // Apply commit conventions
    if (conventions.commit_convention === 'conventional') {
      // This would be used by git hooks or commit message templates
      settings['git.inputValidation'] = 'always';
    }
  }

  /**
   * Transform prompts context to Cursor AI prompts and rules
   * 
   * @param context - The Taptik context
   * @returns Promise<CursorAIPrompts | undefined>
   */
  private async transformAIPrompts(context: TaptikContext): Promise<CursorAIPrompts | undefined> {
    this.logger.debug('Transforming AI prompts');

    const promptsContext = context.content.prompts;
    const projectContext = context.content.project;
    const toolsContext = context.content.tools;

    if (!promptsContext && !projectContext && !toolsContext) {
      this.logger.debug('No prompts, project, or tools context found, skipping AI prompts transformation');
      return undefined;
    }

    const aiPrompts: CursorAIPrompts = {
      systemPrompts: {},
      projectPrompts: {},
      rules: {},
    };

    // Transform system prompts from prompts context
    if (promptsContext?.system_prompts) {
      for (const prompt of promptsContext.system_prompts) {
        aiPrompts.systemPrompts[prompt.name] = {
          content: prompt.content,
          description: `System prompt: ${prompt.name}`,
          tags: prompt.tags || [prompt.category || 'general'],
        };
      }
    }

    // Transform prompt templates
    if (promptsContext?.templates) {
      for (const template of promptsContext.templates) {
        aiPrompts.systemPrompts[template.name] = {
          content: template.template,
          description: template.description || `Template: ${template.name}`,
          tags: ['template'],
        };
      }
    }

    // Transform conversation examples to project prompts
    if (promptsContext?.examples) {
      for (const example of promptsContext.examples) {
        aiPrompts.projectPrompts[example.name] = {
          content: example.prompt,
          description: `Example: ${example.name}`,
          context: example.use_case || 'general',
          tags: ['example'],
        };
      }
    }

    // Transform Claude Code agents to project prompts
    if (toolsContext?.agents) {
      for (const agent of toolsContext.agents) {
        aiPrompts.projectPrompts[agent.name] = {
          content: agent.content,
          description: `Claude Code Agent: ${agent.name}`,
          context: 'agent',
          tags: ['claude-code', 'agent'],
        };
      }
    }

    // Transform Claude Code commands to project prompts
    if (toolsContext?.commands) {
      for (const command of toolsContext.commands) {
        aiPrompts.projectPrompts[command.name] = {
          content: command.content,
          description: `Claude Code Command: ${command.name}`,
          context: 'command',
          tags: ['claude-code', 'command'],
        };
      }
    }

    // Generate rules from project context
    if (projectContext) {
      aiPrompts.rules = this.generateProjectRules(projectContext);
    }

    // Transform Claude MD content if available
    const claudeMd = projectContext?.claudeMd || context.content.ide?.['claude-code']?.claude_md;
    if (claudeMd) {
      aiPrompts.projectPrompts['claude-md'] = {
        content: claudeMd,
        description: 'Claude Code project context',
        context: 'project',
        tags: ['claude-code', 'project-context'],
      };
    }

    this.logger.debug('Successfully transformed AI prompts');
    return aiPrompts;
  }

  /**
   * Generate Cursor AI rules from project context
   */
  private generateProjectRules(projectContext: any): Record<string, string> {
    const rules: Record<string, string> = {};

    // Generate architecture rule
    if (projectContext.architecture || projectContext.tech_stack) {
      rules['architecture'] = this.generateArchitectureRule(projectContext);
    }

    // Generate coding style rule
    if (projectContext.conventions || projectContext.tech_stack) {
      rules['coding-style'] = this.generateCodingStyleRule(projectContext);
    }

    // Generate testing rule
    if (projectContext.tech_stack?.testing) {
      rules['testing'] = this.generateTestingRule(projectContext);
    }

    // Generate security rule
    if (projectContext.constraints?.security_level) {
      rules['security'] = this.generateSecurityRule(projectContext);
    }

    return rules;
  }

  /**
   * Generate architecture rule content
   */
  private generateArchitectureRule(projectContext: any): string {
    const { architecture, tech_stack, info } = projectContext;
    
    let rule = `# Architecture Guidelines\n\n`;
    
    if (info?.name) {
      rule += `Project: ${info.name}\n`;
    }
    
    if (info?.type) {
      rule += `Type: ${info.type}\n`;
    }
    
    rule += `\n## Architecture Pattern\n`;
    
    if (architecture?.pattern) {
      rule += `- Follow ${architecture.pattern} architecture pattern\n`;
    }
    
    if (architecture?.database_pattern) {
      rule += `- Use ${architecture.database_pattern} for data access\n`;
    }
    
    if (architecture?.api_style) {
      rule += `- Implement ${architecture.api_style} API design\n`;
    }
    
    if (tech_stack) {
      rule += `\n## Technology Stack\n`;
      if (tech_stack.framework) rule += `- Framework: ${tech_stack.framework}\n`;
      if (tech_stack.language) rule += `- Language: ${tech_stack.language}\n`;
      if (tech_stack.database) rule += `- Database: ${tech_stack.database}\n`;
      if (tech_stack.orm) rule += `- ORM: ${tech_stack.orm}\n`;
    }
    
    return rule;
  }

  /**
   * Generate coding style rule content
   */
  private generateCodingStyleRule(projectContext: any): string {
    const { conventions, tech_stack } = projectContext;
    
    let rule = `# Coding Style Guidelines\n\n`;
    
    if (conventions) {
      rule += `## Naming Conventions\n`;
      if (conventions.file_naming) rule += `- Files: ${conventions.file_naming}\n`;
      if (conventions.folder_structure) rule += `- Folders: ${conventions.folder_structure}\n`;
      
      rule += `\n## Version Control\n`;
      if (conventions.commit_convention) rule += `- Commits: ${conventions.commit_convention}\n`;
      if (conventions.branch_strategy) rule += `- Branches: ${conventions.branch_strategy}\n`;
    }
    
    if (tech_stack?.language) {
      rule += `\n## Language-Specific Guidelines\n`;
      rule += `- Primary language: ${tech_stack.language}\n`;
      
      // Add language-specific best practices
      switch (tech_stack.language.toLowerCase()) {
        case 'typescript':
          rule += `- Use strict TypeScript configuration\n`;
          rule += `- Prefer interfaces over types for object shapes\n`;
          rule += `- Use proper type annotations\n`;
          break;
        case 'javascript':
          rule += `- Use ES6+ features\n`;
          rule += `- Prefer const/let over var\n`;
          rule += `- Use arrow functions appropriately\n`;
          break;
        case 'python':
          rule += `- Follow PEP 8 style guide\n`;
          rule += `- Use type hints\n`;
          rule += `- Write docstrings for functions and classes\n`;
          break;
      }
    }
    
    return rule;
  }

  /**
   * Generate testing rule content
   */
  private generateTestingRule(projectContext: any): string {
    const { tech_stack } = projectContext;
    
    let rule = `# Testing Guidelines\n\n`;
    
    if (tech_stack.testing) {
      rule += `## Testing Framework\n`;
      for (const framework of tech_stack.testing) {
        rule += `- ${framework}\n`;
      }
    }
    
    rule += `\n## Testing Principles\n`;
    rule += `- Write tests for all critical functionality\n`;
    rule += `- Follow AAA pattern (Arrange, Act, Assert)\n`;
    rule += `- Use descriptive test names\n`;
    rule += `- Mock external dependencies\n`;
    rule += `- Maintain test coverage above 80%\n`;
    
    // Add framework-specific guidelines
    if (tech_stack.testing?.includes('jest')) {
      rule += `\n## Jest Guidelines\n`;
      rule += `- Use describe blocks to group related tests\n`;
      rule += `- Use beforeEach/afterEach for setup/cleanup\n`;
      rule += `- Mock modules with jest.mock()\n`;
    }
    
    if (tech_stack.testing?.includes('vitest')) {
      rule += `\n## Vitest Guidelines\n`;
      rule += `- Use vi.mock() for mocking\n`;
      rule += `- Leverage Vitest's fast execution\n`;
      rule += `- Use test.concurrent for parallel tests\n`;
    }
    
    return rule;
  }

  /**
   * Generate security rule content
   */
  private generateSecurityRule(projectContext: any): string {
    const { constraints } = projectContext;
    
    let rule = `# Security Guidelines\n\n`;
    
    if (constraints.security_level) {
      rule += `Security Level: ${constraints.security_level}\n\n`;
    }
    
    rule += `## General Security Practices\n`;
    rule += `- Never commit secrets or API keys\n`;
    rule += `- Use environment variables for configuration\n`;
    rule += `- Validate all user inputs\n`;
    rule += `- Use HTTPS for all communications\n`;
    rule += `- Implement proper authentication and authorization\n`;
    rule += `- Keep dependencies updated\n`;
    
    if (constraints.compliance) {
      rule += `\n## Compliance Requirements\n`;
      for (const requirement of constraints.compliance) {
        rule += `- ${requirement}\n`;
      }
    }
    
    return rule;
  }

  /**
   * Transform tools context to Cursor extensions configuration
   * 
   * @param context - The Taptik context
   * @returns Promise<CursorExtensions | undefined>
   */
  private async transformExtensions(context: TaptikContext): Promise<CursorExtensions | undefined> {
    this.logger.debug('Transforming extensions');

    const projectContext = context.content.project;
    const ideContext = context.content.ide;
    
    // Get existing extensions from various sources
    const claudeCodeExtensions = ideContext?.['claude-code']?.extensions as string[] || [];
    const cursorExtensions = ideContext?.['cursor-ide']?.extensions as string[] || [];
    // Note: kiro-ide doesn't have extensions in the interface, so we skip it
    const kiroExtensions: string[] = [];

    // Combine all extensions
    const allExtensions = [
      ...claudeCodeExtensions,
      ...cursorExtensions,
      ...kiroExtensions,
    ];

    // Generate recommended extensions based on tech stack
    const techStackExtensions = this.generateTechStackExtensions(projectContext?.tech_stack);
    
    // Combine and deduplicate
    const recommendedExtensions = [...new Set([...allExtensions, ...techStackExtensions])];
    
    // Filter out incompatible extensions
    const compatibleExtensions = this.filterCompatibleExtensions(recommendedExtensions);
    const incompatibleExtensions = this.getIncompatibleExtensions(recommendedExtensions);

    if (compatibleExtensions.length === 0 && incompatibleExtensions.length === 0) {
      this.logger.debug('No extensions found, skipping extensions transformation');
      return undefined;
    }

    const extensions: CursorExtensions = {
      recommendations: compatibleExtensions,
      unwantedRecommendations: incompatibleExtensions,
    };

    this.logger.debug(`Transformed ${compatibleExtensions.length} compatible extensions and ${incompatibleExtensions.length} incompatible extensions`);
    return extensions;
  }

  /**
   * Transform IDE context to Cursor code snippets
   * 
   * @param context - The Taptik context
   * @returns Promise<CursorSnippets | undefined>
   */
  private async transformSnippets(context: TaptikContext): Promise<CursorSnippets | undefined> {
    this.logger.debug('Transforming snippets');

    const projectContext = context.content.project;
    const ideContext = context.content.ide;

    // Get existing snippets from IDE contexts
    const existingSnippets = this.extractExistingSnippets(ideContext);
    
    // Generate tech stack specific snippets
    const techStackSnippets = this.generateTechStackSnippets(projectContext?.tech_stack);
    
    // Merge snippets
    const allSnippets = this.mergeSnippets(existingSnippets, techStackSnippets);

    if (Object.keys(allSnippets).length === 0) {
      this.logger.debug('No snippets found, skipping snippets transformation');
      return undefined;
    }

    this.logger.debug(`Transformed snippets for ${Object.keys(allSnippets).length} languages`);
    return allSnippets;
  }

  /**
   * Generate recommended extensions based on tech stack
   */
  private generateTechStackExtensions(techStack?: any): string[] {
    if (!techStack) return [];

    const extensions: string[] = [];
    const language = techStack.language?.toLowerCase();
    const framework = techStack.framework?.toLowerCase();
    const testing = techStack.testing || [];

    // Language-specific extensions
    switch (language) {
      case 'typescript':
      case 'javascript':
        extensions.push(
          'esbenp.prettier-vscode',
          'dbaeumer.vscode-eslint',
          'bradlc.vscode-tailwindcss',
          'ms-vscode.vscode-typescript-next'
        );
        break;
      case 'python':
        extensions.push(
          'ms-python.python',
          'ms-python.black-formatter',
          'ms-python.pylint',
          'ms-python.isort'
        );
        break;
      case 'java':
        extensions.push(
          'redhat.java',
          'vscjava.vscode-java-pack',
          'vscjava.vscode-spring-boot-dashboard'
        );
        break;
      case 'csharp':
      case 'c#':
        extensions.push(
          'ms-dotnettools.csharp',
          'ms-dotnettools.vscode-dotnet-runtime'
        );
        break;
      case 'go':
        extensions.push('golang.go');
        break;
      case 'rust':
        extensions.push('rust-lang.rust-analyzer');
        break;
    }

    // Framework-specific extensions
    switch (framework) {
      case 'nestjs':
        extensions.push(
          'angular.ng-template',
          'ms-vscode.vscode-json'
        );
        break;
      case 'nextjs':
      case 'next.js':
      case 'react':
        extensions.push(
          'dsznajder.es7-react-js-snippets',
          'formulahendry.auto-rename-tag',
          'bradlc.vscode-tailwindcss'
        );
        break;
      case 'vue':
        extensions.push(
          'vue.volar',
          'vue.vscode-typescript-vue-plugin'
        );
        break;
      case 'angular':
        extensions.push(
          'angular.ng-template',
          'johnpapa.angular2'
        );
        break;
      case 'express':
        extensions.push('ms-vscode.vscode-json');
        break;
    }

    // Testing framework extensions
    for (const testFramework of testing) {
      switch (testFramework.toLowerCase()) {
        case 'jest':
          extensions.push('orta.vscode-jest');
          break;
        case 'vitest':
          extensions.push('zixuanchen.vitest-explorer');
          break;
        case 'cypress':
          extensions.push('shelex.vscode-cy-helper');
          break;
        case 'playwright':
          extensions.push('ms-playwright.playwright');
          break;
      }
    }

    // General development extensions
    extensions.push(
      'ms-vscode.vscode-json',
      'redhat.vscode-yaml',
      'ms-vscode.vscode-markdown',
      'streetsidesoftware.code-spell-checker'
    );

    return extensions;
  }

  /**
   * Filter out extensions that are incompatible with Cursor
   */
  private filterCompatibleExtensions(extensions: string[]): string[] {
    const incompatible = this.getIncompatibleExtensions(extensions);
    return extensions.filter(_ext => !incompatible.includes(_ext));
  }

  /**
   * Get list of extensions incompatible with Cursor
   */
  private getIncompatibleExtensions(extensions: string[]): string[] {
    const incompatibleList = [
      'github.copilot', // Cursor has built-in AI
      'github.copilot-chat', // Cursor has built-in AI chat
      'tabnine.tabnine-vscode', // Conflicts with Cursor AI
      'visualstudioexptteam.vscodeintellicode', // Cursor has built-in intelligence
      'ms-vscode.vscode-typescript-next', // Cursor has built-in TypeScript support
    ];

    return extensions.filter(ext => incompatibleList.includes(ext));
  }

  /**
   * Extract existing snippets from IDE contexts
   */
  private extractExistingSnippets(ideContext?: any): CursorSnippets {
    const snippets: CursorSnippets = {};

    // Extract from various IDE contexts
    const contexts = [
      ideContext?.['claude-code'],
      ideContext?.['cursor-ide'],
      ideContext?.['kiro-ide'],
    ];

    for (const context of contexts) {
      if (context?.snippets) {
        Object.assign(snippets, context.snippets);
      }
    }

    return snippets;
  }

  /**
   * Generate tech stack specific snippets
   */
  private generateTechStackSnippets(techStack?: any): CursorSnippets {
    if (!techStack) return {};

    const snippets: CursorSnippets = {};
    const language = techStack.language?.toLowerCase();
    const framework = techStack.framework?.toLowerCase();

    // TypeScript/JavaScript snippets
    if (language === 'typescript' || language === 'javascript') {
      const _ext = language === 'typescript' ? 'ts' : 'js';
      
      snippets[language] = {
        'console-log': {
          prefix: 'cl',
          body: ['console.log($1);'],
          description: 'Console log'
        },
        'arrow-function': {
          prefix: 'af',
          body: ['const $1 = ($2) => {', '  $3', '};'],
          description: 'Arrow function'
        },
        'async-function': {
          prefix: 'asf',
          body: ['const $1 = async ($2) => {', '  $3', '};'],
          description: 'Async arrow function'
        },
      };

      // TypeScript specific snippets
      if (language === 'typescript') {
        snippets.typescript = {
          ...snippets.typescript,
          'interface': {
            prefix: 'int',
            body: ['interface $1 {', '  $2', '}'],
            description: 'TypeScript interface'
          },
          'type': {
            prefix: 'typ',
            body: ['type $1 = $2;'],
            description: 'TypeScript type alias'
          },
        };
      }
    }

    // Framework-specific snippets
    if (framework === 'nestjs') {
      snippets.typescript = {
        ...snippets.typescript,
        'nestjs-controller': {
          prefix: 'nest-controller',
          body: [
            '@Controller(\'$1\')',
            'export class $2Controller {',
            '  constructor() {}',
            '',
            '  @Get()',
            '  findAll() {',
            '    return \'This action returns all $1\';',
            '  }',
            '}'
          ],
          description: 'NestJS Controller'
        },
        'nestjs-service': {
          prefix: 'nest-service',
          body: [
            '@Injectable()',
            'export class $1Service {',
            '  constructor() {}',
            '',
            '  findAll() {',
            '    return \'This action returns all $1\';',
            '  }',
            '}'
          ],
          description: 'NestJS Service'
        },
      };
    }

    // React snippets
    if (framework === 'react' || framework === 'nextjs') {
      const reactLang = language === 'typescript' ? 'typescriptreact' : 'javascriptreact';
      
      snippets[reactLang] = {
        'react-component': {
          prefix: 'rfc',
          body: [
            'import React from \'react\';',
            '',
            'interface $1Props {',
            '  $2',
            '}',
            '',
            'const $1: React.FC<$1Props> = ({ $3 }) => {',
            '  return (',
            '    <div>',
            '      $4',
            '    </div>',
            '  );',
            '};',
            '',
            'export default $1;'
          ],
          description: 'React Functional Component'
        },
      };
    }

    return snippets;
  }

  /**
   * Merge multiple snippet collections
   */
  private mergeSnippets(...snippetCollections: CursorSnippets[]): CursorSnippets {
    const merged: CursorSnippets = {};

    for (const collection of snippetCollections) {
      for (const [language, snippets] of Object.entries(collection)) {
        if (!merged[language]) {
          merged[language] = {};
        }
        Object.assign(merged[language], snippets);
      }
    }

    return merged;
  }

  /**
   * Transform tools context to Cursor tasks configuration
   * 
   * @param context - The Taptik context
   * @returns Promise<CursorTasks | undefined>
   */
  private async transformTasks(context: TaptikContext): Promise<CursorTasks | undefined> {
    this.logger.debug('Transforming tasks');

    const projectContext = context.content.project;
    const toolsContext = context.content.tools;
    const ideContext = context.content.ide;

    // Get existing tasks from IDE contexts
    const existingTasks = this.extractExistingTasks(ideContext);
    
    // Generate tasks from Claude Code commands
    const commandTasks = this.transformCommandsToTasks(toolsContext?.commands || []);
    
    // Generate tech stack specific tasks
    const techStackTasks = this.generateTechStackTasks(projectContext?.tech_stack);
    
    // Combine all tasks
    const allTasks = [...existingTasks, ...commandTasks, ...techStackTasks];

    if (allTasks.length === 0) {
      this.logger.debug('No tasks found, skipping tasks transformation');
      return undefined;
    }

    const tasks: CursorTasks = {
      version: '2.0.0',
      tasks: allTasks,
    };

    this.logger.debug(`Transformed ${allTasks.length} tasks`);
    return tasks;
  }

  /**
   * Transform project context to Cursor launch/debug configuration
   * 
   * @param context - The Taptik context
   * @returns Promise<CursorLaunch | undefined>
   */
  private async transformLaunch(context: TaptikContext): Promise<CursorLaunch | undefined> {
    this.logger.debug('Transforming launch configuration');

    const projectContext = context.content.project;
    const ideContext = context.content.ide;

    // Get existing launch configurations
    const existingConfigs = this.extractExistingLaunchConfigs(ideContext);
    
    // Generate launch configurations based on tech stack
    const techStackConfigs = this.generateTechStackLaunchConfigs(projectContext?.tech_stack);
    
    // Combine configurations
    const allConfigs = [...existingConfigs, ...techStackConfigs];

    if (allConfigs.length === 0) {
      this.logger.debug('No launch configurations found, skipping launch transformation');
      return undefined;
    }

    const launch: CursorLaunch = {
      version: '0.2.0',
      configurations: allConfigs,
    };

    this.logger.debug(`Transformed ${allConfigs.length} launch configurations`);
    return launch;
  }

  /**
   * Extract existing tasks from IDE contexts
   */
  private extractExistingTasks(ideContext?: any): any[] {
    const tasks: any[] = [];

    // Extract from various IDE contexts
    const contexts = [
      ideContext?.['claude-code'],
      ideContext?.['cursor-ide'],
      ideContext?.['kiro-ide'],
    ];

    for (const context of contexts) {
      if (context?.tasks?.tasks) {
        tasks.push(...context.tasks.tasks);
      }
    }

    return tasks;
  }

  /**
   * Transform Claude Code commands to Cursor tasks
   */
  private transformCommandsToTasks(commands: any[]): any[] {
    const tasks: any[] = [];

    for (const command of commands) {
      // Parse command content to extract executable commands
      const executableCommands = this.parseCommandContent(command.content);
      
      for (const execCmd of executableCommands) {
        tasks.push({
          label: `${command.name}: ${execCmd.name}`,
          type: 'shell',
          command: execCmd.command,
          args: execCmd.args || [],
          group: this.determineTaskGroup(execCmd.command),
          presentation: {
            echo: true,
            reveal: 'always',
            focus: false,
            panel: 'shared',
          },
          problemMatcher: this.getProblemMatcher(execCmd.command),
        });
      }
    }

    return tasks;
  }

  /**
   * Generate tech stack specific tasks
   */
  private generateTechStackTasks(techStack?: any): any[] {
    if (!techStack) return [];

    const tasks: any[] = [];
    const language = techStack.language?.toLowerCase();
    const framework = techStack.framework?.toLowerCase();
    const testing = techStack.testing || [];

    // Common tasks for Node.js projects
    if (language === 'typescript' || language === 'javascript') {
      tasks.push(
        {
          label: 'npm: install',
          type: 'shell',
          command: 'npm',
          args: ['install'],
          group: 'build',
          presentation: {
            echo: true,
            reveal: 'always',
            focus: false,
            panel: 'shared',
          },
        },
        {
          label: 'npm: build',
          type: 'shell',
          command: 'npm',
          args: ['run', 'build'],
          group: 'build',
          presentation: {
            echo: true,
            reveal: 'always',
            focus: false,
            panel: 'shared',
          },
          problemMatcher: ['$tsc'],
        },
        {
          label: 'npm: start',
          type: 'shell',
          command: 'npm',
          args: ['start'],
          presentation: {
            echo: true,
            reveal: 'always',
            focus: false,
            panel: 'shared',
          },
        }
      );
    }

    // Framework-specific tasks
    if (framework === 'nestjs') {
      tasks.push(
        {
          label: 'nest: start:dev',
          type: 'shell',
          command: 'npm',
          args: ['run', 'start:dev'],
          presentation: {
            echo: true,
            reveal: 'always',
            focus: false,
            panel: 'shared',
          },
        },
        {
          label: 'nest: build',
          type: 'shell',
          command: 'npm',
          args: ['run', 'build'],
          group: 'build',
          presentation: {
            echo: true,
            reveal: 'always',
            focus: false,
            panel: 'shared',
          },
        }
      );
    }

    if (framework === 'nextjs') {
      tasks.push(
        {
          label: 'next: dev',
          type: 'shell',
          command: 'npm',
          args: ['run', 'dev'],
          presentation: {
            echo: true,
            reveal: 'always',
            focus: false,
            panel: 'shared',
          },
        },
        {
          label: 'next: build',
          type: 'shell',
          command: 'npm',
          args: ['run', 'build'],
          group: 'build',
          presentation: {
            echo: true,
            reveal: 'always',
            focus: false,
            panel: 'shared',
          },
        }
      );
    }

    // Testing tasks
    for (const testFramework of testing) {
      switch (testFramework.toLowerCase()) {
        case 'jest':
          tasks.push({
            label: 'test: jest',
            type: 'shell',
            command: 'npm',
            args: ['run', 'test'],
            group: 'test',
            presentation: {
              echo: true,
              reveal: 'always',
              focus: false,
              panel: 'shared',
            },
            problemMatcher: ['$jest'],
          });
          break;
        case 'vitest':
          tasks.push({
            label: 'test: vitest',
            type: 'shell',
            command: 'npm',
            args: ['run', 'test'],
            group: 'test',
            presentation: {
              echo: true,
              reveal: 'always',
              focus: false,
              panel: 'shared',
            },
          });
          break;
      }
    }

    return tasks;
  }

  /**
   * Parse command content to extract executable commands
   */
  private parseCommandContent(content: string): Array<{ name: string; command: string; args?: string[] }> {
    const commands: Array<{ name: string; command: string; args?: string[] }> = [];
    
    // Simple parsing - look for common command patterns
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
        continue;
      }
      
      // Look for npm/yarn commands
      if (trimmed.includes('npm ') || trimmed.includes('yarn ')) {
        const parts = trimmed.split(' ');
        const cmdIndex = parts.findIndex(p => p === 'npm' || p === 'yarn');
        if (cmdIndex >= 0) {
          commands.push({
            name: parts.slice(cmdIndex).join(' '),
            command: parts[cmdIndex],
            args: parts.slice(cmdIndex + 1),
          });
        }
      }
      
      // Look for other common commands
      const commonCommands = ['node', 'python', 'java', 'go', 'cargo', 'dotnet'];
      for (const cmd of commonCommands) {
        if (trimmed.startsWith(`${cmd  } `)) {
          const parts = trimmed.split(' ');
          commands.push({
            name: trimmed,
            command: cmd,
            args: parts.slice(1),
          });
          break;
        }
      }
    }
    
    return commands;
  }

  /**
   * Determine task group based on command
   */
  private determineTaskGroup(command: string): 'build' | 'test' | 'clean' | undefined {
    if (command.includes('build') || command.includes('compile')) {
      return 'build';
    }
    if (command.includes('test') || command.includes('spec')) {
      return 'test';
    }
    if (command.includes('clean') || command.includes('clear')) {
      return 'clean';
    }
    return undefined;
  }

  /**
   * Get problem matcher for command
   */
  private getProblemMatcher(command: string): string | string[] | undefined {
    if (command.includes('tsc') || command.includes('typescript')) {
      return ['$tsc'];
    }
    if (command.includes('eslint')) {
      return ['$eslint-stylish'];
    }
    if (command.includes('jest')) {
      return ['$jest'];
    }
    return undefined;
  }

  /**
   * Extract existing launch configurations from IDE contexts
   */
  private extractExistingLaunchConfigs(ideContext?: any): any[] {
    const configs: any[] = [];

    // Extract from various IDE contexts
    const contexts = [
      ideContext?.['claude-code'],
      ideContext?.['cursor-ide'],
      ideContext?.['kiro-ide'],
    ];

    for (const context of contexts) {
      if (context?.launch?.configurations) {
        configs.push(...context.launch.configurations);
      }
    }

    return configs;
  }

  /**
   * Generate tech stack specific launch configurations
   */
  private generateTechStackLaunchConfigs(techStack?: any): unknown[] {
    if (!techStack) return [];

    const configs: unknown[] = [];
    const language = techStack.language?.toLowerCase();
    const framework = techStack.framework?.toLowerCase();
    const runtime = techStack.runtime?.toLowerCase();

    // Node.js configurations
    if (language === 'typescript' || language === 'javascript' || runtime === 'node') {
      configs.push({
        name: 'Launch Program',
        type: 'node',
        request: 'launch',
        program: '${workspaceFolder}/dist/main.js',
        args: [],
        cwd: '${workspaceFolder}',
        env: {
          NODE_ENV: 'development',
        },
        console: 'integratedTerminal',
        preLaunchTask: 'npm: build',
      });

      // TypeScript specific configuration
      if (language === 'typescript') {
        configs.push({
          name: 'Launch TypeScript',
          type: 'node',
          request: 'launch',
          program: '${workspaceFolder}/src/main.ts',
          args: [],
          cwd: '${workspaceFolder}',
          env: {
            NODE_ENV: 'development',
          },
          console: 'integratedTerminal',
          runtimeArgs: ['-r', 'ts-node/register'],
        });
      }
    }

    // Framework-specific configurations
    if (framework === 'nestjs') {
      configs.push({
        name: 'Launch NestJS',
        type: 'node',
        request: 'launch',
        program: '${workspaceFolder}/dist/main.js',
        args: [],
        cwd: '${workspaceFolder}',
        env: {
          NODE_ENV: 'development',
        },
        console: 'integratedTerminal',
        preLaunchTask: 'nest: build',
      });
    }

    // Python configurations
    if (language === 'python') {
      configs.push({
        name: 'Python: Current File',
        type: 'python',
        request: 'launch',
        program: '${file}',
        console: 'integratedTerminal',
        cwd: '${workspaceFolder}',
      });
    }

    // Java configurations
    if (language === 'java') {
      configs.push({
        name: 'Launch Java',
        type: 'java',
        request: 'launch',
        mainClass: 'Main',
        projectName: '${workspaceFolderBasename}',
      });
    }

    return configs;
  }
}