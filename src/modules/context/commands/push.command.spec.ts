import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AIPlatform } from '../interfaces';
import { ContextStorageService } from '../services/context-storage.service';
import { FileSystemUtility } from '../utils/file-system.utility';

import { ContextPushCommand } from './push.command';

vi.mock('node:fs/promises');

describe('ContextPushCommand', () => {
  let command: ContextPushCommand;
  let storageService: ContextStorageService;
  let fileSystemUtility: FileSystemUtility;

  const mockContext = {
    version: '1.0.0',
    metadata: {
      platform: AIPlatform.KIRO,
      created: '2024-01-01T00:00:00Z',
      modified: '2024-01-01T00:00:00Z',
    },
    personal: {},
    project: {},
  };

  beforeEach(async () => {
    const mockStorageService = {
      uploadContext: vi.fn(),
      validateContext: vi.fn(),
    };

    const mockFileSystemUtility = {
      fileExists: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      ensureDirectory: vi.fn(),
    };

    // Create the command instance directly with mocked dependencies
    command = new ContextPushCommand(
      mockStorageService as any,
      mockFileSystemUtility as any,
    );

    storageService = mockStorageService as any;
    fileSystemUtility = mockFileSystemUtility as any;
  });

  describe('run', () => {
    it('should push a valid context successfully', async () => {
      vi.mocked(fileSystemUtility.fileExists).mockResolvedValue(true);
      vi.mocked(fileSystemUtility.readFile).mockResolvedValue(
        JSON.stringify(mockContext),
      );

      vi.mocked(storageService.validateContext).mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
      });

      vi.mocked(storageService.uploadContext).mockResolvedValue({
        success: true,
        id: 'context-123',
        url: 'https://storage.example.com/context-123',
      });

      await command.run(['context.json']);

      expect(fileSystemUtility.fileExists).toHaveBeenCalledWith('context.json');
      expect(fileSystemUtility.readFile).toHaveBeenCalledWith('context.json');
      expect(storageService.validateContext).toHaveBeenCalledWith(mockContext);
      expect(storageService.uploadContext).toHaveBeenCalled();
    });

    it('should fail when file does not exist', async () => {
      vi.mocked(fileSystemUtility.fileExists).mockResolvedValue(false);

      await expect(command.run(['nonexistent.json'])).rejects.toThrow(
        'Context file not found',
      );
    });

    it('should fail validation without force flag', async () => {
      vi.mocked(fileSystemUtility.fileExists).mockResolvedValue(true);
      vi.mocked(fileSystemUtility.readFile).mockResolvedValue(
        JSON.stringify(mockContext),
      );

      vi.mocked(storageService.validateContext).mockResolvedValue({
        valid: false,
        errors: [
          {
            path: 'personal.name',
            message: 'Missing required field: personal.name',
          },
        ],
        warnings: [],
      });

      await expect(command.run(['context.json'])).rejects.toThrow(
        'Context validation failed',
      );

      expect(storageService.uploadContext).not.toHaveBeenCalled();
    });

    it('should force push with validation errors', async () => {
      vi.mocked(fileSystemUtility.fileExists).mockResolvedValue(true);
      vi.mocked(fileSystemUtility.readFile).mockResolvedValue(
        JSON.stringify(mockContext),
      );

      vi.mocked(storageService.validateContext).mockResolvedValue({
        valid: false,
        errors: [
          {
            path: 'personal.name',
            message: 'Missing required field: personal.name',
          },
        ],
        warnings: [],
      });

      vi.mocked(storageService.uploadContext).mockResolvedValue({
        success: true,
        id: 'context-123',
        url: 'https://storage.example.com/context-123',
      });

      await command.run(['context.json'], { force: true });

      expect(storageService.uploadContext).toHaveBeenCalled();
    });

    it('should handle upload failure', async () => {
      vi.mocked(fileSystemUtility.fileExists).mockResolvedValue(true);
      vi.mocked(fileSystemUtility.readFile).mockResolvedValue(
        JSON.stringify(mockContext),
      );

      vi.mocked(storageService.validateContext).mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
      });

      vi.mocked(storageService.uploadContext).mockResolvedValue({
        success: false,
        error: 'Network error',
      });

      await expect(command.run(['context.json'])).rejects.toThrow(
        'Network error',
      );
    });

    it('should apply custom metadata', async () => {
      vi.mocked(fileSystemUtility.fileExists).mockResolvedValue(true);
      vi.mocked(fileSystemUtility.readFile).mockResolvedValue(
        JSON.stringify(mockContext),
      );

      vi.mocked(storageService.validateContext).mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
      });

      vi.mocked(storageService.uploadContext).mockResolvedValue({
        success: true,
        id: 'context-123',
        url: 'https://storage.example.com/context-123',
      });

      await command.run(['context.json'], {
        name: 'Custom Name',
        description: 'Custom Description',
        tags: 'tag1,tag2,tag3',
      });

      expect(storageService.uploadContext).toHaveBeenCalled();
    });
  });
});
