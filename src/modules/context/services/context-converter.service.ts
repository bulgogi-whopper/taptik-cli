import { Injectable, Logger } from '@nestjs/common';

import { ConverterStrategyFactory } from '../factories/converter-strategy.factory';
import { TaptikContext, AIPlatform } from '../interfaces';

export interface ConversionOptions {
  validateCompatibility?: boolean;
  preserveOriginal?: boolean;
  dryRun?: boolean;
  force?: boolean;
  preserveMetadata?: boolean;
}

export interface ConversionResult {
  success: boolean;
  context?: TaptikContext;
  originalContext?: TaptikContext;
  error?: string;
  report?: {
    source: AIPlatform;
    target: AIPlatform;
    supportedFeatures: string[];
    unsupportedFeatures: string[];
    approximations: any[];
    warnings: string[];
    errors: string[];
    mappedFeatures?: number;
  };
}

@Injectable()
export class ContextConverterService {
  private readonly logger = new Logger(ContextConverterService.name);

  constructor(private readonly strategyFactory: ConverterStrategyFactory) {}

  /**
   * Convert context from one platform to another
   */
  async convert(
    context: TaptikContext,
    targetPlatform: AIPlatform,
    options?: ConversionOptions,
  ): Promise<ConversionResult> {
    try {
      // Determine source platform
      const sourcePlatform = this.getSourcePlatform(context);

      if (!sourcePlatform) {
        return {
          success: false,
          report: {
            source: AIPlatform.KIRO, // Default
            target: targetPlatform,
            supportedFeatures: [],
            unsupportedFeatures: [],
            approximations: [],
            warnings: [],
            errors: ['Could not determine source platform from context'],
          },
        };
      }

      if (sourcePlatform === targetPlatform) {
        return {
          success: true,
          context,
          report: {
            source: sourcePlatform,
            target: targetPlatform,
            supportedFeatures: [],
            unsupportedFeatures: [],
            approximations: [],
            warnings: ['Source and target platforms are the same'],
            errors: [],
          },
        };
      }

      // Get the appropriate converter strategy
      const strategy = this.strategyFactory.getStrategy(
        sourcePlatform,
        targetPlatform,
      );

      if (!strategy) {
        return {
          success: false,
          report: {
            source: sourcePlatform,
            target: targetPlatform,
            supportedFeatures: [],
            unsupportedFeatures: [],
            approximations: [],
            warnings: [],
            errors: [
              `No converter available for ${sourcePlatform} to ${targetPlatform}`,
            ],
          },
        };
      }

      // Validate compatibility if requested
      if (options?.validateCompatibility) {
        const compatibility = await strategy.validateCompatibility(context);

        if (!compatibility.compatible && !options.force) {
          return {
            success: false,
            report: {
              source: sourcePlatform,
              target: targetPlatform,
              supportedFeatures: compatibility.supported_features,
              unsupportedFeatures: compatibility.unsupported_features,
              approximations: [],
              warnings: [`Compatibility score: ${compatibility.score}%`],
              errors: [
                'Context is not compatible with target platform. Use --force to override',
              ],
            },
          };
        }
      }

      // Perform the conversion
      const result = await strategy.convert(context);

      if (!result.success) {
        return {
          success: false,
          report: {
            source: sourcePlatform,
            target: targetPlatform,
            supportedFeatures: [],
            unsupportedFeatures: result.unsupported_features || [],
            approximations: result.approximations || [],
            warnings: result.warnings || [],
            errors: [result.error || 'Conversion failed'],
          },
        };
      }

      return {
        success: true,
        context: result.context,
        originalContext: options?.preserveOriginal ? context : undefined,
        report: {
          source: sourcePlatform,
          target: targetPlatform,
          supportedFeatures: this.extractSupportedFeatures(result),
          unsupportedFeatures: result.unsupported_features || [],
          approximations: result.approximations || [],
          warnings: result.warnings || [],
          errors: [],
        },
      };
    } catch (error) {
      this.logger.error(`Conversion failed: ${error.message}`);
      return {
        success: false,
        report: {
          source: this.getSourcePlatform(context) || AIPlatform.KIRO,
          target: targetPlatform,
          supportedFeatures: [],
          unsupportedFeatures: [],
          approximations: [],
          warnings: [],
          errors: [error.message],
        },
      };
    }
  }

  /**
   * Convert between multiple platforms
   */
  async convertChain(
    context: TaptikContext,
    platforms: AIPlatform[],
    options?: ConversionOptions,
  ): Promise<ConversionResult[]> {
    const results: ConversionResult[] = [];
    let currentContext = context;

    for (let i = 1; i < platforms.length; i++) {
      const targetPlatform = platforms[i];
      const result = await this.convert(
        currentContext,
        targetPlatform,
        options,
      );

      results.push(result);

      if (!result.success) {
        break; // Stop chain on failure
      }

      currentContext = result.context!;
    }

    return results;
  }

  /**
   * Check if conversion is available
   */
  isConversionAvailable(
    sourcePlatform: AIPlatform,
    targetPlatform: AIPlatform,
  ): boolean {
    const strategy = this.strategyFactory.getStrategy(
      sourcePlatform,
      targetPlatform,
    );
    return strategy !== undefined && strategy.canConvert();
  }

  /**
   * Get available conversions
   */
  getAvailableConversions(): Array<{ source: AIPlatform; target: AIPlatform }> {
    return this.strategyFactory.getAvailableConversions();
  }

  /**
   * Get feature mapping for a conversion
   */
  getFeatureMapping(
    sourcePlatform: AIPlatform,
    targetPlatform: AIPlatform,
  ): any {
    const strategy = this.strategyFactory.getStrategy(
      sourcePlatform,
      targetPlatform,
    );
    return strategy?.getFeatureMapping();
  }

  /**
   * Determine source platform from context
   */
  private getSourcePlatform(context: TaptikContext): AIPlatform | null {
    // Check metadata first
    if (context.metadata?.platforms && context.metadata.platforms.length > 0) {
      return context.metadata.platforms[0];
    }

    // Check IDE data
    if (context.ide?.data) {
      if (context.ide.data.kiro) return AIPlatform.KIRO;
      if (context.ide.data.claude_code) return AIPlatform.CLAUDE_CODE;
      if (context.ide.data.cursor) return AIPlatform.CURSOR;
    }

    return null;
  }

  /**
   * Extract supported features from conversion result
   */
  private extractSupportedFeatures(result: any): string[] {
    const features: string[] = [];

    if (result.context?.ide?.data) {
      const targetData = Object.values(result.context.ide.data)[0] as any;

      if (targetData) {
        // Extract non-null/non-empty features
        for (const [key, value] of Object.entries(targetData)) {
          if (value !== null && value !== undefined) {
            if (Array.isArray(value) && value.length > 0) {
              features.push(key);
            } else if (
              typeof value === 'object' &&
              Object.keys(value).length > 0
            ) {
              features.push(key);
            } else if (typeof value === 'string' && value.length > 0) {
              features.push(key);
            }
          }
        }
      }
    }

    return features;
  }
}
