// mobile/src/services/queryClient.ts
// [25/10/2026] v2 — l'état « au premier plan » de React Query suit l'état de l'application (AppState) : au retour dans l'app, les données
// périmées (plus de 30 s) se rechargent toutes seules. Sans cela, un client qui revenait dans l'app voyait l'état d'avant (conducteur
// arrivé, dépose validée, remboursement) tant qu'il ne tirait pas l'écran. Rechargement aussi au retour du réseau.
import { AppState, Platform } from 'react-native';
import { focusManager, QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/ApiError';

if (Platform.OS !== 'web') {
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (state) => handleFocus(state === 'active'));
    return () => subscription.remove();
  });
}

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
      refetchOnReconnect: 'always',
    },
    mutations: {
      retry: false,
    },
  },
});
