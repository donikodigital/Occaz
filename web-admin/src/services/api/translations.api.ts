// web-admin/src/services/api/translations.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type { Translation, UpsertTranslationPayload } from '@/types/translations.types';

export const translationsApi = {
  listAll: (params: { page?: number; limit?: number; entityType?: string; locale?: string }) =>
    api.get<Paginated<Translation>>('/translations', { query: params }),

  upsert: (payload: UpsertTranslationPayload) => api.post<Translation>('/translations', payload),

  remove: (params: { entityType: string; entityId: string; locale: string; field: string }) =>
    api.delete<void>('/translations', { query: params }),
};
