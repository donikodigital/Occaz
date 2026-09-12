// web-admin/src/services/api/bookings.api.ts
import { api } from './client';
import type { BookingContext } from '@/types/bookings.types';

export const bookingsApi = {
  getOne: (id: string) => api.get<BookingContext>(`/bookings/${id}`),
};
