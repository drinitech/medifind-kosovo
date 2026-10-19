import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : typeof value === 'string' ? value.trim() : value;

/** Location fields must be given together (lat + lng + radius) or not at all. */
const hasAnyLocation = (o: { latitude?: unknown; longitude?: unknown; radiusKm?: unknown }) =>
  [o.latitude, o.longitude, o.radiusKm].some((v) => v !== undefined && v !== null);

export class CreateAlertDto {
  @ApiProperty()
  @IsString()
  @MaxLength(40)
  medicineId: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(80)
  preferredCity?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(hasAnyLocation)
  @Type(() => Number)
  @IsLatitude()
  latitude?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(hasAnyLocation)
  @Type(() => Number)
  @IsLongitude()
  longitude?: number | null;

  @ApiPropertyOptional({ nullable: true, minimum: 1, maximum: 100 })
  @ValidateIf(hasAnyLocation)
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  radiusKm?: number | null;
}

export class UpdateAlertDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(80)
  preferredCity?: string | null;

  @ApiPropertyOptional({ nullable: true, minimum: 1, maximum: 100 })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  radiusKm?: number | null;
}
