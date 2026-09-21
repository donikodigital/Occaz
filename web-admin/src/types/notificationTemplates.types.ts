// web-admin/src/types/notificationTemplates.types.ts
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