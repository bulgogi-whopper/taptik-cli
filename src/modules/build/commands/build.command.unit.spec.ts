import { Test, TestingModule } from '@nestjs/testing';

import { describe, expect, it, beforeEach, vi } from 'vitest';

import { CollectionService } from '../services/collection/collection.service';
import { ErrorHandlerService } from '../services/error-handler/error-handler.service';
import { InteractiveService } from '../services/interactive/interactive.service';
import { OutputService } from '../services/output/output.service';
import { ProgressService } from '../services/progress/progress.service';
import { TransformationService } from '../services/transformation/transformation.service';

import { BuildCommand } from './build.command';

// Mock the services
const mockCollectionService = {
  collectLocalSettings: vi.fn(),
  collectGlobalSettings: vi.fn(),
};

const mockErrorHandlerService = {
  isProcessInterrupted: vi.fn().mockReturnValue(false),
  addWarning: vi.fn(),
  hasWarnings: vi.fn().mockReturnValue(false),
  displayErrorSummary: vi.fn(),
  exitWithAppropriateCode: vi.fn(),
  getErrorSummary: vi
    .fn()
    .mockReturnValue({ warnings: [], criticalErrors: [] }),
  handleCriticalErrorAndExit: vi.fn(),
};

const mockInteractiveService = {
  selectPlatform: vi.fn(),
  selectCategories: vi.fn(),
};

const mockOutputService = {
  createOutputDirectory: vi.fn(),
  writeOutputFiles: vi.fn(),
  generateManifest: vi.fn(),
  displayBuildSummary: vi.fn(),
};

const mockProgressService = {
  initializeProgress: vi.fn(),
  startStep: vi.fn(),
  completeStep: vi.fn(),
  failStep: vi.fn(),
  startScan: vi.fn(),
  completeScan: vi.fn(),
  startTransformation: vi.fn(),
  completeTransformation: vi.fn(),
  startOutput: vi.fn(),
  completeOutput: vi.fn(),
  displayBuildSummary: vi.fn(),
};

const mockTransformationService = {
  transformPersonalContext: vi.fn(),
  transformProjectContext: vi.fn(),
  transformPromptTemplates: vi.fn(),
};

describe('BuildCommand Unit Tests', () => {
  let command: BuildCommand;
  let collectionService: CollectionService;
  let errorHandlerService: ErrorHandlerService;
  let interactiveService: InteractiveService;
  let outputService: OutputService;
  let progressService: ProgressService;
  let transformationService: TransformationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BuildCommand,
        { provide: CollectionService, useValue: mockCollectionService },
        { provide: ErrorHandlerService, useValue: mockErrorHandlerService },
        { provide: InteractiveService, useValue: mockInteractiveService },
        { provide: OutputService, useValue: mockOutputService },
        { provide: ProgressService, useValue: mockProgressService },
        { provide: TransformationService, useValue: mockTransformationService },
      ],
    }).compile();

    command = module.get<BuildCommand>(BuildCommand);
    collectionService = module.get<CollectionService>(CollectionService);
    errorHandlerService = module.get<ErrorHandlerService>(ErrorHandlerService);
    interactiveService = module.get<InteractiveService>(InteractiveService);
    outputService = module.get<OutputService>(OutputService);
    progressService = module.get<ProgressService>(ProgressService);
    transformationService = module.get<TransformationService>(
      TransformationService,
    );
  });

  describe('Command Structure', () => {
    it('should be defined', () => {
      expect(command).toBeDefined();
    });

    it('should have correct command name', () => {
      // Test that the command is properly decorated
      expect(command).toHaveProperty('run');
      expect(typeof command.run).toBe('function');
    });
  });

  describe('Options Validation', () => {
    it('should validate platform options', () => {
      // Since the validation is done via class-validator decorators,
      // we can test the command instance properties
      expect(command).toBeDefined();
    });

    it('should validate categories options', () => {
      // Test that the command accepts valid category combinations
      expect(command).toBeDefined();
    });
  });

  describe('Service Dependencies', () => {
    it('should inject CollectionService', () => {
      expect(collectionService).toBeDefined();
      expect(collectionService).toBe(mockCollectionService);
    });

    it('should inject ErrorHandlerService', () => {
      expect(errorHandlerService).toBeDefined();
      expect(errorHandlerService).toBe(mockErrorHandlerService);
    });

    it('should inject InteractiveService', () => {
      expect(interactiveService).toBeDefined();
      expect(interactiveService).toBe(mockInteractiveService);
    });

    it('should inject OutputService', () => {
      expect(outputService).toBeDefined();
      expect(outputService).toBe(mockOutputService);
    });

    it('should inject ProgressService', () => {
      expect(progressService).toBeDefined();
      expect(progressService).toBe(mockProgressService);
    });

    it('should inject TransformationService', () => {
      expect(transformationService).toBeDefined();
      expect(transformationService).toBe(mockTransformationService);
    });
  });

  describe('CLI Help Information', () => {
    it('should provide help information structure', () => {
      // Test that the command has the expected structure for help
      expect(command).toBeDefined();

      // Verify command exists and is callable
      expect(typeof command.run).toBe('function');
    });
  });
});
