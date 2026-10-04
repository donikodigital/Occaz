// backend/src/trips/bookings.service.seats.spec.ts
// Réutilisation des sièges : une place prise de Conakry à Kindia est de nouveau libre de Kindia à Labé.
import { BadRequestException, ConflictException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

const DEPARTURE = new Date('2026-10-10T06:00:00.000Z');
const TOTAL_SEATS = 4;

const trip = {
  id: 'trip1',
  pricePerSeat: 100_000n,
  currencyId: 'cur1',
  status: 'PUBLISHED',
  totalSeats: TOTAL_SEATS,
  originCity: { countryId: 'country-1' },
  departureAt: DEPARTURE,
  originCityId: 'conakry',
  originLocationId: 'loc-a',
  destinationCityId: 'labe',
  destinationLocationId: 'loc-b',
  stops: [
    { id: 's-kindia', sequence: 1, cityId: 'kindia', locationId: 'loc-k', fareFromOrigin: 35_000n, distanceFromOriginKm: 135, estimatedArrivalAt: new Date('2026-10-10T08:00:00.000Z'), isBookable: true },
    { id: 's-mamou', sequence: 2, cityId: 'mamou', locationId: 'loc-m', fareFromOrigin: 65_000n, distanceFromOriginKm: 270, estimatedArrivalAt: new Date('2026-10-10T10:00:00.000Z'), isBookable: true },
  ],
};

type Hold = { seatsCount: number; boardingStopId: string | null; alightingStopId: string | null };
const hold = (seatsCount: number, boardingStopId: string | null, alightingStopId: string | null): Hold => ({ seatsCount, boardingStopId, alightingStopId });

function build(options: { holds?: Hold[]; lockedStatus?: string | null } = {}) {
  const holds = options.holds ?? [];
  const created: Hold[] = [];
  const tx = {
    $queryRaw: jest
      .fn()
      .mockResolvedValue(options.lockedStatus === null ? [] : [{ status: options.lockedStatus ?? 'PUBLISHED', totalSeats: TOTAL_SEATS }]),
    booking: {
      create: jest.fn().mockImplementation(({ data }) => {
        created.push({ seatsCount: data.seatsCount, boardingStopId: data.boardingStopId, alightingStopId: data.alightingStopId });
        return Promise.resolve({ id: 'b1', ...data });
      }),
      findUnique: jest.fn().mockResolvedValue({ id: 'b1' }),
      // 1er appel : réservations déjà là (contrôle) ; appels suivants : celles-ci + la nouvelle (recalcul du compteur)
      findMany: jest.fn().mockImplementation(() => Promise.resolve([...holds, ...created])),
    },
    trip: { findUnique: jest.fn().mockResolvedValue(trip), update: jest.fn().mockResolvedValue({}) },
    tripPassenger: { createMany: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    trip: { findUnique: jest.fn().mockResolvedValue(trip) },
    customerProfile: { findUnique: jest.fn().mockResolvedValue({ firstName: 'A', lastName: 'B' }) },
    $transaction: jest.fn().mockImplementation((callback: (client: unknown) => unknown) => callback(tx)),
  };
  const pricing = {
    computeCommission: jest.fn().mockImplementation(({ baseAmount }: { baseAmount: bigint }) => Promise.resolve((baseAmount * 15n) / 100n)),
    getNumericSetting: jest.fn().mockImplementation((_key: string, fallback: number) => Promise.resolve(fallback)),
  };
  const service = new BookingsService(
    prisma as never, pricing as never, { emit: jest.fn() } as never,
    { resolveForCheckout: jest.fn(), redeem: jest.fn() } as never,
    { notify: jest.fn().mockResolvedValue(undefined) } as never,
  );
  return { service, tx, created };
}

const names = (n: number) => Array.from({ length: n }, (_, i) => ({ fullName: `Passager ${i + 1}` }));
const book = (service: BookingsService, seats: number, extra: Record<string, unknown> = {}) =>
  service.create('c1', { tripId: 'trip1', seatsCount: seats, ...(seats > 1 ? { passengers: names(seats) } : {}), ...extra } as never);
const lastCounter = (tx: ReturnType<typeof build>['tx']) => tx.trip.update.mock.calls.at(-1)?.[0].data.availableSeats;

describe('BookingsService.create — places par tronçon', () => {
  it('Conakry → Kindia complet : un client de Kindia → Labé réserve quand même (le siège est revendu)', async () => {
    const { service, tx, created } = build({ holds: [hold(4, null, 's-kindia')] });
    await expect(book(service, 1, { boardingStopId: 's-kindia' })).resolves.toBeDefined();
    expect(created).toHaveLength(1);
    // 4 occupées sur le 1er tronçon, 1 sur les deux suivants : le plus chargé laisse 0 place sur le trajet entier
    expect(lastCounter(tx)).toBe(0);
  });

  it('le trajet entier est refusé quand un tronçon est plein, même si les autres sont libres', async () => {
    const { service, tx } = build({ holds: [hold(4, 's-kindia', 's-mamou')] });
    await expect(book(service, 1)).rejects.toThrow(/sur ce trajet/);
    await expect(book(service, 1)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it('Kindia → Labé est refusé quand Kindia → Mamou est plein, avec un message sur le tronçon', async () => {
    const { service } = build({ holds: [hold(4, 's-kindia', 's-mamou')] });
    await expect(book(service, 1, { boardingStopId: 's-kindia' })).rejects.toThrow(/sur ce tronçon/);
  });

  it('un tronçon qui ne chevauche pas le tronçon plein reste réservable (Conakry → Kindia, Mamou → Labé)', async () => {
    const { service } = build({ holds: [hold(4, 's-kindia', 's-mamou')] });
    await expect(book(service, 2, { alightingStopId: 's-kindia' })).resolves.toBeDefined();
    const second = build({ holds: [hold(4, 's-kindia', 's-mamou')] });
    await expect(book(second.service, 2, { boardingStopId: 's-mamou' })).resolves.toBeDefined();
  });

  it('refuse plus de places qu\'il n\'en reste sur le tronçon le plus chargé', async () => {
    // 3 places prises de Kindia à Mamou : il en reste 1 pour un client qui traverse ce tronçon
    const { service } = build({ holds: [hold(3, 's-kindia', 's-mamou')] });
    await expect(book(service, 2, { boardingStopId: 's-kindia' })).rejects.toBeInstanceOf(ConflictException);
    const ok = build({ holds: [hold(3, 's-kindia', 's-mamou')] });
    await expect(book(ok.service, 1, { boardingStopId: 's-kindia' })).resolves.toBeDefined();
  });

  it('un siège revendu trois fois sur la route : le 4e client trouve toutes les places prises', async () => {
    // 4 sièges × 3 tronçons : les trois premiers tronçons sont pleins chacun par un groupe différent
    const holds = [hold(4, null, 's-kindia'), hold(4, 's-kindia', 's-mamou'), hold(4, 's-mamou', null)];
    const { service } = build({ holds });
    await expect(book(service, 1)).rejects.toBeInstanceOf(ConflictException);
    await expect(book(service, 1, { boardingStopId: 's-kindia', alightingStopId: 's-mamou' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('sans étapes : le comportement d\'avant (compteur = places − réservées)', async () => {
    const { service, tx } = build({ holds: [hold(3, null, null)] });
    await expect(book(service, 2)).rejects.toBeInstanceOf(ConflictException); // 4 − 3 = 1 libre < 2
    await expect(book(service, 1)).resolves.toBeDefined();
    expect(lastCounter(tx)).toBe(0);
  });

  it('relit le statut sous verrou : un trajet annulé entre-temps ne reçoit aucune réservation', async () => {
    const { service, tx } = build({ lockedStatus: 'CANCELLED' });
    await expect(book(service, 1)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.booking.create).not.toHaveBeenCalled();
    expect(tx.trip.update).not.toHaveBeenCalled();
  });

  it('trajet introuvable sous verrou : refusé', async () => {
    const { service } = build({ lockedStatus: null });
    await expect(book(service, 1)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('verrouille le trajet avant de lire les places (deux clients ne passent pas en même temps)', async () => {
    const { service, tx } = build();
    await book(service, 1);
    const lockOrder = tx.$queryRaw.mock.invocationCallOrder[0];
    const readOrder = tx.booking.findMany.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(readOrder);
    expect(String(tx.$queryRaw.mock.calls[0][0])).toContain('FOR UPDATE');
  });
});

describe('BookingsService.cancel — libère les places du tronçon', () => {
  function cancelBuild(remaining: Hold[]) {
    const booking = {
      id: 'b1', customerId: 'c1', tripId: 'trip1', seatsCount: 4, status: 'CONFIRMED',
      boardingStopId: null, alightingStopId: 's-kindia',
      trip: { driver: { user: { phone: '+224' } } }, customer: { user: { phone: '+224' } },
      boardingStop: null, alightingStop: { city: { name: 'Kindia' } },
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ status: 'PUBLISHED', totalSeats: TOTAL_SEATS }]),
      booking: { update: jest.fn().mockResolvedValue({ id: 'b1' }), findMany: jest.fn().mockResolvedValue(remaining) },
      trip: { update: jest.fn(), findUnique: jest.fn().mockResolvedValue(trip) },
    };
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue(booking) },
      trip: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'trip1', departureAt: new Date(Date.now() + 5 * 86_400_000), originCity: { countryId: 'country-1', name: 'Conakry' },
          destinationCity: { name: 'Labé' }, driver: { userId: 'u-driver' },
        }),
      },
      $transaction: jest.fn().mockImplementation((callback: (client: unknown) => unknown) => callback(tx)),
    };
    const pricing = { getCancellationPolicy: jest.fn().mockResolvedValue(null) };
    const service = new BookingsService(prisma as never, pricing as never, { emit: jest.fn() } as never, {} as never, { notify: jest.fn() } as never);
    return { service, tx };
  }

  it('recalcule le compteur sur les réservations restantes au lieu d\'ajouter les places à l\'aveugle', async () => {
    // la réservation annulée (4 places Conakry → Kindia) disparaît ; il reste 2 places Kindia → Labé
    const { service, tx } = cancelBuild([hold(2, 's-kindia', null)]);
    await service.cancel('b1', 'c1', 'Imprévu');
    expect(tx.trip.update).toHaveBeenCalledWith({ where: { id: 'trip1' }, data: { availableSeats: 2 } });
  });

  it('annuler deux fois donne le même compteur (plus de dérive possible)', async () => {
    const first = cancelBuild([]);
    await first.service.cancel('b1', 'c1', 'Imprévu');
    const second = cancelBuild([]);
    await second.service.cancel('b1', 'c1', 'Imprévu');
    expect(first.tx.trip.update.mock.calls[0][0].data).toEqual(second.tx.trip.update.mock.calls[0][0].data);
    expect(first.tx.trip.update.mock.calls[0][0].data).toEqual({ availableSeats: TOTAL_SEATS });
  });
});
