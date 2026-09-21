// web-admin/src/app/(app)/users/page.tsx
//
// v2 — Page refaite dans le style de Géographie.
//   - Recherche et filtre « Tous les rôles » sur une seule ligne, y compris
//     sur mobile (la recherche prend la place restante, le filtre garde une
//     largeur fixe). Le filtre est un <select> natif habillé à la main : le
//     composant Select posait sa flèche au bord de la ligne, loin de la boîte
//     quand on limitait sa largeur.
//   - Bandeau d'en-tête avec le total (ou le nombre de résultats).
//   - Cartes utilisateur : avatar coloré selon le rôle, icône quand le nom
//     n'est pas renseigné (fini les « +2 » et le numéro affiché deux fois),
//     badge de rôle et de statut.
//   - Recherche différée de 300 ms (une requête par pause de frappe et non
//     une par lettre), squelettes de chargement, état vide avec « Effacer
//     les filtres ».

'use client';

import React, { useEffect, useState } from 'react';
import { IconAlertTriangle, IconChevronDown, IconChevronRight, IconSearch, IconUser, IconUsers, IconX } from '@tabler/icons-react';
import { Badge, Button } from '@/components/ui';
import { useUsersList } from '@/hooks/useUsers';
import { ACCOUNT_TYPE_LABELS } from '@/utils/userLabels';
import type { AccountType, SafeUser } from '@/types/auth.types';
import { UserDetailModal } from '@/components/users/UserDetailModal';

const SEARCH_DEBOUNCE_MS = 300;

const ROLE_TONE: Record<AccountType, 'primary' | 'success' | 'neutral' | 'danger'> = {
  CUSTOMER: 'primary',
  DRIVER: 'success',
  SUPPORT: 'neutral',
  SUPERADMIN: 'danger',
};

const AVATAR_TONE: Record<'primary' | 'success' | 'neutral' | 'danger', string> = {
  primary: 'bg-primary-light text-primary',
  success: 'bg-success-light text-success-dark',
  neutral: 'bg-border/40 text-text-secondary',
  danger: 'bg-danger-light text-danger-dark',
};

function hasName(user: SafeUser): boolean {
  return Boolean(user.firstName || user.lastName);
}

function fullNameOf(user: SafeUser): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return name || user.phone;
}

function initialsOf(user: SafeUser): string {
  const parts = fullNameOf(user).trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return '?';
  const last = parts[parts.length - 1];
  if (parts.length === 1 || !last) return first.slice(0, 2).toUpperCase();
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);
  return debounced;
}

function UserCard({ user, onClick }: { user: SafeUser; onClick: () => void }) {
  const tone = ROLE_TONE[user.accountType];
  const named = hasName(user);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-3.5 rounded-2xl border bg-surface p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md ${
        user.isSuspended ? 'border-danger-light' : 'border-border'
      }`}
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ${AVATAR_TONE[tone]}`}>
        {named ? initialsOf(user) : <IconUser size={20} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-text-primary">{fullNameOf(user)}</p>
        <p className="truncate text-xs text-text-secondary">{named ? user.phone : 'Nom non renseigné'}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge label={ACCOUNT_TYPE_LABELS[user.accountType]} tone={tone} />
          {!user.isActive ? <Badge label="Désactivé" tone="neutral" /> : user.isSuspended ? <Badge label="Suspendu" tone="danger" /> : null}
        </div>
      </div>
      <IconChevronRight size={18} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [accountType, setAccountType] = useState<AccountType | ''>('');
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);

  const { data, isLoading, isError } = useUsersList({
    search: debouncedSearch || undefined,
    accountType: accountType || undefined,
  });

  const [selectedUser, setSelectedUser] = useState<SafeUser | null>(null);

  const users = data?.data ?? [];
  const total = data?.meta.total;
  const hasFilters = search.trim().length > 0 || accountType !== '';
  const isTruncated = total !== undefined && users.length < total;

  function resetFilters() {
    setSearch('');
    setAccountType('');
  }

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/75 p-5 shadow-lg sm:p-6">
        <span className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-[rgba(255,255,255,0.10)]" />
        <span className="pointer-events-none absolute -bottom-20 left-8 h-44 w-44 rounded-full bg-[rgba(255,255,255,0.07)]" />
        <div className="relative flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[rgba(255,255,255,0.75)]">Comptes de la plateforme</p>
            <h1 className="mt-1 text-2xl font-bold text-[#ffffff] sm:text-3xl">Utilisateurs</h1>
            <p className="mt-1 text-sm text-[rgba(255,255,255,0.82)]">Clients, chauffeurs et équipe support.</p>
          </div>
          <div className="shrink-0 rounded-2xl bg-[rgba(255,255,255,0.14)] px-4 py-3 text-center backdrop-blur-sm">
            <p className="text-2xl font-bold leading-none text-[#ffffff]">{total ?? '…'}</p>
            <p className="mt-1 text-[11px] font-medium text-[rgba(255,255,255,0.8)]">
              {hasFilters ? (total === 1 ? 'résultat' : 'résultats') : 'au total'}
            </p>
          </div>
        </div>
      </div>

      {/* Recherche + filtre de rôle : toujours sur la même ligne */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <IconSearch size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Téléphone ou email…"
            aria-label="Rechercher un utilisateur"
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-9 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Effacer la recherche"
              className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-text-muted transition hover:bg-border/40 hover:text-text-primary"
            >
              <IconX size={14} />
            </button>
          ) : null}
        </div>

        <div className="relative w-[9.5rem] shrink-0 sm:w-52">
          <select
            value={accountType}
            onChange={(e) => setAccountType(e.target.value as AccountType | '')}
            aria-label="Filtrer par rôle"
            className="w-full appearance-none rounded-xl border border-border bg-surface py-2.5 pl-3.5 pr-9 text-sm text-text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Tous les rôles</option>
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <IconChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
        </div>
      </div>

      {/* Liste */}
      {isError ? (
        <div className="flex items-start gap-2.5 rounded-2xl bg-danger-light/40 px-4 py-3 text-sm text-danger-dark">
          <IconAlertTriangle size={18} className="mt-0.5 shrink-0" />
          Impossible de charger les utilisateurs.
        </div>
      ) : isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-[94px] animate-pulse rounded-2xl bg-border/50" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-surface px-6 py-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary">
            <IconUsers size={26} />
          </span>
          <p className="mt-4 font-semibold text-text-primary">Aucun utilisateur</p>
          <p className="mt-1 max-w-sm text-sm text-text-secondary">
            {hasFilters ? 'Aucun compte ne correspond à cette recherche.' : 'Les comptes apparaîtront ici dès qu’ils sont créés.'}
          </p>
          {hasFilters ? (
            <div className="mt-5">
              <Button type="button" variant="secondary" onClick={resetFilters}>
                Effacer les filtres
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {users.map((user) => (
              <UserCard key={user.id} user={user} onClick={() => setSelectedUser(user)} />
            ))}
          </div>
          {isTruncated ? (
            <p className="text-center text-xs text-text-muted">
              Affichage de {users.length} sur {total} — affine ta recherche pour voir les autres.
            </p>
          ) : null}
        </>
      )}

      <UserDetailModal open={selectedUser !== null} onClose={() => setSelectedUser(null)} user={selectedUser} />
    </div>
  );
}