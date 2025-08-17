import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AIPlatform } from '../interfaces';

import { PlatformDetectorService } from './platform-detector.service';

describe('PlatformDetectorService', () => {
  let service: PlatformDetectorService;
  let mockFileSystem: any;

  beforeEach(() => {
    mockFileSystem = {
      exists: vi.fn(),
      readFile: vi.fn(),
      readDirectory: vi.fn(),
      readJson: vi.fn(),
    };

    service = new PlatformDetectorService(mockFileSystem);
  });

  describe('detectAll', () => {
    it('should detect Kiro project with high confidence', async () => {
      mockFileSystem.exists.mockImplementation((path: string) => {
        if (path.includes('.kiro')) return true;
        if (path.includes('.kiro/specs')) return true;
        if (path.includes('.kiro/steering')) return true;
        if (path.includes('.kiro/hooks')) return true;
        return false;
      });

      mockFileSystem.readDirectory.mockImplementation((path: string) => {
        if (path.includes('specs')) return ['feature1', 'feature2'];
        if (path.includes('steering')) return ['principle.md', 'persona.md'];
        return [];
      });

      const report = await service.detectAll('/test/project');

      expect(report.detected).toHaveLength(1);
      expect(report.primary).toBe(AIPlatform.KIRO);
      expect(report.ambiguous).toBe(false);

      const kiroResult = report.details.get(AIPlatform.KIRO);
      expect(kiroResult).toBeDefined();
      expect(kiroResult!.confidence).toBeGreaterThan(80);
      expect(kiroResult!.indicators).toContain('.kiro directory');
      expect(kiroResult!.indicators).toContain('.kiro/specs directory');
      expect(kiroResult!.indicators).toContain('.kiro/steering directory');
    });

    it('should detect Claude Code project with high confidence', async () => {
      mockFileSystem.exists.mockImplementation((path: string) => {
        if (path.includes('.claude')) return true;
        if (path.includes('.claude/settings.json')) return true;
        if (path.includes('.claude/mcp.json')) return true;
        if (path.includes('CLAUDE.md')) return true;
        if (path.includes('CLAUDE.local.md')) return true;
        return false;
      });

      mockFileSystem.readFile.mockImplementation((path: string) => {
        if (path.includes('CLAUDE.md')) {
          return '# Project Instructions\n\nDetailed instructions here...';
        }
        return '';
      });

      const report = await service.detectAll('/test/project');

      expect(report.detected).toHaveLength(1);
      expect(report.primary).toBe(AIPlatform.CLAUDE_CODE);
      expect(report.ambiguous).toBe(false);

      const claudeResult = report.details.get(AIPlatform.CLAUDE_CODE);
      expect(claudeResult).toBeDefined();
      expect(claudeResult!.confidence).toBeGreaterThan(75);
      expect(claudeResult!.indicators).toContain('.claude directory');
      expect(claudeResult!.indicators).toContain('CLAUDE.md');
    });

    it('should detect Cursor project with confidence', async () => {
      mockFileSystem.exists.mockImplementation((path: string) => {
        if (path.includes('.cursor')) return true;
        if (path.includes('.cursor/settings.json')) return true;
        if (path.includes('.cursorrules')) return true;
        return false;
      });

      const report = await service.detectAll('/test/project');

      expect(report.detected).toHaveLength(1);
      expect(report.primary).toBe(AIPlatform.CURSOR);

      const cursorResult = report.details.get(AIPlatform.CURSOR);
      expect(cursorResult).toBeDefined();
      expect(cursorResult!.confidence).toBeGreaterThan(60);
      expect(cursorResult!.indicators).toContain('.cursor directory');
      expect(cursorResult!.indicators).toContain('.cursorrules file');
    });

    it('should detect multiple platforms and mark as ambiguous', async () => {
      mockFileSystem.exists.mockImplementation((path: string) => {
        // Both Kiro and Claude Code present
        if (path.includes('.kiro')) return true;
        if (path.includes('.kiro/specs')) return true;
        if (path.includes('.claude')) return true;
        if (path.includes('CLAUDE.md')) return true;
        return false;
      });

      mockFileSystem.readDirectory.mockResolvedValue([]);

      const report = await service.detectAll('/test/project');

      expect(report.detected.length).toBeGreaterThanOrEqual(2);
      expect(report.ambiguous).toBe(true);
      expect(report.details.has(AIPlatform.KIRO)).toBe(true);
      expect(report.details.has(AIPlatform.CLAUDE_CODE)).toBe(true);
    });

    it('should return empty report when no platforms detected', async () => {
      mockFileSystem.exists.mockResolvedValue(false);

      const report = await service.detectAll('/test/project');

      expect(report.detected).toHaveLength(0);
      expect(report.primary).toBeNull();
      expect(report.ambiguous).toBe(false);
    });

    it('should handle detection errors gracefully', async () => {
      mockFileSystem.exists.mockRejectedValue(new Error('Permission denied'));

      const report = await service.detectAll('/test/project');

      expect(report.detected).toHaveLength(0);
      expect(report.primary).toBeNull();
    });
  });

  describe('detectPrimary', () => {
    it('should return primary platform with highest confidence', async () => {
      mockFileSystem.exists.mockImplementation((path: string) => {
        // Strong Kiro indicators
        if (path.includes('.kiro')) return true;
        if (path.includes('.kiro/specs')) return true;
        if (path.includes('.kiro/steering')) return true;
        // Weak Claude indicators
        if (path.includes('CLAUDE.md')) return true;
        return false;
      });

      mockFileSystem.readDirectory.mockResolvedValue(['spec1']);

      const primary = await service.detectPrimary('/test/project');

      expect(primary).toBe(AIPlatform.KIRO);
    });

    it('should return null when no platform detected', async () => {
      mockFileSystem.exists.mockResolvedValue(false);

      const primary = await service.detectPrimary('/test/project');

      expect(primary).toBeNull();
    });
  });

  describe('isPlatformPresent', () => {
    it('should detect Kiro platform presence', async () => {
      mockFileSystem.exists.mockImplementation((path: string) =>
        path.includes('.kiro'),
      );

      const present = await service.isPlatformPresent(
        AIPlatform.KIRO,
        '/test/project',
      );

      expect(present).toBe(true);
    });

    it('should detect Claude Code platform presence', async () => {
      mockFileSystem.exists.mockImplementation((path: string) =>
        path.includes('CLAUDE.md'),
      );

      const present = await service.isPlatformPresent(
        AIPlatform.CLAUDE_CODE,
        '/test/project',
      );

      expect(present).toBe(true);
    });

    it('should detect Cursor platform presence', async () => {
      mockFileSystem.exists.mockImplementation((path: string) =>
        path.includes('.cursor'),
      );

      const present = await service.isPlatformPresent(
        AIPlatform.CURSOR,
        '/test/project',
      );

      expect(present).toBe(true);
    });

    it('should return false for absent platform', async () => {
      mockFileSystem.exists.mockResolvedValue(false);

      const present = await service.isPlatformPresent(
        AIPlatform.KIRO,
        '/test/project',
      );

      expect(present).toBe(false);
    });
  });

  describe('confidence scoring', () => {
    it('should give maximum confidence for complete Kiro setup', async () => {
      mockFileSystem.exists.mockImplementation((path: string) => {
        if (path.includes('.kiro')) return true;
        if (path.includes('specs')) return true;
        if (path.includes('steering')) return true;
        if (path.includes('hooks')) return true;
        if (path.includes('mcp.json')) return true;
        return false;
      });

      mockFileSystem.readDirectory.mockImplementation((path: string) => {
        if (path.includes('specs')) return ['feature1', 'feature2', 'feature3'];
        if (path.includes('steering'))
          return ['principle.md', 'persona.md', 'architecture.md'];
        return [];
      });

      const report = await service.detectAll('/test/project');
      const kiroResult = report.details.get(AIPlatform.KIRO);

      expect(kiroResult).toBeDefined();
      expect(kiroResult!.confidence).toBe(100);
    });

    it('should give partial confidence for minimal setup', async () => {
      mockFileSystem.exists.mockImplementation((path: string) =>
        // Only .kiro directory exists
        path.endsWith('.kiro'),
      );

      mockFileSystem.readDirectory.mockResolvedValue([]);

      const report = await service.detectAll('/test/project');
      const kiroResult = report.details.get(AIPlatform.KIRO);

      expect(kiroResult).toBeDefined();
      expect(kiroResult!.confidence).toBe(40); // Just the directory
    });

    it('should give higher confidence for more indicators', async () => {
      // First test: minimal Claude setup
      mockFileSystem.exists.mockImplementation((path: string) =>
        path.includes('CLAUDE.md'),
      );

      let report = await service.detectAll('/test/project');
      let claudeResult = report.details.get(AIPlatform.CLAUDE_CODE);
      const minimalConfidence = claudeResult!.confidence;

      // Second test: complete Claude setup
      mockFileSystem.exists.mockImplementation((path: string) => {
        if (path.includes('.claude')) return true;
        if (path.includes('settings.json')) return true;
        if (path.includes('mcp.json')) return true;
        if (path.includes('CLAUDE.md')) return true;
        if (path.includes('CLAUDE.local.md')) return true;
        return false;
      });

      mockFileSystem.readFile.mockResolvedValue(
        `# Long content here...${'x'.repeat(200)}`,
      );

      report = await service.detectAll('/test/project');
      claudeResult = report.details.get(AIPlatform.CLAUDE_CODE);
      const completeConfidence = claudeResult!.confidence;

      expect(completeConfidence).toBeGreaterThan(minimalConfidence);
    });
  });

  describe('getDetectionHints', () => {
    it('should provide hints for low confidence Kiro detection', () => {
      const result = {
        platform: AIPlatform.KIRO,
        confidence: 30,
        indicators: [],
      };

      const hints = service.getDetectionHints(result);

      expect(hints).toContain(
        'Create .kiro directory to identify as Kiro project',
      );
      expect(hints).toContain('Add .kiro/specs directory for specifications');
      expect(hints).toContain(
        'Add .kiro/steering directory for steering rules',
      );
    });

    it('should provide hints for improving Claude Code detection', () => {
      const result = {
        platform: AIPlatform.CLAUDE_CODE,
        confidence: 20,
        indicators: [],
      };

      const hints = service.getDetectionHints(result);

      expect(hints).toContain('Create .claude directory or CLAUDE.md file');
      expect(hints).toContain('Add CLAUDE.md for project instructions');
    });

    it('should provide hints for Cursor detection', () => {
      const result = {
        platform: AIPlatform.CURSOR,
        confidence: 30,
        indicators: ['.cursor directory'],
      };

      const hints = service.getDetectionHints(result);

      expect(hints).toContain('Add .cursorrules file for AI instructions');
    });

    it('should not provide hints for high confidence detection', () => {
      const result = {
        platform: AIPlatform.KIRO,
        confidence: 90,
        indicators: [
          '.kiro directory',
          '.kiro/specs directory',
          '.kiro/steering directory',
          '.kiro/hooks directory',
        ],
      };

      const hints = service.getDetectionHints(result);

      expect(hints).toHaveLength(0);
    });
  });
});
