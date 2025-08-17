import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { ConflictResult } from '../interfaces/deployment-result.interface';

import { PromptService } from './prompt.service';

// Mock readline interface
vi.mock('node:readline/promises', () => ({
  default: {
    createInterface: vi.fn(() => ({
      question: vi.fn(),
      close: vi.fn(),
    })),
  },
  createInterface: vi.fn(() => ({
    question: vi.fn(),
    close: vi.fn(),
  })),
}));

// Mock process.stdout
const mockStdoutWrite = vi.fn();
const originalStdoutWrite = process.stdout.write;

describe('PromptService', () => {
  let service: PromptService;
  let mockReadline: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromptService],
    }).compile();

    service = module.get<PromptService>(PromptService);

    // Setup readline mock
    const readline = await import('node:readline/promises');
    mockReadline = {
      question: vi.fn(),
      close: vi.fn(),
    };
    vi.mocked(readline.createInterface).mockReturnValue(mockReadline);

    // Mock stdout
    process.stdout.write = mockStdoutWrite as any;
    mockStdoutWrite.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.stdout.write = originalStdoutWrite;
  });

  describe('confirmDeployment', () => {
    it('should display deployment summary and get confirmation', async () => {
      mockReadline.question.mockResolvedValue('y');

      const summary = {
        platform: 'claude-code',
        components: ['settings', 'agents'],
        fileCount: 5,
        mode: 'normal' as const,
      };

      const result = await service.confirmDeployment(summary);

      expect(result).toBe(true);
      expect(mockReadline.question).toHaveBeenCalledWith(
        expect.stringContaining('Proceed with deployment? (y/n): ')
      );
      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('Deployment Summary')
      );
    });

    it('should return false when user declines', async () => {
      mockReadline.question.mockResolvedValue('n');

      const summary = {
        platform: 'claude-code',
        components: ['settings'],
        fileCount: 1,
        mode: 'normal' as const,
      };

      const result = await service.confirmDeployment(summary);

      expect(result).toBe(false);
    });

    it('should skip confirmation in force mode', async () => {
      const summary = {
        platform: 'claude-code',
        components: ['settings'],
        fileCount: 1,
        mode: 'force' as const,
      };

      const result = await service.confirmDeployment(summary);

      expect(result).toBe(true);
      expect(mockReadline.question).not.toHaveBeenCalled();
    });

    it('should display dry-run warning', async () => {
      mockReadline.question.mockResolvedValue('y');

      const summary = {
        platform: 'claude-code',
        components: ['settings'],
        fileCount: 1,
        mode: 'dry-run' as const,
      };

      await service.confirmDeployment(summary);

      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('DRY RUN MODE')
      );
    });
  });

  describe('selectConflictResolution', () => {
    it('should display conflict details and options', async () => {
      mockReadline.question.mockResolvedValue('o');

      const conflict: ConflictResult = {
        filePath: '~/.claude/settings.json',
        message: 'File already exists',
        resolution: 'skipped',
        originalContent: '{"old": true}',
        newContent: '{"new": true}',
      };

      const result = await service.selectConflictResolution(conflict);

      expect(result).toBe('overwrite');
      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('Conflict detected')
      );
      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('[o] Overwrite')
      );
    });

    it('should handle skip option', async () => {
      mockReadline.question.mockResolvedValue('s');

      const conflict: ConflictResult = {
        filePath: 'test.json',
        resolution: 'skipped',
      };

      const result = await service.selectConflictResolution(conflict);

      expect(result).toBe('skip');
    });

    it('should handle merge option', async () => {
      mockReadline.question.mockResolvedValue('m');

      const conflict: ConflictResult = {
        filePath: 'test.json',
        resolution: 'skipped',
      };

      const result = await service.selectConflictResolution(conflict);

      expect(result).toBe('merge');
    });

    it('should handle backup option', async () => {
      mockReadline.question.mockResolvedValue('b');

      const conflict: ConflictResult = {
        filePath: 'test.json',
        resolution: 'skipped',
      };

      const result = await service.selectConflictResolution(conflict);

      expect(result).toBe('backup');
    });

    it('should show diff when requested', async () => {
      mockReadline.question
        .mockResolvedValueOnce('d') // Show diff
        .mockResolvedValueOnce('o'); // Then overwrite

      const conflict: ConflictResult = {
        filePath: 'test.json',
        resolution: 'skipped',
        originalContent: '{"old": true}',
        newContent: '{"new": true}',
      };

      const result = await service.selectConflictResolution(conflict);

      expect(result).toBe('overwrite');
      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('---')
      );
      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('+++')
      );
    });

    it('should handle invalid input with retry', async () => {
      mockReadline.question
        .mockResolvedValueOnce('x') // Invalid
        .mockResolvedValueOnce('s'); // Valid

      const conflict: ConflictResult = {
        filePath: 'test.json',
        resolution: 'skipped',
      };

      const result = await service.selectConflictResolution(conflict);

      expect(result).toBe('skip');
      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('Invalid option')
      );
    });
  });

  describe('showProgress', () => {
    it('should display progress bar', () => {
      service.showProgress('Deploying', 5, 10);

      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('Deploying')
      );
      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('[')
      );
      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('50%')
      );
    });

    it('should handle 100% progress', () => {
      service.showProgress('Complete', 10, 10);

      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('100%')
      );
    });

    it('should handle 0% progress', () => {
      service.showProgress('Starting', 0, 10);

      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('0%')
      );
    });
  });

  describe('showDeploymentSummary', () => {
    it('should display deployment results', () => {
      const results = {
        deployed: ['settings.json', 'agents/helper.md'],
        skipped: ['commands/test.sh'],
        failed: [],
        backupCreated: true,
        duration: 1234,
      };

      service.showDeploymentSummary(results);

      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('Deployment Complete')
      );
      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('2 files deployed')
      );
      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('1 file skipped')
      );
      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('Backup created')
      );
      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('1.23s')
      );
    });

    it('should display failed deployments', () => {
      const results = {
        deployed: [],
        skipped: [],
        failed: ['error.json'],
        backupCreated: false,
        duration: 500,
      };

      service.showDeploymentSummary(results);

      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('1 file failed')
      );
    });
  });

  describe('askForRetry', () => {
    it('should ask for retry confirmation', async () => {
      mockReadline.question.mockResolvedValue('y');

      const result = await service.askForRetry('Network error occurred');

      expect(result).toBe(true);
      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('Network error occurred')
      );
      expect(mockReadline.question).toHaveBeenCalledWith(
        expect.stringContaining('Retry? (y/n): ')
      );
    });

    it('should return false when user declines retry', async () => {
      mockReadline.question.mockResolvedValue('n');

      const result = await service.askForRetry('Error');

      expect(result).toBe(false);
    });
  });

  describe('selectComponents', () => {
    it('should allow component selection', async () => {
      mockReadline.question.mockResolvedValue('1,3');

      const available = ['settings', 'agents', 'commands', 'project'];
      const result = await service.selectComponents(available);

      expect(result).toEqual(['settings', 'commands']);
      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('[1] settings')
      );
      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('[4] project')
      );
    });

    it('should handle all selection', async () => {
      mockReadline.question.mockResolvedValue('all');

      const available = ['settings', 'agents'];
      const result = await service.selectComponents(available);

      expect(result).toEqual(['settings', 'agents']);
    });

    it('should handle none selection', async () => {
      mockReadline.question.mockResolvedValue('none');

      const available = ['settings', 'agents'];
      const result = await service.selectComponents(available);

      expect(result).toEqual([]);
    });
  });

  describe('cleanup', () => {
    it('should close readline interface', () => {
      service.cleanup();
      expect(mockReadline.close).toHaveBeenCalled();
    });
  });
});