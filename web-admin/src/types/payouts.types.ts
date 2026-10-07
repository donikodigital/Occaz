// web-admin/src/types/payouts.types.ts
import type { Money } from '@/services/api/types';

export type PayoutStatus = 'REQUESTED' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED';

export interface PayoutListItem {
  id: string;
  walletId: string;
  amount: Money;
  currencyId: string;
  /** Devise du retrait (GNF, XOF…). */
  currency?: { isoCode: string };
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

/** Mode des retraits, tel que la page « Retraits » l'affiche en tête. */
export interface PayoutConfig {
  /** true = Automatique (le retrait part tout de suite) ; false = Manuel (chaque retrait attend la validation de l'équipe). */
  autoEnabled: boolean;
  /** Plafond du mode automatique (plus petite unité de la devise du conducteur) ; « 0 » = aucune limite. */
  autoMaxAmount: Money;
  /** Vrai tant qu'Orange Money n'est pas branché : aucun virement réel ne part du serveur. */
  providerSimulated: boolean;
  /** Retraits en attente de validation. */
  pendingCount: number;
}
