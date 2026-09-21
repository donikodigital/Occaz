// backend/src/shipments/dto/quote-shipment.dto.ts
// [21/09/2026] v1 — champs du calcul de prix, partagés entre devis et création.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

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
}