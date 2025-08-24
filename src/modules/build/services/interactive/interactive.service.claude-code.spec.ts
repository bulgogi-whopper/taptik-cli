import { Test, TestingModule } from '@nestjs/testing';

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { InteractiveService } from './interactive.service';

// Mock the @inquirer/prompts module
vi.mock('@inquirer/prompts', () => ({
  select: vi.fn(),
  checkbox: vi.fn(),
  input: vi.fn(),
  confirm: vi.fn(),
  password: vi.fn(),
}));

describe('InteractiveService - Claude Code User Experience', () => {
  let service: InteractiveService;
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
      providers: [InteractiveService],
    }).compile();

    service = module.get<InteractiveService>(InteractiveService);

    // Replace the logger with our mock
    (service as any).logger = mockLogger;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Claude Code upload prompts', () => {
    it('should prompt for upload confirmation with package details', async () => {
      const { confirm } = await import('@inquirer/prompts');
      (confirm as any).mockResolvedValue(true);

      const packageDetails = {
        size: 1024 * 850, // 850KB
        title: 'My Claude Code Setup',
        isPublic: false,
        tags: ['frontend', 'react', 'typescript'],
        securityLevel: 'safe' as const,
      };

      const result = await service.confirmClaudeCodeUpload(packageDetails);

      expect(result).toBe(true);
      expect(confirm).toHaveBeenCalledWith({
        message: expect.stringContaining(
          'Ready to upload your Claude Code configuration to the cloud?',
        ),
        default: true,
      });
      expect(mockLogger.log).toHaveBeenCalledWith('📦 Package Details:');
      expect(mockLogger.log).toHaveBeenCalledWith('  • Size: 850.0 KB');
      expect(mockLogger.log).toHaveBeenCalledWith(
        '  • Title: My Claude Code Setup',
      );
      expect(mockLogger.log).toHaveBeenCalledWith('  • Visibility: Private');
      expect(mockLogger.log).toHaveBeenCalledWith(
        '  • Tags: frontend, react, typescript',
      );
      expect(mockLogger.log).toHaveBeenCalledWith('  • Security: ✅ SAFE');
    });

    it('should provide upload options when user wants to configure', async () => {
      const { select } = await import('@inquirer/prompts');
      (select as any).mockResolvedValue('configure');

      const result = await service.selectUploadAction();

      expect(result).toBe('configure');
      expect(select).toHaveBeenCalledWith({
        message: 'What would you like to do with your Claude Code package?',
        choices: [
          { value: 'upload', name: '☁️  Upload to cloud now' },
          { value: 'save', name: '💾 Save locally only' },
          { value: 'configure', name: '⚙️  Configure upload settings' },
          { value: 'both', name: '📤 Save locally and upload' },
        ],
        default: 'both',
      });
    });

    it('should prompt for visibility preference', async () => {
      const { select } = await import('@inquirer/prompts');
      (select as any).mockResolvedValue('public');

      const result = await service.selectVisibility();

      expect(result).toBe('public');
      expect(select).toHaveBeenCalledWith({
        message: 'Choose visibility for your Claude Code configuration:',
        choices: [
          {
            value: 'public',
            name: '🌍 Public - Anyone can discover and use',
            description: 'Share with the community',
          },
          {
            value: 'private',
            name: '🔒 Private - Only you can access',
            description: 'Keep for personal use',
          },
        ],
        default: 'private',
      });
    });

    it('should prompt for configuration title and description', async () => {
      const { input, checkbox } = await import('@inquirer/prompts');
      (input as any)
        .mockResolvedValueOnce('My Awesome Claude Setup')
        .mockResolvedValueOnce(
          'A comprehensive setup for TypeScript development',
        )
        .mockResolvedValueOnce(''); // for tags input
      (checkbox as any).mockResolvedValue([]); // for suggested tags

      const result = await service.getPackageMetadata();

      expect(result).toEqual({
        title: 'My Awesome Claude Setup',
        description: 'A comprehensive setup for TypeScript development',
        tags: [],
      });

      expect(input).toHaveBeenCalledTimes(3);
      expect(input).toHaveBeenNthCalledWith(1, {
        message: 'Enter a title for your configuration:',
        default: 'Claude Code Configuration',
        validate: expect.any(Function),
      });
      expect(input).toHaveBeenNthCalledWith(2, {
        message: 'Enter a description (optional):',
        default: '',
      });
    });

    it('should validate title input', async () => {
      const { input, checkbox } = await import('@inquirer/prompts');
      const titlePrompt = vi
        .fn()
        .mockResolvedValueOnce('Valid Title')
        .mockResolvedValueOnce('') // description
        .mockResolvedValueOnce(''); // tags
      (input as any).mockImplementation(titlePrompt);
      (checkbox as any).mockResolvedValue([]); // for suggested tags

      await service.getPackageMetadata();

      const validateFn = titlePrompt.mock.calls[0][0].validate;

      expect(validateFn('')).toBe('Title is required');
      expect(validateFn('ab')).toBe('Title must be at least 3 characters');
      expect(validateFn('Valid Title')).toBe(true);
    });

    it('should prompt for tags selection', async () => {
      const { input, checkbox } = await import('@inquirer/prompts');
      (input as any).mockResolvedValue('frontend, react, hooks');
      (checkbox as any).mockResolvedValue(['team', 'production']);

      const result = await service.selectTags();

      expect(result).toEqual([
        'frontend',
        'react',
        'hooks',
        'team',
        'production',
      ]);

      expect(input).toHaveBeenCalledWith({
        message: 'Enter custom tags (comma-separated):',
        default: '',
      });

      expect(checkbox).toHaveBeenCalledWith({
        message: 'Select suggested tags:',
        choices: expect.arrayContaining([
          { value: 'team', name: 'team' },
          { value: 'production', name: 'production' },
          { value: 'development', name: 'development' },
          { value: 'personal', name: 'personal' },
        ]),
      });
    });
  });

  describe('Auto-upload configuration prompts', () => {
    it('should prompt to enable auto-upload', async () => {
      const { confirm } = await import('@inquirer/prompts');
      (confirm as any).mockResolvedValue(true);

      const result = await service.promptEnableAutoUpload();

      expect(result).toBe(true);
      expect(confirm).toHaveBeenCalledWith({
        message: 'Enable automatic cloud upload for future builds?',
        default: false,
      });
    });

    it('should prompt for default visibility setting', async () => {
      const { select } = await import('@inquirer/prompts');
      (select as any).mockResolvedValue('private');

      const result = await service.selectDefaultVisibility();

      expect(result).toBe('private');
      expect(select).toHaveBeenCalledWith({
        message: 'Choose default visibility for auto-uploads:',
        choices: [
          { value: 'private', name: '🔒 Private (recommended)' },
          { value: 'public', name: '🌍 Public' },
          { value: 'ask', name: '❓ Ask each time' },
        ],
        default: 'private',
      });
    });

    it('should prompt for default tags', async () => {
      const { input } = await import('@inquirer/prompts');
      (input as any).mockResolvedValue('auto-backup, personal');

      const result = await service.getDefaultTags();

      expect(result).toEqual(['auto-backup', 'personal']);
      expect(input).toHaveBeenCalledWith({
        message: 'Enter default tags for auto-uploads (comma-separated):',
        default: 'auto-backup',
      });
    });

    it('should prompt to save configuration', async () => {
      const { confirm } = await import('@inquirer/prompts');
      (confirm as any).mockResolvedValue(true);

      const result = await service.confirmSaveConfiguration();

      expect(result).toBe(true);
      expect(confirm).toHaveBeenCalledWith({
        message: 'Save these settings to ~/.taptik/config.yaml?',
        default: true,
      });
    });
  });

  describe('Conflict resolution prompts', () => {
    it('should prompt for handling existing configuration', async () => {
      const { select } = await import('@inquirer/prompts');
      (select as any).mockResolvedValue('backup');

      const result = await service.handleExistingConfig();

      expect(result).toBe('backup');
      expect(select).toHaveBeenCalledWith({
        message: 'A configuration already exists. What would you like to do?',
        choices: [
          { value: 'backup', name: '💾 Backup existing and continue' },
          { value: 'merge', name: '🔀 Merge with existing' },
          { value: 'replace', name: '🔄 Replace existing' },
          { value: 'cancel', name: '❌ Cancel operation' },
        ],
        default: 'backup',
      });
    });

    it('should prompt for security issue resolution', async () => {
      const { select } = await import('@inquirer/prompts');
      (select as any).mockResolvedValue('remove');

      const securityIssue = {
        type: 'API_KEY_DETECTED',
        file: '.claude/settings.json',
        line: 15,
        severity: 'high',
      };

      const result = await service.resolveSecurityIssue(securityIssue);

      expect(result).toBe('remove');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '⚠️  Security Issue Detected:',
      );
      expect(mockLogger.warn).toHaveBeenCalledWith('  Type: API_KEY_DETECTED');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '  Location: .claude/settings.json:15',
      );
      expect(mockLogger.warn).toHaveBeenCalledWith('  Severity: HIGH');

      expect(select).toHaveBeenCalledWith({
        message: 'How would you like to handle this security issue?',
        choices: [
          { value: 'remove', name: '🗑️  Remove sensitive data' },
          { value: 'mask', name: '🎭 Mask sensitive data' },
          {
            value: 'ignore',
            name: '⚠️  Ignore and continue (not recommended)',
          },
          { value: 'cancel', name: '❌ Cancel upload' },
        ],
        default: 'remove',
      });
    });
  });

  describe('Authentication prompts', () => {
    it('should prompt for authentication when not logged in', async () => {
      const { confirm } = await import('@inquirer/prompts');
      (confirm as any).mockResolvedValue(true);

      const result = await service.promptAuthentication();

      expect(result).toBe(true);
      expect(mockLogger.log).toHaveBeenCalledWith(
        '☁️  Cloud upload requires authentication',
      );
      expect(confirm).toHaveBeenCalledWith({
        message: 'Would you like to login now?',
        default: true,
      });
    });

    it('should prompt for authentication method', async () => {
      const { select } = await import('@inquirer/prompts');
      (select as any).mockResolvedValue('github');

      const result = await service.selectAuthMethod();

      expect(result).toBe('github');
      expect(select).toHaveBeenCalledWith({
        message: 'Choose authentication method:',
        choices: [
          { value: 'github', name: '🐙 GitHub' },
          { value: 'google', name: '🔍 Google' },
          { value: 'email', name: '📧 Email/Password' },
        ],
        default: 'github',
      });
    });
  });

  describe('Progress notification preferences', () => {
    it('should prompt for notification preferences', async () => {
      const { checkbox } = await import('@inquirer/prompts');
      (checkbox as any).mockResolvedValue(['upload_complete', 'error']);

      const result = await service.selectNotificationPreferences();

      expect(result).toEqual(['upload_complete', 'error']);
      expect(checkbox).toHaveBeenCalledWith({
        message: 'Select notification preferences:',
        choices: [
          {
            value: 'upload_complete',
            name: '✅ Upload completion',
            checked: true,
          },
          { value: 'upload_failed', name: '❌ Upload failures', checked: true },
          { value: 'error', name: '⚠️  Errors and warnings', checked: true },
          { value: 'progress', name: '📊 Progress updates', checked: false },
        ],
      });
    });
  });

  describe('Batch operations prompts', () => {
    it('should prompt for batch upload confirmation', async () => {
      const { confirm } = await import('@inquirer/prompts');
      (confirm as any).mockResolvedValue(true);

      const configs = [
        { id: '1', name: 'Config 1', size: 500 },
        { id: '2', name: 'Config 2', size: 750 },
        { id: '3', name: 'Config 3', size: 300 },
      ];

      const result = await service.confirmBatchUpload(configs);

      expect(result).toBe(true);
      expect(mockLogger.log).toHaveBeenCalledWith(
        '📦 Found 3 configurations ready for upload:',
      );
      expect(mockLogger.log).toHaveBeenCalledWith('  • Config 1 (500 KB)');
      expect(mockLogger.log).toHaveBeenCalledWith('  • Config 2 (750 KB)');
      expect(mockLogger.log).toHaveBeenCalledWith('  • Config 3 (300 KB)');
      expect(mockLogger.log).toHaveBeenCalledWith('  Total size: 1.5 MB');

      expect(confirm).toHaveBeenCalledWith({
        message: 'Upload all configurations?',
        default: true,
      });
    });

    it('should prompt for selective upload', async () => {
      const { checkbox } = await import('@inquirer/prompts');
      (checkbox as any).mockResolvedValue(['config1', 'config3']);

      const configs = [
        { id: 'config1', name: 'Config 1', size: 500 },
        { id: 'config2', name: 'Config 2', size: 750 },
        { id: 'config3', name: 'Config 3', size: 300 },
      ];

      const result = await service.selectConfigsForUpload(configs);

      expect(result).toEqual(['config1', 'config3']);
      expect(checkbox).toHaveBeenCalledWith({
        message: 'Select configurations to upload:',
        choices: [
          { value: 'config1', name: 'Config 1 (500 KB)', checked: true },
          { value: 'config2', name: 'Config 2 (750 KB)', checked: true },
          { value: 'config3', name: 'Config 3 (300 KB)', checked: true },
        ],
      });
    });
  });

  describe('Error recovery prompts', () => {
    it('should prompt for retry on upload failure', async () => {
      const { select } = await import('@inquirer/prompts');
      (select as any).mockResolvedValue('retry');

      const error = {
        message: 'Network timeout',
        code: 'ETIMEDOUT',
      };

      const result = await service.handleUploadError(error);

      expect(result).toBe('retry');
      expect(mockLogger.error).toHaveBeenCalledWith(
        '❌ Upload failed: Network timeout',
      );
      expect(select).toHaveBeenCalledWith({
        message: 'What would you like to do?',
        choices: [
          { value: 'retry', name: '🔄 Retry upload' },
          { value: 'save', name: '💾 Save locally only' },
          { value: 'debug', name: '🐛 Show debug information' },
          { value: 'cancel', name: '❌ Cancel' },
        ],
        default: 'retry',
      });
    });

    it('should prompt for partial success handling', async () => {
      const { select } = await import('@inquirer/prompts');
      (select as any).mockResolvedValue('continue');

      const partial = {
        successful: ['agents', 'commands'],
        failed: ['mcp_servers'],
        errors: ['MCP server configuration validation failed'],
      };

      const result = await service.handlePartialSuccess(partial);

      expect(result).toBe('continue');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '⚠️  Partial upload success:',
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        '  ✅ Successful: agents, commands',
      );
      expect(mockLogger.error).toHaveBeenCalledWith('  ❌ Failed: mcp_servers');
      expect(mockLogger.error).toHaveBeenCalledWith(
        '  Error: MCP server configuration validation failed',
      );

      expect(select).toHaveBeenCalledWith({
        message: 'How would you like to proceed?',
        choices: [
          { value: 'continue', name: '➡️  Continue with successful parts' },
          { value: 'fix', name: '🔧 Fix issues and retry' },
          { value: 'cancel', name: '❌ Cancel entire upload' },
        ],
        default: 'continue',
      });
    });
  });
});
