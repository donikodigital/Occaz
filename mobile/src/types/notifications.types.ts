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
  readAt: string | null;
  sentAt: string | null;
  failedReason: string | null;
  createdAt: string;
}
