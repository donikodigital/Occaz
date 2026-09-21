// web-admin/src/app/(app)/payouts/page.tsx
//
// v2 — Refonte complète (le tableau à 5 colonnes débordait sur mobile).
//   - Une carte par retrait : chauffeur, méthode, montant en grand, frise de
//     progression Demandé → En traitement → Payé (ou Échec / Annulé) et les
//     actions possibles à cette étape seulement ;
//   - filtre par statut en pastilles ;
//   - « Marquer payé » demande une confirmation (c'est une opération
//     d'argent) et les erreurs de l'API s'affichent sur la carte au lieu
//     d'être ignorées.

'use client';

import React, { useState } from 'react';
import { IconWallet } from '@tabler/icons-react';
import { Badge, Button, TextField } from '@/components/ui';
import { EmptyState, FilterChips, ListSkeleton, Notice, PageHero } from '@/components/admin/AdminUi';
import {
  useMarkPayoutFailed,
  useMarkPayoutPaid,
  useMarkPayoutProcessing,
  usePayoutsList,
} from '@/hooks/usePayouts';
import { ApiError } from '@/services/api/ApiError';
import { PAYOUT_STATUS_LABELS, PAYOUT_STATUS_TONE } from '@/utils/payoutLabels';
import { formatMoney } from '@/utils/money';
import type { PayoutListItem, PayoutStatus } from '@/types/payouts.types';

const STATUS_OPTIONS = (Object.keys(PAYOUT_STATUS_LABELS) as PayoutStatus[]).map((value) => ({
  value,
  label: PAYOUT_STATUS_LABELS[value],
}));

function formatMethod(method: string | null): string {
  if (!method) return 'Méthode non précisée';
  const text = method.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return '?';
  const last = parts[parts.length - 1];
  if (parts.length === 1 || !last) return first.slice(0, 2).toUpperCase();
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

/** Demandé → En traitement → Payé ; en cas d'échec le dernier point devient rouge. */
function PayoutProgress({ status }: { status: PayoutStatus }) {
  if (status === 'CANCELLED') {
    return <p className="text-xs font-medium text-text-muted">Retrait annulé</p>;
  }

  const failed = status === 'FAILED';
  const labels = ['Demandé', 'En traitement', failed ? 'Échec' : 'Payé'];
  const reached = status === 'REQUESTED' ? 0 : status === 'PROCESSING' ? 1 : 2;

  return (
    <div className="flex items-center gap-1.5">
      {labels.map((label, index) => {
        const isDone = index <= reached;
        const isFailure = failed && index === 2;
        return (
          <React.Fragment key={label}>
            <div className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${isFailure ? 'bg-danger' : isDone ? 'bg-primary' : 'bg-border'}`} />
              <span className={`text-[11px] font-medium ${isDone ? 'text-text-primary' : 'text-text-muted'}`}>{label}</span>
            </div>
            {index < labels.length - 1 ? <span className={`h-px flex-1 ${index < reached ? 'bg-primary' : 'bg-border'}`} /> : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

type ActionMode = 'idle' | 'confirmPaid' | 'fail';

function PayoutCard({ payout }: { payout: PayoutListItem }) {
  const markProcessing = useMarkPayoutProcessing();
  const markPaid = useMarkPayoutPaid();
  const markFailed = useMarkPayoutFailed();
  const [mode, setMode] = useState<ActionMode>('idle');
  const [failReason, setFailReason] = useState('');

  const driverName = payout.wallet?.driver ? `${payout.wallet.driver.firstName} ${payout.wallet.driver.lastName}` : null;
  const amount = formatMoney(payout.amount);
  const mutationError = markProcessing.error ?? markPaid.error ?? markFailed.error;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success-light text-sm font-bold text-success-dark">
          {driverName ? initialsOf(driverName) : '?'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-text-primary">{driverName ?? 'Chauffeur inconnu'}</p>
          <p className="truncate text-xs text-text-secondary">{formatMethod(payout.method)}</p>
        </div>
        <Badge label={PAYOUT_STATUS_LABELS[payout.status]} tone={PAYOUT_STATUS_TONE[payout.status]} />
      </div>

      <p className="mt-3 text-2xl font-bold text-text-primary">{amount}</p>

      <div className="mt-3">
        <PayoutProgress status={payout.status} />
      </div>

      {payout.status === 'REQUESTED' ? (
        <div className="mt-4">
          <Button onClick={() => markProcessing.mutate(payout.id)} loading={markProcessing.isPending}>
            Passer en traitement
          </Button>
        </div>
      ) : null}

      {payout.status === 'PROCESSING' ? (
        <div className="mt-4 space-y-3">
          {mode === 'idle' ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="success" onClick={() => setMode('confirmPaid')}>
                Marquer payé
              </Button>
              <button
                type="button"
                onClick={() => setMode('fail')}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-danger transition hover:bg-danger-light/40"
              >
                Signaler un échec
              </button>
            </div>
          ) : null}

          {mode === 'confirmPaid' ? (
            <div className="space-y-3 rounded-2xl bg-success-light/50 p-3">
              <p className="text-sm font-medium text-success-dark">
                Confirmer que {amount} a bien été envoyé{driverName ? ` à ${driverName}` : ''} ?
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => setMode('idle')}>
                  Annuler
                </Button>
                <Button variant="success" loading={markPaid.isPending} onClick={() => markPaid.mutate(payout.id)}>
                  Oui, marquer payé
                </Button>
              </div>
            </div>
          ) : null}

          {mode === 'fail' ? (
            <div className="space-y-3 rounded-2xl bg-danger-light/40 p-3">
              <TextField
                label="Motif de l'échec"
                value={failReason}
                onChange={(e) => setFailReason(e.target.value)}
                placeholder="Ex : numéro Mobile Money invalide"
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => setMode('idle')}>
                  Annuler
                </Button>
                <Button
                  variant="danger"
                  disabled={!failReason.trim()}
                  loading={markFailed.isPending}
                  onClick={() => markFailed.mutate({ id: payout.id, reason: failReason.trim() })}
                >
                  Confirmer l’échec
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {mutationError ? (
        <p className="mt-3 text-sm text-danger">
          {mutationError instanceof ApiError ? mutationError.message : 'Une erreur est survenue.'}
        </p>
      ) : null}
    </div>
  );
}

export default function PayoutsPage() {
  const [status, setStatus] = useState<PayoutStatus | ''>('');
  const { data, isLoading, isError } = usePayoutsList({ status: status || undefined });

  const payouts = data?.data ?? [];
  const total = data?.meta.total;
  const isTruncated = total !== undefined && payouts.length < total;

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Finance"
        title="Retraits"
        description="Demandes de retrait des chauffeurs : passe-les en traitement, puis marque-les payées."
        stats={[{ value: total !== undefined ? String(total) : '…', label: status ? 'retraits avec ce statut' : 'retraits au total' }]}
      />

      <FilterChips value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="Tous" />

      {isError ? (
        <Notice tone="danger">Impossible de charger les retraits.</Notice>
      ) : isLoading ? (
        <ListSkeleton count={4} heightClass="h-44" />
      ) : payouts.length === 0 ? (
        <EmptyState
          icon={<IconWallet size={26} />}
          title="Aucun retrait"
          text={
            status
              ? 'Aucun retrait ne correspond à ce statut.'
              : 'Les demandes de retrait des chauffeurs apparaîtront ici dès qu’ils en font une.'
          }
          action={
            status ? (
              <Button type="button" variant="secondary" onClick={() => setStatus('')}>
                Voir tous les retraits
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {payouts.map((payout) => (
              <PayoutCard key={payout.id} payout={payout} />
            ))}
          </div>
          {isTruncated ? (
            <p className="text-center text-xs text-text-muted">
              Affichage de {payouts.length} sur {total} — filtre par statut pour voir les autres.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}