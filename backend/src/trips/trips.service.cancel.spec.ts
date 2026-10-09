// backend/src/trips/trips.service.cancel.spec.ts
// Annulation par le conducteur : possible tant que personne n'est monté, refusée dès que le trajet a commencé
// (le recours est alors le litige, toujours ouvert).
import { TripStatus } from '@prisma/client';
import { TripsService } from './trips.service';

function createService(status: TripStatus) {
  const prisma = { trip: { update: jest.fn().mockResolvedValue({}) } };
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
      expect(prisma.trip.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { status: TripStatus.CANCELLED } });
      expect(bookings.cancelAllForTrip).toHaveBeenCalled();
    },
  );

  it.each([TripStatus.PASSENGER_PICKED_UP, TripStatus.IN_PROGRESS, TripStatus.ARRIVED])(
    'statut %s : annulation refusée, aucune réservation remboursée',
    async (status) => {
      const { service, prisma, bookings, drivers } = createService(status);
      await expect(service.cancel('t1', 'd1', 'Imprévu')).rejects.toThrow(/a commencé/);
      expect(prisma.trip.update).not.toHaveBeenCalled();
      expect(bookings.cancelAllForTrip).not.toHaveBeenCalled();
      expect(drivers.incrementCancellations).not.toHaveBeenCalled();
    },
  );
});