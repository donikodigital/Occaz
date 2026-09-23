// backend/src/trips/booking-expiry.service.spec.ts
// [22/09/2026] v2 — délai en minutes (booking.unpaid_expiry_minutes, 15 par défaut).
import { BookingStatus } from '@prisma/client';
import { BookingExpiryService } from './booking-expiry.service';

/**
 * Une réservation impayée expire au premier des deux cas : plus de
 * `booking.unpaid_expiry_hours` depuis sa création, ou le trajet est déjà
 * parti (filet de sécurité) — c'est ce second cas que le bug remonté par
 * l'utilisateur touchait (réservations "À payer" restées bloquées bien
 * après le départ du trajet).
 */
function createService(options: { staleBookings?: { id: string }[]; expiryMinutes?: number } = {}) {
  const findMany = jest.fn().mockResolvedValue(options.staleBookings ?? []);
  const prisma = { booking: { findMany } };
  const pricing = { getNumericSetting: jest.fn().mockResolvedValue(options.expiryMinutes ?? 15) };
  const bookings = { expireUnpaid: jest.fn().mockResolvedValue(true) };
  const service = new BookingExpiryService(prisma as never, pricing as never, bookings as never);
  return { service, prisma, pricing, bookings };
}

describe('BookingExpiryService.runOnce', () => {
  it('interroge avec le délai configuré ET les trajets déjà partis', async () => {
    const { service, prisma, pricing } = createService({ expiryMinutes: 30 });
    await service.runOnce();

    expect(pricing.getNumericSetting).toHaveBeenCalledWith('booking.unpaid_expiry_minutes', 15);
    const call = prisma.booking.findMany.mock.calls[0][0];
    expect(call.where.status).toBe(BookingStatus.PENDING_PAYMENT);
    expect(call.where.OR).toEqual([
      { createdAt: { lt: expect.any(Date) } },
      { trip: { departureAt: { lt: expect.any(Date) } } },
    ]);
  });

  it('expire chaque réservation trouvée', async () => {
    const { service, bookings } = createService({ staleBookings: [{ id: 'b1' }, { id: 'b2' }] });
    await service.runOnce();
    expect(bookings.expireUnpaid).toHaveBeenCalledTimes(2);
    expect(bookings.expireUnpaid).toHaveBeenCalledWith('b1', expect.any(String));
    expect(bookings.expireUnpaid).toHaveBeenCalledWith('b2', expect.any(String));
  });

  it("continue avec les suivantes quand l'une échoue", async () => {
    const { service, bookings } = createService({ staleBookings: [{ id: 'a' }, { id: 'b' }] });
    bookings.expireUnpaid.mockRejectedValueOnce(new Error('boom'));
    await service.runOnce();
    expect(bookings.expireUnpaid).toHaveBeenCalledTimes(2);
  });

  it('ne relance pas un passage déjà en cours', async () => {
    const { service, prisma } = createService();
    const first = service.runOnce();
    const second = service.runOnce();
    await Promise.all([first, second]);
    expect(prisma.booking.findMany).toHaveBeenCalledTimes(1);
  });
});