// backend/src/trips/trip-expiry.service.spec.ts
import { BookingStatus, TripStatus } from '@prisma/client';
import { TripExpiryService } from './trip-expiry.service';

/**
 * Un trajet expire quand il est PUBLISHED ou DRIVER_ARRIVED, sans aucune
 * réservation active, et que son départ est passé de plus de
 * `trip.stale_expiry_hours` (24h par défaut).
 */
function createService(options: { staleTrips?: { id: string }[]; abandonedTrips?: { id: string }[]; expiryHours?: number; abandonedHours?: number } = {}) {
  // 1er appel : trajets sans réservation (expireStale) ; 2e appel : trajets abandonnés AVEC clients payés (cancelAbandoned).
  const findMany = jest.fn().mockResolvedValueOnce(options.staleTrips ?? []).mockResolvedValue(options.abandonedTrips ?? []);
  const prisma = { trip: { findMany } };
  const pricing = {
    getNumericSetting: jest.fn().mockImplementation((key: string) =>
      Promise.resolve(key === 'trip.abandoned_after_hours' ? (options.abandonedHours ?? 12) : (options.expiryHours ?? 24)),
    ),
  };
  const trips = { expireStale: jest.fn().mockResolvedValue(true), cancelAbandoned: jest.fn().mockResolvedValue(true) };
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
    // Un envoi accepté et pas encore livré empêche l'expiration du trajet.
    expect(call.where.shipments.none.status.in).toEqual(expect.arrayContaining(['DRIVER_ASSIGNED', 'IN_TRANSIT']));
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
    // Un seul passage (deux requêtes : trajets sans réservation, trajets abandonnés) — jamais deux.
    expect(prisma.trip.findMany).toHaveBeenCalledTimes(2);
  });

  it('interrupteur de l\'administration coupé (jobs.trip_expiry_enabled = 0) : aucun trajet n\'est examiné ni expiré', async () => {
    const { service, prisma, pricing, trips } = createService({ staleTrips: [{ id: 't1' }] });
    pricing.getNumericSetting.mockImplementation((key: string) => Promise.resolve(key === 'jobs.trip_expiry_enabled' ? 0 : 24));
    await service.runOnce();
    expect(pricing.getNumericSetting).toHaveBeenCalledWith('jobs.trip_expiry_enabled', 1);
    expect(prisma.trip.findMany).not.toHaveBeenCalled();
    expect(trips.expireStale).not.toHaveBeenCalled();
  });
});

describe('TripExpiryService — trajets abandonnés avec des clients payés', () => {
  it('cherche les trajets non démarrés (publié / arrivé) avec une réservation payée, départ dépassé du délai, sans colis confié', async () => {
    const { service, prisma, pricing } = createService({ abandonedHours: 10 });
    await service.runOnce();
    expect(pricing.getNumericSetting).toHaveBeenCalledWith('trip.abandoned_after_hours', 12);
    const call = prisma.trip.findMany.mock.calls[1][0];
    expect(call.where.status).toEqual({ in: [TripStatus.PUBLISHED, TripStatus.DRIVER_ARRIVED] });
    expect(call.where.bookings).toEqual({ some: { status: { in: [BookingStatus.PAID, BookingStatus.CONFIRMED] } } });
    expect(call.where.shipments.none.status.in).toEqual(expect.arrayContaining(['DRIVER_ASSIGNED', 'IN_TRANSIT']));
    const limit = call.where.departureAt.lt as Date;
    expect(Math.round((Date.now() - limit.getTime()) / 3_600_000)).toBe(10);
  });

  it('annule chaque trajet abandonné (remboursement intégral des clients, voir TripsService.cancelAbandoned)', async () => {
    const { service, trips } = createService({ abandonedTrips: [{ id: 'a1' }, { id: 'a2' }] });
    await service.runOnce();
    expect(trips.cancelAbandoned).toHaveBeenCalledTimes(2);
    expect(trips.cancelAbandoned).toHaveBeenCalledWith('a1', expect.any(String));
    expect(trips.expireStale).not.toHaveBeenCalled();
  });

  it('un échec n\'empêche pas les suivants', async () => {
    const { service, trips } = createService({ abandonedTrips: [{ id: 'a1' }, { id: 'a2' }] });
    trips.cancelAbandoned.mockRejectedValueOnce(new Error('boom'));
    await service.runOnce();
    expect(trips.cancelAbandoned).toHaveBeenCalledTimes(2);
  });

  it('délai à 0 : fonction désactivée, aucune requête de recherche des abandonnés', async () => {
    const { service, prisma, trips } = createService({ abandonedHours: 0, abandonedTrips: [{ id: 'a1' }] });
    await service.runOnce();
    expect(prisma.trip.findMany).toHaveBeenCalledTimes(1);
    expect(trips.cancelAbandoned).not.toHaveBeenCalled();
  });
});
