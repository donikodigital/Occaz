// mobile/src/types/notifications.types.ts
// [21/09/2026] v+ — types SHIPMENT_REQUEST et SHIPMENT_EXTENSION.
export type NotificationType =
  | 'BOOKING'
  | 'PAYMENT'
  | 'DRIVER_ACCEPTED'
  | 'DRIVER_REJECTED'
  | 'DEPARTURE_IMMINENT'
  | 'ARRIVAL'
  | 'OTP'
  | 'DELIVERY'
  | 'DRIVER_PAYMENT'
  | 'DISPUTE'
  | 'REFUND'
  | 'STATUS_CHANGE'
  | 'SUPPORT_MESSAGE'
  | 'SHIPMENT_REQUEST'
  | 'SHIPMENT_EXTENSION';

export type NotificationChannel = 'PUSH' | 'SMS' | 'EMAIL';

export interface AppNotification {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  /** null pour les notifications envoyées avant cette migration — voir NotificationsInboxScreen pour le repli sur NOTIFICATION_TYPE_LABELS. */
  title: string | null;
  body: string | null;
  readAt: string | null;
  sentAt: string | null;
  failedReason: string | null;
  createdAt: string;
}