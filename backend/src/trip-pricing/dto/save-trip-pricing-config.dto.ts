// backend/src/trip-pricing/dto/save-trip-pricing-config.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsObject } from 'class-validator';
import { PRICING_MODES, PricingMode } from '../trip-pricing.rules';

export class SaveTripPricingConfigDto {
  @ApiProperty({ enum: PRICING_MODES, description: 'MANUAL : le conducteur fixe son prix · SEMI_AUTO : prix conseillé et maximum · AUTO : prix imposé' })
  @IsIn(PRICING_MODES as unknown as string[], { message: 'Mode de prix inconnu.' })
  mode!: PricingMode;

  @ApiProperty({
    description:
      'Configuration par code devise (ex. GNF) : { tiers: [{ upToKm, pricePerKm }], roundingStep, minPercent, maxPercent }. null retire la configuration de la devise. Validée par le serveur.',
    example: {
      GNF: {
        tiers: [
          { upToKm: 10, pricePerKm: 1000 },
          { upToKm: 30, pricePerKm: 700 },
          { upToKm: null, pricePerKm: 500 },
        ],
        roundingStep: 500,
        minPercent: 85,
        maxPercent: 120,
      },
    },
  })
  @IsObject({ message: 'La configuration des devises est invalide.' })
  currencies!: Record<string, unknown>;
}
