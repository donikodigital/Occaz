// backend/src/locations/dto/create-location.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GeocodeTrust } from '@prisma/client';
import { IsEnum, IsLatitude, IsLongitude, IsOptional, IsString } from 'class-validator';

export class CreateLocationDto {
  @ApiProperty({ example: 'Gare routière de Labé', description: 'Libellé libre — toujours requis, même sans coordonnées GPS fiables (section 58).' })
  @IsString()
  label: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  formattedAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ enum: GeocodeTrust, default: GeocodeTrust.MANUAL })
  @IsOptional()
  @IsEnum(GeocodeTrust)
  geocodeTrust?: GeocodeTrust;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cityId?: string;
}
