// web-admin/src/app/(app)/platform-wallet/page.tsx
// [25/10/2026] v4 — Motifs de dépense sur les retraits (Salaire, Primes, Fonctionnement, Frais de voyage, Fournitures, Équipements de bureau,
// Autres) : la fenêtre de retrait demande ce que le motif exige et produit une pièce PDF (bulletin de paie, reçu de prime, facture d'achat,
// note de frais, justificatif), téléchargeable depuis chaque retrait de l'historique ; filtre par motif. Voir aussi la page Comptabilité.
// [23/10/2026] v3 — fenêtre de retrait : le numéro n'était plus visible dans la liste « Envoyer à » (texte coupé) ; la liste ne montre plus
// que le numéro puis le nom, et une carte sous la liste affiche le bénéficiaire choisi en entier (nom, type, numéro complet).
// [19/10/2026] Retrait en 2 étapes : le code à 6 chiffres reçu par e-mail remplace le mot de passe (POST withdrawals/code puis withdrawals).
//
// Portefeuille de la plateforme : les commissions encaissées (XOF et GNF) et leur retrait vers des numéros Orange Money enregistrés
// — le propriétaire, le support, le service client… Le solde vient du registre des commissions (il n'est pas saisi à la main).
//  - Une carte par devise : disponible à retirer, gagné, en attente (course non terminée), déjà retiré, en cours.
//  - Un retrait demande le mot de passe du compte connecté et ne part que vers un bénéficiaire enregistré.
//  - Tant qu'Orange Money n'est pas branché sur le serveur, le retrait est réservé « en cours » : on fait le virement depuis le compte
//    marchand, puis « Marquer payé ».
// Cartes ombrées uniquement, jamais de tableau.
// v2 — Page réorganisée : soldes compacts avec barre de répartition, puis deux onglets (Historique / Bénéficiaires) au lieu d'une longue
// page ; cartes de bénéficiaires et de retraits sur une seule ligne dense, en grille (1, 2 ou 3 colonnes selon la largeur).

'use client';

import React, { useMemo, useState } from 'react';
import {
  IconArrowUpRight,
  IconBriefcase,
  IconCheck,
  IconCopy,
  IconCrown,
  IconHeadset,
  IconHistory,
  IconPencil,
  IconPlus,
  IconPower,
  IconUser,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { Button, IconActionButton, Modal, Select, TextArea, TextField } from '@/components/ui';
import { DocumentButton, ExpenseIcon, StatusPill } from '@/components/platformWallet/ExpenseParts';
import { ExpenseMotifForm } from '@/components/platformWallet/ExpenseMotifForm';
import {
  CardShell,
  Chip,
  EmptyState,
  FilterChips,
  FormError,
  IconTile,
  ListSkeleton,
  Notice,
  PageHero,
  SavedNotice,
  Tabs,
  type Tone,
} from '@/components/admin/AdminUi';
import { useAccountingStaff } from '@/hooks/useAccounting';
import {
  useCreateBeneficiary,
  useMarkWithdrawalFailed,
  useMarkWithdrawalPaid,
  usePayslipPreview,
  useRequestWithdrawalCode,
  usePlatformBeneficiaries,
  usePlatformWallet,
  usePlatformWithdrawals,
  useUpdateBeneficiary,
  useWithdrawCommissions,
} from '@/hooks/usePlatformWallet';
import { usePermissions } from '@/hooks/usePermissions';
import { ApiError } from '@/services/api/ApiError';
import { PERMISSIONS } from '@/utils/permissions';
import { formatMoney } from '@/utils/money';
import { EXPENSE_CATEGORY_INFO, EXPENSE_CATEGORY_ORDER, expenseLabel, periodLabel } from '@/utils/expenseCategories';
import { amountMode, draftIssue, draftToInput, emptyMotifDraft, fixedAmount, type MotifDraft } from '@/utils/motifDraft';
import type {
  BeneficiaryKind,
  CurrencyBalance,
  ExpenseCategory,
  PlatformBeneficiary,
  PlatformWithdrawal,
  PlatformWithdrawalStatus,
} from '@/types/platform-wallet.types';

const KIND_LABELS: Record<BeneficiaryKind, string> = {
  OWNER: 'Propriétaire',
  SUPPORT: 'Support',
  STAFF: 'Équipe',
  OTHER: 'Autre',
};

const KIND_ICONS: Record<BeneficiaryKind, React.ReactNode> = {
  OWNER: <IconCrown size={20} />,
  SUPPORT: <IconHeadset size={20} />,
  STAFF: <IconUsers size={20} />,
  OTHER: <IconUser size={20} />,
};

const KIND_TONES: Record<BeneficiaryKind, Tone> = { OWNER: 'accent', SUPPORT: 'primary', STAFF: 'success', OTHER: 'neutral' };

const STATUS_LABELS: Record<PlatformWithdrawalStatus, string> = { PROCESSING: 'En cours', PAID: 'Payé', FAILED: 'Échoué' };
const STATUS_TONES: Record<PlatformWithdrawalStatus, Tone> = { PROCESSING: 'primary', PAID: 'success', FAILED: 'danger' };

function errorText(error: unknown): string | undefined {
  if (!error) return undefined;
  return error instanceof ApiError ? error.message : 'Une erreur est survenue.';
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

// ---------------------------------------------------------------------------
// Soldes
// ---------------------------------------------------------------------------

function MiniStat({ label, value, iso, dot, muted }: { label: string; value: string; iso: string; dot?: string; muted?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-muted/70 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary">
        {dot ? <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dot}`} /> : null}
        <span className="truncate">{label}</span>
      </p>
      <p className={`mt-0.5 truncate text-sm tabular-nums ${muted ? 'text-text-muted' : 'font-semibold text-text-primary'}`}>{formatMoney(value, iso)}</p>
    </div>
  );
}

/** Répartition des commissions gagnées : encore disponible / en cours d'envoi / déjà retiré. */
function SplitBar({ balance }: { balance: CurrencyBalance }) {
  const earned = Number(balance.earned);
  if (!(earned > 0)) return <div aria-hidden className="h-2 rounded-full bg-border/60" />;
  const pct = (value: string) => Math.max(0, Math.min(100, (Number(value) / earned) * 100));
  return (
    <div aria-hidden className="flex h-2 overflow-hidden rounded-full bg-border/60">
      <span className="bg-success" style={{ width: `${pct(balance.available)}%` }} />
      <span className="bg-primary" style={{ width: `${pct(balance.inProgress)}%` }} />
      <span className="bg-border-strong" style={{ width: `${pct(balance.withdrawn)}%` }} />
    </div>
  );
}

function BalanceCard({ balance, canWithdraw, onWithdraw }: { balance: CurrencyBalance; canWithdraw: boolean; onWithdraw: () => void }) {
  const available = BigInt(balance.available);
  return (
    <CardShell tone={available > 0n ? 'success' : 'neutral'} className="p-4 pl-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-text-secondary">Disponible à retirer</p>
          <p className="mt-1 truncate text-2xl font-bold leading-none tabular-nums text-text-primary sm:text-3xl">
            {new Intl.NumberFormat('fr-FR').format(Number(balance.available))}
            <span className="ml-1.5 text-sm font-semibold text-text-muted">{balance.isoCode}</span>
          </p>
        </div>
        {canWithdraw ? (
          <Button className="shrink-0 !px-3 !py-2 !text-xs sm:!text-sm" disabled={available <= 0n} onClick={onWithdraw}>
            <IconArrowUpRight size={15} />
            Retirer
          </Button>
        ) : (
          <Chip tone="primary">{balance.isoCode}</Chip>
        )}
      </div>

      <div className="mt-3.5">
        <SplitBar balance={balance} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniStat label="Gagnées" value={balance.earned} iso={balance.isoCode} />
        <MiniStat label="Déjà retiré" value={balance.withdrawn} iso={balance.isoCode} dot="bg-border-strong" />
        <MiniStat label="En cours" value={balance.inProgress} iso={balance.isoCode} dot="bg-primary" />
        <MiniStat label="En attente" value={balance.pending} iso={balance.isoCode} muted />
      </div>
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// Bénéficiaires
// ---------------------------------------------------------------------------

function BeneficiaryCard({
  beneficiary,
  canManage,
  onEdit,
}: {
  beneficiary: PlatformBeneficiary;
  canManage: boolean;
  onEdit: () => void;
}) {
  const update = useUpdateBeneficiary();
  const [copied, setCopied] = useState(false);
  const tone = beneficiary.isActive ? KIND_TONES[beneficiary.kind] : 'neutral';

  function copy() {
    navigator.clipboard
      ?.writeText(beneficiary.phone)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => undefined);
  }

  return (
    <CardShell tone={tone} muted={!beneficiary.isActive} className="py-3 pl-5 pr-3">
      <div className="flex items-center gap-3">
        <IconTile tone={KIND_TONES[beneficiary.kind]}>{KIND_ICONS[beneficiary.kind]}</IconTile>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-text-primary">{beneficiary.label}</p>
          <p className="truncate text-xs text-text-secondary">
            {beneficiary.holderName} · {KIND_LABELS[beneficiary.kind]}
            {!beneficiary.isActive ? ' · désactivé' : ''}
          </p>
        </div>
        {canManage ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <IconActionButton icon={IconPencil} label="Modifier" onClick={onEdit} />
            <IconActionButton
              icon={IconPower}
              label={beneficiary.isActive ? 'Désactiver' : 'Réactiver'}
              tone={beneficiary.isActive ? 'danger' : 'success'}
              loading={update.isPending}
              onClick={() => update.mutate({ id: beneficiary.id, isActive: !beneficiary.isActive })}
            />
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={copy}
        title="Copier le numéro"
        className="mt-2.5 inline-flex max-w-full items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-xs font-medium tabular-nums text-text-secondary transition hover:bg-border active:scale-95"
      >
        <span className="shrink-0 text-text-muted">Orange Money</span>
        <span className="truncate font-semibold text-text-primary">{beneficiary.phone}</span>
        {copied ? <IconCheck size={13} className="shrink-0 text-success-dark" /> : <IconCopy size={13} className="shrink-0 text-text-muted" />}
      </button>
      {update.error ? <p className="mt-1.5 text-xs text-danger">{errorText(update.error)}</p> : null}
    </CardShell>
  );
}

function BeneficiaryModal({
  open,
  beneficiary,
  onClose,
  onSaved,
}: {
  open: boolean;
  beneficiary: PlatformBeneficiary | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const create = useCreateBeneficiary();
  const update = useUpdateBeneficiary();
  const [label, setLabel] = useState(beneficiary?.label ?? '');
  const [holderName, setHolderName] = useState(beneficiary?.holderName ?? '');
  const [kind, setKind] = useState<BeneficiaryKind>(beneficiary?.kind ?? 'OWNER');
  const [phone, setPhone] = useState(beneficiary?.phone ?? '+224');

  const busy = create.isPending || update.isPending;
  const error = errorText(create.error ?? update.error);
  const phoneValid = /^\+\d{8,15}$/.test(phone.replace(/[\s.-]/g, ''));
  const valid = label.trim().length >= 2 && holderName.trim().length >= 2 && phoneValid;

  function submit() {
    const input = { label: label.trim(), holderName: holderName.trim(), kind, phone: phone.replace(/[\s.-]/g, '') };
    if (beneficiary) {
      update.mutate(
        { id: beneficiary.id, ...input },
        {
          onSuccess: () => {
            onSaved('Bénéficiaire mis à jour.');
            onClose();
          },
        },
      );
    } else {
      create.mutate(input, {
        onSuccess: () => {
          onSaved('Bénéficiaire ajouté : tu peux maintenant lui envoyer de l’argent.');
          onClose();
        },
      });
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={beneficiary ? 'Modifier le bénéficiaire' : 'Ajouter un bénéficiaire'}
      description="Un retrait ne part que vers un numéro enregistré ici."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button loading={busy} disabled={!valid} onClick={submit}>
            {beneficiary ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Select label="Qui est-ce ?" value={kind} onChange={(event) => setKind(event.target.value as BeneficiaryKind)}>
          {(Object.keys(KIND_LABELS) as BeneficiaryKind[]).map((value) => (
            <option key={value} value={value}>
              {KIND_LABELS[value]}
            </option>
          ))}
        </Select>
        <TextField label="Nom du compte" placeholder="Mon Orange Money, Awa — Service client…" value={label} onChange={(event) => setLabel(event.target.value)} />
        <TextField label="Nom de la personne" placeholder="Nom et prénom" value={holderName} onChange={(event) => setHolderName(event.target.value)} />
        <TextField
          label="Numéro Orange Money"
          inputMode="tel"
          placeholder="+224620004417"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          error={phone.length > 4 && !phoneValid ? 'Format international, par exemple +224620004417.' : undefined}
          hint="Avec l’indicatif du pays : +224 (Guinée), +225 (Côte d’Ivoire), +221 (Sénégal), +223 (Mali)…"
        />
        <FormError message={error} />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Retrait
// ---------------------------------------------------------------------------

function WithdrawModal({
  balance,
  beneficiaries,
  manualTransfer,
  onClose,
  onDone,
}: {
  balance: CurrencyBalance;
  beneficiaries: PlatformBeneficiary[];
  manualTransfer: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const requestCode = useRequestWithdrawalCode();
  const withdraw = useWithdrawCommissions();
  const staff = useAccountingStaff();
  const active = useMemo(() => beneficiaries.filter((item) => item.isActive), [beneficiaries]);
  const [beneficiaryId, setBeneficiaryId] = useState(active.find((item) => item.kind === 'OWNER')?.id ?? active[0]?.id ?? '');
  const [draft, setDraft] = useState<MotifDraft>(emptyMotifDraft);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  // Étape 2 : null tant que le code n'a pas été envoyé par e-mail.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');

  // Bulletin de la personne pour le mois choisi (motif « Salaire ») : son net à payer devient le montant.
  const preview = usePayslipPreview(draft.category === 'SALARY' ? draft.staffUserId : '', draft.periodMonth);

  const selected = active.find((item) => item.id === beneficiaryId);
  const available = BigInt(balance.available);
  const mode = amountMode(draft);
  const fixed = fixedAmount(draft, preview.data);
  const typed = mode === 'manual' ? (amount ? BigInt(amount) : 0n) : (fixed ?? 0n);
  const finalAmount = typed.toString();
  const tooMuch = typed > available;
  const wrongCurrency = draft.category === 'SALARY' && !!preview.data && preview.data.currencyId !== balance.currencyId;
  const issue = draftIssue(draft, preview.data);
  const formValid = !!selected && typed > 0n && !tooMuch && !issue && !wrongCurrency;
  const codeValid = /^\d{6}$/.test(code);
  const motifText = expenseLabel(draft.category, draft.categoryLabel);

  function sendCode() {
    if (!selected) return;
    requestCode.mutate(
      { beneficiaryId: selected.id, currencyId: balance.currencyId, amount: finalAmount, ...draftToInput(draft) },
      {
        onSuccess: (result) => {
          setSentTo(result.sentTo);
          setCode('');
        },
      },
    );
  }

  function submit() {
    if (!selected) return;
    withdraw.mutate(
      { beneficiaryId: selected.id, currencyId: balance.currencyId, amount: finalAmount, note: note.trim() || undefined, code, ...draftToInput(draft) },
      {
        onSuccess: (result) => {
          const text = formatMoney(result.amount, balance.isoCode);
          const piece = result.documentNumber ? ` La pièce ${result.documentNumber} est téléchargeable en PDF dans l’historique.` : '';
          onDone(
            (result.status === 'PAID'
              ? `${text} envoyés à ${selected.label}.`
              : manualTransfer
                ? `${text} réservés pour ${selected.label}. Fais maintenant le virement depuis ton compte marchand Orange Money, puis clique sur « Marquer payé ».`
                : `${text} en cours d’envoi vers ${selected.label}.`) + piece,
          );
          onClose();
        },
      },
    );
  }

  /** Revenir à l'étape 1 pour changer le montant ou le bénéficiaire : le code envoyé ne vaut que pour la demande d'origine. */
  function backToForm() {
    setSentTo(null);
    setCode('');
    withdraw.reset();
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={`Retirer des commissions en ${balance.isoCode}`}
      description={`Disponible : ${formatMoney(balance.available, balance.isoCode)}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={sentTo ? backToForm : onClose}>
            {sentTo ? 'Modifier' : 'Annuler'}
          </Button>
          {sentTo ? (
            <Button loading={withdraw.isPending} disabled={!codeValid} onClick={submit}>
              {manualTransfer ? 'Réserver le retrait' : 'Envoyer'}
            </Button>
          ) : (
            <Button loading={requestCode.isPending} disabled={!formValid} onClick={sendCode}>
              Recevoir le code par e-mail
            </Button>
          )}
        </div>
      }
    >
      {active.length === 0 ? (
        <Notice>Ajoute d’abord un bénéficiaire (ton numéro Orange Money, par exemple) pour pouvoir retirer.</Notice>
      ) : sentTo && selected ? (
        <div className="space-y-4">
          <Notice>
            Un code à 6 chiffres vient d’être envoyé à {sentTo}. Il est valable 10 minutes et ne sert que pour ce retrait de{' '}
            {formatMoney(finalAmount, balance.isoCode)} vers {selected.label} ({motifText}).
          </Notice>
          <TextField
            label="Code reçu par e-mail"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(event) => setCode(digitsOnly(event.target.value).slice(0, 6))}
          />
          <button
            type="button"
            disabled={requestCode.isPending}
            onClick={sendCode}
            className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
          >
            {requestCode.isPending ? 'Envoi…' : 'Renvoyer le code'}
          </button>
          <FormError message={errorText(withdraw.error) ?? errorText(requestCode.error)} />
        </div>
      ) : (
        <div className="space-y-4">
          {manualTransfer ? (
            <Notice>
              Orange Money n’est pas encore branché sur le serveur : le montant est réservé, puis tu fais le virement depuis ton compte marchand et tu
              cliques sur « Marquer payé ».
            </Notice>
          ) : null}

          <ExpenseMotifForm
            draft={draft}
            onChange={setDraft}
            currencyId={balance.currencyId}
            isoCode={balance.isoCode}
            staff={staff.data}
            staffLoading={staff.isLoading}
            preview={{ data: preview.data, isLoading: preview.isLoading, error: preview.error }}
          />

          {/* Montant : saisi à la main, ou imposé par le motif (net du bulletin, total des lignes). */}
          {mode === 'manual' ? (
            <div>
              <TextField
                label={`Montant (${balance.isoCode})`}
                inputMode="numeric"
                placeholder="0"
                value={amount ? new Intl.NumberFormat('fr-FR').format(Number(amount)) : ''}
                onChange={(event) => setAmount(digitsOnly(event.target.value).replace(/^0+/, ''))}
                error={tooMuch ? `Maximum : ${formatMoney(balance.available, balance.isoCode)}` : undefined}
              />
              <button
                type="button"
                onClick={() => setAmount(balance.available === '0' ? '' : balance.available)}
                className="mt-1.5 text-xs font-semibold text-primary hover:underline"
              >
                Tout retirer ({formatMoney(balance.available, balance.isoCode)})
              </button>
            </div>
          ) : (
            <div className="rounded-xl bg-surface-muted px-3.5 py-3 shadow-sm">
              <p className="text-xs font-medium text-text-secondary">
                Montant du retrait · {mode === 'salary' ? 'net à payer du bulletin' : 'total des lignes'}
              </p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-text-primary">{typed > 0n ? formatMoney(finalAmount, balance.isoCode) : '—'}</p>
              {tooMuch ? <p className="mt-1 text-xs text-danger">Maximum disponible : {formatMoney(balance.available, balance.isoCode)}</p> : null}
              {wrongCurrency && preview.data ? <p className="mt-1 text-xs text-danger">Ce salaire est en {preview.data.isoCode} : ouvre le retrait de cette devise.</p> : null}
            </div>
          )}

          <Select label="Envoyer à" value={beneficiaryId} onChange={(event) => setBeneficiaryId(event.target.value)}>
            {active.map((item) => (
              <option key={item.id} value={item.id}>
                {item.phone} · {item.label}
              </option>
            ))}
          </Select>
          {selected ? (
            <div className="-mt-2 rounded-xl bg-surface-muted px-3.5 py-2.5 text-sm shadow-sm">
              <p className="break-words font-semibold text-text-primary">{selected.label}</p>
              <p className="mt-0.5 break-words text-xs text-text-secondary">
                {selected.holderName} · {KIND_LABELS[selected.kind]}
              </p>
              <p className="mt-1 break-all text-sm font-semibold tabular-nums text-text-primary">{selected.phone}</p>
            </div>
          ) : null}
          <TextArea label="Note (facultative)" rows={2} placeholder="Une précision pour le journal…" value={note} onChange={(event) => setNote(event.target.value)} />
          {issue && !(draft.category === 'SALARY' && preview.isLoading) ? <p className="text-xs text-text-muted">À compléter : {issue}</p> : null}
          <FormError message={errorText(requestCode.error)} />
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Historique
// ---------------------------------------------------------------------------

function WithdrawalCard({ withdrawal, canManage }: { withdrawal: PlatformWithdrawal; canManage: boolean }) {
  const markPaid = useMarkWithdrawalPaid();
  const markFailed = useMarkWithdrawalFailed();
  const [mode, setMode] = useState<'paid' | 'failed' | null>(null);
  const [value, setValue] = useState('');

  const open = withdrawal.status === 'PROCESSING';
  const busy = markPaid.isPending || markFailed.isPending;
  const error = errorText(markPaid.error ?? markFailed.error);

  function confirm() {
    if (mode === 'paid') {
      markPaid.mutate({ id: withdrawal.id, externalReference: value.trim() || undefined }, { onSuccess: () => setMode(null) });
    } else if (mode === 'failed') {
      markFailed.mutate({ id: withdrawal.id, reason: value.trim() }, { onSuccess: () => setMode(null) });
    }
  }

  return (
    <CardShell tone={STATUS_TONES[withdrawal.status]} className="py-3 pl-5 pr-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <ExpenseIcon category={withdrawal.category} />
          <div className="min-w-0">
            <p className="text-base font-bold leading-tight tabular-nums text-text-primary">{formatMoney(withdrawal.amount, withdrawal.currency.isoCode)}</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-text-primary">
              {expenseLabel(withdrawal.category, withdrawal.categoryLabel)}
              {withdrawal.periodMonth ? ` · ${periodLabel(withdrawal.periodMonth)}` : ''}
            </p>
            {withdrawal.subject ? <p className="truncate text-xs text-text-secondary">{withdrawal.subject}</p> : null}
          </div>
        </div>
        <StatusPill status={withdrawal.status} />
      </div>
      <p className="mt-1.5 truncate text-sm text-text-secondary">
        vers <span className="font-medium text-text-primary">{withdrawal.beneficiary.label}</span>
        {withdrawal.documentNumber ? <span className="text-text-muted"> · pièce {withdrawal.documentNumber}</span> : null}
      </p>

      <p className="mt-1.5 break-words text-xs leading-relaxed text-text-muted">
        {formatDate(withdrawal.requestedAt)} · {withdrawal.destinationRef}
        {withdrawal.requestedBy?.email ? ` · par ${withdrawal.requestedBy.email}` : ''}
        {withdrawal.externalReference ? ` · réf. ${withdrawal.externalReference}` : ''}
      </p>
      {withdrawal.note ? <p className="mt-1.5 text-sm text-text-secondary">{withdrawal.note}</p> : null}
      {withdrawal.status === 'FAILED' && withdrawal.failureReason ? (
        <p className="mt-1.5 text-sm text-danger-dark">Motif : {withdrawal.failureReason}</p>
      ) : null}

      {withdrawal.hasDocument ? (
        <div className="mt-2.5 flex justify-end">
          <DocumentButton withdrawal={withdrawal} canManage={canManage} />
        </div>
      ) : null}

      {open && canManage ? (
        <div className="mt-2.5 space-y-2">
          {mode ? (
            <div className="space-y-2 rounded-2xl bg-surface-muted/70 p-2.5">
              <TextField
                aria-label={mode === 'paid' ? 'Référence Orange Money' : 'Motif de l’échec'}
                placeholder={mode === 'paid' ? 'Référence du reçu Orange Money (facultatif)' : 'Pourquoi le virement n’est pas passé ?'}
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" className="!px-3 !py-1.5 !text-xs" onClick={() => setMode(null)}>
                  Annuler
                </Button>
                <Button
                  variant={mode === 'paid' ? 'success' : 'danger'}
                  className="!px-3 !py-1.5 !text-xs"
                  loading={busy}
                  disabled={mode === 'failed' && value.trim().length < 3}
                  onClick={confirm}
                >
                  {mode === 'paid' ? 'Confirmer : payé' : 'Confirmer : échoué'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                className="!px-3 !py-1.5 !text-xs"
                onClick={() => {
                  setValue('');
                  setMode('failed');
                }}
              >
                <IconX size={14} />
                Échoué
              </Button>
              <Button
                variant="success"
                className="!px-3 !py-1.5 !text-xs"
                onClick={() => {
                  setValue(withdrawal.externalReference ?? '');
                  setMode('paid');
                }}
              >
                <IconCheck size={14} />
                Marquer payé
              </Button>
            </div>
          )}
          {error ? <p className="text-xs text-danger">{error}</p> : null}
        </div>
      ) : null}
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type PageTab = 'history' | 'beneficiaries';

export default function PlatformWalletPage() {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.PLATFORM_WALLET_MANAGE);

  const overview = usePlatformWallet();
  const beneficiaries = usePlatformBeneficiaries();
  const [tab, setTab] = useState<PageTab>('history');
  const [status, setStatus] = useState<PlatformWithdrawalStatus | ''>('');
  const [category, setCategory] = useState<ExpenseCategory | ''>('');
  const [page, setPage] = useState(1);
  const withdrawals = usePlatformWithdrawals({ page, status: status || undefined, category: category || undefined });

  const [withdrawing, setWithdrawing] = useState<CurrencyBalance | null>(null);
  const [editing, setEditing] = useState<PlatformBeneficiary | null>(null);
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const data = overview.data;
  const stats = [
    ...(data?.balances ?? []).slice(0, 2).map((balance) => ({ value: formatMoney(balance.available, ''), label: `Disponible ${balance.isoCode}` })),
    { value: String(data?.inProgressCount ?? 0), label: 'Retraits en cours' },
  ];
  const activeBeneficiaries = (beneficiaries.data ?? []).filter((item) => item.isActive).length;

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHero
        eyebrow="Finance"
        title="Portefeuille plateforme"
        description="Les commissions d’Occa’Z en XOF et en GNF, et leur retrait vers ton Orange Money ou celui de l’équipe."
        stats={stats}
      />

      {saved ? <SavedNotice>{saved}</SavedNotice> : null}

      {data?.manualTransfer ? (
        <Notice>
          Orange Money n’est pas encore branché : un retrait réserve le montant, tu fais ensuite le virement depuis ton compte marchand, puis tu
          cliques sur « Marquer payé ».
        </Notice>
      ) : data?.providerSimulated ? (
        <Notice>Mode simulation : les retraits sont enregistrés mais aucun vrai virement ne part.</Notice>
      ) : null}

      {overview.isError ? <Notice tone="danger">Impossible de lire le portefeuille. {errorText(overview.error)}</Notice> : null}

      {/* Soldes */}
      {overview.isLoading ? (
        <ListSkeleton count={2} heightClass="h-52" gridClass="md:grid-cols-2" />
      ) : data ? (
        <div className="grid gap-3 md:grid-cols-2">
          {data.balances.map((balance) => (
            <BalanceCard key={balance.currencyId} balance={balance} canWithdraw={canManage} onWithdraw={() => setWithdrawing(balance)} />
          ))}
        </div>
      ) : null}
      {data ? (
        <details className="group rounded-2xl bg-surface-muted/60 px-4 py-2.5 text-xs leading-relaxed text-text-secondary">
          <summary className="cursor-pointer list-none font-medium text-text-primary marker:hidden">
            Comment lire ces montants ?
            <span className="ml-1 text-text-muted group-open:hidden">(afficher)</span>
          </summary>
          <p className="mt-1.5">
            Seules les commissions des courses et envois <span className="font-medium text-text-primary">terminés</span> sont retirables. Le tableau
            de bord compte toutes les commissions confirmées d’une période, y compris celles encore « en attente » ici : les deux totaux ne
            coïncident donc qu’une fois les courses terminées. Chaque commission est comptée dans la devise payée par le client.
          </p>
          <p className="mt-1.5">
            <span className="font-medium text-text-primary">La barre</span> montre les commissions gagnées : en vert ce qui reste à retirer, en bleu ce
            qui est en cours d’envoi, en gris ce qui est déjà retiré.
          </p>
        </details>
      ) : null}

      {/* Historique / Bénéficiaires */}
      <Tabs<PageTab>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'history', label: 'Historique', icon: <IconHistory size={16} />, count: data?.inProgressCount ? data.inProgressCount : undefined },
          { value: 'beneficiaries', label: 'Bénéficiaires', icon: <IconUsers size={16} />, count: beneficiaries.data ? activeBeneficiaries : undefined },
        ]}
      />

      {tab === 'history' ? (
        <section className="space-y-3">
          <FilterChips
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            allLabel="Tous"
            options={(Object.keys(STATUS_LABELS) as PlatformWithdrawalStatus[]).map((value) => ({ value, label: STATUS_LABELS[value] }))}
          />
          <FilterChips
            value={category}
            onChange={(value) => {
              setCategory(value);
              setPage(1);
            }}
            allLabel="Tous les motifs"
            options={EXPENSE_CATEGORY_ORDER.map((value) => ({ value, label: EXPENSE_CATEGORY_INFO[value].label }))}
          />
          {withdrawals.isLoading ? (
            <ListSkeleton count={3} heightClass="h-24" gridClass="lg:grid-cols-2" />
          ) : withdrawals.isError ? (
            <Notice tone="danger">Impossible de lire l’historique. {errorText(withdrawals.error)}</Notice>
          ) : (withdrawals.data?.data ?? []).length === 0 ? (
            <EmptyState
              icon={<IconArrowUpRight size={26} />}
              title="Aucun retrait pour le moment"
              text="Dès que tu retireras des commissions, elles apparaîtront ici avec leur statut. Chaque retrait est aussi inscrit dans le journal d’audit."
            />
          ) : (
            <>
              <div className="grid items-start gap-2.5 lg:grid-cols-2">
                {(withdrawals.data?.data ?? []).map((withdrawal) => (
                  <WithdrawalCard key={withdrawal.id} withdrawal={withdrawal} canManage={canManage} />
                ))}
              </div>
              {withdrawals.data && withdrawals.data.meta.totalPages > 1 ? (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                    Précédent
                  </Button>
                  <span className="text-xs text-text-secondary">
                    Page {withdrawals.data.meta.page} / {withdrawals.data.meta.totalPages}
                  </span>
                  <Button variant="secondary" disabled={page >= withdrawals.data.meta.totalPages} onClick={() => setPage((current) => current + 1)}>
                    Suivant
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 text-xs text-text-secondary sm:text-sm">Les numéros Orange Money qui peuvent recevoir un retrait.</p>
            {canManage ? (
              <Button className="shrink-0 !px-3 !py-2" onClick={() => setAdding(true)}>
                <IconPlus size={16} />
                Ajouter
              </Button>
            ) : null}
          </div>
          {beneficiaries.isLoading ? (
            <ListSkeleton count={3} heightClass="h-24" gridClass="sm:grid-cols-2 xl:grid-cols-3" />
          ) : (beneficiaries.data ?? []).length === 0 ? (
            <EmptyState
              icon={<IconBriefcase size={26} />}
              title="Aucun bénéficiaire"
              text="Ajoute ton numéro Orange Money, puis ceux de l’équipe support ou du service client, pour pouvoir leur envoyer de l’argent."
              action={canManage ? <Button onClick={() => setAdding(true)}>Ajouter un bénéficiaire</Button> : undefined}
            />
          ) : (
            <div className="grid items-start gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {(beneficiaries.data ?? []).map((beneficiary) => (
                <BeneficiaryCard key={beneficiary.id} beneficiary={beneficiary} canManage={canManage} onEdit={() => setEditing(beneficiary)} />
              ))}
            </div>
          )}
        </section>
      )}

      {withdrawing ? (
        <WithdrawModal
          balance={withdrawing}
          beneficiaries={beneficiaries.data ?? []}
          manualTransfer={!!data?.manualTransfer}
          onClose={() => setWithdrawing(null)}
          onDone={setSaved}
        />
      ) : null}
      {adding ? <BeneficiaryModal open beneficiary={null} onClose={() => setAdding(false)} onSaved={setSaved} /> : null}
      {editing ? <BeneficiaryModal open beneficiary={editing} onClose={() => setEditing(null)} onSaved={setSaved} /> : null}
    </div>
  );
}