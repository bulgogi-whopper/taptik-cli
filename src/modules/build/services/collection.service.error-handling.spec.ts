import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { CollectionService } from './collection.service';

// Mock fs promises
vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
  },
}));

describe('CollectionService - Error Handling', () => {
  let service: CollectionService;
  let mockLogger: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CollectionService],
    }).compile();

    service = module.get<CollectionService>(CollectionService);
    
    // Mock the logger
    mockLogger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    (service as any).logger = mockLogger;

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('JSON File Validation', () => {
    it('should validate JSON structure when collecting files', async () => {
      const validJsonContent = '{"valid": "json", "structure": true}';
      const filePath = '/test/.kiro/config/settings.json';
      const filename = 'settings.json';

      vi.mocked(fs.readFile).mockResolvedValue(validJsonContent);

      const mockCallback = vi.fn();
      await (service as any).collectFileWithSecurity(filePath, filename, mockCallback);

      expect(fs.readFile).toHaveBeenCalledWith(filePath, 'utf8');
      expect(mockCallback).toHaveBeenCalledWith(validJsonContent, false);
      expect(mockLogger.debug).toHaveBeenCalledWith(`Successfully read file: ${filename}`);
      expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('Invalid JSON'));
    });

    it('should warn about invalid JSON but continue processing', async () => {
      const invalidJsonContent = '{"invalid": json, "missing": }';
      const filePath = '/test/.kiro/config/settings.json';
      const filename = 'settings.json';

      vi.mocked(fs.readFile).mockResolvedValue(invalidJsonContent);

      const mockCallback = vi.fn();
      await (service as any).collectFileWithSecurity(filePath, filename, mockCallback);

      expect(fs.readFile).toHaveBeenCalledWith(filePath, 'utf8');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Invalid JSON structure in ${filename}`)
      );
      expect(mockCallback).toHaveBeenCalledWith(invalidJsonContent, false);
      expect(mockLogger.debug).toHaveBeenCalledWith(`Successfully read file: ${filename}`);
    });

    it('should not validate non-JSON files', async () => {
      const markdownContent = '# Test Markdown\n\nSome content here.';
      const filePath = '/test/.kiro/settings/context.md';
      const filename = 'context.md';

      vi.mocked(fs.readFile).mockResolvedValue(markdownContent);

      const mockCallback = vi.fn();
      await (service as any).collectFileWithSecurity(filePath, filename, mockCallback);

      expect(fs.readFile).toHaveBeenCalledWith(filePath, 'utf8');
      expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('Invalid JSON'));
      expect(mockCallback).toHaveBeenCalledWith(markdownContent, false);
    });
  });

  describe('File Reading Error Handling', () => {
    it('should handle file not found errors gracefully', async () => {
      const filePath = '/test/.kiro/missing-file.json';
      const filename = 'missing-file.json';

      const fileNotFoundError = new Error('ENOENT: no such file or directory');
      fileNotFoundError.code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(fileNotFoundError);

      const mockCallback = vi.fn();
      await (service as any).collectFileWithSecurity(filePath, filename, mockCallback);

      expect(fs.readFile).toHaveBeenCalledWith(filePath, 'utf8');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Could not read file ${filename}: ENOENT: no such file or directory`
      );
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle permission denied errors gracefully', async () => {
      const filePath = '/test/.kiro/restricted-file.json';
      const filename = 'restricted-file.json';

      const permissionError = new Error('EACCES: permission denied');
      permissionError.code = 'EACCES';
      vi.mocked(fs.readFile).mockRejectedValue(permissionError);

      const mockCallback = vi.fn();
      await (service as any).collectFileWithSecurity(filePath, filename, mockCallback);

      expect(fs.readFile).toHaveBeenCalledWith(filePath, 'utf8');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Could not read file ${filename}: EACCES: permission denied`
      );
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle generic file reading errors', async () => {
      const filePath = '/test/.kiro/corrupted-file.json';
      const filename = 'corrupted-file.json';

      const genericError = new Error('File is corrupted');
      vi.mocked(fs.readFile).mockRejectedValue(genericError);

      const mockCallback = vi.fn();
      await (service as any).collectFileWithSecurity(filePath, filename, mockCallback);

      expect(fs.readFile).toHaveBeenCalledWith(filePath, 'utf8');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Could not read file ${filename}: File is corrupted`
      );
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('Directory Access Error Handling', () => {
    it('should handle missing .kiro directory gracefully', async () => {
      const projectPath = '/test/project';
      const kiroPath = '/test/project/.kiro';

      const dirNotFoundError = new Error('ENOENT: no such file or directory');
      dirNotFoundError.code = 'ENOENT';
      vi.mocked(fs.access).mockRejectedValue(dirNotFoundError);

      await expect(service.collectLocalSettings(projectPath)).rejects.toThrow(
        `No .kiro directory found at: ${kiroPath}`
      );

      expect(fs.access).toHaveBeenCalledWith(kiroPath);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `No .kiro directory found at: ${kiroPath}`
      );
    });

    it('should handle missing global .kiro directory gracefully', async () => {
      const homeDir = require('os').homedir();
      const globalKiroPath = require('path').join(homeDir, '.kiro');

      const dirNotFoundError = new Error('ENOENT: no such file or directory');
      dirNotFoundError.code = 'ENOENT';
      vi.mocked(fs.access).mockRejectedValue(dirNotFoundError);

      await expect(service.collectGlobalSettings()).rejects.toThrow(
        `No global .kiro directory found at: ${globalKiroPath}`
      );

      expect(fs.access).toHaveBeenCalledWith(globalKiroPath);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `No global .kiro directory found at: ${globalKiroPath}`
      );
    });

    it('should handle subdirectory access errors gracefully', async () => {
      const projectPath = '/test/project';
      const kiroPath = '/test/project/.kiro';
      const settingsPath = '/test/project/.kiro/settings';

      // Mock .kiro directory exists
      vi.mocked(fs.access).mockImplementation((path) => {
        if (path === kiroPath) {
          return Promise.resolve();
        } else if (path === settingsPath) {
          const error = new Error('ENOENT: no such file or directory');
          error.code = 'ENOENT';
          return Promise.reject(error);
        }
        return Promise.reject(new Error('Unexpected path'));
      });

      const result = await service.collectLocalSettings(projectPath);

      expect(result).toBeDefined();
      expect(result.sourcePath).toBe(kiroPath);
      expect(result.context).toBeUndefined();
      expect(result.userPreferences).toBeUndefined();
      expect(result.projectSpec).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Settings directory not found: ${settingsPath}`
      );
    });
  });

  describe('Directory Reading Error Handling', () => {
    it('should handle steering directory read errors gracefully', async () => {
      const projectPath = '/test/project';
      const kiroPath = '/test/project/.kiro';
      const steeringPath = '/test/project/.kiro/steering';

      // Mock directory access
      vi.mocked(fs.access).mockImplementation((path) => {
        if (path === kiroPath || path === steeringPath) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Directory not found'));
      });

      // Mock readdir to fail
      const readdirError = new Error('Permission denied reading directory');
      vi.mocked(fs.readdir).mockRejectedValue(readdirError);

      const result = await service.collectLocalSettings(projectPath);

      expect(result).toBeDefined();
      expect(result.steeringFiles).toHaveLength(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error reading steering directory: ${readdirError.message}`
      );
    });

    it('should handle hooks directory read errors gracefully', async () => {
      const projectPath = '/test/project';
      const kiroPath = '/test/project/.kiro';
      const hooksPath = '/test/project/.kiro/hooks';

      // Mock directory access
      vi.mocked(fs.access).mockImplementation((path) => {
        if (path === kiroPath || path === hooksPath) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Directory not found'));
      });

      // Mock readdir to fail
      const readdirError = new Error('Permission denied reading directory');
      vi.mocked(fs.readdir).mockRejectedValue(readdirError);

      const result = await service.collectLocalSettings(projectPath);

      expect(result).toBeDefined();
      expect(result.hookFiles).toHaveLength(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error reading hooks directory: ${readdirError.message}`
      );
    });

    it('should handle templates directory read errors gracefully', async () => {
      const homeDir = require('os').homedir();
      const globalKiroPath = require('path').join(homeDir, '.kiro');
      const templatesPath = require('path').join(globalKiroPath, 'templates');

      // Mock directory access
      vi.mocked(fs.access).mockImplementation((path) => {
        if (path === globalKiroPath || path === templatesPath) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Directory not found'));
      });

      // Mock readdir to fail
      const readdirError = new Error('Permission denied reading directory');
      vi.mocked(fs.readdir).mockRejectedValue(readdirError);

      const result = await service.collectGlobalSettings();

      expect(result).toBeDefined();
      expect(result.promptTemplates).toHaveLength(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error reading templates directory: ${readdirError.message}`
      );
    });
  });

  describe('Security Filtering Error Handling', () => {
    it('should continue processing when security filtering encounters errors', async () => {
      const contentWithSensitiveData = `
        api_key: sk-1234567890abcdef
        database_url: postgres://user:pass@localhost/db
        secret_token: abc123def456
        normal_config: some_value
      `;

      const filePath = '/test/.kiro/config/settings.yaml';
      const filename = 'settings.yaml';

      vi.mocked(fs.readFile).mockResolvedValue(contentWithSensitiveData);

      const mockCallback = vi.fn();
      await (service as any).collectFileWithSecurity(filePath, filename, mockCallback);

      expect(mockCallback).toHaveBeenCalled();
      const [filteredContent, wasFiltered] = mockCallback.mock.calls[0];
      
      expect(wasFiltered).toBe(true);
      expect(filteredContent).toContain('[REDACTED]');
      expect(filteredContent).not.toContain('sk-1234567890abcdef');
      expect(filteredContent).not.toContain('user:pass@localhost');
      expect(filteredContent).toContain('normal_config: some_value');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Security filtering applied to file: ${filename}`
      );
    });

    it('should handle malformed security patterns gracefully', async () => {
      // Test with content that might cause regex issues
      const problematicContent = `
        api_key: [invalid regex pattern \\
        normal_content: this should work
      `;

      const filePath = '/test/.kiro/config/settings.yaml';
      const filename = 'settings.yaml';

      vi.mocked(fs.readFile).mockResolvedValue(problematicContent);

      const mockCallback = vi.fn();
      await (service as any).collectFileWithSecurity(filePath, filename, mockCallback);

      expect(mockCallback).toHaveBeenCalled();
      const [filteredContent, wasFiltered] = mockCallback.mock.calls[0];
      
      // Should still process the content even if some patterns fail
      expect(filteredContent).toContain('normal_content: this should work');
      expect(mockLogger.debug).toHaveBeenCalledWith(`Successfully read file: ${filename}`);
    });
  });

  describe('Partial Collection Success', () => {
    it('should collect available files even when some fail', async () => {
      const projectPath = '/test/project';
      const kiroPath = '/test/project/.kiro';
      const settingsPath = '/test/project/.kiro/settings';

      // Mock directory access
      vi.mocked(fs.access).mockImplementation((path) => {
        if (path === kiroPath || path === settingsPath) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Directory not found'));
      });

      // Mock file reading - some succeed, some fail
      vi.mocked(fs.readFile).mockImplementation((path) => {
        if (path.includes('context.md')) {
          return Promise.resolve('# Context Content');
        } else if (path.includes('user-preferences.md')) {
          return Promise.reject(new Error('File corrupted'));
        } else if (path.includes('project-spec.md')) {
          return Promise.resolve('# Project Spec Content');
        }
        return Promise.reject(new Error('Unexpected file'));
      });

      const result = await service.collectLocalSettings(projectPath);

      expect(result).toBeDefined();
      expect(result.context).toBe('# Context Content');
      expect(result.userPreferences).toBeUndefined(); // Failed to read
      expect(result.projectSpec).toBe('# Project Spec Content');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not read file user-preferences.md')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith('Successfully read file: context.md');
      expect(mockLogger.debug).toHaveBeenCalledWith('Successfully read file: project-spec.md');
    });

    it('should collect partial steering files when some fail', async () => {
      const projectPath = '/test/project';
      const kiroPath = '/test/project/.kiro';
      const steeringPath = '/test/project/.kiro/steering';

      // Mock directory access
      vi.mocked(fs.access).mockImplementation((path) => {
        if (path === kiroPath || path === steeringPath) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Directory not found'));
      });

      // Mock readdir to return some files
      vi.mocked(fs.readdir).mockResolvedValue(['rule1.md', 'rule2.md', 'rule3.md'] as any);

      // Mock file reading - some succeed, some fail
      vi.mocked(fs.readFile).mockImplementation((path) => {
        if (path.includes('rule1.md')) {
          return Promise.resolve('# Rule 1 Content');
        } else if (path.includes('rule2.md')) {
          return Promise.reject(new Error('Permission denied'));
        } else if (path.includes('rule3.md')) {
          return Promise.resolve('# Rule 3 Content');
        }
        return Promise.reject(new Error('Unexpected file'));
      });

      const result = await service.collectLocalSettings(projectPath);

      expect(result).toBeDefined();
      expect(result.steeringFiles).toHaveLength(2);
      expect(result.steeringFiles[0].content).toBe('# Rule 1 Content');
      expect(result.steeringFiles[1].content).toBe('# Rule 3 Content');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not read file rule2.md')
      );
    });
  });
});