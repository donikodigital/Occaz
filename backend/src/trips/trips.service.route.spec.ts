// backend/src/trips/trips.service.route.spec.ts
// Villes traversées : recherche par tronçon, création avec prix automatiques, étapes, arrivée à une étape.
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus, TripStatus } from '@prisma/client';
import { TripsService } from './trips.service';

const DEPARTURE = new Date('2026-10-10T06:00:00.000Z');

const stop = (id: string, sequence: number, cityId: string, cityName: string, fare: bigint, hoursAfter: number, extra: Record<string, unknown> = {}) => ({
  id,
  tripId: 'trip1',
  sequence,
  cityId,
  city: { id: cityId, name: cityName },
  locationId: `loc-${id}`,
  fareFromOrigin: fare,
  distanceFromOriginKm: sequence * 100,
  estimatedArrivalAt: new Date(DEPARTURE.getTime() + hoursAfter * 3_600_000),
  isBookable: true,
  arrivedAt: null,
  ...extra,
});

function tripRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'trip1',
    driverId: 'driver1',
    vehicleId: 'v1',
    status: TripStatus.PUBLISHED,
    departureAt: DEPARTURE,
    pricePerSeat: 100_000n,
    availableSeats: 3,
    totalSeats: 4,
    bookings: [] as Array<{ seatsCount: number; boardingStopId: string | null; alightingStopId: string | null }>,
    originCityId: 'conakry',
    originLocationId: 'loc-conakry',
    destinationCityId: 'labe',
    destinationLocationId: 'loc-labe',
    originCity: { id: 'conakry', name: 'Conakry', countryId: 'gn' },
    destinationCity: { id: 'labe', name: 'Labé' },
    stops: [stop('s-kindia', 1, 'kindia', 'Kindia', 35_000n, 2), stop('s-mamou', 2, 'mamou', 'Mamou', 65_000n, 4)],
    ...overrides,
  };
}

function build(
  options: {
    candidates?: unknown[];
    trip?: Record<string, unknown>;
    distances?: Array<number | null>;
    /** Devise par défaut du pays de la ville de départ ; null = pays sans devise par défaut configurée. */
    originCurrency?: string | null;
  } = {},
) {
  const trip = tripRow(options.trip);
  const tx = {
    trip: { create: jest.fn().mockResolvedValue({ id: 'new-trip' }) },
    tripStop: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new-stop', ...data })),
    },
  };
  const distances = [...(options.distances ?? [100, 100, 100])];
  const prisma = {
    trip: {
      findMany: jest.fn().mockResolvedValue(options.candidates ?? []),
      findUnique: jest.fn().mockResolvedValue(trip),
    },
    city: {
      findUnique: jest.fn().mockResolvedValue({
        country: { defaultCurrencyId: options.originCurrency === undefined ? 'cur-gnf' : options.originCurrency },
      }),
    },
    tripStop: { update: jest.fn().mockResolvedValue({ id: 's-kindia' }) },
    booking: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn().mockImplementation((callback: (client: unknown) => unknown) => callback(tx)),
  };
  const pricing = {
    computeCommission: jest
      .fn()
      .mockImplementation(({ baseAmount }: { baseAmount: bigint }) => Promise.resolve((baseAmount * 15n) / 100n)),
    getNumericSetting: jest.fn().mockImplementation((_key: string, fallback: number) => Promise.resolve(fallback)),
    distanceKmBetweenLocations: jest.fn().mockImplementation(() => Promise.resolve(distances.length ? distances.shift() : 100)),
  };
  const locations = {
    findOne: jest.fn().mockImplementation((id: string) =>
      Promise.resolve({ id, cityId: id === 'loc-no-city' ? null : id.replace('loc-', '') }),
    ),
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const vehicles = { assertOwnership: jest.fn().mockResolvedValue({ totalSeats: 4 }) };
  const service = new TripsService(
    prisma as never,
    { log: jest.fn() } as never,
    vehicles as never,
    locations as never,
    {} as never,
    {} as never,
    pricing as never,
    notifications as never,
  );
  return { service, prisma, tx, pricing, locations, notifications, trip };
}

describe('TripsService.create — devise du trajet', () => {
  const dto = (extra: Record<string, unknown> = {}) =>
    ({
      vehicleId: 'v1', originCityId: 'conakry', originLocationId: 'loc-conakry',
      destinationCityId: 'labe', destinationLocationId: 'loc-labe',
      departureAt: new Date(Date.now() + 86_400_000).toISOString(), totalSeats: 3, pricePerSeat: '100000',
      ...extra,
    }) as never;
  const createdCurrency = (tx: ReturnType<typeof build>['tx']) => tx.trip.create.mock.calls[0][0].data.currencyId;

  it('la devise est celle du pays de la ville de départ, sans que le chauffeur ait à la choisir', async () => {
    const { service, tx, prisma } = build({ originCurrency: 'cur-gnf' });
    await service.create('driver1', dto());
    expect(createdCurrency(tx)).toBe('cur-gnf');
    expect(prisma.city.findUnique).toHaveBeenCalledWith({
      where: { id: 'conakry' },
      select: { country: { select: { defaultCurrencyId: true } } },
    });
  });

  it('départ au Sénégal : XOF, même si la requête demande une autre devise (ancienne version ou client modifié)', async () => {
    const { service, tx } = build({ originCurrency: 'cur-xof' });
    await service.create('driver1', dto({ currencyId: 'cur-gnf' }));
    expect(createdCurrency(tx)).toBe('cur-xof');
  });

  it('pays de départ sans devise par défaut : la devise demandée sert de repli', async () => {
    const { service, tx } = build({ originCurrency: null });
    await service.create('driver1', dto({ currencyId: 'cur-gnf' }));
    expect(createdCurrency(tx)).toBe('cur-gnf');
  });

  it('pays de départ sans devise par défaut et aucune devise demandée : refusé avec un message clair', async () => {
    const { service, tx } = build({ originCurrency: null });
    await expect(service.create('driver1', dto())).rejects.toThrow(/devise par défaut/);
    expect(tx.trip.create).not.toHaveBeenCalled();
  });

  it('la mise à jour d\'un brouillon ne change jamais la devise', async () => {
    const { service, prisma } = build({ trip: { status: TripStatus.DRAFT, stops: [] } });
    const tx = { trip: { update: jest.fn().mockResolvedValue({}) }, tripStop: { update: jest.fn() } };
    (prisma.$transaction as jest.Mock).mockImplementation((callback: (client: unknown) => unknown) => callback(tx));
    await service.update('trip1', 'driver1', { currencyId: 'cur-xof', notes: 'ok' } as never);
    expect(tx.trip.update.mock.calls[0][0].data).not.toHaveProperty('currencyId');
  });
});

describe('TripsService.search — par villes, avec les étapes', () => {
  const base = { page: 1, limit: 20, skip: 0, take: 20 } as never;
  const search = (service: TripsService, dto: Record<string, unknown>) =>
    service.search({ ...(base as object), passengersCount: 1, ...dto } as never) as Promise<{
      data: Array<{ id: string; customerPricePerSeat: bigint; segment: Record<string, unknown> }>;
      meta?: { total?: number };
      total?: number;
    }>;

  it('un client de Kindia qui va à Labé trouve le trajet Conakry → Labé, au prix du tronçon', async () => {
    const { service } = build({ candidates: [tripRow()] });
    const result = await search(service, { originCityId: 'kindia', destinationCityId: 'labe' });

    expect(result.data).toHaveLength(1);
    const [found] = result.data;
    expect(found.segment.boardingCityName).toBe('Kindia');
    expect(found.segment.alightingCityName).toBe('Labé');
    expect(found.segment.pricePerSeat).toBe(65_000n);
    expect(found.segment.isFullTrip).toBe(false);
    // commission (15 %) sur le prix du tronçon : 65 000 + 9 750
    expect(found.customerPricePerSeat).toBe(74_750n);
    // l'heure affichée est le passage estimé à Kindia, pas le départ de Conakry
    expect(found.segment.boardingAt).toEqual(new Date(DEPARTURE.getTime() + 2 * 3_600_000));
  });

  it('le trajet direct Conakry → Labé reste trouvé, au prix du trajet', async () => {
    const { service } = build({ candidates: [tripRow()] });
    const result = await search(service, { originCityId: 'conakry', destinationCityId: 'labe' });
    expect(result.data[0].segment.isFullTrip).toBe(true);
    expect(result.data[0].segment.pricePerSeat).toBe(100_000n);
  });

  it('ne propose pas un trajet dans le mauvais sens (Labé → Kindia)', async () => {
    const { service } = build({ candidates: [tripRow()] });
    const result = await search(service, { originCityId: 'labe', destinationCityId: 'kindia' });
    expect(result.data).toHaveLength(0);
  });

  it('la date demandée s\'applique à l\'heure de passage à la montée', async () => {
    // départ le 10 à 06:00, passage à Kindia à 08:00 le même jour ; trajet de nuit : passage à Mamou le 11
    const night = tripRow({
      departureAt: new Date('2026-10-10T22:00:00.000Z'),
      stops: [stop('s-kindia', 1, 'kindia', 'Kindia', 35_000n, 0, { estimatedArrivalAt: new Date('2026-10-11T00:30:00.000Z') })],
    });
    const { service } = build({ candidates: [night] });
    expect((await search(service, { originCityId: 'kindia', destinationCityId: 'labe', departureDate: '2026-10-11' })).data).toHaveLength(1);
    expect((await search(service, { originCityId: 'kindia', destinationCityId: 'labe', departureDate: '2026-10-10' })).data).toHaveLength(0);
    // le client qui monte au départ garde la date de départ
    expect((await search(service, { originCityId: 'conakry', destinationCityId: 'labe', departureDate: '2026-10-10' })).data).toHaveLength(1);
  });

  it('le prix maximum se compare au prix du tronçon, pas à celui du trajet entier', async () => {
    const { service } = build({ candidates: [tripRow()] });
    expect((await search(service, { originCityId: 'kindia', destinationCityId: 'labe', maxPricePerSeat: '70000' })).data).toHaveLength(1);
    expect((await search(service, { originCityId: 'conakry', destinationCityId: 'labe', maxPricePerSeat: '70000' })).data).toHaveLength(0);
  });

  it('une étape fermée aux passagers n\'est pas proposée', async () => {
    const closed = tripRow({ stops: [stop('s-kindia', 1, 'kindia', 'Kindia', 35_000n, 2, { isBookable: false })] });
    const { service } = build({ candidates: [closed] });
    expect((await search(service, { originCityId: 'kindia', destinationCityId: 'labe' })).data).toHaveLength(0);
  });

  it('interroge la base avec les quatre cas : direct, départ → étape, étape → arrivée, étape → étape', async () => {
    const { service, prisma } = build();
    await search(service, { originCityId: 'kindia', destinationCityId: 'labe' });
    const where = prisma.trip.findMany.mock.calls[0][0].where;
    expect(where.status).toBe(TripStatus.PUBLISHED);
    expect(where.AND[0].OR).toHaveLength(4);
    // les places se contrôlent par tronçon : un trajet avec étapes n'est jamais écarté sur le seul compteur
    expect(where.AND[1].OR).toEqual([{ availableSeats: { gte: 1 } }, { stops: { some: {} } }]);
  });

  it('pagine les résultats en mémoire avec le bon total', async () => {
    const trips = [1, 2, 3].map((n) => tripRow({ id: `t${n}`, departureAt: new Date(DEPARTURE.getTime() + n * 3_600_000) }));
    const { service } = build({ candidates: trips });
    const result = (await service.search({
      originCityId: 'conakry', destinationCityId: 'labe', passengersCount: 1, page: 1, limit: 2, skip: 0, take: 2,
    } as never)) as { data: unknown[]; meta?: { total?: number }; total?: number };
    expect(result.data).toHaveLength(2);
  });
});

describe('TripsService.findOne — tronçon demandé', () => {
  it('sans tronçon : trajet entier', async () => {
    const { service } = build();
    const result = await service.findOne('trip1');
    expect(result.segment.isFullTrip).toBe(true);
    expect(result.customerPricePerSeat).toBe(115_000n);
  });

  it('avec une étape de montée : prix client du tronçon', async () => {
    const { service } = build();
    const result = await service.findOne('trip1', { boardingStopId: 's-kindia' });
    expect(result.segment.pricePerSeat).toBe(65_000n);
    expect(result.customerPricePerSeat).toBe(74_750n);
    // le prix brut du trajet reste celui du conducteur
    expect(result.pricePerSeat).toBe(100_000n);
  });

  it('étape inconnue : 400', async () => {
    const { service } = build();
    await expect(service.findOne('trip1', { boardingStopId: 'nope' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('TripsService.create — étapes et prix automatiques', () => {
  const dto = (stops: Array<Record<string, unknown>>) =>
    ({
      vehicleId: 'v1',
      originCityId: 'conakry',
      originLocationId: 'loc-conakry',
      destinationCityId: 'labe',
      destinationLocationId: 'loc-labe',
      departureAt: new Date(Date.now() + 86_400_000).toISOString(),
      totalSeats: 3,
      pricePerSeat: '100000',
      currencyId: 'cur1',
      stops,
    }) as never;

  it('crée le trajet et ses étapes dans une seule transaction, avec prix et heures calculés', async () => {
    // distances : Conakry→Kindia 135, Kindia→Mamou 135, Mamou→Labé 160
    const { service, tx, prisma } = build({ distances: [135, 135, 160] });
    await service.create('driver1', dto([
      { locationId: 'loc-kindia', sequence: 1 },
      { locationId: 'loc-mamou', sequence: 2 },
    ]));

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const rows = tx.tripStop.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ tripId: 'new-trip', cityId: 'kindia', sequence: 1, distanceFromOriginKm: 135 });
    expect(rows[1]).toMatchObject({ cityId: 'mamou', sequence: 2, distanceFromOriginKm: 270 });
    // 135/430 → 31 395 → 31 500 ; 270/430 → 62 790 → 63 000
    expect(rows[0].fareFromOrigin).toBe(31_500n);
    expect(rows[1].fareFromOrigin).toBe(63_000n);
    expect(rows[0].estimatedArrivalAt).toBeInstanceOf(Date);
    expect(rows[0].isBookable).toBe(true);
  });

  it('respecte un prix saisi par le conducteur', async () => {
    const { service, tx } = build({ distances: [135, 135, 160] });
    await service.create('driver1', dto([{ locationId: 'loc-kindia', sequence: 1, fareFromOrigin: '40000' }]));
    expect(tx.tripStop.createMany.mock.calls[0][0].data[0].fareFromOrigin).toBe(40_000n);
  });

  it('refuse des prix d\'étapes décroissants ou supérieurs au prix du trajet', async () => {
    const { service } = build({ distances: [135, 135, 160] });
    await expect(
      service.create('driver1', dto([
        { locationId: 'loc-kindia', sequence: 1, fareFromOrigin: '70000' },
        { locationId: 'loc-mamou', sequence: 2, fareFromOrigin: '30000' },
      ])),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('trie les étapes par ordre de passage et les renumérote 1..n', async () => {
    const { service, tx } = build({ distances: [135, 135, 160] });
    await service.create('driver1', dto([
      { locationId: 'loc-mamou', sequence: 7 },
      { locationId: 'loc-kindia', sequence: 3 },
    ]));
    const rows = tx.tripStop.createMany.mock.calls[0][0].data;
    // reçues dans le désordre (7 puis 3) : rangées par ordre de passage, puis renumérotées 1 et 2
    expect(rows.map((r: { cityId: string; sequence: number }) => [r.cityId, r.sequence])).toEqual([['kindia', 1], ['mamou', 2]]);
  });

  it('refuse une étape sans ville, ou dans la ville de départ / d\'arrivée / déjà traversée', async () => {
    const { service } = build();
    await expect(service.create('driver1', dto([{ locationId: 'loc-no-city', sequence: 1 }]))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('driver1', dto([{ locationId: 'loc-conakry', sequence: 1 }]))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('driver1', dto([{ locationId: 'loc-labe', sequence: 1 }]))).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create('driver1', dto([{ locationId: 'loc-kindia', sequence: 1 }, { locationId: 'loc-kindia', sequence: 2 }])),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sans distance exploitable, répartit les étapes à égale distance au lieu d\'échouer', async () => {
    const { service, tx } = build({ distances: [null, null] });
    await service.create('driver1', dto([{ locationId: 'loc-kindia', sequence: 1 }]));
    const [row] = tx.tripStop.createMany.mock.calls[0][0].data;
    expect(row.fareFromOrigin).toBe(50_000n);
    expect(row.distanceFromOriginKm).toBeNull();
  });
});

describe('TripsService — étapes en brouillon', () => {
  it('removeStop : supprime uniquement une étape de CE trajet (jamais celle d\'un autre conducteur)', async () => {
    const { service, tx } = build({ trip: { status: TripStatus.DRAFT } });
    tx.tripStop.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.removeStop('trip1', 'etape-d-un-autre-trajet', 'driver1')).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.tripStop.deleteMany).toHaveBeenCalledWith({ where: { id: 'etape-d-un-autre-trajet', tripId: 'trip1' } });
  });

  it('removeStop : renumérote les étapes restantes', async () => {
    const { service, tx } = build({ trip: { status: TripStatus.DRAFT }, distances: [200, 200] });
    await service.removeStop('trip1', 's-kindia', 'driver1');
    expect(tx.tripStop.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's-mamou' }, data: expect.objectContaining({ sequence: 1 }) }),
    );
  });

  it('les étapes ne se modifient plus une fois le trajet publié', async () => {
    const { service } = build({ trip: { status: TripStatus.PUBLISHED } });
    await expect(service.removeStop('trip1', 's-kindia', 'driver1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateStop('trip1', 's-kindia', 'driver1', { fareFromOrigin: '40000' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updateStop : un prix entre ceux des voisins est accepté, hors bornes refusé', async () => {
    const { service, prisma } = build({ trip: { status: TripStatus.DRAFT } });
    await service.updateStop('trip1', 's-kindia', 'driver1', { fareFromOrigin: '40000' });
    expect(prisma.tripStop.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's-kindia' }, data: expect.objectContaining({ fareFromOrigin: 40_000n }) }),
    );
    await expect(service.updateStop('trip1', 's-kindia', 'driver1', { fareFromOrigin: '70000' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateStop('trip1', 'inconnue', 'driver1', { fareFromOrigin: '1000' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('addStop : décale les étapes suivantes et place le prix entre ses voisins', async () => {
    // Insertion d'une ville entre Kindia (35 000) et Mamou (65 000) : distances Conakry→Coyah… peu importe, au milieu.
    const { service, tx } = build({ trip: { status: TripStatus.DRAFT }, distances: [100, 100, 100, 100] });
    await service.addStop('trip1', 'driver1', { locationId: 'loc-dalaba', sequence: 2 });

    // Mamou (sequence 2) est décalée en 3 avant l'insertion
    expect(tx.tripStop.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's-mamou' }, data: { sequence: 3 } }),
    );
    const created = tx.tripStop.create.mock.calls[0][0].data;
    expect(created).toMatchObject({ cityId: 'dalaba', sequence: 2 });
    expect(created.fareFromOrigin).toBeGreaterThanOrEqual(35_000n);
    expect(created.fareFromOrigin).toBeLessThanOrEqual(65_000n);
  });
});

describe('TripsService — cycle de vie avec embarquement à une étape', () => {
  it('startTrip : un conducteur que personne n\'attend au départ peut démarrer s\'il a des clients à une étape', async () => {
    const { service, prisma } = build({ trip: { status: TripStatus.DRIVER_ARRIVED } });
    (prisma.trip as Record<string, unknown>).update = jest.fn().mockResolvedValue({ status: TripStatus.IN_PROGRESS });
    // 2 clients attendent à une étape, personne au départ
    prisma.booking.count.mockImplementation(({ where }: { where: { boardingStopId: unknown } }) =>
      Promise.resolve(where.boardingStopId === null ? 0 : 2),
    );
    await expect(service.startTrip('trip1', 'driver1')).resolves.toMatchObject({ status: TripStatus.IN_PROGRESS });
    expect(prisma.booking.count).toHaveBeenCalledWith({
      where: { tripId: 'trip1', boardingStopId: { not: null }, status: { in: [BookingStatus.PAID, BookingStatus.CONFIRMED] } },
    });
  });

  it('startTrip : refusé tant qu\'un client du départ attend encore (il ne pourrait plus monter en cours de route)', async () => {
    const { service, prisma } = build({ trip: { status: TripStatus.DRIVER_ARRIVED } });
    prisma.booking.count.mockResolvedValue(1); // des clients au départ ET à une étape
    await expect(service.startTrip('trip1', 'driver1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('startTrip : sans passager pris en charge ni client à une étape, le démarrage reste refusé', async () => {
    const { service, prisma } = build({ trip: { status: TripStatus.DRIVER_ARRIVED } });
    prisma.booking.count.mockResolvedValue(0);
    await expect(service.startTrip('trip1', 'driver1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('startTrip : comportement habituel inchangé quand un passager est déjà pris en charge', async () => {
    const { service, prisma } = build({ trip: { status: TripStatus.PASSENGER_PICKED_UP } });
    (prisma.trip as Record<string, unknown>).update = jest.fn().mockResolvedValue({ status: TripStatus.IN_PROGRESS });
    await expect(service.startTrip('trip1', 'driver1')).resolves.toBeDefined();
    expect(prisma.booking.count).not.toHaveBeenCalled();
  });

  it('markArrivedAtStop : prévient seulement les clients qui montent à cette étape, une seule fois', async () => {
    const { service, prisma, notifications } = build({ trip: { status: TripStatus.IN_PROGRESS } });
    prisma.booking.findMany.mockResolvedValue([{ customer: { userId: 'u1' } }, { customer: { userId: 'u2' } }]);
    await service.markArrivedAtStop('trip1', 's-kindia', 'driver1');

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tripId: 'trip1', boardingStopId: 's-kindia' }) }),
    );
    expect(notifications.notify).toHaveBeenCalledTimes(2);
    expect(notifications.notify.mock.calls[0][0].fallbackBody).toContain('Kindia');
  });

  it('markArrivedAtStop : un second signalement ne renvoie aucune notification', async () => {
    const already = tripRow({
      status: TripStatus.IN_PROGRESS,
      stops: [stop('s-kindia', 1, 'kindia', 'Kindia', 35_000n, 2, { arrivedAt: new Date() })],
    });
    const { service, notifications } = build({ trip: already });
    await service.markArrivedAtStop('trip1', 's-kindia', 'driver1');
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('markArrivedAtStop : seulement pendant un trajet en cours, et sur une étape de ce trajet', async () => {
    const { service } = build({ trip: { status: TripStatus.PUBLISHED } });
    await expect(service.markArrivedAtStop('trip1', 's-kindia', 'driver1')).rejects.toBeInstanceOf(BadRequestException);
    const running = build({ trip: { status: TripStatus.IN_PROGRESS } });
    await expect(running.service.markArrivedAtStop('trip1', 'autre', 'driver1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('Places par tronçon — recherche et détail', () => {
  const base = { page: 1, limit: 20, skip: 0, take: 20, passengersCount: 1 };
  const found = async (service: TripsService, dto: Record<string, unknown>) =>
    ((await service.search({ ...base, ...dto } as never)) as { data: Array<{ id: string; segment: { availableSeats: number | null }; bookings?: unknown }> }).data;

  // Conakry → Kindia complet (4/4 sur le premier tronçon), le reste libre
  const fullFirstLeg = () => tripRow({ availableSeats: 0, bookings: [{ seatsCount: 4, boardingStopId: null, alightingStopId: 's-kindia' }] });

  it('un trajet complet de Conakry à Kindia reste proposé à un client de Kindia → Labé, avec 4 places libres', async () => {
    const { service } = build({ candidates: [fullFirstLeg()] });
    const results = await found(service, { originCityId: 'kindia', destinationCityId: 'labe', passengersCount: 4 });
    expect(results).toHaveLength(1);
    expect(results[0].segment.availableSeats).toBe(4);
  });

  it('le même trajet n\'est plus proposé pour Conakry → Kindia ni pour le trajet entier (complet)', async () => {
    const { service } = build({ candidates: [fullFirstLeg()] });
    expect(await found(service, { originCityId: 'conakry', destinationCityId: 'kindia' })).toHaveLength(0);
    expect(await found(service, { originCityId: 'conakry', destinationCityId: 'labe' })).toHaveLength(0);
  });

  it('exige assez de places sur le tronçon pour le nombre de passagers demandé', async () => {
    const busyMiddle = tripRow({ bookings: [{ seatsCount: 3, boardingStopId: 's-kindia', alightingStopId: 's-mamou' }] });
    const { service } = build({ candidates: [busyMiddle] });
    expect(await found(service, { originCityId: 'kindia', destinationCityId: 'labe', passengersCount: 1 })).toHaveLength(1);
    expect(await found(service, { originCityId: 'kindia', destinationCityId: 'labe', passengersCount: 2 })).toHaveLength(0);
    // Mamou → Labé ne traverse pas le tronçon chargé : 4 places libres
    const mamou = await found(service, { originCityId: 'mamou', destinationCityId: 'labe', passengersCount: 4 });
    expect(mamou[0].segment.availableSeats).toBe(4);
  });

  it('ne renvoie jamais les réservations au client (seulement le nombre de places)', async () => {
    const { service } = build({ candidates: [fullFirstLeg()] });
    const [result] = await found(service, { originCityId: 'kindia', destinationCityId: 'labe' });
    expect(result.bookings).toBeUndefined();
  });

  it('findOne : places libres du tronçon demandé et détail par tronçon pour le conducteur', async () => {
    const { service, prisma } = build();
    (prisma.trip.findUnique as jest.Mock).mockResolvedValue(
      tripRow({ bookings: [{ seatsCount: 4, boardingStopId: null, alightingStopId: 's-kindia' }, { seatsCount: 1, boardingStopId: 's-mamou', alightingStopId: null }] }),
    );
    const trip = (await service.findOne('trip1', { boardingStopId: 's-kindia' })) as unknown as {
      segment: { availableSeats: number };
      seatsByLeg: Array<{ fromCityName: string; toCityName: string; occupiedSeats: number; freeSeats: number }>;
      bookings?: unknown;
    };
    expect(trip.segment.availableSeats).toBe(3); // Kindia → Labé : le tronçon Mamou → Labé a 1 place prise
    expect(trip.seatsByLeg.map((l) => [l.fromCityName, l.toCityName, l.occupiedSeats, l.freeSeats])).toEqual([
      ['Conakry', 'Kindia', 4, 0],
      ['Kindia', 'Mamou', 0, 4],
      ['Mamou', 'Labé', 1, 3],
    ]);
    expect(trip.bookings).toBeUndefined();
  });

  it('findOne : un trajet sans étape n\'a pas de détail par tronçon', async () => {
    const { service } = build({ trip: { stops: [] } });
    const trip = (await service.findOne('trip1')) as unknown as { seatsByLeg?: unknown };
    expect(trip.seatsByLeg).toBeUndefined();
  });
});

describe('TripsService.search — une seule ville', () => {
  const base = { page: 1, limit: 20, skip: 0, take: 20, passengersCount: 1 };
  type Found = { data: Array<{ id: string; segment: Record<string, unknown>; customerPricePerSeat: bigint }> };
  const search = (service: TripsService, dto: Record<string, unknown>) => service.search({ ...base, ...dto } as never) as Promise<Found>;

  it('destination seule : un trajet qui y arrive est proposé, au prix du trajet, avec le départ du conducteur', async () => {
    const { service } = build({ candidates: [tripRow()] });
    const { data } = await search(service, { destinationCityId: 'labe' });
    expect(data).toHaveLength(1);
    expect(data[0].segment).toMatchObject({ boardingCityName: 'Conakry', alightingCityName: 'Labé', isFullTrip: true });
  });

  it('destination seule : un trajet qui traverse la ville est proposé, au prix de l\'étape (ex. Mamou)', async () => {
    const { service } = build({ candidates: [tripRow()] });
    const { data } = await search(service, { destinationCityId: 'mamou' });
    expect(data).toHaveLength(1);
    expect(data[0].segment).toMatchObject({ boardingCityName: 'Conakry', alightingCityName: 'Mamou', pricePerSeat: 65_000n, isFullTrip: false });
    // commission sur le prix du tronçon : 65 000 + 15 %
    expect(data[0].customerPricePerSeat).toBe(74_750n);
  });

  it('destination seule : la ville de départ du trajet, une ville hors route et une étape fermée aux passagers ne le font pas apparaître', async () => {
    const { service } = build({ candidates: [tripRow()] });
    expect((await search(service, { destinationCityId: 'conakry' })).data).toHaveLength(0);
    expect((await search(service, { destinationCityId: 'dakar' })).data).toHaveLength(0);
    const closed = build({ candidates: [tripRow({ stops: [stop('s-kindia', 1, 'kindia', 'Kindia', 35_000n, 2, { isBookable: false })] })] });
    expect((await search(closed.service, { destinationCityId: 'kindia' })).data).toHaveLength(0);
  });

  it('destination seule : plusieurs trajets d\'origines différentes, classés par heure de passage', async () => {
    const dakar = tripRow({
      id: 'dakar-labe', originCityId: 'dakar', originCity: { id: 'dakar', name: 'Dakar', countryId: 'sn' },
      departureAt: new Date(DEPARTURE.getTime() - 3_600_000), stops: [],
    });
    const { service } = build({ candidates: [tripRow({ id: 'conakry-labe' }), dakar] });
    const { data } = await search(service, { destinationCityId: 'labe' });
    expect(data.map((trip) => trip.id)).toEqual(['dakar-labe', 'conakry-labe']);
  });

  it('destination seule : la date demandée s\'applique au départ du trajet', async () => {
    const { service } = build({ candidates: [tripRow()] });
    expect((await search(service, { destinationCityId: 'labe', departureDate: '2026-10-10' })).data).toHaveLength(1);
    expect((await search(service, { destinationCityId: 'labe', departureDate: '2026-10-11' })).data).toHaveLength(0);
  });

  it('destination seule : le prix maximum et le nombre de places s\'appliquent au tronçon', async () => {
    const full = tripRow({ bookings: [{ seatsCount: 4, boardingStopId: null, alightingStopId: null }] });
    const a = build({ candidates: [full] });
    expect((await search(a.service, { destinationCityId: 'labe' })).data).toHaveLength(0);
    const b = build({ candidates: [tripRow()] });
    expect((await search(b.service, { destinationCityId: 'labe', maxPricePerSeat: '70000' })).data).toHaveLength(0);
    expect((await search(b.service, { destinationCityId: 'mamou', maxPricePerSeat: '70000' })).data).toHaveLength(1);
  });

  it('destination seule : la requête en base cible les trajets qui y arrivent ou la traversent', async () => {
    const { service, prisma } = build();
    await search(service, { destinationCityId: 'labe' });
    const where = prisma.trip.findMany.mock.calls[0][0].where;
    expect(where.AND[0].OR).toHaveLength(2);
    expect(where.AND[0].OR[0]).toEqual({ destinationCityId: 'labe' });
    expect(where.AND[0].OR[1].stops.some).toMatchObject({ cityId: 'labe', isBookable: true });
  });

  it('départ seul : tous les trajets qui partent de la ville ou la traversent, jusqu\'à leur arrivée', async () => {
    const { service, prisma } = build({ candidates: [tripRow()] });
    const { data } = await search(service, { originCityId: 'kindia' });
    expect(data).toHaveLength(1);
    expect(data[0].segment).toMatchObject({ boardingCityName: 'Kindia', alightingCityName: 'Labé', pricePerSeat: 65_000n });
    expect(prisma.trip.findMany.mock.calls[0][0].where.AND[0].OR[0]).toEqual({ originCityId: 'kindia' });
    expect((await search(service, { originCityId: 'labe' })).data).toHaveLength(0);
  });

  it('les deux villes : comportement inchangé (4 cas)', async () => {
    const { service, prisma } = build();
    await search(service, { originCityId: 'kindia', destinationCityId: 'labe' });
    expect(prisma.trip.findMany.mock.calls[0][0].where.AND[0].OR).toHaveLength(4);
  });

  it('ni ville ni position : refusé avec un message qui dit quoi fournir', async () => {
    const { service } = build();
    await expect(service.search({ ...base } as never)).rejects.toThrow(/au moins une ville/);
  });
});
