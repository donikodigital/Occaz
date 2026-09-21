// mobile/src/utils/notificationLabels.ts
// [21/09/2026] v+ — libellés SHIPMENT_REQUEST et SHIPMENT_EXTENSION.
import type { NotificationType } from '@/types/notifications.types';

/**
 * Le backend ne persiste jamais le texte réellement envoyé (seul `type`
 * est stocké sur la ligne Notification, le corps du message est rendu
 * à la volée au moment de l'envoi puis jeté) — ces libellés sont donc
 * générés côté client à partir du type, comme les statuts de trajet/
 * réservation/envoi ailleurs dans l'app.
 */
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
  SHIPMENT_REQUEST: "Nouvelle demande d'envoi",
  SHIPMENT_EXTENSION: 'Prolonger votre envoi',
};