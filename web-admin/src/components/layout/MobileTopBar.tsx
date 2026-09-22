// web-admin/src/components/layout/MobileTopBar.tsx
// [22/09/2026] v2 — Vrai en-tête mobile, à la place de l'ancienne barre du
// bas (retirée) : plus de hauteur, ombre douce au lieu d'un simple trait,
// et un avatar à droite qui ouvre le même tiroir que le menu burger — le
// compte (email, déconnexion) reste dans le pied de la Sidebar, cet avatar
// n'est qu'un second accès, symétrique du burger.
'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { IconMenu2 } from '@tabler/icons-react';
import { useAuthStore } from '@/stores/authStore';
import { getActiveNavItem } from './nav-items';

interface MobileTopBarProps {
  onOpenMenu: () => void;
}

function initialsFor(user: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string } | null): string {
  if (!user) return '·';
  if (user.firstName || user.lastName) {
    return `${user.firstName?.charAt(0) ?? ''}${user.lastName?.charAt(0) ?? ''}`.toUpperCase() || '·';
  }
  const source = user.email ?? user.phone ?? '';
  return source.slice(0, 2).toUpperCase() || '·';
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
  const user = useAuthStore((state) => state.user);
  const activeItem = getActiveNavItem(pathname);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-surface px-4 py-3.5 shadow-sm lg:hidden">
      <button
        onClick={onOpenMenu}
        aria-label="Ouvrir le menu"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-text-primary transition-colors hover:bg-surface-muted"
      >
        <IconMenu2 size={20} />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold leading-tight text-text-primary">
          {activeItem?.label ?? 'Back-office'}
        </p>
        <p className="truncate text-xs font-medium text-text-secondary">Transport Partagé</p>
      </div>

      <button
        onClick={onOpenMenu}
        aria-label="Ouvrir le menu du compte"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary-dark transition-transform active:scale-95"
      >
        {initialsFor(user)}
      </button>
    </header>
  );
}