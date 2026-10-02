// web-admin/src/components/layout/AccessDenied.tsx
// [02/10/2026] Affiché à la place d'une page que le compte connecté n'a pas le droit d'ouvrir (lien tapé à la
// main, ancien favori…). Le serveur refuse de toute façon les données : ceci évite l'écran d'erreur brut.
import React from 'react';
import Link from 'next/link';
import { IconArrowLeft, IconShieldLock } from '@tabler/icons-react';

export function AccessDenied() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-3xl border border-border bg-surface p-8 text-center shadow-xl shadow-primary-dark/10">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light text-primary shadow-sm">
        <IconShieldLock size={30} />
      </span>
      <h1 className="mt-5 text-xl font-bold text-text-primary">Accès non autorisé</h1>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        Votre rôle ne donne pas accès à cette page. Si vous pensez que c&apos;est une erreur, demandez à un
        SuperAdmin de vous attribuer le rôle correspondant.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-ocean px-5 py-3 text-sm font-semibold text-on-primary shadow-lg shadow-primary-dark/25 transition hover:brightness-110"
      >
        <IconArrowLeft size={16} />
        Retour au tableau de bord
      </Link>
    </div>
  );
}