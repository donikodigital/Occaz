// backend/src/user-safety/sos.service.ts
// [11/10/2026] v1 — alerte SOS : enregistre l'alerte (position, trajet concerné), prévient par SMS les proches enregistrés et alerte le
// support (cloche + email). Une alerte déjà active n'est pas dupliquée : un second appui met seulement la position à jour, pour ne pas
// envoyer dix SMS aux proches. La personne peut annuler (« je suis en sécurité »), les proches en sont alors informés.
import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { NotificationType, Prisma, SosStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SMS_PROVIDER, SmsProvider } from '../integrations/sms/sms-provider.interface';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { CreateSosDto, HandleSosDto } from './dto/user-safety.dto';
import { fullName, mapsLink } from './user-safety.utils';

const ACTIVE: SosStatus[] = [SosStatus.OPEN, SosStatus.ACKNOWLEDGED];
/** Une alerte encore active depuis moins de ce délai absorbe les appuis répétés. */
const ACTIVE_WINDOW_MS = 6 * 60 * 60 * 1000;

const USER_SELECT = {
  id: true,
  phone: true,
  customerProfile: { select: { firstName: true, lastName: true } },
  driverProfile: { select: { firstName: true, lastName: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class SosService {
  private readonly logger = new Logger(SosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  async trigger(userId: string, dto: CreateSosDto) {
    if ((dto.latitude === undefined) !== (dto.longitude === undefined)) {
      throw new BadRequestException('Latitude et longitude vont ensemble.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    // Un SOS déjà actif : on garde la même alerte, avec la position la plus récente.
    const active = await this.prisma.sosAlert.findFirst({
      where: { userId, status: { in: ACTIVE }, createdAt: { gte: new Date(Date.now() - ACTIVE_WINDOW_MS) } },
      orderBy: { createdAt: 'desc' },
    });
    if (active) {
      const refreshed =
        dto.latitude !== undefined && dto.longitude !== undefined
          ? await this.prisma.sosAlert.update({
              where: { id: active.id },
              data: { latitude: dto.latitude, longitude: dto.longitude },
            })
          : active;
      return this.toResult(refreshed, await this.prisma.emergencyContact.count({ where: { userId } }), true);
    }

    // On ne retient que le contexte qui concerne vraiment cette personne : en urgence, une référence erronée ne doit pas bloquer l'alerte.
    const context = await this.resolveContext(userId, dto);

    const alert = await this.prisma.sosAlert.create({
      data: {
        userId,
        tripId: context.tripId,
        bookingId: context.bookingId,
        shipmentId: context.shipmentId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        message: dto.message?.trim() || null,
      },
    });

    const contacts = await this.prisma.emergencyContact.findMany({ where: { userId } });
    const name = fullName(user);
    const where =
      alert.latitude !== null && alert.longitude !== null ? ` Position : ${mapsLink(alert.latitude, alert.longitude)}` : '';
    const trip = context.routeLabel ? ` (${context.routeLabel})` : '';
    const smsText = `[Occa'Z] ALERTE SOS : ${name} a besoin d'aide${trip}. Appelez-le/la au ${user.phone}.${where}`;

    const [smsResults] = await Promise.all([
      Promise.allSettled(contacts.map((contact) => this.sms.send(contact.phone, smsText))),
      this.notifications.notifyStaff({
        permission: PERMISSIONS.SOS_READ,
        type: NotificationType.SAFETY,
        title: '🚨 Alerte SOS',
        body: `${name} (${user.phone}) a déclenché un SOS${trip}.${where}`,
        link: '/sos',
        email: true,
        payload: { sosAlertId: alert.id },
      }),
    ]);

    smsResults.forEach((result, index) => {
      if (result.status === 'rejected') this.logger.error(`SMS SOS non envoyé au contact ${contacts[index].id}`, result.reason as Error);
    });
    const notified = smsResults.filter((result) => result.status === 'fulfilled').length;
    const saved =
      notified > 0 ? await this.prisma.sosAlert.update({ where: { id: alert.id }, data: { contactsNotified: notified } }) : alert;

    return this.toResult(saved, contacts.length, false);
  }

  async updateLocation(userId: string, id: string, latitude: number, longitude: number) {
    const result = await this.prisma.sosAlert.updateMany({
      where: { id, userId, status: { in: ACTIVE } },
      data: { latitude, longitude },
    });
    if (result.count === 0) throw new NotFoundException('Alerte introuvable ou déjà terminée.');
    return { updated: true };
  }

  /** « Je suis en sécurité » : l'alerte s'arrête et les proches déjà prévenus en sont informés. */
  async cancel(userId: string, id: string) {
    const alert = await this.prisma.sosAlert.findFirst({ where: { id, userId, status: { in: ACTIVE } } });
    if (!alert) throw new NotFoundException('Alerte introuvable ou déjà terminée.');

    await this.prisma.sosAlert.update({
      where: { id },
      data: { status: SosStatus.CANCELLED, handledAt: new Date(), resolutionNote: 'Annulée par la personne.' },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT });
    const contacts = alert.contactsNotified > 0 ? await this.prisma.emergencyContact.findMany({ where: { userId } }) : [];
    const text = `[Occa'Z] Fausse alerte : ${user ? fullName(user) : 'votre proche'} est en sécurité. Merci de votre réactivité.`;
    await Promise.allSettled([
      ...contacts.map((contact) => this.sms.send(contact.phone, text)),
      this.notifications.notifyStaff({
        permission: PERMISSIONS.SOS_READ,
        type: NotificationType.SAFETY,
        title: 'SOS annulé',
        body: `${user ? fullName(user) : 'L’utilisateur'} indique être en sécurité.`,
        link: '/sos',
        payload: { sosAlertId: id },
      }),
    ]);
    return { cancelled: true };
  }

  async listMine(userId: string) {
    const alerts = await this.prisma.sosAlert.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 });
    return alerts.map((alert) => this.toResult(alert, alert.contactsNotified, false));
  }

  // ---------------------------------------------------------------- support

  async findAll(query: PaginationQueryDto, filters: { status?: SosStatus }, scopeWhere?: Prisma.UserWhereInput) {
    const where: Prisma.SosAlertWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(scopeWhere ? { user: scopeWhere } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sosAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
        include: { user: { select: { ...USER_SELECT, emergencyContacts: { select: { name: true, phone: true } } } } },
      }),
      this.prisma.sosAlert.count({ where }),
    ]);

    const data = rows.map((row) => ({
      id: row.id,
      status: row.status,
      message: row.message,
      latitude: row.latitude,
      longitude: row.longitude,
      mapUrl: row.latitude !== null && row.longitude !== null ? mapsLink(row.latitude, row.longitude) : null,
      tripId: row.tripId,
      bookingId: row.bookingId,
      shipmentId: row.shipmentId,
      contactsNotified: row.contactsNotified,
      resolutionNote: row.resolutionNote,
      handledAt: row.handledAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: {
        id: row.user.id,
        name: fullName(row.user),
        phone: row.user.phone,
        emergencyContacts: row.user.emergencyContacts,
      },
    }));
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  async handle(id: string, dto: HandleSosDto, actorId: string) {
    const existing = await this.prisma.sosAlert.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Alerte introuvable.');
    if (existing.status === SosStatus.CANCELLED) throw new BadRequestException('Cette alerte a été annulée par la personne.');

    const resolving = dto.status === SosStatus.RESOLVED;
    const updated = await this.prisma.sosAlert.update({
      where: { id },
      data: {
        status: dto.status,
        handledById: actorId,
        handledAt: resolving ? new Date() : existing.handledAt,
        resolutionNote: dto.resolutionNote?.trim() || undefined,
      },
    });
    await this.audit.log({
      actorId,
      entityType: 'SosAlert',
      entityId: id,
      action: 'sos.handle',
      diff: { from: existing.status, to: dto.status },
    });

    // La personne sait que son alerte a été vue.
    if (existing.status === SosStatus.OPEN && dto.status === SosStatus.ACKNOWLEDGED) {
      await this.notifications
        .notify({
          userId: existing.userId,
          type: NotificationType.SAFETY,
          fallbackTitle: 'Votre alerte a été reçue',
          fallbackBody: "L'équipe Occa'Z a pris votre alerte en compte. Si vous êtes en danger immédiat, appelez aussi les secours.",
        })
        .catch((error: unknown) => this.logger.warn(`Accusé de réception SOS non envoyé : ${String(error)}`));
    }
    return { id: updated.id, status: updated.status, handledAt: updated.handledAt, resolutionNote: updated.resolutionNote };
  }

  async openCount(): Promise<{ count: number }> {
    return { count: await this.prisma.sosAlert.count({ where: { status: { in: ACTIVE } } }) };
  }

  // ---------------------------------------------------------------- privé

  private toResult(
    alert: { id: string; status: SosStatus; contactsNotified: number; latitude: number | null; longitude: number | null; createdAt: Date },
    contactsTotal: number,
    alreadyActive: boolean,
  ) {
    return {
      id: alert.id,
      status: alert.status,
      contactsNotified: alert.contactsNotified,
      contactsTotal,
      hasLocation: alert.latitude !== null && alert.longitude !== null,
      createdAt: alert.createdAt,
      alreadyActive,
    };
  }

  /** Garde seulement le trajet / la réservation / l'envoi auquel la personne participe, avec « Ville → Ville » pour le SMS. */
  private async resolveContext(userId: string, dto: CreateSosDto) {
    const result: { tripId?: string; bookingId?: string; shipmentId?: string; routeLabel?: string } = {};
    const label = (trip: { originCity: { name: string }; destinationCity: { name: string } }) =>
      `${trip.originCity.name} → ${trip.destinationCity.name}`;
    const tripInclude = { originCity: { select: { name: true } }, destinationCity: { select: { name: true } } } as const;

    try {
      if (dto.bookingId) {
        const booking = await this.prisma.booking.findUnique({
          where: { id: dto.bookingId },
          include: { customer: { select: { userId: true } }, trip: { include: { ...tripInclude, driver: { select: { userId: true } } } } },
        });
        if (booking && (booking.customer.userId === userId || booking.trip.driver.userId === userId)) {
          result.bookingId = booking.id;
          result.tripId = booking.tripId;
          result.routeLabel = label(booking.trip);
        }
      }
      if (!result.tripId && dto.tripId) {
        const trip = await this.prisma.trip.findUnique({
          where: { id: dto.tripId },
          include: { ...tripInclude, driver: { select: { userId: true } } },
        });
        const isPassenger =
          trip &&
          trip.driver.userId !== userId &&
          (await this.prisma.booking.count({ where: { tripId: trip.id, customer: { userId } } })) > 0;
        if (trip && (trip.driver.userId === userId || isPassenger)) {
          result.tripId = trip.id;
          result.routeLabel = label(trip);
        }
      }
      if (dto.shipmentId) {
        const shipment = await this.prisma.shipment.findUnique({
          where: { id: dto.shipmentId },
          select: { id: true, customer: { select: { userId: true } }, driver: { select: { userId: true } } },
        });
        if (shipment && (shipment.customer.userId === userId || shipment.driver?.userId === userId)) {
          result.shipmentId = shipment.id;
        }
      }
    } catch (error) {
      // Le contexte est un plus : en cas de souci de lecture, l'alerte part quand même.
      this.logger.warn(`Contexte du SOS non résolu : ${String(error)}`);
    }
    return result;
  }
}
