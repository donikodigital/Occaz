// backend/src/profiles/customer-profiles/dto/create-customer-profile.dto.ts
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateCustomerProfileDto {
  @ApiProperty({ example: 'Fatoumata' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Diallo' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  photoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  countryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cityId?: string;

  @ApiPropertyOptional({ example: '1998-04-12' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}
