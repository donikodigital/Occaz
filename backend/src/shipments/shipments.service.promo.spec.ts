// backend/src/shipments/shipments.service.promo.spec.ts
import { PromoDiscountType } from '@prisma/client';
import { ShipmentsService } from './shipments.service';

/**
 * Code promo à la création d'un envoi : la réduction est toujours
 * plafonnée à la commission de la plateforme — jamais au-delà, pour que
 * le gain du chauffeur ne dépende jamais d'un code promo (voir le
 * commentaire dans ShipmentsService.create).
 */
const senderLocation = {
  id: 'loc-a',
  cityId: 'city-a',
  city: { countryId: 'country-1', country: { defaultCurrencyId: 'cur-1' } },
};
const recipientLocation = { id: 'loc-b' };

function createService(options: { rawDiscount?: bigint; platformFee?: bigint; withPromo?: boolean } = {}) {
  const platformFee = options.platformFee ?? 15_000n;
  const tx = {
    shipment: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 's1', ...data })),
      findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve({ id: where.id })),
    },
    shipmentTracking: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    category: {},
    location: {
      findUnique: jest.fn().mockImplementation(({ where }) =>
        Promise.resolve(where.id === 'loc-a' ? senderLocation : recipientLocation),
      ),
    },
    $transaction: jest.fn().mockImplementation((callback: (client: unknown) => unknown) => callback(tx)),
  };
  const categories = {
    findOne: jest.fn().mockResolvedValue({ id: 'cat1', name: 'Documents', isAllowed: true, priceMultiplier: 1, maxDeclaredValue: null }),
  };
  const pricing = {
    computeShipmentQuote: jest.fn().mockResolvedValue({ price: 150_000n, distanceKm: 10, chargeableWeightKg: 5, volumetricWeightKg: null }),
    computeCommission: jest.fn().mockResolvedValue(platformFee),
  };
  const promoCodes = {
    resolveForCheckout: jest.fn().mockResolvedValue({
      promoCode: { id: 'promo1', usageLimit: null, usedCount: 0 },
      discountAmount: options.rawDiscount ?? 5_000n,
    }),
    redeem: jest.fn().mockResolvedValue(undefined),
  };
  const service = new ShipmentsService(
    prisma as never,
    pricing as never,
    categories as never,
    {} as never,
    {} as never,
    { emit: jest.fn() } as never,
    {} as never,
    promoCodes as never,
  );
  return { service, tx, pricing, promoCodes };
}

const baseDto: Record<string, unknown> = {
  categoryId: 'cat1',
  senderLocationId: 'loc-a',
  recipientLocationId: 'loc-b',
  weightKg: 5,
  senderName: 'A',
  senderPhone: '+224600000001',
  recipientName: 'B',
  recipientPhone: '+224600000002',
  windowStart: new Date(Date.now() + 3_600_000).toISOString(),
  windowEnd: new Date(Date.now() + 7 * 86_400_000).toISOString(),
};

describe('ShipmentsService.create — code promo', () => {
  it('sans code promo : le prix et la commission ne changent pas', async () => {
    const { service, tx, promoCodes } = createService();
    const shipment = await service.create('cust1', baseDto as never);

    expect(promoCodes.resolveForCheckout).not.toHaveBeenCalled();
    expect(promoCodes.redeem).not.toHaveBeenCalled();
    expect(tx.shipment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ totalAmount: 150_000n, platformFee: 15_000n, price: 150_000n }) }),
    );
  });

  it('réduction inférieure à la commission : entièrement absorbée par la plateforme', async () => {
    const { service, tx, promoCodes } = createService({ rawDiscount: 5_000n, platformFee: 15_000n });
    await service.create('cust1', { ...baseDto, promoCode: 'BIENVENUE' } as never);

    // 150 000 de prix, 15 000 de commission -> 10 000 après un rabais de 5 000.
    expect(tx.shipment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalAmount: 145_000n, platformFee: 10_000n, price: 150_000n }),
      }),
    );
    // Le chauffeur touche toujours 150 000 - 15 000 = 135 000 (145 000 - 10 000).
    expect(145_000n - 10_000n).toBe(150_000n - 15_000n);
    expect(promoCodes.redeem).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ id: 'promo1' }),
      expect.objectContaining({ customerId: 'cust1', shipmentId: 's1', discountAmount: 5_000n }),
    );
  });

  it('réduction supérieure à la commission : plafonnée, jamais au-delà — le chauffeur ne perd jamais rien', async () => {
    const { service, tx, promoCodes } = createService({ rawDiscount: 50_000n, platformFee: 15_000n });
    await service.create('cust1', { ...baseDto, promoCode: 'GROSPROMO' } as never);

    // Rabais brut de 50 000, mais la commission ne vaut que 15 000 : plafonné à 15 000.
    expect(tx.shipment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalAmount: 135_000n, platformFee: 0n, price: 150_000n }),
      }),
    );
    // Le chauffeur touche encore 150 000 - 15 000 = 135 000 (135 000 - 0).
    expect(135_000n - 0n).toBe(150_000n - 15_000n);
    expect(promoCodes.redeem).toHaveBeenCalledWith(
      tx,
      expect.anything(),
      expect.objectContaining({ discountAmount: 15_000n }),
    );
  });
});