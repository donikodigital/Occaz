// mobile/src/utils/disputeLabels.ts
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
import type { DisputePriority, DisputeStatus } from '@/types/disputes.types';
import { translate } from '@/i18n';

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  get OPENED() { return translate('Ouvert'); },
  get UNDER_REVIEW() { return translate("En cours d'examen"); },
  get WAITING_FOR_CUSTOMER() { return translate('En attente de votre réponse'); },
  get WAITING_FOR_DRIVER() { return translate('En attente du conducteur'); },
  get INVESTIGATION() { return translate('En investigation'); },
  get RESOLVED() { return translate('Résolu'); },
  get CLOSED() { return translate('Clos'); },
};

export const DISPUTE_STATUS_TONE: Record<DisputeStatus, 'primary' | 'success' | 'accent' | 'danger' | 'neutral'> = {
  OPENED: 'primary',
  UNDER_REVIEW: 'primary',
  WAITING_FOR_CUSTOMER: 'accent',
  WAITING_FOR_DRIVER: 'primary',
  INVESTIGATION: 'primary',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};

export const DISPUTE_PRIORITY_LABELS: Record<DisputePriority, string> = {
  get LOW() { return translate('Faible'); },
  get MEDIUM() { return translate('Normale'); },
  get HIGH() { return translate('Haute'); },
  get CRITICAL() { return translate('Critique'); },
};
