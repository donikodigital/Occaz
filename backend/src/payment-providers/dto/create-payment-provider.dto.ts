// backend/src/payment-providers/dto/create-payment-provider.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProviderType } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class CreatePaymentProviderDto {
  @ApiProperty({ enum: PaymentProviderType })
  @IsEnum(PaymentProviderType)
  type: PaymentProviderType;

  @ApiProperty({ example: 'Orange Money Guinée' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'null = disponible dans tous les pays' })
  @IsOptional()
  @IsString()
  countryId?: string;

  @ApiPropertyOptional({
    description:
      'Identifiants PUBLICS uniquement (endpoint, merchant id...) — jamais de secret. Les secrets restent en variables d\'environnement.',
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
