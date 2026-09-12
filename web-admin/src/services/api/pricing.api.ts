// web-admin/src/services/api/pricing.api.ts
import { api } from './client';
import type {
  CancellationPolicy,
  CommissionRule,
  ServiceType,
  UpsertCancellationPolicyPayload,
  UpsertCommissionRulePayload,
} from '@/types/pricing.types';

export const commissionRulesApi = {
  listAll: (serviceType?: ServiceType) => api.get<CommissionRule[]>('/commission-rules', { query: { serviceType } }),

  create: (payload: UpsertCommissionRulePayload) => api.post<CommissionRule>('/commission-rules', payload),

  update: (id: string, payload: Partial<UpsertCommissionRulePayload>) =>
    api.patch<CommissionRule>(`/commission-rules/${id}`, payload),

  deactivate: (id: string) => api.patch<CommissionRule>(`/commission-rules/${id}/deactivate`),
};

export const cancellationPoliciesApi = {
  listAll: (serviceType?: ServiceType) =>
    api.get<CancellationPolicy[]>('/cancellation-policies', { query: { serviceType } }),

  create: (payload: UpsertCancellationPolicyPayload) => api.post<CancellationPolicy>('/cancellation-policies', payload),

  update: (id: string, payload: Partial<UpsertCancellationPolicyPayload>) =>
    api.patch<CancellationPolicy>(`/cancellation-policies/${id}`, payload),

  deactivate: (id: string) => api.patch<CancellationPolicy>(`/cancellation-policies/${id}/deactivate`),
};
