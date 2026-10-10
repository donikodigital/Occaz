// backend/src/integrations/email/email-provider.interface.ts
export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';

/** Bouton d'action facultatif sous le texte de l'email (ex. « Ouvrir les retraits » vers le back-office). */
export interface EmailAction {
  url: string;
  label: string;
}

/** Pièce jointe d'un email (billet, étiquettes…). `content` est le fichier lui-même. */
export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface EmailProvider {
  send(toEmail: string, subject: string, body: string, action?: EmailAction, attachments?: EmailAttachment[]): Promise<void>;
}
