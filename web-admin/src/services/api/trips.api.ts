// web-admin/src/services/api/trips.api.ts
// Liste, détail et réservations admin des trajets — réutilise les endpoints
// déjà exposés pour l'app mobile (GET /trips, GET /trips/:id,
// GET /trips/:id/bookings) ; aucun endpoint dédié à l'admin n'était
// nécessaire, seule la permission trip.read/booking.read change ce qui
// est renvoyé.
import { api } from './client';
import type { Paginated } from './types';
import type { AdminTripDetail, AdminTripListItem, TripBookingSummary } from '@/types/trips.types';

export const tripsApi = {
  /** Liste de tous les trajets (permission trip.read), du plus récent au plus ancien. */
  list: (params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<AdminTripListItem>>('/trips', { query: params }),

  getDetail: (id: string) => api.get<AdminTripDetail>(`/trips/${id}`),

  getBookings: (id: string) => api.get<TripBookingSummary[]>(`/trips/${id}/bookings`),
};