// backend/src/notifications/notifications.service.ts
// [21/09/2026] v2 — pushData et pushOptions transmis au fournisseur push.
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AccountType, NotificationChannel, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationTemplatesService } from './notification-templates.service';
import { SMS_PROVIDER, SmsProvider } from '../integrations/sms/sms-provider.interface';
import { PUSH_PROVIDER, PushOptions, PushProvider } from '../integrations/push/push-provider.interface';
import { EMAIL_PROVIDER, EmailProvider } from '../integrations/email/email-provider.interface';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { OtpSettingsService } from '../otp/otp-settings.service';

export interface NotifyParams {
  userId: string;
  type: NotificationType;
  /** Par défaut [PUSH] — section 27 : "SMS pour événements critiques" doit être demandé explicitement par l'appelant. */
  channels?: NotificationChannel[];
  /** Valeurs substituées dans le modèle ({{cle}}) et conservées sur la ligne Notification pour audit. */
  payload?: Record<string, unknown>;
  /** Utilisés si aucun NotificationTemplate actif n'existe pour (type, canal, locale). */
  fallbackTitle?: string;
  fallbackBody?: string;
  /** Données jointes au push (ex: { type, shipmentId }) pour que l'app sache où ouvrir la notification. */
  pushData?: Record<string, unknown>;
  /** Canal Android / priorité du push — voir PushOptions. */
  pushOptions?: PushOptions;
}

/**
 * Point d'entrée unique d'envoi (section 27). Les autres modules
 * n'appellent jamais un provider directement — toujours NotificationsService,
 * qui choisit le modèle, restitue le texte final et trace l'envoi
 * (Notification.sentAt / failedReason), même en cas d'échec du canal.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: NotificationTemplatesService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
    @Inject(PUSH_PROVIDER) private readonly pushProvider: PushProvider,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    private readonly otpSettings: OtpSettingsService,
  ) {}

  async notify(params: NotifyParams): Promise<void> {
    const channels = params.channels ?? [NotificationChannel.PUSH];
    await Promise.all(channels.map((channel) => this.dispatchOne(params, channel)));
  }

  private async dispatchOne(params: NotifyParams, channel: NotificationChannel): Promise<void> {
    const template = await this.templates.findActive(params.type, channel);
    const body = template
      ? this.renderTemplate(template.body, params.payload)
      : params.fallbackBody;

    if (!body) {
      this.logger.warn(
        `Aucun modèle actif et aucun texte de repli pour (${params.type}, ${channel}) — notification ignorée.`,
      );
      return;
    }
    const subject = template?.subject
      ? this.renderTemplate(template.subject, params.payload)
      : params.fallbackTitle;

    // title/body persistés désormais (auparavant jetés après l'envoi) —
    // sans ça, le client ne pouvait distinguer aucune notification du
    // même NotificationType (ex: STATUS_CHANGE couvre validation
    // conducteur, suspension, vérif véhicule/document...), toutes
    // rendues avec le même libellé générique côté mobile.
    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        templateId: template?.id,
        type: params.type,
        channel,
        title: subject ?? null,
        body,
        payload: params.payload as never,
      },
    });

    try {
      await this.send(params.userId, channel, subject ?? '', body, params.pushData, params.pushOptions);
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { sentAt: new Date() },
      });
    } catch (error) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { failedReason: (error as Error).message?.slice(0, 500) },
      });
    }
  }

  private async send(
    userId: string,
    channel: NotificationChannel,
    title: string,
    body: string,
    pushData?: Record<string, unknown>,
    pushOptions?: PushOptions,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('Utilisateur introuvable.');

    switch (channel) {
      case NotificationChannel.PUSH: {
        const devices = await this.prisma.device.findMany({
          where: { userId, pushToken: { not: null } },
        });
        const tokens = devices.map((d) => d.pushToken).filter((t): t is string => Boolean(t));
        await this.pushProvider.send(tokens, title, body, pushData, pushOptions);
        return;
      }
      case NotificationChannel.SMS:
        await this.assertSmsBudget(userId);
        await this.smsProvider.send(user.phone, body);
        return;
      case NotificationChannel.EMAIL:
        if (!user.email) throw new Error("L'utilisateur n'a pas d'adresse email.");
        await this.emailProvider.send(user.email, title, body);
        return;
    }
  }

  /**
   * Plafond de SMS de notification par utilisateur et par 24 h (réglable dans l'administration, 0 = illimité). Un SMS refusé
   * ici est tracé comme un échec de ce canal (failedReason) ; la notification reste lisible dans l'application et le push
   * part normalement. Les SMS de codes (connexion, remise) ont leurs propres plafonds : ils ne passent pas par ici.
   */
  private async assertSmsBudget(userId: string): Promise<void> {
    const { notificationSmsDailyLimitPerUser: limit } = await this.otpSettings.get();
    if (limit <= 0) return;
    const sentToday = await this.prisma.notification.count({
      where: {
        userId,
        channel: NotificationChannel.SMS,
        sentAt: { not: null },
        createdAt: { gte: new Date(Date.now() - 24 * 3_600_000) },
      },
    });
    if (sentToday >= limit) {
      throw new Error(`Plafond quotidien de SMS de notification atteint (${limit}) — SMS non envoyé.`);
    }
  }

  private renderTemplate(template: string, payload?: Record<string, unknown>): string {
    if (!payload) return template;
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) =>
      key in payload ? String(payload[key]) : match,
    );
  }

  // ---------------------------------------------------------------------
  // Boîte de réception
  // ---------------------------------------------------------------------

  /**
   * notify() enregistre une ligne par CANAL (push/email/sms) pour un même
   * événement (voir dispatchOne ci-dessous) — utile pour suivre l'envoi
   * de chacun séparément, mais ça faisait apparaître "Conducteur trouvé"
   * ou "Paiement confirmé" deux fois dans la liste du client, comme deux
   * événements distincts. On ne garde que la première ligne par (type,
   * title, body) créée à quelques secondes d'écart : assez large pour
   * regrouper les canaux d'un même envoi (partis dans le même
   * Promise.all), jamais assez pour fusionner deux événements réellement
   * différents. Pagination faite en mémoire après déduplication plutôt
   * qu'en base : le volume par utilisateur reste modeste, pas la peine
   * d'ajouter une colonne de regroupement en base pour l'instant.
   */
  /** Boîte de réception d'un utilisateur : plus récentes d'abord, un seul élément par événement (voir findMine). */
  private async dedupedInbox(userId: string) {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const DEDUPE_WINDOW_MS = 5_000;
    const deduped: typeof rows = [];
    for (const row of rows) {
      const isDuplicate = deduped.some(
        (kept) =>
          kept.type === row.type &&
          kept.title === row.title &&
          kept.body === row.body &&
          Math.abs(kept.createdAt.getTime() - row.createdAt.getTime()) < DEDUPE_WINDOW_MS,
      );
      if (!isDuplicate) deduped.push(row);
    }
    return deduped;
  }

  async findMine(userId: string, query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    const deduped = await this.dedupedInbox(userId);
    const total = deduped.length;
    const data = deduped.slice(query.skip, query.skip + query.take);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  /** Nombre de notifications non lues (un événement envoyé sur plusieurs canaux ne compte qu'une fois) — pour la pastille de la cloche. */
  async unreadCount(userId: string): Promise<{ count: number }> {
    const deduped = await this.dedupedInbox(userId);
    return { count: deduped.filter((row) => row.readAt === null).length };
  }

  /**
   * Les lignes « jumelles » d'une notification : le même événement envoyé sur d'autres canaux (même type, même texte, à
   * quelques secondes d'écart). La boîte n'en montre qu'une ; lire ou supprimer celle-là doit donc traiter aussi les autres,
   * sinon la jumelle cachée réapparaîtrait comme une notification non lue ou « ressuscitée ».
   */
  private twinsWhere(notification: { userId: string; type: NotificationType; title: string | null; body: string | null; createdAt: Date }): Prisma.NotificationWhereInput {
    const WINDOW_MS = 5_000;
    return {
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      createdAt: {
        gt: new Date(notification.createdAt.getTime() - WINDOW_MS),
        lt: new Date(notification.createdAt.getTime() + WINDOW_MS),
      },
    };
  }

  async markRead(id: string, userId: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification introuvable.');
    }
    await this.prisma.notification.updateMany({
      where: { ...this.twinsWhere(notification), readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification introuvable.');
    }
    await this.prisma.notification.deleteMany({ where: this.twinsWhere(notification) });
  }

  /**
   * Suppression groupée (sélection multiple côté client) — filtrée par
   * userId dans la clause `where` elle-même plutôt que vérifiée id par
   * id : un id qui n'appartient pas à l'appelant est silencieusement
   * ignoré (ni supprimé, ni erreur), jamais une 404 qui bloquerait la
   * suppression du reste de la sélection.
   */
  async removeMany(ids: string[], userId: string): Promise<void> {
    if (ids.length === 0) return;
    const selected = await this.prisma.notification.findMany({ where: { id: { in: ids }, userId } });
    if (selected.length === 0) return;
    await this.prisma.notification.deleteMany({
      where: { OR: selected.map((notification) => this.twinsWhere(notification)) },
    });
  }

  /** Vide toute la boîte de réception de l'utilisateur. */
  async removeAll(userId: string): Promise<void> {
    await this.prisma.notification.deleteMany({ where: { userId } });
  }

  // ---------------------------------------------------------------------
  // Alertes pour l'équipe (cloche du back-office)
  // ---------------------------------------------------------------------

  /**
   * Alerte l'équipe d'un événement à traiter (retrait à valider, conducteur à vérifier, document à contrôler…). Destinataires :
   * les SuperAdmins actifs et les comptes dont un rôle porte la permission demandée (limité à leurs pays quand le rôle l'est).
   * Rien n'est envoyé hors de l'application : la notification s'affiche dans la cloche du back-office. Ne lève jamais
   * d'exception — une alerte manquée ne doit pas défaire l'opération qui l'a déclenchée.
   */
  async notifyStaff(params: {
    permission: string;
    type: NotificationType;
    title: string;
    body: string;
    /** Page du back-office à ouvrir au clic (ex. « /payouts »). */
    link?: string;
    /** Si renseigné, un rôle limité à un pays n'est alerté que pour ces pays ; un rôle sans pays l'est toujours. */
    countryIds?: string[];
    payload?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const staff = await this.prisma.user.findMany({
        where: {
          isActive: true,
          OR: [
            { accountType: AccountType.SUPERADMIN },
            {
              userRoles: {
                some: {
                  role: { permissions: { some: { permission: { key: params.permission } } } },
                  ...(params.countryIds ? { OR: [{ countryId: null }, { countryId: { in: params.countryIds } }] } : {}),
                },
              },
            },
          ],
        },
        select: { id: true },
      });
      if (staff.length === 0) return;

      const payload = { ...params.payload, link: params.link, audience: 'STAFF' } as Prisma.InputJsonValue;
      const now = new Date();
      await this.prisma.notification.createMany({
        data: staff.map((user) => ({
          userId: user.id,
          type: params.type,
          channel: NotificationChannel.PUSH,
          title: params.title,
          body: params.body,
          payload,
          sentAt: now,
        })),
      });
    } catch (error) {
      this.logger.warn(`Alerte équipe non enregistrée (${params.title}) : ${(error as Error).message}`);
    }
  }
}
