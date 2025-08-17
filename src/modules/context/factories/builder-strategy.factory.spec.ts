import { ModuleRef } from '@nestjs/core';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AIPlatform } from '../interfaces';
import { ClaudeCodeBuilderStrategy } from '../strategies/claude-code-builder.strategy';
import { KiroBuilderStrategy } from '../strategies/kiro-builder.strategy';

import { BuilderStrategyFactory } from './builder-strategy.factory';

describe('BuilderStrategyFactory', () => {
  let factory: BuilderStrategyFactory;
  let mockModuleReference: any;
  let mockKiroStrategy: any;
  let mockClaudeStrategy: any;

  beforeEach(() => {
    // Create mock strategies
    mockKiroStrategy = {
      platform: AIPlatform.KIRO,
      detect: vi.fn(),
      extract: vi.fn(),
      normalize: vi.fn(),
      validate: vi.fn(),
      build: vi.fn(),
    };

    mockClaudeStrategy = {
      platform: AIPlatform.CLAUDE_CODE,
      detect: vi.fn(),
      extract: vi.fn(),
      normalize: vi.fn(),
      validate: vi.fn(),
      build: vi.fn(),
    };

    // Create mock ModuleRef
    mockModuleReference = {
      get: vi.fn(),
    };

    // Setup ModuleRef to return strategies
    mockModuleReference.get.mockImplementation((token: any, _options?: any) => {
      // Handle the { strict: false } options
      if (token === KiroBuilderStrategy) {
        return mockKiroStrategy;
      }
      if (token === ClaudeCodeBuilderStrategy) {
        return mockClaudeStrategy;
      }
      return null;
    });

    factory = new BuilderStrategyFactory(
      mockModuleReference as unknown as ModuleRef,
    );

    // Strategies are initialized in constructor
  });

  describe('initialization', () => {
    it('should initialize with available strategies', () => {
      const strategies = factory.getAllStrategies();

      expect(strategies.size).toBe(2);
      expect(strategies.has(AIPlatform.KIRO)).toBe(true);
      expect(strategies.has(AIPlatform.CLAUDE_CODE)).toBe(true);
    });
  });

  describe('getStrategy', () => {
    it('should return strategy for Kiro platform', () => {
      const strategy = factory.getStrategy(AIPlatform.KIRO);

      expect(strategy).toBe(mockKiroStrategy);
    });

    it('should return strategy for Claude Code platform', () => {
      const strategy = factory.getStrategy(AIPlatform.CLAUDE_CODE);

      expect(strategy).toBe(mockClaudeStrategy);
    });

    it('should throw error for unsupported platform', () => {
      expect(() => factory.getStrategy(AIPlatform.CURSOR)).toThrow(
        'No builder strategy available for platform: cursor',
      );
    });
  });

  describe('getAllStrategies', () => {
    it('should return all registered strategies', () => {
      const strategies = factory.getAllStrategies();

      expect(strategies.size).toBe(2);
      expect(strategies.get(AIPlatform.KIRO)).toBe(mockKiroStrategy);
      expect(strategies.get(AIPlatform.CLAUDE_CODE)).toBe(mockClaudeStrategy);
    });
  });

  describe('hasStrategy', () => {
    it('should return true for registered strategy', () => {
      expect(factory.hasStrategy(AIPlatform.KIRO)).toBe(true);
      expect(factory.hasStrategy(AIPlatform.CLAUDE_CODE)).toBe(true);
    });

    it('should return false for unregistered strategy', () => {
      expect(factory.hasStrategy(AIPlatform.CURSOR)).toBe(false);
    });
  });

  describe('registerStrategy', () => {
    it('should register a new strategy', () => {
      const mockCursorStrategy = {
        platform: AIPlatform.CURSOR,
        detect: vi.fn(),
        extract: vi.fn(),
        normalize: vi.fn(),
        validate: vi.fn(),
        build: vi.fn(),
      };

      factory.registerStrategy(AIPlatform.CURSOR, mockCursorStrategy);

      expect(factory.hasStrategy(AIPlatform.CURSOR)).toBe(true);
      expect(factory.getStrategy(AIPlatform.CURSOR)).toBe(mockCursorStrategy);
    });

    it('should override existing strategy', () => {
      const newKiroStrategy = {
        platform: AIPlatform.KIRO,
        detect: vi.fn(),
        extract: vi.fn(),
        normalize: vi.fn(),
        validate: vi.fn(),
        build: vi.fn(),
      };

      factory.registerStrategy(AIPlatform.KIRO, newKiroStrategy);

      expect(factory.getStrategy(AIPlatform.KIRO)).toBe(newKiroStrategy);
    });
  });

  describe('unregisterStrategy', () => {
    it('should remove a registered strategy', () => {
      factory.unregisterStrategy(AIPlatform.KIRO);

      expect(factory.hasStrategy(AIPlatform.KIRO)).toBe(false);
      expect(() => factory.getStrategy(AIPlatform.KIRO)).toThrow(
        'No builder strategy available for platform: kiro',
      );
    });

    it('should not throw when unregistering non-existent strategy', () => {
      expect(() => factory.unregisterStrategy(AIPlatform.CURSOR)).not.toThrow();
    });
  });
});
