// backend/src/trips/trips.service.cancel.spec.ts
// Annulation par le conducteur : possible tant que personne n'est monté, refusée dès que le trajet a commencé
// (le recours est alors le litige, toujours ouvert).
import { BadRequestException } from '@nestjs/common';
import { TripStatus } from '@prisma/client';
import { TripsService } from './trips.service';

function createService(status: TripStatus, options: { activeShipments?: number; claimCount?: number } = {}) {
  const prisma = {
    trip: { findUnique: jest.fn().mockResolvedValue({ driverId: 'd1' }), updateMany: jest.fn().mockResolvedValue({ count: options.claimCount ?? 1 }) },
    shipment: { count: jest.fn().mockResolvedValue(options.activeShipments ?? 0) },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const bookings = { cancelAllForTrip: jest.fn().mockResolvedValue(undefined) };
  const drivers = { incrementCancellations: jest.fn().mockResolvedValue(undefined) };
  const service = new TripsService(
    prisma as never,
    audit as never,
    {} as never,
    {} as never,
    drivers as never,
    bookings as never,
    {} as never,
    { notify: jest.fn().mockResolvedValue(undefined) } as never,
    {} as never,
    {} as never,
  );
  jest.spyOn(service as never, 'findOne').mockResolvedValue({ id: 't1', driverId: 'd1', status } as never);
  return { service, prisma, bookings, drivers };
}

describe('TripsService.cancel — trajet commencé', () => {
  it.each([TripStatus.DRAFT, TripStatus.PUBLISHED, TripStatus.DRIVER_ARRIVED])(
    'statut %s : l\'annulation passe et prévient les réservations',
    async (status) => {
      const { service, prisma, bookings } = createService(status);
      await service.cancel('t1', 'd1', 'Imprévu');
      expect(prisma.trip.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 't1' }), data: { status: TripStatus.CANCELLED } }),
      );
      expect(bookings.cancelAllForTrip).toHaveBeenCalled();
    },
  );

  it.each([TripStatus.PASSENGER_PICKED_UP, TripStatus.IN_PROGRESS, TripStatus.ARRIVED])(
    'statut %s : annulation refusée, aucune réservation remboursée',
    async (status) => {
      const { service, prisma, bookings, drivers } = createService(status);
      await expect(service.cancel('t1', 'd1', 'Imprévu')).rejects.toThrow(/a commencé/);
      expect(prisma.trip.updateMany).not.toHaveBeenCalled();
      expect(bookings.cancelAllForTrip).not.toHaveBeenCalled();
      expect(drivers.incrementCancellations).not.toHaveBeenCalled();
    },
  );
});

describe('TripsService.cancel — colis confiés et concurrence', () => {
  it('un colis accepté et pas encore livré : annulation refusée, rien n\'est remboursé ni compté', async () => {
    const { service, prisma, bookings, drivers } = createService(TripStatus.PUBLISHED, { activeShipments: 2 });
    await expect(service.cancel('t1', 'd1', 'Imprévu')).rejects.toThrow(/2 colis vous sont confiés/);
    expect(prisma.trip.updateMany).not.toHaveBeenCalled();
    expect(bookings.cancelAllForTrip).not.toHaveBeenCalled();
    expect(drivers.incrementCancellations).not.toHaveBeenCalled();
  });

  it('trajet annulé ou parti entre-temps (réclamation perdue) : refus, un seul compteur d\'annulation', async () => {
    const { service, bookings, drivers } = createService(TripStatus.PUBLISHED, { claimCount: 0 });
    await expect(service.cancel('t1', 'd1', 'Imprévu')).rejects.toThrow(/ne peut plus être annulé/);
    expect(bookings.cancelAllForTrip).not.toHaveBeenCalled();
    expect(drivers.incrementCancellations).not.toHaveBeenCalled();
  });
});

describe('TripsService.cancelAbandoned — trajet délaissé par son conducteur', () => {
  it('annule, rembourse tous les clients (initiateur SYSTÈME), compte l\'annulation au conducteur et laisse une trace', async () => {
    const { service, prisma, bookings, drivers } = createService(TripStatus.PUBLISHED);
    await expect(service.cancelAbandoned('t1', 'Trajet abandonné')).resolves.toBe(true);
    expect(prisma.trip.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 't1',
          status: { in: [TripStatus.PUBLISHED, TripStatus.DRIVER_ARRIVED] },
          shipments: { none: { status: { in: expect.arrayContaining(['DRIVER_ASSIGNED', 'IN_TRANSIT']) } } },
        }),
        data: { status: TripStatus.CANCELLED },
      }),
    );
    expect(bookings.cancelAllForTrip).toHaveBeenCalledWith('t1', 'Trajet abandonné', 'SYSTEM');
    expect(drivers.incrementCancellations).toHaveBeenCalledWith('d1');
  });

  it('trajet parti, annulé ou chargé d\'un colis entre-temps (réclamation perdue) : rien n\'est remboursé ni compté', async () => {
    const { service, bookings, drivers } = createService(TripStatus.PUBLISHED, { claimCount: 0 });
    await expect(service.cancelAbandoned('t1', 'Trajet abandonné')).resolves.toBe(false);
    expect(bookings.cancelAllForTrip).not.toHaveBeenCalled();
    expect(drivers.incrementCancellations).not.toHaveBeenCalled();
  });
});

describe('TripsService.completeTrip — clôture réclamée une seule fois', () => {
  function completeBuild(options: { unfinished?: number; claimCount?: number; currentStatus?: TripStatus } = {}) {
    const prisma = {
      booking: { count: jest.fn().mockResolvedValue(options.unfinished ?? 0) },
      trip: {
        updateMany: jest.fn().mockResolvedValue({ count: options.claimCount ?? 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't1', status: options.currentStatus ?? TripStatus.COMPLETED }),
      },
    };
    const drivers = { incrementCompletedTrips: jest.fn().mockResolvedValue(undefined) };
    const service = new TripsService(prisma as never, {} as never, {} as never, {} as never, drivers as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    jest.spyOn(service as never, 'assertOwnership').mockResolvedValue({ id: 't1', driverId: 'd1', status: TripStatus.ARRIVED } as never);
    return { service, prisma, drivers };
  }

  it('clôture normale : course comptée une fois', async () => {
    const { service, drivers } = completeBuild();
    await service.completeTrip('t1', 'd1');
    expect(drivers.incrementCompletedTrips).toHaveBeenCalledTimes(1);
  });

  it('clôture automatique passée juste avant : on renvoie le trajet sans recompter la course', async () => {
    const { service, drivers } = completeBuild({ claimCount: 0, currentStatus: TripStatus.COMPLETED });
    await expect(service.completeTrip('t1', 'd1')).resolves.toMatchObject({ status: TripStatus.COMPLETED });
    expect(drivers.incrementCompletedTrips).not.toHaveBeenCalled();
  });

  it('trajet ni clos ni clôturable (ex. réservation relancée entre-temps) : refusé', async () => {
    const { service, drivers } = completeBuild({ claimCount: 0, currentStatus: TripStatus.ARRIVED });
    await expect(service.completeTrip('t1', 'd1')).rejects.toBeInstanceOf(BadRequestException);
    expect(drivers.incrementCompletedTrips).not.toHaveBeenCalled();
  });
});

