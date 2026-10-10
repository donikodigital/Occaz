// backend/src/tickets/tickets.service.spec.ts
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { bookingReference, readDownloadToken } from './ticket-codes';

const BOOKING_ID = '7f3a91c2-1111-4222-8333-444455556666';
const SHIPMENT_ID = 'b0c1d2e3-f4a5-4678-8901-23456789abcd';

const bookingRow = (extra: Record<string, unknown> = {}) => ({
  id: BOOKING_ID,
  customerId: 'cust1',
  status: 'CONFIRMED',
  seatsCount: 2,
  totalAmount: 235_000n,
  createdAt: new Date('2026-10-09T14:00:00Z'),
  currency: { isoCode: 'GNF' },
  passengers: [{ fullName: 'Boubacar BARRY' }, { fullName: 'Fatou BARRY' }],
  boardingStop: null,
  alightingStop: null,
  customer: { firstName: 'Boubacar', lastName: 'BARRY', user: { email: 'boubacar@example.com' } },
  trip: {
    departureAt: new Date('2026-10-12T08:30:00Z'),
    originCity: { name: 'Conakry' },
    destinationCity: { name: 'Kindia' },
    originLocation: { label: 'Gare routière de Madina' },
    destinationLocation: { label: 'Carrefour de la gare' },
    driver: { firstName: 'Mamadou', lastName: 'DIALLO' },
    vehicle: { brand: 'Toyota', model: 'Hiace', color: 'blanc', plateNumber: 'AB-1234-GN' },
  },
  ...extra,
});

const shipmentRow = (extra: Record<string, unknown> = {}) => ({
  id: SHIPMENT_ID,
  customerId: 'cust1',
  status: 'SEARCHING_DRIVER',
  senderName: 'Boubacar BARRY',
  recipientName: 'Aïssatou Bah',
  recipientPhone: '+224620000002',
  isUrgent: false,
  quantity: 3,
  weightKg: 9,
  lengthCm: 40,
  widthCm: 30,
  heightCm: 20,
  declaredValue: 300_000n,
  description: 'Vêtements',
  windowEnd: new Date('2026-10-15T18:00:00Z'),
  currency: { isoCode: 'GNF' },
  category: { name: 'Colis' },
  items: [],
  senderLocation: { label: 'Kindia centre', city: { name: 'Kindia', country: { name: 'Guinée' } } },
  recipientLocation: { label: 'Wondima', formattedAddress: 'Quartier Wondima, Labé', city: { name: 'Labé', country: { name: 'Guinée' } } },
  customer: { firstName: 'Boubacar', user: { email: 'boubacar@example.com' } },
  ...extra,
});

function build(options: { booking?: unknown; shipment?: unknown; customerId?: string | null; staff?: boolean } = {}) {
  const prisma = {
    booking: { findUnique: jest.fn().mockResolvedValue('booking' in options ? options.booking : bookingRow()) },
    shipment: { findUnique: jest.fn().mockResolvedValue('shipment' in options ? options.shipment : shipmentRow()) },
  };
  const emailProvider = { send: jest.fn().mockResolvedValue(undefined) };
  const customerProfiles = {
    findByUserId: jest.fn().mockImplementation(() =>
      options.customerId === null ? Promise.reject(new Error('no profile')) : Promise.resolve({ id: options.customerId ?? 'cust1' }),
    ),
  };
  const scope = {
    hasBookingAccess: jest.fn().mockResolvedValue(options.staff ?? false),
    hasShipmentAccess: jest.fn().mockResolvedValue(options.staff ?? false),
  };
  const service = new TicketsService(prisma as never, emailProvider as never, customerProfiles as never, scope as never);
  return { service, prisma, emailProvider, scope };
}

const user = { id: 'u1' } as never;

describe('TicketsService — liens de téléchargement', () => {
  it('donne un lien au propriétaire d\'une réservation payée', async () => {
    const { service } = build();
    const link = await service.bookingDownloadLink(BOOKING_ID, user);
    expect(link.filename).toBe(`billet-${bookingReference(BOOKING_ID)}.pdf`);
    const token = link.path.replace('tickets/download/', '');
    expect(readDownloadToken(token)).toEqual({ kind: 'BOOKING', id: BOOKING_ID });
  });

  it('refuse un autre client, accepte le support autorisé', async () => {
    await expect(build({ customerId: 'autre' }).service.bookingDownloadLink(BOOKING_ID, user)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(build({ customerId: null, staff: true }).service.bookingDownloadLink(BOOKING_ID, user)).resolves.toBeDefined();
  });

  it('refuse un billet pour une réservation non payée, annulée ou remboursée', async () => {
    for (const status of ['PENDING_PAYMENT', 'CANCELLED', 'REFUNDED']) {
      await expect(build({ booking: bookingRow({ status }) }).service.bookingDownloadLink(BOOKING_ID, user)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('réservation ou envoi introuvable', async () => {
    await expect(build({ booking: null }).service.bookingDownloadLink(BOOKING_ID, user)).rejects.toBeInstanceOf(NotFoundException);
    await expect(build({ shipment: null }).service.shipmentDownloadLink(SHIPMENT_ID, user)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('étiquettes : refusées tant que l\'envoi n\'est pas payé, ou une fois annulé', async () => {
    for (const status of ['CREATED', 'CANCELLED', 'REFUNDED']) {
      await expect(build({ shipment: shipmentRow({ status }) }).service.shipmentDownloadLink(SHIPMENT_ID, user)).rejects.toBeInstanceOf(BadRequestException);
    }
    await expect(build().service.shipmentDownloadLink(SHIPMENT_ID, user)).resolves.toMatchObject({ filename: expect.stringMatching(/^etiquettes-OCZ/) });
  });

  it('le jeton d\'un lien ouvre le bon PDF ; un jeton falsifié est refusé', async () => {
    const { service } = build();
    const { path } = await service.bookingDownloadLink(BOOKING_ID, user);
    const file = await service.fileForToken(path.replace('tickets/download/', ''));
    expect(file.buffer.subarray(0, 5).toString()).toBe('%PDF-');
    await expect(service.fileForToken('jeton.falsifie')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('TicketsService — e-mail à la confirmation du paiement', () => {
  it('envoie le billet en pièce jointe PDF quand le client a une adresse e-mail', async () => {
    const { service, emailProvider } = build();
    await expect(service.emailBookingTicket(BOOKING_ID)).resolves.toBe(true);
    const [to, subject, body, action, attachments] = emailProvider.send.mock.calls[0];
    expect(to).toBe('boubacar@example.com');
    expect(subject).toContain('Conakry');
    expect(subject).toContain('Kindia');
    expect(body).toContain(bookingReference(BOOKING_ID));
    expect(body).not.toMatch(/\b\d{6}\b/); // jamais de code à usage unique
    expect(action).toBeUndefined();
    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({ filename: `billet-${bookingReference(BOOKING_ID)}.pdf`, contentType: 'application/pdf' });
    expect(attachments[0].content.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('n\'envoie rien (sans erreur) quand le client n\'a pas d\'adresse e-mail', async () => {
    const { service, emailProvider } = build({
      booking: bookingRow({ customer: { firstName: 'Boubacar', lastName: 'BARRY', user: { email: null } } }),
    });
    await expect(service.emailBookingTicket(BOOKING_ID)).resolves.toBe(false);
    expect(emailProvider.send).not.toHaveBeenCalled();
  });

  it('envoie les étiquettes : une page par colis (ancien envoi : quantité)', async () => {
    const { service, emailProvider } = build();
    await expect(service.emailShipmentLabels(SHIPMENT_ID)).resolves.toBe(true);
    const attachments = emailProvider.send.mock.calls[0][4];
    const pages = (attachments[0].content.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;
    expect(pages).toBe(3);
    expect(emailProvider.send.mock.calls[0][1]).toContain('Labé');
  });

  it('étiquettes d\'un envoi saisi colis par colis : une page par ShipmentItem, avec ses propres mesures', async () => {
    const items = [
      { weightKg: 3, lengthCm: 40, widthCm: 30, heightCm: 20, declaredValue: 200_000n, description: 'Chaussures' },
      { weightKg: 12, lengthCm: null, widthCm: null, heightCm: null, declaredValue: null, description: null },
    ];
    const { service } = build({ shipment: shipmentRow({ quantity: 2, items }) });
    const { labels } = await service.loadParcelLabels(SHIPMENT_ID);
    expect(labels).toHaveLength(2);
    expect(labels[0]).toMatchObject({ parcelNumber: 1, parcelCount: 2, weightKg: 3, dimensions: '40 × 30 × 20', description: 'Chaussures' });
    expect(labels[0].declaredValue).toContain('200');
    expect(labels[1]).toMatchObject({ parcelNumber: 2, weightKg: 12, dimensions: null, declaredValue: null });
    expect(labels[0].trackingNumber).not.toBe(labels[1].trackingNumber);
  });

  it('un échec d\'e-mail ne remonte jamais à celui qui a déclenché l\'événement', async () => {
    const { service, emailProvider } = build();
    emailProvider.send.mockRejectedValue(new Error('Resend a répondu 500'));
    await expect(service.onBookingPaid({ bookingId: BOOKING_ID })).resolves.toBeUndefined();
    await expect(service.onShipmentPaid({ shipmentId: SHIPMENT_ID })).resolves.toBeUndefined();
  });
});
