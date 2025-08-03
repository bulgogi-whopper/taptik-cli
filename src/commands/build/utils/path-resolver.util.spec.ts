import { homedir, platform } from 'node:os';
import { join } from 'node:path';

import { access, constants } from 'fs-extra';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { PathResolverUtil as PathResolverUtility } from './path-resolver.util';

// Mock the dependencies
vi.mock('node:os', () => ({
  homedir: vi.fn(),
  platform: vi.fn(),
}));

vi.mock('fs-extra', () => ({
  access: vi.fn(),
  constants: {
    F_OK: 0,
    R_OK: 4,
    W_OK: 2,
  },
}));

const mockHomedir = vi.mocked(homedir);
const mockPlatform = vi.mocked(platform);
const mockAccess = vi.mocked(access);

describe('PathResolverUtil', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPlatform', () => {
    it('should return "windows" for win32 platform', () => {
      mockPlatform.mockReturnValue('win32');
      expect(PathResolverUtility.getPlatform()).toBe('windows');
    });

    it('should return "macos" for darwin platform', () => {
      mockPlatform.mockReturnValue('darwin');
      expect(PathResolverUtility.getPlatform()).toBe('macos');
    });

    it('should return "linux" for linux platform', () => {
      mockPlatform.mockReturnValue('linux');
      expect(PathResolverUtility.getPlatform()).toBe('linux');
    });

    it('should return "unknown" for unsupported platform', () => {
      mockPlatform.mockReturnValue('freebsd' as any);
      expect(PathResolverUtility.getPlatform()).toBe('unknown');
    });
  });

  describe('getHomeDirectory', () => {
    it('should return home directory when available', () => {
      const mockHome = '/Users/testuser';
      mockHomedir.mockReturnValue(mockHome);

      expect(PathResolverUtility.getHomeDirectory()).toBe(mockHome);
    });

    it('should throw error when home directory is not available', () => {
      mockHomedir.mockReturnValue('');
      mockPlatform.mockReturnValue('darwin');

      expect(() => PathResolverUtility.getHomeDirectory()).toThrow(
        'Unable to determine home directory'
      );
    });

    it('should throw platform-specific error when homedir throws', () => {
      mockHomedir.mockImplementation(() => {
        throw new Error('Access denied');
      });
      mockPlatform.mockReturnValue('win32');

      expect(() => PathResolverUtility.getHomeDirectory()).toThrow(
        'Failed to detect home directory on windows: Access denied'
      );
    });
  });

  describe('getKiroConfigDirectory', () => {
    beforeEach(() => {
      mockHomedir.mockReturnValue('/Users/testuser');
    });

    it('should return correct path for Windows', () => {
      mockPlatform.mockReturnValue('win32');
      mockHomedir.mockReturnValue('C:\\Users\\testuser');

      const result = PathResolverUtility.getKiroConfigDirectory();
      expect(result).toBe(join('C:\\Users\\testuser', '.kiro'));
    });

    it('should return correct path for macOS', () => {
      mockPlatform.mockReturnValue('darwin');
      mockHomedir.mockReturnValue('/Users/testuser');

      const result = PathResolverUtility.getKiroConfigDirectory();
      expect(result).toBe(join('/Users/testuser', '.kiro'));
    });

    it('should return correct path for Linux', () => {
      mockPlatform.mockReturnValue('linux');
      mockHomedir.mockReturnValue('/home/testuser');

      const result = PathResolverUtility.getKiroConfigDirectory();
      expect(result).toBe(join('/home/testuser', '.kiro'));
    });

    it('should throw error for unsupported platform', () => {
      mockPlatform.mockReturnValue('freebsd' as any);

      expect(() => PathResolverUtility.getKiroConfigDirectory()).toThrow(
        'Unsupported platform: unknown'
      );
    });
  });

  describe('getLocalKiroConfigDirectory', () => {
    it('should return .kiro in current working directory when no project path provided', () => {
      const originalCwd = process.cwd();
      const mockCwd = '/current/project';
      
      // Mock process.cwd
      const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);

      const result = PathResolverUtility.getLocalKiroConfigDirectory();
      expect(result).toBe(join(mockCwd, '.kiro'));

      cwdSpy.mockRestore();
    });

    it('should return .kiro in specified project path', () => {
      const projectPath = '/path/to/project';
      const result = PathResolverUtility.getLocalKiroConfigDirectory(projectPath);
      expect(result).toBe(join(projectPath, '.kiro'));
    });

    it('should resolve relative project paths', () => {
      const projectPath = './relative/path';
      const result = PathResolverUtility.getLocalKiroConfigDirectory(projectPath);
      expect(result).toContain('.kiro');
    });
  });

  describe('getKiroSettingsPaths', () => {
    beforeEach(() => {
      mockPlatform.mockReturnValue('darwin');
      mockHomedir.mockReturnValue('/Users/testuser');
      
      // Mock process.cwd
      vi.spyOn(process, 'cwd').mockReturnValue('/current/project');
    });

    it('should return correct global and local paths', () => {
      const paths = PathResolverUtility.getKiroSettingsPaths();

      expect(paths.global.userConfig).toBe('/Users/testuser/.kiro/user-config.json');
      expect(paths.global.globalPrompts).toBe('/Users/testuser/.kiro/prompts');
      expect(paths.global.preferences).toBe('/Users/testuser/.kiro/preferences.json');

      expect(paths.local.contextJson).toBe('/current/project/.kiro/context.json');
      expect(paths.local.userPreferences).toBe('/current/project/.kiro/user-preferences.json');
      expect(paths.local.projectSpec).toBe('/current/project/.kiro/project-spec.json');
      expect(paths.local.promptsDir).toBe('/current/project/.kiro/prompts');
      expect(paths.local.hooksDir).toBe('/current/project/.kiro/hooks');
    });
  });

  describe('pathExists', () => {
    it('should return true when path exists', async () => {
      mockAccess.mockResolvedValue(undefined);

      const result = await PathResolverUtility.pathExists('/existing/path');
      expect(result).toBe(true);
      expect(mockAccess).toHaveBeenCalledWith('/existing/path', constants.F_OK);
    });

    it('should return false when path does not exist', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await PathResolverUtility.pathExists('/nonexistent/path');
      expect(result).toBe(false);
    });
  });

  describe('isReadable', () => {
    it('should return true when path is readable', async () => {
      mockAccess.mockResolvedValue(undefined);

      const result = await PathResolverUtility.isReadable('/readable/path');
      expect(result).toBe(true);
      expect(mockAccess).toHaveBeenCalledWith('/readable/path', constants.R_OK);
    });

    it('should return false when path is not readable', async () => {
      mockAccess.mockRejectedValue(new Error('EACCES'));

      const result = await PathResolverUtility.isReadable('/unreadable/path');
      expect(result).toBe(false);
    });
  });

  describe('isWritable', () => {
    it('should return true when path is writable', async () => {
      mockAccess.mockResolvedValue(undefined);

      const result = await PathResolverUtility.isWritable('/writable/path');
      expect(result).toBe(true);
      expect(mockAccess).toHaveBeenCalledWith('/writable/path', constants.W_OK);
    });

    it('should return false when path is not writable', async () => {
      mockAccess.mockRejectedValue(new Error('EACCES'));

      const result = await PathResolverUtility.isWritable('/readonly/path');
      expect(result).toBe(false);
    });
  });

  describe('normalizePath', () => {
    it('should normalize forward slashes to platform separators', () => {
      const path = 'path/to/file';
      const result = PathResolverUtility.normalizePath(path);
      // Result will depend on the actual platform running the test
      expect(result).toMatch(/path[/\\]to[/\\]file/);
    });

    it('should normalize backslashes to platform separators', () => {
      const path = 'path\\to\\file';
      const result = PathResolverUtility.normalizePath(path);
      expect(result).toMatch(/path[/\\]to[/\\]file/);
    });

    it('should handle mixed separators', () => {
      const path = 'path/to\\mixed/separators';
      const result = PathResolverUtility.normalizePath(path);
      expect(result).toMatch(/path[/\\]to[/\\]mixed[/\\]separators/);
    });
  });

  describe('getPathErrorMessage', () => {
    beforeEach(() => {
      mockPlatform.mockReturnValue('darwin');
    });

    it('should return file not found message for ENOENT error', () => {
      const error = new Error('ENOENT: no such file or directory');
      const result = PathResolverUtility.getPathErrorMessage('/missing/path', error);

      expect(result).toContain('Path not found');
      expect(result).toContain('/missing/path');
      expect(result).toContain('run Kiro at least once');
    });

    it('should return permission denied message for EACCES error', () => {
      const error = new Error('EACCES: permission denied');
      const result = PathResolverUtility.getPathErrorMessage('/restricted/path', error);

      expect(result).toContain('Permission denied');
      expect(result).toContain('/restricted/path');
      expect(result).toContain('sudo');
    });

    it('should return generic error message for other errors', () => {
      const error = new Error('Some other error');
      const result = PathResolverUtility.getPathErrorMessage('/some/path', error);

      expect(result).toContain('Error accessing path');
      expect(result).toContain('/some/path');
      expect(result).toContain('macos');
      expect(result).toContain('Some other error');
    });

    it('should provide Windows-specific messages', () => {
      mockPlatform.mockReturnValue('win32');
      
      const enoentError = new Error('ENOENT: no such file or directory');
      const enoentResult = PathResolverUtility.getPathErrorMessage('/missing/path', enoentError);
      expect(enoentResult).toContain('directory was created during Kiro setup');

      const eaccesError = new Error('EACCES: permission denied');
      const eaccesResult = PathResolverUtility.getPathErrorMessage('/restricted/path', eaccesError);
      expect(eaccesResult).toContain('Administrator');
    });

    it('should provide Linux-specific messages', () => {
      mockPlatform.mockReturnValue('linux');
      
      const enoentError = new Error('ENOENT: no such file or directory');
      const enoentResult = PathResolverUtility.getPathErrorMessage('/missing/path', enoentError);
      expect(enoentResult).toContain('~/.kiro exists');

      const eaccesError = new Error('EACCES: permission denied');
      const eaccesResult = PathResolverUtility.getPathErrorMessage('/restricted/path', eaccesError);
      expect(eaccesResult).toContain('sudo');
    });
  });

  describe('validateKiroInstallation', () => {
    beforeEach(() => {
      mockPlatform.mockReturnValue('darwin');
      mockHomedir.mockReturnValue('/Users/testuser');
      vi.spyOn(process, 'cwd').mockReturnValue('/current/project');
    });

    it('should return valid when both global and local configs exist', async () => {
      mockAccess.mockResolvedValue(undefined);

      const result = await PathResolverUtility.validateKiroInstallation();

      expect(result.isValid).toBe(true);
      expect(result.globalConfigExists).toBe(true);
      expect(result.localConfigExists).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return valid when only global config exists', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined) // global exists
        .mockResolvedValueOnce(undefined) // global readable
        .mockRejectedValueOnce(new Error('ENOENT')) // local doesn't exist
        .mockRejectedValueOnce(new Error('ENOENT')); // local not readable

      const result = await PathResolverUtility.validateKiroInstallation();

      expect(result.isValid).toBe(true);
      expect(result.globalConfigExists).toBe(true);
      expect(result.localConfigExists).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Local Kiro configuration directory not found');
    });

    it('should return invalid when neither config exists', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await PathResolverUtility.validateKiroInstallation();

      expect(result.isValid).toBe(false);
      expect(result.globalConfigExists).toBe(false);
      expect(result.localConfigExists).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it('should handle permission errors gracefully', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined) // global exists
        .mockRejectedValueOnce(new Error('EACCES')) // global not readable
        .mockResolvedValueOnce(undefined) // local exists
        .mockRejectedValueOnce(new Error('EACCES')); // local not readable

      const result = await PathResolverUtility.validateKiroInstallation();

      expect(result.isValid).toBe(false);
      expect(result.globalConfigExists).toBe(true);
      expect(result.localConfigExists).toBe(true);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('Cannot read global Kiro configuration');
      expect(result.errors[1]).toContain('Cannot read local Kiro configuration');
    });

    it('should handle unexpected errors during validation', async () => {
      mockHomedir.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await PathResolverUtility.validateKiroInstallation();

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Error checking global Kiro configuration');
    });
  });
});