// web-admin/src/components/layout/MobileTopBar.tsx
'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { IconMenu2 } from '@tabler/icons-react';
import { getActiveNavItem } from './nav-items';

interface MobileTopBarProps {
  onOpenMenu: () => void;
}

/**
 * Barre visible uniquement en dessous de lg (1024px) — donne accès au
 * tiroir de navigation puisque la sidebar fixe disparaît à cette largeur,
 * et rappelle où l'on se trouve dans le back-office.
 */
export function MobileTopBar({ onOpenMenu }: MobileTopBarProps) {
  const pathname = usePathname();
  const activeItem = getActiveNavItem(pathname);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-surface px-4 py-3 lg:hidden">
      <button
        onClick={onOpenMenu}
        aria-label="Ouvrir le menu"
        className="rounded-lg p-1.5 text-text-primary hover:bg-surface-muted"
      >
        <IconMenu2 size={20} />
      </button>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-text-primary">
          {activeItem?.label ?? 'Back-office'}
        </p>
        <p className="text-xs text-text-secondary">Transport Partagé</p>
      </div>
    </header>
  );
}