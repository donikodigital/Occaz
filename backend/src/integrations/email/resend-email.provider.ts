// backend/src/integrations/email/resend-email.provider.ts
import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider } from './email-provider.interface';

/**
 * Initialisation différée (même principe que StorageService et
 * MapboxGeocodingProvider) : tant que RESEND_API_KEY n'est pas
 * renseignée, le reste du backend démarre normalement — seul un envoi
 * réel échoue, avec un message clair plutôt qu'un crash au démarrage.
 * Utilisable dès que le compte Resend existe et qu'un domaine
 * d'expédition y est vérifié (obligatoire côté Resend, indépendant de
 * ce code).
 */
@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly logger = new Logger('Email');
  private readonly endpoint = 'https://api.resend.com/emails';

  async send(toEmail: string, subject: string, body: string): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Variable d'environnement RESEND_API_KEY manquante — voir .env.example (section email).",
      );
    }
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    if (!fromEmail) {
      throw new Error(
        "Variable d'environnement RESEND_FROM_EMAIL manquante — doit être une adresse sur un domaine vérifié dans Resend.",
      );
    }

    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: toEmail,
          subject,
          text: body,
          // Emballage minimal — préserve les retours à la ligne sans construire
          // un système de templates HTML complet, hors scope ici.
          html: `<p style="font-family: sans-serif; white-space: pre-line;">${escapeHtml(body)}</p>`,
        }),
      });
    } catch (error) {
      throw new Error(`Connexion au service email Resend impossible : ${(error as Error).message}`);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Resend a répondu ${response.status}${detail ? ` : ${detail.slice(0, 300)}` : ''}.`);
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
