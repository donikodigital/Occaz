// mobile/src/types/payouts.types.ts
// [19/10/2026] RequestPayoutPayload.pin : le code PIN de connexion confirme le retrait (à la place d'un SMS).
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
  /** Code PIN de connexion (6 chiffres) : obligatoire, confirme le retrait. */
  pin: string;
}
