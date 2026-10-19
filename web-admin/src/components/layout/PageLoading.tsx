// web-admin/src/components/layout/PageLoading.tsx
// [19/10/2026] v1 — Indicateur de chargement partagé par les fichiers loading.tsx (changement de page) : carte ombrée avec un cercle animé.
import React from 'react';

export function PageLoading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[40vh] items-center justify-center">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-4 shadow-lg shadow-primary-dark/10">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-accent border-t-primary" aria-hidden="true" />
        <span className="text-sm font-medium text-text-secondary">{label}</span>
      </div>
    </div>
  );
}
