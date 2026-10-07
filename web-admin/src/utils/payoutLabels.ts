// web-admin/src/utils/payoutLabels.ts
import type { PayoutStatus } from '@/types/payouts.types';

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  // Statut REQUESTED : la demande est faite et les fonds sont réservés, elle attend la décision de l'équipe.
  REQUESTED: 'En attente de validation',
  PROCESSING: 'En cours',
  PAID: 'Payé',
  FAILED: 'Échoué',
  CANCELLED: 'Annulé',
};

export const PAYOUT_STATUS_TONE: Record<PayoutStatus, 'primary' | 'success' | 'accent' | 'danger' | 'neutral'> = {
  REQUESTED: 'accent',
  PROCESSING: 'primary',
  PAID: 'success',
  FAILED: 'danger',
  CANCELLED: 'danger',
};
