import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trimLower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class RegisterDto {
  @ApiProperty({ example: 'Arta Krasniqi' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ example: 'arta@example.com' })
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ minLength: 8, description: 'At least 8 characters, including a letter and a digit.' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'password must contain at least one letter and one digit' })
  password: string;

  @ApiPropertyOptional({
    enum: ['USER', 'PHARMACY'],
    default: 'USER',
    description: 'PHARMACY creates a pharmacy-manager account. Administrator accounts cannot be self-registered.',
  })
  @IsOptional()
  @IsIn(['USER', 'PHARMACY'])
  accountType?: 'USER' | 'PHARMACY';
}

export class LoginDto {
  @ApiProperty()
  @Transform(trimLower)
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}
