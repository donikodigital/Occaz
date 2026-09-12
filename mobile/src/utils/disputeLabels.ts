// mobile/src/utils/disputeLabels.ts
import type { DisputePriority, DisputeStatus } from '@/types/disputes.types';

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  OPENED: 'Ouvert',
  UNDER_REVIEW: 'En cours d\'examen',
  WAITING_FOR_CUSTOMER: 'En attente de votre réponse',
  WAITING_FOR_DRIVER: 'En attente du chauffeur',
  INVESTIGATION: 'En investigation',
  RESOLVED: 'Résolu',
  CLOSED: 'Clos',
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
  LOW: 'Faible',
  MEDIUM: 'Normale',
  HIGH: 'Haute',
  CRITICAL: 'Critique',
};
