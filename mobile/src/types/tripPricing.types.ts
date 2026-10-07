// mobile/src/types/tripPricing.types.ts
// Prix des trajets fixé par la plateforme (GET /trip-pricing/guidance). Les montants sont des chaînes (BigInt côté serveur).

export type TripPricingMode = 'MANUAL' | 'SEMI_AUTO' | 'AUTO';

export type TripPriceGuidanceReason = 'NO_ROUTE' | 'MANUAL' | 'NOT_CONFIGURED' | 'NO_DISTANCE';

export interface TripPriceGuidance {
  mode: TripPricingMode;
  /** true : un prix conseillé (et ses bornes) a pu être calculé pour ce trajet et la règle du mode s'applique. */
  applicable: boolean;
  reason: TripPriceGuidanceReason | null;
  currency: { id: string; isoCode: string; symbol: string | null } | null;
  distanceKm: number | null;
  suggestedPrice: string | null;
  minPrice: string | null;
  maxPrice: string | null;
}
