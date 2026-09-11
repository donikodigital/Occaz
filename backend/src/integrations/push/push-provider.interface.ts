// backend/src/integrations/push/push-provider.interface.ts
/**
 * Abstraction du canal push — même principe que SmsProvider (Lot 1) et
 * PaymentProviderAdapter (Lot 5) : aucun module métier ne parle jamais
 * directement à Expo/Firebase, uniquement à ce contrat.
 */
export const PUSH_PROVIDER = 'PUSH_PROVIDER';

export interface PushProvider {
  send(pushTokens: string[], title: string, body: string, data?: Record<string, unknown>): Promise<void>;
}
