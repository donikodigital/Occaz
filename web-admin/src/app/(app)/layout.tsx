// web-admin/src/app/(app)/layout.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileTopBar } from '@/components/layout/MobileTopBar';
import { useAuthStore } from '@/stores/authStore';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar isOpen={isMobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      {/* min-w-0 : empêche ce conteneur flex de s'élargir au-delà du viewport
          quand le contenu (tableaux, cartes) est large — c'est ça qui causait
          le scroll horizontal sur mobile. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar onOpenMenu={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}