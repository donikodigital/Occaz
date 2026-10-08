// web-admin/src/app/(app)/platform-wallet/page.tsx
//
// Portefeuille de la plateforme : les commissions encaissées (XOF et GNF) et leur retrait vers des numéros Orange Money enregistrés
// — le propriétaire, le support, le service client… Le solde vient du registre des commissions (il n'est pas saisi à la main).
//  - Une carte par devise : disponible à retirer, gagné, en attente (course non terminée), déjà retiré, en cours.
//  - Un retrait demande le mot de passe du compte connecté et ne part que vers un bénéficiaire enregistré.
//  - Tant qu'Orange Money n'est pas branché sur le serveur, le retrait est réservé « en cours » : on fait le virement depuis le compte
//    marchand, puis « Marquer payé ».
// Cartes ombrées uniquement, jamais de tableau.

'use client';

import React, { useMemo, useState } from 'react';
import {
  IconArrowUpRight,
  IconBriefcase,
  IconCheck,
  IconClockHour4,
  IconCopy,
  IconCrown,
  IconHeadset,
  IconPencil,
  IconPlus,
  IconUser,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { Button, Modal, PasswordField, Select, TextArea, TextField } from '@/components/ui';
import {
  Chip,
  EmptyState,
  FilterChips,
  FormError,
  IconTile,
  ListSkeleton,
  Notice,
  PageHero,
  SavedNotice,
  CardShell,
  type Tone,
} from '@/components/admin/AdminUi';
import {
  useCreateBeneficiary,
  useMarkWithdrawalFailed,
  useMarkWithdrawalPaid,
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
import type {
  BeneficiaryKind,
  CurrencyBalance,
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
const STATUS_CHIP: Record<PlatformWithdrawalStatus, 'primary' | 'success' | 'danger'> = {
  PROCESSING: 'primary',
  PAID: 'success',
  FAILED: 'danger',
};

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

function BalanceLine({ label, value, iso, muted }: { label: string; value: string; iso: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className={`tabular-nums ${muted ? 'text-text-muted' : 'font-medium text-text-primary'}`}>{formatMoney(value, iso)}</span>
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
          <p className="mt-1 text-2xl font-bold leading-none tabular-nums text-text-primary sm:text-3xl">
            {new Intl.NumberFormat('fr-FR').format(Number(balance.available))}
            <span className="ml-1.5 text-sm font-semibold text-text-muted">{balance.isoCode}</span>
          </p>
        </div>
        <Chip tone="primary">{balance.isoCode}</Chip>
      </div>

      <div className="mt-4 space-y-1.5 border-t border-border/70 pt-3">
        <BalanceLine label="Commissions gagnées" value={balance.earned} iso={balance.isoCode} />
        <BalanceLine label="Déjà retiré" value={balance.withdrawn} iso={balance.isoCode} />
        <BalanceLine label="Retraits en cours" value={balance.inProgress} iso={balance.isoCode} />
        <BalanceLine label="En attente (courses non terminées)" value={balance.pending} iso={balance.isoCode} muted />
      </div>

      {canWithdraw ? (
        <Button className="mt-4 w-full" disabled={available <= 0n} onClick={onWithdraw}>
          <IconArrowUpRight size={16} />
          Retirer en {balance.isoCode}
        </Button>
      ) : null}
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
    <CardShell tone={beneficiary.isActive ? KIND_TONES[beneficiary.kind] : 'neutral'} muted={!beneficiary.isActive} className="p-3.5 pl-5">
      <div className="flex items-start gap-3">
        <IconTile tone={KIND_TONES[beneficiary.kind]}>{KIND_ICONS[beneficiary.kind]}</IconTile>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-text-primary">{beneficiary.label}</p>
          <p className="truncate text-sm text-text-secondary">{beneficiary.holderName}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Chip tone={KIND_TONES[beneficiary.kind] === 'neutral' ? 'neutral' : (KIND_TONES[beneficiary.kind] as 'primary' | 'success' | 'accent')}>
              {KIND_LABELS[beneficiary.kind]}
            </Chip>
            {!beneficiary.isActive ? <Chip tone="danger">Désactivé</Chip> : null}
            <button
              type="button"
              onClick={copy}
              title="Copier le numéro"
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-xs font-medium tabular-nums text-text-secondary transition hover:bg-border active:scale-95"
            >
              <span className="text-text-muted">Orange Money</span>
              <span className="font-semibold text-text-primary">{beneficiary.phone}</span>
              {copied ? <IconCheck size={13} className="text-success-dark" /> : <IconCopy size={13} className="text-text-muted" />}
            </button>
          </div>
        </div>
      </div>

      {canManage ? (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" className="!px-3 !py-1.5 !text-xs" onClick={onEdit}>
            <IconPencil size={14} />
            Modifier
          </Button>
          <Button
            variant="secondary"
            className="!px-3 !py-1.5 !text-xs"
            loading={update.isPending}
            onClick={() => update.mutate({ id: beneficiary.id, isActive: !beneficiary.isActive })}
          >
            {beneficiary.isActive ? 'Désactiver' : 'Réactiver'}
          </Button>
        </div>
      ) : null}
      {update.error ? <p className="mt-2 text-xs text-danger">{errorText(update.error)}</p> : null}
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
  const withdraw = useWithdrawCommissions();
  const active = useMemo(() => beneficiaries.filter((item) => item.isActive), [beneficiaries]);
  const [beneficiaryId, setBeneficiaryId] = useState(active.find((item) => item.kind === 'OWNER')?.id ?? active[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [password, setPassword] = useState('');

  const selected = active.find((item) => item.id === beneficiaryId);
  const available = BigInt(balance.available);
  const typed = amount ? BigInt(amount) : 0n;
  const tooMuch = typed > available;
  const valid = !!selected && typed > 0n && !tooMuch && password.length > 0;

  function submit() {
    if (!selected) return;
    withdraw.mutate(
      { beneficiaryId: selected.id, currencyId: balance.currencyId, amount, note: note.trim() || undefined, password },
      {
        onSuccess: (result) => {
          const text = formatMoney(result.amount, balance.isoCode);
          onDone(
            result.status === 'PAID'
              ? `${text} envoyés à ${selected.label}.`
              : manualTransfer
                ? `${text} réservés pour ${selected.label}. Fais maintenant le virement depuis ton compte marchand Orange Money, puis clique sur « Marquer payé ».`
                : `${text} en cours d’envoi vers ${selected.label}.`,
          );
          onClose();
        },
      },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Retirer des commissions en ${balance.isoCode}`}
      description={`Disponible : ${formatMoney(balance.available, balance.isoCode)}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button loading={withdraw.isPending} disabled={!valid} onClick={submit}>
            {manualTransfer ? 'Réserver le retrait' : 'Envoyer'}
          </Button>
        </div>
      }
    >
      {active.length === 0 ? (
        <Notice>Ajoute d’abord un bénéficiaire (ton numéro Orange Money, par exemple) pour pouvoir retirer.</Notice>
      ) : (
        <div className="space-y-4">
          {manualTransfer ? (
            <Notice>
              Orange Money n’est pas encore branché sur le serveur : le montant est réservé, puis tu fais le virement depuis ton compte marchand et tu
              cliques sur « Marquer payé ».
            </Notice>
          ) : null}
          <Select label="Envoyer à" value={beneficiaryId} onChange={(event) => setBeneficiaryId(event.target.value)}>
            {active.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} · {KIND_LABELS[item.kind]} · {item.phone}
              </option>
            ))}
          </Select>
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
          <TextArea label="Motif (facultatif)" rows={2} placeholder="Commissions de septembre, prime équipe support…" value={note} onChange={(event) => setNote(event.target.value)} />
          <PasswordField
            label="Ton mot de passe"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <FormError message={errorText(withdraw.error)} />
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
    <CardShell tone={STATUS_TONES[withdrawal.status]} className="p-3.5 pl-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold tabular-nums text-text-primary">{formatMoney(withdrawal.amount, withdrawal.currency.isoCode)}</p>
          <p className="truncate text-sm text-text-secondary">
            vers {withdrawal.beneficiary.label} · {withdrawal.destinationRef}
          </p>
        </div>
        <Chip tone={STATUS_CHIP[withdrawal.status]} icon={open ? <IconClockHour4 size={13} /> : undefined}>
          {STATUS_LABELS[withdrawal.status]}
        </Chip>
      </div>

      <p className="mt-1.5 text-xs text-text-muted">
        {formatDate(withdrawal.requestedAt)}
        {withdrawal.requestedBy?.email ? ` · par ${withdrawal.requestedBy.email}` : ''}
        {withdrawal.externalReference ? ` · réf. ${withdrawal.externalReference}` : ''}
      </p>
      {withdrawal.note ? <p className="mt-1.5 text-sm text-text-secondary">{withdrawal.note}</p> : null}
      {withdrawal.status === 'FAILED' && withdrawal.failureReason ? (
        <p className="mt-1.5 text-sm text-danger-dark">Motif : {withdrawal.failureReason}</p>
      ) : null}

      {open && canManage ? (
        <div className="mt-3 space-y-2.5">
          {mode ? (
            <div className="space-y-2.5 rounded-2xl bg-surface-muted/70 p-3">
              <TextField
                label={mode === 'paid' ? 'Référence Orange Money (facultatif)' : 'Pourquoi le virement n’est pas passé ?'}
                placeholder={mode === 'paid' ? 'Numéro de transaction du reçu' : 'Ex. numéro refusé, solde marchand insuffisant'}
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
              <div className="flex flex-wrap justify-end gap-2">
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
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                className="!px-3 !py-1.5 !text-xs"
                onClick={() => {
                  setValue('');
                  setMode('failed');
                }}
              >
                <IconX size={14} />
                Marquer échoué
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

export default function PlatformWalletPage() {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.PLATFORM_WALLET_MANAGE);

  const overview = usePlatformWallet();
  const beneficiaries = usePlatformBeneficiaries();
  const [status, setStatus] = useState<PlatformWithdrawalStatus | ''>('');
  const [page, setPage] = useState(1);
  const withdrawals = usePlatformWithdrawals({ page, status: status || undefined });

  const [withdrawing, setWithdrawing] = useState<CurrencyBalance | null>(null);
  const [editing, setEditing] = useState<PlatformBeneficiary | null>(null);
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const data = overview.data;
  const stats = [
    ...(data?.balances ?? []).slice(0, 2).map((balance) => ({ value: formatMoney(balance.available, ''), label: `Disponible ${balance.isoCode}` })),
    { value: String(data?.inProgressCount ?? 0), label: 'Retraits en cours' },
  ];

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Finance"
        title="Portefeuille plateforme"
        description="Les commissions d’Occa’Z en XOF et en GNF, et leur retrait vers ton Orange Money ou celui de l’équipe."
        stats={stats}
      />

      {saved ? <SavedNotice>{saved}</SavedNotice> : null}

      {data?.manualTransfer ? (
        <Notice>
          Orange Money n’est pas encore branché sur le serveur. Un retrait réserve le montant ; tu fais ensuite le virement depuis ton compte
          marchand Orange Money, puis tu cliques sur « Marquer payé ».
        </Notice>
      ) : data?.providerSimulated ? (
        <Notice>Mode simulation : les retraits sont enregistrés mais aucun vrai virement ne part.</Notice>
      ) : null}

      {overview.isError ? <Notice tone="danger">Impossible de lire le portefeuille. {errorText(overview.error)}</Notice> : null}

      {/* Soldes */}
      {overview.isLoading ? (
        <ListSkeleton count={2} heightClass="h-64" />
      ) : data ? (
        <div className="grid gap-3 md:grid-cols-2">
          {data.balances.map((balance) => (
            <BalanceCard key={balance.currencyId} balance={balance} canWithdraw={canManage} onWithdraw={() => setWithdrawing(balance)} />
          ))}
        </div>
      ) : null}

      {/* Bénéficiaires */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Bénéficiaires</h2>
            <p className="text-xs text-text-secondary">Les numéros Orange Money qui peuvent recevoir un retrait.</p>
          </div>
          {canManage ? (
            <Button onClick={() => setAdding(true)}>
              <IconPlus size={16} />
              Ajouter
            </Button>
          ) : null}
        </div>
        {beneficiaries.isLoading ? (
          <ListSkeleton count={2} heightClass="h-28" />
        ) : (beneficiaries.data ?? []).length === 0 ? (
          <EmptyState
            icon={<IconBriefcase size={26} />}
            title="Aucun bénéficiaire"
            text="Ajoute ton numéro Orange Money, puis ceux de l’équipe support ou du service client, pour pouvoir leur envoyer de l’argent."
            action={canManage ? <Button onClick={() => setAdding(true)}>Ajouter un bénéficiaire</Button> : undefined}
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {(beneficiaries.data ?? []).map((beneficiary) => (
              <BeneficiaryCard key={beneficiary.id} beneficiary={beneficiary} canManage={canManage} onEdit={() => setEditing(beneficiary)} />
            ))}
          </div>
        )}
      </section>

      {/* Historique */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Historique des retraits</h2>
          <p className="text-xs text-text-secondary">Chaque retrait est aussi inscrit dans le journal d’audit.</p>
        </div>
        <FilterChips
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          allLabel="Tous"
          options={(Object.keys(STATUS_LABELS) as PlatformWithdrawalStatus[]).map((value) => ({ value, label: STATUS_LABELS[value] }))}
        />
        {withdrawals.isLoading ? (
          <ListSkeleton count={3} heightClass="h-24" gridClass="" />
        ) : withdrawals.isError ? (
          <Notice tone="danger">Impossible de lire l’historique. {errorText(withdrawals.error)}</Notice>
        ) : (withdrawals.data?.data ?? []).length === 0 ? (
          <EmptyState
            icon={<IconArrowUpRight size={26} />}
            title="Aucun retrait pour le moment"
            text="Dès que tu retireras des commissions, elles apparaîtront ici avec leur statut."
          />
        ) : (
          <div className="space-y-3">
            {(withdrawals.data?.data ?? []).map((withdrawal) => (
              <WithdrawalCard key={withdrawal.id} withdrawal={withdrawal} canManage={canManage} />
            ))}
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
          </div>
        )}
      </section>

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
