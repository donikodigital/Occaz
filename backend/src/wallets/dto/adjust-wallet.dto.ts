// backend/src/wallets/dto/adjust-wallet.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class AdjustWalletDto {
  @ApiProperty({ description: 'Montant signé (plus petite unité) — positif = crédit, négatif = débit' })
  @IsString()
  amount: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason: string;

  @ApiProperty({
    required: false,
    description: 'Autorise un débit qui rend le solde disponible négatif (dette du conducteur). Refusé par défaut.',
  })
  @IsOptional()
  @IsBoolean()
  allowDebt?: boolean;
}
