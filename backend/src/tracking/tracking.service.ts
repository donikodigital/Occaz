// backend/src/tracking/tracking.service.ts
// [10/10/2026] v1 — Suivi d'un envoi : par numéro de suivi (public, position approximative) ou par l'expéditeur / le support
// (position exacte). Les règles d'affichage sont dans tracking-view.ts ; ici on charge les données et on assemble la réponse.
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerProfilesService } from '../profiles/customer-profiles/customer-profiles.service';
import { CountryScopeService } from '../common/scope/country-scope.service';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { formatTrackingNumber, shipmentTrackingNumber } from '../tickets/ticket-codes';
import { buildRoute, matchRoute } from '../trips/trip-route';
import {
  CARRIED_STATUSES,
  buildJourney,
  buildProgress,
  eventLabel,
  freshTripPosition,
  headlineFor,
  normalizeTrackingNumber,
  outcomeOf,
  whereIsParcel,
  type JourneyInputPoint,
} from './tracking-view';

/** Au-delà, une position GPS n'est plus montrée comme « en direct » : le colis est suivi par ses villes traversées. */
const GPS_MAX_AGE_MS = 6 * 60 * 60 * 1000;
/** Une position plus vieille que ça est signalée « dernière position connue » par l'application. */
const GPS_STALE_AFTER_MS = 15 * 60 * 1000;

const SHIPMENT_INCLUDE = {
  senderLocation: { include: { city: true } },
  recipientLocation: { include: { city: true } },
  driver: { select: { firstName: true } },
  tracking: { orderBy: { recordedAt: 'asc' } },
  trip: {
    include: {
      originCity: true,
      destinationCity: true,
      stops: { orderBy: { sequence: 'asc' }, include: { city: true } },
    },
  },
} satisfies Prisma.ShipmentInclude;

type TrackedShipment = Prisma.ShipmentGetPayload<{ include: typeof SHIPMENT_INCLUDE }>;

export interface TrackingView {
  trackingNumber: string;
  trackingNumberFormatted: string;
  status: string;
  outcome: 'ACTIVE' | 'DELIVERED' | 'CANCELLED' | 'INCIDENT';
  headline: string;
  pickupCity: string;
  deliveryCity: string;
  parcelsCount: number;
  driverFirstName: string | null;
  progress: ReturnType<typeof buildProgress>;
  journey: ReturnType<typeof buildJourney>;
  location: ReturnType<typeof whereIsParcel> & { isStale: boolean };
  /** Du plus récent au plus ancien. */
  events: Array<{ status: string; label: string; at: Date }>;
  updatedAt: Date;
}

@Injectable()
export class TrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customerProfiles: CustomerProfilesService,
    private readonly scope: CountryScopeService,
  ) {}

  /** Suivi public : toute personne qui a le numéro. Position arrondie, aucune donnée personnelle. */
  async findPublic(rawNumber: string): Promise<TrackingView> {
    const trackingNumber = normalizeTrackingNumber(rawNumber);
    if (!trackingNumber) {
      throw new NotFoundException("Ce numéro de suivi n'est pas valide. Il commence par OCZ, suivi de 10 caractères.");
    }
    const shipment = await this.findByTrackingNumber(trackingNumber);
    // Un envoi pas encore payé n'a ni étiquette ni numéro connu de qui que ce soit : il n'existe pas encore pour le public.
    if (!shipment || shipment.status === 'CREATED') {
      throw new NotFoundException('Aucun colis ne correspond à ce numéro.');
    }
    return this.buildView(shipment, false);
  }

  /** Suivi de l'expéditeur (position exacte) ou du support dans son périmètre. */
  async findForUser(shipmentId: string, user: AuthenticatedUser): Promise<TrackingView> {
    const shipment = await this.prisma.shipment.findFirst({ where: { id: shipmentId, deletedAt: null }, include: SHIPMENT_INCLUDE });
    if (!shipment) throw new NotFoundException('Envoi introuvable.');

    const isStaff = await this.scope.hasShipmentAccess(user, shipmentId);
    if (!isStaff) {
      const customer = await this.customerProfiles.findByUserId(user.id).catch(() => null);
      if (!customer || customer.id !== shipment.customerId) {
        throw new ForbiddenException('Cet envoi ne vous appartient pas.');
      }
    }
    return this.buildView(shipment, true);
  }

  private async findByTrackingNumber(trackingNumber: string): Promise<TrackedShipment | null> {
    // Le numéro n'est pas stocké : c'est « OCZ » + les 10 premiers caractères de l'identifiant (sans tirets), que l'index
    // shipments_tracking_number_idx permet de retrouver directement.
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "shipments" WHERE upper(substr(replace("id", '-', ''), 1, 10)) = ${trackingNumber.slice(3)} AND "deletedAt" IS NULL LIMIT 2`,
    );
    // Deux envois pour un même numéro (collision d'identifiants, pratiquement impossible) : on refuse de choisir au hasard.
    if (rows.length !== 1) return null;
    return this.prisma.shipment.findFirst({ where: { id: rows[0].id, deletedAt: null }, include: SHIPMENT_INCLUDE });
  }

  buildView(shipment: TrackedShipment, precise: boolean, now = new Date()): TrackingView {
    const pickupCity = shipment.senderLocation?.city?.name ?? 'Lieu de départ';
    const deliveryCity = shipment.recipientLocation?.city?.name ?? 'Lieu de livraison';
    const trackingNumber = shipmentTrackingNumber(shipment.id);

    const pickedUpAt = shipment.tracking.find((entry) => entry.status === 'PICKED_UP')?.recordedAt ?? null;
    const deliveredAt = shipment.tracking.find((entry) => entry.status === 'DELIVERED')?.recordedAt ?? null;

    const journey = buildJourney(this.journeyPoints(shipment, pickupCity, deliveryCity), shipment.status, pickedUpAt, deliveredAt);

    const carried = CARRIED_STATUSES.includes(shipment.status);
    const gps = carried ? freshTripPosition(shipment.trip, now, GPS_MAX_AGE_MS) : null;
    const where = whereIsParcel({ status: shipment.status, journey, gps, precise });
    const isStale = where.source === 'GPS' && where.updatedAt !== null && now.getTime() - where.updatedAt.getTime() > GPS_STALE_AFTER_MS;

    const driverFirstName = shipment.driver?.firstName ?? null;
    const events = shipment.tracking
      .map((entry) => ({ status: entry.status as string, label: eventLabel(entry.status, entry.note, { pickupCity, deliveryCity }), at: entry.recordedAt }))
      .filter((entry): entry is { status: string; label: string; at: Date } => entry.label !== null)
      .reverse();

    return {
      trackingNumber,
      trackingNumberFormatted: formatTrackingNumber(trackingNumber),
      status: shipment.status,
      outcome: outcomeOf(shipment.status),
      headline: headlineFor({ status: shipment.status, driverFirstName, deliveryCity, where }),
      pickupCity,
      deliveryCity,
      parcelsCount: shipment.quantity,
      driverFirstName,
      progress: buildProgress(shipment.status),
      journey,
      location: { ...where, isStale },
      events,
      updatedAt: shipment.tracking.length > 0 ? shipment.tracking[shipment.tracking.length - 1].recordedAt : shipment.updatedAt,
    };
  }

  /**
   * Villes de la route du colis : du ramassage à la livraison, villes traversées comprises quand le colis voyage sur un trajet
   * dont la route passe par les deux. Sinon (conducteur sans trajet, route qui ne correspond pas) : ramassage et livraison seuls.
   */
  private journeyPoints(shipment: TrackedShipment, pickupCity: string, deliveryCity: string): JourneyInputPoint[] {
    const fallback: JourneyInputPoint[] = [
      { cityName: pickupCity, kind: 'PICKUP', reachedAt: null },
      { cityName: deliveryCity, kind: 'DELIVERY', reachedAt: null },
    ];
    const trip = shipment.trip;
    const senderCityId = shipment.senderLocation?.cityId ?? null;
    const recipientCityId = shipment.recipientLocation?.cityId ?? null;
    if (!trip || !senderCityId || !recipientCityId) return fallback;

    const route = buildRoute(trip);
    const segment = matchRoute(route, senderCityId, recipientCityId, { requireBookable: false });
    if (!segment) return fallback;

    const stopsById = new Map(trip.stops.map((stop) => [stop.id, stop]));
    const points: JourneyInputPoint[] = [];
    for (const point of route) {
      if (point.index < segment.from.index || point.index > segment.to.index) continue;
      if (point.index === segment.from.index) {
        points.push({ cityName: pickupCity, kind: 'PICKUP', reachedAt: null });
      } else if (point.index === segment.to.index) {
        points.push({ cityName: deliveryCity, kind: 'DELIVERY', reachedAt: null });
      } else {
        const stop = point.stopId ? stopsById.get(point.stopId) : undefined;
        points.push({ cityName: stop?.city?.name ?? 'Étape', kind: 'STOP', reachedAt: stop?.arrivedAt ?? null });
      }
    }
    return points;
  }
}
