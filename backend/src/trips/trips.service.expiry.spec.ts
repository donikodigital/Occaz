// backend/src/trips/trips.service.expiry.spec.ts
import { BookingStatus, TripStatus } from '@prisma/client';
import { TripsService } from './trips.service';

/**
 * expireStale : annule un trajet publié (ou "conducteur arrivé") sans
 * aucune réservation active, dont le départ est passé — la mise à jour
 * conditionnelle (status + aucune réservation active) garantit qu'un
 * trajet qui vient d'être réservé entre-temps n'est jamais annulé par
 * erreur.
 */
function createService(options: { claimCount?: number } = {}) {
  const prisma = {
    trip: { updateMany: jest.fn().mockResolvedValue({ count: options.claimCount ?? 1 }) },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new TripsService(
    prisma as never,
    audit as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { notify: jest.fn().mockResolvedValue(undefined) } as never,
    {} as never,
    {} as never,
  );
  return { service, prisma, audit };
}

describe('TripsService.expireStale', () => {
  it('annule le trajet et journalise, sans acteur (système)', async () => {
    const { service, prisma, audit } = createService();
    await expect(service.expireStale('t1', 'Trajet resté sans réservation bien après son départ.')).resolves.toBe(true);

    expect(prisma.trip.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 't1',
          status: { in: [TripStatus.PUBLISHED, TripStatus.DRIVER_ARRIVED] },
          bookings: { none: { status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.PAID, BookingStatus.CONFIRMED] } } },
          // Un envoi accepté et pas encore livré empêche l'expiration du trajet.
          shipments: expect.objectContaining({ none: expect.objectContaining({ status: expect.anything() }) }),
        }),
        data: { status: TripStatus.CANCELLED },
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ actorId: null, action: 'AUTO_EXPIRE' }));
  });

  it('ne fait rien si une réservation a été prise entre-temps, ou si le trajet a déjà changé de statut', async () => {
    const { service, audit } = createService({ claimCount: 0 });
    await expect(service.expireStale('t1', 'raison')).resolves.toBe(false);
    expect(audit.log).not.toHaveBeenCalled();
  });
});