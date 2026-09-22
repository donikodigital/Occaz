// web-admin/src/components/layout/Sidebar.tsx
// [22/09/2026] v2 — Refonte visuelle : marque en médaillon dégradé, icônes
// de navigation dans une pastille (au lieu d'un simple trait actif à
// gauche), item actif en fond plein avec ombre douce, carte utilisateur
// arrondie en pied de page. Structure et logique inchangées : toujours un
// tiroir piloté par isOpen/onClose en dessous de lg, fixe au-delà.
'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { IconLogout, IconRoute, IconX } from '@tabler/icons-react';
import { useAuthStore } from '@/stores/authStore';
import { NAV_SECTIONS } from './nav-items';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

/** "Mamadou Diallo" -> "MD" ; à défaut, les deux premières lettres de l'email ou du téléphone. */
function initialsFor(user: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string } | null): string {
  if (!user) return '·';
  if (user.firstName || user.lastName) {
    return `${user.firstName?.charAt(0) ?? ''}${user.lastName?.charAt(0) ?? ''}`.toUpperCase() || '·';
  }
  const source = user.email ?? user.phone ?? '';
  return source.slice(0, 2).toUpperCase() || '·';
}

/**
 * Fixe en desktop (≥ lg). En dessous de lg, devient un tiroir hors-écran
 * piloté par isOpen/onClose (déclenché depuis MobileTopBar) — même liste
 * de navigation des deux côtés, seule la présentation change.
 *
 * h-dvh (et non h-screen) : sur mobile, 100vh dépasse souvent la zone
 * réellement visible quand la barre d'adresse du navigateur est affichée,
 * ce qui poussait le pied (mail + déconnexion) hors écran.
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
        className={`fixed inset-0 z-40 bg-text-primary/40 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-72 shrink-0 flex-col border-r border-border bg-surface shadow-xl transition-transform duration-200 ease-out lg:static lg:h-screen lg:w-64 lg:translate-x-0 lg:shadow-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark text-on-primary shadow-md shadow-primary/25">
              <IconRoute size={20} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-bold leading-tight text-text-primary">Back-office</p>
              <p className="truncate text-xs font-medium text-text-secondary">Transport Partagé</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer le menu"
            className="shrink-0 rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-muted lg:hidden"
          >
            <IconX size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-text-muted">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-all ${
                        isActive
                          ? 'bg-primary font-semibold text-on-primary shadow-sm shadow-primary/30'
                          : 'font-medium text-text-primary hover:bg-surface-muted'
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                          isActive
                            ? 'bg-white/15 text-on-primary'
                            : 'bg-surface-muted text-text-secondary group-hover:bg-surface group-hover:text-primary'
                        }`}
                      >
                        <Icon size={16} />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-border px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3 rounded-xl bg-surface-muted p-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary-dark">
              {initialsFor(user)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text-primary">{user?.email ?? user?.phone}</p>
              <button
                onClick={handleLogout}
                className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-danger transition-colors hover:text-danger-dark"
              >
                <IconLogout size={13} />
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}