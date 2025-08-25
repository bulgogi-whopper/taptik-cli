import { Type } from 'class-transformer';
import {
  IsString,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsArray,
  IsDate,
  IsIn,
  IsUUID,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';

export class ComponentInfoDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsNumber()
  count!: number;
}

export class PackageMetadataDto {
  @IsUUID()
  id!: string;

  @IsString()
  @IsNotEmpty()
  configId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  version!: string;

  @IsString()
  @IsNotEmpty()
  platform!: string;

  @IsBoolean()
  isPublic!: boolean;

  @IsIn(['safe', 'warning', 'blocked'])
  sanitizationLevel!: 'safe' | 'warning' | 'blocked';

  @IsString()
  @IsNotEmpty()
  checksum!: string;

  @IsString()
  @IsNotEmpty()
  storageUrl!: string;

  @IsNumber()
  packageSize!: number;

  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComponentInfoDto)
  components!: ComponentInfoDto[];

  @IsArray()
  @IsString({ each: true })
  autoTags!: string[];

  @IsArray()
  @IsString({ each: true })
  userTags!: string[];

  @IsDate()
  @Type(() => Date)
  createdAt!: Date;

  @IsDate()
  @Type(() => Date)
  updatedAt!: Date;
}