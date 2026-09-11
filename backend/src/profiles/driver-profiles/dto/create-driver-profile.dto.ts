// backend/src/profiles/driver-profiles/dto/create-driver-profile.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateDriverProfileDto {
  @ApiProperty({ example: 'Mamadou' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Barry' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  photoUrl?: string;

  @ApiProperty()
  @IsString()
  countryId: string;

  @ApiProperty()
  @IsString()
  cityId: string;

  @ApiPropertyOptional({ example: '1990-01-20' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Numéro mobile money pour les retraits' })
  @IsOptional()
  @IsString()
  mobileMoneyNumber?: string;
}
