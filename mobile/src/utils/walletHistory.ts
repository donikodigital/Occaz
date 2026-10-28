// mobile/src/utils/walletHistory.ts
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
//
// Historique du portefeuille — libellés, regroupement par jour et textes des lignes. Fonctions pures, sans écran : l'affichage est
// dans app/(driver)/(tabs)/wallet.tsx.
import type { PayoutStatus } from '@/types/payouts.types';
import type { WalletTransaction, WalletTransactionStatus, WalletTxFilter } from '@/types/wallets.types';
import { translate, translateN, intlLocale } from '@/i18n';

export const WALLET_FILTERS: WalletTxFilter[] = ['ALL', 'TRIPS', 'SHIPMENTS', 'PAYOUTS', 'OTHER'];

export const FILTER_LABELS: Record<WalletTxFilter, string> = {
  get ALL() { return translate('Tout'); },
  get TRIPS() { return translate('Trajets'); },
  get SHIPMENTS() { return translate('Envois'); },
  get PAYOUTS() { return translate('Retraits'); },
  get OTHER() { return translate('Autres'); },
};

/** Titre de la carte de total quand un filtre est actif. */
export const FILTER_TOTAL_LABELS: Record<Exclude<WalletTxFilter, 'ALL'>, string> = {
  get TRIPS() { return translate('Gagné avec les trajets'); },
  get SHIPMENTS() { return translate('Gagné avec les envois'); },
  get PAYOUTS() { return translate('Total retiré'); },
  get OTHER() { return translate('Remboursements et ajustements'); },
};

export const FILTER_EMPTY_TEXT: Record<WalletTxFilter, string> = {
  get ALL() { return translate('Aucune opération pour le moment.'); },
  get TRIPS() { return translate('Aucun gain de trajet pour le moment.'); },
  get SHIPMENTS() { return translate('Aucun gain d’envoi pour le moment.'); },
  get PAYOUTS() { return translate('Aucun retrait pour le moment.'); },
  get OTHER() { return translate('Aucun remboursement ni ajustement.'); },
};

const TX_TITLES: Record<WalletTransaction['type'], string> = {
  get BOOKING_REVENUE() { return translate('Trajet'); },
  get SHIPMENT_REVENUE() { return translate('Envoi'); },
  get COMMISSION() { return translate('Commission'); },
  get REFUND() { return translate('Remboursement'); },
  get PAYOUT() { return translate('Retrait'); },
  get ADJUSTMENT() { return translate('Ajustement'); },
  get CANCELLATION_FEE() { return translate('Frais d’annulation'); },
};

export function txTitle(tx: Pick<WalletTransaction, 'type'>): string {
  return TX_TITLES[tx.type];
}

const METHOD_LABELS: Record<string, string> = {
  get orange_money() { return translate('Orange Money'); },
  get mobile_money() { return translate('Mobile Money'); },
  get mobile_money_xof() { return translate('Mobile Money'); },
  get bank_transfer() { return translate('Virement bancaire'); },
  get cash() { return translate('Espèces'); },
};

export function methodLabel(method: string | null | undefined): string | null {
  if (!method) return null;
  return METHOD_LABELS[method] ?? method.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/** Deuxième ligne d'une opération : de quoi il s'agit (tronçon, itinéraire, mode de retrait). */
export function txSubtitle(tx: Pick<WalletTransaction, 'subject'>): string | null {
  const subject = tx.subject;
  if (!subject) return null;
  switch (subject.kind) {
    case 'TRIP':
      return translateN(subject.seats, '{from} → {to} · {count} place', '{from} → {to} · {count} places', { from: subject.from, to: subject.to });
    case 'SHIPMENT':
      return [subject.categoryName, `${subject.from} → ${subject.to}`, `${subject.weightKg} kg`].filter(Boolean).join(' · ');
    case 'PAYOUT':
      return [methodLabel(subject.method), subject.destination].filter(Boolean).join(' · ') || null;
  }
}

/** « Converti du GNF · 1 GNF = 0,062 XOF » — pour qu'un petit montant en XOF ne surprenne pas quand le trajet était en GNF. */
export function conversionNote(conversion: WalletTransaction['conversion']): string | null {
  if (!conversion) return null;
  const rate = new Intl.NumberFormat(intlLocale(), { maximumSignificantDigits: 4 }).format(conversion.rate);
  return translate('Converti du {fromIsoCode} · 1 {fromIsoCode} = {rate} {toIsoCode}', { fromIsoCode: conversion.fromIsoCode, rate, toIsoCode: conversion.toIsoCode });
}

export type StatusTone = 'ocean' | 'success' | 'danger' | 'neutral';

const TX_STATUS: Record<WalletTransactionStatus, { label: string; tone: StatusTone }> = {
  PENDING: { get label() { return translate('En cours'); }, tone: 'ocean' },
  COMPLETED: { get label() { return translate('Payé'); }, tone: 'success' },
  REVERSED: { get label() { return translate('Annulé'); }, tone: 'danger' },
};

const PAYOUT_STATUS: Record<PayoutStatus, { label: string; tone: StatusTone }> = {
  REQUESTED: { get label() { return translate('En attente de validation'); }, tone: 'neutral' },
  PROCESSING: { get label() { return translate('En cours'); }, tone: 'ocean' },
  PAID: { get label() { return translate('Payé'); }, tone: 'success' },
  FAILED: { get label() { return translate('Échoué'); }, tone: 'danger' },
  CANCELLED: { get label() { return translate('Annulé'); }, tone: 'danger' },
};

/** Pastille de statut : pour un retrait, celui de la demande de retrait (En attente de validation, En cours, Payé, Échoué) ; sinon celui de l'opération. */
export function txStatus(tx: Pick<WalletTransaction, 'status' | 'subject'>): { label: string; tone: StatusTone } {
  if (tx.subject?.kind === 'PAYOUT') return PAYOUT_STATUS[tx.subject.status];
  return TX_STATUS[tx.status];
}

// ---------------------------------------------------------------------------
// Regroupement par jour
// ---------------------------------------------------------------------------

export interface DayGroup {
  key: string;
  label: string;
  items: WalletTransaction[];
}

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

/** « Aujourd'hui », « Hier », sinon « lundi 5 octobre » (avec l'année si ce n'est pas l'année en cours). */
export function dayLabel(date: Date, now: Date): string {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfDay.getTime()) / 86_400_000);
  if (diffDays === 0) return translate("Aujourd'hui");
  if (diffDays === 1) return translate('Hier');
  const text = new Intl.DateTimeFormat(intlLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {}),
  }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Regroupe les opérations (déjà triées du plus récent au plus ancien) par jour, en gardant l'ordre. */
export function groupByDay(transactions: WalletTransaction[], now: Date = new Date()): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const tx of transactions) {
    const date = new Date(tx.createdAt);
    const key = dayKey(date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(tx);
    else groups.push({ key, label: dayLabel(date, now), items: [tx] });
  }
  return groups;
}

/** « +4 495 » / « −13 950 » : le signe, puis le montant formaté par l'appelant (avec sa devise). */
export function signOf(amount: string | number): '+' | '−' | '' {
  const value = Number(amount);
  if (value > 0) return '+';
  if (value < 0) return '−';
  return '';
}
