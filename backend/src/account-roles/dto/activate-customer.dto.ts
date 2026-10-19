// backend/src/account-roles/dto/activate-customer.dto.ts
// [19/10/2026] v1 — Ouverture de l'espace passager d'un conducteur : confirmée par son code PIN à 6 chiffres.
import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class ActivateCustomerDto {
  @ApiProperty({ example: '482913', description: 'Code PIN à 6 chiffres du compte.' })
  @Matches(/^\d{6}$/, { message: 'Le code PIN comporte 6 chiffres.' })
  pin: string;
}
