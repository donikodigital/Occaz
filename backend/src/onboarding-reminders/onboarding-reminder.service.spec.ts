// backend/src/onboarding-reminders/onboarding-reminder.service.spec.ts
// Rappels d'intégration : dossier conducteur tous les 2 jours tant que des pièces manquent ; adresse e-mail à renseigner (2 rappels) ;
// chaque rappel n'est envoyé qu'une fois.
import { Prisma, DriverAccountStatus } from '@prisma/client';
import {
  OnboardingReminderService,
  buildDriverDocumentsReminder,
  buildEmailAddressReminder,
  dueEmailReminder,
  reminderSequence,
} from './onboarding-reminder.service';

const DAY = 86_400_000;
const NOW = new Date('2026-10-19T12:00:00Z');
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

describe('règles pures', () => {
  it('reminderSequence compte les périodes entières écoulées', () => {
    expect(reminderSequence(ago(1.9), NOW, 2)).toBe(0);
    expect(reminderSequence(ago(2), NOW, 2)).toBe(1);
    expect(reminderSequence(ago(5), NOW, 2)).toBe(2);
    expect(reminderSequence(ago(9), NOW, 3)).toBe(3);
    expect(reminderSequence(ago(5), NOW, 0)).toBe(5); // intervalle borné à 1 jour au minimum
  });

  it('dueEmailReminder : aucun avant 1 jour, le 1er dès 1 jour, le 2e dès 5 jours', () => {
    expect([0.5, 1, 4.9, 5, 20].map(dueEmailReminder)).toEqual([0, 1, 1, 2, 2]);
  });

  it('texte du dossier : jours restants, dernier jour, délai dépassé', () => {
    const open = buildDriverDocumentsReminder({ missingLabels: ['permis de conduire', 'carte grise du véhicule'], daysLeft: 3, graceDays: 7, graceExpired: false });
    expect(open.body).toContain('Il vous reste 3 jours');
    expect(open.body).toContain('permis de conduire et carte grise du véhicule');
    expect(open.body).toContain('colis');
    expect(buildDriverDocumentsReminder({ missingLabels: ['photo de profil'], daysLeft: 1, graceDays: 7, graceExpired: false }).body).toContain('Dernier jour');
    const late = buildDriverDocumentsReminder({ missingLabels: ['photo de profil'], daysLeft: 0, graceDays: 7, graceExpired: true });
    expect(late.title).toContain('suspendue');
    expect(late.body).toContain('7 jours');
  });

  it('texte de l\'adresse e-mail : premier puis dernier rappel', () => {
    expect(buildEmailAddressReminder(1).body).toContain('Facultatif');
    expect(buildEmailAddressReminder(2).body).toContain('Dernier rappel');
  });
});

function p2002() {
  return new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' });
}

function build(options: {
  drivers?: Array<Record<string, unknown>>;
  users?: Array<Record<string, unknown>>;
  settings?: Record<string, unknown>;
  missing?: string[];
  claimed?: Set<string>;
} = {}) {
  const claimed = options.claimed ?? new Set<string>();
  const prisma = {
    platformSetting: { findUnique: jest.fn(async ({ where }: { where: { key: string } }) => (where.key in (options.settings ?? {}) ? { value: (options.settings ?? {})[where.key] } : null)) },
    driverProfile: { findMany: jest.fn().mockResolvedValueOnce(options.drivers ?? []).mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValueOnce(options.users ?? []).mockResolvedValue([]) },
    onboardingReminderLog: {
      create: jest.fn(async ({ data }: { data: { userId: string; kind: string; sequence: number } }) => {
        const key = `${data.userId}:${data.kind}:${data.sequence}`;
        if (claimed.has(key)) throw p2002();
        claimed.add(key);
        return data;
      }),
    },
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const compliance = {
    evaluateLoaded: jest.fn().mockResolvedValue({
      missing: options.missing ?? ['driver_license'],
      missingLabels: (options.missing ?? ['driver_license']).map(() => 'permis de conduire'),
      daysLeft: 4,
      graceDays: 7,
      graceExpired: false,
    }),
  };
  const service = new OnboardingReminderService(prisma as never, notifications as never, compliance as never);
  return { service, prisma, notifications, compliance, claimed };
}

const driver = (over: Record<string, unknown> = {}) => ({
  id: 'dp1', userId: 'u1', status: DriverAccountStatus.PENDING, createdAt: ago(5), photoUrl: null, vehicles: [], user: { email: null }, ...over,
});

describe('OnboardingReminderService — dossier conducteur', () => {
  it('envoie un rappel (notification) à un conducteur au dossier incomplet', async () => {
    const { service, notifications } = build({ drivers: [driver()] });
    const result = await service.runOnce(NOW, true);
    expect(result.documents).toBe(1);
    const call = notifications.notify.mock.calls[0][0];
    expect(call.userId).toBe('u1');
    expect(call.channels).toEqual(['PUSH']);
    expect(call.fallbackBody).toContain('Il vous reste 4 jours');
  });

  it('ajoute l\'e-mail quand le conducteur a renseigné son adresse', async () => {
    const { service, notifications } = build({ drivers: [driver({ user: { email: 'a@b.com' } })] });
    await service.runOnce(NOW, true);
    expect(notifications.notify.mock.calls[0][0].channels).toEqual(['PUSH', 'EMAIL']);
  });

  it('pas de rappel avant la fin de la première période', async () => {
    const { service, notifications } = build({ drivers: [driver({ createdAt: ago(1) })] });
    expect((await service.runOnce(NOW, true)).documents).toBe(0);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('dossier complet en attente d\'examen : aucun rappel', async () => {
    const { service, notifications } = build({ drivers: [driver()], missing: [] });
    expect((await service.runOnce(NOW, true)).documents).toBe(0);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('le même rappel n\'est jamais envoyé deux fois (même période), le suivant l\'est (période suivante)', async () => {
    const claimed = new Set<string>();
    const first = build({ drivers: [driver({ createdAt: ago(5) })], claimed });
    await first.service.runOnce(NOW, true);
    const again = build({ drivers: [driver({ createdAt: ago(5) })], claimed });
    expect((await again.service.runOnce(NOW, true)).documents).toBe(0);
    const later = build({ drivers: [driver({ createdAt: ago(5) })], claimed });
    expect((await later.service.runOnce(new Date(NOW.getTime() + 2 * DAY), true)).documents).toBe(1);
  });

  it('l\'intervalle se règle (réglage « driver.reminder_interval_days »)', async () => {
    const { service } = build({ drivers: [driver({ createdAt: ago(5) })], settings: { 'driver.reminder_interval_days': 5 } });
    expect((await service.runOnce(NOW, true)).documents).toBe(1);
    const tooSoon = build({ drivers: [driver({ createdAt: ago(4) })], settings: { 'driver.reminder_interval_days': 5 } });
    expect((await tooSoon.service.runOnce(NOW, true)).documents).toBe(0);
  });

  it('interrupteur : rien ne part quand les rappels sont désactivés', async () => {
    const { service, notifications } = build({ drivers: [driver()], settings: { 'jobs.onboarding_reminders_enabled': false } });
    expect(await service.runOnce(NOW, true)).toEqual({ documents: 0, emails: 0 });
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('un échec d\'envoi ne bloque pas les autres conducteurs', async () => {
    const { service, notifications } = build({ drivers: [driver({ userId: 'u1' }), driver({ id: 'dp2', userId: 'u2' })] });
    notifications.notify.mockRejectedValueOnce(new Error('boom'));
    expect((await service.runOnce(NOW, true)).documents).toBe(1);
  });
});

describe('OnboardingReminderService — adresse e-mail', () => {
  it('1er rappel à 1 jour, 2e à 5 jours', async () => {
    const one = build({ users: [{ id: 'u1', createdAt: ago(2) }] });
    expect((await one.service.runOnce(NOW, true)).emails).toBe(1);
    expect(one.claimed.has('u1:EMAIL_ADDRESS:1')).toBe(true);

    const two = build({ users: [{ id: 'u2', createdAt: ago(6) }] });
    await two.service.runOnce(NOW, true);
    expect(two.claimed.has('u2:EMAIL_ADDRESS:2')).toBe(true);
    expect(two.notifications.notify.mock.calls[0][0].fallbackBody).toContain('Dernier rappel');
  });

  it('chaque rappel d\'adresse part une seule fois', async () => {
    const claimed = new Set<string>();
    await build({ users: [{ id: 'u1', createdAt: ago(2) }], claimed }).service.runOnce(NOW, true);
    const again = build({ users: [{ id: 'u1', createdAt: ago(2) }], claimed });
    expect((await again.service.runOnce(NOW, true)).emails).toBe(0);
  });

  it('seuls les comptes sans adresse, avec un profil, ouverts depuis 1 à 30 jours sont ciblés', async () => {
    const { service, prisma } = build({ users: [] });
    await service.runOnce(NOW, true);
    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.email).toBeNull();
    expect(where.isSuspended).toBe(false);
    expect(where.OR).toHaveLength(2);
    expect(where.createdAt.gte.getTime()).toBe(NOW.getTime() - 30 * DAY);
    expect(where.createdAt.lte.getTime()).toBe(NOW.getTime() - 1 * DAY);
  });

  it('le balayage n\'est pas relancé avant une demi-heure (sans « force »)', async () => {
    const { service, prisma } = build();
    await service.runOnce(NOW);
    const calls = prisma.driverProfile.findMany.mock.calls.length;
    await service.runOnce(NOW);
    expect(prisma.driverProfile.findMany.mock.calls.length).toBe(calls);
  });
});
