// backend/src/shipments/dto/create-shipment.dto.ts
// [19/10/2026] v4 — photoKeys : 2 photos du colis au plus, déposées d'avance via POST /shipments/photos/upload-url.
// [23/09/2026] v3 — champ promoCode facultatif.
// [21/09/2026] v2 — plage de dates obligatoire ; champs de prix hérités de QuoteShipmentDto.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsEmail, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ShipmentItemInputDto } from './shipment-item-input.dto';
import { QuoteShipmentDto } from './quote-shipment.dto';

export class CreateShipmentDto extends QuoteShipmentDto {
  @ApiPropertyOptional({
    description:
      "Trajet choisi à l'avance (issu de GET /trips/search?requiresShipmentCapacity=true). Si omis, l'envoi passe en recherche de conducteur (SEARCHING_DRIVER) : tous les conducteurs validés sont prévenus, le premier à accepter l'emporte.",
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
      "Fin de la plage (obligatoire). Passée cette date sans conducteur, le client est invité à prolonger, sinon il est remboursé intégralement.",
  })
  @IsDateString()
  windowEnd: string;

  @ApiPropertyOptional({
    example: 'Mamadou Diallo',
    deprecated: true,
    description:
      "Ignoré : l'expéditeur est le titulaire du compte, son nom vient de son profil (modifiable uniquement dans le profil). Conservé pour les anciennes versions de l'application.",
  })
  @IsOptional()
  @IsString()
  senderName?: string;

  @ApiPropertyOptional({
    example: '+224620000001',
    deprecated: true,
    description: "Ignoré : le téléphone de l'expéditeur est celui de son compte. Conservé pour les anciennes versions de l'application.",
  })
  @IsOptional()
  @IsString()
  senderPhone?: string;

  @ApiProperty({ example: 'Aïssatou Bah' })
  @IsString()
  recipientName: string;

  @ApiProperty({ example: '+224620000002' })
  @IsString()
  recipientPhone: string;

  @ApiPropertyOptional({
    example: 'aissatou@example.com',
    description: 'Facultatif : le destinataire reçoit le suivi de son colis par e-mail. Jamais communiqué au conducteur.',
  })
  @IsOptional()
  @IsEmail({}, { message: "L'adresse e-mail du destinataire n'est pas valide." })
  recipientEmail?: string;

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

  @ApiPropertyOptional({
    type: [String],
    description:
      "Photos du colis (2 au plus) : les `storageKey` renvoyés par POST /shipments/photos/upload-url, après le dépôt des fichiers. Visibles de l'expéditeur, du conducteur et du support.",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2, { message: 'Vous pouvez joindre 2 photos au plus.' })
  @IsString({ each: true })
  photoKeys?: string[];

  @ApiPropertyOptional({ description: 'Code promo à appliquer, s’il y en a un.' })
  @IsOptional()
  @IsString()
  promoCode?: string;
}