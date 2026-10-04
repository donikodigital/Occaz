// backend/src/trips/bookings.service.ts
import { BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BookingStatus, CancellationInitiator, NotificationChannel, NotificationType, Prisma, ServiceType, TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { BookingCancelledEvent, DOMAIN_EVENTS } from '../common/events/domain-events';
import { CreateBookingDto } from './dto/create-booking.dto';
import { SEGMENT_FAILURE_MESSAGES, buildRoute, resolveSegment } from './trip-route';
import { loadRouteSettings } from './trip-route.planner';
import { freeSeatsOnSegment, seatsOccupiedByLeg } from './trip-seats';
import { loadSeatHolds, lockTrip, syncTripSeats } from './trip-seats.db';

/**
 * Relations de Trip attendues côté mobile pour toute réponse contenant
 * booking.trip (voir mobile/src/types/trips.types.ts — Booking.trip est
 * typé comme un Trip complet, pas seulement ses colonnes scalaires).
 * `include: { trip: true }` seul ne charge PAS ces relations imbriquées
 * — c'était la cause de "trip.originCity is undefined" côté client.
 * Centralisé ici pour que ce bug ne puisse pas resurgir ailleurs dans ce
 * fichier faute d'avoir pensé à dupliquer le bon include partout.
 */
const TRIP_INCLUDE_FOR_BOOKING = {
  originCity: true,
  destinationCity: true,
  driver: true,
  vehicle: true,
  // Devise du trajet (= celle de la réservation) : les montants de la réservation s'affichent dans cette devise.
  currency: { select: { id: true, isoCode: true, symbol: true } },
} as const;

/**
 * Variante de TRIP_INCLUDE_FOR_BOOKING qui charge aussi le téléphone du
 * chauffeur (via User, DriverProfile n'a pas son propre champ phone) —
 * seulement là où un numéro peut être révélé (findOne, findAllForTrip),
 * jamais dans les listes génériques (findAll, admin) qui n'en ont pas
 * besoin.
 */
/** Étapes de montée / descente d'une réservation, avec leur ville : « Kindia → Labé » sur les écrans client, conducteur et admin. */
const SEGMENT_STOPS_INCLUDE = {
  boardingStop: { include: { city: true, location: true } },
  alightingStop: { include: { city: true, location: true } },
} as const;

const TRIP_INCLUDE_WITH_DRIVER_PHONE = {
  ...TRIP_INCLUDE_FOR_BOOKING,
  driver: { include: { user: { select: { phone: true } } } },
} as const;

/**
 * Le numéro du client et celui du chauffeur ne sont révélés qu'une fois
 * la relation établie par le paiement — CONFIRMED ou COMPLETED, jamais
 * avant (demande explicite : permettre un contact direct par SMS/appel
 * uniquement "une fois le paiement effectué", à l'image d'Uber). Calculé
 * ici, jamais laissé au client de décider quoi afficher : la donnée ne
 * doit pas quitter le serveur trop tôt.
 */
function withContactPhones<
  T extends {
    status: BookingStatus;
    trip: { driver: { user: { phone: string } } };
    customer: { user: { phone: string } };
  },
>(booking: T): T & { driverPhone: string | null; customerPhone: string | null } {
  const isRevealed = booking.status === BookingStatus.CONFIRMED || booking.status === BookingStatus.COMPLETED;
  return {
    ...booking,
    driverPhone: isRevealed ? booking.trip.driver.user.phone : null,
    customerPhone: isRevealed ? booking.customer.user.phone : null,
  };
}

/**
 * Volontairement indépendant de TripsService (pas d'injection croisée) —
 * TripsService dépend déjà de BookingsService pour la cascade
 * d'annulation ; une dépendance dans l'autre sens créerait un cycle.
 * Ce service lit directement Trip via Prisma pour ce dont il a besoin.
 * Le remboursement effectif est déclenché par PaymentsService, abonné à
 * l'événement BOOKING_CANCELLED (voir common/events/domain-events.ts).
 */
@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly eventEmitter: EventEmitter2,
    private readonly promoCodes: PromoCodesService,
    private readonly notifications: NotificationsService,
  ) {}

  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        trip: { include: TRIP_INCLUDE_WITH_DRIVER_PHONE },
        passengers: true,
        customer: { include: { user: { select: { phone: true } } } },
        ...SEGMENT_STOPS_INCLUDE,
      },
    });
    if (!booking) throw new NotFoundException('Réservation introuvable.');
    return withContactPhones(booking);
  }

  /**
   * Réservation atomique : le contrôle des places et la création de la
   * réservation se font dans la même transaction, sous verrou du trajet —
   * deux clients qui réservent simultanément la dernière place ne peuvent
   * pas tous les deux réussir (l'un des deux reçoit un 409).
   *
   * Places par tronçon : le client occupe ses places entre sa montée et sa
   * descente seulement. Il faut donc qu'il en reste assez sur chacun des
   * tronçons qu'il traverse ; un siège pris de Conakry à Kindia est libre
   * de nouveau pour un client de Kindia à Labé (voir trip-seats.ts).
   */
  async create(customerId: string, dto: CreateBookingDto) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: dto.tripId },
      include: { originCity: true, stops: { orderBy: { sequence: 'asc' } } },
    });
    if (!trip) throw new NotFoundException('Trajet introuvable.');
    if (trip.status !== TripStatus.PUBLISHED) {
      throw new BadRequestException("Ce trajet n'accepte plus de réservations.");
    }

    // Tronçon réservé (ex. Kindia → Labé) : le prix par place est celui du tronçon, jamais celui du trajet entier. Sans
    // étapes dans la demande, c'est le trajet entier — comportement inchangé.
    const routeSettings = await loadRouteSettings(this.pricing);
    const resolvedSegment = resolveSegment(
      buildRoute(trip),
      dto.boardingStopId,
      dto.alightingStopId,
      routeSettings.minSegmentPrice,
    );
    if (!resolvedSegment.ok) throw new BadRequestException(SEGMENT_FAILURE_MESSAGES[resolvedSegment.reason]);
    const segmentPricePerSeat = resolvedSegment.segment.pricePerSeat;

    if (dto.passengers && dto.passengers.length !== dto.seatsCount) {
      throw new BadRequestException(
        'Le nombre de passagers nommés doit correspondre au nombre de places réservées.',
      );
    }
    if (!dto.passengers && dto.seatsCount !== 1) {
      throw new BadRequestException(
        'Pour réserver plusieurs places, précisez un passager nommé par place (passengers).',
      );
    }

    let passengerNames = dto.passengers;
    if (!passengerNames) {
      const customer = await this.prisma.customerProfile.findUnique({ where: { id: customerId } });
      if (!customer) throw new NotFoundException('Profil client introuvable.');
      passengerNames = [{ fullName: `${customer.firstName} ${customer.lastName}` }];
    }

    const baseAmount = segmentPricePerSeat * BigInt(dto.seatsCount);
    let platformFee = await this.pricing.computeCommission({
      serviceType: ServiceType.TRIP,
      countryId: trip.originCity.countryId,
      baseAmount,
    });

    // Un code promo réduit ce que le client paie, jamais ce que le
    // chauffeur touche : le rabais est prélevé sur la commission de la
    // plateforme, plafonné à son montant — voir ShipmentsService.create
    // pour le même principe, appliqué là aux envois.
    let promoCodeMatch: Awaited<ReturnType<PromoCodesService['resolveForCheckout']>> | null = null;
    let discountAmount = 0n;
    if (dto.promoCode) {
      promoCodeMatch = await this.promoCodes.resolveForCheckout(
        customerId,
        dto.promoCode,
        ServiceType.TRIP,
        baseAmount + platformFee,
        trip.originCity.countryId,
      );
      discountAmount = promoCodeMatch.discountAmount > platformFee ? platformFee : promoCodeMatch.discountAmount;
      platformFee -= discountAmount;
    }
    const totalAmount = baseAmount + platformFee;

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Verrou du trajet : le statut et les places se relisent ici, sous verrou, pas depuis la lecture du début de requête.
      const locked = await lockTrip(tx, dto.tripId);
      if (!locked || locked.status !== TripStatus.PUBLISHED) {
        throw new BadRequestException("Ce trajet n'accepte plus de réservations.");
      }
      const occupiedByLeg = seatsOccupiedByLeg(buildRoute(trip), await loadSeatHolds(tx, dto.tripId));
      const freeSeats = freeSeatsOnSegment(
        locked.totalSeats,
        occupiedByLeg,
        resolvedSegment.segment.from.index,
        resolvedSegment.segment.to.index,
      );
      if (freeSeats < dto.seatsCount) {
        throw new ConflictException(
          resolvedSegment.segment.isFullTrip
            ? 'Plus assez de places disponibles sur ce trajet.'
            : 'Plus assez de places disponibles sur ce tronçon.',
        );
      }

      const booking = await tx.booking.create({
        data: {
          tripId: dto.tripId,
          customerId,
          seatsCount: dto.seatsCount,
          pricePerSeat: segmentPricePerSeat,
          boardingStopId: dto.boardingStopId ?? null,
          alightingStopId: dto.alightingStopId ?? null,
          platformFee,
          totalAmount,
          currencyId: trip.currencyId,
          status: BookingStatus.PENDING_PAYMENT,
        },
      });

      if (promoCodeMatch) {
        await this.promoCodes.redeem(tx, promoCodeMatch.promoCode, {
          customerId,
          bookingId: booking.id,
          discountAmount,
        });
      }

      await tx.tripPassenger.createMany({
        data: passengerNames!.map((p) => ({
          tripId: dto.tripId,
          bookingId: booking.id,
          fullName: p.fullName,
          phone: p.phone,
        })),
      });

      // Compteur du trajet = places libres sur le tronçon le plus chargé, recalculé avec cette réservation.
      await syncTripSeats(tx, dto.tripId);

      return tx.booking.findUnique({
        where: { id: booking.id },
        include: { passengers: true, trip: { include: TRIP_INCLUDE_FOR_BOOKING } },
      });
    });
  }

  /**
   * L'éligibilité et le pourcentage de remboursement (section 26/63) sont
   * calculés à partir de l'heure d'annulation vs. l'heure de départ, puis
   * émis via BOOKING_CANCELLED — c'est PaymentsService qui exécute le
   * remboursement réel (appel au prestataire) en écoutant cet événement.
   */
  async cancel(id: string, customerId: string, reason: string) {
    const booking = await this.findOne(id);
    if (booking.customerId !== customerId) {
      throw new ForbiddenException("Cette réservation n'appartient pas à ce client.");
    }
    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.COMPLETED ||
      booking.status === BookingStatus.REFUNDED
    ) {
      throw new BadRequestException('Cette réservation ne peut plus être annulée.');
    }

    const trip = await this.prisma.trip.findUniqueOrThrow({
      where: { id: booking.tripId },
      include: { originCity: true, destinationCity: true, driver: true },
    });
    // Le délai d'annulation se compte depuis l'heure à laquelle LE CLIENT monte (passage estimé à son étape), pas depuis
    // le départ du trajet : un client de Mamou n'a pas à être pénalisé comme s'il partait de Conakry.
    const refundEligiblePercentage = await this.computeCustomerRefundPercentage({
      departureAt: booking.boardingStop?.estimatedArrivalAt ?? trip.departureAt,
      originCity: trip.originCity,
    });

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const result = await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledBy: CancellationInitiator.CUSTOMER,
          cancellationReason: reason,
        },
      });

      // Les places de ce client sont libérées sur les tronçons qu'il occupait — recalcul plutôt qu'incrément.
      await syncTripSeats(tx, booking.tripId);

      return result;
    });

    this.eventEmitter.emit(
      DOMAIN_EVENTS.BOOKING_CANCELLED,
      new BookingCancelledEvent(id, reason, refundEligiblePercentage),
    );

    // Seulement si le chauffeur avait déjà été informé de cette réservation
    // (PAID/CONFIRMED — voir PaymentsService.handleCaptured) : une
    // réservation encore PENDING_PAYMENT ne lui a jamais été signalée, pas
    // la peine de le prévenir de l'annulation de quelque chose qu'il ne
    // savait pas exister.
    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      await this.notifications.notify({
        userId: trip.driver.userId,
        type: NotificationType.STATUS_CHANGE,
        channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
        fallbackTitle: 'Réservation annulée',
        fallbackBody: `Une réservation de ${booking.seatsCount} place${booking.seatsCount > 1 ? 's' : ''} a été annulée sur votre trajet ${booking.boardingStop?.city?.name ?? trip.originCity.name} → ${booking.alightingStop?.city?.name ?? trip.destinationCity.name}.`,
        pushData: { type: 'STATUS_CHANGE', tripId: trip.id, bookingId: id },
      });
    }

    return { ...updated, refundEligiblePercentage };
  }

  private async computeCustomerRefundPercentage(trip: {
    departureAt: Date;
    originCity: { countryId: string };
  }): Promise<number | null> {
    const policy = await this.pricing.getCancellationPolicy({
      serviceType: ServiceType.TRIP,
      countryId: trip.originCity.countryId,
    });
    if (!policy) return null; // aucune politique configurée pour ce pays/service
    const hoursUntilDeparture = (trip.departureAt.getTime() - Date.now()) / 3_600_000;
    return hoursUntilDeparture >= policy.hoursBeforeDeparture ? policy.refundPercentage : 0;
  }

  /**
   * Appelé par TripsService.cancel — bascule toutes les réservations
   * actives d'un trajet annulé par le chauffeur (ou par le système, ex :
   * échec de paiement) en CANCELLED et émet un événement par réservation.
   * Remboursement à 100% dans ce cas : l'annulation n'est pas du fait du
   * client, la politique d'annulation habituelle (basée sur le délai) ne
   * s'applique donc pas. Ne restaure pas availableSeats : le trajet
   * lui-même est annulé, cette valeur ne sera plus consultée.
   */
  async cancelAllForTrip(
    tripId: string,
    reason: string,
    initiatedBy: CancellationInitiator,
  ): Promise<void> {
    const affectedBookings = await this.prisma.booking.findMany({
      where: {
        tripId,
        status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.PAID, BookingStatus.CONFIRMED] },
      },
      select: { id: true, status: true, seatsCount: true, customer: { select: { userId: true } } },
    });
    if (affectedBookings.length === 0) return;

    await this.prisma.booking.updateMany({
      where: { id: { in: affectedBookings.map((b) => b.id) } },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: initiatedBy,
        cancellationReason: reason,
      },
    });

    for (const booking of affectedBookings) {
      this.eventEmitter.emit(
        DOMAIN_EVENTS.BOOKING_CANCELLED,
        new BookingCancelledEvent(booking.id, reason, 100),
      );
    }

    // Le passager le plus concerné de toute la plateforme : son trajet
    // n'aura pas lieu. Averti même s'il n'avait pas encore payé
    // (PENDING_PAYMENT) — contrairement à l'annulation d'une seule
    // réservation par le client, ici c'est le trajet entier qui disparaît,
    // il doit le savoir dans tous les cas pour ne pas se présenter au
    // point de départ pour rien.
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: { originCity: true, destinationCity: true },
    });
    if (!trip) return;

    await Promise.all(
      affectedBookings.map((booking) =>
        this.notifications.notify({
          userId: booking.customer.userId,
          type: NotificationType.STATUS_CHANGE,
          channels: [NotificationChannel.PUSH, NotificationChannel.SMS, NotificationChannel.EMAIL],
          fallbackTitle: 'Trajet annulé',
          fallbackBody: `Le trajet ${trip.originCity.name} → ${trip.destinationCity.name} du ${trip.departureAt.toLocaleDateString('fr-FR')} a été annulé par le chauffeur. Vous êtes remboursé intégralement.`,
          pushData: { type: 'STATUS_CHANGE', tripId },
        }),
      ),
    );
  }

  /**
   * À appeler par le webhook de paiement (Lot 5) une fois le paiement
   * confirmé côté serveur — jamais depuis une route publique (règle
   * d'or, section 13 : le mobile ne décide jamais qu'un paiement a réussi).
   */
  /**
   * Passe la réservation de « à payer » à « confirmée ». Ne ressuscite JAMAIS une réservation annulée ou expirée :
   * avec un paiement mobile money asynchrone, la confirmation du client peut arriver après l'expiration du délai
   * (places déjà rendues, parfois déjà revendues). Dans ce cas on le signale (`NOT_PAYABLE`) et l'appelant rembourse.
   */
  async confirmPayment(id: string): Promise<'CONFIRMED' | 'ALREADY_CONFIRMED' | 'NOT_PAYABLE'> {
    const claimed = await this.prisma.booking.updateMany({
      where: { id, status: BookingStatus.PENDING_PAYMENT },
      data: { status: BookingStatus.CONFIRMED },
    });
    if (claimed.count === 1) return 'CONFIRMED';

    const booking = await this.prisma.booking.findUnique({ where: { id }, select: { status: true } });
    if (!booking) return 'NOT_PAYABLE';
    return booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.REFUNDED
      ? 'NOT_PAYABLE'
      : 'ALREADY_CONFIRMED';
  }

  /**
   * Réservation jamais payée : elle bloquait une place que personne
   * d'autre ne pouvait réserver (voir create() — la place est décomptée
   * dès la création, avant tout paiement). Appelée par BookingExpiryService
   * une fois le délai de paiement dépassé, ou dès que le trajet est parti
   * — filet de sécurité pour qu'une réservation impayée ne reste jamais
   * "À payer" indéfiniment après le départ.
   * Sans effet si la réservation a été payée ou annulée entre-temps.
   */
  async expireUnpaid(id: string, reason: string): Promise<boolean> {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) return false;

    const expired = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const claimed = await tx.booking.updateMany({
        where: { id, status: BookingStatus.PENDING_PAYMENT },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledBy: CancellationInitiator.SYSTEM,
          cancellationReason: reason,
        },
      });
      if (claimed.count === 0) return false;

      await syncTripSeats(tx, booking.tripId);

      return true;
    });

    // Aucun paiement n'a été capturé (règle d'or, section 13 : le mobile ne
    // décide jamais qu'un paiement a réussi, et confirmPayment n'a jamais
    // été appelé) — refundBooking et reverseHeldFunds n'ont donc rien à
    // faire, mais l'événement reste émis pour rester sur le même chemin
    // que toute autre annulation plutôt que d'en créer un second.
    if (expired) {
      this.eventEmitter.emit(DOMAIN_EVENTS.BOOKING_CANCELLED, new BookingCancelledEvent(id, reason, 0));
    }
    return expired;
  }

  async findMineForCustomer(
    customerId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<unknown>> {
    const where = { customerId };
    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
        include: { trip: { include: TRIP_INCLUDE_FOR_BOOKING }, passengers: true, ...SEGMENT_STOPS_INCLUDE },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  async findAllForTrip(tripId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: { tripId },
      include: {
        passengers: true,
        trip: { include: TRIP_INCLUDE_WITH_DRIVER_PHONE },
        customer: { include: { user: { select: { phone: true } } } },
        ...SEGMENT_STOPS_INCLUDE,
      },
      orderBy: { createdAt: 'asc' },
    });
    return bookings.map(withContactPhones);
  }

  async findAll(
    query: PaginationQueryDto,
    filters: { status?: BookingStatus; tripId?: string } = {},
    /** Filtre de portée par pays (CountryScopeService) ; absent = aucune restriction. */
    scopeWhere?: Prisma.BookingWhereInput,
  ): Promise<PaginatedResult<unknown>> {
    const baseWhere = { status: filters.status, tripId: filters.tripId };
    const where = scopeWhere ? { AND: [baseWhere, scopeWhere] } : baseWhere;
    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
        include: { trip: { include: TRIP_INCLUDE_FOR_BOOKING }, ...SEGMENT_STOPS_INCLUDE },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }
}