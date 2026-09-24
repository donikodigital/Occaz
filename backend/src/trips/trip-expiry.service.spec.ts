// backend/src/trips/trip-expiry.service.spec.ts
import { BookingStatus, TripStatus } from '@prisma/client';
import { TripExpiryService } from './trip-expiry.service';

/**
 * Un trajet expire quand il est PUBLISHED ou DRIVER_ARRIVED, sans aucune
 * réservation active, et que son départ est passé de plus de
 * `trip.stale_expiry_hours` (24h par défaut).
 */
function createService(options: { staleTrips?: { id: string }[]; expiryHours?: number } = {}) {
  const findMany = jest.fn().mockResolvedValue(options.staleTrips ?? []);
  const prisma = { trip: { findMany } };
  const pricing = { getNumericSetting: jest.fn().mockResolvedValue(options.expiryHours ?? 24) };
  const trips = { expireStale: jest.fn().mockResolvedValue(true) };
  const service = new TripExpiryService(prisma as never, pricing as never, trips as never);
  return { service, prisma, pricing, trips };
}

describe('TripExpiryService.runOnce', () => {
  it('interroge avec le délai configuré, les statuts PUBLISHED/DRIVER_ARRIVED et aucune réservation active', async () => {
    const { service, prisma, pricing } = createService({ expiryHours: 48 });
    await service.runOnce();

    expect(pricing.getNumericSetting).toHaveBeenCalledWith('trip.stale_expiry_hours', 24);
    const call = prisma.trip.findMany.mock.calls[0][0];
    expect(call.where.status).toEqual({ in: [TripStatus.PUBLISHED, TripStatus.DRIVER_ARRIVED] });
    expect(call.where.departureAt).toEqual({ lt: expect.any(Date) });
    expect(call.where.bookings).toEqual({
      none: { status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.PAID, BookingStatus.CONFIRMED] } },
    });
  });

  it('expire chaque trajet trouvé', async () => {
    const { service, trips } = createService({ staleTrips: [{ id: 't1' }, { id: 't2' }] });
    await service.runOnce();
    expect(trips.expireStale).toHaveBeenCalledTimes(2);
    expect(trips.expireStale).toHaveBeenCalledWith('t1', expect.any(String));
    expect(trips.expireStale).toHaveBeenCalledWith('t2', expect.any(String));
  });

  it("continue avec les suivants quand l'un échoue", async () => {
    const { service, trips } = createService({ staleTrips: [{ id: 'a' }, { id: 'b' }] });
    trips.expireStale.mockRejectedValueOnce(new Error('boom'));
    await service.runOnce();
    expect(trips.expireStale).toHaveBeenCalledTimes(2);
  });

  it('ne relance pas un passage déjà en cours', async () => {
    const { service, prisma } = createService();
    const first = service.runOnce();
    const second = service.runOnce();
    await Promise.all([first, second]);
    expect(prisma.trip.findMany).toHaveBeenCalledTimes(1);
  });
});