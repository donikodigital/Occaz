// mobile/src/types/wallets.types.ts
import type { Money } from '@/services/api/types';

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
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  type: WalletTransactionType;
  status: WalletTransactionStatus;
  /** Signé — positif pour un crédit, négatif pour un débit (voir le schéma backend, ledger immuable). */
  amount: Money;
  currencyId: string;
  bookingId: string | null;
  shipmentId: string | null;
  payoutId: string | null;
  createdAt: string;
}
