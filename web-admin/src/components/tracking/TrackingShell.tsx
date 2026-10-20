// web-admin/src/components/tracking/TrackingShell.tsx
// [20/10/2026] v1 — Cadre commun des pages publiques de suivi : bandeau océan avec le logo, colonne centrale, pied de page légal.
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { LegalFooterLinks } from '@/components/legal/LegalDocumentView';

export function TrackingShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-linear-to-b from-primary-light via-background to-background px-4 py-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <section className="relative overflow-hidden rounded-3xl bg-(image:--gradient-ocean) px-6 pb-7 pt-6 text-on-primary shadow-xl shadow-primary-dark/20">
          <span className="pointer-events-none absolute -right-12 -top-14 h-44 w-44 rounded-full bg-white/10" aria-hidden />
          <span className="pointer-events-none absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-white/10" aria-hidden />
          <div className="relative flex items-center gap-3">
            <Image src="/brand/logo.png" alt="" width={44} height={44} className="rounded-xl bg-white/15 p-1" priority />
            <Link href="/suivi" className="text-lg font-bold tracking-tight">
              Occa&apos;Z
            </Link>
          </div>
          <h1 className="relative mt-6 text-2xl font-bold leading-tight">{title}</h1>
          {subtitle ? <p className="relative mt-2 text-sm text-white/80">{subtitle}</p> : null}
        </section>

        {children}

        <div className="flex flex-col items-center gap-2 pb-2">
          <LegalFooterLinks />
          <p className="text-center text-xs text-text-muted">© 2026 Occa&apos;Z · occaz.sarl</p>
        </div>
      </div>
    </main>
  );
}
