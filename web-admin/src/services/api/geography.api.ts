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
} from '@/types/geography.types';

// Ajouté : aucune route de mise à jour générale n'existait pour un pays
// (seulement /deactivate) — nécessaire pour relier un pays à sa devise
// par défaut après coup. À CONFIRMER côté backend : si PATCH /countries/:id
// n'existe pas encore, cet appel échouera avec une 404/405 jusqu'à ce
// qu'il soit ajouté.
export interface UpdateCountryPayload {
  defaultCurrencyId?: string | null;
}

export const geographyApi = {
  listCountries: () => api.get<Country[]>('/countries', { auth: false }),
  createCountry: (payload: CreateCountryPayload) => api.post<Country>('/countries', payload),
  updateCountry: (id: string, payload: UpdateCountryPayload) => api.patch<Country>(`/countries/${id}`, payload),
  deactivateCountry: (id: string) => api.patch<Country>(`/countries/${id}/deactivate`),

  listCurrencies: () => api.get<Currency[]>('/currencies', { auth: false }),
  createCurrency: (payload: CreateCurrencyPayload) => api.post<Currency>('/currencies', payload),

  listRegions: (countryId: string) => api.get<Region[]>('/regions', { query: { countryId }, auth: false }),
  createRegion: (payload: CreateRegionPayload) => api.post<Region>('/regions', payload),

  listPrefectures: (regionId: string) => api.get<Prefecture[]>('/prefectures', { query: { regionId }, auth: false }),
  createPrefecture: (payload: CreatePrefecturePayload) => api.post<Prefecture>('/prefectures', payload),

  listCities: (countryId?: string) =>
    api.get<{ data: City[] }>('/cities', { query: { countryId, limit: 100 }, auth: false }).then((r) => r.data),
  createCity: (payload: CreateCityPayload) => api.post<City>('/cities', payload),
};