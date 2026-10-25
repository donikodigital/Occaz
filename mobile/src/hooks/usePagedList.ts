// mobile/src/hooks/usePagedList.ts
// [25/10/2026] v1 — Liste paginée « charger la suite en bas de l'écran ». Les écrans d'activité n'affichaient que les 20 premiers éléments,
// sans moyen d'en voir davantage, et comptaient « 20 » même avec 57 réservations : le total vient maintenant du serveur.
import { useMemo } from 'react';
import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query';
import type { Paginated } from '@/services/api/types';

export const PAGE_SIZE = 20;

export function usePagedList<T>(queryKey: QueryKey, fetchPage: (page: number) => Promise<Paginated<T>>) {
  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
  });

  const items = useMemo(() => query.data?.pages.flatMap((page) => page.data) ?? [], [query.data]);
  /** Total réel côté serveur (pas le nombre d'éléments déjà chargés). */
  const total = query.data?.pages[0]?.meta.total;

  return {
    items,
    total,
    isLoading: query.isLoading,
    /** Échec sans rien à afficher : l'écran propose « Réessayer » au lieu d'un faux « Aucun élément ». */
    hasFailed: query.isError && items.length === 0,
    isRefreshing: query.isRefetching && !query.isFetchingNextPage,
    isLoadingMore: query.isFetchingNextPage,
    refresh: () => void query.refetch(),
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage && !query.isError) void query.fetchNextPage();
    },
  };
}
