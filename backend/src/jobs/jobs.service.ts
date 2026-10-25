// backend/src/jobs/jobs.service.ts
// [25/10/2026] v4 — + envoi automatique des retraits programmés, clôture automatique des trajets restés à l'arrivée (client absent / dépose jamais validée).
// [20/10/2026] v3 — + suppression des comptes suspendus depuis 6 mois (rappels mensuels par e-mail avant).
// [19/10/2026] v2 — + rappels d'intégration (dossier conducteur tous les 2 jours, adresse e-mail).
// [19/10/2026] v1 — Lance, un par un, les traitements automatiques (réservations impayées, trajets sans réservation, rappels de départ, plages
// de dates des envois). Chaque traitement garde son propre garde-fou (verrou « déjà en cours » + mises à jour conditionnelles en base) :
// l'appeler deux fois en même temps, ou depuis plusieurs instances, ne traite jamais deux fois la même ligne.
import { Injectable, Logger } from '@nestjs/common';
import { BookingExpiryService } from '../trips/booking-expiry.service';
import { TripExpiryService } from '../trips/trip-expiry.service';
import { TripReminderService } from '../trips/trip-reminder.service';
import { TripCompletionService } from '../trips/trip-completion.service';
import { PayoutAutoReleaseService } from '../wallets/payout-auto-release.service';
import { ShipmentWindowService } from '../shipments/shipment-window.service';
import { OnboardingReminderService } from '../onboarding-reminders/onboarding-reminder.service';
import { SuspendedAccountPurgeService } from '../account-purge/suspended-account-purge.service';

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
    private readonly onboardingReminders: OnboardingReminderService,
    private readonly suspendedAccountPurge: SuspendedAccountPurgeService,
    private readonly tripCompletion: TripCompletionService,
    private readonly payoutAutoRelease: PayoutAutoReleaseService,
  ) {}

  /** Les traitements, dans l'ordre. Un échec n'empêche jamais les suivants. */
  private tasks(): Array<[string, () => Promise<unknown>]> {
    return [
      ['booking-expiry', () => this.bookingExpiry.runOnce()],
      ['trip-expiry', () => this.tripExpiry.runOnce()],
      ['trip-reminders', () => this.tripReminder.runOnce()],
      ['trip-autoclose', () => this.tripCompletion.runOnce()],
      ['payout-auto-release', () => this.payoutAutoRelease.runOnce()],
      ['shipment-window', () => this.shipmentWindow.runOnce()],
      ['onboarding-reminders', () => this.onboardingReminders.runOnce()],
      ['suspended-account-purge', () => this.suspendedAccountPurge.runOnce()],
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
