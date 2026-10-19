import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AvailabilityStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : typeof value === 'string' ? value.trim() : value;
const csvList = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.split(',').map((v) => v.trim()).filter(Boolean) : value;

export const MAX_QUANTITY = 1_000_000;

export class InventoryListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  pharmacyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ description: 'Comma-separated statuses' })
  @IsOptional()
  @Transform(csvList)
  @IsArray()
  @IsEnum(AvailabilityStatus, { each: true })
  status?: AvailabilityStatus[];

  @ApiPropertyOptional({ enum: ['active', 'inactive', 'all'], default: 'active' })
  @IsOptional()
  @IsIn(['active', 'inactive', 'all'])
  active: 'active' | 'inactive' | 'all' = 'active';

  @ApiPropertyOptional({ enum: ['fresh', 'aging', 'stale'] })
  @IsOptional()
  @IsIn(['fresh', 'aging', 'stale'])
  freshness?: 'fresh' | 'aging' | 'stale';

  @ApiPropertyOptional({ enum: ['name', 'status', 'quantity', 'lastReportedAt'], default: 'name' })
  @IsOptional()
  @IsIn(['name', 'status', 'quantity', 'lastReportedAt'])
  sort: 'name' | 'status' | 'quantity' | 'lastReportedAt' = 'name';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'asc';
}

export class CreateInventoryDto {
  @ApiProperty()
  @IsString()
  @MaxLength(40)
  medicineId: string;

  @ApiPropertyOptional({ enum: AvailabilityStatus, description: 'Derived from quantity when omitted' })
  @IsOptional()
  @IsEnum(AvailabilityStatus)
  availabilityStatus?: AvailabilityStatus;

  @ApiPropertyOptional({ nullable: true, minimum: 0 })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_QUANTITY)
  quantity?: number | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  showQuantityPublicly?: boolean;
}

export class UpdateInventoryDto {
  @ApiPropertyOptional({ enum: AvailabilityStatus })
  @IsOptional()
  @IsEnum(AvailabilityStatus)
  availabilityStatus?: AvailabilityStatus;

  @ApiPropertyOptional({ nullable: true, minimum: 0 })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_QUANTITY)
  quantity?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showQuantityPublicly?: boolean;

  @ApiPropertyOptional({ description: 'false deactivates; true reactivates' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class BulkUpdateInventoryDto {
  @ApiProperty({ type: [String], maxItems: 500 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  ids: string[];

  @ApiPropertyOptional({ enum: AvailabilityStatus })
  @IsOptional()
  @IsEnum(AvailabilityStatus)
  availabilityStatus?: AvailabilityStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showQuantityPublicly?: boolean;

  @ApiPropertyOptional({ description: 'Re-confirm the selected entries as current without changing them' })
  @IsOptional()
  @IsBoolean()
  confirmCurrent?: boolean;
}

export class HistoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  pharmacyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  inventoryId?: string;
}

export class ImportConfirmDto {
  @ApiProperty()
  @IsString()
  @MaxLength(40)
  batchId: string;
}
