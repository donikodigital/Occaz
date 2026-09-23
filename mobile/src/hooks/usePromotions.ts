// mobile/src/hooks/usePromotions.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { articlesApi, dealsApi, promoCodesApi, referralsApi, savedCardsApi } from '@/services/api/promotions.api';
import type { ValidatePromoCodePayload } from '@/types/promotions.types';

// --- Codes promo ---

export function useValidatePromoCode() {
  return useMutation({
    mutationFn: (payload: ValidatePromoCodePayload) => promoCodesApi.validate(payload),
  });
}

// --- Parrainage ---

export function useMyReferralCode() {
  return useQuery({ queryKey: ['referrals', 'my-code'], queryFn: () => referralsApi.myCode() });
}

export function useApplyReferralCode() {
  return useMutation({ mutationFn: (code: string) => referralsApi.apply(code) });
}

export function useMyReferrals(page = 1) {
  return useQuery({
    queryKey: ['referrals', 'mine', page],
    queryFn: () => referralsApi.findMine({ page, limit: 20 }),
  });
}

// --- Bons plans ---

export function useActiveDeals() {
  return useQuery({ queryKey: ['deals', 'active'], queryFn: () => dealsApi.findActive(), staleTime: 5 * 60_000 });
}

// --- Actualités ---

export function usePublishedArticles(page = 1) {
  return useQuery({
    queryKey: ['articles', 'published', page],
    queryFn: () => articlesApi.findPublished({ page, limit: 20 }),
  });
}

export function useArticle(id: string | undefined) {
  return useQuery({
    queryKey: ['articles', id],
    queryFn: () => articlesApi.getOne(id!),
    enabled: Boolean(id),
  });
}

// --- Cartes enregistrées ---

export function useMySavedCards() {
  return useQuery({ queryKey: ['saved-cards', 'mine'], queryFn: () => savedCardsApi.findMine() });
}

export function useRemoveSavedCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => savedCardsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-cards', 'mine'] }),
  });
}

export function useSetDefaultSavedCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => savedCardsApi.setDefault(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-cards', 'mine'] }),
  });
}