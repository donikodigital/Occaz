// backend/src/geography/dto/create-country.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreateCountryDto {
  @ApiProperty({ example: 'GN', description: 'Code ISO 3166-1 alpha-2' })
  @IsString()
  @Length(2, 2)
  isoCode!: string;

  @ApiProperty({ example: 'Guinée' })
  @IsString()
  name!: string;

  @ApiProperty({ example: '+224' })
  @IsString()
  phoneCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultCurrencyId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isCrossBorderEnabled?: boolean;
}