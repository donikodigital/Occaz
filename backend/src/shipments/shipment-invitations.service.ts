// backend/src/shipments/shipment-invitations.service.ts
//
// [09/10/2026] v1 — Le client cherche un conducteur et l'invite à prendre son colis.
//
// S'ajoute à l'annonce faite à TOUS les conducteurs (ShipmentDispatchService) sans la remplacer : le client, une fois son colis payé
// (SEARCHING_DRIVER), cherche les trajets publiés qui vont à sa ville d'arrivée (ville de départ facultative), choisit un ou
// plusieurs conducteurs et leur envoie une invitation (push, e-mail, bannière sur l'accueil). Le premier qui accepte l'emporte,
// exactement comme avant : l'acceptation passe par ShipmentsService.accept.
//
// Aucune donnée personnelle du client dans l'invitation : villes, poids et gain net seulement (comme la liste des envois ouverts).
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  DriverAccountStatus,
  NotificationChannel,
  NotificationType,
  Prisma,
  ShipmentInvitationStatus,
  ShipmentStatus,
  TripStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { buildRoute, matchRoute, matchRouteToCity } from '../trips/trip-route';
import { ShipmentsService } from './shipments.service';
import { toAvailableShipmentView } from './shipment-views';
import { SHIPMENT_REQUEST_CHANNEL_ID } from './shipment-dispatch.service';
import { buildInvitationMessage, invitationSubject } from './shipment-invitation-message';
import { SearchShipmentDriversDto } from './dto/search-shipment-drivers.dto';
import { MAX_INVITATIONS_PER_SHIPMENT } from './dto/invite-shipment-drivers.dto';

const MAX_SEARCH_RESULTS = 20;
/** Trajets lus avant filtrage par tronçon : de quoi retrouver 20 conducteurs même si certains trajets ne conviennent pas. */
const SEARCH_CANDIDATES = 100;

/** Champs publics d'un conducteur pour le client qui le cherche : jamais Mobile Money, banque ni téléphone. */
const DRIVER_PUBLIC_SELECT = {
  firstName: true,
  lastName: true,
  photoUrl: true,
  averageRating: true,
  ratingsCount: true,
  isVerifiedBadge: true,
  completedTripsCount: true,
} as const;

export type InvitationView = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

@Injectable()
export class ShipmentInvitationsService {
  private readonly logger = new Logger(ShipmentInvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shipments: ShipmentsService,
    private readonly notifications: NotificationsService,
  ) {}

  // -----------------------------------------------------------------------
  // Côté client : chercher et inviter
  // -----------------------------------------------------------------------

  private async loadOpenShipment(shipmentId: string, customerId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        category: true,
        currency: true,
        senderLocation: { include: { city: true } },
        recipientLocation: { include: { city: true } },
      },
    });
    if (!shipment) throw new NotFoundException('Envoi introuvable.');
    if (shipment.customerId !== customerId) throw new ForbiddenException('Cet envoi ne vous appartient pas.');
    return shipment;
  }

  private assertStillSearching(shipment: { status: ShipmentStatus; windowEnd: Date }) {
    if (shipment.status !== ShipmentStatus.SEARCHING_DRIVER) {
      throw new ConflictException("Votre colis n'est pas en recherche de conducteur : payez-le d'abord, ou un conducteur l'a déjà accepté.");
    }
    if (shipment.windowEnd < new Date()) {
      throw new BadRequestException('La période choisie pour cet envoi est terminée : prolongez-la pour chercher un conducteur.');
    }
  }

  /**
   * Un trajet par conducteur, du plus proche au plus lointain : les trajets publiés qui acceptent des colis, dont la route atteint
   * la ville d'arrivée (arrivée ou ville traversée) — et, si elle est donnée, la ville de départ AVANT celle d'arrivée. Sans ville
   * de départ, le conducteur est compté au départ de son trajet. Le passage doit tomber dans la plage de dates du client.
   */
  async searchDrivers(shipmentId: string, customerId: string, dto: SearchShipmentDriversDto) {
    const shipment = await this.loadOpenShipment(shipmentId, customerId);
    this.assertStillSearching(shipment);

    const now = new Date();
    const cityFilter: Prisma.TripWhereInput[] = [
      { OR: [{ destinationCityId: dto.destinationCityId }, { stops: { some: { cityId: dto.destinationCityId } } }] },
    ];
    if (dto.originCityId) {
      cityFilter.push({ OR: [{ originCityId: dto.originCityId }, { stops: { some: { cityId: dto.originCityId } } }] });
    }

    const trips = await this.prisma.trip.findMany({
      where: {
        status: TripStatus.PUBLISHED,
        deletedAt: null,
        allowsShipments: true,
        departureAt: { gte: now, lte: shipment.windowEnd },
        driver: { status: DriverAccountStatus.VALIDATED, deletedAt: null, user: { isSuspended: false } },
        AND: cityFilter,
      },
      orderBy: { departureAt: 'asc' },
      take: SEARCH_CANDIDATES,
      include: {
        driver: { select: DRIVER_PUBLIC_SELECT },
        vehicle: { select: { brand: true, model: true, color: true } },
        originCity: { select: { name: true } },
        destinationCity: { select: { name: true } },
        stops: { orderBy: { sequence: 'asc' }, include: { city: { select: { name: true } } } },
      },
    });

    const existing = await this.prisma.shipmentInvitation.findMany({
      where: { shipmentId },
      select: { driverId: true, status: true },
    });
    const invitedByDriver = new Map(existing.map((invitation) => [invitation.driverId, invitation.status]));

    const seenDrivers = new Set<string>();
    const results: Array<Record<string, unknown>> = [];
    for (const trip of trips) {
      if (seenDrivers.has(trip.driverId)) continue;
      if (trip.maxShipmentWeightKg !== null && trip.maxShipmentWeightKg < shipment.weightKg) continue;
      if (trip.availableShipmentWeightKg !== null && trip.availableShipmentWeightKg < shipment.weightKg) continue;

      const route = buildRoute(trip);
      const segment = dto.originCityId
        ? matchRoute(route, dto.originCityId, dto.destinationCityId, { requireBookable: false })
        : matchRouteToCity(route, dto.destinationCityId, { requireBookable: false });
      if (!segment) continue;
      const passingAt = segment.boardingAt ?? trip.departureAt;
      if (passingAt < shipment.windowStart || passingAt > shipment.windowEnd) continue;

      seenDrivers.add(trip.driverId);
      results.push({
        tripId: trip.id,
        departureAt: trip.departureAt,
        passingAt,
        originCityName: trip.originCity.name,
        destinationCityName: trip.destinationCity.name,
        viaCityNames: trip.stops.map((stop) => stop.city?.name).filter((name): name is string => Boolean(name)),
        driver: trip.driver,
        vehicle: trip.vehicle,
        invitationStatus: invitedByDriver.get(trip.driverId) ?? null,
      });
      if (results.length >= MAX_SEARCH_RESULTS) break;
    }
    return results;
  }

  /**
   * Envoie l'invitation aux conducteurs des trajets choisis. Un conducteur déjà invité (quelle que soit sa réponse) n'est pas
   * relancé ; une invitation expirée est rouverte. 10 invitations en attente au plus par envoi.
   */
  async invite(shipmentId: string, customerId: string, tripIds: string[]) {
    const shipment = await this.loadOpenShipment(shipmentId, customerId);
    this.assertStillSearching(shipment);

    const trips = await this.prisma.trip.findMany({
      where: {
        id: { in: tripIds },
        status: TripStatus.PUBLISHED,
        deletedAt: null,
        allowsShipments: true,
        driver: { status: DriverAccountStatus.VALIDATED, deletedAt: null, user: { isSuspended: false } },
      },
      include: { driver: { select: { id: true, userId: true, firstName: true, lastName: true } } },
    });
    if (trips.length === 0) {
      throw new BadRequestException("Ces conducteurs ne sont plus disponibles : relancez la recherche.");
    }

    const existing = await this.prisma.shipmentInvitation.findMany({ where: { shipmentId } });
    const existingByDriver = new Map(existing.map((invitation) => [invitation.driverId, invitation]));
    const pendingCount = existing.filter((invitation) => invitation.status === ShipmentInvitationStatus.PENDING).length;

    const toSend: typeof trips = [];
    let alreadyInvited = 0;
    const seen = new Set<string>();
    for (const trip of trips) {
      if (seen.has(trip.driverId)) continue;
      seen.add(trip.driverId);
      const previous = existingByDriver.get(trip.driverId);
      if (previous && previous.status !== ShipmentInvitationStatus.EXPIRED) {
        alreadyInvited += 1;
        continue;
      }
      toSend.push(trip);
    }

    if (pendingCount + toSend.length > MAX_INVITATIONS_PER_SHIPMENT) {
      throw new BadRequestException(
        `Vous pouvez inviter ${MAX_INVITATIONS_PER_SHIPMENT} conducteurs au plus pour un même envoi (${pendingCount} invitation(s) déjà en attente).`,
      );
    }

    const destinationCity = shipment.recipientLocation.city?.name ?? shipment.recipientLocation.label;
    for (const trip of toSend) {
      const previous = existingByDriver.get(trip.driverId);
      if (previous) {
        await this.prisma.shipmentInvitation.update({
          where: { id: previous.id },
          data: { status: ShipmentInvitationStatus.PENDING, tripId: trip.id, respondedAt: null },
        });
      } else {
        await this.prisma.shipmentInvitation.create({
          data: { shipmentId, driverId: trip.driverId, tripId: trip.id },
        });
      }
    }

    // Les notifications partent après l'enregistrement, en parallèle : l'échec d'un canal ne défait jamais une invitation.
    await Promise.allSettled(
      toSend.map((trip) => {
        const message = buildInvitationMessage({
          driverFirstName: trip.driver.firstName,
          driverLastName: trip.driver.lastName,
          categoryName: shipment.category.name,
          destinationCity,
        });
        return this.notifications.notify({
          userId: trip.driver.userId,
          type: NotificationType.SHIPMENT_INVITATION,
          channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
          payload: { destinationCity, category: shipment.category.name },
          fallbackTitle: invitationSubject({ destinationCity }),
          fallbackBody: `${message}\n\nOuvrez l'application Occa'Z pour accepter ou refuser. Le premier conducteur qui accepte prend le colis.`,
          pushData: { type: 'SHIPMENT_INVITATION', shipmentId },
          pushOptions: { channelId: SHIPMENT_REQUEST_CHANNEL_ID, priority: 'high' },
        });
      }),
    );

    this.logger.log(`Envoi ${shipmentId} : ${toSend.length} invitation(s) envoyée(s).`);
    return { invited: toSend.length, alreadyInvited, unavailable: tripIds.length - trips.length };
  }

  /** Les invitations de l'envoi, avec leur état réel (une invitation en attente sur un colis déjà pris ou expiré n'est plus en attente). */
  async listForShipment(shipmentId: string, customerId: string) {
    const shipment = await this.loadOpenShipment(shipmentId, customerId);
    const invitations = await this.prisma.shipmentInvitation.findMany({
      where: { shipmentId },
      orderBy: { createdAt: 'desc' },
      include: { driver: { select: { firstName: true, lastName: true, photoUrl: true } } },
    });
    return invitations.map((invitation) => ({
      id: invitation.id,
      status: effectiveStatus(invitation.status, shipment, invitation.driverId),
      createdAt: invitation.createdAt,
      driver: invitation.driver,
    }));
  }

  // -----------------------------------------------------------------------
  // Côté conducteur : voir, accepter, refuser
  // -----------------------------------------------------------------------

  /** Invitations à traiter : en attente, sur un colis encore ouvert. Alimente la bannière de l'accueil. */
  async listMine(userId: string) {
    const driverId = await this.shipments.requireEligibleDriver(userId);
    const invitations = await this.prisma.shipmentInvitation.findMany({
      where: {
        driverId,
        status: ShipmentInvitationStatus.PENDING,
        shipment: { status: ShipmentStatus.SEARCHING_DRIVER, windowEnd: { gte: new Date() } },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        driver: { select: { firstName: true, lastName: true } },
        trip: { select: { id: true, departureAt: true, originCity: { select: { name: true } }, destinationCity: { select: { name: true } } } },
        shipment: {
          include: {
            category: true,
            currency: true,
            senderLocation: { include: { city: true } },
            recipientLocation: { include: { city: true } },
          },
        },
      },
    });

    return invitations.map((invitation) => {
      const view = toAvailableShipmentView(invitation.shipment);
      return {
        id: invitation.id,
        createdAt: invitation.createdAt,
        message: buildInvitationMessage({
          driverFirstName: invitation.driver.firstName,
          driverLastName: invitation.driver.lastName,
          categoryName: invitation.shipment.category.name,
          destinationCity: view.recipientLocation.label,
        }),
        shipment: view,
        trip: invitation.trip
          ? {
              id: invitation.trip.id,
              departureAt: invitation.trip.departureAt,
              originCityName: invitation.trip.originCity.name,
              destinationCityName: invitation.trip.destinationCity.name,
            }
          : null,
      };
    });
  }

  private async loadMyInvitation(invitationId: string, userId: string) {
    const driverId = await this.shipments.requireEligibleDriver(userId);
    const invitation = await this.prisma.shipmentInvitation.findUnique({ where: { id: invitationId } });
    if (!invitation || invitation.driverId !== driverId) throw new NotFoundException('Invitation introuvable.');
    if (invitation.status !== ShipmentInvitationStatus.PENDING) {
      throw new ConflictException('Cette invitation a déjà reçu une réponse ou n’est plus valable.');
    }
    return invitation;
  }

  /**
   * Accepter = accepter l'envoi (premier arrivé, premier servi), avec le trajet qui a servi à trouver le conducteur si ce trajet
   * convient encore à l'envoi (ramassage avant livraison sur sa route, dans la plage de dates, assez de capacité) ; sinon sans trajet,
   * ce que tout conducteur validé peut faire.
   */
  async accept(invitationId: string, userId: string) {
    const invitation = await this.loadMyInvitation(invitationId, userId);
    const tripId = invitation.tripId ? await this.usableTripId(invitation.tripId, invitation.shipmentId, invitation.driverId) : undefined;

    try {
      const accepted = await this.shipments.accept(invitation.shipmentId, userId, tripId);
      await this.prisma.shipmentInvitation.update({
        where: { id: invitation.id },
        data: { status: ShipmentInvitationStatus.ACCEPTED, respondedAt: new Date() },
      });
      return accepted;
    } catch (error) {
      // Pris par un autre conducteur entre-temps : l'invitation n'a plus d'objet.
      if (error instanceof ConflictException) {
        await this.prisma.shipmentInvitation.update({
          where: { id: invitation.id },
          data: { status: ShipmentInvitationStatus.EXPIRED, respondedAt: new Date() },
        });
      }
      throw error;
    }
  }

  async decline(invitationId: string, userId: string) {
    const invitation = await this.loadMyInvitation(invitationId, userId);
    await this.prisma.shipmentInvitation.update({
      where: { id: invitation.id },
      data: { status: ShipmentInvitationStatus.DECLINED, respondedAt: new Date() },
    });

    // Le client est prévenu (push) pour inviter quelqu'un d'autre sans attendre. Échec d'envoi : sans conséquence.
    try {
      const shipment = await this.prisma.shipment.findUnique({
        where: { id: invitation.shipmentId },
        select: { customer: { select: { userId: true } } },
      });
      if (shipment) {
        await this.notifications.notify({
          userId: shipment.customer.userId,
          type: NotificationType.DRIVER_REJECTED,
          channels: [NotificationChannel.PUSH],
          fallbackTitle: 'Un conducteur ne peut pas prendre votre colis',
          fallbackBody: 'Pas de souci : invitez un autre conducteur, votre colis reste visible de tous les conducteurs.',
          pushData: { type: 'SHIPMENT_INVITATION_DECLINED', shipmentId: invitation.shipmentId },
        });
      }
    } catch (error) {
      this.logger.warn(`Refus d'invitation ${invitationId} : client non prévenu (${(error as Error).message}).`);
    }
    return { id: invitation.id, status: ShipmentInvitationStatus.DECLINED };
  }

  /** Le trajet de l'invitation, s'il convient encore à l'envoi ; sinon undefined (acceptation sans trajet). */
  private async usableTripId(tripId: string, shipmentId: string, driverId: string): Promise<string | undefined> {
    const [trip, shipment] = await Promise.all([
      this.prisma.trip.findUnique({ where: { id: tripId }, include: { stops: { orderBy: { sequence: 'asc' } } } }),
      this.prisma.shipment.findUnique({
        where: { id: shipmentId },
        select: {
          weightKg: true,
          windowStart: true,
          windowEnd: true,
          senderLocation: { select: { cityId: true } },
          recipientLocation: { select: { cityId: true } },
        },
      }),
    ]);
    if (!trip || !shipment) return undefined;
    if (trip.driverId !== driverId || trip.status !== TripStatus.PUBLISHED || !trip.allowsShipments) return undefined;
    if (trip.availableShipmentWeightKg !== null && trip.availableShipmentWeightKg < shipment.weightKg) return undefined;

    const senderCityId = shipment.senderLocation?.cityId ?? null;
    const recipientCityId = shipment.recipientLocation?.cityId ?? null;
    if (!senderCityId || !recipientCityId) return undefined;
    const segment = matchRoute(buildRoute(trip), senderCityId, recipientCityId, { requireBookable: false });
    if (!segment) return undefined;
    const passingAt = segment.boardingAt ?? trip.departureAt;
    if (passingAt < shipment.windowStart || passingAt > shipment.windowEnd) return undefined;
    return trip.id;
  }
}

/** PENDING sur un colis qui n'est plus ouvert (pris par un autre, annulé, plage terminée) = EXPIRED, ou ACCEPTED si c'est ce conducteur qui l'a. */
export function effectiveStatus(
  status: ShipmentInvitationStatus,
  shipment: { status: ShipmentStatus; windowEnd: Date; driverId?: string | null },
  invitationDriverId: string,
): InvitationView {
  if (status !== ShipmentInvitationStatus.PENDING) return status;
  if (shipment.status === ShipmentStatus.SEARCHING_DRIVER && shipment.windowEnd >= new Date()) return 'PENDING';
  return shipment.driverId === invitationDriverId ? 'ACCEPTED' : 'EXPIRED';
}
