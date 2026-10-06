// web-admin/src/app/(app)/users/page.tsx
//
// v2 — Page refaite dans le style de Géographie.
//   - Bandeau d'en-tête avec le total (ou le nombre de résultats).
//   - Cartes utilisateur : avatar coloré selon le rôle, icône quand le nom
//     n'est pas renseigné (fini les « +2 » et le numéro affiché deux fois),
//     badge de rôle et de statut.
//   - Recherche différée de 300 ms (une requête par pause de frappe et non
//     une par lettre), squelettes de chargement, état vide avec « Effacer
//     les filtres ».
// [02/10/2026] v3 — Le filtre de rôle ne propose que les types de comptes que le compte connecté a le droit de voir
// (un Support voit clients et conducteurs ; l'équipe n'apparaît qu'avec la permission d'attribuer les litiges ;
// le SuperAdmin voit tout) — même règle que côté serveur.
// v4 — Même structure que les autres pages : bandeau compact (PageHero), champ de recherche commun, rôles en
// pastilles défilantes (sans barre visible) à la place de la liste déroulante, cartes avec barre de couleur selon
// le rôle (rouge si suspendu, grise si désactivé).

'use client';

import React, { useEffect, useState } from 'react';
import { IconChevronRight, IconUser, IconUsers } from '@tabler/icons-react';
import { Badge, Button } from '@/components/ui';
import {
  EmptyState,
  FilterChips,
  IconTile,
  ListCard,
  ListSkeleton,
  Notice,
  PageHero,
  SearchField,
  type Tone,
} from '@/components/admin/AdminUi';
import { useUsersList } from '@/hooks/useUsers';
import { ACCOUNT_TYPE_LABELS } from '@/utils/userLabels';
import type { AccountType, SafeUser } from '@/types/auth.types';
import { UserDetailModal } from '@/components/users/UserDetailModal';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/utils/permissions';

const SEARCH_DEBOUNCE_MS = 300;

const ROLE_TONE: Record<AccountType, 'primary' | 'success' | 'neutral' | 'danger'> = {
  CUSTOMER: 'primary',
  DRIVER: 'success',
  SUPPORT: 'neutral',
  SUPERADMIN: 'danger',
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
  const roleTone = ROLE_TONE[user.accountType];
  const barTone: Tone = user.isSuspended ? 'danger' : !user.isActive ? 'neutral' : roleTone;
  const named = hasName(user);

  return (
    <ListCard onClick={onClick} tone={barTone}>
      <div className="flex items-center gap-3">
        <IconTile tone={roleTone} round>
          {named ? initialsOf(user) : <IconUser size={20} />}
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-text-primary">{fullNameOf(user)}</p>
          <p className="truncate text-xs text-text-secondary">{named ? user.phone : 'Nom non renseigné'}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge label={ACCOUNT_TYPE_LABELS[user.accountType]} tone={roleTone} />
            {!user.isActive ? (
              <Badge label="Désactivé" tone="neutral" />
            ) : user.isSuspended ? (
              <Badge label="Suspendu" tone="danger" />
            ) : null}
          </div>
        </div>
        <IconChevronRight size={18} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
      </div>
    </ListCard>
  );
}

export default function UsersPage() {
  const { can, isSuperAdmin } = usePermissions();
  const visibleTypes: AccountType[] = isSuperAdmin
    ? ['CUSTOMER', 'DRIVER', 'SUPPORT', 'SUPERADMIN']
    : can(PERMISSIONS.DISPUTE_ASSIGN)
      ? ['CUSTOMER', 'DRIVER', 'SUPPORT']
      : ['CUSTOMER', 'DRIVER'];
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

  const roleOptions = visibleTypes.map((value) => ({ value, label: ACCOUNT_TYPE_LABELS[value] }));

  function resetFilters() {
    setSearch('');
    setAccountType('');
  }

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Comptes de la plateforme"
        title="Utilisateurs"
        description={
          visibleTypes.includes('SUPPORT') ? 'Clients, conducteurs et équipe support.' : 'Clients et conducteurs.'
        }
        stats={[
          {
            value: total !== undefined ? String(total) : '…',
            label: hasFilters ? (total === 1 ? 'résultat' : 'résultats') : 'au total',
          },
        ]}
      />

      <div className="space-y-2">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Téléphone ou email…"
          ariaLabel="Rechercher un utilisateur"
        />
        <FilterChips value={accountType} onChange={setAccountType} options={roleOptions} allLabel="Tous les rôles" />
      </div>

      {isError ? (
        <Notice tone="danger">Impossible de charger les utilisateurs.</Notice>
      ) : isLoading ? (
        <ListSkeleton count={6} heightClass="h-24" gridClass="sm:grid-cols-2 xl:grid-cols-3" />
      ) : users.length === 0 ? (
        <EmptyState
          icon={<IconUsers size={26} />}
          title="Aucun utilisateur"
          text={hasFilters ? 'Aucun compte ne correspond à cette recherche.' : 'Les comptes apparaîtront ici dès qu’ils sont créés.'}
          action={
            hasFilters ? (
              <Button type="button" variant="secondary" onClick={resetFilters}>
                Effacer les filtres
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
