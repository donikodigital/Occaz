// web-admin/src/hooks/useGeography.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { geographyApi } from '@/services/api/geography.api';
import type { UpdateCountryPayload } from '@/services/api/geography.api';
import type {
  CreateCityPayload,
  CreateCountryPayload,
  CreateCurrencyPayload,
  CreatePrefecturePayload,
  CreateRegionPayload,
} from '@/types/geography.types';

export function useCountries() {
  return useQuery({ queryKey: ['countries'], queryFn: () => geographyApi.listCountries(), staleTime: 10 * 60_000 });
}

export function useCreateCountry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCountryPayload) => geographyApi.createCountry(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['countries'] }),
  });
}

// Ajouté : permet de relier un pays existant à sa devise par défaut —
// jusqu'ici impossible depuis cette page, ce qui bloquait silencieusement
// la création du portefeuille chauffeur (voir CountryRow dans page.tsx).
export function useUpdateCountry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateCountryPayload) =>
      geographyApi.updateCountry(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['countries'] }),
  });
}

export function useCurrencies() {
  return useQuery({ queryKey: ['currencies'], queryFn: () => geographyApi.listCurrencies(), staleTime: 10 * 60_000 });
}

export function useCreateCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCurrencyPayload) => geographyApi.createCurrency(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['currencies'] }),
  });
}

export function useRegions(countryId: string | undefined) {
  return useQuery({
    queryKey: ['regions', countryId],
    queryFn: () => geographyApi.listRegions(countryId!),
    enabled: Boolean(countryId),
  });
}

export function useCreateRegion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRegionPayload) => geographyApi.createRegion(payload),
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: ['regions', variables.countryId] }),
  });
}

export function usePrefectures(regionId: string | undefined) {
  return useQuery({
    queryKey: ['prefectures', regionId],
    queryFn: () => geographyApi.listPrefectures(regionId!),
    enabled: Boolean(regionId),
  });
}

export function useCreatePrefecture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePrefecturePayload) => geographyApi.createPrefecture(payload),
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: ['prefectures', variables.regionId] }),
  });
}

export function useCities(countryId: string | undefined) {
  return useQuery({
    queryKey: ['cities', countryId],
    queryFn: () => geographyApi.listCities(countryId),
    enabled: Boolean(countryId),
  });
}

export function useCreateCity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCityPayload) => geographyApi.createCity(payload),
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: ['cities', variables.countryId] }),
  });
}