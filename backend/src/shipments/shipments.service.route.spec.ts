// backend/src/shipments/shipments.service.route.spec.ts
// Colis et villes traversées : un colis Kindia → Labé se prend avec un trajet Conakry → Labé qui passe par Kindia.
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DriverAccountStatus, ShipmentStatus, TripStatus } from '@prisma/client';
import { ShipmentsService } from './shipments.service';

const DAY = 86_400_000;
const DEPARTURE = new Date(Date.now() + 2 * DAY); // départ de Conakry dans 2 jours
const KINDIA_AT = new Date(DEPARTURE.getTime() + 2 * 3_600_000); // passage à Kindia 2 h plus tard

const stop = (id: string, sequence: number, cityId: string, at: Date | null) => ({
  id, sequence, cityId, locationId: `loc-${id}`, fareFromOrigin: 35_000n, distanceFromOriginKm: sequence * 100,
  estimatedArrivalAt: at, isBookable: true,
});

const tripRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'trip1',
  driverId: 'd1',
  status: TripStatus.PUBLISHED,
  allowsShipments: true,
  availableShipmentWeightKg: null,
  departureAt: DEPARTURE,
  pricePerSeat: 100_000n,
  originCityId: 'conakry',
  originLocationId: 'loc-conakry',
  destinationCityId: 'labe',
  destinationLocationId: 'loc-labe',
  stops: [stop('s-kindia', 1, 'kindia', KINDIA_AT), stop('s-mamou', 2, 'mamou', new Date(DEPARTURE.getTime() + 4 * 3_600_000))],
  ...overrides,
});

const shipmentRow = (senderCityId: string | null, recipientCityId: string | null, windowStart: Date, windowEnd: Date, id = 's1') => ({
  id,
  status: ShipmentStatus.SEARCHING_DRIVER,
  customerId: 'c1',
  weightKg: 5,
  totalAmount: 150_000n,
  platformFee: 15_000n,
  currencyId: 'cur1',
  windowStart,
  windowEnd,
  createdAt: new Date(),
  category: { id: 'cat', name: 'Colis' },
  currency: { isoCode: 'GNF' },
  senderLocation: { id: 'l1', cityId: senderCityId, city: senderCityId ? { name: senderCityId } : null },
  recipientLocation: { id: 'l2', cityId: recipientCityId, city: recipientCityId ? { name: recipientCityId } : null },
});

function build(options: { trip?: Record<string, unknown> | null; shipment?: ReturnType<typeof shipmentRow>; candidates?: ReturnType<typeof shipmentRow>[] } = {}) {
  const tx = {
    shipment: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 's1', status: ShipmentStatus.DRIVER_ASSIGNED }),
    },
    trip: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    shipmentTracking: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    driverProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'd1', status: DriverAccountStatus.VALIDATED }) },
    shipment: {
      findUnique: jest.fn().mockResolvedValue(options.shipment ?? shipmentRow('kindia', 'labe', new Date(Date.now() - DAY), new Date(DEPARTURE.getTime() + DAY))),
      findMany: jest.fn().mockResolvedValue(options.candidates ?? []),
      count: jest.fn().mockResolvedValue(0),
    },
    trip: { findUnique: jest.fn().mockResolvedValue(options.trip === undefined ? tripRow() : options.trip) },
    customerProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'u-customer' }) },
    $transaction: jest.fn().mockImplementation((callback: (client: unknown) => unknown) => callback(tx)),
  };
  const service = new ShipmentsService(
    prisma as never, {} as never, {} as never, {} as never,
    { holdShipmentRevenue: jest.fn().mockResolvedValue(undefined) } as never,
    { emit: jest.fn() } as never,
    { notify: jest.fn().mockResolvedValue(undefined) } as never,
    {} as never,
  );
  return { service, prisma, tx };
}

describe('ShipmentsService.accept — avec un trajet qui traverse des villes', () => {
  it('colis Kindia → Labé accepté avec le trajet Conakry → Labé qui passe par Kindia', async () => {
    const { service, tx } = build();
    await service.accept('s1', 'u1', 'trip1');
    expect(tx.shipment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tripId: 'trip1' }) }),
    );
  });

  it('refuse un colis dont le ramassage est APRÈS la livraison sur la route (Labé → Kindia)', async () => {
    const { service } = build({ shipment: shipmentRow('labe', 'kindia', new Date(Date.now() - DAY), new Date(DEPARTURE.getTime() + DAY)) });
    await expect(service.accept('s1', 'u1', 'trip1')).rejects.toThrow(/ne passe pas par les villes/);
  });

  it('refuse un colis dont une ville n\'est pas sur la route', async () => {
    const { service } = build({ shipment: shipmentRow('dakar', 'labe', new Date(Date.now() - DAY), new Date(DEPARTURE.getTime() + DAY)) });
    await expect(service.accept('s1', 'u1', 'trip1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('la plage du client se compare au passage à la ville de ramassage, pas au départ de Conakry', async () => {
    // plage : de 1 h après le départ jusqu'à 3 h après → le départ de Conakry est avant la plage, le passage à Kindia dedans
    const window = [new Date(DEPARTURE.getTime() + 3_600_000), new Date(DEPARTURE.getTime() + 3 * 3_600_000)] as const;
    const { service } = build({ shipment: shipmentRow('kindia', 'labe', window[0], window[1]) });
    await expect(service.accept('s1', 'u1', 'trip1')).resolves.toBeDefined();
  });

  it('refuse si le passage à la ville de ramassage tombe hors de la plage du client', async () => {
    const window = [new Date(DEPARTURE.getTime() + 5 * 3_600_000), new Date(DEPARTURE.getTime() + DAY)] as const;
    const { service } = build({ shipment: shipmentRow('kindia', 'labe', window[0], window[1]) });
    await expect(service.accept('s1', 'u1', 'trip1')).rejects.toThrow(/plage de dates/);
  });

  it('un colis Conakry → Labé reste accepté avec le trajet direct, jugé sur l\'heure de départ', async () => {
    const { service } = build({ shipment: shipmentRow('conakry', 'labe', new Date(Date.now() - DAY), new Date(DEPARTURE.getTime() + DAY)) });
    await expect(service.accept('s1', 'u1', 'trip1')).resolves.toBeDefined();
  });

  it('sans trajet : aucune vérification de route (le conducteur peut transporter hors de ses trajets)', async () => {
    const { service, prisma } = build({ shipment: shipmentRow('dakar', 'labe', new Date(Date.now() - DAY), new Date(Date.now() + DAY)) });
    await expect(service.accept('s1', 'u1')).resolves.toBeDefined();
    expect(prisma.trip.findUnique).not.toHaveBeenCalled();
  });

  it('refuse le trajet d\'un autre conducteur', async () => {
    const { service } = build({ trip: tripRow({ driverId: 'autre' }) });
    await expect(service.accept('s1', 'u1', 'trip1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('ville inconnue sur l\'envoi : ne bloque pas (comportement d\'avant), jugé sur le départ', async () => {
    const { service } = build({ shipment: shipmentRow(null, null, new Date(Date.now() - DAY), new Date(DEPARTURE.getTime() + DAY)) });
    await expect(service.accept('s1', 'u1', 'trip1')).resolves.toBeDefined();
  });
});

describe('ShipmentsService.findAvailable — colis sur mon trajet', () => {
  const dto = (extra: Record<string, unknown> = {}) => ({ page: 1, limit: 20, skip: 0, take: 20, ...extra }) as never;
  const wide = [new Date(Date.now() - DAY), new Date(DEPARTURE.getTime() + 2 * DAY)] as const;

  it('ne garde que les colis dont le ramassage précède la livraison sur la route du trajet', async () => {
    const { service } = build({
      candidates: [
        shipmentRow('kindia', 'labe', wide[0], wide[1], 'ok-kindia-labe'),
        shipmentRow('conakry', 'mamou', wide[0], wide[1], 'ok-conakry-mamou'),
        shipmentRow('labe', 'kindia', wide[0], wide[1], 'ko-sens-inverse'),
        shipmentRow('mamou', 'kindia', wide[0], wide[1], 'ko-sens-inverse-2'),
      ],
    });
    const result = (await service.findAvailable(dto({ tripId: 'trip1' }), 'd1')) as { data: Array<{ id: string }> };
    expect(result.data.map((s) => s.id)).toEqual(['ok-kindia-labe', 'ok-conakry-mamou']);
  });

  it('écarte un colis dont la plage ne couvre pas le passage du conducteur au ramassage', async () => {
    const tooLate = [new Date(DEPARTURE.getTime() + 6 * 3_600_000), new Date(DEPARTURE.getTime() + DAY)] as const;
    const { service } = build({ candidates: [shipmentRow('kindia', 'labe', tooLate[0], tooLate[1], 'trop-tard')] });
    const result = (await service.findAvailable(dto({ tripId: 'trip1' }), 'd1')) as { data: unknown[] };
    expect(result.data).toHaveLength(0);
  });

  it('interroge la base uniquement sur les villes du trajet', async () => {
    const { service, prisma } = build();
    await service.findAvailable(dto({ tripId: 'trip1' }), 'd1');
    const where = prisma.shipment.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain('"in":["conakry","kindia","mamou","labe"]');
  });

  it('refuse le trajet d\'un autre conducteur', async () => {
    const { service } = build({ trip: tripRow({ driverId: 'autre' }) });
    await expect(service.findAvailable(dto({ tripId: 'trip1' }), 'd1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sans tripId : liste habituelle, requête paginée en base', async () => {
    const { service, prisma } = build({ candidates: [shipmentRow('kindia', 'labe', wide[0], wide[1])] });
    await service.findAvailable(dto(), 'd1');
    expect(prisma.shipment.count).toHaveBeenCalledTimes(1);
    expect(prisma.trip.findUnique).not.toHaveBeenCalled();
  });
});
