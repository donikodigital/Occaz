// backend/src/saved-cards/dto/add-saved-card.dto.ts
//
// Jamais de PAN ni de CVV ici : ce DTO reçoit le résultat d'une
// tokenisation déjà faite par un SDK de paiement côté mobile (ex. Stripe),
// jamais la carte elle-même. À ce jour, aucun SDK de ce type n'est encore
// intégré côté mobile (le paiement de l'app repose sur le mobile money) —
// ce service est prêt à le recevoir dès que cette intégration existera.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AddSavedCardDto {
  @ApiProperty()
  @IsString()
  providerId: string;

  @ApiProperty({ description: 'Jeton renvoyé par le SDK de paiement — jamais le numéro de carte.' })
  @IsString()
  providerToken: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiProperty({ description: '4 derniers chiffres uniquement' })
  @IsString()
  last4: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(12)
  expiryMonth: number;

  @ApiProperty()
  @IsInt()
  @Min(2024)
  expiryYear: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}