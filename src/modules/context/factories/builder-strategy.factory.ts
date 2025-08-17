import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { AIPlatform } from '../interfaces';
import { IContextBuilderStrategy } from '../interfaces/strategy.interface';
import { ClaudeCodeBuilderStrategy } from '../strategies/claude-code-builder.strategy';
import { KiroBuilderStrategy } from '../strategies/kiro-builder.strategy';

@Injectable()
export class BuilderStrategyFactory {
  private readonly strategies = new Map<AIPlatform, IContextBuilderStrategy>();

  constructor(private readonly moduleReference: ModuleRef) {
    this.initializeStrategies();
  }

  /**
   * Initialize all available strategies
   */
  private initializeStrategies(): void {
    // Register Kiro strategy
    try {
      const kiroStrategy = this.moduleReference.get(KiroBuilderStrategy, {
        strict: false,
      });
      if (kiroStrategy) {
        this.strategies.set(AIPlatform.KIRO, kiroStrategy);
      }
    } catch {
      // Strategy not available
    }

    // Register Claude Code strategy
    try {
      const claudeStrategy = this.moduleReference.get(
        ClaudeCodeBuilderStrategy,
        {
          strict: false,
        },
      );
      if (claudeStrategy) {
        this.strategies.set(AIPlatform.CLAUDE_CODE, claudeStrategy);
      }
    } catch {
      // Strategy not available
    }

    // Add more strategies here as they become available
    // For now, Cursor strategy is not implemented
    // try {
    //   const cursorStrategy = this.moduleRef.get(CursorBuilderStrategy, { strict: false });
    //   if (cursorStrategy) {
    //     this.strategies.set(AIPlatform.CURSOR, cursorStrategy);
    //   }
    // } catch (error) {
    //   // Strategy not available
    // }
  }

  /**
   * Get strategy for a specific platform
   */
  getStrategy(platform: AIPlatform): IContextBuilderStrategy {
    const strategy = this.strategies.get(platform);
    if (!strategy) {
      throw new Error(
        `No builder strategy available for platform: ${platform}`,
      );
    }
    return strategy;
  }

  /**
   * Get all available strategies
   */
  getAllStrategies(): Map<AIPlatform, IContextBuilderStrategy> {
    return new Map(this.strategies);
  }

  /**
   * Check if a strategy exists for a platform
   */
  hasStrategy(platform: AIPlatform): boolean {
    return this.strategies.has(platform);
  }

  /**
   * Register a new strategy dynamically
   */
  registerStrategy(
    platform: AIPlatform,
    strategy: IContextBuilderStrategy,
  ): void {
    this.strategies.set(platform, strategy);
  }

  /**
   * Unregister a strategy
   */
  unregisterStrategy(platform: AIPlatform): void {
    this.strategies.delete(platform);
  }
}
