// mobile/src/hooks/usePayments.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentProvidersApi } from '@/services/api/paymentProviders.api';
import { paymentsApi } from '@/services/api/payments.api';
import type { InitiatePaymentPayload } from '@/types/payments.types';

export function useActivePaymentProviders(countryId?: string) {
  return useQuery({
    queryKey: ['payment-providers', 'active', countryId],
    queryFn: () => paymentProvidersApi.listActive(countryId),
    staleTime: 5 * 60_000,
  });
}

export function useInitiatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: InitiatePaymentPayload) => paymentsApi.initiate(payload),
    onSuccess: (_, variables) => {
      if (variables.bookingId) {
        queryClient.invalidateQueries({ queryKey: ['bookings', variables.bookingId] });
        queryClient.invalidateQueries({ queryKey: ['bookings', 'mine'] });
      }
      if (variables.shipmentId) {
        queryClient.invalidateQueries({ queryKey: ['shipments', variables.shipmentId] });
        queryClient.invalidateQueries({ queryKey: ['shipments', 'mine'] });
      }
    },
  });
}
