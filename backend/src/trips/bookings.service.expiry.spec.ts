// backend/src/trips/bookings.service.expiry.spec.ts
import { BookingStatus } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { DOMAIN_EVENTS } from '../common/events/domain-events';

/**
 * expireUnpaid : une réservation jamais payée libère la place qu'elle
 * bloquait (voir create() — la place est décomptée dès la réservation,
 * avant tout paiement) et n'a d'effet que si elle est toujours "À payer".
 */
function createService(options: { claimCount?: number; booking?: Record<string, unknown> | null } = {}) {
  const booking = options.booking !== undefined ? options.booking : { id: 'b1', tripId: 't1', seatsCount: 2 };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ status: 'PUBLISHED', totalSeats: 4 }]),
    booking: {
      updateMany: jest.fn().mockResolvedValue({ count: options.claimCount ?? 1 }),
      // réservations qui occupent encore des places une fois celle-ci annulée : 1 place prise sur tout le trajet
      findMany: jest.fn().mockResolvedValue([{ seatsCount: 1, boardingStopId: null, alightingStopId: null }]),
    },
    trip: {
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue({
        id: 't1', totalSeats: 4, departureAt: new Date(), pricePerSeat: 100_000n, originCityId: 'a',
        originLocationId: 'la', destinationCityId: 'b', destinationLocationId: 'lb', stops: [],
      }),
    },
  };
  const prisma = {
    booking: { findUnique: jest.fn().mockResolvedValue(booking) },
    $transaction: jest.fn().mockImplementation((callback: (client: unknown) => unknown) => callback(tx)),
  };
  const eventEmitter = { emit: jest.fn() };
  const service = new BookingsService(prisma as never, {} as never, eventEmitter as never, {} as never, { notify: jest.fn().mockResolvedValue(undefined) } as never);
  return { service, prisma, tx, eventEmitter };
}

describe('BookingsService.expireUnpaid', () => {
  it('annule et restitue les places réservées', async () => {
    const { service, tx, eventEmitter } = createService();
    await expect(service.expireUnpaid('b1', 'Paiement non effectué dans le délai imparti.')).resolves.toBe(true);

    expect(tx.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'b1', status: BookingStatus.PENDING_PAYMENT },
        data: expect.objectContaining({ status: BookingStatus.CANCELLED }),
      }),
    );
    // compteur recalculé : 4 places − 1 encore réservée = 3 libres (et non plus « +2 » à l'aveugle)
    expect(tx.trip.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { availableSeats: 3 } });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DOMAIN_EVENTS.BOOKING_CANCELLED,
      expect.objectContaining({ bookingId: 'b1', refundEligiblePercentage: 0 }),
    );
  });

  it('ne fait rien si la réservation a été payée ou annulée entre-temps', async () => {
    const { service, tx, eventEmitter } = createService({ claimCount: 0 });
    await expect(service.expireUnpaid('b1', 'raison')).resolves.toBe(false);
    expect(tx.trip.update).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it("ne fait rien si la réservation n'existe plus", async () => {
    const { service, eventEmitter } = createService({ booking: null });
    await expect(service.expireUnpaid('b1', 'raison')).resolves.toBe(false);
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});