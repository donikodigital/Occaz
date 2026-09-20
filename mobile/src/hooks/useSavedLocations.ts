// mobile/src/hooks/useSavedLocations.ts
import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { locationsApi } from '@/services/api/locations.api';

const DEBOUNCE_MS = 250;
const SAVED_LOCATIONS_LIMIT = 6;

/** Préfixe commun des requêtes d'adresses mémorisées — sert à les invalider après une création ou une réutilisation. */
export const SAVED_LOCATIONS_QUERY_KEY = ['locations', 'saved'] as const;

/**
 * Adresses déjà utilisées par l'utilisateur. Texte vide : les plus
 * récentes ; sinon celles qui correspondent à la saisie.
 */
export function useSavedLocations(query: string, enabled = true) {
  const [debouncedQuery, setDebouncedQuery] = useState(query.trim());

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query]);

  return useQuery({
    queryKey: [...SAVED_LOCATIONS_QUERY_KEY, debouncedQuery],
    queryFn: () => locationsApi.saved(debouncedQuery || undefined, SAVED_LOCATIONS_LIMIT),
    enabled,
    staleTime: 30_000,
    // Garde la liste précédente affichée pendant la frappe : pas de clignotement.
    placeholderData: keepPreviousData,
  });
}