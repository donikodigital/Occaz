// backend/src/promo-codes/dto/validate-promo-code.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ValidatePromoCodeDto {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty({ enum: ServiceType })
  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @ApiProperty({ description: 'Montant de la commande, avant réduction' })
  @IsString()
  amount: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  countryId?: string;
}