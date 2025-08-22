import { describe, it, expect, beforeEach, afterEach, vi, Mock, Mocked } from 'vitest';

import { CollectionService } from '../services/collection/collection.service';
import { ErrorHandlerService } from '../services/error-handler/error-handler.service';
import { InteractiveService } from '../services/interactive/interactive.service';
import { OutputService } from '../services/output/output.service';
import { ProgressService } from '../services/progress/progress.service';
import { TransformationService } from '../services/transformation/transformation.service';

import { BuildCommand } from './build.command';


describe('BuildCommand Error Handling', () => {
  let command: BuildCommand;
  let interactiveService: Mocked<InteractiveService>;
  let errorHandler: Mocked<ErrorHandlerService>;
  let collectionService: Mocked<CollectionService>;
  let transformationService: Mocked<TransformationService>;
  let outputService: Mocked<OutputService>;
  let progressService: Mocked<ProgressService>;

  beforeEach(() => {
    // Create mock services
    interactiveService = {
      selectPlatform: vi.fn(),
      selectCategories: vi.fn(),
    } as any;

    collectionService = {
      collectLocalSettings: vi.fn().mockResolvedValue({
        context: 'mock context',
        userPreferences: 'mock preferences',
        projectSpec: 'mock spec',
        steeringFiles: [],
        hookFiles: [],
      }),
      collectGlobalSettings: vi.fn().mockResolvedValue({
        userConfig: {},
        globalPreferences: {},
        promptTemplates: [],
        configFiles: [],
      }),
    } as any;

    transformationService = {
      transformPersonalContext: vi.fn().mockResolvedValue({}),
      transformProjectContext: vi.fn().mockResolvedValue({}),
      transformPromptTemplates: vi.fn().mockResolvedValue({}),
    } as any;

    outputService = {
      createOutputDirectory: vi.fn().mockResolvedValue('/mock/output/path'),
      writeOutputFiles: vi.fn().mockResolvedValue([]),
      generateManifest: vi.fn().mockResolvedValue(undefined),
      displayBuildSummary: vi.fn().mockResolvedValue(undefined),
    } as any;

    progressService = {
      initializeProgress: vi.fn(),
      startStep: vi.fn(),
      completeStep: vi.fn(),
      startScan: vi.fn(),
      completeScan: vi.fn(),
      startTransformation: vi.fn(),
      completeTransformation: vi.fn(),
      startOutput: vi.fn(),
      completeOutput: vi.fn(),
      displayBuildSummary: vi.fn(),
      failStep: vi.fn(),
    } as any;

    errorHandler = {
      isProcessInterrupted: vi.fn().mockReturnValue(false),
      hasWarnings: vi.fn().mockReturnValue(false),
      displayErrorSummary: vi.fn(),
      exitWithAppropriateCode: vi.fn().mockImplementation(() => {
        throw new Error('process.exit called');
      }),
      handleCriticalErrorAndExit: vi.fn().mockImplementation(() => {
        throw new Error('process.exit called');
      }),
      addWarning: vi.fn(),
      getErrorSummary: vi.fn().mockReturnValue({ warnings: [], criticalErrors: [] }),
    } as any;

    // Create command with mocked dependencies
    command = new BuildCommand(interactiveService, collectionService, transformationService, outputService, progressService, errorHandler);

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('User Interruption Handling', () => {
    it('should handle interruption before platform selection', async () => {
      (errorHandler.isProcessInterrupted as Mock).mockReturnValue(true);

      await command.run([], {});

      expect(interactiveService.selectPlatform).not.toHaveBeenCalled();
      expect(interactiveService.selectCategories).not.toHaveBeenCalled();
    });

    it('should handle interruption after platform selection', async () => {
      (interactiveService.selectPlatform as Mock).mockResolvedValue('kiro');
      (errorHandler.isProcessInterrupted as Mock)
        .mockReturnValueOnce(false) // Before platform selection
        .mockReturnValueOnce(true); // After platform selection

      await command.run([], {});

      expect(interactiveService.selectPlatform).toHaveBeenCalled();
      expect(interactiveService.selectCategories).not.toHaveBeenCalled();
    });

    it('should handle interruption after category selection', async () => {
      (interactiveService.selectPlatform as Mock).mockResolvedValue('kiro');
      (interactiveService.selectCategories as Mock).mockResolvedValue([
        { name: 'personal-context', enabled: true },
      ]);
      (errorHandler.isProcessInterrupted as Mock)
        .mockReturnValueOnce(false) // Before starting
        .mockReturnValueOnce(false) // After platform selection (in else branch)
        .mockReturnValueOnce(false) // After platform selection (duplicate check)
        .mockReturnValueOnce(true); // After category selection

      await command.run([], {});

      expect(interactiveService.selectPlatform).toHaveBeenCalled();
      expect(interactiveService.selectCategories).toHaveBeenCalled();
    });
  });

  describe('Critical Error Handling', () => {
    it('should handle timeout errors with appropriate exit code', async () => {
      const timeoutError = new Error('Operation timed out');
      timeoutError.name = 'TimeoutError';
      
      (interactiveService.selectPlatform as Mock).mockRejectedValue(timeoutError);

      await expect(command.run([], {})).rejects.toThrow('process.exit called');

      expect(errorHandler.handleCriticalErrorAndExit).toHaveBeenCalledWith({
        type: 'system',
        message: 'Build process timed out',
        details: 'Operation timed out',
        suggestedResolution: 'Try running the command again or check your system resources',
        exitCode: 124,
      });
    });

    it('should handle permission denied errors with appropriate exit code', async () => {
      const permissionError = new Error('Permission denied');
      (permissionError as any).code = 'EACCES';
      
      (interactiveService.selectPlatform as Mock).mockRejectedValue(permissionError);

      await expect(command.run([], {})).rejects.toThrow('process.exit called');

      expect(errorHandler.handleCriticalErrorAndExit).toHaveBeenCalledWith({
        type: 'file_system',
        message: 'Permission denied accessing files',
        details: 'Permission denied',
        suggestedResolution: 'Check file permissions or run with appropriate privileges',
        exitCode: 126,
      });
    });

    it('should handle file not found errors with appropriate exit code', async () => {
      const fileNotFoundError = new Error('File not found');
      (fileNotFoundError as any).code = 'ENOENT';
      
      (interactiveService.selectPlatform as Mock).mockRejectedValue(fileNotFoundError);

      await expect(command.run([], {})).rejects.toThrow('process.exit called');

      expect(errorHandler.handleCriticalErrorAndExit).toHaveBeenCalledWith({
        type: 'file_system',
        message: 'Required file or directory not found',
        details: 'File not found',
        suggestedResolution: 'Ensure all required files exist and paths are correct',
        exitCode: 2,
      });
    });

    it('should handle generic errors with default exit code', async () => {
      const genericError = new Error('Something went wrong');
      
      (interactiveService.selectPlatform as Mock).mockRejectedValue(genericError);

      await expect(command.run([], {})).rejects.toThrow('process.exit called');

      expect(errorHandler.handleCriticalErrorAndExit).toHaveBeenCalledWith({
        type: 'system',
        message: 'Build process failed with unexpected error',
        details: 'Something went wrong',
        suggestedResolution: 'Please report this issue with the error details',
        exitCode: 1,
      });
    });
  });

  describe('Successful Execution with Warnings', () => {
    it('should display warnings and exit appropriately on success', async () => {
      (interactiveService.selectPlatform as Mock).mockResolvedValue('kiro');
      (interactiveService.selectCategories as Mock).mockResolvedValue([
        { name: 'personal-context', enabled: true },
      ]);
      (errorHandler.hasWarnings as Mock).mockReturnValue(true);

      await expect(command.run([], {})).rejects.toThrow('process.exit called');

      expect(errorHandler.displayErrorSummary).toHaveBeenCalled();
      expect(errorHandler.exitWithAppropriateCode).toHaveBeenCalled();
    });

    it('should exit appropriately on success without warnings', async () => {
      (interactiveService.selectPlatform as Mock).mockResolvedValue('kiro');
      (interactiveService.selectCategories as Mock).mockResolvedValue([
        { name: 'personal-context', enabled: true },
      ]);
      (errorHandler.hasWarnings as Mock).mockReturnValue(false);

      await expect(command.run([], {})).rejects.toThrow('process.exit called');

      expect(errorHandler.displayErrorSummary).not.toHaveBeenCalled();
      expect(errorHandler.exitWithAppropriateCode).toHaveBeenCalled();
    });
  });

  describe('Error Handling During Category Selection', () => {
    it('should handle errors during category selection', async () => {
      (interactiveService.selectPlatform as Mock).mockResolvedValue('kiro');
      (interactiveService.selectCategories as Mock).mockRejectedValue(new Error('Category selection failed'));

      await expect(command.run([], {})).rejects.toThrow('process.exit called');

      expect(errorHandler.handleCriticalErrorAndExit).toHaveBeenCalledWith({
        type: 'system',
        message: 'Build process failed with unexpected error',
        details: 'Category selection failed',
        suggestedResolution: 'Please report this issue with the error details',
        exitCode: 1,
      });
    });
  });

  describe('Multiple Interruption Checks', () => {
    it('should check for interruption at each major step', async () => {
      (interactiveService.selectPlatform as Mock).mockResolvedValue('kiro');
      (interactiveService.selectCategories as Mock).mockResolvedValue([
        { name: 'personal-context', enabled: true },
      ]);

      await expect(command.run([], {})).rejects.toThrow('process.exit called');

      // Should check for interruption 7 times:
      // 1. Before starting
      // 2. After platform selection (in else branch)
      // 3. After platform selection (duplicate check)
      // 4. After category selection
      // 5. After data collection
      // 6. After data transformation
      // 7. After output generation
      expect(errorHandler.isProcessInterrupted).toHaveBeenCalledTimes(7);
    });
  });
});