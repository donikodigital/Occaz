// mobile/src/utils/notificationLabels.ts
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [21/09/2026] v+ — libellés SHIPMENT_REQUEST et SHIPMENT_EXTENSION.
import type { NotificationType } from '@/types/notifications.types';
import { translate } from '@/i18n';

/**
 * Le backend ne persiste jamais le texte réellement envoyé (seul `type`
 * est stocké sur la ligne Notification, le corps du message est rendu
 * à la volée au moment de l'envoi puis jeté) — ces libellés sont donc
 * générés côté client à partir du type, comme les statuts de trajet/
 * réservation/envoi ailleurs dans l'app.
 */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  get BOOKING() { return translate('Réservation'); },
  get PAYMENT() { return translate('Paiement confirmé'); },
  get DRIVER_ACCEPTED() { return translate('Conducteur trouvé'); },
  get DRIVER_REJECTED() { return translate('Conducteur indisponible'); },
  get DEPARTURE_IMMINENT() { return translate('Départ imminent'); },
  get ARRIVAL() { return translate('Arrivée à destination'); },
  get OTP() { return translate('Code de vérification'); },
  get DELIVERY() { return translate('Colis livré'); },
  get DRIVER_PAYMENT() { return translate('Paiement reçu'); },
  get DISPUTE() { return translate('Litige'); },
  get REFUND() { return translate('Remboursement'); },
  get STATUS_CHANGE() { return translate('Mise à jour'); },
  get SUPPORT_MESSAGE() { return translate('Message du support'); },
  get SHIPMENT_REQUEST() { return translate("Nouvelle demande d'envoi"); },
  get SHIPMENT_EXTENSION() { return translate('Prolonger votre envoi'); },
  get SHIPMENT_INVITATION() { return translate('Un colis à transporter'); },
  get CONVERSATION_MESSAGE() { return translate('Nouveau message'); },
  get SAFETY() { return translate('Sécurité'); },
};