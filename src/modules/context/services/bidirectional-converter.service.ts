import { Injectable, Logger } from '@nestjs/common';

import { TaptikContext, AIPlatform } from '../interfaces';

import {
  ContextConverterService,
  ConversionOptions,
} from './context-converter.service';
import { ContextValidatorService } from './context-validator.service';

export interface BidirectionalConversionOptions extends ConversionOptions {
  testReversibility?: boolean;
  maxRoundTrips?: number;
  preserveIntermediateResults?: boolean;
}

export interface BidirectionalConversionResult {
  success: boolean;
  forward?: {
    context: TaptikContext;
    report: unknown;
  };
  reverse?: {
    context: TaptikContext;
    report: unknown;
  };
  reversible: boolean;
  dataLoss: {
    forward: string[];
    reverse: string[];
  };
  roundTripAccuracy: number;
  intermediateResults?: TaptikContext[];
}

export interface ConversionPath {
  platforms: AIPlatform[];
  confidence: number;
  approximations: number;
}

@Injectable()
export class BidirectionalConverterService {
  private readonly logger = new Logger(BidirectionalConverterService.name);

  constructor(
    private readonly converterService: ContextConverterService,
    private readonly validatorService: ContextValidatorService,
  ) {}

  /**
   * Perform bidirectional conversion between two platforms
   */
  async convertBidirectional(
    context: TaptikContext,
    targetPlatform: AIPlatform,
    options?: BidirectionalConversionOptions,
  ): Promise<BidirectionalConversionResult> {
    try {
      const sourcePlatform = this.getSourcePlatform(context);

      if (!sourcePlatform) {
        return {
          success: false,
          reversible: false,
          dataLoss: { forward: [], reverse: [] },
          roundTripAccuracy: 0,
        };
      }

      // Forward conversion
      const forwardResult = await this.converterService.convert(
        context,
        targetPlatform,
        options,
      );

      if (!forwardResult.success || !forwardResult.context) {
        return {
          success: false,
          forward: {
            context,
            report: forwardResult.report,
          },
          reversible: false,
          dataLoss: {
            forward: forwardResult.report?.unsupportedFeatures || [],
            reverse: [],
          },
          roundTripAccuracy: 0,
        };
      }

      const result: BidirectionalConversionResult = {
        success: true,
        forward: {
          context: forwardResult.context,
          report: forwardResult.report,
        },
        reversible: false,
        dataLoss: {
          forward: forwardResult.report?.unsupportedFeatures || [],
          reverse: [],
        },
        roundTripAccuracy: 100,
      };

      // Test reversibility if requested
      if (options?.testReversibility) {
        const reverseResult = await this.converterService.convert(
          forwardResult.context,
          sourcePlatform,
          options,
        );

        if (reverseResult.success && reverseResult.context) {
          result.reverse = {
            context: reverseResult.context,
            report: reverseResult.report,
          };

          result.dataLoss.reverse =
            reverseResult.report?.unsupportedFeatures || [];

          // Calculate round-trip accuracy
          const accuracy = await this.calculateRoundTripAccuracy(
            context,
            reverseResult.context,
            sourcePlatform,
          );

          result.roundTripAccuracy = accuracy;
          result.reversible = accuracy >= 90; // Consider reversible if 90% accurate

          // Perform multiple round trips if requested
          if (options.maxRoundTrips && options.maxRoundTrips > 1) {
            const intermediateResults = await this.performRoundTrips(
              context,
              sourcePlatform,
              targetPlatform,
              options.maxRoundTrips,
              options,
            );

            if (options.preserveIntermediateResults) {
              result.intermediateResults = intermediateResults;
            }
          }
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`Bidirectional conversion failed: ${error.message}`);
      return {
        success: false,
        reversible: false,
        dataLoss: { forward: [], reverse: [] },
        roundTripAccuracy: 0,
      };
    }
  }

  /**
   * Find optimal conversion path between platforms
   */
  async findConversionPath(
    sourcePlatform: AIPlatform,
    targetPlatform: AIPlatform,
    maxHops: number = 3,
  ): Promise<ConversionPath | null> {
    // Direct conversion available
    if (
      this.converterService.isConversionAvailable(
        sourcePlatform,
        targetPlatform,
      )
    ) {
      const mapping = this.converterService.getFeatureMapping(
        sourcePlatform,
        targetPlatform,
      );
      return {
        platforms: [sourcePlatform, targetPlatform],
        confidence: 100,
        approximations: mapping?.approximations?.size || 0,
      };
    }

    // Try to find indirect path
    const availableConversions =
      this.converterService.getAvailableConversions();
    const paths = this.findPaths(
      sourcePlatform,
      targetPlatform,
      availableConversions,
      maxHops,
    );

    if (paths.length === 0) {
      return null;
    }

    // Select path with highest confidence
    return paths.reduce((best, current) =>
      current.confidence > best.confidence ? current : best,
    );
  }

  /**
   * Validate conversion compatibility
   */
  async validateConversion(
    context: TaptikContext,
    targetPlatform: AIPlatform,
  ): Promise<{
    compatible: boolean;
    score: number;
    warnings: string[];
    errors: string[];
  }> {
    const sourcePlatform = this.getSourcePlatform(context);

    if (!sourcePlatform) {
      return {
        compatible: false,
        score: 0,
        warnings: [],
        errors: ['Cannot determine source platform'],
      };
    }

    // Check if conversion is available
    if (
      !this.converterService.isConversionAvailable(
        sourcePlatform,
        targetPlatform,
      )
    ) {
      return {
        compatible: false,
        score: 0,
        warnings: [],
        errors: [
          `No conversion available from ${sourcePlatform} to ${targetPlatform}`,
        ],
      };
    }

    // Validate context structure
    const validationResult =
      await this.validatorService.validateContext(context);

    if (!validationResult.valid) {
      return {
        compatible: false,
        score: 0,
        warnings: validationResult.warnings.map((warn) => warn.message),
        errors: validationResult.errors.map((error) => error.message),
      };
    }

    // Get feature mapping and calculate compatibility
    const mapping = this.converterService.getFeatureMapping(
      sourcePlatform,
      targetPlatform,
    );
    const compatibilityScore = this.calculateCompatibilityScore(
      context,
      mapping,
    );

    return {
      compatible: compatibilityScore >= 60,
      score: compatibilityScore,
      warnings: validationResult.warnings.map((warn) => warn.message),
      errors: [],
    };
  }

  /**
   * Generate conversion report
   */
  async generateConversionReport(
    context: TaptikContext,
    targetPlatform: AIPlatform,
  ): Promise<{
    sourcePlatform: AIPlatform | null;
    targetPlatform: AIPlatform;
    supportedFeatures: string[];
    unsupportedFeatures: string[];
    approximations: Record<string, unknown>[];
    dataLossRisk: 'low' | 'medium' | 'high';
    reversibility: 'full' | 'partial' | 'none';
    recommendations: string[];
  }> {
    const sourcePlatform = this.getSourcePlatform(context);

    if (!sourcePlatform) {
      return {
        sourcePlatform: null,
        targetPlatform,
        supportedFeatures: [],
        unsupportedFeatures: [],
        approximations: [],
        dataLossRisk: 'high',
        reversibility: 'none',
        recommendations: ['Cannot determine source platform'],
      };
    }

    const mapping = this.converterService.getFeatureMapping(
      sourcePlatform,
      targetPlatform,
    );
    const features = this.extractFeatures(context, sourcePlatform);

    const supportedFeatures: string[] = [];
    const unsupportedFeatures: string[] = [];
    const approximations: Record<string, unknown>[] = [];

    // Categorize features
    for (const feature of features) {
      if (mapping?.direct_mappings?.has(feature)) {
        supportedFeatures.push(feature);
      } else if (mapping?.approximations?.has(feature)) {
        approximations.push({
          feature,
          approximation: mapping.approximations.get(feature),
        });
      } else if (mapping?.unsupported?.includes(feature)) {
        unsupportedFeatures.push(feature);
      }
    }

    // Calculate risk levels
    const unsupportedRatio = unsupportedFeatures.length / features.length;
    const approximationRatio = approximations.length / features.length;

    const dataLossRisk =
      unsupportedRatio > 0.3
        ? 'high'
        : unsupportedRatio > 0.1 || approximationRatio > 0.3
          ? 'medium'
          : 'low';

    const reversibility =
      unsupportedRatio === 0 && approximationRatio === 0
        ? 'full'
        : unsupportedRatio < 0.2
          ? 'partial'
          : 'none';

    // Generate recommendations
    const recommendations: string[] = [];

    if (dataLossRisk === 'high') {
      recommendations.push(
        'Consider backing up your context before conversion',
      );
    }

    if (unsupportedFeatures.length > 0) {
      recommendations.push(
        `The following features will be lost: ${unsupportedFeatures.join(', ')}`,
      );
    }

    if (approximations.length > 0) {
      recommendations.push(
        'Some features will be approximated and may not work exactly as expected',
      );
    }

    if (reversibility === 'none') {
      recommendations.push(
        'This conversion cannot be reversed without significant data loss',
      );
    }

    return {
      sourcePlatform,
      targetPlatform,
      supportedFeatures,
      unsupportedFeatures,
      approximations,
      dataLossRisk,
      reversibility,
      recommendations,
    };
  }

  /**
   * Perform multiple round trips
   */
  private async performRoundTrips(
    context: TaptikContext,
    sourcePlatform: AIPlatform,
    targetPlatform: AIPlatform,
    maxRoundTrips: number,
    options?: ConversionOptions,
  ): Promise<TaptikContext[]> {
    const results: TaptikContext[] = [context];
    let currentContext = context;

    for (let i = 0; i < maxRoundTrips; i++) {
      // Forward
      const forward = await this.converterService.convert(
        currentContext,
        targetPlatform,
        options,
      );

      if (!forward.success || !forward.context) break;
      results.push(forward.context);

      // Reverse
      const reverse = await this.converterService.convert(
        forward.context,
        sourcePlatform,
        options,
      );

      if (!reverse.success || !reverse.context) break;
      results.push(reverse.context);

      currentContext = reverse.context;
    }

    return results;
  }

  /**
   * Calculate round-trip accuracy
   */
  private async calculateRoundTripAccuracy(
    original: TaptikContext,
    roundTripped: TaptikContext,
    platform: AIPlatform,
  ): Promise<number> {
    const originalFeatures = this.extractFeatures(original, platform);
    const roundTrippedFeatures = this.extractFeatures(roundTripped, platform);

    let matches = 0;
    const total = originalFeatures.length;

    for (const feature of originalFeatures) {
      if (roundTrippedFeatures.includes(feature)) {
        const originalValue = this.getFeatureValue(original, platform, feature);
        const roundTrippedValue = this.getFeatureValue(
          roundTripped,
          platform,
          feature,
        );

        if (this.compareFeatureValues(originalValue, roundTrippedValue)) {
          matches++;
        }
      }
    }

    return total > 0 ? Math.round((matches / total) * 100) : 0;
  }

  /**
   * Extract features from context
   */
  private extractFeatures(
    context: TaptikContext,
    platform: AIPlatform,
  ): string[] {
    const features: string[] = [];
    const platformData = this.getPlatformData(context, platform);

    if (platformData) {
      for (const [key, value] of Object.entries(platformData)) {
        if (
          value !== null &&
          value !== undefined &&
          ((Array.isArray(value) && value.length > 0) ||
            (typeof value === 'object' && Object.keys(value).length > 0) ||
            (typeof value === 'string' && value.length > 0))
        ) {
          features.push(key);
        }
      }
    }

    return features;
  }

  /**
   * Get platform-specific data from context
   */
  private getPlatformData(context: TaptikContext, platform: AIPlatform): unknown {
    switch (platform) {
      case AIPlatform.KIRO:
        return context.ide?.data?.kiro;
      case AIPlatform.CLAUDE_CODE:
        return context.ide?.data?.claude_code;
      case AIPlatform.CURSOR:
        return context.ide?.data?.cursor;
      default:
        return null;
    }
  }

  /**
   * Get feature value from context
   */
  private getFeatureValue(
    context: TaptikContext,
    platform: AIPlatform,
    feature: string,
  ): unknown {
    const platformData = this.getPlatformData(context, platform);
    return platformData?.[feature];
  }

  /**
   * Compare feature values
   */
  private compareFeatureValues(value1: unknown, value2: unknown): boolean {
    // Simple comparison for now
    return JSON.stringify(value1) === JSON.stringify(value2);
  }

  /**
   * Find paths between platforms
   */
  private findPaths(
    source: AIPlatform,
    target: AIPlatform,
    conversions: Array<{ source: AIPlatform; target: AIPlatform }>,
    maxHops: number,
  ): ConversionPath[] {
    const paths: ConversionPath[] = [];
    const visited = new Set<AIPlatform>();

    const dfs = (current: AIPlatform, path: AIPlatform[], hops: number) => {
      if (hops > maxHops) return;
      if (current === target) {
        paths.push({
          platforms: [...path, target],
          confidence: Math.max(50, 100 - hops * 20), // Reduce confidence with more hops
          approximations: hops * 2, // Estimate approximations
        });
        return;
      }

      visited.add(current);

      for (const conv of conversions) {
        if (conv.source === current && !visited.has(conv.target)) {
          dfs(conv.target, [...path, current], hops + 1);
        }
      }

      visited.delete(current);
    };

    dfs(source, [], 0);
    return paths;
  }

  /**
   * Get source platform from context
   */
  private getSourcePlatform(context: TaptikContext): AIPlatform | null {
    if (context.metadata?.platforms && context.metadata.platforms.length > 0) {
      return context.metadata.platforms[0];
    }

    if (context.ide?.data) {
      if (context.ide.data.kiro) return AIPlatform.KIRO;
      if (context.ide.data.claude_code) return AIPlatform.CLAUDE_CODE;
      if (context.ide.data.cursor) return AIPlatform.CURSOR;
    }

    return null;
  }

  /**
   * Calculate compatibility score
   */
  private calculateCompatibilityScore(
    context: TaptikContext,
    mapping: unknown,
  ): number {
    const features = this.extractFeatures(
      context,
      this.getSourcePlatform(context) || AIPlatform.KIRO,
    );

    if (features.length === 0) return 0;

    let score = 0;
    for (const feature of features) {
      const mappingObject = mapping as { direct_mappings?: Set<string>; approximations?: Set<string>; unsupported?: string[] } | undefined;
      if (mappingObject?.direct_mappings?.has(feature)) {
        score += 100;
      } else if (mappingObject?.approximations?.has(feature)) {
        score += 70;
      } else if (!mappingObject?.unsupported?.includes(feature)) {
        score += 50; // Unknown features get partial score
      }
    }

    return Math.round(score / features.length);
  }
}
