// web-admin/src/services/api/documents.api.ts
import { api } from './client';
import type { AppDocument, DocumentOwnerType } from '@/types/documents.types';

export const documentsApi = {
  /** Filtre désormais par ownerId directement côté backend (trou comblé — voir README, Lot 2). */
  findForOwner: (ownerType: DocumentOwnerType, ownerId: string) =>
    api.get<{ data: AppDocument[] }>('/documents', { query: { ownerType, ownerId, limit: 50 } }).then((r) => r.data),

  getDownloadUrl: (id: string) => api.get<{ url: string; expiresInSeconds: number }>(`/documents/${id}/download-url`),

  verify: (id: string) => api.patch<AppDocument>(`/documents/${id}/verify`),

  reject: (id: string, reason: string) => api.patch<AppDocument>(`/documents/${id}/reject`, { reason }),
};
