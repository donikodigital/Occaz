// backend/src/shipments/dto/create-shipment.dto.ts
// [21/09/2026] v2 — plage de dates obligatoire ; champs de prix hérités de QuoteShipmentDto.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ShipmentItemInputDto } from './shipment-item-input.dto';
import { QuoteShipmentDto } from './quote-shipment.dto';

export class CreateShipmentDto extends QuoteShipmentDto {
  @ApiPropertyOptional({
    description:
      "Trajet choisi à l'avance (issu de GET /trips/search?requiresShipmentCapacity=true). Si omis, l'envoi passe en recherche de chauffeur (SEARCHING_DRIVER) : tous les chauffeurs validés sont prévenus, le premier à accepter l'emporte.",
  })
  @IsOptional()
  @IsString()
  tripId?: string;

  @ApiProperty({
    example: '2026-09-25T08:00:00.000Z',
    description: "Début de la plage pendant laquelle le colis peut partir (obligatoire).",
  })
  @IsDateString()
  windowStart: string;

  @ApiProperty({
    example: '2026-09-27T18:00:00.000Z',
    description:
      "Fin de la plage (obligatoire). Passée cette date sans chauffeur, le client est invité à prolonger, sinon il est remboursé intégralement.",
  })
  @IsDateString()
  windowEnd: string;

  @ApiProperty({ example: 'Mamadou Diallo' })
  @IsString()
  senderName: string;

  @ApiProperty({ example: '+224620000001' })
  @IsString()
  senderPhone: string;

  @ApiProperty({ example: 'Aïssatou Bah' })
  @IsString()
  recipientName: string;

  @ApiProperty({ example: '+224620000002' })
  @IsString()
  recipientPhone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({ type: [ShipmentItemInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShipmentItemInputDto)
  items?: ShipmentItemInputDto[];
}