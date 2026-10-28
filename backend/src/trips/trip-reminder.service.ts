// backend/src/trips/trip-reminder.service.ts
// [11/10/2026] v1 — rappels de départ : le conducteur et chaque passager (réservation payée ou confirmée) reçoivent une notification
// la veille / plusieurs heures avant le départ (EARLY), puis dans les dernières heures (SOON).
//
// Un rappel n'est envoyé qu'une fois par (trajet, personne, type), même si le serveur tourne en plusieurs exemplaires : avant l'envoi,
// on « réserve » le rappel en écrivant une ligne dans TripReminderLog, dont la contrainte d'unicité refuse le second essai. Le choix est
// assumé : mieux vaut, en cas de panne du canal, un rappel manquant qu'un rappel envoyé deux fois.
// Désactivable avec TRIP_REMINDER_JOB=off ou depuis l'administration (réglage « jobs.trip_reminders_enabled »).
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BookingStatus, NotificationChannel, NotificationType, Prisma, TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { NotificationsService } from '../notifications/notifications.service';

const CHECK_INTERVAL_MS = 5 * 60_000;
const BATCH_SIZE = 100;
const HOUR_MS = 3_600_000;
/** Au-delà de cette distance au départ, aucun rappel. */
export const EARLY_WINDOW_HOURS = 24;
/** En dessous de cette distance, on envoie le rappel « SOON » plutôt que « EARLY ». */
export const SOON_WINDOW_HOURS = 3;
const DEFAULT_TIME_ZONE = 'Africa/Conakry';

export type ReminderKind = 'EARLY' | 'SOON';

/** Quel rappel convient à un départ dans `msLeft` millisecondes ? null = trop tôt ou déjà parti. */
export function reminderKindFor(msLeft: number): ReminderKind | null {
  if (msLeft <= 0 || msLeft > EARLY_WINDOW_HOURS * HOUR_MS) return null;
  return msLeft <= SOON_WINDOW_HOURS * HOUR_MS ? 'SOON' : 'EARLY';
}

/** « 45 min », « 2 h 15 », « 1 h » : le temps restant, arrondi à la minute, en toutes lettres courtes. */
export function formatDelay(ms: number): string {
  const totalMinutes = Math.max(1, Math.round(ms / 60_000));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')}`;
}

function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** « aujourd’hui », « demain » ou « le 12 octobre » — selon le fuseau horaire des trajets. */
export function formatDay(departure: Date, now: Date, timeZone: string): string {
  const today = dayKey(now, timeZone);
  if (dayKey(departure, timeZone) === today) return 'aujourd’hui';
  if (dayKey(departure, timeZone) === dayKey(new Date(now.getTime() + 24 * HOUR_MS), timeZone)) return 'demain';
  return `le ${new Intl.DateTimeFormat('fr-FR', { timeZone, day: 'numeric', month: 'long' }).format(departure)}`;
}

export function formatClock(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(date).replace(':', ' h ');
}

export interface ReminderTexts {
  title: string;
  body: string;
}

/** Texte du rappel — une fonction pure, testée à part. */
export function buildReminderTexts(params: {
  role: 'driver' | 'passenger';
  kind: ReminderKind;
  origin: string;
  destination: string;
  departureAt: Date;
  now: Date;
  timeZone: string;
  confirmedBookings: number;
}): ReminderTexts {
  const route = `${params.origin} → ${params.destination}`;
  const clock = formatClock(params.departureAt, params.timeZone);
  const when = `${formatDay(params.departureAt, params.now, params.timeZone)} à ${clock}`;
  const delay = formatDelay(params.departureAt.getTime() - params.now.getTime());

  if (params.role === 'passenger') {
    return params.kind === 'EARLY'
      ? { title: 'Rappel de votre trajet', body: `Votre trajet ${route} part ${when}. Soyez au point de rendez-vous quelques minutes avant.` }
      : { title: 'Votre départ approche', body: `Votre trajet ${route} part dans ${delay} (${clock}). Gardez votre code de prise en charge à portée de main.` };
  }

  const bookings =
    params.confirmedBookings === 0
      ? 'Aucune réservation pour le moment.'
      : `${params.confirmedBookings} réservation${params.confirmedBookings > 1 ? 's' : ''} confirmée${params.confirmedBookings > 1 ? 's' : ''}.`;
  return params.kind === 'EARLY'
    ? { title: 'Rappel de départ', body: `Votre trajet ${route} part ${when}. ${bookings}` }
    : { title: 'Votre départ approche', body: `Votre trajet ${route} part dans ${delay} (${clock}). ${bookings}` };
}

@Injectable()
export class TripReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TripReminderService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    if (process.env.TRIP_REMINDER_JOB === 'off') return;
    this.timer = setInterval(() => void this.runOnce(), CHECK_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private get timeZone(): string {
    return process.env.TICKET_TIMEZONE || DEFAULT_TIME_ZONE;
  }

  async runOnce(now: Date = new Date()): Promise<{ sent: number }> {
    if (this.running) return { sent: 0 };
    this.running = true;
    try {
      // Interrupteur de l'administration (Paramètres → Tâches automatiques) : lu à chaque passage, aucun redémarrage requis.
      if ((await this.pricing.getNumericSetting('jobs.trip_reminders_enabled', 1)) === 0) return { sent: 0 };
      return { sent: await this.sendDueReminders(now) };
    } catch (error) {
      this.logger.error('Échec de l’envoi des rappels de départ', error as Error);
      return { sent: 0 };
    } finally {
      this.running = false;
    }
  }

  private async sendDueReminders(now: Date): Promise<number> {
    const horizon = new Date(now.getTime() + EARLY_WINDOW_HOURS * HOUR_MS);
    let sent = 0;
    let cursor: string | undefined;

    // On parcourt tous les trajets de la fenêtre, par paquets : aucun trajet ne reste « derrière » un autre.
    for (;;) {
      const trips = await this.prisma.trip.findMany({
        where: { status: TripStatus.PUBLISHED, deletedAt: null, departureAt: { gt: now, lte: horizon } },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          departureAt: true,
          originCity: { select: { name: true } },
          destinationCity: { select: { name: true } },
          driver: { select: { userId: true } },
          bookings: {
            where: { status: { in: [BookingStatus.PAID, BookingStatus.CONFIRMED] }, deletedAt: null },
            select: { id: true, customer: { select: { userId: true } } },
          },
        },
      });
      if (trips.length === 0) break;
      cursor = trips[trips.length - 1].id;

      const alreadySent = await this.prisma.tripReminderLog.findMany({
        where: { tripId: { in: trips.map((trip) => trip.id) } },
        select: { tripId: true, userId: true, kind: true },
      });
      const done = new Set(alreadySent.map((row) => `${row.tripId}:${row.userId}:${row.kind}`));

      for (const trip of trips) {
        const kind = reminderKindFor(trip.departureAt.getTime() - now.getTime());
        if (!kind) continue;

        const recipients: { userId: string; role: 'driver' | 'passenger'; bookingId?: string }[] = [
          { userId: trip.driver.userId, role: 'driver' },
        ];
        const seen = new Set<string>([trip.driver.userId]);
        for (const booking of trip.bookings) {
          if (seen.has(booking.customer.userId)) continue;
          seen.add(booking.customer.userId);
          recipients.push({ userId: booking.customer.userId, role: 'passenger', bookingId: booking.id });
        }

        for (const recipient of recipients) {
          if (done.has(`${trip.id}:${recipient.userId}:${kind}`)) continue;
          if (!(await this.claim(trip.id, recipient.userId, kind))) continue;

          const texts = buildReminderTexts({
            role: recipient.role,
            kind,
            origin: trip.originCity.name,
            destination: trip.destinationCity.name,
            departureAt: trip.departureAt,
            now,
            timeZone: this.timeZone,
            confirmedBookings: trip.bookings.length,
          });
          try {
            await this.notifications.notify({
              userId: recipient.userId,
              audience: recipient.role === 'driver' ? 'DRIVER' : 'CUSTOMER',
              type: NotificationType.DEPARTURE_IMMINENT,
              channels: [NotificationChannel.PUSH],
              fallbackTitle: texts.title,
              fallbackBody: texts.body,
              payload: {
                tripId: trip.id,
                origin: trip.originCity.name,
                destination: trip.destinationCity.name,
                reminder: kind,
              },
              pushData: { type: 'DEPARTURE_IMMINENT', tripId: trip.id, ...(recipient.bookingId ? { bookingId: recipient.bookingId } : {}) },
            });
            sent += 1;
          } catch (error) {
            this.logger.warn(`Rappel ${kind} non envoyé (trajet ${trip.id}, utilisateur ${recipient.userId}) : ${(error as Error).message}`);
          }
        }
      }
      if (trips.length < BATCH_SIZE) break;
    }
    return sent;
  }

  /** Réserve le rappel : vrai pour le seul exemplaire du serveur qui l'a écrit en premier. */
  private async claim(tripId: string, userId: string, kind: ReminderKind): Promise<boolean> {
    try {
      await this.prisma.tripReminderLog.create({ data: { tripId, userId, kind } });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false;
      throw error;
    }
  }
}
