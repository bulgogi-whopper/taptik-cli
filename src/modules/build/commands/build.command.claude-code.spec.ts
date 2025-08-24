/**
 * Unit tests for Claude Code Build Command
 */

import { Test } from '@nestjs/testing';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MetadataGeneratorService } from '../../context/services/metadata-generator.service';
import { PackageService } from '../../context/services/package.service';
import { SanitizationService } from '../../context/services/sanitization.service';
import { ValidationService } from '../../context/services/validation.service';
import { CollectionService } from '../services/collection/collection.service';
import { ErrorHandlerService } from '../services/error-handler/error-handler.service';
import { InteractiveService } from '../services/interactive/interactive.service';
import { OutputService } from '../services/output/output.service';
import { ProgressService } from '../services/progress/progress.service';
import { TransformationService } from '../services/transformation/transformation.service';

import { BuildCommand } from './build.command';

describe('Claude Code Build Command', () => {
  let command: BuildCommand;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BuildCommand,
        {
          provide: InteractiveService,
          useValue: {
            selectPlatform: vi.fn(),
            selectCategories: vi.fn(),
          },
        },
        {
          provide: CollectionService,
          useValue: {
            collectClaudeCodeLocalSettings: vi.fn(),
            collectClaudeCodeGlobalSettings: vi.fn(),
            collectLocalSettings: vi.fn(),
            collectGlobalSettings: vi.fn(),
          },
        },
        {
          provide: TransformationService,
          useValue: {
            transformClaudeCodePersonalContext: vi.fn(),
            transformClaudeCodeProjectContext: vi.fn(),
            transformClaudeCodePromptTemplates: vi.fn(),
            transformPersonalContext: vi.fn(),
            transformProjectContext: vi.fn(),
            transformPromptTemplates: vi.fn(),
          },
        },
        {
          provide: SanitizationService,
          useValue: {
            sanitizeForCloudUpload: vi.fn(),
          },
        },
        {
          provide: MetadataGeneratorService,
          useValue: {
            generateCloudMetadata: vi.fn(),
          },
        },
        {
          provide: PackageService,
          useValue: {
            createTaptikPackage: vi.fn(),
            writePackageToFile: vi.fn(),
          },
        },
        {
          provide: ValidationService,
          useValue: {
            validateForCloudUpload: vi.fn(),
          },
        },
        {
          provide: OutputService,
          useValue: {
            createOutputDirectory: vi.fn(),
            writeOutputFiles: vi.fn(),
            generateManifest: vi.fn(),
            displayBuildSummary: vi.fn(),
            writeCloudMetadata: vi.fn(),
            writeSanitizationReport: vi.fn(),
            writeValidationReport: vi.fn(),
          },
        },
        {
          provide: ProgressService,
          useValue: {
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
          },
        },
        {
          provide: ErrorHandlerService,
          useValue: {
            isProcessInterrupted: vi.fn().mockReturnValue(false),
            handleCriticalErrorAndExit: vi.fn(),
            addWarning: vi.fn(),
            hasWarnings: vi.fn().mockReturnValue(false),
            getErrorSummary: vi.fn(),
            displayErrorSummary: vi.fn(),
            exitWithAppropriateCode: vi.fn(),
          },
        },
      ],
    }).compile();

    command = module.get(BuildCommand);
  });

  it('should be defined', () => {
    expect(command).toBeDefined();
  });

  it('should create command with all required services', () => {
    expect(command).toBeDefined();
    expect(command.run).toBeDefined();
  });
});
