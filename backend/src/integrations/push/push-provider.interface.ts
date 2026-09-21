// backend/src/integrations/push/push-provider.interface.ts
// [21/09/2026] v2 — PushOptions (canal Android, priorité).
/**
 * Abstraction du canal push — même principe que SmsProvider (Lot 1) et
 * PaymentProviderAdapter (Lot 5) : aucun module métier ne parle jamais
 * directement à Expo/Firebase, uniquement à ce contrat.
 */
export const PUSH_PROVIDER = 'PUSH_PROVIDER';

/**
 * Réglages d'affichage propres à un envoi — utilisés pour les alertes qui
 * doivent sonner et s'afficher tout de suite (nouvelle demande d'envoi) : un
 * canal Android à forte importance, créé côté app, et la priorité haute.
 */
export interface PushOptions {
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
}

export interface PushProvider {
  send(
    pushTokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
    options?: PushOptions,
  ): Promise<void>;
}