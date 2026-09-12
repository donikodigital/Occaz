// web-admin/src/app/(app)/audit-logs/page.tsx
'use client';

import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, TextField } from '@/components/ui';
import { useAuditLogs } from '@/hooks/useAuditLogs';

export default function AuditLogsPage() {
  const [entityType, setEntityType] = useState('');
  const { data, isLoading, isError } = useAuditLogs({ entityType: entityType || undefined });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Journal d&apos;audit</h1>
        <p className="text-sm text-text-secondary">{data ? `${data.meta.total} entrées` : ''}</p>
      </div>

      <TextField
        value={entityType}
        onChange={(e) => setEntityType(e.target.value)}
        placeholder="Filtrer par type d'entité (ex: Role, PaymentProvider)…"
        className="max-w-sm"
      />

      {isError ? (
        <p className="text-sm text-danger">Impossible de charger le journal d&apos;audit.</p>
      ) : isLoading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell>Acteur</TableHeaderCell>
              <TableHeaderCell>Action</TableHeaderCell>
              <TableHeaderCell>Entité</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(data?.data ?? []).map((entry) => (
              <TableRow key={entry.id} className="hover:bg-surface-muted/50">
                <TableCell className="text-text-secondary">
                  {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(entry.createdAt))}
                </TableCell>
                <TableCell className="text-text-secondary">{entry.actor?.email ?? entry.actor?.phone ?? '—'}</TableCell>
                <TableCell>{entry.action}</TableCell>
                <TableCell className="font-mono text-xs text-text-secondary">
                  {entry.entityType} · {entry.entityId.slice(0, 8)}…
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
