// backend/src/integrations/email/email-provider.interface.ts
export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';

export interface EmailProvider {
  send(toEmail: string, subject: string, body: string): Promise<void>;
}
