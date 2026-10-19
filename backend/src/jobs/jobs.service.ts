// backend/src/jobs/jobs.service.ts
// [19/10/2026] v1 — Lance, un par un, les traitements automatiques (réservations impayées, trajets sans réservation, rappels de départ, plages
// de dates des envois). Chaque traitement garde son propre garde-fou (verrou « déjà en cours » + mises à jour conditionnelles en base) :
// l'appeler deux fois en même temps, ou depuis plusieurs instances, ne traite jamais deux fois la même ligne.
import { Injectable, Logger } from '@nestjs/common';
import { BookingExpiryService } from '../trips/booking-expiry.service';
import { TripExpiryService } from '../trips/trip-expiry.service';
import { TripReminderService } from '../trips/trip-reminder.service';
import { ShipmentWindowService } from '../shipments/shipment-window.service';

export interface JobResult {
  job: string;
  ok: boolean;
  durationMs: number;
  error?: string;
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly bookingExpiry: BookingExpiryService,
    private readonly tripExpiry: TripExpiryService,
    private readonly tripReminder: TripReminderService,
    private readonly shipmentWindow: ShipmentWindowService,
  ) {}

  /** Les traitements, dans l'ordre. Un échec n'empêche jamais les suivants. */
  private tasks(): Array<[string, () => Promise<unknown>]> {
    return [
      ['booking-expiry', () => this.bookingExpiry.runOnce()],
      ['trip-expiry', () => this.tripExpiry.runOnce()],
      ['trip-reminders', () => this.tripReminder.runOnce()],
      ['shipment-window', () => this.shipmentWindow.runOnce()],
    ];
  }

  async runAll(): Promise<JobResult[]> {
    const results: JobResult[] = [];
    for (const [job, run] of this.tasks()) {
      const startedAt = Date.now();
      try {
        await run();
        results.push({ job, ok: true, durationMs: Date.now() - startedAt });
      } catch (error) {
        const message = (error as Error).message ?? String(error);
        this.logger.error(`Traitement « ${job} » en échec : ${message}`);
        results.push({ job, ok: false, durationMs: Date.now() - startedAt, error: message.slice(0, 200) });
      }
    }
    return results;
  }
}
