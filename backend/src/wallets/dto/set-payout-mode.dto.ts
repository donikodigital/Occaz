// backend/src/wallets/dto/set-payout-mode.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetPayoutModeDto {
  @ApiProperty({
    description: 'true = Automatique (le retrait part tout de suite) ; false = Manuel (chaque retrait attend la validation de l\'équipe).',
  })
  @IsBoolean()
  autoEnabled: boolean;
}
