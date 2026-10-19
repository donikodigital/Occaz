// backend/src/wallets/dto/request-payout.dto.ts
// [19/10/2026] v2 — `pin` obligatoire (code PIN de connexion du conducteur : confirme le retrait à la place d'un SMS), montant et numéro validés.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class RequestPayoutDto {
  @ApiProperty({ description: 'Montant à retirer, plus petite unité de la devise (entier strictement positif)' })
  @IsString()
  @Matches(/^\d{1,15}$/, { message: 'Le montant doit être un nombre entier positif.' })
  amount: string;

  @ApiPropertyOptional({ example: 'orange_money' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  method?: string;

  @ApiPropertyOptional({ description: 'Numéro mobile money de destination, avec indicatif (ex. +224620000000)' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  destinationRef?: string;

  @ApiProperty({ description: 'Code PIN de connexion (6 chiffres) : confirme le retrait.' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Le code PIN doit comporter 6 chiffres.' })
  pin: string;
}
