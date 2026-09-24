// backend/src/trips/trips.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, CancellationInitiator, Prisma, TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { LocationsService } from '../locations/locations.service';
import { DriverProfilesService } from '../profiles/driver-profiles/driver-profiles.service';
import { PricingService } from '../pricing/pricing.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { toMoneyBigInt } from '../common/utils/money.util';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { SearchTripsDto } from './dto/search-trips.dto';
import { TripStopInputDto } from './dto/trip-stop-input.dto';
import { BookingsService } from './bookings.service';

const DEFAULT_SEARCH_RADIUS_KM = 5;
const SEARCH_RADIUS_SETTING_KEY = 'trip.search_radius_km';
/**
 * NB sur le cycle de vie (section 20) : ce Lot implémente les transitions
 * DRAFT -> PUBLISHED et -> CANCELLED, entièrement sous le contrôle du
 * chauffeur/admin. Les étapes DRIVER_ARRIVED / PASSENGER_PICKED_UP /
 * IN_PROGRESS / ARRIVED / COMPLETED nécessitent une validation OTP
 * (section 18, "le chauffeur ne génère jamais lui-même la validation") et
 * sont donc implémentées au Lot 6, une fois OtpCode disponible. Les
 * statuts BOOKING_PENDING / CONFIRMED restent disponibles dans l'enum
 * pour un usage administratif manuel en attendant l'automatisation
 * (fermeture des réservations avant départ, Lot 9 — tâches planifiées).
 */
@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly vehiclesService: VehiclesService,
    private readonly locationsService: LocationsService,
    private readonly driverProfilesService: DriverProfilesService,
    private readonly bookingsService: BookingsService,
    private readonly pricing: PricingService,
  ) {}

  async findOne(id: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      include: {
        driver: true,
        vehicle: true,
        originCity: true,
        originLocation: true,
        destinationCity: true,
        destinationLocation: true,
        stops: { orderBy: { sequence: 'asc' }, include: { location: true } },
      },
    });
    if (!trip) throw new NotFoundException('Trajet introuvable.');
    return trip;
  }

  /** Lève une exception si `driverId` n'est pas le propriétaire du trajet. */
  private async assertOwnership(id: string, driverId: string) {
    const trip = await this.findOne(id);
    if (trip.driverId !== driverId) {
      throw new ForbiddenException("Ce trajet n'appartient pas à ce chauffeur.");
    }
    return trip;
  }

  async create(driverId: string, dto: CreateTripDto) {
    const vehicle = await this.vehiclesService.assertOwnership(dto.vehicleId, driverId);
    if (dto.totalSeats > vehicle.totalSeats) {
      throw new BadRequestException(
        `Le véhicule ne dispose que de ${vehicle.totalSeats} places.`,
      );
    }

    // Vérifie l'existence des localisations référencées (404 explicite
    // plutôt qu'une violation de clé étrangère peu lisible).
    await this.locationsService.findOne(dto.originLocationId);
    await this.locationsService.findOne(dto.destinationLocationId);
    for (const stop of dto.stops ?? []) {
      await this.locationsService.findOne(stop.locationId);
    }

    if (new Date(dto.departureAt).getTime() <= Date.now()) {
      throw new BadRequestException("La date de départ doit être dans le futur.");
    }

    const trip = await this.prisma.trip.create({
      data: {
        driverId,
        vehicleId: dto.vehicleId,
        originCityId: dto.originCityId,
        originLocationId: dto.originLocationId,
        destinationCityId: dto.destinationCityId,
        destinationLocationId: dto.destinationLocationId,
        departureAt: new Date(dto.departureAt),
        status: TripStatus.DRAFT,
        totalSeats: dto.totalSeats,
        availableSeats: dto.totalSeats,
        allowsLuggage: dto.allowsLuggage ?? true,
        allowsShipments: dto.allowsShipments ?? true,
        maxShipmentWeightKg: dto.maxShipmentWeightKg,
        availableShipmentWeightKg: dto.maxShipmentWeightKg,
        pricePerSeat: toMoneyBigInt(dto.pricePerSeat),
        currencyId: dto.currencyId,
        notes: dto.notes,
      },
    });

    if (dto.stops?.length) {
      await this.prisma.tripStop.createMany({
        data: dto.stops.map((stop) => ({
          tripId: trip.id,
          locationId: stop.locationId,
          sequence: stop.sequence,
          estimatedArrivalAt: stop.estimatedArrivalAt ? new Date(stop.estimatedArrivalAt) : undefined,
        })),
      });
    }

    return this.findOne(trip.id);
  }

  async update(id: string, driverId: string, dto: UpdateTripDto) {
    const trip = await this.assertOwnership(id, driverId);
    if (trip.status !== TripStatus.DRAFT) {
      throw new BadRequestException(
        'Seul un trajet en brouillon (DRAFT) peut encore être modifié.',
      );
    }

    const effectiveVehicleId = dto.vehicleId ?? trip.vehicleId;
    const effectiveTotalSeats = dto.totalSeats ?? trip.totalSeats;
    if (dto.vehicleId || dto.totalSeats) {
      const vehicle = await this.vehiclesService.assertOwnership(effectiveVehicleId, driverId);
      if (effectiveTotalSeats > vehicle.totalSeats) {
        throw new BadRequestException(
          `Le véhicule ne dispose que de ${vehicle.totalSeats} places.`,
        );
      }
    }

    return this.prisma.trip.update({
      where: { id },
      data: {
        vehicleId: dto.vehicleId,
        originLocationId: dto.originLocationId,
        destinationLocationId: dto.destinationLocationId,
        departureAt: dto.departureAt ? new Date(dto.departureAt) : undefined,
        totalSeats: dto.totalSeats,
        availableSeats: dto.totalSeats, // trajet encore en DRAFT : aucune réservation existante
        allowsLuggage: dto.allowsLuggage,
        allowsShipments: dto.allowsShipments,
        maxShipmentWeightKg: dto.maxShipmentWeightKg,
        availableShipmentWeightKg: dto.maxShipmentWeightKg,
        pricePerSeat: dto.pricePerSeat ? toMoneyBigInt(dto.pricePerSeat) : undefined,
        currencyId: dto.currencyId,
        notes: dto.notes,
      },
    });
  }

  async publish(id: string, driverId: string) {
    const trip = await this.assertOwnership(id, driverId);
    if (trip.status !== TripStatus.DRAFT) {
      throw new BadRequestException('Seul un trajet DRAFT peut être publié.');
    }
    return this.prisma.trip.update({
      where: { id },
      data: { status: TripStatus.PUBLISHED },
    });
  }

  /**
   * Annulation par le chauffeur : bascule le trajet et toutes ses
   * réservations actives en CANCELLED, et incrémente le compteur
   * d'annulations du chauffeur (section 26). Le remboursement effectif
   * des paiements déjà capturés est déclenché par le Lot 5.
   */
  async cancel(id: string, driverId: string, reason: string) {
    const trip = await this.assertOwnership(id, driverId);
    if (trip.status === TripStatus.CANCELLED || trip.status === TripStatus.COMPLETED) {
      throw new BadRequestException('Ce trajet ne peut plus être annulé.');
    }

    await this.prisma.trip.update({
      where: { id },
      data: { status: TripStatus.CANCELLED },
    });

    await this.bookingsService.cancelAllForTrip(id, reason, CancellationInitiator.DRIVER);
    await this.driverProfilesService.incrementCancellations(driverId);

    await this.audit.log({
      actorId: driverId,
      entityType: 'Trip',
      entityId: id,
      action: 'CANCEL',
      diff: { reason },
    });

    return this.findOne(id);
  }

  // -----------------------------------------------------------------------
  // Cycle de vie opérationnel (Lot 6) — transitions déclenchées par le
  // chauffeur, sans validation OTP (le pickup/dropoff par réservation,
  // lui, passe par TripOtpService). Voir la note de cycle de vie en tête
  // de fichier pour l'articulation complète des statuts (section 20).
  // -----------------------------------------------------------------------

  async markDriverArrived(id: string, driverId: string) {
    const trip = await this.assertOwnership(id, driverId);
    if (trip.status !== TripStatus.PUBLISHED) {
      throw new BadRequestException('Seul un trajet PUBLISHED peut passer à "chauffeur arrivé".');
    }
    return this.prisma.trip.update({
      where: { id },
      data: { status: TripStatus.DRIVER_ARRIVED },
    });
  }

  /** Démarre le trajet — au moins un passager doit déjà avoir été pris en charge (OTP départ vérifié). */
  async startTrip(id: string, driverId: string) {
    const trip = await this.assertOwnership(id, driverId);
    if (trip.status !== TripStatus.PASSENGER_PICKED_UP) {
      throw new BadRequestException(
        'Au moins un passager doit être pris en charge (code OTP vérifié) avant de démarrer le trajet.',
      );
    }
    return this.prisma.trip.update({ where: { id }, data: { status: TripStatus.IN_PROGRESS } });
  }

  async markArrived(id: string, driverId: string) {
    const trip = await this.assertOwnership(id, driverId);
    if (trip.status !== TripStatus.IN_PROGRESS) {
      throw new BadRequestException('Seul un trajet IN_PROGRESS peut passer à "arrivé à destination".');
    }
    return this.prisma.trip.update({ where: { id }, data: { status: TripStatus.ARRIVED } });
  }

  /**
   * Appelé par polling depuis l'app chauffeur pendant IN_PROGRESS (toutes
   * les quelques secondes) — pas de canal temps réel dans cette V1, voir
   * la note du schéma sur Trip.currentLatitude/currentLongitude.
   */
  async updatePosition(id: string, driverId: string, latitude: number, longitude: number) {
    const trip = await this.assertOwnership(id, driverId);
    if (trip.status !== TripStatus.IN_PROGRESS) {
      throw new BadRequestException('Le suivi de position n\'est disponible que pendant un trajet en cours (IN_PROGRESS).');
    }
    return this.prisma.trip.update({
      where: { id },
      data: {
        currentLatitude: latitude,
        currentLongitude: longitude,
        currentPositionUpdatedAt: new Date(),
      },
      select: { id: true, currentLatitude: true, currentLongitude: true, currentPositionUpdatedAt: true },
    });
  }

  /**
   * Accessible au chauffeur du trajet (confirme que ses propres mises à
   * jour arrivent bien) ou à un client ayant une réservation active dessus
   * — jamais à un tiers, même authentifié. La visibilité Support/
   * SuperAdmin (utile pour l'instruction d'un litige) n'est volontairement
   * pas couverte ici ; à ajouter côté back-office si le besoin se
   * confirme, via une permission dédiée plutôt qu'un accès systématique.
   */
  async getPosition(
    id: string,
    requester: { driverProfileId?: string; customerProfileId?: string },
  ): Promise<{ latitude: number; longitude: number; updatedAt: Date } | null> {
    const trip = await this.prisma.trip.findUnique({ where: { id } });
    if (!trip) throw new NotFoundException('Trajet introuvable.');

    const isOwnTrip = Boolean(requester.driverProfileId) && trip.driverId === requester.driverProfileId;
    const hasActiveBooking =
      Boolean(requester.customerProfileId) &&
      Boolean(
        await this.prisma.booking.findFirst({
          where: {
            tripId: id,
            customerId: requester.customerProfileId,
            status: { in: [BookingStatus.PAID, BookingStatus.CONFIRMED] },
          },
        }),
      );

    if (!isOwnTrip && !hasActiveBooking) {
      throw new ForbiddenException("Vous n'avez pas accès à la position de ce trajet.");
    }

    if (trip.currentLatitude === null || trip.currentLongitude === null || !trip.currentPositionUpdatedAt) {
      return null;
    }
    return {
      latitude: trip.currentLatitude,
      longitude: trip.currentLongitude,
      updatedAt: trip.currentPositionUpdatedAt,
    };
  }

  /**
   * Clôture le trajet — exige que toutes les réservations actives aient
   * déjà été closes individuellement (dépose OTP vérifiée pour chacune,
   * voir TripOtpService.verifyDropoffOtp). Incrémente le compteur de
   * réputation du chauffeur une fois pour le trajet entier, pas par
   * réservation (section 25).
   */
  async completeTrip(id: string, driverId: string) {
    const trip = await this.assertOwnership(id, driverId);
    if (trip.status !== TripStatus.ARRIVED) {
      throw new BadRequestException('Seul un trajet ARRIVED peut être clôturé.');
    }

    const unfinishedBookings = await this.prisma.booking.count({
      where: {
        tripId: id,
        status: { notIn: [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.REFUNDED] },
      },
    });
    if (unfinishedBookings > 0) {
      throw new BadRequestException(
        `${unfinishedBookings} réservation(s) n'ont pas encore été clôturées (dépose non confirmée).`,
      );
    }

    const updated = await this.prisma.trip.update({
      where: { id },
      data: { status: TripStatus.COMPLETED },
    });
    await this.driverProfilesService.incrementCompletedTrips(driverId);
    return updated;
  }

  /**
   * Trajet publié (ou dont le chauffeur a signalé son arrivée) sans
   * aucune réservation, dont le départ est passé depuis longtemps —
   * appelée par TripExpiryService. Contrairement à cancel() (annulation
   * volontaire du chauffeur), n'incrémente jamais le compteur
   * d'annulations : aucun passager n'a été impacté, personne n'a
   * concrètement annulé quoi que ce soit. Sans effet si une réservation
   * a été prise entre-temps, ou si le trajet a déjà changé de statut.
   */
  async expireStale(id: string, reason: string): Promise<boolean> {
    const claimed = await this.prisma.trip.updateMany({
      where: {
        id,
        status: { in: [TripStatus.PUBLISHED, TripStatus.DRIVER_ARRIVED] },
        bookings: { none: { status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.PAID, BookingStatus.CONFIRMED] } } },
      },
      data: { status: TripStatus.CANCELLED },
    });
    if (claimed.count === 0) return false;

    await this.audit.log({ actorId: null, entityType: 'Trip', entityId: id, action: 'AUTO_EXPIRE', diff: { reason } });
    return true;
  }

  async findAllForDriver(driverId: string, query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    const where = { driverId };
    const [data, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { departureAt: 'desc' },
        include: { originCity: true, destinationCity: true },
      }),
      this.prisma.trip.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  async findAll(
    query: PaginationQueryDto,
    filters: { status?: TripStatus; driverId?: string } = {},
  ): Promise<PaginatedResult<unknown>> {
    const where = { status: filters.status, driverId: filters.driverId };
    const [data, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { departureAt: 'desc' },
        include: { driver: true, originCity: true, destinationCity: true },
      }),
      this.prisma.trip.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  // -----------------------------------------------------------------------
  // Étapes intermédiaires
  // -----------------------------------------------------------------------

  async addStop(tripId: string, driverId: string, dto: TripStopInputDto) {
    const trip = await this.assertOwnership(tripId, driverId);
    if (trip.status !== TripStatus.DRAFT) {
      throw new BadRequestException('Les étapes ne se modifient que sur un trajet DRAFT.');
    }
    await this.locationsService.findOne(dto.locationId);
    return this.prisma.tripStop.create({
      data: {
        tripId,
        locationId: dto.locationId,
        sequence: dto.sequence,
        estimatedArrivalAt: dto.estimatedArrivalAt ? new Date(dto.estimatedArrivalAt) : undefined,
      },
    });
  }

  async removeStop(tripId: string, stopId: string, driverId: string) {
    const trip = await this.assertOwnership(tripId, driverId);
    if (trip.status !== TripStatus.DRAFT) {
      throw new BadRequestException('Les étapes ne se modifient que sur un trajet DRAFT.');
    }
    await this.prisma.tripStop.delete({ where: { id: stopId } });
  }

  // -----------------------------------------------------------------------
  // Recherche (section 8) — correspondance par ville ou par proximité
  // -----------------------------------------------------------------------

  async search(dto: SearchTripsDto): Promise<PaginatedResult<unknown>> {
    const hasCityMode = Boolean(dto.originCityId && dto.destinationCityId);
    const hasGeoMode = Boolean(dto.originLatitude !== undefined && dto.originLongitude !== undefined);

    if (!hasCityMode && !hasGeoMode) {
      throw new BadRequestException(
        'Fournissez soit originCityId + destinationCityId, soit originLatitude + originLongitude.',
      );
    }

    if (hasGeoMode) {
      return this.searchNearby(dto);
    }
    return this.searchByCities(dto);
  }

  private async searchByCities(dto: SearchTripsDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.TripWhereInput = {
      status: TripStatus.PUBLISHED,
      originCityId: dto.originCityId,
      destinationCityId: dto.destinationCityId,
      availableSeats: { gte: dto.passengersCount ?? 1 },
      ...(dto.requiresShipmentCapacity ? { allowsShipments: true } : {}),
      ...(dto.maxPricePerSeat ? { pricePerSeat: { lte: toMoneyBigInt(dto.maxPricePerSeat) } } : {}),
      ...(dto.departureDate ? this.dayRangeFilter(dto.departureDate) : {}),
      ...(dto.verifiedDriverOnly ? { driver: { isVerifiedBadge: true } } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { departureAt: 'asc' },
        include: { driver: true, vehicle: true, originCity: true, destinationCity: true },
      }),
      this.prisma.trip.count({ where }),
    ]);
    return new PaginatedResult(data, total, dto.page, dto.limit);
  }

  /**
   * "Trajets proches" (section 8) : recherche par rayon PostGIS autour du
   * point de départ souhaité, plutôt qu'une correspondance exacte de
   * ville. Le rayon est lu depuis PlatformSetting (configurable par le
   * SuperAdmin, Partie VII) avec un repli sur une valeur par défaut.
   */
  private async searchNearby(dto: SearchTripsDto): Promise<PaginatedResult<unknown>> {
    const radiusKm = await this.getSearchRadiusKm();
    const radiusMeters = radiusKm * 1000;
    const limit = dto.take;
    const offset = dto.skip;

    const tripIds = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT t.id
      FROM trips t
      JOIN locations lo ON lo.id = t."originLocationId"
      WHERE t.status = 'PUBLISHED'
        AND t."availableSeats" >= ${dto.passengersCount ?? 1}
        AND lo."geoPoint" IS NOT NULL
        AND ST_DWithin(
          lo."geoPoint",
          ST_SetSRID(ST_MakePoint(${dto.originLongitude}, ${dto.originLatitude}), 4326)::geography,
          ${radiusMeters}
        )
      ORDER BY t.id
      LIMIT ${limit} OFFSET ${offset};
    `;

    if (tripIds.length === 0) {
      return new PaginatedResult([], 0, dto.page, dto.limit);
    }

    const trips = await this.prisma.trip.findMany({
      where: { id: { in: tripIds.map((row) => row.id) } },
      orderBy: { departureAt: 'asc' },
      include: { driver: true, vehicle: true, originCity: true, destinationCity: true },
    });

    // Le compte total exact en mode géospatial demanderait une seconde
    // requête sans LIMIT/OFFSET ; approximé ici par la taille de la page
    // courante pour éviter de doubler le coût de la requête PostGIS à
    // chaque appel. À affiner si la pagination profonde devient un besoin réel.
    return new PaginatedResult(trips, trips.length + offset, dto.page, dto.limit);
  }

  private async getSearchRadiusKm(): Promise<number> {
    return this.pricing.getNumericSetting(SEARCH_RADIUS_SETTING_KEY, DEFAULT_SEARCH_RADIUS_KM);
  }

  private dayRangeFilter(dateOnly: string): Prisma.TripWhereInput {
    const start = new Date(`${dateOnly}T00:00:00.000Z`);
    const end = new Date(`${dateOnly}T23:59:59.999Z`);
    return { departureAt: { gte: start, lte: end } };
  }
}