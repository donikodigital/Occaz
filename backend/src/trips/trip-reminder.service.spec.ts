// backend/src/trips/trip-reminder.service.spec.ts
import { Prisma } from '@prisma/client';
import {
  TripReminderService,
  buildReminderTexts,
  formatClock,
  formatDay,
  formatDelay,
  reminderKindFor,
} from './trip-reminder.service';

const HOUR = 3_600_000;
const TZ = 'Africa/Conakry'; // UTC+0, sans heure d'été : les heures du test sont lisibles telles quelles.
const NOW = new Date('2026-10-12T10:00:00Z');

describe('reminderKindFor', () => {
  it.each([
    [-1, null],
    [0, null],
    [30 * 60_000, 'SOON'],
    [3 * HOUR, 'SOON'],
    [3 * HOUR + 1, 'EARLY'],
    [24 * HOUR, 'EARLY'],
    [24 * HOUR + 1, null],
  ])('%d ms avant le départ -> %s', (ms, expected) => {
    expect(reminderKindFor(ms)).toBe(expected);
  });
});

describe('formatDelay / formatDay / formatClock', () => {
  it.each([
    [45 * 60_000, '45 min'],
    [60 * 60_000, '1 h'],
    [135 * 60_000, '2 h 15'],
    [125 * 60_000, '2 h 05'],
    [10_000, '1 min'],
  ])('formatDelay(%d) = %s', (ms, expected) => {
    expect(formatDelay(ms)).toBe(expected);
  });

  it('dit aujourd’hui, demain, ou la date', () => {
    expect(formatDay(new Date('2026-10-12T18:00:00Z'), NOW, TZ)).toBe('aujourd’hui');
    expect(formatDay(new Date('2026-10-13T06:00:00Z'), NOW, TZ)).toBe('demain');
    expect(formatDay(new Date('2026-10-15T06:00:00Z'), NOW, TZ)).toBe('le 15 octobre');
  });

  it('écrit l’heure à la française', () => {
    expect(formatClock(new Date('2026-10-12T14:30:00Z'), TZ)).toBe('14 h 30');
  });

  it('tient compte du fuseau : minuit UTC+2 est encore « aujourd’hui » à 23 h UTC', () => {
    const now = new Date('2026-10-12T22:30:00Z'); // 00 h 30 le 13 en UTC+2
    expect(formatDay(new Date('2026-10-13T06:00:00Z'), now, 'Europe/Paris')).toBe('aujourd’hui');
  });
});

describe('buildReminderTexts', () => {
  const base = { origin: 'Conakry', destination: 'Labé', departureAt: new Date('2026-10-13T08:30:00Z'), now: NOW, timeZone: TZ };

  it('passager, la veille : date, heure et trajet', () => {
    const texts = buildReminderTexts({ ...base, role: 'passenger', kind: 'EARLY', confirmedBookings: 0 });
    expect(texts.body).toBe('Votre trajet Conakry → Labé part demain à 08 h 30. Soyez au point de rendez-vous quelques minutes avant.');
  });

  it('passager, dernières heures : temps restant', () => {
    const departureAt = new Date(NOW.getTime() + 90 * 60_000);
    const texts = buildReminderTexts({ ...base, departureAt, role: 'passenger', kind: 'SOON', confirmedBookings: 0 });
    expect(texts.title).toBe('Votre départ approche');
    expect(texts.body).toContain('part dans 1 h 30');
  });

  it('conducteur : le nombre de réservations, au pluriel quand il faut', () => {
    expect(buildReminderTexts({ ...base, role: 'driver', kind: 'EARLY', confirmedBookings: 0 }).body).toContain('Aucune réservation pour le moment.');
    expect(buildReminderTexts({ ...base, role: 'driver', kind: 'EARLY', confirmedBookings: 1 }).body).toContain('1 réservation confirmée.');
    expect(buildReminderTexts({ ...base, role: 'driver', kind: 'EARLY', confirmedBookings: 3 }).body).toContain('3 réservations confirmées.');
  });
});

// ---------------------------------------------------------------------------

function trip(id: string, departureInMs: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    departureAt: new Date(NOW.getTime() + departureInMs),
    originCity: { name: 'Conakry' },
    destinationCity: { name: 'Labé' },
    driver: { userId: `driver-${id}` },
    bookings: [{ id: `b-${id}`, customer: { userId: `cust-${id}` } }],
    ...extra,
  };
}

function build(options: { trips?: unknown[]; logged?: { tripId: string; userId: string; kind: string }[]; setting?: number; claimConflicts?: Set<string> } = {}) {
  const claimed: string[] = [];
  const prisma = {
    trip: { findMany: jest.fn().mockResolvedValueOnce(options.trips ?? []).mockResolvedValue([]) },
    tripReminderLog: {
      findMany: jest.fn().mockResolvedValue(options.logged ?? []),
      create: jest.fn().mockImplementation(({ data }: { data: { tripId: string; userId: string; kind: string } }) => {
        const key = `${data.tripId}:${data.userId}:${data.kind}`;
        if (options.claimConflicts?.has(key)) {
          return Promise.reject(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }));
        }
        claimed.push(key);
        return Promise.resolve({});
      }),
    },
  };
  const pricing = { getNumericSetting: jest.fn().mockResolvedValue(options.setting ?? 1) };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new TripReminderService(prisma as never, pricing as never, notifications as never);
  return { service, prisma, pricing, notifications, claimed };
}

describe('TripReminderService.runOnce', () => {
  it('envoie un rappel au conducteur et à chaque passager, avec le bon type', async () => {
    const { service, notifications, claimed } = build({ trips: [trip('t1', 2 * HOUR), trip('t2', 10 * HOUR)] });
    const { sent } = await service.runOnce(NOW);

    expect(sent).toBe(4);
    expect(claimed).toEqual(['t1:driver-t1:SOON', 't1:cust-t1:SOON', 't2:driver-t2:EARLY', 't2:cust-t2:EARLY']);
    const call = notifications.notify.mock.calls.find(([params]: [{ userId: string }]) => params.userId === 'cust-t1')![0];
    expect(call).toMatchObject({ type: 'DEPARTURE_IMMINENT', pushData: { type: 'DEPARTURE_IMMINENT', tripId: 't1', bookingId: 'b-t1' } });
  });

  it('n’envoie rien à ceux qui ont déjà reçu ce rappel', async () => {
    const { service, notifications } = build({
      trips: [trip('t1', 2 * HOUR)],
      logged: [{ tripId: 't1', userId: 'driver-t1', kind: 'SOON' }],
    });
    const { sent } = await service.runOnce(NOW);
    expect(sent).toBe(1);
    expect(notifications.notify.mock.calls.map(([params]: [{ userId: string }]) => params.userId)).toEqual(['cust-t1']);
  });

  it('un autre exemplaire du serveur a pris le rappel en premier : pas de doublon', async () => {
    const { service, notifications } = build({
      trips: [trip('t1', 2 * HOUR)],
      claimConflicts: new Set(['t1:driver-t1:SOON', 't1:cust-t1:SOON']),
    });
    const { sent } = await service.runOnce(NOW);
    expect(sent).toBe(0);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('un échec de notification ne bloque pas les suivants', async () => {
    const { service, notifications } = build({ trips: [trip('t1', 2 * HOUR)] });
    notifications.notify.mockRejectedValueOnce(new Error('push down'));
    const { sent } = await service.runOnce(NOW);
    expect(sent).toBe(1);
    expect(notifications.notify).toHaveBeenCalledTimes(2);
  });

  it('ne fait rien quand l’interrupteur d’administration est coupé', async () => {
    const { service, prisma, pricing } = build({ trips: [trip('t1', 2 * HOUR)], setting: 0 });
    await expect(service.runOnce(NOW)).resolves.toEqual({ sent: 0 });
    expect(pricing.getNumericSetting).toHaveBeenCalledWith('jobs.trip_reminders_enabled', 1);
    expect(prisma.trip.findMany).not.toHaveBeenCalled();
  });

  it('ne cherche que les trajets publiés qui partent dans les 24 prochaines heures', async () => {
    const { service, prisma } = build();
    await service.runOnce(NOW);
    const where = prisma.trip.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('PUBLISHED');
    expect(where.departureAt).toEqual({ gt: NOW, lte: new Date(NOW.getTime() + 24 * HOUR) });
    expect(where.deletedAt).toBeNull();
  });
});
