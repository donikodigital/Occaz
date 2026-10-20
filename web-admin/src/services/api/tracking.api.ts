// web-admin/src/services/api/tracking.api.ts
// [20/10/2026] v1 — Suivi public d'un colis par son numéro (route ouverte du serveur, sans compte).
import { api } from './client';
import type { TrackingView } from '@/types/tracking.types';

export const trackingApi = {
  findPublic: (number: string) => api.get<TrackingView>(`/tracking/public/${encodeURIComponent(number)}`, { auth: false }),
};
