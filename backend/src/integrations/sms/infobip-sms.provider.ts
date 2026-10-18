// backend/src/integrations/sms/infobip-sms.provider.ts
// [18/10/2026] v1 — Infobip (infobip.com) : vrai fournisseur SMS cloud, sans téléphone à garder allumé (contrairement à TextBee). Couvre la
// Guinée avec une liaison directe aux opérateurs Orange et MTN, ainsi que la plupart des pays de la zone XOF.
import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms-provider.interface';

/** Réponse de POST /sms/3/messages : un état par message (PENDING = accepté, la remise au téléphone est asynchrone). */
interface InfobipSendResponse {
  messages?: { messageId?: string; status?: { groupName?: string; name?: string; description?: string } }[];
  requestError?: { serviceException?: { text?: string } };
}

/** Groupes d'état qui signifient « ce message ne partira pas » (le reste : PENDING / DELIVERED = bon signe). */
const FAILED_GROUPS = ['REJECTED', 'UNDELIVERABLE'];

const TIMEOUT_MS = 15_000;

/** « https://xxxxx.api.infobip.com/ » ou « xxxxx.api.infobip.com » -> « https://xxxxx.api.infobip.com ». */
export function normalizeInfobipBaseUrl(raw: string | undefined): string {
  const value = (raw ?? '').trim().replace(/\/+$/, '');
  if (!value) return 'https://api.infobip.com';
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/** Infobip attend le numéro au format international, sans « + » ni espaces : « +224622343234 » -> « 224622343234 ». */
export function toInfobipNumber(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

/**
 * Initialisation différée (même principe que TextBee, Resend, Mapbox) : sans INFOBIP_API_KEY le backend démarre normalement, seul un envoi
 * réel échoue, avec un message clair. Le choix du fournisseur se fait dans sms.module.ts.
 *
 * Variables : INFOBIP_API_KEY (clé avec la portée « sms:message:send »), INFOBIP_BASE_URL (l'adresse personnelle de TON compte, affichée sur
 * la page d'accueil du portail Infobip, ex. « xxxxx.api.infobip.com »), INFOBIP_SENDER (nom d'expéditeur, ex. « OccaZ » ; facultatif —
 * sans lui, Infobip utilise son expéditeur par défaut, seul autorisé pendant l'essai gratuit).
 */
@Injectable()
export class InfobipSmsProvider implements SmsProvider {
  private readonly logger = new Logger('SMS');

  async send(toPhone: string, message: string): Promise<void> {
    const apiKey = process.env.INFOBIP_API_KEY;
    if (!apiKey) {
      throw new Error("Variable d'environnement INFOBIP_API_KEY manquante — voir .env.example (section SMS).");
    }

    const baseUrl = normalizeInfobipBaseUrl(process.env.INFOBIP_BASE_URL);
    const sender = process.env.INFOBIP_SENDER?.trim();

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/sms/3/messages`, {
        method: 'POST',
        headers: {
          Authorization: `App ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              ...(sender ? { sender } : {}),
              destinations: [{ to: toInfobipNumber(toPhone) }],
              content: { text: message },
            },
          ],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new Error(`Connexion à Infobip impossible : ${(error as Error).message}`);
    }

    const raw = await response.text().catch(() => '');
    if (!response.ok) {
      throw new Error(`Infobip a répondu ${response.status}${raw ? ` : ${raw.slice(0, 300)}` : ''}.`);
    }

    // 200 ne veut pas dire « parti » : Infobip peut refuser le message dans le corps (numéro invalide, expéditeur non autorisé…).
    let body: InfobipSendResponse = {};
    try {
      body = raw ? (JSON.parse(raw) as InfobipSendResponse) : {};
    } catch {
      return; // corps illisible mais statut 200 : on considère l'envoi accepté
    }
    const status = body.messages?.[0]?.status;
    if (status?.groupName && FAILED_GROUPS.includes(status.groupName)) {
      throw new Error(`Infobip a refusé le SMS (${status.name ?? status.groupName}) : ${status.description ?? 'sans détail'}.`);
    }
    this.logger.debug(`SMS accepté par Infobip (${body.messages?.[0]?.messageId ?? 'sans identifiant'}).`);
  }
}
