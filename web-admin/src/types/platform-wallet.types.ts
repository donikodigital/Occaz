// web-admin/src/types/platform-wallet.types.ts
import type { Money } from '@/services/api/types';

export type BeneficiaryKind = 'OWNER' | 'SUPPORT' | 'STAFF' | 'OTHER';
export type PlatformWithdrawalStatus = 'PROCESSING' | 'PAID' | 'FAILED';

/** Solde de la plateforme pour une devise (XOF ou GNF). Tous les montants sont en plus petite unité, sous forme de texte. */
export interface CurrencyBalance {
  currencyId: string;
  isoCode: string;
  /** Commissions libérées depuis le début. */
  earned: Money;
  /** Commissions des courses pas encore terminées : pas encore retirables. */
  pending: Money;
  /** Déjà retiré (payé). */
  withdrawn: Money;
  /** Retraits envoyés mais pas encore confirmés. */
  inProgress: Money;
  /** Ce qui peut être retiré maintenant. */
  available: Money;
}

export interface PlatformWalletOverview {
  balances: CurrencyBalance[];
  inProgressCount: number;
  /** Aucun vrai virement ne part du serveur (prestataire simulé). */
  providerSimulated: boolean;
  /** Vrai en production tant qu'Orange Money n'est pas branché : le virement se fait à la main, puis « Marquer payé ». */
  manualTransfer: boolean;
}

export interface PlatformBeneficiary {
  id: string;
  label: string;
  holderName: string;
  kind: BeneficiaryKind;
  method: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
}

export interface PlatformWithdrawal {
  id: string;
  beneficiaryId: string;
  beneficiary: PlatformBeneficiary;
  amount: Money;
  currencyId: string;
  currency: { isoCode: string };
  status: PlatformWithdrawalStatus;
  method: string;
  destinationRef: string;
  note: string | null;
  externalReference: string | null;
  failureReason: string | null;
  requestedBy?: { id: string; email: string | null; phone: string } | null;
  requestedAt: string;
  processedAt: string | null;
}

export interface BeneficiaryInput {
  label: string;
  holderName: string;
  kind: BeneficiaryKind;
  phone: string;
}

export interface WithdrawalInput {
  beneficiaryId: string;
  currencyId: string;
  amount: Money;
  note?: string;
  password: string;
}
