// web-admin/src/app/(app)/users/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { IconSearch } from '@tabler/icons-react';
import { Badge, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, TextField } from '@/components/ui';
import { useUsersList } from '@/hooks/useUsers';
import { ACCOUNT_TYPE_LABELS } from '@/utils/userLabels';
import type { AccountType } from '@/types/auth.types';

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [accountType, setAccountType] = useState<AccountType | ''>('');
  const { data, isLoading, isError } = useUsersList({
    search: search || undefined,
    accountType: accountType || undefined,
  });

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
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Téléphone</TableHeaderCell>
              <TableHeaderCell>Email</TableHeaderCell>
              <TableHeaderCell>Rôle</TableHeaderCell>
              <TableHeaderCell>Statut</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(data?.data ?? []).map((user) => (
              <TableRow key={user.id} className="hover:bg-surface-muted/50">
                <TableCell>
                  <Link href={`/users/${user.id}`} className="font-medium text-primary hover:underline">
                    {user.phone}
                  </Link>
                </TableCell>
                <TableCell className="text-text-secondary">{user.email ?? '—'}</TableCell>
                <TableCell>{ACCOUNT_TYPE_LABELS[user.accountType]}</TableCell>
                <TableCell>
                  {user.isSuspended ? (
                    <Badge label="Suspendu" tone="danger" />
                  ) : (
                    <Badge label="Actif" tone="success" />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
