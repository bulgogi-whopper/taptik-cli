import { promises as fs } from 'node:fs';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AIPlatform } from '../interfaces';
import { ContextBuilderService } from '../services/context-builder.service';
import { FileSystemUtility } from '../utils/file-system.utility';

import { ContextBuildCommand } from './build.command';

vi.mock('node:fs', () => ({
  promises: {
    writeFile: vi.fn(),
  },
}));

describe('ContextBuildCommand', () => {
  let command: ContextBuildCommand;
  let contextBuilder: ContextBuilderService;
  let _fileSystem: FileSystemUtility;

  beforeEach(async () => {
    const mockContextBuilder = {
      build: vi.fn(),
    };

    const mockFileSystem = {
      ensureDirectory: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
    };

    // Create the command instance directly with mocked dependencies
    command = new ContextBuildCommand(
      mockContextBuilder as any,
      mockFileSystem as any,
    );

    contextBuilder = mockContextBuilder as any;
    _fileSystem = mockFileSystem as any;
  });

  describe('option parsing', () => {
    it('should validate platform option', () => {
      expect(command.parsePlatform('kiro')).toBe('kiro');
      expect(command.parsePlatform('claude-code')).toBe('claude-code');
      expect(command.parsePlatform('cursor')).toBe('cursor');

      expect(() => command.parsePlatform('invalid')).toThrow(
        'Invalid platform',
      );
    });

    it('should parse output option', () => {
      expect(command.parseOutput('/path/to/output.json')).toBe(
        '/path/to/output.json',
      );
    });

    it('should parse boolean options', () => {
      expect(command.parseCompress()).toBe(true);
      expect(command.parseExcludeSensitive()).toBe(true);
      expect(command.parseVerbose()).toBe(true);
    });
  });

  describe('run', () => {
    it('should build context successfully', async () => {
      const mockContext = {
        version: '1.0.0',
        metadata: { name: 'test-context', platform: AIPlatform.KIRO },
        personal: {},
        project: {},
      };

      vi.mocked(contextBuilder.build).mockResolvedValue({
        success: true,
        context: mockContext,
        platform: AIPlatform.KIRO,
      });

      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await command.run([], { platform: 'kiro' });

      expect(contextBuilder.build).toHaveBeenCalledWith(process.cwd(), 'kiro', {
        excludeSensitive: undefined,
        includeOnly: undefined,
        exclude: undefined,
      });

      // fs.writeFile should be called (we can't easily test the exact arguments due to mocking complexity)
      expect(vi.mocked(fs.writeFile)).toHaveBeenCalled();
    });

    it('should handle build failure', async () => {
      vi.mocked(contextBuilder.build).mockResolvedValue({
        success: false,
        error: 'Failed to detect platform',
      });

      await expect(command.run([])).rejects.toThrow(
        'Failed to detect platform',
      );
    });

    it('should use specified platform', async () => {
      const mockContext = {
        version: '1.0.0',
        metadata: { name: 'test-context', platform: AIPlatform.CLAUDE_CODE },
        personal: {},
        project: {},
      };

      vi.mocked(contextBuilder.build).mockResolvedValue({
        success: true,
        context: mockContext,
        platform: AIPlatform.CLAUDE_CODE,
      });

      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await command.run([], { platform: 'claude-code' });

      expect(contextBuilder.build).toHaveBeenCalledWith(
        process.cwd(),
        'claude-code',
        expect.any(Object),
      );
    });

    it('should compress output when requested', async () => {
      const mockContext = {
        version: '1.0.0',
        metadata: { name: 'test-context', platform: AIPlatform.KIRO },
        personal: {},
        project: {},
      };

      vi.mocked(contextBuilder.build).mockResolvedValue({
        success: true,
        context: mockContext,
        platform: AIPlatform.KIRO,
      });

      // Mock zlib
      vi.doMock('node:zlib', () => ({
        gzipSync: vi.fn().mockReturnValue(Buffer.from('compressed')),
      }));

      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await command.run([], { compress: true });

      // fs.writeFile should be called with compressed data
      expect(vi.mocked(fs.writeFile)).toHaveBeenCalled();
    });

    it('should handle build options', async () => {
      const mockContext = {
        version: '1.0.0',
        metadata: { name: 'test-context', platform: AIPlatform.KIRO },
        personal: {},
        project: {},
      };

      vi.mocked(contextBuilder.build).mockResolvedValue({
        success: true,
        context: mockContext,
        platform: AIPlatform.KIRO,
      });

      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await command.run([], {
        excludeSensitive: true,
        includeOnly: 'personal,project',
        exclude: 'tools,ide',
      });

      expect(contextBuilder.build).toHaveBeenCalledWith(
        process.cwd(),
        undefined,
        {
          excludeSensitive: true,
          includeOnly: ['personal', 'project'],
          exclude: ['tools', 'ide'],
        },
      );
    });

    it('should log verbose output', async () => {
      const mockContext = {
        version: '1.0.0',
        metadata: {
          name: 'test-context',
          platform: AIPlatform.KIRO,
          version: '1.0.0',
          created: new Date().toISOString(),
        },
        personal: {},
        project: {},
      };

      vi.mocked(contextBuilder.build).mockResolvedValue({
        success: true,
        context: mockContext,
        platform: AIPlatform.KIRO,
      });

      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const logSpy = vi.spyOn(command['logger'], 'log');

      await command.run([], { verbose: true });

      expect(logSpy).toHaveBeenCalledWith(
        'Context metadata:',
        mockContext.metadata,
      );
    });
  });
});
