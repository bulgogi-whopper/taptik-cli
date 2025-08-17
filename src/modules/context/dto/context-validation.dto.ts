import { Type } from 'class-transformer';
import {
  IsString,
  IsArray,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsDateString,
  ValidateNested,
  IsObject,
} from 'class-validator';

import { SecurityAction } from '../constants';

/**
 * DTO for validating TaptikContext structure
 * Ensures exported contexts meet required format standards
 */

export class ContextMetadataDto {
  @IsString()
  version: string;

  @IsDateString()
  exportedAt: string;

  @IsString()
  sourceIde: string;

  @IsArray()
  @IsString({ each: true })
  targetIdes: string[];

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @IsOptional()
  @IsString()
  generatedBy?: string;
}

export class SecurityInfoDto {
  @IsBoolean()
  hasApiKeys: boolean;

  @IsArray()
  @IsString({ each: true })
  filteredFields: string[];

  @ValidateNested()
  @Type(() => ScanResultsDto)
  scanResults: ScanResultsDto;

  @IsOptional()
  @IsArray()
  detectedPatterns?: Array<{
    pattern: string;
    field: string;
    action: SecurityAction.REMOVED | SecurityAction.MASKED;
  }>;
}

export class ScanResultsDto {
  @IsBoolean()
  passed: boolean;

  @IsArray()
  @IsString({ each: true })
  warnings: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  errors?: string[];
}

export class TaptikContextDto {
  @ValidateNested()
  @Type(() => ContextMetadataDto)
  metadata: ContextMetadataDto;

  @IsObject()
  content: Record<string, unknown>;

  @ValidateNested()
  @Type(() => SecurityInfoDto)
  security: SecurityInfoDto;
}

export class CloudMetadataDto {
  @IsString()
  configId: string;

  @IsString()
  storagePath: string;

  @IsOptional()
  @IsString()
  downloadUrl?: string;

  @IsBoolean()
  isPublic: boolean;

  @IsString()
  uploadedBy: string;

  @IsDateString()
  uploadedAt: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CloudStatsDto)
  stats?: CloudStatsDto;
}

export class CloudStatsDto {
  @IsNumber()
  downloadCount: number;

  @IsNumber()
  likeCount: number;

  @IsOptional()
  @IsNumber()
  viewCount?: number;
}

export class DeployableContextDto extends TaptikContextDto {
  @ValidateNested()
  @Type(() => CloudMetadataDto)
  cloudMetadata: CloudMetadataDto;
}

/**
 * Validation constants for consistent format checking
 */
export const VALIDATION_CONSTANTS = {
  SUPPORTED_IDES: ['claude-code', 'kiro-ide', 'cursor-ide'] as const,
  REQUIRED_VERSION_FORMAT: /^\d+\.\d+\.\d+$/,
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_TITLE_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_TAGS: 10,
  SENSITIVE_PATTERNS: [
    /api[_-]?key/i,
    /secret/i,
    /token/i,
    /password/i,
    /private[_-]?key/i,
    /access[_-]?key/i,
    /auth[_-]?token/i,
  ],
} as const;

export type SupportedIde = (typeof VALIDATION_CONSTANTS.SUPPORTED_IDES)[number];

/**
 * Export format validation utilities
 */
export class ContextValidator {
  static validateIdeSupport(sourceIde: string, targetIdes: string[]): boolean {
    return (
      VALIDATION_CONSTANTS.SUPPORTED_IDES.includes(sourceIde as SupportedIde) &&
      targetIdes.every((ide) =>
        VALIDATION_CONSTANTS.SUPPORTED_IDES.includes(ide as SupportedIde),
      )
    );
  }

  static validateVersion(version: string): boolean {
    return VALIDATION_CONSTANTS.REQUIRED_VERSION_FORMAT.test(version);
  }

  static scanForSensitiveData(content: unknown): string[] {
    const detected: string[] = [];
    const jsonString = JSON.stringify(content);

    VALIDATION_CONSTANTS.SENSITIVE_PATTERNS.forEach((pattern) => {
      if (pattern.test(jsonString)) {
        detected.push(pattern.source);
      }
    });

    return detected;
  }

  static validateFileSize(size: number): boolean {
    return size <= VALIDATION_CONSTANTS.MAX_FILE_SIZE;
  }
}
