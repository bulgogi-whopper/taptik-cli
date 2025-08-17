import { Injectable, Logger } from '@nestjs/common';

import { AIPlatform } from '../interfaces';

import {
  FeatureMappingService,
  FeatureMapping,
  MappingResult,
} from './feature-mapping.service';

export interface ReverseMappingOptions {
  preserveOriginal?: boolean;
  mergeStrategy?: 'replace' | 'merge' | 'append';
  validateIntegrity?: boolean;
  customTransforms?: Map<string, (value: any) => any>;
}

export interface ReverseMappingResult extends MappingResult {
  reversedFeatures: Map<string, any>;
  conflicts: Map<string, string>;
  metadata: {
    originalPlatform: AIPlatform;
    targetPlatform: AIPlatform;
    timestamp: string;
    reversible: boolean;
  };
}

@Injectable()
export class ReverseMappingService {
  private readonly logger = new Logger(ReverseMappingService.name);
  private readonly reverseMappingCache = new Map<string, FeatureMapping[]>();

  constructor(private readonly featureMappingService: FeatureMappingService) {
    this.initializeReverseMappings();
  }

  /**
   * Initialize reverse mappings for all bidirectional features
   */
  private initializeReverseMappings(): void {
    const platforms = [
      AIPlatform.KIRO,
      AIPlatform.CLAUDE_CODE,
      AIPlatform.CURSOR,
    ];

    for (const source of platforms) {
      for (const target of platforms) {
        if (source === target) continue;

        const mappings = this.featureMappingService.getMappings(source, target);
        const reverseMappings: FeatureMapping[] = [];

        for (const mapping of mappings) {
          if (mapping.bidirectional) {
            const reverse = this.createReverseMapping(mapping);
            if (reverse) {
              reverseMappings.push(reverse);
            }
          }
        }

        if (reverseMappings.length > 0) {
          const key = `${target}-to-${source}`;
          this.reverseMappingCache.set(key, reverseMappings);
        }
      }
    }
  }

  /**
   * Create a reverse mapping from an existing mapping
   */
  private createReverseMapping(mapping: FeatureMapping): FeatureMapping | null {
    try {
      return {
        source: {
          platform: mapping.target.platform,
          feature: mapping.target.feature,
          path: mapping.target.path,
        },
        target: {
          platform: mapping.source.platform,
          feature: mapping.source.feature,
          path: mapping.source.path,
          transform: this.createReverseTransform(mapping),
        },
        bidirectional: true,
        priority: mapping.priority,
        description: `[Reverse] ${mapping.description}`,
      };
    } catch (error) {
      this.logger.warn(`Failed to create reverse mapping: ${error.message}`);
      return null;
    }
  }

  /**
   * Create a reverse transform function
   */
  private createReverseTransform(
    mapping: FeatureMapping,
  ): ((value: any) => any) | undefined {
    // Special handling for specific feature types
    const featureType = mapping.source.feature;

    switch (featureType) {
      case 'specs':
        return this.createSpecsReverseTransform();
      case 'steering':
        return this.createSteeringReverseTransform();
      case 'hooks':
        return this.createHooksReverseTransform();
      case 'mcp_servers':
        // MCP servers are already bidirectional, no special transform needed
        return undefined;
      default:
        return mapping.target.transform
          ? this.createGenericReverseTransform(mapping.target.transform)
          : undefined;
    }
  }

  /**
   * Create reverse transform for specs
   */
  private createSpecsReverseTransform(): (value: any) => any {
    return (value: any) => {
      if (typeof value === 'string') {
        // Parse CLAUDE.md format back to Kiro specs
        const specs: any[] = [];
        const sections = value.split(/^## /m).filter((s) => s.trim());

        for (const section of sections) {
          const lines = section.split('\n');
          const name = lines[0]?.trim();

          if (name && name !== 'Project Instructions') {
            const content = lines.slice(1).join('\n').trim();
            const spec: any = { name };

            // Parse subsections
            const designMatch = content.match(
              /### Design\n([\S\s]*?)(?=###|$)/,
            );
            const requirementsMatch = content.match(
              /### Requirements\n([\S\s]*?)(?=###|$)/,
            );
            const tasksMatch = content.match(/### Tasks\n([\S\s]*?)(?=###|$)/);

            if (designMatch) spec.design = designMatch[1].trim();
            if (requirementsMatch)
              spec.requirements = requirementsMatch[1].trim();
            if (tasksMatch) spec.tasks = tasksMatch[1].trim();

            specs.push(spec);
          }
        }

        return specs;
      }
      return value;
    };
  }

  /**
   * Create reverse transform for steering rules
   */
  private createSteeringReverseTransform(): (value: any) => any {
    return (value: any) => {
      if (typeof value === 'string') {
        // Parse custom instructions back to steering rules
        const rules: any[] = [];
        const sections = value.split(/^## /m).filter((s) => s.trim());

        for (const section of sections) {
          const lines = section.split('\n');
          const name = lines[0]?.trim();

          if (name && name !== 'Custom Instructions') {
            const content = lines.slice(1).join('\n').trim();
            rules.push({
              name: name || 'unnamed-rule',
              content,
              type: 'steering',
            });
          } else if (name === 'Custom Instructions' && lines.length > 1) {
            // Handle content without section headers
            const content = lines.slice(1).join('\n').trim();
            if (content) {
              rules.push({
                name: 'custom-instructions',
                content,
                type: 'steering',
              });
            }
          }
        }

        // If no sections found, treat entire content as a single rule
        if (rules.length === 0 && value.trim()) {
          rules.push({
            name: 'imported-rules',
            content: value.trim(),
            type: 'steering',
          });
        }

        return rules;
      }
      return value;
    };
  }

  /**
   * Create reverse transform for hooks
   */
  private createHooksReverseTransform(): (value: any) => any {
    return (value: any) => {
      if (value?.commands && Array.isArray(value.commands)) {
        // Transform Claude commands back to Kiro hooks
        return value.commands.map((cmd: any) => ({
          name: cmd.name,
          event: cmd.trigger || cmd.event || 'manual',
          command: cmd.command,
          description: cmd.description,
          enabled: true,
        }));
      }
      return value;
    };
  }

  /**
   * Create a generic reverse transform
   */
  private createGenericReverseTransform(
    _originalTransform: (value: unknown) => unknown,
  ): (value: unknown) => unknown {
    return (value: unknown) => {
      // Attempt to reverse the transformation
      // This is a best-effort approach for generic transforms
      try {
        // For simple value transformations, try to detect patterns
        if (typeof value === 'object' && value !== null) {
          return this.reverseObjectTransform(value);
        }
        return value;
      } catch (error) {
        this.logger.debug(`Generic reverse transform failed: ${error.message}`);
        return value;
      }
    };
  }

  /**
   * Check if a feature mapping is reversible
   */
  isReversible(sourceFeature: string, targetFeature: string): boolean {
    // For bidirectional features like mcp_servers and settings
    const bidirectionalFeatures = new Set(['mcp_servers', 'settings']);
    if (
      bidirectionalFeatures.has(sourceFeature) &&
      bidirectionalFeatures.has(targetFeature)
    ) {
      return true;
    }

    // Check specific reversible mappings
    const reversibleMappings = new Map([
      ['specs->instructions', true],
      ['instructions->specs', true],
      ['steering->custom_instructions', true],
      ['custom_instructions->steering', true],
      ['hooks->commands', true],
      ['commands->hooks', true],
      ['steering->rules', true],
      ['rules->steering', true],
    ]);

    const mappingKey = `${sourceFeature}->${targetFeature}`;
    if (reversibleMappings.has(mappingKey)) {
      return true;
    }

    // Log for debugging
    this.logger.debug(`Feature ${sourceFeature} is not reversible`);
    return false;
  }

  /**
   * Reverse object transformations
   */
  private reverseObjectTransform(object: any): any {
    const reversed: any = {};

    for (const [key, value] of Object.entries(object)) {
      // Handle common transformation patterns
      if (key.includes('_')) {
        // Convert snake_case back to camelCase
        const camelKey = key.replaceAll(/_([a-z])/g, (_, letter) =>
          letter.toUpperCase(),
        );
        reversed[camelKey] = value;
      } else if (/[A-Z]/.test(key)) {
        // Convert camelCase to snake_case
        const snakeKey = key.replaceAll(
          /[A-Z]/g,
          (letter) => `_${letter.toLowerCase()}`,
        );
        reversed[snakeKey] = value;
      } else {
        reversed[key] = value;
      }
    }

    return reversed;
  }

  /**
   * Perform reverse mapping with options
   */
  async reverseMap(
    data: any,
    sourcePlatform: AIPlatform,
    targetPlatform: AIPlatform,
    options?: ReverseMappingOptions,
  ): Promise<ReverseMappingResult> {
    const _startTime = Date.now();

    // First try cached reverse mappings
    const cacheKey = `${sourcePlatform}-to-${targetPlatform}`;
    let mappings = this.reverseMappingCache.get(cacheKey);

    // If no cached reverse mappings, try to get direct mappings
    if (!mappings || mappings.length === 0) {
      mappings = this.featureMappingService.getMappings(
        sourcePlatform,
        targetPlatform,
      );
    }

    // Perform the mapping
    const baseResult = await this.featureMappingService.mapFeatures(
      data,
      sourcePlatform,
      targetPlatform,
    );

    // Apply reverse-specific logic
    const reversedFeatures = new Map<string, any>();
    const conflicts = new Map<string, string>();

    for (const [feature, value] of baseResult.mappedFeatures) {
      try {
        let processedValue = value;

        // Apply custom transforms if provided
        if (options?.customTransforms?.has(feature)) {
          const customTransform = options.customTransforms.get(feature);
          processedValue = customTransform!(value);
        }

        // Handle merge strategy
        if (
          options?.mergeStrategy === 'merge' &&
          reversedFeatures.has(feature)
        ) {
          const existing = reversedFeatures.get(feature);
          processedValue = this.mergeValues(existing, processedValue);
        } else if (
          options?.mergeStrategy === 'append' &&
          reversedFeatures.has(feature)
        ) {
          const existing = reversedFeatures.get(feature);
          processedValue = this.appendValues(existing, processedValue);
        }

        reversedFeatures.set(feature, processedValue);

        // Validate integrity if requested
        if (options?.validateIntegrity) {
          const isValid = await this.validateFeatureIntegrity(
            feature,
            processedValue,
            targetPlatform,
          );
          if (!isValid) {
            conflicts.set(feature, 'Failed integrity validation');
          }
        }
      } catch (error) {
        conflicts.set(feature, error.message);
        this.logger.warn(
          `Reverse mapping conflict for ${feature}: ${error.message}`,
        );
      }
    }

    // Check reversibility
    const reversible = await this.checkReversibility(
      data,
      reversedFeatures,
      sourcePlatform,
      targetPlatform,
    );

    return {
      ...baseResult,
      reversedFeatures,
      conflicts,
      metadata: {
        originalPlatform: sourcePlatform,
        targetPlatform,
        timestamp: new Date().toISOString(),
        reversible,
      },
    };
  }

  /**
   * Merge two values based on their types
   */
  private mergeValues(existing: any, newValue: any): any {
    if (Array.isArray(existing) && Array.isArray(newValue)) {
      return [...existing, ...newValue];
    }

    if (typeof existing === 'object' && typeof newValue === 'object') {
      return { ...existing, ...newValue };
    }

    // For primitives, prefer new value
    return newValue;
  }

  /**
   * Append values
   */
  private appendValues(existing: any, newValue: any): any {
    if (Array.isArray(existing)) {
      return Array.isArray(newValue)
        ? [...existing, ...newValue]
        : [...existing, newValue];
    }

    if (typeof existing === 'string' && typeof newValue === 'string') {
      return `${existing}\n\n${newValue}`;
    }

    return [existing, newValue];
  }

  /**
   * Validate feature integrity for target platform
   */
  private async validateFeatureIntegrity(
    feature: string,
    value: any,
    platform: AIPlatform,
  ): Promise<boolean> {
    // Platform-specific validation rules
    switch (platform) {
      case AIPlatform.KIRO:
        return this.validateKiroFeature(feature, value);
      case AIPlatform.CLAUDE_CODE:
        return this.validateClaudeFeature(feature, value);
      case AIPlatform.CURSOR:
        return this.validateCursorFeature(feature, value);
      default:
        return true;
    }
  }

  /**
   * Validate Kiro feature
   */
  private validateKiroFeature(feature: string, value: any): boolean {
    switch (feature) {
      case 'specs':
        return (
          Array.isArray(value) &&
          value.every(
            (spec) =>
              spec.name && (spec.design || spec.requirements || spec.tasks),
          )
        );
      case 'steering':
        return (
          Array.isArray(value) &&
          value.every((rule) => rule.name && rule.content)
        );
      case 'hooks':
        return (
          Array.isArray(value) &&
          value.every((hook) => hook.name && hook.command)
        );
      default:
        return true;
    }
  }

  /**
   * Validate Claude Code feature
   */
  private validateClaudeFeature(feature: string, value: any): boolean {
    switch (feature) {
      case 'instructions':
        return typeof value === 'string' && value.includes('# ');
      case 'custom_instructions':
        return typeof value === 'string';
      case 'commands':
        return value?.commands && Array.isArray(value.commands);
      default:
        return true;
    }
  }

  /**
   * Validate Cursor feature
   */
  private validateCursorFeature(feature: string, value: any): boolean {
    switch (feature) {
      case 'rules':
        return typeof value === 'string' && value.length > 0;
      default:
        return true;
    }
  }

  /**
   * Check if a mapping is reversible
   */
  private async checkReversibility(
    originalData: any,
    reversedFeatures: Map<string, any>,
    sourcePlatform: AIPlatform,
    targetPlatform: AIPlatform,
  ): Promise<boolean> {
    try {
      // Convert reversed features back to original
      const doubleReversed = await this.featureMappingService.mapFeatures(
        Object.fromEntries(reversedFeatures),
        targetPlatform,
        sourcePlatform,
      );

      // Check if critical features are preserved
      const criticalFeatures = this.getCriticalFeatures(sourcePlatform);

      for (const feature of criticalFeatures) {
        const original = originalData[feature];
        const reversed = doubleReversed.mappedFeatures.get(feature);

        if (!this.compareFeatures(original, reversed)) {
          this.logger.debug(`Feature ${feature} is not reversible`);
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.debug(`Reversibility check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get critical features for a platform
   */
  private getCriticalFeatures(platform: AIPlatform): string[] {
    switch (platform) {
      case AIPlatform.KIRO:
        return ['specs', 'steering'];
      case AIPlatform.CLAUDE_CODE:
        return ['instructions'];
      case AIPlatform.CURSOR:
        return ['rules'];
      default:
        return [];
    }
  }

  /**
   * Compare two feature values for equality
   */
  private compareFeatures(original: any, reversed: any): boolean {
    if (original === reversed) return true;

    if (Array.isArray(original) && Array.isArray(reversed)) {
      if (original.length !== reversed.length) return false;
      // Check if arrays contain same elements (order may differ)
      return original.every((item) =>
        reversed.some(
          (revItem) => JSON.stringify(item) === JSON.stringify(revItem),
        ),
      );
    }

    if (typeof original === 'object' && typeof reversed === 'object') {
      const origKeys = Object.keys(original).sort();
      const revKeys = Object.keys(reversed).sort();

      if (origKeys.length !== revKeys.length) return false;

      return origKeys.every((key) =>
        this.compareFeatures(original[key], reversed[key]),
      );
    }

    // For strings, normalize whitespace
    if (typeof original === 'string' && typeof reversed === 'string') {
      return (
        original.trim().replaceAll(/\s+/g, ' ') ===
        reversed.trim().replaceAll(/\s+/g, ' ')
      );
    }

    return false;
  }

  /**
   * Get available reverse mappings
   */
  getAvailableReverseMappings(): Map<string, number> {
    const available = new Map<string, number>();

    for (const [key, mappings] of this.reverseMappingCache) {
      available.set(key, mappings.length);
    }

    return available;
  }

  /**
   * Clear reverse mapping cache
   */
  clearCache(): void {
    this.reverseMappingCache.clear();
    this.initializeReverseMappings();
  }
}
