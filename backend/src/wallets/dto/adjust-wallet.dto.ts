// backend/src/wallets/dto/adjust-wallet.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AdjustWalletDto {
  @ApiProperty({ description: 'Montant signé (plus petite unité) — positif = crédit, négatif = débit' })
  @IsString()
  amount: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason: string;
}
