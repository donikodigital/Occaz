// backend/src/trips/dto/search-trips.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * Deux modes de recherche (section 8) :
 *  - par villes : originCityId et/ou destinationCityId (rapide, indexé). Les deux : trajets qui vont de l'une à l'autre.
 *    Seulement destinationCityId : tous les trajets qui mènent à cette ville (arrivée ou ville traversée), d'où qu'ils partent.
 *    Seulement originCityId : tous les trajets qui partent de cette ville ou la traversent. Villes traversées comprises.
 *  - par proximité ("trajets proches") : originLatitude/Longitude
 *    (+ destinationLatitude/Longitude en option), avec le rayon
 *    configurable via PlatformSetting "trip.search_radius_km".
 * Au moins une ville, ou une position de départ, doit être fournie — voir TripsService.search.
 */
export class SearchTripsDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originCityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destinationCityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  originLatitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  originLongitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  destinationLatitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  destinationLongitude?: number;

  @ApiPropertyOptional({ example: '2026-09-20', description: 'Filtre sur la date de départ (jour civil)' })
  @IsOptional()
  @IsDateString()
  departureDate?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  passengersCount?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requiresShipmentCapacity?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  verifiedDriverOnly?: boolean;

  @ApiPropertyOptional({ description: 'Prix maximum par place (plus petite unité)' })
  @IsOptional()
  @IsString()
  maxPricePerSeat?: string;
}
