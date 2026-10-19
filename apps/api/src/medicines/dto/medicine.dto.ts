import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { AvailabilityStatus, DosageForm } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : typeof value === 'string' ? value.trim() : value;
const toBool = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value);
const csvList = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.split(',').map((v) => v.trim()).filter(Boolean) : value;

export class SearchMedicinesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Name or active ingredient (case/accent-insensitive)' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: DosageForm })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEnum(DosageForm)
  dosageForm?: DosageForm;

  @ApiPropertyOptional({ example: '500 mg' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(50)
  strength?: string;

  @ApiPropertyOptional({ example: '20 tableta' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(50)
  packageSize?: string;

  @ApiPropertyOptional({ enum: ['relevance', 'name', 'availability'], default: 'relevance' })
  @IsOptional()
  @IsIn(['relevance', 'name', 'availability'])
  sort: 'relevance' | 'name' | 'availability' = 'relevance';

  @ApiPropertyOptional({ description: 'Only medicines reported available by at least one pharmacy' })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  availableOnly?: boolean;
}

export class SuggestQueryDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q: string;
}

export class AvailabilityQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ description: 'Requires lat/lng', minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  radiusKm?: number;

  @ApiPropertyOptional({ description: 'Comma-separated statuses', example: 'IN_STOCK,LOW_STOCK' })
  @IsOptional()
  @Transform(csvList)
  @IsArray()
  @ArrayMaxSize(4)
  @IsEnum(AvailabilityStatus, { each: true })
  status?: AvailabilityStatus[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ enum: ['distance', 'updated', 'status'], default: 'status' })
  @IsOptional()
  @IsIn(['distance', 'updated', 'status'])
  sort: 'distance' | 'updated' | 'status' = 'status';

  @ApiPropertyOptional({ description: 'Hide entries older than the stale threshold' })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  hideStale?: boolean;
}

export class CreateMedicineDto {
  @ApiProperty({ example: 'Paracetamol' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: 'MF-000123', description: 'Optional catalog/registry code used by imports' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(50)
  catalogCode?: string;

  @ApiPropertyOptional({ example: 'Paracetamol' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(200)
  activeIngredient?: string;

  @ApiPropertyOptional({ example: '500 mg' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(50)
  strength?: string;

  @ApiPropertyOptional({ enum: DosageForm })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEnum(DosageForm)
  dosageForm?: DosageForm;

  @ApiPropertyOptional({ example: '20 tableta' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(50)
  packageSize?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(150)
  manufacturer?: string;
}

export class UpdateMedicineDto extends PartialType(CreateMedicineDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdminMedicinesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: ['active', 'inactive', 'all'], default: 'all' })
  @IsOptional()
  @IsIn(['active', 'inactive', 'all'])
  status: 'active' | 'inactive' | 'all' = 'all';
}
