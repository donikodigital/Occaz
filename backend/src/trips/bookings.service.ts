// backend/src/trips/bookings.service.ts
import { BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BookingStatus, CancellationInitiator, Prisma, ServiceType, TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { BookingCancelledEvent, DOMAIN_EVENTS } from '../common/events/domain-events';
import { CreateBookingDto } from './dto/create-booking.dto';

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
  ) {}

  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { trip: true, passengers: true },
    });
    if (!booking) throw new NotFoundException('Réservation introuvable.');
    return booking;
  }

  /**
   * Réservation atomique : le décompte des places disponibles et la
   * création de la réservation se font dans la même transaction, avec
   * une condition sur availableSeats dans le WHERE de l'UPDATE — deux
   * clients qui réservent simultanément la dernière place ne peuvent pas
   * tous les deux réussir (l'un des deux reçoit un 409).
   */
  async create(customerId: string, dto: CreateBookingDto) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: dto.tripId },
      include: { originCity: true },
    });
    if (!trip) throw new NotFoundException('Trajet introuvable.');
    if (trip.status !== TripStatus.PUBLISHED) {
      throw new BadRequestException("Ce trajet n'accepte plus de réservations.");
    }

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

    const baseAmount = trip.pricePerSeat * BigInt(dto.seatsCount);
    const platformFee = await this.pricing.computeCommission({
      serviceType: ServiceType.TRIP,
      countryId: trip.originCity.countryId,
      baseAmount,
    });
    const totalAmount = baseAmount + platformFee;

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const seatUpdate = await tx.trip.updateMany({
        where: { id: dto.tripId, status: TripStatus.PUBLISHED, availableSeats: { gte: dto.seatsCount } },
        data: { availableSeats: { decrement: dto.seatsCount } },
      });
      if (seatUpdate.count === 0) {
        throw new ConflictException('Plus assez de places disponibles sur ce trajet.');
      }

      const booking = await tx.booking.create({
        data: {
          tripId: dto.tripId,
          customerId,
          seatsCount: dto.seatsCount,
          pricePerSeat: trip.pricePerSeat,
          platformFee,
          totalAmount,
          currencyId: trip.currencyId,
          status: BookingStatus.PENDING_PAYMENT,
        },
      });

      await tx.tripPassenger.createMany({
        data: passengerNames!.map((p) => ({
          tripId: dto.tripId,
          bookingId: booking.id,
          fullName: p.fullName,
          phone: p.phone,
        })),
      });

      return tx.booking.findUnique({
        where: { id: booking.id },
        include: { passengers: true, trip: true },
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
      include: { originCity: true },
    });
    const refundEligiblePercentage = await this.computeCustomerRefundPercentage(trip);

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

      await tx.trip.update({
        where: { id: booking.tripId },
        data: { availableSeats: { increment: booking.seatsCount } },
      });

      return result;
    });

    this.eventEmitter.emit(
      DOMAIN_EVENTS.BOOKING_CANCELLED,
      new BookingCancelledEvent(id, reason, refundEligiblePercentage),
    );

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
      select: { id: true },
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
  }

  /**
   * À appeler par le webhook de paiement (Lot 5) une fois le paiement
   * confirmé côté serveur — jamais depuis une route publique (règle
   * d'or, section 13 : le mobile ne décide jamais qu'un paiement a réussi).
   */
  async confirmPayment(id: string): Promise<void> {
    await this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CONFIRMED },
    });
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
        include: { trip: true, passengers: true },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  findAllForTrip(tripId: string) {
    return this.prisma.booking.findMany({
      where: { tripId },
      include: { passengers: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findAll(
    query: PaginationQueryDto,
    filters: { status?: BookingStatus; tripId?: string } = {},
  ): Promise<PaginatedResult<unknown>> {
    const where = { status: filters.status, tripId: filters.tripId };
    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
        include: { trip: true },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }
}
