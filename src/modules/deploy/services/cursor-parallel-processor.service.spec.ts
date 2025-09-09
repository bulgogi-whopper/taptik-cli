import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CursorParallelProcessorService } from './cursor-parallel-processor.service';
import { PerformanceMonitorService } from './performance-monitor.service';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockResolvedValue(undefined),
}));

// Mock constants
vi.mock('node:fs/promises', () => ({
  constants: {
    W_OK: 2,
  },
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockResolvedValue(undefined),
}));

describe('CursorParallelProcessorService', () => {
  let service: CursorParallelProcessorService;
  let performanceMonitor: PerformanceMonitorService;

  beforeEach(() => {
    performanceMonitor = {
      startDeploymentTiming: vi.fn(),
      endDeploymentTiming: vi.fn(),
      recordMemoryUsage: vi.fn(),
    } as any;

    service = new CursorParallelProcessorService(performanceMonitor);
  });

  describe('processComponentsInParallel', () => {
    it('should process components successfully', async () => {
      const config = {
        globalSettings: { 'editor.fontSize': 14 },
        projectSettings: { 'editor.tabSize': 2 },
      };
      const components = ['settings'];
      const context = {
        globalSettingsPath: '/test/.cursor/settings.json',
        projectSettingsPath: '/test/project/.cursor/settings.json',
        aiPromptsPath: '/test/project/.cursor/ai/prompts',
        aiRulesPath: '/test/project/.cursor/ai/rules',
        aiContextPath: '/test/project/.cursor/ai/context.json',
        extensionsPath: '/test/project/.cursor/extensions.json',
        snippetsPath: '/test/.cursor/snippets',
        tasksPath: '/test/project/.cursor/tasks.json',
        launchPath: '/test/project/.cursor/launch.json',
      };
      const options = {
        platform: 'cursor-ide' as const,
        conflictStrategy: 'overwrite' as const,
        dryRun: false,
        validateOnly: false,
      };

      const result = await service.processComponentsInParallel(
        config as any,
        components as any,
        context,
        options,
        'test-deployment',
        {
          maxConcurrency: 2,
          batchSize: 3,
          safetyChecks: false, // Disable safety checks for testing
        },
      );

      expect(result.success).toBe(true);
      expect(result.totalFiles).toBeGreaterThan(0);
      expect(result.totalBatches).toBeGreaterThan(0);
    });

    it('should handle empty components gracefully', async () => {
      const config = {};
      const components: any[] = [];
      const context = {
        globalSettingsPath: '/test/.cursor/settings.json',
        projectSettingsPath: '/test/project/.cursor/settings.json',
        aiPromptsPath: '/test/project/.cursor/ai/prompts',
        aiRulesPath: '/test/project/.cursor/ai/rules',
        aiContextPath: '/test/project/.cursor/ai/context.json',
        extensionsPath: '/test/project/.cursor/extensions.json',
        snippetsPath: '/test/.cursor/snippets',
        tasksPath: '/test/project/.cursor/tasks.json',
        launchPath: '/test/project/.cursor/launch.json',
      };
      const options = {
        platform: 'cursor-ide' as const,
        conflictStrategy: 'overwrite' as const,
        dryRun: false,
        validateOnly: false,
      };

      const result = await service.processComponentsInParallel(
        config as any,
        components,
        context,
        options,
        'test-deployment',
        {
          safetyChecks: false,
        },
      );

      expect(result.success).toBe(true);
      expect(result.totalFiles).toBe(0);
      expect(result.totalBatches).toBe(0);
    });

    it('should respect dry run mode', async () => {
      const config = {
        globalSettings: { 'editor.fontSize': 14 },
      };
      const components = ['settings'];
      const context = {
        globalSettingsPath: '/test/.cursor/settings.json',
        projectSettingsPath: '/test/project/.cursor/settings.json',
        aiPromptsPath: '/test/project/.cursor/ai/prompts',
        aiRulesPath: '/test/project/.cursor/ai/rules',
        aiContextPath: '/test/project/.cursor/ai/context.json',
        extensionsPath: '/test/project/.cursor/extensions.json',
        snippetsPath: '/test/.cursor/snippets',
        tasksPath: '/test/project/.cursor/tasks.json',
        launchPath: '/test/project/.cursor/launch.json',
      };
      const options = {
        platform: 'cursor-ide' as const,
        conflictStrategy: 'overwrite' as const,
        dryRun: true, // Enable dry run
        validateOnly: false,
      };

      const result = await service.processComponentsInParallel(
        config as any,
        components as any,
        context,
        options,
        'test-deployment',
        {
          safetyChecks: false,
        },
      );

      expect(result.success).toBe(true);
      // In dry run mode, files should be processed but not actually written
      expect(result.totalFiles).toBeGreaterThan(0);
    });
  });
});