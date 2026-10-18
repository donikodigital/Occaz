// backend/src/integrations/sms/orange-sms.provider.ts
// [18/10/2026] v1 — API SMS d'Orange Developer pour la Guinée (https://developer.orange.com/apis/sms-gn) : environ 100 à 200 GNF par SMS
// (packs achetés dans « My apps »), contre plus de 2 000 GNF chez un agrégateur international. Ne couvre que la Guinée : les autres pays
// passent par le fournisseur international (voir routing-sms.provider.ts).
import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms-provider.interface';

const TIMEOUT_MS = 15_000;
/** On renouvelle le jeton un peu avant son expiration (Orange le délivre pour 3600 s). */
const TOKEN_SAFETY_MARGIN_MS = 60_000;
const DEFAULT_BASE_URL = 'https://api.orange.com';
/** Adresse d'expéditeur « pays » de la Guinée : à confirmer dans ta documentation Orange (ORANGE_SMS_SENDER_ADDRESS la remplace). */
const DEFAULT_SENDER_ADDRESS = 'tel:+224000';

/** « https://api.orange.com/ » ou « api.orange.com » -> « https://api.orange.com ». */
export function normalizeOrangeBaseUrl(raw: string | undefined): string {
  const value = (raw ?? '').trim().replace(/\/+$/, '');
  if (!value) return DEFAULT_BASE_URL;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/** « +224 622 34 32 34 » -> « tel:+224622343234 » (format attendu par Orange). */
export function toOrangeAddress(phone: string): string {
  return `tel:+${phone.replace(/[^\d]/g, '')}`;
}

/** « tel:+224000 » (ou « +224000 », « 224000 ») -> « tel:+224000 ». */
export function normalizeSenderAddress(raw: string | undefined): string {
  const digits = (raw ?? '').replace(/[^\d]/g, '');
  return digits ? `tel:+${digits}` : DEFAULT_SENDER_ADDRESS;
}

/** En-tête Authorization de la demande de jeton : fourni tel quel par Orange, ou construit avec l'identifiant et le secret. */
export function buildOrangeAuthorization(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const given = env.ORANGE_SMS_AUTHORIZATION_HEADER?.trim();
  if (given) return /^basic\s/i.test(given) ? given : `Basic ${given}`;
  const id = env.ORANGE_SMS_CLIENT_ID?.trim();
  const secret = env.ORANGE_SMS_CLIENT_SECRET?.trim();
  if (!id || !secret) return undefined;
  return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;
}

/** Vrai quand les variables permettent d'obtenir un jeton Orange (utilisé par le choix du fournisseur). */
export function isOrangeSmsConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return buildOrangeAuthorization(env) !== undefined;
}

/** Message lisible tiré d'une réponse d'erreur Orange (formats « requestError » ou « code / message / description »). */
function describeError(raw: string): string {
  if (!raw) return '';
  try {
    const body = JSON.parse(raw) as {
      requestError?: { serviceException?: { messageId?: string; text?: string; variables?: string } };
      code?: number | string;
      message?: string;
      description?: string;
      error_description?: string;
    };
    const service = body.requestError?.serviceException;
    if (service) return [service.messageId, service.text, service.variables].filter(Boolean).join(' — ');
    return [body.code, body.message, body.description ?? body.error_description].filter(Boolean).join(' — ') || raw.slice(0, 300);
  } catch {
    return raw.slice(0, 300);
  }
}

/**
 * Initialisation différée (comme Infobip, TextBee, Resend…) : sans les variables, le backend démarre normalement, seul un envoi réel
 * échoue, avec un message clair.
 *
 * Variables : ORANGE_SMS_CLIENT_ID + ORANGE_SMS_CLIENT_SECRET (ou ORANGE_SMS_AUTHORIZATION_HEADER, l'en-tête « Basic … » que
 * le portail affiche), ORANGE_SMS_SENDER_ADDRESS (facultatif, « tel:+224000 » par défaut), ORANGE_SMS_SENDER_NAME (facultatif : nom
 * d'expéditeur personnalisé, à faire approuver par Orange — sinon l'API répond une erreur 400), ORANGE_SMS_BASE_URL (facultatif).
 *
 * Deux appels : un jeton OAuth (valable une heure, gardé en mémoire et renouvelé avant l'échéance), puis l'envoi du SMS.
 */
@Injectable()
export class OrangeSmsProvider implements SmsProvider {
  private readonly logger = new Logger('SMS');
  private token?: { value: string; expiresAt: number };
  /** Une seule demande de jeton à la fois : plusieurs SMS simultanés n'en déclenchent pas plusieurs. */
  private pendingToken?: Promise<string>;

  async send(toPhone: string, message: string): Promise<void> {
    if (!isOrangeSmsConfigured()) {
      throw new Error('ORANGE_SMS_CLIENT_ID / ORANGE_SMS_CLIENT_SECRET manquantes — voir .env.example (section SMS).');
    }

    let response = await this.post(toPhone, message, await this.getToken());
    if (response.status === 401) {
      // Jeton refusé (expiré ou révoqué) : on en demande un neuf et on réessaie une seule fois.
      this.token = undefined;
      response = await this.post(toPhone, message, await this.getToken());
    }

    const raw = await response.text().catch(() => '');
    if (!response.ok) {
      throw new Error(`Orange a répondu ${response.status}${raw ? ` : ${describeError(raw)}` : ''}.`);
    }
    this.logger.debug(`SMS accepté par Orange (${response.headers.get('location') ?? 'sans identifiant'}).`);
  }

  private async post(toPhone: string, message: string, token: string): Promise<Response> {
    const baseUrl = normalizeOrangeBaseUrl(process.env.ORANGE_SMS_BASE_URL);
    const senderAddress = normalizeSenderAddress(process.env.ORANGE_SMS_SENDER_ADDRESS);
    const senderName = process.env.ORANGE_SMS_SENDER_NAME?.trim();

    try {
      return await fetch(`${baseUrl}/smsmessaging/v1/outbound/${encodeURIComponent(senderAddress)}/requests`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          outboundSMSMessageRequest: {
            address: toOrangeAddress(toPhone),
            senderAddress,
            ...(senderName ? { senderName } : {}),
            outboundSMSTextMessage: { message },
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new Error(`Connexion à Orange impossible : ${(error as Error).message}`);
    }
  }

  private async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt - TOKEN_SAFETY_MARGIN_MS > Date.now()) return this.token.value;
    this.pendingToken ??= this.fetchToken().finally(() => {
      this.pendingToken = undefined;
    });
    return this.pendingToken;
  }

  private async fetchToken(): Promise<string> {
    const authorization = buildOrangeAuthorization();
    if (!authorization) throw new Error('ORANGE_SMS_CLIENT_ID / ORANGE_SMS_CLIENT_SECRET manquantes.');

    let response: Response;
    try {
      response = await fetch(`${normalizeOrangeBaseUrl(process.env.ORANGE_SMS_BASE_URL)}/oauth/v3/token`, {
        method: 'POST',
        headers: { Authorization: authorization, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new Error(`Connexion à Orange impossible : ${(error as Error).message}`);
    }

    const raw = await response.text().catch(() => '');
    if (!response.ok) {
      throw new Error(`Orange a refusé l'authentification (${response.status})${raw ? ` : ${describeError(raw)}` : ''}.`);
    }
    let body: { access_token?: string; expires_in?: string | number } = {};
    try {
      body = JSON.parse(raw);
    } catch {
      // traité plus bas
    }
    if (!body.access_token) throw new Error("Orange n'a pas renvoyé de jeton d'accès.");

    const lifetimeSeconds = Number(body.expires_in) > 0 ? Number(body.expires_in) : 3600;
    this.token = { value: body.access_token, expiresAt: Date.now() + lifetimeSeconds * 1000 };
    return body.access_token;
  }
}
