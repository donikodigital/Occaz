// web-admin/src/hooks/usePricing.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cancellationPoliciesApi, commissionRulesApi } from '@/services/api/pricing.api';
import type {
  ServiceType,
  UpsertCancellationPolicyPayload,
  UpsertCommissionRulePayload,
} from '@/types/pricing.types';

export function useCommissionRules(serviceType?: ServiceType) {
  return useQuery({
    queryKey: ['commission-rules', serviceType],
    queryFn: () => commissionRulesApi.listAll(serviceType),
  });
}

export function useCreateCommissionRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertCommissionRulePayload) => commissionRulesApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['commission-rules'] }),
  });
}

export function useDeactivateCommissionRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => commissionRulesApi.deactivate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['commission-rules'] }),
  });
}

export function useCancellationPolicies(serviceType?: ServiceType) {
  return useQuery({
    queryKey: ['cancellation-policies', serviceType],
    queryFn: () => cancellationPoliciesApi.listAll(serviceType),
  });
}

export function useCreateCancellationPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertCancellationPolicyPayload) => cancellationPoliciesApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cancellation-policies'] }),
  });
}

export function useDeactivateCancellationPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancellationPoliciesApi.deactivate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cancellation-policies'] }),
  });
}
