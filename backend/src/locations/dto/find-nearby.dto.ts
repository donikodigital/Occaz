// backend/src/locations/dto/find-nearby.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsLatitude, IsLongitude, IsOptional, Max, Min } from 'class-validator';

export class FindNearbyDto {
  @ApiProperty()
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @ApiProperty()
  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional({
    default: 5,
    description:
      'Rayon de recherche en kilomètres. Valeur par défaut alignée sur PlatformSetting "trip.search_radius_km" (Partie III/VII) — à terme, lire ce paramètre plutôt que la constante codée en dur.',
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0.1)
  @Max(100)
  radiusKm?: number = 5;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
