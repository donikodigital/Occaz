// web-admin/src/services/api/geography.api.ts
import { api } from './client';
import type {
  City,
  Country,
  CreateCityPayload,
  CreateCountryPayload,
  CreateCurrencyPayload,
  CreatePrefecturePayload,
  CreateRegionPayload,
  Currency,
  Prefecture,
  Region,
  UpdateCityPayload,
  UpdateCurrencyPayload,
  UpdatePrefecturePayload,
  UpdateRegionPayload,
} from '@/types/geography.types';

export interface UpdateCountryPayload {
  isoCode?: string;
  name?: string;
  phoneCode?: string;
  defaultCurrencyId?: string | null;
  isCrossBorderEnabled?: boolean;
}

export const geographyApi = {
  listCountries: () => api.get<Country[]>('/countries', { auth: false }),
  createCountry: (payload: CreateCountryPayload) => api.post<Country>('/countries', payload),
  updateCountry: (id: string, payload: UpdateCountryPayload) => api.patch<Country>(`/countries/${id}`, payload),
  deactivateCountry: (id: string) => api.patch<Country>(`/countries/${id}/deactivate`),

  listCurrencies: () => api.get<Currency[]>('/currencies', { auth: false }),
  createCurrency: (payload: CreateCurrencyPayload) => api.post<Currency>('/currencies', payload),
  updateCurrency: (id: string, payload: UpdateCurrencyPayload) => api.patch<Currency>(`/currencies/${id}`, payload),
  deleteCurrency: (id: string) => api.delete<void>(`/currencies/${id}`),

  listRegions: (countryId: string) => api.get<Region[]>('/regions', { query: { countryId }, auth: false }),
  createRegion: (payload: CreateRegionPayload) => api.post<Region>('/regions', payload),
  updateRegion: (id: string, payload: UpdateRegionPayload) => api.patch<Region>(`/regions/${id}`, payload),
  deleteRegion: (id: string) => api.delete<void>(`/regions/${id}`),

  listPrefectures: (regionId: string) => api.get<Prefecture[]>('/prefectures', { query: { regionId }, auth: false }),
  createPrefecture: (payload: CreatePrefecturePayload) => api.post<Prefecture>('/prefectures', payload),
  updatePrefecture: (id: string, payload: UpdatePrefecturePayload) => api.patch<Prefecture>(`/prefectures/${id}`, payload),
  deletePrefecture: (id: string) => api.delete<void>(`/prefectures/${id}`),

  listCities: (countryId?: string) =>
    api.get<{ data: City[] }>('/cities', { query: { countryId, limit: 100 }, auth: false }).then((r) => r.data),
  createCity: (payload: CreateCityPayload) => api.post<City>('/cities', payload),
  updateCity: (id: string, payload: UpdateCityPayload) => api.patch<City>(`/cities/${id}`, payload),
  deleteCity: (id: string) => api.delete<void>(`/cities/${id}`),
};