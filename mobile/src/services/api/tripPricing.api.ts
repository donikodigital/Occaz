// mobile/src/services/api/tripPricing.api.ts
import { api } from './client';
import type { TripPriceGuidance } from '@/types/tripPricing.types';

export const tripPricingApi = {
  /** Mode de prix en vigueur et, si possible, prix conseillé et bornes pour ce départ / cette arrivée. */
  guidance: (params: { originLocationId?: string; destinationLocationId?: string }) =>
    api.get<TripPriceGuidance>('/trip-pricing/guidance', { query: params }),
};
