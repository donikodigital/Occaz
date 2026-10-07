// web-admin/src/services/api/tripPricing.api.ts
import { api } from './client';
import type { SaveTripPricingPayload, TripPricingConfig } from '@/types/tripPricing.types';

export const tripPricingApi = {
  getConfig: () => api.get<TripPricingConfig>('/trip-pricing/config'),

  saveConfig: (payload: SaveTripPricingPayload) => api.put<TripPricingConfig>('/trip-pricing/config', payload),
};
