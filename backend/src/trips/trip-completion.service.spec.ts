// backend/src/trips/trip-completion.service.spec.ts
// Client absent (attente minimale, conducteur payé, pas de remboursement) et clôture automatique des trajets restés à l'arrivée.
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BookingStatus, TripStatus } from '@prisma/client';
import { NO_SHOW_REASON, TripCompletionService } from './trip-completion.service';

const MIN = 60_000;
const ago = (minutes: number) => new Date(Date.now() - minutes * MIN);

function bookingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    tripId: 't1',
    status: BookingStatus.CONFIRMED,
    boardingStopId: null,
    boardingStop: null,
    cancellationReason: null,
    passengers: [{ pickedUpAt: null }],
    customer: { userId: 'u-customer' },
    trip: {
      id: 't1',
      driverId: 'd1',
      status: TripStatus.DRIVER_ARRIVED,
      driverArrivedAt: ago(20),
      updatedAt: ago(20),
      originCity: { name: 'Conakry' },
      destinationCity: { name: 'Labé' },
      driver: { userId: 'u-driver' },
    },
    ...overrides,
  };
}

function build(options: { booking?: Record<string, unknown> | null; claimCount?: number; waitMinutes?: number; stuck?: Array<{ id: string; driverId: string }>; stuckBookings?: Array<Record<string, unknown>>; tripClaim?: number } = {}) {
  const tx = {
    booking: { updateMany: jest.fn().mockResolvedValue({ count: options.claimCount ?? 1 }), findMany: jest.fn().mockResolvedValue([]) },
    trip: { findUnique: jest.fn().mockResolvedValue({ id: 't1', totalSeats: 4, departureAt: new Date(), pricePerSeat: 1n, originCityId: 'a', originLocationId: 'la', destinationCityId: 'b', destinationLocationId: 'lb', stops: [] }), update: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([{ status: 'DRIVER_ARRIVED', totalSeats: 4 }]),
  };
  const prisma = {
    booking: {
      findUnique: jest.fn().mockResolvedValue(options.booking === undefined ? bookingRow() : options.booking),
      findMany: jest.fn().mockResolvedValue(options.stuckBookings ?? []),
    },
    trip: {
      updateMany: jest.fn().mockResolvedValue({ count: options.tripClaim ?? 1 }),
      findMany: jest.fn().mockResolvedValue(options.stuck ?? []),
    },
    $transaction: jest.fn().mockImplementation((callback: (client: unknown) => unknown) => callback(tx)),
  };
  const pricing = {
    getNumericSetting: jest.fn().mockImplementation((key: string, fallback: number) =>
      Promise.resolve(key === 'booking.no_show_wait_minutes' && options.waitMinutes !== undefined ? options.waitMinutes : fallback),
    ),
  };
  const wallets = { releaseHeldFunds: jest.fn().mockResolvedValue(undefined) };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const driverProfiles = { incrementCompletedTrips: jest.fn().mockResolvedValue(undefined) };
  const tripOtp = { closeDropoffBySystem: jest.fn().mockResolvedValue(undefined) };
  const service = new TripCompletionService(
    prisma as never, pricing as never, wallets as never, notifications as never, audit as never, driverProfiles as never, tripOtp as never,
  );
  return { service, prisma, tx, wallets, notifications, audit, driverProfiles, tripOtp };
}

describe('TripCompletionService.declareNoShow', () => {
  it('après 15 min d’attente : réservation annulée, conducteur payé, client prévenu, aucun remboursement', async () => {
    const { service, tx, wallets, notifications, audit } = build();
    await expect(service.declareNoShow('b1', 'd1')).resolves.toMatchObject({ noShow: true });

    expect(tx.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.CANCELLED, cancellationReason: NO_SHOW_REASON }) }),
    );
    expect(tx.trip.update).toHaveBeenCalled(); // places rendues (recalcul du compteur)
    expect(wallets.releaseHeldFunds).toHaveBeenCalledWith({ driverId: 'd1', bookingId: 'b1' });
    expect(notifications.notify).toHaveBeenCalledTimes(2);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'NO_SHOW', entityId: 'b1' }));
  });

  it('trop tôt : refusé avec le temps restant, rien n’est modifié', async () => {
    const booking = bookingRow({ trip: { ...bookingRow().trip, driverArrivedAt: ago(5) } });
    const { service, tx, wallets } = build({ booking });
    await expect(service.declareNoShow('b1', 'd1')).rejects.toThrow(/attendre encore 10 minutes/);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
    expect(wallets.releaseHeldFunds).not.toHaveBeenCalled();
  });

  it('l’attente minimale est réglable depuis l’administration', async () => {
    const booking = bookingRow({ trip: { ...bookingRow().trip, driverArrivedAt: ago(5) } });
    const { service } = build({ booking, waitMinutes: 3 });
    await expect(service.declareNoShow('b1', 'd1')).resolves.toMatchObject({ noShow: true });
  });

  it('refuse un autre conducteur', async () => {
    const { service } = build();
    await expect(service.declareNoShow('b1', 'autre')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuse un client déjà pris en charge', async () => {
    const { service, wallets } = build({ booking: bookingRow({ passengers: [{ pickedUpAt: ago(3) }] }) });
    await expect(service.declareNoShow('b1', 'd1')).rejects.toBeInstanceOf(BadRequestException);
    expect(wallets.releaseHeldFunds).not.toHaveBeenCalled();
  });

  it('client monté à une étape : l’attente se compte depuis l’arrivée à son étape', async () => {
    const stopBooking = bookingRow({
      boardingStopId: 's1',
      boardingStop: { pickupArrivedAt: ago(4), city: { name: 'Mamou' } },
      trip: { ...bookingRow().trip, status: TripStatus.IN_PROGRESS },
    });
    const { service } = build({ booking: stopBooking });
    await expect(service.declareNoShow('b1', 'd1')).rejects.toThrow(/attendre encore 11 minutes/);

    const waited = bookingRow({
      boardingStopId: 's1',
      boardingStop: { pickupArrivedAt: ago(30), city: { name: 'Mamou' } },
      trip: { ...bookingRow().trip, status: TripStatus.IN_PROGRESS },
    });
    await expect(build({ booking: waited }).service.declareNoShow('b1', 'd1')).resolves.toMatchObject({ noShow: true });
  });

  it('arrivée à l’étape jamais signalée : refusé', async () => {
    const booking = bookingRow({ boardingStopId: 's1', boardingStop: { pickupArrivedAt: null, city: { name: 'Mamou' } }, trip: { ...bookingRow().trip, status: TripStatus.IN_PROGRESS } });
    const { service } = build({ booking });
    await expect(service.declareNoShow('b1', 'd1')).rejects.toThrow(/arrivée/);
  });

  it('appel simultané perdu (réservation annulée entre-temps) : refusé, conducteur non payé', async () => {
    const { service, wallets } = build({ claimCount: 0 });
    await expect(service.declareNoShow('b1', 'd1')).rejects.toBeInstanceOf(BadRequestException);
    expect(wallets.releaseHeldFunds).not.toHaveBeenCalled();
  });

  it('rejouable : déjà déclarée absente, ne fait que terminer la libération des fonds (jamais de double paiement)', async () => {
    const { service, wallets, tx } = build({ booking: bookingRow({ status: BookingStatus.CANCELLED, cancellationReason: NO_SHOW_REASON }) });
    await expect(service.declareNoShow('b1', 'd1')).resolves.toMatchObject({ noShow: true });
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
    expect(wallets.releaseHeldFunds).toHaveBeenCalledTimes(1);
  });

  it('tous les clients du départ absents : le trajet est clos sans pénalité', async () => {
    const { service, prisma, audit } = build();
    await service.declareNoShow('b1', 'd1');
    expect(prisma.trip.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 't1', status: TripStatus.DRIVER_ARRIVED }), data: { status: TripStatus.CANCELLED } }),
    );
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTO_CLOSE_NO_SHOW' }));
  });
});

describe('TripCompletionService.autoCloseStuckTrips', () => {
  it('valide les passagers déposés, traite les absents, clôt le trajet et compte la course au conducteur', async () => {
    const stuckBookings = [
      { id: 'b-boarded', passengers: [{ pickedUpAt: ago(400) }] },
      { id: 'b-absent', passengers: [{ pickedUpAt: null }] },
    ];
    const { service, tripOtp, wallets, driverProfiles, prisma } = build({ stuck: [{ id: 't1', driverId: 'd1' }], stuckBookings });
    await expect(service.autoCloseStuckTrips()).resolves.toBe(1);

    expect(tripOtp.closeDropoffBySystem).toHaveBeenCalledWith('b-boarded');
    expect(wallets.releaseHeldFunds).toHaveBeenCalledWith({ driverId: 'd1', bookingId: 'b-absent' });
    expect(prisma.trip.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: TripStatus.COMPLETED } }),
    );
    expect(driverProfiles.incrementCompletedTrips).toHaveBeenCalledWith('d1');
  });

  it('cherche les trajets arrivés depuis plus de 6 h par défaut', async () => {
    const { service, prisma } = build();
    await service.autoCloseStuckTrips();
    const where = prisma.trip.findMany.mock.calls[0][0].where;
    expect(where.status).toBe(TripStatus.ARRIVED);
    const limit: Date = where.OR[0].arrivedAt.lt;
    expect(Date.now() - limit.getTime()).toBeGreaterThan(6 * 60 * MIN - 5_000);
    expect(Date.now() - limit.getTime()).toBeLessThan(6 * 60 * MIN + 5_000);
  });

  it('un trajet encore bloqué par une réservation non clôturée n’est pas compté comme terminé', async () => {
    const { service, driverProfiles } = build({ stuck: [{ id: 't1', driverId: 'd1' }], tripClaim: 0 });
    await expect(service.autoCloseStuckTrips()).resolves.toBe(0);
    expect(driverProfiles.incrementCompletedTrips).not.toHaveBeenCalled();
  });

  it('un échec sur un trajet n’empêche pas les suivants', async () => {
    const { service, prisma } = build({ stuck: [{ id: 't1', driverId: 'd1' }, { id: 't2', driverId: 'd2' }] });
    prisma.booking.findMany.mockRejectedValueOnce(new Error('base indisponible')).mockResolvedValue([]);
    await expect(service.autoCloseStuckTrips()).resolves.toBe(1);
  });

  it('respecte l’interrupteur d’administration', async () => {
    const { service, prisma } = build();
    (service as unknown as { pricing: { getNumericSetting: jest.Mock } }).pricing.getNumericSetting.mockResolvedValue(0);
    await service.runOnce();
    expect(prisma.trip.findMany).not.toHaveBeenCalled();
  });
});
