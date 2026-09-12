// web-admin/src/services/api/paymentProviders.api.ts
import { api } from './client';
import type {
  CreatePaymentProviderPayload,
  PaymentProvider,
  UpdatePaymentProviderPayload,
} from '@/types/paymentProviders.types';

export const paymentProvidersApi = {
  listAll: () => api.get<PaymentProvider[]>('/payment-providers'),

  getOne: (id: string) => api.get<PaymentProvider>(`/payment-providers/${id}`),

  create: (payload: CreatePaymentProviderPayload) => api.post<PaymentProvider>('/payment-providers', payload),

  update: (id: string, payload: UpdatePaymentProviderPayload) =>
    api.patch<PaymentProvider>(`/payment-providers/${id}`, payload),

  activate: (id: string) => api.patch<PaymentProvider>(`/payment-providers/${id}/activate`),

  deactivate: (id: string) => api.patch<PaymentProvider>(`/payment-providers/${id}/deactivate`),
};
