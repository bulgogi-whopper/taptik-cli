import * as os from 'node:os';

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PathResolver } from './path-resolver.utility';

vi.mock('os');

describe('PathResolver', () => {
  beforeEach(() => {
    vi.mocked(os.homedir).mockReturnValue('/home/testuser');
  });

  describe('resolvePath', () => {
    it('should expand home directory ~', () => {
      const result = PathResolver.resolvePath('~/.claude/settings.json');
      expect(result).toBe('/home/testuser/.claude/settings.json');
    });

    it('should handle absolute paths', () => {
      const result = PathResolver.resolvePath('/usr/local/bin');
      expect(result).toBe('/usr/local/bin');
    });

    it('should handle relative paths', () => {
      const result = PathResolver.resolvePath('./config/settings.json');
      expect(result).toContain('config/settings.json');
    });

    it('should normalize path separators', () => {
      const result = PathResolver.resolvePath('path\\to\\file');
      expect(result).not.toContain('\\');
    });

    it('should handle empty path', () => {
      const result = PathResolver.resolvePath('');
      expect(result).toBe('');
    });
  });

  describe('validatePath', () => {
    it('should reject paths with directory traversal', () => {
      const result = PathResolver.validatePath('../../../etc/passwd');
      expect(result).toBe(false);
    });

    it('should reject encoded traversal attempts', () => {
      const result = PathResolver.validatePath('%2e%2e%2f%2e%2e%2fetc');
      expect(result).toBe(false);
    });

    it('should accept safe paths', () => {
      const result = PathResolver.validatePath('~/.claude/settings.json');
      expect(result).toBe(true);
    });

    it('should accept project relative paths', () => {
      const result = PathResolver.validatePath('.claude/agents/helper.md');
      expect(result).toBe(true);
    });

    it('should reject null bytes', () => {
      const result = PathResolver.validatePath('file.txt\0.exe');
      expect(result).toBe(false);
    });

    it('should reject blocked system paths', () => {
      const result = PathResolver.validatePath('/etc/passwd');
      expect(result).toBe(false);
    });

    it('should reject SSH key paths', () => {
      const result = PathResolver.validatePath('~/.ssh/id_rsa');
      expect(result).toBe(false);
    });
  });

  describe('isWithinAllowedDirectory', () => {
    it('should allow paths within allowed directories', () => {
      const allowedDirectories = ['~/.claude', '.claude'];
      const result = PathResolver.isWithinAllowedDirectory(
        '~/.claude/agents/test.md',
        allowedDirectories,
      );
      expect(result).toBe(true);
    });

    it('should allow exact matches', () => {
      const allowedDirectories = ['~/.claude/settings.json'];
      const result = PathResolver.isWithinAllowedDirectory(
        '~/.claude/settings.json',
        allowedDirectories,
      );
      expect(result).toBe(true);
    });

    it('should reject paths outside allowed directories', () => {
      const allowedDirectories = ['~/.claude', '.claude'];
      const result = PathResolver.isWithinAllowedDirectory(
        '/etc/passwd',
        allowedDirectories,
      );
      expect(result).toBe(false);
    });

    it('should handle nested allowed paths', () => {
      const allowedDirectories = ['.claude'];
      const result = PathResolver.isWithinAllowedDirectory(
        '.claude/deep/nested/file.txt',
        allowedDirectories,
      );
      expect(result).toBe(true);
    });

    it('should reject traversal attempts to escape allowed directory', () => {
      const allowedDirectories = ['~/.claude'];
      const result = PathResolver.isWithinAllowedDirectory(
        '~/.claude/../.ssh/id_rsa',
        allowedDirectories,
      );
      expect(result).toBe(false);
    });

    it('should handle empty allowed directories', () => {
      const result = PathResolver.isWithinAllowedDirectory(
        '~/.claude/settings.json',
        [],
      );
      expect(result).toBe(false);
    });
  });

  describe('sanitizePath', () => {
    it('should remove null bytes', () => {
      const result = PathResolver.sanitizePath('file.txt\0.exe');
      expect(result).toBe('file.txt.exe');
    });

    it('should normalize separators', () => {
      const result = PathResolver.sanitizePath('path\\to\\file');
      expect(result).not.toContain('\\');
    });

    it('should remove multiple slashes', () => {
      const result = PathResolver.sanitizePath('path//to///file');
      expect(result).toBe('path/to/file');
    });

    it('should trim whitespace', () => {
      const result = PathResolver.sanitizePath('  path/to/file  ');
      expect(result).toBe('path/to/file');
    });

    it('should handle encoded characters', () => {
      const result = PathResolver.sanitizePath('%2e%2e%2fpath');
      expect(result).toBe('../path');
    });

    it('should preserve valid special characters', () => {
      const result = PathResolver.sanitizePath('file-name_123.test.json');
      expect(result).toBe('file-name_123.test.json');
    });
  });
});
