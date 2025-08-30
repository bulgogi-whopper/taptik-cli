import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { DeploymentResult, DeploymentError } from '../interfaces/deployment-result.interface';
import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import { 
  DeploymentReporterService, 
  DeploymentReport, 
  ReportingOptions 
} from './deployment-reporter.service';

describe('DeploymentReporterService', () => {
  let service: DeploymentReporterService;

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

  const mockSuccessResult: DeploymentResult = {
    success: true,
    deployedComponents: ['ai-config', 'workspace-settings'],
    skippedComponents: ['extensions'],
    summary: {
      filesDeployed: 5,
      filesSkipped: 1,
      conflictsResolved: 2,
      backupCreated: true,
    },
    errors: [],
    warnings: [
      { message: 'AI configuration contains large content', code: 'LARGE_AI_CONTENT' },
    ],
  };

  const mockFailureResult: DeploymentResult = {
    success: false,
    deployedComponents: ['workspace-settings'],
    skippedComponents: ['ai-config', 'extensions'],
    summary: {
      filesDeployed: 2,
      filesSkipped: 3,
      conflictsResolved: 0,
      backupCreated: true,
    },
    errors: [
      {
        component: 'ai-config',
        type: 'validation-error',
        severity: 'high',
        message: 'AI configuration contains invalid syntax',
        suggestion: 'Check .cursorrules file format',
      },
      {
        component: 'platform-detection',
        type: 'platform-error',
        severity: 'high',
        message: 'Cursor IDE not found',
        suggestion: 'Install Cursor IDE or specify path',
      },
    ],
    warnings: [
      { message: 'Some extensions may not be compatible', code: 'EXTENSION_COMPATIBILITY' },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DeploymentReporterService],
    }).compile();

    service = module.get<DeploymentReporterService>(DeploymentReporterService);

    // Mock filesystem operations
    vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    vi.spyOn(fs, 'readFile').mockResolvedValue('{}');
    vi.spyOn(fs, 'readdir').mockResolvedValue([]);
    vi.spyOn(fs, 'stat').mockResolvedValue({
      size: 1024,
      mtime: new Date(),
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateDeploymentReport', () => {
    it('should generate comprehensive deployment report for successful deployment', async () => {
      const report = await service.generateDeploymentReport(
        mockSuccessResult,
        'cursor-ide',
        mockContext,
        'test-context-id',
      );

      expect(report).toBeDefined();
      expect(report.id).toBeDefined();
      expect(report.platform).toBe('cursor-ide');
      expect(report.context.projectName).toBe('test-project');
      expect(report.summary.overall.status).toBe('success');
      expect(report.summary.components).toHaveLength(3); // 2 deployed + 1 skipped
      expect(report.recommendations).toBeDefined();
      expect(report.performance).toBeDefined();
      expect(report.analysis).toBeDefined();
    });

    it('should generate deployment report for failed deployment', async () => {
      const report = await service.generateDeploymentReport(
        mockFailureResult,
        'cursor-ide',
        mockContext,
        'test-context-id',
      );

      expect(report.summary.overall.status).toBe('partial');
      expect(report.analysis.riskFactors.length).toBeGreaterThan(0);
      expect(report.analysis.qualityScore).toBeLessThan(100);
    });

    it('should respect reporting options', async () => {
      const options: ReportingOptions = {
        includePerformance: false,
        includeAnalysis: false,
        includeArtifacts: false,
        exportFormat: 'json',
        saveToFile: false,
        verboseLevel: 'minimal',
      };

      const report = await service.generateDeploymentReport(
        mockSuccessResult,
        'cursor-ide',
        mockContext,
        'test-context-id',
        options,
      );

      expect(report.performance.phases).toHaveLength(0);
      expect(report.analysis.qualityScore).toBe(100);
      expect(report.artifacts.logs.deploymentLog).toBe('');
    });

    it('should save report to file when requested', async () => {
      const options: ReportingOptions = {
        includePerformance: true,
        includeAnalysis: true,
        includeArtifacts: true,
        exportFormat: 'json',
        saveToFile: true,
        verboseLevel: 'standard',
      };

      await service.generateDeploymentReport(
        mockSuccessResult,
        'cursor-ide',
        mockContext,
        'test-context-id',
        options,
      );

      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should include platform-specific information for Cursor IDE', async () => {
      const report = await service.generateDeploymentReport(
        mockSuccessResult,
        'cursor-ide',
        mockContext,
        'test-context-id',
      );

      expect(report.summary.platformSpecific.cursorVersion).toBeDefined();
      expect(report.summary.platformSpecific.aiConfigDeployed).toBe(true);
    });

    it('should calculate quality score based on errors and warnings', async () => {
      const report = await service.generateDeploymentReport(
        mockFailureResult,
        'cursor-ide',
        mockContext,
        'test-context-id',
      );

      // With 2 errors and 1 warning: 100 - (2*20) - (1*5) = 55
      expect(report.analysis.qualityScore).toBe(55);
    });
  });

  describe('generateFailureAnalysis', () => {
    it('should generate detailed failure analysis', async () => {
      const analysis = await service.generateFailureAnalysis(
        mockFailureResult,
        'cursor-ide',
        { workspacePath: '/test/workspace' },
      );

      expect(analysis.rootCauses).toHaveLength(2);
      expect(analysis.recoveryPlan.length).toBeGreaterThan(0);
      expect(analysis.preventionMeasures.length).toBeGreaterThan(0);
      expect(analysis.similarIncidents).toBeDefined();
    });

    it('should categorize errors correctly', async () => {
      const analysis = await service.generateFailureAnalysis(
        mockFailureResult,
        'cursor-ide',
      );

      const validationError = analysis.rootCauses.find(rc => 
        rc.error.type === 'validation-error'
      );
      expect(validationError?.category).toBe('validation');

      const platformError = analysis.rootCauses.find(rc => 
        rc.error.type === 'platform-error'
      );
      expect(platformError?.category).toBe('missing-resource');
    });

    it('should assess error impact correctly', async () => {
      const analysis = await service.generateFailureAnalysis(
        mockFailureResult,
        'cursor-ide',
      );

      // High severity errors in failed deployment should have critical impact
      const criticalErrors = analysis.rootCauses.filter(rc => rc.impact === 'critical');
      expect(criticalErrors.length).toBeGreaterThan(0);
    });

    it('should provide recovery plan with appropriate steps', async () => {
      const analysis = await service.generateFailureAnalysis(
        mockFailureResult,
        'cursor-ide',
      );

      expect(analysis.recoveryPlan).toHaveLength(3);
      expect(analysis.recoveryPlan[0].step).toBe(1);
      expect(analysis.recoveryPlan[0].action).toContain('root cause');
      expect(analysis.recoveryPlan[0].timeEstimate).toBeDefined();
      expect(analysis.recoveryPlan[0].riskLevel).toBeDefined();
    });

    it('should provide platform-specific prevention measures', async () => {
      const analysis = await service.generateFailureAnalysis(
        mockFailureResult,
        'cursor-ide',
      );

      const cursorSpecificMeasures = analysis.preventionMeasures.filter(measure =>
        measure.toLowerCase().includes('cursor')
      );
      expect(cursorSpecificMeasures.length).toBeGreaterThan(0);
    });
  });

  describe('formatReportForConsole', () => {
    it('should format successful deployment report for console', async () => {
      const report = await service.generateDeploymentReport(
        mockSuccessResult,
        'cursor-ide',
        mockContext,
        'test-context-id',
      );

      const formatted = service.formatReportForConsole(report, 'standard');

      expect(formatted).toContain('Deployment Report - CURSOR-IDE');
      expect(formatted).toContain('✅ SUCCESS');
      expect(formatted).toContain('📋 DEPLOYMENT SUMMARY');
      expect(formatted).toContain('test-project');
      expect(formatted).toContain('💡 RECOMMENDATIONS');
    });

    it('should format failed deployment report with analysis', async () => {
      const report = await service.generateDeploymentReport(
        mockFailureResult,
        'cursor-ide',
        mockContext,
        'test-context-id',
      );

      const formatted = service.formatReportForConsole(report, 'detailed');

      expect(formatted).toContain('⚠️ PARTIAL');
      expect(formatted).toContain('📈 QUALITY ANALYSIS');
      expect(formatted).toContain('🧩 COMPONENTS DETAIL');
      expect(formatted).toContain('⚡ PERFORMANCE METRICS');
    });

    it('should adjust verbosity level correctly', async () => {
      const report = await service.generateDeploymentReport(
        mockSuccessResult,
        'cursor-ide',
        mockContext,
        'test-context-id',
      );

      const minimal = service.formatReportForConsole(report, 'minimal');
      const detailed = service.formatReportForConsole(report, 'detailed');

      expect(detailed.length).toBeGreaterThan(minimal.length);
      expect(detailed).toContain('🧩 COMPONENTS DETAIL');
      expect(minimal).not.toContain('🧩 COMPONENTS DETAIL');
    });

    it('should include security issues when present', async () => {
      const reportWithSecurity = await service.generateDeploymentReport(
        mockFailureResult,
        'cursor-ide',
        mockContext,
        'test-context-id',
      );

      // Mock security vulnerabilities
      reportWithSecurity.analysis.security.vulnerabilities = [
        {
          type: 'Insecure Configuration',
          severity: 'high',
          description: 'AI configuration contains sensitive data',
          recommendation: 'Remove sensitive information from AI rules',
        },
      ];

      const formatted = service.formatReportForConsole(reportWithSecurity, 'detailed');

      expect(formatted).toContain('🔒 Security Issues');
      expect(formatted).toContain('🔴 Insecure Configuration');
    });
  });

  describe('formatFailureAnalysisForConsole', () => {
    it('should format failure analysis for console display', async () => {
      const analysis = await service.generateFailureAnalysis(
        mockFailureResult,
        'cursor-ide',
      );

      const formatted = service.formatFailureAnalysisForConsole(analysis);

      expect(formatted).toContain('🔍 FAILURE ANALYSIS REPORT');
      expect(formatted).toContain('🎯 ROOT CAUSES');
      expect(formatted).toContain('🛠️  RECOVERY PLAN');
      expect(formatted).toContain('🛡️  PREVENTION MEASURES');
    });

    it('should include impact indicators for root causes', async () => {
      const analysis = await service.generateFailureAnalysis(
        mockFailureResult,
        'cursor-ide',
      );

      const formatted = service.formatFailureAnalysisForConsole(analysis);

      expect(formatted).toMatch(/[🚨🔴🟡🟢]/); // Should contain impact emojis
    });

    it('should show risk levels for recovery steps', async () => {
      const analysis = await service.generateFailureAnalysis(
        mockFailureResult,
        'cursor-ide',
      );

      const formatted = service.formatFailureAnalysisForConsole(analysis);

      expect(formatted).toMatch(/[🔴🟡🟢]/); // Should contain risk level emojis
    });
  });

  describe('exportReport', () => {
    it('should export report to JSON format', async () => {
      const report = await service.generateDeploymentReport(
        mockSuccessResult,
        'cursor-ide',
        mockContext,
        'test-context-id',
      );

      const filePath = await service.exportReport(report, 'json');

      expect(filePath).toContain('.json');
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.json'),
        expect.stringContaining('"platform":"cursor-ide"'),
        'utf8',
      );
    });

    it('should export report to HTML format', async () => {
      const report = await service.generateDeploymentReport(
        mockSuccessResult,
        'cursor-ide',
        mockContext,
        'test-context-id',
      );

      const filePath = await service.exportReport(report, 'html');

      expect(filePath).toContain('.html');
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.html'),
        expect.stringContaining('<!DOCTYPE html>'),
        'utf8',
      );
    });

    it('should export report to Markdown format', async () => {
      const report = await service.generateDeploymentReport(
        mockSuccessResult,
        'cursor-ide',
        mockContext,
        'test-context-id',
      );

      const filePath = await service.exportReport(report, 'markdown');

      expect(filePath).toContain('.md');
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.md'),
        expect.stringContaining('# Deployment Report'),
        'utf8',
      );
    });

    it('should throw error for unsupported format', async () => {
      const report = await service.generateDeploymentReport(
        mockSuccessResult,
        'cursor-ide',
        mockContext,
        'test-context-id',
      );

      await expect(
        service.exportReport(report, 'xml' as any),
      ).rejects.toThrow('Unsupported export format: xml');
    });

    it('should use custom output path when provided', async () => {
      const report = await service.generateDeploymentReport(
        mockSuccessResult,
        'cursor-ide',
        mockContext,
        'test-context-id',
      );

      const customPath = '/custom/path';
      await service.exportReport(report, 'json', customPath);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('/custom/path/'),
        expect.any(String),
        'utf8',
      );
    });
  });

  describe('getReportsHistory', () => {
    it('should return reports history', async () => {
      vi.spyOn(fs, 'readdir').mockResolvedValue([
        'deployment-report-cursor-ide-test-2024-01-01.json',
        'deployment-report-claude-code-test-2024-01-02.json',
        'other-file.txt',
      ] as any);

      vi.spyOn(fs, 'readFile').mockImplementation(async (filePath: string) => {
        if (filePath.toString().includes('cursor-ide')) {
          return JSON.stringify({
            id: 'cursor-ide-test-2024-01-01',
            timestamp: '2024-01-01T10:00:00Z',
            platform: 'cursor-ide',
            summary: { overall: { status: 'success' } },
            context: { projectName: 'test-project-1' },
          });
        }
        return JSON.stringify({
          id: 'claude-code-test-2024-01-02',
          timestamp: '2024-01-02T10:00:00Z',
          platform: 'claude-code',
          summary: { overall: { status: 'failed' } },
          context: { projectName: 'test-project-2' },
        });
      });

      const history = await service.getReportsHistory(10);

      expect(history).toHaveLength(2);
      expect(history[0].platform).toBe('cursor-ide');
      expect(history[0].status).toBe('success');
      expect(history[1].platform).toBe('claude-code');
      expect(history[1].status).toBe('failed');
    });

    it('should handle malformed report files gracefully', async () => {
      vi.spyOn(fs, 'readdir').mockResolvedValue([
        'deployment-report-invalid.json',
        'deployment-report-valid.json',
      ] as any);

      vi.spyOn(fs, 'readFile').mockImplementation(async (filePath: string) => {
        if (filePath.toString().includes('invalid')) {
          return 'invalid json';
        }
        return JSON.stringify({
          id: 'valid-report',
          timestamp: '2024-01-01T10:00:00Z',
          platform: 'cursor-ide',
          summary: { overall: { status: 'success' } },
          context: { projectName: 'valid-project' },
        });
      });

      const history = await service.getReportsHistory();

      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('valid-report');
    });

    it('should limit results correctly', async () => {
      vi.spyOn(fs, 'readdir').mockResolvedValue([
        'report1.json', 'report2.json', 'report3.json',
      ] as any);

      vi.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify({
        id: 'test',
        timestamp: '2024-01-01T10:00:00Z',
        platform: 'cursor-ide',
        summary: { overall: { status: 'success' } },
        context: { projectName: 'test' },
      }));

      const history = await service.getReportsHistory(2);

      expect(history).toHaveLength(2);
    });
  });

  describe('error handling', () => {
    it('should handle filesystem errors during report generation', async () => {
      vi.spyOn(fs, 'mkdir').mockRejectedValue(new Error('Permission denied'));

      await expect(
        service.generateDeploymentReport(
          mockSuccessResult,
          'cursor-ide',
          mockContext,
          'test-context-id',
        ),
      ).rejects.toThrow('Failed to generate deployment report');
    });

    it('should handle filesystem errors during export', async () => {
      const report = await service.generateDeploymentReport(
        mockSuccessResult,
        'cursor-ide',
        mockContext,
        'test-context-id',
      );

      vi.spyOn(fs, 'writeFile').mockRejectedValue(new Error('Disk full'));

      await expect(
        service.exportReport(report, 'json'),
      ).rejects.toThrow();
    });

    it('should handle missing reports directory gracefully', async () => {
      vi.spyOn(fs, 'readdir').mockRejectedValue(new Error('Directory not found'));

      const history = await service.getReportsHistory();

      expect(history).toEqual([]);
    });
  });

  describe('performance and optimization', () => {
    it('should include performance bottlenecks when detected', async () => {
      const report = await service.generateDeploymentReport(
        mockSuccessResult,
        'cursor-ide',
        mockContext,
        'test-context-id',
      );

      // Mock performance bottlenecks
      report.performance.bottlenecks = [
        {
          phase: 'File Writing',
          issue: 'Large file processing',
          impact: 'high',
          suggestion: 'Enable streaming for large files',
        },
      ];

      const formatted = service.formatReportForConsole(report, 'detailed');

      expect(formatted).toContain('🐌 Performance Bottlenecks');
      expect(formatted).toContain('Large file processing');
    });

    it('should suggest optimizations based on deployment characteristics', async () => {
      const report = await service.generateDeploymentReport(
        mockSuccessResult,
        'cursor-ide',
        mockContext,
        'test-context-id',
      );

      expect(report.performance.optimizations.length).toBeGreaterThan(0);
      expect(report.performance.optimizations.some(opt => opt.type === 'cache')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty deployment results', async () => {
      const emptyResult: DeploymentResult = {
        success: false,
        deployedComponents: [],
        skippedComponents: [],
        summary: {
          filesDeployed: 0,
          filesSkipped: 0,
          conflictsResolved: 0,
          backupCreated: false,
        },
        errors: [],
        warnings: [],
      };

      const report = await service.generateDeploymentReport(
        emptyResult,
        'cursor-ide',
        mockContext,
        'test-context-id',
      );

      expect(report).toBeDefined();
      expect(report.summary.overall.status).toBe('failed');
      expect(report.summary.components).toHaveLength(0);
    });

    it('should handle very long error messages', async () => {
      const longErrorResult: DeploymentResult = {
        ...mockFailureResult,
        errors: [
          {
            component: 'test',
            type: 'test-error',
            severity: 'medium',
            message: 'A'.repeat(1000),
            suggestion: 'Fix this very long error',
          },
        ],
      };

      const analysis = await service.generateFailureAnalysis(
        longErrorResult,
        'cursor-ide',
      );

      expect(analysis.rootCauses).toHaveLength(1);
      expect(analysis.rootCauses[0].error.message).toHaveLength(1000);
    });
  });
});
