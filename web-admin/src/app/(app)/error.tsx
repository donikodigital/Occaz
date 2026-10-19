// web-admin/src/app/(app)/error.tsx
// [19/10/2026] v1 — Erreur dans une page de l'espace connecté : le menu latéral reste affiché, seule la zone de contenu montre l'erreur
// (avant, l'écran d'erreur brut de Next.js remplaçait toute la page).
'use client';

import React from 'react';
import { ErrorPanel } from '@/components/layout/ErrorPanel';

export default function AppSectionError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel error={error} reset={reset} boundary="app-section" />;
}
