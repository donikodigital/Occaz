// web-admin/src/utils/disputeLabels.ts
import type { DisputePriority, DisputeResolutionType, DisputeStatus } from '@/types/disputes.types';

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  OPENED: 'Ouvert',
  UNDER_REVIEW: "En cours d'examen",
  WAITING_FOR_CUSTOMER: 'En attente du client',
  WAITING_FOR_DRIVER: 'En attente du chauffeur',
  INVESTIGATION: 'En investigation',
  RESOLVED: 'Résolu',
  CLOSED: 'Clos',
};

export const DISPUTE_STATUS_TONE: Record<DisputeStatus, 'primary' | 'success' | 'accent' | 'danger' | 'neutral'> = {
  OPENED: 'primary',
  UNDER_REVIEW: 'primary',
  WAITING_FOR_CUSTOMER: 'accent',
  WAITING_FOR_DRIVER: 'accent',
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

export const DISPUTE_PRIORITY_TONE: Record<DisputePriority, 'primary' | 'success' | 'accent' | 'danger' | 'neutral'> = {
  LOW: 'neutral',
  MEDIUM: 'primary',
  HIGH: 'accent',
  CRITICAL: 'danger',
};

export const DISPUTE_RESOLUTION_TYPE_LABELS: Record<DisputeResolutionType, string> = {
  FULL_REFUND: 'Remboursement total',
  PARTIAL_REFUND: 'Remboursement partiel',
  DRIVER_PAYOUT: 'Paiement au chauffeur',
  SHARED_RESPONSIBILITY: 'Responsabilité partagée',
  CANCELLATION: 'Annulation',
  SANCTION: 'Sanction',
  SUSPENSION: 'Suspension de compte',
  NO_ACTION: 'Aucune action',
};
