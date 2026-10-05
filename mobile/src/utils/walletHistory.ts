// mobile/src/utils/walletHistory.ts
//
// Historique du portefeuille — libellés, regroupement par jour et textes des lignes. Fonctions pures, sans écran : l'affichage est
// dans app/(driver)/(tabs)/wallet.tsx.
import type { PayoutStatus } from '@/types/payouts.types';
import type { WalletTransaction, WalletTransactionStatus, WalletTxFilter } from '@/types/wallets.types';

export const WALLET_FILTERS: WalletTxFilter[] = ['ALL', 'TRIPS', 'SHIPMENTS', 'PAYOUTS', 'OTHER'];

export const FILTER_LABELS: Record<WalletTxFilter, string> = {
  ALL: 'Tout',
  TRIPS: 'Trajets',
  SHIPMENTS: 'Envois',
  PAYOUTS: 'Retraits',
  OTHER: 'Autres',
};

/** Titre de la carte de total quand un filtre est actif. */
export const FILTER_TOTAL_LABELS: Record<Exclude<WalletTxFilter, 'ALL'>, string> = {
  TRIPS: 'Gagné avec les trajets',
  SHIPMENTS: 'Gagné avec les envois',
  PAYOUTS: 'Total retiré',
  OTHER: 'Remboursements et ajustements',
};

export const FILTER_EMPTY_TEXT: Record<WalletTxFilter, string> = {
  ALL: 'Aucune opération pour le moment.',
  TRIPS: 'Aucun gain de trajet pour le moment.',
  SHIPMENTS: 'Aucun gain d\u2019envoi pour le moment.',
  PAYOUTS: 'Aucun retrait pour le moment.',
  OTHER: 'Aucun remboursement ni ajustement.',
};

const TX_TITLES: Record<WalletTransaction['type'], string> = {
  BOOKING_REVENUE: 'Trajet',
  SHIPMENT_REVENUE: 'Envoi',
  COMMISSION: 'Commission',
  REFUND: 'Remboursement',
  PAYOUT: 'Retrait',
  ADJUSTMENT: 'Ajustement',
  CANCELLATION_FEE: 'Frais d\u2019annulation',
};

export function txTitle(tx: Pick<WalletTransaction, 'type'>): string {
  return TX_TITLES[tx.type];
}

const METHOD_LABELS: Record<string, string> = {
  orange_money: 'Orange Money',
  mobile_money: 'Mobile Money',
  mobile_money_xof: 'Mobile Money',
  bank_transfer: 'Virement bancaire',
  cash: 'Espèces',
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
      return `${subject.from} → ${subject.to} · ${subject.seats} place${subject.seats > 1 ? 's' : ''}`;
    case 'SHIPMENT':
      return [subject.categoryName, `${subject.from} → ${subject.to}`, `${subject.weightKg} kg`].filter(Boolean).join(' · ');
    case 'PAYOUT':
      return [methodLabel(subject.method), subject.destination].filter(Boolean).join(' · ') || null;
  }
}

/** « Converti du GNF · 1 GNF = 0,062 XOF » — pour qu'un petit montant en XOF ne surprenne pas quand le trajet était en GNF. */
export function conversionNote(conversion: WalletTransaction['conversion']): string | null {
  if (!conversion) return null;
  const rate = new Intl.NumberFormat('fr-FR', { maximumSignificantDigits: 4 }).format(conversion.rate);
  return `Converti du ${conversion.fromIsoCode} · 1 ${conversion.fromIsoCode} = ${rate} ${conversion.toIsoCode}`;
}

export type StatusTone = 'ocean' | 'success' | 'danger' | 'neutral';

const TX_STATUS: Record<WalletTransactionStatus, { label: string; tone: StatusTone }> = {
  PENDING: { label: 'En cours', tone: 'ocean' },
  COMPLETED: { label: 'Payé', tone: 'success' },
  REVERSED: { label: 'Annulé', tone: 'danger' },
};

const PAYOUT_STATUS: Record<PayoutStatus, { label: string; tone: StatusTone }> = {
  REQUESTED: { label: 'Demandé', tone: 'neutral' },
  PROCESSING: { label: 'En cours', tone: 'ocean' },
  PAID: { label: 'Payé', tone: 'success' },
  FAILED: { label: 'Échoué', tone: 'danger' },
  CANCELLED: { label: 'Annulé', tone: 'danger' },
};

/** Pastille de statut : pour un retrait, celui de la demande de retrait (Demandé, En cours, Payé, Échoué) ; sinon celui de l'opération. */
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
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  const text = new Intl.DateTimeFormat('fr-FR', {
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
