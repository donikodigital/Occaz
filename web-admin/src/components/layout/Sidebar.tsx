// web-admin/src/components/layout/Sidebar.tsx
'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { IconLogout, IconX } from '@tabler/icons-react';
import { useAuthStore } from '@/stores/authStore';
import { NAV_SECTIONS } from './nav-items';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Fixe en desktop (≥ lg). En dessous de lg, devient un tiroir hors-écran
 * piloté par isOpen/onClose (déclenché depuis MobileTopBar) — même liste
 * de navigation des deux côtés, seule la présentation change.
 */
export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  // Referme le tiroir à chaque changement de page.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Bloque le scroll du fond pendant que le tiroir mobile est ouvert.
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-text-primary/40 transition-opacity duration-200 lg:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-72 shrink-0 flex-col border-r border-border bg-surface transition-transform duration-200 ease-out lg:static lg:w-64 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-5 py-6">
          <div>
            <p className="text-lg font-bold text-primary">Back-office</p>
            <p className="text-xs text-text-secondary">Transport Partagé</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer le menu"
            className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-muted lg:hidden"
          >
            <IconX size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="mb-1.5 px-3 text-xs font-semibold text-text-muted">{section.title}</p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5 text-sm transition-colors ${
                        isActive
                          ? 'border-primary bg-primary-light font-semibold text-primary-dark'
                          : 'border-transparent text-text-primary hover:bg-surface-muted'
                      }`}
                    >
                      <Icon size={18} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border px-4 py-4">
          <p className="truncate text-sm font-medium text-text-primary">{user?.email ?? user?.phone}</p>
          <button
            onClick={handleLogout}
            className="mt-2 flex items-center gap-2 text-sm text-danger hover:underline"
          >
            <IconLogout size={16} />
            Se déconnecter
          </button>
        </div>
      </aside>
    </>
  );
}