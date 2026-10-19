// backend/src/integrations/sms/sms-provider.interface.ts
// [19/10/2026] v2 — `send` reçoit le MOTIF du SMS (SmsPurpose) : la politique d'envoi (voir sms-purpose.ts) refuse tout SMS dont le
// motif n'est pas autorisé, et tout SMS sans motif.
import type { SmsPurpose } from './sms-purpose';

/**
 * Abstraction du canal SMS — même principe que PaymentService dans le
 * cahier des charges (section 14) : le reste de l'application ne connaît
 * que ce contrat, jamais un SDK de prestataire précis. Permet de brancher
 * un vrai fournisseur (Orange, Twilio...) plus tard sans toucher au
 * module Auth qui l'utilise pour l'envoi des codes OTP.
 */
export const SMS_PROVIDER = 'SMS_PROVIDER';

export interface SmsProvider {
  send(toPhone: string, message: string, purpose?: SmsPurpose): Promise<void>;
}
