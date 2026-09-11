// backend/src/documents/dto/create-document.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

/**
 * Utilisé en interne par les modules propriétaires (DriverProfile,
 * Vehicle...) — jamais exposé tel quel sur une route publique, car
 * ownerType/ownerId doivent être déterminés côté serveur à partir de
 * l'utilisateur authentifié, jamais fournis librement par le client.
 */
export class CreateDocumentDto {
  @ApiProperty({ example: 'national_id' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Clé de l\'objet dans le stockage sécurisé (S3, R2...)' })
  @IsString()
  storageKey: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
