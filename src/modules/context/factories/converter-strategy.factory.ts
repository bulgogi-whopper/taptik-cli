import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { AIPlatform } from '../interfaces';
import { IContextConverterStrategy } from '../interfaces/strategy.interface';
import { ClaudeToKiroConverterStrategy } from '../strategies/claude-to-kiro-converter.strategy';
import { KiroToClaudeConverterStrategy } from '../strategies/kiro-to-claude-converter.strategy';

@Injectable()
export class ConverterStrategyFactory {
  private readonly logger = new Logger(ConverterStrategyFactory.name);
  private readonly strategies = new Map<string, IContextConverterStrategy>();

  constructor(private readonly moduleReference: ModuleRef) {
    this.initializeStrategies();
  }

  /**
   * Initialize converter strategies
   */
  private initializeStrategies(): void {
    try {
      // Kiro to Claude Code
      const kiroToClaude = this.moduleReference.get(
        KiroToClaudeConverterStrategy,
        {
          strict: false,
        },
      );
      if (kiroToClaude) {
        const key = this.createKey(AIPlatform.KIRO, AIPlatform.CLAUDE_CODE);
        this.strategies.set(key, kiroToClaude);
        this.logger.debug(`Registered converter: ${key}`);
      }

      // Claude Code to Kiro
      const claudeToKiro = this.moduleReference.get(
        ClaudeToKiroConverterStrategy,
        { strict: false },
      );
      if (claudeToKiro) {
        const key = this.createKey(AIPlatform.CLAUDE_CODE, AIPlatform.KIRO);
        this.strategies.set(key, claudeToKiro);
        this.logger.debug(`Registered converter: ${key}`);
      }

      // Additional converters can be added here
      // Kiro to Cursor, Cursor to Kiro, etc.
    } catch (error) {
      this.logger.warn(
        `Failed to initialize some converter strategies: ${error.message}`,
      );
    }
  }

  /**
   * Get converter strategy for specific platforms
   */
  getStrategy(
    sourcePlatform: AIPlatform,
    targetPlatform: AIPlatform,
  ): IContextConverterStrategy | undefined {
    const key = this.createKey(sourcePlatform, targetPlatform);
    const strategy = this.strategies.get(key);

    if (!strategy) {
      this.logger.debug(`No converter found for ${key}`);
    }

    return strategy;
  }

  /**
   * Get all available converter strategies
   */
  getAllStrategies(): Map<string, IContextConverterStrategy> {
    return new Map(this.strategies);
  }

  /**
   * Check if a converter exists for the given platforms
   */
  hasConverter(
    sourcePlatform: AIPlatform,
    targetPlatform: AIPlatform,
  ): boolean {
    const key = this.createKey(sourcePlatform, targetPlatform);
    return this.strategies.has(key);
  }

  /**
   * Get available conversions
   */
  getAvailableConversions(): Array<{ source: AIPlatform; target: AIPlatform }> {
    const conversions: Array<{ source: AIPlatform; target: AIPlatform }> = [];

    for (const key of this.strategies.keys()) {
      const [source, target] = key.split('->') as [AIPlatform, AIPlatform];
      conversions.push({ source, target });
    }

    return conversions;
  }

  /**
   * Register a custom converter strategy
   */
  registerStrategy(
    sourcePlatform: AIPlatform,
    targetPlatform: AIPlatform,
    strategy: IContextConverterStrategy,
  ): void {
    const key = this.createKey(sourcePlatform, targetPlatform);
    this.strategies.set(key, strategy);
    this.logger.debug(`Registered custom converter: ${key}`);
  }

  /**
   * Unregister a converter strategy
   */
  unregisterStrategy(
    sourcePlatform: AIPlatform,
    targetPlatform: AIPlatform,
  ): void {
    const key = this.createKey(sourcePlatform, targetPlatform);
    this.strategies.delete(key);
    this.logger.debug(`Unregistered converter: ${key}`);
  }

  /**
   * Create a unique key for platform pair
   */
  private createKey(
    sourcePlatform: AIPlatform,
    targetPlatform: AIPlatform,
  ): string {
    return `${sourcePlatform}->${targetPlatform}`;
  }

  /**
   * Get converter chains for multi-step conversions
   */
  getConversionChain(
    sourcePlatform: AIPlatform,
    targetPlatform: AIPlatform,
  ): AIPlatform[] | null {
    // Direct conversion available
    if (this.hasConverter(sourcePlatform, targetPlatform)) {
      return [sourcePlatform, targetPlatform];
    }

    // Try to find a chain through intermediate platforms
    // For now, we only support direct conversions
    // Future enhancement: implement graph traversal for multi-step conversions

    return null;
  }
}
