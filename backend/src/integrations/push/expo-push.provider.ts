// backend/src/integrations/push/expo-push.provider.ts
// [21/09/2026] v2 — options par push : canal Android et priorité (alerte qui sonne).
import { Injectable, Logger } from '@nestjs/common';
import { PushOptions, PushProvider } from './push-provider.interface';

/**
 * Service push d'Expo — gratuit, aucun compte tiers à créer (contrairement
 * à Orange Money ou TextBee) : n'importe quelle app Expo peut y envoyer des
 * notifications dès qu'un appareil a un token valide. C'est pour ça que ce
 * fournisseur remplace directement ConsolePushProvider comme choix par
 * défaut dans push.module.ts, sans variable d'environnement à activer —
 * rien à configurer pour que ça fonctionne.
 *
 * EXPO_ACCESS_TOKEN (optionnel) : uniquement utile si le volume d'envoi
 * devient important (accès prioritaire côté Expo) — absent, tout
 * fonctionne normalement.
 */
@Injectable()
export class ExpoPushProvider implements PushProvider {
  private readonly logger = new Logger('Push');
  private readonly endpoint = 'https://exp.host/--/api/v2/push/send';
  /** Limite recommandée par Expo par requête — on découpe au-delà. */
  private readonly maxMessagesPerRequest = 100;

  async send(
    pushTokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
    options?: PushOptions,
  ): Promise<void> {
    // Un token invalide (mauvais format) ferait échouer tout le lot côté
    // Expo — filtré ici plutôt que de risquer de perdre les envois valides
    // à cause d'un seul mauvais token.
    const validTokens = pushTokens.filter((token) => /^Expo(nent)?PushToken\[.+\]$/.test(token));
    if (validTokens.length === 0) {
      if (pushTokens.length > 0) {
        this.logger.warn(`${pushTokens.length} token(s) fourni(s), aucun au format Expo valide — rien envoyé.`);
      }
      return;
    }

    const messages = validTokens.map((to) => ({
      to,
      title,
      body,
      data,
      sound: 'default' as const,
      ...(options?.channelId ? { channelId: options.channelId } : {}),
      ...(options?.priority ? { priority: options.priority } : {}),
    }));
    const chunks = this.chunk(messages, this.maxMessagesPerRequest);

    for (const messageChunk of chunks) {
      await this.sendChunk(messageChunk);
    }
  }

  private async sendChunk(messages: unknown[]): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const accessToken = process.env.EXPO_ACCESS_TOKEN;
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(messages),
      });
    } catch (error) {
      // Échec réseau : propagé — l'appelant (NotificationsService)
      // enregistre déjà ce genre d'échec sur la ligne Notification
      // (champ failedReason), inutile de dupliquer cette logique ici.
      throw new Error(`Connexion au service push Expo impossible : ${(error as Error).message}`);
    }

    if (!response.ok) {
      throw new Error(`Le service push Expo a répondu ${response.status}.`);
    }

    const result = (await response.json()) as {
      data?: Array<{ status: 'ok' | 'error'; message?: string; details?: { error?: string } }>;
    };
    const errors = (result.data ?? []).filter((entry) => entry.status === 'error');
    if (errors.length > 0) {
      // Erreurs par destinataire (ex: appareil désinstallé,
      // "DeviceNotRegistered") — normales à la marge, jamais bloquantes
      // pour les autres envois du même lot, donc seulement journalisées.
      this.logger.warn(`${errors.length}/${messages.length} notification(s) push en erreur : ${JSON.stringify(errors.slice(0, 3))}`);
    }
  }

  private chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
    return chunks;
  }
}