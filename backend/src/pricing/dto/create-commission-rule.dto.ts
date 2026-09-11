// backend/src/pricing/dto/create-commission-rule.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateCommissionRuleDto {
  @ApiProperty({ enum: ServiceType })
  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @ApiPropertyOptional({ description: 'null = règle globale, sinon spécifique à ce pays' })
  @IsOptional()
  @IsString()
  countryId?: string;

  @ApiPropertyOptional({ description: 'Pourcentage (0-100) — exclusif avec fixedAmount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage?: number;

  @ApiPropertyOptional({ description: 'Montant fixe, plus petite unité — exclusif avec percentage' })
  @IsOptional()
  @IsString()
  fixedAmount?: string;

  @ApiPropertyOptional({ description: 'Plus petite unité' })
  @IsOptional()
  @IsString()
  minAmount?: string;

  @ApiPropertyOptional({ description: 'Plus petite unité' })
  @IsOptional()
  @IsString()
  maxAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currencyId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
