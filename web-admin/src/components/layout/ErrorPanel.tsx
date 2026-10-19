// web-admin/src/components/layout/ErrorPanel.tsx
// [19/10/2026] v1 — Carte « Une erreur est survenue » partagée par les pages d'erreur (app/error.tsx, app/(app)/error.tsx) : message clair,
// bouton « Réessayer » et retour au tableau de bord. L'erreur est envoyée au suivi (Sentry) ; son détail technique n'est jamais affiché.
'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { IconAlertTriangle, IconArrowLeft, IconRefresh } from '@tabler/icons-react';
import { captureException } from '@/lib/monitoring';

export function ErrorPanel({ error, reset, boundary }: { error: Error & { digest?: string }; reset: () => void; boundary: string }) {
  useEffect(() => {
    captureException(error, { boundary, digest: error.digest });
  }, [error, boundary]);

  return (
    <div role="alert" className="mx-auto mt-16 flex max-w-md flex-col items-center rounded-3xl border border-border bg-surface p-8 text-center shadow-xl shadow-primary-dark/10">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-light text-danger shadow-sm">
        <IconAlertTriangle size={30} />
      </span>
      <h1 className="mt-5 text-xl font-bold text-text-primary">Une erreur est survenue</h1>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        Cette page n&apos;a pas pu s&apos;afficher. L&apos;équipe technique en a été informée. Vous pouvez réessayer ou revenir au tableau de bord.
      </p>
      {error.digest ? <p className="mt-2 text-xs text-text-muted">Référence : {error.digest}</p> : null}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-ocean px-5 py-3 text-sm font-semibold text-on-primary shadow-lg shadow-primary-dark/25 transition hover:brightness-110"
        >
          <IconRefresh size={16} />
          Réessayer
        </button>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-muted"
        >
          <IconArrowLeft size={16} />
          Tableau de bord
        </Link>
      </div>
    </div>
  );
}
