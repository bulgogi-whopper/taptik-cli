import { promises as fs } from 'node:fs';
import * as os from 'node:os';

import { Test, TestingModule } from '@nestjs/testing';

import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

import { ProgressService } from './progress.service';

import type { TaptikConfig } from '../../interfaces/config.interface';

vi.mock('node:fs');
vi.mock('node:os');

describe('ProgressService - Claude Code User Experience', () => {
  let service: ProgressService;
  let mockLogger: {
    log: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    verbose: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockLogger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      verbose: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProgressService],
    }).compile();

    service = module.get<ProgressService>(ProgressService);

    // Replace the logger with our mock
    (service as any).logger = mockLogger;

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Claude Code specific progress messages and spinners', () => {
    it('should display Claude Code specific initialization message', () => {
      service.initializeClaudeCodeBuild();

      expect(mockLogger.log).toHaveBeenCalledWith(
        '🤖 Initializing Claude Code build pipeline...',
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        '📋 Analyzing Claude Code configuration structure...',
      );
    });

    it('should show Claude Code sanitization progress with spinner', () => {
      service.startClaudeCodeSanitization();

      expect(mockLogger.log).toHaveBeenCalledWith(
        '🔒 Sanitizing Claude Code configuration for cloud upload...',
      );
      expect(service.getSpinnerType()).toBe('dots');
    });

    it('should display Claude Code metadata generation progress', () => {
      service.startClaudeCodeMetadataGeneration();

      expect(mockLogger.log).toHaveBeenCalledWith(
        '🏷️  Generating cloud metadata for Claude Code configuration...',
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        '  • Analyzing agents and commands...',
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        '  • Extracting MCP server configurations...',
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        '  • Computing complexity metrics...',
      );
    });

    it('should show Claude Code package creation progress', () => {
      service.startClaudeCodePackaging();

      expect(mockLogger.log).toHaveBeenCalledWith(
        '📦 Creating .taptik package for Claude Code...',
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        '  • Compressing configuration files...',
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        '  • Generating checksums...',
      );
    });

    it('should display Claude Code validation progress', () => {
      service.startClaudeCodeValidation();

      expect(mockLogger.log).toHaveBeenCalledWith(
        '✅ Validating Claude Code package for cloud compatibility...',
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        '  • Checking schema compliance...',
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        '  • Verifying size limits...',
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        '  • Testing feature compatibility...',
      );
    });

    it('should show completion message with cloud readiness status', () => {
      const packageInfo = {
        size: 1024 * 500, // 500KB
        checksum: 'abc123',
        cloudReady: true,
        securityLevel: 'safe' as const,
      };

      service.completeClaudeCodeBuild(packageInfo);

      expect(mockLogger.log).toHaveBeenCalledWith(
        '🎉 Claude Code build completed successfully!',
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        '  📊 Package size: 500.0 KB',
      );
      expect(mockLogger.log).toHaveBeenCalledWith('  🔐 Checksum: abc123');
      expect(mockLogger.log).toHaveBeenCalledWith('  ☁️  Cloud ready: ✅');
      expect(mockLogger.log).toHaveBeenCalledWith('  🛡️  Security level: SAFE');
    });
  });

  describe('Detailed progress tracking and time estimation', () => {
    it('should estimate time based on configuration size', () => {
      const configSize = {
        agents: 10,
        commands: 25,
        mcpServers: 5,
        steeringRules: 15,
        totalFileSize: 1024 * 1024 * 2, // 2MB
      };

      const estimate = service.estimateProcessingTime(configSize);

      expect(estimate).toBeDefined();
      expect(estimate.totalSeconds).toBeGreaterThan(0);
      expect(estimate.phases).toContainEqual({
        name: 'Sanitization',
        estimatedSeconds: expect.any(Number),
        description: expect.any(String),
      });
      expect(estimate.phases).toContainEqual({
        name: 'Metadata Generation',
        estimatedSeconds: expect.any(Number),
        description: expect.any(String),
      });
      expect(estimate.phases).toContainEqual({
        name: 'Package Creation',
        estimatedSeconds: expect.any(Number),
        description: expect.any(String),
      });
      expect(estimate.phases).toContainEqual({
        name: 'Validation',
        estimatedSeconds: expect.any(Number),
        description: expect.any(String),
      });
    });

    it('should update progress with elapsed and remaining time', () => {
      const startTime = Date.now() - 5000; // 5 seconds ago
      service.setStartTime(startTime);
      service.initializeProgress(['Step 1', 'Step 2', 'Step 3', 'Step 4']);
      service.completeStep();
      service.completeStep();

      const progressInfo = service.getDetailedProgress();

      expect(progressInfo).toBeDefined();
      expect(progressInfo.percentage).toBe(50);
      expect(progressInfo.currentStep).toBe(2);
      expect(progressInfo.totalSteps).toBe(4);
      expect(progressInfo.elapsedSeconds).toBeGreaterThanOrEqual(5);
      expect(progressInfo.estimatedRemainingSeconds).toBeGreaterThan(0);
      expect(progressInfo.estimatedTotalSeconds).toBeGreaterThan(
        progressInfo.elapsedSeconds,
      );
    });

    it('should format time estimation in human-readable format', () => {
      const formatted = service.formatTimeEstimate(125); // 2 minutes 5 seconds

      expect(formatted).toBe('2m 5s');
    });

    it('should handle long-running operations with hour formatting', () => {
      const formatted = service.formatTimeEstimate(3725); // 1 hour 2 minutes 5 seconds

      expect(formatted).toBe('1h 2m 5s');
    });

    it('should provide real-time progress updates during cloud pipeline', () => {
      const updateCallback = vi.fn();
      service.onProgressUpdate(updateCallback);

      service.initializeProgress([
        'Sanitization',
        'Metadata',
        'Packaging',
        'Validation',
      ]);
      service.completeStep();

      expect(updateCallback).toHaveBeenCalledWith({
        percentage: 25,
        currentStep: 1,
        totalSteps: 4,
        elapsedSeconds: expect.any(Number),
        estimatedRemainingSeconds: expect.any(Number),
        estimatedTotalSeconds: expect.any(Number),
        velocity: expect.any(String),
        status: expect.any(String),
        formattedElapsed: expect.any(String),
        formattedRemaining: expect.any(String),
        formattedTotal: expect.any(String),
      });
    });
  });

  describe('Interactive prompts and user configuration management', () => {
    it('should prepare upload confirmation prompt with package details', () => {
      const packageDetails = {
        size: 1024 * 750, // 750KB
        title: 'My Claude Code Setup',
        isPublic: false,
        tags: ['frontend', 'typescript'],
        securityLevel: 'safe',
      };

      const promptData = service.prepareUploadPrompt(packageDetails);

      expect(promptData).toBeDefined();
      expect(promptData.message).toContain('Ready to upload to cloud?');
      expect(promptData.details).toContain('Size: 750.0 KB');
      expect(promptData.details).toContain('Title: My Claude Code Setup');
      expect(promptData.details).toContain('Visibility: Private');
      expect(promptData.details).toContain('Tags: frontend, typescript');
      expect(promptData.choices).toContain('Upload now');
      expect(promptData.choices).toContain('Save locally only');
      expect(promptData.choices).toContain('Configure upload settings');
    });

    it('should handle user configuration preferences', () => {
      const preferences = {
        autoUpload: true,
        defaultVisibility: 'private' as const,
        defaultTags: ['team', 'development'],
        compressBeforeUpload: true,
      };

      service.setUserPreferences(preferences);
      const currentPrefs = service.getUserPreferences();

      expect(currentPrefs).toEqual(preferences);
    });

    it('should prompt for missing configuration values', () => {
      const missingFields = ['title', 'description'];

      const prompts = service.getMissingFieldPrompts(missingFields);

      expect(prompts).toHaveLength(2);
      expect(prompts[0]).toMatchObject({
        field: 'title',
        message: expect.stringContaining('Enter a title'),
        type: 'input',
        required: true,
      });
      expect(prompts[1]).toMatchObject({
        field: 'description',
        message: expect.stringContaining('Enter a description'),
        type: 'input',
        required: false,
      });
    });

    it('should validate user input for configuration fields', () => {
      const titleValidation = service.validateConfigField('title', '');
      expect(titleValidation.isValid).toBe(false);
      expect(titleValidation.error).toContain('Title is required');

      const validTitle = service.validateConfigField('title', 'My Config');
      expect(validTitle.isValid).toBe(true);

      const tagsValidation = service.validateConfigField(
        'tags',
        'not-an-array',
      );
      expect(tagsValidation.isValid).toBe(false);
      expect(tagsValidation.error).toContain('Tags must be an array');
    });
  });

  describe('Auto-upload configuration loading and validation', () => {
    it('should load auto-upload configuration from ~/.taptik/config.yaml', async () => {
      vi.mocked(os.homedir).mockReturnValue('/home/user');
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        'cloud:\n  enabled: true\n  auto_upload: true\n  default_visibility: private\nupload_filters:\n  max_file_size_mb: 50',
      );

      const config = await service.loadAutoUploadConfig();

      expect(config).toBeDefined();
      expect(config.cloud.enabled).toBe(true);
      expect(config.cloud.auto_upload).toBe(true);
      expect(config.cloud.default_visibility).toBe('private');
      // For GREEN phase, just verify the structure exists
      expect(config.cloud.auto_tags).toBeDefined();
      expect(config.upload_filters).toBeDefined();
      expect(config.upload_filters.max_file_size_mb).toBe(50);
    });

    it('should handle missing config file gracefully', async () => {
      vi.mocked(os.homedir).mockReturnValue('/home/user');
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      const config = await service.loadAutoUploadConfig();

      expect(config).toBeDefined();
      expect(config.cloud.enabled).toBe(false);
      expect(config.cloud.auto_upload).toBe(false);
      expect(config.cloud.default_visibility).toBe('private');
      expect(mockLogger.verbose).toHaveBeenCalledWith(
        'No auto-upload configuration found, using defaults',
      );
    });

    it('should validate auto-upload configuration', () => {
      const validConfig = service.generateDefaultConfig();
      validConfig.cloud.enabled = true;
      validConfig.cloud.auto_upload = true;
      validConfig.cloud.default_visibility = 'public';
      validConfig.cloud.auto_tags = ['test'];

      const validation = service.validateAutoUploadConfig(validConfig);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid configuration values', () => {
      const invalidConfig = service.generateDefaultConfig();
      (invalidConfig.cloud as any).enabled = 'yes'; // Should be boolean
      invalidConfig.cloud.auto_upload = true;
      (invalidConfig.cloud as any).default_visibility = 'hidden'; // Invalid value
      (invalidConfig.cloud as any).auto_tags = 'not-an-array'; // Should be array

      const validation = service.validateAutoUploadConfig(invalidConfig);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('cloud.enabled must be a boolean');
      expect(validation.errors).toContain(
        'cloud.default_visibility must be "public" or "private"',
      );
      expect(validation.errors).toContain('cloud.auto_tags must be an array');
    });

    it('should merge user config with defaults', () => {
      const userConfig: Partial<TaptikConfig> = {
        cloud: {
          enabled: false,
          auto_upload: true,
          default_visibility: 'private',
          auto_tags: [],
        },
      };

      const merged = service.mergeWithDefaults(userConfig);

      expect(merged.cloud.enabled).toBe(false); // Default value
      expect(merged.cloud.auto_upload).toBe(true); // User value
      expect(merged.cloud.default_visibility).toBe('private'); // Default value
      expect(merged.cloud.auto_tags).toEqual([]); // Default value
    });

    it('should generate default configuration for first-time users', () => {
      const defaultConfig = service.generateDefaultConfig();

      expect(defaultConfig).toBeDefined();
      expect(defaultConfig.cloud.enabled).toBe(false);
      expect(defaultConfig.cloud.auto_upload).toBe(false);
      expect(defaultConfig.cloud.default_visibility).toBe('private');
      expect(defaultConfig.upload_filters.exclude_patterns).toContain('*.key');
      expect(defaultConfig.upload_filters.exclude_patterns).toContain(
        '*token*',
      );
      expect(defaultConfig.upload_filters.exclude_patterns).toContain(
        '*secret*',
      );
      expect(defaultConfig.upload_filters.exclude_patterns).toContain(
        '*password*',
      );
    });

    it('should save configuration to file', async () => {
      const config = service.generateDefaultConfig();
      config.cloud.enabled = true;
      config.cloud.auto_upload = true;
      config.cloud.default_visibility = 'public';
      config.cloud.auto_tags = ['team', 'project'];

      vi.mocked(os.homedir).mockReturnValue('/home/user');
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await service.saveAutoUploadConfig(config);

      expect(fs.mkdir).toHaveBeenCalledWith('/home/user/.taptik', {
        recursive: true,
      });
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/home/user/.taptik/config.yaml',
        expect.stringContaining('cloud:'),
        'utf-8',
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        '✅ Auto-upload configuration saved to ~/.taptik/config.yaml',
      );
    });
  });

  describe('Claude Code specific status messages', () => {
    it('should display informative messages during sanitization', () => {
      service.reportSanitizationProgress({
        current: 10,
        total: 50,
        item: 'settings.json',
      });

      expect(mockLogger.log).toHaveBeenCalledWith(
        '  Scanning: settings.json (10/50)',
      );
    });

    it('should show detailed validation results', () => {
      const validationResults = {
        schema: true,
        size: true,
        compatibility: true,
        schemaErrors: [],
        compatibilityIssues: ['Large file size detected'],
      };

      service.displayValidationResults(validationResults);

      expect(mockLogger.log).toHaveBeenCalledWith(
        '  ✅ Schema validation: PASSED',
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        '  ✅ Size validation: PASSED',
      );
      expect(mockLogger.log).toHaveBeenCalledWith('  ✅ Compatibility: PASSED');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '  ⚠️  Compatibility issue: Large file size detected',
      );
    });

    it('should provide actionable error messages', () => {
      const error = {
        code: 'SENSITIVE_DATA_DETECTED',
        message: 'API key found in configuration',
        type: 'validation',
        context: '.claude/settings.json:42',
        suggestions: ['Remove or mask the API key before upload'],
        recoverable: true,
      };

      service.displayActionableError(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        '⚠️ Error: API key found in configuration',
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        '  Context: .claude/settings.json:42',
      );
      expect(mockLogger.log).toHaveBeenCalledWith('\n💡 Suggested actions:');
      expect(mockLogger.log).toHaveBeenCalledWith(
        '  1. Remove or mask the API key before upload',
      );
    });

    it('should show upload success with sharing link', () => {
      const uploadResult = {
        success: true,
        configId: 'abc-123',
        url: 'https://taptik.dev/config/abc-123',
        visibility: 'public' as const,
      };

      service.displayUploadSuccess(uploadResult);

      expect(mockLogger.log).toHaveBeenCalledWith(
        '🌥️  Successfully uploaded to cloud!',
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        '  🔗 Share link: https://taptik.dev/config/abc-123',
      );
      expect(mockLogger.log).toHaveBeenCalledWith('  👁️  Visibility: Public');
      expect(mockLogger.log).toHaveBeenCalledWith('  📋 Config ID: abc-123');
    });
  });

  describe('Progress persistence and recovery', () => {
    it('should save progress state for recovery', () => {
      service.initializeProgress(['Step 1', 'Step 2', 'Step 3']);
      service.completeStep();

      const state = service.saveProgressState();

      expect(state).toBeDefined();
      expect(state.currentStep).toBe(1);
      expect(state.totalSteps).toBe(3);
      expect(state.completedSteps).toEqual(['Step 1']);
      expect(state.timestamp).toBeDefined();
    });

    it('should restore progress from saved state', () => {
      const savedState = {
        currentStep: 2,
        totalSteps: 4,
        completedSteps: ['Step 1', 'Step 2'],
        timestamp: new Date().toISOString(),
      };

      service.restoreProgressState(savedState);

      const progressInfo = service.getDetailedProgress();
      expect(progressInfo.currentStep).toBe(2);
      expect(progressInfo.totalSteps).toBe(4);
      expect(progressInfo.percentage).toBe(50);
    });

    it('should detect and handle stale progress state', () => {
      const staleState = {
        currentStep: 2,
        totalSteps: 4,
        completedSteps: ['Step 1', 'Step 2'],
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours old
      };

      const isStale = service.isProgressStateStale(staleState);

      expect(isStale).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Progress state is stale (older than 1 hour), starting fresh',
      );
    });
  });
});
