// backend/src/account-purge/suspended-account-purge.service.spec.ts
// Comptes suspendus depuis 6 mois : rappels mensuels par e-mail (seulement avec une adresse), puis suppression définitive — complète s'il
// n'y a aucun historique, anonymisation sinon — avec les garde-fous (équipe, service en cours, solde, litige).
// [20/10/2026] Comptes supprimés par leur titulaire : mêmes effacements 30 jours après la demande (SELF_DELETE).
import { AccountType, Prisma } from '@prisma/client';
import {
  ANONYMOUS_FIRST_NAME,
  SuspendedAccountPurgeService,
  addMonths,
  buildSuspensionReminder,
  dueSuspensionReminder,
  monthsElapsed,
  purgeDueAt,
  storageKeyFromPublicUrl,
  suspensionNoticeKind,
} from './suspended-account-purge.service';
import { suspensionStart } from '../common/utils/suspension';

const NOW = new Date('2026-10-20T10:00:00Z');
const at = (iso: string) => new Date(iso);

describe('règles pures', () => {
  it('addMonths : ne déborde jamais sur le mois suivant', () => {
    expect(addMonths(at('2026-08-31T10:00:00Z'), 6).toISOString()).toBe('2027-02-28T10:00:00.000Z');
    expect(addMonths(at('2026-01-31T10:00:00Z'), 1).toISOString()).toBe('2026-02-28T10:00:00.000Z');
    expect(addMonths(at('2026-10-20T10:00:00Z'), -6).toISOString()).toBe('2026-04-20T10:00:00.000Z');
    expect(addMonths(at('2026-11-15T08:30:00Z'), 3).toISOString()).toBe('2027-02-15T08:30:00.000Z');
  });

  it('monthsElapsed compte les mois entiers', () => {
    expect(monthsElapsed(at('2026-09-20T10:00:01Z'), NOW)).toBe(0);
    expect(monthsElapsed(at('2026-09-20T10:00:00Z'), NOW)).toBe(1);
    expect(monthsElapsed(at('2026-05-20T10:00:00Z'), NOW)).toBe(5);
    expect(monthsElapsed(at('2026-04-20T10:00:00Z'), NOW)).toBe(6);
    expect(monthsElapsed(at('2027-01-01T00:00:00Z'), NOW)).toBe(0); // date future : jamais négatif
  });

  it('un rappel par mois, du 1er au 5e ; aucun avant un mois ni à partir de 6 mois', () => {
    expect(dueSuspensionReminder(at('2026-10-01T00:00:00Z'), NOW)).toBe(0);
    expect(dueSuspensionReminder(at('2026-09-20T10:00:00Z'), NOW)).toBe(1);
    expect(dueSuspensionReminder(at('2026-08-01T00:00:00Z'), NOW)).toBe(2);
    expect(dueSuspensionReminder(at('2026-05-20T10:00:00Z'), NOW)).toBe(5);
    expect(dueSuspensionReminder(at('2026-04-20T10:00:00Z'), NOW)).toBe(0);
  });

  it('la suppression est due 6 mois après le début de la suspension', () => {
    expect(purgeDueAt(at('2026-04-20T10:00:00Z')).toISOString()).toBe('2026-10-20T10:00:00.000Z');
  });

  it('une nouvelle suspension repart de zéro (autre « kind »)', () => {
    expect(suspensionNoticeKind(at('2026-04-20T10:00:00Z'))).toBe('SUSPENSION_NOTICE:2026-04-20');
    expect(suspensionNoticeKind(at('2026-07-02T10:00:00Z'))).not.toBe(suspensionNoticeKind(at('2026-04-20T10:00:00Z')));
  });

  it('le texte donne la date de suppression et invite à contacter l\'administration', () => {
    const texts = buildSuspensionReminder({ suspendedAt: at('2026-08-20T10:00:00Z'), now: NOW, sequence: 2 });
    expect(texts.title).toBe('Votre compte Occa\'Z est suspendu');
    expect(texts.body).toContain('suspendu depuis le 20 août 2026');
    expect(texts.body).toContain('administration');
    expect(texts.body).toContain('avant le 20 février 2027');
    expect(texts.body).toContain('définitivement supprimés');
  });

  it('le 5e rappel est annoncé comme le dernier', () => {
    const texts = buildSuspensionReminder({ suspendedAt: at('2026-05-20T10:00:00Z'), now: NOW, sequence: 5 });
    expect(texts.title).toContain('Dernier rappel');
    expect(texts.body.startsWith('Dernier rappel.')).toBe(true);
    expect(texts.body).toContain('dans 31 jours');
  });

  it('storageKeyFromPublicUrl retrouve la clé d\'une URL publique, pas celle d\'une autre origine', () => {
    expect(storageKeyFromPublicUrl('https://cdn.occaz.sarl/driver-avatar/d1/a.jpg', 'https://cdn.occaz.sarl/')).toBe('driver-avatar/d1/a.jpg');
    expect(storageKeyFromPublicUrl('https://autre.site/driver-avatar/d1/a.jpg', 'https://cdn.occaz.sarl')).toBeNull();
    expect(storageKeyFromPublicUrl(null, 'https://cdn.occaz.sarl')).toBeNull();
    expect(storageKeyFromPublicUrl('https://cdn.occaz.sarl/x.jpg', undefined)).toBeNull();
  });

  it('suspensionStart garde la date d\'origine d\'un compte déjà suspendu', () => {
    const original = at('2026-04-20T10:00:00Z');
    expect(suspensionStart({ isSuspended: true, suspendedAt: original }, NOW)).toBe(original);
    expect(suspensionStart({ isSuspended: false, suspendedAt: null }, NOW)).toBe(NOW);
    expect(suspensionStart({ isSuspended: true, suspendedAt: null }, NOW)).toBe(NOW);
    expect(suspensionStart(null, NOW)).toBe(NOW);
  });
});

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

function knownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: 'x' });
}

const COUNT_MODELS = [
  'booking', 'shipment', 'trip', 'dispute', 'payout', 'rating', 'disputeMessage', 'disputeResolution', 'message', 'referral', 'sosAlert',
  'userReport', 'auditLog', 'walletTransaction', 'conversation', 'promoCodeRedemption', 'shipmentInvitation',
] as const;
const TX_MODELS = [
  'onboardingReminderLog', 'tripReminderLog', 'notification', 'savedLocation', 'emergencyContact', 'userBlock', 'cookieConsent',
  'phoneChangeRequest', 'otpCode', 'session', 'device', 'userRole', 'verification', 'document', 'savedCard', 'wallet', 'message', 'review',
  'sosAlert', 'userReport', 'auditLog',
] as const;

interface Options {
  /** Comptes renvoyés à la requête des rappels. */
  reminderUsers?: Array<{ id: string; suspendedAt: Date | null }>;
  /** Comptes renvoyés à la requête de suppression. */
  purgeUsers?: Array<{ id: string }>;
  /** Fiche rechargée juste avant de supprimer. */
  target?: Record<string, unknown> | null;
  /** Nombre de lignes par modèle (booking: 1, …), 0 par défaut. */
  counts?: Partial<Record<(typeof COUNT_MODELS)[number], number>>;
  wallet?: { balance: bigint; pendingBalance: bigint } | null;
  settings?: Record<string, unknown>;
  claimed?: Set<string>;
  /** Comptes désactivés renvoyés à la requête des comptes supprimés par leur titulaire. */
  selfDeletedUsers?: Array<{ id: string }>;
  /** Demandes de suppression (journal d'audit SELF_DELETE) renvoyées pour ces comptes. */
  selfDeleteRequests?: Array<{ entityId: string }>;
  /** Date de la dernière demande de suppression relue par purgeOne ; null = aucune. */
  selfDeleteRequestedAt?: Date | null;
  /** Erreur levée par la première suppression complète. */
  hardDeleteError?: Error;
}

function build(options: Options = {}) {
  const claimed = options.claimed ?? new Set<string>();
  let reminderPageServed = false;
  let purgePageServed = false;
  let selfDeletePageServed = false;

  const tx: Record<string, Record<string, jest.Mock>> = {};
  for (const name of TX_MODELS) tx[name] = { deleteMany: jest.fn().mockResolvedValue({ count: 0 }), updateMany: jest.fn().mockResolvedValue({ count: 0 }) };
  tx.customerProfile = { delete: jest.fn(), update: jest.fn() };
  tx.driverProfile = { delete: jest.fn(), update: jest.fn() };
  tx.vehicle = { findMany: jest.fn().mockResolvedValue([{ id: 'v1' }]), deleteMany: jest.fn(), update: jest.fn() };
  tx.wallet = { deleteMany: jest.fn() };
  tx.user = { delete: jest.fn(), update: jest.fn() };
  if (options.hardDeleteError) tx.user.delete.mockRejectedValueOnce(options.hardDeleteError);

  const prisma: Record<string, unknown> = {
    platformSetting: {
      findUnique: jest.fn(async ({ where }: { where: { key: string } }) =>
        where.key in (options.settings ?? {}) ? { value: (options.settings ?? {})[where.key] } : null,
      ),
    },
    user: {
      findMany: jest.fn(async ({ where }: { where: { email?: unknown } }) => {
        if (where.email) {
          if (reminderPageServed) return [];
          reminderPageServed = true;
          return options.reminderUsers ?? [];
        }
        if ((where as { isActive?: boolean }).isActive === false) {
          if (selfDeletePageServed) return [];
          selfDeletePageServed = true;
          return options.selfDeletedUsers ?? [];
        }
        if (purgePageServed) return [];
        purgePageServed = true;
        return options.purgeUsers ?? [];
      }),
      findUnique: jest.fn().mockResolvedValue(options.target === undefined ? null : options.target),
    },
    onboardingReminderLog: {
      create: jest.fn(async ({ data }: { data: { userId: string; kind: string; sequence: number } }) => {
        const key = `${data.userId}:${data.kind}:${data.sequence}`;
        if (claimed.has(key)) throw knownError('P2002');
        claimed.add(key);
        return data;
      }),
    },
    wallet: { findUnique: jest.fn().mockResolvedValue(options.wallet ?? null) },
    vehicle: { findMany: jest.fn().mockResolvedValue([{ id: 'v1', photoUrl: null }]) },
    document: { findMany: jest.fn().mockResolvedValue([{ storageKey: 'driver/dp1/cni.jpg' }]) },
    $transaction: jest.fn(async (fn: (client: unknown) => Promise<unknown>) => fn(tx)),
  };
  for (const name of COUNT_MODELS) prisma[name] = { count: jest.fn().mockResolvedValue(options.counts?.[name] ?? 0) };
  prisma.auditLog = {
    count: jest.fn().mockResolvedValue(options.counts?.auditLog ?? 0),
    findMany: jest.fn().mockResolvedValue(options.selfDeleteRequests ?? []),
    findFirst: jest.fn().mockResolvedValue(options.selfDeleteRequestedAt ? { createdAt: options.selfDeleteRequestedAt } : null),
  };

  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const storage = { deleteObject: jest.fn().mockResolvedValue(undefined) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new SuspendedAccountPurgeService(prisma as never, notifications as never, storage as never, audit as never);
  return { service, prisma, tx, notifications, storage, audit, claimed };
}

const target = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  accountType: AccountType.DRIVER,
  isSuspended: true,
  suspendedAt: at('2026-04-01T10:00:00Z'),
  deletedAt: null,
  customerProfile: null,
  driverProfile: { id: 'dp1', photoUrl: null },
  ...over,
});

describe('SuspendedAccountPurgeService — rappels mensuels', () => {
  it('envoie un e-mail (et seulement un e-mail) à un compte suspendu depuis un mois', async () => {
    const { service, notifications, prisma } = build({ reminderUsers: [{ id: 'u1', suspendedAt: at('2026-09-20T10:00:00Z') }] });
    const result = await service.runOnce(NOW, true);
    expect(result.reminders).toBe(1);
    const call = notifications.notify.mock.calls[0][0];
    expect(call.userId).toBe('u1');
    expect(call.channels).toEqual(['EMAIL']);
    expect(call.fallbackBody).toContain('administration');
    // Pas d'adresse e-mail = pas de rappel : la requête ne sélectionne que les comptes qui en ont une, et jamais un compte d'équipe.
    const where = (prisma.user as { findMany: jest.Mock }).findMany.mock.calls.find(([arg]) => arg.where.email)?.[0].where;
    expect(where.email).toEqual({ not: null });
    expect(where.accountType).toEqual({ in: ['CUSTOMER', 'DRIVER'] });
    expect(where.isSuspended).toBe(true);
  });

  it('le même rappel n\'est jamais envoyé deux fois ; le mois suivant, oui', async () => {
    const claimed = new Set<string>();
    const suspendedAt = at('2026-08-20T10:00:00Z');
    await build({ reminderUsers: [{ id: 'u1', suspendedAt }], claimed }).service.runOnce(NOW, true);
    const again = build({ reminderUsers: [{ id: 'u1', suspendedAt }], claimed });
    expect((await again.service.runOnce(NOW, true)).reminders).toBe(0);
    expect(again.notifications.notify).not.toHaveBeenCalled();
    const nextMonth = build({ reminderUsers: [{ id: 'u1', suspendedAt }], claimed });
    expect((await nextMonth.service.runOnce(at('2026-11-20T10:00:00Z'), true)).reminders).toBe(1);
  });

  it('aucun rappel avant un mois, ni une fois les 6 mois écoulés', async () => {
    const { service, notifications } = build({
      reminderUsers: [
        { id: 'u1', suspendedAt: at('2026-10-01T10:00:00Z') },
        { id: 'u2', suspendedAt: at('2026-04-01T10:00:00Z') },
        { id: 'u3', suspendedAt: null },
      ],
    });
    expect((await service.runOnce(NOW, true)).reminders).toBe(0);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('une nouvelle suspension (autre date) reçoit de nouveau ses rappels', async () => {
    const claimed = new Set<string>();
    await build({ reminderUsers: [{ id: 'u1', suspendedAt: at('2026-08-20T10:00:00Z') }], claimed }).service.runOnce(NOW, true);
    const reSuspended = build({ reminderUsers: [{ id: 'u1', suspendedAt: at('2026-09-20T10:00:00Z') }], claimed });
    expect((await reSuspended.service.runOnce(NOW, true)).reminders).toBe(1);
  });

  it('interrupteur : rien ne part ni ne disparaît quand le traitement est désactivé', async () => {
    const { service, notifications, tx } = build({
      reminderUsers: [{ id: 'u1', suspendedAt: at('2026-09-20T10:00:00Z') }],
      purgeUsers: [{ id: 'u2' }],
      settings: { 'jobs.suspended_purge_enabled': false },
    });
    expect(await service.runOnce(NOW, true)).toEqual({ reminders: 0, deleted: 0, anonymized: 0, skipped: 0, failed: 0 });
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(tx.user.delete).not.toHaveBeenCalled();
  });
});

describe('SuspendedAccountPurgeService — suppression', () => {
  it('sans historique : le compte et ses données sont supprimés pour de bon, fichiers compris', async () => {
    const { service, tx, storage, audit } = build({ purgeUsers: [{ id: 'u1' }], target: target() });
    const result = await service.runOnce(NOW, true);
    expect(result).toMatchObject({ deleted: 1, anonymized: 0, skipped: 0, failed: 0 });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(tx.driverProfile.delete).toHaveBeenCalledWith({ where: { id: 'dp1' } });
    expect(tx.vehicle.deleteMany).toHaveBeenCalled();
    expect(tx.wallet.deleteMany).toHaveBeenCalled();
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(storage.deleteObject).toHaveBeenCalledWith('driver/dp1/cni.jpg');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'u1', action: 'PURGE_DELETED' }));
    // Le journal ne contient aucune donnée personnelle.
    expect(JSON.stringify(audit.log.mock.calls[0][0])).not.toMatch(/phone|email|@/);
  });

  it('avec un historique : données personnelles effacées, ligne anonyme conservée, numéro libéré', async () => {
    const { service, tx, audit } = build({ purgeUsers: [{ id: 'u1' }], target: target(), counts: { rating: 3 } });
    const result = await service.runOnce(NOW, true);
    expect(result).toMatchObject({ deleted: 0, anonymized: 1 });
    expect(tx.user.delete).not.toHaveBeenCalled();
    const userUpdate = tx.user.update.mock.calls[0][0];
    expect(userUpdate.where).toEqual({ id: 'u1' });
    expect(userUpdate.data).toMatchObject({ phone: 'deleted-u1', email: null, passwordHash: null, twoFactorSecret: null, isActive: false });
    expect(userUpdate.data.deletedAt).toBe(NOW);
    expect(tx.driverProfile.update.mock.calls[0][0].data).toMatchObject({
      firstName: ANONYMOUS_FIRST_NAME,
      photoUrl: null,
      dateOfBirth: null,
      mobileMoneyNumber: null,
      bankAccountRef: null,
    });
    expect(tx.vehicle.update.mock.calls[0][0].data.plateNumber).toBe('supprime-v1');
    expect(tx.message.updateMany).toHaveBeenCalledWith({ where: { senderId: 'u1' }, data: { content: '[message supprimé]' } });
    expect(tx.document.deleteMany).toHaveBeenCalled();
    expect(tx.savedCard.deleteMany).not.toHaveBeenCalled(); // pas de profil client
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PURGE_ANONYMIZED' }));
  });

  it('un client : cartes enregistrées supprimées, profil client anonymisé', async () => {
    const { service, tx } = build({
      purgeUsers: [{ id: 'u1' }],
      target: target({ accountType: AccountType.CUSTOMER, driverProfile: null, customerProfile: { id: 'cp1', photoUrl: null } }),
      counts: { conversation: 2 },
    });
    await service.runOnce(NOW, true);
    expect(tx.savedCard.deleteMany).toHaveBeenCalledWith({ where: { customerId: 'cp1' } });
    expect(tx.customerProfile.update.mock.calls[0][0].data).toMatchObject({ lastName: 'supprimé', address: null });
    expect(tx.driverProfile.update).not.toHaveBeenCalled();
  });

  it('suppression complète impossible (clé étrangère) : repli sur l\'anonymisation', async () => {
    const { service, tx, prisma } = build({ purgeUsers: [{ id: 'u1' }], target: target(), hardDeleteError: knownError('P2003') });
    const result = await service.runOnce(NOW, true);
    expect(result).toMatchObject({ deleted: 0, anonymized: 1, failed: 0 });
    expect((prisma.$transaction as jest.Mock).mock.calls).toHaveLength(2);
    expect(tx.user.update).toHaveBeenCalled();
  });

  it('toute autre erreur de la base n\'est pas masquée : le compte est compté en échec, rien n\'est anonymisé', async () => {
    const { service, tx } = build({ purgeUsers: [{ id: 'u1' }], target: target(), hardDeleteError: knownError('P1001') });
    const result = await service.runOnce(NOW, true);
    expect(result).toMatchObject({ deleted: 0, anonymized: 0, failed: 1 });
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it.each([
    ['réservation en cours', { booking: 1 }, null],
    ['envoi en cours', { shipment: 1 }, null],
    ['trajet en cours', { trip: 1 }, null],
    ['litige ouvert', { dispute: 1 }, null],
    ['retrait en cours', { payout: 1 }, null],
    ['solde de portefeuille', {}, { balance: BigInt(5000), pendingBalance: BigInt(0) }],
    ['solde en attente', {}, { balance: BigInt(0), pendingBalance: BigInt(1) }],
  ])('%s : le compte est laissé tel quel', async (_label, counts, wallet) => {
    // Un compte à deux profils (client et conducteur) : toutes les situations en cours sont vérifiées.
    const bothProfiles = target({ customerProfile: { id: 'cp1', photoUrl: null } });
    const { service, tx, prisma, storage } = build({ purgeUsers: [{ id: 'u1' }], target: bothProfiles, counts, wallet });
    const result = await service.runOnce(NOW, true);
    expect(result).toMatchObject({ deleted: 0, anonymized: 0, skipped: 1 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.user.delete).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('jamais un compte d\'équipe, même suspendu depuis longtemps', async () => {
    for (const accountType of [AccountType.SUPPORT, AccountType.SUPERADMIN]) {
      const { service, prisma } = build({ purgeUsers: [{ id: 'u1' }], target: target({ accountType }) });
      expect(await service.purgeOne('u1', NOW)).toBe('skipped');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    }
  });

  it('pas avant 6 mois, pas si la suspension a été levée entre-temps, pas si déjà supprimé', async () => {
    const early = build({ target: target({ suspendedAt: at('2026-04-21T10:00:00Z') }) });
    expect(await early.service.purgeOne('u1', NOW)).toBe('skipped');
    const lifted = build({ target: target({ isSuspended: false, suspendedAt: null }) });
    expect(await lifted.service.purgeOne('u1', NOW)).toBe('skipped');
    const already = build({ target: target({ deletedAt: at('2026-10-01T00:00:00Z') }) });
    expect(await already.service.purgeOne('u1', NOW)).toBe('skipped');
    const missing = build({ target: null });
    expect(await missing.service.purgeOne('u1', NOW)).toBe('skipped');
    for (const run of [early, lifted, already, missing]) expect(run.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('la requête ne cible que les clients et conducteurs suspendus depuis plus de 6 mois et pas encore supprimés', async () => {
    const { service, prisma } = build({});
    await service.runOnce(NOW, true);
    const where = (prisma.user as { findMany: jest.Mock }).findMany.mock.calls.find(([arg]) => !arg.where.email)?.[0].where;
    expect(where.isSuspended).toBe(true);
    expect(where.deletedAt).toBeNull();
    expect(where.accountType).toEqual({ in: ['CUSTOMER', 'DRIVER'] });
    expect(where.suspendedAt.not).toBeNull();
    expect(where.suspendedAt.lte.toISOString()).toBe('2026-04-20T10:00:00.000Z');
  });
});

describe('SuspendedAccountPurgeService — comptes supprimés par leur titulaire', () => {
  const selfDeleted = (over: Record<string, unknown> = {}) => target({ isSuspended: false, suspendedAt: null, ...over });

  it('30 jours après la demande : données effacées, motif de départ effacé du journal, audit sans donnée personnelle', async () => {
    const { service, tx, audit } = build({
      selfDeletedUsers: [{ id: 'u1' }],
      selfDeleteRequests: [{ entityId: 'u1' }],
      selfDeleteRequestedAt: at('2026-09-20T10:00:00Z'),
      target: selfDeleted(),
      // Le journal compte déjà la demande faite par le titulaire lui-même : le compte est donc anonymisé, pas supprimé.
      counts: { auditLog: 1 },
    });
    const result = await service.runOnce(NOW, true);
    expect(result).toMatchObject({ deleted: 0, anonymized: 1, skipped: 0, failed: 0 });
    expect(tx.user.update.mock.calls[0][0].data).toMatchObject({ phone: 'deleted-u1', email: null, isActive: false });
    expect(tx.auditLog.updateMany).toHaveBeenCalledWith({
      where: { entityType: 'User', entityId: 'u1', action: 'SELF_DELETE' },
      data: { diff: Prisma.DbNull },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'u1', action: 'PURGE_ANONYMIZED', diff: { accountType: 'DRIVER', reason: 'SELF_DELETE_30_DAYS' } }),
    );
  });

  it('une demande de moins de 30 jours n\'est jamais traitée', async () => {
    const { service, prisma } = build({
      selfDeletedUsers: [{ id: 'u1' }],
      selfDeleteRequests: [{ entityId: 'u1' }],
      selfDeleteRequestedAt: at('2026-09-21T10:00:00Z'),
      target: selfDeleted(),
    });
    const result = await service.runOnce(NOW, true);
    expect(result).toMatchObject({ deleted: 0, anonymized: 0, skipped: 1 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('compte réactivé entre-temps, déjà effacé, ou sans demande de suppression : rien n\'est fait', async () => {
    const reactivated = build({ target: selfDeleted(), selfDeleteRequestedAt: at('2026-01-01T00:00:00Z') });
    (reactivated.prisma.user as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce({ isActive: true });
    expect(await reactivated.service.purgeOne('u1', NOW, 'SELF_DELETE')).toBe('skipped');

    const noRequest = build({ target: selfDeleted(), selfDeleteRequestedAt: null });
    (noRequest.prisma.user as { findUnique: jest.Mock }).findUnique
      .mockResolvedValueOnce(selfDeleted())
      .mockResolvedValueOnce({ isActive: false });
    expect(await noRequest.service.purgeOne('u1', NOW, 'SELF_DELETE')).toBe('skipped');

    const already = build({ target: selfDeleted({ deletedAt: at('2026-10-01T00:00:00Z') }) });
    expect(await already.service.purgeOne('u1', NOW, 'SELF_DELETE')).toBe('skipped');
    for (const run of [reactivated, noRequest, already]) expect(run.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('même garde-fou que pour une suspension : solde de portefeuille non nul = compte laissé tel quel', async () => {
    const { service, prisma } = build({
      selfDeletedUsers: [{ id: 'u1' }],
      selfDeleteRequests: [{ entityId: 'u1' }],
      selfDeleteRequestedAt: at('2026-09-01T10:00:00Z'),
      target: selfDeleted(),
      wallet: { balance: BigInt(2000), pendingBalance: BigInt(0) },
    });
    const result = await service.runOnce(NOW, true);
    expect(result).toMatchObject({ anonymized: 0, deleted: 0, skipped: 1 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('la requête ne cible que les clients et conducteurs désactivés et pas encore effacés', async () => {
    const { service, prisma } = build({});
    await service.runOnce(NOW, true);
    const where = (prisma.user as { findMany: jest.Mock }).findMany.mock.calls.find(([arg]) => arg.where.isActive === false)?.[0].where;
    expect(where.deletedAt).toBeNull();
    expect(where.accountType).toEqual({ in: ['CUSTOMER', 'DRIVER'] });
  });
});
