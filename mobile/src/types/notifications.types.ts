// mobile/src/types/notifications.types.ts
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
  | 'SUPPORT_MESSAGE';

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