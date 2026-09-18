// web-admin/src/app/(app)/users/page.tsx
'use client';

import React, { useState } from 'react';
import { IconChevronRight, IconSearch } from '@tabler/icons-react';
import { Badge, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, TextField } from '@/components/ui';
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

function StatusBadge({ user }: { user: SafeUser }) {
  if (!user.isActive) return <Badge label="Désactivé" tone="neutral" />;
  if (user.isSuspended) return <Badge label="Suspendu" tone="danger" />;
  return <Badge label="Actif" tone="success" />;
}

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

      <div className="flex gap-3">
        <div className="relative max-w-xs flex-1">
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
          className="max-w-xs"
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
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Nom complet</TableHeaderCell>
              <TableHeaderCell>Téléphone</TableHeaderCell>
              <TableHeaderCell>Rôle</TableHeaderCell>
              <TableHeaderCell className="hidden sm:table-cell">Email</TableHeaderCell>
              <TableHeaderCell className="hidden sm:table-cell">Statut</TableHeaderCell>
              <TableHeaderCell className="w-8" />
            </TableRow>
          </TableHead>
          <TableBody>
            {(data?.data ?? []).map((user) => (
              <TableRow
                key={user.id}
                className="cursor-pointer transition-colors hover:bg-surface-muted/50"
                onClick={() => setSelectedUser(user)}
              >
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-semibold text-primary">
                      {initialsOf(user)}
                    </span>
                    <span className="font-medium text-text-primary">{fullNameOf(user)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-text-secondary">{user.phone}</TableCell>
                <TableCell>
                  <Badge label={ACCOUNT_TYPE_LABELS[user.accountType]} tone={ROLE_TONE[user.accountType]} />
                </TableCell>
                <TableCell className="hidden text-text-secondary sm:table-cell">{user.email ?? '—'}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  <StatusBadge user={user} />
                </TableCell>
                <TableCell className="w-8">
                  <IconChevronRight size={16} className="text-text-muted" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <UserDetailModal open={selectedUser !== null} onClose={() => setSelectedUser(null)} user={selectedUser} />
    </div>
  );
}