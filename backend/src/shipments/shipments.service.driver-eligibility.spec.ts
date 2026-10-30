// backend/src/shipments/shipments.service.driver-eligibility.spec.ts
// Colis : aucun délai de tolérance. Un client ne peut pas poser un envoi sur le trajet d'un conducteur pas encore validé.
import { BadRequestException } from '@nestjs/common';
import { DriverAccountStatus, TripStatus } from '@prisma/client';
import { ShipmentsService } from './shipments.service';

const senderLocation = {
  id: 'loc-a', cityId: 'city-a',
  city: { countryId: 'country-1', country: { defaultCurrencyId: 'cur-1' } },
};

function build(driverStatus: DriverAccountStatus) {
  const tx = {
    shipment: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 's1', ...data })),
      findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve({ id: where.id })),
    },
    shipmentTracking: { create: jest.fn().mockResolvedValue({}) },
    trip: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const departure = new Date(Date.now() + 2 * 86_400_000);
  const prisma = {
    category: {},
    customerProfile: { findUnique: jest.fn().mockResolvedValue({ firstName: 'Boubacar', lastName: 'BARRY', user: { phone: '+224600000003' } }) },
    location: { findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id === 'loc-a' ? senderLocation : { id: 'loc-b' })) },
    trip: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'trip1', driverId: 'd1', status: TripStatus.PUBLISHED, allowsShipments: true,
        departureAt: departure, availableShipmentWeightKg: null, driver: { status: driverStatus },
      }),
    },
    $transaction: jest.fn().mockImplementation((callback: (client: unknown) => unknown) => callback(tx)),
  };
  const categories = { findOne: jest.fn().mockResolvedValue({ id: 'cat1', name: 'Colis', isAllowed: true, priceMultiplier: 1, maxDeclaredValue: null }) };
  const pricing = {
    computeShipmentQuote: jest.fn().mockResolvedValue({ price: 50_000n, distanceKm: 10, chargeableWeightKg: 5, volumetricWeightKg: null }),
    computeCommission: jest.fn().mockResolvedValue(5_000n),
  };
  const service = new ShipmentsService(
    prisma as never, pricing as never, categories as never, {} as never, {} as never,
    { emit: jest.fn() } as never, {} as never, { resolveForCheckout: jest.fn(), redeem: jest.fn() } as never,
  );
  return { service, tx, departure };
}

const dto = (departure: Date) =>
  ({
    categoryId: 'cat1', senderLocationId: 'loc-a', recipientLocationId: 'loc-b', weightKg: 2, tripId: 'trip1',
    recipientName: 'Aïssatou Bah', recipientPhone: '+224620000002',
    windowStart: new Date(departure.getTime() - 86_400_000).toISOString(),
    windowEnd: new Date(departure.getTime() + 86_400_000).toISOString(),
  }) as never;

describe('ShipmentsService.create — conducteur du trajet choisi', () => {
  it.each([DriverAccountStatus.PENDING, DriverAccountStatus.IN_VERIFICATION, DriverAccountStatus.SUSPENDED])(
    'refuse un trajet dont le conducteur est %s : rien n\'est créé',
    async (status) => {
      const { service, tx, departure } = build(status);
      await expect(service.create('cust1', dto(departure))).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.shipment.create).not.toHaveBeenCalled();
    },
  );

  it('accepte un trajet dont le conducteur est validé', async () => {
    const { service, tx, departure } = build(DriverAccountStatus.VALIDATED);
    await service.create('cust1', dto(departure));
    expect(tx.shipment.create.mock.calls[0][0].data).toMatchObject({ tripId: 'trip1', driverId: 'd1' });
  });
});
