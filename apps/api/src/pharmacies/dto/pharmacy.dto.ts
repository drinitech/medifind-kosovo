import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : typeof value === 'string' ? value.trim() : value;

/** Kosovo spans roughly 41.8–43.3°N, 19.9–21.8°E; a small margin is allowed. */
const KOSOVO_BOUNDS = { minLat: 41.7, maxLat: 43.4, minLng: 19.8, maxLng: 21.9 };

export class PharmacyProfileDto {
  @ApiProperty({ example: 'Farmacia Shembull' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'Rruga Shembull 1' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  address: string;

  @ApiProperty({ example: 'Prishtinë' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city: string;

  @ApiProperty({ example: 42.6629 })
  @Type(() => Number)
  @IsLatitude()
  @Min(KOSOVO_BOUNDS.minLat, { message: 'latitude must be within Kosovo' })
  @Max(KOSOVO_BOUNDS.maxLat, { message: 'latitude must be within Kosovo' })
  latitude: number;

  @ApiProperty({ example: 21.1655 })
  @Type(() => Number)
  @IsLongitude()
  @Min(KOSOVO_BOUNDS.minLng, { message: 'longitude must be within Kosovo' })
  @Max(KOSOVO_BOUNDS.maxLng, { message: 'longitude must be within Kosovo' })
  longitude: number;

  @ApiPropertyOptional({ description: 'Public contact phone shown to users' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @Matches(/^\+?[0-9 ()-]{6,20}$/, { message: 'phone must be a valid phone number' })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  @MaxLength(254)
  email?: string;
}

export class UpdatePharmacyProfileDto extends PartialType(PharmacyProfileDto) {}

export class PharmacyScopeQueryDto {
  @ApiPropertyOptional({ description: 'Required for administrators and managers of several pharmacies' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  pharmacyId?: string;
}

export class ListPharmaciesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Only verified pharmacies that report inventory' })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  participating?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(80)
  city?: string;
}

export class NearbyQueryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @ApiProperty()
  @Type(() => Number)
  @IsLongitude()
  lng: number;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  radiusKm: number = 10;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 50;
}

export class PharmacyInventoryPublicQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: ['available', 'all'], default: 'all' })
  @IsOptional()
  @IsIn(['available', 'all'])
  filter: 'available' | 'all' = 'all';
}
