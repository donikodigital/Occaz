// web-admin/src/services/api/promotions.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type {
  AdminReferral,
  Article,
  Deal,
  PromoCode,
  UpsertArticlePayload,
  UpsertDealPayload,
  UpsertPromoCodePayload,
} from '@/types/promotions.types';

export const promoCodesApi = {
  listAll: (params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<PromoCode>>('/promo-codes', { query: params }),
  getOne: (id: string) => api.get<PromoCode>(`/promo-codes/${id}`),
  create: (payload: UpsertPromoCodePayload) => api.post<PromoCode>('/promo-codes', payload),
  update: (id: string, payload: Partial<UpsertPromoCodePayload>) => api.patch<PromoCode>(`/promo-codes/${id}`, payload),
  deactivate: (id: string) => api.patch<PromoCode>(`/promo-codes/${id}/deactivate`, {}),
};

export const dealsApi = {
  listAll: (params: { page?: number; limit?: number } = {}) => api.get<Paginated<Deal>>('/deals', { query: params }),
  getOne: (id: string) => api.get<Deal>(`/deals/${id}`),
  create: (payload: UpsertDealPayload) => api.post<Deal>('/deals', payload),
  update: (id: string, payload: Partial<UpsertDealPayload>) => api.patch<Deal>(`/deals/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/deals/${id}`),
};

export const articlesApi = {
  listAll: (params: { page?: number; limit?: number } = {}) => api.get<Paginated<Article>>('/articles', { query: params }),
  getOne: (id: string) => api.get<Article>(`/articles/${id}`),
  create: (payload: UpsertArticlePayload) => api.post<Article>('/articles', payload),
  update: (id: string, payload: Partial<UpsertArticlePayload>) => api.patch<Article>(`/articles/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/articles/${id}`),
};

export const referralsApi = {
  listAll: (params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<AdminReferral>>('/referrals', { query: params }),
  complete: (id: string, rewardAmount: string) => api.patch<AdminReferral>(`/referrals/${id}/complete`, { rewardAmount }),
};

export const cookieConsentApi = {
  /** Publique — fonctionne avant toute connexion (bandeau visible dès la page de login). */
  record: (payload: { choice: 'ACCEPT_ALL' | 'REJECT_ALL' | 'CUSTOM'; policyVersion: string; categories?: Record<string, boolean> }) =>
    api.post<void>('/cookie-consent', payload, { auth: false }),
};