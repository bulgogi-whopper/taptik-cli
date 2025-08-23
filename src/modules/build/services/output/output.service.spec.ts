import { Test, TestingModule } from '@nestjs/testing';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { 
  CloudMetadata, 
  SanitizationResult, 
  ValidationResult, 
  TaptikPackage 
} from '../../../context/interfaces/cloud.interface';
import { BuildConfig, BuildCategoryName, BuildPlatform } from '../../interfaces/build-config.interface';
import { SettingsData } from '../../interfaces/settings-data.interface';
import { TaptikPersonalContext, OutputFile } from '../../interfaces/taptik-format.interface';

import { OutputService } from './output.service';

describe('OutputService', () => {
  let service: OutputService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OutputService],
    }).compile();

    service = module.get<OutputService>(OutputService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate timestamp in correct format', () => {
    const timestamp = service['generateTimestamp']();
    expect(timestamp).toMatch(/^\d{8}-\d{6}$/);
    
    // Verify timestamp components
    const parts = timestamp.split('-');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveLength(8); // YYYYMMDD
    expect(parts[1]).toHaveLength(6); // HHMMSS
  });

  it('should check directory existence', async () => {
    const exists = await service['directoryExists']('/nonexistent/path');
    expect(exists).toBe(false);
  });

  describe('createOutputDirectory', () => {
    it('should generate valid directory name format', async () => {
      // Mock the directory existence check to avoid actual file system operations
      const originalDirectoryExists = service['directoryExists'];
      service['directoryExists'] = vi.fn().mockResolvedValue(false);

      // Mock fs.mkdir to avoid actual directory creation
      const mockMkdir = vi.fn().mockResolvedValue(undefined);
      const fs = await import('node:fs');
      vi.spyOn(fs.promises, 'mkdir').mockImplementation(mockMkdir);

      const outputPath = await service.createOutputDirectory();
      
      expect(outputPath).toMatch(/taptik-build-\d{8}-\d{6}$/);
      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringMatching(/taptik-build-\d{8}-\d{6}$/),
        { recursive: true }
      );

      // Restore original method
      service['directoryExists'] = originalDirectoryExists;
    });

    it('should handle directory conflicts with incremental numbering', async () => {
      // Mock directory existence to return true for first call, false for second
      let callCount = 0;
      service['directoryExists'] = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1; // First call returns true (conflict), second returns false
      });

      // Mock fs.mkdir
      const mockMkdir = vi.fn().mockResolvedValue(undefined);
      const fs = await import('node:fs');
      vi.spyOn(fs.promises, 'mkdir').mockImplementation(mockMkdir);

      const outputPath = await service.createOutputDirectory();
      
      expect(outputPath).toMatch(/taptik-build-\d{8}-\d{6}-1$/);
      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringMatching(/taptik-build-\d{8}-\d{6}-1$/),
        { recursive: true }
      );
    });

    it('should throw error after too many conflict resolution attempts', async () => {
      // Mock directory existence to always return true (always conflict)
      service['directoryExists'] = vi.fn().mockResolvedValue(true);

      await expect(service.createOutputDirectory()).rejects.toThrow(
        'Unable to create unique directory after 1000 attempts'
      );
    });

    it('should handle file system errors', async () => {
      // Mock directory existence check to return false
      service['directoryExists'] = vi.fn().mockResolvedValue(false);

      // Mock fs.mkdir to throw an error
      const mockMkdir = vi.fn().mockRejectedValue(new Error('Permission denied'));
      const fs = await import('node:fs');
      vi.spyOn(fs.promises, 'mkdir').mockImplementation(mockMkdir);

      await expect(service.createOutputDirectory()).rejects.toThrow(
        'File system error when creating output directory'
      );
    });
  });

  describe('writeOutputFiles', () => {
    it('should return empty array when no files provided', async () => {
      const mockOutputPath = '/test/path';
      
      const result = await service.writeOutputFiles(mockOutputPath);
      
      expect(result).toEqual([]);
    });

    it('should write personal context file when provided', async () => {
      const mockOutputPath = '/test/path';
      const mockPersonalContext: TaptikPersonalContext = {
        user_id: 'test-user',
        preferences: {
          preferred_languages: ['TypeScript'],
          coding_style: {
            indentation: '2 spaces',
            naming_convention: 'camelCase',
            comment_style: 'JSDoc',
            code_organization: 'feature-based',
          },
          tools_and_frameworks: ['NestJS'],
          development_environment: ['VSCode'],
        },
        work_style: {
          preferred_workflow: 'agile',
          problem_solving_approach: 'incremental',
          documentation_level: 'comprehensive',
          testing_approach: 'unit-first',
        },
        communication: {
          preferred_explanation_style: 'detailed',
          technical_depth: 'expert',
          feedback_style: 'direct',
        },
        metadata: {
          source_platform: 'kiro',
          created_at: '2025-01-04T10:30:00Z',
          version: '1.0.0',
        },
      };

      // Mock fs operations
      const mockWriteFile = vi.fn().mockResolvedValue(undefined);
      const mockStat = vi.fn().mockResolvedValue({ size: 1024 });
      const fs = await import('node:fs');
      vi.spyOn(fs.promises, 'writeFile').mockImplementation(mockWriteFile);
      vi.spyOn(fs.promises, 'stat').mockImplementation(mockStat);

      const result = await service.writeOutputFiles(mockOutputPath, mockPersonalContext);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        filename: 'personal-context.json',
        category: 'personal-context',
        size: 1024,
      });
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/path/personal-context.json',
        expect.stringContaining('"user_id": "test-user"'),
        'utf8'
      );
    });
  });

  describe('generateManifest', () => {
    it('should generate manifest with correct metadata', async () => {
      const mockOutputPath = '/test/output';
      const mockConfig: BuildConfig = {
        platform: BuildPlatform.KIRO,
        categories: [
          { name: BuildCategoryName.PERSONAL_CONTEXT, enabled: true },
          { name: BuildCategoryName.PROJECT_CONTEXT, enabled: false },
        ],
        outputDirectory: '/test/output',
        timestamp: '2025-01-04T10:30:00Z',
        buildId: 'build-123',
      };
      
      const mockSettingsData: SettingsData = {
        localSettings: {
          steeringFiles: [],
          hooks: [],
        },
        globalSettings: {
          globalPrompts: [],
        },
        collectionMetadata: {
          sourcePlatform: 'kiro',
          collectionTimestamp: '2025-01-04T10:30:00Z',
          projectPath: '/test/project',
          globalPath: '/home/.kiro',
          warnings: [],
          errors: [],
        },
      };

      const mockOutputFiles = [
        { filename: 'personal-context.json', category: 'personal-context', size: 1024 },
      ];

      // Mock fs operations
      const mockWriteFile = vi.fn().mockResolvedValue(undefined);
      const mockStat = vi.fn().mockResolvedValue({ size: 512 });
      const fs = await import('node:fs');
      vi.spyOn(fs.promises, 'writeFile').mockImplementation(mockWriteFile);
      vi.spyOn(fs.promises, 'stat').mockImplementation(mockStat);

      await service.generateManifest(mockOutputPath, mockConfig, mockSettingsData, mockOutputFiles);

      const manifestContent = mockWriteFile.mock.calls[0][1];
      expect(manifestContent).toContain('"source_platform": "kiro"');
      expect(manifestContent).toContain('"personal-context"');
      expect(manifestContent).toContain('"taptik_version": "1.0.0"');
      expect(manifestContent).toContain('"build_id"');
      expect(manifestContent).toContain('"created_at"');
    });
  });

  describe('generateBuildId', () => {
    it('should generate unique build IDs', () => {
      const id1 = service['generateBuildId']();
      const id2 = service['generateBuildId']();
      
      expect(id1).toMatch(/^build(?:-[\da-z]+){2}$/);
      expect(id2).toMatch(/^build(?:-[\da-z]+){2}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('file existence checks', () => {
    it('should check file existence correctly', async () => {
      const existsResult = await service['fileExists']('/nonexistent/file.txt');
      expect(existsResult).toBe(false);
    });
  });

  describe('displayBuildSummary', () => {
    const mockOutputFiles = [
      { filename: 'personal-context.json', category: 'personal-context', size: 1024 },
      { filename: 'project-context.json', category: 'project-context', size: 2048 },
    ];

    it('should display comprehensive build summary with warnings and errors', async () => {
      const outputPath = '/test/output';
      const warnings = ['Warning 1', 'Warning 2'];
      const errors = ['Error 1'];
      const buildTime = 2500;

      // Mock file existence and stats
      const mockStat = vi.fn().mockResolvedValue({ size: 512 });
      const fs = await import('node:fs');
      vi.spyOn(fs.promises, 'stat').mockImplementation(mockStat);
      service['fileExists'] = vi.fn().mockResolvedValue(true);

      await service.displayBuildSummary(outputPath, mockOutputFiles, warnings, errors, buildTime);

      // Basic verification that the method executes without errors
      expect(service).toBeDefined();
    });

    it('should display build summary without warnings and errors', async () => {
      const outputPath = '/test/output';
      
      // Mock file existence
      service['fileExists'] = vi.fn().mockResolvedValue(false);

      await service.displayBuildSummary(outputPath, mockOutputFiles);

      // Basic verification that the method executes without errors
      expect(service).toBeDefined();
    });

    it('should handle empty output files gracefully', async () => {
      const outputPath = '/test/output';
      const emptyOutputFiles: OutputFile[] = [];
      
      service['fileExists'] = vi.fn().mockResolvedValue(false);

      await service.displayBuildSummary(outputPath, emptyOutputFiles);

      expect(service).toBeDefined();
    });

    it('should handle display errors gracefully', async () => {
      const outputPath = '/test/output';
      const mockOutputFiles = [
        { filename: 'test.json', category: 'test', size: 1024 },
      ];
      
      // Mock file existence to throw an error
      service['fileExists'] = vi.fn().mockRejectedValue(new Error('File access error'));

      // Should not throw error - build summary errors are non-critical
      await expect(service.displayBuildSummary(outputPath, mockOutputFiles)).resolves.toBeUndefined();
    });
  });

  describe('writeCloudMetadata', () => {
    it('should write cloud metadata to file', async () => {
      const outputPath = '/test/output';
      const mockMetadata: CloudMetadata = {
        title: 'Test Claude Code Configuration',
        description: 'Test configuration for Claude Code',
        tags: ['test', 'claude-code'],
        author: 'test-user',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        sourceIde: 'claude-code',
        targetIdes: ['claude-code', 'cursor'],
        complexityLevel: 'intermediate',
        componentCount: {
          agents: 2,
          commands: 3,
          mcpServers: 1,
          steeringRules: 4,
          instructions: 2
        },
        features: ['mcp', 'agents', 'commands'],
        compatibility: ['claude-code-v1', 'cursor-v2'],
        searchKeywords: ['ai', 'development', 'claude'],
        fileSize: 1024,
        checksum: 'abc123',
        isPublic: true
      };

      // Mock fs operations
      const mockWriteFile = vi.fn().mockResolvedValue(undefined);
      const mockAccess = vi.fn().mockResolvedValue(undefined);
      const mockStat = vi.fn().mockResolvedValue({ size: 512 });
      const fs = await import('node:fs');
      vi.spyOn(fs.promises, 'writeFile').mockImplementation(mockWriteFile);
      vi.spyOn(fs.promises, 'access').mockImplementation(mockAccess);
      vi.spyOn(fs.promises, 'stat').mockImplementation(mockStat);

      const result = await service.writeCloudMetadata(outputPath, mockMetadata);
      
      expect(result).toBeDefined();
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('cloud-metadata.json'),
        expect.stringContaining('"title": "Test Claude Code Configuration"'),
        'utf8'
      );
    });

    it('should handle errors when writing cloud metadata', async () => {
      const outputPath = '/test/output';
      const mockMetadata: CloudMetadata = {
        title: 'Test Configuration',
        tags: [],
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        sourceIde: 'claude-code',
        targetIdes: ['claude-code'],
        complexityLevel: 'basic',
        componentCount: {
          agents: 0,
          commands: 0,
          mcpServers: 0,
          steeringRules: 0,
          instructions: 0
        },
        features: [],
        compatibility: [],
        searchKeywords: [],
        fileSize: 0,
        checksum: ''
      };

      // Mock fs operations - access succeeds but writeFile fails
      const fs = await import('node:fs');
      vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
      vi.spyOn(fs.promises, 'writeFile').mockRejectedValue(new Error('Write failed'));

      await expect(service.writeCloudMetadata(outputPath, mockMetadata))
        .rejects.toThrow();
    });
  });

  describe('writeSanitizationReport', () => {
    it('should write sanitization report to file', async () => {
      const outputPath = '/test/output';
      const mockSanitizationResult: SanitizationResult = {
        sanitizedData: { test: 'data' },
        securityLevel: 'safe',
        findings: ['Removed API key from configuration'],
        report: {
          totalFields: 100,
          sanitizedFields: 5,
          safeFields: 95,
          timestamp: new Date(),
          summary: 'Configuration sanitized successfully',
          processingTimeMs: 150,
          detailedFindings: [
            {
              category: 'credentials',
              severity: 'high',
              count: 2,
              path: '.claude/settings.json'
            }
          ]
        },
        severityBreakdown: {
          safe: 95,
          low: 3,
          medium: 1,
          critical: 1
        },
        recommendations: ['Review API key management', 'Use environment variables']
      };

      // Mock fs operations
      const mockWriteFile = vi.fn().mockResolvedValue(undefined);
      const mockAccess = vi.fn().mockResolvedValue(undefined);
      const mockStat = vi.fn().mockResolvedValue({ size: 256 });
      const fs = await import('node:fs');
      vi.spyOn(fs.promises, 'writeFile').mockImplementation(mockWriteFile);
      vi.spyOn(fs.promises, 'access').mockImplementation(mockAccess);
      vi.spyOn(fs.promises, 'stat').mockImplementation(mockStat);

      const result = await service.writeSanitizationReport(outputPath, mockSanitizationResult);
      
      expect(result).toBeDefined();
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('sanitization-report.json'),
        expect.any(String),
        'utf8'
      );
    });

    it('should handle empty sanitization report', async () => {
      const outputPath = '/test/output';
      const mockSanitizationResult: SanitizationResult = {
        sanitizedData: {},
        securityLevel: 'safe',
        findings: [],
        report: {
          totalFields: 0,
          sanitizedFields: 0,
          safeFields: 0,
          timestamp: new Date(),
          summary: 'No sanitization needed'
        }
      };

      // Mock fs operations
      const mockWriteFile = vi.fn().mockResolvedValue(undefined);
      const mockAccess = vi.fn().mockResolvedValue(undefined);
      const fs = await import('node:fs');
      vi.spyOn(fs.promises, 'writeFile').mockImplementation(mockWriteFile);
      vi.spyOn(fs.promises, 'access').mockImplementation(mockAccess);
      vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 100 } as any);

      const result = await service.writeSanitizationReport(outputPath, mockSanitizationResult);
      
      expect(result).toBeDefined();
    });
  });

  describe('writeValidationReport', () => {
    it('should write validation report to file', async () => {
      const outputPath = '/test/output';
      const mockValidationResult: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: ['Consider upgrading to latest schema'],
        cloudCompatible: true,
        schemaCompliant: true,
        sizeLimit: {
          current: 1024,
          maximum: 10240,
          withinLimit: true
        },
        featureSupport: {
          ide: 'claude-code',
          supported: ['mcp', 'agents', 'commands'],
          unsupported: ['advanced-hooks']
        },
        recommendations: ['Add more metadata for better discoverability']
      };

      // Mock fs operations
      const mockWriteFile = vi.fn().mockResolvedValue(undefined);
      const mockAccess = vi.fn().mockResolvedValue(undefined);
      const mockStat = vi.fn().mockResolvedValue({ size: 128 });
      const fs = await import('node:fs');
      vi.spyOn(fs.promises, 'writeFile').mockImplementation(mockWriteFile);
      vi.spyOn(fs.promises, 'access').mockImplementation(mockAccess);
      vi.spyOn(fs.promises, 'stat').mockImplementation(mockStat);

      const result = await service.writeValidationReport(outputPath, mockValidationResult);
      
      expect(result).toBeDefined();
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('validation-report.json'),
        expect.any(String),
        'utf8'
      );
    });

    it('should handle validation errors in report', async () => {
      const outputPath = '/test/output';
      const mockValidationResult: ValidationResult = {
        isValid: false,
        errors: ['Schema validation failed', 'Required field missing'],
        warnings: [],
        cloudCompatible: false,
        schemaCompliant: false,
        sizeLimit: {
          current: 20480,
          maximum: 10240,
          withinLimit: false
        },
        featureSupport: {
          ide: 'claude-code',
          supported: [],
          unsupported: ['mcp', 'agents']
        },
        recommendations: ['Fix schema errors', 'Reduce package size']
      };

      // Mock fs operations
      const mockWriteFile = vi.fn().mockResolvedValue(undefined);
      const mockAccess = vi.fn().mockResolvedValue(undefined);
      const mockStat = vi.fn().mockResolvedValue({ size: 200 });
      const fs = await import('node:fs');
      vi.spyOn(fs.promises, 'writeFile').mockImplementation(mockWriteFile);
      vi.spyOn(fs.promises, 'access').mockImplementation(mockAccess);
      vi.spyOn(fs.promises, 'stat').mockImplementation(mockStat);

      const result = await service.writeValidationReport(outputPath, mockValidationResult);
      
      expect(result).toBeDefined();
    });
  });

  describe('displayBuildSummary with cloud features', () => {
    it('should display cloud package information in build summary', async () => {
      const outputPath = '/test/output';
      const mockOutputFiles = [
        { filename: 'personal-context.json', category: 'personal-context', size: 1024 },
        { filename: 'project-context.json', category: 'project-context', size: 2048 },
        { filename: 'cloud-metadata.json', category: 'cloud-metadata', size: 512 },
        { filename: 'sanitization-report.json', category: 'sanitization-report', size: 256 }
      ];
      const mockCloudPackage: TaptikPackage = {
        metadata: {
          title: 'Test Package',
          tags: ['test'],
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          complexityLevel: 'basic',
          componentCount: {
            agents: 1,
            commands: 2,
            mcpServers: 0,
            steeringRules: 3,
            instructions: 1
          },
          features: ['basic'],
          compatibility: ['claude-code-v1'],
          searchKeywords: ['test'],
          fileSize: 3840,
          checksum: 'test-checksum'
        },
        sanitizedConfig: {
          version: '1.0',
          sourceIde: 'claude-code',
          targetIdes: ['claude-code'],
          data: {},
          metadata: {
            timestamp: new Date().toISOString()
          }
        },
        checksum: 'test-checksum',
        format: 'taptik-v1',
        compression: 'gzip',
        size: 3840,
        manifest: {
          files: ['test.json'],
          directories: ['.claude'],
          totalSize: 3840
        }
      };

      // Mock file existence
      service['fileExists'] = vi.fn().mockResolvedValue(true);

      // Mock fs.stat
      const fs = await import('node:fs');
      vi.spyOn(fs.promises, 'stat').mockResolvedValue({ 
        size: 512,
        mtime: new Date(),
        isFile: () => true,
        isDirectory: () => false 
      } as any);

      // This test expects the enhanced displayBuildSummary to handle cloud package
      // It will fail as the method doesn't have cloud support yet (RED phase)
      await expect(
        (service as any).displayBuildSummary(outputPath, mockOutputFiles, [], [], 1000, mockCloudPackage)
      ).resolves.toBeUndefined();
    });

    it('should handle cloud-ready output directory structure', async () => {
      const outputPath = '/test/output';
      
      // Mock fs.mkdir and fs.access
      const mockMkdir = vi.fn().mockResolvedValue(undefined);
      const mockAccess = vi.fn().mockResolvedValue(undefined);
      const fs = await import('node:fs');
      vi.spyOn(fs.promises, 'mkdir').mockImplementation(mockMkdir);
      vi.spyOn(fs.promises, 'access').mockImplementation(mockAccess);
      
      const cloudStructure = await service.createCloudReadyOutputStructure(outputPath);
      
      expect(cloudStructure).toBeDefined();
      expect(cloudStructure.directories).toContain('cloud');
      expect(cloudStructure.directories).toContain('reports');
      expect(cloudStructure.directories).toContain('metadata');
      expect(cloudStructure.paths).toBeDefined();
      expect(cloudStructure.paths.cloud).toBe('/test/output/cloud');
      expect(cloudStructure.paths.reports).toBe('/test/output/reports');
      expect(cloudStructure.paths.metadata).toBe('/test/output/metadata');
      expect(mockMkdir).toHaveBeenCalledTimes(3);
    });
  });

  describe('helper methods for summary', () => {
    it('should format bytes correctly', () => {
      const formatBytes = (service as any).formatBytes.bind(service);
      
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should format durations correctly', () => {
      const formatDuration = (service as any).formatDuration.bind(service);

      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(1500)).toBe('1s');
      expect(formatDuration(30_000)).toBe('30s');
      expect(formatDuration(90_000)).toBe('1m 30s');
      expect(formatDuration(125_000)).toBe('2m 5s');
    });

    it('should display issues summary correctly', () => {
      const displayIssuesSummary = (service as any).displayIssuesSummary.bind(service);
      const warnings = ['Test warning'];
      const errors = ['Test error'];

      // Should execute without throwing errors
      expect(() => displayIssuesSummary(warnings, errors)).not.toThrow();
      expect(() => displayIssuesSummary([], [])).not.toThrow();
    });
  });
});