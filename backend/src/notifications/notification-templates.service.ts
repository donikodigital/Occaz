// backend/src/notifications/notification-templates.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationChannel, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';

@Injectable()
export class NotificationTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.notificationTemplate.findMany({ orderBy: [{ type: 'asc' }, { channel: 'asc' }] });
  }

  async findOne(id: string) {
    const template = await this.prisma.notificationTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Modèle de notification introuvable.');
    return template;
  }

  /** Utilisé par NotificationsService au moment de l'envoi — repli sur `null` si aucun modèle actif n'existe. */
  findActive(type: NotificationType, channel: NotificationChannel, locale = 'fr') {
    return this.prisma.notificationTemplate.findFirst({
      where: { type, channel, locale, isActive: true },
    });
  }

  async create(dto: CreateNotificationTemplateDto, actorId: string) {
    const template = await this.prisma.notificationTemplate.create({
      data: {
        type: dto.type,
        channel: dto.channel,
        locale: dto.locale ?? 'fr',
        subject: dto.subject,
        body: dto.body,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit.log({
      actorId,
      entityType: 'NotificationTemplate',
      entityId: template.id,
      action: 'CREATE',
      diff: { ...dto },
    });
    return template;
  }

  async update(id: string, dto: UpdateNotificationTemplateDto, actorId: string) {
    await this.findOne(id);
    const template = await this.prisma.notificationTemplate.update({
      where: { id },
      data: {
        type: dto.type,
        channel: dto.channel,
        locale: dto.locale,
        subject: dto.subject,
        body: dto.body,
        isActive: dto.isActive,
      },
    });
    await this.audit.log({
      actorId,
      entityType: 'NotificationTemplate',
      entityId: id,
      action: 'UPDATE',
      diff: { ...dto },
    });
    return template;
  }
}
