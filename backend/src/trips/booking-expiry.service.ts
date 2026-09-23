// backend/src/trips/booking-expiry.service.ts
// [22/09/2026] v2 — délai en minutes (15 par défaut, au lieu de 2 h) : booking.unpaid_expiry_minutes.
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { BookingsService } from './bookings.service';

/** Fréquence de la vérification — même cadence que ShipmentWindowService. */
const CHECK_INTERVAL_MS = 5 * 60_000;
const BATCH_SIZE = 100;

/**
 * Nettoyage des réservations jamais payées (section 12) : la place est
 * décomptée dès la création (BookingsService.create), avant tout paiement
 * — sans cette tâche, une réservation "À payer" jamais réglée bloquait
 * indéfiniment une place que personne d'autre ne pouvait prendre, même
 * après le départ du trajet.
 *
 * Une réservation impayée expire au premier des deux cas :
 * 1. Plus de `booking.unpaid_expiry_minutes` (15 min par défaut) depuis
 *    sa création — le paiement est censé se faire dans la foulée de la
 *    réservation, pas des jours plus tard ;
 * 2. Le trajet est déjà parti — filet de sécurité, quel que soit le
 *    réglage ci-dessus.
 *
 * Même mécanique que ShipmentWindowService : un simple minuteur, mise à
 * jour conditionnelle en base (un run concurrent ne traite jamais deux
 * fois la même réservation). Désactivable avec BOOKING_EXPIRY_JOB=off.
 */
@Injectable()
export class BookingExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingExpiryService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly bookings: BookingsService,
  ) {}

  onModuleInit(): void {
    if (process.env.BOOKING_EXPIRY_JOB === 'off') return;
    this.timer = setInterval(() => void this.runOnce(), CHECK_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.expireStaleBookings();
    } catch (error) {
      this.logger.error('Échec de la vérification des réservations impayées', error as Error);
    } finally {
      this.running = false;
    }
  }

  private async expireStaleBookings(): Promise<void> {
    const expiryMinutes = await this.pricing.getNumericSetting('booking.unpaid_expiry_minutes', 15);
    const now = new Date();
    const createdBefore = new Date(now.getTime() - expiryMinutes * 60_000);

    const stale = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.PENDING_PAYMENT,
        OR: [{ createdAt: { lt: createdBefore } }, { trip: { departureAt: { lt: now } } }],
      },
      select: { id: true },
      take: BATCH_SIZE,
    });

    for (const booking of stale) {
      try {
        await this.bookings.expireUnpaid(booking.id, 'Paiement non effectué dans le délai imparti.');
      } catch (error) {
        this.logger.error(`Échec de l'expiration de la réservation ${booking.id}`, error as Error);
      }
    }
  }
}