// backend/src/disputes/disputes.service.ts
// [21/09/2026] v2 — parties d'un envoi identifiées via Shipment.driverId.
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  DisputePriority,
  DisputeResolutionType,
  DisputeStatus,
  DocumentOwnerType,
  NotificationChannel,
  NotificationType,
  OtpPurpose,
  PaymentStatus,
  Prisma,
  ServiceType,
  ShipmentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DocumentsService } from '../documents/documents.service';
import { PaymentsService } from '../payments/payments.service';
import { WalletsService } from '../wallets/wallets.service';
import { UsersService } from '../users/users.service';
import { CountryScopeService } from '../common/scope/country-scope.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TripOtpService } from '../trips/trip-otp.service';
import { ShipmentOtpService } from '../shipments/shipment-otp.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { toMoneyBigInt } from '../common/utils/money.util';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { AddDisputeEvidenceDto } from './dto/add-dispute-evidence.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { syncTripSeats } from '../trips/trip-seats.db';

/** Champs d'un utilisateur exposés dans un litige — jamais passwordHash / twoFactorSecret. */
const SAFE_USER_SELECT = { id: true, phone: true, email: true } as const;

/**
 * Section 21/22. Un point important, confirmé explicitement : un
 * désaccord conducteur/client à n'importe quelle étape d'un trajet ou
 * d'un envoi passe par ici, jamais par une validation manuelle côté
 * conducteur — voir les notes de cycle de vie dans TripsService et
 * ShipmentsService (Lots 3/4/6).
 *
 * Décision de conception : l'ouverture d'un litige ne modifie PAS
 * Booking.status / Shipment.status (qui gardent leur valeur
 * opérationnelle, y compris COMPLETED — perdre cette information serait
 * dommageable pour le support). Seule la RÉSOLUTION du litige, quand son
 * type a une conséquence opérationnelle concrète (remboursement,
 * annulation), modifie le statut de la réservation/l'envoi concerné.
 */
@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly documentsService: DocumentsService,
    private readonly paymentsService: PaymentsService,
    private readonly wallets: WalletsService,
    private readonly usersService: UsersService,
    private readonly notifications: NotificationsService,
    private readonly tripOtpService: TripOtpService,
    private readonly shipmentOtpService: ShipmentOtpService,
    private readonly scope: CountryScopeService,
  ) {}

  async findOne(id: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        // Devise de l'objet du litige : le remboursement s'affiche dans la même devise que la réservation / l'envoi.
        booking: { include: { currency: { select: { id: true, isoCode: true, symbol: true } } } },
        shipment: { include: { currency: { select: { id: true, isoCode: true, symbol: true } } } },
        // Jamais la ligne User complète (hash du mot de passe, secret 2FA…) : seulement de quoi identifier la personne.
        openedBy: { select: SAFE_USER_SELECT },
        assignedAgent: { select: SAFE_USER_SELECT },
        messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: SAFE_USER_SELECT } } },
        evidence: { include: { document: true } },
        resolution: true,
      },
    });
    if (!dispute) throw new NotFoundException('Litige introuvable.');
    return dispute;
  }

  async create(openedByUserId: string, dto: CreateDisputeDto) {
    if ((!dto.bookingId && !dto.shipmentId) || (dto.bookingId && dto.shipmentId)) {
      throw new BadRequestException('Fournissez exactement un des deux : bookingId ou shipmentId.');
    }
    if (
      (dto.subjectType === ServiceType.TRIP && !dto.bookingId) ||
      (dto.subjectType === ServiceType.SHIPMENT && !dto.shipmentId)
    ) {
      throw new BadRequestException('subjectType ne correspond pas à bookingId/shipmentId fourni.');
    }

    await this.assertOpenerIsParty(openedByUserId, dto);

    const dispute = await this.prisma.dispute.create({
      data: {
        subjectType: dto.subjectType,
        bookingId: dto.bookingId,
        shipmentId: dto.shipmentId,
        openedById: openedByUserId,
        reason: dto.reason,
        description: dto.description,
        status: DisputeStatus.OPENED,
        priority: DisputePriority.MEDIUM,
      },
    });

    await this.audit.log({
      actorId: openedByUserId,
      entityType: 'Dispute',
      entityId: dispute.id,
      action: 'OPEN',
      diff: { reason: dto.reason },
    });

    await this.notifySupportOfNewDispute(dispute.id, dto.reason);

    return dispute;
  }

  /**
   * Alerte les agents avec la permission dispute.read dont le périmètre couvre le litige (rôle sans pays, ou
   * rôle limité à l'un des pays du dossier — voir CountryScopeService.countriesOfDispute).
   * Un litige ouvert n'a pas encore d'agent assigné, donc pas de
   * destinataire unique évident — c'est le rôle qui compte, pas la personne.
   */
  private async notifySupportOfNewDispute(disputeId: string, reason: string): Promise<void> {
    // Un agent limité à un pays n'est alerté que pour les litiges de son périmètre ; un rôle sans pays alerte partout.
    const disputeCountryIds = await this.scope.countriesOfDispute(disputeId);
    const agents = await this.prisma.user.findMany({
      where: {
        userRoles: {
          some: {
            role: { permissions: { some: { permission: { key: 'dispute.read' } } } },
            OR: [{ countryId: null }, { countryId: { in: disputeCountryIds } }],
          },
        },
      },
      select: { id: true },
    });
    await Promise.all(
      agents.map((agent) =>
        this.notifications.notify({
          userId: agent.id,
          type: NotificationType.DISPUTE,
          channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
          fallbackTitle: 'Nouveau litige à traiter',
          fallbackBody: `Motif : ${reason}`,
          // « link » : page à ouvrir depuis la cloche du back-office.
          payload: { link: '/disputes', disputeId },
          pushData: { type: 'DISPUTE', disputeId },
        }),
      ),
    );
  }

  private async assertOpenerIsParty(userId: string, dto: CreateDisputeDto): Promise<void> {
    if (dto.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: dto.bookingId },
        include: { customer: true, trip: { include: { driver: true } } },
      });
      if (!booking) throw new NotFoundException('Réservation introuvable.');
      const isParty = booking.customer.userId === userId || booking.trip.driver.userId === userId;
      if (!isParty) throw new ForbiddenException("Vous n'êtes pas partie à cette réservation.");
    } else if (dto.shipmentId) {
      const shipment = await this.prisma.shipment.findUnique({
        where: { id: dto.shipmentId },
        include: { customer: true, driver: true },
      });
      if (!shipment) throw new NotFoundException('Envoi introuvable.');
      const isParty =
        shipment.customer.userId === userId || shipment.driver?.userId === userId;
      if (!isParty) throw new ForbiddenException("Vous n'êtes pas partie à cet envoi.");
    }
  }

  /** Vérifie l'accès : ouvreur, conducteur/client concerné, agent assigné, ou permission support. */
  async assertCanAccess(disputeId: string, userId: string, hasReadPermission: boolean): Promise<void> {
    if (hasReadPermission) return;
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        booking: { include: { customer: true, trip: { include: { driver: true } } } },
        shipment: { include: { customer: true, driver: true } },
      },
    });
    if (!dispute) throw new NotFoundException('Litige introuvable.');

    const isOpener = dispute.openedById === userId;
    const isAssignedAgent = dispute.assignedAgentId === userId;
    const isBookingParty =
      dispute.booking &&
      (dispute.booking.customer.userId === userId || dispute.booking.trip.driver.userId === userId);
    const isShipmentParty =
      dispute.shipment &&
      (dispute.shipment.customer.userId === userId || dispute.shipment.driver?.userId === userId);

    if (!isOpener && !isAssignedAgent && !isBookingParty && !isShipmentParty) {
      throw new ForbiddenException('Accès non autorisé à ce litige.');
    }
  }

  async findAllForUser(userId: string) {
    return this.prisma.dispute.findMany({
      where: {
        OR: [
          { openedById: userId },
          { booking: { customer: { userId } } },
          { booking: { trip: { driver: { userId } } } },
          { shipment: { customer: { userId } } },
          { shipment: { trip: { driver: { userId } } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(
    query: PaginationQueryDto,
    filters: { status?: DisputeStatus; priority?: DisputePriority; assignedAgentId?: string } = {},
    /** Filtre de portée par pays (CountryScopeService) ; absent = aucune restriction. */
    scopeWhere?: Prisma.DisputeWhereInput,
  ): Promise<PaginatedResult<unknown>> {
    const baseWhere = {
      status: filters.status,
      priority: filters.priority,
      assignedAgentId: filters.assignedAgentId,
    };
    const where = scopeWhere ? { AND: [baseWhere, scopeWhere] } : baseWhere;
    const [data, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        include: { openedBy: { select: SAFE_USER_SELECT }, assignedAgent: { select: SAFE_USER_SELECT } },
      }),
      this.prisma.dispute.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  // -----------------------------------------------------------------------
  // Messagerie et preuves
  // -----------------------------------------------------------------------

  async addMessage(disputeId: string, authorId: string, message: string) {
    const dispute = await this.findOne(disputeId);
    const created = await this.prisma.disputeMessage.create({
      data: { disputeId, authorId, message },
      include: { author: { select: SAFE_USER_SELECT } },
    });

    await this.notifyOtherParties(dispute, authorId);

    return created;
  }

  /** Notifie toutes les parties du litige (client, conducteur, agent assigné) sauf l'auteur du message. */
  private async notifyOtherParties(
    dispute: Awaited<ReturnType<DisputesService['findOne']>>,
    excludeUserId: string,
  ): Promise<void> {
    const recipientIds = new Set<string>();

    if (dispute.booking) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: dispute.bookingId! },
        include: { customer: true, trip: { include: { driver: true } } },
      });
      if (booking) {
        recipientIds.add(booking.customer.userId);
        recipientIds.add(booking.trip.driver.userId);
      }
    }
    if (dispute.shipment) {
      const shipment = await this.prisma.shipment.findUnique({
        where: { id: dispute.shipmentId! },
        include: { customer: true, driver: true },
      });
      if (shipment) {
        recipientIds.add(shipment.customer.userId);
        if (shipment.driver) recipientIds.add(shipment.driver.userId);
      }
    }
    if (dispute.assignedAgentId) recipientIds.add(dispute.assignedAgentId);
    recipientIds.delete(excludeUserId);

    await Promise.all(
      Array.from(recipientIds).map((userId) =>
        this.notifications.notify({
          userId,
          type: NotificationType.SUPPORT_MESSAGE,
          channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
          fallbackTitle: 'Nouveau message — litige',
          fallbackBody: `Nouveau message sur le litige "${dispute.reason}".`,
        }),
      ),
    );
  }

  async addEvidence(disputeId: string, dto: AddDisputeEvidenceDto) {
    await this.findOne(disputeId);
    const document = await this.documentsService.create(DocumentOwnerType.DISPUTE, disputeId, {
      type: dto.type,
      storageKey: dto.storageKey,
      expiresAt: dto.expiresAt,
    });
    return this.prisma.disputeEvidence.create({
      data: { disputeId, documentId: document.id, note: dto.note },
      include: { document: true },
    });
  }

  // -----------------------------------------------------------------------
  // Triage
  // -----------------------------------------------------------------------

  async assign(disputeId: string, agentUserId: string, priority: DisputePriority | undefined, actorId: string) {
    const dispute = await this.findOne(disputeId);
    this.assertNotClosed(dispute.status);

    const updated = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        assignedAgentId: agentUserId,
        priority: priority ?? dispute.priority,
        status: dispute.status === DisputeStatus.OPENED ? DisputeStatus.UNDER_REVIEW : dispute.status,
      },
    });
    await this.audit.log({
      actorId,
      entityType: 'Dispute',
      entityId: disputeId,
      action: 'ASSIGN',
      diff: { agentUserId, priority },
    });
    return updated;
  }

  async updateStatus(disputeId: string, status: DisputeStatus, actorId: string) {
    const dispute = await this.findOne(disputeId);
    this.assertNotClosed(dispute.status);
    if (status === DisputeStatus.RESOLVED || status === DisputeStatus.CLOSED) {
      throw new BadRequestException('Utilisez /resolve ou /close pour ces transitions.');
    }
    const updated = await this.prisma.dispute.update({ where: { id: disputeId }, data: { status } });
    await this.audit.log({
      actorId,
      entityType: 'Dispute',
      entityId: disputeId,
      action: 'STATUS_CHANGE',
      diff: { status },
    });
    return updated;
  }

  private assertNotClosed(status: DisputeStatus): void {
    if (status === DisputeStatus.RESOLVED || status === DisputeStatus.CLOSED) {
      throw new BadRequestException('Ce litige est déjà résolu/clos.');
    }
  }

  // -----------------------------------------------------------------------
  // Résolution — chaque type déclenche sa conséquence réelle plutôt que
  // de rester une simple étiquette (section 22).
  // -----------------------------------------------------------------------

  async resolve(disputeId: string, dto: ResolveDisputeDto, actorId: string) {
    const dispute = await this.findOne(disputeId);
    this.assertNotClosed(dispute.status);
    if (dispute.resolution) {
      throw new BadRequestException('Ce litige a déjà une résolution enregistrée.');
    }

    const { refundAmount, currencyId } = await this.applyResolutionConsequences(dispute, dto, actorId);

    const resolution = await this.prisma.disputeResolution.create({
      data: {
        disputeId,
        type: dto.type,
        refundAmount,
        currencyId,
        otpPurpose: dto.type === DisputeResolutionType.OTP_MANUAL_VALIDATION ? dto.otpPurpose : undefined,
        decidedById: actorId,
        notes: dto.notes,
      },
    });

    await this.prisma.dispute.update({ where: { id: disputeId }, data: { status: DisputeStatus.RESOLVED } });

    await this.notifyResolutionParties(dispute, dto.type);

    await this.audit.log({
      actorId,
      entityType: 'Dispute',
      entityId: disputeId,
      action: 'RESOLVE',
      diff: { type: dto.type, otpPurpose: dto.otpPurpose, notes: dto.notes },
    });

    return resolution;
  }

  private async applyResolutionConsequences(
    dispute: Awaited<ReturnType<DisputesService['findOne']>>,
    dto: ResolveDisputeDto,
    actorId: string,
  ): Promise<{ refundAmount?: bigint; currencyId?: string }> {
    const serviceType = dispute.subjectType;
    const targetId = dispute.bookingId ?? dispute.shipmentId;
    if (!targetId) return {};

    switch (dto.type) {
      case DisputeResolutionType.FULL_REFUND:
        return this.executeRefund(serviceType, targetId, 100);

      case DisputeResolutionType.PARTIAL_REFUND:
      case DisputeResolutionType.SHARED_RESPONSIBILITY: {
        if (!dto.refundAmount) {
          throw new BadRequestException('refundAmount est requis pour ce type de résolution.');
        }
        return this.executeRefundByAmount(serviceType, targetId, toMoneyBigInt(dto.refundAmount));
      }

      case DisputeResolutionType.DRIVER_PAYOUT: {
        const driverId = await this.resolveDriverId(serviceType, targetId);
        if (driverId) {
          await this.wallets
            .releaseHeldFunds(
              serviceType === ServiceType.TRIP
                ? { driverId, bookingId: targetId }
                : { driverId, shipmentId: targetId },
            )
            .catch(() => undefined); // déjà libéré (prestation menée à son terme normalement) : rien à faire
        }
        return {};
      }

      case DisputeResolutionType.CANCELLATION: {
        if (serviceType === ServiceType.TRIP) {
          const booking = await this.prisma.booking.findUnique({ where: { id: targetId } });
          if (booking && booking.status !== BookingStatus.CANCELLED && booking.status !== BookingStatus.REFUNDED) {
            await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
              await tx.booking.update({
                where: { id: targetId },
                data: { status: BookingStatus.CANCELLED, cancelledAt: new Date(), cancellationReason: dto.notes },
              });
              // Places libérées sur les tronçons qu'occupait la réservation (voir trip-seats.ts).
              await syncTripSeats(tx, booking.tripId);
            });
          }
        } else {
          const shipment = await this.prisma.shipment.findUnique({ where: { id: targetId } });
          if (
            shipment &&
            shipment.status !== ShipmentStatus.CANCELLED &&
            shipment.status !== ShipmentStatus.REFUNDED
          ) {
            await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
              await tx.shipment.update({
                where: { id: targetId },
                data: {
                  status: ShipmentStatus.CANCELLED,
                  cancelledAt: new Date(),
                  cancellationReason: dto.notes,
                },
              });
              if (shipment.tripId) {
                const trip = await tx.trip.findUnique({ where: { id: shipment.tripId } });
                if (trip && trip.availableShipmentWeightKg !== null) {
                  await tx.trip.update({
                    where: { id: shipment.tripId },
                    data: { availableShipmentWeightKg: { increment: shipment.weightKg } },
                  });
                }
              }
            });
          }
        }
        return {};
      }

      case DisputeResolutionType.SUSPENSION: {
        if (!dto.targetUserId) {
          throw new BadRequestException('targetUserId est requis pour une SUSPENSION.');
        }
        await this.usersService.suspend(dto.targetUserId, dto.notes ?? 'Suspendu suite à résolution de litige.', actorId);
        return {};
      }

      case DisputeResolutionType.OTP_MANUAL_VALIDATION: {
        if (!dto.otpPurpose) {
          throw new BadRequestException(
            "otpPurpose est requis pour ce type de résolution (quelle étape valider : TRIP_PICKUP, TRIP_DROPOFF, SHIPMENT_PICKUP ou SHIPMENT_DELIVERY).",
          );
        }
        if (!dto.notes || dto.notes.trim().length < 10) {
          throw new BadRequestException(
            'Une justification détaillée (10 caractères minimum) est requise pour valider un code manuellement — elle reste tracée dans le litige.',
          );
        }

        const tripPurposes: OtpPurpose[] = [OtpPurpose.TRIP_PICKUP, OtpPurpose.TRIP_DROPOFF];
        const shipmentPurposes: OtpPurpose[] = [OtpPurpose.SHIPMENT_PICKUP, OtpPurpose.SHIPMENT_DELIVERY];
        const purposeMatchesService =
          (serviceType === ServiceType.TRIP && tripPurposes.includes(dto.otpPurpose)) ||
          (serviceType === ServiceType.SHIPMENT && shipmentPurposes.includes(dto.otpPurpose));
        if (!purposeMatchesService) {
          throw new BadRequestException('Cette étape ne correspond pas au type de ce litige (trajet/envoi).');
        }

        switch (dto.otpPurpose) {
          case OtpPurpose.TRIP_PICKUP:
            await this.tripOtpService.manuallyValidatePickup(targetId);
            break;
          case OtpPurpose.TRIP_DROPOFF:
            await this.tripOtpService.manuallyValidateDropoff(targetId);
            break;
          case OtpPurpose.SHIPMENT_PICKUP:
            await this.shipmentOtpService.manuallyValidatePickup(targetId);
            break;
          case OtpPurpose.SHIPMENT_DELIVERY:
            await this.shipmentOtpService.manuallyValidateDelivery(targetId);
            break;
        }
        return {};
      }

      case DisputeResolutionType.SANCTION:
      case DisputeResolutionType.NO_ACTION:
      default:
        return {};
    }
  }

  private async executeRefund(
    serviceType: ServiceType,
    targetId: string,
    percentage: number,
  ): Promise<{ refundAmount?: bigint; currencyId?: string }> {
    const payment = await this.prisma.payment.findUnique({
      where: serviceType === ServiceType.TRIP ? { bookingId: targetId } : { shipmentId: targetId },
    });
    if (!payment || payment.status !== PaymentStatus.CAPTURED) return {};

    if (serviceType === ServiceType.TRIP) {
      await this.paymentsService.refundBooking(targetId, percentage);
    } else {
      await this.paymentsService.refundShipment(targetId, percentage);
    }

    const refundAmount = BigInt(Math.round(Number(payment.amount) * (percentage / 100)));
    return { refundAmount, currencyId: payment.currencyId };
  }

  private async executeRefundByAmount(
    serviceType: ServiceType,
    targetId: string,
    amount: bigint,
  ): Promise<{ refundAmount?: bigint; currencyId?: string }> {
    const payment = await this.prisma.payment.findUnique({
      where: serviceType === ServiceType.TRIP ? { bookingId: targetId } : { shipmentId: targetId },
    });
    if (!payment || payment.status !== PaymentStatus.CAPTURED) {
      throw new BadRequestException('Aucun paiement capturé pour cette prestation — rien à rembourser.');
    }
    if (amount > payment.amount) {
      throw new BadRequestException('Le montant à rembourser dépasse le montant payé.');
    }
    const percentage = Math.round((Number(amount) / Number(payment.amount)) * 100);

    if (serviceType === ServiceType.TRIP) {
      await this.paymentsService.refundBooking(targetId, percentage);
    } else {
      await this.paymentsService.refundShipment(targetId, percentage);
    }

    return { refundAmount: amount, currencyId: payment.currencyId };
  }

  private async resolveDriverId(serviceType: ServiceType, targetId: string): Promise<string | undefined> {
    if (serviceType === ServiceType.TRIP) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: targetId },
        include: { trip: true },
      });
      return booking?.trip.driverId;
    }
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: targetId },
      select: { driverId: true },
    });
    return shipment?.driverId ?? undefined;
  }

  /** Notifie client et conducteur de l'issue du litige (section 22). */
  private async notifyResolutionParties(
    dispute: Awaited<ReturnType<DisputesService['findOne']>>,
    resolutionType: DisputeResolutionType,
  ): Promise<void> {
    const recipientIds = new Set<string>();

    if (dispute.booking) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: dispute.bookingId! },
        include: { customer: true, trip: { include: { driver: true } } },
      });
      if (booking) {
        recipientIds.add(booking.customer.userId);
        recipientIds.add(booking.trip.driver.userId);
      }
    }
    if (dispute.shipment) {
      const shipment = await this.prisma.shipment.findUnique({
        where: { id: dispute.shipmentId! },
        include: { customer: true, driver: true },
      });
      if (shipment) {
        recipientIds.add(shipment.customer.userId);
        if (shipment.driver) recipientIds.add(shipment.driver.userId);
      }
    }

    await Promise.all(
      Array.from(recipientIds).map((userId) =>
        this.notifications.notify({
          userId,
          type: NotificationType.DISPUTE,
          channels: [NotificationChannel.PUSH, NotificationChannel.SMS, NotificationChannel.EMAIL],
          fallbackTitle: 'Litige résolu',
          fallbackBody: `Le litige "${dispute.reason}" a été résolu (${resolutionType}).`,
        }),
      ),
    );
  }

  async close(disputeId: string, actorId: string) {
    const dispute = await this.findOne(disputeId);
    if (dispute.status !== DisputeStatus.RESOLVED) {
      throw new BadRequestException('Seul un litige RESOLVED peut être clos.');
    }
    const updated = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: { status: DisputeStatus.CLOSED },
    });
    await this.audit.log({ actorId, entityType: 'Dispute', entityId: disputeId, action: 'CLOSE' });
    return updated;
  }
}