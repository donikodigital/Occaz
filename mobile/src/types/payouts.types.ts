// mobile/src/types/payouts.types.ts
import type { Money } from '@/services/api/types';

export type PayoutStatus = 'REQUESTED' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED';

export interface Payout {
  id: string;
  walletId: string;
  amount: Money;
  currencyId: string;
  status: PayoutStatus;
  method: string | null;
  destinationRef: string | null;
  requestedAt: string;
  processedAt: string | null;
  /** Retrait envoyé tout de suite au prestataire, sans validation de l'équipe. */
  autoProcessed?: boolean;
  /** Raison d'un refus (numéro refusé…), le cas échéant. */
  failureReason?: string | null;
}

export interface RequestPayoutPayload {
  amount: string;
  method?: string;
  destinationRef?: string;
}
