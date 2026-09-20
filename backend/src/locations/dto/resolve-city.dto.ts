// backend/src/locations/dto/resolve-city.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsOptional, IsString } from 'class-validator';

export class ResolveCityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({
    example: 'Rond-point de Bambeto, Conakry, Guinée',
    description: "Texte de l'adresse (libellé + adresse complète) — sert à retrouver la ville par son nom.",
  })
  @IsOptional()
  @IsString()
  address?: string;
}