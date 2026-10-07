// web-admin/src/types/tripPricing.types.ts
// Miroir de backend/src/trip-pricing (page « Configuration frais trajets »).

export type PricingMode = 'MANUAL' | 'SEMI_AUTO' | 'AUTO';

export interface PricingTier {
  /** Fin de la tranche en km (incluse) ; null = sans limite, uniquement pour la dernière tranche. */
  upToKm: number | null;
  /** Prix du kilomètre dans cette tranche, en unité entière de la devise. */
  pricePerKm: number;
}

export interface CurrencyPricing {
  tiers: PricingTier[];
  roundingStep: number;
  minPercent: number;
  maxPercent: number;
}

export interface TripPricingCurrency {
  id: string;
  isoCode: string;
  name: string;
  symbol: string | null;
  /** null = devise pas encore configurée : les conducteurs y fixent librement leur prix. */
  config: CurrencyPricing | null;
}

export interface TripPricingConfig {
  mode: PricingMode;
  currencies: TripPricingCurrency[];
}

export interface SaveTripPricingPayload {
  mode: PricingMode;
  /** Par code ISO ; null retire la configuration de la devise. */
  currencies: Record<string, CurrencyPricing | null>;
}
