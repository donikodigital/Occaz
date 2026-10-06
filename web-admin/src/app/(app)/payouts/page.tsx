// web-admin/src/app/(app)/payouts/page.tsx
//
// v6 — Cartes compactes et dépliables (≈ 80 px au lieu de ≈ 270 px une fois repliées).
//   - Carte repliée : avatar, nom, méthode + date, montant à droite avec sa pastille de statut, et une mini-barre de progression
//     en 3 segments. Un éclair signale un traitement automatique.
//   - Un toucher déplie la carte : référence copiable, frise détaillée, motif d'échec, actions.
//   - Les retraits qui attendent une décision (Demandé, En traitement) s'affichent dépliés ; les autres (Payé, Échec, Annulé)
//     sont repliés, donc une longue liste d'historique reste lisible.
//
// v5 — Montant allégé : graisse « medium » (500) forcée en style en ligne, devise « GNF » plus petite et plus claire,
//   chiffres de largeur égale (tabular-nums).
//
// v3 — Cartes modernisées (liseré de statut, avatar dégradé, référence courte copiable, frise, confirmation « Marquer payé »).
//
// v2 — Refonte complète (le tableau à 5 colonnes débordait sur mobile).

'use client';

import React, { useState } from 'react';
import {
  IconBolt,
  IconBuildingBank,
  IconCash,
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconDeviceMobile,
  IconWallet,
  IconX,
} from '@tabler/icons-react';
import { Button, TextField } from '@/components/ui';
import { EmptyState, FilterChips, ListSkeleton, Notice, PageHero } from '@/components/admin/AdminUi';
import {
  useMarkPayoutFailed,
  useMarkPayoutPaid,
  useMarkPayoutProcessing,
  usePayoutsList,
} from '@/hooks/usePayouts';
import { ApiError } from '@/services/api/ApiError';
import { PAYOUT_STATUS_LABELS } from '@/utils/payoutLabels';
import { formatMoney } from '@/utils/money';
import type { PayoutListItem, PayoutStatus } from '@/types/payouts.types';

const STATUS_OPTIONS = (Object.keys(PAYOUT_STATUS_LABELS) as PayoutStatus[]).map((value) => ({
  value,
  label: PAYOUT_STATUS_LABELS[value],
}));

/** Liseré de la carte et pastille de statut : une couleur par statut. */
const STATUS_STYLE: Record<PayoutStatus, { bar: string; pill: string }> = {
  REQUESTED: { bar: 'bg-border-strong', pill: 'bg-surface-muted text-text-secondary' },
  PROCESSING: { bar: 'bg-primary', pill: 'bg-primary-light text-primary-dark' },
  PAID: { bar: 'bg-success', pill: 'bg-success-light text-success-dark' },
  FAILED: { bar: 'bg-danger', pill: 'bg-danger-light text-danger' },
  CANCELLED: { bar: 'bg-danger', pill: 'bg-danger-light text-danger' },
};

function formatMethod(method: string | null): string {
  if (!method) return 'Méthode non précisée';
  const text = method.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function MethodIcon({ method }: { method: string | null }) {
  const key = (method ?? '').toLowerCase();
  if (key.includes('mobile')) return <IconDeviceMobile size={13} className="shrink-0" />;
  if (key.includes('bank') || key.includes('banc') || key.includes('virement')) return <IconBuildingBank size={13} className="shrink-0" />;
  return <IconCash size={13} className="shrink-0" />;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return '?';
  const last = parts[parts.length - 1];
  if (parts.length === 1 || !last) return first.slice(0, 2).toUpperCase();
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

/**
 * Sépare « 15 000 GNF » en nombre et devise pour pouvoir styler la devise plus discrètement. Si le format n'est pas reconnu
 * (devise placée avant le nombre, par exemple), le texte est affiché tel quel.
 */
function splitMoney(formatted: string): { value: string; currency: string } {
  const match = formatted.match(/^(.*?\d)[\s\u00a0\u202f]*([^\d\s\u00a0\u202f.,-]+)$/);
  if (!match) return { value: formatted, currency: '' };
  const [, value = formatted, currency = ''] = match;
  return { value, currency };
}

/** Montant d'une carte : nombre en graisse moyenne, devise plus petite et plus claire. Un <span> : il vit dans un <button>. */
function AmountText({ formatted }: { formatted: string }) {
  const { value, currency } = splitMoney(formatted);
  return (
    <span
      className="block whitespace-nowrap text-lg font-medium leading-tight tabular-nums tracking-tight text-text-primary"
      // Graisse en ligne : prioritaire sur toute règle globale, et 500 existe dans à peu près toutes les polices chargées.
      style={{ fontWeight: 500 }}
    >
      {value}
      {currency ? (
        <span className="ml-1 text-xs text-text-secondary" style={{ fontWeight: 400 }}>
          {currency}
        </span>
      ) : null}
    </span>
  );
}

/** « 5 oct., 15:02 » — la date de la demande, dans le fuseau de l'appareil. */
function formatRequestedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

/**
 * Référence lisible : « SIM-2560a4a5-14b1-44c9-8220-acbeb703c422 » devient « SIM · 2560A4A5 ». La référence complète reste
 * disponible (copie au toucher, info-bulle) pour retrouver le virement chez le prestataire.
 */
function shortReference(reference: string): string {
  const match = reference.match(/^([A-Za-z]+)[-_](.+)$/);
  if (!match) return reference.length > 14 ? `${reference.slice(0, 12).toUpperCase()}…` : reference;
  const [, prefix = '', rest = ''] = match;
  const compact = rest.replace(/[-_]/g, '').slice(0, 8).toUpperCase();
  return `${prefix.toUpperCase()} · ${compact}`;
}

function ReferenceChip({ reference }: { reference: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard
      ?.writeText(reference)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => undefined);
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={reference}
      aria-label={`Copier la référence complète ${reference}`}
      className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5 text-xs font-medium tabular-nums text-text-secondary transition hover:bg-border active:scale-95"
    >
      <span className="text-text-muted">Réf.</span>
      <span className="font-semibold text-text-primary">{shortReference(reference)}</span>
      {copied ? <IconCheck size={13} className="text-success-dark" /> : <IconCopy size={13} className="text-text-muted" />}
    </button>
  );
}

/** Mini-barre de la carte repliée : 3 segments (Demandé → En traitement → Payé/Échec), sans libellé. */
function MiniProgress({ status }: { status: PayoutStatus }) {
  if (status === 'CANCELLED') return null;
  const failed = status === 'FAILED';
  const reached = status === 'REQUESTED' ? 0 : status === 'PROCESSING' ? 1 : 2;
  return (
    <div aria-hidden className="mt-2.5 flex gap-1">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={`h-1 flex-1 rounded-full ${
            index > reached ? 'bg-border' : failed && index === 2 ? 'bg-danger' : 'bg-primary'
          } ${status === 'PROCESSING' && index === 1 ? 'animate-pulse' : ''}`}
        />
      ))}
    </div>
  );
}

/** Étapes : Demandé → En traitement → Payé ; en cas d'échec la dernière étape devient rouge. */
function PayoutProgress({ status }: { status: PayoutStatus }) {
  if (status === 'CANCELLED') {
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
        <IconX size={14} />
        Retrait annulé
      </p>
    );
  }

  const failed = status === 'FAILED';
  const labels = ['Demandé', 'En traitement', failed ? 'Échec' : 'Payé'];
  const reached = status === 'REQUESTED' ? 0 : status === 'PROCESSING' ? 1 : 2;

  return (
    <ol className="grid grid-cols-3">
      {labels.map((label, index) => {
        const isDone = index <= reached;
        const isFailure = failed && index === 2;
        const isCurrent = status === 'PROCESSING' && index === 1;
        const leftOn = index > 0 && index <= reached;
        const rightOn = index < reached;
        return (
          <li key={label} className="flex flex-col items-center gap-1.5">
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 rounded-full ${index === 0 ? 'bg-transparent' : leftOn ? 'bg-primary' : 'bg-border'}`} />
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#ffffff] ${
                  isFailure
                    ? 'bg-danger'
                    : isDone
                      ? 'bg-primary'
                      : 'border border-border-strong bg-surface-muted'
                } ${isCurrent ? 'ring-4 ring-primary/20' : ''}`}
              >
                {isFailure ? (
                  <IconX size={13} stroke={3} />
                ) : isCurrent ? (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#ffffff]" />
                ) : isDone ? (
                  <IconCheck size={13} stroke={3} />
                ) : null}
              </span>
              <span
                className={`h-0.5 flex-1 rounded-full ${index === labels.length - 1 ? 'bg-transparent' : rightOn ? 'bg-primary' : 'bg-border'}`}
              />
            </div>
            <span className={`text-[11px] font-medium ${isFailure ? 'text-danger' : isDone ? 'text-text-primary' : 'text-text-muted'}`}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

type ActionMode = 'idle' | 'confirmPaid' | 'fail';

function PayoutCard({ payout }: { payout: PayoutListItem }) {
  const markProcessing = useMarkPayoutProcessing();
  const markPaid = useMarkPayoutPaid();
  const markFailed = useMarkPayoutFailed();
  const [mode, setMode] = useState<ActionMode>('idle');
  const [failReason, setFailReason] = useState('');
  // Un retrait qui attend une décision s'affiche déplié ; l'historique (payé, échec, annulé) reste replié.
  const [open, setOpen] = useState(payout.status === 'REQUESTED' || payout.status === 'PROCESSING');

  const driverName = payout.wallet?.driver ? `${payout.wallet.driver.firstName} ${payout.wallet.driver.lastName}` : null;
  const amount = formatMoney(payout.amount);
  const mutationError = markProcessing.error ?? markPaid.error ?? markFailed.error;
  const style = STATUS_STYLE[payout.status];
  const requestedAt = formatRequestedAt(payout.requestedAt);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-surface p-3.5 pl-5 shadow-[0_8px_24px_-12px_rgba(8,58,99,0.28)] ring-1 ring-border/70">
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${style.bar}`} />

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark text-xs font-bold text-[#ffffff] shadow-sm">
          {driverName ? initialsOf(driverName) : '?'}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-text-primary">{driverName ?? 'Conducteur inconnu'}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-secondary">
            <MethodIcon method={payout.method} />
            <span className="truncate">
              {formatMethod(payout.method)}
              {requestedAt ? ` · ${requestedAt}` : ''}
            </span>
            {payout.autoProcessed ? <IconBolt size={12} className="shrink-0 text-primary" aria-label="Traitement automatique" /> : null}
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end gap-1">
          <AmountText formatted={amount} />
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style.pill}`}>
            {PAYOUT_STATUS_LABELS[payout.status]}
          </span>
        </span>

        <IconChevronDown
          size={16}
          aria-hidden
          className={`shrink-0 text-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <MiniProgress status={payout.status} />

      {open ? (
        <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
          {/* Traité tout seul ou par l'équipe : on sait qui a décidé, et la référence permet de retrouver le virement chez le prestataire. */}
          {payout.autoProcessed || payout.externalReference ? (
            <div className="flex flex-wrap items-center gap-2">
              {payout.autoProcessed ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-3 py-1.5 text-xs font-semibold text-primary-dark">
                  <IconBolt size={13} />
                  Automatique
                </span>
              ) : null}
              {payout.externalReference ? <ReferenceChip reference={payout.externalReference} /> : null}
            </div>
          ) : null}

          {payout.status === 'FAILED' && payout.failureReason ? (
            <p className="rounded-2xl bg-danger-light/60 px-4 py-3 text-sm text-danger">Motif : {payout.failureReason}</p>
          ) : null}
          {payout.status === 'PROCESSING' && payout.autoProcessed ? (
            <p className="rounded-2xl bg-accent-light px-4 py-3 text-sm text-accent-dark">
              Envoi automatique sans réponse définitive du prestataire. Vérifiez chez lui si le virement est parti avant de marquer
              « payé » (ou de signaler un échec, qui remet le montant dans le solde du conducteur).
            </p>
          ) : null}

          <div className="rounded-2xl bg-surface-muted/70 px-3 py-3">
            <PayoutProgress status={payout.status} />
          </div>

          {payout.status === 'REQUESTED' ? (
            <Button onClick={() => markProcessing.mutate(payout.id)} loading={markProcessing.isPending}>
              Passer en traitement
            </Button>
          ) : null}

          {payout.status === 'PROCESSING' ? (
            <div className="space-y-3">
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
                <div className="space-y-3 rounded-2xl bg-success-light/60 p-4">
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
                <div className="space-y-3 rounded-2xl bg-danger-light/50 p-4">
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
        description="Demandes de retrait des conducteurs : passe-les en traitement, puis marque-les payées."
        stats={[{ value: total !== undefined ? String(total) : '…', label: status ? 'retraits avec ce statut' : 'retraits au total' }]}
      />

      <FilterChips value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="Tous" />

      {isError ? (
        <Notice tone="danger">Impossible de charger les retraits.</Notice>
      ) : isLoading ? (
        <ListSkeleton count={6} heightClass="h-20" />
      ) : payouts.length === 0 ? (
        <EmptyState
          icon={<IconWallet size={26} />}
          title="Aucun retrait"
          text={
            status
              ? 'Aucun retrait ne correspond à ce statut.'
              : 'Les demandes de retrait des conducteurs apparaîtront ici dès qu’ils en font une.'
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
          <div className="grid items-start gap-3 lg:grid-cols-2">
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