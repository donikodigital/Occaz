// backend/src/trips/dto/trip-stop-input.dto.ts
// [03/10/2026] v+ — Étape = ville traversée où le conducteur peut prendre / déposer des passagers. Le prix depuis le
// départ est calculé automatiquement ; `fareFromOrigin` permet au conducteur de le fixer lui-même.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

export class TripStopInputDto {
  @ApiProperty({ description: "Adresse du point de rendez-vous dans la ville traversée (doit être rattachée à une ville)" })
  @IsString()
  locationId!: string;

  @ApiProperty({ description: 'Ordre de passage (1, 2, 3...)' })
  @IsInt()
  @Min(1)
  sequence!: number;

  @ApiPropertyOptional({ description: 'Heure de passage estimée ; calculée automatiquement si absente.' })
  @IsOptional()
  @IsDateString()
  estimatedArrivalAt?: string;

  @ApiPropertyOptional({
    example: '35000',
    description: "Prix d'une place depuis le départ jusqu'à cette étape ; calculé au prorata de la distance si absent.",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'Le prix doit être un nombre entier.' })
  fareFromOrigin?: string;

  @ApiPropertyOptional({ default: true, description: 'false : le conducteur traverse la ville sans prendre de passagers.' })
  @IsOptional()
  @IsBoolean()
  isBookable?: boolean;
}
