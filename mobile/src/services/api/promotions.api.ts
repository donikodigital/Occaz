// mobile/src/services/api/promotions.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type {
  Article,
  Deal,
  PromoCodeValidation,
  Referral,
  SavedCard,
  ValidatePromoCodePayload,
} from '@/types/promotions.types';

export const promoCodesApi = {
  validate: (payload: ValidatePromoCodePayload) => api.post<PromoCodeValidation>('/promo-codes/validate', payload),
};

export const referralsApi = {
  myCode: () => api.get<{ code: string }>('/referrals/my-code'),
  apply: (code: string) => api.post<void>('/referrals/apply', { code }),
  findMine: (params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<Referral>>('/referrals/mine', { query: params }),
};

export const dealsApi = {
  findActive: () => api.get<Deal[]>('/deals/active'),
};

export const articlesApi = {
  findPublished: (params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<Article>>('/articles/published', { query: params }),
  getOne: (id: string) => api.get<Article>(`/articles/${id}`),
};

export const savedCardsApi = {
  findMine: () => api.get<SavedCard[]>('/saved-cards/mine'),
  remove: (id: string) => api.delete<void>(`/saved-cards/${id}`),
  setDefault: (id: string) => api.patch<SavedCard>(`/saved-cards/${id}/default`, {}),
};