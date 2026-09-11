// mobile/src/services/api/paymentProviders.api.ts
import { api } from './client';
import type { PaymentProvider, PaymentProviderType } from '@/types/payments.types';

export const paymentProvidersApi = {
  listActive: (countryId?: string, type?: PaymentProviderType) =>
    api.get<PaymentProvider[]>('/payment-providers/active', { query: { countryId, type } }),
};
