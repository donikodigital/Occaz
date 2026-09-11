// mobile/src/services/api/currencies.api.ts
import { api } from './client';
import type { Currency } from '@/types/currencies.types';

export const currenciesApi = {
  listAll: () => api.get<Currency[]>('/currencies', { auth: false }),
};
