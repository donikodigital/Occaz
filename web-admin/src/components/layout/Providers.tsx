// web-admin/src/components/layout/Providers.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/services/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { CookieBanner } from '@/components/cookies/CookieBanner';

/**
 * Hydrate la session au premier chargement (vérifie qu'un jeton stocké
 * est toujours valide via GET /users/me) avant de rendre quoi que ce
 * soit — même principe que app/_layout.tsx côté mobile.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((state) => state.hydrate);
  const isHydrating = useAuthStore((state) => state.isHydrating);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {mounted && !isHydrating ? children : null}
      {mounted ? <CookieBanner /> : null}
    </QueryClientProvider>
  );
}