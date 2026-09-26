// mobile/src/services/api/geography.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type { City, Country } from '@/types/geography.types';

export const geographyApi = {
  listCountries: () => api.get<Country[]>('/countries'),

  searchCities: (params: { countryId?: string; search?: string; page?: number; limit?: number }) =>
    api.get<Paginated<City>>('/cities', { query: params }),

  getCity: (id: string) => api.get<City>(`/cities/${id}`),
};