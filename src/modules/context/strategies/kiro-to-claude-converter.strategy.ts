import { join } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import {
  TaptikContext,
  AIPlatform,
  KiroConfig,
  ClaudeCodeConfig,
} from '../interfaces';
import {
  IContextConverterStrategy,
  ConversionResult,
  CompatibilityReport,
  FeatureMapping,
  FeatureApproximation,
} from '../interfaces/strategy.interface';
import { FeatureMappingService } from '../services/feature-mapping.service';
import { FileSystemUtility } from '../utils/file-system.utility';

@Injectable()
export class KiroToClaudeConverterStrategy
  implements IContextConverterStrategy
{
  private readonly logger = new Logger(KiroToClaudeConverterStrategy.name);
  readonly sourcePlatform = AIPlatform.KIRO;
  readonly targetPlatform = AIPlatform.CLAUDE_CODE;

  constructor(
    private readonly featureMappingService: FeatureMappingService,
    private readonly fileSystem: FileSystemUtility,
  ) {}

  /**
   * Check if conversion is supported
   */
  canConvert(): boolean {
    return true; // Kiro to Claude Code conversion is always supported
  }

  /**
   * Convert Kiro context to Claude Code context
   */
  async convert(context: TaptikContext): Promise<ConversionResult> {
    try {
      // Validate source context
      if (!context.ide?.data?.kiro) {
        return {
          success: false,
          error: 'No Kiro configuration found in context',
        };
      }

      const kiroConfig = context.ide.data.kiro as KiroConfig;
      const convertedContext = { ...context };

      // Perform feature mapping
      const mappingResult = await this.featureMappingService.mapFeatures(
        kiroConfig,
        this.sourcePlatform,
        this.targetPlatform,
      );

      // Build Claude Code configuration
      const claudeConfig: ClaudeCodeConfig = await this.buildClaudeConfig(
        kiroConfig,
        mappingResult.mappedFeatures,
      );

      // Update context with Claude Code configuration
      convertedContext.ide = {
        ...convertedContext.ide,
        data: {
          ...convertedContext.ide.data,
          claude_code: claudeConfig,
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
   * Validate compatibility between Kiro and Claude Code
   */
  async validateCompatibility(
    context: TaptikContext,
  ): Promise<CompatibilityReport> {
    const supportedFeatures: string[] = [];
    const unsupportedFeatures: string[] = [];
    const partialSupport: any[] = [];

    if (!context.ide?.data?.kiro) {
      return {
        compatible: false,
        score: 0,
        supported_features: [],
        unsupported_features: ['No Kiro configuration found'],
        partial_support: [],
      };
    }

    const kiroConfig = context.ide.data.kiro as KiroConfig;

    // Check specs support
    if (kiroConfig.specs_path) {
      supportedFeatures.push('specs');
      partialSupport.push({
        feature: 'specs',
        support_level: 80,
        notes: 'Specs converted to CLAUDE.md instructions',
      });
    }

    // Check steering rules support
    if (kiroConfig.steering_rules) {
      supportedFeatures.push('steering_rules');
      partialSupport.push({
        feature: 'steering_rules',
        support_level: 90,
        notes: 'Steering rules converted to CLAUDE.local.md',
      });
    }

    // Check hooks support
    if (kiroConfig.hooks) {
      partialSupport.push({
        feature: 'hooks',
        support_level: 70,
        notes: 'Hooks converted to Claude custom commands',
      });
    }

    // Check MCP servers support
    if (kiroConfig.mcp_settings) {
      supportedFeatures.push('mcp_servers');
    }

    // Task templates have no direct equivalent
    if (kiroConfig.task_templates) {
      unsupportedFeatures.push('task_templates');
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
      ['mcp_settings', 'mcp_servers'],
      ['project_settings', 'settings'],
    ]);

    const approximations = new Map<string, FeatureApproximation>([
      [
        'specs_path',
        {
          source_feature: 'specs',
          target_approximation: 'CLAUDE.md instructions',
          confidence: 'high',
          notes: 'Kiro specs are converted to Claude instructions in CLAUDE.md',
        },
      ],
      [
        'steering_rules',
        {
          source_feature: 'steering_rules',
          target_approximation: 'CLAUDE.local.md custom instructions',
          confidence: 'high',
          notes: 'Steering rules become custom instructions',
        },
      ],
      [
        'hooks',
        {
          source_feature: 'hooks',
          target_approximation: 'custom commands',
          confidence: 'medium',
          notes: 'Hooks are approximated as Claude custom commands',
        },
      ],
    ]);

    const unsupported = [
      'task_templates', // No direct equivalent in Claude Code
    ];

    return {
      direct_mappings: directMappings,
      approximations,
      unsupported,
    };
  }

  /**
   * Build Claude Code configuration from Kiro config and mapped features
   */
  private async buildClaudeConfig(
    kiroConfig: KiroConfig,
    mappedFeatures: Map<string, any>,
  ): Promise<ClaudeCodeConfig> {
    const config: ClaudeCodeConfig = {};

    // Convert instructions from specs
    if (mappedFeatures.has('instructions')) {
      config.claude_md = mappedFeatures.get('instructions');
    }

    // Convert custom instructions from steering rules
    if (mappedFeatures.has('custom_instructions')) {
      config.claude_local_md = mappedFeatures.get('custom_instructions');
    }

    // Convert commands from hooks
    if (mappedFeatures.has('commands')) {
      const commands = mappedFeatures.get('commands');
      const normalizedCommands = this.normalizeCommands(commands);
      if (normalizedCommands.length > 0) {
        config.commands = normalizedCommands;
      }
    }

    // Direct mapping for MCP servers
    if (mappedFeatures.has('mcp_servers')) {
      config.mcp_servers = mappedFeatures.get('mcp_servers');
    }

    // Convert settings
    if (mappedFeatures.has('settings')) {
      config.settings = this.convertSettings(mappedFeatures.get('settings'));
    }

    // Add default Claude Code settings if not present
    if (!config.settings) {
      config.settings = this.getDefaultClaudeSettings();
    }

    return config;
  }

  /**
   * Normalize commands structure
   */
  private normalizeCommands(commands: any): any[] {
    if (Array.isArray(commands)) {
      return commands;
    }

    if (commands?.commands && Array.isArray(commands.commands)) {
      return commands.commands;
    }

    return [];
  }

  /**
   * Convert Kiro settings to Claude Code settings
   */
  private convertSettings(kiroSettings: any): any {
    const claudeSettings: any = {
      version: '1.0.0',
    };

    // Direct pass-through of settings if it's already formatted
    if (typeof kiroSettings === 'object' && !kiroSettings.project_settings) {
      Object.assign(claudeSettings, kiroSettings);
    }

    // Map project settings (from KiroProjectSettings)
    if (kiroSettings.project_settings) {
      // KiroProjectSettings doesn't directly map to ClaudeCodeSettings
      // but we can preserve them for reference
      Object.assign(claudeSettings, kiroSettings.project_settings);
    }

    // Map global settings
    if (kiroSettings.global_settings) {
      Object.assign(claudeSettings, kiroSettings.global_settings);
    }

    // Add Claude-specific defaults
    if (!claudeSettings.permissions) {
      claudeSettings.permissions = {
        defaultMode: 'acceptEdits',
      };
    }

    if (!claudeSettings.env) {
      claudeSettings.env = {};
    }

    return claudeSettings;
  }

  /**
   * Get default Claude Code settings
   */
  private getDefaultClaudeSettings(): any {
    return {
      version: '1.0.0',
      permissions: {
        defaultMode: 'acceptEdits',
        allow: [],
        deny: [],
      },
      env: {},
      includeCoAuthoredBy: false,
      cleanupPeriodDays: 14,
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

    for (const [_source, approx] of mapping.approximations) {
      if (
        mappingResult.mappedFeatures.has(
          approx.target_approximation.split(' ')[0],
        )
      ) {
        approximations.push(approx);
      }
    }

    return approximations;
  }

  /**
   * Deploy converted context to Claude Code environment
   */
  async deploy(
    context: TaptikContext,
    targetPath?: string,
  ): Promise<{ success: boolean; deployedFiles: string[]; errors?: string[] }> {
    const basePath = targetPath || process.cwd();
    const deployedFiles: string[] = [];
    const errors: string[] = [];

    if (!context.ide?.data?.claude_code) {
      return {
        success: false,
        deployedFiles: [],
        errors: ['No Claude Code configuration in context'],
      };
    }

    const claudeConfig = context.ide.data.claude_code;

    try {
      // Create .claude directory if it doesn't exist
      const claudeDir = join(basePath, '.claude');
      await this.fileSystem.ensureDirectory(claudeDir);

      // Deploy CLAUDE.md
      if (claudeConfig.claude_md) {
        const claudeMdPath = join(basePath, 'CLAUDE.md');
        await this.fileSystem.writeFile(claudeMdPath, claudeConfig.claude_md);
        deployedFiles.push('CLAUDE.md');
      }

      // Deploy CLAUDE.local.md
      if (claudeConfig.claude_local_md) {
        const claudeLocalPath = join(basePath, 'CLAUDE.local.md');
        await this.fileSystem.writeFile(
          claudeLocalPath,
          claudeConfig.claude_local_md,
        );
        deployedFiles.push('CLAUDE.local.md');
      }

      // Deploy settings
      if (claudeConfig.settings) {
        const settingsPath = join(claudeDir, 'settings.json');
        await this.fileSystem.writeJson(settingsPath, claudeConfig.settings);
        deployedFiles.push('.claude/settings.json');
      }

      // Deploy MCP servers
      if (claudeConfig.mcp_servers && claudeConfig.mcp_servers.length > 0) {
        const mcpPath = join(claudeDir, 'mcp.json');
        await this.fileSystem.writeJson(mcpPath, {
          servers: claudeConfig.mcp_servers,
        });
        deployedFiles.push('.claude/mcp.json');
      }

      // Deploy commands
      if (
        claudeConfig.commands &&
        Array.isArray(claudeConfig.commands) &&
        claudeConfig.commands.length > 0
      ) {
        const commandsPath = join(claudeDir, 'commands.json');
        await this.fileSystem.writeJson(commandsPath, {
          commands: claudeConfig.commands,
        });
        deployedFiles.push('.claude/commands.json');
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
