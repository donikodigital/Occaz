// web-admin/src/app/(app)/disputes/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { IconPackage, IconRoute } from '@tabler/icons-react';
import { Badge, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui';
import { useDisputesList } from '@/hooks/useDisputes';
import {
  DISPUTE_PRIORITY_LABELS,
  DISPUTE_PRIORITY_TONE,
  DISPUTE_STATUS_LABELS,
  DISPUTE_STATUS_TONE,
} from '@/utils/disputeLabels';
import type { DisputePriority, DisputeStatus } from '@/types/disputes.types';

const STATUS_OPTIONS = Object.keys(DISPUTE_STATUS_LABELS) as DisputeStatus[];
const PRIORITY_OPTIONS = Object.keys(DISPUTE_PRIORITY_LABELS) as DisputePriority[];

export default function DisputesPage() {
  const [status, setStatus] = useState<DisputeStatus | ''>('');
  const [priority, setPriority] = useState<DisputePriority | ''>('');
  const { data, isLoading, isError } = useDisputesList({ status: status || undefined, priority: priority || undefined });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Litiges</h1>
        <p className="text-sm text-text-secondary">{data ? `${data.meta.total} au total` : ''}</p>
      </div>

      <div className="flex gap-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value as DisputeStatus | '')} className="max-w-xs">
          <option value="">Tous les statuts</option>
          {STATUS_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {DISPUTE_STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
        <Select value={priority} onChange={(e) => setPriority(e.target.value as DisputePriority | '')} className="max-w-xs">
          <option value="">Toutes priorités</option>
          {PRIORITY_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {DISPUTE_PRIORITY_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>

      {isError ? (
        <p className="text-sm text-danger">Impossible de charger les litiges.</p>
      ) : isLoading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Motif</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Priorité</TableHeaderCell>
              <TableHeaderCell>Statut</TableHeaderCell>
              <TableHeaderCell>Ouvert le</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(data?.data ?? []).map((dispute) => (
              <TableRow key={dispute.id} className="hover:bg-surface-muted/50">
                <TableCell>
                  <Link href={`/disputes/${dispute.id}`} className="font-medium text-primary hover:underline">
                    {dispute.reason}
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-text-secondary">
                    {dispute.subjectType === 'SHIPMENT' ? <IconPackage size={14} /> : <IconRoute size={14} />}
                    {dispute.subjectType === 'SHIPMENT' ? 'Envoi' : 'Trajet'}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge label={DISPUTE_PRIORITY_LABELS[dispute.priority]} tone={DISPUTE_PRIORITY_TONE[dispute.priority]} />
                </TableCell>
                <TableCell>
                  <Badge label={DISPUTE_STATUS_LABELS[dispute.status]} tone={DISPUTE_STATUS_TONE[dispute.status]} />
                </TableCell>
                <TableCell className="text-text-secondary">
                  {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(
                    new Date(dispute.createdAt),
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
