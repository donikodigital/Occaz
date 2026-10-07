// backend/src/trip-pricing/dto/price-guidance-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class PriceGuidanceQueryDto {
  @ApiPropertyOptional({ description: 'Adresse de départ du trajet (voir POST /locations)' })
  @IsOptional()
  @IsString()
  originLocationId?: string;

  @ApiPropertyOptional({ description: "Adresse d'arrivée du trajet" })
  @IsOptional()
  @IsString()
  destinationLocationId?: string;
}
