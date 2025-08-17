/* eslint-disable unicorn/no-thenable */
import { join } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import {
  TaptikContext,
  AIPlatform,
  KiroConfig,
  ClaudeCodeConfig,
  SteeringRule,
  Hook,
} from '../interfaces';
import {
  IContextConverterStrategy,
  ConversionResult,
  CompatibilityReport,
  FeatureMapping,
  FeatureApproximation,
} from '../interfaces/strategy.interface';
import { ReverseMappingService } from '../services/reverse-mapping.service';
import { FileSystemUtility } from '../utils/file-system.utility';

@Injectable()
export class ClaudeToKiroConverterStrategy
  implements IContextConverterStrategy
{
  private readonly logger = new Logger(ClaudeToKiroConverterStrategy.name);
  readonly sourcePlatform = AIPlatform.CLAUDE_CODE;
  readonly targetPlatform = AIPlatform.KIRO;

  constructor(
    private readonly reverseFeatureMappingService: ReverseMappingService,
    private readonly fileSystem: FileSystemUtility,
  ) {}

  /**
   * Check if conversion is supported
   */
  canConvert(): boolean {
    return true; // Claude Code to Kiro conversion is always supported
  }

  /**
   * Convert Claude Code context to Kiro context
   */
  async convert(context: TaptikContext): Promise<ConversionResult> {
    try {
      // Validate source context
      if (!context.ide?.data?.claude_code) {
        return {
          success: false,
          error: 'No Claude Code configuration found in context',
        };
      }

      const claudeConfig = context.ide.data.claude_code as ClaudeCodeConfig;
      const convertedContext = { ...context };

      // Perform reverse feature mapping
      const mappingResult = await this.reverseFeatureMappingService.reverseMap(
        claudeConfig,
        this.sourcePlatform,
        this.targetPlatform,
      );

      // Build Kiro configuration
      const kiroConfig: KiroConfig = await this.buildKiroConfig(
        claudeConfig,
        mappingResult.reversedFeatures || mappingResult.mappedFeatures,
      );

      // Update context with Kiro configuration
      convertedContext.ide = {
        ...convertedContext.ide,
        data: {
          ...convertedContext.ide.data,
          kiro: kiroConfig,
        },
      };

      // Update metadata
      convertedContext.metadata = {
        ...convertedContext.metadata,
        platforms: [this.targetPlatform],
        conversion: {
          source: this.sourcePlatform,
          target: this.targetPlatform,
          timestamp: new Date().toISOString(),
        },
      };

      return {
        success: true,
        context: convertedContext,
        warnings: mappingResult.warnings,
        unsupported_features: mappingResult.unmappedFeatures,
        approximations: this.getApproximations(mappingResult),
      };
    } catch (error) {
      this.logger.error(`Conversion failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Validate compatibility between Claude Code and Kiro
   */
  async validateCompatibility(
    context: TaptikContext,
  ): Promise<CompatibilityReport> {
    const supportedFeatures: string[] = [];
    const unsupportedFeatures: string[] = [];
    const partialSupport: any[] = [];

    if (!context.ide?.data?.claude_code) {
      return {
        compatible: false,
        score: 0,
        supported_features: [],
        unsupported_features: ['No Claude Code configuration found'],
        partial_support: [],
      };
    }

    const claudeConfig = context.ide.data.claude_code as ClaudeCodeConfig;

    // Check CLAUDE.md support
    if (claudeConfig.claude_md) {
      supportedFeatures.push('instructions');
      partialSupport.push({
        feature: 'instructions',
        support_level: 85,
        notes: 'CLAUDE.md converted to Kiro specs structure',
      });
    }

    // Check CLAUDE.local.md support
    if (claudeConfig.claude_local_md) {
      supportedFeatures.push('custom_instructions');
      partialSupport.push({
        feature: 'custom_instructions',
        support_level: 90,
        notes: 'CLAUDE.local.md converted to steering rules',
      });
    }

    // Check commands support
    if (claudeConfig.commands) {
      partialSupport.push({
        feature: 'commands',
        support_level: 75,
        notes: 'Commands converted to Kiro hooks',
      });
    }

    // Check MCP servers support
    if (claudeConfig.mcp_servers || claudeConfig.mcp) {
      supportedFeatures.push('mcp_servers');
    }

    // Settings have partial support
    if (claudeConfig.settings) {
      partialSupport.push({
        feature: 'settings',
        support_level: 60,
        notes: 'Settings partially mapped to Kiro project settings',
      });
    }

    const score = this.calculateCompatibilityScore(
      supportedFeatures,
      unsupportedFeatures,
      partialSupport,
    );

    return {
      compatible: score >= 60,
      score,
      supported_features: supportedFeatures,
      unsupported_features: unsupportedFeatures,
      partial_support: partialSupport,
    };
  }

  /**
   * Get feature mapping between platforms
   */
  getFeatureMapping(): FeatureMapping {
    const directMappings = new Map<string, string>([
      ['mcp_servers', 'mcp_settings'],
      ['mcp', 'mcp_settings'],
    ]);

    const approximations = new Map<string, FeatureApproximation>([
      [
        'claude_md',
        {
          source_feature: 'instructions',
          target_approximation: 'Kiro specs',
          confidence: 'high',
          notes: 'CLAUDE.md instructions converted to structured specs',
        },
      ],
      [
        'claude_local_md',
        {
          source_feature: 'custom_instructions',
          target_approximation: 'steering rules',
          confidence: 'high',
          notes: 'Custom instructions become steering rules',
        },
      ],
      [
        'commands',
        {
          source_feature: 'commands',
          target_approximation: 'hooks',
          confidence: 'medium',
          notes: 'Commands are approximated as Kiro hooks',
        },
      ],
      [
        'settings',
        {
          source_feature: 'settings',
          target_approximation: 'project_settings',
          confidence: 'low',
          notes: 'Settings partially mapped to project settings',
        },
      ],
    ]);

    const unsupported = [
      'permissions', // Kiro doesn't have direct permission model
      'env', // Environment variables handled differently
      'statusLine', // No direct equivalent in Kiro
    ];

    return {
      direct_mappings: directMappings,
      approximations,
      unsupported,
    };
  }

  /**
   * Build Kiro configuration from Claude Code config and mapped features
   */
  private async buildKiroConfig(
    claudeConfig: ClaudeCodeConfig,
    mappedFeatures: Map<string, any>,
  ): Promise<KiroConfig> {
    const config: KiroConfig = {
      specs_path: '.kiro/specs',
    };

    // Convert CLAUDE.md to specs
    if (mappedFeatures.has('specs')) {
      // Specs will be written to files during deployment
      config.specs_path = '.kiro/specs';
    }

    // Convert CLAUDE.local.md to steering rules
    if (mappedFeatures.has('steering_rules')) {
      config.steering_rules = this.convertToSteeringRules(
        mappedFeatures.get('steering_rules'),
      );
    }

    // Convert commands to hooks
    if (mappedFeatures.has('hooks')) {
      config.hooks = this.convertToHooks(mappedFeatures.get('hooks'));
    }

    // Direct mapping for MCP servers
    if (mappedFeatures.has('mcp_settings')) {
      config.mcp_settings = mappedFeatures.get('mcp_settings');
    }

    // Convert settings to project settings
    if (mappedFeatures.has('project_settings')) {
      config.project_settings = this.convertToProjectSettings(
        mappedFeatures.get('project_settings'),
      );
    }

    // Add default Kiro settings if not present
    if (!config.project_settings) {
      config.project_settings = this.getDefaultKiroSettings();
    }

    return config;
  }

  /**
   * Convert steering rules from mapped features
   */
  private convertToSteeringRules(steeringData: any): SteeringRule[] {
    if (typeof steeringData === 'string') {
      // Parse markdown content into steering rules
      const rules = this.parseMarkdownToRules(steeringData);
      return rules;
    }

    if (Array.isArray(steeringData)) {
      return steeringData.map((rule) => ({
        name: rule.name || 'unnamed',
        description: rule.description,
        rules: Array.isArray(rule.rules) ? rule.rules : [rule.content || ''],
        priority: rule.priority || 0,
      }));
    }

    return [];
  }

  /**
   * Parse markdown content into steering rules
   */
  private parseMarkdownToRules(markdown: string): SteeringRule[] {
    const rules: SteeringRule[] = [];
    const sections = markdown.split(/^##\s+/m).filter((s) => s.trim());

    for (const section of sections) {
      const lines = section.split('\n');
      const name = lines[0].trim();
      const content = lines.slice(1).join('\n').trim();

      if (name && content) {
        rules.push({
          name: name.toLowerCase().replaceAll(/\s+/g, '_'),
          description: name,
          rules: [content],
          priority: 0,
        });
      }
    }

    return rules;
  }

  /**
   * Convert commands to hooks
   */
  private convertToHooks(commandsData: any): Hook[] {
    const hooks: Hook[] = [];

    if (Array.isArray(commandsData)) {
      for (const cmd of commandsData) {
        hooks.push({
          name: cmd.name || 'unnamed',
          enabled: true,
          description: cmd.description || `Command: ${cmd.command}`,
          version: '1.0.0',
          when: {
            type: 'manual',
            patterns: [],
          },
          then: {
            type: 'command',
            command: cmd.command,
          },
        });
      }
    } else if (typeof commandsData === 'object') {
      // Handle Record<string, string> format
      for (const [name, command] of Object.entries(commandsData)) {
        if (typeof command === 'string') {
          hooks.push({
            name,
            enabled: true,
            description: `Command: ${command}`,
            version: '1.0.0',
            when: {
              type: 'manual',
              patterns: [],
            },
            then: {
              type: 'command',
              command,
            },
          });
        }
      }
    }

    return hooks;
  }

  /**
   * Convert Claude settings to Kiro project settings
   */
  private convertToProjectSettings(settingsData: any): any {
    const kiroSettings: any = {
      specification_driven: true, // Default for Kiro
      auto_test: false,
      incremental_progress: true,
      task_confirmation: true,
    };

    // Map relevant Claude settings
    if (
      settingsData && // Extract any relevant settings that map to Kiro
      settingsData.includeCoAuthoredBy === false
    ) {
      kiroSettings.auto_attribution = false;
    }

    // Add any custom mappings as needed

    return kiroSettings;
  }

  /**
   * Get default Kiro settings
   */
  private getDefaultKiroSettings(): any {
    return {
      specification_driven: true,
      auto_test: true,
      incremental_progress: true,
      task_confirmation: true,
    };
  }

  /**
   * Calculate compatibility score
   */
  private calculateCompatibilityScore(
    supported: string[],
    unsupported: string[],
    partial: any[],
  ): number {
    const totalFeatures =
      supported.length + unsupported.length + partial.length;

    if (totalFeatures === 0) {
      return 0;
    }

    let score = 0;

    // Full support contributes 100%
    score += supported.length * 100;

    // Partial support contributes based on support level
    for (const p of partial) {
      score += p.support_level || 50;
    }

    // Unsupported features contribute 0%

    return Math.round(score / totalFeatures);
  }

  /**
   * Get approximations from mapping result
   */
  private getApproximations(mappingResult: any): FeatureApproximation[] {
    const approximations: FeatureApproximation[] = [];
    const mapping = this.getFeatureMapping();
    const features =
      mappingResult.reversedFeatures || mappingResult.mappedFeatures;

    for (const [, approx] of mapping.approximations) {
      if (features.has(approx.target_approximation.split(' ')[0])) {
        approximations.push(approx);
      }
    }

    return approximations;
  }

  /**
   * Deploy converted context to Kiro environment
   */
  async deploy(
    context: TaptikContext,
    targetPath?: string,
  ): Promise<{ success: boolean; deployedFiles: string[]; errors?: string[] }> {
    const basePath = targetPath || process.cwd();
    const deployedFiles: string[] = [];
    const errors: string[] = [];

    if (!context.ide?.data?.kiro) {
      return {
        success: false,
        deployedFiles: [],
        errors: ['No Kiro configuration in context'],
      };
    }

    const kiroConfig = context.ide.data.kiro;

    try {
      // Create .kiro directory structure
      const kiroDir = join(basePath, '.kiro');
      await this.fileSystem.ensureDirectory(kiroDir);
      await this.fileSystem.ensureDirectory(join(kiroDir, 'specs'));
      await this.fileSystem.ensureDirectory(join(kiroDir, 'steering'));
      await this.fileSystem.ensureDirectory(join(kiroDir, 'hooks'));
      await this.fileSystem.ensureDirectory(join(kiroDir, 'settings'));

      // Deploy specs (from CLAUDE.md conversion)
      if (context.project?.data?.claude_instructions) {
        const specsPath = join(kiroDir, 'specs', 'requirements.md');
        await this.fileSystem.writeFile(
          specsPath,
          `# Requirements\n\n${context.project.data.claude_instructions}`,
        );
        deployedFiles.push('.kiro/specs/requirements.md');
      }

      // Deploy steering rules
      if (
        kiroConfig.steering_rules &&
        Array.isArray(kiroConfig.steering_rules)
      ) {
        for (const rule of kiroConfig.steering_rules) {
          const typedRule = rule as SteeringRule;
          const rulePath = join(kiroDir, 'steering', `${typedRule.name}.md`);
          const content = `# ${typedRule.description || typedRule.name}\n\n${typedRule.rules.join('\n\n')}`;
          await this.fileSystem.writeFile(rulePath, content);
          deployedFiles.push(`.kiro/steering/${typedRule.name}.md`);
        }
      }

      // Deploy hooks
      if (kiroConfig.hooks && kiroConfig.hooks.length > 0) {
        const hooksPath = join(kiroDir, 'hooks', 'hooks.json');
        await this.fileSystem.writeJson(hooksPath, { hooks: kiroConfig.hooks });
        deployedFiles.push('.kiro/hooks/hooks.json');
      }

      // Deploy MCP settings
      if (kiroConfig.mcp_settings) {
        const mcpPath = join(kiroDir, 'settings', 'mcp.json');
        await this.fileSystem.writeJson(mcpPath, kiroConfig.mcp_settings);
        deployedFiles.push('.kiro/settings/mcp.json');
      }

      // Deploy project settings
      if (kiroConfig.project_settings) {
        const settingsPath = join(kiroDir, 'settings', 'project.json');
        await this.fileSystem.writeJson(
          settingsPath,
          kiroConfig.project_settings,
        );
        deployedFiles.push('.kiro/settings/project.json');
      }

      return {
        success: true,
        deployedFiles,
      };
    } catch (error) {
      errors.push(error.message);
      return {
        success: false,
        deployedFiles,
        errors,
      };
    }
  }
}
