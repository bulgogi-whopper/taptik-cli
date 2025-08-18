import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { ConflictResult } from '../interfaces/deployment-result.interface';

import { PromptService } from './prompt.service';

// Mock readline interface
const mockQuestion = vi.fn();
const mockClose = vi.fn();

vi.mock('node:readline/promises', () => ({
  createInterface: vi.fn(() => ({
    question: mockQuestion,
    close: mockClose,
  })),
}));

// Mock process.stdout
const mockStdoutWrite = vi.fn();

describe('PromptService', () => {
  let service: PromptService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock stdout.write
    vi.spyOn(process.stdout, 'write').mockImplementation(mockStdoutWrite);
    mockStdoutWrite.mockReturnValue(true);
    
    service = new PromptService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Ensure service cleanup
    if (service) {
      service.cleanup();
    }
  });

  describe('confirmDeployment', () => {
    it('should display deployment summary and get confirmation', async () => {
      mockQuestion.mockResolvedValue('y');

      const summary = {
        platform: 'claude-code',
        components: ['settings', 'agents'],
        fileCount: 5,
        mode: 'normal' as const,
      };

      const result = await service.confirmDeployment(summary);

      expect(result).toBe(true);
      expect(mockQuestion).toHaveBeenCalledWith(
        'Proceed with deployment? (y/n): '
      );
      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('Deployment Summary')
      );
    });

    it('should return false when user declines', async () => {
      mockQuestion.mockResolvedValue('n');

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
      expect(mockQuestion).not.toHaveBeenCalled();
    });

    it('should show dry-run warning', async () => {
      mockQuestion.mockResolvedValue('y');

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
    it('should handle overwrite option', async () => {
      mockQuestion.mockResolvedValue('o');

      const conflict: ConflictResult = {
        filePath: 'test.json',
        resolution: 'skipped',
      };

      const result = await service.selectConflictResolution(conflict);

      expect(result).toBe('overwrite');
      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('Conflict detected')
      );
    });

    it('should handle skip option', async () => {
      mockQuestion.mockResolvedValue('s');

      const conflict: ConflictResult = {
        filePath: 'test.json',
        resolution: 'skipped',
      };

      const result = await service.selectConflictResolution(conflict);

      expect(result).toBe('skip');
    });

    it('should handle merge option', async () => {
      mockQuestion.mockResolvedValue('m');

      const conflict: ConflictResult = {
        filePath: 'test.json',
        resolution: 'skipped',
      };

      const result = await service.selectConflictResolution(conflict);

      expect(result).toBe('merge');
    });

    it('should handle backup option', async () => {
      mockQuestion.mockResolvedValue('b');

      const conflict: ConflictResult = {
        filePath: 'test.json',
        resolution: 'skipped',
      };

      const result = await service.selectConflictResolution(conflict);

      expect(result).toBe('backup');
    });
  });

  describe('showProgress', () => {
    it('should display progress bar', () => {
      service.showProgress('Deploying files', 3, 10);

      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('30%')
      );
      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('Deploying files')
      );
    });

    it('should show completion when at 100%', () => {
      service.showProgress('Complete', 10, 10);

      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('100%')
      );
    });
  });

  describe('showDeploymentSummary', () => {
    it('should display deployment results', () => {
      const results = {
        deployed: ['file1.json', 'file2.json'],
        skipped: ['file3.json'],
        failed: [],
        backupCreated: true,
        duration: 2500,
      };

      service.showDeploymentSummary(results);

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
        expect.stringContaining('2.50s')
      );
    });
  });

  describe('askForRetry', () => {
    it('should return true when user confirms retry', async () => {
      mockQuestion.mockResolvedValue('y');

      const result = await service.askForRetry('Operation failed');

      expect(result).toBe(true);
      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('Operation failed')
      );
    });

    it('should return false when user declines retry', async () => {
      mockQuestion.mockResolvedValue('n');

      const result = await service.askForRetry('Operation failed');

      expect(result).toBe(false);
    });
  });

  describe('selectComponents', () => {
    it('should return all components when user selects "all"', async () => {
      mockQuestion.mockResolvedValue('all');

      const available = ['settings', 'agents', 'commands'];
      const result = await service.selectComponents(available);

      expect(result).toEqual(available);
    });

    it('should return empty array when user selects "none"', async () => {
      mockQuestion.mockResolvedValue('none');

      const available = ['settings', 'agents', 'commands'];
      const result = await service.selectComponents(available);

      expect(result).toEqual([]);
    });

    it('should return selected components by index', async () => {
      mockQuestion.mockResolvedValue('1,3');

      const available = ['settings', 'agents', 'commands'];
      const result = await service.selectComponents(available);

      expect(result).toEqual(['settings', 'commands']);
    });
  });

  describe('cleanup', () => {
    it('should close readline interface', () => {
      service.cleanup();

      expect(mockClose).toHaveBeenCalled();
    });
  });
});