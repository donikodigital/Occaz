// web-admin/src/components/layout/Sidebar.tsx
// [22/09/2026] v2 — Refonte visuelle : marque en médaillon dégradé, icônes
// de navigation dans une pastille (au lieu d'un simple trait actif à
// gauche), item actif en fond plein avec ombre douce, carte utilisateur
// arrondie en pied de page. Structure et logique inchangées : toujours un
// tiroir piloté par isOpen/onClose en dessous de lg, fixe au-delà.
// [02/10/2026] v3 — Le menu ne montre plus que les entrées permises au compte connecté (voir nav-items.ts).
// v4 — Le vrai logo Occa'Z remplace l'icône générique (public/brand/logo.png), en-tête avec le nom en grand
// et la pastille « Back-office », entrée active en dégradé, titres de section avec filet, défilement du menu
// sans barre visible, pied de page aéré : e-mail et rôle en haut, bouton « Se déconnecter » à part en dessous.
'use client';

import React, { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { IconLogout, IconX } from '@tabler/icons-react';
import { useAuthStore } from '@/stores/authStore';
import { usePermissions } from '@/hooks/usePermissions';
import { ACCOUNT_TYPE_LABELS } from '@/utils/userLabels';
import { getVisibleSections } from './nav-items';

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
  const { can } = usePermissions();
  const sections = getVisibleSections(can);

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
        <div className="relative shrink-0 overflow-hidden border-b border-border px-4 py-4">
          <span className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-primary-light/70" />
          <span className="pointer-events-none absolute -bottom-12 right-10 h-20 w-20 rounded-full bg-primary-light/40" />
          <div className="relative flex items-center justify-between gap-2">
            <Link href="/dashboard" aria-label="Occa'Z — tableau de bord" className="flex min-w-0 items-center gap-3">
              <Image
                src="/brand/logo.png"
                alt=""
                width={44}
                height={44}
                priority
                className="h-11 w-11 shrink-0 rounded-2xl shadow-md shadow-primary/30 ring-1 ring-primary-dark/10"
              />
              <div className="min-w-0">
                <p className="truncate text-lg font-extrabold leading-none tracking-tight text-text-primary">Occa&apos;Z</p>
                <span className="mt-1.5 inline-flex items-center rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-dark">
                  Back-office
                </span>
              </div>
            </Link>
            <button
              onClick={onClose}
              aria-label="Fermer le menu"
              className="shrink-0 rounded-xl p-2 text-text-secondary transition-colors hover:bg-surface-muted lg:hidden"
            >
              <IconX size={18} />
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="mb-1.5 flex items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                {section.title}
                <span aria-hidden className="h-px flex-1 bg-border" />
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={`group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-primary to-primary-dark font-semibold text-on-primary shadow-md shadow-primary/30'
                          : 'font-medium text-text-primary hover:bg-primary-light/50'
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                          isActive
                            ? 'bg-white/15 text-on-primary'
                            : 'bg-surface-muted text-text-secondary group-hover:bg-primary-light group-hover:text-primary'
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
          <div className="rounded-2xl bg-surface-muted p-3 ring-1 ring-border/60">
            <div className="flex items-center gap-3">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-xs font-bold text-on-primary shadow-sm">
                {initialsFor(user)}
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface-muted bg-success" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold leading-tight text-text-primary" title={user?.email ?? user?.phone}>
                  {user?.email ?? user?.phone}
                </p>
                {user ? (
                  <p className="mt-0.5 truncate text-xs font-medium text-text-secondary">
                    {ACCOUNT_TYPE_LABELS[user.accountType]}
                  </p>
                ) : null}
                {user?.scopedCountries && user.scopedCountries.length > 0 ? (
                  <p className="truncate text-[11px] font-medium text-text-muted">
                    Périmètre : {user.scopedCountries.map((country) => country.name).join(', ')}
                  </p>
                ) : null}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm font-semibold text-danger shadow-sm ring-1 ring-danger/20 transition hover:bg-danger-light hover:text-danger-dark active:scale-[0.98]"
            >
              <IconLogout size={16} />
              Se déconnecter
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}