// mobile/src/hooks/useAddressSearch.ts
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { geocodingApi } from '@/services/api/geocoding.api';

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 3;

/**
 * Debounce manuel plutôt qu'un package dédié — un simple délai avant
 * de répercuter la saisie dans la clé de la query suffit ici, pas
 * besoin d'une dépendance de plus pour ça.
 */
export function useAddressSearch(countryCode?: string) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query]);

  const { data: suggestions, isFetching } = useQuery({
    queryKey: ['geocoding', 'search', debouncedQuery, countryCode],
    queryFn: () => geocodingApi.search(debouncedQuery, countryCode),
    enabled: debouncedQuery.trim().length >= MIN_QUERY_LENGTH,
  });

  return {
    query,
    setQuery,
    suggestions: suggestions ?? [],
    isSearching: isFetching && debouncedQuery.trim().length >= MIN_QUERY_LENGTH,
  };
}
