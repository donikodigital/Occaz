// mobile/src/services/queryClient.ts
import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/ApiError';

/**
 * Ne retente jamais automatiquement une erreur d'autorisation ou de
 * validation (ça ne changera pas au deuxième essai) — seulement les
 * erreurs réseau/serveur transitoires.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && (error.isAuthError || error.isValidationError)) {
          return false;
        }
        return failureCount < 2;
      },
      staleTime: 30_000,
    },
    mutations: {
      retry: false,
    },
  },
});
