// backend/src/geocoding/dto/search-address.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class SearchAddressDto {
  @ApiProperty({ example: 'Gare routière de Labé' })
  @IsString()
  @MinLength(3, { message: 'La recherche doit contenir au moins 3 caractères.' })
  query: string;

  @ApiPropertyOptional({ example: 'gn', description: 'Code pays ISO 3166-1 alpha-2, restreint la recherche.' })
  @IsOptional()
  @IsString()
  countryCode?: string;
}
