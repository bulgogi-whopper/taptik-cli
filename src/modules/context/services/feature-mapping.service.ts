import { Injectable, Logger } from '@nestjs/common';

import { AIPlatform } from '../interfaces';

export interface FeatureMapping {
  source: {
    platform: AIPlatform;
    feature: string;
    path?: string;
  };
  target: {
    platform: AIPlatform;
    feature: string;
    path?: string;
    transform?: (value: any) => any;
  };
  bidirectional?: boolean;
  priority?: number;
  description?: string;
}

export interface MappingResult {
  success: boolean;
  mappedFeatures: Map<string, any>;
  unmappedFeatures: string[];
  warnings: string[];
}

@Injectable()
export class FeatureMappingService {
  private readonly logger = new Logger(FeatureMappingService.name);
  private readonly mappings: Map<string, FeatureMapping[]> = new Map();

  constructor() {
    this.initializeMappings();
  }

  /**
   * Initialize platform-to-platform feature mappings
   */
  private initializeMappings(): void {
    // Kiro to Claude Code mappings
    this.addMappings('kiro-to-claude-code', [
      // Specs mapping
      {
        source: {
          platform: AIPlatform.KIRO,
          feature: 'specs',
          path: '.kiro/specs',
        },
        target: {
          platform: AIPlatform.CLAUDE_CODE,
          feature: 'instructions',
          path: 'CLAUDE.md',
          transform: this.transformKiroSpecsToClaudeInstructions.bind(this),
        },
        description: 'Convert Kiro specs to Claude instructions',
        priority: 1,
      },
      // Steering rules mapping
      {
        source: {
          platform: AIPlatform.KIRO,
          feature: 'steering',
          path: '.kiro/steering',
        },
        target: {
          platform: AIPlatform.CLAUDE_CODE,
          feature: 'custom_instructions',
          path: 'CLAUDE.local.md',
          transform: this.transformKiroSteeringToClaudeCustom.bind(this),
        },
        description:
          'Convert Kiro steering rules to Claude custom instructions',
        priority: 2,
      },
      // Hooks mapping
      {
        source: {
          platform: AIPlatform.KIRO,
          feature: 'hooks',
          path: '.kiro/hooks',
        },
        target: {
          platform: AIPlatform.CLAUDE_CODE,
          feature: 'commands',
          path: '.claude/commands.json',
          transform: this.transformKiroHooksToClaudeCommands.bind(this),
        },
        description: 'Convert Kiro hooks to Claude custom commands',
        priority: 3,
      },
      // MCP servers mapping
      {
        source: {
          platform: AIPlatform.KIRO,
          feature: 'mcp_servers',
          path: '.kiro/mcp.json',
        },
        target: {
          platform: AIPlatform.CLAUDE_CODE,
          feature: 'mcp_servers',
          path: '.claude/mcp.json',
          transform: this.transformMcpServers.bind(this),
        },
        bidirectional: true,
        description: 'Map MCP server configurations',
        priority: 4,
      },
      // Settings mapping
      {
        source: {
          platform: AIPlatform.KIRO,
          feature: 'settings',
          path: '.kiro/settings',
        },
        target: {
          platform: AIPlatform.CLAUDE_CODE,
          feature: 'settings',
          path: '.claude/settings.json',
          transform: this.transformKiroSettingsToClaude.bind(this),
        },
        description: 'Convert Kiro settings to Claude settings',
        priority: 5,
      },
    ]);

    // Claude Code to Kiro mappings
    this.addMappings('claude-code-to-kiro', [
      // CLAUDE.md to specs
      {
        source: {
          platform: AIPlatform.CLAUDE_CODE,
          feature: 'instructions',
          path: 'CLAUDE.md',
        },
        target: {
          platform: AIPlatform.KIRO,
          feature: 'specs',
          path: '.kiro/specs',
          transform: this.transformClaudeInstructionsToKiroSpecs.bind(this),
        },
        description: 'Convert Claude instructions to Kiro specs',
        priority: 1,
      },
      // CLAUDE.local.md to steering
      {
        source: {
          platform: AIPlatform.CLAUDE_CODE,
          feature: 'custom_instructions',
          path: 'CLAUDE.local.md',
        },
        target: {
          platform: AIPlatform.KIRO,
          feature: 'steering',
          path: '.kiro/steering',
          transform: this.transformClaudeCustomToKiroSteering.bind(this),
        },
        description: 'Convert Claude custom instructions to Kiro steering',
        priority: 2,
      },
      // Commands to hooks
      {
        source: {
          platform: AIPlatform.CLAUDE_CODE,
          feature: 'commands',
          path: '.claude/commands.json',
        },
        target: {
          platform: AIPlatform.KIRO,
          feature: 'hooks',
          path: '.kiro/hooks',
          transform: this.transformClaudeCommandsToKiroHooks.bind(this),
        },
        description: 'Convert Claude commands to Kiro hooks',
        priority: 3,
      },
      // Settings mapping
      {
        source: {
          platform: AIPlatform.CLAUDE_CODE,
          feature: 'settings',
          path: '.claude/settings.json',
        },
        target: {
          platform: AIPlatform.KIRO,
          feature: 'settings',
          path: '.kiro/settings',
          transform: this.transformClaudeSettingsToKiro.bind(this),
        },
        description: 'Convert Claude settings to Kiro settings',
        priority: 5,
      },
    ]);

    // Kiro to Cursor mappings
    this.addMappings('kiro-to-cursor', [
      {
        source: {
          platform: AIPlatform.KIRO,
          feature: 'steering',
          path: '.kiro/steering',
        },
        target: {
          platform: AIPlatform.CURSOR,
          feature: 'rules',
          path: '.cursorrules',
          transform: this.transformKiroSteeringToCursorRules.bind(this),
        },
        description: 'Convert Kiro steering to Cursor rules',
        priority: 1,
      },
    ]);

    // Cursor to Kiro mappings
    this.addMappings('cursor-to-kiro', [
      {
        source: {
          platform: AIPlatform.CURSOR,
          feature: 'rules',
          path: '.cursorrules',
        },
        target: {
          platform: AIPlatform.KIRO,
          feature: 'steering',
          path: '.kiro/steering',
          transform: this.transformCursorRulesToKiroSteering.bind(this),
        },
        description: 'Convert Cursor rules to Kiro steering',
        priority: 1,
      },
    ]);
  }

  /**
   * Add mappings to the registry
   */
  private addMappings(key: string, mappings: FeatureMapping[]): void {
    this.mappings.set(key, mappings);
  }

  /**
   * Get mappings for a specific conversion
   */
  getMappings(
    sourcePlatform: AIPlatform,
    targetPlatform: AIPlatform,
  ): FeatureMapping[] {
    // Build the key from the platform values
    const key = `${sourcePlatform}-to-${targetPlatform}`;
    return this.mappings.get(key) || [];
  }

  /**
   * Map features from source to target platform
   */
  async mapFeatures(
    sourceData: any,
    sourcePlatform: AIPlatform,
    targetPlatform: AIPlatform,
  ): Promise<MappingResult> {
    const mappings = this.getMappings(sourcePlatform, targetPlatform);
    const mappedFeatures = new Map<string, any>();
    const unmappedFeatures: string[] = [];
    const warnings: string[] = [];

    // Sort mappings by priority
    const sortedMappings = [...mappings].sort(
      (a, b) => (a.priority || 999) - (b.priority || 999),
    );

    // Process each mapping
    for (const mapping of sortedMappings) {
      try {
        const sourceValue = this.extractFeatureValue(
          sourceData,
          mapping.source.feature,
        );

        if (sourceValue !== undefined && sourceValue !== null) {
          const targetValue = mapping.target.transform
            ? await mapping.target.transform(sourceValue)
            : sourceValue;

          if (targetValue !== undefined) {
            mappedFeatures.set(mapping.target.feature, targetValue);
            this.logger.debug(
              `Mapped ${mapping.source.feature} to ${mapping.target.feature}`,
            );
          }
        } else {
          unmappedFeatures.push(mapping.source.feature);
        }
      } catch (error) {
        warnings.push(
          `Failed to map ${mapping.source.feature}: ${error.message}`,
        );
        this.logger.warn(
          `Mapping error for ${mapping.source.feature}: ${error.message}`,
        );
      }
    }

    return {
      success: mappedFeatures.size > 0,
      mappedFeatures,
      unmappedFeatures,
      warnings,
    };
  }

  /**
   * Extract feature value from source data
   */
  private extractFeatureValue(data: any, feature: string): any {
    // Navigate through nested properties
    const parts = feature.split('.');
    let current = data;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Transform Kiro specs to Claude instructions
   */
  private async transformKiroSpecsToClaudeInstructions(
    specs: any,
  ): Promise<string> {
    const sections: string[] = ['# Project Instructions\n'];

    if (Array.isArray(specs)) {
      for (const spec of specs) {
        sections.push(`## ${spec.name}\n`);
        if (spec.design) sections.push(`### Design\n${spec.design}\n`);
        if (spec.requirements)
          sections.push(`### Requirements\n${spec.requirements}\n`);
        if (spec.tasks) sections.push(`### Tasks\n${spec.tasks}\n`);
      }
    } else if (typeof specs === 'object') {
      for (const [name, content] of Object.entries(specs)) {
        sections.push(`## ${name}\n${content}\n`);
      }
    }

    return sections.join('\n');
  }

  /**
   * Transform Kiro steering to Claude custom instructions
   */
  private async transformKiroSteeringToClaudeCustom(
    steering: any,
  ): Promise<string> {
    const sections: string[] = ['# Custom Instructions\n'];

    if (Array.isArray(steering)) {
      for (const rule of steering) {
        if (rule.content) {
          sections.push(rule.content);
        }
      }
    } else if (typeof steering === 'object') {
      for (const [name, content] of Object.entries(steering)) {
        sections.push(`## ${name}\n${content}\n`);
      }
    }

    return sections.join('\n');
  }

  /**
   * Transform Kiro hooks to Claude commands
   */
  private async transformKiroHooksToClaudeCommands(hooks: any): Promise<any> {
    const commands: any[] = [];

    if (Array.isArray(hooks)) {
      for (const hook of hooks) {
        commands.push({
          name: hook.name || hook.event,
          command: hook.command || hook.script,
          description: hook.description,
          trigger: hook.event,
        });
      }
    }

    return { commands };
  }

  /**
   * Transform MCP servers (bidirectional)
   */
  private async transformMcpServers(servers: any): Promise<any> {
    // MCP servers have similar structure, minimal transformation needed
    return servers;
  }

  /**
   * Transform Kiro settings to Claude settings
   */
  private async transformKiroSettingsToClaude(settings: any): Promise<any> {
    return {
      version: '1.0.0',
      ...settings,
      // Map specific Kiro settings to Claude equivalents
      features: this.mapKiroFeaturesToClaude(settings.features),
    };
  }

  /**
   * Transform Claude instructions to Kiro specs
   */
  private async transformClaudeInstructionsToKiroSpecs(
    instructions: string,
  ): Promise<any> {
    const specs: any[] = [];

    // Parse markdown sections
    const sections = instructions.split(/^## /m).filter((s) => s.trim());

    for (const section of sections) {
      const lines = section.split('\n');
      const name = lines[0]?.trim() || 'unnamed';
      const content = lines.slice(1).join('\n').trim();

      specs.push({
        name,
        content,
        type: 'instruction',
      });
    }

    return specs;
  }

  /**
   * Transform Claude custom instructions to Kiro steering
   */
  private async transformClaudeCustomToKiroSteering(
    custom: string,
  ): Promise<any> {
    const steering: any[] = [];

    // Parse markdown sections
    const sections = custom.split(/^## /m).filter((s) => s.trim());

    for (const section of sections) {
      const lines = section.split('\n');
      const name = lines[0]?.trim() || 'unnamed';
      const content = lines.slice(1).join('\n').trim();

      steering.push({
        name,
        content,
        type: 'custom_instruction',
      });
    }

    return steering;
  }

  /**
   * Transform Claude commands to Kiro hooks
   */
  private async transformClaudeCommandsToKiroHooks(
    commands: any,
  ): Promise<any> {
    const hooks: any[] = [];

    if (commands?.commands && Array.isArray(commands.commands)) {
      for (const cmd of commands.commands) {
        hooks.push({
          name: cmd.name,
          event: cmd.trigger || 'manual',
          command: cmd.command,
          description: cmd.description,
        });
      }
    }

    return hooks;
  }

  /**
   * Transform Claude settings to Kiro settings
   */
  private async transformClaudeSettingsToKiro(settings: any): Promise<any> {
    return {
      version: settings.version || '1.0.0',
      ...settings,
      features: this.mapClaudeFeaturesToKiro(settings.features),
    };
  }

  /**
   * Transform Kiro steering to Cursor rules
   */
  private async transformKiroSteeringToCursorRules(
    steering: any,
  ): Promise<string> {
    const rules: string[] = [];

    if (Array.isArray(steering)) {
      for (const rule of steering) {
        if (rule.content) {
          rules.push(rule.content);
        }
      }
    }

    return rules.join('\n\n');
  }

  /**
   * Transform Cursor rules to Kiro steering
   */
  private async transformCursorRulesToKiroSteering(
    rules: string,
  ): Promise<any> {
    return [
      {
        name: 'cursor-rules',
        content: rules,
        type: 'imported',
        source: 'cursor',
      },
    ];
  }

  /**
   * Map Kiro features to Claude features
   */
  private mapKiroFeaturesToClaude(features: any): any {
    if (!features) return {};

    return {
      ...features,
      // Add specific feature mappings here
    };
  }

  /**
   * Map Claude features to Kiro features
   */
  private mapClaudeFeaturesToKiro(features: any): any {
    if (!features) return {};

    return {
      ...features,
      // Add specific feature mappings here
    };
  }

  /**
   * Get reverse mapping for bidirectional features
   */
  getReverseMapping(mapping: FeatureMapping): FeatureMapping | null {
    if (!mapping.bidirectional) return null;

    return {
      source: mapping.target,
      target: mapping.source,
      bidirectional: true,
      priority: mapping.priority,
      description: `Reverse: ${mapping.description}`,
    };
  }

  /**
   * Validate mapping compatibility
   */
  validateMapping(
    sourcePlatform: AIPlatform,
    targetPlatform: AIPlatform,
  ): { valid: boolean; errors: string[] } {
    const mappings = this.getMappings(sourcePlatform, targetPlatform);
    const errors: string[] = [];

    if (mappings.length === 0) {
      errors.push(
        `No mappings defined for ${sourcePlatform} to ${targetPlatform}`,
      );
    }

    // Check for required mappings
    const requiredFeatures = ['settings', 'mcp_servers'];
    for (const feature of requiredFeatures) {
      const hasMapping = mappings.some((m) => m.source.feature === feature);
      if (!hasMapping) {
        this.logger.warn(`No mapping for required feature: ${feature}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
