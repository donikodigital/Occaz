// web-admin/src/app/(app)/payouts/page.tsx
'use client';

import React, { useState } from 'react';
import { Badge, Button, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, TextField } from '@/components/ui';
import {
  useMarkPayoutFailed,
  useMarkPayoutPaid,
  useMarkPayoutProcessing,
  usePayoutsList,
} from '@/hooks/usePayouts';
import { PAYOUT_STATUS_LABELS, PAYOUT_STATUS_TONE } from '@/utils/payoutLabels';
import { formatMoney } from '@/utils/money';
import type { PayoutListItem, PayoutStatus } from '@/types/payouts.types';

const STATUS_OPTIONS = Object.keys(PAYOUT_STATUS_LABELS) as PayoutStatus[];

function PayoutRow({ payout }: { payout: PayoutListItem }) {
  const markProcessing = useMarkPayoutProcessing();
  const markPaid = useMarkPayoutPaid();
  const markFailed = useMarkPayoutFailed();
  const [failReason, setFailReason] = useState('');
  const [showFailForm, setShowFailForm] = useState(false);

  return (
    <TableRow className="hover:bg-surface-muted/50 align-top">
      <TableCell>
        {payout.wallet?.driver ? `${payout.wallet.driver.firstName} ${payout.wallet.driver.lastName}` : '—'}
      </TableCell>
      <TableCell className="font-medium text-text-primary">{formatMoney(payout.amount)}</TableCell>
      <TableCell className="text-text-secondary">{payout.method ?? '—'}</TableCell>
      <TableCell>
        <Badge label={PAYOUT_STATUS_LABELS[payout.status]} tone={PAYOUT_STATUS_TONE[payout.status]} />
      </TableCell>
      <TableCell>
        {payout.status === 'REQUESTED' ? (
          <Button className="px-3 py-1.5 text-xs" onClick={() => markProcessing.mutate(payout.id)} loading={markProcessing.isPending}>
            Passer en traitement
          </Button>
        ) : null}
        {payout.status === 'PROCESSING' ? (
          <div className="flex flex-col gap-2">
            <Button
              variant="success"
              className="px-3 py-1.5 text-xs"
              onClick={() => markPaid.mutate(payout.id)}
              loading={markPaid.isPending}
            >
              Marquer payé
            </Button>
            {!showFailForm ? (
              <button onClick={() => setShowFailForm(true)} className="text-left text-xs text-danger hover:underline">
                Signaler un échec
              </button>
            ) : (
              <div className="flex gap-2">
                <TextField
                  value={failReason}
                  onChange={(e) => setFailReason(e.target.value)}
                  placeholder="Motif de l'échec"
                  className="text-xs"
                />
                <Button
                  variant="danger"
                  className="px-3 py-1.5 text-xs"
                  disabled={!failReason.trim()}
                  loading={markFailed.isPending}
                  onClick={() => markFailed.mutate({ id: payout.id, reason: failReason.trim() })}
                >
                  Confirmer
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

export default function PayoutsPage() {
  const [status, setStatus] = useState<PayoutStatus | ''>('');
  const { data, isLoading, isError } = usePayoutsList({ status: status || undefined });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Retraits</h1>
        <p className="text-sm text-text-secondary">{data ? `${data.meta.total} au total` : ''}</p>
      </div>

      <Select value={status} onChange={(e) => setStatus(e.target.value as PayoutStatus | '')} className="max-w-xs">
        <option value="">Tous les statuts</option>
        {STATUS_OPTIONS.map((value) => (
          <option key={value} value={value}>
            {PAYOUT_STATUS_LABELS[value]}
          </option>
        ))}
      </Select>

      {isError ? (
        <p className="text-sm text-danger">Impossible de charger les retraits.</p>
      ) : isLoading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Chauffeur</TableHeaderCell>
              <TableHeaderCell>Montant</TableHeaderCell>
              <TableHeaderCell>Méthode</TableHeaderCell>
              <TableHeaderCell>Statut</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(data?.data ?? []).map((payout) => (
              <PayoutRow key={payout.id} payout={payout} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
