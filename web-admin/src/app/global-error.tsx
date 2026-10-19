// web-admin/src/app/global-error.tsx
// [19/10/2026] v1 — Dernier filet : si la structure même de la page (layout racine) plante, cette page de secours remplace tout. Elle doit
// donc porter ses propres <html> et <body>, et n'utilise aucun composant de l'application (ils peuvent être la cause de la panne).
'use client';

import React, { useEffect } from 'react';
import { captureException } from '@/lib/monitoring';
import './globals.css';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    captureException(error, { boundary: 'global', digest: error.digest });
  }, [error]);

  return (
    <html lang="fr">
      <body className="bg-background text-text-primary antialiased">
        <main role="alert" className="flex min-h-screen items-center justify-center px-4">
          <div className="max-w-md rounded-3xl border border-border bg-surface p-8 text-center shadow-xl">
            <h1 className="text-xl font-bold">Occa&apos;Z est momentanément indisponible</h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Une erreur inattendue est survenue. L&apos;équipe technique en a été informée. Rechargez la page dans un instant.
            </p>
            {error.digest ? <p className="mt-2 text-xs text-text-muted">Référence : {error.digest}</p> : null}
            <button
              type="button"
              onClick={reset}
              className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary shadow-lg transition hover:brightness-110"
            >
              Recharger
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
