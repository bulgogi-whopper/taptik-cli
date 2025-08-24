import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CursorInstallationDetectorService } from './cursor-installation-detector.service';

vi.mock('node:fs/promises');
vi.mock('node:os');
vi.mock('node:child_process');

describe('CursorInstallationDetectorService', () => {
  let service: CursorInstallationDetectorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CursorInstallationDetectorService],
    }).compile();

    service = module.get<CursorInstallationDetectorService>(CursorInstallationDetectorService);
    
    vi.clearAllMocks();
  });

  describe('detectCursorInstallation', () => {
    it('should detect Cursor installation successfully', async () => {
      // Mock file system access
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue('{"version": "0.40.0"}');
      vi.mocked(os.homedir).mockReturnValue('/home/user');
      vi.mocked(os.userInfo).mockReturnValue({ username: 'testuser' } as any);

      const result = await service.detectCursorInstallation();

      expect(result.isInstalled).toBe(true);
      expect(result.version).toBe('0.40.0');
      expect(result.configurationPath?.global).toBe('/home/user/.cursor');
      expect(result.configurationPath?.project).toBe(path.join(process.cwd(), '.cursor'));
    });

    it('should handle missing Cursor installation', async () => {
      // Mock file system access failure
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const result = await service.detectCursorInstallation();

      expect(result.isInstalled).toBe(false);
      expect(result.version).toBeUndefined();
      expect(result.isCompatible).toBe(false);
    });

    it('should detect version from package.json', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue('{"version": "0.41.0", "name": "cursor"}');
      vi.mocked(os.homedir).mockReturnValue('/home/user');
      vi.mocked(os.userInfo).mockReturnValue({ username: 'testuser' } as any);

      const result = await service.detectCursorInstallation();

      expect(result.version).toBe('0.41.0');
      expect(result.isInstalled).toBe(true);
    });

    it('should handle JSON parsing errors gracefully', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue('invalid json');
      vi.mocked(os.homedir).mockReturnValue('/home/user');
      vi.mocked(os.userInfo).mockReturnValue({ username: 'testuser' } as any);

      const result = await service.detectCursorInstallation();

      expect(result.isInstalled).toBe(true);
      expect(result.version).toBeUndefined();
    });
  });

  describe('checkCompatibility', () => {
    it('should return compatible result for supported version', async () => {
      const result = await service.checkCompatibility('0.40.0');

      expect(result.isCompatible).toBe(true);
      expect(result.version.current).toBe('0.40.0');
      expect(result.issues).toHaveLength(0);
    });

    it('should detect version compatibility issues', async () => {
      const result = await service.checkCompatibility('0.35.0');

      expect(result.isCompatible).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      
      const versionIssue = result.issues.find(issue => issue.type === 'version');
      expect(versionIssue).toBeDefined();
      expect(versionIssue?.severity).toBe('critical');
    });

    it('should handle undefined version', async () => {
      const result = await service.checkCompatibility(undefined);

      expect(result.isCompatible).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('version');
      expect(result.issues[0].severity).toBe('critical');
    });

    it('should generate appropriate recommendations', async () => {
      const result = await service.checkCompatibility('0.38.0');

      expect(result.recommendations).toContain('Consider upgrading to Cursor IDE v0.41.0 for best compatibility');
    });

    it('should detect extension compatibility issues', async () => {
      const result = await service.checkCompatibility('0.37.0');

      const extensionIssue = result.issues.find(issue => issue.type === 'extensions');
      expect(extensionIssue).toBeDefined();
      expect(extensionIssue?.severity).toBe('medium');
    });

    it('should detect workspace compatibility issues', async () => {
      const result = await service.checkCompatibility('0.35.0');

      const workspaceIssue = result.issues.find(issue => issue.type === 'workspace');
      expect(workspaceIssue).toBeDefined();
      expect(workspaceIssue?.severity).toBe('low');
    });
  });

  describe('performHealthCheck', () => {
    it('should return healthy result when all checks pass', async () => {
      // Mock successful installation detection
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue('{"version": "0.40.0"}');
      vi.mocked(os.homedir).mockReturnValue('/home/user');
      vi.mocked(os.userInfo).mockReturnValue({ username: 'testuser' } as any);

      const result = await service.performHealthCheck();

      expect(result.healthy).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect installation health issues', async () => {
      // Mock installation not found
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const result = await service.performHealthCheck();

      expect(result.healthy).toBe(false);
      expect(result.issues.some(issue => issue.category === 'installation')).toBe(true);
    });

    it('should detect configuration health issues', async () => {
      // Mock installation found but config corrupted
      vi.mocked(fs.access).mockImplementation((filePath) => {
        if (typeof filePath === 'string' && filePath.includes('settings.json')) {
          return Promise.resolve(undefined);
        }
        return Promise.resolve(undefined);
      });
      
      vi.mocked(fs.readFile).mockImplementation((filePath) => {
        if (typeof filePath === 'string' && filePath.includes('settings.json')) {
          return Promise.resolve('invalid json');
        }
        return Promise.resolve('{"version": "0.40.0"}');
      });
      
      vi.mocked(os.homedir).mockReturnValue('/home/user');
      vi.mocked(os.userInfo).mockReturnValue({ username: 'testuser' } as any);

      const result = await service.performHealthCheck();

      expect(result.issues.some(issue => issue.category === 'configuration')).toBe(true);
    });

    it('should detect permission issues', async () => {
      // Mock successful installation but permission errors
      vi.mocked(fs.access).mockImplementation((filePath, mode) => {
        if (mode === (fs.constants.R_OK | fs.constants.W_OK)) {
          return Promise.reject(new Error('EACCES'));
        }
        return Promise.resolve(undefined);
      });
      
      vi.mocked(fs.readFile).mockResolvedValue('{"version": "0.40.0"}');
      vi.mocked(os.homedir).mockReturnValue('/home/user');
      vi.mocked(os.userInfo).mockReturnValue({ username: 'testuser' } as any);

      const result = await service.performHealthCheck();

      expect(result.issues.some(issue => issue.category === 'permissions')).toBe(true);
    });

    it('should detect extension health issues', async () => {
      // Mock installation found but extensions directory missing
      vi.mocked(fs.access).mockImplementation((filePath) => {
        if (typeof filePath === 'string' && filePath.includes('extensions')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.resolve(undefined);
      });
      
      vi.mocked(fs.readFile).mockResolvedValue('{"version": "0.40.0"}');
      vi.mocked(os.homedir).mockReturnValue('/home/user');
      vi.mocked(os.userInfo).mockReturnValue({ username: 'testuser' } as any);

      const result = await service.performHealthCheck();

      expect(result.issues.some(issue => issue.category === 'extensions')).toBe(true);
    });

    it('should generate health fixes for auto-fixable issues', async () => {
      // Mock config issue
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation((filePath) => {
        if (typeof filePath === 'string' && filePath.includes('settings.json')) {
          return Promise.resolve('invalid json');
        }
        return Promise.resolve('{"version": "0.40.0"}');
      });
      vi.mocked(os.homedir).mockReturnValue('/home/user');
      vi.mocked(os.userInfo).mockReturnValue({ username: 'testuser' } as any);

      const result = await service.performHealthCheck();

      expect(result.fixes.length).toBeGreaterThan(0);
      expect(result.fixes.some(fix => fix.automated)).toBe(true);
    });

    it('should handle unexpected errors gracefully', async () => {
      // Mock an unexpected error
      vi.mocked(fs.access).mockRejectedValue(new Error('Unexpected error'));

      const result = await service.performHealthCheck();

      expect(result.healthy).toBe(false);
      expect(result.issues.some(issue => 
        issue.category === 'installation' && 
        issue.severity === 'critical'
      )).toBe(true);
    });
  });

  describe('platform detection', () => {
    it('should detect platform-specific installation paths', async () => {
      const originalPlatform = process.platform;
      
      // Test macOS
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      vi.mocked(os.userInfo).mockReturnValue({ username: 'testuser' } as any);
      vi.mocked(fs.access).mockImplementation((filePath) => {
        if (typeof filePath === 'string' && filePath.includes('/Applications/Cursor.app')) {
          return Promise.resolve(undefined);
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const result = await service.detectCursorInstallation();
      
      expect(result.installationPath).toContain('/Applications/Cursor.app');
      
      // Restore original platform
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('version comparison', () => {
    it('should correctly compare versions', async () => {
      const compatibilityOld = await service.checkCompatibility('0.35.0');
      const compatibilityCurrent = await service.checkCompatibility('0.40.0');
      const compatibilityNew = await service.checkCompatibility('0.42.0');

      expect(compatibilityOld.isCompatible).toBe(false);
      expect(compatibilityCurrent.isCompatible).toBe(true);
      expect(compatibilityNew.isCompatible).toBe(true);
    });
  });
});