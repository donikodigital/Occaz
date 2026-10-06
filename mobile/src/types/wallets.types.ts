// mobile/src/types/wallets.types.ts
import type { Money } from '@/services/api/types';
import type { PayoutStatus } from '@/types/payouts.types';

export type WalletTransactionType =
  | 'BOOKING_REVENUE'
  | 'SHIPMENT_REVENUE'
  | 'COMMISSION'
  | 'REFUND'
  | 'PAYOUT'
  | 'ADJUSTMENT'
  | 'CANCELLATION_FEE';

export type WalletTransactionStatus = 'PENDING' | 'COMPLETED' | 'REVERSED';

export interface Wallet {
  id: string;
  driverId: string;
  balance: Money;
  pendingBalance: Money;
  currencyId: string;
  /** Ajouté — WalletsService.findByDriverId inclut désormais la devise ; évite un "GNF" codé en dur côté mobile, faux en zone XOF. */
  currency: { id: string; isoCode: string };
}

/** Catégories de l'historique : trajets, envois, retraits, autres (remboursements, ajustements…). ALL = tout. */
export type WalletTxFilter = 'ALL' | 'TRIPS' | 'SHIPMENTS' | 'PAYOUTS' | 'OTHER';

/** De quoi la ligne parle : un trajet et son tronçon, un envoi et son itinéraire, un retrait et son statut. Villes seulement. */
export type WalletTransactionSubject =
  | { kind: 'TRIP'; from: string; to: string; seats: number }
  | { kind: 'SHIPMENT'; from: string; to: string; weightKg: number; categoryName: string | null }
  | { kind: 'PAYOUT'; status: PayoutStatus; method: string | null; destination: string | null };

export interface WalletTransaction {
  id: string;
  /** Absent sur l'historique conducteur (lignes fusionnées au net) : ne pas s'y fier. */
  walletId?: string;
  type: WalletTransactionType;
  status: WalletTransactionStatus;
  /** Signé — positif pour un crédit, négatif pour un débit (voir le schéma backend, ledger immuable). */
  amount: Money;
  currencyId: string;
  bookingId: string | null;
  shipmentId: string | null;
  payoutId: string | null;
  createdAt: string;
  category?: Exclude<WalletTxFilter, 'ALL'>;
  /** Crédit converti d'une autre devise (trajet payé en GNF, portefeuille en XOF) : devises et taux, jamais les montants d'origine. */
  conversion?: { fromIsoCode: string; toIsoCode: string; rate: number } | null;
  subject?: WalletTransactionSubject | null;
}

export interface WalletCategorySummary {
  /** Nombre d'opérations de la catégorie, annulées comprises. */
  count: number;
  /** Somme signée des opérations payées (gains positifs, retraits et remboursements négatifs). */
  total: Money;
  /** Somme signée des opérations encore en cours (pas encore dans le solde disponible). */
  pending: Money;
}

export type WalletSummary = Record<WalletTxFilter, WalletCategorySummary>;