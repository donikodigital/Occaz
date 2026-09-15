// web-admin/src/components/layout/BottomNavBar.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getQuickLinks } from './nav-items';

const QUICK_LINKS = getQuickLinks();

/**
 * Barre d'accès rapide mobile — les sections les plus utilisées, en
 * complément du menu burger (MobileTopBar) qui donne accès au reste.
 * Visible uniquement en dessous de lg ; masquée sur desktop où la
 * Sidebar affiche déjà tout.
 */
export function BottomNavBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="flex items-stretch justify-around">
        {QUICK_LINKS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-center text-[11px] leading-tight ${
                isActive ? 'font-semibold text-primary' : 'text-text-secondary'
              }`}
            >
              <Icon size={22} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}