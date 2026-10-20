// backend/src/account-purge/suspended-account-purge.service.ts
// [20/10/2026] v1 — Suppression définitive des comptes CLIENT et CONDUCTEUR suspendus depuis 6 mois sans avoir été réactivés, lancée par le
// déclencheur de tâches (POST /jobs/run, toutes les 5 minutes ; au plus une passe par heure et par instance).
//
// RAPPELS — chaque mois après le début de la suspension (1er, 2e… 5e mois), le titulaire reçoit un e-mail qui l'invite à se rapprocher de
// l'administration pour se mettre en conformité, avec la date de suppression. Pas d'adresse e-mail sur le compte = aucun avertissement
// (pas de SMS ni de notification dans l'application : un compte suspendu ne peut plus s'y connecter). Chaque rappel n'est envoyé qu'une fois :
// une ligne OnboardingReminderLog (contrainte d'unicité) est écrite avant l'envoi, même avec plusieurs instances du serveur.
//
// SUPPRESSION — à 6 mois, le compte est effacé de la base :
//  • sans aucun historique (ni réservation, envoi, trajet, mouvement de portefeuille, conversation, évaluation, litige…) : la ligne User et
//    tout ce qui lui appartient sont supprimés physiquement (profils, véhicules, pièces, cartes, sessions, appareils, notifications…) ;
//  • avec un historique : les données personnelles sont effacées pour de bon (téléphone, e-mail, nom, photo, pièces d'identité, cartes,
//    messages…) et la ligne ne subsiste que comme ancre anonyme (« Compte supprimé ») pour les enregistrements dont d'autres personnes et
//    la comptabilité ont besoin (réservations, paiements, mouvements de portefeuille, litiges). Le numéro de téléphone redevient libre.
//  Si la suppression complète échoue sur une contrainte de la base, on retombe sur cette anonymisation.
//
// GARDE-FOUS — jamais de suppression d'un compte d'équipe (Support, SuperAdmin) ; un compte qui a encore une réservation, un envoi ou un
// trajet en cours, un litige ouvert, un solde de portefeuille ou un retrait en cours est laissé tel quel (journalisé) : c'est à l'équipe de
// régler la situation. Réactiver le compte (levée de la suspension) remet le compteur à zéro. Interrupteur : réglage
// « jobs.suspended_purge_enabled ». Les comptes déjà suspendus au déploiement ont 6 mois à compter du déploiement (voir la migration).
import { Injectable, Logger } from '@nestjs/common';
import { AccountType, DocumentOwnerType, NotificationChannel, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';

const DAY_MS = 86_400_000;
const BATCH_SIZE = 100;
/** Passe complète au plus une fois par heure et par instance : les échéances se comptent en jours. */
const MIN_RUN_GAP_MS = 60 * 60_000;
const TRANSACTION_OPTIONS = { timeout: 30_000, maxWait: 10_000 };

/** Durée de suspension (en mois) au bout de laquelle le compte est supprimé. */
export const RETENTION_MONTHS = 6;
export const KIND_SUSPENSION_NOTICE = 'SUSPENSION_NOTICE';
export const PURGE_ENABLED_KEY = 'jobs.suspended_purge_enabled';
export const ANONYMOUS_FIRST_NAME = 'Compte';
export const ANONYMOUS_LAST_NAME = 'supprimé';
const ANONYMIZED_MESSAGE = '[message supprimé]';
/** Seuls les comptes client et conducteur sont concernés : jamais un compte d'équipe (Support, SuperAdmin). */
const PURGEABLE_TYPES: AccountType[] = [AccountType.CUSTOMER, AccountType.DRIVER];

export interface SuspensionReminderTexts {
  title: string;
  body: string;
}

// ---------------------------------------------------------------------------
// Règles pures (testées sans base)
// ---------------------------------------------------------------------------

/** Ajoute `months` mois (négatif = retrancher) en UTC ; le 31 + 1 mois donne le dernier jour du mois suivant, jamais un débordement. */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

/** Nombre de mois entiers écoulés entre `since` et `now`. */
export function monthsElapsed(since: Date, now: Date): number {
  let months = (now.getUTCFullYear() - since.getUTCFullYear()) * 12 + (now.getUTCMonth() - since.getUTCMonth());
  if (months > 0 && addMonths(since, months).getTime() > now.getTime()) months -= 1;
  return Math.max(0, months);
}

/** Date à partir de laquelle un compte suspendu depuis `suspendedAt` est supprimé. */
export function purgeDueAt(suspendedAt: Date): Date {
  return addMonths(suspendedAt, RETENTION_MONTHS);
}

/** Numéro du rappel mensuel dû (1 à 5), ou 0 : pas encore un mois écoulé, ou l'heure de la suppression est venue. */
export function dueSuspensionReminder(suspendedAt: Date, now: Date): number {
  const months = monthsElapsed(suspendedAt, now);
  return months >= 1 && months < RETENTION_MONTHS ? months : 0;
}

/** Une même suspension = un même « kind » : si le compte est réactivé puis suspendu de nouveau, les rappels repartent de zéro. */
export function suspensionNoticeKind(suspendedAt: Date): string {
  return `${KIND_SUSPENSION_NOTICE}:${suspendedAt.toISOString().slice(0, 10)}`;
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });

export function buildSuspensionReminder(params: { suspendedAt: Date; now: Date; sequence: number }): SuspensionReminderTexts {
  const deadline = purgeDueAt(params.suspendedAt);
  const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - params.now.getTime()) / DAY_MS));
  const left = daysLeft === 0 ? 'très bientôt' : daysLeft === 1 ? 'dans 1 jour' : `dans ${daysLeft} jours`;
  const isLast = params.sequence >= RETENTION_MONTHS - 1;
  const lead = `Votre compte Occa'Z est suspendu depuis le ${dateFormatter.format(params.suspendedAt)}. Rapprochez-vous de l'administration pour vous mettre en conformité et le réactiver.`;
  const warning = `Sans régularisation avant le ${dateFormatter.format(deadline)} (${left}), votre compte et vos données seront définitivement supprimés, sans possibilité de les récupérer.`;
  return {
    title: isLast ? 'Dernier rappel : votre compte Occa\'Z va être supprimé' : 'Votre compte Occa\'Z est suspendu',
    body: isLast ? `Dernier rappel. ${lead} ${warning}` : `${lead} ${warning}`,
  };
}

/** Le fichier d'une photo servie par l'URL publique du stockage (STORAGE_PUBLIC_BASE_URL) ; null si l'URL n'en vient pas (URL signée, autre). */
export function storageKeyFromPublicUrl(url: string | null | undefined, publicBaseUrl = process.env.STORAGE_PUBLIC_BASE_URL): string | null {
  if (!url || !publicBaseUrl) return null;
  const prefix = `${publicBaseUrl.replace(/\/$/, '')}/`;
  if (!url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length).split('?')[0];
  try {
    return key ? decodeURIComponent(key) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export type PurgeOutcome = 'deleted' | 'anonymized' | 'skipped';

interface PurgeTarget {
  id: string;
  accountType: AccountType;
  isSuspended: boolean;
  suspendedAt: Date | null;
  deletedAt: Date | null;
  customerProfile: { id: string; photoUrl: string | null } | null;
  driverProfile: { id: string; photoUrl: string | null } | null;
}

export interface PurgeRunResult {
  reminders: number;
  deleted: number;
  anonymized: number;
  skipped: number;
  failed: number;
}

const EMPTY_RESULT: PurgeRunResult = { reminders: 0, deleted: 0, anonymized: 0, skipped: 0, failed: 0 };

@Injectable()
export class SuspendedAccountPurgeService {
  private readonly logger = new Logger(SuspendedAccountPurgeService.name);
  private running = false;
  private lastRunAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async runOnce(now: Date = new Date(), force = false): Promise<PurgeRunResult> {
    if (this.running) return { ...EMPTY_RESULT };
    if (!force && Date.now() - this.lastRunAt < MIN_RUN_GAP_MS) return { ...EMPTY_RESULT };
    this.running = true;
    try {
      if (!(await this.enabled())) return { ...EMPTY_RESULT };
      const result: PurgeRunResult = { ...EMPTY_RESULT };
      await this.purgeDueAccounts(now, result);
      result.reminders = await this.sendMonthlyReminders(now);
      this.lastRunAt = Date.now();
      return result;
    } catch (error) {
      this.logger.error('Échec du traitement des comptes suspendus', error as Error);
      return { ...EMPTY_RESULT };
    } finally {
      this.running = false;
    }
  }

  private async enabled(): Promise<boolean> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: PURGE_ENABLED_KEY } });
    return row?.value !== false && row?.value !== 0;
  }

  // -------------------------------------------------------------------------
  // Rappels mensuels
  // -------------------------------------------------------------------------

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

  private async sendMonthlyReminders(now: Date): Promise<number> {
    // Au moins 1 mois et moins de 6 mois de suspension ; seuls les comptes qui ont une adresse e-mail sont prévenus.
    const oldestStart = addMonths(now, -RETENTION_MONTHS);
    const latestStart = addMonths(now, -1);
    let sent = 0;
    let lastId: string | undefined;

    for (;;) {
      const users = await this.prisma.user.findMany({
        where: {
          isSuspended: true,
          deletedAt: null,
          accountType: { in: PURGEABLE_TYPES },
          email: { not: null },
          suspendedAt: { gt: oldestStart, lte: latestStart },
          ...(lastId ? { id: { gt: lastId } } : {}),
        },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        select: { id: true, suspendedAt: true },
      });
      if (users.length === 0) break;
      lastId = users[users.length - 1].id;

      for (const user of users) {
        if (!user.suspendedAt) continue;
        const sequence = dueSuspensionReminder(user.suspendedAt, now);
        if (sequence < 1) continue;
        if (!(await this.claim(user.id, suspensionNoticeKind(user.suspendedAt), sequence))) continue;

        const texts = buildSuspensionReminder({ suspendedAt: user.suspendedAt, now, sequence });
        try {
          await this.notifications.notify({
            userId: user.id,
            type: NotificationType.STATUS_CHANGE,
            channels: [NotificationChannel.EMAIL],
            fallbackTitle: texts.title,
            fallbackBody: texts.body,
          });
          sent += 1;
        } catch (error) {
          this.logger.warn(`Rappel de suspension non envoyé à ${user.id} : ${(error as Error).message}`);
        }
      }
    }
    return sent;
  }

  // -------------------------------------------------------------------------
  // Suppression
  // -------------------------------------------------------------------------

  private async purgeDueAccounts(now: Date, result: PurgeRunResult): Promise<void> {
    const threshold = addMonths(now, -RETENTION_MONTHS);
    let lastId: string | undefined;

    for (;;) {
      const users = await this.prisma.user.findMany({
        where: {
          isSuspended: true,
          deletedAt: null,
          accountType: { in: PURGEABLE_TYPES },
          suspendedAt: { not: null, lte: threshold },
          ...(lastId ? { id: { gt: lastId } } : {}),
        },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        select: { id: true },
      });
      if (users.length === 0) break;
      lastId = users[users.length - 1].id;

      for (const { id } of users) {
        try {
          const outcome = await this.purgeOne(id, now);
          if (outcome === 'deleted') result.deleted += 1;
          else if (outcome === 'anonymized') result.anonymized += 1;
          else result.skipped += 1;
        } catch (error) {
          result.failed += 1;
          this.logger.error(`Suppression du compte suspendu ${id} en échec : ${(error as Error).message}`);
        }
      }
    }
  }

  /** Supprime un compte dont les 6 mois sont écoulés. Revérifie tout juste avant d'agir : la situation a pu changer depuis la sélection. */
  async purgeOne(userId: string, now: Date = new Date()): Promise<PurgeOutcome> {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        accountType: true,
        isSuspended: true,
        suspendedAt: true,
        deletedAt: true,
        customerProfile: { select: { id: true, photoUrl: true } },
        driverProfile: { select: { id: true, photoUrl: true } },
      },
    });
    if (!target || target.deletedAt) return 'skipped';
    if (!PURGEABLE_TYPES.includes(target.accountType)) return 'skipped';
    if (!target.isSuspended || !target.suspendedAt || purgeDueAt(target.suspendedAt).getTime() > now.getTime()) return 'skipped';

    const blocker = await this.blockingReason(target);
    if (blocker) {
      this.logger.warn(`Compte suspendu ${userId} conservé malgré les 6 mois : ${blocker}.`);
      return 'skipped';
    }

    const storageKeys = await this.collectStorageKeys(target);
    const hasHistory = await this.hasRetainedHistory(target);

    let outcome: Exclude<PurgeOutcome, 'skipped'>;
    if (hasHistory) {
      await this.prisma.$transaction((tx) => this.anonymize(tx, target, now), TRANSACTION_OPTIONS);
      outcome = 'anonymized';
    } else {
      try {
        await this.prisma.$transaction((tx) => this.hardDelete(tx, target), TRANSACTION_OPTIONS);
        outcome = 'deleted';
      } catch (error) {
        // Une ligne liée qu'on n'avait pas prévue (contrainte de clé étrangère) : on efface au moins toutes les données personnelles.
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !['P2003', 'P2014'].includes(error.code)) throw error;
        this.logger.warn(`Suppression complète impossible pour ${userId} (${error.code}) — anonymisation à la place.`);
        await this.prisma.$transaction((tx) => this.anonymize(tx, target, now), TRANSACTION_OPTIONS);
        outcome = 'anonymized';
      }
    }

    // Les fichiers (pièces d'identité, photos) partent en dernier : supprimer le fichier d'une ligne qu'on garderait serait irréparable.
    await Promise.all(storageKeys.map((key) => this.storage.deleteObject(key)));

    try {
      await this.audit.log({
        entityType: 'User',
        entityId: userId,
        action: outcome === 'deleted' ? 'PURGE_DELETED' : 'PURGE_ANONYMIZED',
        diff: { accountType: target.accountType, reason: `SUSPENDED_${RETENTION_MONTHS}_MONTHS`, suspendedAt: target.suspendedAt.toISOString() },
      });
    } catch (error) {
      this.logger.warn(`Journal d'audit non écrit pour ${userId} : ${(error as Error).message}`);
    }
    return outcome;
  }

  /** Pourquoi ce compte ne doit pas être supprimé maintenant, ou null. */
  private async blockingReason(target: PurgeTarget): Promise<string | null> {
    const userId = target.id;
    const customerId = target.customerProfile?.id;
    const driverId = target.driverProfile?.id;

    const [bookings, shipments, trips, disputes, wallet, payouts] = await Promise.all([
      customerId
        ? this.prisma.booking.count({ where: { customerId, status: { in: ['PENDING_PAYMENT', 'PAID', 'CONFIRMED'] } } })
        : 0,
      this.prisma.shipment.count({
        where: {
          OR: [...(customerId ? [{ customerId }] : []), ...(driverId ? [{ driverId }] : [])],
          status: { in: ['CREATED', 'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERY_PENDING'] },
        },
      }),
      driverId ? this.prisma.trip.count({ where: { driverId, status: { notIn: ['DRAFT', 'COMPLETED', 'CANCELLED'] } } }) : 0,
      this.prisma.dispute.count({
        where: {
          status: { notIn: ['RESOLVED', 'CLOSED'] },
          OR: [
            { openedById: userId },
            ...(customerId ? [{ booking: { customerId } }, { shipment: { customerId } }] : []),
            ...(driverId ? [{ booking: { trip: { driverId } } }, { shipment: { driverId } }] : []),
          ],
        },
      }),
      driverId ? this.prisma.wallet.findUnique({ where: { driverId }, select: { balance: true, pendingBalance: true } }) : null,
      driverId ? this.prisma.payout.count({ where: { wallet: { driverId }, status: { in: ['REQUESTED', 'PROCESSING'] } } }) : 0,
    ]);

    if (bookings > 0) return 'réservation en cours';
    if (shipments > 0) return 'envoi en cours';
    if (trips > 0) return 'trajet en cours';
    if (disputes > 0) return 'litige ouvert';
    if (payouts > 0) return 'retrait en cours';
    if (wallet && (wallet.balance > BigInt(0) || wallet.pendingBalance > BigInt(0))) return 'solde de portefeuille non nul';
    return null;
  }

  /** Vrai si d'autres personnes ou la comptabilité ont encore besoin d'enregistrements rattachés à ce compte : on l'anonymise au lieu de le supprimer. */
  private async hasRetainedHistory(target: PurgeTarget): Promise<boolean> {
    const userId = target.id;
    const customerId = target.customerProfile?.id;
    const driverId = target.driverProfile?.id;

    const counts = await Promise.all([
      this.prisma.rating.count({ where: { OR: [{ fromUserId: userId }, { toUserId: userId }] } }),
      this.prisma.dispute.count({ where: { openedById: userId } }),
      this.prisma.disputeMessage.count({ where: { authorId: userId } }),
      this.prisma.disputeResolution.count({ where: { decidedById: userId } }),
      this.prisma.message.count({ where: { senderId: userId } }),
      this.prisma.referral.count({ where: { OR: [{ referrerId: userId }, { refereeId: userId }] } }),
      this.prisma.sosAlert.count({ where: { userId } }),
      this.prisma.userReport.count({ where: { OR: [{ reporterId: userId }, { reportedUserId: userId }] } }),
      this.prisma.auditLog.count({ where: { actorId: userId } }),
      this.prisma.walletTransaction.count({ where: { triggeredByUserId: userId } }),
      customerId ? this.prisma.booking.count({ where: { customerId } }) : 0,
      customerId ? this.prisma.shipment.count({ where: { customerId } }) : 0,
      customerId ? this.prisma.conversation.count({ where: { customerId } }) : 0,
      customerId ? this.prisma.promoCodeRedemption.count({ where: { customerId } }) : 0,
      driverId ? this.prisma.trip.count({ where: { driverId } }) : 0,
      driverId ? this.prisma.shipment.count({ where: { driverId } }) : 0,
      driverId ? this.prisma.shipmentInvitation.count({ where: { driverId } }) : 0,
      driverId ? this.prisma.conversation.count({ where: { driverId } }) : 0,
      driverId ? this.prisma.walletTransaction.count({ where: { wallet: { driverId } } }) : 0,
      driverId ? this.prisma.payout.count({ where: { wallet: { driverId } } }) : 0,
    ]);
    return counts.some((count) => count > 0);
  }

  /** Fichiers du stockage à effacer : pièces d'identité, documents du véhicule, photos de profil et de véhicule. */
  private async collectStorageKeys(target: PurgeTarget): Promise<string[]> {
    const vehicles = target.driverProfile
      ? await this.prisma.vehicle.findMany({ where: { driverId: target.driverProfile.id }, select: { id: true, photoUrl: true } })
      : [];
    const documents = await this.prisma.document.findMany({
      where: { OR: this.documentOwners(target, vehicles.map((vehicle) => vehicle.id)) },
      select: { storageKey: true },
    });
    const keys = [
      ...documents.map((document) => document.storageKey),
      storageKeyFromPublicUrl(target.customerProfile?.photoUrl),
      storageKeyFromPublicUrl(target.driverProfile?.photoUrl),
      ...vehicles.map((vehicle) => storageKeyFromPublicUrl(vehicle.photoUrl)),
    ];
    return [...new Set(keys.filter((key): key is string => Boolean(key)))];
  }

  private documentOwners(target: PurgeTarget, vehicleIds: string[]): Prisma.DocumentWhereInput[] {
    return [
      ...(target.customerProfile ? [{ ownerType: DocumentOwnerType.CUSTOMER, ownerId: target.customerProfile.id }] : []),
      ...(target.driverProfile ? [{ ownerType: DocumentOwnerType.DRIVER, ownerId: target.driverProfile.id }] : []),
      ...(vehicleIds.length > 0 ? [{ ownerType: DocumentOwnerType.VEHICLE, ownerId: { in: vehicleIds } }] : []),
    ];
  }

  /** Données personnelles propres au compte : supprimées dans les deux cas (suppression complète ou anonymisation). */
  private async deletePersonalData(tx: Prisma.TransactionClient, target: PurgeTarget, vehicleIds: string[]): Promise<void> {
    const userId = target.id;
    await tx.onboardingReminderLog.deleteMany({ where: { userId } });
    await tx.tripReminderLog.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.savedLocation.deleteMany({ where: { userId } });
    await tx.emergencyContact.deleteMany({ where: { userId } });
    await tx.userBlock.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
    await tx.cookieConsent.deleteMany({ where: { userId } });
    await tx.phoneChangeRequest.deleteMany({ where: { userId } });
    await tx.otpCode.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.device.deleteMany({ where: { userId } });
    await tx.userRole.deleteMany({ where: { userId } });
    await tx.verification.deleteMany({ where: { userId } });
    await tx.document.deleteMany({ where: { OR: this.documentOwners(target, vehicleIds) } });
    if (target.customerProfile) await tx.savedCard.deleteMany({ where: { customerId: target.customerProfile.id } });
  }

  /** Aucun historique : on supprime la ligne User et tout ce qui lui appartient. */
  private async hardDelete(tx: Prisma.TransactionClient, target: PurgeTarget): Promise<void> {
    const driverId = target.driverProfile?.id;
    const vehicles = driverId ? await tx.vehicle.findMany({ where: { driverId }, select: { id: true } }) : [];
    await this.deletePersonalData(tx, target, vehicles.map((vehicle) => vehicle.id));

    if (target.customerProfile) await tx.customerProfile.delete({ where: { id: target.customerProfile.id } });
    if (driverId) {
      await tx.vehicle.deleteMany({ where: { driverId } });
      await tx.wallet.deleteMany({ where: { driverId } });
      await tx.driverProfile.delete({ where: { id: driverId } });
    }
    await tx.user.delete({ where: { id: target.id } });
  }

  /** Historique à conserver : on efface les données personnelles et on ne garde qu'une ligne anonyme. */
  private async anonymize(tx: Prisma.TransactionClient, target: PurgeTarget, now: Date): Promise<void> {
    const userId = target.id;
    const driverId = target.driverProfile?.id;
    const vehicles = driverId ? await tx.vehicle.findMany({ where: { driverId }, select: { id: true } }) : [];
    await this.deletePersonalData(tx, target, vehicles.map((vehicle) => vehicle.id));

    // Les véhicules restent (des trajets s'y rattachent) mais ne portent plus la plaque ni la photo.
    for (const vehicle of vehicles) {
      await tx.vehicle.update({
        where: { id: vehicle.id },
        data: { plateNumber: `supprime-${vehicle.id}`, photoUrl: null, deletedAt: now },
      });
    }
    // Ce que la personne a écrit ou localisé.
    await tx.message.updateMany({ where: { senderId: userId }, data: { content: ANONYMIZED_MESSAGE } });
    await tx.review.updateMany({ where: { rating: { fromUserId: userId } }, data: { comment: null } });
    await tx.sosAlert.updateMany({ where: { userId }, data: { latitude: null, longitude: null, message: null } });
    await tx.userReport.updateMany({ where: { reporterId: userId }, data: { details: null } });

    if (target.customerProfile) {
      await tx.customerProfile.update({
        where: { id: target.customerProfile.id },
        data: { firstName: ANONYMOUS_FIRST_NAME, lastName: ANONYMOUS_LAST_NAME, photoUrl: null, dateOfBirth: null, address: null, deletedAt: now },
      });
    }
    if (driverId) {
      await tx.driverProfile.update({
        where: { id: driverId },
        data: {
          firstName: ANONYMOUS_FIRST_NAME,
          lastName: ANONYMOUS_LAST_NAME,
          photoUrl: null,
          dateOfBirth: null,
          mobileMoneyNumber: null,
          bankAccountRef: null,
          deletedAt: now,
        },
      });
    }
    await tx.user.update({
      where: { id: userId },
      data: {
        // Le numéro redevient libre : la personne pourra s'inscrire de nouveau. « deleted- » ne ressemble à aucun vrai numéro.
        phone: `deleted-${userId}`,
        email: null,
        passwordHash: null,
        twoFactorSecret: null,
        isTwoFactorEnabled: false,
        isPhoneVerified: false,
        isEmailVerified: false,
        referralCode: null,
        lastLoginAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        suspendedReason: null,
        isActive: false,
        deletedAt: now,
      },
    });
  }
}
