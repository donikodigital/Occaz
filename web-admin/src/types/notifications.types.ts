// web-admin/src/types/notifications.types.ts
// Boîte de réception du compte connecté (cloche du back-office) — GET /notifications/mine.
import type { NotificationType } from '@/types/notificationTemplates.types';

export interface InboxNotification {
  id: string;
  /** Le serveur peut aussi renvoyer CONVERSATION_MESSAGE (messages client ↔ conducteur), absent des modèles de notification. */
  type: NotificationType | 'CONVERSATION_MESSAGE';
  title: string | null;
  body: string | null;
  /** Pour les alertes de l'équipe : { link: '/payouts', audience: 'STAFF', … }. */
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}
