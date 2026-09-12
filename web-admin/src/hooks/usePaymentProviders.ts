// web-admin/src/hooks/usePaymentProviders.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentProvidersApi } from '@/services/api/paymentProviders.api';
import type { CreatePaymentProviderPayload, UpdatePaymentProviderPayload } from '@/types/paymentProviders.types';

export function usePaymentProviders() {
  return useQuery({
    queryKey: ['payment-providers'],
    queryFn: () => paymentProvidersApi.listAll(),
  });
}

export function usePaymentProvider(id: string | undefined) {
  return useQuery({
    queryKey: ['payment-providers', id],
    queryFn: () => paymentProvidersApi.getOne(id!),
    enabled: Boolean(id),
  });
}

export function useCreatePaymentProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePaymentProviderPayload) => paymentProvidersApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payment-providers'] }),
  });
}

export function useUpdatePaymentProvider(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdatePaymentProviderPayload) => paymentProvidersApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-providers'] });
      queryClient.invalidateQueries({ queryKey: ['payment-providers', id] });
    },
  });
}

export function useTogglePaymentProviderActive(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (activate: boolean) =>
      activate ? paymentProvidersApi.activate(id) : paymentProvidersApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-providers'] });
      queryClient.invalidateQueries({ queryKey: ['payment-providers', id] });
    },
  });
}
