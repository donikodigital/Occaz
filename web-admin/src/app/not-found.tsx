// web-admin/src/app/not-found.tsx
// [19/10/2026] v1 — Page « introuvable » (adresse inconnue) à la place de la page 404 brute de Next.js.
import React from 'react';
import Link from 'next/link';
import { IconArrowLeft, IconMapQuestion } from '@tabler/icons-react';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex max-w-md flex-col items-center rounded-3xl border border-border bg-surface p-8 text-center shadow-xl shadow-primary-dark/10">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light text-primary shadow-sm">
          <IconMapQuestion size={30} />
        </span>
        <h1 className="mt-5 text-xl font-bold text-text-primary">Page introuvable</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          L&apos;adresse demandée n&apos;existe pas ou a été déplacée. Vérifiez le lien, ou revenez au tableau de bord.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-ocean px-5 py-3 text-sm font-semibold text-on-primary shadow-lg shadow-primary-dark/25 transition hover:brightness-110"
        >
          <IconArrowLeft size={16} />
          Retour au tableau de bord
        </Link>
      </div>
    </main>
  );
}
