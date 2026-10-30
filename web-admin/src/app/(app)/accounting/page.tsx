// web-admin/src/app/(app)/accounting/page.tsx
// [25/10/2026] v1 — Comptabilité de la plateforme.
//  • Synthèse : pour une année et une devise (jamais de mélange GNF / XOF), les commissions encaissées, ce qui a été versé aux conducteurs et les
//    dépenses de l'administration (par motif), par MOIS, par SEMESTRE ou pour l'ANNÉE, avec le résultat (commissions − dépenses).
//  • Pièces : les bulletins de paie, factures d'achat, reçus et notes de frais de chaque retrait, téléchargeables en PDF.
//  • Personnel : la fiche de paie de chaque membre de l'administration (base du bulletin de salaire) — réservé à ceux qui gèrent le portefeuille.
//  • Exports Excel (formules de totaux) et PDF de l'année.
// Cartes ombrées uniquement, jamais de tableau.
'use client';

import React, { useMemo, useState } from 'react';
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconBuildingBank,
  IconCalculator,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconReceipt2,
  IconSteeringWheel,
  IconUserCircle,
  IconUsers,
} from '@tabler/icons-react';
import { Button, Select } from '@/components/ui';
import {
  CardShell,
  Chip,
  EmptyState,
  FilterChips,
  IconTile,
  ListSkeleton,
  Notice,
  PageHero,
  SavedNotice,
  Tabs,
  type Tone,
} from '@/components/admin/AdminUi';
import { DocumentButton, ExpenseIcon, StatusPill, formatDateTime } from '@/components/platformWallet/ExpenseParts';
import { StaffPayModal } from '@/components/accounting/StaffPayModal';
import { useAccountingStaff, useAccountingSummary, useExport } from '@/hooks/useAccounting';
import { usePlatformWithdrawals } from '@/hooks/usePlatformWallet';
import { usePermissions } from '@/hooks/usePermissions';
import { ApiError } from '@/services/api/ApiError';
import type { AccountingBucket, CurrencyAccounting, StaffPaySummary } from '@/types/accounting.types';
import type { ExpenseCategory, PlatformWithdrawal } from '@/types/platform-wallet.types';
import { EXPENSE_CATEGORY_INFO, EXPENSE_CATEGORY_ORDER, expenseLabel, periodLabel } from '@/utils/expenseCategories';
import { formatMoney } from '@/utils/money';
import { PERMISSIONS } from '@/utils/permissions';

type Granularity = 'month' | 'semester' | 'year';
type PageTab = 'summary' | 'pieces' | 'staff';

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function errorText(error: unknown): string | undefined {
  if (!error) return undefined;
  return error instanceof ApiError ? error.message : 'Une erreur est survenue.';
}

const big = (value: string) => BigInt(value || '0');

/** Part de `value` dans `total`, en % (0 à 100, une décimale) ; 0 si le total est nul ou négatif. */
function share(value: bigint, total: bigint): number {
  if (total <= 0n || value <= 0n) return 0;
  return Math.min(100, Number((value * 1000n) / total) / 10);
}

function resultTone(result: string): Tone {
  const value = big(result);
  return value > 0n ? 'success' : value < 0n ? 'danger' : 'neutral';
}

// ---------------------------------------------------------------------------
// Synthèse
// ---------------------------------------------------------------------------

function BigStat({ icon, tone, label, value, iso, note }: { icon: React.ReactNode; tone: Tone; label: string; value: string; iso: string; note?: string }) {
  const negative = value.startsWith('-');
  return (
    <CardShell tone={tone} className="p-3.5 pl-5">
      <div className="flex items-start gap-3">
        <IconTile tone={tone}>{icon}</IconTile>
        <div className="min-w-0">
          <p className="text-xs font-medium text-text-secondary">{label}</p>
          <p className={`mt-0.5 truncate text-lg font-bold leading-tight tabular-nums sm:text-xl ${negative ? 'text-danger-dark' : 'text-text-primary'}`}>{formatMoney(value, iso)}</p>
          {note ? <p className="mt-0.5 text-xs text-text-muted">{note}</p> : null}
        </div>
      </div>
    </CardShell>
  );
}

function FigureLine({ dot, label, value, iso }: { dot: string; label: string; value: string; iso: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex min-w-0 items-center gap-1.5 text-text-secondary">
        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 font-semibold tabular-nums text-text-primary">{formatMoney(value, iso)}</span>
    </div>
  );
}

/** Les trois motifs les plus coûteux d'une période, sur une ligne : « Salaire 9 000 000 · Fournitures 40 250 000 ». */
function topMotifs(bucket: AccountingBucket, iso: string): string {
  return EXPENSE_CATEGORY_ORDER.map((category) => ({ category, amount: big(bucket.byCategory[category]) }))
    .filter((item) => item.amount > 0n)
    .sort((a, b) => (a.amount > b.amount ? -1 : 1))
    .slice(0, 3)
    .map((item) => `${EXPENSE_CATEGORY_INFO[item.category].label} ${formatMoney(item.amount.toString(), iso)}`)
    .join(' · ');
}

function PeriodCard({ bucket, iso, emphasis }: { bucket: AccountingBucket; iso: string; emphasis?: boolean }) {
  const commissions = big(bucket.commissions);
  const expenses = big(bucket.adminExpenses);
  const empty = commissions === 0n && big(bucket.driverPayouts) === 0n && expenses === 0n;
  const tone = resultTone(bucket.result);
  const motifs = topMotifs(bucket, iso);
  return (
    <CardShell tone={empty ? 'neutral' : tone} muted={empty} className={`py-3 pl-5 pr-3.5 ${emphasis ? 'ring-primary/30' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-bold text-text-primary">{bucket.label}</p>
        {!empty ? (
          <Chip tone={tone} icon={big(bucket.result) < 0n ? <IconArrowDownRight size={13} /> : <IconArrowUpRight size={13} />}>
            {formatMoney(bucket.result, iso)}
          </Chip>
        ) : (
          <span className="text-xs text-text-muted">Aucun mouvement</span>
        )}
      </div>
      {!empty ? (
        <>
          <div className="mt-2.5 space-y-1.5">
            <FigureLine dot="bg-success" label="Commissions" value={bucket.commissions} iso={iso} />
            <FigureLine dot="bg-primary" label={`Versé aux conducteurs${bucket.driverPayoutCount ? ` (${bucket.driverPayoutCount})` : ''}`} value={bucket.driverPayouts} iso={iso} />
            <FigureLine dot="bg-accent" label={`Dépenses admin.${bucket.adminExpenseCount ? ` (${bucket.adminExpenseCount})` : ''}`} value={bucket.adminExpenses} iso={iso} />
          </div>
          {commissions > 0n ? (
            <div className="mt-2.5" title={`Les dépenses représentent ${share(expenses, commissions)} % des commissions`}>
              <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-border/60">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${share(expenses, commissions)}%` }} />
              </div>
            </div>
          ) : null}
          {motifs ? <p className="mt-2 text-xs leading-relaxed text-text-muted">{motifs}</p> : null}
        </>
      ) : null}
    </CardShell>
  );
}

function MotifBreakdown({ bucket, iso }: { bucket: AccountingBucket; iso: string }) {
  const total = big(bucket.adminExpenses);
  return (
    <CardShell tone="accent" className="p-4 pl-5">
      <p className="text-sm font-bold text-text-primary">Dépenses de l’administration par motif</p>
      <p className="text-xs text-text-secondary">{bucket.label} · {formatMoney(bucket.adminExpenses, iso)} payés</p>
      <div className="mt-3 space-y-3">
        {EXPENSE_CATEGORY_ORDER.map((category) => {
          const amount = big(bucket.byCategory[category]);
          return (
            <div key={category}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className={`min-w-0 truncate ${amount > 0n ? 'font-medium text-text-primary' : 'text-text-muted'}`}>{EXPENSE_CATEGORY_INFO[category].label}</span>
                <span className={`shrink-0 tabular-nums ${amount > 0n ? 'font-semibold text-text-primary' : 'text-text-muted'}`}>{formatMoney(amount.toString(), iso)}</span>
              </div>
              <div aria-hidden className="mt-1 h-1.5 overflow-hidden rounded-full bg-border/60">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${share(amount, total)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}

function SummaryView({ currency, granularity }: { currency: CurrencyAccounting; granularity: Granularity }) {
  const iso = currency.isoCode;
  const buckets = granularity === 'month' ? currency.months : granularity === 'semester' ? currency.semesters : [currency.year];
  const year = currency.year;
  return (
    <div className="space-y-4">
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <BigStat icon={<IconBuildingBank size={20} />} tone="success" label="Commissions encaissées" value={year.commissions} iso={iso} note="Ce que la plateforme gagne" />
        <BigStat icon={<IconSteeringWheel size={20} />} tone="primary" label="Versé aux conducteurs" value={year.driverPayouts} iso={iso} note={`${year.driverPayoutCount} paiement${year.driverPayoutCount > 1 ? 's' : ''}`} />
        <BigStat icon={<IconReceipt2 size={20} />} tone="accent" label="Dépenses de l’administration" value={year.adminExpenses} iso={iso} note={`${year.adminExpenseCount} retrait${year.adminExpenseCount > 1 ? 's' : ''} payé${year.adminExpenseCount > 1 ? 's' : ''}`} />
        <BigStat icon={<IconCalculator size={20} />} tone={resultTone(year.result)} label="Résultat de l’année" value={year.result} iso={iso} note="Commissions − dépenses" />
      </div>

      <div className="grid items-start gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {buckets.map((bucket) => (
          <PeriodCard key={bucket.label} bucket={bucket} iso={iso} emphasis={granularity === 'year'} />
        ))}
      </div>

      <MotifBreakdown bucket={year} iso={iso} />

      <details className="group rounded-2xl bg-surface-muted/60 px-4 py-2.5 text-xs leading-relaxed text-text-secondary">
        <summary className="cursor-pointer list-none font-medium text-text-primary marker:hidden">
          Comment lire ces montants ?
          <span className="ml-1 text-text-muted group-open:hidden">(afficher)</span>
        </summary>
        <p className="mt-1.5">
          <span className="font-medium text-text-primary">Commissions</span> : celles des courses et envois terminés, comptées dans la devise payée par le
          client et datées du jour de leur inscription au registre. <span className="font-medium text-text-primary">Versé aux conducteurs</span> et{' '}
          <span className="font-medium text-text-primary">dépenses de l’administration</span> : retraits <em>payés</em>, comptés au jour du paiement — un
          retrait « en cours » n’y figure pas encore.
        </p>
        <p className="mt-1.5">
          <span className="font-medium text-text-primary">Résultat</span> = commissions − dépenses de l’administration. Chaque devise a sa propre
          comptabilité : le GNF et le XOF ne s’additionnent jamais.
        </p>
      </details>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pièces
// ---------------------------------------------------------------------------

const STATUS_TONES = { PROCESSING: 'primary', PAID: 'success', FAILED: 'danger' } as const;

function PieceCard({ withdrawal, canManage }: { withdrawal: PlatformWithdrawal; canManage: boolean }) {
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
      <p className="mt-1.5 truncate text-xs text-text-muted">
        {formatDateTime(withdrawal.requestedAt)}
        {withdrawal.documentNumber ? ` · pièce ${withdrawal.documentNumber}` : ' · avant les motifs (pas de pièce)'}
      </p>
      {withdrawal.hasDocument ? (
        <div className="mt-2.5 flex justify-end">
          <DocumentButton withdrawal={withdrawal} canManage={canManage} />
        </div>
      ) : null}
    </CardShell>
  );
}

function PiecesView({ year, canManage }: { year: number; canManage: boolean }) {
  const [category, setCategory] = useState<ExpenseCategory | ''>('');
  const [month, setMonth] = useState('');
  const [page, setPage] = useState(1);
  const list = usePlatformWithdrawals({ page, year, month: month ? Number(month) : undefined, category: category || undefined });
  const rows = list.data?.data ?? [];

  return (
    <section className="space-y-3">
      <Select label="Mois" value={month} onChange={(event) => { setMonth(event.target.value); setPage(1); }}>
        <option value="">Toute l’année {year}</option>
        {MONTHS.map((name, index) => (
          <option key={name} value={index + 1}>
            {name}
          </option>
        ))}
      </Select>
      <FilterChips
        value={category}
        onChange={(value) => {
          setCategory(value);
          setPage(1);
        }}
        allLabel="Tous les motifs"
        options={EXPENSE_CATEGORY_ORDER.map((value) => ({ value, label: EXPENSE_CATEGORY_INFO[value].label }))}
      />
      {list.isLoading ? (
        <ListSkeleton count={4} heightClass="h-24" gridClass="lg:grid-cols-2" />
      ) : list.isError ? (
        <Notice tone="danger">Impossible de lire les pièces. {errorText(list.error)}</Notice>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<IconReceipt2 size={26} />}
          title="Aucune pièce pour cette période"
          text="Chaque retrait de la plateforme produit une pièce : bulletin de paie, facture d’achat, reçu de prime, note de frais ou justificatif."
        />
      ) : (
        <>
          <div className="grid items-start gap-2.5 lg:grid-cols-2">
            {rows.map((withdrawal) => (
              <PieceCard key={withdrawal.id} withdrawal={withdrawal} canManage={canManage} />
            ))}
          </div>
          {list.data && list.data.meta.totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3 pt-1">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                Précédent
              </Button>
              <span className="text-xs text-text-secondary">
                Page {list.data.meta.page} / {list.data.meta.totalPages}
              </span>
              <Button variant="secondary" disabled={page >= list.data.meta.totalPages} onClick={() => setPage((current) => current + 1)}>
                Suivant
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Personnel
// ---------------------------------------------------------------------------

function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase());
  return letters.join('') || '?';
}

function StaffCard({ staff, onEdit }: { staff: StaffPaySummary; onEdit: () => void }) {
  return (
    <CardShell tone={staff.payReady ? 'success' : 'accent'} muted={!staff.isActive} className="py-3 pl-5 pr-3.5">
      <div className="flex items-start gap-3">
        <IconTile tone={staff.payReady ? 'success' : 'accent'} round>
          {initials(staff.fullName)}
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-text-primary">{staff.fullName}</p>
          <p className="truncate text-xs text-text-secondary">
            {staff.pay?.jobTitle ? `${staff.pay.jobTitle} · ` : ''}
            {staff.roles.join(', ') || 'Administration'}
            {!staff.isActive ? ' · compte désactivé' : ''}
          </p>
        </div>
        <Chip tone={staff.payReady ? 'success' : 'accent'}>{staff.payReady ? 'Fiche prête' : 'À compléter'}</Chip>
      </div>
      {staff.pay && staff.payReady ? (
        <p className="mt-2.5 text-sm text-text-secondary">
          Salaire de base <span className="font-semibold tabular-nums text-text-primary">{formatMoney(staff.pay.baseSalary, staff.pay.isoCode)}</span>
          {staff.pay.allowances.length > 0 ? ` · ${staff.pay.allowances.length} prime${staff.pay.allowances.length > 1 ? 's' : ''}` : ''}
          {staff.pay.deductions.length > 0 ? ` · ${staff.pay.deductions.length} retenue${staff.pay.deductions.length > 1 ? 's' : ''}` : ''}
        </p>
      ) : (
        <p className="mt-2.5 text-xs text-text-muted">Renseigne le salaire de base pour pouvoir produire son bulletin.</p>
      )}
      <div className="mt-2.5 flex justify-end">
        <Button variant={staff.payReady ? 'secondary' : 'primary'} className="!px-3 !py-1.5 !text-xs" onClick={onEdit}>
          <IconUserCircle size={15} />
          {staff.payReady ? 'Modifier la fiche' : 'Renseigner la fiche'}
        </Button>
      </div>
    </CardShell>
  );
}

function StaffView({ currencies, onSaved }: { currencies: Array<{ currencyId: string; isoCode: string }>; onSaved: (message: string) => void }) {
  const staff = useAccountingStaff();
  const [editing, setEditing] = useState<StaffPaySummary | null>(null);
  const people = staff.data ?? [];

  return (
    <section className="space-y-3">
      <Notice>
        Données personnelles et salaires : visibles seulement par ceux qui gèrent le portefeuille. Le bulletin de salaire d’un retrait « Salaire » est
        calculé depuis cette fiche, puis figé.
      </Notice>
      {staff.isLoading ? (
        <ListSkeleton count={3} heightClass="h-32" gridClass="sm:grid-cols-2 xl:grid-cols-3" />
      ) : staff.isError ? (
        <Notice tone="danger">Impossible de lire le personnel. {errorText(staff.error)}</Notice>
      ) : people.length === 0 ? (
        <EmptyState icon={<IconUsers size={26} />} title="Aucun membre du personnel" text="Les comptes d’équipe (Support, Superviseur…) se créent depuis « Création comptes »." />
      ) : (
        <div className="grid items-start gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {people.map((person) => (
            <StaffCard key={person.userId} staff={person} onEdit={() => setEditing(person)} />
          ))}
        </div>
      )}
      {editing ? <StaffPayModal staff={editing} currencies={currencies} onClose={() => setEditing(null)} onSaved={onSaved} /> : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AccountingPage() {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.PLATFORM_WALLET_MANAGE);

  const [year, setYear] = useState<number | undefined>(undefined);
  const summary = useAccountingSummary(year);
  const data = summary.data;
  const [currencyId, setCurrencyId] = useState('');
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [tab, setTab] = useState<PageTab>('summary');
  const [saved, setSaved] = useState<string | null>(null);
  const exporter = useExport();

  const currency = useMemo(() => data?.currencies.find((item) => item.currencyId === currencyId) ?? data?.currencies[0], [data, currencyId]);
  const activeYear = data?.year ?? year ?? new Date().getFullYear();
  const iso = currency?.isoCode ?? '';

  const stats = currency
    ? [
        { value: formatMoney(currency.year.commissions, ''), label: `Commissions ${iso}` },
        { value: formatMoney(currency.year.driverPayouts, ''), label: 'Aux conducteurs' },
        { value: formatMoney(currency.year.adminExpenses, ''), label: 'Dépenses admin.' },
        { value: formatMoney(currency.year.result, ''), label: 'Résultat' },
      ]
    : undefined;

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHero
        eyebrow="Finance"
        title="Comptabilité"
        description={`Année ${activeYear} : ce que la plateforme encaisse, ce qui est versé aux conducteurs et ce que l’administration dépense, par mois, semestre et année.`}
        stats={stats}
      />

      {saved ? <SavedNotice>{saved}</SavedNotice> : null}
      {summary.isError ? <Notice tone="danger">Impossible de lire la comptabilité. {errorText(summary.error)}</Notice> : null}

      {/* Réglages d'affichage et exports */}
      <CardShell tone="primary" className="space-y-3 p-3.5 pl-5">
        {/* Trois listes sur la même ligne, y compris sur téléphone */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Select
            label="Année"
            value={String(activeYear)}
            onChange={(event) => setYear(Number(event.target.value))}
            className="!px-2.5 !pr-7 sm:!px-3.5 sm:!pr-9"
          >
            {(data?.years ?? [activeYear]).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          {data && data.currencies.length > 0 ? (
            <Select
              label="Devise"
              value={currency?.currencyId ?? ''}
              onChange={(event) => setCurrencyId(event.target.value)}
              className="!px-2.5 !pr-7 sm:!px-3.5 sm:!pr-9"
            >
              {data.currencies.map((item) => (
                <option key={item.currencyId} value={item.currencyId}>
                  {item.isoCode}
                </option>
              ))}
            </Select>
          ) : (
            <div>
              <p className="mb-1.5 text-sm font-medium text-text-secondary">Devise</p>
              <div className="h-10 animate-pulse rounded-lg bg-surface-muted" />
            </div>
          )}
          <Select
            label="Période"
            value={granularity}
            onChange={(event) => setGranularity(event.target.value as Granularity)}
            disabled={tab !== 'summary'}
            title={tab !== 'summary' ? 'La période ne s’applique qu’à l’onglet Synthèse.' : undefined}
            className="!px-2.5 !pr-7 sm:!px-3.5 sm:!pr-9"
          >
            <option value="month">Mois</option>
            <option value="semester">Semestres</option>
            <option value="year">Année</option>
          </Select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
          <p className="min-w-0 text-xs text-text-secondary">Exporter toute l’année {activeYear}, toutes devises.</p>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="secondary"
              className="!px-3 !py-2 !text-xs"
              loading={exporter.isPending && exporter.variables?.kind === 'excel'}
              disabled={!data || exporter.isPending}
              onClick={() => exporter.mutate({ kind: 'excel', year: activeYear })}
            >
              <IconFileSpreadsheet size={16} />
              Excel
            </Button>
            <Button
              variant="secondary"
              className="!px-3 !py-2 !text-xs"
              loading={exporter.isPending && exporter.variables?.kind === 'pdf'}
              disabled={!data || exporter.isPending}
              onClick={() => exporter.mutate({ kind: 'pdf', year: activeYear })}
            >
              <IconFileTypePdf size={16} />
              PDF
            </Button>
          </div>
        </div>
        {exporter.error ? <p className="text-xs text-danger">{errorText(exporter.error)}</p> : null}
      </CardShell>

      <Tabs<PageTab>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'summary', label: 'Synthèse', icon: <IconCalculator size={16} /> },
          { value: 'pieces', label: 'Pièces', icon: <IconReceipt2 size={16} /> },
          ...(canManage ? [{ value: 'staff' as const, label: 'Personnel', icon: <IconUsers size={16} /> }] : []),
        ]}
      />

      {tab === 'summary' ? (
        summary.isLoading ? (
          <ListSkeleton count={6} heightClass="h-36" gridClass="sm:grid-cols-2 xl:grid-cols-3" />
        ) : currency ? (
          <SummaryView currency={currency} granularity={granularity} />
        ) : (
          <EmptyState icon={<IconCalculator size={26} />} title="Aucune devise configurée" text="Les devises (GNF, XOF) apparaissent ici dès qu’elles sont créées." />
        )
      ) : tab === 'pieces' ? (
        <PiecesView year={activeYear} canManage={canManage} />
      ) : (
        <StaffView currencies={(data?.currencies ?? []).map((item) => ({ currencyId: item.currencyId, isoCode: item.isoCode }))} onSaved={setSaved} />
      )}
    </div>
  );
}
