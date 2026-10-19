// backend/src/onboarding-reminders/onboarding-reminder.service.ts
// [19/10/2026] v1 — Rappels automatiques d'intégration, lancés par le déclencheur de tâches (POST /jobs/run, toutes les 5 minutes) :
//
//  1. DOSSIER CONDUCTEUR — tant qu'un conducteur n'est pas validé ET qu'il lui manque des pièces (photo, permis, véhicule, carte grise),
//     il reçoit un rappel tous les 2 jours (réglage « driver.reminder_interval_days ») : notification dans l'application + push, et e-mail
//     s'il a renseigné son adresse. Le texte dit combien de jours il reste avant le blocage de la création de trajets, ou que ce blocage est
//     en vigueur. Un dossier complet qui attend seulement l'examen de l'équipe ne reçoit rien : il n'a plus rien à faire.
//  2. ADRESSE E-MAIL — facultative, mais précieuse (récupération du compte, reçus). Un client ou un conducteur sans adresse reçoit deux
//     rappels après l'ouverture de son compte (au bout de 1 jour, puis de 5 jours), en plus de l'invitation faite pendant l'inscription.
//
// Chaque rappel n'est envoyé qu'une fois : avant l'envoi, on écrit une ligne dans OnboardingReminderLog dont la contrainte d'unicité refuse
// le second essai, même avec plusieurs instances du serveur. En cas de panne du canal, mieux vaut un rappel manquant qu'un doublon.
// Pas de SMS (politique de coût, voir integrations/sms/sms-purpose.ts). Interrupteur : réglage « jobs.onboarding_reminders_enabled ».
import { Injectable, Logger } from '@nestjs/common';
import { DriverAccountStatus, NotificationChannel, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DriverComplianceService, joinLabels } from '../profiles/driver-profiles/driver-compliance.service';

const DAY_MS = 86_400_000;
const BATCH_SIZE = 100;
/** Le balayage complet n'a pas besoin de tourner toutes les 5 minutes : au plus une fois par demi-heure et par instance. */
const MIN_RUN_GAP_MS = 30 * 60_000;
/** Un compte plus ancien que cela ne reçoit plus de rappel d'adresse e-mail. */
const EMAIL_REMINDER_WINDOW_DAYS = 30;
/** Âge (en jours) du compte à partir duquel part le 1er puis le 2e rappel d'adresse e-mail. */
export const EMAIL_REMINDER_AFTER_DAYS = [1, 5] as const;

export const KIND_DRIVER_DOCUMENTS = 'DRIVER_DOCUMENTS';
export const KIND_EMAIL_ADDRESS = 'EMAIL_ADDRESS';
export const REMINDER_INTERVAL_KEY = 'driver.reminder_interval_days';
export const REMINDERS_ENABLED_KEY = 'jobs.onboarding_reminders_enabled';
const DEFAULT_INTERVAL_DAYS = 2;

export interface ReminderTexts {
  title: string;
  body: string;
}

/** Numéro de la période de rappel écoulée depuis `since` (0 = pas encore une période entière). */
export function reminderSequence(since: Date, now: Date, intervalDays: number): number {
  const interval = Math.max(1, Math.floor(intervalDays)) * DAY_MS;
  return Math.max(0, Math.floor((now.getTime() - since.getTime()) / interval));
}

/** Quel rappel d'adresse e-mail est dû pour un compte ouvert depuis `ageDays` jours ? 0 = aucun, 1 ou 2. */
export function dueEmailReminder(ageDays: number): 0 | 1 | 2 {
  if (ageDays >= EMAIL_REMINDER_AFTER_DAYS[1]) return 2;
  if (ageDays >= EMAIL_REMINDER_AFTER_DAYS[0]) return 1;
  return 0;
}

export function buildDriverDocumentsReminder(params: {
  missingLabels: string[];
  daysLeft: number;
  graceDays: number;
  graceExpired: boolean;
}): ReminderTexts {
  const list = joinLabels(params.missingLabels);
  if (params.graceExpired) {
    return {
      title: 'Création de trajets suspendue',
      body: `Le délai de ${params.graceDays} jour${params.graceDays > 1 ? 's' : ''} pour régulariser votre dossier est dépassé. Envoyez : ${list}. Dès que ces pièces sont envoyées, vous pouvez de nouveau créer des trajets. Les envois de colis s'ouvrent après la validation de votre dossier.`,
    };
  }
  const left = params.daysLeft <= 1 ? 'Dernier jour' : `Il vous reste ${params.daysLeft} jours`;
  return {
    title: 'Complétez votre dossier conducteur',
    body: `${left} pour envoyer : ${list}. Passé ce délai, vous ne pourrez plus créer de trajets. Les envois de colis s'ouvrent après la validation de votre dossier.`,
  };
}

export function buildEmailAddressReminder(sequence: 1 | 2): ReminderTexts {
  return sequence === 1
    ? {
        title: 'Ajoutez votre adresse e-mail',
        body: "Facultatif, mais utile : avec une adresse e-mail, vous pouvez récupérer votre compte plus facilement et recevoir vos reçus et rappels. Ajoutez-la depuis votre profil, en quelques secondes.",
      }
    : {
        title: 'Pensez à votre adresse e-mail',
        body: "Dernier rappel : une adresse e-mail protège l'accès à votre compte et vous garantit de ne manquer aucune information importante. Vous pouvez l'ajouter depuis votre profil.",
      };
}

@Injectable()
export class OnboardingReminderService {
  private readonly logger = new Logger(OnboardingReminderService.name);
  private running = false;
  private lastRunAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly compliance: DriverComplianceService,
  ) {}

  async runOnce(now: Date = new Date(), force = false): Promise<{ documents: number; emails: number }> {
    if (this.running) return { documents: 0, emails: 0 };
    if (!force && Date.now() - this.lastRunAt < MIN_RUN_GAP_MS) return { documents: 0, emails: 0 };
    this.running = true;
    try {
      if (!(await this.enabled())) return { documents: 0, emails: 0 };
      const documents = await this.sendDriverDocumentReminders(now);
      const emails = await this.sendEmailAddressReminders(now);
      this.lastRunAt = Date.now();
      return { documents, emails };
    } catch (error) {
      this.logger.error('Échec des rappels d’intégration', error as Error);
      return { documents: 0, emails: 0 };
    } finally {
      this.running = false;
    }
  }

  private async setting(key: string): Promise<unknown> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key } });
    return row?.value;
  }

  private async enabled(): Promise<boolean> {
    const value = await this.setting(REMINDERS_ENABLED_KEY);
    return value !== false && value !== 0;
  }

  private async intervalDays(): Promise<number> {
    const value = Number(await this.setting(REMINDER_INTERVAL_KEY));
    return Number.isFinite(value) && value >= 1 ? Math.floor(value) : DEFAULT_INTERVAL_DAYS;
  }

  /** Réserve le rappel (kind, sequence) pour cette personne. false = déjà envoyé (ou en cours d'envoi par une autre instance). */
  private async claim(userId: string, kind: string, sequence: number): Promise<boolean> {
    try {
      await this.prisma.onboardingReminderLog.create({ data: { userId, kind, sequence } });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false;
      throw error;
    }
  }

  private async sendDriverDocumentReminders(now: Date): Promise<number> {
    const intervalDays = await this.intervalDays();
    let sent = 0;
    let cursor: string | undefined;

    for (;;) {
      const drivers = await this.prisma.driverProfile.findMany({
        where: {
          status: { in: [DriverAccountStatus.PENDING, DriverAccountStatus.IN_VERIFICATION] },
          deletedAt: null,
          user: { isSuspended: false, isActive: true },
        },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          userId: true,
          status: true,
          createdAt: true,
          photoUrl: true,
          vehicles: { where: { deletedAt: null }, select: { id: true } },
          user: { select: { email: true } },
        },
      });
      if (drivers.length === 0) break;
      cursor = drivers[drivers.length - 1].id;

      for (const driver of drivers) {
        const sequence = reminderSequence(driver.createdAt, now, intervalDays);
        if (sequence < 1) continue;

        const compliance = await this.compliance.evaluateLoaded(driver, now);
        if (compliance.missing.length === 0) continue; // dossier complet : rien à faire de son côté
        if (!(await this.claim(driver.userId, KIND_DRIVER_DOCUMENTS, sequence))) continue;

        const texts = buildDriverDocumentsReminder({
          missingLabels: compliance.missingLabels,
          daysLeft: compliance.daysLeft,
          graceDays: compliance.graceDays,
          graceExpired: compliance.graceExpired,
        });
        try {
          await this.notifications.notify({
            userId: driver.userId,
            type: NotificationType.STATUS_CHANGE,
            channels: driver.user.email ? [NotificationChannel.PUSH, NotificationChannel.EMAIL] : [NotificationChannel.PUSH],
            fallbackTitle: texts.title,
            fallbackBody: texts.body,
            pushData: { type: 'DRIVER_COMPLIANCE' },
          });
          sent += 1;
        } catch (error) {
          this.logger.warn(`Rappel de dossier non envoyé à ${driver.userId} : ${(error as Error).message}`);
        }
      }
    }
    return sent;
  }

  private async sendEmailAddressReminders(now: Date): Promise<number> {
    const since = new Date(now.getTime() - EMAIL_REMINDER_WINDOW_DAYS * DAY_MS);
    const firstDue = new Date(now.getTime() - EMAIL_REMINDER_AFTER_DAYS[0] * DAY_MS);
    let sent = 0;
    let cursor: string | undefined;

    for (;;) {
      const users = await this.prisma.user.findMany({
        where: {
          email: null,
          isSuspended: false,
          isActive: true,
          createdAt: { gte: since, lte: firstDue },
          OR: [{ customerProfile: { is: { deletedAt: null } } }, { driverProfile: { is: { deletedAt: null } } }],
        },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, createdAt: true },
      });
      if (users.length === 0) break;
      cursor = users[users.length - 1].id;

      for (const user of users) {
        const ageDays = (now.getTime() - user.createdAt.getTime()) / DAY_MS;
        const due = dueEmailReminder(ageDays);
        if (due === 0) continue;
        if (!(await this.claim(user.id, KIND_EMAIL_ADDRESS, due))) continue;

        const texts = buildEmailAddressReminder(due);
        try {
          await this.notifications.notify({
            userId: user.id,
            type: NotificationType.STATUS_CHANGE,
            channels: [NotificationChannel.PUSH],
            fallbackTitle: texts.title,
            fallbackBody: texts.body,
            pushData: { type: 'ADD_EMAIL' },
          });
          sent += 1;
        } catch (error) {
          this.logger.warn(`Rappel d'adresse e-mail non envoyé à ${user.id} : ${(error as Error).message}`);
        }
      }
    }
    return sent;
  }
}
