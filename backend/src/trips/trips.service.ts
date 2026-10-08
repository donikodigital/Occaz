// backend/src/trips/trips.service.ts
// [03/10/2026] v+ — Étapes (villes traversées) : un trajet Conakry → Labé peut desservir Kindia, Mamou… Chaque étape a
// sa ville, son prix depuis le départ (calculé automatiquement au prorata de la distance, modifiable en brouillon) et son
// heure de passage. La recherche trouve un trajet dès que la ville de montée précède la ville de descente sur la route,
// et le prix d'un tronçon est la différence des prix de ses deux extrémités (voir trip-route.ts).
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  CancellationInitiator,
  NotificationChannel,
  NotificationType,
  Prisma,
  ServiceType,
  ShipmentStatus,
  TripStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { LocationsService } from '../locations/locations.service';
import { DriverProfilesService } from '../profiles/driver-profiles/driver-profiles.service';
import { PricingService } from '../pricing/pricing.service';
import { TripPricingService } from '../trip-pricing/trip-pricing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { toMoneyBigInt } from '../common/utils/money.util';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { SearchTripsDto } from './dto/search-trips.dto';
import { TripStopInputDto } from './dto/trip-stop-input.dto';
import { UpdateTripStopDto } from './dto/update-trip-stop.dto';
import { TripSegmentQueryDto } from './dto/trip-segment-query.dto';
import { BookingsService } from './bookings.service';
import {
  SEGMENT_FAILURE_MESSAGES,
  buildRoute,
  matchRoute,
  matchRouteFromCity,
  matchRouteToCity,
  rescaleFares,
  resolveSegment,
  type RouteSegment,
  type RouteStopInput,
  type RouteTripInput,
} from './trip-route';
import { TripRoutePlanner, loadRouteSettings } from './trip-route.planner';
import { freeSeatsOnSegment, seatsByLeg, seatsOccupiedByLeg, type SeatHoldInput } from './trip-seats';
import { SEAT_HOLDING_STATUSES, SEAT_HOLD_SELECT } from './trip-seats.db';

const DEFAULT_SEARCH_RADIUS_KM = 5;
/** Nombre maximal de trajets examinés par une recherche par villes (le tri exact par tronçon se fait ensuite en mémoire). */
const SEARCH_CANDIDATE_LIMIT = 300;
const DAY_MS = 24 * 3_600_000;

/** Trajet avec ses villes ; les étapes ne sont pas chargées dans toutes les listes (ex. trajets proches). */
type TripLike = Omit<RouteTripInput, 'stops'> & {
  originCity: { countryId: string; name: string };
  destinationCity: { name: string };
  stops?: Array<RouteStopInput & { city?: { name: string } | null }>;
  totalSeats?: number;
  availableSeats?: number;
  /** Réservations qui occupent des places (montée, descente, nombre) — jamais renvoyées au client, seulement comptées. */
  bookings?: SeatHoldInput[];
};

/** À joindre aux requêtes de trajets pour compter les places libres par tronçon. */
const SEAT_HOLDS_INCLUDE = { where: { status: { in: SEAT_HOLDING_STATUSES } }, select: SEAT_HOLD_SELECT } as const;
const SEARCH_RADIUS_SETTING_KEY = 'trip.search_radius_km';
/** Devise à joindre aux listes pour que les écrans affichent les montants dans la bonne monnaie (même pattern que shipments.service.ts). */
const CURRENCY_SELECT = { select: { id: true, isoCode: true, symbol: true } } as const;
/**
 * NB sur le cycle de vie (section 20) : ce Lot implémente les transitions
 * DRAFT -> PUBLISHED et -> CANCELLED, entièrement sous le contrôle du
 * conducteur/admin. Les étapes DRIVER_ARRIVED / PASSENGER_PICKED_UP /
 * IN_PROGRESS / ARRIVED / COMPLETED nécessitent une validation OTP
 * (section 18, "le conducteur ne génère jamais lui-même la validation") et
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
    private readonly notifications: NotificationsService,
    private readonly tripPricing: TripPricingService,
  ) {}

  /** Calculs de route qui demandent la base (distances, prix automatiques) — sans changer le constructeur injecté. */
  private readonly planner = new TripRoutePlanner(this.pricing);

  /**
   * `segmentQuery` : tronçon demandé (étape de montée / de descente) ; absent = trajet entier. Le prix client renvoyé
   * (`customerPricePerSeat`) est toujours celui du tronçon demandé, et `segment` décrit ce tronçon.
   */
  async findOne(id: string, segmentQuery: TripSegmentQueryDto = {}) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      include: {
        driver: true,
        vehicle: true,
        // Villes avec leur pays : l'app affiche « Kindia, Guinée » sous chaque adresse.
        originCity: { include: { country: true } },
        originLocation: true,
        destinationCity: { include: { country: true } },
        destinationLocation: true,
        stops: { orderBy: { sequence: 'asc' }, include: { location: true, city: { include: { country: true } } } },
        currency: CURRENCY_SELECT,
        bookings: SEAT_HOLDS_INCLUDE,
      },
    });
    if (!trip) throw new NotFoundException('Trajet introuvable.');

    const settings = await loadRouteSettings(this.pricing);
    const resolved = resolveSegment(
      buildRoute(trip),
      segmentQuery.boardingStopId,
      segmentQuery.alightingStopId,
      settings.minSegmentPrice,
    );
    if (!resolved.ok) throw new BadRequestException(SEGMENT_FAILURE_MESSAGES[resolved.reason]);
    return this.withSegment(trip, resolved.segment);
  }

  /**
   * Ajoute à CÔTÉ des champs du trajet (jamais à leur place) :
   *  - customerPricePerSeat : prix du tronçon + commission plateforme — ce que le client paiera. Le client ne doit jamais
   *    voir le prix brut fixé par le conducteur ; le conducteur, lui, continue de lire pricePerSeat tel quel (sa propre
   *    saisie). GET /trips/:id sert les deux publics, d'où cet ajout plutôt qu'une transformation du champ existant ;
   *  - segment : le tronçon (montée, descente, heure de passage à la montée, prix avant commission, places libres sur ce
   *    tronçon) ;
   *  - seatsByLeg : places occupées et libres sur chaque tronçon de la route (trajets avec étapes, détail d'un trajet).
   * Les réservations jointes pour compter les places ne sont jamais renvoyées.
   */
  private async withSegment<T extends TripLike>(trip: T, segment: RouteSegment) {
    const fee = await this.pricing.computeCommission({
      serviceType: ServiceType.TRIP,
      countryId: trip.originCity.countryId,
      baseAmount: segment.pricePerSeat,
    });

    const cityName = (point: RouteSegment['from']): string | null => {
      if (point.kind === 'ORIGIN') return trip.originCity.name;
      if (point.kind === 'DESTINATION') return trip.destinationCity.name;
      return trip.stops?.find((stop) => stop.id === point.stopId)?.city?.name ?? null;
    };

    const { bookings, ...tripFields } = trip;
    const route = buildRoute({ ...trip, stops: trip.stops ?? [] });
    const occupiedByLeg = bookings && trip.totalSeats !== undefined ? seatsOccupiedByLeg(route, bookings) : null;

    return {
      ...tripFields,
      customerPricePerSeat: segment.pricePerSeat + fee,
      seatsByLeg:
        occupiedByLeg && trip.totalSeats !== undefined && (trip.stops?.length ?? 0) > 0
          ? seatsByLeg(route, occupiedByLeg, trip.totalSeats).map((leg) => ({
              ...leg,
              fromCityName: cityName(route[leg.fromIndex]),
              toCityName: cityName(route[leg.toIndex]),
            }))
          : undefined,
      segment: {
        availableSeats: this.segmentFreeSeats(trip, segment),
        boardingStopId: segment.from.stopId,
        alightingStopId: segment.to.stopId,
        boardingCityId: segment.from.cityId,
        alightingCityId: segment.to.cityId,
        boardingCityName: cityName(segment.from),
        alightingCityName: cityName(segment.to),
        boardingAt: segment.boardingAt ?? trip.departureAt,
        isFullTrip: segment.isFullTrip,
        pricePerSeat: segment.pricePerSeat,
      },
    };
  }

  /**
   * Places libres sur CE tronçon : le tronçon le plus chargé entre la montée et la descente décide. Sans les réservations
   * (listes qui ne les joignent pas), on retombe sur le compteur du trajet — la valeur pour le trajet entier, donc prudente.
   */
  private segmentFreeSeats(trip: TripLike, segment: RouteSegment): number | null {
    if (trip.bookings && trip.totalSeats !== undefined) {
      const route = buildRoute({ ...trip, stops: trip.stops ?? [] });
      return freeSeatsOnSegment(
        trip.totalSeats,
        seatsOccupiedByLeg(route, trip.bookings),
        segment.from.index,
        segment.to.index,
      );
    }
    return trip.availableSeats ?? null;
  }

  /** Trajet entier (liste des trajets proches, où les étapes ne sont pas chargées). */
  private async withCustomerPrice<T extends TripLike>(trip: T) {
    const resolved = resolveSegment(buildRoute({ ...trip, stops: trip.stops ?? [] }), null, null);
    if (!resolved.ok) throw new BadRequestException(SEGMENT_FAILURE_MESSAGES[resolved.reason]);
    return this.withSegment(trip, resolved.segment);
  }

  private async withCustomerPriceList<T extends TripLike>(trips: T[]) {
    const results = [];
    for (const trip of trips) {
      results.push(await this.withCustomerPrice(trip));
    }
    return results;
  }

  /** Lève une exception si `driverId` n'est pas le propriétaire du trajet. */
  private async assertOwnership(id: string, driverId: string) {
    const trip = await this.findOne(id);
    if (trip.driverId !== driverId) {
      throw new ForbiddenException("Ce trajet n'appartient pas à ce conducteur.");
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

    // Étapes : rangées dans l'ordre de passage demandé, chacune dans une ville différente de celles du trajet.
    const orderedStops = [...(dto.stops ?? [])].sort((a, b) => a.sequence - b.sequence);
    const stopLocations: Array<{ cityId: string | null }> = [];
    for (const stop of orderedStops) {
      stopLocations.push(await this.locationsService.findOne(stop.locationId));
    }
    this.assertValidStopCities(dto.originCityId, dto.destinationCityId, stopLocations);

    if (new Date(dto.departureAt).getTime() <= Date.now()) {
      throw new BadRequestException("La date de départ doit être dans le futur.");
    }

    const departureAt = new Date(dto.departureAt);
    const currencyId = await this.currencyForOriginCity(dto.originCityId, dto.currencyId);
    // Prix selon le mode choisi par le SuperAdmin (manuel / semi-automatique / automatique) : voir TripPricingService.
    const decision = await this.tripPricing.decidePrice({
      originLocationId: dto.originLocationId,
      destinationLocationId: dto.destinationLocationId,
      currencyId,
      requested: dto.pricePerSeat ? toMoneyBigInt(dto.pricePerSeat) : undefined,
    });
    const pricePerSeat = decision.pricePerSeat;
    const plannedStops = await this.planner.planStops({
      departureAt,
      pricePerSeat,
      originLocationId: dto.originLocationId,
      destinationLocationId: dto.destinationLocationId,
      stops: orderedStops.map((stop, index) => ({
        locationId: stop.locationId,
        cityId: stopLocations[index].cityId as string,
        // Prix fixés par Occa'Z : les prix d'étapes saisis par le conducteur sont ignorés, ils se calculent au prorata.
        fareFromOrigin:
          !decision.locked && stop.fareFromOrigin !== undefined ? toMoneyBigInt(stop.fareFromOrigin) : undefined,
        estimatedArrivalAt: stop.estimatedArrivalAt ? new Date(stop.estimatedArrivalAt) : undefined,
        isBookable: stop.isBookable,
      })),
    });

    // Trajet et étapes créés ensemble : jamais un trajet sans ses étapes si l'une des écritures échoue.
    const trip = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.trip.create({
        data: {
          driverId,
          vehicleId: dto.vehicleId,
          originCityId: dto.originCityId,
          originLocationId: dto.originLocationId,
          destinationCityId: dto.destinationCityId,
          destinationLocationId: dto.destinationLocationId,
          departureAt,
          status: TripStatus.DRAFT,
          totalSeats: dto.totalSeats,
          availableSeats: dto.totalSeats,
          allowsLuggage: dto.allowsLuggage ?? true,
          allowsShipments: dto.allowsShipments ?? true,
          maxShipmentWeightKg: dto.maxShipmentWeightKg,
          availableShipmentWeightKg: dto.maxShipmentWeightKg,
          pricePerSeat,
          currencyId,
          notes: dto.notes,
        },
      });
      if (plannedStops.length > 0) {
        await tx.tripStop.createMany({ data: plannedStops.map((row) => ({ ...row, tripId: created.id })) });
      }
      return created;
    });

    return this.findOne(trip.id);
  }

  /**
   * Devise du trajet = devise par défaut du pays de la ville de DÉPART : c'est là que le passager monte et paie, donc la devise
   * qu'il attend. Départ au Sénégal → XOF, en Guinée → GNF — le conducteur n'a pas à la choisir (et ne peut pas se tromper). La
   * conversion vers le portefeuille du conducteur, s'il est dans une autre devise, se fait déjà au crédit (ExchangeRateService).
   * `requested` (ancienne version de l'app) ne sert que si ce pays n'a pas de devise par défaut configurée.
   */
  private async currencyForOriginCity(originCityId: string, requested?: string): Promise<string> {
    const city = await this.prisma.city.findUnique({
      where: { id: originCityId },
      select: { country: { select: { defaultCurrencyId: true } } },
    });
    const fromCountry = city?.country?.defaultCurrencyId;
    if (fromCountry) return fromCountry;
    if (requested) return requested;
    throw new BadRequestException(
      "Impossible de déterminer la devise : le pays de la ville de départ n'a pas de devise par défaut configurée.",
    );
  }

  /** Chaque étape doit avoir une ville, différente de celles du départ, de l'arrivée et des autres étapes. */
  private assertValidStopCities(
    originCityId: string,
    destinationCityId: string,
    locations: Array<{ cityId: string | null }>,
    alreadyUsedCityIds: string[] = [],
  ): void {
    const used = new Set<string>([originCityId, destinationCityId, ...alreadyUsedCityIds]);
    for (const location of locations) {
      if (!location.cityId) {
        throw new BadRequestException("Chaque étape doit être rattachée à une ville : choisissez une adresse localisée dans la ville traversée.");
      }
      if (used.has(location.cityId)) {
        throw new BadRequestException(
          "Une étape ne peut pas se trouver dans la ville de départ, la ville d'arrivée ou une ville déjà traversée.",
        );
      }
      used.add(location.cityId);
    }
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

    if (dto.originLocationId) await this.locationsService.findOne(dto.originLocationId);
    if (dto.destinationLocationId) await this.locationsService.findOne(dto.destinationLocationId);

    // Le prix n'est revu que si le conducteur le change ou change le trajet (les distances changent) ; une simple
    // modification de l'heure ou des notes ne doit pas être bloquée par un réglage modifié entre-temps (la publication
    // revérifie de toute façon le prix).
    let pricePerSeat: bigint | undefined;
    if (dto.pricePerSeat || dto.originLocationId || dto.destinationLocationId) {
      const decision = await this.tripPricing.decidePrice({
        originLocationId: dto.originLocationId ?? trip.originLocationId,
        destinationLocationId: dto.destinationLocationId ?? trip.destinationLocationId,
        currencyId: trip.currencyId,
        requested: dto.pricePerSeat ? toMoneyBigInt(dto.pricePerSeat) : trip.pricePerSeat,
      });
      pricePerSeat = decision.pricePerSeat;
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.trip.update({
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
          pricePerSeat,
          // La devise ne se modifie pas : elle suit le pays de la ville de départ, qui ne change pas en brouillon.
          notes: dto.notes,
        },
      });

      if (trip.stops.length > 0) await this.realignStopsAfterTripUpdate(tx, trip, updated);
      return updated;
    });
  }

  /**
   * Garde les étapes cohérentes quand le trajet change (toujours en brouillon, donc sans réservation) : si le prix du
   * trajet change, les prix des étapes gardent leurs proportions ; si le départ change, les heures de passage suivent ;
   * si une adresse change, les distances sont recalculées.
   */
  private async realignStopsAfterTripUpdate(
    tx: Prisma.TransactionClient,
    before: {
      pricePerSeat: bigint;
      departureAt: Date;
      stops: Array<{ id: string; locationId: string; fareFromOrigin: bigint | null; estimatedArrivalAt: Date | null }>;
    },
    after: { pricePerSeat: bigint; departureAt: Date; originLocationId: string; destinationLocationId: string },
  ): Promise<void> {
    const priceChanged = before.pricePerSeat !== after.pricePerSeat;
    const departureShiftMs = after.departureAt.getTime() - before.departureAt.getTime();
    const settings = await loadRouteSettings(this.pricing);

    const fares = priceChanged
      ? rescaleFares(before.pricePerSeat, after.pricePerSeat, before.stops.map((stop) => stop.fareFromOrigin), settings.roundingStep)
      : before.stops.map((stop) => stop.fareFromOrigin);
    const geometry = await this.planner.computeGeometry(
      after.originLocationId,
      before.stops.map((stop) => stop.locationId),
      after.destinationLocationId,
    );

    for (const [index, stop] of before.stops.entries()) {
      await tx.tripStop.update({
        where: { id: stop.id },
        data: {
          fareFromOrigin: fares[index],
          estimatedArrivalAt:
            departureShiftMs !== 0 && stop.estimatedArrivalAt
              ? new Date(stop.estimatedArrivalAt.getTime() + departureShiftMs)
              : undefined,
          distanceFromOriginKm: geometry ? geometry.cumulativeKm[index] : undefined,
        },
      });
    }
  }

  async publish(id: string, driverId: string) {
    const trip = await this.assertOwnership(id, driverId);
    if (trip.status !== TripStatus.DRAFT) {
      throw new BadRequestException('Seul un trajet DRAFT peut être publié.');
    }

    // Le brouillon peut dater : le prix est revérifié avec la configuration du jour. Mode automatique : remis au prix
    // actuel (les étapes suivent) ; mode semi-automatique : un prix devenu trop élevé bloque la publication.
    const priceOnPublish = await this.tripPricing.priceToApplyOnPublish({
      originLocationId: trip.originLocationId,
      destinationLocationId: trip.destinationLocationId,
      currencyId: trip.currencyId,
      pricePerSeat: trip.pricePerSeat,
    });
    if (priceOnPublish === null) {
      return this.prisma.trip.update({
        where: { id },
        data: { status: TripStatus.PUBLISHED },
      });
    }
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const published = await tx.trip.update({
        where: { id },
        data: { status: TripStatus.PUBLISHED, pricePerSeat: priceOnPublish },
      });
      if (trip.stops.length > 0) await this.realignStopsAfterTripUpdate(tx, trip, published);
      return published;
    });
  }

  /**
   * Annulation par le conducteur : bascule le trajet et toutes ses
   * réservations actives en CANCELLED, et incrémente le compteur
   * d'annulations du conducteur (section 26). Le remboursement effectif
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
  // conducteur, sans validation OTP (le pickup/dropoff par réservation,
  // lui, passe par TripOtpService). Voir la note de cycle de vie en tête
  // de fichier pour l'articulation complète des statuts (section 20).
  // -----------------------------------------------------------------------

  async markDriverArrived(id: string, driverId: string) {
    const trip = await this.assertOwnership(id, driverId);
    if (trip.status !== TripStatus.PUBLISHED) {
      throw new BadRequestException('Seul un trajet PUBLISHED peut passer à "conducteur arrivé".');
    }
    // Sans réservation payée, personne n'attend au départ — et une fois « arrivé », le trajet n'accepte plus de réservation
    // (elles ne se prennent que sur un trajet PUBLISHED) : il ne pourrait jamais démarrer.
    const reservations = await this.prisma.booking.count({
      where: { tripId: id, status: { in: [BookingStatus.PAID, BookingStatus.CONFIRMED] } },
    });
    if (reservations === 0) {
      throw new BadRequestException(
        "Aucune réservation sur ce trajet : vous pourrez signaler votre arrivée au départ dès qu'un passager aura réservé.",
      );
    }
    const updated = await this.prisma.trip.update({
      where: { id },
      data: { status: TripStatus.DRIVER_ARRIVED },
    });

    const activeBookings = await this.prisma.booking.findMany({
      // Les clients qui montent à une étape sont prévenus à leur étape (voir markArrivedAtStop), pas au départ.
      where: { tripId: id, boardingStopId: null, status: { in: [BookingStatus.PAID, BookingStatus.CONFIRMED] } },
      select: { customer: { select: { userId: true } } },
    });
    await Promise.all(
      activeBookings.map((booking) =>
        this.notifications.notify({
          userId: booking.customer.userId,
          type: NotificationType.DEPARTURE_IMMINENT,
          channels: [NotificationChannel.PUSH, NotificationChannel.SMS],
          fallbackTitle: 'Le conducteur est arrivé',
          fallbackBody: `Votre conducteur vous attend au point de départ de ${trip.originCity.name} → ${trip.destinationCity.name}. Tenez votre code de prise en charge prêt à lui communiquer.`,
          pushData: { type: 'DEPARTURE_IMMINENT', tripId: id },
        }),
      ),
    );

    return updated;
  }

  /** Démarre le trajet — au moins un passager doit déjà avoir été pris en charge (OTP départ vérifié). */
  async startTrip(id: string, driverId: string) {
    const trip = await this.assertOwnership(id, driverId);
    if (trip.status === TripStatus.DRIVER_ARRIVED) {
      // Personne ne monte au départ (tous les clients montent à une étape) : le conducteur peut démarrer, à condition
      // qu'au moins une réservation payée l'attende à une étape — sinon il n'a aucun passager à emmener — et qu'aucun
      // client du départ ne soit encore là à attendre : une fois le trajet en cours, il ne pourrait plus monter.
      const activeStatuses = { in: [BookingStatus.PAID, BookingStatus.CONFIRMED] };
      const [waitingAtStops, waitingAtOrigin] = await Promise.all([
        this.prisma.booking.count({ where: { tripId: id, boardingStopId: { not: null }, status: activeStatuses } }),
        this.prisma.booking.count({ where: { tripId: id, boardingStopId: null, status: activeStatuses } }),
      ]);
      if (waitingAtStops > 0 && waitingAtOrigin === 0) {
        return this.prisma.trip.update({ where: { id }, data: { status: TripStatus.IN_PROGRESS } });
      }
    }
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
   * Appelé par polling depuis l'app conducteur pendant IN_PROGRESS (toutes
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
   * Accessible au conducteur du trajet (confirme que ses propres mises à
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
   * réputation du conducteur une fois pour le trajet entier, pas par
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
   * Trajet publié (ou dont le conducteur a signalé son arrivée) sans
   * aucune réservation, dont le départ est passé depuis longtemps —
   * appelée par TripExpiryService. Contrairement à cancel() (annulation
   * volontaire du conducteur), n'incrémente jamais le compteur
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
        // Un envoi accepté sur ce trajet et pas encore livré : le conducteur a encore du travail, le trajet n'est pas « abandonné ».
        shipments: { none: { status: { in: [ShipmentStatus.DRIVER_ASSIGNED, ShipmentStatus.PICKUP_PENDING, ShipmentStatus.PICKED_UP, ShipmentStatus.IN_TRANSIT, ShipmentStatus.DELIVERY_PENDING] } } },
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
        // Étapes jointes : l'app conducteur y retrouve les villes traversées (colis sur la route, « via Kindia · Mamou »).
        // La devise du trajet accompagne chaque liste : l'app n'a plus à deviner « GNF ».
        include: {
          originCity: true,
          destinationCity: true,
          stops: { orderBy: { sequence: 'asc' }, include: { city: true } },
          currency: CURRENCY_SELECT,
        },
      }),
      this.prisma.trip.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  async findAll(
    query: PaginationQueryDto,
    filters: { status?: TripStatus; driverId?: string } = {},
    /** Filtre de portée par pays (CountryScopeService) ; absent = aucune restriction. */
    scopeWhere?: Prisma.TripWhereInput,
  ): Promise<PaginatedResult<unknown>> {
    const baseWhere = { status: filters.status, driverId: filters.driverId };
    const where = scopeWhere ? { AND: [baseWhere, scopeWhere] } : baseWhere;
    const [data, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { departureAt: 'desc' },
        include: { driver: true, originCity: true, destinationCity: true, currency: CURRENCY_SELECT },
      }),
      this.prisma.trip.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  // -----------------------------------------------------------------------
  // Étapes intermédiaires
  // -----------------------------------------------------------------------

  /**
   * Ajoute une étape à la position demandée (les suivantes sont décalées). Son prix est calculé entre ceux de ses voisins
   * au prorata de la distance, sauf prix saisi ; son heure de passage est estimée depuis le départ.
   */
  async addStop(tripId: string, driverId: string, dto: TripStopInputDto) {
    const trip = await this.assertOwnership(tripId, driverId);
    if (trip.status !== TripStatus.DRAFT) {
      throw new BadRequestException('Les étapes ne se modifient que sur un trajet DRAFT.');
    }
    const location = await this.locationsService.findOne(dto.locationId);
    this.assertValidStopCities(
      trip.originCityId,
      trip.destinationCityId,
      [location],
      trip.stops.map((stop) => stop.cityId).filter((cityId): cityId is string => cityId !== null),
    );

    const settings = await loadRouteSettings(this.pricing);
    const existing = trip.stops;
    const position = Math.min(Math.max(dto.sequence, 1), existing.length + 1);
    const insertIndex = existing.filter((stop) => stop.sequence < position).length;

    const orderedLocationIds = existing.map((stop) => stop.locationId);
    orderedLocationIds.splice(insertIndex, 0, dto.locationId);
    const geometry = await this.planner.computeGeometry(trip.originLocationId, orderedLocationIds, trip.destinationLocationId);

    const previous = insertIndex > 0 ? existing[insertIndex - 1] : null;
    const next = insertIndex < existing.length ? existing[insertIndex] : null;
    const thisKm = geometry ? geometry.cumulativeKm[insertIndex] : null;
    // Prix fixés par Occa'Z (mode automatique) : le prix saisi est ignoré, l'étape prend le prix calculé au prorata.
    const priceLocked = await this.tripPricing.isPriceLocked({
      originLocationId: trip.originLocationId,
      destinationLocationId: trip.destinationLocationId,
      currencyId: trip.currencyId,
    });
    const fare =
      dto.fareFromOrigin !== undefined && !priceLocked
        ? toMoneyBigInt(dto.fareFromOrigin)
        : this.planner.interpolateInsertedFare({
            previousFare: previous?.fareFromOrigin ?? 0n,
            nextFare: next?.fareFromOrigin ?? trip.pricePerSeat,
            previousKm: previous ? (previous.distanceFromOriginKm ?? null) : 0,
            nextKm: next ? (next.distanceFromOriginKm ?? null) : geometry ? geometry.totalKm : null,
            thisKm,
            roundingStep: settings.roundingStep,
          });
    if (fare < (previous?.fareFromOrigin ?? 0n) || fare > (next?.fareFromOrigin ?? trip.pricePerSeat)) {
      throw new BadRequestException("Le prix de l'étape doit rester entre ceux des étapes voisines.");
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Décalage de la dernière étape vers la première : l'unicité (trajet + ordre) n'est jamais violée.
      const toShift = existing.filter((stop) => stop.sequence >= position).sort((a, b) => b.sequence - a.sequence);
      for (const stop of toShift) {
        await tx.tripStop.update({ where: { id: stop.id }, data: { sequence: stop.sequence + 1 } });
      }

      const created = await tx.tripStop.create({
        data: {
          tripId,
          locationId: dto.locationId,
          cityId: location.cityId as string,
          sequence: position,
          distanceFromOriginKm: thisKm,
          fareFromOrigin: fare,
          estimatedArrivalAt: dto.estimatedArrivalAt
            ? new Date(dto.estimatedArrivalAt)
            : thisKm !== null
              ? estimateArrivalAtFor(trip.departureAt, thisKm, settings)
              : null,
          isBookable: dto.isBookable ?? true,
        },
      });

      if (geometry) {
        for (const [index, stop] of existing.entries()) {
          const newIndex = index >= insertIndex ? index + 1 : index;
          await tx.tripStop.update({ where: { id: stop.id }, data: { distanceFromOriginKm: geometry.cumulativeKm[newIndex] } });
        }
      }
      return created;
    });
  }

  /** Modifie le prix, l'heure de passage ou la disponibilité d'une étape (brouillon uniquement). */
  async updateStop(tripId: string, stopId: string, driverId: string, dto: UpdateTripStopDto) {
    const trip = await this.assertOwnership(tripId, driverId);
    if (trip.status !== TripStatus.DRAFT) {
      throw new BadRequestException('Les étapes ne se modifient que sur un trajet DRAFT.');
    }
    const stop = trip.stops.find((candidate) => candidate.id === stopId);
    if (!stop) throw new NotFoundException('Étape introuvable sur ce trajet.');

    if (dto.fareFromOrigin !== undefined) {
      const priceLocked = await this.tripPricing.isPriceLocked({
        originLocationId: trip.originLocationId,
        destinationLocationId: trip.destinationLocationId,
        currencyId: trip.currencyId,
      });
      if (priceLocked) throw new BadRequestException("Les prix des étapes sont fixés automatiquement par Occa'Z.");
    }
    const fare = dto.fareFromOrigin !== undefined ? toMoneyBigInt(dto.fareFromOrigin) : undefined;
    if (fare !== undefined) this.planner.assertFareWithinNeighbours(trip, stopId, fare);

    return this.prisma.tripStop.update({
      where: { id: stopId },
      data: {
        fareFromOrigin: fare,
        isBookable: dto.isBookable,
        estimatedArrivalAt: dto.estimatedArrivalAt ? new Date(dto.estimatedArrivalAt) : undefined,
      },
    });
  }

  async removeStop(tripId: string, stopId: string, driverId: string) {
    const trip = await this.assertOwnership(tripId, driverId);
    if (trip.status !== TripStatus.DRAFT) {
      throw new BadRequestException('Les étapes ne se modifient que sur un trajet DRAFT.');
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Le trajet est vérifié dans la condition : un conducteur ne peut pas supprimer l'étape d'un autre trajet.
      const removed = await tx.tripStop.deleteMany({ where: { id: stopId, tripId } });
      if (removed.count === 0) throw new NotFoundException('Étape introuvable sur ce trajet.');

      const remaining = trip.stops.filter((stop) => stop.id !== stopId);
      const geometry = await this.planner.computeGeometry(
        trip.originLocationId,
        remaining.map((stop) => stop.locationId),
        trip.destinationLocationId,
      );
      for (const [index, stop] of remaining.entries()) {
        await tx.tripStop.update({
          where: { id: stop.id },
          data: { sequence: index + 1, distanceFromOriginKm: geometry ? geometry.cumulativeKm[index] : undefined },
        });
      }
    });
  }

  /**
   * Le conducteur signale son arrivée à une étape (trajet en cours) : les clients qui montent ici sont prévenus et peuvent
   * donner leur code de prise en charge. Sans effet répété : la première arrivée signalée fait foi.
   */
  async markArrivedAtStop(tripId: string, stopId: string, driverId: string) {
    const trip = await this.assertOwnership(tripId, driverId);
    if (trip.status !== TripStatus.IN_PROGRESS) {
      throw new BadRequestException("L'arrivée à une étape ne se signale que pendant un trajet en cours.");
    }
    const stop = trip.stops.find((candidate) => candidate.id === stopId);
    if (!stop) throw new NotFoundException('Étape introuvable sur ce trajet.');
    if (stop.arrivedAt) return stop;

    const updated = await this.prisma.tripStop.update({ where: { id: stopId }, data: { arrivedAt: new Date() } });

    const boardingHere = await this.prisma.booking.findMany({
      where: { tripId, boardingStopId: stopId, status: { in: [BookingStatus.PAID, BookingStatus.CONFIRMED] } },
      select: { customer: { select: { userId: true } } },
    });
    const cityName = stop.city?.name ?? 'votre point de montée';
    await Promise.all(
      boardingHere.map((booking) =>
        this.notifications.notify({
          userId: booking.customer.userId,
          type: NotificationType.DEPARTURE_IMMINENT,
          channels: [NotificationChannel.PUSH, NotificationChannel.SMS],
          fallbackTitle: 'Le conducteur est arrivé',
          fallbackBody: `Votre conducteur est arrivé à ${cityName}. Tenez votre code de prise en charge prêt à lui communiquer.`,
          pushData: { type: 'DEPARTURE_IMMINENT', tripId },
        }),
      ),
    );
    return updated;
  }

  // -----------------------------------------------------------------------
  // Recherche (section 8) — correspondance par ville ou par proximité
  // -----------------------------------------------------------------------

  async search(dto: SearchTripsDto): Promise<PaginatedResult<unknown>> {
    // Une seule ville suffit : sans départ, tous les trajets qui mènent à la destination ; sans arrivée, tous ceux qui partent
    // de la ville de départ.
    const hasCityMode = Boolean(dto.originCityId || dto.destinationCityId);
    const hasGeoMode = Boolean(dto.originLatitude !== undefined && dto.originLongitude !== undefined);

    if (!hasCityMode && !hasGeoMode) {
      throw new BadRequestException(
        'Fournissez au moins une ville (originCityId ou destinationCityId), ou originLatitude + originLongitude.',
      );
    }

    if (hasGeoMode) {
      return this.searchNearby(dto);
    }
    return this.searchByCities(dto);
  }

  /**
   * Recherche par villes : un trajet convient dès que la ville de montée précède la ville de descente sur sa route
   * (départ → étapes → arrivée). Un client de Kindia qui va à Labé trouve donc un trajet Conakry → Labé qui passe par
   * Kindia. Le prix affiché est celui du tronçon, l'heure celle du passage estimé à la montée.
   *
   * Le filtre en base retient les trajets candidats (villes présentes sur la route) ; l'ordre des villes, la date au point
   * de montée et le prix du tronçon se vérifient ensuite en mémoire sur ces candidats (au plus SEARCH_CANDIDATE_LIMIT).
   */
  private async searchByCities(dto: SearchTripsDto): Promise<PaginatedResult<unknown>> {
    const { originCityId, destinationCityId } = dto;
    const settings = await loadRouteSettings(this.pricing);
    const maxPrice = dto.maxPricePerSeat ? toMoneyBigInt(dto.maxPricePerSeat) : undefined;

    const bookableStopIn = (cityId: string): Prisma.TripWhereInput => ({
      stops: { some: { cityId, isBookable: true, fareFromOrigin: { not: null } } },
    });
    const passengersCount = dto.passengersCount ?? 1;
    const where: Prisma.TripWhereInput = {
      status: TripStatus.PUBLISHED,
      ...(dto.requiresShipmentCapacity ? { allowsShipments: true } : {}),
      ...(dto.verifiedDriverOnly ? { driver: { isVerifiedBadge: true } } : {}),
      // Un trajet de nuit peut passer à l'étape le jour demandé en étant parti la veille : fenêtre élargie d'un jour,
      // le jour exact est vérifié ensuite sur l'heure de passage à la montée.
      ...(dto.departureDate ? this.dayWindowPrefilter(dto.departureDate) : {}),
      AND: [
        originCityId && destinationCityId
          ? {
              OR: [
                { originCityId, destinationCityId },
                { originCityId, ...bookableStopIn(destinationCityId) },
                { destinationCityId, ...bookableStopIn(originCityId) },
                { AND: [bookableStopIn(originCityId), bookableStopIn(destinationCityId)] },
              ],
            }
          : destinationCityId
            ? // Seulement la destination : trajets qui y arrivent, ou qui la traversent en y laissant descendre.
              { OR: [{ destinationCityId }, bookableStopIn(destinationCityId)] }
            : // Seulement le départ : trajets qui en partent, ou qui le traversent en y laissant monter.
              { OR: [{ originCityId: originCityId as string }, bookableStopIn(originCityId as string)] },
        // Les places se comptent par tronçon : un trajet complet de bout en bout peut encore avoir de la place entre deux
        // villes. Sans étapes, le compteur suffit ; avec étapes, le contrôle exact se fait ensuite sur chaque tronçon.
        { OR: [{ availableSeats: { gte: passengersCount } }, { stops: { some: {} } }] },
      ],
    };

    const candidates = await this.prisma.trip.findMany({
      where,
      orderBy: { departureAt: 'asc' },
      take: SEARCH_CANDIDATE_LIMIT,
      include: {
        driver: true,
        vehicle: true,
        originCity: true,
        destinationCity: true,
        stops: { orderBy: { sequence: 'asc' }, include: { city: true } },
        currency: CURRENCY_SELECT,
        bookings: SEAT_HOLDS_INCLUDE,
      },
    });

    const matches: Array<{ trip: (typeof candidates)[number]; segment: RouteSegment; boardingAt: Date }> = [];
    for (const trip of candidates) {
      const route = buildRoute(trip);
      const options = { minPrice: settings.minSegmentPrice };
      const segment =
        originCityId && destinationCityId
          ? matchRoute(route, originCityId, destinationCityId, options)
          : destinationCityId
            ? matchRouteToCity(route, destinationCityId, options)
            : matchRouteFromCity(route, originCityId as string, options);
      if (!segment) continue;
      const boardingAt = segment.boardingAt ?? trip.departureAt;
      if (dto.departureDate && !this.isOnDay(boardingAt, dto.departureDate)) continue;
      if (maxPrice !== undefined && segment.pricePerSeat > maxPrice) continue;
      // Assez de places sur CE tronçon (et pas seulement sur le trajet entier).
      if ((this.segmentFreeSeats(trip, segment) ?? 0) < passengersCount) continue;
      matches.push({ trip, segment, boardingAt });
    }
    matches.sort((a, b) => a.boardingAt.getTime() - b.boardingAt.getTime());

    const page = matches.slice(dto.skip, dto.skip + dto.take);
    const data = await Promise.all(page.map(({ trip, segment }) => this.withSegment(trip, segment)));
    return new PaginatedResult(data, matches.length, dto.page, dto.limit);
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
      include: { driver: true, vehicle: true, originCity: true, destinationCity: true, currency: CURRENCY_SELECT },
    });

    // Le compte total exact en mode géospatial demanderait une seconde
    // requête sans LIMIT/OFFSET ; approximé ici par la taille de la page
    // courante pour éviter de doubler le coût de la requête PostGIS à
    // chaque appel. À affiner si la pagination profonde devient un besoin réel.
    return new PaginatedResult(await this.withCustomerPriceList(trips), trips.length + offset, dto.page, dto.limit);
  }

  private async getSearchRadiusKm(): Promise<number> {
    return this.pricing.getNumericSetting(SEARCH_RADIUS_SETTING_KEY, DEFAULT_SEARCH_RADIUS_KM);
  }

  /** Départ de la veille jusqu'à la fin du jour demandé : couvre les trajets qui passent à une étape ce jour-là. */
  private dayWindowPrefilter(dateOnly: string): Prisma.TripWhereInput {
    const start = new Date(`${dateOnly}T00:00:00.000Z`);
    const end = new Date(`${dateOnly}T23:59:59.999Z`);
    return { departureAt: { gte: new Date(start.getTime() - DAY_MS), lte: end } };
  }

  private isOnDay(date: Date, dateOnly: string): boolean {
    const start = new Date(`${dateOnly}T00:00:00.000Z`).getTime();
    const end = new Date(`${dateOnly}T23:59:59.999Z`).getTime();
    return date.getTime() >= start && date.getTime() <= end;
  }
}

function estimateArrivalAtFor(
  departureAt: Date,
  distanceKm: number,
  settings: { roadDistanceFactor: number; averageSpeedKmh: number },
): Date {
  const hours = (distanceKm * settings.roadDistanceFactor) / settings.averageSpeedKmh;
  return new Date(departureAt.getTime() + Math.round(hours * 3_600_000));
}