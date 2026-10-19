// mobile/src/hooks/useConnectivityProbe.ts
// [19/10/2026] v1 — Tant que l'application se croit hors connexion, vérifie toutes les 8 secondes si le serveur répond de nouveau
// (GET /health, route publique et légère). Dès qu'il répond, le bandeau « Pas de connexion » disparaît et les écrans se rechargent.
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiUrl } from '@/services/api/client';
import { useConnectivityStore } from '@/stores/connectivityStore';

const PROBE_INTERVAL_MS = 8_000;
const PROBE_TIMEOUT_MS = 6_000;

export function useConnectivityProbe(): void {
  const offline = useConnectivityStore((state) => state.offline);
  const markOnline = useConnectivityStore((state) => state.markOnline);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!offline) return undefined;
    let cancelled = false;

    async function probe() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
      try {
        // Toute réponse HTTP (même une erreur) prouve que le réseau est revenu ; seul un échec réseau est ignoré.
        await fetch(apiUrl('/health'), { signal: controller.signal });
        if (cancelled) return;
        markOnline();
        void queryClient.invalidateQueries();
      } catch {
        // toujours hors connexion : on réessaiera
      } finally {
        clearTimeout(timer);
      }
    }

    const interval = setInterval(() => void probe(), PROBE_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [offline, markOnline, queryClient]);
}
