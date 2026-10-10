// backend/src/tickets/ticket-scan.service.spec.ts
import { ForbiddenException } from '@nestjs/common';
import { TicketScanService } from './ticket-scan.service';
import { bookingQrPayload, parcelQrPayload } from './ticket-codes';

const BOOKING_ID = '7f3a91c2-1111-4222-8333-444455556666';
const SHIPMENT_ID = 'b0c1d2e3-f4a5-4678-8901-23456789abcd';

const bookingRow = (extra: Record<string, unknown> = {}) => ({
  id: BOOKING_ID,
  tripId: 't1',
  status: 'CONFIRMED',
  seatsCount: 2,
  trip: {
    driverId: 'drv1',
    departureAt: new Date('2026-10-12T08:30:00Z'),
    originCity: { name: 'Conakry' },
    destinationCity: { name: 'Labé' },
  },
  passengers: [
    { fullName: 'Boubacar Barry', pickedUpAt: new Date() },
    { fullName: 'Fatou Barry', pickedUpAt: null },
  ],
  customer: { firstName: 'Boubacar', lastName: 'Barry' },
  boardingStop: null,
  alightingStop: { city: { name: 'Mamou' } },
  ...extra,
});

const shipmentRow = (extra: Record<string, unknown> = {}) => ({
  id: SHIPMENT_ID,
  driverId: 'drv1',
  status: 'PICKED_UP',
  quantity: 3,
  weightKg: 9,
  recipientName: 'Aïssatou Bah',
  category: { name: 'Colis' },
  items: [],
  senderLocation: { label: 'Kindia centre', city: { name: 'Kindia' } },
  recipientLocation: { label: 'Wondima', city: { name: 'Labé' } },
  ...extra,
});

function build(options: { driver?: unknown; booking?: unknown; shipment?: unknown } = {}) {
  const prisma = {
    driverProfile: { findUnique: jest.fn().mockResolvedValue('driver' in options ? options.driver : { id: 'drv1' }) },
    booking: { findUnique: jest.fn().mockResolvedValue('booking' in options ? options.booking : bookingRow()) },
    shipment: { findUnique: jest.fn().mockResolvedValue('shipment' in options ? options.shipment : shipmentRow()) },
  };
  return { service: new TicketScanService(prisma as never), prisma };
}

describe('TicketScanService — billets', () => {
  it('reconnaît le billet d’un de ses trajets, avec les passagers et ceux déjà à bord', async () => {
    const { service } = build();
    const result = await service.scan('u1', bookingQrPayload(BOOKING_ID));
    expect(result).toMatchObject({ valid: true, kind: 'BOOKING' });
    expect(result.booking).toMatchObject({
      bookingId: BOOKING_ID,
      tripId: 't1',
      reference: 'OCZ-7F3A91C2',
      passengers: ['Boubacar Barry', 'Fatou Barry'],
      seatsCount: 2,
      boardedCount: 1,
      from: 'Conakry',
      to: 'Mamou',
    });
  });

  it('refuse un code fabriqué à la main (signature fausse), sans même lire la base', async () => {
    const { service, prisma } = build();
    const forged = `OCCAZ1:B:${BOOKING_ID}:AAAAAAAAAAAAAAAA`;
    await expect(service.scan('u1', forged)).resolves.toMatchObject({ valid: false, reason: 'INVALID' });
    expect(prisma.booking.findUnique).not.toHaveBeenCalled();
  });

  it('refuse un texte quelconque', async () => {
    const { service } = build();
    await expect(service.scan('u1', 'https://exemple.com/promo')).resolves.toMatchObject({ valid: false, reason: 'INVALID' });
  });

  it('refuse le billet d’un trajet d’un autre conducteur', async () => {
    const { service } = build({ booking: bookingRow({ trip: { ...bookingRow().trip, driverId: 'someone-else' } }) });
    await expect(service.scan('u1', bookingQrPayload(BOOKING_ID))).resolves.toMatchObject({ valid: false, reason: 'OTHER_DRIVER' });
  });

  it.each(['CANCELLED', 'REFUNDED', 'PENDING_PAYMENT'])('refuse une réservation %s', async (status) => {
    const { service } = build({ booking: bookingRow({ status }) });
    await expect(service.scan('u1', bookingQrPayload(BOOKING_ID))).resolves.toMatchObject({ valid: false, reason: 'NOT_ACTIVE' });
  });

  it('refuse un billet dont la réservation n’existe plus', async () => {
    const { service } = build({ booking: null });
    await expect(service.scan('u1', bookingQrPayload(BOOKING_ID))).resolves.toMatchObject({ valid: false, reason: 'INVALID' });
  });

  it('réservé aux conducteurs', async () => {
    const { service } = build({ driver: null });
    await expect(service.scan('u1', bookingQrPayload(BOOKING_ID))).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('TicketScanService — colis', () => {
  it('reconnaît l’étiquette d’un de ses envois', async () => {
    const { service } = build();
    const result = await service.scan('u1', parcelQrPayload(SHIPMENT_ID, 2));
    expect(result).toMatchObject({ valid: true, kind: 'PARCEL' });
    expect(result.parcel).toMatchObject({
      shipmentId: SHIPMENT_ID,
      trackingNumber: 'OCZ B0C1 D2E3 F4',
      parcelNumber: 2,
      parcelCount: 3,
      from: 'Kindia',
      to: 'Labé',
      recipientName: 'Aïssatou Bah',
    });
  });

  it('refuse un numéro de colis au-delà de la quantité de l’envoi', async () => {
    const { service } = build();
    await expect(service.scan('u1', parcelQrPayload(SHIPMENT_ID, 9))).resolves.toMatchObject({ valid: false, reason: 'INVALID' });
  });

  it('refuse l’envoi d’un autre conducteur', async () => {
    const { service } = build({ shipment: shipmentRow({ driverId: 'someone-else' }) });
    await expect(service.scan('u1', parcelQrPayload(SHIPMENT_ID, 1))).resolves.toMatchObject({ valid: false, reason: 'OTHER_DRIVER' });
  });

  it.each(['CREATED', 'CANCELLED', 'REFUNDED'])('refuse un envoi %s', async (status) => {
    const { service } = build({ shipment: shipmentRow({ status }) });
    await expect(service.scan('u1', parcelQrPayload(SHIPMENT_ID, 1))).resolves.toMatchObject({ valid: false, reason: 'NOT_ACTIVE' });
  });
});
