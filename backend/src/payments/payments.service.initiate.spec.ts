// backend/src/payments/payments.service.initiate.spec.ts
// Lancement d'un paiement : seule une réservation « à payer » (ou un envoi tout juste créé) peut être payée ; double appui sans erreur.
import { ConflictException } from '@nestjs/common';
import { BookingStatus, PaymentStatus, Prisma, ShipmentStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';

function build(options: {
  payment?: { id: string; status: PaymentStatus; bookingId?: string | null; shipmentId?: string | null } | null;
  bookingStatus?: BookingStatus;
  shipmentStatus?: ShipmentStatus;
  createFailsWithUnique?: boolean;
  forShipment?: boolean;
} = {}) {
  const existing = options.payment === undefined ? null : options.payment;
  const uniqueError = Object.assign(new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }), { code: 'P2002' });
  const createdPayment = { id: 'pay1', bookingId: options.forShipment ? null : 'b1', shipmentId: options.forShipment ? 's1' : null, amount: 100n, currencyId: 'GNF', status: PaymentStatus.PENDING };
  const prisma = {
    payment: {
      findUnique: options.createFailsWithUnique
        ? jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(createdPayment)
        : jest.fn().mockResolvedValue(existing ? { amount: 100n, currencyId: 'GNF', bookingId: 'b1', shipmentId: null, ...existing } : null),
      create: options.createFailsWithUnique ? jest.fn().mockRejectedValue(uniqueError) : jest.fn().mockResolvedValue(createdPayment),
    },
    booking: { findUnique: jest.fn().mockResolvedValue({ id: 'b1', customerId: 'c1', status: options.bookingStatus ?? BookingStatus.PENDING_PAYMENT, totalAmount: 100n, currencyId: 'GNF' }) },
    shipment: { findUnique: jest.fn().mockResolvedValue({ id: 's1', customerId: 'c1', status: options.shipmentStatus ?? ShipmentStatus.CREATED, totalAmount: 100n, currencyId: 'GNF' }) },
    currency: { findUniqueOrThrow: jest.fn().mockResolvedValue({ isoCode: 'GNF' }) },
    paymentTransaction: { create: jest.fn().mockResolvedValue({ id: 'tx1' }), update: jest.fn().mockResolvedValue({}) },
  };
  const adapter = { initiate: jest.fn().mockResolvedValue({ externalReference: 'ext1' }) };
  const providers = { findOne: jest.fn().mockResolvedValue({ id: 'prov1', isActive: true, type: 'ORANGE_MONEY' }) };
  const service = new PaymentsService(prisma as never, providers as never, { resolve: () => adapter } as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  return { service, prisma, adapter };
}

const ask = (service: PaymentsService, dto: Record<string, unknown> = { bookingId: 'b1', providerId: 'prov1' }) => service.initiate({ customerId: 'c1' }, dto as never);

describe('PaymentsService.initiate', () => {
  it('réservation à payer : le paiement est lancé', async () => {
    const { service, adapter } = build();
    await expect(ask(service)).resolves.toEqual(expect.objectContaining({ paymentId: 'pay1', externalReference: 'ext1' }));
    expect(adapter.initiate).toHaveBeenCalledTimes(1);
  });

  it.each([BookingStatus.CANCELLED, BookingStatus.CONFIRMED, BookingStatus.REFUNDED, BookingStatus.COMPLETED])(
    'réservation %s : refusée AVANT tout débit chez le prestataire',
    async (bookingStatus) => {
      const { service, adapter, prisma } = build({ bookingStatus });
      await expect(ask(service)).rejects.toBeInstanceOf(ConflictException);
      expect(adapter.initiate).not.toHaveBeenCalled();
      expect(prisma.paymentTransaction.create).not.toHaveBeenCalled();
    },
  );

  it('envoi déjà annulé : refusé', async () => {
    const { service, adapter } = build({ shipmentStatus: ShipmentStatus.CANCELLED, forShipment: true });
    await expect(ask(service, { shipmentId: 's1', providerId: 'prov1' })).rejects.toBeInstanceOf(ConflictException);
    expect(adapter.initiate).not.toHaveBeenCalled();
  });

  it.each([PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.CAPTURED])('paiement déjà %s : refusé', async (status) => {
    const { service, adapter } = build({ payment: { id: 'pay1', status } });
    await expect(ask(service)).rejects.toBeInstanceOf(ConflictException);
    expect(adapter.initiate).not.toHaveBeenCalled();
  });

  it('paiement précédent échoué : on peut réessayer', async () => {
    const { service, adapter } = build({ payment: { id: 'pay1', status: PaymentStatus.FAILED } });
    await expect(ask(service)).resolves.toBeDefined();
    expect(adapter.initiate).toHaveBeenCalledTimes(1);
  });

  it('double appui : le paiement créé par l\'autre requête est repris au lieu d\'une erreur', async () => {
    const { service, adapter } = build({ createFailsWithUnique: true });
    await expect(ask(service)).resolves.toEqual(expect.objectContaining({ paymentId: 'pay1' }));
    expect(adapter.initiate).toHaveBeenCalledTimes(1);
  });
});
