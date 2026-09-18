// web-admin/src/hooks/useGeography.ts
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { geographyApi } from '@/services/api/geography.api';
import type { UpdateCountryPayload } from '@/services/api/geography.api';
import type {
  CreateCityPayload,
  CreateCountryPayload,
  CreateCurrencyPayload,
  CreatePrefecturePayload,
  CreateRegionPayload,
  UpdateCityPayload,
  UpdateCurrencyPayload,
  UpdatePrefecturePayload,
  UpdateRegionPayload,
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

export function useUpdateCountry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateCountryPayload) =>
      geographyApi.updateCountry(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['countries'] }),
  });
}

// Un pays n'est jamais supprimé physiquement (voir countries.service.ts) —
// "Supprimer" dans l'UI déclenche toujours cette désactivation.
export function useDeactivateCountry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => geographyApi.deactivateCountry(id),
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

export function useUpdateCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateCurrencyPayload) =>
      geographyApi.updateCurrency(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['currencies'] }),
  });
}

export function useDeleteCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => geographyApi.deleteCurrency(id),
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

export function useUpdateRegion(countryId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateRegionPayload) => geographyApi.updateRegion(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['regions', countryId] }),
  });
}

export function useDeleteRegion(countryId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => geographyApi.deleteRegion(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['regions', countryId] }),
  });
}

export function usePrefectures(regionId: string | undefined) {
  return useQuery({
    queryKey: ['prefectures', regionId],
    queryFn: () => geographyApi.listPrefectures(regionId!),
    enabled: Boolean(regionId),
  });
}

// Agrège les préfectures de plusieurs régions en parallèle — utilisé par le
// tableau Région/Préfecture/Ville pour résoudre "préfecture → région" sans
// endpoint backend dédié (Prefecture n'a pas de countryId direct).
export function usePrefecturesByRegions(regionIds: string[]) {
  return useQueries({
    queries: regionIds.map((regionId) => ({
      queryKey: ['prefectures', regionId],
      queryFn: () => geographyApi.listPrefectures(regionId),
      enabled: Boolean(regionId),
    })),
  });
}

export function useCreatePrefecture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePrefecturePayload) => geographyApi.createPrefecture(payload),
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: ['prefectures', variables.regionId] }),
  });
}

export function useUpdatePrefecture(regionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdatePrefecturePayload) =>
      geographyApi.updatePrefecture(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prefectures', regionId] }),
  });
}

export function useDeletePrefecture(regionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => geographyApi.deletePrefecture(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prefectures', regionId] }),
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

export function useUpdateCity(countryId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateCityPayload) => geographyApi.updateCity(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cities', countryId] }),
  });
}

export function useDeleteCity(countryId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => geographyApi.deleteCity(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cities', countryId] }),
  });
}