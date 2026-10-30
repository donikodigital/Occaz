// backend/src/jobs/jobs.service.ts
// [30/10/2026] v6 — + reprise des fonds restés en attente, clôture des trajets abandonnés, relevé du dernier passage (alerte si les traitements ne tournent plus).
// [25/10/2026] v5 — + reprise automatique des remboursements d'annulation en échec.
// [25/10/2026] v4 — + envoi automatique des retraits programmés, clôture automatique des trajets restés à l'arrivée (client absent / dépose jamais validée).
// [20/10/2026] v3 — + suppression des comptes suspendus depuis 6 mois (rappels mensuels par e-mail avant).
// [19/10/2026] v2 — + rappels d'intégration (dossier conducteur tous les 2 jours, adresse e-mail).
// [19/10/2026] v1 — Lance, un par un, les traitements automatiques (réservations impayées, trajets sans réservation, rappels de départ, plages
// de dates des envois). Chaque traitement garde son propre garde-fou (verrou « déjà en cours » + mises à jour conditionnelles en base) :
// l'appeler deux fois en même temps, ou depuis plusieurs instances, ne traite jamais deux fois la même ligne.
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { BookingExpiryService } from '../trips/booking-expiry.service';
import { TripExpiryService } from '../trips/trip-expiry.service';
import { TripReminderService } from '../trips/trip-reminder.service';
import { TripCompletionService } from '../trips/trip-completion.service';
import { RefundRecoveryService } from '../payments/refund-recovery.service';
import { PayoutAutoReleaseService } from '../wallets/payout-auto-release.service';
import { HeldFundsRecoveryService } from '../wallets/held-funds-recovery.service';
import { ShipmentWindowService } from '../shipments/shipment-window.service';
import { OnboardingReminderService } from '../onboarding-reminders/onboarding-reminder.service';
import { SuspendedAccountPurgeService } from '../account-purge/suspended-account-purge.service';

export interface JobResult {
  job: string;
  ok: boolean;
  durationMs: number;
  error?: string;
}

/** Sans appel de la tâche planifiée depuis ce délai, les traitements ne tournent plus : l'équipe est alertée. */
export const JOBS_STALE_AFTER_MS = 15 * 60_000;
const WATCHDOG_INTERVAL_MS = 5 * 60_000;
/** Une alerte au plus toutes les 6 heures tant que le problème dure (pas de pluie de messages). */
const ALERT_EVERY_MS = 6 * 3_600_000;

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private readonly startedAt = Date.now();
  private lastRunAt: number | null = null;
  private lastAlertAt: number | null = null;
  private watchdog?: NodeJS.Timeout;

  constructor(
    private readonly bookingExpiry: BookingExpiryService,
    private readonly tripExpiry: TripExpiryService,
    private readonly tripReminder: TripReminderService,
    private readonly shipmentWindow: ShipmentWindowService,
    private readonly onboardingReminders: OnboardingReminderService,
    private readonly suspendedAccountPurge: SuspendedAccountPurgeService,
    private readonly tripCompletion: TripCompletionService,
    private readonly payoutAutoRelease: PayoutAutoReleaseService,
    private readonly refundRecovery: RefundRecoveryService,
    private readonly heldFundsRecovery: HeldFundsRecoveryService,
  ) {}

  onModuleInit(): void {
    // Veille uniquement quand l'appel externe est configuré (JOBS_SECRET) : c'est lui, et lui seul, que ce garde-fou surveille.
    if (process.env.JOBS_WATCHDOG === 'off' || (process.env.JOBS_SECRET?.trim().length ?? 0) < 24) return;
    this.watchdog = setInterval(() => this.checkFreshness(), WATCHDOG_INTERVAL_MS);
    this.watchdog.unref?.();
  }

  onModuleDestroy(): void {
    if (this.watchdog) clearInterval(this.watchdog);
  }

  /**
   * Garde-fou : si la tâche planifiée externe (GitHub Actions → POST /jobs/run) cesse d'appeler l'API alors que le serveur est
   * éveillé, réservations impayées, remboursements, clôtures de trajets et libérations de fonds ne sont plus traités — sans aucun
   * message d'erreur nulle part. Cette vérification le signale (journal + Sentry). Renvoie vrai quand une alerte part.
   */
  checkFreshness(now: number = Date.now()): boolean {
    const reference = this.lastRunAt ?? this.startedAt;
    if (now - reference < JOBS_STALE_AFTER_MS) return false;
    if (this.lastAlertAt !== null && now - this.lastAlertAt < ALERT_EVERY_MS) return false;
    this.lastAlertAt = now;
    const minutes = Math.round((now - reference) / 60_000);
    const message = `Traitements automatiques : aucun appel de la tâche planifiée depuis ${minutes} minutes — vérifier le workflow GitHub « Traitements automatiques » (secrets JOBS_API_URL / JOBS_SECRET) et que l'hébergement ne met pas l'API en veille.`;
    this.logger.error(message);
    Sentry.captureMessage(message, 'error');
    return true;
  }

  /** Les traitements, dans l'ordre. Un échec n'empêche jamais les suivants. */
  private tasks(): Array<[string, () => Promise<unknown>]> {
    return [
      ['booking-expiry', () => this.bookingExpiry.runOnce()],
      ['trip-expiry', () => this.tripExpiry.runOnce()],
      ['trip-reminders', () => this.tripReminder.runOnce()],
      ['trip-autoclose', () => this.tripCompletion.runOnce()],
      ['refund-recovery', () => this.refundRecovery.runOnce()],
      ['held-funds-recovery', () => this.heldFundsRecovery.runOnce()],
      ['payout-auto-release', () => this.payoutAutoRelease.runOnce()],
      ['shipment-window', () => this.shipmentWindow.runOnce()],
      ['onboarding-reminders', () => this.onboardingReminders.runOnce()],
      ['suspended-account-purge', () => this.suspendedAccountPurge.runOnce()],
    ];
  }

  async runAll(): Promise<JobResult[]> {
    this.lastRunAt = Date.now();
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
