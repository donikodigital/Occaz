// backend/src/trips/trip-expiry.service.ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BookingStatus, TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { TripsService } from './trips.service';

/** Même cadence que BookingExpiryService/ShipmentWindowService. */
const CHECK_INTERVAL_MS = 5 * 60_000;
const BATCH_SIZE = 100;

/**
 * Nettoyage des trajets publiés jamais réservés, dont le départ est
 * dépassé — sans cette tâche, un tel trajet reste indéfiniment PUBLISHED
 * (ou DRIVER_ARRIVED, si le chauffeur a signalé son arrivée), affiché
 * comme actif, sans qu'aucune réservation ne soit possible et sans
 * qu'aucune action ne fasse avancer le chauffeur. C'est exactement ce
 * blocage qui a été identifié le 23/09/2026 : un chauffeur arrivé sur un
 * trajet à 0 réservation n'avait plus aucun moyen d'avancer ni d'annuler
 * depuis l'écran (corrigé côté mobile — trip/[id].tsx v4 — mais ce
 * filet de sécurité empêche le trajet de rester bloqué si le chauffeur
 * ne remarque jamais qu'il peut l'annuler lui-même).
 *
 * Un trajet expire quand TOUTES ces conditions sont réunies :
 * - statut PUBLISHED ou DRIVER_ARRIVED ;
 * - aucune réservation active (en attente de paiement, payée ou
 *   confirmée) — un trajet avec au moins une réservation reste
 *   entièrement à la main du chauffeur, même en retard ;
 * - le départ est passé depuis plus de `trip.stale_expiry_hours`
 *   (24h par défaut — un délai large, sans urgence puisqu'aucune
 *   réservation ne bloque personne).
 *
 * N'incrémente jamais le compteur d'annulations du chauffeur (voir
 * TripsService.expireStale) : personne n'a été impacté. Même mécanique
 * que les autres tâches planifiées : mise à jour conditionnelle en base,
 * un run concurrent ne traite jamais deux fois le même trajet.
 * Désactivable avec TRIP_EXPIRY_JOB=off.
 */
@Injectable()
export class TripExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TripExpiryService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly trips: TripsService,
  ) {}

  onModuleInit(): void {
    if (process.env.TRIP_EXPIRY_JOB === 'off') return;
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
      await this.expireStaleTrips();
    } catch (error) {
      this.logger.error('Échec de la vérification des trajets sans réservation', error as Error);
    } finally {
      this.running = false;
    }
  }

  private async expireStaleTrips(): Promise<void> {
    const expiryHours = await this.pricing.getNumericSetting('trip.stale_expiry_hours', 24);
    const departedBefore = new Date(Date.now() - expiryHours * 3_600_000);

    const stale = await this.prisma.trip.findMany({
      where: {
        status: { in: [TripStatus.PUBLISHED, TripStatus.DRIVER_ARRIVED] },
        departureAt: { lt: departedBefore },
        bookings: { none: { status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.PAID, BookingStatus.CONFIRMED] } } },
      },
      select: { id: true },
      take: BATCH_SIZE,
    });

    for (const trip of stale) {
      try {
        await this.trips.expireStale(trip.id, 'Trajet resté sans réservation bien après son départ.');
      } catch (error) {
        this.logger.error(`Échec de l'expiration du trajet ${trip.id}`, error as Error);
      }
    }
  }
}