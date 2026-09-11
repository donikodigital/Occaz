// mobile/src/services/api/payments.api.ts
import { api } from './client';
import type { InitiatePaymentPayload, InitiatePaymentResult } from '@/types/payments.types';

export const paymentsApi = {
  initiate: (payload: InitiatePaymentPayload) =>
    api.post<InitiatePaymentResult>('/payments/initiate', payload),
};
