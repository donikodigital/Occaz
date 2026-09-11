// backend/src/integrations/sms/sms-provider.interface.ts
/**
 * Abstraction du canal SMS — même principe que PaymentService dans le
 * cahier des charges (section 14) : le reste de l'application ne connaît
 * que ce contrat, jamais un SDK de prestataire précis. Permet de brancher
 * un vrai fournisseur (Orange, Twilio...) plus tard sans toucher au
 * module Auth qui l'utilise pour l'envoi des codes OTP.
 */
export const SMS_PROVIDER = 'SMS_PROVIDER';

export interface SmsProvider {
  send(toPhone: string, message: string): Promise<void>;
}
