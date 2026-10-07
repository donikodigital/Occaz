// web-admin/src/app/(app)/payouts/page.tsx
//
// v7 — Mode des retraits Automatique / Manuel, et validation par l'admin.
//   - Carte « Mode des retraits » en tête : deux choix, Automatique (le retrait part tout de suite) ou Manuel (chaque retrait passe
//     « En attente de validation » ; l'admin est alerté par la cloche et par email, vérifie son compte Orange Money, puis valide).
//     Passer en Automatique demande une confirmation (c'est le sens qui laisse partir l'argent sans contrôle). Le changement est
//     réservé à qui peut modifier les paramètres de la plateforme.
//   - Un retrait en attente propose « Valider et envoyer » (envoi par le prestataire) ou, tant qu'Orange Money n'est pas branché,
//     « Valider » (l'admin fait le virement lui-même, puis « Marquer payé »), et « Refuser » (le solde est remis au conducteur).
//   - Le numéro Mobile Money du conducteur est affiché et copiable : il faut bien le connaître pour faire le virement.
//   - Les montants s'affichent dans la devise du retrait (GNF, XOF…), plus toujours en GNF.
//
// v6 — Cartes compactes et dépliables (≈ 80 px au lieu de ≈ 270 px une fois repliées).
//   - Carte repliée : avatar, nom, méthode + date, montant à droite avec sa pastille de statut, et une mini-barre de progression
//     en 3 segments. Un éclair signale un traitement automatique.
//   - Un toucher déplie la carte : référence copiable, frise détaillée, motif d'échec, actions.
//   - Les retraits qui attendent une décision (en attente de validation, En cours) s'affichent dépliés ; les autres (Payé, Échec,
//     Annulé) sont repliés, donc une longue liste d'historique reste lisible.
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
  IconInfoCircle,
  IconShieldCheck,
  IconWallet,
  IconX,
} from '@tabler/icons-react';
import { Button, TextField } from '@/components/ui';
import { EmptyState, FilterChips, ListSkeleton, Notice, PageHero, SavedNotice } from '@/components/admin/AdminUi';
import {
  useApprovePayout,
  useMarkPayoutFailed,
  useMarkPayoutPaid,
  useMarkPayoutProcessing,
  usePayoutConfig,
  usePayoutsList,
  useSetPayoutMode,
} from '@/hooks/usePayouts';
import { usePermissions } from '@/hooks/usePermissions';
import { ApiError } from '@/services/api/ApiError';
import { PAYOUT_STATUS_LABELS } from '@/utils/payoutLabels';
import { PERMISSIONS } from '@/utils/permissions';
import { formatMoney } from '@/utils/money';
import type { PayoutConfig, PayoutListItem, PayoutStatus } from '@/types/payouts.types';

const STATUS_OPTIONS = (Object.keys(PAYOUT_STATUS_LABELS) as PayoutStatus[]).map((value) => ({
  value,
  label: PAYOUT_STATUS_LABELS[value],
}));

/** Liseré de la carte et pastille de statut : une couleur par statut. */
const STATUS_STYLE: Record<PayoutStatus, { bar: string; pill: string }> = {
  REQUESTED: { bar: 'bg-accent', pill: 'bg-accent-light text-accent-dark' },
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
  const match = formatted.match(/^(.*?\d)[\s  ]*([^\d\s  .,-]+)$/);
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

/** Pastille qui copie sa valeur au toucher : la référence du virement, ou le numéro Mobile Money du conducteur. */
function CopyChip({ label, value, display, ariaLabel }: { label: string; value: string; display: string; ariaLabel: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard
      ?.writeText(value)
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
      title={value}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5 text-xs font-medium tabular-nums text-text-secondary transition hover:bg-border active:scale-95"
    >
      <span className="text-text-muted">{label}</span>
      <span className="font-semibold text-text-primary">{display}</span>
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

// ---------------------------------------------------------------------------
// Mode des retraits
// ---------------------------------------------------------------------------

function ModeOption({
  selected,
  disabled,
  icon,
  title,
  text,
  onSelect,
}: {
  selected: boolean;
  disabled: boolean;
  icon: React.ReactNode;
  title: string;
  text: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-2xl p-3.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed ${
        selected ? 'bg-primary-light/60 ring-2 ring-primary' : 'bg-surface-muted/60 ring-1 ring-border/70 hover:bg-surface-muted'
      } ${disabled && !selected ? 'opacity-60' : ''}`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          selected ? 'bg-gradient-to-br from-primary to-primary-dark text-[#ffffff] shadow-sm' : 'bg-surface text-text-secondary'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          {title}
          {selected ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#ffffff]">Actif</span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-text-secondary">{text}</span>
      </span>
    </button>
  );
}

function ModeCard({
  config,
  isLoading,
  isError,
  onShowPending,
}: {
  config: PayoutConfig | undefined;
  isLoading: boolean;
  isError: boolean;
  onShowPending: () => void;
}) {
  const { can } = usePermissions();
  const canChange = can(PERMISSIONS.SETTINGS_UPDATE);
  const setMode = useSetPayoutMode();
  const [confirmAuto, setConfirmAuto] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  if (isError) return <Notice tone="danger">Impossible de lire le mode des retraits.</Notice>;
  if (isLoading || !config) return <div className="h-44 animate-pulse rounded-3xl bg-surface-muted" aria-hidden />;

  const busy = setMode.isPending;
  const capAmount = Number(config.autoMaxAmount);
  const error = setMode.error;

  function apply(autoEnabled: boolean) {
    setSaved(null);
    setMode.mutate(autoEnabled, {
      onSuccess: () => {
        setConfirmAuto(false);
        setSaved(
          autoEnabled
            ? 'Mode Automatique activé : les prochains retraits partent tout de suite.'
            : 'Mode Manuel activé : les prochains retraits attendront ta validation.',
        );
      },
    });
  }

  return (
    <section className="space-y-3 rounded-3xl bg-surface p-4 shadow-[0_8px_24px_-12px_rgba(8,58,99,0.28)] ring-1 ring-border/70">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text-primary">Mode des retraits</h2>
          <p className="mt-0.5 text-xs text-text-secondary">Choisis qui déclenche l’envoi de l’argent aux conducteurs.</p>
        </div>
        {config.pendingCount > 0 ? (
          <button
            type="button"
            onClick={onShowPending}
            className="shrink-0 rounded-full bg-accent-light px-3 py-1.5 text-xs font-semibold text-accent-dark transition hover:brightness-95 active:scale-95"
          >
            {config.pendingCount} à valider
          </button>
        ) : null}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <ModeOption
          selected={config.autoEnabled}
          disabled={!canChange || busy}
          icon={<IconBolt size={18} />}
          title="Automatique"
          text="Le conducteur retire son argent sans aucune intervention : le retrait part tout de suite."
          onSelect={() => {
            if (!config.autoEnabled) {
              setSaved(null);
              setConfirmAuto(true);
            }
          }}
        />
        <ModeOption
          selected={!config.autoEnabled}
          disabled={!canChange || busy}
          icon={<IconShieldCheck size={18} />}
          title="Manuel"
          text="Chaque retrait passe « En attente de validation ». Tu es alerté par notification et par email, tu vérifies ton solde, puis tu valides."
          onSelect={() => {
            setConfirmAuto(false);
            if (config.autoEnabled) apply(false);
          }}
        />
      </div>

      {confirmAuto ? (
        <div className="space-y-3 rounded-2xl bg-accent-light p-4">
          <p className="text-sm font-medium text-accent-dark">
            Passer en Automatique ? Les prochains retraits partiront sans que tu les valides, même si ton compte Orange Money n’a pas assez
            d’unités.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setConfirmAuto(false)}>
              Annuler
            </Button>
            <Button loading={busy} onClick={() => apply(true)}>
              Oui, passer en Automatique
            </Button>
          </div>
        </div>
      ) : null}

      {config.autoEnabled && capAmount > 0 ? (
        <p className="flex items-start gap-1.5 text-xs text-text-secondary">
          <IconInfoCircle size={14} className="mt-0.5 shrink-0" />
          Au-dessus de {formatMoney(config.autoMaxAmount, '')}, un retrait attend quand même ta validation (plafond réglable dans Paramètres).
        </p>
      ) : null}

      {config.providerSimulated ? (
        <Notice>
          Orange Money n’est pas encore branché sur le serveur : en mode Automatique, un retrait est marqué « payé » sans qu’aucun argent ne
          parte. En mode Manuel, tu valides puis tu fais le virement toi-même depuis ton compte Orange Money, avant de marquer le retrait payé.
        </Notice>
      ) : null}

      {!canChange ? <p className="text-xs text-text-muted">Seul un compte autorisé à modifier les paramètres peut changer le mode.</p> : null}
      {saved ? <SavedNotice>{saved}</SavedNotice> : null}
      {error ? <p className="text-sm text-danger">{error instanceof ApiError ? error.message : 'Une erreur est survenue.'}</p> : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Carte d'un retrait
// ---------------------------------------------------------------------------

type ActionMode = 'idle' | 'confirmApprove' | 'confirmPaid' | 'fail';

function PayoutCard({ payout, providerSimulated }: { payout: PayoutListItem; providerSimulated: boolean }) {
  const approve = useApprovePayout();
  const markProcessing = useMarkPayoutProcessing();
  const markPaid = useMarkPayoutPaid();
  const markFailed = useMarkPayoutFailed();
  const [mode, setMode] = useState<ActionMode>('idle');
  const [failReason, setFailReason] = useState('');
  // Un retrait qui attend une décision s'affiche déplié ; l'historique (payé, échec, annulé) reste replié.
  const [open, setOpen] = useState(payout.status === 'REQUESTED' || payout.status === 'PROCESSING');

  const driverName = payout.wallet?.driver ? `${payout.wallet.driver.firstName} ${payout.wallet.driver.lastName}` : null;
  const amount = formatMoney(payout.amount, payout.currency?.isoCode);
  const mutationError = approve.error ?? markProcessing.error ?? markPaid.error ?? markFailed.error;
  const style = STATUS_STYLE[payout.status];
  const requestedAt = formatRequestedAt(payout.requestedAt);
  const awaitingValidation = payout.status === 'REQUESTED';
  const canDecide = awaitingValidation || payout.status === 'PROCESSING';

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
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-tight ${style.pill}`}>
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
          {/* Traité tout seul ou par l'équipe : on sait qui a décidé ; le numéro sert à faire le virement, la référence à le retrouver. */}
          {payout.autoProcessed || payout.externalReference || payout.destinationRef ? (
            <div className="flex flex-wrap items-center gap-2">
              {payout.autoProcessed ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-3 py-1.5 text-xs font-semibold text-primary-dark">
                  <IconBolt size={13} />
                  Automatique
                </span>
              ) : null}
              {payout.destinationRef ? (
                <CopyChip
                  label="N°"
                  value={payout.destinationRef}
                  display={payout.destinationRef}
                  ariaLabel={`Copier le numéro Mobile Money ${payout.destinationRef}`}
                />
              ) : null}
              {payout.externalReference ? (
                <CopyChip
                  label="Réf."
                  value={payout.externalReference}
                  display={shortReference(payout.externalReference)}
                  ariaLabel={`Copier la référence complète ${payout.externalReference}`}
                />
              ) : null}
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

          {awaitingValidation && mode === 'idle' ? (
            <div className="space-y-3">
              <p className="flex items-start gap-1.5 rounded-2xl bg-accent-light px-4 py-3 text-sm text-accent-dark">
                <IconInfoCircle size={16} className="mt-0.5 shrink-0" />
                <span>
                  Avant de valider, vérifie que ton compte Orange Money dispose de {amount}
                  {payout.currency ? '' : ' (devise à confirmer)'}. Si besoin, fais d’abord ton change entre GNF et XOF.
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {providerSimulated ? (
                  <Button loading={markProcessing.isPending} onClick={() => markProcessing.mutate(payout.id)}>
                    Valider (je fais le virement)
                  </Button>
                ) : (
                  <Button onClick={() => setMode('confirmApprove')}>Valider et envoyer</Button>
                )}
                <button
                  type="button"
                  onClick={() => setMode('fail')}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-danger transition hover:bg-danger-light/40"
                >
                  Refuser
                </button>
              </div>
            </div>
          ) : null}

          {payout.status === 'PROCESSING' && mode === 'idle' ? (
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

          {canDecide && mode === 'confirmApprove' ? (
            <div className="space-y-3 rounded-2xl bg-primary-light/60 p-4">
              <p className="text-sm font-medium text-primary-dark">
                Envoyer {amount}
                {driverName ? ` à ${driverName}` : ''}
                {payout.destinationRef ? ` (${payout.destinationRef})` : ''} maintenant ?
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => setMode('idle')}>
                  Annuler
                </Button>
                <Button loading={approve.isPending} onClick={() => approve.mutate(payout.id, { onSuccess: () => setMode('idle') })}>
                  Oui, valider et envoyer
                </Button>
              </div>
            </div>
          ) : null}

          {canDecide && mode === 'confirmPaid' ? (
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

          {canDecide && mode === 'fail' ? (
            <div className="space-y-3 rounded-2xl bg-danger-light/50 p-4">
              <TextField
                label={awaitingValidation ? 'Motif du refus' : 'Motif de l\'échec'}
                value={failReason}
                onChange={(e) => setFailReason(e.target.value)}
                placeholder="Ex : numéro Mobile Money invalide"
              />
              <p className="text-xs text-text-secondary">Le montant est remis dans le solde du conducteur, qui est prévenu avec ce motif.</p>
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
                  {awaitingValidation ? 'Confirmer le refus' : 'Confirmer l’échec'}
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
  const config = usePayoutConfig();

  const payouts = data?.data ?? [];
  const total = data?.meta.total;
  const isTruncated = total !== undefined && payouts.length < total;
  // Tant que la configuration n'est pas lue, on suppose « simulé » : jamais un bouton d'envoi réel proposé par erreur.
  const providerSimulated = config.data?.providerSimulated ?? true;

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Finance"
        title="Retraits"
        description="Choisis si les retraits des conducteurs partent tout seuls ou attendent ta validation, et traite ceux qui attendent."
        stats={[
          { value: total !== undefined ? String(total) : '…', label: status ? 'retraits avec ce statut' : 'retraits au total' },
          ...(config.data ? [{ value: String(config.data.pendingCount), label: 'à valider' }] : []),
        ]}
      />

      <ModeCard
        config={config.data}
        isLoading={config.isLoading}
        isError={config.isError}
        onShowPending={() => setStatus('REQUESTED')}
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
              <PayoutCard key={payout.id} payout={payout} providerSimulated={providerSimulated} />
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
