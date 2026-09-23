// web-admin/src/types/promotions.types.ts
import type { Money } from '@/services/api/types';

export type PromoDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type ServiceType = 'TRIP' | 'SHIPMENT';

export interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discountType: PromoDiscountType;
  discountValue: number;
  serviceType: ServiceType | null;
  countryId: string | null;
  currencyId: string | null;
  minAmount: Money | null;
  maxDiscountAmount: Money | null;
  usageLimit: number | null;
  usageLimitPerUser: number;
  usedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface UpsertPromoCodePayload {
  code: string;
  description?: string;
  discountType: PromoDiscountType;
  discountValue: number;
  serviceType?: ServiceType;
  countryId?: string;
  currencyId?: string;
  minAmount?: string;
  maxDiscountAmount?: string;
  usageLimit?: number;
  usageLimitPerUser?: number;
  startsAt?: string;
  expiresAt?: string;
  isActive?: boolean;
}

export interface Deal {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  promoCodeId: string | null;
  countryId: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface UpsertDealPayload {
  title: string;
  description: string;
  imageUrl?: string;
  promoCodeId?: string;
  countryId?: string;
  startsAt?: string;
  expiresAt?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface Article {
  id: string;
  title: string;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  countryId: string | null;
  publishedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface UpsertArticlePayload {
  title: string;
  excerpt?: string;
  content: string;
  coverImageUrl?: string;
  countryId?: string;
  publishedAt?: string;
  isActive?: boolean;
}

export type ReferralStatus = 'PENDING' | 'COMPLETED' | 'EXPIRED';

interface ReferralPersonSummary {
  phone?: string;
  customerProfile: { firstName: string; lastName: string } | null;
  driverProfile: { firstName: string; lastName: string } | null;
}

export interface AdminReferral {
  id: string;
  status: ReferralStatus;
  rewardAmount: Money | null;
  completedAt: string | null;
  createdAt: string;
  referrer: ReferralPersonSummary;
  referee: ReferralPersonSummary;
}

export type CookieConsentChoice = 'ACCEPT_ALL' | 'REJECT_ALL' | 'CUSTOM';