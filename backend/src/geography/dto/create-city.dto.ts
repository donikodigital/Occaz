// backend/src/geography/dto/create-city.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsOptional, IsString } from 'class-validator';

export class CreateCityDto {
  @ApiProperty()
  @IsString()
  countryId!: string;

  @ApiPropertyOptional({ description: 'Hérité — la région et la préfecture ne servent plus : une ville se définit par son pays.' })
  @IsOptional()
  @IsString()
  prefectureId?: string;

  @ApiProperty({ example: 'Labé' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Quartier Almamya, en face du marché', description: 'Adresse libre, optionnelle' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    example: 11.3183,
    description:
      'Centre de la ville. Sert à détecter automatiquement la ville d\'une adresse (la plus proche des coordonnées choisies). Sans coordonnées, la ville n\'est retrouvée que par son nom.',
  })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: -12.2833 })
  @IsOptional()
  @IsLongitude()
  longitude?: number;
}