import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import { CursorDeploymentOptions, CursorComponentType } from '../interfaces/cursor-deployment.interface';
import { 
  ReverseConversionMetadataService, 
  ConversionMetadata, 
  ChangeDetectionResult,
  ReverseConversionOptions,
  ReverseConversionResult 
} from './reverse-conversion-metadata.service';

describe('ReverseConversionMetadataService', () => {
  let service: ReverseConversionMetadataService;

  const mockContext: TaptikContext = {
    metadata: {
      projectName: 'test-project',
      version: '1.0.0',
      description: 'Test project',
      author: 'Test Author',
      repository: 'https://github.com/test/project',
      license: 'MIT',
      platforms: ['cursor'],
      tags: ['test'],
      lastModified: new Date().toISOString(),
      configVersion: '2.0.0',
    },
    personalContext: {
      userPreferences: {
        theme: 'dark',
        language: 'typescript',
        editorSettings: {
          fontSize: 14,
          fontFamily: 'JetBrains Mono',
          lineHeight: 1.5,
          wordWrap: true,
        },
        shortcuts: [],
      },
      aiSettings: {
        model: 'claude-3.5-sonnet',
        temperature: 0.7,
        maxTokens: 4000,
        systemPrompt: 'You are a helpful assistant.',
      },
      workspacePreferences: {
        autoSave: true,
        formatOnSave: true,
        lintOnSave: true,
        showWhitespace: false,
      },
    },
    projectContext: {
      buildTool: 'pnpm',
      testFramework: 'vitest',
      linter: 'eslint',
      formatter: 'prettier',
      packageManager: 'pnpm',
      nodeVersion: '18.0.0',
      scripts: {
        build: 'pnpm run build',
        test: 'pnpm run test',
      },
      dependencies: ['@nestjs/core'],
      devDependencies: ['typescript'],
      workspaceStructure: {
        srcDir: 'src',
        testDir: 'test',
        buildDir: 'dist',
        configFiles: ['tsconfig.json'],
      },
    },
    promptContext: {
      rules: ['Use TypeScript', 'Write tests'],
      context: 'Test project context',
      examples: [
        {
          title: 'Example',
          code: 'console.log("test");',
        },
      ],
      workflows: [],
    },
  };

  const mockDeploymentOptions: CursorDeploymentOptions = {
    workspacePath: '/test/workspace',
    components: ['ai-config', 'workspace-settings'],
    conflictStrategy: 'merge',
    backupEnabled: true,
    validationEnabled: true,
    securityScanEnabled: true,
    dryRun: false,
  };

  const mockDeployedFiles = [
    { path: '/test/workspace/.cursorrules', component: 'ai-config' as CursorComponentType, type: 'rules' },
    { path: '/test/workspace/.cursor/settings.json', component: 'workspace-settings' as CursorComponentType, type: 'settings' },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReverseConversionMetadataService],
    }).compile();

    service = module.get<ReverseConversionMetadataService>(ReverseConversionMetadataService);

    // Mock filesystem operations
    vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    vi.spyOn(fs, 'readFile').mockImplementation(async (filePath: string) => {
      if (filePath.toString().includes('.cursorrules')) {
        return 'Use TypeScript\nWrite tests';
      }
      if (filePath.toString().includes('settings.json')) {
        return JSON.stringify({ 'editor.fontSize': 14, 'workbench.colorTheme': 'Dark+' });
      }
      return '{}';
    });
    vi.spyOn(fs, 'readdir').mockResolvedValue([]);
    vi.spyOn(fs, 'stat').mockResolvedValue({
      size: 1024,
      mtime: new Date(),
      isFile: () => true,
      isDirectory: () => false,
    } as any);
    vi.spyOn(fs, 'access').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createConversionMetadata', () => {
    it('should create conversion metadata successfully', async () => {
      const metadata = await service.createConversionMetadata(
        mockContext,
        mockDeploymentOptions,
        mockDeployedFiles,
      );

      expect(metadata).toBeDefined();
      expect(metadata.id).toBeDefined();
      expect(metadata.sourceFormat).toBe('taptik');
      expect(metadata.targetFormat).toBe('cursor');
      expect(metadata.originalFiles).toHaveLength(2);
      expect(metadata.transformationMap).toBeDefined();
      expect(metadata.componentMapping).toBeDefined();
      expect(metadata.integrity).toBeDefined();
    });

    it('should generate unique metadata IDs for different contexts', async () => {
      const metadata1 = await service.createConversionMetadata(
        mockContext,
        mockDeploymentOptions,
        mockDeployedFiles,
      );

      const differentContext = { ...mockContext, metadata: { ...mockContext.metadata, projectName: 'different-project' } };
      const metadata2 = await service.createConversionMetadata(
        differentContext,
        mockDeploymentOptions,
        mockDeployedFiles,
      );

      expect(metadata1.id).not.toBe(metadata2.id);
    });

    it('should include transformation mapping for known properties', async () => {
      const metadata = await service.createConversionMetadata(
        mockContext,
        mockDeploymentOptions,
        mockDeployedFiles,
      );

      expect(metadata.transformationMap).toHaveProperty('personalContext.userPreferences.theme');
      expect(metadata.transformationMap).toHaveProperty('promptContext.rules');
      
      const themeMapping = metadata.transformationMap['personalContext.userPreferences.theme'];
      expect(themeMapping.reversible).toBe(true);
      expect(themeMapping.transformationType).toBe('computed');
    });

    it('should calculate file hashes and metadata', async () => {
      const metadata = await service.createConversionMetadata(
        mockContext,
        mockDeploymentOptions,
        mockDeployedFiles,
      );

      expect(metadata.originalFiles).toHaveLength(2);
      
      const rulesFile = metadata.originalFiles.find(f => f.path.includes('.cursorrules'));
      expect(rulesFile).toBeDefined();
      expect(rulesFile!.hash).toBeDefined();
      expect(rulesFile!.size).toBeGreaterThan(0);
      expect(rulesFile!.component).toBe('ai-config');
    });

    it('should create component mapping correctly', async () => {
      const metadata = await service.createConversionMetadata(
        mockContext,
        mockDeploymentOptions,
        mockDeployedFiles,
      );

      expect(metadata.componentMapping).toHaveProperty('ai-config');
      expect(metadata.componentMapping).toHaveProperty('workspace-settings');
      
      const aiConfigMapping = metadata.componentMapping['ai-config'];
      expect(aiConfigMapping.originalComponents).toContain('promptContext');
      expect(aiConfigMapping.targetComponents).toContain('.cursorrules');
    });
  });

  describe('detectChanges', () => {
    it('should detect when files have been modified', async () => {
      // First create metadata
      const metadata = await service.createConversionMetadata(
        mockContext,
        mockDeploymentOptions,
        mockDeployedFiles,
      );

      // Mock file modification
      vi.spyOn(fs, 'readFile').mockImplementation(async (filePath: string) => {
        if (filePath.toString().includes('.cursorrules')) {
          return 'Use TypeScript\nWrite tests\nNew rule added'; // Modified content
        }
        return '{}';
      });

      // Mock stat to show newer modification time
      vi.spyOn(fs, 'stat').mockResolvedValue({
        size: 1200,
        mtime: new Date(Date.now() + 60000), // 1 minute newer
        isFile: () => true,
        isDirectory: () => false,
      } as any);

      const changes = await service.detectChanges('/test/workspace', metadata.id);

      expect(changes.hasChanges).toBe(true);
      expect(changes.changedFiles).toHaveLength(1);
      expect(changes.changedFiles[0].changeType).toBe('modified');
      expect(changes.changedFiles[0].component).toBe('ai-config');
      expect(changes.changedComponents).toContain('ai-config');
    });

    it('should detect when files have been deleted', async () => {
      const metadata = await service.createConversionMetadata(
        mockContext,
        mockDeploymentOptions,
        mockDeployedFiles,
      );

      // Mock file deletion
      vi.spyOn(fs, 'stat').mockRejectedValue(new Error('File not found'));

      const changes = await service.detectChanges('/test/workspace', metadata.id);

      expect(changes.hasChanges).toBe(true);
      expect(changes.changedFiles.some(f => f.changeType === 'deleted')).toBe(true);
    });

    it('should return no changes when files are unchanged', async () => {
      const metadata = await service.createConversionMetadata(
        mockContext,
        mockDeploymentOptions,
        mockDeployedFiles,
      );

      const changes = await service.detectChanges('/test/workspace', metadata.id);

      expect(changes.hasChanges).toBe(false);
      expect(changes.changedFiles).toHaveLength(0);
      expect(changes.incrementalUpdatePossible).toBe(true);
    });

    it('should determine when full sync is required', async () => {
      const metadata = await service.createConversionMetadata(
        mockContext,
        mockDeploymentOptions,
        mockDeployedFiles,
      );

      // Mock many file changes
      vi.spyOn(fs, 'readFile').mockImplementation(async () => 'modified content');
      vi.spyOn(fs, 'stat').mockResolvedValue({
        size: 2000,
        mtime: new Date(Date.now() + 60000),
        isFile: () => true,
        isDirectory: () => false,
      } as any);

      const changes = await service.detectChanges('/test/workspace', metadata.id);

      expect(changes.hasChanges).toBe(true);
      expect(changes.fullSyncRequired).toBe(true);
    });
  });

  describe('performReverseConversion', () => {
    it('should perform reverse conversion successfully', async () => {
      const metadata = await service.createConversionMetadata(
        mockContext,
        mockDeploymentOptions,
        mockDeployedFiles,
      );

      const options: ReverseConversionOptions = {
        targetPlatform: 'taptik',
        preserveMetadata: true,
        enableChangeDetection: true,
        incrementalUpdate: false,
        strictValidation: true,
        handleDataLoss: 'warn',
        conflictResolution: 'merge',
      };

      const result = await service.performReverseConversion(
        '/test/workspace',
        metadata.id,
        options,
      );

      expect(result.success).toBe(true);
      expect(result.convertedContext).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.performanceStats).toBeDefined();
      expect(result.performanceStats.conversionTime).toBeGreaterThan(0);
    });

    it('should skip conversion when no changes detected and incremental update enabled', async () => {
      const metadata = await service.createConversionMetadata(
        mockContext,
        mockDeploymentOptions,
        mockDeployedFiles,
      );

      const options: ReverseConversionOptions = {
        targetPlatform: 'taptik',
        preserveMetadata: true,
        enableChangeDetection: true,
        incrementalUpdate: true,
        strictValidation: true,
        handleDataLoss: 'warn',
        conflictResolution: 'merge',
      };

      const result = await service.performReverseConversion(
        '/test/workspace',
        metadata.id,
        options,
      );

      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.message.includes('No changes detected'))).toBe(true);
      expect(result.performanceStats.cacheHitRate).toBe(1.0);
    });

    it('should handle data loss according to options', async () => {
      const metadata = await service.createConversionMetadata(
        mockContext,
        mockDeploymentOptions,
        mockDeployedFiles,
      );

      // Mock transformation that causes data loss
      metadata.transformationMap['projectContext.dependencies'] = {
        sourceProperty: 'projectContext.dependencies',
        targetProperty: '.cursor/extensions.json:recommendations',
        transformationType: 'computed',
        reversible: false,
        lossyConversion: true,
      };

      const optionsError: ReverseConversionOptions = {
        targetPlatform: 'taptik',
        preserveMetadata: true,
        enableChangeDetection: false,
        incrementalUpdate: false,
        strictValidation: true,
        handleDataLoss: 'error',
        conflictResolution: 'merge',
      };

      const result = await service.performReverseConversion(
        '/test/workspace',
        metadata.id,
        optionsError,
      );

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.message.includes('Data loss detected'))).toBe(true);
    });

    it('should handle missing metadata gracefully', async () => {
      const options: ReverseConversionOptions = {
        targetPlatform: 'taptik',
        preserveMetadata: true,
        enableChangeDetection: true,
        incrementalUpdate: false,
        strictValidation: true,
        handleDataLoss: 'warn',
        conflictResolution: 'merge',
      };

      const result = await service.performReverseConversion(
        '/test/workspace',
        'non-existent-metadata',
        options,
      );

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.message.includes('not found'))).toBe(true);
    });
  });

  describe('loadConversionMetadata', () => {
    it('should load existing metadata successfully', async () => {
      const originalMetadata = await service.createConversionMetadata(
        mockContext,
        mockDeploymentOptions,
        mockDeployedFiles,
      );

      const loadedMetadata = await service.loadConversionMetadata(originalMetadata.id);

      expect(loadedMetadata).toBeDefined();
      expect(loadedMetadata!.id).toBe(originalMetadata.id);
      expect(loadedMetadata!.sourceFormat).toBe('taptik');
      expect(loadedMetadata!.targetFormat).toBe('cursor');
    });

    it('should return null for non-existent metadata', async () => {
      const loadedMetadata = await service.loadConversionMetadata('non-existent-id');

      expect(loadedMetadata).toBeNull();
    });
  });

  describe('listConversionMetadata', () => {
    it('should list available metadata files', async () => {
      // Create some metadata
      await service.createConversionMetadata(mockContext, mockDeploymentOptions, mockDeployedFiles);
      
      const differentContext = { ...mockContext, metadata: { ...mockContext.metadata, projectName: 'project2' } };
      await service.createConversionMetadata(differentContext, mockDeploymentOptions, mockDeployedFiles);

      // Mock readdir to return our metadata files
      vi.spyOn(fs, 'readdir').mockResolvedValue(['metadata1.json', 'metadata2.json'] as any);

      const metadataList = await service.listConversionMetadata();

      expect(metadataList).toHaveLength(2);
      expect(metadataList[0]).toHaveProperty('id');
      expect(metadataList[0]).toHaveProperty('timestamp');
      expect(metadataList[0]).toHaveProperty('sourceFormat');
      expect(metadataList[0]).toHaveProperty('targetFormat');
    });

    it('should handle empty metadata directory', async () => {
      vi.spyOn(fs, 'readdir').mockResolvedValue([]);

      const metadataList = await service.listConversionMetadata();

      expect(metadataList).toHaveLength(0);
    });
  });

  describe('cleanupOldMetadata', () => {
    it('should remove old metadata files', async () => {
      const unlinkSpy = vi.spyOn(fs, 'unlink').mockResolvedValue(undefined);
      
      // Mock old files
      vi.spyOn(fs, 'readdir').mockResolvedValue(['old1.json', 'old2.json', 'recent.json'] as any);
      vi.spyOn(fs, 'stat').mockImplementation(async (filePath: string) => {
        const isOld = filePath.toString().includes('old');
        return {
          mtime: new Date(Date.now() - (isOld ? 40 * 24 * 60 * 60 * 1000 : 5 * 24 * 60 * 60 * 1000)), // 40 days vs 5 days old
        } as any;
      });

      const cleanedCount = await service.cleanupOldMetadata(30 * 24 * 60 * 60 * 1000); // 30 days

      expect(cleanedCount).toBe(2);
      expect(unlinkSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle cleanup errors gracefully', async () => {
      vi.spyOn(fs, 'readdir').mockResolvedValue(['error.json'] as any);
      vi.spyOn(fs, 'stat').mockResolvedValue({
        mtime: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      } as any);
      vi.spyOn(fs, 'unlink').mockRejectedValue(new Error('Permission denied'));

      const cleanedCount = await service.cleanupOldMetadata();

      expect(cleanedCount).toBe(0); // No files successfully cleaned
    });
  });

  describe('transformation mapping', () => {
    it('should create correct transformation mappings', async () => {
      const metadata = await service.createConversionMetadata(
        mockContext,
        mockDeploymentOptions,
        mockDeployedFiles,
      );

      // Check theme transformation
      const themeMapping = metadata.transformationMap['personalContext.userPreferences.theme'];
      expect(themeMapping).toBeDefined();
      expect(themeMapping.sourceProperty).toBe('personalContext.userPreferences.theme');
      expect(themeMapping.targetProperty).toBe('.cursor/settings.json:workbench.colorTheme');
      expect(themeMapping.reversible).toBe(true);

      // Check AI rules transformation
      const rulesMapping = metadata.transformationMap['promptContext.rules'];
      expect(rulesMapping).toBeDefined();
      expect(rulesMapping.sourceProperty).toBe('promptContext.rules');
      expect(rulesMapping.targetProperty).toBe('.cursorrules');
      expect(rulesMapping.reversible).toBe(true);
    });

    it('should identify lossy conversions', async () => {
      const metadata = await service.createConversionMetadata(
        mockContext,
        mockDeploymentOptions,
        mockDeployedFiles,
      );

      const depsMapping = metadata.transformationMap['projectContext.dependencies'];
      expect(depsMapping).toBeDefined();
      expect(depsMapping.reversible).toBe(false);
      expect(depsMapping.lossyConversion).toBe(true);
    });
  });

  describe('component mapping', () => {
    it('should create correct component mappings', async () => {
      const metadata = await service.createConversionMetadata(
        mockContext,
        mockDeploymentOptions,
        mockDeployedFiles,
      );

      const aiConfigMapping = metadata.componentMapping['ai-config'];
      expect(aiConfigMapping.originalComponents).toContain('promptContext');
      expect(aiConfigMapping.targetComponents).toContain('.cursorrules');
      expect(aiConfigMapping.conversionNotes).toContain('AI rules converted to .cursorrules format');

      const workspaceMapping = metadata.componentMapping['workspace-settings'];
      expect(workspaceMapping.originalComponents).toContain('personalContext.userPreferences');
      expect(workspaceMapping.targetComponents).toContain('.cursor/settings.json');
    });
  });

  describe('integrity validation', () => {
    it('should calculate file checksums', async () => {
      const metadata = await service.createConversionMetadata(
        mockContext,
        mockDeploymentOptions,
        mockDeployedFiles,
      );

      expect(metadata.integrity.checksums).toBeDefined();
      expect(metadata.integrity.checksums['original-context']).toBeDefined();
      
      // Should have checksums for each deployed file
      for (const file of mockDeployedFiles) {
        expect(metadata.integrity.checksums[file.path]).toBeDefined();
      }
    });

    it('should include validation rules', async () => {
      const metadata = await service.createConversionMetadata(
        mockContext,
        mockDeploymentOptions,
        mockDeployedFiles,
      );

      expect(metadata.integrity.validationRules).toContain('Verify all file checksums match');
      expect(metadata.integrity.validationRules).toContain('Ensure no data loss in critical properties');
      expect(metadata.integrity.validationRules).toContain('Validate transformation reversibility');
    });
  });

  describe('error handling', () => {
    it('should handle filesystem errors during metadata creation', async () => {
      vi.spyOn(fs, 'writeFile').mockRejectedValue(new Error('Disk full'));

      await expect(
        service.createConversionMetadata(mockContext, mockDeploymentOptions, mockDeployedFiles),
      ).rejects.toThrow('Failed to create conversion metadata');
    });

    it('should handle filesystem errors during change detection', async () => {
      const metadata = await service.createConversionMetadata(
        mockContext,
        mockDeploymentOptions,
        mockDeployedFiles,
      );

      vi.spyOn(fs, 'readFile').mockRejectedValue(new Error('Permission denied'));

      await expect(
        service.detectChanges('/test/workspace', metadata.id),
      ).rejects.toThrow('Failed to detect changes');
    });
  });
});
