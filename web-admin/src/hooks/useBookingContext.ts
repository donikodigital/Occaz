// web-admin/src/hooks/useBookingContext.ts
import { useQuery } from '@tanstack/react-query';
import { bookingsApi } from '@/services/api/bookings.api';

export function useBookingContext(id: string | undefined) {
  return useQuery({
    queryKey: ['bookings', id],
    queryFn: () => bookingsApi.getOne(id!),
    enabled: Boolean(id),
  });
}
