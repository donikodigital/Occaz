// web-admin/src/types/payouts.types.ts
import type { Money } from '@/services/api/types';

export type PayoutStatus = 'REQUESTED' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED';

export interface PayoutListItem {
  id: string;
  walletId: string;
  amount: Money;
  currencyId: string;
  status: PayoutStatus;
  method: string | null;
  destinationRef: string | null;
  requestedAt: string;
  processedAt: string | null;
  /** Retrait envoyé tout de suite au prestataire de paiement, sans validation de l'équipe. */
  autoProcessed?: boolean;
  /** Référence du virement chez le prestataire (rapprochement avec ses relevés). */
  externalReference?: string | null;
  /** Raison d'un refus (par le prestataire ou par l'équipe). */
  failureReason?: string | null;
  wallet?: { driver?: { firstName: string; lastName: string } };
}
