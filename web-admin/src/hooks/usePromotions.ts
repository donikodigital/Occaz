// web-admin/src/hooks/usePromotions.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { articlesApi, dealsApi, promoCodesApi, referralsApi } from '@/services/api/promotions.api';
import type { UpsertArticlePayload, UpsertDealPayload, UpsertPromoCodePayload } from '@/types/promotions.types';

// --- Codes promo ---

export function usePromoCodes() {
  return useQuery({ queryKey: ['promo-codes'], queryFn: () => promoCodesApi.listAll({ page: 1, limit: 100 }) });
}

export function usePromoCode(id: string | undefined) {
  return useQuery({
    queryKey: ['promo-codes', id],
    queryFn: () => promoCodesApi.getOne(id!),
    enabled: Boolean(id),
  });
}

export function useCreatePromoCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertPromoCodePayload) => promoCodesApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promo-codes'] }),
  });
}

export function useUpdatePromoCode(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<UpsertPromoCodePayload>) => promoCodesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
      queryClient.invalidateQueries({ queryKey: ['promo-codes', id] });
    },
  });
}

export function useDeactivatePromoCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => promoCodesApi.deactivate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promo-codes'] }),
  });
}

// --- Bons plans ---

export function useDeals() {
  return useQuery({ queryKey: ['deals'], queryFn: () => dealsApi.listAll({ page: 1, limit: 100 }) });
}

export function useDeal(id: string | undefined) {
  return useQuery({ queryKey: ['deals', id], queryFn: () => dealsApi.getOne(id!), enabled: Boolean(id) });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertDealPayload) => dealsApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deals'] }),
  });
}

export function useUpdateDeal(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<UpsertDealPayload>) => dealsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deals', id] });
    },
  });
}

export function useDeleteDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dealsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deals'] }),
  });
}

// --- Actualités ---

export function useArticles() {
  return useQuery({ queryKey: ['articles'], queryFn: () => articlesApi.listAll({ page: 1, limit: 100 }) });
}

export function useArticleAdmin(id: string | undefined) {
  return useQuery({ queryKey: ['articles', id], queryFn: () => articlesApi.getOne(id!), enabled: Boolean(id) });
}

export function useCreateArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertArticlePayload) => articlesApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['articles'] }),
  });
}

export function useUpdateArticle(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<UpsertArticlePayload>) => articlesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['articles', id] });
    },
  });
}

export function useDeleteArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => articlesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['articles'] }),
  });
}

// --- Parrainage ---

export function useReferrals() {
  return useQuery({ queryKey: ['referrals'], queryFn: () => referralsApi.listAll({ page: 1, limit: 100 }) });
}

export function useCompleteReferral() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rewardAmount }: { id: string; rewardAmount: string }) => referralsApi.complete(id, rewardAmount),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['referrals'] }),
  });
}