// web-admin/src/types/shipmentCategories.types.ts
import type { Money } from '@/services/api/types';

export interface ShipmentCategory {
  id: string;
  name: string;
  description: string | null;
  isAllowed: boolean;
  countryId: string | null;
  maxDeclaredValue: Money | null;
  currencyId: string | null;
  priceMultiplier: number;
}

export interface UpsertShipmentCategoryPayload {
  name: string;
  description?: string;
  isAllowed?: boolean;
  countryId?: string;
  maxDeclaredValue?: string;
  currencyId?: string;
  priceMultiplier?: number;
}
