import { Injectable } from '@nestjs/common';

import {
  CloudMetadata,
  TaptikContext,
  ClaudeCodeLocalSettings,
  ClaudeCodeGlobalSettings,
  ClaudeCommand,
} from '../interfaces/cloud.interface';

interface ComponentAnalysis {
  agents: number;
  commands: number;
  mcpServers: number;
  steeringRules: number;
  instructions: number;
}

interface _TagGenerationContext {
  context: TaptikContext;
  componentCount: ComponentAnalysis;
  features: string[];
  languages: Set<string>;
  technologies: Set<string>;
}

@Injectable()
export class MetadataGeneratorService {
  private readonly MAX_KEYWORDS = 50;
  private readonly MAX_DESCRIPTION_LENGTH = 200;

  // Technology mapping for better keyword extraction
  private readonly TECHNOLOGY_PATTERNS = new Map<string, string>([
    // Build tools
    ['next', 'nextjs'],
    ['vite', 'vite'],
    ['webpack', 'webpack'],
    ['rollup', 'rollup'],
    ['parcel', 'parcel'],
    ['esbuild', 'esbuild'],

    // Testing frameworks
    ['jest', 'jest'],
    ['vitest', 'vitest'],
    ['mocha', 'mocha'],
    ['cypress', 'cypress'],
    ['playwright', 'playwright'],
    ['selenium', 'selenium'],

    // Linting and formatting
    ['eslint', 'eslint'],
    ['prettier', 'prettier'],
    ['biome', 'biome'],
    ['stylelint', 'stylelint'],

    // Container and orchestration
    ['docker', 'docker'],
    ['kubernetes', 'kubernetes'],
    ['k8s', 'kubernetes'],
    ['kubectl', 'kubernetes'],
    ['helm', 'helm'],
    ['compose', 'docker-compose'],

    // Frontend frameworks
    ['react', 'react'],
    ['redux', 'redux'],
    ['vue', 'vue'],
    ['vuex', 'vuex'],
    ['angular', 'angular'],
    ['svelte', 'svelte'],
    ['solid', 'solidjs'],
    ['qwik', 'qwik'],

    // Backend frameworks
    ['express', 'express'],
    ['fastify', 'fastify'],
    ['nestjs', 'nestjs'],
    ['koa', 'koa'],
    ['hapi', 'hapi'],
    ['django', 'django'],
    ['flask', 'flask'],
    ['fastapi', 'fastapi'],
    ['rails', 'rails'],
    ['laravel', 'laravel'],
    ['spring', 'spring'],

    // Languages
    ['typescript', 'typescript'],
    ['javascript', 'javascript'],
    ['python', 'python'],
    ['pytest', 'python'],
    ['rust', 'rust'],
    ['cargo', 'rust'],
    ['golang', 'golang'],
    ['java', 'java'],
    ['kotlin', 'kotlin'],
    ['swift', 'swift'],

    // Package managers
    ['npm', 'nodejs'],
    ['pnpm', 'nodejs'],
    ['yarn', 'nodejs'],
    ['bun', 'bun'],
    ['pip', 'python'],
    ['poetry', 'python'],
    ['cargo', 'rust'],
    ['maven', 'java'],
    ['gradle', 'java'],
  ]);

  // Common words to exclude from keywords
  private readonly COMMON_WORDS = new Set<string>([
    'the',
    'and',
    'for',
    'with',
    'use',
    'all',
    'new',
    'can',
    'has',
    'this',
    'that',
    'from',
    'will',
    'are',
    'was',
    'been',
    'have',
    'had',
    'were',
    'said',
    'each',
    'which',
    'she',
    'their',
    'what',
    'not',
    'but',
    'out',
    'them',
    'than',
    'then',
    'its',
    'also',
    'echo',
    'run',
    'npm',
    'yarn',
    'pnpm',
    'node',
    'help',
    'about',
    'more',
    'less',
    'very',
    'much',
    'many',
    'some',
    'any',
    'only',
  ]);

  // Language to category mapping for better tagging
  private readonly LANGUAGE_CATEGORIES = new Map<string, string[]>([
    ['typescript', ['frontend', 'backend', 'fullstack']],
    ['javascript', ['frontend', 'backend', 'fullstack']],
    ['react', ['frontend', 'ui']],
    ['vue', ['frontend', 'ui']],
    ['angular', ['frontend', 'ui']],
    ['python', ['backend', 'data-science', 'ml']],
    ['rust', ['backend', 'systems']],
    ['golang', ['backend', 'microservices']],
    ['java', ['backend', 'enterprise']],
    ['kotlin', ['backend', 'mobile']],
    ['swift', ['mobile', 'ios']],
  ]);

  async generateCloudMetadata(context: TaptikContext): Promise<CloudMetadata> {
    const componentCount = this.analyzeComponents(context);
    const features = this.detectFeatures(context);
    const tags = this.generateTags(context, componentCount, features);
    const searchKeywords = this.generateSearchKeywords(context, tags);
    const complexityLevel = this.assessComplexity(componentCount);
    const compatibility = this.detectCompatibility(context, features);

    return {
      title: this.generateTitle(context),
      description: this.generateDescription(context, componentCount, features),
      sourceIde: context.sourceIde || 'claude-code',
      targetIdes:
        context.targetIdes?.length > 0 ? context.targetIdes : ['claude-code'],
      tags: this.deduplicateAndSort(tags),
      searchKeywords: this.optimizeKeywords(searchKeywords),
      componentCount,
      complexityLevel,
      features: this.deduplicateAndSort(features),
      compatibility: this.deduplicateAndSort(compatibility),
      version: context.version || '1.0.0',
      author: context.metadata?.exportedBy || 'unknown',
      createdAt: context.metadata?.timestamp || new Date().toISOString(),
      fileSize: 0,
      checksum: 'pending', // Will be set by package service
    };
  }

  private generateTitle(context: TaptikContext): string {
    const ideNames: Record<string, string> = {
      'claude-code': 'Claude Code',
      'kiro-ide': 'Kiro IDE',
      'cursor-ide': 'Cursor IDE',
    };

    const sourceName = ideNames[context.sourceIde] || 'Claude Code';
    return `${sourceName} Configuration`;
  }

  private generateDescription(
    context: TaptikContext,
    componentCount: ComponentAnalysis,
    features: string[],
  ): string {
    const components: string[] = [];

    // Add component counts
    if (componentCount.agents > 0) {
      components.push(
        `${componentCount.agents} agent${componentCount.agents > 1 ? 's' : ''}`,
      );
    }
    if (componentCount.commands > 0) {
      components.push(
        `${componentCount.commands} command${componentCount.commands > 1 ? 's' : ''}`,
      );
    }
    if (componentCount.mcpServers > 0) {
      components.push(
        `${componentCount.mcpServers} MCP server${componentCount.mcpServers > 1 ? 's' : ''}`,
      );
    }
    if (componentCount.steeringRules > 0) {
      components.push(
        `${componentCount.steeringRules} steering rule${componentCount.steeringRules > 1 ? 's' : ''}`,
      );
    }
    if (componentCount.instructions > 0) {
      components.push(
        `${componentCount.instructions} instruction${componentCount.instructions > 1 ? 's' : ''}`,
      );
    }

    // Generate description based on content
    if (components.length === 0) {
      return 'Basic configuration settings';
    }

    let description = `Configuration with ${components.join(', ')}`;

    // Add feature highlights if present
    const highlightFeatures = features.filter((f) =>
      ['git-integration', 'docker', 'kubernetes', 'mcp-servers'].includes(f),
    );

    if (highlightFeatures.length > 0) {
      description += `. Features: ${highlightFeatures.join(', ')}`;
    }

    // Truncate if too long
    if (description.length > this.MAX_DESCRIPTION_LENGTH) {
      description = `${description.substring(0, this.MAX_DESCRIPTION_LENGTH - 3)}...`;
    }

    return description;
  }

  private analyzeComponents(context: TaptikContext): ComponentAnalysis {
    const analysis: ComponentAnalysis = {
      agents: 0,
      commands: 0,
      mcpServers: 0,
      steeringRules: 0,
      instructions: 0,
    };

    const claudeCode = context.data?.claudeCode;
    if (!claudeCode) {
      return analysis;
    }

    // Analyze local components
    if (claudeCode.local) {
      this.countComponents(claudeCode.local, analysis);
    }

    // Analyze global components
    if (claudeCode.global) {
      this.countComponents(claudeCode.global, analysis);
    }

    return analysis;
  }

  private countComponents(
    data: ClaudeCodeLocalSettings | ClaudeCodeGlobalSettings,
    analysis: ComponentAnalysis,
  ): void {
    analysis.agents += data.agents?.length || 0;
    analysis.commands += data.commands?.length || 0;
    analysis.mcpServers += data.mcpServers?.servers?.length || 0;
    analysis.steeringRules += data.steeringRules?.length || 0;

    if (data.instructions) {
      if (data.instructions.global) analysis.instructions++;
      if (data.instructions.local) analysis.instructions++;
    }
  }

  private generateTags(
    context: TaptikContext,
    componentCount: ComponentAnalysis,
    features: string[],
  ): string[] {
    const tags = new Set<string>();

    // Add IDE tags
    this.addIdeTags(context, tags);

    // Add component-based tags
    this.addComponentTags(componentCount, tags);

    // Add feature tags
    features.forEach((feature) => tags.add(feature));

    // Add language and framework tags
    this.addLanguageTags(context, tags);

    // Add workflow tags
    this.addWorkflowTags(context, tags);

    // Add scope tags
    if (context.data?.claudeCode?.global) {
      tags.add('global-settings');
    }

    return Array.from(tags);
  }

  private addIdeTags(context: TaptikContext, tags: Set<string>): void {
    if (context.sourceIde) {
      tags.add(context.sourceIde);
    }

    if (context.targetIdes) {
      context.targetIdes.forEach((ide) => tags.add(ide));
      if (context.targetIdes.length > 1) {
        tags.add('multi-ide');
      }
    }
  }

  private addComponentTags(
    componentCount: ComponentAnalysis,
    tags: Set<string>,
  ): void {
    if (componentCount.agents > 0) tags.add('custom-agents');
    if (componentCount.mcpServers > 0) tags.add('mcp-enabled');
    if (componentCount.steeringRules > 0) tags.add('custom-rules');
    if (componentCount.instructions > 0) tags.add('guided-development');
  }

  private addLanguageTags(context: TaptikContext, tags: Set<string>): void {
    // Analyze steering rules
    const steeringRules = [
      ...(context.data?.claudeCode?.local?.steeringRules || []),
      ...(context.data?.claudeCode?.global?.steeringRules || []),
    ];

    const languageMap: Record<string, string[]> = {
      typescript: ['typescript', 'frontend'],
      react: ['react', 'frontend'],
      python: ['python', 'backend'],
      rust: ['rust', 'backend'],
      golang: ['golang', 'backend'],
      javascript: ['javascript', 'frontend'],
    };

    for (const rule of steeringRules) {
      const ruleLower = rule.rule?.toLowerCase();
      if (ruleLower && languageMap[ruleLower]) {
        languageMap[ruleLower].forEach((tag) => tags.add(tag));
      } else if (ruleLower) {
        tags.add(ruleLower);
      }
    }

    // Analyze commands for technology detection
    const commands = [
      ...(context.data?.claudeCode?.local?.commands || []),
      ...(context.data?.claudeCode?.global?.commands || []),
    ];

    for (const cmd of commands) {
      const cmdLower = cmd.command?.toLowerCase() || '';
      if (cmdLower.includes('npm') || cmdLower.includes('node')) {
        tags.add('nodejs');
      }
      if (cmdLower.includes('pytest')) {
        tags.add('python');
      }
      if (cmdLower.includes('cargo')) {
        tags.add('rust');
      }
    }

    // Add fullstack if both frontend and backend
    if (tags.has('frontend') && tags.has('backend')) {
      tags.add('fullstack');
    }
  }

  private addWorkflowTags(context: TaptikContext, tags: Set<string>): void {
    const commands = [
      ...(context.data?.claudeCode?.local?.commands || []),
      ...(context.data?.claudeCode?.global?.commands || []),
    ];

    const instructions = this.getAllInstructions(context).toLowerCase();

    // Testing tags
    if (this.hasTestingWorkflow(commands, instructions)) {
      tags.add('testing');
      if (this.hasCoverageWorkflow(commands)) {
        tags.add('code-quality');
      }
      if (this.hasTddWorkflow(instructions)) {
        tags.add('tdd');
      }
    }

    // CI/CD tags
    if (this.hasCiCdWorkflow(commands)) {
      tags.add('ci-cd');
      if (this.hasDeploymentWorkflow(commands)) {
        tags.add('automated-deployment');
      }
    }

    // Code quality tags
    if (this.hasCodeQualityWorkflow(commands)) {
      tags.add('code-quality');
    }

    // DevOps tags
    if (tags.has('docker') || tags.has('kubernetes')) {
      tags.add('devops');
    }
  }

  private detectFeatures(context: TaptikContext): string[] {
    const features = new Set<string>();
    const settings = context.data?.claudeCode?.local?.settings;

    // Detect settings-based features
    if (settings?.features) {
      Object.entries(settings.features).forEach(([key, value]) => {
        if (value === true) {
          const featureName = this.normalizeFeatureName(key);
          if (featureName) {
            features.add(featureName);
          }
        }
      });
    }

    // Detect component-based features
    if (
      context.data?.claudeCode?.local?.mcpServers?.servers?.length > 0 ||
      context.data?.claudeCode?.global?.mcpServers?.servers?.length > 0
    ) {
      features.add('mcp-servers');
    }

    if (
      context.data?.claudeCode?.local?.agents?.length > 0 ||
      context.data?.claudeCode?.global?.agents?.length > 0
    ) {
      features.add('custom-agents');
    }

    // Detect workflow features
    const commands = [
      ...(context.data?.claudeCode?.local?.commands || []),
      ...(context.data?.claudeCode?.global?.commands || []),
    ];

    for (const cmd of commands) {
      const cmdFeatures = this.extractFeaturesFromCommand(cmd.command);
      cmdFeatures.forEach((f) => features.add(f));
    }

    return Array.from(features);
  }

  private normalizeFeatureName(key: string): string | null {
    const featureMap: Record<string, string> = {
      gitIntegration: 'git-integration',
      dockerSupport: 'docker',
      kubernetesIntegration: 'kubernetes',
      autocomplete: 'autocomplete',
      linting: 'linting',
      formatting: 'formatting',
      debugging: 'debugging',
    };

    return featureMap[key] || null;
  }

  private extractFeaturesFromCommand(command: string | undefined): string[] {
    if (!command) return [];

    const features = new Set<string>();
    const cmdLower = command.toLowerCase();

    if (cmdLower.includes('docker')) features.add('docker');
    if (cmdLower.includes('kubectl') || cmdLower.includes('k8s'))
      features.add('kubernetes');
    if (cmdLower.includes('git')) features.add('git-integration');
    if (cmdLower.includes('test')) features.add('testing');
    if (cmdLower.includes('lint')) features.add('linting');
    if (cmdLower.includes('format')) features.add('formatting');

    return Array.from(features);
  }

  private extractTechnologiesFromCommand(
    command: string | undefined,
  ): string[] {
    if (!command) return [];

    const technologies = new Set<string>();
    const cmdLower = command.toLowerCase();

    // Check for known technology patterns
    for (const [pattern, tech] of Array.from(
      this.TECHNOLOGY_PATTERNS.entries(),
    )) {
      if (cmdLower.includes(pattern)) {
        technologies.add(tech);
      }
    }

    // Special case detections
    if (cmdLower.includes('.ts') || cmdLower.includes('.tsx')) {
      technologies.add('typescript');
    }
    if (cmdLower.includes('.py')) {
      technologies.add('python');
    }
    if (cmdLower.includes('.rs')) {
      technologies.add('rust');
    }
    if (cmdLower.includes('.go')) {
      technologies.add('golang');
    }

    return Array.from(technologies);
  }

  private generateSearchKeywords(
    context: TaptikContext,
    tags: string[],
  ): string[] {
    const keywords = new Set<string>();

    // Add base keywords
    keywords.add(context.sourceIde || 'claude-code');
    keywords.add('configuration');

    // Add all tags as keywords
    tags.forEach((tag) => keywords.add(tag));

    // Extract keywords from content
    this.extractKeywordsFromAgents(context, keywords);
    this.extractKeywordsFromCommands(context, keywords);
    this.extractKeywordsFromInstructions(context, keywords);
    this.extractKeywordsFromSteeringRules(context, keywords);

    return Array.from(keywords);
  }

  private extractKeywordsFromAgents(
    context: TaptikContext,
    keywords: Set<string>,
  ): void {
    const agents = [
      ...(context.data?.claudeCode?.local?.agents || []),
      ...(context.data?.claudeCode?.global?.agents || []),
    ];

    for (const agent of agents) {
      this.extractKeywordsFromText(agent.name, keywords);
      this.extractKeywordsFromText(agent.prompt, keywords);
    }
  }

  private extractKeywordsFromCommands(
    context: TaptikContext,
    keywords: Set<string>,
  ): void {
    const commands = [
      ...(context.data?.claudeCode?.local?.commands || []),
      ...(context.data?.claudeCode?.global?.commands || []),
    ];

    for (const cmd of commands) {
      this.extractKeywordsFromText(cmd.name, keywords);
      const technologies = this.extractTechnologiesFromCommand(cmd.command);
      technologies.forEach((tech) => keywords.add(tech));
    }
  }

  private extractKeywordsFromInstructions(
    context: TaptikContext,
    keywords: Set<string>,
  ): void {
    const instructions = [
      context.data?.claudeCode?.local?.instructions?.global,
      context.data?.claudeCode?.local?.instructions?.local,
      context.data?.claudeCode?.global?.instructions?.global,
    ].filter(Boolean);

    for (const instruction of instructions) {
      this.extractKeywordsFromText(instruction, keywords);
    }
  }

  private extractKeywordsFromSteeringRules(
    context: TaptikContext,
    keywords: Set<string>,
  ): void {
    const steeringRules = [
      ...(context.data?.claudeCode?.local?.steeringRules || []),
      ...(context.data?.claudeCode?.global?.steeringRules || []),
    ];

    for (const rule of steeringRules) {
      if (rule.rule) {
        keywords.add(rule.rule.toLowerCase());
      }
    }
  }

  private extractKeywordsFromText(
    text: string | undefined,
    keywords: Set<string>,
  ): void {
    if (!text) return;

    const textLower = text.toLowerCase();

    // Handle special cases
    if (textLower.includes('node.js') || textLower.includes('nodejs')) {
      keywords.add('nodejs');
    }
    if (textLower.includes('solid') && textLower.includes('principles')) {
      keywords.add('solid-principles');
    }

    const words = textLower
      .split(/[\s!"'(),.:;?[\]_{|}-]/g)
      .filter((word) => word.length > 2);

    for (const word of words) {
      // Check technology mapping
      const mappedTech = this.TECHNOLOGY_PATTERNS.get(word);
      if (mappedTech) {
        keywords.add(mappedTech);
      } else if (word === 'react') {
        keywords.add('react');
      } else if (word === 'redux') {
        keywords.add('redux');
      } else if (word === 'express') {
        keywords.add('express');
      } else if (word === 'typescript') {
        keywords.add('typescript');
      } else if (word.length > 3 && !this.COMMON_WORDS.has(word)) {
        keywords.add(word);
      }
    }
  }

  private isRelevantKeyword(word: string, context: string): boolean {
    // Special case handling
    if (word === 'solid' && context.toLowerCase().includes('principles')) {
      return true; // Will be added as 'solid-principles'
    }

    // Filter out too generic or too specific words
    if (word.length < 4 || word.length > 20) {
      return false;
    }

    // Check if it's not a common word
    return !this.COMMON_WORDS.has(word);
  }

  private optimizeKeywords(keywords: string[]): string[] {
    // Remove duplicates, normalize, and limit
    const uniqueKeywords = new Set<string>();

    for (const keyword of keywords) {
      const normalized = keyword.toLowerCase().trim();
      if (normalized && normalized.length > 2) {
        // Handle special cases
        if (normalized === 'solid' && keywords.includes('principles')) {
          uniqueKeywords.add('solid-principles');
        } else {
          uniqueKeywords.add(normalized);
        }
      }
    }

    // Convert to array and limit
    return Array.from(uniqueKeywords).sort().slice(0, this.MAX_KEYWORDS);
  }

  private assessComplexity(
    componentCount: ComponentAnalysis,
  ): CloudMetadata['complexityLevel'] {
    const total = Object.values(componentCount).reduce(
      (sum, count) => sum + count,
      0,
    );

    // Keep original simple logic for consistency with tests
    if (total === 0) {
      return 'minimal';
    } else if (total <= 3) {
      return 'basic';
    } else if (total <= 10) {
      return 'intermediate';
    } else if (total <= 30) {
      return 'advanced';
    } else {
      return 'expert';
    }
  }

  private detectCompatibility(
    context: TaptikContext,
    features: string[],
  ): string[] {
    const compatibility = new Set<string>();

    // IDE compatibility
    if (context.sourceIde) {
      compatibility.add(context.sourceIde);
    }
    if (context.targetIdes) {
      context.targetIdes.forEach((ide) => compatibility.add(ide));
    }

    // Feature-based compatibility
    if (features.includes('mcp-servers')) {
      compatibility.add('mcp-compatible');
    }

    if (features.includes('docker') || features.includes('kubernetes')) {
      compatibility.add('container-ready');
    }

    // Version compatibility
    const version = context.version || '1.0.0';
    const majorVersion = version.split('.')[0];
    if (majorVersion !== '1') {
      compatibility.add(`v${majorVersion}-compatible`);
    }

    return Array.from(compatibility);
  }

  // Helper methods for workflow detection
  private hasTestingWorkflow(
    commands: ClaudeCommand[],
    instructions: string,
  ): boolean {
    return (
      commands.some(
        (cmd) =>
          cmd.name?.toLowerCase().includes('test') ||
          cmd.command?.toLowerCase().includes('test'),
      ) || instructions.includes('test')
    );
  }

  private hasCoverageWorkflow(commands: ClaudeCommand[]): boolean {
    return commands.some((cmd) =>
      cmd.command?.toLowerCase().includes('coverage'),
    );
  }

  private hasTddWorkflow(instructions: string): boolean {
    return (
      instructions.includes('tdd') ||
      (instructions.includes('test') && instructions.includes('first'))
    );
  }

  private hasCiCdWorkflow(commands: ClaudeCommand[]): boolean {
    return commands.some(
      (cmd) =>
        cmd.name?.toLowerCase().includes('ci') ||
        cmd.name?.toLowerCase().includes('deploy') ||
        cmd.command?.toLowerCase().includes('ci'),
    );
  }

  private hasDeploymentWorkflow(commands: ClaudeCommand[]): boolean {
    return commands.some(
      (cmd) =>
        cmd.name?.toLowerCase().includes('deploy') ||
        cmd.command?.toLowerCase().includes('deploy'),
    );
  }

  private hasCodeQualityWorkflow(commands: ClaudeCommand[]): boolean {
    return commands.some(
      (cmd) =>
        cmd.command?.toLowerCase().includes('lint') ||
        cmd.command?.toLowerCase().includes('eslint') ||
        cmd.command?.toLowerCase().includes('prettier') ||
        cmd.command?.toLowerCase().includes('format'),
    );
  }

  private getAllInstructions(context: TaptikContext): string {
    return [
      context.data?.claudeCode?.local?.instructions?.global,
      context.data?.claudeCode?.local?.instructions?.local,
      context.data?.claudeCode?.global?.instructions?.global,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  private deduplicateAndSort(items: string[]): string[] {
    return Array.from(new Set(items)).sort();
  }
}
