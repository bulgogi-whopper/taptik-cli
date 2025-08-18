import { Test, TestingModule } from '@nestjs/testing';

import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

import { ProgressService } from './progress.service';

describe('ProgressService', () => {
  let service: ProgressService;
  let mockLogger: {
    log: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockLogger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProgressService],
    }).compile();

    service = module.get<ProgressService>(ProgressService);
    
    // Replace the logger with our mock
    (service as any).logger = mockLogger;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('progress initialization', () => {
    it('should initialize progress with steps', () => {
      const steps = ['Step 1', 'Step 2', 'Step 3'];
      
      service.initializeProgress(steps);
      
      expect(mockLogger.log).toHaveBeenCalledWith('🚀 Starting Taptik build process...');
      expect(service.getProgressPercentage()).toBe(0);
    });

    it('should reset progress correctly', () => {
      const steps = ['Step 1', 'Step 2'];
      service.initializeProgress(steps);
      service.completeStep();
      
      expect(service.getProgressPercentage()).toBe(50);
      
      service.reset();
      
      expect(service.getProgressPercentage()).toBe(0);
      expect(service.isComplete()).toBe(true); // 0 steps means complete
    });
  });

  describe('step management', () => {
    beforeEach(() => {
      service.initializeProgress(['Step 1', 'Step 2', 'Step 3']);
    });

    it('should start step with default message', () => {
      service.startStep();
      
      expect(mockLogger.log).toHaveBeenCalledWith('⏳ Step 1...');
    });

    it('should start step with custom message', () => {
      service.startStep('Custom step message');
      
      expect(mockLogger.log).toHaveBeenCalledWith('⏳ Custom step message...');
    });

    it('should complete step with default message', () => {
      service.completeStep();
      
      expect(mockLogger.log).toHaveBeenCalledWith('✓ Step 1');
      expect(service.getProgressPercentage()).toBe(33);
    });

    it('should complete step with custom message', () => {
      service.completeStep('Custom completion message');
      
      expect(mockLogger.log).toHaveBeenCalledWith('✓ Custom completion message');
    });

    it('should fail step with error message', () => {
      const error = new Error('Test error');
      
      service.failStep('Step failed', error);
      
      expect(mockLogger.error).toHaveBeenCalledWith('✗ Step failed', error.stack);
      expect(service.getProgressPercentage()).toBe(33);
    });
  });

  describe('scanning operations', () => {
    beforeEach(() => {
      service.initializeProgress([]);
    });

    it('should start local scan', () => {
      service.startScan('local');
      
      expect(mockLogger.log).toHaveBeenCalledWith('⏳ Scanning local Kiro settings...');
    });

    it('should start global scan', () => {
      service.startScan('global');
      
      expect(mockLogger.log).toHaveBeenCalledWith('⏳ Scanning global Kiro settings...');
    });

    it('should complete local scan with file count', () => {
      service.completeScan('local', 5);
      
      expect(mockLogger.log).toHaveBeenCalledWith('✓ Scanning local Kiro settings (5 files found)');
    });

    it('should complete global scan with file count', () => {
      service.completeScan('global', 3);
      
      expect(mockLogger.log).toHaveBeenCalledWith('✓ Scanning global Kiro settings (3 files found)');
    });
  });

  describe('transformation operations', () => {
    beforeEach(() => {
      service.initializeProgress([]);
    });

    it('should start transformation for category', () => {
      service.startTransformation('Personal Context');
      
      expect(mockLogger.log).toHaveBeenCalledWith('⏳ Transforming Personal Context...');
    });

    it('should complete transformation for category', () => {
      service.completeTransformation('Project Context');
      
      expect(mockLogger.log).toHaveBeenCalledWith('✓ Project Context Complete Conversion!');
    });
  });

  describe('output operations', () => {
    beforeEach(() => {
      service.initializeProgress([]);
    });

    it('should start output generation', () => {
      service.startOutput();
      
      expect(mockLogger.log).toHaveBeenCalledWith('⏳ Generating output files...');
    });

    it('should complete output generation', () => {
      const outputPath = '/test/output';
      const fileCount = 4;
      
      service.completeOutput(outputPath, fileCount);
      
      expect(mockLogger.log).toHaveBeenCalledWith('✓ Generated 4 files in /test/output');
    });
  });

  describe('build summary', () => {
    it('should display build summary with formatted time', () => {
      const buildTime = 2500; // 2.5 seconds
      const outputPath = '/test/output';
      const categories = ['personal-context', 'project-context'];
      
      service.displayBuildSummary(buildTime, outputPath, categories);
      
      expect(mockLogger.log).toHaveBeenCalledWith('');
      expect(mockLogger.log).toHaveBeenCalledWith('🎉 Build completed successfully!');
      expect(mockLogger.log).toHaveBeenCalledWith('📁 Output directory: /test/output');
      expect(mockLogger.log).toHaveBeenCalledWith('📋 Categories processed: personal-context, project-context');
      expect(mockLogger.log).toHaveBeenCalledWith('⏱️  Build time: 2s');
      expect(mockLogger.log).toHaveBeenCalledWith('');
    });
  });

  describe('issues summary', () => {
    it('should display warnings', () => {
      const warnings = ['Warning 1', 'Warning 2'];
      const errors: string[] = [];
      
      service.displayIssuesSummary(warnings, errors);
      
      expect(mockLogger.warn).toHaveBeenCalledWith('⚠️  Warnings encountered:');
      expect(mockLogger.warn).toHaveBeenCalledWith('  • Warning 1');
      expect(mockLogger.warn).toHaveBeenCalledWith('  • Warning 2');
    });

    it('should display errors', () => {
      const warnings: string[] = [];
      const errors = ['Error 1', 'Error 2'];
      
      service.displayIssuesSummary(warnings, errors);
      
      expect(mockLogger.error).toHaveBeenCalledWith('❌ Errors encountered:');
      expect(mockLogger.error).toHaveBeenCalledWith('  • Error 1');
      expect(mockLogger.error).toHaveBeenCalledWith('  • Error 2');
    });

    it('should not display sections for empty arrays', () => {
      const warnings: string[] = [];
      const errors: string[] = [];
      
      service.displayIssuesSummary(warnings, errors);
      
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('progress calculation', () => {
    it('should calculate progress percentage correctly', () => {
      service.initializeProgress(['Step 1', 'Step 2', 'Step 3', 'Step 4']);
      
      expect(service.getProgressPercentage()).toBe(0);
      
      service.completeStep();
      expect(service.getProgressPercentage()).toBe(25);
      
      service.completeStep();
      expect(service.getProgressPercentage()).toBe(50);
      
      service.completeStep();
      expect(service.getProgressPercentage()).toBe(75);
      
      service.completeStep();
      expect(service.getProgressPercentage()).toBe(100);
      expect(service.isComplete()).toBe(true);
    });

    it('should handle zero steps', () => {
      service.initializeProgress([]);
      
      expect(service.getProgressPercentage()).toBe(0);
      expect(service.isComplete()).toBe(true);
    });
  });

  describe('duration formatting', () => {
    it('should format milliseconds correctly', () => {
      // Access private method for testing
      const formatDuration = (service as any).formatDuration.bind(service);
      
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(1500)).toBe('1s');
      expect(formatDuration(30_000)).toBe('30s');
      expect(formatDuration(90_000)).toBe('1m 30s');
      expect(formatDuration(125_000)).toBe('2m 5s');
    });
  });
});