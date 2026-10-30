// backend/src/payments/payments.service.settle.spec.ts
// Règlement des paiements : webhook rejoué, échec tardif, paiement après annulation, reprise après erreur.
import { PaymentProviderType, PaymentStatus, ShipmentStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';

type Tx = { id: string; paymentId: string; status: PaymentStatus; amount?: bigint; currencyId?: string };

function build(options: {
  transaction?: Partial<Tx>;
  claimTransaction?: number;
  claimPayment?: number;
  confirmOutcome?: 'CONFIRMED' | 'ALREADY_CONFIRMED' | 'NOT_PAYABLE';
  holdFails?: boolean;
  shipmentStatus?: ShipmentStatus;
  paymentOf?: 'booking' | 'shipment';
  refundFails?: boolean;
  bookingAmounts?: { totalAmount: bigint; platformFee: bigint };
} = {}) {
  const transaction: Tx = { id: 'tx1', paymentId: 'pay1', status: PaymentStatus.PENDING, currencyId: 'GNF', ...options.transaction };
  const payment =
    options.paymentOf === 'shipment'
      ? { id: 'pay1', bookingId: null, shipmentId: 's1', status: PaymentStatus.CAPTURED }
      : { id: 'pay1', bookingId: 'b1', shipmentId: null, status: PaymentStatus.CAPTURED };
  const booking = {
    id: 'b1',
    totalAmount: options.bookingAmounts?.totalAmount ?? 115_000n,
    platformFee: options.bookingAmounts?.platformFee ?? 15_000n,
    currencyId: 'GNF',
    seatsCount: 1,
    customer: { userId: 'uc' },
    trip: { id: 't1', driverId: 'dr1', driver: { userId: 'ud' }, originCity: { name: 'A' }, destinationCity: { name: 'B' } },
  };
  const shipment = {
    id: 's1',
    status: options.shipmentStatus ?? ShipmentStatus.CREATED,
    driverId: null,
    customer: { userId: 'uc' },
    totalAmount: 150_000n,
    platformFee: 15_000n,
    currencyId: 'GNF',
  };
  const prisma = {
    paymentTransaction: {
      findFirst: jest.fn().mockResolvedValue(transaction),
      updateMany: jest.fn().mockResolvedValue({ count: options.claimTransaction ?? 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    payment: {
      updateMany: jest.fn().mockResolvedValue({ count: options.claimPayment ?? 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(payment),
      update: jest.fn().mockResolvedValue({}),
    },
    booking: { findUniqueOrThrow: jest.fn().mockResolvedValue(booking), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    shipment: { findUniqueOrThrow: jest.fn().mockResolvedValue(shipment), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    currency: { findUnique: jest.fn().mockResolvedValue({ isoCode: 'GNF' }) },
  };
  const wallets = {
    holdBookingRevenue: options.holdFails
      ? jest.fn().mockRejectedValue(new Error('portefeuille indisponible'))
      : jest.fn().mockResolvedValue(undefined),
    holdShipmentRevenue: jest.fn().mockResolvedValue(undefined),
  };
  const bookingsService = { confirmPayment: jest.fn().mockResolvedValue(options.confirmOutcome ?? 'CONFIRMED') };
  const shipmentsService = {
    // Même décision atomique que ShipmentsService.confirmPayment : un envoi annulé n'est jamais ressuscité.
    confirmPayment: jest
      .fn()
      .mockResolvedValue(
        shipment.status === ShipmentStatus.CANCELLED || shipment.status === ShipmentStatus.REFUNDED ? 'NOT_PAYABLE' : 'CONFIRMED',
      ),
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const referrals = { handleFirstPaymentConfirmed: jest.fn().mockResolvedValue(undefined) };
  const service = new PaymentsService(
    prisma as never,
    {} as never,
    {} as never,
    wallets as never,
    bookingsService as never,
    shipmentsService as never,
    notifications as never,
    referrals as never,
  );
  const refundBooking = jest.spyOn(service, 'refundBooking');
  const refundShipment = jest.spyOn(service, 'refundShipment');
  if (options.refundFails) {
    refundBooking.mockRejectedValue(new Error('prestataire indisponible'));
    refundShipment.mockRejectedValue(new Error('prestataire indisponible'));
  } else {
    refundBooking.mockResolvedValue(0n);
    refundShipment.mockResolvedValue(0n);
  }
  return { service, prisma, wallets, bookingsService, shipmentsService, refundBooking, refundShipment };
}

const settle = (service: PaymentsService, status: 'CAPTURED' | 'FAILED') =>
  service.handleWebhook(PaymentProviderType.ORANGE_MONEY, { externalReference: 'ref', status }, {});
// handleWebhook délègue l'authentification à l'adaptateur : on court-circuite le registre pour tester le règlement seul.
function withAdapter(service: PaymentsService, status: 'CAPTURED' | 'FAILED', reported: { amount?: bigint; currencyIsoCode?: string } = {}) {
  (service as unknown as { registry: unknown }).registry = {
    resolve: () => ({ verifyAndParseWebhook: async () => ({ externalReference: 'ref', status, ...reported }) }),
  };
  return settle(service, status);
}

describe('PaymentsService — règlement des paiements', () => {
  it('capture : crédite le conducteur une fois, confirme la réservation', async () => {
    const { service, wallets, bookingsService } = build();
    await expect(withAdapter(service, 'CAPTURED')).resolves.toEqual({ paymentId: 'pay1', status: PaymentStatus.CAPTURED });
    expect(bookingsService.confirmPayment).toHaveBeenCalledWith('b1');
    expect(wallets.holdBookingRevenue).toHaveBeenCalledTimes(1);
  });

  it('webhook rejoué (transaction déjà capturée) : ne retraite rien', async () => {
    const { service, wallets, prisma } = build({ transaction: { status: PaymentStatus.CAPTURED } });
    await withAdapter(service, 'CAPTURED');
    expect(prisma.paymentTransaction.updateMany).not.toHaveBeenCalled();
    expect(wallets.holdBookingRevenue).not.toHaveBeenCalled();
  });

  it('deux webhooks simultanés : seul celui qui réclame la capture crédite le conducteur', async () => {
    const { service, wallets } = build({ claimTransaction: 0 });
    await withAdapter(service, 'CAPTURED');
    expect(wallets.holdBookingRevenue).not.toHaveBeenCalled();
  });

  it('paiement déjà capturé par une autre tentative : pas de second crédit', async () => {
    const { service, wallets } = build({ claimPayment: 0 });
    await withAdapter(service, 'CAPTURED');
    expect(wallets.holdBookingRevenue).not.toHaveBeenCalled();
  });

  it('un échec tardif n\'écrase jamais un paiement déjà capturé', async () => {
    const { service, prisma } = build();
    await withAdapter(service, 'FAILED');
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { notIn: [PaymentStatus.CAPTURED, PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED] },
        }),
      }),
    );
  });

  it('paiement arrivé après annulation de la réservation : remboursement intégral, conducteur non crédité', async () => {
    const { service, wallets, refundBooking } = build({ confirmOutcome: 'NOT_PAYABLE' });
    await withAdapter(service, 'CAPTURED');
    expect(refundBooking).toHaveBeenCalledWith('b1', 100);
    expect(wallets.holdBookingRevenue).not.toHaveBeenCalled();
  });

  it('paiement arrivé après annulation de l\'envoi : remboursement intégral', async () => {
    const { service, shipmentsService, refundShipment } = build({
      paymentOf: 'shipment',
      shipmentStatus: ShipmentStatus.CANCELLED,
    });
    await withAdapter(service, 'CAPTURED');
    expect(refundShipment).toHaveBeenCalledWith('s1', 100);
    // La décision est prise par confirmPayment (atomique) : l'envoi annulé n'est pas ressuscité, et la décision « 100 % » est notée.
    expect(shipmentsService.confirmPayment).toHaveBeenCalledWith('s1');
  });

  it('paiement tardif dont le remboursement échoue : la capture reste enregistrée et la reprise automatique prend le relais', async () => {
    const { service, prisma } = build({ confirmOutcome: 'NOT_PAYABLE', refundFails: true });
    await expect(withAdapter(service, 'CAPTURED')).resolves.toEqual({ paymentId: 'pay1', status: PaymentStatus.CAPTURED });
    // Décision « rembourser 100 % » notée sur la réservation annulée (c'est ce que cherche RefundRecoveryService)…
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({ where: { id: 'b1', status: 'CANCELLED' }, data: { refundPercentage: 100 } });
    // …et le paiement ne repasse PAS en attente (sinon plus rien ne le rembourserait si le prestataire n'envoie pas de second webhook).
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.paymentTransaction.update).not.toHaveBeenCalled();
  });

  it('même chose pour un envoi annulé : décision notée, aucune annulation de la capture', async () => {
    const { service, prisma } = build({ paymentOf: 'shipment', shipmentStatus: ShipmentStatus.CANCELLED, refundFails: true });
    await expect(withAdapter(service, 'CAPTURED')).resolves.toEqual({ paymentId: 'pay1', status: PaymentStatus.CAPTURED });
    expect(prisma.shipment.updateMany).toHaveBeenCalledWith({ where: { id: 's1', status: 'CANCELLED' }, data: { refundPercentage: 100 } });
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  describe('contrôle du montant et de la devise annoncés par le prestataire', () => {
    it('montant différent de celui demandé : rien n\'est crédité, la transaction est marquée en échec', async () => {
      const { service, wallets, bookingsService, prisma } = build({ transaction: { amount: 115_000n } as never });
      await withAdapter(service, 'CAPTURED', { amount: 1_000n, currencyIsoCode: 'GNF' });
      expect(wallets.holdBookingRevenue).not.toHaveBeenCalled();
      expect(bookingsService.confirmPayment).not.toHaveBeenCalled();
      expect(prisma.paymentTransaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: PaymentStatus.FAILED }) }),
      );
    });

    it('devise différente : refusé de la même façon', async () => {
      const { service, wallets } = build({ transaction: { amount: 115_000n } as never });
      await withAdapter(service, 'CAPTURED', { amount: 115_000n, currencyIsoCode: 'XOF' });
      expect(wallets.holdBookingRevenue).not.toHaveBeenCalled();
    });

    it('montant et devise conformes : traité normalement', async () => {
      const { service, wallets } = build({ transaction: { amount: 115_000n } as never });
      await withAdapter(service, 'CAPTURED', { amount: 115_000n, currencyIsoCode: 'gnf' });
      expect(wallets.holdBookingRevenue).toHaveBeenCalledTimes(1);
    });
  });

  it('si le crédit du conducteur échoue, la transaction repasse en attente pour que le webhook rejoué la reprenne', async () => {
    const { service, prisma } = build({ holdFails: true });
    await expect(withAdapter(service, 'CAPTURED')).rejects.toThrow('portefeuille indisponible');
    expect(prisma.paymentTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: PaymentStatus.PENDING } }),
    );
    expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: PaymentStatus.PENDING } }));
  });

  describe('gain du conducteur sur un trajet : toujours son prix, promo ou non', () => {
    // prix du conducteur = 100 000 ; la commission est payée EN PLUS par le client et un rabais ne réduit qu'elle.
    const cases: Array<[string, bigint, bigint]> = [
      ['sans promo', 115_000n, 15_000n],
      ['promo de 10 000 sur la commission', 105_000n, 5_000n],
      ['promo qui annule toute la commission', 100_000n, 0n],
    ];

    it.each(cases)('%s : le conducteur touche 100 000', async (_label, totalAmount, platformFee) => {
      const { service, wallets } = build({ bookingAmounts: { totalAmount, platformFee } });
      await withAdapter(service, 'CAPTURED');

      const call = wallets.holdBookingRevenue.mock.calls[0][0];
      expect(call.grossAmount).toBe(totalAmount);
      expect(call.commission).toBe(platformFee);
      expect(call.grossAmount - call.commission).toBe(100_000n);
    });
  });
});
