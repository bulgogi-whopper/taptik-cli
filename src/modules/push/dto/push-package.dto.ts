import {
  IsBoolean,
  IsOptional,
  IsString,
  IsArray,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class PushPackageDto {
  @IsOptional()
  @IsBoolean()
  public?: boolean;

  @IsOptional()
  @IsBoolean()
  private?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  team?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/, {
    message:
      'Version must follow semantic versioning (e.g., 1.0.0, 1.0.0-beta.1)',
  })
  version?: string;

  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
