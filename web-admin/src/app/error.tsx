// web-admin/src/app/error.tsx
// [19/10/2026] v1 — Page d'erreur de l'application (hors espace connecté, ex. page de connexion) : remplace l'écran d'erreur brut de Next.js.
'use client';

import React from 'react';
import { ErrorPanel } from '@/components/layout/ErrorPanel';

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-background px-4">
      <ErrorPanel error={error} reset={reset} boundary="app" />
    </main>
  );
}
