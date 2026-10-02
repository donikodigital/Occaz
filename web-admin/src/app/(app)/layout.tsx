// web-admin/src/app/(app)/layout.tsx
// [22/09/2026] v2 — Barre du bas mobile retirée (BottomNavBar supprimé) :
// sur mobile, la navigation passe entièrement par le tiroir ouvert depuis
// le vrai en-tête (MobileTopBar). Plus de pb-24 réservé pour elle.
// [02/10/2026] v3 — Garde d'accès par permission : une page absente du menu du compte (lien tapé à la main)
// affiche « Accès non autorisé » au lieu d'une erreur brute. Le contenu attend que les permissions soient chargées.
'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileTopBar } from '@/components/layout/MobileTopBar';
import { AccessDenied } from '@/components/layout/AccessDenied';
import { canSeeNavItem, getActiveNavItem } from '@/components/layout/nav-items';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/stores/authStore';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { can, isReady } = usePermissions();
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const activeItem = getActiveNavItem(pathname);
  const isAllowed = !activeItem || canSeeNavItem(activeItem, can);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar isOpen={isMobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar onOpenMenu={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <div className="mx-auto w-full max-w-6xl">
            {!isReady ? (
              <p className="text-sm text-text-secondary">Chargement…</p>
            ) : isAllowed ? (
              children
            ) : (
              <AccessDenied />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}