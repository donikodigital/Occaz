// backend/src/trips/dto/trip-segment-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/** Tronçon demandé sur GET /trips/:id — absent = trajet entier. Le prix renvoyé est celui de ce tronçon. */
export class TripSegmentQueryDto {
  @ApiPropertyOptional({ description: "Étape de montée (absent = départ du trajet)" })
  @IsOptional()
  @IsString()
  boardingStopId?: string;

  @ApiPropertyOptional({ description: "Étape de descente (absent = arrivée du trajet)" })
  @IsOptional()
  @IsString()
  alightingStopId?: string;
}
