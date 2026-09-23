// backend/src/promo-codes/dto/upsert-promo-code.dto.ts
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { PromoDiscountType, ServiceType } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpsertPromoCodeDto {
  @ApiProperty({ example: 'BIENVENUE10' })
  @IsString()
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: PromoDiscountType })
  @IsEnum(PromoDiscountType)
  discountType: PromoDiscountType;

  @ApiProperty({ description: 'Pourcentage (0-100) ou montant fixe selon discountType' })
  @IsNumber()
  @Min(0)
  discountValue: number;

  @ApiPropertyOptional({ enum: ServiceType, description: 'Omis = valable pour trajets et envois' })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  countryId?: string;

  @ApiPropertyOptional({ description: 'Requis si discountType = FIXED_AMOUNT' })
  @IsOptional()
  @IsString()
  currencyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  minAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maxDiscountAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimitPerUser?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}