// web-admin/src/utils/payoutLabels.ts
import type { PayoutStatus } from '@/types/payouts.types';

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  REQUESTED: 'Demandé',
  PROCESSING: 'En cours',
  PAID: 'Payé',
  FAILED: 'Échoué',
  CANCELLED: 'Annulé',
};

export const PAYOUT_STATUS_TONE: Record<PayoutStatus, 'primary' | 'success' | 'accent' | 'danger' | 'neutral'> = {
  REQUESTED: 'neutral',
  PROCESSING: 'primary',
  PAID: 'success',
  FAILED: 'danger',
  CANCELLED: 'danger',
};
