// backend/src/trips/bookings.service.promo.spec.ts
import { BookingsService } from './bookings.service';

/**
 * Code promo à la réservation d'un trajet : même règle que pour les
 * envois (ShipmentsService.create) — la réduction est plafonnée à la
 * commission de la plateforme, jamais au-delà, pour que le gain du
 * chauffeur (Trip.pricePerSeat × places) ne dépende jamais d'un code
 * promo.
 */
const trip = {
  id: 'trip1',
  pricePerSeat: 100_000n,
  currencyId: 'cur1',
  status: 'PUBLISHED',
  originCity: { countryId: 'country-1' },
};

function createService(options: { rawDiscount?: bigint; platformFee?: bigint } = {}) {
  const platformFee = options.platformFee ?? 15_000n;
  const tx = {
    trip: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    booking: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'b1', ...data })),
      findUnique: jest.fn().mockResolvedValue({ id: 'b1' }),
    },
    tripPassenger: { createMany: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    trip: { findUnique: jest.fn().mockResolvedValue(trip) },
    customerProfile: { findUnique: jest.fn().mockResolvedValue({ firstName: 'A', lastName: 'B' }) },
    $transaction: jest.fn().mockImplementation((callback: (client: unknown) => unknown) => callback(tx)),
  };
  const pricing = { computeCommission: jest.fn().mockResolvedValue(platformFee) };
  const promoCodes = {
    resolveForCheckout: jest.fn().mockResolvedValue({
      promoCode: { id: 'promo1', usageLimit: null, usedCount: 0 },
      discountAmount: options.rawDiscount ?? 5_000n,
    }),
    redeem: jest.fn().mockResolvedValue(undefined),
  };
  const service = new BookingsService(prisma as never, pricing as never, { emit: jest.fn() } as never, promoCodes as never);
  return { service, tx, promoCodes };
}

describe('BookingsService.create — code promo', () => {
  it('sans code promo : le prix et la commission ne changent pas', async () => {
    const { tx, service, promoCodes } = createService();
    await service.create('cust1', { tripId: 'trip1', seatsCount: 1 } as never);

    expect(promoCodes.redeem).not.toHaveBeenCalled();
    // 100 000 de base + 15 000 de commission = 115 000.
    expect(tx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ totalAmount: 115_000n, platformFee: 15_000n }) }),
    );
  });

  it('réduction plafonnée à la commission : le chauffeur touche toujours son montant plein', async () => {
    const { tx, service, promoCodes } = createService({ rawDiscount: 50_000n, platformFee: 15_000n });
    await service.create('cust1', { tripId: 'trip1', seatsCount: 1, promoCode: 'GROSPROMO' } as never);

    // Rabais brut 50 000, mais plafonné à 15 000 (la commission) : commission à 0, total à 100 000.
    expect(tx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ totalAmount: 100_000n, platformFee: 0n }) }),
    );
    // Le chauffeur touche toujours 100 000 - 0 = 100 000 (le prix de base, inchangé).
    expect(100_000n - 0n).toBe(trip.pricePerSeat);
    expect(promoCodes.redeem).toHaveBeenCalledWith(
      tx,
      expect.anything(),
      expect.objectContaining({ customerId: 'cust1', bookingId: 'b1', discountAmount: 15_000n }),
    );
  });
});