// web-admin/src/types/notificationTemplates.types.ts
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

export interface NotificationTemplate {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  locale: string;
  subject: string | null;
  body: string;
  isActive: boolean;
}

export interface UpsertNotificationTemplatePayload {
  type: NotificationType;
  channel: NotificationChannel;
  locale?: string;
  subject?: string;
  body: string;
  isActive?: boolean;
}
