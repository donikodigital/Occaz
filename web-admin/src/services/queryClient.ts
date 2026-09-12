// web-admin/src/services/queryClient.ts
import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/ApiError';

/** Ne retente jamais une erreur d'autorisation/validation — seulement les erreurs réseau/serveur transitoires. */
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
