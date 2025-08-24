import {
  CloudMetadata,
  SanitizationResult,
  TaptikPackage,
  ValidationResult as CloudValidationResult,
} from '../../context/interfaces/cloud.interface';

import {
  TaptikPersonalContext,
  TaptikProjectContext,
  TaptikPromptTemplates,
} from './taptik-format.interface';

export interface CloudCollectionService {
  collectClaudeCodeLocalSettings?(): Promise<unknown>;
  collectClaudeCodeGlobalSettings?(): Promise<unknown>;
}

export interface CloudTransformationService {
  transformClaudeCodePersonalContext?(
    localData: unknown,
    globalData: unknown,
  ): Promise<TaptikPersonalContext>;
  transformClaudeCodeProjectContext?(
    localData: unknown,
    globalData: unknown,
  ): Promise<TaptikProjectContext>;
  transformClaudeCodePromptTemplates?(
    localData: unknown,
    globalData: unknown,
  ): Promise<TaptikPromptTemplates>;
}

export interface CloudOutputService {
  writeCloudMetadata?(
    outputPath: string,
    metadata: CloudMetadata,
  ): Promise<void>;
  writeSanitizationReport?(
    outputPath: string,
    report: SanitizationResult['report'],
  ): Promise<void>;
  writeValidationReport?(
    outputPath: string,
    validationResult: CloudValidationResult,
  ): Promise<void>;
  displayCloudReadySummary?(
    outputPath: string,
    cloudPackage: TaptikPackage,
    validationResult: CloudValidationResult | undefined,
  ): Promise<void>;
}

export interface CloudInteractiveService {
  confirmAutoUpload?(metadata: CloudMetadata): Promise<boolean>;
  promptForManualUpload?(metadata: CloudMetadata): Promise<void>;
}
