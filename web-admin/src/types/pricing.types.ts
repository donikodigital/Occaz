// web-admin/src/types/pricing.types.ts
import type { Money } from '@/services/api/types';

export type ServiceType = 'TRIP' | 'SHIPMENT';

export interface CommissionRule {
  id: string;
  serviceType: ServiceType;
  countryId: string | null;
  percentage: number | null;
  fixedAmount: Money | null;
  minAmount: Money | null;
  maxAmount: Money | null;
  currencyId: string | null;
  isActive: boolean;
}

export interface UpsertCommissionRulePayload {
  serviceType: ServiceType;
  countryId?: string;
  percentage?: number;
  fixedAmount?: string;
  minAmount?: string;
  maxAmount?: string;
  currencyId?: string;
  isActive?: boolean;
}

export interface CancellationPolicy {
  id: string;
  serviceType: ServiceType;
  countryId: string | null;
  hoursBeforeDeparture: number;
  refundPercentage: number;
  cancellationFee: Money | null;
  currencyId: string | null;
  isActive: boolean;
}

export interface UpsertCancellationPolicyPayload {
  serviceType: ServiceType;
  countryId?: string;
  hoursBeforeDeparture: number;
  refundPercentage: number;
  cancellationFee?: string;
  currencyId?: string;
  isActive?: boolean;
}
