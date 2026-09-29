// backend/src/integrations/sms/textbee-sms.provider.ts
import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms-provider.interface';

/**
 * TextBee (textbee.dev) — passerelle SMS via un téléphone Android réel
 * (voir README, section géocodage/notifications pour le contexte des
 * autres fournisseurs). L'API TextBee exige désormais l'identifiant de
 * l'appareil dans l'URL de la requête (elle ne retombe plus sur
 * l'appareil actif par défaut quand il est omis) : sans lui, TextBee
 * répond 400 "No enabled device found. Enable a device or pass a
 * deviceId." — c'est cette erreur qui remontait jusqu'à l'app.
 *
 * Initialisation différée (même principe que StorageService,
 * MapboxGeocodingProvider, ResendEmailProvider) : tant que
 * TEXTBEE_API_KEY ou TEXTBEE_DEVICE_ID n'est pas renseignée, le reste
 * du backend démarre normalement — seul un envoi réel échoue, avec un
 * message clair.
 */
@Injectable()
export class TextBeeSmsProvider implements SmsProvider {
  private readonly logger = new Logger('SMS');
  private readonly baseUrl = 'https://api.textbee.dev/api/v1/gateway/devices';

  async send(toPhone: string, message: string): Promise<void> {
    const apiKey = process.env.TEXTBEE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Variable d'environnement TEXTBEE_API_KEY manquante — voir .env.example (section SMS).",
      );
    }

    const deviceId = process.env.TEXTBEE_DEVICE_ID;
    if (!deviceId) {
      throw new Error(
        "Variable d'environnement TEXTBEE_DEVICE_ID manquante (identifiant de l'appareil, visible dans le tableau de bord TextBee) — voir .env.example (section SMS).",
      );
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/${deviceId}/send-sms`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipients: [toPhone],
          message,
        }),
      });
    } catch (error) {
      throw new Error(`Connexion à TextBee impossible : ${(error as Error).message}`);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`TextBee a répondu ${response.status}${detail ? ` : ${detail.slice(0, 300)}` : ''}.`);
    }
  }
}