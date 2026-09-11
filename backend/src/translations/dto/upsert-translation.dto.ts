// backend/src/translations/dto/upsert-translation.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/**
 * Table de traduction générique (Partie VII 7.2) — évite des colonnes
 * name_fr/name_en codées en dur sur chaque table. Utile dès la Phase 2
 * langues (section 67 : français au lancement, anglais ensuite), mais le
 * modèle existe dès la V1 pour ne pas avoir à migrer plus tard.
 */
export class UpsertTranslationDto {
  @ApiProperty({ example: 'ShipmentCategory', description: 'Nom du modèle Prisma concerné' })
  @IsString()
  entityType: string;

  @ApiProperty()
  @IsString()
  entityId: string;

  @ApiProperty({ example: 'en' })
  @IsString()
  @Length(2, 5)
  locale: string;

  @ApiProperty({ example: 'name', description: 'Nom du champ traduit' })
  @IsString()
  field: string;

  @ApiProperty()
  @IsString()
  value: string;
}
