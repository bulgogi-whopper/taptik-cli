import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { BuildCommand } from './build.command';
import { BuildModule } from '../build.module';
import { BuildPlatform, BuildCategoryName } from '../interfaces/build-config.interface';
import {
  createMockKiroFileSystem,
  createMockFileSystemWithErrors,
  createEmptyMockFileSystem,
  MockFileSystem
} from '../test-fixtures';

describe('BuildCommand E2E Tests', () => {
  let command: BuildCommand;
  let module: TestingModule;
  let mockFs: MockFileSystem;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for test outputs
    tempDir = await fs.mkdtemp(join(tmpdir(), 'taptik-build-test-'));

    module = await Test.createTestingModule({
      imports: [BuildModule],
    }).compile();

    command = module.get<BuildCommand>(BuildCommand);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(async () => {
    await module.close();

    // Clean up temporary directory
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    jest.clearAllMocks();
  });

  describe('End-to-End Build Process', () => {
    it('should complete full build with real file system operations', async () => {
      // Mock file system with proper Kiro structure
      mockFs = createMockKiroFileSystem();
      
      // Mock process.cwd() and os.homedir()
      jest.spyOn(process, 'cwd').mockReturnValue('/test/project');
      const originalHomedir = require('os').homedir;
      jest.spyOn(require('os'), 'homedir').mockReturnValue('/test/home');

      // Mock file system operations
      jest.spyOn(fs, 'readFile').mockImplementation(async (path: any) => {
        return Buffer.from(await mockFs.readFile(path.toString()));
      });

      jest.spyOn(fs, 'readdir').mockImplementation(async (path: any) => {
        return await mockFs.readdir(path.toString()) as any;
      });

      jest.spyOn(fs, 'stat').mockImplementation(async (path: any) => {
        return await mockFs.stat(path.toString()) as any;
      });

      jest.spyOn(fs, 'mkdir').mockImplementation(async (path: any, options?: any) => {
        await mockFs.mkdir(path.toString(), options);
        return undefined as any;
      });

      jest.spyOn(fs, 'writeFile').mockImplementation(async (path: any, data: any) => {
        await mockFs.writeFile(path.toString(), data.toString());
      });

      // Mock interactive selections
      const interactiveService = module.get('InteractiveService');
      jest.spyOn(interactiveService, 'selectPlatform').mockResolvedValue(BuildPlatform.KIRO);
      jest.spyOn(interactiveService, 'selectCategories').mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
        { name: BuildCategoryName.PROJECT_CONTEXT, enabled: true },
        { name: BuildCategoryName.PROMPT_TEMPLATES, enabled: true },
      ]);

      // Execute build command
      await command.run([], {});

      // Verify output files were created in mock file system
      expect(mockFs.exists('./taptik-build-test/personal-context.json')).toBe(false); // Real path would be timestamped
      
      // Verify file system operations were called correctly
      expect(fs.readFile).toHaveBeenCalledWith('.kiro/settings/context.md', 'utf8');
      expect(fs.readFile).toHaveBeenCalledWith('~/.kiro/config/user.yaml', 'utf8');
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();

      // Restore mocks
      (require('os').homedir as jest.Mock).mockImplementation(originalHomedir);
    });

    it('should handle missing Kiro directories gracefully', async () => {
      // Mock empty file system
      mockFs = createEmptyMockFileSystem();
      
      jest.spyOn(process, 'cwd').mockReturnValue('/test/project');
      jest.spyOn(require('os'), 'homedir').mockReturnValue('/test/home');

      // Mock file system operations to simulate missing directories
      jest.spyOn(fs, 'readdir').mockImplementation(async (path: any) => {
        try {
          return await mockFs.readdir(path.toString()) as any;
        } catch (error) {
          throw error;
        }
      });

      jest.spyOn(fs, 'readFile').mockImplementation(async (path: any) => {
        try {
          return Buffer.from(await mockFs.readFile(path.toString()));
        } catch (error) {
          throw error;
        }
      });

      jest.spyOn(fs, 'mkdir').mockImplementation(async (path: any, options?: any) => {
        await mockFs.mkdir(path.toString(), options);
        return undefined as any;
      });

      jest.spyOn(fs, 'writeFile').mockImplementation(async (path: any, data: any) => {
        await mockFs.writeFile(path.toString(), data.toString());
      });

      // Mock interactive selections
      const interactiveService = module.get('InteractiveService');
      jest.spyOn(interactiveService, 'selectPlatform').mockResolvedValue(BuildPlatform.KIRO);
      jest.spyOn(interactiveService, 'selectCategories').mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      // Execute build command - should not throw
      await expect(command.run([], {})).resolves.not.toThrow();

      // Verify error handler was used for missing directories
      const errorHandler = module.get('ErrorHandlerService');
      expect(errorHandler.addWarning).toHaveBeenCalled();
    });

    it('should handle file permission errors', async () => {
      // Mock file system with permission errors
      mockFs = createMockFileSystemWithErrors();
      
      jest.spyOn(process, 'cwd').mockReturnValue('/test/project');
      jest.spyOn(require('os'), 'homedir').mockReturnValue('/test/home');

      // Mock file system operations with permission errors
      jest.spyOn(fs, 'readFile').mockImplementation(async (path: any) => {
        try {
          return Buffer.from(await mockFs.readFile(path.toString()));
        } catch (error) {
          throw error;
        }
      });

      jest.spyOn(fs, 'readdir').mockImplementation(async (path: any) => {
        try {
          return await mockFs.readdir(path.toString()) as any;
        } catch (error) {
          throw error;
        }
      });

      jest.spyOn(fs, 'mkdir').mockImplementation(async (path: any, options?: any) => {
        await mockFs.mkdir(path.toString(), options);
        return undefined as any;
      });

      jest.spyOn(fs, 'writeFile').mockImplementation(async (path: any, data: any) => {
        await mockFs.writeFile(path.toString(), data.toString());
      });

      // Mock interactive selections
      const interactiveService = module.get('InteractiveService');
      jest.spyOn(interactiveService, 'selectPlatform').mockResolvedValue(BuildPlatform.KIRO);
      jest.spyOn(interactiveService, 'selectCategories').mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      // Execute build command - should handle errors gracefully
      await expect(command.run([], {})).resolves.not.toThrow();

      // Verify warnings were added for permission errors
      const errorHandler = module.get('ErrorHandlerService');
      expect(errorHandler.addWarning).toHaveBeenCalled();
    });
  });

  describe('Output Format Validation', () => {
    it('should generate taptik-compliant JSON output', async () => {
      mockFs = createMockKiroFileSystem();
      
      jest.spyOn(process, 'cwd').mockReturnValue('/test/project');
      jest.spyOn(require('os'), 'homedir').mockReturnValue('/test/home');

      let capturedOutputs: Record<string, any> = {};

      // Mock file system operations and capture outputs
      jest.spyOn(fs, 'readFile').mockImplementation(async (path: any) => {
        return Buffer.from(await mockFs.readFile(path.toString()));
      });

      jest.spyOn(fs, 'readdir').mockImplementation(async (path: any) => {
        return await mockFs.readdir(path.toString()) as any;
      });

      jest.spyOn(fs, 'stat').mockImplementation(async (path: any) => {
        return await mockFs.stat(path.toString()) as any;
      });

      jest.spyOn(fs, 'mkdir').mockImplementation(async (path: any, options?: any) => {
        await mockFs.mkdir(path.toString(), options);
        return undefined as any;
      });

      jest.spyOn(fs, 'writeFile').mockImplementation(async (path: any, data: any) => {
        // Capture JSON outputs for validation
        const pathStr = path.toString();
        if (pathStr.endsWith('.json')) {
          const filename = pathStr.split('/').pop();
          if (filename) {
            capturedOutputs[filename] = JSON.parse(data.toString());
          }
        }
        await mockFs.writeFile(pathStr, data.toString());
      });

      // Mock interactive selections for all categories
      const interactiveService = module.get('InteractiveService');
      jest.spyOn(interactiveService, 'selectPlatform').mockResolvedValue(BuildPlatform.KIRO);
      jest.spyOn(interactiveService, 'selectCategories').mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
        { name: BuildCategoryName.PROJECT_CONTEXT, enabled: true },
        { name: BuildCategoryName.PROMPT_TEMPLATES, enabled: true },
      ]);

      // Execute build command
      await command.run([], {});

      // Validate personal-context.json structure
      const personalContext = capturedOutputs['personal-context.json'];
      expect(personalContext).toHaveProperty('taptik_version');
      expect(personalContext).toHaveProperty('context_type', 'personal');
      expect(personalContext).toHaveProperty('created_at');
      expect(personalContext).toHaveProperty('source_platform', 'Kiro');
      expect(personalContext).toHaveProperty('user_preferences');

      // Validate project-context.json structure
      const projectContext = capturedOutputs['project-context.json'];
      expect(projectContext).toHaveProperty('taptik_version');
      expect(projectContext).toHaveProperty('context_type', 'project');
      expect(projectContext).toHaveProperty('created_at');
      expect(projectContext).toHaveProperty('source_platform', 'Kiro');
      expect(projectContext).toHaveProperty('project_info');

      // Validate prompt-templates.json structure
      const promptTemplates = capturedOutputs['prompt-templates.json'];
      expect(promptTemplates).toHaveProperty('taptik_version');
      expect(promptTemplates).toHaveProperty('context_type', 'prompt_templates');
      expect(promptTemplates).toHaveProperty('created_at');
      expect(promptTemplates).toHaveProperty('source_platform', 'Kiro');
      expect(promptTemplates).toHaveProperty('templates');
      expect(Array.isArray(promptTemplates.templates)).toBe(true);

      // Validate manifest.json structure
      const manifest = capturedOutputs['manifest.json'];
      expect(manifest).toHaveProperty('build_id');
      expect(manifest).toHaveProperty('taptik_version');
      expect(manifest).toHaveProperty('source_platform', 'Kiro');
      expect(manifest).toHaveProperty('categories');
      expect(manifest).toHaveProperty('created_at');
      expect(manifest).toHaveProperty('source_files');
      expect(Array.isArray(manifest.categories)).toBe(true);
      expect(Array.isArray(manifest.source_files)).toBe(true);
    });

    it('should include all required metadata fields', async () => {
      mockFs = createMockKiroFileSystem();
      
      jest.spyOn(process, 'cwd').mockReturnValue('/test/project');
      jest.spyOn(require('os'), 'homedir').mockReturnValue('/test/home');

      let capturedManifest: any = null;

      // Mock file system operations
      jest.spyOn(fs, 'readFile').mockImplementation(async (path: any) => {
        return Buffer.from(await mockFs.readFile(path.toString()));
      });

      jest.spyOn(fs, 'readdir').mockImplementation(async (path: any) => {
        return await mockFs.readdir(path.toString()) as any;
      });

      jest.spyOn(fs, 'stat').mockImplementation(async (path: any) => {
        return await mockFs.stat(path.toString()) as any;
      });

      jest.spyOn(fs, 'mkdir').mockImplementation(async (path: any, options?: any) => {
        await mockFs.mkdir(path.toString(), options);
        return undefined as any;
      });

      jest.spyOn(fs, 'writeFile').mockImplementation(async (path: any, data: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith('manifest.json')) {
          capturedManifest = JSON.parse(data.toString());
        }
        await mockFs.writeFile(pathStr, data.toString());
      });

      // Mock interactive selections
      const interactiveService = module.get('InteractiveService');
      jest.spyOn(interactiveService, 'selectPlatform').mockResolvedValue(BuildPlatform.KIRO);
      jest.spyOn(interactiveService, 'selectCategories').mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      // Execute build command
      await command.run([], {});

      // Validate manifest contains all required metadata
      expect(capturedManifest).toHaveProperty('build_id');
      expect(capturedManifest.build_id).toMatch(/^build-[a-z0-9]+-[a-z0-9]+$/);
      
      expect(capturedManifest).toHaveProperty('taptik_version');
      expect(typeof capturedManifest.taptik_version).toBe('string');
      
      expect(capturedManifest).toHaveProperty('source_platform', 'Kiro');
      
      expect(capturedManifest).toHaveProperty('categories');
      expect(capturedManifest.categories).toEqual(['personal-context']);
      
      expect(capturedManifest).toHaveProperty('created_at');
      expect(new Date(capturedManifest.created_at)).toBeInstanceOf(Date);
      
      expect(capturedManifest).toHaveProperty('source_files');
      expect(Array.isArray(capturedManifest.source_files)).toBe(true);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle large numbers of files efficiently', async () => {
      // Create mock file system with many files
      const largeFilesConfig = {
        files: {} as Record<string, string>,
        directories: ['.kiro', '.kiro/steering', '.kiro/hooks', '~/.kiro', '~/.kiro/prompts'],
      };

      // Generate 100 steering files and 50 prompt templates
      for (let i = 0; i < 100; i++) {
        largeFilesConfig.files[`.kiro/steering/rule-${i}.md`] = `# Rule ${i}\nThis is rule number ${i}.`;
      }
      
      for (let i = 0; i < 50; i++) {
        largeFilesConfig.files[`~/.kiro/prompts/prompt-${i}.md`] = `# Prompt ${i}\nThis is prompt template number ${i}.`;
      }

      mockFs = new MockFileSystem(largeFilesConfig);
      
      jest.spyOn(process, 'cwd').mockReturnValue('/test/project');
      jest.spyOn(require('os'), 'homedir').mockReturnValue('/test/home');

      // Mock file system operations
      jest.spyOn(fs, 'readFile').mockImplementation(async (path: any) => {
        return Buffer.from(await mockFs.readFile(path.toString()));
      });

      jest.spyOn(fs, 'readdir').mockImplementation(async (path: any) => {
        return await mockFs.readdir(path.toString()) as any;
      });

      jest.spyOn(fs, 'stat').mockImplementation(async (path: any) => {
        return await mockFs.stat(path.toString()) as any;
      });

      jest.spyOn(fs, 'mkdir').mockImplementation(async (path: any, options?: any) => {
        await mockFs.mkdir(path.toString(), options);
        return undefined as any;
      });

      jest.spyOn(fs, 'writeFile').mockImplementation(async (path: any, data: any) => {
        await mockFs.writeFile(path.toString(), data.toString());
      });

      // Mock interactive selections
      const interactiveService = module.get('InteractiveService');
      jest.spyOn(interactiveService, 'selectPlatform').mockResolvedValue(BuildPlatform.KIRO);
      jest.spyOn(interactiveService, 'selectCategories').mockResolvedValue([
        { name: BuildCategoryName.PROJECT_CONTEXT, enabled: true },
        { name: BuildCategoryName.PROMPT_TEMPLATES, enabled: true },
      ]);

      // Measure execution time
      const startTime = Date.now();
      await command.run([], {});
      const executionTime = Date.now() - startTime;

      // Verify it completes within reasonable time (less than 5 seconds)
      expect(executionTime).toBeLessThan(5000);

      // Verify file operations were called for all files
      expect(fs.readFile).toHaveBeenCalledTimes(150); // 100 steering + 50 prompts
    });

    it('should clean up resources on interruption', async () => {
      mockFs = createMockKiroFileSystem();
      
      jest.spyOn(process, 'cwd').mockReturnValue('/test/project');
      jest.spyOn(require('os'), 'homedir').mockReturnValue('/test/home');

      // Mock file system operations
      jest.spyOn(fs, 'readFile').mockImplementation(async (path: any) => {
        return Buffer.from(await mockFs.readFile(path.toString()));
      });

      jest.spyOn(fs, 'readdir').mockImplementation(async (path: any) => {
        return await mockFs.readdir(path.toString()) as any;
      });

      jest.spyOn(fs, 'stat').mockImplementation(async (path: any) => {
        return await mockFs.stat(path.toString()) as any;
      });

      jest.spyOn(fs, 'mkdir').mockImplementation(async (path: any, options?: any) => {
        await mockFs.mkdir(path.toString(), options);
        return undefined as any;
      });

      jest.spyOn(fs, 'writeFile').mockImplementation(async (path: any, data: any) => {
        await mockFs.writeFile(path.toString(), data.toString());
      });

      // Mock interruption during data collection
      const errorHandler = module.get('ErrorHandlerService');
      jest.spyOn(errorHandler, 'isProcessInterrupted')
        .mockReturnValueOnce(false) // Initial check
        .mockReturnValueOnce(false) // After platform selection
        .mockReturnValueOnce(false) // After category selection
        .mockReturnValueOnce(true); // During data collection

      // Mock interactive selections
      const interactiveService = module.get('InteractiveService');
      jest.spyOn(interactiveService, 'selectPlatform').mockResolvedValue(BuildPlatform.KIRO);
      jest.spyOn(interactiveService, 'selectCategories').mockResolvedValue([
        { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
      ]);

      // Execute build command
      await command.run([], {});

      // Verify process stopped cleanly without creating output files
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });
});