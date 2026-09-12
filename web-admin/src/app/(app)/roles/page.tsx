// web-admin/src/app/(app)/roles/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { IconPlus } from '@tabler/icons-react';
import { Button, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui';
import { useRoles } from '@/hooks/useRbac';

export default function RolesPage() {
  const { data: roles, isLoading, isError } = useRoles();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Rôles</h1>
          <p className="text-sm text-text-secondary">Réglage ponctuel — l&apos;attribution d&apos;un rôle à un utilisateur se fait depuis sa fiche.</p>
        </div>
        <Link href="/roles/new">
          <Button>
            <IconPlus size={16} />
            Créer un rôle
          </Button>
        </Link>
      </div>

      {isError ? (
        <p className="text-sm text-danger">Impossible de charger les rôles.</p>
      ) : isLoading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Nom</TableHeaderCell>
              <TableHeaderCell>Clé</TableHeaderCell>
              <TableHeaderCell>Permissions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(roles ?? []).map((role) => (
              <TableRow key={role.id} className="hover:bg-surface-muted/50">
                <TableCell>
                  <Link href={`/roles/${role.id}`} className="font-medium text-primary hover:underline">
                    {role.name}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-text-secondary">{role.key}</TableCell>
                <TableCell className="text-text-secondary">{role.permissions.length}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
