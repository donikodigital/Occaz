// backend/src/trips/trip-completion.service.ts
// [25/10/2026] v1 — Client absent au rendez-vous (déclaré par le conducteur après une attente) et clôture automatique des trajets restés
// bloqués à l'arrivée. Modèle repris des grandes plateformes de covoiturage et de VTC : le conducteur qui a fait le déplacement est payé,
// le client absent n'est pas remboursé (il garde le recours « Signaler un problème »), et un trajet ne reste jamais ouvert indéfiniment.
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  BookingStatus,
  CancellationInitiator,
  NotificationChannel,
  NotificationType,
  Prisma,
  ShipmentStatus,
  TripStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { WalletsService } from '../wallets/wallets.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { DriverProfilesService } from '../profiles/driver-profiles/driver-profiles.service';
import { syncTripSeats } from './trip-seats.db';
import { TripOtpService } from './trip-otp.service';

const CHECK_INTERVAL_MS = 5 * 60_000;
const BATCH_SIZE = 50;
const DEFAULT_NO_SHOW_WAIT_MINUTES = 15;
const DEFAULT_AUTO_CLOSE_HOURS = 6;

export const NO_SHOW_REASON = 'Client absent au point de rendez-vous';

const ACTIVE_BOOKING_STATUSES = [BookingStatus.PAID, BookingStatus.CONFIRMED];
const WAITING_TRIP_STATUSES: TripStatus[] = [TripStatus.DRIVER_ARRIVED, TripStatus.PASSENGER_PICKED_UP, TripStatus.IN_PROGRESS];

@Injectable()
export class TripCompletionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TripCompletionService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly wallets: WalletsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly driverProfiles: DriverProfilesService,
    private readonly tripOtp: TripOtpService,
  ) {}

  onModuleInit(): void {
    if (process.env.TRIP_AUTOCLOSE_JOB === 'off') return;
    this.timer = setInterval(() => void this.runOnce(), CHECK_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // ---------------------------------------------------------------------
  // Client absent
  // ---------------------------------------------------------------------

  /**
   * Le conducteur déclare qu'un client ne s'est pas présenté. Possible seulement après l'attente prévue (réglage
   * `booking.no_show_wait_minutes`, 15 min par défaut) comptée depuis son arrivée au point de rendez-vous du client.
   * Effets : réservation annulée (places rendues), conducteur payé (les fonds en attente sont libérés), aucun remboursement,
   * client prévenu — il peut contester via « Signaler un problème ». Rejouable : un second appel ne repaye pas, il termine
   * seulement ce qui aurait été interrompu (libération des fonds).
   */
  async declareNoShow(bookingId: string, driverId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        trip: { include: { originCity: true, destinationCity: true, driver: { select: { userId: true } } } },
        boardingStop: { include: { city: true } },
        passengers: true,
        customer: { select: { userId: true } },
      },
    });
    if (!booking) throw new NotFoundException('Réservation introuvable.');
    if (booking.trip.driverId !== driverId) {
      throw new ForbiddenException("Cette réservation n'est pas rattachée à un de vos trajets.");
    }

    // Reprise : déjà déclarée absente, il ne manque peut-être que la libération des fonds (idempotente).
    if (booking.status === BookingStatus.CANCELLED && booking.cancellationReason === NO_SHOW_REASON) {
      await this.wallets.releaseHeldFunds({ driverId, bookingId });
      return { bookingId, status: BookingStatus.CANCELLED, noShow: true };
    }

    if (!ACTIVE_BOOKING_STATUSES.includes(booking.status as never)) {
      throw new BadRequestException("Cette réservation n'est pas en attente de prise en charge.");
    }
    if (booking.passengers.some((passenger: { pickedUpAt: Date | null }) => Boolean(passenger.pickedUpAt))) {
      throw new BadRequestException('Ce client a déjà été pris en charge.');
    }

    // Où et depuis quand le conducteur attend-il ce client ?
    const atStop = Boolean(booking.boardingStopId);
    if (atStop) {
      if (booking.trip.status !== TripStatus.IN_PROGRESS) {
        throw new BadRequestException("Le trajet doit être en cours pour signaler l'absence d'un client monté en cours de route.");
      }
    } else if (booking.trip.status !== TripStatus.DRIVER_ARRIVED && booking.trip.status !== TripStatus.PASSENGER_PICKED_UP) {
      throw new BadRequestException('Signalez d’abord votre arrivée au point de départ.');
    }
    const waitingSince = atStop
      ? (booking.boardingStop?.pickupArrivedAt ?? null)
      : (booking.trip.driverArrivedAt ?? booking.trip.updatedAt);
    if (!waitingSince) {
      throw new BadRequestException('Signalez d’abord votre arrivée sur les lieux avant de déclarer un client absent.');
    }

    const waitMinutes = await this.pricing.getNumericSetting('booking.no_show_wait_minutes', DEFAULT_NO_SHOW_WAIT_MINUTES);
    const elapsedMs = Date.now() - waitingSince.getTime();
    if (elapsedMs < waitMinutes * 60_000) {
      const remaining = Math.ceil((waitMinutes * 60_000 - elapsedMs) / 60_000);
      throw new BadRequestException(
        `Merci d'attendre encore ${remaining} minute${remaining > 1 ? 's' : ''} avant de déclarer ce client absent (attente minimale : ${waitMinutes} minutes).`,
      );
    }

    const closed = await this.closeAsNoShow(booking.id, booking.tripId, driverId, 'DRIVER_DECLARATION');
    if (!closed) throw new BadRequestException("Cette réservation n'est plus en attente de prise en charge.");

    await this.notifyNoShow(booking.customer.userId, booking.trip.driver.userId, booking.id, booking.tripId, booking.trip.originCity.name, booking.trip.destinationCity.name);
    await this.closeTripIfNobodyBoarded(booking.tripId);
    return { bookingId, status: BookingStatus.CANCELLED, noShow: true };
  }

  /** Annule la réservation d'un client absent et paie le conducteur. Renvoie false si quelqu'un d'autre l'avait déjà traitée. */
  private async closeAsNoShow(bookingId: string, tripId: string, driverId: string, source: string): Promise<boolean> {
    const claimed = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const result = await tx.booking.updateMany({
        where: { id: bookingId, status: { in: ACTIVE_BOOKING_STATUSES } },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledBy: CancellationInitiator.SYSTEM,
          cancellationReason: NO_SHOW_REASON,
        },
      });
      if (result.count === 0) return false;
      await syncTripSeats(tx, tripId);
      return true;
    });
    if (!claimed) return false;

    // Pas d'événement BOOKING_CANCELLED ici : il déclencherait un remboursement. Le client absent n'est pas remboursé.
    try {
      await this.wallets.releaseHeldFunds({ driverId, bookingId });
    } catch (error) {
      // La réservation est déjà close : un nouvel appel à declareNoShow terminera la libération des fonds.
      this.logger.error(`Client absent — libération des fonds impossible pour la réservation ${bookingId}`, error as Error);
      throw error;
    }
    await this.audit.log({
      actorId: null,
      entityType: 'Booking',
      entityId: bookingId,
      action: 'NO_SHOW',
      diff: { source, tripId },
    });
    return true;
  }

  private async notifyNoShow(
    customerUserId: string,
    driverUserId: string,
    bookingId: string,
    tripId: string,
    from: string,
    to: string,
  ): Promise<void> {
    try {
      await this.notifications.notify({
        userId: customerUserId,
        type: NotificationType.STATUS_CHANGE,
        channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
        fallbackTitle: 'Réservation clôturée : vous n’étiez pas au rendez-vous',
        fallbackBody: `Le conducteur vous a attendu sur le trajet ${from} → ${to} sans vous voir. La réservation est clôturée, sans remboursement. Si c’est une erreur, utilisez « Signaler un problème » : notre équipe examinera votre situation.`,
        pushData: { type: 'STATUS_CHANGE', tripId, bookingId },
      });
      await this.notifications.notify({
        userId: driverUserId,
        type: NotificationType.DRIVER_PAYMENT,
        channels: [NotificationChannel.PUSH],
        fallbackTitle: 'Client absent : vous êtes payé',
        fallbackBody: `Vous avez attendu votre client : le montant de la réservation est ajouté à votre solde disponible.`,
        pushData: { type: 'DRIVER_PAYMENT', tripId, bookingId },
      });
    } catch (error) {
      this.logger.warn(`Notification « client absent » non envoyée pour la réservation ${bookingId} — ${(error as Error).message}.`);
    }
  }

  /**
   * Plus personne à emmener (tous les clients du départ absents, aucun passager pris en charge, aucun envoi en cours) :
   * le trajet est clos sans pénalité pour le conducteur plutôt que de rester bloqué à « arrivé au départ ».
   */
  private async closeTripIfNobodyBoarded(tripId: string): Promise<void> {
    const closed = await this.prisma.trip.updateMany({
      where: {
        id: tripId,
        status: TripStatus.DRIVER_ARRIVED,
        bookings: { none: { status: { in: [BookingStatus.PENDING_PAYMENT, ...ACTIVE_BOOKING_STATUSES, BookingStatus.COMPLETED] } } },
        shipments: {
          none: {
            status: {
              in: [ShipmentStatus.DRIVER_ASSIGNED, ShipmentStatus.PICKUP_PENDING, ShipmentStatus.PICKED_UP, ShipmentStatus.IN_TRANSIT, ShipmentStatus.DELIVERY_PENDING],
            },
          },
        },
      },
      data: { status: TripStatus.CANCELLED },
    });
    if (closed.count > 0) {
      await this.audit.log({ actorId: null, entityType: 'Trip', entityId: tripId, action: 'AUTO_CLOSE_NO_SHOW', diff: { reason: 'Aucun client présent au départ.' } });
    }
  }

  // ---------------------------------------------------------------------
  // Clôture automatique des trajets restés à l'arrivée
  // ---------------------------------------------------------------------

  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      if ((await this.pricing.getNumericSetting('jobs.trip_autoclose_enabled', 1)) === 0) return;
      await this.autoCloseStuckTrips();
    } catch (error) {
      this.logger.error('Échec de la clôture automatique des trajets', error as Error);
    } finally {
      this.running = false;
    }
  }

  /**
   * Un trajet « arrivé » depuis plus de `trip.auto_close_hours` (6 h par défaut) dont des réservations n'ont jamais été clôturées
   * (code de dépose jamais saisi, client jamais monté) est clos tout seul : les passagers réellement déposés sont validés et le
   * conducteur payé, les absents sont traités comme « client absent ». Sans cela le conducteur restait bloqué et son argent aussi.
   */
  async autoCloseStuckTrips(): Promise<number> {
    const hours = await this.pricing.getNumericSetting('trip.auto_close_hours', DEFAULT_AUTO_CLOSE_HOURS);
    const before = new Date(Date.now() - hours * 3_600_000);
    const stuck = await this.prisma.trip.findMany({
      where: {
        status: TripStatus.ARRIVED,
        OR: [{ arrivedAt: { lt: before } }, { arrivedAt: null, updatedAt: { lt: before } }],
      },
      select: { id: true, driverId: true },
      take: BATCH_SIZE,
    });

    let closedCount = 0;
    for (const trip of stuck) {
      try {
        if (await this.closeStuckTrip(trip.id, trip.driverId)) closedCount += 1;
      } catch (error) {
        this.logger.error(`Clôture automatique du trajet ${trip.id} impossible`, error as Error);
      }
    }
    return closedCount;
  }

  private async closeStuckTrip(tripId: string, driverId: string): Promise<boolean> {
    const bookings = await this.prisma.booking.findMany({
      where: { tripId, status: { in: ACTIVE_BOOKING_STATUSES } },
      include: { passengers: true },
    });
    for (const booking of bookings) {
      const boarded = booking.passengers.some((passenger: { pickedUpAt: Date | null }) => Boolean(passenger.pickedUpAt));
      if (boarded) {
        await this.tripOtp.closeDropoffBySystem(booking.id);
      } else {
        await this.closeAsNoShow(booking.id, tripId, driverId, 'AUTO_CLOSE');
      }
    }

    // Une réservation jamais payée n'a plus de raison de bloquer la clôture : si elle traîne encore, on la laisse à son propre délai.
    const claimed = await this.prisma.trip.updateMany({
      where: {
        id: tripId,
        status: TripStatus.ARRIVED,
        bookings: { none: { status: { notIn: [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.REFUNDED] } } },
      },
      data: { status: TripStatus.COMPLETED },
    });
    if (claimed.count === 0) return false;

    await this.driverProfiles.incrementCompletedTrips(driverId);
    await this.audit.log({ actorId: null, entityType: 'Trip', entityId: tripId, action: 'AUTO_CLOSE', diff: { hours: await this.pricing.getNumericSetting('trip.auto_close_hours', DEFAULT_AUTO_CLOSE_HOURS) } });
    return true;
  }
}
