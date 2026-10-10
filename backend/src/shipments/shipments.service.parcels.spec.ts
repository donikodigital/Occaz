// backend/src/shipments/shipments.service.parcels.spec.ts
// Saisie colis par colis : quantité, poids total et valeur déclarée viennent de la liste ; chaque colis est enregistré avec son prix.
import { BadRequestException } from '@nestjs/common';
import { ShipmentsService } from './shipments.service';

const senderLocation = {
  id: 'loc-a',
  cityId: 'city-a',
  city: { countryId: 'country-1', country: { defaultCurrencyId: 'cur-1' } },
};

function build(maxDeclaredValue: bigint | null = null) {
  const tx = {
    shipment: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 's1', ...data })),
      findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve({ id: where.id })),
    },
    shipmentItem: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    shipmentTracking: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    customerProfile: {
      findUnique: jest.fn().mockResolvedValue({ firstName: 'Boubacar', lastName: 'BARRY', user: { phone: '+224600000003' } }),
    },
    location: { findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id === 'loc-a' ? senderLocation : { id: 'loc-b' })) },
    currency: { findUnique: jest.fn().mockResolvedValue({ isoCode: 'GNF' }) },
    $transaction: jest.fn().mockImplementation((callback: (client: unknown) => unknown) => callback(tx)),
  };
  const categories = {
    findOne: jest.fn().mockResolvedValue({ id: 'cat1', name: 'Colis', isAllowed: true, priceMultiplier: 1, maxDeclaredValue }),
  };
  const pricing = {
    computeShipmentQuote: jest.fn().mockImplementation(({ parcels }) =>
      Promise.resolve({
        price: 100_000n,
        distanceKm: 10,
        chargeableWeightKg: 5,
        volumetricWeightKg: null,
        parcels: (parcels ?? []).map((_: unknown, index: number) => ({
          price: BigInt(40_000 + index * 10_000),
          chargeableWeightKg: 1,
          volumetricWeightKg: null,
        })),
        urgentSurcharge: 0n,
      }),
    ),
    computeCommission: jest.fn().mockResolvedValue(5_000n),
  };
  const service = new ShipmentsService(
    prisma as never, pricing as never, categories as never, {} as never, {} as never,
    { emit: jest.fn() } as never, {} as never, { resolveForCheckout: jest.fn(), redeem: jest.fn() } as never,
  );
  return { service, tx, pricing };
}

const dto = (extra: Record<string, unknown> = {}) =>
  ({
    categoryId: 'cat1', senderLocationId: 'loc-a', recipientLocationId: 'loc-b', weightKg: 999, quantity: 1,
    recipientName: 'Aïssatou Bah', recipientPhone: '+224620000002',
    windowStart: new Date(Date.now() + 3_600_000).toISOString(),
    windowEnd: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    ...extra,
  }) as never;

const twoParcels = [
  { weightKg: 3, lengthCm: 40, widthCm: 30, heightCm: 20, declaredValue: '200000', description: 'Vêtements' },
  { weightKg: 1.5, lengthCm: 60, widthCm: 50, heightCm: 40 },
];

describe('ShipmentsService.create — colis par colis', () => {
  it('tire quantité, poids total et valeur déclarée de la liste de colis, pas des champs globaux', async () => {
    const { service, tx } = build();
    await service.create('cust1', dto({ parcels: twoParcels }));
    expect(tx.shipment.create.mock.calls[0][0].data).toMatchObject({ quantity: 2, weightKg: 4.5, declaredValue: 200_000n });
  });

  it("garde sur l'envoi les dimensions du colis le plus volumineux", async () => {
    const { service, tx } = build();
    await service.create('cust1', dto({ parcels: twoParcels }));
    expect(tx.shipment.create.mock.calls[0][0].data).toMatchObject({ lengthCm: 60, widthCm: 50, heightCm: 40 });
  });

  it('enregistre chaque colis avec ses mesures, sa valeur et son prix, dans l\'ordre de la saisie', async () => {
    const { service, tx } = build();
    await service.create('cust1', dto({ parcels: twoParcels }));
    const items = tx.shipmentItem.createMany.mock.calls[0][0].data;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      shipmentId: 's1', label: 'Vêtements', weightKg: 3, lengthCm: 40, widthCm: 30, heightCm: 20, declaredValue: 200_000n, price: 40_000n,
    });
    expect(items[1]).toMatchObject({ label: 'Colis 2', weightKg: 1.5, declaredValue: undefined, price: 50_000n });
    expect(items[1].createdAt.getTime()).toBeGreaterThan(items[0].createdAt.getTime());
  });

  it('refuse des dimensions incomplètes (les trois ou aucune)', async () => {
    const { service, tx } = build();
    await expect(
      service.create('cust1', dto({ parcels: [{ weightKg: 2 }, { weightKg: 2, lengthCm: 30, widthCm: 20 }] })),
    ).rejects.toThrow(/Colis 2/);
    expect(tx.shipment.create).not.toHaveBeenCalled();
    await expect(service.create('cust1', dto({ parcels: [{ weightKg: 2, lengthCm: 30 }] }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse une valeur déclarée totale au-dessus du maximum de la catégorie', async () => {
    const { service } = build(150_000n);
    await expect(service.create('cust1', dto({ parcels: twoParcels }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sans liste de colis, le comportement d\'avant est conservé', async () => {
    const { service, tx } = build();
    await service.create('cust1', dto({ weightKg: 7, quantity: 3 }));
    expect(tx.shipment.create.mock.calls[0][0].data).toMatchObject({ quantity: 3, weightKg: 7 });
    expect(tx.shipmentItem.createMany).not.toHaveBeenCalled();
  });
});

describe('ShipmentsService.quote — colis par colis', () => {
  it('renvoie le prix de chaque colis, la majoration d\'urgence et le total', async () => {
    const { service } = build();
    const quote = await service.quote(dto({ parcels: twoParcels }));
    expect(quote.totalAmount).toBe(100_000n);
    expect(quote.quantity).toBe(2);
    expect(quote.weightKg).toBe(4.5);
    expect(quote.parcels).toEqual([
      expect.objectContaining({ index: 1, weightKg: 3, price: 40_000n }),
      expect.objectContaining({ index: 2, weightKg: 1.5, price: 50_000n }),
    ]);
    expect(quote.urgentSurcharge).toBe(0n);
  });
});
