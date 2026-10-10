// backend/src/shipments/dto/shipment-parcel-input.dto.ts
// [10/10/2026] v1 — un colis d'un envoi, saisi colis par colis (poids, dimensions, valeur déclarée, description).
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

/** Maximum de colis par envoi — aligné sur le sélecteur de quantité de l'application. */
export const MAX_PARCELS_PER_SHIPMENT = 20;

export class ShipmentParcelInputDto {
  @ApiProperty({ example: 3, description: 'Poids de CE colis, en kg' })
  @IsNumber()
  @Min(0.1)
  weightKg: number;

  @ApiPropertyOptional({ description: 'Dimensions de CE colis, en cm — servent au poids volumétrique (les trois ou aucune)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lengthCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  widthCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  heightCm?: number;

  @ApiPropertyOptional({ description: 'Valeur déclarée de CE colis, plus petite unité de la devise' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'La valeur déclarée doit être un montant en chiffres.' })
  declaredValue?: string;

  @ApiPropertyOptional({ example: 'Vêtements' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
