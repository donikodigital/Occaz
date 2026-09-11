// backend/src/notifications/notifications.service.ts
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationChannel, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationTemplatesService } from './notification-templates.service';
import { SMS_PROVIDER, SmsProvider } from '../integrations/sms/sms-provider.interface';
import { PUSH_PROVIDER, PushProvider } from '../integrations/push/push-provider.interface';
import { EMAIL_PROVIDER, EmailProvider } from '../integrations/email/email-provider.interface';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';

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

    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        templateId: template?.id,
        type: params.type,
        channel,
        payload: params.payload as never,
      },
    });

    try {
      await this.send(params.userId, channel, subject ?? '', body);
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

  private async send(userId: string, channel: NotificationChannel, title: string, body: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('Utilisateur introuvable.');

    switch (channel) {
      case NotificationChannel.PUSH: {
        const devices = await this.prisma.device.findMany({
          where: { userId, pushToken: { not: null } },
        });
        const tokens = devices.map((d) => d.pushToken).filter((t): t is string => Boolean(t));
        await this.pushProvider.send(tokens, title, body);
        return;
      }
      case NotificationChannel.SMS:
        await this.smsProvider.send(user.phone, body);
        return;
      case NotificationChannel.EMAIL:
        if (!user.email) throw new Error("L'utilisateur n'a pas d'adresse email.");
        await this.emailProvider.send(user.email, title, body);
        return;
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

  async findMine(userId: string, query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    const where = { userId };
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  async markRead(id: string, userId: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification introuvable.');
    }
    await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
