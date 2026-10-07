// web-admin/src/components/layout/MobileTopBar.tsx
// [22/09/2026] v2 — Vrai en-tête mobile, à la place de l'ancienne barre du
// bas (retirée) : plus de hauteur, ombre douce au lieu d'un simple trait,
// et un avatar à droite qui ouvre le même tiroir que le menu burger — le
// compte (email, déconnexion) reste dans le pied de la Sidebar, cet avatar
// n'est qu'un second accès, symétrique du burger.
// v3 — Le logo Occa'Z s'affiche entre le burger et le titre de la page.
// v4 — L'avatar (initiales) laisse la place à la cloche des notifications ; le compte reste dans le pied de la Sidebar.
'use client';

import React from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { IconMenu2 } from '@tabler/icons-react';
import { getActiveNavItem } from './nav-items';
import { NotificationBell } from './NotificationBell';

interface MobileTopBarProps {
  onOpenMenu: () => void;
}

/**
 * Visible uniquement en dessous de lg (1024px) — donne accès au tiroir de
 * navigation puisque la sidebar fixe disparaît à cette largeur, et rappelle
 * où l'on se trouve dans le back-office. Seule barre de navigation mobile :
 * l'ancienne barre du bas (accès rapide à 4 sections) a été retirée, tout
 * passe par ce tiroir désormais.
 */
export function MobileTopBar({ onOpenMenu }: MobileTopBarProps) {
  const pathname = usePathname();
  const activeItem = getActiveNavItem(pathname);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-border bg-surface px-3 py-3 shadow-sm lg:hidden">
      <button
        onClick={onOpenMenu}
        aria-label="Ouvrir le menu"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-text-primary transition-colors hover:bg-surface-muted"
      >
        <IconMenu2 size={20} />
      </button>

      <Image
        src="/brand/logo.png"
        alt="Occa'Z"
        width={36}
        height={36}
        priority
        className="h-9 w-9 shrink-0 rounded-xl shadow-sm shadow-primary/30 ring-1 ring-primary-dark/10"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold leading-tight text-text-primary">
          {activeItem?.label ?? 'Back-office'}
        </p>
        <p className="truncate text-xs font-medium text-text-secondary">Occa'Z</p>
      </div>

      <NotificationBell />
    </header>
  );
}