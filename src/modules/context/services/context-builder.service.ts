import { Injectable, Logger } from '@nestjs/common';

import { BuilderStrategyFactory } from '../factories/builder-strategy.factory';
import { TaptikContext, AIPlatform } from '../interfaces';
import {
  BuildOptions,
} from '../interfaces/strategy.interface';

import { PlatformDetectorService } from './platform-detector.service';

export interface BuildResult {
  success: boolean;
  context?: TaptikContext;
  platform?: AIPlatform;
  error?: string;
  warnings?: string[];
}

export interface MultiBuildResult {
  contexts: TaptikContext[];
  platforms: AIPlatform[];
  errors: Map<AIPlatform, string>;
  warnings: Map<AIPlatform, string[]>;
}

@Injectable()
export class ContextBuilderService {
  private readonly logger = new Logger(ContextBuilderService.name);

  constructor(
    private readonly strategyFactory: BuilderStrategyFactory,
    private readonly platformDetector: PlatformDetectorService,
  ) {}

  /**
   * Build context from the current environment
   * Auto-detects the platform if not specified
   */
  async build(
    path?: string,
    platform?: AIPlatform,
    options?: BuildOptions,
  ): Promise<BuildResult> {
    try {
      // Auto-detect platform if not specified
      const targetPlatform = platform || (await this.detectPlatform(path));
      if (!targetPlatform) {
        return {
          success: false,
          error:
            'Could not detect IDE platform. Please specify with --platform option.',
        };
      }

      // Get the appropriate strategy
      const strategy = this.strategyFactory.getStrategy(targetPlatform);
      if (!strategy) {
        return {
          success: false,
          error: `No builder strategy available for platform: ${targetPlatform}`,
        };
      }

      // Build the context
      const context = await strategy.build(path);

      // Apply options if provided
      const processedContext = await this.applyBuildOptions(context, options);

      return {
        success: true,
        context: processedContext,
        platform: targetPlatform,
      };
    } catch (error) {
      this.logger.error(`Failed to build context: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Build contexts from multiple platforms simultaneously
   */
  async buildMultiple(
    path?: string,
    platforms?: AIPlatform[],
    options?: BuildOptions,
  ): Promise<MultiBuildResult> {
    const contexts: TaptikContext[] = [];
    const detectedPlatforms: AIPlatform[] = [];
    const errors = new Map<AIPlatform, string>();
    const warnings = new Map<AIPlatform, string[]>();

    // Determine which platforms to build from
    const targetPlatforms = platforms || (await this.detectAllPlatforms(path));

    // Build from each platform in parallel
    const buildPromises = targetPlatforms.map(async (platform) => {
      try {
        const result = await this.build(path, platform, options);
        if (result.success && result.context) {
          contexts.push(result.context);
          detectedPlatforms.push(platform);
        } else if (result.error) {
          errors.set(platform, result.error);
        }
        if (result.warnings) {
          warnings.set(platform, result.warnings);
        }
      } catch (error) {
        errors.set(platform, error.message);
      }
    });

    await Promise.all(buildPromises);

    return {
      contexts,
      platforms: detectedPlatforms,
      errors,
      warnings,
    };
  }

  /**
   * Detect the platform of the current environment
   */
  async detectPlatform(path?: string): Promise<AIPlatform | null> {
    const primary = await this.platformDetector.detectPrimary(path);
    if (primary) {
      this.logger.log(`Detected platform: ${primary}`);
    }
    return primary;
  }

  /**
   * Detect all platforms present in the current environment
   */
  async detectAllPlatforms(path?: string): Promise<AIPlatform[]> {
    const report = await this.platformDetector.detectAll(path);
    const platforms = report.detected.map((d) => d.platform);

    if (report.ambiguous) {
      this.logger.warn(
        'Multiple platforms detected with similar confidence levels',
      );
    }

    this.logger.log(`Detected platforms: ${platforms.join(', ')}`);
    return platforms;
  }

  /**
   * Get available platforms
   */
  getAvailablePlatforms(): AIPlatform[] {
    return [...this.strategyFactory.getAllStrategies().keys()];
  }

  /**
   * Check if a platform is supported
   */
  isPlatformSupported(platform: AIPlatform): boolean {
    return this.strategyFactory.hasStrategy(platform);
  }

  /**
   * Apply build options to the context
   */
  private async applyBuildOptions(
    context: TaptikContext,
    options?: BuildOptions,
  ): Promise<TaptikContext> {
    if (!options) {
      return context;
    }

    let processedContext = { ...context };

    // Exclude sensitive data if requested
    if (options.excludeSensitive) {
      processedContext = this.removeSensitiveData(processedContext);
    }

    // Include only specified sections
    if (options.includeOnly && options.includeOnly.length > 0) {
      processedContext = this.filterSections(
        processedContext,
        options.includeOnly,
      );
    }

    // Exclude specified sections
    if (options.exclude && options.exclude.length > 0) {
      processedContext = this.excludeSections(
        processedContext,
        options.exclude,
      );
    }

    return processedContext;
  }

  /**
   * Remove sensitive data from context
   */
  private removeSensitiveData(context: TaptikContext): TaptikContext {
    const processed = JSON.parse(JSON.stringify(context));

    // Remove sensitive fields from IDE configurations
    if (processed.ide?.data) {
      this.removeSensitiveFields(processed.ide.data);
    }

    // Remove sensitive fields from tools
    if (processed.tools?.data) {
      this.removeSensitiveFields(processed.tools.data);
    }

    return processed;
  }

  /**
   * Remove sensitive fields from an object
   */
  private removeSensitiveFields(object: any): void {
    const sensitiveKeys = [
      'api_key',
      'apiKey',
      'token',
      'secret',
      'password',
      'auth',
      'authorization',
      'credentials',
    ];

    for (const key in object) {
      if (
        sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))
      ) {
        object[key] = '[REDACTED]';
      } else if (typeof object[key] === 'object' && object[key] !== null) {
        this.removeSensitiveFields(object[key]);
      }
    }
  }

  /**
   * Filter context to include only specified sections
   */
  private filterSections(
    context: TaptikContext,
    sections: string[],
  ): TaptikContext {
    const filtered: any = {
      version: context.version,
      metadata: context.metadata,
    };

    for (const section of sections) {
      if (context[section as keyof TaptikContext]) {
        filtered[section] = context[section as keyof TaptikContext];
      }
    }

    return filtered as TaptikContext;
  }

  /**
   * Exclude specified sections from context
   */
  private excludeSections(
    context: TaptikContext,
    sections: string[],
  ): TaptikContext {
    const processed = { ...context };

    for (const section of sections) {
      delete processed[section as keyof TaptikContext];
    }

    return processed;
  }
}
