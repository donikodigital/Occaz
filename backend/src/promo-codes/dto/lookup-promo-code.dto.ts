// backend/src/promo-codes/dto/lookup-promo-code.dto.ts
// [10/10/2026] v1 — Consultation d'un code promo à partir du code seul : pas de montant à fournir.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LookupPromoCodeDto {
  @ApiProperty({ example: 'BIENVENUE10' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ enum: ServiceType, description: "Omis = on n'exclut aucun type de prestation ; la réponse indique à quoi le code s'applique" })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  countryId?: string;
}
