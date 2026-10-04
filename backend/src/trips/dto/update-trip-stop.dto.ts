// backend/src/trips/dto/update-trip-stop.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, Matches } from 'class-validator';

/** Modification d'une étape tant que le trajet est en brouillon : son prix, son heure de passage, sa disponibilité. */
export class UpdateTripStopDto {
  @ApiPropertyOptional({ example: '35000', description: "Prix d'une place depuis le départ jusqu'à cette étape." })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'Le prix doit être un nombre entier.' })
  fareFromOrigin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  estimatedArrivalAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBookable?: boolean;
}
