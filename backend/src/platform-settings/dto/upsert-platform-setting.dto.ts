// backend/src/platform-settings/dto/upsert-platform-setting.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

/**
 * `value` accepte tout JSON (nombre, chaîne, booléen, objet) — c'est la
 * table clé/valeur générique de la Partie VII (rayon de recherche,
 * tarifs d'envoi, seuils...). Toujours lue via
 * PricingService.getNumericSetting ou un accès direct documenté dans le
 * service appelant — jamais codée en dur dans un module métier.
 */
export class UpsertPlatformSettingDto {
  @ApiProperty({ example: 'trip.search_radius_km' })
  @IsString()
  @Matches(/^[a-z0-9_]+(\.[a-z0-9_]+)+$/, {
    message: 'La clé doit suivre le format "domaine.parametre" (ex: trip.search_radius_km).',
  })
  key: string;

  @ApiProperty({ description: 'Toute valeur JSON valide (nombre, chaîne, booléen, objet)' })
  @IsNotEmpty()
  value: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
