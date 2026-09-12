// web-admin/src/utils/notificationLabels.ts
import type { NotificationChannel, NotificationType } from '@/types/notificationTemplates.types';

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  BOOKING: 'Réservation',
  PAYMENT: 'Paiement confirmé',
  DRIVER_ACCEPTED: 'Chauffeur trouvé',
  DRIVER_REJECTED: 'Chauffeur indisponible',
  DEPARTURE_IMMINENT: 'Départ imminent',
  ARRIVAL: 'Arrivée à destination',
  OTP: 'Code de vérification',
  DELIVERY: 'Colis livré',
  DRIVER_PAYMENT: 'Paiement reçu',
  DISPUTE: 'Litige',
  REFUND: 'Remboursement',
  STATUS_CHANGE: 'Mise à jour',
  SUPPORT_MESSAGE: 'Message du support',
};

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  PUSH: 'Notification push',
  SMS: 'SMS',
  EMAIL: 'Email',
};
