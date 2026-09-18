// web-admin/src/app/(app)/users/page.tsx
'use client';

import React, { useState } from 'react';
import { IconSearch } from '@tabler/icons-react';
import { Badge, EntityAvatar, EntityListCard, Select, TextField } from '@/components/ui';
import { useUsersList } from '@/hooks/useUsers';
import { ACCOUNT_TYPE_LABELS } from '@/utils/userLabels';
import type { AccountType, SafeUser } from '@/types/auth.types';
import { UserDetailModal } from '@/components/users/UserDetailModal';

function fullNameOf(user: SafeUser): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return name || user.phone;
}

function initialsOf(user: SafeUser): string {
  const name = fullNameOf(user);
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const ROLE_TONE: Record<AccountType, 'primary' | 'success' | 'neutral' | 'danger'> = {
  CUSTOMER: 'primary',
  DRIVER: 'success',
  SUPPORT: 'neutral',
  SUPERADMIN: 'danger',
};

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [accountType, setAccountType] = useState<AccountType | ''>('');
  const { data, isLoading, isError } = useUsersList({
    search: search || undefined,
    accountType: accountType || undefined,
  });

  const [selectedUser, setSelectedUser] = useState<SafeUser | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Utilisateurs</h1>
        <p className="text-sm text-text-secondary">{data ? `${data.meta.total} au total` : ''}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[180px] flex-1">
          <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Téléphone ou email…"
            className="pl-9"
          />
        </div>
        <Select
          value={accountType}
          onChange={(e) => setAccountType(e.target.value as AccountType | '')}
          className="max-w-[180px]"
        >
          <option value="">Tous les rôles</option>
          {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {isError ? (
        <p className="text-sm text-danger">Impossible de charger les utilisateurs.</p>
      ) : isLoading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : (data?.data.length ?? 0) === 0 ? (
        <p className="py-10 text-center text-sm text-text-muted">Aucun utilisateur ne correspond à cette recherche.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {(data?.data ?? []).map((user) => (
            <EntityListCard
              key={user.id}
              avatar={<EntityAvatar initials={initialsOf(user)} tone={ROLE_TONE[user.accountType]} />}
              title={fullNameOf(user)}
              subtitle={user.phone}
              badges={
                <>
                  <Badge label={ACCOUNT_TYPE_LABELS[user.accountType]} tone={ROLE_TONE[user.accountType]} />
                  {!user.isActive ? <Badge label="Désactivé" tone="neutral" /> : user.isSuspended ? <Badge label="Suspendu" tone="danger" /> : null}
                </>
              }
              onClick={() => setSelectedUser(user)}
            />
          ))}
        </div>
      )}

      <UserDetailModal open={selectedUser !== null} onClose={() => setSelectedUser(null)} user={selectedUser} />
    </div>
  );
}