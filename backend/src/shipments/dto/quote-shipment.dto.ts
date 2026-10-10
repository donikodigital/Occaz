// backend/src/shipments/dto/quote-shipment.dto.ts
// [10/10/2026] v2 — `parcels` : saisie colis par colis (poids, dimensions, valeur de chacun) ; le prix est calculé colis par colis.
// [21/09/2026] v1 — champs du calcul de prix, partagés entre devis et création.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { MAX_PARCELS_PER_SHIPMENT, ShipmentParcelInputDto } from './shipment-parcel-input.dto';

/**
 * Tout ce qui entre dans le calcul du prix d'un envoi. Sert à la fois au
 * devis (POST /shipments/quote, affiché au client avant paiement) et de base
 * à CreateShipmentDto — un seul endroit pour ces champs, donc le devis et
 * le prix réellement facturé ne peuvent pas diverger.
 */
export class QuoteShipmentDto {
  @ApiProperty()
  @IsString()
  categoryId: string;

  @ApiProperty()
  @IsString()
  senderLocationId: string;

  @ApiProperty()
  @IsString()
  recipientLocationId: string;

  @ApiProperty({ example: 5, description: 'Poids total, tous colis confondus' })
  @IsNumber()
  @Min(0.1)
  weightKg: number;

  @ApiPropertyOptional({ description: "Dimensions d'un colis — servent au poids volumétrique" })
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

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Valeur déclarée, plus petite unité de la devise' })
  @IsOptional()
  @IsString()
  declaredValue?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isUrgent?: boolean;

  @ApiPropertyOptional({
    type: [ShipmentParcelInputDto],
    description:
      "Les colis, un par un. Quand il est fourni, le serveur en tire la quantité, le poids total et la valeur déclarée totale (les champs globaux ci-dessus sont alors ignorés) et calcule le prix de chaque colis.",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PARCELS_PER_SHIPMENT)
  @ValidateNested({ each: true })
  @Type(() => ShipmentParcelInputDto)
  parcels?: ShipmentParcelInputDto[];
}