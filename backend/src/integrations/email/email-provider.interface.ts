// backend/src/integrations/email/email-provider.interface.ts
export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';

/** Bouton d'action facultatif sous le texte de l'email (ex. « Ouvrir les retraits » vers le back-office). */
export interface EmailAction {
  url: string;
  label: string;
}

export interface EmailProvider {
  send(toEmail: string, subject: string, body: string, action?: EmailAction): Promise<void>;
}
