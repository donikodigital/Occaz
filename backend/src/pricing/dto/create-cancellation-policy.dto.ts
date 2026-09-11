// backend/src/pricing/dto/create-cancellation-policy.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateCancellationPolicyDto {
  @ApiProperty({ enum: ServiceType })
  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @ApiPropertyOptional({ description: 'null = règle globale, sinon spécifique à ce pays' })
  @IsOptional()
  @IsString()
  countryId?: string;

  @ApiProperty({ example: 24, description: 'Délai minimum avant départ/prestation pour un remboursement plein' })
  @IsInt()
  @Min(0)
  hoursBeforeDeparture: number;

  @ApiProperty({ example: 100, description: 'Pourcentage remboursé si annulé avant ce délai' })
  @IsNumber()
  @Min(0)
  @Max(100)
  refundPercentage: number;

  @ApiPropertyOptional({ description: 'Frais fixe éventuel, plus petite unité' })
  @IsOptional()
  @IsString()
  cancellationFee?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currencyId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
