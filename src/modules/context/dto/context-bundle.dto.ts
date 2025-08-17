import { Type } from 'class-transformer';
import {
  IsString,
  IsObject,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsNumber,
} from 'class-validator';

import type { TaptikContext, AIPlatform } from '../interfaces';

export class ContextBundleDto {
  @IsString()
  version: string;

  @IsString()
  created_at: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object) // Will be replaced with TaptikContextDto when created
  contexts: TaptikContext[];

  @IsOptional()
  @IsObject()
  metadata?: BundleMetadataDto;
}

export class BundleMetadataDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsString()
  checksum?: string;

  @IsOptional()
  @IsBoolean()
  compressed?: boolean;

  @IsOptional()
  @IsObject()
  encryption?: {
    algorithm?: string;
    key_id?: string;
  };
}

export class BuildOptionsDto {
  @IsOptional()
  @IsBoolean()
  excludeSensitive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includeOnly?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  exclude?: string[];

  @IsOptional()
  @IsBoolean()
  validate?: boolean;

  @IsOptional()
  @IsString()
  output?: string;
}

export class DeployOptionsDto {
  @IsOptional()
  @IsBoolean()
  backup?: boolean;

  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @IsOptional()
  @IsBoolean()
  dry_run?: boolean;

  @IsOptional()
  @IsString()
  merge_strategy?: 'overwrite' | 'merge' | 'prompt';

  @IsOptional()
  @IsString()
  target_scope?: 'global' | 'project' | 'both';
}

export class ConvertOptionsDto {
  @IsString()
  from: AIPlatform;

  @IsString()
  to: AIPlatform;

  @IsOptional()
  @IsBoolean()
  validate?: boolean;

  @IsOptional()
  @IsBoolean()
  compatibility_check?: boolean;

  @IsOptional()
  @IsBoolean()
  preserve_unsupported?: boolean;
}

export class PushOptionsDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  is_private?: boolean;

  @IsOptional()
  @IsString()
  team_id?: string;
}

export class PullOptionsDto {
  @IsString()
  context_id: string;

  @IsOptional()
  @IsBoolean()
  dry_run?: boolean;

  @IsOptional()
  @IsString()
  target_scope?: 'global' | 'project' | 'both';

  @IsOptional()
  @IsString()
  merge_strategy?: 'overwrite' | 'merge' | 'prompt';

  @IsOptional()
  @IsBoolean()
  backup?: boolean;
}

export class ListOptionsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsString()
  platform?: AIPlatform;

  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsNumber()
  offset?: number;

  @IsOptional()
  @IsString()
  sort_by?: 'created_at' | 'updated_at' | 'name' | 'downloads';

  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc';
}
