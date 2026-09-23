// mobile/src/types/promotions.types.ts
//
// Types partagés par les 5 nouvelles rubriques : codes promo, parrainage,
// bons plans, actualités, cartes enregistrées.
import type { Money } from '@/services/api/types';

export type PromoDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type ServiceType = 'TRIP' | 'SHIPMENT';

export interface ValidatePromoCodePayload {
  code: string;
  serviceType: ServiceType;
  amount: string;
  countryId?: string;
}

export interface PromoCodeValidation {
  discountAmount: Money;
  finalAmount: Money;
}

export type ReferralStatus = 'PENDING' | 'COMPLETED' | 'EXPIRED';

interface ReferralPersonSummary {
  customerProfile: { firstName: string; lastName: string } | null;
  driverProfile: { firstName: string; lastName: string } | null;
}

export interface Referral {
  id: string;
  status: ReferralStatus;
  rewardAmount: Money | null;
  completedAt: string | null;
  createdAt: string;
  referee: ReferralPersonSummary;
}

export interface Deal {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  promoCodeId: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface Article {
  id: string;
  title: string;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  publishedAt: string | null;
  isActive: boolean;
}

export interface SavedCard {
  id: string;
  providerId: string;
  brand: string | null;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  createdAt: string;
}