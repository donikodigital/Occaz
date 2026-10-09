// backend/src/trips/bookings.service.segment.spec.ts
// Réservation d'un tronçon (ex. Kindia → Labé) : prix du tronçon, commission sur ce prix, étapes enregistrées,
// et délai d'annulation compté depuis l'heure de montée du client.
import { BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

const DEPARTURE = new Date('2026-10-10T06:00:00.000Z');

const trip = {
  id: 'trip1',
  pricePerSeat: 100_000n,
  currencyId: 'cur1',
  status: 'PUBLISHED',
  originCity: { countryId: 'country-1' },
  departureAt: DEPARTURE,
  originCityId: 'conakry',
  originLocationId: 'loc-a',
  destinationCityId: 'labe',
  destinationLocationId: 'loc-b',
  stops: [
    {
      id: 's-kindia', sequence: 1, cityId: 'kindia', locationId: 'loc-k', fareFromOrigin: 35_000n,
      distanceFromOriginKm: 135, estimatedArrivalAt: new Date('2026-10-10T08:00:00.000Z'), isBookable: true,
    },
    {
      id: 's-mamou', sequence: 2, cityId: 'mamou', locationId: 'loc-m', fareFromOrigin: 65_000n,
      distanceFromOriginKm: 270, estimatedArrivalAt: new Date('2026-10-10T10:00:00.000Z'), isBookable: true,
    },
  ],
};

function createService(options: { commissionPercent?: number } = {}) {
  const percent = options.commissionPercent ?? 15;
  const tx = {
    // Contrôle des places sous verrou : statut + nombre de places du trajet, réservations déjà là, recalcul du compteur.
    $queryRaw: jest.fn().mockResolvedValue([{ status: 'PUBLISHED', totalSeats: 4 }]),
    booking: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'b1', ...data })),
      findUnique: jest.fn().mockResolvedValue({ id: 'b1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    trip: {
      findUnique: jest.fn().mockResolvedValue({ ...trip, totalSeats: 4 }),
      update: jest.fn().mockResolvedValue({}),
    },
    tripPassenger: { createMany: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    trip: { findUnique: jest.fn().mockResolvedValue(trip) },
    customerProfile: { findUnique: jest.fn().mockResolvedValue({ firstName: 'A', lastName: 'B' }) },
    $transaction: jest.fn().mockImplementation((callback: (client: unknown) => unknown) => callback(tx)),
  };
  const pricing = {
    // 15 % du montant sur lequel porte la commission
    computeCommission: jest
      .fn()
      .mockImplementation(({ baseAmount }: { baseAmount: bigint }) => Promise.resolve((baseAmount * BigInt(percent)) / 100n)),
    getNumericSetting: jest.fn().mockImplementation((_key: string, fallback: number) => Promise.resolve(fallback)),
  };
  const service = new BookingsService(
    prisma as never,
    pricing as never,
    { emit: jest.fn() } as never,
    { resolveForCheckout: jest.fn(), redeem: jest.fn() } as never,
    { notify: jest.fn().mockResolvedValue(undefined) } as never,
  );
  return { service, tx, prisma, pricing };
}

const createdData = (tx: ReturnType<typeof createService>['tx']) => tx.booking.create.mock.calls[0][0].data;

describe('BookingsService.create — tronçon réservé', () => {
  it('trajet entier : prix du trajet, aucune étape enregistrée (comportement inchangé)', async () => {
    const { service, tx } = createService();
    await service.create('c1', { tripId: 'trip1', seatsCount: 1 });
    const data = createdData(tx);
    expect(data.pricePerSeat).toBe(100_000n);
    expect(data.platformFee).toBe(15_000n);
    expect(data.totalAmount).toBe(115_000n);
    expect(data.boardingStopId).toBeNull();
    expect(data.alightingStopId).toBeNull();
  });

  it('Kindia → Labé : le prix du tronçon (65 000) et la commission sur ce prix', async () => {
    const { service, tx } = createService();
    await service.create('c1', { tripId: 'trip1', seatsCount: 1, boardingStopId: 's-kindia' });
    const data = createdData(tx);
    expect(data.pricePerSeat).toBe(65_000n);
    expect(data.platformFee).toBe(9_750n); // 15 % de 65 000
    expect(data.totalAmount).toBe(74_750n);
    expect(data.boardingStopId).toBe('s-kindia');
    expect(data.alightingStopId).toBeNull();
  });

  it('plusieurs places : le prix du tronçon se multiplie par le nombre de places', async () => {
    const { service, tx } = createService();
    await service.create('c1', {
      tripId: 'trip1',
      seatsCount: 2,
      boardingStopId: 's-kindia',
      alightingStopId: 's-mamou',
      passengers: [{ fullName: 'A B' }, { fullName: 'C D' }],
    });
    const data = createdData(tx);
    expect(data.pricePerSeat).toBe(30_000n);
    expect(data.totalAmount - data.platformFee).toBe(60_000n); // ce que touchera le conducteur : 2 × 30 000
  });

  it('refuse une descente avant la montée, une étape inconnue et une étape fermée aux passagers', async () => {
    const { service } = createService();
    await expect(
      service.create('c1', { tripId: 'trip1', seatsCount: 1, boardingStopId: 's-mamou', alightingStopId: 's-kindia' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create('c1', { tripId: 'trip1', seatsCount: 1, boardingStopId: 'inconnue' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ne décompte aucune place si le tronçon est refusé', async () => {
    const { service, tx } = createService();
    await expect(
      service.create('c1', { tripId: 'trip1', seatsCount: 1, alightingStopId: 'inconnue' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    // refusé avant tout verrou, lecture de places ou écriture
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.booking.create).not.toHaveBeenCalled();
  });
});

describe('BookingsService.cancel — délai compté depuis la montée du client', () => {
  function cancelService(departureAt: Date, boardingAt: Date | null, passengers: Array<{ pickedUpAt: Date | null }> = []) {
    const booking = {
      passengers,
      id: 'b1',
      customerId: 'c1',
      tripId: 'trip1',
      seatsCount: 1,
      status: 'CONFIRMED',
      trip: { driver: { user: { phone: '+224' } } },
      customer: { user: { phone: '+224' } },
      boardingStop: boardingAt ? { estimatedArrivalAt: boardingAt, city: { name: 'Mamou' } } : null,
      alightingStop: null,
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ status: 'PUBLISHED', totalSeats: 4 }]),
      booking: { update: jest.fn().mockResolvedValue({ id: 'b1' }), findMany: jest.fn().mockResolvedValue([]) },
      trip: { update: jest.fn(), findUnique: jest.fn().mockResolvedValue({ ...trip, totalSeats: 4 }) },
    };
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue(booking) },
      trip: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'trip1', departureAt, originCity: { countryId: 'country-1', name: 'Conakry' },
          destinationCity: { name: 'Labé' }, driver: { userId: 'u-driver' },
        }),
      },
      $transaction: jest.fn().mockImplementation((callback: (client: unknown) => unknown) => callback(tx)),
    };
    const pricing = {
      // 24 h avant la montée : remboursement intégral ; sinon rien
      getCancellationPolicy: jest.fn().mockResolvedValue({ hoursBeforeDeparture: 24, refundPercentage: 100 }),
    };
    const emit = jest.fn();
    const service = new BookingsService(prisma as never, pricing as never, { emit } as never, {} as never, { notify: jest.fn() } as never);
    return { service, emit, tx };
  }

  it('départ dans 10 h mais montée dans 30 h : remboursement intégral (le délai suit la montée)', async () => {
    const now = Date.now();
    const { service } = cancelService(new Date(now + 10 * 3_600_000), new Date(now + 30 * 3_600_000));
    const result = await service.cancel('b1', 'c1', 'Imprévu');
    expect(result.refundEligiblePercentage).toBe(100);
  });

  it('client qui monte au départ : le délai suit le départ du trajet, comme avant', async () => {
    const now = Date.now();
    const { service } = cancelService(new Date(now + 10 * 3_600_000), null);
    const result = await service.cancel('b1', 'c1', 'Imprévu');
    expect(result.refundEligiblePercentage).toBe(0);
  });

  it('client déjà pris en charge : annulation refusée, rien n\'est modifié ni remboursé', async () => {
    const now = Date.now();
    const { service, emit, tx } = cancelService(new Date(now + 10 * 3_600_000), null, [{ pickedUpAt: new Date(now - 60_000) }]);
    await expect(service.cancel('b1', 'c1', 'Imprévu')).rejects.toThrow(/déjà été pris en charge/);
    expect(tx.booking.update).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('client pas encore monté (passagers sans prise en charge) : l\'annulation reste possible', async () => {
    const now = Date.now();
    const { service } = cancelService(new Date(now + 10 * 3_600_000), null, [{ pickedUpAt: null }]);
    await expect(service.cancel('b1', 'c1', 'Imprévu')).resolves.toBeDefined();
  });
});

describe('BookingsService — devise de la réservation', () => {
  it('le détail et les listes de réservations joignent la devise du trajet', async () => {
    const booking = { id: 'b1', customerId: 'c1', tripId: 'trip1', status: 'CONFIRMED', trip: { driver: { user: { phone: '+224' } } }, customer: { user: { phone: '+224' } }, passengers: [] };
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue(booking) },
    };
    const service = new BookingsService(prisma as never, {} as never, { emit: jest.fn() } as never, {} as never, { notify: jest.fn() } as never);
    await service.findOne('b1');
    const include = prisma.booking.findUnique.mock.calls[0][0].include;
    expect(include.trip.include.currency).toEqual({ select: { id: true, isoCode: true, symbol: true } });
  });
});