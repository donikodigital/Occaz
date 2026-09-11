// backend/src/wallets/dto/request-payout.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RequestPayoutDto {
  @ApiProperty({ description: 'Montant à retirer, plus petite unité de la devise' })
  @IsString()
  amount: string;

  @ApiPropertyOptional({ example: 'orange_money' })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({ description: 'Numéro mobile money / IBAN masqué de destination' })
  @IsOptional()
  @IsString()
  destinationRef?: string;
}
