import { describe, it, expect, beforeEach, vi } from 'vitest';

import { BuilderStrategyFactory } from '../factories/builder-strategy.factory';
import { AIPlatform } from '../interfaces';

import { ContextBuilderService } from './context-builder.service';

describe('ContextBuilderService', () => {
  let service: ContextBuilderService;
  let mockStrategyFactory: any;
  let mockPlatformDetector: any;
  let mockKiroStrategy: any;
  let mockClaudeStrategy: any;

  const mockContext = {
    version: '1.0.0',
    metadata: {
      name: 'Test Context',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      platforms: [AIPlatform.KIRO],
    },
    ide: {
      category: 'ide' as const,
      spec_version: '1.0.0',
      data: {
        kiro: {
          specs_path: '.kiro/specs',
        },
      },
    },
  };

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

    // Create mock factory
    mockStrategyFactory = {
      getStrategy: vi.fn(),
      getAllStrategies: vi.fn(),
      hasStrategy: vi.fn(),
      registerStrategy: vi.fn(),
      unregisterStrategy: vi.fn(),
    };

    // Create mock platform detector
    mockPlatformDetector = {
      detectAll: vi.fn(),
      detectPrimary: vi.fn(),
      isPlatformPresent: vi.fn(),
    };

    service = new ContextBuilderService(
      mockStrategyFactory as unknown as BuilderStrategyFactory,
      mockPlatformDetector,
    );
  });

  describe('build', () => {
    it('should build context with auto-detected platform', async () => {
      mockPlatformDetector.detectPrimary.mockResolvedValue(AIPlatform.KIRO);
      mockStrategyFactory.getStrategy.mockReturnValue(mockKiroStrategy);
      mockKiroStrategy.build.mockResolvedValue(mockContext);

      const result = await service.build('/test/path');

      expect(result.success).toBe(true);
      expect(result.context).toEqual(mockContext);
      expect(result.platform).toBe(AIPlatform.KIRO);
      expect(mockPlatformDetector.detectPrimary).toHaveBeenCalledWith(
        '/test/path',
      );
      expect(mockKiroStrategy.build).toHaveBeenCalledWith('/test/path');
    });

    it('should build context with specified platform', async () => {
      mockStrategyFactory.getStrategy.mockReturnValue(mockClaudeStrategy);
      mockClaudeStrategy.build.mockResolvedValue(mockContext);

      const result = await service.build('/test/path', AIPlatform.CLAUDE_CODE);

      expect(result.success).toBe(true);
      expect(result.context).toEqual(mockContext);
      expect(result.platform).toBe(AIPlatform.CLAUDE_CODE);
      expect(mockClaudeStrategy.build).toHaveBeenCalledWith('/test/path');
    });

    it('should fail when platform cannot be detected', async () => {
      mockPlatformDetector.detectPrimary.mockResolvedValue(null);

      const result = await service.build('/test/path');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Could not detect IDE platform');
    });

    it('should fail when no strategy available for platform', async () => {
      mockStrategyFactory.getStrategy.mockReturnValue(undefined);

      const result = await service.build('/test/path', AIPlatform.CURSOR);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No builder strategy available');
    });

    it('should apply build options to exclude sensitive data', async () => {
      const sensitiveContext = {
        ...mockContext,
        ide: {
          ...mockContext.ide,
          data: {
            kiro: {
              specs_path: '.kiro/specs',
              api_key: 'secret-key',
              token: 'auth-token',
            },
          },
        },
      };

      mockStrategyFactory.getStrategy.mockReturnValue(mockKiroStrategy);
      mockKiroStrategy.build.mockResolvedValue(sensitiveContext);

      const result = await service.build('/test/path', AIPlatform.KIRO, {
        excludeSensitive: true,
      });

      expect(result.success).toBe(true);
      expect((result.context?.ide?.data?.kiro as any)?.api_key).toBe(
        '[REDACTED]',
      );
      expect((result.context?.ide?.data?.kiro as any)?.token).toBe(
        '[REDACTED]',
      );
      expect(result.context?.ide?.data?.kiro?.specs_path).toBe('.kiro/specs');
    });

    it('should apply build options to include only specified sections', async () => {
      const fullContext = {
        ...mockContext,
        project: {
          category: 'project' as const,
          spec_version: '1.0.0',
          data: { kiro_specs: [] },
        },
        tools: {
          category: 'tools' as const,
          spec_version: '1.0.0',
          data: { mcp_servers: [] },
        },
      };

      mockStrategyFactory.getStrategy.mockReturnValue(mockKiroStrategy);
      mockKiroStrategy.build.mockResolvedValue(fullContext);

      const result = await service.build('/test/path', AIPlatform.KIRO, {
        includeOnly: ['ide', 'project'],
      });

      expect(result.success).toBe(true);
      expect(result.context?.ide).toBeDefined();
      expect(result.context?.project).toBeDefined();
      expect(result.context?.tools).toBeUndefined();
    });

    it('should apply build options to exclude specified sections', async () => {
      const fullContext = {
        ...mockContext,
        project: {
          category: 'project' as const,
          spec_version: '1.0.0',
          data: { kiro_specs: [] },
        },
      };

      mockStrategyFactory.getStrategy.mockReturnValue(mockKiroStrategy);
      mockKiroStrategy.build.mockResolvedValue(fullContext);

      const result = await service.build('/test/path', AIPlatform.KIRO, {
        exclude: ['project'],
      });

      expect(result.success).toBe(true);
      expect(result.context?.ide).toBeDefined();
      expect(result.context?.project).toBeUndefined();
    });

    it('should handle build errors gracefully', async () => {
      mockStrategyFactory.getStrategy.mockReturnValue(mockKiroStrategy);
      mockKiroStrategy.build.mockRejectedValue(new Error('Build failed'));

      const result = await service.build('/test/path', AIPlatform.KIRO);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Build failed');
    });
  });

  describe('buildMultiple', () => {
    it('should build contexts from multiple platforms', async () => {
      const kiroContext = { ...mockContext };
      const claudeContext = {
        ...mockContext,
        metadata: {
          ...mockContext.metadata,
          platforms: [AIPlatform.CLAUDE_CODE],
        },
      };

      mockPlatformDetector.detectAll.mockResolvedValue({
        detected: [
          { platform: AIPlatform.KIRO, confidence: 90, indicators: [] },
          { platform: AIPlatform.CLAUDE_CODE, confidence: 85, indicators: [] },
        ],
        primary: AIPlatform.KIRO,
        ambiguous: false,
        details: new Map(),
      });
      mockStrategyFactory.getStrategy
        .mockReturnValueOnce(mockKiroStrategy)
        .mockReturnValueOnce(mockClaudeStrategy);
      mockKiroStrategy.build.mockResolvedValue(kiroContext);
      mockClaudeStrategy.build.mockResolvedValue(claudeContext);

      const result = await service.buildMultiple('/test/path');

      expect(result.contexts).toHaveLength(2);
      expect(result.platforms).toContain(AIPlatform.KIRO);
      expect(result.platforms).toContain(AIPlatform.CLAUDE_CODE);
      expect(result.errors.size).toBe(0);
    });

    it('should handle partial failures in multiple builds', async () => {
      mockPlatformDetector.detectAll.mockResolvedValue({
        detected: [
          { platform: AIPlatform.KIRO, confidence: 90, indicators: [] },
          { platform: AIPlatform.CLAUDE_CODE, confidence: 85, indicators: [] },
        ],
        primary: AIPlatform.KIRO,
        ambiguous: false,
        details: new Map(),
      });
      mockStrategyFactory.getStrategy
        .mockReturnValueOnce(mockKiroStrategy)
        .mockReturnValueOnce(mockClaudeStrategy);
      mockKiroStrategy.build.mockResolvedValue(mockContext);
      mockClaudeStrategy.build.mockRejectedValue(
        new Error('Claude build failed'),
      );

      const result = await service.buildMultiple('/test/path');

      expect(result.contexts).toHaveLength(1);
      expect(result.platforms).toContain(AIPlatform.KIRO);
      expect(result.errors.has(AIPlatform.CLAUDE_CODE)).toBe(true);
      expect(result.errors.get(AIPlatform.CLAUDE_CODE)).toContain(
        'Claude build failed',
      );
    });

    it('should build from specified platforms only', async () => {
      mockStrategyFactory.getStrategy.mockReturnValue(mockKiroStrategy);
      mockKiroStrategy.build.mockResolvedValue(mockContext);

      const result = await service.buildMultiple('/test/path', [
        AIPlatform.KIRO,
      ]);

      expect(result.contexts).toHaveLength(1);
      expect(result.platforms).toEqual([AIPlatform.KIRO]);
      expect(mockKiroStrategy.build).toHaveBeenCalled();
    });
  });

  describe('detectPlatform', () => {
    it('should detect Kiro platform', async () => {
      mockPlatformDetector.detectPrimary.mockResolvedValue(AIPlatform.KIRO);

      const platform = await service.detectPlatform('/test/path');

      expect(platform).toBe(AIPlatform.KIRO);
      expect(mockPlatformDetector.detectPrimary).toHaveBeenCalledWith(
        '/test/path',
      );
    });

    it('should detect Claude Code platform', async () => {
      mockPlatformDetector.detectPrimary.mockResolvedValue(
        AIPlatform.CLAUDE_CODE,
      );

      const platform = await service.detectPlatform('/test/path');

      expect(platform).toBe(AIPlatform.CLAUDE_CODE);
    });

    it('should return null when no platform detected', async () => {
      mockPlatformDetector.detectPrimary.mockResolvedValue(null);

      const platform = await service.detectPlatform('/test/path');

      expect(platform).toBeNull();
    });

    it('should handle detection errors gracefully', async () => {
      mockPlatformDetector.detectPrimary.mockResolvedValue(
        AIPlatform.CLAUDE_CODE,
      );

      const platform = await service.detectPlatform('/test/path');

      expect(platform).toBe(AIPlatform.CLAUDE_CODE);
    });
  });

  describe('detectAllPlatforms', () => {
    it('should detect all present platforms', async () => {
      mockPlatformDetector.detectAll.mockResolvedValue({
        detected: [
          { platform: AIPlatform.KIRO, confidence: 90, indicators: [] },
          { platform: AIPlatform.CLAUDE_CODE, confidence: 85, indicators: [] },
        ],
        primary: AIPlatform.KIRO,
        ambiguous: false,
        details: new Map(),
      });

      const platforms = await service.detectAllPlatforms('/test/path');

      expect(platforms).toHaveLength(2);
      expect(platforms).toContain(AIPlatform.KIRO);
      expect(platforms).toContain(AIPlatform.CLAUDE_CODE);
    });

    it('should return empty array when no platforms detected', async () => {
      mockPlatformDetector.detectAll.mockResolvedValue({
        detected: [],
        primary: null,
        ambiguous: false,
        details: new Map(),
      });

      const platforms = await service.detectAllPlatforms('/test/path');

      expect(platforms).toEqual([]);
    });
  });

  describe('getAvailablePlatforms', () => {
    it('should return all available platforms', () => {
      const strategies = new Map([
        [AIPlatform.KIRO, mockKiroStrategy],
        [AIPlatform.CLAUDE_CODE, mockClaudeStrategy],
      ]);

      mockStrategyFactory.getAllStrategies.mockReturnValue(strategies);

      const platforms = service.getAvailablePlatforms();

      expect(platforms).toHaveLength(2);
      expect(platforms).toContain(AIPlatform.KIRO);
      expect(platforms).toContain(AIPlatform.CLAUDE_CODE);
    });
  });

  describe('isPlatformSupported', () => {
    it('should return true for supported platform', () => {
      mockStrategyFactory.hasStrategy.mockReturnValue(true);

      const supported = service.isPlatformSupported(AIPlatform.KIRO);

      expect(supported).toBe(true);
      expect(mockStrategyFactory.hasStrategy).toHaveBeenCalledWith(
        AIPlatform.KIRO,
      );
    });

    it('should return false for unsupported platform', () => {
      mockStrategyFactory.hasStrategy.mockReturnValue(false);

      const supported = service.isPlatformSupported(AIPlatform.CURSOR);

      expect(supported).toBe(false);
      expect(mockStrategyFactory.hasStrategy).toHaveBeenCalledWith(
        AIPlatform.CURSOR,
      );
    });
  });
});
