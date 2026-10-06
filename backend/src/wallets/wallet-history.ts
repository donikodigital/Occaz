// backend/src/wallets/wallet-history.ts
//
// Historique du portefeuille tel que le CONDUCTEUR le voit : fusion du revenu et de sa commission en une seule ligne au montant net,
// classement par catégorie (trajets, envois, retraits, autres) et totaux par catégorie. Ce fichier est pur (ni base ni réseau) ; les
// lectures en base et l'enrichissement des lignes (itinéraire, statut du retrait) sont dans wallets.service.ts.
//
// Règle de confidentialité (demande explicite) : le conducteur ne voit jamais le montant brut payé par le client ni la commission de
// la plateforme comme lignes séparées — seulement sa part. Rien de ce qui sort d'ici ne permet de les retrouver : la conversion de
// devise n'expose que les devises et le taux, jamais les montants d'origine.
import { WalletTransactionStatus, WalletTransactionType } from '@prisma/client';

export const WALLET_TX_FILTERS = ['ALL', 'TRIPS', 'SHIPMENTS', 'PAYOUTS', 'OTHER'] as const;
export type WalletTxFilter = (typeof WALLET_TX_FILTERS)[number];
export type WalletTxCategory = Exclude<WalletTxFilter, 'ALL'>;

export interface LedgerRow {
  id: string;
  type: WalletTransactionType;
  status: WalletTransactionStatus;
  amount: bigint;
  currencyId: string;
  bookingId: string | null;
  shipmentId: string | null;
  payoutId: string | null;
  createdAt: Date;
  metadata?: unknown;
}

export interface DriverConversion {
  fromIsoCode: string;
  toIsoCode: string;
  rate: number;
}

export interface DriverHistoryRow {
  id: string;
  type: WalletTransactionType;
  status: WalletTransactionStatus;
  amount: bigint;
  currencyId: string;
  bookingId: string | null;
  shipmentId: string | null;
  payoutId: string | null;
  createdAt: Date;
  category: WalletTxCategory;
  /** Présent si le crédit a changé de devise (ex. trajet payé en GNF, portefeuille en XOF) : devises et taux seulement. */
  conversion: DriverConversion | null;
}

const REVENUE_TYPES = new Set<WalletTransactionType>([
  WalletTransactionType.BOOKING_REVENUE,
  WalletTransactionType.SHIPMENT_REVENUE,
]);

export function categoryOf(type: WalletTransactionType): WalletTxCategory {
  switch (type) {
    case WalletTransactionType.BOOKING_REVENUE:
      return 'TRIPS';
    case WalletTransactionType.SHIPMENT_REVENUE:
      return 'SHIPMENTS';
    case WalletTransactionType.PAYOUT:
      return 'PAYOUTS';
    default:
      // Remboursements, ajustements, frais d'annulation, commission isolée (sans réservation ni envoi).
      return 'OTHER';
  }
}

/** Extrait devises et taux d'une conversion enregistrée, sans les montants (voir la règle de confidentialité en tête). */
function conversionOf(metadata: unknown): DriverConversion | null {
  const conversion = (metadata as { conversion?: Partial<DriverConversion> } | null | undefined)?.conversion;
  if (!conversion || typeof conversion.fromIsoCode !== 'string' || typeof conversion.toIsoCode !== 'string') return null;
  return { fromIsoCode: conversion.fromIsoCode, toIsoCode: conversion.toIsoCode, rate: Number(conversion.rate) };
}

/**
 * Fusionne chaque revenu (trajet / envoi) et sa commission jumelle (même réservation / même envoi, posés ensemble) en UNE ligne au
 * montant net, avec un statut unique (les deux lignes basculent toujours ensemble). Les autres lignes passent telles quelles.
 * Le résultat est trié du plus récent au plus ancien.
 */
export function mergeForDriver(rows: LedgerRow[]): DriverHistoryRow[] {
  const byGroupKey = new Map<string, LedgerRow[]>();
  const standalone: LedgerRow[] = [];

  for (const row of rows) {
    const groupKey = row.bookingId ? `booking:${row.bookingId}` : row.shipmentId ? `shipment:${row.shipmentId}` : null;
    const isGroupable = groupKey && (REVENUE_TYPES.has(row.type) || row.type === WalletTransactionType.COMMISSION);
    if (isGroupable) {
      const group = byGroupKey.get(groupKey) ?? [];
      group.push(row);
      byGroupKey.set(groupKey, group);
    } else {
      standalone.push(row);
    }
  }

  const merged: DriverHistoryRow[] = Array.from(byGroupKey.values()).map((group) => {
    const revenue = group.find((r) => REVENUE_TYPES.has(r.type)) ?? group[0];
    const latest = group.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
    return {
      id: `net:${revenue.bookingId ?? revenue.shipmentId}`,
      type: revenue.type,
      status: latest.status,
      amount: group.reduce((sum, r) => sum + r.amount, 0n),
      currencyId: latest.currencyId,
      bookingId: revenue.bookingId,
      shipmentId: revenue.shipmentId,
      payoutId: null,
      createdAt: latest.createdAt,
      category: categoryOf(revenue.type),
      conversion: conversionOf(revenue.metadata),
    };
  });

  const others: DriverHistoryRow[] = standalone.map((row) => ({
    id: row.id,
    type: row.type,
    status: row.status,
    amount: row.amount,
    currencyId: row.currencyId,
    bookingId: row.bookingId,
    shipmentId: row.shipmentId,
    payoutId: row.payoutId,
    createdAt: row.createdAt,
    category: categoryOf(row.type),
    conversion: null,
  }));

  return [...merged, ...others].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

export interface CategorySummary {
  /** Nombre d'opérations de la catégorie, annulées comprises (c'est la longueur de la liste affichée). */
  count: number;
  /** Somme signée des opérations payées (COMPLETED) : gains positifs, retraits et remboursements négatifs. */
  total: bigint;
  /** Somme signée des opérations encore en cours (PENDING), pas encore dans le solde disponible. */
  pending: bigint;
}

export type WalletSummary = Record<WalletTxFilter, CategorySummary>;

/** Totaux de chaque catégorie sur TOUT l'historique (pas seulement la page affichée). Les opérations annulées ne comptent pas dans les sommes. */
export function summarize(rows: DriverHistoryRow[]): WalletSummary {
  const empty = (): CategorySummary => ({ count: 0, total: 0n, pending: 0n });
  const summary: WalletSummary = { ALL: empty(), TRIPS: empty(), SHIPMENTS: empty(), PAYOUTS: empty(), OTHER: empty() };

  for (const row of rows) {
    for (const key of ['ALL', row.category] as const) {
      const bucket = summary[key];
      bucket.count += 1;
      if (row.status === WalletTransactionStatus.COMPLETED) bucket.total += row.amount;
      else if (row.status === WalletTransactionStatus.PENDING) bucket.pending += row.amount;
    }
  }
  return summary;
}

export function filterByCategory(rows: DriverHistoryRow[], filter: WalletTxFilter): DriverHistoryRow[] {
  return filter === 'ALL' ? rows : rows.filter((row) => row.category === filter);
}
